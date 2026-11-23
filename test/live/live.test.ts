// Live tests: real interactive Claude Code sessions, driven through a terminal with expect, with
// noonsight installed per account into a temporary Claude Code configuration directory. Nothing here
// touches the account of the person running it.
//
//   npm run test:live
//     Needs `claude` and `expect` on PATH; fails when either is missing. Sends no prompt and no
//     request to Anthropic: a placeholder token gets Claude Code past sign-in and the API address
//     points at a closed local port. It proves that Claude Code runs the hooks on startup, /model and
//     /clear, with the inputs the adapter expects, shows noonsight's warnings, and tells its hooks
//     whether the session runs headless (CLAUDE_CODE_SESSION_ATTENDED), which decides the place.
//
//   NOONSIGHT_LIVE_TOKENS=1 CLAUDE_CODE_OAUTH_TOKEN=... npm run test:live
//     Also asks the models which rules they received; this spends a little usage on the account the
//     token belongs to. The token is passed to claude through the environment only and is never
//     written to a file. Create one with `claude setup-token`.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { PACKAGE_ROOT } from '../../src/config/paths.js';
import { runCli, tempTree } from '../helpers.js';

const DRIVER = path.join(PACKAGE_ROOT, 'test', 'live', 'drive.exp');
const SONNET_WORD = 'SONNET-LIVE-4127';
const OPUS_WORD = 'OPUS-LIVE-7350';
const QUESTION =
  'Reply with only the verification words of the noonsight working rules that apply to you now, separated by spaces, ' +
  'or the single word NONE when there are none. Do not use any tool.';

const tools = ['claude', 'expect'].filter((t) => spawnSync(t, t === 'expect' ? ['-v'] : ['--version']).status !== 0);
const withTokens = process.env.NOONSIGHT_LIVE_TOKENS === '1';

interface Lab {
  readonly home: string;
  readonly claudeDir: string;
  readonly project: string;
  readonly probe: string;
  /** sonnet and opus have rules, haiku is declared "none". */
  readonly config: string;
  /** haiku is not declared. */
  readonly undeclared: string;
  /** refused: a rule file is missing. */
  readonly invalid: string;
  log(): Record<string, any>[];
  answers(): string[];
}

function lab(): Lab {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'noonsight-live-')));
  const home = path.join(root, 'home');
  const claudeDir = path.join(root, 'claude');
  const project = path.join(root, 'project');
  const probe = path.join(root, 'probe');
  for (const d of [home, claudeDir, project, probe]) fs.mkdirSync(d);
  // A fresh Claude Code configuration directory that opens straight into the session.
  fs.writeFileSync(
    path.join(claudeDir, '.claude.json'),
    JSON.stringify({ hasCompletedOnboarding: true, projects: { [project]: { hasTrustDialogAccepted: true } } }),
  );
  // A Stop hook that records each answer, next to noonsight's own entries.
  const stop = { type: 'command', command: '/bin/sh', args: ['-c', 'cat > "$0/stop-$$.json"', probe], timeout: 10 };
  fs.writeFileSync(path.join(claudeDir, 'settings.json'), JSON.stringify({ theme: 'dark', hooks: { Stop: [{ hooks: [stop] }] } }));

  const rules = tempTree({
    'sonnet.md': `- The verification word for claude-sonnet-5-5 is ${SONNET_WORD}.`,
    'opus.md': `- The verification word for claude-opus-5-5 is ${OPUS_WORD}.`,
  });
  const write = (name: string, models: Record<string, unknown>): string => {
    const file = path.join(rules, name);
    fs.writeFileSync(file, JSON.stringify({ version: 1, models }));
    return file;
  };
  const sonnet = { use: 'custom', add: [{ id: 'live/sonnet', file: 'sonnet.md' }] };
  const opus = { use: 'custom', add: [{ id: 'live/opus', file: 'opus.md' }] };
  const config = write('noonsight.json', { 'claude-sonnet-5-5': sonnet, 'claude-opus-5-5': opus, 'claude-haiku-5-5': { use: 'none' } });
  const undeclared = write('undeclared.json', { 'claude-sonnet-5-5': sonnet });
  const invalid = write('invalid.json', { 'claude-sonnet-5-5': { use: 'custom', add: [{ id: 'x', file: 'missing.md' }] } });

  const installed = runCli(['install', '--account', claudeDir], { HOME: home, NOONSIGHT_CONFIG: config });
  assert.equal(installed.status, 0, installed.stderr);

  return {
    home,
    claudeDir,
    project,
    probe,
    config,
    undeclared,
    invalid,
    log() {
      const file = path.join(home, '.local', 'state', 'noonsight', 'decisions.jsonl');
      return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trimEnd().split('\n').map((l) => JSON.parse(l)) : [];
    },
    answers() {
      return fs
        .readdirSync(probe)
        .map((f) => path.join(probe, f))
        .sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs)
        .map((f) => String(JSON.parse(fs.readFileSync(f, 'utf8')).last_assistant_message ?? ''));
    },
  };
}

interface Run {
  readonly status: number | null;
  /** The screen text with terminal control sequences and all whitespace removed, for matching words. */
  readonly screen: string;
}

function sessionEnv(l: Lab, config: string, tokens: boolean): Record<string, string> {
  const env: Record<string, string> = {
    PATH: process.env.PATH ?? '',
    HOME: l.home,
    TERM: 'xterm-256color',
    LANG: 'en_US.UTF-8',
    CLAUDE_CONFIG_DIR: l.claudeDir,
    NOONSIGHT_CONFIG: config,
    DISABLE_AUTOUPDATER: '1',
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
  };
  if (tokens) env.CLAUDE_CODE_OAUTH_TOKEN = process.env.CLAUDE_CODE_OAUTH_TOKEN ?? '';
  else {
    env.CLAUDE_CODE_OAUTH_TOKEN = 'noonsight-live-test-placeholder';
    env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:9';
  }
  return env;
}

function session(l: Lab, config: string, steps: readonly string[], claudeArgs: readonly string[], tokens: boolean): Run {
  const env = sessionEnv(l, config, tokens);
  const r = spawnSync('expect', [DRIVER, l.probe, ...steps, '--', ...claudeArgs], { cwd: l.project, env, encoding: 'utf8', timeout: 600_000 });
  const screen = (r.stdout + r.stderr)
    .replace(/\x1b\][^\x07]*\x07/g, '')
    .replace(/\x1b\[[0-9;?<>]*[a-zA-Z]/g, '')
    .replace(/\x1b[()][A-Z0-9]/g, '')
    .replace(/\s+/g, '');
  return { status: r.status, screen };
}

const squeeze = (s: string): string => s.replace(/\s+/g, '');
const pick = (log: Record<string, any>[]): unknown[][] =>
  log.map((d) => [d.event, d.source, d.model ?? null, d.model_source ?? null, d.status, d.delivered, d.warned]);
/** Where each decision placed the session, and why it was unattended. */
const places = (log: Record<string, any>[]): unknown[][] => log.map((d) => [d.event, d.place ?? null, d.unattended_because ?? null]);

test('live, no tokens: claude and expect are installed', () => {
  assert.deepEqual(tools, [], `missing on PATH: ${tools.join(', ')}`);
});

test('live, no tokens: startup, /model and /clear run the hooks with the inputs noonsight expects', { skip: tools.length > 0 }, () => {
  const l = lab();
  const r = session(l, l.config, ['wait:12', 'type:/model opus', 'type:/model haiku', 'type:/clear', 'wait:4'], ['--model', 'sonnet'], false);
  assert.equal(r.status, 0, r.screen.slice(-2000));
  assert.doesNotMatch(r.screen, /hookerror/i, r.screen.slice(-2000));
  assert.deepEqual(pick(l.log()), [
    ['session-start', 'startup', 'claude-sonnet-5-5', 'hook-input', 'matched', 'rules', false],
    ['model-switch', 'command', 'claude-opus-5-5', 'hook-input', 'matched', 'rules+note', false],
    ['model-switch', 'command', 'claude-haiku-5-5', 'hook-input', 'none', 'note', false],
    ['session-start', 'clear', 'claude-haiku-5-5', 'process-record', 'none', 'nothing', false],
  ]);
  // An interactive session is a watched one: Claude Code gives its hooks CLAUDE_CODE_SESSION_ATTENDED=1.
  assert.deepEqual(places(l.log()), [
    ['session-start', 'attended', null],
    ['model-switch', 'attended', null],
    ['model-switch', 'attended', null],
    ['session-start', 'attended', null],
  ]);
});

test('live, no tokens: an undeclared model and a refused configuration warn on screen and never stop the session', { skip: tools.length > 0 }, () => {
  const l = lab();
  const undeclared = session(l, l.undeclared, ['wait:12'], ['--model', 'haiku'], false);
  assert.equal(undeclared.status, 0, undeclared.screen.slice(-2000));
  assert.ok(undeclared.screen.includes(squeeze('claude-haiku-5-5 is not declared')), undeclared.screen.slice(-2000));
  const invalid = session(l, l.invalid, ['wait:12'], ['--model', 'haiku'], false);
  assert.equal(invalid.status, 0, invalid.screen.slice(-2000));
  assert.ok(invalid.screen.includes(squeeze('was refused (1 problem), so no rules were delivered')), invalid.screen.slice(-2000));
  assert.deepEqual(pick(l.log()), [
    ['session-start', 'startup', 'claude-haiku-5-5', 'hook-input', 'undeclared', 'nothing', true],
    ['session-start', 'startup', null, null, 'config-invalid', 'nothing', true],
  ]);
});

test('live, no tokens: claude -p reports no model, and the hook takes it from --model, ANTHROPIC_MODEL or the model setting', { skip: tools.length > 0 }, () => {
  const l = lab();
  // The run fails at its first request to the closed port; SessionStart has run by then.
  const print = (args: readonly string[], extra: Record<string, string> = {}): void => {
    spawnSync('claude', ['-p', 'hello', ...args], {
      cwd: l.project,
      env: { ...sessionEnv(l, l.config, false), CLAUDE_CODE_MAX_RETRIES: '0', ...extra },
      encoding: 'utf8',
      timeout: 120_000,
    });
  };
  print(['--model', 'sonnet']);
  print([], { ANTHROPIC_MODEL: 'claude-opus-5-5' });
  const settingsFile = path.join(l.claudeDir, 'settings.json');
  fs.writeFileSync(settingsFile, JSON.stringify({ ...JSON.parse(fs.readFileSync(settingsFile, 'utf8')), model: 'haiku' }));
  print([]);
  assert.deepEqual(pick(l.log()), [
    ['session-start', 'startup', 'claude-sonnet-5-5', 'claude-args', 'matched', 'rules', false],
    ['session-start', 'startup', 'claude-opus-5-5', 'env', 'matched', 'rules', false],
    ['session-start', 'startup', 'claude-haiku-5-5', 'settings', 'none', 'nothing', false],
  ]);
  // A -p run is headless: Claude Code gives its hooks CLAUDE_CODE_SESSION_ATTENDED=0, so with no
  // configuration for it the session is unattended. This fails if a Claude Code version drops the signal.
  assert.deepEqual(places(l.log()), [
    ['session-start', 'unattended', 'headless'],
    ['session-start', 'unattended', 'headless'],
    ['session-start', 'unattended', 'headless'],
  ]);
});

test('live, with tokens: the models answer with the rules they received, and /model switches them', { skip: !withTokens }, () => {
  assert.deepEqual(tools, [], `missing on PATH: ${tools.join(', ')}`);
  assert.ok(process.env.CLAUDE_CODE_OAUTH_TOKEN, 'NOONSIGHT_LIVE_TOKENS=1 needs CLAUDE_CODE_OAUTH_TOKEN in the environment');
  const l = lab();
  const ask = `ask:${QUESTION}`;

  const switching = session(l, l.config, ['wait:12', ask, 'type:/model opus', ask], ['--model', 'sonnet'], true);
  assert.equal(switching.status, 0, switching.screen.slice(-2000));
  const none = session(l, l.config, ['wait:12', ask], ['--model', 'haiku'], true);
  assert.equal(none.status, 0, none.screen.slice(-2000));
  const undeclared = session(l, l.undeclared, ['wait:12', ask], ['--model', 'haiku'], true);
  assert.equal(undeclared.status, 0, undeclared.screen.slice(-2000));
  const invalid = session(l, l.invalid, ['wait:12', ask], ['--model', 'haiku'], true);
  assert.equal(invalid.status, 0, invalid.screen.slice(-2000));

  const [onSonnet, onOpus, onNone, onUndeclared, onInvalid] = l.answers();
  assert.match(onSonnet ?? '', new RegExp(SONNET_WORD));
  assert.match(onOpus ?? '', new RegExp(OPUS_WORD));
  assert.doesNotMatch(onOpus ?? '', new RegExp(SONNET_WORD), 'after /model, the earlier rules no longer apply');
  for (const answer of [onNone, onUndeclared, onInvalid]) assert.match((answer ?? '').trim(), /^NONE\.?$/);
  assert.deepEqual(
    l.log().map((d) => [d.event, d.model ?? null, d.status, d.delivered]),
    [
      ['session-start', 'claude-sonnet-5-5', 'matched', 'rules'],
      ['model-switch', 'claude-opus-5-5', 'matched', 'rules+note'],
      ['session-start', 'claude-haiku-5-5', 'none', 'nothing'],
      ['session-start', 'claude-haiku-5-5', 'undeclared', 'nothing'],
      ['session-start', null, 'config-invalid', 'nothing'],
    ],
  );
});
