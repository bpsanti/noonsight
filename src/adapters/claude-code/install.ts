// Install and uninstall: write the hook pointer, then add sextant's hook entries to a settings file
// (or remove both). Every write replaces a whole file in one step, nothing outside sextant's own
// entries is changed, and running the same command twice changes nothing the second time.

import fs from 'node:fs';
import path from 'node:path';
import { isPermissionError, mkdirWithMode, modeOf, readJsonFile, writeFileAtomic } from '../../state/files.js';
import type { InstallTarget } from './locations.js';
import { pointerScript, readPointer, type PointerTarget } from './pointer.js';
import { HOOK_EVENTS, isObject, withSextantHooks, withoutSextantHooks, SettingsShapeError } from './settings.js';

/** What the hook pointer should run: this copy of sextant, by absolute paths. */
export interface Runtime {
  readonly node: string;
  readonly cli: string;
  readonly version: string;
}

/** A refusal that leaves every file as it was. */
export class InstallRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InstallRefused';
  }
}

/** This account cannot write one of the paths; nothing was changed. */
export class NeedsPermission extends Error {
  constructor(readonly paths: readonly string[]) {
    super(`cannot write ${paths.join(' and ')}`);
    this.name = 'NeedsPermission';
  }
}

const EVENTS = Object.keys(HOOK_EVENTS).join(', ');

interface InstallPlan {
  readonly settings: Record<string, unknown> | null;
  readonly edit: { readonly settings: Record<string, unknown>; readonly changed: boolean };
  readonly script: string;
  readonly oldScript: string | null;
  readonly pointerChanged: boolean;
}

/** What install would write, after every check that can refuse it; nothing is written. */
function planInstall(target: InstallTarget, runtime: Runtime): InstallPlan {
  if (target.configDir !== undefined && !isDirectory(target.configDir))
    throw new InstallRefused(`${target.configDir} is not a directory; give the Claude Code configuration directory of an account, such as ~/.claude`);
  refuseRootInAccount(target);

  const settings = readSettings(target.settingsFile);
  const edit = editSettings(target.settingsFile, () => withSextantHooks(settings ?? {}, target.pointer));
  const pointer: PointerTarget = { ...runtime, kind: target.kind };
  const script = pointerScript(pointer);
  const oldScript = readText(target.pointer);
  const pointerChanged = oldScript !== script;

  const toWrite = [...(pointerChanged ? [target.pointer] : []), ...(edit.changed ? [target.settingsFile] : [])];
  const blocked = toWrite.filter((f) => !canCreate(f));
  if (blocked.length) throw new NeedsPermission(blocked);
  return { settings, edit, script, oldScript, pointerChanged };
}

/** Throws what install would throw, and writes nothing; for installing into several directories at once. */
export function checkInstallable(target: InstallTarget, runtime: Runtime): void {
  planInstall(target, runtime);
}

export function install(target: InstallTarget, runtime: Runtime): string[] {
  const { settings, edit, script, oldScript, pointerChanged } = planInstall(target, runtime);

  if (pointerChanged) {
    mkdirWithMode(path.dirname(target.pointer), 0o755);
    writeFileAtomic(target.pointer, script, 0o755);
  }
  if (edit.changed) {
    try {
      mkdirWithMode(path.dirname(target.settingsFile), 0o755);
      writeFileAtomic(target.settingsFile, `${JSON.stringify(edit.settings, null, 2)}\n`, modeOf(target.settingsFile, 0o644));
    } catch (e) {
      // Put the pointer back as it was, so a failed install leaves nothing behind.
      if (pointerChanged) {
        if (oldScript === null) fs.rmSync(target.pointer, { force: true });
        else writeFileAtomic(target.pointer, oldScript, 0o755);
      }
      throw e;
    }
  }

  return [
    `hook pointer ${target.pointer}: ${pointerChanged ? (oldScript === null ? 'written' : 'rewritten') : 'unchanged'} (runs ${runtime.node} ${runtime.cli})`,
    `hooks ${target.settingsFile}: ${edit.changed ? (settings === null ? 'created' : 'added') : 'unchanged'} (${EVENTS})`,
  ];
}

export interface UninstallOptions {
  /** Keep the hook pointer, because another install still runs it. */
  readonly keepPointer?: boolean;
}

export function uninstall(target: InstallTarget, options: UninstallOptions = {}): string[] {
  refuseRootInAccount(target);
  const settings = readSettings(target.settingsFile);
  const edit = settings === null ? null : editSettings(target.settingsFile, () => withoutSextantHooks(settings));
  // sextant's drop-in file is removed once nothing is left in it.
  const removeFile = edit !== null && target.kind === 'managed' && Object.keys(edit.settings).length === 0;
  const pointer = readPointer(target.pointer);
  const removePointer = pointer !== null && pointer.kind === target.kind && !options.keepPointer;

  const toWrite = [...(edit?.changed || removeFile ? [target.settingsFile] : []), ...(removePointer ? [target.pointer] : [])];
  const blocked = toWrite.filter((f) => !canCreate(f));
  if (blocked.length) throw new NeedsPermission(blocked);

  if (removeFile) fs.rmSync(target.settingsFile, { force: true });
  else if (edit?.changed)
    writeFileAtomic(target.settingsFile, `${JSON.stringify(edit.settings, null, 2)}\n`, modeOf(target.settingsFile, 0o644));
  if (removePointer) fs.rmSync(target.pointer, { force: true });

  const hooksLine = removeFile ? 'removed the file' : edit?.changed ? 'removed' : 'none found';
  const pointerLine = removePointer ? 'removed' : pointer === null ? 'none found' : options.keepPointer ? 'kept (another account install uses it)' : 'kept (not written for this kind of install)';
  return [`hooks ${target.settingsFile}: ${hooksLine}`, `hook pointer ${target.pointer}: ${pointerLine}`];
}

/** The parsed settings file, or null when it does not exist. An unreadable file is refused. */
export function readSettings(file: string): Record<string, unknown> | null {
  if (!fs.existsSync(file)) return null;
  let value: unknown;
  try {
    value = readJsonFile(file);
  } catch (e) {
    if (isPermissionError(e)) throw new NeedsPermission([file]);
    throw new InstallRefused(`${file} is not valid JSON (${(e as Error).message}); fix it first, nothing was changed`);
  }
  if (!isObject(value)) throw new InstallRefused(`${file} does not hold a JSON object; fix it first, nothing was changed`);
  return value;
}

function editSettings<T>(file: string, edit: () => T): T {
  try {
    return edit();
  } catch (e) {
    if (e instanceof SettingsShapeError) throw new InstallRefused(`${file}: ${e.message}; fix it first, nothing was changed`);
    throw e;
  }
}

function readText(file: string): string | null {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

/**
 * An administrator writing another account's settings would leave that account a settings file it
 * cannot change any more, so a per-account install runs as the account that owns the directory.
 */
function refuseRootInAccount(target: InstallTarget): void {
  if (target.kind !== 'account' || target.configDir === undefined || process.getuid?.() !== 0) return;
  let owner: number;
  try {
    owner = fs.statSync(target.configDir).uid;
  } catch {
    return;
  }
  if (owner !== 0)
    throw new InstallRefused(
      `${target.configDir} belongs to another account; run sextant with --account as that account, without sudo, so its settings stay its own`,
    );
}

function isDirectory(dir: string): boolean {
  try {
    return fs.statSync(dir).isDirectory();
  } catch {
    return false;
  }
}

/** Whether this account can create or replace the file: the nearest existing directory above it must be writable. */
function canCreate(file: string): boolean {
  let dir = path.dirname(file);
  for (;;) {
    try {
      if (fs.statSync(dir).isDirectory()) {
        fs.accessSync(dir, fs.constants.W_OK);
        return true;
      }
      return false;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') return false;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return false;
    dir = parent;
  }
}
