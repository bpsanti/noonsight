// install and uninstall, machine-wide and per account, always against temporary directories.
// NOONSIGHT_SYSTEM_ROOT stands in for "/" so the machine-wide install never touches the real system.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { accountTarget, managedTarget, UnsupportedPlatformError } from '../src/adapters/claude-code/locations.js';
import { CLI, fakeClaude, hookInput, LAB_CONFIG, LAB_PRESETS, runCli, runProgram, tempTree } from './helpers.js';

/** A settings file that already has hooks of its own, and other settings, before noonsight arrives. */
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
  const env = { HOME: home, NOONSIGHT_SYSTEM_ROOT: root, NOONSIGHT_CONFIG: LAB_CONFIG, NOONSIGHT_PRESETS_DIR: LAB_PRESETS };
  const target = managedTarget(env);
  return { home, root, env, target };
}

function noonsightHandlers(settings: any): any[] {
  return Object.entries(settings.hooks ?? {}).flatMap(([event, groups]) =>
    (groups as any[]).flatMap((g) => (g.hooks as any[]).filter((h) => String(h.command).endsWith('/noonsight-hook')).map((h) => ({ event, matcher: g.matcher, ...h }))),
  );
}

test('the machine-wide paths are the ones Claude Code documents for each system', () => {
  const mac = managedTarget({}, 'darwin');
  assert.equal(mac.settingsFile, '/Library/Application Support/ClaudeCode/managed-settings.d/noonsight.json');
  assert.equal(mac.pointer, '/Library/Application Support/noonsight/noonsight-hook');
  const linux = managedTarget({}, 'linux');
  assert.equal(linux.settingsFile, '/etc/claude-code/managed-settings.d/noonsight.json');
  assert.equal(linux.pointer, '/usr/local/lib/noonsight/noonsight-hook');
  assert.throws(() => managedTarget({}, 'win32'), (e) => e instanceof UnsupportedPlatformError && /C:\\Program Files\\ClaudeCode/.test(e.message));
  assert.equal(accountTarget('~/.claude', '/home/u').settingsFile, '/home/u/.claude/settings.json');
  assert.equal(accountTarget('/x/claude-work', '/home/u').pointer, '/home/u/.local/share/noonsight/noonsight-hook');
});

test('per account: install twice adds one entry per event and keeps every third-party hook and setting', () => {
  const home = tempTree({});
  const claudeDir = tempTree({ 'settings.json': THIRD_PARTY });
  const file = path.join(claudeDir, 'settings.json');
  const env = { HOME: home, NOONSIGHT_CONFIG: LAB_CONFIG, NOONSIGHT_PRESETS_DIR: LAB_PRESETS };

  const first = runCli(['install', '--account', claudeDir], env);
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /hooks .*settings\.json: added \(SessionStart, PostModelSwitch, PreToolUse, SubagentStart, PostToolUse\)/);
  assert.match(first.stdout, /hook pointer .*noonsight-hook: written/);
  const once = fs.readFileSync(file, 'utf8');

  const second = runCli(['install', '--account', claudeDir], env);
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /settings\.json: unchanged/);
  assert.match(second.stdout, /noonsight-hook: unchanged/);
  assert.equal(fs.readFileSync(file, 'utf8'), once, 'the second install leaves the file byte for byte as it was');

  const settings = JSON.parse(once);
  const pointer = path.join(home, '.local', 'share', 'noonsight', 'noonsight-hook');
  assert.deepEqual(noonsightHandlers(settings), [
    { event: 'SessionStart', matcher: undefined, type: 'command', command: pointer, args: ['session-start'], timeout: 10 },
    { event: 'PostModelSwitch', matcher: undefined, type: 'command', command: pointer, args: ['model-switch'], timeout: 10 },
    { event: 'PreToolUse', matcher: 'Agent|Task', type: 'command', command: pointer, args: ['agent-call'], timeout: 10 },
    { event: 'SubagentStart', matcher: undefined, type: 'command', command: pointer, args: ['subagent-start'], timeout: 10 },
    { event: 'PostToolUse', matcher: 'Agent|Task', type: 'command', command: pointer, args: ['agent-result'], timeout: 10 },
    { event: 'PostToolUse', matcher: 'Edit|Write', type: 'command', command: pointer, args: ['file-edit'], timeout: 10 },
  ]);
  // The third-party PreToolUse group comes first and is left as it was; noonsight's has its own group.
  assert.deepEqual(settings.hooks.PreToolUse[0], THIRD_PARTY.hooks.PreToolUse[0]);
  // Everything that was there is still there, in place.
  assert.equal(settings.model, 'opus');
  assert.deepEqual(settings.permissions, THIRD_PARTY.permissions);
  assert.deepEqual(settings.hooks.SessionStart[0], THIRD_PARTY.hooks.SessionStart[0]);
  assert.deepEqual(settings.hooks.PostModelSwitch[0], THIRD_PARTY.hooks.PostModelSwitch[0]);
  assert.equal(settings.hooks.PreToolUse.length, 2);
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
  assert.equal(noonsightHandlers(JSON.parse(fs.readFileSync(path.join(empty, 'settings.json'), 'utf8'))).length, 6);

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

test('per account: install repairs a moved, duplicated or outdated noonsight entry', () => {
  const home = tempTree({});
  const pointer = path.join(home, '.local', 'share', 'noonsight', 'noonsight-hook');
  const stale = { type: 'command', command: '/old/place/noonsight-hook', args: ['session-start'] };
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
  assert.deepEqual(noonsightHandlers(settings).map((h) => [h.event, h.command, h.args[0]]), [
    ['SessionStart', pointer, 'session-start'],
    ['PostModelSwitch', pointer, 'model-switch'],
    ['PreToolUse', pointer, 'agent-call'],
    ['SubagentStart', pointer, 'subagent-start'],
    ['PostToolUse', pointer, 'agent-result'],
    ['PostToolUse', pointer, 'file-edit'],
  ]);
  assert.deepEqual(settings.hooks.SessionStart[0], { matcher: 'startup', hooks: [{ type: 'command', command: 'echo keep' }] });
  assert.equal(settings.hooks.Stop, undefined);
});

test('per account: an install from before the subagent hooks gains them, and a noonsight entry with a widened matcher is narrowed back', () => {
  const home = tempTree({});
  const pointer = path.join(home, '.local', 'share', 'noonsight', 'noonsight-hook');
  const own = (args: string[]): Record<string, unknown> => ({ type: 'command', command: pointer, args, timeout: 10 });
  const dir = tempTree({
    'settings.json': {
      hooks: {
        SessionStart: [{ hooks: [own(['session-start'])] }],
        PostModelSwitch: [{ hooks: [own(['model-switch'])] }],
        PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: '/opt/acme/bin/guard' }] }, { matcher: '.*', hooks: [own(['agent-call'])] }],
      },
    },
  });
  const r = runCli(['install', '--account', dir], { HOME: home });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /settings\.json: added/);
  const settings = JSON.parse(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8'));
  // Rewritten events move to the end of the file's hooks object; their order there does not matter.
  const byEvent = (a: unknown[], b: unknown[]): number => String(a[0]).localeCompare(String(b[0]));
  assert.deepEqual(noonsightHandlers(settings).map((h) => [h.event, h.matcher, h.args[0]]).sort(byEvent), [
    ['PostModelSwitch', undefined, 'model-switch'],
    ['PostToolUse', 'Agent|Task', 'agent-result'],
    ['PostToolUse', 'Edit|Write', 'file-edit'],
    ['PreToolUse', 'Agent|Task', 'agent-call'],
    ['SessionStart', undefined, 'session-start'],
    ['SubagentStart', undefined, 'subagent-start'],
  ]);
  assert.deepEqual(settings.hooks.PreToolUse[0], { matcher: 'Bash', hooks: [{ type: 'command', command: '/opt/acme/bin/guard' }] });
  assert.equal(settings.hooks.PreToolUse.length, 2);
});

test('machine-wide: noonsight writes its own drop-in file and never edits the managed settings already there', { skip: !supported }, () => {
  const { root, env, target } = machine();
  const managedDir = target.managedDir ?? '';
  const itPolicy = JSON.stringify({ ...THIRD_PARTY, permissions: { deny: ['Read(./.env)'] } }, null, 4);
  const otherDropIn = '{"hooks":{"SessionStart":[{"hooks":[{"type":"command","command":"/opt/it/audit"}]}]}}';
  fs.mkdirSync(path.join(managedDir, 'managed-settings.d'), { recursive: true });
  fs.writeFileSync(path.join(managedDir, 'managed-settings.json'), itPolicy);
  fs.writeFileSync(path.join(managedDir, 'managed-settings.d', '10-it.json'), otherDropIn);

  const first = runCli(['install', '--managed'], env);
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /managed-settings\.d\/noonsight\.json: created \(SessionStart, PostModelSwitch, PreToolUse, SubagentStart, PostToolUse\)/);
  assert.match(first.stdout, /built-in guard for the mods users install: https:\/\/code\.claude\.com\/docs\/en\/plugins\/mods\/admin/);
  assert.match(first.stdout, /NOONSIGHT_DISABLE=1/);
  const dropIn = fs.readFileSync(target.settingsFile, 'utf8');
  assert.deepEqual(Object.keys(JSON.parse(dropIn)), ['hooks']);
  assert.deepEqual(noonsightHandlers(JSON.parse(dropIn)).map((h) => [h.event, h.command]), [
    ['SessionStart', target.pointer],
    ['PostModelSwitch', target.pointer],
    ['PreToolUse', target.pointer],
    ['SubagentStart', target.pointer],
    ['PostToolUse', target.pointer],
    ['PostToolUse', target.pointer],
  ]);
  const hooked = runProgram(target.pointer, ['session-start'], env, hookInput('session-start-print', { model: 'claude-sonnet-5-5' }));
  assert.equal(hooked.status, 0, hooked.stderr);
  assert.match(JSON.parse(hooked.stdout).hookSpecificOutput.additionalContext, /SONNET-GEN-3306/);
  const decisions = fs.readFileSync(path.join(env.HOME, '.local', 'state', 'noonsight', 'decisions.jsonl'), 'utf8').trimEnd().split('\n');
  assert.equal(JSON.parse(decisions.at(-1) ?? '{}').install, 'managed');
  assert.equal(fs.statSync(target.pointer).mode & 0o777, 0o755);
  assert.equal(fs.statSync(target.settingsFile).mode & 0o777, 0o644);

  const second = runCli(['install', '--managed'], env);
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /noonsight\.json: unchanged/);
  assert.equal(fs.readFileSync(target.settingsFile, 'utf8'), dropIn);
  assert.equal(fs.readFileSync(path.join(managedDir, 'managed-settings.json'), 'utf8'), itPolicy);
  assert.equal(fs.readFileSync(path.join(managedDir, 'managed-settings.d', '10-it.json'), 'utf8'), otherDropIn);
  assert.deepEqual(fs.readdirSync(path.join(managedDir, 'managed-settings.d')).sort(), ['10-it.json', 'noonsight.json']);

  const removed = runCli(['uninstall', '--managed'], env);
  assert.equal(removed.status, 0, removed.stderr);
  assert.match(removed.stdout, /removed the file/);
  assert.equal(fs.existsSync(target.settingsFile), false);
  assert.equal(fs.existsSync(target.pointer), false);
  assert.equal(fs.readFileSync(path.join(managedDir, 'managed-settings.json'), 'utf8'), itPolicy);
  assert.equal(fs.readFileSync(path.join(managedDir, 'managed-settings.d', '10-it.json'), 'utf8'), otherDropIn);
  assert.ok(fs.existsSync(root));
});

test('machine-wide without administrator rights: says so plainly, offers the install that needs none, changes nothing', { skip: !supported || process.getuid?.() === 0 }, () => {
  const { root, env, target } = machine();
  fs.chmodSync(root, 0o555);
  try {
    const r = runCli(['install', '--managed'], { ...env, CLAUDE_CONFIG_DIR: '/somewhere/claude-work' });
    assert.equal(r.status, 1);
    assert.equal(r.stdout, '');
    assert.match(r.stderr, /needs administrator rights\. Nothing was changed\./);
    assert.ok(r.stderr.includes(target.settingsFile) && r.stderr.includes(target.pointer), r.stderr);
    assert.match(r.stderr, /\n  sudo \S+node\S* \S+cli\.js install --managed\n/);
    assert.match(r.stderr, /for every Claude Code configuration directory of this account:\n  noonsight install$/m);
    assert.deepEqual(fs.readdirSync(root), []);

    const un = runCli(['uninstall', '--managed'], env);
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
    const r = runCli(['install', '--managed'], second.env);
    assert.equal(r.status, 1);
    assert.equal(fs.existsSync(second.target.pointer), false);
  } finally {
    fs.chmodSync(managedDir, 0o755);
  }
});

test('a per-account install next to a machine-wide one warns that the rules would arrive twice', { skip: !supported }, () => {
  const { env } = machine();
  assert.equal(runCli(['install', '--managed'], env).status, 0);
  const r = runCli(['install', '--account', tempTree({})], env);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /warning: noonsight is also installed for the whole machine .*sessions that use .* receive the rules twice/);
});

test('a refused configuration: install keeps the file, exits 2, and does not say it is done', () => {
  const bad = path.join(tempTree({ 'noonsight.json': { version: 9 } }), 'noonsight.json');
  const before = fs.readFileSync(bad, 'utf8');
  const r = runCli(['install', '--account', tempTree({})], { HOME: tempTree({}), NOONSIGHT_CONFIG: bad });
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.equal(fs.readFileSync(bad, 'utf8'), before);
  assert.match(r.stdout, /^Until the configuration is fixed, sessions get no rules\./m);
  assert.doesNotMatch(r.stdout, /^Done:/m);
});

test('install --account exits 0 for what it set up while check reports a problem elsewhere, and does not say it is done', () => {
  const home = tempTree({ '.claude/.keep': '' });
  const env = { HOME: home, PATH: fakeClaude('2.1.325'), NOONSIGHT_CONFIG: LAB_CONFIG, NOONSIGHT_PRESETS_DIR: LAB_PRESETS, NOONSIGHT_SYSTEM_ROOT: tempTree({}) };
  const r = runCli(['install', '--account', tempTree({})], env);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^problem: Claude Code configuration .*\.claude: no noonsight hooks reach it/m);
  assert.match(r.stdout, /^Not done yet: fix the problems the check reports above/m);
  assert.doesNotMatch(r.stdout, /^Done:/m);

  const ready = runCli(['install'], env);
  assert.equal(ready.status, 0, ready.stdout + ready.stderr);
  assert.match(ready.stdout, /^Done: /m);
});

test('a configuration this account cannot write: install says which path, changes nothing, and exits 1', { skip: process.getuid?.() === 0 }, () => {
  const locked = tempTree({});
  fs.chmodSync(locked, 0o500);
  try {
    const config = path.join(locked, 'noonsight', 'noonsight.json');
    const claudeDir = tempTree({});
    const home = tempTree({});
    const r = runCli(['install', '--account', claudeDir], { HOME: home, NOONSIGHT_CONFIG: config });
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.ok(r.stderr.includes(`noonsight: this account cannot write ${path.join(locked, 'noonsight')}`), r.stderr);
    assert.match(r.stderr, /no hook was written either\./);
    assert.doesNotMatch(r.stderr, /\n {4}at /, 'no stack trace');
    assert.equal(fs.existsSync(config), false);
    assert.deepEqual(fs.readdirSync(claudeDir), [], 'no hooks were written');
    assert.equal(fs.existsSync(path.join(home, '.local', 'share', 'noonsight', 'noonsight-hook')), false, 'no hook pointer was written');
  } finally {
    fs.chmodSync(locked, 0o755);
  }
});

test('one command on a clean machine: writes the configuration, installs in every directory, checks, and a second run changes nothing', () => {
  const home = tempTree({});
  const work = tempTree({});
  const env = { HOME: home, CLAUDE_CONFIG_DIR: work };
  const configFile = path.join(home, '.config', 'noonsight', 'noonsight.json');
  const dirs = [path.join(home, '.claude'), work];

  const first = runCli(['install'], env);
  assert.equal(first.status, 0, first.stdout + first.stderr);
  assert.match(first.stdout, /wrote .*noonsight\.json: preset claude/);
  assert.match(first.stdout, /Each declared model receives:\n  claude-fable-5-2: \d+ of \d+ rules/);
  assert.match(first.stdout, /^ok: config .*noonsight\.json: valid/m);
  assert.match(first.stdout, /^Changed: the configuration file was written; hooks were added to 2 Claude Code configuration directories\./m);
  assert.ok(fs.existsSync(configFile));
  for (const dir of dirs) assert.ok(noonsightHandlers(JSON.parse(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8'))).length > 0, `${dir} has the hooks`);

  const snapshot = [configFile, ...dirs.map((d) => path.join(d, 'settings.json'))].map((f) => fs.readFileSync(f, 'utf8'));
  const second = runCli(['install'], env);
  assert.equal(second.status, 0, second.stdout + second.stderr);
  assert.match(second.stdout, /already there, left as it is/);
  assert.match(second.stdout, /^Nothing changed: noonsight was already set up here\./m);
  assert.deepEqual([configFile, ...dirs.map((d) => path.join(d, 'settings.json'))].map((f) => fs.readFileSync(f, 'utf8')), snapshot);

  // The done line promises only what the configuration gives: a session with no scope gets its model's
  // every-scope rules, and a scope is needed for the rest.
  assert.match(first.stdout, /^Done: .*a session with no scope receives only the rules its model has for every scope/m);
  assert.match(first.stdout, /^Done: .*`NOONSIGHT_SCOPE` or `noonsight run --scope`/m);

  // The first session receives exactly what the preset gives its model there, and report sees it:
  // Sonnet has no rule for a session with no scope, and verify-changes for a session in build.
  const hook = path.join(home, '.local', 'share', 'noonsight', 'noonsight-hook');
  const unscoped = runProgram(hook, ['session-start'], env, hookInput('session-start-startup', { model: 'claude-sonnet-5-5' }));
  assert.equal(unscoped.status, 0, unscoped.stderr);
  assert.doesNotMatch(unscoped.stdout, /noonsight-rules/);
  const none = runCli(['report'], env);
  assert.match(none.stdout, /delivered rules: 0\b/);
  assert.match(none.stdout, /no-rule-applies 1\b/);
  const session = runProgram(hook, ['session-start'], { ...env, NOONSIGHT_SCOPE: 'build' }, hookInput('session-start-startup', { model: 'claude-sonnet-5-5' }));
  assert.match(session.stdout, /noonsight-rules model=\\"claude-sonnet-5-5\\" scope=\\"build/);
  const report = runCli(['report'], env);
  assert.match(report.stdout, /sonnet-5-5\/verify-changes/);
  assert.doesNotMatch(report.stdout, /never delivered in this log:[^]*sonnet-5-5\/verify-changes/);
});

test('one command with an existing configuration leaves it untouched', () => {
  const home = tempTree({});
  const lab = tempTree({});
  fs.cpSync(path.dirname(LAB_CONFIG), lab, { recursive: true });
  const config = path.join(lab, 'noonsight.json');
  const before = fs.readFileSync(config, 'utf8');
  const r = runCli(['install', '--account', tempTree({})], { HOME: home, NOONSIGHT_CONFIG: config, NOONSIGHT_PRESETS_DIR: LAB_PRESETS });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /already there, left as it is/);
  assert.equal(fs.readFileSync(config, 'utf8'), before);
});

test('two account installs share one pointer, which stays until the last one is removed', () => {
  const home = tempTree({});
  const a = tempTree({});
  const b = tempTree({});
  const pointer = path.join(home, '.local', 'share', 'noonsight', 'noonsight-hook');
  assert.equal(runCli(['install', '--account', a], { HOME: home }).status, 0);
  assert.equal(runCli(['install', '--account', b], { HOME: home }).status, 0);
  assert.match(runCli(['uninstall', '--account', a], { HOME: home }).stdout, /kept \(another account install uses it\)/);
  assert.ok(fs.existsSync(pointer));
  assert.match(runCli(['uninstall', '--account', b], { HOME: home }).stdout, /noonsight-hook: removed/);
  assert.equal(fs.existsSync(pointer), false);
});

test('install and uninstall usage errors exit 2', () => {
  for (const args of [['install', '--bogus'], ['install', '--account'], ['install', 'x'], ['uninstall', '--account='], ['install', '--managed', '--account', '/x']]) {
    const r = runCli(args);
    assert.equal(r.status, 2, args.join(' '));
    assert.match(r.stderr, /usage: noonsight install/);
  }
  assert.equal(runCli(['install', '--help']).status, 0);
});

test('machine-wide under a strict umask: every account can still read the directories and run the pointer', { skip: !supported }, () => {
  const { root, env, target } = machine();
  const r = runProgram('/bin/sh', ['-c', 'umask 077; exec "$0" "$@"', process.execPath, CLI, 'install', '--managed'], env);
  assert.equal(r.status, 0, r.stderr);
  for (let d = path.dirname(target.pointer); d.startsWith(root) && d !== root; d = path.dirname(d))
    assert.equal(fs.statSync(d).mode & 0o777, 0o755, d);
  for (let d = path.dirname(target.settingsFile); d.startsWith(root) && d !== root; d = path.dirname(d))
    assert.equal(fs.statSync(d).mode & 0o777, 0o755, d);
  assert.equal(fs.statSync(target.pointer).mode & 0o777, 0o755);
  assert.equal(fs.statSync(target.settingsFile).mode & 0o777, 0o644);
});

/** A home directory with three Claude Code configuration directories, one per login, and a project. */
function logins() {
  const home = tempTree({
    '.claude/settings.json': THIRD_PARTY,
    '.claude-work/.claude.json': {},
    'second-login/.claude.json': {},
    'second-login/settings.json': { theme: 'dark' },
    'code/project/.claude/settings.json': { model: 'sonnet' },
  });
  const outside = tempTree({ '.claude.json': {} });
  const env = { HOME: home, CLAUDE_CONFIG_DIR: outside, NOONSIGHT_CONFIG: LAB_CONFIG, NOONSIGHT_PRESETS_DIR: LAB_PRESETS, NOONSIGHT_SYSTEM_ROOT: tempTree({}) };
  const dirs = [path.join(home, '.claude'), outside, path.join(home, '.claude-work'), path.join(home, 'second-login')];
  return { home, outside, env, dirs };
}

const readJson = (file: string): any => JSON.parse(fs.readFileSync(file, 'utf8'));

test('by default: install reaches every Claude Code configuration directory of the account, twice changes nothing, uninstall removes them all', () => {
  const { home, env, dirs } = logins();
  const pointer = path.join(home, '.local', 'share', 'noonsight', 'noonsight-hook');

  const first = runCli(['install'], env);
  assert.equal(first.status, 0, first.stderr);
  for (const dir of dirs) {
    assert.ok(first.stdout.includes(`hooks ${path.join(dir, 'settings.json')}: `), `${dir}\n${first.stdout}`);
    assert.deepEqual(noonsightHandlers(readJson(path.join(dir, 'settings.json'))).map((h) => [h.event, h.command]), [
      ['SessionStart', pointer],
      ['PostModelSwitch', pointer],
      ['PreToolUse', pointer],
      ['SubagentStart', pointer],
      ['PostToolUse', pointer],
      ['PostToolUse', pointer],
    ]);
  }
  const kept = readJson(path.join(home, '.claude', 'settings.json'));
  assert.deepEqual(kept.permissions, THIRD_PARTY.permissions);
  assert.deepEqual(kept.hooks.PreToolUse[0], THIRD_PARTY.hooks.PreToolUse[0]);
  assert.deepEqual(kept.hooks.SessionStart[0], THIRD_PARTY.hooks.SessionStart[0]);
  assert.equal(readJson(path.join(home, 'second-login', 'settings.json')).theme, 'dark');
  assert.deepEqual(readJson(path.join(home, 'code', 'project', '.claude', 'settings.json')), { model: 'sonnet' }, 'a project is not a login');
  assert.deepEqual(readJson(path.join(home, '.local', 'state', 'noonsight', 'installs.json')).accounts.sort(), [...dirs].sort());

  const before = dirs.map((d) => fs.readFileSync(path.join(d, 'settings.json'), 'utf8'));
  const second = runCli(['install'], env);
  assert.equal(second.status, 0, second.stderr);
  assert.equal((second.stdout.match(/: unchanged/g) ?? []).length, dirs.length * 2, second.stdout);
  assert.deepEqual(dirs.map((d) => fs.readFileSync(path.join(d, 'settings.json'), 'utf8')), before);

  // A directory that is no longer found, such as one whose CLAUDE_CONFIG_DIR is not set now, is still removed.
  const removed = runCli(['uninstall'], { ...env, CLAUDE_CONFIG_DIR: '' });
  assert.equal(removed.status, 0, removed.stderr);
  for (const dir of dirs) assert.deepEqual(noonsightHandlers(readJson(path.join(dir, 'settings.json'))), [], dir);
  assert.deepEqual(readJson(path.join(home, '.claude', 'settings.json')), THIRD_PARTY);
  assert.equal(fs.existsSync(pointer), false);
  assert.deepEqual(readJson(path.join(home, '.local', 'state', 'noonsight', 'installs.json')).accounts, []);
});

test('by default: a login deleted since install does not keep the hook pointer, and uninstall forgets it', () => {
  const { home, env } = logins();
  assert.equal(runCli(['install'], env).status, 0);
  fs.rmSync(path.join(home, 'second-login'), { recursive: true });
  const r = runCli(['uninstall'], env);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, new RegExp(`account install ${path.join(home, 'second-login')}: forgotten`));
  assert.equal(fs.existsSync(path.join(home, '.local', 'share', 'noonsight', 'noonsight-hook')), false);
  assert.deepEqual(readJson(path.join(home, '.local', 'state', 'noonsight', 'installs.json')).accounts, []);
});

test('uninstall --managed leaves the list of account installs alone, even for a login deleted since', { skip: !supported }, () => {
  const { home, env } = logins();
  assert.equal(runCli(['install'], env).status, 0);
  const installs = path.join(home, '.local', 'state', 'noonsight', 'installs.json');
  fs.rmSync(path.join(home, 'second-login'), { recursive: true });
  const before = fs.readFileSync(installs, 'utf8');
  const r = runCli(['uninstall', '--managed'], env);
  assert.equal(r.status, 0, r.stderr);
  assert.doesNotMatch(r.stdout, /forgotten/);
  assert.equal(fs.readFileSync(installs, 'utf8'), before);
});

test('by default: install creates ~/.claude when Claude Code has not run yet', () => {
  const home = tempTree({});
  const r = runCli(['install'], { HOME: home });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(noonsightHandlers(readJson(path.join(home, '.claude', 'settings.json'))).length, 6);
});

test('by default: one broken settings file refuses the whole install and leaves every directory as it was', () => {
  const { home, env, dirs } = logins();
  fs.writeFileSync(path.join(home, 'second-login', 'settings.json'), '{ broken');
  const before = dirs.map((d) => (fs.existsSync(path.join(d, 'settings.json')) ? fs.readFileSync(path.join(d, 'settings.json'), 'utf8') : null));
  const r = runCli(['install'], env);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /second-login\/settings\.json is not valid JSON .*nothing was changed/);
  assert.deepEqual(dirs.map((d) => (fs.existsSync(path.join(d, 'settings.json')) ? fs.readFileSync(path.join(d, 'settings.json'), 'utf8') : null)), before);
  assert.equal(fs.existsSync(path.join(home, '.local', 'share', 'noonsight', 'noonsight-hook')), false);
});

test('by default: one broken settings file refuses the whole uninstall and leaves every directory as it was', () => {
  const { home, env, dirs } = logins();
  assert.equal(runCli(['install'], env).status, 0);
  fs.writeFileSync(path.join(home, 'second-login', 'settings.json'), '{ broken');
  const read = () => dirs.map((d) => fs.readFileSync(path.join(d, 'settings.json'), 'utf8'));
  const before = read();
  const r = runCli(['uninstall'], env);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /second-login\/settings\.json is not valid JSON .*nothing was changed/);
  assert.doesNotMatch(r.stdout, /: removed/);
  assert.deepEqual(read(), before);
  assert.equal(fs.existsSync(path.join(home, '.local', 'share', 'noonsight', 'noonsight-hook')), true);
});

test('by default: a hook pointer this account cannot remove refuses the whole uninstall and leaves every directory as it was', { skip: process.getuid?.() === 0 }, () => {
  const { home, env, dirs } = logins();
  assert.equal(runCli(['install'], env).status, 0);
  const pointerDir = path.join(home, '.local', 'share', 'noonsight');
  const read = () => dirs.map((d) => fs.readFileSync(path.join(d, 'settings.json'), 'utf8'));
  const before = read();
  fs.chmodSync(pointerDir, 0o555);
  try {
    const r = runCli(['uninstall'], env);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /noonsight-hook\. Nothing was changed\./);
    assert.doesNotMatch(r.stdout, /: removed/);
    assert.deepEqual(read(), before);
  } finally {
    fs.chmodSync(pointerDir, 0o755);
  }
});

test('--managed warns about each login whose server-managed settings make Claude Code ignore the managed files', { skip: !supported }, () => {
  const { home, env } = logins();
  fs.writeFileSync(path.join(home, '.claude', 'remote-settings.json'), JSON.stringify({ permissions: { deny: ['WebFetch'] } }));
  fs.writeFileSync(path.join(home, '.claude-work', 'remote-settings.json'), JSON.stringify({ managedSourcesBehavior: 'merge', permissions: {} }));
  fs.writeFileSync(path.join(home, 'second-login', 'remote-settings.json'), JSON.stringify({ managedSourcesBehavior: 'first-wins' }));
  const r = runCli(['install', '--managed'], env);
  assert.equal(r.status, 0, r.stderr);
  const warned = r.stdout.split('\n').filter((l) => l.startsWith('warning: the login in '));
  assert.equal(warned.length, 1, r.stdout);
  assert.ok(warned[0]?.includes(path.join(home, '.claude')) && /Run `noonsight install`, without --managed/.test(warned[0] ?? ''), r.stdout);

  // The default install next to it: only logins the machine-wide install still reaches get the rules twice.
  const both = runCli(['install'], env);
  assert.equal(both.status, 0, both.stderr);
  const twice = /sessions that use (.*) receive the rules twice/.exec(both.stdout)?.[1] ?? '';
  assert.ok(!twice.split(', ').includes(path.join(home, '.claude')) && twice.includes(path.join(home, '.claude-work')), both.stdout);
});

test('by default under sudo for another account\'s home: refused, nothing written', { skip: process.getuid?.() !== 0 }, () => {
  const home = tempTree({});
  fs.chownSync(home, 1, 1);
  const r = runCli(['install'], { HOME: home });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /belongs to another account/);
  assert.deepEqual(fs.readdirSync(home), []);
});
