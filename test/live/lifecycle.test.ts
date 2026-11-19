// Live test of the lifecycle sequences where a delivery used to go missing: interactive Claude Code
// sessions driven with expect (drive.exp) against a local stand-in for the Messages API (stub-api.ts),
// with noonsight installed per account and the real preset for every model. It sends nothing to
// Anthropic and costs no tokens, and it reads the request each sequence ends with.
//
//   npm run test:live
//     Needs `claude` and `expect` on PATH; skipped without them.
//
// The sequences:
//   - /model twice before any request: the first switch's return never reaches a request, so the
//     second one's note must say that the start's rules no longer apply.
//   - /model, then the end of the session before any request, then a resume on the new model: the
//     switch's return is lost with the process, so the resume must deliver again.
//   - a resume with no --model of a conversation that last answered on another model than the model
//     setting names: Claude Code resumes on the conversation's model, and so must the rules.

import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { PACKAGE_ROOT } from '../../src/config/paths.js';
import { runCli } from '../helpers.js';
import { startStub, type Stub } from './stub-api.js';

const missing = spawnSync('claude', ['--version']).status !== 0 || spawnSync('expect', ['-v']).status !== 0;
const DRIVER = path.join(PACKAGE_ROOT, 'test', 'live', 'drive.exp');
const MODELS = ['claude-fable-5-2', 'claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'];
const FINAL = 'LIFECYCLE-FINAL: reply ok';

interface Lab {
  readonly home: string;
  readonly claudeDir: string;
  readonly project: string;
  readonly probe: string;
  readonly stub: Stub;
  readonly env: Record<string, string>;
}

/** A fresh Claude Code configuration with noonsight installed and the preset for every model, unattended and with no scope. */
async function lab(): Promise<Lab> {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'noonsight-lifecycle-')));
  const [home, claudeDir, project, probe] = ['home', 'claude', 'project', 'probe'].map((d) => path.join(root, d)) as [string, string, string, string];
  for (const d of [home, claudeDir, project, probe]) fs.mkdirSync(d);
  fs.writeFileSync(path.join(claudeDir, '.claude.json'), JSON.stringify({ hasCompletedOnboarding: true, projects: { [project]: { hasTrustDialogAccepted: true } } }));
  const stop = { type: 'command', command: '/bin/sh', args: ['-c', 'cat > "$0/stop-$$.json"', probe], timeout: 10 };
  fs.writeFileSync(path.join(claudeDir, 'settings.json'), JSON.stringify({ theme: 'dark', hooks: { Stop: [{ hooks: [stop] }] } }));
  const config = path.join(root, 'noonsight.json');
  fs.writeFileSync(config, JSON.stringify({ version: 1, models: Object.fromEntries(MODELS.map((m) => [m, { use: 'preset' }])), session: { unattended_when_env: ['NOONSIGHT_LIFECYCLE'] } }));
  const installed = runCli(['install', '--account', claudeDir], { HOME: home, NOONSIGHT_CONFIG: config });
  assert.equal(installed.status, 0, installed.stderr);
  const stub = await startStub();
  const env = {
    PATH: process.env.PATH ?? '',
    HOME: home,
    TERM: 'xterm-256color',
    LANG: 'en_US.UTF-8',
    CLAUDE_CONFIG_DIR: claudeDir,
    NOONSIGHT_CONFIG: config,
    NOONSIGHT_LIFECYCLE: '1',
    DISABLE_AUTOUPDATER: '1',
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    CLAUDE_CODE_OAUTH_TOKEN: 'noonsight-lifecycle-placeholder',
    ANTHROPIC_BASE_URL: stub.url,
  };
  return { home, claudeDir, project, probe, stub, env };
}

/** One interactive session through the driver; fails the test when it does not finish its steps. */
async function drive(l: Lab, steps: readonly string[], args: readonly string[]): Promise<void> {
  const status = await new Promise<number | null>((resolve) => {
    const child = spawn('expect', [DRIVER, l.probe, ...steps, '--', ...args, '--permission-mode', 'default'], { cwd: l.project, env: l.env, stdio: 'ignore' });
    child.on('close', resolve);
  });
  assert.equal(status, 0, `the session did not finish its steps (expect exit ${status})`);
}

/** Everything the model reads in a request, in order: the system prompt, then every message's text. */
function requestText(body: Record<string, any>): string {
  const parts: string[] = [];
  const walk = (value: unknown): void => {
    if (typeof value === 'string') parts.push(value);
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value !== null && typeof value === 'object') {
      const v = value as Record<string, unknown>;
      if (typeof v.text === 'string') parts.push(v.text);
      else if (v.content !== undefined) walk(v.content);
    }
  };
  walk(body.system);
  walk(body.messages);
  return parts.join('\n');
}

/** The session's request for the final prompt: its model and what it reads. */
function finalRequest(stub: Stub): { model: string; text: string } {
  const r = stub.requests.filter((q) => Array.isArray(q.body.tools) && q.body.tools.length > 0 && requestText(q.body).includes(FINAL)).at(-1);
  assert.ok(r, 'no request for the final prompt');
  return { model: String(r.body.model), text: requestText(r.body) };
}

/** Whether a note that names the model comes after the model's last rules in the text. */
function retiredAfterLastCopy(text: string, model: string): boolean {
  const last = text.lastIndexOf(`<noonsight-rules model="${model}"`);
  for (const m of text.matchAll(/<noonsight-rules-change from="([^"]*)"/g))
    if ((m.index ?? 0) > last && m[1]?.split(' ').some((n) => n === model || n === '*')) return true;
  return false;
}

function decisions(l: Lab): Record<string, any>[] {
  const file = path.join(l.home, '.local', 'state', 'noonsight', 'decisions.jsonl');
  return fs
    .readFileSync(file, 'utf8')
    .trimEnd()
    .split('\n')
    .map((x) => JSON.parse(x) as Record<string, any>);
}

test('live, no tokens: /model twice before a request; the request after them holds no rules of the start\'s model without a note', { skip: missing, timeout: 300_000 }, async () => {
  const l = await lab();
  try {
    await drive(l, ['wait:8', 'type:/model sonnet', 'type:/model fable', `ask:${FINAL}`], ['--model', 'haiku']);
    const { model, text } = finalRequest(l.stub);
    assert.equal(model, 'claude-fable-5-2');
    assert.match(text, /<noonsight-rules model="claude-haiku-5-5"/, 'the start delivered Haiku\'s rules');
    assert.ok(retiredAfterLastCopy(text, 'claude-haiku-5-5'), 'a note after Haiku\'s rules says they no longer apply');
    assert.match(text, /<noonsight-rules model="claude-fable-5-2"/);
  } finally {
    await l.stub.close();
  }
});

test('live, no tokens: /model, then the end of the session, then a resume on the new model; the resume delivers the rules again', { skip: missing, timeout: 300_000 }, async () => {
  const l = await lab();
  try {
    await drive(l, ['wait:8', 'ask:LIFECYCLE-FIRST: reply ok', 'type:/model haiku', 'type:', 'wait:3'], ['--model', 'fable']);
    await drive(l, ['wait:8', `ask:${FINAL}`], ['--continue', '--model', 'haiku']);
    const { model, text } = finalRequest(l.stub);
    assert.equal(model, 'claude-haiku-5-5');
    assert.match(text, /<noonsight-rules model="claude-haiku-5-5"/, 'Haiku\'s rules reach the resumed conversation');
    assert.ok(retiredAfterLastCopy(text, 'claude-fable-5-2'), 'a note after Fable\'s rules says they no longer apply');
    assert.equal(decisions(l).at(-1)?.unconfirmed_switch, true);
  } finally {
    await l.stub.close();
  }
});

test('live, no tokens: a resume with no --model runs on the conversation\'s model over the model setting, and so do the rules', { skip: missing, timeout: 300_000 }, async () => {
  const l = await lab();
  try {
    await drive(l, ['wait:8', 'ask:LIFECYCLE-FIRST: reply ok'], ['--model', 'opus']);
    // A /model in any session leaves its choice as the model setting.
    const settingsFile = path.join(l.claudeDir, 'settings.json');
    fs.writeFileSync(settingsFile, JSON.stringify({ ...(JSON.parse(fs.readFileSync(settingsFile, 'utf8')) as Record<string, unknown>), model: 'haiku' }));
    await drive(l, ['wait:8', `ask:${FINAL}`], ['--continue']);
    const { model, text } = finalRequest(l.stub);
    assert.equal(model, 'claude-opus-5-5', 'Claude Code resumes the conversation on its own model');
    assert.doesNotMatch(text, /<noonsight-rules model="claude-haiku-5-5"/);
    assert.match(text, /<noonsight-rules model="claude-opus-5-5"/);
    const resumed = decisions(l).filter((d) => d.event === 'session-start').at(-1);
    assert.deepEqual([resumed?.source, resumed?.model, resumed?.model_source, resumed?.delivered], ['resume', 'claude-opus-5-5', 'session-transcript', 'already-delivered']);
  } finally {
    await l.stub.close();
  }
});
