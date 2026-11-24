// noonsight check: the configuration, every install this account can see, the plugin included, the watcher, the Claude
// Code version and the last decision, one line each. It reads local files, runs `claude --version`,
// and, when the watcher is on, asks the service manager whether it runs; it never uses the network
// and never changes anything.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CLAUDE_CODE_FLOORS, MODEL_ALIASES } from '../adapters/claude-code/compat.js';
import { readSettings } from '../adapters/claude-code/install.js';
import { accountTarget, discoverConfigDirs, managedTarget } from '../adapters/claude-code/locations.js';
import { managedFilesApply, readManagedFiles, readRemoteSettings } from '../adapters/claude-code/managed.js';
import { noonsightPlugins } from '../adapters/claude-code/plugins.js';
import { readPointer } from '../adapters/claude-code/pointer.js';
import { findNoonsightHandlers, handlersFor, HOOK_HANDLERS, matcherOf } from '../adapters/claude-code/settings.js';
import { ConfigError, loadConfigDetails } from '../config/load.js';
import { changesDelivery, comparePresets, describeChanges } from '../config/preset-changes.js';
import { scopeOverlaps } from '../core/overlap.js';
import { SCOPE_ENV, sessionPlace, sessionScope } from '../core/scope.js';
import { ROUTING_ENV, routingEnvOff } from '../core/route.js';
import { TRIGGER_ACTIONS } from '../core/triggers.js';
import { ROUTE_TARGETS, RULES_TEXT_LIMIT, TRIGGERS } from '../core/types.js';
import { CLI_FILE, configPath, stateDir } from '../config/paths.js';
import { describeProject, projectFor } from '../config/project.js';
import { accountInstalls } from '../state/installs.js';
import { isLoaded, isOurs, manager, readServiceFile, serviceContent, watchService, WatchUnsupported } from '../watch/service.js';
import { lastDecision } from '../state/log.js';
import { compareVersions, packageVersion } from '../version.js';
import { changeLines, receivesLines } from './receives.js';
import { UsageError } from './usage.js';
export const CHECK_USAGE = `usage: noonsight check

Check the configuration, the installed hooks, the watcher and the Claude Code version, and show
the last decision. A project configuration found from the current directory is checked as a
session started here would read it. Each line starts with ok, warning or problem. Exits 0 when there is no problem, 1 when there is one,
and 2 when the configuration is missing or refused.`;
export function runCheck(args, env, out, options = {}) {
    if (args.length)
        throw new UsageError(`unexpected argument "${args[0]}"`, CHECK_USAGE);
    const home = os.homedir();
    const lines = [];
    const add = (level, text) => {
        lines.push([level, text]);
    };
    const version = packageVersion();
    const cli = fs.realpathSync(CLI_FILE);
    // Configuration.
    const file = configPath(env, home);
    let configOk = false;
    try {
        // As a session started here would: with the project found from this directory over the configuration.
        const details = loadConfigDetails(file, { project: projectFor(env.CLAUDE_PROJECT_DIR || process.cwd(), file, stateDir(home)) }, env);
        const config = details.config;
        configOk = true;
        const sub = config.subagents;
        add('ok', `config ${file}: valid (${config.exact.size + config.wildcards.length} model entries; subagents: ` +
            (sub.delivery === 'off' ? 'off' : `rules when each subagent starts, permission ${sub.permission} for a routed call, on mismatch ${sub.onMismatch}`) +
            ')');
        checkProject(details, add);
        checkPreset(details, env, add);
        checkAllModels(config, add);
        if (options.receives !== false)
            checkReceives(details, add);
        checkScopes(config, env, add);
        checkTriggers(config, add);
        checkRouting(config, env, add);
        checkClassifier(config, add);
    }
    catch (e) {
        if (!(e instanceof ConfigError))
            throw e;
        add('problem', `config ${e.message.replace(/^configuration refused \(([^)]*)\):/, '$1: refused, so sessions get no rules:')}`);
    }
    // Installs: the machine-wide one, then every Claude Code configuration directory of this account.
    let installs = 0;
    let managed = null;
    try {
        managed = managedTarget(env);
    }
    catch (e) {
        add('warning', `machine-wide install: ${e.message}`);
    }
    const managedInstalled = managed !== null && checkInstall(managed, version, cli, add, false);
    if (managed) {
        if (managedInstalled)
            installs++;
        checkManagedPolicy(managed, env, add, managedInstalled);
    }
    const recorded = accountInstalls(stateDir(home));
    const dirs = discoverConfigDirs(env, home, recorded);
    const uncovered = [];
    for (const dir of dirs) {
        const target = accountTarget(dir, home);
        const remote = readRemoteSettings(dir);
        const managedReaches = managedInstalled && managedFilesApply(remote);
        const hasAccountHooks = hasHooks(target.settingsFile);
        const plugins = noonsightPlugins({ projectDir: env.CLAUDE_PROJECT_DIR || process.cwd(), configDir: dir, env });
        const pluginRuns = checkPlugins(dir, plugins, target.settingsFile, add);
        if (pluginRuns !== null)
            installs++;
        // With the plugin there, a recorded install whose hooks are gone was replaced by it.
        if (hasAccountHooks || (recorded.includes(dir) && pluginRuns === null)) {
            if (checkInstall(target, version, cli, add, true))
                installs++;
            if (hasAccountHooks && managedReaches)
                add('warning', `account install ${dir}: the machine-wide install reaches this login too; each event is delivered once, by whichever copy runs first, so one of the two is enough: remove one with \`noonsight uninstall\``);
        }
        else if (pluginRuns === null && managedReaches)
            add('ok', `Claude Code configuration ${dir}: reached by the machine-wide install`);
        else if (pluginRuns === null)
            uncovered.push(dir);
        if (pluginRuns !== null && (hasAccountHooks || managedReaches))
            checkBoth(dir, pluginRuns, hasAccountHooks ? target : managed, add);
        checkRemotePolicy(dir, remote, hasAccountHooks || pluginRuns !== null, managedInstalled, add);
    }
    if (installs === 0)
        add('problem', 'noonsight is not installed: run `noonsight install`, or install the Claude Code plugin');
    else
        for (const dir of uncovered)
            add('problem', `Claude Code configuration ${dir}: no noonsight hooks reach it` +
                (managedInstalled ? ' (its login receives server-managed settings, so Claude Code ignores the machine-wide install there)' : '') +
                '; run `noonsight install`');
    // The watcher.
    checkWatcher(env, home, cli, add);
    // Claude Code.
    checkClaude(env, add);
    // The decision log.
    const last = lastDecision(stateDir(home));
    if (last)
        add('ok', `last decision: ${String(last.ts)} ${String(last.event)} ${String(last.status ?? last.result)}` +
            `${last.model ? ` ${String(last.model)}` : ''} (${String(last.delivered)}), log in ${stateDir(home)}`);
    else
        add('ok', `no decisions logged yet in ${stateDir(home)}`);
    out(lines.map(([level, text]) => `${level}: ${text}`).join('\n'));
    if (!configOk)
        return 2;
    return lines.some(([level]) => level === 'problem') ? 1 : 0;
}
/** The project configuration found from this directory: what became of it, and its entries that do not apply here. */
function checkProject(details, add) {
    const layer = details.project;
    if (layer === null)
        return;
    const level = layer.status === 'refused' ? 'problem' : layer.status === 'untrusted' ? 'warning' : 'ok';
    add(level, `project ${layer.file}: ${describeProject(layer)}`);
    for (const note of layer.notes)
        add('warning', `project ${layer.file}: ${note}`);
}
/**
 * The preset version the configuration accepted against the installed one, and, model by model, what
 * the installed version changes: rules turned on or off, renamed or changed, and enable, disable or
 * replaces entries that no longer name a rule.
 */
function checkPreset(details, env, add) {
    const v = details.presetVersions;
    let c;
    try {
        c = comparePresets(v, details.declared, {}, env);
    }
    catch (e) {
        if (!(e instanceof ConfigError))
            throw e;
        add('problem', `preset ${v.name}: the copy of ${String(v.accepted)} the package keeps was refused, so what changed since cannot be listed: ${e.problems.join('; ')}`);
        return;
    }
    // A configuration that declares no model with "use": "preset" takes only the preset's scopes and routing table.
    if (c === null || (c.accepted === null && ![...details.declared.values()].some((m) => m.use === 'preset')))
        return;
    const to = c.installed.version;
    const accept = `run \`noonsight accept\` to accept ${to}`;
    if (c.accepted === null)
        add('warning', `preset ${c.name} ${to}: the configuration records no "preset_version", so nothing can say what a preset update changes in the rules sessions receive; ` +
            `run \`noonsight accept\` to record ${to}`);
    else if (c.accepted === to)
        add('ok', `preset ${c.name} ${to}: the version the configuration accepted` + (v.onChange === 'hold' ? ', held ("on_preset_change": "hold")' : ''));
    else if (c.from === null)
        add('warning', `preset ${c.name}: the configuration accepted ${c.accepted}, but the package ships ${to} and keeps no copy of ${c.accepted}, so what changed cannot be listed; ` +
            `sessions receive the rules of ${to}. Review them with \`noonsight models\`, then ${accept}`);
    else if (c.held)
        add('warning', `preset ${c.name}: held at ${c.accepted} ("on_preset_change": "hold") while the package ships ${to}, so sessions keep the rules of ${c.accepted}; ` +
            (c.models.some(changesDelivery) ? `accepting ${to} would change them as listed below; ` : `${to} changes no rule a declared model receives; `) +
            accept);
    else
        add('warning', `preset ${c.name}: the package ships ${to}, and the configuration accepted ${c.accepted}, so sessions receive the rules of ${to}` +
            (c.models.some(changesDelivery) ? ', which changed as listed below' : ', which change no rule a declared model receives') +
            `; ${accept} once reviewed`);
    for (const m of c.models)
        add('warning', `preset ${c.name}, ${m.model}: ${describeChanges(m, c.held)}`);
}
/**
 * The "all_models" block: the models that receive its rules and the places they cover. The limit on
 * the text delivered was already checked per model when the configuration loaded, with these rules
 * in each model's rules, so a block that is too large for a model has refused the configuration.
 */
function checkAllModels(config, add) {
    if (config.allModels.length === 0)
        return;
    const receiving = [...config.exact].filter(([, entry]) => entry.use === 'rules').map(([model]) => model);
    add('ok', `all_models: ${plural(config.allModels.length, 'rule')} (${config.allModels.map((r) => r.id).join(', ')}) delivered to ${plural(receiving.length, 'model')} declared with preset or custom` +
        `${receiving.length ? ` (${receiving.join(', ')})` : ''}, each within the ${RULES_TEXT_LIMIT}-character limit on the rules delivered`);
    if (receiving.length === 0)
        add('warning', 'all_models: no model is declared with "use": "preset" or "use": "custom", so no model receives these rules');
}
/** What each declared model receives in each place with no scope, then how to change it. */
function checkReceives(details, add) {
    for (const line of receivesLines(details))
        add('ok', `receives with no scope, ${line}`);
    add('ok', `places and scopes: ${changeLines(details).join(' ')}`);
}
/**
 * The declared scopes: scopes a single task can fall in, matchers that could not be tested for that,
 * and the scope and place sessions started from this environment get.
 */
function checkScopes(config, env, add) {
    const report = scopeOverlaps(config);
    if (config.scopes.size > 0) {
        const untested = report.untested.map((u) => `scope "${u.scope}": ${JSON.stringify(u.matcher)}`);
        add('ok', `scopes: ${plural(config.scopes.size, 'scope')} declared, ${plural(report.matchers, 'matcher')}` +
            (report.overlaps.length === 0 && untested.length === 0 && report.matchers > 0 ? '; no two scopes overlap' : '') +
            (untested.length ? `; not all example texts could be built for ${untested.join(', ')}, so their overlaps are not fully checked` : ''));
    }
    for (const o of report.overlaps)
        add('warning', `scopes "${o.scopes[0]}" and "${o.scopes[1]}" overlap: the task text ${JSON.stringify(o.text)} matches both` +
            (o.winner !== null ? `, and a task with only that text gets "${o.winner}"` : '') +
            '; the scope whose matcher matches earliest in a task wins, and at the same place the one declared first');
    const scope = sessionScope(env).scope;
    const place = sessionPlace(config, env);
    if (scope !== null && !config.scopes.has(scope))
        add('warning', `${SCOPE_ENV} is "${scope}" here, which is not a declared scope, so sessions started from this environment get only the rules for every scope`);
    else if (scope !== null || place.because !== undefined)
        add('ok', 'sessions started from this environment get ' +
            (scope !== null ? `scope "${scope}" (${SCOPE_ENV})` : 'no scope') +
            `, place "${place.place}"` +
            (place.because === 'env' ? ` (${place.env} is set)` : place.because === 'headless' ? ' (a headless run)' : ''));
}
/** The triggers the hooks act on, and the rules that list each one. */
function checkTriggers(config, add) {
    const listing = (trigger) => [...config.exact].flatMap(([model, entry]) => (entry.use === 'rules' ? entry.rules.filter((r) => r.triggers.includes(trigger)).map((r) => `${r.id} for ${model}`) : []));
    for (const t of TRIGGERS) {
        const rules = listing(t);
        add('ok', `triggers: ${t}` + (rules.length ? `, which delivers ${rules.join(', ')} to ${TRIGGER_ACTIONS[t]}` : ', which no rule lists'));
    }
}
/** Whether routing is on, where it acts, its table, and whether sessions started from this environment are routed. */
function checkRouting(config, env, add) {
    const r = config.routing;
    if (!r.enabled) {
        add('ok', 'routing: off, so noonsight never changes a model or an effort');
        return;
    }
    const rows = [...r.table.entries()].map(([scope, row]) => `${scope} ${describeRow(row)}`);
    add('ok', `routing: on for ${r.targets.join(' and ')}` +
        (r.respectExplicit ? ', a model the caller chose wins' : ', the table wins over a model the caller chose') +
        (r.yieldWhenEnv.length ? `, yields when ${r.yieldWhenEnv.join(' or ')} is set` : '') +
        `; table: ${rows.length ? rows.join('; ') : 'empty'}; default: ${r.default === null ? 'inherit' : describeRow(r.default)}`);
    if (routingEnvOff(env))
        add('ok', `${ROUTING_ENV} turns routing off for sessions started from this environment`);
    else {
        const yieldEnv = r.yieldWhenEnv.find((name) => (env[name] ?? '') !== '');
        if (yieldEnv !== undefined)
            add('ok', `routing yields for sessions started from this environment (${yieldEnv} is set)`);
    }
}
/** Whether the classifier is on, for which tasks, and what one classification may cost in time. */
function checkClassifier(config, add) {
    const c = config.classifier;
    if (c.mode === 'off') {
        add('ok', 'classifier: off, so a task without an explicit scope takes its scope from the matchers alone');
        return;
    }
    const which = c.mode === 'fallback' ? 'for a task no explicit scope and no matcher placed' : 'for every task without an explicit scope, over the matchers';
    add('ok', `classifier: ${c.mode}, ${which}; ${c.model} at ${c.effort} effort, at most ${c.timeoutMs} ms per task`);
}
function describeRow(row) {
    const list = (options) => options === undefined ? 'default' : options.length === 0 ? 'none' : options.map((o) => (o.effort ? `${o.model} ${o.effort}` : o.model)).join(', ');
    const [launcher, subagents] = ROUTE_TARGETS.map((t) => list(row[t]));
    return launcher === subagents ? `[${launcher}]` : `[launcher: ${launcher}; subagents: ${subagents}]`;
}
function plural(n, word) {
    return `${n} ${word}${n === 1 ? '' : 's'}`;
}
/** Report one install; returns whether its hook entries are there. */
function checkInstall(target, version, cli, add, expected) {
    const label = target.kind === 'managed' ? 'machine-wide install' : `account install ${target.configDir}`;
    const again = target.kind === 'managed' ? '`noonsight install --managed` again, as an administrator,' : '`noonsight install` again';
    let settings;
    try {
        settings = readSettings(target.settingsFile);
    }
    catch (e) {
        add('problem', `${label}: ${e.message}`);
        return false;
    }
    const found = findNoonsightHandlers(settings);
    if (found.length === 0) {
        if (expected)
            add('problem', `${label}: no noonsight hooks in ${target.settingsFile}; run \`noonsight install --account ${target.configDir}\``);
        else
            add('ok', `${label}: not installed (${target.settingsFile})`);
        return false;
    }
    const missing = HOOK_HANDLERS.filter((spec) => handlersFor(found, spec, target.pointer).length === 0);
    if (missing.length || found.length !== HOOK_HANDLERS.length)
        add('problem', `${label}: the hooks in ${target.settingsFile} are incomplete or point elsewhere` +
            (missing.length ? ` (missing: ${missing.map(describeHandler).join(', ')})` : '') +
            `; run ${again} to repair them`);
    else
        add('ok', `${label}: hooks in ${target.settingsFile} (${HOOK_HANDLERS.map(describeHandler).join(', ')})`);
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
        add('problem', `${label}: this account cannot run ${denied.join(' and ')}, so its hooks do nothing; ` +
            'install noonsight from a Node.js and a copy of noonsight that every account can read and run');
        return true;
    }
    const running = pointer.cli === cli ? version : versionOf(pointer.node, pointer.cli);
    if (running === null)
        add('problem', `${label}: the copy of noonsight the hook pointer runs (${pointer.cli}) did not report its version`);
    else if (running !== version)
        add('warning', `${label}: hooks run noonsight ${running} (${pointer.cli}), but this copy is ${version}; run ${again} to switch`);
    else
        add('ok', `${label}: hook pointer ${target.pointer} runs noonsight ${running}`);
    return true;
}
/** Report noonsight's plugin in one login; returns the one whose hooks run there, or null. */
function checkPlugins(dir, plugins, settingsFile, add) {
    let runs = null;
    for (const p of plugins) {
        const label = `plugin ${p.id} in ${dir}`;
        if (!p.enabled)
            add('ok', `${label}: installed and turned off; \`claude plugin enable ${p.id}\` turns it on`);
        else if (p.dir === null)
            add('problem', `${label}: turned on in the settings and not installed, so it delivers nothing; run \`claude plugin install ${p.id}\``);
        else if (p.version === null)
            add('problem', `${label}: its folder ${p.dir} holds no noonsight that can run, so it delivers nothing; run \`claude plugin install ${p.id}\` again`);
        else {
            add('ok', `${label}: runs noonsight ${p.version} (${p.dir})` + (p.scope === 'project' || p.scope === 'local' ? `, in this project only (${p.scope} scope)` : ''));
            runs ??= p;
        }
    }
    if (runs !== null) {
        let settings = null;
        try {
            settings = readSettings(settingsFile);
        }
        catch {
            // Reported with the login's other findings, or by Claude Code itself.
        }
        if (settings?.disableAllHooks === true)
            add('problem', `plugin ${runs.id} in ${dir}: ${settingsFile} sets disableAllHooks, so Claude Code runs none of its hooks`);
    }
    return runs;
}
/** A login the plugin and an install of the hooks both reach: safe, but the copy that runs first decides the version. */
function checkBoth(dir, plugin, target, add) {
    const pointer = target === null ? null : readPointer(target.pointer);
    const other = pointer === null ? null : versionOf(pointer.node, pointer.cli);
    const label = target?.kind === 'managed' ? 'the machine-wide install' : 'the account install';
    add('warning', `Claude Code configuration ${dir}: both the plugin ${plugin.id} and ${label} reach this login; each event is delivered once, by whichever copy runs first` +
        (other !== null && plugin.version !== null && other !== plugin.version ? `, and they run different versions (the plugin ${plugin.version}, ${label} ${other})` : '') +
        `. One is enough: remove the plugin with \`claude plugin uninstall ${plugin.id}\`, or the hooks with \`noonsight uninstall${target?.kind === 'managed' ? ' --managed' : ` --account ${dir}`}\``);
}
/**
 * Machine-wide settings that decide whether the installed hooks run at all. Claude Code merges the
 * managed settings file and every drop-in file in alphabetical order; a later value wins.
 */
function checkManagedPolicy(managed, env, add, installed) {
    const { merged: policy, problems } = readManagedFiles(managed.managedDir ?? '');
    for (const p of problems)
        add('problem', `managed settings ${p.file} cannot be read as a JSON object (${p.message}); Claude Code refuses to start while it is so`);
    if (policy.disableAllHooks === true)
        add('problem', 'managed settings set disableAllHooks: Claude Code runs no hooks at all, noonsight included');
    if (policy.allowManagedHooksOnly === true)
        add('warning', 'managed settings set allowManagedHooksOnly: only the machine-wide install runs; account installs are ignored, and so is the plugin unless managed settings enable it');
    // An MDM profile ranks above managed settings files, and Claude Code then ignores the files by default.
    if (installed && process.platform === 'darwin') {
        const root = env.NOONSIGHT_SYSTEM_ROOT ? path.resolve(env.NOONSIGHT_SYSTEM_ROOT) : '/';
        const profile = path.join(root, 'Library', 'Managed Preferences', 'com.anthropic.claudecode.plist');
        if (fs.existsSync(profile))
            add('warning', `an MDM profile for Claude Code is present (${profile}); unless it sets managedSourcesBehavior to "merge", ` +
                'Claude Code ignores the managed settings files and the machine-wide hooks do not run. Use `noonsight install` (without --managed) instead.');
    }
}
/**
 * Server-managed settings, which Claude Code caches per login in its configuration directory. They
 * outrank the managed settings files, and can turn hooks off for that login.
 */
function checkRemotePolicy(dir, remote, accountHooks, managedInstalled, add) {
    if (!remote?.deliversPolicy)
        return;
    const label = `Claude Code configuration ${dir}`;
    if (remote.settings.disableAllHooks === true)
        add('problem', `${label}: the server-managed settings of this login (${remote.file}) set disableAllHooks, so Claude Code runs no hooks there`);
    else if (remote.settings.allowManagedHooksOnly === true && !(remote.merges && managedInstalled))
        add('problem', `${label}: the server-managed settings of this login (${remote.file}) set allowManagedHooksOnly, ` +
            'so Claude Code runs only the hooks the organization delivers, and no noonsight install reaches it');
    else if (accountHooks && !remote.merges)
        add('ok', `${label}: this login receives server-managed settings, which shadow the managed settings files; the account install reaches it`);
}
/** Whether the opt-in watcher is on, whether it runs, and what it last logged. */
function checkWatcher(env, home, cli, add) {
    let service;
    try {
        service = watchService(env, home);
    }
    catch (e) {
        if (!(e instanceof WatchUnsupported))
            throw e;
        add('ok', `watcher: off (${e.message})`);
        return;
    }
    let content;
    try {
        content = readServiceFile(service);
    }
    catch (e) {
        add('warning', `watcher: cannot read ${service.file} (${e.message})`);
        return;
    }
    if (content === null) {
        if (isLoaded(manager.running(service)))
            add('problem', `watcher: loaded without ${service.file}; run \`noonsight watch disable\` to stop it`);
        else
            add('ok', 'watcher: off; `noonsight watch enable` installs into each new Claude Code configuration directory as it appears');
        return;
    }
    if (!isOurs(content)) {
        add('warning', `watcher: ${service.file} is in noonsight's place but was not written by noonsight`);
        return;
    }
    const running = manager.running(service);
    if (running === 'off')
        add('problem', `watcher: on in ${service.file}, but not running; run \`noonsight watch enable\` again`);
    else if (running === 'loaded')
        add('warning', `watcher: on in ${service.file}, but loaded without a running process; run \`noonsight watch enable\` again`);
    else
        add('ok', `watcher: on (${service.file})${running === null ? '; whether it runs now could not be checked' : ''}`);
    if (content !== serviceContent(service, { node: process.execPath, cli }))
        add('warning', `watcher: ${service.file} runs another copy of noonsight or another Node.js; run \`noonsight watch enable\` again to switch to this one`);
    const last = lastLine(service.log);
    if (last !== null)
        add(/ (problem|noonsight): /.test(last) ? 'warning' : 'ok', `watcher log ${service.log}: ${last}`);
}
/** The last line of a small log file, or null when there is none. */
function lastLine(file) {
    try {
        const fd = fs.openSync(file, 'r');
        try {
            const size = fs.fstatSync(fd).size;
            const length = Math.min(size, 16 * 1024);
            const buffer = Buffer.alloc(length);
            fs.readSync(fd, buffer, 0, length, size - length);
            return buffer.toString('utf8').trimEnd().split('\n').pop() || null;
        }
        finally {
            fs.closeSync(fd);
        }
    }
    catch {
        return null;
    }
}
function checkClaude(env, add) {
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
        for (const f of short)
            add('problem', `claude: installed ${found}; ${f.feature} needs ${f.version} or later (upgrade: claude update)`);
    else
        add('ok', `claude: ${found}`);
    const aliases = MODEL_ALIASES.reduce((v, a) => ((compareVersions(a.since, v) ?? 0) > 0 ? a.since : v), '0.0.0');
    if ((compareVersions(found, aliases) ?? 0) < 0)
        add('warning', `claude: installed ${found}; when a session without a reported model, such as \`claude -p\`, names it by an alias, ` +
            `noonsight assumes what the aliases select from Claude Code ${aliases} on (upgrade: claude update)`);
}
/** An entry as check lists it: its event, with the tools it matches. */
function describeHandler(spec) {
    const matcher = matcherOf(spec);
    return matcher === undefined ? spec.event : `${spec.event} on ${matcher}`;
}
/** Why this account cannot use a file in the given mode, as an error code, or null when it can. */
function reach(file, mode) {
    try {
        fs.accessSync(file, mode);
        return null;
    }
    catch (e) {
        return e.code ?? 'EACCES';
    }
}
function versionOf(node, cli) {
    const r = spawnSync(node, [cli, '--version'], { encoding: 'utf8', timeout: 10000 });
    const v = r.status === 0 ? r.stdout.trim() : '';
    return /^\d+\.\d+\.\d+$/.test(v) ? v : null;
}
function hasHooks(file) {
    try {
        return findNoonsightHandlers(readSettings(file)).length > 0;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=check.js.map