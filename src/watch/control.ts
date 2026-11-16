// Turning the watcher on and off: `noonsight watch enable` and `noonsight watch disable`, and the
// install that replaces a watcher of an earlier name with this one.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CLI_FILE, stateDir } from '../config/paths.js';
import { writeFileAtomic } from '../state/files.js';
import { isLoaded, isOurs, manager, readServiceFile, serviceContent, type WatchService } from './service.js';

export interface Io {
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
}

export function enableWatcher(service: WatchService, io: Io): number {
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

export function disableWatcher(service: WatchService, io: Io): number {
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
