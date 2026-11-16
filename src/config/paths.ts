import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The installed package's root directory (this file lives in dist/src/config/). */
export const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** The command line's entry point in the installed package; hooks run this file. */
export const CLI_FILE = path.join(PACKAGE_ROOT, 'dist', 'src', 'cli.js');

export type Env = Readonly<Record<string, string | undefined>>;

/**
 * Where the configuration lives. One file serves the whole machine: it never depends on which
 * Claude Code account or configuration directory (CLAUDE_CONFIG_DIR) is running, because rules
 * follow the model and not the account.
 *
 *   1. $NOONSIGHT_CONFIG
 *   2. ~/.config/noonsight/noonsight.json
 */
export function configPath(env: Env = process.env, home: string = os.homedir()): string {
  if (env.NOONSIGHT_CONFIG) return path.resolve(env.NOONSIGHT_CONFIG);
  return path.join(home, '.config', 'noonsight', 'noonsight.json');
}

/**
 * Where presets are read from: the installed package, so a preset always follows the package
 * version. NOONSIGHT_PRESETS_DIR replaces the directory for tests and preset development.
 */
export function presetsDir(env: Env = process.env): string {
  return env.NOONSIGHT_PRESETS_DIR ? path.resolve(env.NOONSIGHT_PRESETS_DIR) : path.join(PACKAGE_ROOT, 'presets');
}

export const SCHEMA_DIR = path.join(PACKAGE_ROOT, 'schema');

/**
 * The account's own state: the decision log, what each session last received, and the list of
 * Claude Code configuration directories noonsight was installed into. Hooks run as the account that
 * owns the session, so a machine-wide install still keeps state per account.
 */
export function stateDir(home: string = os.homedir()): string {
  return path.join(home, '.local', 'state', 'noonsight');
}

/** Files noonsight writes for one account, such as the hook pointer of a per-account install. */
export function dataDir(home: string = os.homedir()): string {
  return path.join(home, '.local', 'share', 'noonsight');
}
