// Live test of the code-edit trigger: a real `claude -p` session, with noonsight installed per account
// into a temporary Claude Code configuration directory and the real `claude` preset, whose requests go
// to a stand-in for the Messages API on a local port. The stand-in answers with a fixed script of tool
// calls and records every request, so the test sees exactly what reached the model after each tool
// result. It spends no usage and sends nothing to Anthropic: the API key is a placeholder.
//
//   npm run test:live
//     Needs `claude` on PATH; skipped without it.

import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runCli } from '../helpers.js';

const missing = spawnSync('claude', ['--version']).status !== 0;

/** One answer of the stand-in: a tool call, or a final text. */
type Step = { readonly tool: string; readonly input: Record<string, unknown> } | { readonly text: string };

interface Api {
  readonly url: string;
  /** The bodies of the requests of the session's main loop, the ones that offer the Edit tool, in order. */
  readonly requests: Record<string, any>[];
  close(): Promise<void>;
}

/** A local stand-in for the Messages API that plays the steps to the session's main loop, in order. */
async function standIn(steps: readonly Step[]): Promise<Api> {
  const requests: Record<string, any>[] = [];
  let next = 0;
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c: Buffer) => (raw += c.toString()));
    req.on('end', () => {
      let body: Record<string, any> = {};
      try {
        body = JSON.parse(raw) as Record<string, any>;
      } catch {
        // Not a request the test reads.
      }
      if (!(req.url ?? '').startsWith('/v1/messages') || (req.url ?? '').includes('count_tokens')) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ input_tokens: 1 }));
        return;
      }
      const main = Array.isArray(body.tools) && body.tools.some((t: { name?: string }) => t.name === 'Edit');
      if (main) requests.push(body);
      const step: Step = main ? (steps[next++] ?? { text: 'done' }) : { text: 'ok' };
      const id = `toolu_${requests.length}`;
      const content = 'tool' in step ? { type: 'tool_use', id, name: step.tool, input: step.input } : { type: 'text', text: step.text };
      const stop = 'tool' in step ? 'tool_use' : 'end_turn';
      const message = { id: `msg_${requests.length}`, type: 'message', role: 'assistant', model: body.model, stop_sequence: null };
      if (!body.stream) {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ...message, content: [content], stop_reason: stop, usage: { input_tokens: 1, output_tokens: 1 } }));
        return;
      }
      const event = (type: string, data: Record<string, unknown>): string => `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.end(
        event('message_start', { message: { ...message, content: [], stop_reason: null, usage: { input_tokens: 1, output_tokens: 1 } } }) +
          ('tool' in step
            ? event('content_block_start', { index: 0, content_block: { ...content, input: {} } }) +
              event('content_block_delta', { index: 0, delta: { type: 'input_json_delta', partial_json: JSON.stringify(step.input) } })
            : event('content_block_start', { index: 0, content_block: { type: 'text', text: '' } }) +
              event('content_block_delta', { index: 0, delta: { type: 'text_delta', text: step.text } })) +
          event('content_block_stop', { index: 0 }) +
          event('message_delta', { delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: 1 } }) +
          event('message_stop', {}),
      );
    });
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}`, requests, close: () => new Promise((done) => server.close(() => done())) };
}

/** Run claude and wait for it; the stand-in answers in this process, so the wait cannot block. */
function claude(args: readonly string[], cwd: string, env: Record<string, string>): Promise<{ status: number | null; output: string }> {
  return new Promise((done, fail) => {
    const child = spawn('claude', [...args], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (d: Buffer) => (output += d.toString()));
    child.stderr.on('data', (d: Buffer) => (output += d.toString()));
    const timer = setTimeout(() => child.kill('SIGKILL'), 180_000);
    child.on('error', fail);
    child.on('close', (status) => {
      clearTimeout(timer);
      done({ status, output });
    });
  });
}

/** The text of the messages that follow the result of a tool call, in a request. */
function after(request: Record<string, any>, toolUseId: string): string {
  const messages = request.messages as Record<string, any>[];
  const at = messages.findIndex((m) => JSON.stringify(m.content).includes(`"tool_use_id":"${toolUseId}"`));
  assert.ok(at >= 0, `no result of ${toolUseId} in the request`);
  return JSON.stringify(messages.slice(at));
}

test('live, no tokens: writing a report delivers nothing, and the first edit of a tracked code file delivers the verify rule once', { skip: missing, timeout: 300_000 }, async () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'noonsight-live-triggers-')));
  const home = path.join(root, 'home');
  const claudeDir = path.join(root, 'claude');
  const project = path.join(root, 'project');
  for (const d of [home, claudeDir, path.join(project, 'src'), path.join(project, 'docs')]) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(claudeDir, '.claude.json'), JSON.stringify({ hasCompletedOnboarding: true, projects: { [project]: { hasTrustDialogAccepted: true } } }));
  fs.writeFileSync(path.join(project, 'src', 'app.ts'), 'export const x = 1;\n');
  for (const args of [['init', '-q'], ['add', 'src/app.ts'], ['-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', 'app']])
    assert.equal(spawnSync('git', ['-C', project, ...args]).status, 0);
  const config = path.join(root, 'noonsight.json');
  fs.writeFileSync(config, JSON.stringify({ version: 1, models: { 'claude-sonnet-5-5': { use: 'preset' } } }));
  const installed = runCli(['install', '--account', claudeDir], { HOME: home, NOONSIGHT_CONFIG: config });
  assert.equal(installed.status, 0, installed.stderr);

  const app = path.join(project, 'src', 'app.ts');
  const api = await standIn([
    // An investigation that writes its findings as an HTML report.
    { tool: 'Write', input: { file_path: path.join(project, 'docs', 'findings.html'), content: '<p>The cause is x.</p>\n' } },
    { tool: 'Read', input: { file_path: app } },
    { tool: 'Edit', input: { file_path: app, old_string: 'x = 1', new_string: 'x = 2' } },
    { tool: 'Edit', input: { file_path: app, old_string: 'x = 2', new_string: 'x = 3' } },
    { text: 'done' },
  ]);
  try {
    const run = await claude(['-p', 'Fix x.', '--model', 'sonnet', '--allowedTools', 'Read Edit Write'], project, {
      PATH: process.env.PATH ?? '',
      HOME: home,
      LANG: 'en_US.UTF-8',
      CLAUDE_CONFIG_DIR: claudeDir,
      NOONSIGHT_CONFIG: config,
      ANTHROPIC_API_KEY: 'noonsight-live-test-placeholder',
      ANTHROPIC_BASE_URL: api.url,
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
      DISABLE_AUTOUPDATER: '1',
    });
    assert.equal(run.status, 0, run.output.slice(-2000));
  } finally {
    await api.close();
  }

  assert.equal(fs.readFileSync(app, 'utf8'), 'export const x = 3;\n', 'both edits ran');
  const [, afterWrite, afterRead, afterEdit, afterSecondEdit] = api.requests;
  assert.equal(api.requests.length, 5);
  const rule = 'sonnet-5-5/verify-changes';
  assert.doesNotMatch(after(afterWrite ?? {}, 'toolu_1'), new RegExp(rule), 'the report delivered nothing');
  assert.doesNotMatch(after(afterRead ?? {}, 'toolu_2'), new RegExp(rule));
  const delivered = after(afterEdit ?? {}, 'toolu_3');
  assert.match(delivered, /<noonsight-rules model=\\"claude-sonnet-5-5\\" trigger=\\"code-edit\\">/);
  assert.match(delivered, /A code change that can be executed, built or type-checked gets a real check/);
  assert.equal(JSON.stringify(afterSecondEdit).split(`rules ${rule}`).length - 1, 1, 'the second edit delivered nothing again');

  const log = fs
    .readFileSync(path.join(home, '.local', 'state', 'noonsight', 'decisions.jsonl'), 'utf8')
    .trimEnd()
    .split('\n')
    .map((l) => JSON.parse(l) as Record<string, any>);
  assert.deepEqual(
    log.map((d) => [d.event, d.model, d.delivered, d.trigger ?? null, d.file ?? null, d.tool_name ?? null, d.rules ?? null]),
    [
      ['session-start', 'claude-sonnet-5-5', 'nothing', null, null, null, null],
      ['file-edit', 'claude-sonnet-5-5', 'rules', 'code-edit', 'src/app.ts', 'Edit', [rule]],
    ],
  );
});
