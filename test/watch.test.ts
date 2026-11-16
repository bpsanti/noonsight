// sextant watch: the opt-in watcher and its per-user service, always in a temporary home directory.
// A stand-in for launchctl and systemctl on PATH records each call, so no real service is ever
// loaded, and the watcher itself runs as a child process watching a temporary home.

import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { serviceContent, SERVICE_LABEL, SERVICE_UNIT, watchService } from '../src/watch/service.js';
import { CLI, fakeClaude, LAB_CONFIG, LAB_PRESETS, runCli, tempTree } from './helpers.js';

const supported = process.platform === 'darwin' || process.platform === 'linux';
const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A stand-in for launchctl and systemctl that records its calls and remembers whether the service runs. */
const FAKE_MANAGER = `#!/bin/sh
# Shell builtins only: PATH holds nothing but the stand-ins.
dir="$SEXTANT_TEST_SERVICE_DIR"
call="\${0##*/} $*"
echo "$call" >> "$dir/calls"
state=off
[ -f "$dir/state" ] && read -r state < "$dir/state"
case "$call" in
  "launchctl bootstrap "*|"systemctl --user enable --now "*)
    if [ -f "$dir/refuse" ]; then echo "refused by the test" >&2; exit 5; fi
    echo on > "$dir/state";;
  "launchctl bootout "*)
    [ "$state" = on ] || { echo "Boot-out failed: 3: No such process" >&2; exit 3; }
    echo off > "$dir/state";;
  "systemctl --user disable --now "*) echo off > "$dir/state";;
  "launchctl print "*) [ "$state" = on ] || exit 113;;
  "systemctl --user is-active "*) [ "$state" = on ] || exit 3;;
  "systemctl --user daemon-reload") ;;
  *) echo "unexpected call: $call" >&2; exit 64;;
esac
`;

function machine() {
  const home = tempTree({ '.local/state/sextant/.keep': '', '.claude/.keep': '' });
  const managerDir = tempTree({});
  const bin = fakeClaude('2.1.325');
  for (const name of ['launchctl', 'systemctl']) fs.writeFileSync(path.join(bin, name), FAKE_MANAGER, { mode: 0o755 });
  const env = {
    HOME: home,
    PATH: bin,
    SEXTANT_TEST_SERVICE_DIR: managerDir,
    SEXTANT_CONFIG: LAB_CONFIG,
    SEXTANT_PRESETS_DIR: LAB_PRESETS,
    SEXTANT_SYSTEM_ROOT: tempTree({}),
  };
  const service = watchService(env, home);
  // The service file's directory exists, as it does on a real machine, so the file is the only new entry.
  fs.mkdirSync(path.dirname(service.file), { recursive: true });
  const calls = (): string[] => {
    const file = path.join(managerDir, 'calls');
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trimEnd().split('\n') : [];
  };
  return { home, env, service, managerDir, calls };
}

/** Every file below the directory, with its inode, modification time and content; directories are left out. */
function files(root: string): Map<string, string> {
  const found = new Map<string, string>();
  const walk = (p: string): void => {
    const st = fs.lstatSync(p, { bigint: true });
    if (st.isDirectory()) for (const name of fs.readdirSync(p)) walk(path.join(p, name));
    else found.set(p, `${st.ino} ${st.mtimeNs} ${fs.readFileSync(p, 'utf8')}`);
  };
  walk(root);
  return found;
}

test('the service file runs this copy of sextant at login and keeps it running', () => {
  const runtime = { node: '/opt/node & co/bin/node', cli: '/opt/100%/sextant/dist/src/cli.js' };
  const mac = watchService({}, '/Users/u', 'darwin');
  assert.equal(mac.file, `/Users/u/Library/LaunchAgents/${SERVICE_LABEL}.plist`);
  const plist = serviceContent(mac, runtime);
  assert.match(plist, /<key>ProgramArguments<\/key>\s*<array><string>\/opt\/node &amp; co\/bin\/node<\/string><string>\/opt\/100%\/sextant\/dist\/src\/cli\.js<\/string><string>watch<\/string><string>run<\/string><\/array>/);
  assert.match(plist, /<key>RunAtLoad<\/key><true\/>/);
  assert.match(plist, /<key>KeepAlive<\/key><true\/>/);
  assert.match(plist, /<key>StandardErrorPath<\/key><string>\/Users\/u\/\.local\/state\/sextant\/watch\.log<\/string>/);
  assert.doesNotMatch(plist, /WatchPaths/);

  const linux = watchService({}, '/home/u', 'linux');
  assert.equal(linux.file, `/home/u/.config/systemd/user/${SERVICE_UNIT}`);
  assert.equal(watchService({ XDG_CONFIG_HOME: '/xdg' }, '/home/u', 'linux').file, `/xdg/systemd/user/${SERVICE_UNIT}`);
  const unit = serviceContent(linux, runtime);
  assert.match(unit, /^ExecStart="\/opt\/node & co\/bin\/node" "\/opt\/100%%\/sextant\/dist\/src\/cli\.js" "watch" "run"$/m);
  assert.match(unit, /^Restart=always$/m);
  assert.match(unit, /^WantedBy=default\.target$/m);
  assert.match(unit, /^StandardOutput=append:\/home\/u\/\.local\/state\/sextant\/watch\.log$/m);

  assert.throws(() => watchService({}, 'C:\\Users\\u', 'win32'), /not supported/);
});

test('the watcher is off by default: install writes no service, and check says it is off', { skip: !supported }, () => {
  const { env, service, calls } = machine();
  const r = runCli(['install'], env);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.existsSync(service.file), false);
  const check = runCli(['check'], env);
  assert.match(check.stdout, /^ok: watcher: off; `sextant watch enable`/m);
  assert.deepEqual(calls(), [], 'nothing asked the service manager');
});

test('watch enable writes only its service file and starts it; again changes nothing; disable removes exactly that file', { skip: !supported }, () => {
  const { home, env, service, calls } = machine();
  assert.equal(runCli(['install'], env).status, 0);
  const before = files(home);

  const on = runCli(['watch', 'enable'], env);
  assert.equal(on.status, 0, on.stderr);
  assert.match(on.stdout, new RegExp(`^watcher: on \\(${esc(service.file)}\\)$`, 'm'));
  const after = files(home);
  assert.deepEqual([...after.keys()].filter((f) => !before.has(f)), [service.file], 'the service file is the only new file');
  for (const [file, state] of before) assert.equal(after.get(file), state, `${file} is unchanged`);
  const content = fs.readFileSync(service.file, 'utf8');
  assert.ok(content.includes(fs.realpathSync(CLI)), content);
  assert.ok(content.includes(process.execPath), content);
  assert.deepEqual(
    calls(),
    process.platform === 'darwin'
      ? [`launchctl bootstrap gui/${process.getuid?.()} ${service.file}`]
      : ['systemctl --user daemon-reload', `systemctl --user enable --now ${SERVICE_UNIT}`],
  );

  const again = runCli(['watch', 'enable'], env);
  assert.equal(again.status, 0, again.stderr);
  assert.match(again.stdout, /^watcher: already on/);
  assert.deepEqual(files(home), after, 'enabling again writes nothing');

  const check = runCli(['check'], env);
  assert.match(check.stdout, new RegExp(`^ok: watcher: on \\(${esc(service.file)}\\)$`, 'm'));
  assert.doesNotMatch(check.stdout, /watcher: .*another copy/);

  const callsBefore = calls().length;
  const off = runCli(['watch', 'disable'], env);
  assert.equal(off.status, 0, off.stderr);
  assert.match(off.stdout, /^watcher: off; removed /);
  assert.deepEqual(files(home), before, 'every file is as it was before enable');
  assert.deepEqual(
    calls().slice(callsBefore),
    process.platform === 'darwin'
      ? [`launchctl bootout gui/${process.getuid?.()}/${SERVICE_LABEL}`]
      : [`systemctl --user disable --now ${SERVICE_UNIT}`, 'systemctl --user daemon-reload'],
  );
  assert.match(runCli(['check'], env).stdout, /^ok: watcher: off/m);
  const twice = runCli(['watch', 'disable'], env);
  assert.equal(twice.status, 0, twice.stderr);
  assert.match(twice.stdout, /^watcher: already off/);
});

test('check reports a watcher whose service is in place but not running, and uninstall says the watcher is still on', { skip: !supported }, () => {
  const { env, service, managerDir } = machine();
  assert.equal(runCli(['install'], env).status, 0);
  assert.equal(runCli(['watch', 'enable'], env).status, 0);
  fs.writeFileSync(path.join(managerDir, 'state'), 'off\n');
  const check = runCli(['check'], env);
  assert.equal(check.status, 1, check.stdout);
  assert.match(check.stdout, /^problem: watcher: on in .*, but not running; run `sextant watch enable` again$/m);
  // The last line the watcher logged is shown, as a warning when it reports a problem.
  fs.writeFileSync(service.log, '2026-01-01T00:00:00.000Z watching\n2026-01-01T00:00:01.000Z problem: install into /x failed\n');
  assert.match(runCli(['check'], env).stdout, /^warning: watcher log .*watch\.log: 2026-01-01T00:00:01\.000Z problem: install into \/x failed$/m);
  // Enabling again starts it without rewriting the file.
  const again = runCli(['watch', 'enable'], env);
  assert.equal(again.status, 0, again.stderr);
  assert.equal(fs.readFileSync(path.join(managerDir, 'state'), 'utf8'), 'on\n');

  const removed = runCli(['uninstall'], env);
  assert.equal(removed.status, 0, removed.stderr);
  assert.match(removed.stdout, /^note: the watcher is still on .*`sextant watch disable`/m);
});

test('watch enable that the service manager refuses leaves no service file behind', { skip: !supported }, () => {
  const { home, env, service, managerDir } = machine();
  fs.writeFileSync(path.join(managerDir, 'refuse'), '');
  const before = files(home);
  const r = runCli(['watch', 'enable'], env);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /could not start the watcher .*refused by the test.*the service file was removed again/s);
  assert.equal(fs.existsSync(service.file), false);
  assert.deepEqual(files(home), before);
});

test('watch disable leaves alone a service file sextant did not write', { skip: !supported }, () => {
  const { env, service, calls } = machine();
  fs.writeFileSync(service.file, 'someone else\n');
  const r = runCli(['watch', 'disable'], env);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /was not written by sextant/);
  assert.equal(fs.readFileSync(service.file, 'utf8'), 'someone else\n');
  assert.equal(runCli(['watch', 'enable'], env).status, 1);
  assert.equal(fs.readFileSync(service.file, 'utf8'), 'someone else\n');
  assert.deepEqual(calls(), []);
});

test('watch usage errors exit 2', () => {
  for (const args of [['watch'], ['watch', 'start'], ['watch', 'enable', 'now']]) {
    const r = runCli(args);
    assert.equal(r.status, 2, args.join(' '));
    assert.match(r.stderr, /usage: sextant watch enable/);
  }
});

// The watcher itself.

interface Running {
  readonly child: ChildProcess;
  readonly output: () => string;
}

/** Start `sextant watch run` on the home directory, and wait until it watches. */
async function startWatcher(env: Record<string, string>): Promise<Running> {
  const child = spawn(process.execPath, [CLI, 'watch', 'run'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout?.on('data', (d: Buffer) => (output += d.toString()));
  child.stderr?.on('data', (d: Buffer) => (output += d.toString()));
  await until(() => / watching /.test(output), () => `the watcher did not start:\n${output}`);
  return { child, output: () => output };
}

async function until(done: () => boolean, message: () => string, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!done()) {
    if (Date.now() > deadline) assert.fail(message());
    await new Promise((r) => setTimeout(r, 25));
  }
}

function hasSextantHooks(dir: string): boolean {
  try {
    return fs.readFileSync(path.join(dir, 'settings.json'), 'utf8').includes('sextant-hook');
  } catch {
    return false;
  }
}

test('the watcher installs into a new configuration directory in the home directory, and nowhere else', async (t) => {
  const home = tempTree({
    '.local/state/sextant/.keep': '',
    '.claude-before/.claude.json': {},
    'code/.keep': '',
  });
  const env = { HOME: home, PATH: process.env.PATH ?? '', SEXTANT_SYSTEM_ROOT: tempTree({}), SEXTANT_CONFIG: LAB_CONFIG, SEXTANT_PRESETS_DIR: LAB_PRESETS };
  const watcher = await startWatcher(env);
  t.after(() => watcher.child.kill());
  const entries = new Set(fs.readdirSync(home));

  // A directory that is not a configuration directory, and a configuration directory below the home directory.
  fs.mkdirSync(path.join(home, 'notes'));
  fs.mkdirSync(path.join(home, 'code', 'project'));
  fs.writeFileSync(path.join(home, 'code', 'project', '.claude.json'), '{}');
  // A new login: Claude Code creates the directory, then its marker a moment later.
  const login = path.join(home, '.claude-new');
  fs.mkdirSync(login);
  await new Promise((r) => setTimeout(r, 300));
  fs.writeFileSync(path.join(login, '.claude.json'), '{}');
  entries.add('notes').add('.claude-new');

  await until(() => hasSextantHooks(login), () => `no hooks in ${login}:\n${watcher.output()}`);
  await until(() => watcher.output().includes(`new Claude Code configuration ${login}: installed`), () => watcher.output());
  assert.ok(fs.existsSync(path.join(home, '.local', 'share', 'sextant', 'sextant-hook')));

  // The default directory has its marker in the home directory, so it needs none of its own.
  const defaultDir = path.join(home, '.claude');
  fs.mkdirSync(defaultDir);
  entries.add('.claude');
  await until(() => hasSextantHooks(defaultDir), () => `no hooks in ${defaultDir}:\n${watcher.output()}`);

  assert.equal(hasSextantHooks(path.join(home, '.claude-before')), false, 'a directory that was there before is left to sextant install');
  assert.equal(hasSextantHooks(path.join(home, 'code', 'project')), false, 'nothing below the home directory is watched');
  assert.deepEqual(fs.readdirSync(path.join(home, 'notes')), [], 'a directory that is not a configuration directory is left alone');
  assert.deepEqual(new Set(fs.readdirSync(home)), entries, 'the watcher made no entry in the home directory');
  assert.equal(watcher.child.exitCode, null, 'the watcher is still running');
});

test('the watcher does not create ~/.local itself; it says to run sextant install', async (t) => {
  const home = tempTree({});
  const env = { HOME: home, PATH: process.env.PATH ?? '', SEXTANT_SYSTEM_ROOT: tempTree({}) };
  const watcher = await startWatcher(env);
  t.after(() => watcher.child.kill());
  const login = path.join(home, '.claude-new');
  fs.mkdirSync(login);
  fs.writeFileSync(path.join(login, '.claude.json'), '{}');
  await until(() => / problem: .* does not exist; run `sextant install`/.test(watcher.output()), () => watcher.output());
  assert.deepEqual(fs.readdirSync(home), ['.claude-new']);
  assert.deepEqual(fs.readdirSync(login), ['.claude.json']);
});
