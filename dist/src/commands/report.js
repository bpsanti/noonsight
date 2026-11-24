// noonsight report: what the decision log says the hooks and the launcher did. For each rule, how
// often it was delivered, and to which models, scopes, places and events, and whether its scope or a
// trigger brought it; the triggers sessions revealed, and with which edits; the rules the
// configuration has on that the log never shows delivered; the decisions that delivered nothing, by
// why; and what the classifier did, how long it took and what it cost. The configuration is read as
// a session started in the current directory reads it, with that directory's project laid over it.
// It reads local files only and changes nothing.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ConfigError, loadConfigDetails } from '../config/load.js';
import { configPath, stateDir } from '../config/paths.js';
import { describeProject, projectFor } from '../config/project.js';
import { ANY_SCOPE, placeName } from '../core/types.js';
import { LOG_FILE, readDecisionFile, readDecisions, ROTATED_LOG_FILE } from '../state/log.js';
import { UsageError } from './usage.js';
export const REPORT_USAGE = `usage: noonsight report [--json] [--log <file>]

Report what the decision log records: for each rule, how often it was delivered and to which
models, scopes, places and events, whether its scope or a trigger brought it, and the length of its
text; the triggers sessions revealed, by the edits that revealed them; the rules the configuration
has on that the log never shows delivered; the decisions that delivered nothing, by why; and the
classifier's results, time and cost. Rule lengths and the rules never delivered come from the
configuration as a session started in the current directory reads it, with the project
configuration found from there laid over it; the log counts the sessions of every project.

  --log <file>  read this log file instead of the account's decision log
  --json        print the same as JSON

Exits 0, or 2 for a usage error.`;
/** How a tally names a field the log line does not carry, such as the place on lines older than places. */
export const NOT_RECORDED = '(not recorded)';
/** How a tally names a task with no scope. */
export const NO_SCOPE = '(none)';
/** How the tally of what brought a rule names a delivery by the rule's scopes, as opposed to a trigger. */
export const BY_SCOPE = 'scope';
/** How many files a trigger's text lists, most frequent first. */
const FILES_SHOWN = 10;
/** The values of `delivered` that mean the rules reached the model: by the hook, or in the system prompt. */
export const DELIVERING = ['rules', 'rules+note', 'system-prompt'];
/**
 * Why a /model line's rules are not counted as delivered when the same session's next line is another
 * /model line: Claude Code adds what the hook returns to the next request only, and loses it when
 * another switch comes first. The log records no requests, so a switch followed at once by another
 * may never have reached the model.
 */
export const SWITCHED_AGAIN = 'switched-again';
export function runReport(args, env, out) {
    const options = parseArgs(args);
    // As `noonsight check` and `noonsight models` do: the project a session started here would get.
    const report = buildReport(env, { ...options, project: env.CLAUDE_PROJECT_DIR || process.cwd() });
    out(options.json ? JSON.stringify(report, null, 2) : renderReport(report));
    return 0;
}
function parseArgs(args) {
    let json = false;
    let log = null;
    for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '--json')
            json = true;
        else if (a === '--log') {
            const value = args[++i];
            if (value === undefined || value === '')
                throw new UsageError(`${a} needs a value`, REPORT_USAGE);
            log = value;
        }
        else
            throw new UsageError(a.startsWith('-') ? `unknown option ${a}` : `unexpected argument "${a}"`, REPORT_USAGE);
    }
    return { json, log };
}
export function buildReport(env, options, home = os.homedir()) {
    const dir = stateDir(home);
    const files = options.log !== null ? [path.resolve(options.log)] : [path.join(dir, ROTATED_LOG_FILE), path.join(dir, LOG_FILE)];
    if (options.log !== null && !readableFile(files[0]))
        throw new UsageError(`cannot read the log file ${options.log}`, REPORT_USAGE);
    const records = options.log !== null ? readDecisionFile(files[0]) : readDecisions(dir);
    const superseded = switchedAgain(records);
    const delivering = {};
    const notDelivering = {};
    const agentResults = {};
    const classifierResults = {};
    const classifierMs = [];
    let classifierCost = 0;
    const rules = new Map();
    const triggers = new Map();
    let first = null;
    let last = null;
    for (const [index, r] of records.entries()) {
        const ts = typeof r.ts === 'string' ? r.ts : null;
        if (ts !== null) {
            if (first === null || ts < first)
                first = ts;
            if (last === null || ts > last)
                last = ts;
        }
        const event = text(r.event) ?? NOT_RECORDED;
        const outcome = text(r.classifier);
        if (outcome !== null) {
            count(classifierResults, outcome);
            if (typeof r.classifier_ms === 'number' && Number.isFinite(r.classifier_ms))
                classifierMs.push(r.classifier_ms);
            if (typeof r.classifier_cost_usd === 'number' && Number.isFinite(r.classifier_cost_usd))
                classifierCost += r.classifier_cost_usd;
        }
        if (event === 'agent-result') {
            count(agentResults, text(r.result) ?? NOT_RECORDED);
            continue;
        }
        const revealed = event === 'file-edit' ? text(r.trigger) : null;
        if (revealed !== null) {
            const t = triggers.get(revealed) ?? { revealed: 0, delivered: 0, tools: {}, extensions: {}, files: {} };
            triggers.set(revealed, t);
            t.revealed++;
            if (DELIVERING.includes(r.delivered))
                t.delivered++;
            count(t.tools, text(r.tool_name) ?? NOT_RECORDED);
            const file = text(r.file);
            count(t.extensions, file === null ? NOT_RECORDED : path.extname(file).toLowerCase() || '(none)');
            count(t.files, file ?? NOT_RECORDED);
        }
        // A subagent's rules are counted once: delivered at its start, or not delivered at its call.
        if (event === 'agent-call' && r.delivered === 'at-start')
            continue;
        const ids = Array.isArray(r.rules) ? r.rules.filter((x) => typeof x === 'string') : [];
        const delivers = DELIVERING.includes(r.delivered) && ids.length > 0;
        if (!delivers || superseded.has(index)) {
            if (delivers)
                count(notDelivering, SWITCHED_AGAIN);
            else if (event !== 'subagent-start')
                count(notDelivering, whyNothing(r));
            // Rules the call had that a start shared between several calls could not give.
            else if (text(r.reason) === 'calls-differ')
                count(notDelivering, 'calls-differ');
            continue;
        }
        count(delivering, event);
        const triggered = Array.isArray(r.triggered_rules) ? r.triggered_rules.filter((x) => typeof x === 'string') : [];
        const lineTriggers = Array.isArray(r.triggers) ? r.triggers.filter((x) => typeof x === 'string') : [];
        // A file-edit line names its trigger; a session start or a switch after one names the session's triggers.
        const by = text(r.trigger) ?? (lineTriggers.join(', ') || NOT_RECORDED);
        for (const id of ids) {
            const rule = rules.get(id) ?? newRule(id);
            rules.set(id, rule);
            rule.deliveries++;
            const session = text(r.session_id);
            if (session !== null)
                rule.sessions.add(session);
            if (ts !== null) {
                if (rule.first === null || ts < rule.first)
                    rule.first = ts;
                if (rule.last === null || ts > rule.last)
                    rule.last = ts;
            }
            count(rule.models, text(r.model) ?? NOT_RECORDED);
            // Lines older than scopes carry no scope field; a null scope is a task with no scope.
            count(rule.scopes, 'scope' in r ? (text(r.scope) ?? NO_SCOPE) : NOT_RECORDED);
            // Lines written before "attended" was the place's name say "session"; both count as "attended".
            const place = text(r.place);
            count(rule.places, place === null ? NOT_RECORDED : (placeName(place) ?? place));
            count(rule.events, event);
            count(rule.brought_by, triggered.includes(id) ? by : BY_SCOPE);
        }
    }
    const file = configPath(env, home);
    let config = null;
    let layer = null;
    let status = fs.existsSync(file) ? 'read' : 'missing';
    if (status === 'read')
        try {
            ({ config, project: layer } = loadConfigDetails(file, { project: projectFor(options.project, file, dir) }, env));
        }
        catch (e) {
            if (!(e instanceof ConfigError))
                throw e;
            status = 'refused';
        }
    const lengths = config ? ruleLengths(config) : new Map();
    const listed = [...rules.values()]
        .sort((a, b) => b.deliveries - a.deliveries || (a.id < b.id ? -1 : 1))
        .map((r) => {
        const characters = lengths.get(r.id);
        const shown = characters ? Object.fromEntries([...characters].filter(([model]) => model in r.models)) : {};
        return {
            id: r.id,
            deliveries: r.deliveries,
            sessions: r.sessions.size,
            first: r.first,
            last: r.last,
            models: sorted(r.models),
            scopes: sorted(r.scopes),
            places: sorted(r.places),
            events: sorted(r.events),
            brought_by: sorted(r.brought_by),
            ...(Object.keys(shown).length ? { characters: shown } : {}),
        };
    });
    const neverDelivered = [];
    if (config)
        for (const [model, entry] of config.exact) {
            if (entry.use !== 'rules')
                continue;
            for (const rule of entry.rules)
                if (!((rules.get(rule.id)?.models[model] ?? 0) > 0))
                    neverDelivered.push({ id: rule.id, model, scopes: rule.scopes, where: rule.where });
        }
    return {
        log: files,
        decisions: records.length,
        first,
        last,
        delivering: sorted(delivering),
        not_delivering: sorted(notDelivering),
        agent_results: sorted(agentResults),
        rules: listed,
        triggers: Object.fromEntries([...triggers]
            .sort(([a], [b]) => (a < b ? -1 : 1))
            .map(([name, t]) => [name, { revealed: t.revealed, delivered: t.delivered, tools: sorted(t.tools), extensions: sorted(t.extensions), files: sorted(t.files) }])),
        config: { file, status },
        project: layer && { file: layer.file, dir: layer.dir, allow: layer.allow, status: layer.status, summary: describeProject(layer) },
        never_delivered: neverDelivered,
        classifier: total(classifierResults) === 0
            ? null
            : {
                results: sorted(classifierResults),
                runs: classifierMs.length,
                median_ms: median(classifierMs),
                max_ms: classifierMs.length ? Math.max(...classifierMs) : null,
                cost_usd: Math.round(classifierCost * 1e6) / 1e6,
            },
    };
}
/** The positions of the model-switch lines whose session's next line is another model-switch line. */
function switchedAgain(records) {
    const superseded = new Set();
    const previous = new Map();
    for (const [index, r] of records.entries()) {
        const session = text(r.session_id);
        if (session === null)
            continue;
        const before = previous.get(session);
        if (before !== undefined && r.event === 'model-switch' && records[before]?.event === 'model-switch')
            superseded.add(before);
        previous.set(session, index);
    }
    return superseded;
}
/** The middle value, or the mean of the two middle values; null for none. */
function median(values) {
    if (values.length === 0)
        return null;
    const s = [...values].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
function newRule(id) {
    return { id, deliveries: 0, sessions: new Set(), first: null, last: null, models: {}, scopes: {}, places: {}, events: {}, brought_by: {} };
}
/**
 * Why a decision delivered no rules, in the log's own words: the reason of a "none" decision
 * (declared-none, no-rule-applies), the `delivered` value of a matched one (already-delivered,
 * launcher, off), or the status (undeclared, config-invalid, error).
 */
function whyNothing(r) {
    const status = text(r.status);
    if (status === 'none')
        return text(r.reason) ?? 'none';
    if (status === 'matched')
        return text(r.delivered) ?? NOT_RECORDED;
    return status ?? NOT_RECORDED;
}
/** Each rule's text length, per exact model. */
function ruleLengths(config) {
    const lengths = new Map();
    for (const [model, entry] of config.exact) {
        if (entry.use !== 'rules')
            continue;
        for (const rule of entry.rules) {
            const perModel = lengths.get(rule.id) ?? new Map();
            perModel.set(model, rule.text.length);
            lengths.set(rule.id, perModel);
        }
    }
    return lengths;
}
function readableFile(file) {
    try {
        fs.accessSync(file, fs.constants.R_OK);
        return fs.statSync(file).isFile();
    }
    catch {
        return false;
    }
}
function text(v) {
    return typeof v === 'string' && v !== '' ? v : null;
}
function count(tally, key) {
    tally[key] = (tally[key] ?? 0) + 1;
}
/** Most first, then by name. */
function sorted(tally) {
    return Object.fromEntries(Object.entries(tally).sort(([a, x], [b, y]) => y - x || (a < b ? -1 : 1)));
}
export function renderReport(r) {
    const lines = [];
    lines.push(`log ${r.log.join(', ')}`);
    if (r.project)
        lines.push(`project ${r.project.file}: ${r.project.summary}`);
    if (r.decisions === 0) {
        lines.push('No decisions in the log.');
    }
    else {
        lines.push(`${r.decisions} ${r.decisions === 1 ? 'decision' : 'decisions'}, from ${r.first ?? 'an unknown time'} to ${r.last ?? 'an unknown time'}`);
        lines.push(`  delivered rules: ${total(r.delivering)}${tallyText(r.delivering)}`);
        lines.push(`  delivered no rules: ${total(r.not_delivering)}${tallyText(r.not_delivering)}`);
        if (total(r.agent_results) > 0)
            lines.push(`  subagent checks: ${total(r.agent_results)}${tallyText(r.agent_results)}`);
    }
    if (r.rules.length) {
        lines.push('', 'Rules delivered, most often first:');
        for (const rule of r.rules) {
            lines.push(`  ${rule.id}: ${rule.deliveries} ${rule.deliveries === 1 ? 'delivery' : 'deliveries'}` +
                (rule.sessions ? ` in ${rule.sessions} ${rule.sessions === 1 ? 'session' : 'sessions'}` : '') +
                `, last ${rule.last ?? 'at an unknown time'}`);
            lines.push(`     models: ${pairs(rule.models)}`);
            lines.push(`     scopes: ${pairs(rule.scopes)}`);
            lines.push(`     places: ${pairs(rule.places)}`);
            lines.push(`     events: ${pairs(rule.events)}`);
            if (Object.keys(rule.brought_by).some((k) => k !== BY_SCOPE))
                lines.push(`     brought by: ${pairs(rule.brought_by)}`);
            if (rule.characters)
                lines.push(`     text: ${Object.entries(rule.characters).map(([model, n]) => `${n} characters for ${model}`).join(', ')}`);
        }
    }
    const triggerNames = Object.keys(r.triggers);
    if (triggerNames.length) {
        lines.push('', 'Triggers revealed:');
        for (const name of triggerNames) {
            const t = r.triggers[name];
            lines.push(`  ${name}: in ${t.revealed} ${t.revealed === 1 ? 'session' : 'sessions'}, ${t.delivered} with rules delivered`);
            lines.push(`     tools: ${pairs(t.tools)}`);
            lines.push(`     extensions: ${pairs(t.extensions)}`);
            const files = Object.entries(t.files);
            const more = files.length - FILES_SHOWN;
            lines.push(`     files: ${pairs(Object.fromEntries(files.slice(0, FILES_SHOWN)))}${more > 0 ? `, and ${more} more` : ''}`);
        }
    }
    if (r.classifier !== null) {
        const c = r.classifier;
        lines.push('', 'Classifier:');
        lines.push(`  tasks: ${total(c.results)} (${pairs(c.results)})`);
        lines.push(c.runs === 0
            ? '  runs: 0'
            : `  runs: ${c.runs}, median ${c.median_ms} ms, longest ${c.max_ms} ms, cost US$ ${c.cost_usd.toFixed(4)}`);
    }
    if (r.config.status === 'read') {
        // The log holds the sessions of every project; the configuration is the one of this directory.
        const configuration = r.project?.status === 'applied' ? `${r.config.file}, with the project ${r.project.file}` : r.config.file;
        if (r.never_delivered.length) {
            lines.push('', `On in the configuration (${configuration}), never delivered in this log:`);
            for (const idle of r.never_delivered)
                lines.push(`  ${idle.id} for ${idle.model} (scopes: ${idle.scopes.includes(ANY_SCOPE) ? 'every scope' : idle.scopes.join(', ')}; places: ${idle.where.join(', ')})`);
        }
        else if (r.rules.length)
            lines.push('', `Every rule on in the configuration (${configuration}) was delivered at least once in this log.`);
    }
    else
        lines.push('', r.config.status === 'missing'
            ? `No configuration at ${r.config.file}, so rule lengths and the rules never delivered are not shown.`
            : `The configuration at ${r.config.file} is refused (\`noonsight check\` lists why), so rule lengths and the rules never delivered are not shown.`);
    return lines.join('\n');
}
function total(t) {
    return Object.values(t).reduce((a, b) => a + b, 0);
}
function tallyText(t) {
    return total(t) ? ` (${pairs(t)})` : '';
}
function pairs(t) {
    return Object.entries(t)
        .map(([k, n]) => `${k} ${n}`)
        .join(', ');
}
//# sourceMappingURL=report.js.map