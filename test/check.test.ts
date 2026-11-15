// sextant check, against temporary installs and a fake `claude` on PATH.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { managedTarget } from '../src/adapters/claude-code/locations.js';
import { fakeClaude, FIXTURES, hookInput, LAB_CONFIG, LAB_PRESETS, runCli, tempTree } from './helpers.js';

const supported = process.platform === 'darwin' || process.platform === 'linux';
const NO_NETWORK = ['--require', path.join(FIXTURES, 'no-network.cjs')];

function setup(claudeVersion = '2.1.325') {
  const home = tempTree({});
  const env = {
    HOME: home,
    SEXTANT_SYSTEM_ROOT: tempTree({}),
    SEXTANT_CONFIG: LAB_CONFIG,
    SEXTANT_PRESETS_DIR: LAB_PRESETS,
    PATH: fakeClaude(claudeVersion),
  };
  return { home, env };
}

function lines(stdout: string): string[] {
  return stdout.trimEnd().split('\n');
}

test('after an account install, check reports every part as ok and exits 0', () => {
  const { env } = setup();
  const claudeDir = tempTree({});
  assert.equal(runCli(['install', '--account', claudeDir], env).status, 0);
  runCli(['hook', 'session-start'], env, [], hookInput('session-start-startup'));
  const r = runCli(['check'], env, NO_NETWORK);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const out = lines(r.stdout);
  assert.ok(out.every((l) => /^(ok|warning|problem): /.test(l)), r.stdout);
  assert.ok(out.every((l) => l.startsWith('ok: ')), r.stdout);
  assert.match(r.stdout, /ok: config .*sextant\.json: valid \(3 model entries\)/);
  assert.match(r.stdout, new RegExp(`ok: account install ${claudeDir}: hooks in .*settings\\.json \\(SessionStart, PostModelSwitch\\)`));
  assert.match(r.stdout, /ok: account install .*: hook pointer .*sextant-hook runs sextant \d+\.\d+\.\d+/);
  assert.match(r.stdout, /ok: claude: 2\.1\.325/);
  assert.match(r.stdout, /ok: last decision: \S+ session-start matched claude-haiku-5-5 \(rules\)/);
  assert.doesNotMatch(r.stderr, /NETWORK-ATTEMPT/);
});

test('nothing installed is a problem', () => {
  const { env } = setup();
  const r = runCli(['check'], env);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /problem: sextant is not installed: run `sextant install`/);
  assert.match(r.stdout, /ok: no decisions logged yet/);
});

test('a Claude Code older than the PostModelSwitch event is a problem; no claude on PATH is a warning', () => {
  const old = setup('2.1.200');
  assert.equal(runCli(['install', '--account', tempTree({})], old.env).status, 0);
  const r = runCli(['check'], old.env);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /problem: claude: installed 2\.1\.200; the PostModelSwitch hook event needs 2\.1\.251 or later \(upgrade: claude update\)/);

  const none = setup();
  assert.equal(runCli(['install', '--account', tempTree({})], none.env).status, 0);
  const missing = runCli(['check'], { ...none.env, PATH: tempTree({}) });
  assert.equal(missing.status, 0, missing.stdout);
  assert.match(missing.stdout, /warning: claude: not found on PATH/);
});

test('a hook pointer whose copy of sextant is gone, or missing, is a problem', () => {
  const { env, home } = setup();
  assert.equal(runCli(['install', '--account', tempTree({})], env).status, 0);
  const pointer = path.join(home, '.local', 'share', 'sextant', 'sextant-hook');
  fs.writeFileSync(pointer, fs.readFileSync(pointer, 'utf8').replace(/^cli=.*$/m, "cli='/gone/cli.js'"));
  const gone = runCli(['check'], env);
  assert.equal(gone.status, 1);
  assert.match(gone.stdout, /problem: account install .*: the hook pointer runs \/gone\/cli\.js, which no longer exists; hooks do nothing/);
  fs.rmSync(pointer);
  assert.match(runCli(['check'], env).stdout, /problem: account install .*: the hook pointer .* is missing or unreadable/);
});

test('a hook pointer whose copy of sextant this account cannot reach is reported as unreachable, not gone', { skip: process.getuid?.() === 0 }, () => {
  const { env, home } = setup();
  assert.equal(runCli(['install', '--account', tempTree({})], env).status, 0);
  const pointer = path.join(home, '.local', 'share', 'sextant', 'sextant-hook');
  const locked = tempTree({ 'cli.js': '' });
  fs.writeFileSync(pointer, fs.readFileSync(pointer, 'utf8').replace(/^cli=.*$/m, `cli='${path.join(locked, 'cli.js')}'`));
  fs.chmodSync(locked, 0o000);
  try {
    const r = runCli(['check'], env);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /problem: account install .*: this account cannot run .*cli\.js, so its hooks do nothing; install sextant from a Node\.js and a copy of sextant that every account can read and run/);
    assert.doesNotMatch(r.stdout, /no longer exists/);
  } finally {
    fs.chmodSync(locked, 0o755);
  }
});

test('an account install whose entries were removed by hand, or that sets disableAllHooks, is a problem', () => {
  const { env } = setup();
  const claudeDir = tempTree({});
  assert.equal(runCli(['install', '--account', claudeDir], env).status, 0);
  fs.writeFileSync(path.join(claudeDir, 'settings.json'), JSON.stringify({ disableAllHooks: true }));
  const r = runCli(['check'], env);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /problem: account install .*: no sextant hooks in .*settings\.json; run `sextant install --account/);

  assert.equal(runCli(['install', '--account', claudeDir], env).status, 0);
  assert.match(runCli(['check'], env).stdout, /problem: account install .*sets disableAllHooks, so Claude Code runs none of this account's hooks/);
});

test('a refused or missing configuration exits 2 and lists the problems', () => {
  const { env } = setup();
  assert.equal(runCli(['install', '--account', tempTree({})], env).status, 0);
  const bad = path.join(tempTree({ 'sextant.json': { version: 1, models: { sonnet: { use: 'none' } } } }), 'sextant.json');
  const r = runCli(['check'], { ...env, SEXTANT_CONFIG: bad });
  assert.equal(r.status, 2);
  assert.match(r.stdout, /problem: config .*sextant\.json: refused, so sessions get no rules:\n {2}- \/models\/sonnet: key/);
  const missing = runCli(['check'], { ...env, SEXTANT_CONFIG: path.join(tempTree({}), 'none.json') });
  assert.equal(missing.status, 2);
  assert.match(missing.stdout, /no configuration file here/);
});

test('machine-wide: check reads the managed settings that decide whether hooks run', { skip: !supported }, () => {
  const { env } = setup();
  assert.equal(runCli(['install', '--managed'], env).status, 0);
  const ok = runCli(['check'], env);
  assert.equal(ok.status, 0, ok.stdout);
  assert.match(ok.stdout, /ok: machine-wide install: hooks in .*managed-settings\.d\/sextant-ai\.json/);
  assert.match(ok.stdout, /ok: machine-wide install: hook pointer .* runs sextant/);

  const managedDir = managedTarget(env).managedDir ?? '';
  fs.writeFileSync(path.join(managedDir, 'managed-settings.json'), JSON.stringify({ disableAllHooks: true, allowManagedHooksOnly: true }));
  const off = runCli(['check'], env);
  assert.equal(off.status, 1);
  assert.match(off.stdout, /problem: managed settings set disableAllHooks: Claude Code runs no hooks at all/);
  assert.match(off.stdout, /warning: managed settings set allowManagedHooksOnly/);

  // A later drop-in file wins over the managed settings file.
  fs.writeFileSync(path.join(managedDir, 'managed-settings.d', '90-later.json'), JSON.stringify({ disableAllHooks: false }));
  assert.doesNotMatch(runCli(['check'], env).stdout, /disableAllHooks/);

  fs.writeFileSync(path.join(managedDir, 'managed-settings.json'), '{ broken');
  assert.match(runCli(['check'], env).stdout, /problem: managed settings .*managed-settings\.json cannot be read as a JSON object .*Claude Code refuses to start/);
});

test('machine-wide on macOS: an MDM profile for Claude Code is a warning, because it can shadow the managed files', { skip: process.platform !== 'darwin' }, () => {
  const { env } = setup();
  assert.equal(runCli(['install', '--managed'], env).status, 0);
  const profile = path.join(env.SEXTANT_SYSTEM_ROOT, 'Library', 'Managed Preferences', 'com.anthropic.claudecode.plist');
  fs.mkdirSync(path.dirname(profile), { recursive: true });
  fs.writeFileSync(profile, '<plist/>');
  assert.match(runCli(['check'], env).stdout, /warning: an MDM profile for Claude Code is present .*managedSourcesBehavior/);
});

test('check takes no arguments', () => {
  assert.equal(runCli(['check', 'x']).status, 2);
  assert.match(runCli(['check', '--help']).stdout, /usage: sextant check/);
});

test('a login whose server-managed settings shadow the managed files is a problem until the default install reaches it', { skip: !supported }, () => {
  const { home, env } = setup();
  const claudeDir = path.join(home, '.claude');
  fs.mkdirSync(claudeDir);
  fs.writeFileSync(path.join(claudeDir, 'remote-settings.json'), JSON.stringify({ permissions: { deny: ['WebFetch'] } }));
  const other = path.join(home, '.claude-max');
  fs.mkdirSync(other);
  fs.writeFileSync(path.join(other, '.claude.json'), '{}');
  assert.equal(runCli(['install', '--managed'], env).status, 0);

  const shadowed = runCli(['check'], env);
  assert.equal(shadowed.status, 1, shadowed.stdout);
  assert.ok(
    shadowed.stdout.includes(`problem: Claude Code configuration ${claudeDir}: no sextant hooks reach it (its login receives server-managed settings`),
    shadowed.stdout,
  );
  assert.ok(shadowed.stdout.includes(`ok: Claude Code configuration ${other}: reached by the machine-wide install`), shadowed.stdout);

  assert.equal(runCli(['install', '--account', claudeDir], env).status, 0);
  const reached = runCli(['check'], env);
  assert.equal(reached.status, 0, reached.stdout);
  assert.ok(reached.stdout.includes(`ok: account install ${claudeDir}: hooks in`), reached.stdout);
  assert.ok(reached.stdout.includes(`ok: Claude Code configuration ${claudeDir}: this login receives server-managed settings`), reached.stdout);
  assert.doesNotMatch(reached.stdout, /twice/);
});

test('server-managed settings that turn hooks off for a login are a problem', () => {
  const { home, env } = setup();
  const claudeDir = path.join(home, '.claude');
  fs.mkdirSync(claudeDir);
  assert.equal(runCli(['install'], env).status, 0);
  fs.writeFileSync(path.join(claudeDir, 'remote-settings.json'), JSON.stringify({ allowManagedHooksOnly: true }));
  assert.match(runCli(['check'], env).stdout, /problem: Claude Code configuration .*set allowManagedHooksOnly, so Claude Code runs only the hooks the organization delivers/);
  fs.writeFileSync(path.join(claudeDir, 'remote-settings.json'), JSON.stringify({ disableAllHooks: true }));
  const off = runCli(['check'], env);
  assert.equal(off.status, 1);
  assert.match(off.stdout, /problem: Claude Code configuration .*set disableAllHooks, so Claude Code runs no hooks there/);
});

test('a Claude Code configuration directory added after the install is a problem until install runs again', () => {
  const { home, env } = setup();
  assert.equal(runCli(['install'], env).status, 0);
  const added = path.join(home, '.claude-new');
  fs.mkdirSync(added);
  fs.writeFileSync(path.join(added, '.claude.json'), '{}');
  const r = runCli(['check'], env);
  assert.equal(r.status, 1);
  assert.ok(r.stdout.includes(`problem: Claude Code configuration ${added}: no sextant hooks reach it; run \`sextant install\``), r.stdout);
  assert.equal(runCli(['install'], env).status, 0);
  assert.equal(runCli(['check'], env).status, 0);
});

test('a Claude Code older than the documented aliases is a warning', () => {
  const { env } = setup('2.1.300');
  assert.equal(runCli(['install'], env).status, 0);
  const r = runCli(['check'], env);
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /warning: claude: installed 2\.1\.300; when a session without a reported model, such as `claude -p`, names it by an alias, sextant assumes what the aliases select from Claude Code 2\.1\.321 on/);
});
