import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The installed package's root directory (this file lives in dist/src/config/). */
export const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export type Env = Readonly<Record<string, string | undefined>>;

/**
 * Where the configuration lives. One file serves the whole machine: it never depends on which
 * Claude Code account or configuration directory (CLAUDE_CONFIG_DIR) is running, because rules
 * follow the model and not the account.
 *
 *   1. $SEXTANT_CONFIG
 *   2. $XDG_CONFIG_HOME/sextant/sextant.json, when XDG_CONFIG_HOME is an absolute path
 *   3. ~/.config/sextant/sextant.json
 */
export function configPath(env: Env = process.env, home: string = os.homedir()): string {
  if (env.SEXTANT_CONFIG) return path.resolve(env.SEXTANT_CONFIG);
  const xdg = env.XDG_CONFIG_HOME;
  const base = xdg && path.isAbsolute(xdg) ? xdg : path.join(home, '.config');
  return path.join(base, 'sextant', 'sextant.json');
}

/**
 * Where presets are read from: the installed package, so a preset always follows the package
 * version. SEXTANT_PRESETS_DIR replaces the directory for tests and preset development.
 */
export function presetsDir(env: Env = process.env): string {
  return env.SEXTANT_PRESETS_DIR ? path.resolve(env.SEXTANT_PRESETS_DIR) : path.join(PACKAGE_ROOT, 'presets');
}

export const SCHEMA_DIR = path.join(PACKAGE_ROOT, 'schema');
