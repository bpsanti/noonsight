// Where an install writes. The machine-wide paths come from Claude Code's documentation of
// file-based managed settings (https://code.claude.com/docs/en/managed-settings): Claude Code reads
// managed-settings.json and every *.json file in managed-settings.d/ from one system directory per
// operating system, and merges them.

import os from 'node:os';
import path from 'node:path';
import { dataDir, type Env } from '../../config/paths.js';
import { POINTER_NAME } from './settings.js';

export type InstallKind = 'managed' | 'account';

export interface InstallTarget {
  readonly kind: InstallKind;
  /** The settings file sextant writes its hook entries to. */
  readonly settingsFile: string;
  /** The hook pointer those entries run. */
  readonly pointer: string;
  /** For a machine-wide install: Claude Code's managed settings directory. */
  readonly managedDir?: string;
  /** For a per-account install: the Claude Code configuration directory. */
  readonly configDir?: string;
}

/** sextant's own file in the managed settings drop-in directory. */
export const DROP_IN_NAME = 'sextant-ai.json';

interface SystemDirs {
  /** Claude Code's managed settings directory. */
  readonly claudeCode: string;
  /** Where the machine-wide hook pointer lives; it must be readable by every account. */
  readonly sextant: string;
}

const SYSTEM_DIRS: Partial<Record<NodeJS.Platform, SystemDirs>> = {
  darwin: { claudeCode: '/Library/Application Support/ClaudeCode', sextant: '/Library/Application Support/sextant' },
  linux: { claudeCode: '/etc/claude-code', sextant: '/usr/local/lib/sextant' },
};

/** Claude Code's managed settings directory on Windows; sextant does not install there yet. */
export const WINDOWS_MANAGED_DIR = 'C:\\Program Files\\ClaudeCode';

export class UnsupportedPlatformError extends Error {
  constructor(readonly platform: string) {
    super(
      platform === 'win32'
        ? `installing on Windows is not supported yet. Claude Code reads machine-wide settings from ${WINDOWS_MANAGED_DIR}, ` +
            `but the sextant hook pointer is a POSIX shell script that has not been verified there.`
        : `installing on ${platform} is not supported; sextant knows Claude Code's managed settings directory on macOS and Linux only.`,
    );
    this.name = 'UnsupportedPlatformError';
  }
}

/**
 * The machine-wide install. SEXTANT_SYSTEM_ROOT stands in for "/" so tests can install into a
 * temporary directory; it is not meant for real installs.
 */
export function managedTarget(env: Env, platform: NodeJS.Platform = process.platform): InstallTarget {
  const dirs = SYSTEM_DIRS[platform];
  if (!dirs) throw new UnsupportedPlatformError(platform);
  const root = env.SEXTANT_SYSTEM_ROOT ? path.resolve(env.SEXTANT_SYSTEM_ROOT) : null;
  const system = (p: string): string => (root ? path.join(root, p) : p);
  const managedDir = system(dirs.claudeCode);
  return {
    kind: 'managed',
    managedDir,
    settingsFile: path.join(managedDir, 'managed-settings.d', DROP_IN_NAME),
    pointer: path.join(system(dirs.sextant), POINTER_NAME),
  };
}

/** A per-account install into one Claude Code configuration directory, such as ~/.claude. */
export function accountTarget(configDir: string, home: string = os.homedir()): InstallTarget {
  const dir = path.resolve(expandHome(configDir, home));
  return { kind: 'account', configDir: dir, settingsFile: path.join(dir, 'settings.json'), pointer: path.join(dataDir(home), POINTER_NAME) };
}

/** The Claude Code configuration directory this shell uses, for messages that suggest --account. */
export function defaultAccountDir(env: Env, home: string = os.homedir()): string {
  return env.CLAUDE_CONFIG_DIR ? path.resolve(env.CLAUDE_CONFIG_DIR) : path.join(home, '.claude');
}

function expandHome(p: string, home: string): string {
  return p === '~' ? home : p.startsWith('~/') ? path.join(home, p.slice(2)) : p;
}
