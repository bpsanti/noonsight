// The one-shot migration from sextant, noonsight's earlier name, that `noonsight install` runs. Every
// test builds what a sextant install left in a temporary home directory (and a temporary system
// root for the machine-wide install), with stand-ins for launchctl and systemctl on PATH.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { managedTarget } from '../src/adapters/claude-code/locations.js';
import { PACKAGE_ROOT } from '../src/config/paths.js';
import { CONFIG_SCHEMA_URL } from '../src/commands/init.js';
import { watchService } from '../src/watch/service.js';
import { FAKE_MANAGER, fakeClaude, FIXTURES, LAB_PRESETS, runCli, tempTree } from './helpers.js';

const supported = process.platform === 'darwin' || process.platform === 'linux';
const OLD_LABEL = process.platform === 'darwin' ? 'io.github.bpsanti.sextant-ai.watch' : 'sextant-watch.service';
const SYSTEM_DIR = process.platform === 'darwin' ? 'Library/Application Support/sextant' : 'usr/local/lib/sextant';

const THIRD_PARTY_HOOK = { matcher: 'Bash', hooks: [{ type: 'command', command: '/opt/acme/bin/guard', timeout: 5 }] };

/** A settings file as `sextant install` left it: its four entries after a hook of someone else's. */
function sextantSettings(pointer: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const handler = (arg: string) => ({ type: 'command', command: pointer, args: [arg], timeout: 10 });
  return {
    ...extra,
    hooks: {
      SessionStart: [{ hooks: [handler('session-start')] }],
      PostModelSwitch: [{ hooks: [handler('model-switch')] }],
      PreToolUse: [THIRD_PARTY_HOOK, { matcher: 'Agent|Task', hooks: [handler('agent-call')] }],
      PostToolUse: [{ matcher: 'Agent|Task', hooks: [handler('agent-result')] }],
    },
  };
}

function sextantPointer(cli: string): string {
  return [
    '#!/bin/sh',
    '# sextant-ai hook pointer, written by `sextant install`.',
    '# kind: account',
    '# version: 0.0.0',
    `node='${process.execPath}'`,
    `cli='${cli}'`,
    'exit 0',
    '',
  ].join('\n');
}

/** Output with this copy's own path left out, since the directory it was checked out in may hold any name. */
const shown = (out: string): string => out.split(PACKAGE_ROOT).join('<package>');

function handlers(file: string, suffix: string): string[] {
  const settings = JSON.parse(fs.readFileSync(file, 'utf8')) as { hooks?: Record<string, { hooks: { command: string; args: string[] }[] }[]> };
  return Object.entries(settings.hooks ?? {}).flatMap(([event, groups]) =>
    groups.flatMap((g) => g.hooks.filter((h) => h.command.endsWith(suffix)).map((h) => `${event} ${h.args.join(' ')}`)),
  );
}

/** Every file and directory under a directory, with each file's content, to compare two runs. */
function tree(dir: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (d: string): void => {
    for (const name of fs.readdirSync(d).sort()) {
      const p = path.join(d, name);
      const rel = path.relative(dir, p);
      if (fs.statSync(p).isDirectory()) {
        out[`${rel}/`] = '';
        walk(p);
      } else out[rel] = fs.readFileSync(p, 'utf8');
    }
  };
  walk(dir);
  return out;
}

function machine() {
  const home = tempTree({});
  const root = tempTree({});
  const managerDir = tempTree({});
  const bin = fakeClaude('2.1.325');
  for (const name of ['launchctl', 'systemctl']) fs.writeFileSync(path.join(bin, name), FAKE_MANAGER, { mode: 0o755 });
  const service = watchService({}, home);
  const oldService = path.join(path.dirname(service.file), process.platform === 'darwin' ? `${OLD_LABEL}.plist` : OLD_LABEL);
  const env: Record<string, string> = {
    HOME: home,
    PATH: bin,
    NOONSIGHT_TEST_SERVICE_DIR: managerDir,
    // The stand-in systemctl refuses to disable a unit whose file is missing; the unit being disabled is sextant's.
    NOONSIGHT_TEST_UNIT_FILE: oldService,
    NOONSIGHT_PRESETS_DIR: LAB_PRESETS,
    NOONSIGHT_SYSTEM_ROOT: root,
  };
  const calls = (): string[] => {
    const file = path.join(managerDir, 'calls');
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trimEnd().split('\n') : [];
  };
  return { home, root, env, service, oldService, managerDir, calls };
}

/** What `sextant install`, `sextant init`, some sessions and `sextant watch enable` left in a home directory. */
function sextantInstall(m: ReturnType<typeof machine>) {
  const { home } = m;
  const pointer = path.join(home, '.local', 'share', 'sextant', 'sextant-hook');
  const outside = tempTree({ 'settings.json': sextantSettings(pointer) });
  const files: Record<string, unknown> = {
    '.claude/settings.json': sextantSettings(pointer, { model: 'opus' }),
    '.claude-work/.claude.json': {},
    '.claude-work/settings.json': sextantSettings(pointer),
    '.local/share/sextant/sextant-hook': sextantPointer('/old/sextant-ai/dist/src/cli.js'),
    '.config/sextant/sextant.json': fs
      .readFileSync(path.join(FIXTURES, 'lab', 'config', 'noonsight.json'), 'utf8')
      .replace('{', '{\n  "$schema": "https://unpkg.com/sextant-ai@0/schema/sextant.schema.json",'),
    '.config/sextant/rules/user-haiku-summarize.md': fs.readFileSync(path.join(FIXTURES, 'lab', 'config', 'rules', 'user-haiku-summarize.md'), 'utf8'),
    '.local/state/sextant/decisions.jsonl': '{"event":"session-start","n":1}\n{"event":"session-start","n":2}\n',
    '.local/state/sextant/sessions/abc.json': '{"model":"claude-sonnet-5-5"}',
    '.local/state/sextant/installs.json': { schema: 1, accounts: [path.join(home, '.claude'), path.join(home, '.claude-work'), outside] },
    // noonsight already ran once, through `noonsight run`, before it was installed.
    '.local/state/noonsight/decisions.jsonl': '{"event":"launch","n":3}\n',
  };
  for (const [rel, content] of Object.entries(files)) {
    const file = path.join(home, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
  }
  fs.chmodSync(pointer, 0o755);
  fs.mkdirSync(path.dirname(m.oldService), { recursive: true });
  fs.writeFileSync(m.oldService, '# Written by `sextant watch enable`; `sextant watch disable` removes it.\n');
  fs.writeFileSync(path.join(m.managerDir, 'state'), 'on\n');
  return { pointer, outside };
}

test('a fresh install has nothing to migrate, and a second run changes nothing', { skip: !supported }, () => {
  const m = machine();
  const first = runCli(['install'], m.env);
  assert.equal(first.status, 0, first.stderr);
  assert.doesNotMatch(shown(first.stdout), /sextant/);
  const before = tree(m.home);

  const second = runCli(['install'], m.env);
  assert.equal(second.status, 0, second.stderr);
  assert.doesNotMatch(shown(second.stdout), /sextant/);
  assert.match(second.stdout, /settings\.json: unchanged/);
  assert.deepEqual(tree(m.home), before);
  assert.deepEqual(m.calls(), [], 'no watcher was there, so none is touched');
});

test('an existing sextant install is migrated whole, and a second run is a no-op', { skip: !supported }, () => {
  const m = machine();
  const { pointer, outside } = sextantInstall(m);
  const { home } = m;
  const env = { ...m.env, SEXTANT_SCOPE: 'build' };

  const r = runCli(['install'], env);
  assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
  assert.equal(r.stderr, '');

  // Hooks: in every settings file sextant managed, noonsight's entries replace sextant's, and the rest stays.
  const newPointer = path.join(home, '.local', 'share', 'noonsight', 'noonsight-hook');
  const events = ['SessionStart session-start', 'PostModelSwitch model-switch', 'PreToolUse agent-call', 'PostToolUse agent-result'];
  for (const file of [path.join(home, '.claude', 'settings.json'), path.join(home, '.claude-work', 'settings.json'), path.join(outside, 'settings.json')]) {
    assert.deepEqual(handlers(file, '/sextant-hook'), [], file);
    assert.deepEqual(handlers(file, '/noonsight-hook').sort(), [...events].sort(), file);
    const settings = JSON.parse(fs.readFileSync(file, 'utf8')) as { hooks: { PreToolUse: unknown[] } };
    assert.deepEqual(settings.hooks.PreToolUse[0], THIRD_PARTY_HOOK, `${file} keeps the hook of someone else`);
    assert.match(r.stdout, new RegExp(`migrated from sextant: hooks ${esc(file)}: replaced by noonsight's`));
  }
  assert.equal(JSON.parse(fs.readFileSync(path.join(home, '.claude', 'settings.json'), 'utf8')).model, 'opus');

  // The hook pointer: sextant's is gone with its directory, noonsight's is in place.
  assert.equal(fs.existsSync(pointer), false);
  assert.equal(fs.existsSync(path.join(home, '.local', 'share', 'sextant')), false);
  assert.ok(fs.existsSync(newPointer));
  assert.match(r.stdout, /migrated from sextant: hook pointer .*sextant-hook: removed/);

  // The configuration moved, with its rule files, and points at noonsight's schema.
  const config = path.join(home, '.config', 'noonsight', 'noonsight.json');
  assert.equal(fs.existsSync(path.join(home, '.config', 'sextant')), false);
  assert.equal(JSON.parse(fs.readFileSync(config, 'utf8')).$schema, CONFIG_SCHEMA_URL);
  assert.ok(fs.existsSync(path.join(home, '.config', 'noonsight', 'rules', 'user-haiku-summarize.md')));
  assert.match(r.stdout, new RegExp(`config ${esc(config)}: valid`));

  // The state moved: sextant's decisions come before the one noonsight had logged, and the list of installs is merged.
  const state = path.join(home, '.local', 'state', 'noonsight');
  assert.equal(fs.existsSync(path.join(home, '.local', 'state', 'sextant')), false);
  assert.deepEqual(
    fs.readFileSync(path.join(state, 'decisions.jsonl'), 'utf8').trimEnd().split('\n').map((l) => JSON.parse(l).n),
    [1, 2, 3],
  );
  assert.ok(fs.existsSync(path.join(state, 'sessions', 'abc.json')));
  const accounts = JSON.parse(fs.readFileSync(path.join(state, 'installs.json'), 'utf8')).accounts as string[];
  assert.ok(accounts.includes(outside), 'the directory outside the home directory is still known');
  assert.match(r.stdout, /migrated from sextant: state .* moved to /);

  // The watcher: sextant's stopped and removed, noonsight's on.
  assert.equal(fs.existsSync(m.oldService), false);
  assert.ok(fs.existsSync(m.service.file));
  const uid = process.getuid?.();
  assert.ok(
    m.calls().includes(process.platform === 'darwin' ? `launchctl bootout gui/${uid}/${OLD_LABEL}` : `systemctl --user disable --now ${OLD_LABEL}`),
    m.calls().join('\n'),
  );
  assert.ok(
    m.calls().includes(process.platform === 'darwin' ? `launchctl bootstrap gui/${uid} ${m.service.file}` : 'systemctl --user enable --now noonsight-watch.service'),
    m.calls().join('\n'),
  );
  assert.match(r.stdout, /migrated from sextant: watcher .*: stopped and removed\nwatcher: on/);

  assert.match(r.stdout, /warning: SEXTANT_SCOPE is set in this environment, but noonsight reads NOONSIGHT_SCOPE/);

  // A second run finds nothing left to migrate and changes nothing.
  const before = { home: tree(home), outside: tree(outside) };
  const calls = m.calls();
  const again = runCli(['install'], env);
  assert.equal(again.status, 0, again.stderr);
  assert.doesNotMatch(again.stdout, /migrated from sextant/);
  assert.deepEqual({ home: tree(home), outside: tree(outside) }, before);
  assert.deepEqual(m.calls(), calls, 'the watcher is left as the first run made it');
});

test('an install into one directory replaces sextant hooks there and points at the rest', { skip: !supported }, () => {
  const m = machine();
  const { pointer } = sextantInstall(m);
  const dir = path.join(m.home, '.claude');

  const r = runCli(['install', '--account', dir], m.env);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(handlers(path.join(dir, 'settings.json'), '/sextant-hook'), []);
  assert.equal(handlers(path.join(dir, 'settings.json'), '/noonsight-hook').length, 4);
  assert.match(r.stdout, /migrated from sextant: hooks .*\.claude\/settings\.json: replaced by noonsight's/);
  assert.match(r.stdout, /note: a sextant install left .*; run `noonsight install`, without --account, to migrate them\./);
  // Everything else stays for the full migration: another directory still runs sextant's pointer.
  assert.ok(fs.existsSync(pointer));
  assert.ok(fs.existsSync(path.join(m.home, '.config', 'sextant', 'sextant.json')));
  assert.ok(fs.existsSync(m.oldService));
  assert.deepEqual(m.calls(), []);
});

test('the machine-wide install migrates sextant machine-wide install, and a second run is a no-op', { skip: !supported }, () => {
  const m = machine();
  const target = managedTarget(m.env);
  const managedDir = target.managedDir ?? '';
  const oldPointer = path.join(m.root, SYSTEM_DIR, 'sextant-hook');
  const oldDropIn = path.join(managedDir, 'managed-settings.d', 'sextant-ai.json');
  // A sextant drop-in someone also put a setting of their own in.
  fs.mkdirSync(path.dirname(oldDropIn), { recursive: true });
  fs.writeFileSync(oldDropIn, JSON.stringify(sextantSettings(oldPointer, { env: { ACME: '1' } }), null, 2));
  fs.mkdirSync(path.dirname(oldPointer), { recursive: true });
  fs.writeFileSync(oldPointer, sextantPointer('/old/cli.js'), { mode: 0o755 });

  const r = runCli(['install', '--managed'], m.env);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(handlers(target.settingsFile, '/noonsight-hook').length, 4);
  assert.deepEqual(handlers(oldDropIn, '/sextant-hook'), []);
  assert.deepEqual(JSON.parse(fs.readFileSync(oldDropIn, 'utf8')), { env: { ACME: '1' }, hooks: { PreToolUse: [THIRD_PARTY_HOOK] } });
  assert.equal(fs.existsSync(oldPointer), false);
  assert.equal(fs.existsSync(path.dirname(oldPointer)), false);
  assert.match(r.stdout, /migrated from sextant: hooks .*sextant-ai\.json: removed \(the file keeps settings that are not sextant's\)/);
  assert.match(r.stdout, /migrated from sextant: hook pointer .*sextant-hook: removed/);

  const before = tree(m.root);
  const again = runCli(['install', '--managed'], m.env);
  assert.equal(again.status, 0, again.stderr);
  assert.doesNotMatch(shown(again.stdout), /sextant/);
  assert.deepEqual(tree(m.root), before);
});

test('a sextant drop-in left with nothing else in it is removed', { skip: !supported }, () => {
  const m = machine();
  const managedDir = managedTarget(m.env).managedDir ?? '';
  const oldDropIn = path.join(managedDir, 'managed-settings.d', 'sextant-ai.json');
  const settings = sextantSettings(path.join(m.root, SYSTEM_DIR, 'sextant-hook')) as { hooks: Record<string, unknown[]> };
  settings.hooks.PreToolUse = settings.hooks.PreToolUse?.slice(1) ?? [];
  fs.mkdirSync(path.dirname(oldDropIn), { recursive: true });
  fs.writeFileSync(oldDropIn, JSON.stringify(settings));

  const r = runCli(['install', '--managed'], m.env);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.existsSync(oldDropIn), false);
  assert.match(r.stdout, /migrated from sextant: hooks .*sextant-ai\.json: removed the file/);
});

test('an install for this account names a sextant machine-wide install still in place', { skip: !supported }, () => {
  const m = machine();
  const managedDir = managedTarget(m.env).managedDir ?? '';
  const oldDropIn = path.join(managedDir, 'managed-settings.d', 'sextant-ai.json');
  fs.mkdirSync(path.dirname(oldDropIn), { recursive: true });
  fs.writeFileSync(oldDropIn, JSON.stringify(sextantSettings(path.join(m.root, SYSTEM_DIR, 'sextant-hook'))));

  const r = runCli(['install'], m.env);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /note: sextant is still installed for the whole machine .*; migrate it with `noonsight install --managed`, as an administrator\./);
  assert.ok(fs.existsSync(oldDropIn), 'an install for one account leaves the machine-wide files alone');
});

test('a state file both names have, other than the log and the list of installs, is left in place and named', { skip: !supported }, () => {
  const m = machine();
  const oldRotated = path.join(m.home, '.local', 'state', 'sextant', 'decisions.1.jsonl');
  const newRotated = path.join(m.home, '.local', 'state', 'noonsight', 'decisions.1.jsonl');
  for (const [file, text] of [
    [oldRotated, '{"n":"old"}\n'],
    [newRotated, '{"n":"new"}\n'],
    [path.join(m.home, '.local', 'state', 'sextant', 'sessions', 'a.json'), '{}'],
  ] as const) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  }

  const r = runCli(['install'], m.env);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.readFileSync(oldRotated, 'utf8'), '{"n":"old"}\n');
  assert.equal(fs.readFileSync(newRotated, 'utf8'), '{"n":"new"}\n');
  assert.ok(fs.existsSync(path.join(m.home, '.local', 'state', 'noonsight', 'sessions', 'a.json')));
  assert.match(r.stdout, new RegExp(`moved to .*, except ${esc(oldRotated)}, which noonsight also has and which were left in place`));

  const before = tree(m.home);
  const again = runCli(['install'], m.env);
  assert.equal(again.status, 0, again.stderr);
  assert.deepEqual(tree(m.home), before, 'what was left stays as it was');
});

const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
