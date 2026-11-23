// noonsight as a Claude Code plugin, for real: the package `npm pack` makes, installed from a local
// marketplace with Claude Code's own commands, in `claude -p` sessions against a local stand-in for the
// API (stub-api.ts). It sends nothing to Anthropic, costs no tokens and needs no login, so it runs with
// every `npm run test:live`; without `claude` on PATH it is skipped.

import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { installPlugin, marketplaceFor } from '../../experiments/delivery/plugin.js';
import { PACKAGE_ROOT } from '../../src/config/paths.js';
import { runCli } from '../helpers.js';
import { startStub } from './stub-api.js';

const missing = spawnSync('claude', ['--version']).status !== 0 ? 'claude is not on PATH' : false;
const CLAUDE = spawnSync('/bin/sh', ['-c', 'command -v claude'], { encoding: 'utf8' }).stdout.trim();
/** What each delivery to a Haiku session opens with, as a request holds it. */
const DELIVERY = '<noonsight-rules model=\\"claude-haiku-5-5\\"';
const SYSTEM_NODE = ['/opt/homebrew/bin/node', '/usr/local/bin/node', '/usr/bin/node', '/snap/bin/node'].some((f) => fs.existsSync(f));

interface Login {
  readonly home: string;
  readonly claudeDir: string;
  readonly project: string;
  readonly config: string;
  readonly root: string;
}

function login(withConfig: boolean): Login {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'noonsight-live-plugin-')));
  const [home, claudeDir, project] = ['home', 'claude', 'project'].map((d) => path.join(root, d)) as [string, string, string];
  for (const d of [home, claudeDir, project]) fs.mkdirSync(d);
  fs.writeFileSync(path.join(claudeDir, '.claude.json'), JSON.stringify({ hasCompletedOnboarding: true, projects: { [project]: { hasTrustDialogAccepted: true } } }));
  const config = path.join(home, '.config', 'noonsight', 'noonsight.json');
  if (withConfig) {
    const r = runCli(['init'], { HOME: home });
    assert.equal(r.status, 0, r.stderr);
  }
  return { home, claudeDir, project, config, root };
}

const pluginIn = (l: Login): void => installPlugin('claude', marketplaceFor(PACKAGE_ROOT, l.root), { home: l.home, claudeDir: l.claudeDir, cwd: l.project });

const log = (l: Login): Record<string, any>[] => {
  const file = path.join(l.home, '.local', 'state', 'noonsight', 'decisions.jsonl');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trimEnd().split('\n').map((x) => JSON.parse(x)) : [];
};

/** One `claude -p` on Haiku, unattended as every headless run is: how often its first request holds the rules, and what it streamed. */
async function session(l: Login, prompt = 'reply ok', env: Record<string, string> = {}): Promise<{ copies: number; stream: string; requests: string }> {
  const stub = await startStub();
  try {
    const stream = await new Promise<string>((done, fail) => {
      const child = spawn(CLAUDE, ['-p', prompt, '--model', 'haiku', '--output-format', 'stream-json', '--verbose'], {
        cwd: l.project,
        env: {
          PATH: process.env.PATH ?? '',
          HOME: l.home,
          CLAUDE_CONFIG_DIR: l.claudeDir,
          DISABLE_AUTOUPDATER: '1',
          CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
          CLAUDE_CODE_OAUTH_TOKEN: 'noonsight-live-plugin-placeholder',
          ANTHROPIC_BASE_URL: stub.url,
          ...env,
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let out = '';
      child.stdout.setEncoding('utf8').on('data', (d: string) => (out += d));
      child.stderr.setEncoding('utf8').on('data', (d: string) => (out += d));
      child.on('error', fail);
      child.on('close', () => done(out));
    });
    const main = stub.requests.filter((r) => JSON.stringify(r.body.messages ?? []).includes(JSON.stringify(prompt).slice(1, -1)) || prompt.startsWith('/'));
    const requests = JSON.stringify(main.map((r) => [r.body.system ?? null, r.body.messages ?? []]));
    const first = JSON.stringify([main[0]?.body.system ?? null, main[0]?.body.messages ?? []]);
    return { copies: first.split(DELIVERY).length - 1, stream, requests };
  } finally {
    await stub.close();
  }
}

test('the packed plugin delivers the session\'s rules once, from its own cached copy', { skip: missing, timeout: 300_000 }, async () => {
  const l = login(true);
  pluginIn(l);
  const s = await session(l);
  assert.equal(s.copies, 1, s.stream);
  assert.deepEqual(log(l).map((d) => [d.event, d.install, d.delivered]), [['session-start', 'plugin', 'rules']]);
  const registry = JSON.parse(fs.readFileSync(path.join(l.claudeDir, 'plugins', 'installed_plugins.json'), 'utf8')) as { plugins: Record<string, { installPath: string }[]> };
  const folder = registry.plugins['noonsight@noonsight']?.[0]?.installPath ?? '';
  assert.ok(fs.existsSync(path.join(folder, 'dist', 'src', 'cli.js')), folder);
  // check, run by hand for this login, sees it.
  const check = runCli(['check'], { HOME: l.home, CLAUDE_CONFIG_DIR: l.claudeDir, PATH: process.env.PATH ?? '' });
  assert.match(check.stdout, /ok: plugin noonsight@noonsight in .*: runs noonsight /);
});

test('with the plugin and a settings install, each event is delivered and logged once', { skip: missing, timeout: 300_000 }, async () => {
  const l = login(true);
  assert.equal(runCli(['install', '--account', l.claudeDir], { HOME: l.home }).status, 0);
  pluginIn(l);
  for (let i = 1; i <= 3; i++) {
    assert.equal((await session(l)).copies, 1);
    assert.equal(log(l).length, i);
  }
});

test('the first session under the plugin writes the configuration and delivers', { skip: missing, timeout: 300_000 }, async () => {
  const l = login(false);
  pluginIn(l);
  const s = await session(l);
  assert.ok(fs.existsSync(l.config), s.stream);
  assert.equal(s.copies, 1);
  assert.equal(log(l)[0]?.config_written, true);
});

test('a later session without Node.js on PATH runs on the one recorded; with none, the session goes on and is told', { skip: missing || (SYSTEM_NODE && 'a system Node.js comes first here'), timeout: 300_000 }, async () => {
  const l = login(true);
  pluginIn(l);
  const bare = { PATH: '/usr/bin:/bin:/usr/sbin:/sbin' };
  const before = await session(l, 'reply ok', bare);
  assert.equal(before.copies, 0);
  assert.match(before.stream, /found no Node\.js 20 or newer/);
  assert.equal((await session(l)).copies, 1);
  assert.equal((await session(l, 'reply ok', bare)).copies, 1);
});

test('a skill of the plugin puts the command\'s output in the request', { skip: missing, timeout: 300_000 }, async () => {
  const l = login(true);
  pluginIn(l);
  const check = await session(l, '/noonsight:check');
  assert.match(check.requests, /ok: config .*noonsight\.json: valid/, check.stream);
  const resolve = await session(l, '/noonsight:resolve claude-haiku-5-5 routine');
  assert.match(resolve.requests, /haiku-5-5\/verify-changes/, resolve.stream);
});
