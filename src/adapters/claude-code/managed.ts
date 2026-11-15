// Claude Code's managed settings, as far as sextant needs them: whether the managed settings files
// apply to a login, and the values they set.
//
// Claude Code ranks its managed sources (https://code.claude.com/docs/en/managed-settings, "How
// Claude Code combines managed sources"): server-managed settings from claude.ai or a gateway first,
// then an MDM profile, then the managed settings files. By default ("first-wins") it applies only the
// highest-ranked source that delivers at least one policy key and ignores the rest, unless that
// source sets managedSourcesBehavior to "merge". Server-managed settings are cached per login in the
// Claude Code configuration directory, as remote-settings.json
// (https://code.claude.com/docs/en/server-managed-settings, "Invalid entries in delivered settings").

import fs from 'node:fs';
import path from 'node:path';
import { isObject } from './settings.js';

/** Keys that do not count as a policy: a source holding only these does not shadow the sources below it. */
const CONTROL_KEYS = new Set(['managedSourcesBehavior', 'wslInheritsWindowsSettings']);

/** The cache file of server-managed settings in a Claude Code configuration directory. */
export const REMOTE_SETTINGS_FILE = 'remote-settings.json';

export interface RemoteSettings {
  readonly file: string;
  readonly settings: Record<string, unknown>;
  /** The cache holds at least one policy key, so it outranks the managed settings files. */
  readonly deliversPolicy: boolean;
  /** It sets managedSourcesBehavior to "merge", so the managed settings files still apply. */
  readonly merges: boolean;
}

/** The server-managed settings cached for the login that uses this configuration directory, or null. */
export function readRemoteSettings(configDir: string): RemoteSettings | null {
  const file = path.join(configDir, REMOTE_SETTINGS_FILE);
  let value: unknown;
  try {
    value = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  } catch {
    return null;
  }
  if (!isObject(value)) return null;
  return {
    file,
    settings: value,
    deliversPolicy: Object.keys(value).some((k) => !CONTROL_KEYS.has(k)),
    merges: value.managedSourcesBehavior === 'merge',
  };
}

/** Whether the managed settings files reach sessions of this configuration directory's login. */
export function managedFilesApply(remote: RemoteSettings | null): boolean {
  return remote === null || !remote.deliversPolicy || remote.merges;
}

export interface ManagedFiles {
  /** The top-level keys of every file, merged in the order Claude Code reads them; a later value wins. */
  readonly merged: Record<string, unknown>;
  /** For each merged key, the file its value came from. */
  readonly origins: Record<string, string>;
  /** Files that exist but are not a JSON object. */
  readonly problems: readonly { readonly file: string; readonly message: string }[];
}

/** managed-settings.json, then every *.json file in managed-settings.d/ in alphabetical order. */
export function readManagedFiles(managedDir: string): ManagedFiles {
  const files = [path.join(managedDir, 'managed-settings.json')];
  try {
    const dropIns = path.join(managedDir, 'managed-settings.d');
    files.push(
      ...fs
        .readdirSync(dropIns)
        .filter((n) => n.endsWith('.json') && !n.startsWith('.'))
        .sort()
        .map((n) => path.join(dropIns, n)),
    );
  } catch {
    // No drop-in directory.
  }
  const merged: Record<string, unknown> = {};
  const origins: Record<string, string> = {};
  const problems: { file: string; message: string }[] = [];
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    try {
      const value = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
      if (!isObject(value)) throw new Error('not a JSON object');
      Object.assign(merged, value);
      for (const key of Object.keys(value)) origins[key] = file;
    } catch (e) {
      problems.push({ file, message: (e as Error).message });
    }
  }
  return { merged, origins, problems };
}
