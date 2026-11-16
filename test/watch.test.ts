// noonsight watch: the opt-in watcher and its per-user service, always in a temporary home directory.
// A stand-in for launchctl and systemctl on PATH records each call, so no real service is ever
// loaded, and the watcher itself runs as a child process watching a temporary home.

import assert from 'node:assert/strict';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { serviceContent, SERVICE_LABEL, SERVICE_UNIT, watchService, type WatchService } from '../src/watch/service.js';
import { startWatcher as runWatcher } from '../src/watch/watcher.js';
import { packageVersion } from '../src/version.js';
import { CLI, FAKE_MANAGER, fakeClaude, LAB_CONFIG, LAB_PRESETS, runCli, tempTree } from './helpers.js';

const supported = process.platform === 'darwin' || process.platform === 'linux';
const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function machine() {
  const home = tempTree({ '.local/state/noonsight/.keep': '', '.claude/.keep': '' });
  const managerDir = tempTree({});
  const bin = fakeClaude('2.1.325');
  for (const name of ['launchctl', 'systemctl']) fs.writeFileSync(path.join(bin, name), FAKE_MANAGER, { mode: 0o755 });
  const env = {
    HOME: home,
    PATH: bin,
    NOONSIGHT_TEST_SERVICE_DIR: managerDir,
    NOONSIGHT_TEST_UNIT_FILE: path.join(home, '.config', 'systemd', 'user', SERVICE_UNIT),
    NOONSIGHT_CONFIG: LAB_CONFIG,
    NOONSIGHT_PRESETS_DIR: LAB_PRESETS,
    NOONSIGHT_SYSTEM_ROOT: tempTree({}),
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

/** The launchd property list as plutil, the real consumer, reads it. */
function plistModel(text: string): Record<string, unknown> {
  const r = spawnSync('plutil', ['-convert', 'json', '-o', '-', '-'], { input: text, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout) as Record<string, unknown>;
}

/** A systemd unit as systemd reads it: for each section, the values of each key in order. */
function unitModel(text: string): Record<string, Record<string, string[]> | undefined> {
  const sections: Record<string, Record<string, string[]>> = {};
  let section: Record<string, string[]> | undefined;
  for (const line of text.split('\n')) {
    if (line === '' || line.startsWith('#')) continue;
    const head = /^\[(.+)\]$/.exec(line);
    if (head) {
      section = {};
      sections[head[1] ?? ''] = section;
      continue;
    }
    const eq = line.indexOf('=');
    assert.ok(section && eq > 0, `not a unit line: ${line}`);
    (section[line.slice(0, eq)] ??= []).push(line.slice(eq + 1));
  }
  return sections;
}

/** The words of an ExecStart= value as systemd splits them: whitespace separates, double quotes group, a backslash escapes inside quotes, and %% is a literal %. */
function systemdWords(value: string): string[] {
  return [...value.matchAll(/"((?:[^"\\]|\\.)*)"|(\S+)/g)].map((m) => (m[1] ?? m[2] ?? '').replace(/\\(.)/g, '$1').replace(/%%/g, '%').replace(/\$\$/g, '$'));
}

/** The command line a service file runs, read through the service manager's own format. */
function serviceArgv(service: WatchService, content: string): string[] {
  if (service.platform === 'darwin') return plistModel(content).ProgramArguments as string[];
  const exec = unitModel(content).Service?.ExecStart?.[0];
  assert.ok(exec !== undefined, 'the unit has an ExecStart');
  return systemdWords(exec);
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

test('the launchd service file runs this copy of noonsight at login and keeps it running', { skip: process.platform !== 'darwin' }, () => {
  const runtime = { node: '/opt/node & co/bin/node', cli: '/opt/100%/noonsight$/dist/src/cli.js' };
  const mac = watchService({}, '/Users/u', 'darwin');
  assert.equal(mac.file, `/Users/u/Library/LaunchAgents/${SERVICE_LABEL}.plist`);
  const plist = plistModel(serviceContent(mac, runtime));
  assert.deepEqual(plist.ProgramArguments, [runtime.node, runtime.cli, 'watch', 'run']);
  assert.equal(plist.RunAtLoad, true);
  assert.equal(plist.KeepAlive, true);
  assert.equal(plist.StandardErrorPath, '/Users/u/.local/state/noonsight/watch.log');
  assert.equal(plist.WatchPaths, undefined);
});

test('the systemd unit runs this copy of noonsight at login and keeps it running', () => {
  const runtime = { node: '/opt/node & co/bin/node', cli: '/opt/100%/noonsight$/dist/src/cli.js' };
  const linux = watchService({}, '/home/u', 'linux');
  assert.equal(linux.file, `/home/u/.config/systemd/user/${SERVICE_UNIT}`);
  assert.equal(watchService({ XDG_CONFIG_HOME: '/xdg' }, '/home/u', 'linux').file, `/xdg/systemd/user/${SERVICE_UNIT}`);
  const unit = unitModel(serviceContent(linux, runtime));
  assert.deepEqual(systemdWords(unit.Service?.ExecStart?.[0] ?? ''), [runtime.node, runtime.cli, 'watch', 'run']);
  assert.deepEqual(unit.Service?.Restart, ['always']);
  assert.deepEqual(unit.Service?.StandardOutput, ['append:/home/u/.local/state/noonsight/watch.log']);
  assert.deepEqual(unit.Install?.WantedBy, ['default.target']);

  assert.throws(() => watchService({}, 'C:\\Users\\u', 'win32'), /not supported/);
});

test('the watcher is off by default: install writes no service, and check says it is off', { skip: !supported }, () => {
  const { env, service, calls } = machine();
  const r = runCli(['install'], env);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.existsSync(service.file), false);
  assert.deepEqual(calls(), [], 'install asks the service manager nothing');
  const check = runCli(['check'], env);
  assert.match(check.stdout, /^ok: watcher: off; `noonsight watch enable`/m);
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
  const argv = serviceArgv(service, fs.readFileSync(service.file, 'utf8'));
  assert.deepEqual(argv.slice(0, 2), [process.execPath, fs.realpathSync(CLI)]);
  assert.deepEqual(argv.slice(2), ['watch', 'run']);
  assert.deepEqual(
    calls(),
    process.platform === 'darwin'
      ? [`launchctl print gui/${process.getuid?.()}/${SERVICE_LABEL}`, `launchctl bootstrap gui/${process.getuid?.()} ${service.file}`]
      : [`systemctl --user is-active --quiet ${SERVICE_UNIT}`, 'systemctl --user daemon-reload', `systemctl --user enable --now ${SERVICE_UNIT}`],
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

test('check reports a watcher whose service is in place but not running', { skip: !supported }, () => {
  const { env, service, managerDir } = machine();
  assert.equal(runCli(['install'], env).status, 0);
  assert.equal(runCli(['watch', 'enable'], env).status, 0);
  fs.writeFileSync(path.join(managerDir, 'state'), 'off\n');
  const check = runCli(['check'], env);
  assert.equal(check.status, 1, check.stdout);
  assert.match(check.stdout, /^problem: watcher: on in .*, but not running; run `noonsight watch enable` again$/m);
  // The last line the watcher logged is shown, as a warning when it reports a problem.
  fs.writeFileSync(service.log, '2026-01-01T00:00:00.000Z watching\n2026-01-01T00:00:01.000Z problem: install into /x failed\n');
  assert.match(runCli(['check'], env).stdout, /^warning: watcher log .*watch\.log: 2026-01-01T00:00:01\.000Z problem: install into \/x failed$/m);
  // Enabling again starts it without rewriting the file.
  const again = runCli(['watch', 'enable'], env);
  assert.equal(again.status, 0, again.stderr);
  assert.equal(fs.readFileSync(path.join(managerDir, 'state'), 'utf8'), 'on\n');
});

test('watch enable that replaces a running service and is then refused leaves the watcher stopped, and says so', { skip: !supported }, () => {
  const { env, service, managerDir } = machine();
  assert.equal(runCli(['install'], env).status, 0);
  assert.equal(runCli(['watch', 'enable'], env).status, 0);
  // A copy of noonsight that runs from another Node.js, as after an upgrade: enable replaces its service file.
  const other = serviceContent(service, { node: '/usr/local/other/node', cli: fs.realpathSync(CLI) });
  fs.writeFileSync(service.file, other);
  fs.writeFileSync(path.join(managerDir, 'refuse'), '');
  const r = runCli(['watch', 'enable'], env);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /could not start the watcher .*refused by the test.*the watcher is stopped, and the service file was put back as it was; run `noonsight watch enable` again/s);
  assert.equal(fs.readFileSync(service.file, 'utf8'), other);
  assert.equal(fs.readFileSync(path.join(managerDir, 'state'), 'utf8'), 'off\n');
});

test('a running watcher whose service file was removed by hand is reported by check, and enable and disable still reach it', { skip: !supported }, () => {
  const { env, service, managerDir } = machine();
  assert.equal(runCli(['install'], env).status, 0);
  assert.equal(runCli(['watch', 'enable'], env).status, 0);
  fs.rmSync(service.file);
  const check = runCli(['check'], env);
  assert.equal(check.status, 1, check.stdout);
  assert.match(check.stdout, /^problem: watcher: loaded without .*; run `noonsight watch disable` to stop it$/m);

  const again = runCli(['watch', 'enable'], env);
  assert.equal(again.status, 0, again.stderr);
  assert.equal(fs.readFileSync(path.join(managerDir, 'state'), 'utf8'), 'on\n');
  assert.ok(fs.existsSync(service.file));
  fs.rmSync(service.file);

  const off = runCli(['watch', 'disable'], env);
  assert.equal(off.status, 0, off.stderr);
  assert.match(off.stdout, /^watcher: off; it was running without /m);
  assert.equal(fs.readFileSync(path.join(managerDir, 'state'), 'utf8'), 'off\n');
  assert.match(runCli(['check'], env).stdout, /^ok: watcher: off/m);
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

test('watch disable leaves alone a service file noonsight did not write', { skip: !supported }, () => {
  const { env, service, calls } = machine();
  fs.writeFileSync(service.file, 'someone else\n');
  const r = runCli(['watch', 'disable'], env);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /was not written by noonsight/);
  assert.equal(fs.readFileSync(service.file, 'utf8'), 'someone else\n');
  assert.equal(runCli(['watch', 'enable'], env).status, 1);
  assert.equal(fs.readFileSync(service.file, 'utf8'), 'someone else\n');
  assert.deepEqual(calls(), []);
});

test('watch usage errors exit 2', () => {
  for (const args of [['watch'], ['watch', 'start'], ['watch', 'enable', 'now']]) {
    const r = runCli(args);
    assert.equal(r.status, 2, args.join(' '));
    assert.match(r.stderr, /usage: noonsight watch enable/);
  }
});

// The watcher itself.

interface Running {
  readonly child: ChildProcess;
  readonly output: () => string;
}

/** Start `noonsight watch run` on the home directory, and wait until it watches. */
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

/** Whether the directory's settings.json holds a hook whose command is noonsight's hook pointer. */
function hasNoonsightHooks(dir: string): boolean {
  try {
    const settings = JSON.parse(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8')) as {
      hooks: Record<string, Array<{ hooks: Array<{ command: string }> }>>;
    };
    return Object.values(settings.hooks).some((groups) => groups.some((group) => group.hooks.some((hook) => hook.command.includes('noonsight-hook'))));
  } catch {
    return false;
  }
}

test('the watcher installs into a new configuration directory in the home directory, and nowhere else', async (t) => {
  const home = tempTree({
    '.local/state/noonsight/.keep': '',
    '.claude-before/.claude.json': {},
    'code/.keep': '',
  });
  const env = { HOME: home, PATH: process.env.PATH ?? '', NOONSIGHT_SYSTEM_ROOT: tempTree({}), NOONSIGHT_CONFIG: LAB_CONFIG, NOONSIGHT_PRESETS_DIR: LAB_PRESETS };
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

  await until(() => hasNoonsightHooks(login), () => `no hooks in ${login}:\n${watcher.output()}`);
  await until(() => watcher.output().includes(`new Claude Code configuration ${login}: installed`), () => watcher.output());
  assert.ok(fs.existsSync(path.join(home, '.local', 'share', 'noonsight', 'noonsight-hook')));

  // The default directory has its marker in the home directory, so it needs none of its own.
  const defaultDir = path.join(home, '.claude');
  fs.mkdirSync(defaultDir);
  entries.add('.claude');
  await until(() => hasNoonsightHooks(defaultDir), () => `no hooks in ${defaultDir}:\n${watcher.output()}`);

  assert.equal(hasNoonsightHooks(path.join(home, '.claude-before')), false, 'a directory that was there before is left to noonsight install');
  assert.equal(hasNoonsightHooks(path.join(home, 'code', 'project')), false, 'nothing below the home directory is watched');
  assert.deepEqual(fs.readdirSync(path.join(home, 'notes')), [], 'a directory that is not a configuration directory is left alone');
  assert.deepEqual(new Set(fs.readdirSync(home)), entries, 'the watcher made no entry in the home directory');
  assert.equal(watcher.child.exitCode, null, 'the watcher is still running');
});

test('a watcher install that throws logs its failure on one line that says problem', async (t) => {
  const home = tempTree({ '.local/.keep': '' });
  const logged: string[] = [];
  const close = runWatcher({
    home,
    log: (text) => logged.push(text),
    install: () => {
      throw new Error('disk full');
    },
  });
  t.after(close);
  const login = path.join(home, '.claude-new');
  fs.mkdirSync(login);
  fs.writeFileSync(path.join(login, '.claude.json'), '{}');
  await until(() => logged.some((line) => line.startsWith('problem:')), () => logged.join('\n'));
  assert.deepEqual(logged.filter((line) => line.startsWith('problem:')), [`problem: install into ${login} failed: disk full`]);
});

test('a marker written after the fast window is still picked up', async (t) => {
  const home = tempTree({ '.local/.keep': '' });
  const installed: string[] = [];
  const close = runWatcher({
    home,
    log: () => {},
    install: (dir) => {
      installed.push(dir);
    },
    fastWindowMs: 100,
    slowPollMs: 50,
  });
  t.after(close);
  const login = path.join(home, '.claude-late');
  fs.mkdirSync(login);
  await new Promise((r) => setTimeout(r, 400));
  fs.writeFileSync(path.join(login, '.claude.json'), '{}');
  await until(() => installed.length > 0, () => `nothing installed into ${login}`);
  assert.deepEqual(installed, [login]);
});

test('macOS: a loaded job without a running process is a warning, and enable and disable still reach it', { skip: process.platform !== 'darwin' }, () => {
  const { env, managerDir } = machine();
  assert.equal(runCli(['install'], env).status, 0);
  assert.equal(runCli(['watch', 'enable'], env).status, 0);
  assert.match(runCli(['check'], env).stdout, /^ok: watcher: on \(/m);

  fs.writeFileSync(path.join(managerDir, 'state'), 'loaded\n');
  const loaded = runCli(['check'], env);
  assert.match(loaded.stdout, /^warning: watcher: on in .*, but loaded without a running process/m);
  assert.doesNotMatch(loaded.stdout, /^ok: watcher: on \(/m);

  assert.equal(runCli(['watch', 'enable'], env).status, 0);
  assert.equal(fs.readFileSync(path.join(managerDir, 'state'), 'utf8'), 'on\n');

  fs.writeFileSync(path.join(managerDir, 'state'), 'loaded\n');
  const off = runCli(['watch', 'disable'], env);
  assert.equal(off.status, 0, off.stderr);
  assert.equal(fs.readFileSync(path.join(managerDir, 'state'), 'utf8'), 'off\n');
});

test('a watcher install that fails leaves a problem line as its last log line, and check reports it as a warning', { skip: !supported }, async (t) => {
  const { home, env, service } = machine();
  assert.equal(runCli(['watch', 'enable'], env).status, 0);
  const watcher = await startWatcher({ ...env, PATH: process.env.PATH ?? '' });
  t.after(() => watcher.child.kill());
  const login = path.join(home, '.claude-broken');
  fs.mkdirSync(login);
  fs.writeFileSync(path.join(login, 'settings.json'), '{ not json');
  fs.writeFileSync(path.join(login, '.claude.json'), '{}');
  await until(() => watcher.output().includes('failed; see the lines above'), () => watcher.output());
  fs.writeFileSync(service.log, watcher.output());
  const check = runCli(['check'], env);
  assert.match(check.stdout, /^warning: watcher log .*: \S+ problem: install into .* failed; see the lines above$/m);
});

test('an upgrade of noonsight at the same path is noticed: check warns, and enable rewrites the service file and restarts the watcher', { skip: !supported }, () => {
  const { env, service, calls } = machine();
  assert.equal(runCli(['install'], env).status, 0);
  assert.equal(runCli(['watch', 'enable'], env).status, 0);
  const current = fs.readFileSync(service.file, 'utf8');
  fs.writeFileSync(service.file, current.replaceAll(packageVersion(), 'previous-version'));
  const check = runCli(['check'], env);
  assert.match(check.stdout, /^warning: watcher: .* runs another copy of noonsight or another Node\.js/m);
  const callsBefore = calls().length;

  const again = runCli(['watch', 'enable'], env);
  assert.equal(again.status, 0, again.stderr);
  assert.equal(fs.readFileSync(service.file, 'utf8'), current);
  assert.deepEqual(
    calls().slice(callsBefore),
    process.platform === 'darwin'
      ? [
          `launchctl print gui/${process.getuid?.()}/${SERVICE_LABEL}`,
          `launchctl bootout gui/${process.getuid?.()}/${SERVICE_LABEL}`,
          `launchctl bootstrap gui/${process.getuid?.()} ${service.file}`,
        ]
      : [
          `systemctl --user is-active --quiet ${SERVICE_UNIT}`,
          `systemctl --user disable --now ${SERVICE_UNIT}`,
          'systemctl --user daemon-reload',
          `systemctl --user enable --now ${SERVICE_UNIT}`,
        ],
  );
  assert.match(runCli(['check'], env).stdout, /^ok: watcher: on \(/m);
});

test('a watcher that cannot watch its home directory logs one problem line and exits 1', () => {
  const missing = path.join(tempTree({}), 'no-such-home');
  const r = runCli(['watch', 'run'], { HOME: missing, PATH: process.env.PATH ?? '', NOONSIGHT_SYSTEM_ROOT: tempTree({}), NOONSIGHT_CONFIG: LAB_CONFIG, NOONSIGHT_PRESETS_DIR: LAB_PRESETS });
  assert.equal(r.status, 1, r.stderr);
  const lines = r.stdout.trimEnd().split('\n');
  assert.equal(lines.length, 1, r.stdout);
  assert.match(lines[0] ?? '', /^\d{4}-\d{2}-\d{2}T\S+Z problem: watching .* did not start: ENOENT/);
});
