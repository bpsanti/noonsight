// The watcher: a resident process that adds noonsight's hooks to each Claude Code configuration
// directory made in the home directory after it started, so a new login gets them without anyone
// running `noonsight install` again.
//
// It watches only the entries directly in the home directory, without recursion, so writes below
// them never wake it. When a new directory appears there, it waits for the file that marks a Claude
// Code configuration directory, then installs the hooks as `noonsight install --account <dir>` does,
// for that directory alone and without the rest of the setup. The wait is kept up for as long as the directory stays there, so a marker
// written late is still picked up.
//
// Events make it react at once, but it does not depend on them: it also looks at the entries again
// and again, so a directory whose event never came is found by the next look.
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG_MARKER } from '../adapters/claude-code/locations.js';
/**
 * Claude Code writes the marker shortly after it creates a configuration directory; the fast window
 * covers that, and the slow poll keeps a late marker in view at almost no cost. The home directory is
 * looked at again on the same schedule, from the moment the watcher starts.
 */
const POLL_MS = 100;
const FAST_WINDOW_MS = 10_000;
const SLOW_POLL_MS = 5_000;
/** Start watching; the watch keeps the process alive, and the process ends if the watch fails. */
export function startWatcher(options) {
    const { home, log } = options;
    const fastWindowMs = options.fastWindowMs ?? FAST_WINDOW_MS;
    const slowPollMs = options.slowPollMs ?? SLOW_POLL_MS;
    const timers = new Set();
    // The entries already there are not new; a directory made while the watcher was not running is
    // left to `noonsight install`, and `noonsight check` lists it. Each entry is known by its inode, so a
    // directory removed and made again under the same name between two events still counts as new.
    const known = new Map();
    for (const name of fs.readdirSync(home)) {
        const ino = inode(path.join(home, name));
        if (ino !== null)
            known.set(name, ino);
    }
    const consider = (name) => {
        const entry = path.join(home, name);
        const ino = inode(entry);
        if (ino === null) {
            known.delete(name);
            return;
        }
        if (known.get(name) === ino)
            return;
        known.set(name, ino);
        if (isDirectory(entry))
            awaitMarker(entry, name, ino, Date.now());
    };
    const awaitMarker = (dir, name, ino, since) => {
        // ~/.claude is Claude Code's default configuration directory; its marker lives in the home directory instead.
        if (name === '.claude' || isFile(path.join(dir, CONFIG_MARKER))) {
            installInto(dir);
            return;
        }
        if (known.get(name) !== ino)
            return;
        const timer = setTimeout(() => {
            timers.delete(timer);
            awaitMarker(dir, name, ino, since);
        }, Date.now() - since < fastWindowMs ? POLL_MS : slowPollMs);
        timers.add(timer);
    };
    const installInto = (dir) => {
        log(`new Claude Code configuration ${dir}: installing`);
        try {
            options.install(dir);
        }
        catch (e) {
            log(`problem: install into ${dir} failed: ${e instanceof Error ? e.message : String(e)}`);
        }
    };
    // Without a name, look at every entry: new ones are considered, vanished ones forgotten.
    const scan = () => {
        let names;
        try {
            names = fs.readdirSync(home);
        }
        catch {
            return;
        }
        for (const name of new Set([...names, ...known.keys()]))
            consider(name);
    };
    const watcher = fs.watch(home, { persistent: true, recursive: false }, (_event, filename) => {
        if (filename)
            consider(filename.toString());
        else
            scan();
    });
    watcher.on('error', (e) => {
        log(`problem: watching ${home} stopped: ${e.message}`);
        close();
        process.exitCode = 1;
    });
    // fs.watch can return before events are delivered: on macOS, an entry made right after it returns can
    // get no event. So no single scan closes the gap between the snapshot above and the first event, and
    // an entry made after that scan would be lost. The home directory is scanned for as long as the
    // watcher runs, often at first, when that gap is open.
    const started = Date.now();
    let rescanTimer;
    const rescan = () => {
        // Armed before the scan, so a close during the scan also clears it.
        rescanTimer = setTimeout(rescan, Date.now() - started < fastWindowMs ? POLL_MS : slowPollMs);
        scan();
    };
    const close = () => {
        watcher.close();
        clearTimeout(rescanTimer);
        for (const timer of timers)
            clearTimeout(timer);
        timers.clear();
    };
    rescan();
    log(`watching ${home} for new Claude Code configuration directories (entries directly in it only)`);
    return close;
}
/** The entry's own inode, not its target's; null when it does not exist. */
function inode(entry) {
    try {
        return fs.lstatSync(entry, { bigint: true }).ino;
    }
    catch {
        return null;
    }
}
function isDirectory(entry) {
    try {
        return fs.statSync(entry).isDirectory();
    }
    catch {
        return false;
    }
}
function isFile(file) {
    try {
        return fs.statSync(file).isFile();
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=watcher.js.map