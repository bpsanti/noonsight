// The one-shot migration from sextant, the name noonsight had before. `noonsight install` runs it:
// it replaces sextant's hook entries with noonsight's in the same write that adds them, removes
// sextant's hook pointer, moves the configuration and the state (the decision log among it) to
// noonsight's places, and replaces sextant's watcher with noonsight's. Each step acts only on what a
// sextant install left, so a second run finds nothing and changes nothing.
//
// This file is the only place that still knows sextant's names, paths and environment variables.

import fs from 'node:fs';
import path from 'node:path';
import { canCreate, NeedsPermission, readSettings } from '../adapters/claude-code/install.js';
import { discoverConfigDirs, managedTarget, systemPath, type InstallTarget } from '../adapters/claude-code/locations.js';
import { findNoonsightHandlers, withoutNoonsightHooks } from '../adapters/claude-code/settings.js';
import { CONFIG_SCHEMA_URL } from '../commands/init.js';
import { stateDir, type Env } from '../config/paths.js';
import { modeOf, writeFileAtomic } from '../state/files.js';
import { accountInstalls, INSTALLS_FILE } from '../state/installs.js';
import { LOG_FILE } from '../state/log.js';
import { enableWatcher } from '../watch/control.js';
import { manager, watchService, WatchUnsupported, WATCH_LOG, type WatchService } from '../watch/service.js';

/** The file name of sextant's hook pointer; install removes the handlers that run it. */
export const SEXTANT_POINTER = 'sextant-hook';

const SEXTANT_DROP_IN = 'sextant-ai.json';
const SEXTANT_SYSTEM_DIRS: Partial<Record<NodeJS.Platform, string>> = {
  darwin: '/Library/Application Support/sextant',
  linux: '/usr/local/lib/sextant',
};
const SEXTANT_CONFIG_FILE = 'sextant.json';
const SEXTANT_SCHEMA_URL = 'https://unpkg.com/sextant-ai@0/schema/sextant.schema.json';
const SEXTANT_SERVICE: Readonly<Record<'darwin' | 'linux', string>> = {
  darwin: 'io.github.bpsanti.sextant-ai.watch',
  linux: 'sextant-watch.service',
};
const SEXTANT_SERVICE_MARKER = 'Written by `sextant watch enable`';

const sextantConfigDir = (home: string): string => path.join(home, '.config', 'sextant');
const sextantStateDir = (home: string): string => path.join(home, '.local', 'state', 'sextant');
const sextantDataDir = (home: string): string => path.join(home, '.local', 'share', 'sextant');
/** noonsight's default configuration directory, where sextant's moves whatever NOONSIGHT_CONFIG says. */
const noonsightConfigDir = (home: string): string => path.join(home, '.config', 'noonsight');

export interface Migration {
  readonly lines: string[];
  /** False when a step failed; its line says which and what was left. */
  readonly ok: boolean;
}

/** The Claude Code configuration directories sextant recorded installing into. */
export function sextantAccountDirs(home: string): string[] {
  return accountInstalls(sextantStateDir(home));
}

/** The settings files among the targets that still hold sextant's hook entries. */
export function sextantHookFiles(targets: readonly InstallTarget[]): string[] {
  return targets.map((t) => t.settingsFile).filter(hasSextantHooks);
}

/** The lines that report sextant's hook entries an install just replaced. */
export function replacedHookLines(files: readonly string[]): string[] {
  return files.map((file) => `migrated from sextant: hooks ${file}: replaced by noonsight's`);
}

/**
 * The checks before a machine-wide install writes anything: the migration removes sextant's drop-in
 * file and its hook pointer, so this account must be able to.
 */
export function checkManagedMigration(env: Env): void {
  const blocked = managedLeftovers(env).filter((f) => !canCreate(f));
  if (blocked.length) throw new NeedsPermission(blocked);
}

/** After a machine-wide install: remove sextant's drop-in file, or its hooks in it, and its hook pointer. */
export function migrateManaged(env: Env): Migration {
  const lines: string[] = [];
  let ok = true;
  const step = (what: string, act: () => void): void => {
    try {
      act();
    } catch (e) {
      ok = false;
      lines.push(`problem: migrating from sextant: ${what} failed (${(e as Error).message}); run the install again once the cause is fixed`);
    }
  };
  const { dropIn, pointer } = managedPaths(env);
  if (dropIn !== null && fs.existsSync(dropIn))
    step(`removing sextant's hooks from ${dropIn}`, () => {
      const edit = withoutNoonsightHooks(readSettings(dropIn) ?? {}, SEXTANT_POINTER);
      if (Object.keys(edit.settings).length === 0) {
        fs.rmSync(dropIn, { force: true });
        lines.push(`migrated from sextant: hooks ${dropIn}: removed the file`);
      } else if (edit.changed) {
        writeFileAtomic(dropIn, `${JSON.stringify(edit.settings, null, 2)}\n`, modeOf(dropIn, 0o644));
        lines.push(`migrated from sextant: hooks ${dropIn}: removed (the file keeps settings that are not sextant's)`);
      }
    });
  if (pointer !== null && fs.existsSync(pointer))
    step(`removing ${pointer}`, () => {
      fs.rmSync(pointer, { force: true });
      removeIfEmpty(path.dirname(pointer));
      lines.push(`migrated from sextant: hook pointer ${pointer}: removed`);
    });
  return { lines, ok };
}

/**
 * After an install into every Claude Code configuration directory of this account: remove sextant's
 * hook pointer once no settings file runs it, move the configuration and the state to noonsight's
 * places, replace sextant's watcher with noonsight's, and name the SEXTANT_* variables still set.
 */
export function migrateAccount(env: Env, home: string): Migration {
  const lines: string[] = [];
  let ok = true;
  const step = (what: string, act: () => void): void => {
    try {
      act();
    } catch (e) {
      ok = false;
      lines.push(`problem: migrating from sextant: ${what} failed (${(e as Error).message}); run \`noonsight install\` again once the cause is fixed`);
    }
  };

  // Read before the state moves: the directories sextant recorded are where its hooks may remain.
  const recorded = sextantAccountDirs(home);
  const pointer = path.join(sextantDataDir(home), SEXTANT_POINTER);
  if (fs.existsSync(pointer))
    step(`removing ${pointer}`, () => {
      const users = discoverConfigDirs(env, home, recorded)
        .map((dir) => path.join(dir, 'settings.json'))
        .filter(hasSextantHooks);
      if (users.length) {
        lines.push(`migrated from sextant: hook pointer ${pointer}: kept, because ${users.join(', ')} still run it`);
        return;
      }
      fs.rmSync(pointer, { force: true });
      removeIfEmpty(sextantDataDir(home));
      lines.push(`migrated from sextant: hook pointer ${pointer}: removed`);
    });

  const oldConfig = sextantConfigDir(home);
  if (fs.existsSync(oldConfig))
    step(`moving ${oldConfig}`, () => {
      const newConfig = noonsightConfigDir(home);
      const kept = moveInto(oldConfig, newConfig, { [SEXTANT_CONFIG_FILE]: 'noonsight.json' });
      lines.push(`migrated from sextant: configuration ${oldConfig}: moved to ${newConfig}${keptNote(kept)}`);
      const file = path.join(newConfig, 'noonsight.json');
      if (fs.existsSync(file)) {
        const text = fs.readFileSync(file, 'utf8');
        const next = text.split(JSON.stringify(SEXTANT_SCHEMA_URL)).join(JSON.stringify(CONFIG_SCHEMA_URL));
        if (next !== text) writeFileAtomic(file, next, modeOf(file, 0o644));
        if (next.includes(oldConfig))
          lines.push(`warning: ${file} names files under ${oldConfig}, which moved to ${newConfig}; change those paths`);
      }
    });

  const oldState = sextantStateDir(home);
  if (fs.existsSync(oldState))
    step(`moving ${oldState}`, () => {
      const withLog = fs.existsSync(path.join(oldState, LOG_FILE)) ? ', with the decision log,' : '';
      const kept = moveInto(oldState, stateDir(home), {});
      lines.push(`migrated from sextant: state ${oldState}${withLog} moved to ${stateDir(home)}${keptNote(kept)}`);
    });

  const watcher = sextantWatcher(env, home);
  if (watcher !== null)
    step(`replacing the watcher ${watcher.old.file}`, () => {
      const state = manager.running(watcher.old);
      if (state !== 'off') {
        const stopped = manager.unload(watcher.old);
        if (!stopped.ok && !(watcher.old.platform === 'darwin' && manager.running(watcher.old) === 'off')) throw new Error(stopped.detail);
      }
      fs.rmSync(watcher.old.file, { force: true });
      manager.forget(watcher.old);
      lines.push(`migrated from sextant: watcher ${watcher.old.file}: stopped and removed`);
      const errors: string[] = [];
      const status = enableWatcher(watcher.next, { out: (t) => lines.push(t), err: (t) => errors.push(t) });
      if (status !== 0) throw new Error(`noonsight's watcher did not start: ${errors.join(' ')}`);
    });

  for (const name of Object.keys(env).sort())
    if (name.startsWith('SEXTANT_') && env[name] !== undefined)
      lines.push(`warning: ${name} is set in this environment, but noonsight reads NOONSIGHT_${name.slice('SEXTANT_'.length)}; rename it where it is set`);

  if (managedHasSextant(env))
    lines.push(
      `note: sextant is still installed for the whole machine (${managedPaths(env).dropIn ?? ''}); ` +
        'migrate it with `noonsight install --managed`, as an administrator.',
    );
  return { lines, ok };
}

/** For an install into one directory: the sextant files it leaves for `noonsight install` to migrate. */
export function leftoverNote(env: Env, home: string): string[] {
  const left = [path.join(sextantDataDir(home), SEXTANT_POINTER), sextantConfigDir(home), sextantStateDir(home)].filter((f) => fs.existsSync(f));
  const watcher = sextantWatcher(env, home);
  if (watcher !== null) left.push(watcher.old.file);
  return left.length
    ? [`note: a sextant install left ${left.join(', ')}; run \`noonsight install\`, without --account, to migrate them.`]
    : [];
}

function hasSextantHooks(file: string): boolean {
  try {
    return findNoonsightHandlers(readSettings(file), SEXTANT_POINTER).length > 0;
  } catch {
    return false;
  }
}

function managedPaths(env: Env): { dropIn: string | null; pointer: string | null } {
  const dir = SEXTANT_SYSTEM_DIRS[process.platform];
  let managedDir: string | undefined;
  try {
    managedDir = managedTarget(env).managedDir;
  } catch {
    // No managed settings directory on this system.
  }
  return {
    dropIn: managedDir !== undefined ? path.join(managedDir, 'managed-settings.d', SEXTANT_DROP_IN) : null,
    pointer: dir !== undefined ? path.join(systemPath(env, dir), SEXTANT_POINTER) : null,
  };
}

function managedLeftovers(env: Env): string[] {
  const { dropIn, pointer } = managedPaths(env);
  return [dropIn, pointer].filter((f): f is string => f !== null && fs.existsSync(f));
}

function managedHasSextant(env: Env): boolean {
  const { dropIn } = managedPaths(env);
  return dropIn !== null && hasSextantHooks(dropIn);
}

/** sextant's watcher service, when its file is there and was written by sextant, with noonsight's in its place. */
function sextantWatcher(env: Env, home: string): { old: WatchService; next: WatchService } | null {
  let next: WatchService;
  try {
    next = watchService(env, home);
  } catch (e) {
    if (e instanceof WatchUnsupported) return null;
    throw e;
  }
  const name = SEXTANT_SERVICE[next.platform];
  const old: WatchService = {
    platform: next.platform,
    name,
    file: path.join(path.dirname(next.file), next.platform === 'darwin' ? `${name}.plist` : name),
    log: path.join(sextantStateDir(home), WATCH_LOG),
  };
  let content: string;
  try {
    content = fs.readFileSync(old.file, 'utf8');
  } catch {
    return null;
  }
  return content.includes(SEXTANT_SERVICE_MARKER) ? { old, next } : null;
}

/**
 * Move every entry of one directory into another, renaming the entries the map names, and remove the
 * first once it is empty. A directory with no counterpart moves whole; one with a counterpart has its
 * entries moved in. Two files that exist in both are merged when noonsight knows how (the list of
 * account installs and the decision log), and are otherwise left where they were. Returns the paths
 * left behind.
 */
function moveInto(from: string, to: string, renames: Readonly<Record<string, string>>): string[] {
  if (!fs.existsSync(to)) {
    fs.mkdirSync(path.dirname(to), { recursive: true, mode: 0o700 });
    move(from, to);
    for (const [a, b] of Object.entries(renames)) if (fs.existsSync(path.join(to, a)) && !fs.existsSync(path.join(to, b))) move(path.join(to, a), path.join(to, b));
    return [];
  }
  const kept: string[] = [];
  for (const name of fs.readdirSync(from).sort()) {
    const source = path.join(from, name);
    const target = path.join(to, renames[name] ?? name);
    if (!fs.existsSync(target)) move(source, target);
    else if (fs.statSync(source).isDirectory() && fs.statSync(target).isDirectory()) kept.push(...moveInto(source, target, {}));
    else if (name === INSTALLS_FILE) mergeInstalls(source, target);
    else if (name === LOG_FILE) mergeLog(source, target);
    else kept.push(source);
  }
  removeIfEmpty(from);
  return kept;
}

/** Rename, or copy and remove across file systems. */
function move(from: string, to: string): void {
  try {
    fs.renameSync(from, to);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'EXDEV') throw e;
    fs.cpSync(from, to, { recursive: true, preserveTimestamps: true });
    fs.rmSync(from, { recursive: true, force: true });
  }
}

/** Both lists of account installs, sextant's first, each directory once. */
function mergeInstalls(from: string, to: string): void {
  const accounts = [...new Set([...accountInstalls(path.dirname(from)), ...accountInstalls(path.dirname(to))])];
  writeFileAtomic(to, `${JSON.stringify({ schema: 1, accounts }, null, 2)}\n`, 0o600);
  fs.rmSync(from, { force: true });
}

/** sextant's decisions, which are older, then noonsight's. */
function mergeLog(from: string, to: string): void {
  const old = fs.readFileSync(from, 'utf8');
  const next = fs.readFileSync(to, 'utf8');
  writeFileAtomic(to, `${old}${old && !old.endsWith('\n') ? '\n' : ''}${next}`, modeOf(to, 0o600));
  fs.rmSync(from, { force: true });
}

function removeIfEmpty(dir: string): void {
  try {
    if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
  } catch {
    // Gone already, or not readable: nothing to tidy.
  }
}

function keptNote(kept: readonly string[]): string {
  return kept.length ? `, except ${kept.join(', ')}, which noonsight also has and which were left in place` : '';
}
