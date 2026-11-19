// A local stand-in for the Anthropic Messages API for the delivery benchmark. It answers every request
// from the request alone and keeps no script, so any subsequence of a session still runs, which the
// shrinker needs; it hands each request to a listener before it answers.
//
// The last user message of a session's request may carry a directive the driver typed:
//   DB <n> turn                       a short text that ends the turn
//   DB <n> spawn <type>.<model> ...   one agent call per item, all in one response ("-" for no model)
//   DB <n> edit code|doc|new          a Read then an Edit of the tracked code file or the tracked
//                                     document, or a Write of a new code file
// A subagent's own request (its first user message holds DB-SUB) gets a short text, and so does the
// summary request of a compaction.

import http from 'node:http';
import type { AddressInfo } from 'node:net';

/** The project's files the sessions edit, relative to the project. */
export const FILES = { code: 'src/app.ts', doc: 'docs/notes.md', new: 'src/fresh.ts' } as const;

/** The line every edit replaces, present in both tracked files. */
export const ANCHOR = 'DB-ANCHOR';

export type Body = Record<string, any>;

interface Block {
  readonly type: string;
  readonly [key: string]: unknown;
}

export interface Answer {
  readonly content: readonly Block[];
  readonly stop: 'end_turn' | 'tool_use';
  /** The usage the reply reports, from which Claude Code computes the session's cost; a token or so when absent. */
  readonly usage?: { readonly input_tokens: number; readonly output_tokens: number };
}

function blocks(message: Body | undefined): Block[] {
  if (!message) return [];
  return typeof message.content === 'string' ? [{ type: 'text', text: message.content }] : ((message.content ?? []) as Block[]);
}

function text(message: Body | undefined): string {
  return blocks(message)
    .filter((b) => b.type === 'text')
    .map((b) => String(b.text))
    .join('\n');
}

let calls = 0;

function call(name: string, input: Record<string, unknown>): Block {
  return { type: 'tool_use', id: `toolu_db_${process.pid.toString(36)}_${(calls++).toString(36)}`, name, input };
}

/** Whether a request is the summary Claude Code asks for when it compacts a conversation. */
export function isCompaction(body: Body): boolean {
  const users = ((body.messages ?? []) as Body[]).filter((m) => m.role === 'user');
  return /Respond with TEXT ONLY/.test(text(users.at(-1)));
}

/** The reply to one request. `project` is the session's project directory, for the paths it edits. */
export function reply(body: Body, project: string): Answer {
  const messages = (body.messages ?? []) as Body[];
  const users = messages.filter((m) => m.role === 'user');
  const last = users.at(-1);
  const say = (t: string): Answer => ({ content: [{ type: 'text', text: t }], stop: 'end_turn' });
  if (text(users[0]).includes('DB-SUB')) return say('done');
  if (isCompaction(body)) return say('<summary>\nThe user asked for short replies and got them.\n</summary>');
  if (blocks(last).some((b) => b.type === 'tool_result')) {
    // The second half of an edit: the file was read, now it is edited.
    const lastAssistant = messages.filter((m) => m.role === 'assistant').at(-1);
    const read = blocks(lastAssistant).find((b) => b.type === 'tool_use' && b.name === 'Read');
    if (read) {
      const file = String((read.input as Record<string, unknown> | undefined)?.file_path ?? '');
      return { content: [call('Edit', { file_path: file, old_string: ANCHOR, new_string: `${ANCHOR}\n// edited ${calls}` })], stop: 'tool_use' };
    }
    return say('done');
  }
  const d = /DB (\d+) (\w+)([^\n]*)/.exec(text(last));
  if (!d) return say('ok');
  const [, n, kind, rest = ''] = d;
  if (kind === 'spawn') {
    const names = ((body.tools ?? []) as { name?: string }[]).map((t) => t.name);
    const tool = names.includes('Agent') ? 'Agent' : 'Task';
    const items = rest.trim().split(/\s+/).filter(Boolean);
    const content = items.map((item, i) => {
      const [type = 'general-purpose', model] = item.split('.');
      const input: Record<string, unknown> = { description: `db sub ${n} ${i}`, prompt: `DB-SUB ${n} ${i} ${type}: reply with the word done.`, subagent_type: type };
      if (model && model !== '-') input.model = model;
      return call(tool, input);
    });
    return { content, stop: 'tool_use' };
  }
  if (kind === 'edit') {
    const target = rest.trim();
    if (target === 'new') return { content: [call('Write', { file_path: `${project}/${FILES.new.replace('.ts', `-${n}.ts`)}`, content: `export const fresh${n} = ${n};\n` })], stop: 'tool_use' };
    return { content: [call('Read', { file_path: `${project}/${target === 'doc' ? FILES.doc : FILES.code}` })], stop: 'tool_use' };
  }
  return say('ok');
}

function sse(res: http.ServerResponse, model: string, r: Answer): void {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
  const send = (event: string, data: unknown): void => void res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  const usage = { input_tokens: r.usage?.input_tokens ?? 10, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };
  send('message_start', { type: 'message_start', message: { id: `msg_db_${calls++}`, type: 'message', role: 'assistant', model, content: [], stop_reason: null, stop_sequence: null, usage } });
  r.content.forEach((b, index) => {
    if (b.type === 'text') {
      send('content_block_start', { type: 'content_block_start', index, content_block: { type: 'text', text: '' } });
      send('content_block_delta', { type: 'content_block_delta', index, delta: { type: 'text_delta', text: b.text } });
    } else {
      send('content_block_start', { type: 'content_block_start', index, content_block: { type: 'tool_use', id: b.id, name: b.name, input: {} } });
      send('content_block_delta', { type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: JSON.stringify(b.input) } });
    }
    send('content_block_stop', { type: 'content_block_stop', index });
  });
  send('message_delta', { type: 'message_delta', delta: { stop_reason: r.stop, stop_sequence: null }, usage: { output_tokens: r.usage?.output_tokens ?? 5 } });
  send('message_stop', { type: 'message_stop' });
  res.end();
}

function json(res: http.ServerResponse, model: string, r: Answer): void {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(
    JSON.stringify({
      id: `msg_db_${calls++}`,
      type: 'message',
      role: 'assistant',
      model,
      content: r.content,
      stop_reason: r.stop,
      stop_sequence: null,
      usage: { input_tokens: r.usage?.input_tokens ?? 10, output_tokens: r.usage?.output_tokens ?? 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    }),
  );
}

export interface Stub {
  readonly url: string;
  /** The Messages requests answered so far. */
  readonly count: number;
  close(): Promise<void>;
}

/** Start the stub on a free local port. `onRequest` sees every Messages request and its answer before the answer is sent. */
export function startStub(project: string, onRequest: (body: Body, answer: Answer) => void): Promise<Stub> {
  return serveMessages((body) => reply(body, project), onRequest);
}

/**
 * A local Messages API on a free port that answers each request with `respond`, streamed when the
 * request asks for a stream; `onRequest` sees every Messages request and its answer before the answer
 * is sent. Token counting answers a fixed count, and any other method is refused.
 */
export async function serveMessages(respond: (body: Body) => Answer, onRequest: (body: Body, answer: Answer) => void = () => undefined): Promise<Stub> {
  let count = 0;
  const server = http.createServer((req, res) => {
    let raw = '';
    req.setEncoding('utf8').on('data', (d: string) => (raw += d));
    req.on('end', () => {
      const path = (req.url ?? '').split('?')[0] ?? '';
      let body: Body = {};
      try {
        body = raw ? (JSON.parse(raw) as Body) : {};
      } catch {
        // Answered as an empty request.
      }
      if (req.method !== 'POST') {
        res.writeHead(404).end();
        return;
      }
      if (path.endsWith('/count_tokens')) {
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ input_tokens: 1000 }));
        return;
      }
      count++;
      const answer = respond(body);
      try {
        onRequest(body, answer);
      } catch (e) {
        console.error('the stub listener failed', e);
      }
      const model = String(body.model ?? 'claude-sonnet-5-5');
      if (body.stream) sse(res, model, answer);
      else json(res, model, answer);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    get count() {
      return count;
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
