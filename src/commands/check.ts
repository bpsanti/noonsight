// sextant check: the configuration, every install this account can see, the Claude Code version and
// the last decision, one line each. It reads local files and runs `claude --version`; it never uses
// the network and never changes anything.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CLAUDE_CODE_FLOORS } from '../adapters/claude-code/compat.js';
import { readSettings } from '../adapters/claude-code/install.js';
import { accountTarget, managedTarget, type InstallTarget } from '../adapters/claude-code/locations.js';
import { readPointer } from '../adapters/claude-code/pointer.js';
import { findSextantHandlers, HOOK_EVENTS, isObject } from '../adapters/claude-code/settings.js';
import { ConfigError, loadConfig } from '../config/load.js';
import { CLI_FILE, configPath, stateDir, type Env } from '../config/paths.js';
import { accountInstalls } from '../state/installs.js';
import { lastDecision } from '../state/log.js';
import { compareVersions, packageVersion } from '../version.js';
import { UsageError } from './usage.js';

export const CHECK_USAGE = `usage: sextant check

Check the configuration, the installed hooks and the Claude Code version, and show the last decision.
Each line starts with ok, warning or problem. Exits 0 when there is no problem, 1 when there is one,
and 2 when the configuration is missing or refused.`;

type Level = 'ok' | 'warning' | 'problem';

export function runCheck(args: readonly string[], env: Env, out: (text: string) => void): number {
  if (args.length) throw new UsageError(`unexpected argument "${args[0]}"`, CHECK_USAGE);
  const home = os.homedir();
  const lines: [Level, string][] = [];
  const add = (level: Level, text: string): void => {
    lines.push([level, text]);
  };
  const version = packageVersion();
  const cli = fs.realpathSync(CLI_FILE);

  // Configuration.
  const file = configPath(env, home);
  let configOk = false;
  try {
    const config = loadConfig(file, {}, env);
    configOk = true;
    add('ok', `config ${file}: valid (${config.exact.size + config.wildcards.length} model entries)`);
  } catch (e) {
    if (!(e instanceof ConfigError)) throw e;
    add('problem', `config ${e.message.replace(/^configuration refused \(([^)]*)\):/, '$1: refused, so sessions get no rules:')}`);
  }

  // Installs.
  let installs = 0;
  let managed: InstallTarget | null = null;
  try {
    managed = managedTarget(env);
  } catch (e) {
    add('warning', `machine-wide install: ${(e as Error).message}`);
  }
  if (managed) {
    const found = checkInstall(managed, version, cli, add, false);
    if (found) installs++;
    checkManagedPolicy(managed, env, add, found);
  }
  for (const dir of accountInstalls(stateDir(home))) {
    if (checkInstall(accountTarget(dir, home), version, cli, add, true)) installs++;
  }
  if (installs === 0) add('problem', 'sextant is not installed: run `sextant install` (or `sextant install --account <dir>`)');
  if (installs > 1 && managed && hasHooks(managed.settingsFile))
    add('warning', 'sextant is installed both for the whole machine and for an account; sessions of that account receive the rules twice');

  // Claude Code.
  checkClaude(env, add);

  // The decision log.
  const last = lastDecision(stateDir(home));
  if (last)
    add(
      'ok',
      `last decision: ${String(last.ts)} ${String(last.event)} ${String(last.status)}` +
        `${last.model ? ` ${String(last.model)}` : ''} (${String(last.delivered)}), log in ${stateDir(home)}`,
    );
  else add('ok', `no decisions logged yet in ${stateDir(home)}`);

  out(lines.map(([level, text]) => `${level}: ${text}`).join('\n'));
  if (!configOk) return 2;
  return lines.some(([level]) => level === 'problem') ? 1 : 0;
}

/** Report one install; returns whether its hook entries are there. */
function checkInstall(
  target: InstallTarget,
  version: string,
  cli: string,
  add: (level: Level, text: string) => void,
  expected: boolean,
): boolean {
  const label = target.kind === 'managed' ? 'machine-wide install' : `account install ${target.configDir}`;
  let settings: Record<string, unknown> | null;
  try {
    settings = readSettings(target.settingsFile);
  } catch (e) {
    add('problem', `${label}: ${(e as Error).message}`);
    return false;
  }
  const found = findSextantHandlers(settings);
  if (found.length === 0) {
    if (expected) add('problem', `${label}: no sextant hooks in ${target.settingsFile}; run \`sextant install --account ${target.configDir}\``);
    else add('ok', `${label}: not installed (${target.settingsFile})`);
    return false;
  }
  const missing = Object.keys(HOOK_EVENTS).filter((event) => !found.some((f) => f.event === event));
  const stray = found.filter((f) => f.handler.command !== target.pointer);
  if (missing.length || stray.length || found.length !== Object.keys(HOOK_EVENTS).length)
    add('problem', `${label}: the hooks in ${target.settingsFile} are incomplete or point elsewhere; run \`sextant install\` again to repair them`);
  else add('ok', `${label}: hooks in ${target.settingsFile} (${Object.keys(HOOK_EVENTS).join(', ')})`);
  if (target.kind === 'account' && settings?.disableAllHooks === true)
    add('problem', `${label}: ${target.settingsFile} sets disableAllHooks, so Claude Code runs none of this account's hooks`);

  const pointer = readPointer(target.pointer);
  if (!pointer) {
    add('problem', `${label}: the hook pointer ${target.pointer} is missing or unreadable; run \`sextant install\` again`);
    return true;
  }
  const unreachable = [reach(pointer.node, fs.constants.X_OK), reach(pointer.cli, fs.constants.R_OK)];
  const gone = [pointer.node, pointer.cli].filter((_, i) => unreachable[i] === 'ENOENT');
  if (gone.length) {
    add('problem', `${label}: the hook pointer runs ${gone.join(' and ')}, which no longer exists; hooks do nothing. Run \`sextant install\` again`);
    return true;
  }
  const denied = [pointer.node, pointer.cli].filter((_, i) => unreachable[i] !== null);
  if (denied.length) {
    add(
      'problem',
      `${label}: this account cannot run ${denied.join(' and ')}, so its hooks do nothing; ` +
        'install sextant from a Node.js and a copy of sextant that every account can read and run',
    );
    return true;
  }
  const running = pointer.cli === cli ? version : versionOf(pointer.node, pointer.cli);
  if (running === null) add('problem', `${label}: the copy of sextant the hook pointer runs (${pointer.cli}) did not report its version`);
  else if (running !== version)
    add('warning', `${label}: hooks run sextant ${running} (${pointer.cli}), but this copy is ${version}; run \`sextant install\` again to switch`);
  else add('ok', `${label}: hook pointer ${target.pointer} runs sextant ${running}`);
  return true;
}

/**
 * Machine-wide settings that decide whether the installed hooks run at all. Claude Code merges the
 * managed settings file and every drop-in file in alphabetical order; a later value wins.
 */
function checkManagedPolicy(managed: InstallTarget, env: Env, add: (level: Level, text: string) => void, installed: boolean): void {
  const dir = managed.managedDir ?? '';
  const files = [path.join(dir, 'managed-settings.json')];
  try {
    const dropIns = path.join(dir, 'managed-settings.d');
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
  const policy: Record<string, unknown> = {};
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    try {
      const value = JSON.parse(fs.readFileSync(f, 'utf8')) as unknown;
      if (!isObject(value)) throw new Error('not a JSON object');
      for (const key of ['disableAllHooks', 'allowManagedHooksOnly']) if (key in value) policy[key] = value[key];
    } catch (e) {
      add('problem', `managed settings ${f} cannot be read as a JSON object (${(e as Error).message}); Claude Code refuses to start while it is so`);
    }
  }
  if (policy.disableAllHooks === true) add('problem', 'managed settings set disableAllHooks: Claude Code runs no hooks at all, sextant included');
  if (policy.allowManagedHooksOnly === true)
    add('warning', 'managed settings set allowManagedHooksOnly: only the machine-wide install runs; account installs are ignored');

  // An MDM profile ranks above managed settings files, and Claude Code then ignores the files by default.
  if (installed && process.platform === 'darwin') {
    const root = env.SEXTANT_SYSTEM_ROOT ? path.resolve(env.SEXTANT_SYSTEM_ROOT) : '/';
    const profile = path.join(root, 'Library', 'Managed Preferences', 'com.anthropic.claudecode.plist');
    if (fs.existsSync(profile))
      add(
        'warning',
        `an MDM profile for Claude Code is present (${profile}); unless it sets managedSourcesBehavior to "merge", ` +
          'Claude Code ignores the managed settings files and the machine-wide hooks do not run. Use `sextant install --account <dir>` instead.',
      );
  }
}

function checkClaude(env: Env, add: (level: Level, text: string) => void): void {
  const r = spawnSync('claude', ['--version'], {
    encoding: 'utf8',
    timeout: 10000,
    env: { ...env, DISABLE_AUTOUPDATER: '1' },
  });
  if (r.error || r.status !== 0) {
    add('warning', 'claude: not found on PATH, so its version was not checked');
    return;
  }
  const found = /(\d+\.\d+\.\d+)/.exec(r.stdout)?.[1];
  if (!found) {
    add('warning', `claude: cannot read the version from "${r.stdout.trim()}"`);
    return;
  }
  const short = CLAUDE_CODE_FLOORS.filter((f) => (compareVersions(found, f.version) ?? -1) < 0);
  if (short.length)
    for (const f of short) add('problem', `claude: installed ${found}; ${f.feature} needs ${f.version} or later (upgrade: claude update)`);
  else add('ok', `claude: ${found}`);
}

/** Why this account cannot use a file in the given mode, as an error code, or null when it can. */
function reach(file: string, mode: number): string | null {
  try {
    fs.accessSync(file, mode);
    return null;
  } catch (e) {
    return (e as NodeJS.ErrnoException).code ?? 'EACCES';
  }
}

function versionOf(node: string, cli: string): string | null {
  const r = spawnSync(node, [cli, '--version'], { encoding: 'utf8', timeout: 10000 });
  const v = r.status === 0 ? r.stdout.trim() : '';
  return /^\d+\.\d+\.\d+$/.test(v) ? v : null;
}

function hasHooks(file: string): boolean {
  try {
    return findSextantHandlers(readSettings(file)).length > 0;
  } catch {
    return false;
  }
}
