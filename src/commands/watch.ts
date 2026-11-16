// noonsight watch: the opt-in watcher that installs noonsight's hooks into each new Claude Code
// configuration directory. It is off until `noonsight watch enable` writes its per-user service.

import os from 'node:os';
import { type Env } from '../config/paths.js';
import { disableWatcher, enableWatcher } from '../watch/control.js';
import { watchService, WatchUnsupported, type WatchService } from '../watch/service.js';
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
      return action === 'enable' ? enableWatcher(service, io) : disableWatcher(service, io);
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
        const status = runInstall('install', ['--account', dir], env, { out: log, err: log });
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
