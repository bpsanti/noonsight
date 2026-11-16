// What the live tests that run from the login of the person running them share: real Claude Code
// sessions with sextant's hooks given through --settings. They send prompts to the models, so they
// spend a little usage, and they only run when asked:
//
//   SEXTANT_LIVE_LOGIN=1 npm run test:live
//
// Needs `claude`, logged in (`claude auth status`), and `expect`. Each session uses the person's own
// Claude Code configuration directory (CLAUDE_CONFIG_DIR, or ~/.claude) for the login only: sextant
// is not installed there, the hook entries come from a temporary --settings file, and
// --setting-sources project,local keeps the person's own settings, hooks included, out of these
// sessions. No token is read or passed. Claude Code still records the sessions in that directory as
// it records any session, and an interactive case answers the folder trust question for the
// temporary project there.
//
// sextant's own state goes to a temporary home: the hook entries run a copy of the hook pointer that
// sets HOME for sextant alone.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readSettings } from '../../src/adapters/claude-code/install.js';
import { managedTarget } from '../../src/adapters/claude-code/locations.js';
import { findSextantHandlers, withSextantHooks } from '../../src/adapters/claude-code/settings.js';
import { CLI_FILE } from '../../src/config/paths.js';

export const enabled = process.env.SEXTANT_LIVE_LOGIN === '1';

export interface Lab {
  readonly root: string;
  /** sextant's home: the decision log lands here. */
  readonly home: string;
  readonly project: string;
  readonly probe: string;
  readonly settings: string;
  log(): Record<string, any>[];
  answers(): string[];
}

/** What the tests need on this machine, and nothing that would run sextant's hooks in the test sessions a second time. */
export function preconditions(): void {
  for (const [tool, args] of [
    ['claude', ['--version']],
    ['expect', ['-v']],
  ] as const)
    assert.equal(spawnSync(tool, [...args]).status, 0, `${tool} is not on PATH`);
  const auth = spawnSync('claude', ['auth', 'status'], { env: baseEnv(), encoding: 'utf8' });
  assert.equal(auth.status, 0, 'claude is not logged in for this account: run `claude` once and sign in, or `claude auth login`');
  // Machine-wide hooks run in every session and cannot be left out by --setting-sources.
  let managed = null;
  try {
    managed = managedTarget(process.env);
  } catch {
    // An unsupported system has no machine-wide install.
  }
  if (managed !== null && fs.existsSync(managed.settingsFile))
    assert.equal(
      findSextantHandlers(readSettings(managed.settingsFile)).length,
      0,
      `sextant is installed machine-wide (${managed.settingsFile}); its hooks would run in the test sessions too. Run these tests where it is not.`,
    );
}

/** The environment Claude Code needs to reach the person's login, and nothing from the shell that runs the tests. */
export function baseEnv(): Record<string, string> {
  const env: Record<string, string> = { DISABLE_AUTOUPDATER: '1', LANG: 'en_US.UTF-8', TERM: 'xterm-256color' };
  for (const name of ['PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'TMPDIR', 'CLAUDE_CONFIG_DIR']) {
    const value = process.env[name];
    if (value) env[name] = value;
  }
  return env;
}

/**
 * A temporary lab: the configuration and its rule files in rules/, a hook pointer that runs this
 * copy of sextant with the lab's home and configuration, and a --settings file with sextant's hook
 * entries plus a Stop hook that records each answer of an interactive session.
 */
export function lab(name: string, config: Record<string, unknown>, rules: Record<string, string>): Lab {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `sextant-live-${name}-`)));
  const home = path.join(root, 'home');
  const project = path.join(root, 'project');
  const probe = path.join(root, 'probe');
  const bin = path.join(root, 'bin');
  const rulesDir = path.join(root, 'rules');
  for (const d of [home, project, probe, bin, rulesDir]) fs.mkdirSync(d);
  for (const [file, text] of Object.entries(rules)) fs.writeFileSync(path.join(rulesDir, file), text);
  fs.writeFileSync(path.join(rulesDir, 'sextant.json'), JSON.stringify(config));

  // The hook pointer as install writes it, except that sextant's home is the lab's.
  const pointer = path.join(bin, 'sextant-hook');
  fs.writeFileSync(
    pointer,
    `#!/bin/sh\nHOME=${quote(home)} SEXTANT_CONFIG=${quote(path.join(rulesDir, 'sextant.json'))} exec ${quote(process.execPath)} ${quote(fs.realpathSync(CLI_FILE))} hook --install account "$@"\n`,
    { mode: 0o755 },
  );
  const stop = { type: 'command', command: '/bin/sh', args: ['-c', 'cat > "$0/stop-$$.json"', probe], timeout: 10 };
  const settings = path.join(root, 'settings.json');
  fs.writeFileSync(settings, JSON.stringify(withSextantHooks({ hooks: { Stop: [{ hooks: [stop] }] } }, pointer).settings, null, 2));

  return {
    root,
    home,
    project,
    probe,
    settings,
    log() {
      const file = path.join(home, '.local', 'state', 'sextant', 'decisions.jsonl');
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

function quote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/** The claude options every session shares: the lab's hooks, none of the person's own settings files. Sonnet unless `extra` names a --model. */
export function claudeArgs(l: Lab, extra: readonly string[] = []): string[] {
  const model = extra.includes('--model') ? [] : ['--model', 'sonnet'];
  // A fixed permission mode: in auto mode a classifier reviews each agent call sextant leaves unchanged.
  return [...model, '--permission-mode', 'default', '--setting-sources', 'project,local', '--settings', l.settings, '--allowedTools', 'Agent', ...extra];
}

export interface PrintRun {
  readonly status: number | null;
  /** The session's final answer. */
  readonly result: string;
  /** Every stream event, for the messages sextant showed. */
  readonly stream: Record<string, any>[];
}

/** One `claude -p` session in the lab; `env` adds to the login's environment. */
export function print(l: Lab, prompt: string, extra: readonly string[] = [], env: Record<string, string> = {}): PrintRun {
  const r = spawnSync('claude', ['-p', prompt, '--output-format', 'stream-json', '--verbose', ...claudeArgs(l, extra)], {
    cwd: l.project,
    env: { ...baseEnv(), ...env },
    encoding: 'utf8',
    timeout: 600_000,
  });
  const stream = r.stdout
    .split('\n')
    .filter((line) => line.startsWith('{'))
    .map((line) => JSON.parse(line) as Record<string, any>);
  const result = String(stream.filter((e) => e.type === 'result').at(-1)?.result ?? '');
  fs.writeFileSync(path.join(l.root, 'stream.jsonl'), r.stdout);
  return { status: r.status, result, stream };
}

/** The reply a line of the form "name=<reply> other=<reply>" gives for one name. */
export function reply(line: string, name: string): string {
  const m = new RegExp(`${name}=(.*?)(?=\\s+[a-z]+=|$)`, 's').exec(line);
  return (m?.[1] ?? '').trim();
}

export const calls = (log: Record<string, any>[]): Record<string, any>[] => log.filter((d) => d.event === 'agent-call');
export const results = (log: Record<string, any>[]): Record<string, any>[] => log.filter((d) => d.event === 'agent-result');
