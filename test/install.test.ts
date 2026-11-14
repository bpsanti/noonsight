// install and uninstall, machine-wide and per account, always against temporary directories.
// SEXTANT_SYSTEM_ROOT stands in for "/" so the machine-wide install never touches the real system.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { accountTarget, managedTarget, UnsupportedPlatformError } from '../src/adapters/claude-code/locations.js';
import { CLI, LAB_CONFIG, LAB_PRESETS, runCli, runProgram, tempTree } from './helpers.js';

/** A settings file that already has hooks of its own, and other settings, before sextant arrives. */
const THIRD_PARTY = {
  model: 'opus',
  permissions: { allow: ['Bash(npm test)'] },
  hooks: {
    SessionStart: [{ matcher: 'startup', hooks: [{ type: 'command', command: '/opt/acme/bin/session-banner' }] }],
    PostModelSwitch: [{ matcher: '.*opus.*', hooks: [{ type: 'command', command: 'echo On Opus, plan first.' }] }],
    PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: '/opt/acme/bin/guard', timeout: 5 }] }],
  },
};

const PLATFORM_ROOTS: Record<string, string> = { darwin: 'Library/Application Support', linux: '' };
const supported = process.platform in PLATFORM_ROOTS;

function machine() {
  const home = tempTree({});
  const root = tempTree({});
  const env = { HOME: home, SEXTANT_SYSTEM_ROOT: root, SEXTANT_CONFIG: LAB_CONFIG, SEXTANT_PRESETS_DIR: LAB_PRESETS };
  const target = managedTarget(env);
  return { home, root, env, target };
}

function sextantHandlers(settings: any): any[] {
  return Object.entries(settings.hooks ?? {}).flatMap(([event, groups]) =>
    (groups as any[]).flatMap((g) => (g.hooks as any[]).filter((h) => String(h.command).endsWith('/sextant-hook')).map((h) => ({ event, matcher: g.matcher, ...h }))),
  );
}

test('the machine-wide paths are the ones Claude Code documents for each system', () => {
  const mac = managedTarget({}, 'darwin');
  assert.equal(mac.settingsFile, '/Library/Application Support/ClaudeCode/managed-settings.d/sextant-ai.json');
  assert.equal(mac.pointer, '/Library/Application Support/sextant/sextant-hook');
  const linux = managedTarget({}, 'linux');
  assert.equal(linux.settingsFile, '/etc/claude-code/managed-settings.d/sextant-ai.json');
  assert.equal(linux.pointer, '/usr/local/lib/sextant/sextant-hook');
  assert.throws(() => managedTarget({}, 'win32'), (e) => e instanceof UnsupportedPlatformError && /C:\\Program Files\\ClaudeCode/.test(e.message));
  assert.equal(accountTarget('~/.claude', '/home/u').settingsFile, '/home/u/.claude/settings.json');
  assert.equal(accountTarget('/x/claude-work', '/home/u').pointer, '/home/u/.local/share/sextant/sextant-hook');
});

test('per account: install twice adds one entry per event and keeps every third-party hook and setting', () => {
  const home = tempTree({});
  const claudeDir = tempTree({ 'settings.json': THIRD_PARTY });
  const file = path.join(claudeDir, 'settings.json');
  const env = { HOME: home, SEXTANT_CONFIG: LAB_CONFIG, SEXTANT_PRESETS_DIR: LAB_PRESETS };

  const first = runCli(['install', '--account', claudeDir], env);
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /hooks .*settings\.json: added \(SessionStart, PostModelSwitch\)/);
  assert.match(first.stdout, /hook pointer .*sextant-hook: written/);
  const once = fs.readFileSync(file, 'utf8');

  const second = runCli(['install', '--account', claudeDir], env);
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /settings\.json: unchanged/);
  assert.match(second.stdout, /sextant-hook: unchanged/);
  assert.equal(fs.readFileSync(file, 'utf8'), once, 'the second install leaves the file byte for byte as it was');

  const settings = JSON.parse(once);
  const pointer = path.join(home, '.local', 'share', 'sextant', 'sextant-hook');
  assert.deepEqual(sextantHandlers(settings), [
    { event: 'SessionStart', matcher: undefined, type: 'command', command: pointer, args: ['session-start'], timeout: 10 },
    { event: 'PostModelSwitch', matcher: undefined, type: 'command', command: pointer, args: ['model-switch'], timeout: 10 },
  ]);
  // Everything that was there is still there, in place.
  assert.equal(settings.model, 'opus');
  assert.deepEqual(settings.permissions, THIRD_PARTY.permissions);
  assert.deepEqual(settings.hooks.SessionStart[0], THIRD_PARTY.hooks.SessionStart[0]);
  assert.deepEqual(settings.hooks.PostModelSwitch[0], THIRD_PARTY.hooks.PostModelSwitch[0]);
  assert.deepEqual(settings.hooks.PreToolUse, THIRD_PARTY.hooks.PreToolUse);
  assert.equal(fs.statSync(pointer).mode & 0o777, 0o755);

  const removed = runCli(['uninstall', '--account', claudeDir], env);
  assert.equal(removed.status, 0, removed.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), THIRD_PARTY);
  assert.equal(fs.existsSync(pointer), false);
  const again = runCli(['uninstall', '--account', claudeDir], env);
  assert.equal(again.status, 0);
  assert.match(again.stdout, /settings\.json: none found/);
});

test('per account: a missing settings file is created, and a broken one is refused untouched', () => {
  const home = tempTree({});
  const env = { HOME: home };
  const empty = tempTree({});
  const r = runCli(['install', '--account', empty], env);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /settings\.json: created/);
  assert.equal(sextantHandlers(JSON.parse(fs.readFileSync(path.join(empty, 'settings.json'), 'utf8'))).length, 2);

  for (const [content, message] of [
    ['{ "hooks": ', /is not valid JSON/],
    ['[1, 2]', /does not hold a JSON object/],
    [JSON.stringify({ hooks: { SessionStart: { hooks: [] } } }), /"hooks\.SessionStart" is not a list/],
    [JSON.stringify({ hooks: [] }), /"hooks" is not an object/],
  ] as const) {
    const freshHome = tempTree({});
    const dir = tempTree({ 'settings.json': content });
    const refused = runCli(['install', '--account', dir], { HOME: freshHome });
    assert.equal(refused.status, 1, content);
    assert.match(refused.stderr, message);
    assert.match(refused.stderr, /nothing was changed/);
    assert.equal(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8'), content);
    assert.deepEqual(fs.readdirSync(freshHome), [], 'no hook pointer was written');
  }

  const missing = runCli(['install', '--account', path.join(home, 'nope')], env);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /is not a directory/);
});

test('per account: install repairs a moved, duplicated or outdated sextant entry', () => {
  const home = tempTree({});
  const pointer = path.join(home, '.local', 'share', 'sextant', 'sextant-hook');
  const stale = { type: 'command', command: '/old/place/sextant-hook', args: ['session-start'] };
  const dir = tempTree({
    'settings.json': {
      hooks: {
        SessionStart: [
          { matcher: 'startup', hooks: [stale, { type: 'command', command: 'echo keep' }] },
          { hooks: [{ type: 'command', command: pointer, args: ['session-start'], timeout: 10 }] },
        ],
        Stop: [{ hooks: [{ type: 'command', command: pointer, args: ['stop'] }] }],
      },
    },
  });
  const r = runCli(['install', '--account', dir], { HOME: home });
  assert.equal(r.status, 0, r.stderr);
  const settings = JSON.parse(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8'));
  assert.deepEqual(sextantHandlers(settings).map((h) => [h.event, h.command, h.args[0]]), [
    ['SessionStart', pointer, 'session-start'],
    ['PostModelSwitch', pointer, 'model-switch'],
  ]);
  assert.deepEqual(settings.hooks.SessionStart[0], { matcher: 'startup', hooks: [{ type: 'command', command: 'echo keep' }] });
  assert.equal(settings.hooks.Stop, undefined);
});

test('machine-wide: sextant writes its own drop-in file and never edits the managed settings already there', { skip: !supported }, () => {
  const { root, env, target } = machine();
  const managedDir = target.managedDir ?? '';
  const itPolicy = JSON.stringify({ ...THIRD_PARTY, permissions: { deny: ['Read(./.env)'] } }, null, 4);
  const otherDropIn = '{"hooks":{"SessionStart":[{"hooks":[{"type":"command","command":"/opt/it/audit"}]}]}}';
  fs.mkdirSync(path.join(managedDir, 'managed-settings.d'), { recursive: true });
  fs.writeFileSync(path.join(managedDir, 'managed-settings.json'), itPolicy);
  fs.writeFileSync(path.join(managedDir, 'managed-settings.d', '10-it.json'), otherDropIn);

  const first = runCli(['install'], env);
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /managed-settings\.d\/sextant-ai\.json: created \(SessionStart, PostModelSwitch\)/);
  assert.match(first.stdout, /built-in guard for the mods users install: https:\/\/code\.claude\.com\/docs\/en\/plugins\/mods\/admin/);
  assert.match(first.stdout, /SEXTANT_DISABLE=1/);
  const dropIn = fs.readFileSync(target.settingsFile, 'utf8');
  assert.deepEqual(Object.keys(JSON.parse(dropIn)), ['hooks']);
  assert.deepEqual(sextantHandlers(JSON.parse(dropIn)).map((h) => [h.event, h.command]), [
    ['SessionStart', target.pointer],
    ['PostModelSwitch', target.pointer],
  ]);
  assert.match(fs.readFileSync(target.pointer, 'utf8'), /exec "\$node" "\$cli" hook --install managed "\$@"/);
  assert.equal(fs.statSync(target.pointer).mode & 0o777, 0o755);
  assert.equal(fs.statSync(target.settingsFile).mode & 0o777, 0o644);

  const second = runCli(['install'], env);
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /sextant-ai\.json: unchanged/);
  assert.equal(fs.readFileSync(target.settingsFile, 'utf8'), dropIn);
  assert.equal(fs.readFileSync(path.join(managedDir, 'managed-settings.json'), 'utf8'), itPolicy);
  assert.equal(fs.readFileSync(path.join(managedDir, 'managed-settings.d', '10-it.json'), 'utf8'), otherDropIn);
  assert.deepEqual(fs.readdirSync(path.join(managedDir, 'managed-settings.d')).sort(), ['10-it.json', 'sextant-ai.json']);

  const removed = runCli(['uninstall'], env);
  assert.equal(removed.status, 0, removed.stderr);
  assert.match(removed.stdout, /removed the file/);
  assert.equal(fs.existsSync(target.settingsFile), false);
  assert.equal(fs.existsSync(target.pointer), false);
  assert.equal(fs.readFileSync(path.join(managedDir, 'managed-settings.json'), 'utf8'), itPolicy);
  assert.equal(fs.readFileSync(path.join(managedDir, 'managed-settings.d', '10-it.json'), 'utf8'), otherDropIn);
  assert.ok(fs.existsSync(root));
});

test('machine-wide without administrator rights: says so plainly, offers --account, changes nothing', { skip: !supported || process.getuid?.() === 0 }, () => {
  const { root, env, target } = machine();
  fs.chmodSync(root, 0o555);
  try {
    const r = runCli(['install'], { ...env, CLAUDE_CONFIG_DIR: '/somewhere/claude-work' });
    assert.equal(r.status, 1);
    assert.equal(r.stdout, '');
    assert.match(r.stderr, /needs administrator rights\. Nothing was changed\./);
    assert.ok(r.stderr.includes(target.settingsFile) && r.stderr.includes(target.pointer), r.stderr);
    assert.match(r.stderr, /\n  sudo \S+node\S* \S+cli\.js install\n/);
    assert.match(r.stderr, /sextant install --account \/somewhere\/claude-work/);
    assert.deepEqual(fs.readdirSync(root), []);

    const un = runCli(['uninstall'], env);
    assert.equal(un.status, 0, 'nothing installed means nothing to remove, even without rights');
  } finally {
    fs.chmodSync(root, 0o755);
  }

  // The pointer directory writable but the settings directory not: refused before any write.
  const second = machine();
  const managedDir = second.target.managedDir ?? '';
  fs.mkdirSync(managedDir, { recursive: true });
  fs.chmodSync(managedDir, 0o555);
  try {
    const r = runCli(['install'], second.env);
    assert.equal(r.status, 1);
    assert.equal(fs.existsSync(second.target.pointer), false);
  } finally {
    fs.chmodSync(managedDir, 0o755);
  }
});

test('a per-account install next to a machine-wide one warns that the rules would arrive twice', { skip: !supported }, () => {
  const { env } = machine();
  assert.equal(runCli(['install'], env).status, 0);
  const r = runCli(['install', '--account', tempTree({})], env);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /warning: sextant is also installed for the whole machine .*receives the rules twice/);
});

test('install says what to do next about the configuration', () => {
  const home = tempTree({});
  const none = runCli(['install', '--account', tempTree({})], { HOME: home });
  assert.match(none.stdout, /next: create .*\.config\/sextant\/sextant\.json/);
  const bad = path.join(tempTree({ 'sextant.json': { version: 9 } }), 'sextant.json');
  const refused = runCli(['install', '--account', tempTree({})], { HOME: tempTree({}), SEXTANT_CONFIG: bad });
  assert.equal(refused.status, 0);
  assert.match(refused.stdout, /refused \(1 problem\); run `sextant check`/);
});

test('two account installs share one pointer, which stays until the last one is removed', () => {
  const home = tempTree({});
  const a = tempTree({});
  const b = tempTree({});
  const pointer = path.join(home, '.local', 'share', 'sextant', 'sextant-hook');
  assert.equal(runCli(['install', '--account', a], { HOME: home }).status, 0);
  assert.equal(runCli(['install', '--account', b], { HOME: home }).status, 0);
  assert.match(runCli(['uninstall', '--account', a], { HOME: home }).stdout, /kept \(another account install uses it\)/);
  assert.ok(fs.existsSync(pointer));
  assert.match(runCli(['uninstall', '--account', b], { HOME: home }).stdout, /sextant-hook: removed/);
  assert.equal(fs.existsSync(pointer), false);
});

test('install and uninstall usage errors exit 2', () => {
  for (const args of [['install', '--bogus'], ['install', '--account'], ['install', 'x'], ['uninstall', '--account=']]) {
    const r = runCli(args);
    assert.equal(r.status, 2, args.join(' '));
    assert.match(r.stderr, /usage: sextant install/);
  }
  assert.equal(runCli(['install', '--help']).status, 0);
});

test('machine-wide under a strict umask: every account can still read the directories and run the pointer', { skip: !supported }, () => {
  const { root, env, target } = machine();
  const r = runProgram('/bin/sh', ['-c', 'umask 077; exec "$0" "$@"', process.execPath, CLI, 'install'], env);
  assert.equal(r.status, 0, r.stderr);
  for (let d = path.dirname(target.pointer); d.startsWith(root) && d !== root; d = path.dirname(d))
    assert.equal(fs.statSync(d).mode & 0o777, 0o755, d);
  for (let d = path.dirname(target.settingsFile); d.startsWith(root) && d !== root; d = path.dirname(d))
    assert.equal(fs.statSync(d).mode & 0o777, 0o755, d);
  assert.equal(fs.statSync(target.pointer).mode & 0o777, 0o755);
  assert.equal(fs.statSync(target.settingsFile).mode & 0o777, 0o644);
});
