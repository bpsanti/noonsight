import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkInstallable, checkUninstallable, install, InstallRefused, NeedsPermission, readSettings, uninstall, type Runtime } from '../adapters/claude-code/install.js';
import { accountTarget, defaultAccountDir, discoverConfigDirs, managedTarget, UnsupportedPlatformError, type InstallTarget } from '../adapters/claude-code/locations.js';
import { managedFilesApply, readRemoteSettings } from '../adapters/claude-code/managed.js';
import { findNoonsightHandlers } from '../adapters/claude-code/settings.js';
import { ConfigError, loadConfig, loadConfigDetails } from '../config/load.js';
import { CLI_FILE, configPath, stateDir, type Env } from '../config/paths.js';
import { projectFor } from '../config/project.js';
import { isPermissionError } from '../state/files.js';
import { accountInstalls, recordAccountInstall } from '../state/installs.js';
import { packageVersion } from '../version.js';
import { runCheck } from './check.js';
import { writeConfig } from './init.js';
import { changeLines, receivesLines } from './receives.js';
import { UsageError } from './usage.js';

export const INSTALL_USAGE = `usage: noonsight install [--account <dir> | --managed]
       noonsight uninstall [--account <dir> | --managed]

One command sets noonsight up: it writes the configuration file when there is none (as
\`noonsight init\`, never replacing an existing file), installs the hooks, runs \`noonsight check\`
and lists what each declared model receives. It is safe to run again, and says what it changed or
that nothing changed. It exits 0 once the hooks and a valid configuration are in place, and the
check's lines say what else needs attention; it exits 2 when the configuration is refused.

With no option, install noonsight's hooks into the user settings of every Claude Code configuration
directory of this account: ~/.claude, the directory in CLAUDE_CONFIG_DIR, and every other directory
in the home directory that holds a Claude Code configuration, one per login. It needs no
administrator rights, and it reaches every login, including one whose organization delivers
server-managed settings. Run it again after adding a Claude Code configuration directory, or run
\`noonsight watch enable\` once to have each new one installed as it appears; \`noonsight check\`
lists any directory it does not reach.

  --account <dir>  only this Claude Code configuration directory
  --managed        once for every account on the machine, in Claude Code's managed settings files;
                   needs administrator rights, and Claude Code ignores these files on a login whose
                   organization delivers server-managed settings (see docs/install.md); it only
                   installs the hooks, because the configuration belongs to each account

Running install again changes nothing; uninstall removes only noonsight's own entries.`;

/** The page that explains the guard Claude Code loads on every machine with managed settings. */
export const MOD_GUARD_URL = 'https://code.claude.com/docs/en/plugins/mods/admin#know-what-happens-by-default';

export interface Io {
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
}

type Mode = { readonly kind: 'every' } | { readonly kind: 'account'; readonly dir: string } | { readonly kind: 'managed' };

/** hooksOnly installs the hooks and nothing else; the watcher installs each new login that way. */
export interface InstallOptions {
  readonly hooksOnly?: boolean;
}

export function runInstall(command: 'install' | 'uninstall', args: readonly string[], env: Env, io: Io, options: InstallOptions = {}): number {
  const mode = parseMode(args);
  const home = os.homedir();
  const runtime: Runtime = { node: process.execPath, cli: fs.realpathSync(CLI_FILE), version: packageVersion() };

  let targets: InstallTarget[];
  try {
    if (mode.kind === 'managed') targets = [managedTarget(env)];
    else if (mode.kind === 'account') targets = [accountTarget(mode.dir, home)];
    else targets = everyAccountTarget(command, env, home);
  } catch (e) {
    if (!(e instanceof UnsupportedPlatformError) && !(e instanceof InstallRefused)) throw e;
    io.err(`noonsight: ${e.message}`);
    return 1;
  }

  const setup = command === 'install' && mode.kind !== 'managed' && options.hooksOnly !== true;
  let wrote: string[] | null = null;
  const lines: string[] = [];
  let current: InstallTarget | undefined = targets[0];
  try {
    if (command === 'install') {
      // Every directory is checked before any is written, so a refusal leaves all of them as they were.
      for (const target of targets) {
        current = target;
        checkInstallable(target, runtime);
      }
      if (setup) {
        const file = configPath(env, home);
        try {
          wrote = writeConfig(env);
        } catch (e) {
          if (!isPermissionError(e)) throw e;
          io.err(
            `noonsight: this account cannot write ${(e as NodeJS.ErrnoException).path ?? file}, so the configuration file ${file} was not written, and no hook was written either. ` +
              'Make that directory writable, or set NOONSIGHT_CONFIG to a file this account can write, then run `noonsight install` again.',
          );
          return 1;
        }
        lines.push(...(wrote ?? [`config ${file}: already there, left as it is`]));
      }
      for (const target of targets) {
        current = target;
        lines.push(...install(target, runtime));
        record(target, true, home, lines);
      }
    } else {
      // The per-account pointer is shared by every account install of this account: it stays while a
      // recorded directory that still exists, and that this uninstall has not reached yet, runs it.
      const recorded = accountInstalls(stateDir(home));
      const vanished = recorded.filter(isGone);
      const live = recorded.filter((d) => !vanished.includes(d));
      const keepPointer = targets.map(
        (target, i) => target.kind === 'account' && live.some((d) => !targets.slice(0, i + 1).some((t) => t.configDir === d)),
      );
      for (const [i, target] of targets.entries()) {
        current = target;
        checkUninstallable(target, { keepPointer: keepPointer[i] === true });
      }
      for (const [i, target] of targets.entries()) {
        current = target;
        lines.push(...uninstall(target, { keepPointer: keepPointer[i] === true }));
        record(target, false, home, lines);
      }
      if (mode.kind !== 'managed')
        for (const dir of vanished)
          if (recordDir(dir, false, home, lines)) lines.push(`account install ${dir}: forgotten (the directory no longer exists)`);
    }
  } catch (e) {
    const failed = current ?? targets[0];
    if (failed === undefined) throw e;
    if (lines.length) io.out(lines.join('\n'));
    if (e instanceof NeedsPermission) {
      io.err(permissionMessage(command, failed, e.paths, runtime, env, home, lines.length > 0));
      return 1;
    }
    if (e instanceof InstallRefused) {
      io.err(`noonsight: ${e.message}${lines.length > 0 ? ' (except what the lines above report)' : ''}`);
      return 1;
    }
    // A permission the check before writing could not foresee, such as a file locked meanwhile.
    if (isPermissionError(e)) {
      io.err(permissionMessage(command, failed, [(e as NodeJS.ErrnoException).path ?? failed.settingsFile], runtime, env, home, lines.length > 0));
      return 1;
    }
    throw e;
  }

  if (setup) return finishSetup(lines, wrote !== null, targets, env, home, io);
  if (command === 'install') lines.push(...installNotes(targets, env, home, true));
  else if (targets.length === 0) lines.push('no Claude Code configuration directory found; nothing to remove');
  io.out(lines.join('\n'));
  return 0;
}

/**
 * The rest of the one-command setup, once the configuration file and the hooks are in: what each
 * declared model receives, then the check, then one line on what changed. It composes models and
 * check, and holds no logic of its own about them. Its exit status covers what it set up, the hooks
 * and the configuration; the check's lines report the rest of the machine without changing it.
 */
function finishSetup(setupLines: readonly string[], wroteConfig: boolean, targets: readonly InstallTarget[], env: Env, home: string, io: Io): number {
  const out = [...setupLines];

  let usable = true;
  try {
    out.push(...receives(env, home));
  } catch (e) {
    if (!(e instanceof ConfigError)) throw e;
    usable = false;
  }

  const checked: string[] = [];
  const checkStatus = runCheck([], env, (t) => checked.push(t), { receives: false });
  if (checkStatus === 2) usable = false;
  out.push(...checked, ...installNotes(targets, env, home, false));

  const hooks = setupLines.filter((l) => /^hooks .*: (created|added)\b/.test(l)).length;
  const pointer = setupLines.some((l) => /^hook pointer .*: (written|rewritten)\b/.test(l));
  const changes = [
    ...(wroteConfig ? ['the configuration file was written'] : []),
    ...(hooks > 0 ? [`hooks were added to ${hooks} Claude Code configuration ${hooks === 1 ? 'directory' : 'directories'}`] : []),
    ...(pointer && hooks === 0 ? ['the hook pointer was updated'] : []),
  ];
  out.push(changes.length === 0 ? 'Nothing changed: noonsight was already set up here.' : `Changed: ${changes.join('; ')}.`);
  if (!usable) out.push('Until the configuration is fixed, sessions get no rules. Edit it, then run `noonsight install` again.');
  else if (checkStatus !== 0) out.push('Not done yet: fix the problems the check reports above, then run `noonsight check` again.');
  else
    out.push(
      'Done: from the next Claude Code session on, each session and subagent receives what the lines above give its model in its place and scope. ' +
        '`noonsight report` shows what was delivered. To undo: `noonsight uninstall`.',
    );
  io.out(out.join('\n'));
  return usable ? 0 : 2;
}

/**
 * What each declared model will receive in each place with no scope, one line each, and the two ways
 * to change it; the configuration is read as a session started here would read it.
 */
function receives(env: Env, home: string): string[] {
  const file = configPath(env, home);
  const { config } = loadConfigDetails(file, { project: projectFor(env.CLAUDE_PROJECT_DIR || process.cwd(), file, stateDir(home)) }, env);
  return [
    'Each declared model receives, with no scope:',
    ...receivesLines(config).map((l) => `  ${l}`),
    ...changeLines(config).map((l) => `  ${l}`),
  ];
}

/**
 * The default install reaches every Claude Code configuration directory of this account. ~/.claude
 * is Claude Code's own default, so install creates it when Claude Code has not run yet; uninstall
 * also visits every directory noonsight installed into before.
 */
function everyAccountTarget(command: 'install' | 'uninstall', env: Env, home: string): InstallTarget[] {
  if (process.getuid?.() === 0 && ownerOf(home) !== 0)
    throw new InstallRefused(
      `${home} belongs to another account. Without --managed, noonsight installs for the account that runs it: ` +
        'run it as that account, without sudo, or install for every account with --managed.',
    );
  const recorded = accountInstalls(stateDir(home));
  if (command === 'install') {
    const defaultDir = path.join(home, '.claude');
    if (!fs.existsSync(defaultDir)) fs.mkdirSync(defaultDir, { recursive: true, mode: 0o700 });
  }
  return discoverConfigDirs(env, home, recorded).map((dir) => accountTarget(dir, home));
}

function ownerOf(file: string): number | null {
  try {
    return fs.statSync(file).uid;
  } catch {
    return null;
  }
}

function record(target: InstallTarget, installed: boolean, home: string, lines: string[]): void {
  if (target.kind === 'account' && target.configDir !== undefined) recordDir(target.configDir, installed, home, lines);
}

function recordDir(configDir: string, installed: boolean, home: string, lines: string[]): boolean {
  try {
    recordAccountInstall(stateDir(home), configDir, installed);
    return true;
  } catch {
    lines.push(`warning: could not update the list of account installs in ${stateDir(home)}; \`noonsight check\` may not see this install`);
    return false;
  }
}

/** Whether a recorded directory is gone; one that cannot be reached now, such as on an unmounted volume, is not. */
function isGone(dir: string): boolean {
  try {
    return !fs.statSync(dir).isDirectory();
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    return code === 'ENOENT' || code === 'ENOTDIR';
  }
}

function parseMode(args: readonly string[]): Mode {
  let mode: Mode = { kind: 'every' };
  const set = (next: Mode): void => {
    if (mode.kind !== 'every') throw new UsageError('give at most one of --account and --managed', INSTALL_USAGE);
    mode = next;
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i] ?? '';
    if (a === '--account') {
      const dir = args[++i];
      if (dir === undefined || dir === '') throw new UsageError('--account needs a directory', INSTALL_USAGE);
      set({ kind: 'account', dir });
    } else if (a.startsWith('--account=')) {
      const dir = a.slice('--account='.length);
      if (!dir) throw new UsageError('--account needs a directory', INSTALL_USAGE);
      set({ kind: 'account', dir });
    } else if (a === '--managed') set({ kind: 'managed' });
    else throw new UsageError(a.startsWith('-') ? `unknown option ${a}` : `unexpected argument "${a}"`, INSTALL_USAGE);
  }
  return mode;
}

function installNotes(targets: readonly InstallTarget[], env: Env, home: string, withConfigLine: boolean): string[] {
  const notes: string[] = [];
  if (targets[0]?.kind === 'managed') {
    notes.push(
      'note: every Claude Code account on this machine now runs these hooks; an account with no noonsight configuration gets nothing and is not warned.',
      'note: a person can silence noonsight for one session with NOONSIGHT_DISABLE=1; disableAllHooks in their own settings does not reach managed hooks.',
      `note: on a machine with managed settings, Claude Code loads its built-in guard for the mods users install: ${MOD_GUARD_URL}`,
    );
    for (const dir of discoverConfigDirs(env, home)) {
      const remote = readRemoteSettings(dir);
      if (!managedFilesApply(remote))
        notes.push(
          `warning: the login in ${dir} receives server-managed settings from its organization (${remote?.file ?? ''}), ` +
            'so Claude Code ignores the managed settings files there and its sessions get no rules from this install. ' +
            'Run `noonsight install`, without --managed and without sudo, as the account that owns it.',
        );
    }
  } else {
    if (targets.length === 0) notes.push('no Claude Code configuration directory found');
    const managed = safeManaged(env);
    if (managed && hasNoonsightHooks(managed.settingsFile)) {
      const twice = targets.filter((t) => t.configDir !== undefined && managedFilesApply(readRemoteSettings(t.configDir)));
      if (twice.length)
        notes.push(
          `warning: noonsight is also installed for the whole machine (${managed.settingsFile}); while both installs are in place, ` +
            `sessions that use ${twice.map((t) => t.configDir).join(', ')} receive the rules twice. ` +
            'Remove one of them with `noonsight uninstall`.',
        );
    }
  }
  if (process.getuid?.() === 0) notes.push('next: run `noonsight check` as yourself, without administrator rights, to check your configuration.');
  else if (withConfigLine) notes.push(configLine(env, home));
  return notes;
}

function configLine(env: Env, home: string): string {
  const file = configPath(env, home);
  if (!fs.existsSync(file)) return `next: create ${file} to declare your models (see docs/configuration.md), then run \`noonsight check\`.`;
  try {
    loadConfig(file, {}, env);
    return `config ${file}: valid`;
  } catch (e) {
    if (e instanceof ConfigError) return `config ${file}: refused (${e.problems.length} problem${e.problems.length === 1 ? '' : 's'}); run \`noonsight check\` to see them. Until it is fixed, sessions get no rules.`;
    throw e;
  }
}

function permissionMessage(
  command: string,
  target: InstallTarget,
  paths: readonly string[],
  runtime: Runtime,
  env: Env,
  home: string,
  changedBefore: boolean,
): string {
  const unchanged = changedBefore ? 'Nothing was changed past the lines above.' : 'Nothing was changed.';
  const lines = [`noonsight: this account cannot write ${paths.join(' or ')}. ${unchanged}`];
  if (target.kind === 'managed') {
    lines[0] = `noonsight: ${command === 'install' ? 'installing' : 'uninstalling'} with --managed writes Claude Code's managed settings, which needs administrator rights. ${unchanged}`;
    lines.push(
      `It writes: ${paths.join('\n           ')}`,
      'Run it once as an administrator:',
      `  sudo ${shellQuote(runtime.node)} ${shellQuote(runtime.cli)} ${command} --managed`,
      'Or, with no administrator rights, for every Claude Code configuration directory of this account:',
      `  noonsight ${command}`,
    );
  } else if (process.getuid?.() !== 0) {
    lines.push(`To ${command} for one directory only: noonsight ${command} --account ${shellQuote(defaultAccountDir(env, home))}`);
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

function hasNoonsightHooks(file: string): boolean {
  try {
    return findNoonsightHandlers(readSettings(file)).length > 0;
  } catch {
    return false;
  }
}

function shellQuote(s: string): string {
  return /^[A-Za-z0-9_./~:@%+=-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`;
}
