// The Claude Code configuration directories this account installed sextant into with --account.
// `sextant check` reads the list to know which settings files to look at; the machine-wide install
// lives at a fixed path and needs no record.

import fs from 'node:fs';
import path from 'node:path';
import { writeFileAtomic } from './files.js';

const FILE = 'installs.json';

export function accountInstalls(stateDir: string): string[] {
  try {
    const value = JSON.parse(fs.readFileSync(path.join(stateDir, FILE), 'utf8')) as { accounts?: unknown };
    return Array.isArray(value.accounts) ? value.accounts.filter((a): a is string => typeof a === 'string') : [];
  } catch {
    return [];
  }
}

export function recordAccountInstall(stateDir: string, configDir: string, installed: boolean): string[] {
  const others = accountInstalls(stateDir).filter((d) => d !== configDir);
  const accounts = installed ? [...others, configDir] : others;
  fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  writeFileAtomic(path.join(stateDir, FILE), `${JSON.stringify({ schema: 1, accounts }, null, 2)}\n`, 0o600);
  return accounts;
}
