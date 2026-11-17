// noonsight check: the configuration, every install this account can see, the watcher, the Claude
// Code version and the last decision, one line each. It reads local files, runs `claude --version`,
// and, when the watcher is on, asks the service manager whether it runs; it never uses the network
// and never changes anything.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CLAUDE_CODE_FLOORS, MODEL_ALIASES } from '../adapters/claude-code/compat.js';
import { readSettings } from '../adapters/claude-code/install.js';
import { accountTarget, discoverConfigDirs, managedTarget, type InstallTarget } from '../adapters/claude-code/locations.js';
import { managedFilesApply, readManagedFiles, readRemoteSettings, type RemoteSettings } from '../adapters/claude-code/managed.js';
import { readPointer } from '../adapters/claude-code/pointer.js';
import { findNoonsightHandlers, handlersFor, HOOK_HANDLERS, matcherOf, type HookHandlerSpec } from '../adapters/claude-code/settings.js';
import { ConfigError, loadConfig } from '../config/load.js';
import { scopeOverlaps } from '../core/overlap.js';
import { SCOPE_ENV, sessionPlace, sessionScope } from '../core/scope.js';
import { ROUTING_ENV, routingEnvOff } from '../core/route.js';
import { TRIGGER_ACTIONS } from '../core/triggers.js';
import { ROUTE_TARGETS, RULES_TEXT_LIMIT, TRIGGERS, type Config, type RouteOption, type RouteRow, type Trigger } from '../core/types.js';
import { CLI_FILE, configPath, stateDir, type Env } from '../config/paths.js';
import { accountInstalls } from '../state/installs.js';
import { isLoaded, isOurs, manager, readServiceFile, serviceContent, watchService, WatchUnsupported, type WatchService } from '../watch/service.js';
import { lastDecision } from '../state/log.js';
import { compareVersions, packageVersion } from '../version.js';
import { UsageError } from './usage.js';

export const CHECK_USAGE = `usage: noonsight check

Check the configuration, the installed hooks, the watcher and the Claude Code version, and show
the last decision. Each line starts with ok, warning or problem. Exits 0 when there is no problem, 1 when there is one,
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
    const sub = config.subagents;
    add(
      'ok',
      `config ${file}: valid (${config.exact.size + config.wildcards.length} model entries; subagents: ` +
        (sub.delivery === 'off' ? 'off' : `rules when each subagent starts, permission ${sub.permission} for a routed call, on mismatch ${sub.onMismatch}`) +
        ')',
    );
    checkAllModels(config, add);
    checkScopes(config, env, add);
    checkTriggers(config, add);
    checkRouting(config, env, add);
    checkClassifier(config, add);
  } catch (e) {
    if (!(e instanceof ConfigError)) throw e;
    add('problem', `config ${e.message.replace(/^configuration refused \(([^)]*)\):/, '$1: refused, so sessions get no rules:')}`);
  }

  // Installs: the machine-wide one, then every Claude Code configuration directory of this account.
  let installs = 0;
  let managed: InstallTarget | null = null;
  try {
    managed = managedTarget(env);
  } catch (e) {
    add('warning', `machine-wide install: ${(e as Error).message}`);
  }
  const managedInstalled = managed !== null && checkInstall(managed, version, cli, add, false);
  if (managed) {
    if (managedInstalled) installs++;
    checkManagedPolicy(managed, env, add, managedInstalled);
  }
  const recorded = accountInstalls(stateDir(home));
  const dirs = discoverConfigDirs(env, home, recorded);
  const uncovered: string[] = [];
  for (const dir of dirs) {
    const target = accountTarget(dir, home);
    const remote = readRemoteSettings(dir);
    const managedReaches = managedInstalled && managedFilesApply(remote);
    const hasAccountHooks = hasHooks(target.settingsFile);
    if (recorded.includes(dir) || hasAccountHooks) {
      if (checkInstall(target, version, cli, add, true)) installs++;
      if (hasAccountHooks && managedReaches)
        add('warning', `account install ${dir}: the machine-wide install reaches this login too, so its sessions receive the rules twice; remove one with \`noonsight uninstall\``);
    } else if (managedReaches) add('ok', `Claude Code configuration ${dir}: reached by the machine-wide install`);
    else uncovered.push(dir);
    checkRemotePolicy(dir, remote, hasAccountHooks, managedInstalled, add);
  }
  if (installs === 0) add('problem', 'noonsight is not installed: run `noonsight install`');
  else
    for (const dir of uncovered)
      add(
        'problem',
        `Claude Code configuration ${dir}: no noonsight hooks reach it` +
          (managedInstalled ? ' (its login receives server-managed settings, so Claude Code ignores the machine-wide install there)' : '') +
          '; run `noonsight install`',
      );

  // The watcher.
  checkWatcher(env, home, cli, add);

  // Claude Code.
  checkClaude(env, add);

  // The decision log.
  const last = lastDecision(stateDir(home));
  if (last)
    add(
      'ok',
      `last decision: ${String(last.ts)} ${String(last.event)} ${String(last.status ?? last.result)}` +
        `${last.model ? ` ${String(last.model)}` : ''} (${String(last.delivered)}), log in ${stateDir(home)}`,
    );
  else add('ok', `no decisions logged yet in ${stateDir(home)}`);

  out(lines.map(([level, text]) => `${level}: ${text}`).join('\n'));
  if (!configOk) return 2;
  return lines.some(([level]) => level === 'problem') ? 1 : 0;
}

/**
 * The "all_models" block: the models that receive its rules and the places they cover. The limit on
 * the text delivered was already checked per model when the configuration loaded, with these rules
 * in each model's rules, so a block that is too large for a model has refused the configuration.
 */
function checkAllModels(config: Config, add: (level: Level, text: string) => void): void {
  if (config.allModels.length === 0) return;
  const receiving = [...config.exact].filter(([, entry]) => entry.use === 'rules').map(([model]) => model);
  add(
    'ok',
    `all_models: ${plural(config.allModels.length, 'rule')} (${config.allModels.map((r) => r.id).join(', ')}) delivered to ${plural(receiving.length, 'model')} declared with preset or custom` +
      `${receiving.length ? ` (${receiving.join(', ')})` : ''}, each within the ${RULES_TEXT_LIMIT}-character limit on the rules delivered`,
  );
  if (receiving.length === 0) add('warning', 'all_models: no model is declared with "use": "preset" or "use": "custom", so no model receives these rules');
}

/**
 * The declared scopes: scopes a single task can fall in, matchers that could not be tested for that,
 * and the scope and place sessions started from this environment get.
 */
function checkScopes(config: Config, env: Env, add: (level: Level, text: string) => void): void {
  const report = scopeOverlaps(config);
  if (config.scopes.size > 0) {
    const untested = report.untested.map((u) => `scope "${u.scope}": ${JSON.stringify(u.matcher)}`);
    add(
      'ok',
      `scopes: ${plural(config.scopes.size, 'scope')} declared, ${plural(report.matchers, 'matcher')}` +
        (report.overlaps.length === 0 && untested.length === 0 && report.matchers > 0 ? '; no two scopes overlap' : '') +
        (untested.length ? `; not all example texts could be built for ${untested.join(', ')}, so their overlaps are not fully checked` : ''),
    );
  }
  for (const o of report.overlaps)
    add(
      'warning',
      `scopes "${o.scopes[0]}" and "${o.scopes[1]}" overlap: the task text ${JSON.stringify(o.text)} matches both` +
        (o.winner !== null ? `, and a task with only that text gets "${o.winner}"` : '') +
        '; the scope whose matcher matches earliest in a task wins, and at the same place the one declared first',
    );

  const scope = sessionScope(env).scope;
  const place = sessionPlace(config, env);
  if (scope !== null && !config.scopes.has(scope))
    add('warning', `${SCOPE_ENV} is "${scope}" here, which is not a declared scope, so sessions started from this environment get only the rules for every scope`);
  else if (scope !== null || place.because !== undefined)
    add(
      'ok',
      'sessions started from this environment get ' +
        (scope !== null ? `scope "${scope}" (${SCOPE_ENV})` : 'no scope') +
        `, place "${place.place}"` +
        (place.because !== undefined ? ` (${place.because} is set)` : ''),
    );
}

/** The triggers the hooks act on, and the rules that list each one. */
function checkTriggers(config: Config, add: (level: Level, text: string) => void): void {
  const listing = (trigger: Trigger): string[] =>
    [...config.exact].flatMap(([model, entry]) => (entry.use === 'rules' ? entry.rules.filter((r) => r.triggers.includes(trigger)).map((r) => `${r.id} for ${model}`) : []));
  for (const t of TRIGGERS) {
    const rules = listing(t);
    add('ok', `triggers: ${t}` + (rules.length ? `, which delivers ${rules.join(', ')} to ${TRIGGER_ACTIONS[t]}` : ', which no rule lists'));
  }
}

/** Whether routing is on, where it acts, its table, and whether sessions started from this environment are routed. */
function checkRouting(config: Config, env: Env, add: (level: Level, text: string) => void): void {
  const r = config.routing;
  if (!r.enabled) {
    add('ok', 'routing: off, so noonsight never changes a model or an effort');
    return;
  }
  const rows = [...r.table.entries()].map(([scope, row]) => `${scope} ${describeRow(row)}`);
  add(
    'ok',
    `routing: on for ${r.targets.join(' and ')}` +
      (r.respectExplicit ? ', a model the caller chose wins' : ', the table wins over a model the caller chose') +
      (r.yieldWhenEnv.length ? `, yields when ${r.yieldWhenEnv.join(' or ')} is set` : '') +
      `; table: ${rows.length ? rows.join('; ') : 'empty'}; default: ${r.default === null ? 'inherit' : describeRow(r.default)}`,
  );
  if (routingEnvOff(env)) add('ok', `${ROUTING_ENV} turns routing off for sessions started from this environment`);
  else {
    const yieldEnv = r.yieldWhenEnv.find((name) => (env[name] ?? '') !== '');
    if (yieldEnv !== undefined) add('ok', `routing yields for sessions started from this environment (${yieldEnv} is set)`);
  }
}

/** Whether the classifier is on, for which tasks, and what one classification may cost in time. */
function checkClassifier(config: Config, add: (level: Level, text: string) => void): void {
  const c = config.classifier;
  if (c.mode === 'off') {
    add('ok', 'classifier: off, so a task without an explicit scope takes its scope from the matchers alone');
    return;
  }
  const which = c.mode === 'fallback' ? 'for a task no explicit scope and no matcher placed' : 'for every task without an explicit scope, over the matchers';
  add('ok', `classifier: ${c.mode}, ${which}; ${c.model} at ${c.effort} effort, at most ${c.timeoutMs} ms per task`);
}

function describeRow(row: RouteRow): string {
  const list = (options: readonly RouteOption[] | undefined): string =>
    options === undefined ? 'default' : options.length === 0 ? 'none' : options.map((o) => (o.effort ? `${o.model} ${o.effort}` : o.model)).join(', ');
  const [launcher, subagents] = ROUTE_TARGETS.map((t) => list(row[t]));
  return launcher === subagents ? `[${launcher}]` : `[launcher: ${launcher}; subagents: ${subagents}]`;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
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
  const again = target.kind === 'managed' ? '`noonsight install --managed` again, as an administrator,' : '`noonsight install` again';
  let settings: Record<string, unknown> | null;
  try {
    settings = readSettings(target.settingsFile);
  } catch (e) {
    add('problem', `${label}: ${(e as Error).message}`);
    return false;
  }
  const found = findNoonsightHandlers(settings);
  if (found.length === 0) {
    if (expected) add('problem', `${label}: no noonsight hooks in ${target.settingsFile}; run \`noonsight install --account ${target.configDir}\``);
    else add('ok', `${label}: not installed (${target.settingsFile})`);
    return false;
  }
  const missing = HOOK_HANDLERS.filter((spec) => handlersFor(found, spec, target.pointer).length === 0);
  if (missing.length || found.length !== HOOK_HANDLERS.length)
    add(
      'problem',
      `${label}: the hooks in ${target.settingsFile} are incomplete or point elsewhere` +
        (missing.length ? ` (missing: ${missing.map(describeHandler).join(', ')})` : '') +
        `; run ${again} to repair them`,
    );
  else add('ok', `${label}: hooks in ${target.settingsFile} (${HOOK_HANDLERS.map(describeHandler).join(', ')})`);
  if (target.kind === 'account' && settings?.disableAllHooks === true)
    add('problem', `${label}: ${target.settingsFile} sets disableAllHooks, so Claude Code runs none of this account's hooks`);

  const pointer = readPointer(target.pointer);
  if (!pointer) {
    add('problem', `${label}: the hook pointer ${target.pointer} is missing or unreadable; run ${again}`);
    return true;
  }
  const unreachable = [reach(pointer.node, fs.constants.X_OK), reach(pointer.cli, fs.constants.R_OK)];
  const gone = [pointer.node, pointer.cli].filter((_, i) => unreachable[i] === 'ENOENT');
  if (gone.length) {
    add('problem', `${label}: the hook pointer runs ${gone.join(' and ')}, which no longer exists; hooks do nothing. Run ${again}`);
    return true;
  }
  const denied = [pointer.node, pointer.cli].filter((_, i) => unreachable[i] !== null);
  if (denied.length) {
    add(
      'problem',
      `${label}: this account cannot run ${denied.join(' and ')}, so its hooks do nothing; ` +
        'install noonsight from a Node.js and a copy of noonsight that every account can read and run',
    );
    return true;
  }
  const running = pointer.cli === cli ? version : versionOf(pointer.node, pointer.cli);
  if (running === null) add('problem', `${label}: the copy of noonsight the hook pointer runs (${pointer.cli}) did not report its version`);
  else if (running !== version)
    add('warning', `${label}: hooks run noonsight ${running} (${pointer.cli}), but this copy is ${version}; run ${again} to switch`);
  else add('ok', `${label}: hook pointer ${target.pointer} runs noonsight ${running}`);
  return true;
}

/**
 * Machine-wide settings that decide whether the installed hooks run at all. Claude Code merges the
 * managed settings file and every drop-in file in alphabetical order; a later value wins.
 */
function checkManagedPolicy(managed: InstallTarget, env: Env, add: (level: Level, text: string) => void, installed: boolean): void {
  const { merged: policy, problems } = readManagedFiles(managed.managedDir ?? '');
  for (const p of problems)
    add('problem', `managed settings ${p.file} cannot be read as a JSON object (${p.message}); Claude Code refuses to start while it is so`);
  if (policy.disableAllHooks === true) add('problem', 'managed settings set disableAllHooks: Claude Code runs no hooks at all, noonsight included');
  if (policy.allowManagedHooksOnly === true)
    add('warning', 'managed settings set allowManagedHooksOnly: only the machine-wide install runs; account installs are ignored');

  // An MDM profile ranks above managed settings files, and Claude Code then ignores the files by default.
  if (installed && process.platform === 'darwin') {
    const root = env.NOONSIGHT_SYSTEM_ROOT ? path.resolve(env.NOONSIGHT_SYSTEM_ROOT) : '/';
    const profile = path.join(root, 'Library', 'Managed Preferences', 'com.anthropic.claudecode.plist');
    if (fs.existsSync(profile))
      add(
        'warning',
        `an MDM profile for Claude Code is present (${profile}); unless it sets managedSourcesBehavior to "merge", ` +
          'Claude Code ignores the managed settings files and the machine-wide hooks do not run. Use `noonsight install` (without --managed) instead.',
      );
  }
}

/**
 * Server-managed settings, which Claude Code caches per login in its configuration directory. They
 * outrank the managed settings files, and can turn hooks off for that login.
 */
function checkRemotePolicy(
  dir: string,
  remote: RemoteSettings | null,
  accountHooks: boolean,
  managedInstalled: boolean,
  add: (level: Level, text: string) => void,
): void {
  if (!remote?.deliversPolicy) return;
  const label = `Claude Code configuration ${dir}`;
  if (remote.settings.disableAllHooks === true)
    add('problem', `${label}: the server-managed settings of this login (${remote.file}) set disableAllHooks, so Claude Code runs no hooks there`);
  else if (remote.settings.allowManagedHooksOnly === true && !(remote.merges && managedInstalled))
    add(
      'problem',
      `${label}: the server-managed settings of this login (${remote.file}) set allowManagedHooksOnly, ` +
        'so Claude Code runs only the hooks the organization delivers, and no noonsight install reaches it',
    );
  else if (accountHooks && !remote.merges)
    add('ok', `${label}: this login receives server-managed settings, which shadow the managed settings files; the account install reaches it`);
}

/** Whether the opt-in watcher is on, whether it runs, and what it last logged. */
function checkWatcher(env: Env, home: string, cli: string, add: (level: Level, text: string) => void): void {
  let service: WatchService;
  try {
    service = watchService(env, home);
  } catch (e) {
    if (!(e instanceof WatchUnsupported)) throw e;
    add('ok', `watcher: off (${e.message})`);
    return;
  }
  let content: string | null;
  try {
    content = readServiceFile(service);
  } catch (e) {
    add('warning', `watcher: cannot read ${service.file} (${(e as Error).message})`);
    return;
  }
  if (content === null) {
    if (isLoaded(manager.running(service))) add('problem', `watcher: loaded without ${service.file}; run \`noonsight watch disable\` to stop it`);
    else add('ok', 'watcher: off; `noonsight watch enable` installs into each new Claude Code configuration directory as it appears');
    return;
  }
  if (!isOurs(content)) {
    add('warning', `watcher: ${service.file} is in noonsight's place but was not written by noonsight`);
    return;
  }
  const running = manager.running(service);
  if (running === 'off') add('problem', `watcher: on in ${service.file}, but not running; run \`noonsight watch enable\` again`);
  else if (running === 'loaded') add('warning', `watcher: on in ${service.file}, but loaded without a running process; run \`noonsight watch enable\` again`);
  else add('ok', `watcher: on (${service.file})${running === null ? '; whether it runs now could not be checked' : ''}`);
  if (content !== serviceContent(service, { node: process.execPath, cli }))
    add('warning', `watcher: ${service.file} runs another copy of noonsight or another Node.js; run \`noonsight watch enable\` again to switch to this one`);
  const last = lastLine(service.log);
  if (last !== null) add(/ (problem|noonsight): /.test(last) ? 'warning' : 'ok', `watcher log ${service.log}: ${last}`);
}

/** The last line of a small log file, or null when there is none. */
function lastLine(file: string): string | null {
  try {
    const fd = fs.openSync(file, 'r');
    try {
      const size = fs.fstatSync(fd).size;
      const length = Math.min(size, 16 * 1024);
      const buffer = Buffer.alloc(length);
      fs.readSync(fd, buffer, 0, length, size - length);
      return buffer.toString('utf8').trimEnd().split('\n').pop() || null;
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return null;
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
  const aliases = MODEL_ALIASES.reduce((v, a) => ((compareVersions(a.since, v) ?? 0) > 0 ? a.since : v), '0.0.0');
  if ((compareVersions(found, aliases) ?? 0) < 0)
    add(
      'warning',
      `claude: installed ${found}; when a session without a reported model, such as \`claude -p\`, names it by an alias, ` +
        `noonsight assumes what the aliases select from Claude Code ${aliases} on (upgrade: claude update)`,
    );
}

/** An entry as check lists it: its event, with the tools it matches. */
function describeHandler(spec: HookHandlerSpec): string {
  const matcher = matcherOf(spec);
  return matcher === undefined ? spec.event : `${spec.event} on ${matcher}`;
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
    return findNoonsightHandlers(readSettings(file)).length > 0;
  } catch {
    return false;
  }
}
