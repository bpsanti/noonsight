// The Claude Code configuration directories this account installed noonsight into with --account.
// `noonsight check` reads the list to know which settings files to look at; the machine-wide install
// lives at a fixed path and needs no record.
import fs from 'node:fs';
import path from 'node:path';
import { writeFileAtomic } from './files.js';
const FILE = 'installs.json';
/**
 * What runs a hook, as the decision log records it: a machine-wide install, an install in a configuration
 * directory, or the Claude Code plugin.
 */
export const INSTALL_KINDS = ['managed', 'account', 'plugin'];
export function accountInstalls(stateDir) {
    try {
        const value = JSON.parse(fs.readFileSync(path.join(stateDir, FILE), 'utf8'));
        return Array.isArray(value.accounts) ? value.accounts.filter((a) => typeof a === 'string') : [];
    }
    catch {
        return [];
    }
}
export function recordAccountInstall(stateDir, configDir, installed) {
    const others = accountInstalls(stateDir).filter((d) => d !== configDir);
    const accounts = installed ? [...others, configDir] : others;
    fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 });
    writeFileAtomic(path.join(stateDir, FILE), `${JSON.stringify({ schema: 1, accounts }, null, 2)}\n`, 0o600);
    return accounts;
}
//# sourceMappingURL=installs.js.map