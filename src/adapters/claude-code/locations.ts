// Where an install writes. The machine-wide paths come from Claude Code's documentation of
// file-based managed settings (https://code.claude.com/docs/en/managed-settings): Claude Code reads
// managed-settings.json and every *.json file in managed-settings.d/ from one system directory per
// operating system, and merges them.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { dataDir, type Env } from '../../config/paths.js';
import type { SettingsInstallKind } from '../../state/installs.js';
import { POINTER_NAME } from './settings.js';

export interface InstallTarget {
  readonly kind: SettingsInstallKind;
  /** The settings file noonsight writes its hook entries to. */
  readonly settingsFile: string;
  /** The hook pointer those entries run. */
  readonly pointer: string;
  /** For a machine-wide install: Claude Code's managed settings directory. */
  readonly managedDir?: string;
  /** For a per-account install: the Claude Code configuration directory. */
  readonly configDir?: string;
}

/** noonsight's own file in the managed settings drop-in directory. */
export const DROP_IN_NAME = 'noonsight.json';

interface SystemDirs {
  /** Claude Code's managed settings directory. */
  readonly claudeCode: string;
  /** Where the machine-wide hook pointer lives; it must be readable by every account. */
  readonly noonsight: string;
}

const SYSTEM_DIRS: Partial<Record<NodeJS.Platform, SystemDirs>> = {
  darwin: { claudeCode: '/Library/Application Support/ClaudeCode', noonsight: '/Library/Application Support/noonsight' },
  linux: { claudeCode: '/etc/claude-code', noonsight: '/usr/local/lib/noonsight' },
};

/** Claude Code's managed settings directory on Windows; noonsight does not install there yet. */
export const WINDOWS_MANAGED_DIR = 'C:\\Program Files\\ClaudeCode';

export class UnsupportedPlatformError extends Error {
  constructor(readonly platform: string) {
    super(
      platform === 'win32'
        ? `installing on Windows is not supported yet. Claude Code reads machine-wide settings from ${WINDOWS_MANAGED_DIR}, ` +
            `but the noonsight hook pointer is a POSIX shell script that has not been verified there.`
        : `installing on ${platform} is not supported; noonsight knows Claude Code's managed settings directory on macOS and Linux only.`,
    );
    this.name = 'UnsupportedPlatformError';
  }
}

/**
 * The machine-wide install. NOONSIGHT_SYSTEM_ROOT stands in for "/" so tests can install into a
 * temporary directory; it is not meant for real installs.
 */
export function managedTarget(env: Env, platform: NodeJS.Platform = process.platform): InstallTarget {
  const dirs = SYSTEM_DIRS[platform];
  if (!dirs) throw new UnsupportedPlatformError(platform);
  const root = env.NOONSIGHT_SYSTEM_ROOT ? path.resolve(env.NOONSIGHT_SYSTEM_ROOT) : null;
  const system = (p: string): string => (root ? path.join(root, p) : p);
  const managedDir = system(dirs.claudeCode);
  return {
    kind: 'managed',
    managedDir,
    settingsFile: path.join(managedDir, 'managed-settings.d', DROP_IN_NAME),
    pointer: path.join(system(dirs.noonsight), POINTER_NAME),
  };
}

/** A per-account install into one Claude Code configuration directory, such as ~/.claude. */
export function accountTarget(configDir: string, home: string = os.homedir()): InstallTarget {
  const dir = path.resolve(expandHome(configDir, home));
  return { kind: 'account', configDir: dir, settingsFile: path.join(dir, 'settings.json'), pointer: path.join(dataDir(home), POINTER_NAME) };
}

/**
 * The file Claude Code keeps in a configuration directory it was started with through
 * CLAUDE_CONFIG_DIR (the default directory keeps it in the home directory instead).
 */
export const CONFIG_MARKER = '.claude.json';

/**
 * Every Claude Code configuration directory of this account that exists, each once: ~/.claude, the
 * directory in CLAUDE_CONFIG_DIR, every directory directly in the home directory that holds a Claude
 * Code configuration (such as ~/.claude-work, made for a second login), and the extra directories
 * given, such as the ones noonsight installed into before. Each login keeps its own settings in its
 * own directory, so these are the places a per-account hook must be to reach every login.
 */
export function discoverConfigDirs(env: Env, home: string = os.homedir(), extra: readonly string[] = []): string[] {
  const candidates = [path.join(home, '.claude')];
  if (env.CLAUDE_CONFIG_DIR) candidates.push(path.resolve(expandHome(env.CLAUDE_CONFIG_DIR, home)));
  let names: string[] = [];
  try {
    names = fs.readdirSync(home).sort();
  } catch {
    // No readable home directory.
  }
  for (const name of names) {
    const dir = path.join(home, name);
    if (isFile(path.join(dir, CONFIG_MARKER))) candidates.push(dir);
  }
  candidates.push(...extra.map((d) => path.resolve(d)));

  const seen = new Set<string>();
  const found: string[] = [];
  for (const dir of candidates) {
    let real: string;
    try {
      if (!fs.statSync(dir).isDirectory()) continue;
      real = fs.realpathSync(dir);
    } catch {
      continue;
    }
    if (seen.has(real)) continue;
    seen.add(real);
    found.push(dir);
  }
  return found;
}

function isFile(file: string): boolean {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

/** The Claude Code configuration directory this shell uses, for messages that suggest --account. */
export function defaultAccountDir(env: Env, home: string = os.homedir()): string {
  return env.CLAUDE_CONFIG_DIR ? path.resolve(env.CLAUDE_CONFIG_DIR) : path.join(home, '.claude');
}

function expandHome(p: string, home: string): string {
  return p === '~' ? home : p.startsWith('~/') ? path.join(home, p.slice(2)) : p;
}
