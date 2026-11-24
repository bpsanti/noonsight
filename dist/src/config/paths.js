import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
/** The installed package's root directory (this file lives in dist/src/config/). */
export const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
/** The command line's entry point in the installed package; hooks run this file. */
export const CLI_FILE = path.join(PACKAGE_ROOT, 'dist', 'src', 'cli.js');
/**
 * Where the configuration lives. One file serves the whole machine: it never depends on which
 * Claude Code account or configuration directory (CLAUDE_CONFIG_DIR) is running, because rules
 * follow the model and not the account.
 *
 *   1. $NOONSIGHT_CONFIG
 *   2. ~/.config/noonsight/noonsight.json
 */
export function configPath(env = process.env, home = os.homedir()) {
    if (env.NOONSIGHT_CONFIG)
        return path.resolve(env.NOONSIGHT_CONFIG);
    return path.join(home, '.config', 'noonsight', 'noonsight.json');
}
/**
 * Where presets are read from: the installed package, so a preset follows the package version,
 * along with the copies of earlier versions it keeps for configurations that hold one.
 * NOONSIGHT_PRESETS_DIR replaces the directory for tests and preset development.
 */
export function presetsDir(env = process.env) {
    return env.NOONSIGHT_PRESETS_DIR ? path.resolve(env.NOONSIGHT_PRESETS_DIR) : path.join(PACKAGE_ROOT, 'presets');
}
export const SCHEMA_DIR = path.join(PACKAGE_ROOT, 'schema');
/**
 * The account's own state: the decision log, what each session last received, and the list of
 * Claude Code configuration directories noonsight was installed into. Hooks run as the account that
 * owns the session, so a machine-wide install still keeps state per account.
 */
export function stateDir(home = os.homedir()) {
    return path.join(home, '.local', 'state', 'noonsight');
}
/** Files noonsight writes for one account, such as the hook pointer of a per-account install. */
export function dataDir(home = os.homedir()) {
    return path.join(home, '.local', 'share', 'noonsight');
}
//# sourceMappingURL=paths.js.map