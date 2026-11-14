import fs from 'node:fs';
import os from 'node:os';
import { install, InstallRefused, NeedsPermission, readSettings, uninstall, type Runtime } from '../adapters/claude-code/install.js';
import { accountTarget, defaultAccountDir, managedTarget, UnsupportedPlatformError, type InstallTarget } from '../adapters/claude-code/locations.js';
import { findSextantHandlers } from '../adapters/claude-code/settings.js';
import { ConfigError, loadConfig } from '../config/load.js';
import { CLI_FILE, configPath, stateDir, type Env } from '../config/paths.js';
import { isPermissionError } from '../state/files.js';
import { accountInstalls, recordAccountInstall } from '../state/installs.js';
import { packageVersion } from '../version.js';
import { UsageError } from './usage.js';

export const INSTALL_USAGE = `usage: sextant install [--account <dir>]
       sextant uninstall [--account <dir>]

With no option, install sextant's hooks once for the whole machine, in Claude Code's managed
settings, so every Claude Code account on it gets them. This writes a system directory and needs
administrator rights once. With --account, install for one Claude Code configuration directory
only (such as ~/.claude, or the directory in CLAUDE_CONFIG_DIR), with no administrator rights.

Running install again changes nothing; uninstall removes only sextant's own entries.`;

/** The page that explains the guard Claude Code loads on every machine with managed settings. */
export const MOD_GUARD_URL = 'https://code.claude.com/docs/en/plugins/mods/admin#know-what-happens-by-default';

export interface Io {
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
}

export function runInstall(command: 'install' | 'uninstall', args: readonly string[], env: Env, io: Io): number {
  const account = parseAccount(args);
  const home = os.homedir();
  let target: InstallTarget;
  try {
    target = account === null ? managedTarget(env) : accountTarget(account, home);
  } catch (e) {
    if (!(e instanceof UnsupportedPlatformError)) throw e;
    io.err(`sextant: ${e.message}`);
    return 1;
  }
  const runtime: Runtime = { node: process.execPath, cli: fs.realpathSync(CLI_FILE), version: packageVersion() };

  let lines: string[];
  try {
    if (command === 'install') lines = install(target, runtime);
    else {
      // The per-account pointer is shared by every --account install of this account.
      const others = target.kind === 'account' ? accountInstalls(stateDir(home)).filter((d) => d !== target.configDir) : [];
      lines = uninstall(target, { keepPointer: others.length > 0 });
    }
  } catch (e) {
    if (e instanceof NeedsPermission) {
      io.err(permissionMessage(command, target, e.paths, runtime, env, home));
      return 1;
    }
    if (e instanceof InstallRefused) {
      io.err(`sextant: ${e.message}`);
      return 1;
    }
    // A permission the check before writing could not foresee, such as a file locked meanwhile.
    if (isPermissionError(e)) {
      io.err(permissionMessage(command, target, [(e as NodeJS.ErrnoException).path ?? target.settingsFile], runtime, env, home));
      return 1;
    }
    throw e;
  }
  if (target.kind === 'account' && target.configDir !== undefined) {
    try {
      recordAccountInstall(stateDir(home), target.configDir, command === 'install');
    } catch {
      lines.push(`warning: could not update the list of account installs in ${stateDir(home)}; \`sextant check\` may not see this install`);
    }
  }

  if (command === 'install') lines.push(...installNotes(target, env, home));
  io.out(lines.join('\n'));
  return 0;
}

function parseAccount(args: readonly string[]): string | null {
  let account: string | null = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i] ?? '';
    if (a === '--account') {
      const dir = args[++i];
      if (dir === undefined || dir === '') throw new UsageError('--account needs a directory', INSTALL_USAGE);
      account = dir;
    } else if (a.startsWith('--account=')) {
      account = a.slice('--account='.length);
      if (!account) throw new UsageError('--account needs a directory', INSTALL_USAGE);
    } else throw new UsageError(a.startsWith('-') ? `unknown option ${a}` : `unexpected argument "${a}"`, INSTALL_USAGE);
  }
  return account;
}

function installNotes(target: InstallTarget, env: Env, home: string): string[] {
  const notes: string[] = [];
  if (target.kind === 'managed') {
    notes.push(
      'note: every Claude Code account on this machine now runs these hooks; an account with no sextant configuration gets nothing and is not warned.',
      'note: a person can silence sextant for one session with SEXTANT_DISABLE=1; disableAllHooks in their own settings does not reach managed hooks.',
      `note: on a machine with managed settings, Claude Code loads its built-in guard for the mods users install: ${MOD_GUARD_URL}`,
    );
  } else {
    const managed = safeManaged(env);
    if (managed && hasSextantHooks(managed.settingsFile))
      notes.push(
        `warning: sextant is also installed for the whole machine (${managed.settingsFile}); while both installs are in place, ` +
          'this account receives the rules twice. Remove one of them with `sextant uninstall`.',
      );
  }
  if (process.getuid?.() === 0) notes.push('next: run `sextant check` as yourself, without administrator rights, to check your configuration.');
  else notes.push(configLine(env, home));
  return notes;
}

function configLine(env: Env, home: string): string {
  const file = configPath(env, home);
  if (!fs.existsSync(file)) return `next: create ${file} to declare your models (see docs/configuration.md), then run \`sextant check\`.`;
  try {
    loadConfig(file, {}, env);
    return `config ${file}: valid`;
  } catch (e) {
    if (e instanceof ConfigError) return `config ${file}: refused (${e.problems.length} problem${e.problems.length === 1 ? '' : 's'}); run \`sextant check\` to see them. Until it is fixed, sessions get no rules.`;
    throw e;
  }
}

function permissionMessage(command: string, target: InstallTarget, paths: readonly string[], runtime: Runtime, env: Env, home: string): string {
  const lines = [`sextant: this account cannot write ${paths.join(' or ')}. Nothing was changed.`];
  if (target.kind === 'managed') {
    lines[0] = `sextant: ${command === 'install' ? 'installing' : 'uninstalling'} for the whole machine writes Claude Code's managed settings, which needs administrator rights. Nothing was changed.`;
    lines.push(
      `It writes: ${paths.join('\n           ')}`,
      'Run it once as an administrator:',
      `  sudo ${shellQuote(runtime.node)} ${shellQuote(runtime.cli)} ${command}`,
      'Or, with no administrator rights, for one Claude Code account only:',
      `  sextant ${command} --account ${shellQuote(defaultAccountDir(env, home))}`,
    );
  }
  return lines.join('\n');
}

function safeManaged(env: Env): InstallTarget | null {
  try {
    return managedTarget(env);
  } catch {
    return null;
  }
}

function hasSextantHooks(file: string): boolean {
  try {
    return findSextantHandlers(readSettings(file)).length > 0;
  } catch {
    return false;
  }
}

function shellQuote(s: string): string {
  return /^[A-Za-z0-9_./~:@%+=-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`;
}
