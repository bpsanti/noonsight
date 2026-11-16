// sextant watch: the opt-in watcher that installs sextant's hooks into each new Claude Code
// configuration directory. It is off until `sextant watch enable` writes its per-user service.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CLI_FILE, stateDir, type Env } from '../config/paths.js';
import { writeFileAtomic } from '../state/files.js';
import { isOurs, manager, readServiceFile, serviceContent, watchService, WatchUnsupported, type WatchService } from '../watch/service.js';
import { startWatcher } from '../watch/watcher.js';
import { runInstall } from './install.js';
import { UsageError } from './usage.js';

export const WATCH_USAGE = `usage: sextant watch enable
       sextant watch disable

The watcher is off unless you turn it on. \`sextant watch enable\` writes a per-user service (a
launchd agent on macOS, a systemd user service on Linux) that starts at login and keeps one small
process running. It watches only the entries directly in the home directory: when a new Claude Code
configuration directory appears there, it installs sextant's hooks into that directory, as
\`sextant install --account <dir>\` does. \`sextant watch disable\` stops it and removes the service
file. \`sextant check\` says whether it is on.

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
        io.err(`sextant: ${e.message}`);
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
    io.err(`sextant: ${service.file} was not written by sextant, so it is left alone; nothing was changed`);
    return 1;
  }
  if (old === content && manager.running(service) === true) {
    io.out(`watcher: already on (${service.file})`);
    return 0;
  }
  // A service file from another copy of sextant or another Node.js is replaced; stop what it runs first.
  if (old !== null && manager.running(service) === true) {
    const stopped = manager.unload(service);
    if (!stopped.ok) {
      io.err(`sextant: could not stop the watcher to update it (${stopped.detail}); nothing was changed`);
      return 1;
    }
  }

  // The log's directory, made here so the watcher itself never creates an entry in the home directory.
  fs.mkdirSync(stateDir(home), { recursive: true, mode: 0o700 });
  fs.mkdirSync(path.dirname(service.file), { recursive: true, mode: 0o755 });
  if (old !== content) writeFileAtomic(service.file, content, 0o644);
  const started = manager.load(service);
  if (!started.ok) {
    if (old === null) {
      fs.rmSync(service.file, { force: true });
      manager.forget(service);
    } else if (old !== content) writeFileAtomic(service.file, old, 0o644);
    const restored = old === null ? 'the service file was removed again' : 'the service file was put back as it was, but the watcher is stopped; run `sextant watch enable` again once the cause is fixed';
    io.err(`sextant: could not start the watcher (${started.detail}); ${restored}`);
    return 1;
  }
  io.out(
    [
      `watcher: on (${service.file})`,
      `It runs ${runtime.node} ${runtime.cli} watch run, starts at every login, and logs to ${service.log}.`,
      'note: it adds the hooks to Claude Code configuration directories made from now on; for ones that exist already, run `sextant install`.',
      'note: the first session of a brand-new login can still start without the rules (see docs/install.md); turn the watcher off with `sextant watch disable`.',
    ].join('\n'),
  );
  return 0;
}

function disable(service: WatchService, io: Io): number {
  const old = readServiceFile(service);
  if (old === null) {
    io.out(`watcher: already off (no ${service.file})`);
    return 0;
  }
  if (!isOurs(old)) {
    io.err(`sextant: ${service.file} was not written by sextant, so it is left alone; nothing was changed`);
    return 1;
  }
  const stopped = manager.unload(service);
  // launchctl refuses to stop a service that is not loaded; that is already the state we want.
  if (!stopped.ok && !(service.platform === 'darwin' && manager.running(service) === false)) {
    io.err(`sextant: could not stop the watcher (${stopped.detail}); nothing was changed`);
    return 1;
  }
  fs.rmSync(service.file, { force: true });
  manager.forget(service);
  io.out(`watcher: off; removed ${service.file}`);
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
  startWatcher({
    home: os.homedir(),
    log,
    install: (dir) => {
      const status = runInstall('install', ['--account', dir], env, { out: log, err: log });
      // A summary last, so the last line of the log, which `sextant check` shows, says how it went.
      log(status === 0 ? `new Claude Code configuration ${dir}: installed` : `problem: install into ${dir} failed; see the lines above`);
    },
  });
  return 0;
}
