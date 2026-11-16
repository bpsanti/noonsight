// The watcher: a resident process that adds sextant's hooks to each Claude Code configuration
// directory made in the home directory after it started, so a new login gets them without anyone
// running `sextant install` again.
//
// It watches only the entries directly in the home directory, without recursion, so writes below
// them never wake it. When a new directory appears there, it waits a few seconds for the file that
// marks a Claude Code configuration directory, then runs the same install as
// `sextant install --account <dir>` for that directory alone. It never writes to the home
// directory itself: install writes inside the new directory and under ~/.local, which the watcher
// only uses once it exists.

import fs from 'node:fs';
import path from 'node:path';
import { CONFIG_MARKER } from '../adapters/claude-code/locations.js';

export interface WatcherOptions {
  readonly home: string;
  /** Install sextant's hooks into one configuration directory, as `sextant install --account <dir>` does. */
  readonly install: (dir: string) => void;
  readonly log: (text: string) => void;
}

/**
 * Claude Code writes the marker shortly after it creates a configuration directory; the wait covers
 * a slower disk without keeping a directory that never becomes one in view for long.
 */
const MARKER_WAIT_MS = 10_000;
const POLL_MS = 100;

/** Start watching; the watch keeps the process alive, and the process ends if the watch fails. */
export function startWatcher(options: WatcherOptions): () => void {
  const { home, log } = options;
  const timers = new Set<NodeJS.Timeout>();

  // The entries already there are not new; a directory made while the watcher was not running is
  // left to `sextant install`, and `sextant check` lists it. Each entry is known by its inode, so a
  // directory removed and made again under the same name between two events still counts as new.
  const known = new Map<string, bigint>();
  for (const name of fs.readdirSync(home)) {
    const ino = inode(path.join(home, name));
    if (ino !== null) known.set(name, ino);
  }

  const consider = (name: string): void => {
    const entry = path.join(home, name);
    const ino = inode(entry);
    if (ino === null) {
      known.delete(name);
      return;
    }
    if (known.get(name) === ino) return;
    known.set(name, ino);
    if (isDirectory(entry)) awaitMarker(entry, name, ino, Date.now() + MARKER_WAIT_MS);
  };

  const awaitMarker = (dir: string, name: string, ino: bigint, deadline: number): void => {
    // ~/.claude is Claude Code's default configuration directory; its marker lives in the home directory instead.
    if (name === '.claude' || isFile(path.join(dir, CONFIG_MARKER))) {
      installInto(dir);
      return;
    }
    if (Date.now() >= deadline || known.get(name) !== ino) return;
    const timer = setTimeout(() => {
      timers.delete(timer);
      awaitMarker(dir, name, ino, deadline);
    }, POLL_MS);
    timers.add(timer);
  };

  const installInto = (dir: string): void => {
    // The install creates what is missing under ~/.local; the watcher never makes an entry in the home directory.
    if (!fs.existsSync(path.join(home, '.local'))) {
      log(`problem: new Claude Code configuration ${dir} not installed: ${path.join(home, '.local')} does not exist; run \`sextant install\``);
      return;
    }
    log(`new Claude Code configuration ${dir}: installing`);
    try {
      options.install(dir);
    } catch (e) {
      log(`problem: install into ${dir} failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // Without a name, look at every entry: new ones are considered, vanished ones forgotten.
  const scan = (): void => {
    let names: string[];
    try {
      names = fs.readdirSync(home);
    } catch {
      return;
    }
    for (const name of new Set([...names, ...known.keys()])) consider(name);
  };

  const watcher = fs.watch(home, { persistent: true, recursive: false }, (_event, filename) => {
    if (filename) consider(filename.toString());
    else scan();
  });
  watcher.on('error', (e) => {
    log(`problem: watching ${home} stopped: ${e.message}`);
    close();
    process.exitCode = 1;
  });
  // An entry made after the snapshot above and before the watch started has no event; the scan finds it.
  scan();

  const close = (): void => {
    watcher.close();
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
  };
  log(`watching ${home} for new Claude Code configuration directories (entries directly in it only)`);
  return close;
}

/** The entry's own inode, not its target's; null when it does not exist. */
function inode(entry: string): bigint | null {
  try {
    return fs.lstatSync(entry, { bigint: true }).ino;
  } catch {
    return null;
  }
}

function isDirectory(entry: string): boolean {
  try {
    return fs.statSync(entry).isDirectory();
  } catch {
    return false;
  }
}

function isFile(file: string): boolean {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}
