// A local stand-in for the Anthropic Messages API, for live tests that must send nothing to Anthropic
// and still drive Claude Code through real turns. It records every request it receives, and answers
// with fixed replies chosen from the request's last user message:
//
// - "PROBE-STEP spawn <type>": a call of the agent tool that starts a subagent of that type, whose
//   task carries "PROBE-SUBAGENT-TASK <type>";
// - a request whose first user message holds "PROBE-SUBAGENT-TASK" (the subagent's own turn), a
//   tool result, or anything else: a short text that ends the turn.
//
// Replies stream as server-sent events when the request asks for a stream, as Claude Code's main
// loop does, and come back as one JSON message otherwise.

import http from 'node:http';
import type { AddressInfo } from 'node:net';

export interface Recorded {
  readonly path: string;
  readonly body: Record<string, any>;
}

export interface Stub {
  readonly url: string;
  readonly requests: Recorded[];
  close(): Promise<void>;
}

function blocks(message: Record<string, any> | undefined): Record<string, any>[] {
  if (!message) return [];
  return typeof message.content === 'string' ? [{ type: 'text', text: message.content }] : ((message.content ?? []) as Record<string, any>[]);
}

function text(message: Record<string, any> | undefined): string {
  return blocks(message)
    .filter((b) => b.type === 'text')
    .map((b) => String(b.text))
    .join('\n');
}

/** The reply to one request: a text that ends the turn, or a call that starts a subagent. */
export function reply(body: Record<string, any>): { kind: 'text'; text: string } | { kind: 'agent'; tool: string; input: Record<string, string> } {
  const messages = (body.messages ?? []) as Record<string, any>[];
  const users = messages.filter((m) => m.role === 'user');
  const last = users.at(-1);
  if (text(users[0]).includes('PROBE-SUBAGENT-TASK') || blocks(last).some((b) => b.type === 'tool_result')) return { kind: 'text', text: 'done' };
  const spawn = /PROBE-STEP spawn ([\w-]+)/.exec(text(last));
  if (spawn) {
    const names = ((body.tools ?? []) as { name?: string }[]).map((t) => t.name);
    const tool = names.includes('Agent') ? 'Agent' : 'Task';
    const type = spawn[1] as string;
    return { kind: 'agent', tool, input: { description: `probe ${type}`, prompt: `PROBE-SUBAGENT-TASK ${type}: reply with the word done.`, subagent_type: type } };
  }
  return { kind: 'text', text: 'ok' };
}

function sse(res: http.ServerResponse, model: string, r: ReturnType<typeof reply>): void {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
  const send = (event: string, data: unknown): void => void res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  const usage = { input_tokens: 10, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 };
  send('message_start', { type: 'message_start', message: { id: `msg_${Date.now()}`, type: 'message', role: 'assistant', model, content: [], stop_reason: null, stop_sequence: null, usage } });
  if (r.kind === 'text') {
    send('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
    send('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: r.text } });
  } else {
    send('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: `toolu_${Date.now()}`, name: r.tool, input: {} } });
    send('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: JSON.stringify(r.input) } });
  }
  send('content_block_stop', { type: 'content_block_stop', index: 0 });
  send('message_delta', { type: 'message_delta', delta: { stop_reason: r.kind === 'text' ? 'end_turn' : 'tool_use', stop_sequence: null }, usage: { output_tokens: 5 } });
  send('message_stop', { type: 'message_stop' });
  res.end();
}

function json(res: http.ServerResponse, model: string, r: ReturnType<typeof reply>): void {
  const content = r.kind === 'text' ? [{ type: 'text', text: r.text }] : [{ type: 'tool_use', id: `toolu_${Date.now()}`, name: r.tool, input: r.input }];
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ id: `msg_${Date.now()}`, type: 'message', role: 'assistant', model, content, stop_reason: r.kind === 'text' ? 'end_turn' : 'tool_use', stop_sequence: null, usage: { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } }));
}

/** Start the stub on a free local port. */
export async function startStub(): Promise<Stub> {
  const requests: Recorded[] = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.setEncoding('utf8').on('data', (d: string) => (raw += d));
    req.on('end', () => {
      const path = (req.url ?? '').split('?')[0] ?? '';
      let body: Record<string, any> = {};
      try {
        body = raw ? (JSON.parse(raw) as Record<string, any>) : {};
      } catch {
        // Recorded as empty.
      }
      if (req.method !== 'POST') {
        res.writeHead(404).end();
        return;
      }
      if (path.endsWith('/count_tokens')) {
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ input_tokens: 1000 }));
        return;
      }
      requests.push({ path, body });
      const model = String(body.model ?? 'claude-sonnet-5-5');
      const r = reply(body);
      if (body.stream) sse(res, model, r);
      else json(res, model, r);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
