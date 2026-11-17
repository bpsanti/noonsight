// noonsight watch: the opt-in watcher that installs noonsight's hooks into each new Claude Code
// configuration directory. It is off until `noonsight watch enable` writes its per-user service.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CLI_FILE, stateDir, type Env } from '../config/paths.js';
import { writeFileAtomic } from '../state/files.js';
import { isLoaded, isOurs, manager, readServiceFile, serviceContent, watchService, WatchUnsupported, type WatchService } from '../watch/service.js';
import { startWatcher } from '../watch/watcher.js';
import { runInstall } from './install.js';
import { UsageError } from './usage.js';

export const WATCH_USAGE = `usage: noonsight watch enable
       noonsight watch disable

The watcher is off unless you turn it on. \`noonsight watch enable\` writes a per-user service (a
launchd agent on macOS, a systemd user service on Linux) that starts at login and keeps one small
process running. It watches only the entries directly in the home directory: when a new Claude Code
configuration directory appears there, it installs noonsight's hooks into that directory, as
\`noonsight install --account <dir>\` does. \`noonsight watch disable\` stops it and removes the service
file. \`noonsight check\` says whether it is on.

The first session of a brand-new login can still start without the rules; see docs/install.md.`;

export interface Io {
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
}

export function runWatch(args: readonly string[], env: Env, io: Io): number {
  const [action, ...rest] = args;
  if (rest.length) throw new UsageError(`unexpected argument "${rest[0]}"`, WATCH_USAGE);
  switch (action) {
    case 'enable':
    case 'disable': {
      let service: WatchService;
      try {
        service = watchService(env, os.homedir());
      } catch (e) {
        if (!(e instanceof WatchUnsupported)) throw e;
        io.err(`noonsight: ${e.message}`);
        return 1;
      }
      return action === 'enable' ? enable(service, io) : disable(service, io);
    }
    // What the service runs; not meant to be run by hand.
    case 'run':
      return run(env, io);
    case undefined:
      throw new UsageError('missing enable or disable', WATCH_USAGE);
    default:
      throw new UsageError(`unknown watch action "${action}"`, WATCH_USAGE);
  }
}

function enable(service: WatchService, io: Io): number {
  const home = os.homedir();
  const runtime = { node: process.execPath, cli: fs.realpathSync(CLI_FILE) };
  const content = serviceContent(service, runtime);
  const old = readServiceFile(service);
  if (old !== null && !isOurs(old)) {
    io.err(`noonsight: ${service.file} was not written by noonsight, so it is left alone; nothing was changed`);
    return 1;
  }
  if (old === content && manager.running(service) === 'running') {
    io.out(`watcher: already on (${service.file})`);
    return 0;
  }
  // A running watcher is stopped before its service file is replaced or started again.
  if (isLoaded(manager.running(service))) {
    const stopped = manager.unload(service);
    if (!stopped.ok) {
      io.err(`noonsight: could not stop the watcher to update it (${stopped.detail}); nothing was changed`);
      return 1;
    }
  }

  // The log's directory, made before the service starts and writes to it.
  fs.mkdirSync(stateDir(home), { recursive: true, mode: 0o700 });
  fs.mkdirSync(path.dirname(service.file), { recursive: true, mode: 0o755 });
  if (old !== content) writeFileAtomic(service.file, content, 0o644);
  const started = manager.load(service);
  if (!started.ok) {
    if (old === null) {
      fs.rmSync(service.file, { force: true });
      manager.forget(service);
    } else if (old !== content) writeFileAtomic(service.file, old, 0o644);
    const restored = old === null ? 'the service file was removed again' : 'the service file was put back as it was; run `noonsight watch enable` again once the cause is fixed';
    io.err(`noonsight: could not start the watcher (${started.detail}); the watcher is stopped, and ${restored}`);
    return 1;
  }
  io.out(
    [
      `watcher: on (${service.file})`,
      `It runs ${runtime.node} ${runtime.cli} watch run, starts at every login, and logs to ${service.log}.`,
      'note: it adds the hooks to Claude Code configuration directories made from now on; for ones that exist already, run `noonsight install`.',
      'note: the first session of a brand-new login can still start without the rules (see docs/install.md); turn the watcher off with `noonsight watch disable`.',
    ].join('\n'),
  );
  return 0;
}

function disable(service: WatchService, io: Io): number {
  const old = readServiceFile(service);
  if (old !== null && !isOurs(old)) {
    io.err(`noonsight: ${service.file} was not written by noonsight, so it is left alone; nothing was changed`);
    return 1;
  }
  if (old === null && !isLoaded(manager.running(service))) {
    io.out(`watcher: already off (no ${service.file})`);
    return 0;
  }
  const stopped = manager.unload(service);
  // launchctl refuses to stop a service that is not loaded; that is already the state we want.
  if (!stopped.ok && !(service.platform === 'darwin' && manager.running(service) === 'off')) {
    io.err(`noonsight: could not stop the watcher (${stopped.detail}); nothing was changed`);
    return 1;
  }
  fs.rmSync(service.file, { force: true });
  manager.forget(service);
  if (old !== null) io.out(`watcher: off; removed ${service.file}`);
  else if (service.platform === 'linux')
    io.out(
      `watcher: off; it was running without ${service.file}; a link to it may remain in ${path.join(path.dirname(service.file), 'default.target.wants')}, which can be removed by hand`,
    );
  else io.out(`watcher: off; it was running without ${service.file}`);
  return 0;
}

function run(env: Env, io: Io): number {
  const log = (text: string): void => {
    const ts = new Date().toISOString();
    io.out(
      text
        .split('\n')
        .map((line) => `${ts} ${line}`)
        .join('\n'),
    );
  };
  const home = os.homedir();
  try {
    startWatcher({
      home,
      log,
      install: (dir) => {
        const status = runInstall('install', ['--account', dir], env, { out: log, err: log }, { hooksOnly: true });
        // A summary last, so the last line of the log, which `noonsight check` shows, says how it went.
        log(status === 0 ? `new Claude Code configuration ${dir}: installed` : `problem: install into ${dir} failed; see the lines above`);
      },
    });
  } catch (e) {
    log(`problem: watching ${home} did not start: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  }
  return 0;
}
