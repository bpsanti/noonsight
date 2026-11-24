// Reads the configuration, the preset and every rule file, checks all of it, and builds the value
// the core resolves against. A configuration with any problem is refused whole and no partial
// configuration is ever applied. Problems are reported in passes: schema problems first, then
// preset problems, then every remaining problem together.
import fs from 'node:fs';
import path from 'node:path';
import { backtrackingRisk } from '../core/backtracking.js';
import { NO_SCOPE_ANSWER } from '../core/classify.js';
import { normalizeModel } from '../core/normalize.js';
import { deliveryText, envelope, selectRules } from '../core/resolve.js';
import { ANY_SCOPE, DEFAULT_CLASSIFIER_SETTINGS, DEFAULT_ROUTING_SETTINGS, DEFAULT_SESSION_SETTINGS, DEFAULT_SUBAGENT_SETTINGS, DELIVERY_TEXT_LIMIT, MATCHER_FLAGS, ALL_PLACES, PLACE_ALIASES, PLACES, placeName, ROUTE_ALIASES, ROUTE_TARGETS, RULES_TEXT_LIMIT, SWITCH_NOTE_RESERVE, TRIGGERS, } from '../core/types.js';
import { assertSupported, validateSchema } from './json-schema.js';
import { presetsDir as defaultPresetsDir, SCHEMA_DIR } from './paths.js';
import { DEFAULT_PROJECT_ALLOW, mergeProject, projectRules } from './project.js';
export class ConfigError extends Error {
    file;
    problems;
    constructor(file, problems) {
        super(`configuration refused (${file}):\n${problems.map((p) => `  - ${p}`).join('\n')}`);
        this.file = file;
        this.problems = problems;
        this.name = 'ConfigError';
    }
}
/** The preset a configuration draws from when it names none. */
export const DEFAULT_PRESET = 'claude';
/** What a configuration does on a preset update when it names no policy. */
export const DEFAULT_PRESET_CHANGE_POLICY = 'warn';
/** Where a preset keeps the earlier versions the package still ships, inside its own directory. */
export const PRESET_VERSIONS_DIR = 'versions';
/** Read and check one installed preset on its own; a missing or failing preset throws a ConfigError. */
export function readPreset(name, options = {}, env = process.env) {
    const dir = options.presetsDir ?? defaultPresetsDir(env);
    const problems = [];
    const preset = loadPreset(name, path.join(dir, name), null, true, problems);
    if (preset === null || problems.length)
        throw new ConfigError(path.join(dir, name, 'preset.json'), problems);
    return preset;
}
/**
 * Read and check one version of a preset: the installed preset when it is that version, else the
 * copy of that version the package keeps. Returns null when the package ships neither; a copy that
 * fails its checks throws a ConfigError.
 */
export function readPresetVersion(name, version, options = {}, env = process.env) {
    const dir = options.presetsDir ?? defaultPresetsDir(env);
    const installed = readPreset(name, options, env);
    if (installed.version === version)
        return installed;
    const problems = [];
    const copy = loadPreset(name, versionDir(dir, name, version), version, false, problems);
    if (problems.length)
        throw new ConfigError(path.join(versionDir(dir, name, version), 'preset.json'), problems);
    return copy;
}
/** The directory of the copy of one earlier version of a preset. */
function versionDir(presetsDir, name, version) {
    return path.join(presetsDir, name, PRESET_VERSIONS_DIR, version);
}
export function loadConfig(file, options = {}, env = process.env) {
    return loadConfigDetails(file, options, env).config;
}
/**
 * As loadConfig, and also returns the preset and each model as the file declares it. With a project
 * file, the project is laid over the configuration when the configuration's "projects.allow" and this
 * account's trust let it; a project with any problem is left out, and the configuration applies alone.
 * Only a problem of the configuration itself throws.
 */
export function loadConfigDetails(file, options = {}, env = process.env) {
    const configFile = path.resolve(file);
    const problems = [];
    const raw = options.content !== undefined
        ? parseJson(options.content, problems)
        : readJson(configFile, problems, 'no configuration file here; create one, or point NOONSIGHT_CONFIG at one');
    if (raw !== undefined)
        problems.push(...validateSchema(schema('noonsight.schema.json'), raw));
    if (problems.length)
        throw new ConfigError(configFile, problems);
    const machine = raw;
    const project = options.project ?? null;
    // The machine's configuration alone: it must load whatever the project, and its preset names the
    // rules a project's entries may name by an id they had before a rename.
    const own = build(machine, configFile, options, env, null);
    if (project === null)
        return { ...own, project: null };
    const allow = machine.projects?.allow ?? DEFAULT_PROJECT_ALLOW;
    const alone = (status, why = [], read = null) => ({
        ...own,
        project: { dir: project.dir, file: project.file, allow, status, problems: why, notes: [], rules: [], raw: read },
    });
    if (allow === 'none')
        return alone('ignored');
    if (project.trusted === null)
        return alone('untrusted');
    if (project.trusted === false)
        return alone('declined');
    const unread = [];
    const read = readJson(project.file, unread, 'the project file is gone');
    if (read !== undefined)
        unread.push(...validateSchema(schema('noonsight-project.schema.json'), read));
    if (unread.length)
        return alone('refused', unread);
    const projectRaw = read;
    const renamed = new Map([...(own.preset?.models ?? [])].map(([model, rules]) => [model, new Map(rules.flatMap((r) => r.renamedFrom.map((old) => [old, r.id])))]));
    // Paths in the project file are relative to the file itself, as in the configuration.
    const merged = mergeProject(machine, projectRaw, allow, path.dirname(project.file), project.dir, (model, id) => renamed.get(model)?.get(id) ?? id);
    if (merged.problems.length)
        return alone('refused', merged.problems, projectRaw);
    try {
        // The merged configuration is checked against the configuration's schema too: a project entry
        // merged into the machine's can make a combination neither file has alone.
        const combined = validateSchema(schema('noonsight.schema.json'), merged.raw);
        if (combined.length)
            throw new ConfigError(project.file, combined);
        const built = build(merged.raw, configFile, options, env, merged.origins);
        return {
            ...built,
            project: { dir: project.dir, file: project.file, allow, status: 'applied', problems: [], notes: merged.notes, rules: projectRules(built.config), raw: projectRaw },
        };
    }
    catch (e) {
        if (!(e instanceof ConfigError))
            throw e;
        // A problem the configuration has alone throws from here; one the project brings leaves the project out.
        return alone('refused', e.problems, projectRaw);
    }
}
/** Check a configuration that matches its schema, and build what the core resolves against. */
function build(cfg, configFile, options, env, origins) {
    const problems = [];
    const report = (at, message) => {
        problems.push(`${at}: ${message}`);
    };
    const refuse = () => {
        throw new ConfigError(configFile, problems);
    };
    const origin = (u) => origins?.get(u);
    const models = cfg.models ?? {};
    // The preset: always read when present, required when named or when a model uses it.
    const presetName = cfg.preset ?? DEFAULT_PRESET;
    const presetNeeded = cfg.preset !== undefined || Object.values(models).some((m) => m.use === 'preset');
    const presetsRoot = options.presetsDir ?? defaultPresetsDir(env);
    const installed = loadPreset(presetName, path.join(presetsRoot, presetName), null, presetNeeded, problems);
    if (problems.length)
        refuse();
    // Under "hold", the rules, scopes and routing table come from the accepted version, as the package keeps it.
    const accepted = cfg.preset_version ?? null;
    const onChange = cfg.on_preset_change ?? DEFAULT_PRESET_CHANGE_POLICY;
    let preset = installed;
    if (onChange === 'hold') {
        if (accepted === null)
            report('/on_preset_change', `"hold" keeps the rules of the preset version in "preset_version", and the configuration records none; ` +
                `run \`noonsight accept\` to record ${installed ? `${installed.version}, the installed version` : 'the installed version'}`);
        else if (installed !== null && installed.version !== accepted) {
            preset = loadPreset(presetName, versionDir(presetsRoot, presetName, accepted), accepted, false, problems);
            if (preset === null && !problems.length)
                report('/preset_version', `preset "${presetName}" ${accepted} is held ("on_preset_change": "hold"), but the installed package ships ${installed.version} and keeps no copy of ${accepted}; ` +
                    `run \`noonsight accept\` to take ${installed.version}, or install a noonsight version that ships ${accepted}`);
        }
    }
    if (problems.length)
        refuse();
    // Under "warn", an enable, disable or replaces entry can name a rule the accepted version had and the
    // installed one no longer has: the update dropped it, so the entry is left out and reported, not refused.
    let former;
    const formerRules = (model) => {
        if (former === undefined) {
            former = null;
            if (accepted !== null && installed !== null && preset === installed && accepted !== installed.version) {
                const own = [];
                former = loadPreset(presetName, versionDir(presetsRoot, presetName, accepted), accepted, false, own);
                if (own.length)
                    former = null;
            }
        }
        return former?.models.get(model) ?? [];
    };
    const scopes = mergeScopes(preset?.scopes ?? new Map(), cfg.scopes ?? {}, report);
    const configDir = path.dirname(configFile);
    const exact = new Map();
    const wildcards = [];
    const allModels = loadAllModels(cfg.all_models?.add ?? [], configDir, scopes, report, origin);
    for (const [key, entry] of Object.entries(models)) {
        const at = `/models/${key}`;
        // Lookups use the bare identifier, so a key in any other form would never match.
        const normalized = normalizeModel(key);
        if (normalized !== key) {
            report(at, `write the bare model identifier "${normalized}"; this key would never match`);
            continue;
        }
        if (/[*?]/.test(key)) {
            wildcards.push(compileWildcard(key));
            continue;
        }
        if (entry.use === 'none') {
            exact.set(key, { use: 'none' });
            continue;
        }
        // The preset's part of the rules: a rule that is on, or the index in "add" of the rule that replaces it.
        const presetPart = [];
        // The preset rule each rule of "add" that names one in "replaces" takes its defaults from: the rule
        // it replaces, or, when the update dropped that rule, the rule as the accepted version had it.
        const replaced = new Map();
        const presetIds = new Set(preset?.models.get(key)?.map((r) => r.id) ?? []);
        if (entry.use === 'preset') {
            const presetRules = preset?.models.get(key);
            if (preset && !presetRules) {
                report(at, `preset "${presetName}" has no rules for ${key}; declare it with "use": "custom" or "use": "none"`);
            }
            else if (presetRules) {
                const ids = new Set(presetRules.map((r) => r.id));
                // An entry that names a rule by an id it had before a rename still applies to the rule.
                const renamed = new Map(presetRules.flatMap((r) => r.renamedFrom.map((old) => [old, r.id])));
                const pick = (list) => {
                    const picked = new Map();
                    for (const id of entry[list] ?? []) {
                        const current = ids.has(id) ? id : renamed.get(id);
                        if (current !== undefined)
                            picked.set(current, id);
                        else if (!formerRules(key).some((r) => r.id === id))
                            report(`${at}/${list}`, `preset "${presetName}" has no rule "${id}" for ${key}`);
                    }
                    return picked;
                };
                const enable = pick('enable');
                const disable = pick('disable');
                for (const [id, written] of enable) {
                    const other = disable.get(id);
                    if (other !== undefined)
                        report(at, `rule "${id}" is both enabled and disabled` + (written !== id || other !== id ? ` (as "${written}" and "${other}")` : ''));
                }
                const replacing = new Map();
                (entry.add ?? []).forEach((u, i) => {
                    if (u.replaces === undefined)
                        return;
                    const replacesAt = `${origin(u)?.at ?? `${at}/add/${i}`}/replaces`;
                    const current = ids.has(u.replaces) ? u.replaces : renamed.get(u.replaces);
                    if (current === undefined) {
                        const gone = formerRules(key).find((r) => r.id === u.replaces);
                        if (gone !== undefined)
                            replaced.set(i, gone);
                        else
                            report(replacesAt, `preset "${presetName}" has no rule "${u.replaces}" for ${key}`);
                        return;
                    }
                    const named = current !== u.replaces ? ` (as "${u.replaces}")` : '';
                    const other = replacing.get(current);
                    if (other !== undefined) {
                        report(replacesAt, `rule "${current}"${named} is already replaced by "${entry.add?.[other]?.id}"; a preset rule is replaced by one rule at most`);
                        return;
                    }
                    if (enable.has(current))
                        report(replacesAt, `rule "${current}"${named} is both replaced and enabled; remove it from "enable" to deliver "${u.id}" in its place`);
                    if (disable.has(current))
                        report(replacesAt, `rule "${current}"${named} is both replaced and disabled; "replaces" already turns it off, so remove it from "disable"`);
                    replacing.set(current, i);
                    replaced.set(i, presetRules.find((r) => r.id === current));
                });
                for (const r of presetRules) {
                    const by = replacing.get(r.id);
                    const on = (r.enabled || enable.has(r.id)) && !disable.has(r.id);
                    if (by !== undefined)
                        presetPart.push(by);
                    else if (on)
                        presetPart.push({ id: r.id, origin: r.origin, scopes: r.scopes, where: r.where, triggers: r.triggers, text: r.text });
                }
            }
        }
        // The rules of every model come after the preset's and before the model's own.
        const taken = new Set(presetIds);
        allModels.forEach((r, i) => {
            if (presetIds.has(r.id))
                report(`/all_models/add/${i}/id`, `rule id "${r.id}" is already a preset rule for ${key}; every model declared with "use": "preset" or "use": "custom" receives the rules of "all_models"`);
            taken.add(r.id);
        });
        // A rule that replaces a preset rule takes the scopes, places and triggers it does not give from that rule.
        const own = (entry.add ?? []).map((u, i) => {
            const ruleAt = origin(u)?.at ?? `${at}/add/${i}`;
            if (allModels.some((r) => r.id === u.id))
                report(`${ruleAt}/id`, `rule id "${u.id}" is already used for ${key} by "all_models"`);
            else if (taken.has(u.id))
                report(`${ruleAt}/id`, `rule id "${u.id}" is already used for ${key}`);
            taken.add(u.id);
            const base = replaced.get(i);
            const ruleScopes = u.scopes ?? base?.scopes ?? [ANY_SCOPE];
            const where = placesOf(u.where, `${ruleAt}/where`, report) ?? base?.where ?? [...PLACES];
            const triggers = u.triggers ?? base?.triggers ?? [];
            checkScopes(ruleScopes, scopes, `${ruleAt}/scopes`, report);
            const triggersFrom = u.triggers === undefined && base !== undefined ? base.id : undefined;
            checkTriggers(ruleScopes, where, triggers, `${ruleAt}/triggers`, report, triggersFrom);
            const text = readRuleText(path.resolve(configDir, u.file), `${ruleAt}/file`, report);
            if (text === undefined)
                return undefined;
            const inPlace = base !== undefined && presetPart.includes(i);
            return {
                id: u.id,
                origin: 'user',
                scopes: ruleScopes,
                where,
                triggers,
                text,
                ...(inPlace ? { replaces: base.id } : {}),
                ...(origin(u) ? { project: true } : {}),
            };
        });
        // A rule that replaces a preset rule is delivered in its place; the others follow the rules of "all_models".
        const rules = [
            ...presetPart.flatMap((r) => (typeof r === 'number' ? (own[r] ?? []) : [r])),
            ...allModels,
            ...own.filter((r, i) => r !== undefined && !presetPart.includes(i)),
        ];
        checkDeliverySize(key, rules, scopes, at, report);
        exact.set(key, { use: 'rules', rules });
    }
    if (problems.length)
        refuse();
    wildcards.sort((a, b) => b.literal - a.literal || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    const sub = cfg.subagents ?? {};
    const subagents = {
        delivery: sub.delivery ?? DEFAULT_SUBAGENT_SETTINGS.delivery,
        permission: sub.permission ?? DEFAULT_SUBAGENT_SETTINGS.permission,
        onMismatch: sub.on_mismatch ?? DEFAULT_SUBAGENT_SETTINGS.onMismatch,
    };
    const session = {
        unattendedWhenEnv: cfg.session?.unattended_when_env ?? DEFAULT_SESSION_SETTINGS.unattendedWhenEnv,
        headlessIsUnattended: cfg.session?.headless_is_unattended ?? DEFAULT_SESSION_SETTINGS.headlessIsUnattended,
    };
    const routing = loadRouting(cfg.routing ?? {}, preset, scopes, exact, report);
    const c = cfg.classifier ?? {};
    const classifier = {
        mode: c.mode ?? DEFAULT_CLASSIFIER_SETTINGS.mode,
        model: c.model ?? DEFAULT_CLASSIFIER_SETTINGS.model,
        effort: c.effort ?? DEFAULT_CLASSIFIER_SETTINGS.effort,
        timeoutMs: c.timeout_ms ?? DEFAULT_CLASSIFIER_SETTINGS.timeoutMs,
    };
    if (classifier.mode !== 'off' && scopes.has(NO_SCOPE_ANSWER))
        report(`/scopes/${NO_SCOPE_ANSWER}`, `the classifier answers "${NO_SCOPE_ANSWER}" for a task that fits no scope, so no scope can have that name while classifier.mode is on`);
    if (problems.length)
        refuse();
    const declared = new Map(Object.entries(models).map(([key, entry]) => [
        key,
        {
            use: entry.use,
            wildcard: /[*?]/.test(key),
            enable: entry.enable ?? [],
            disable: entry.disable ?? [],
            add: (entry.add ?? []).map((u) => ({
                ...describeRule(u, origin(u)),
                ...(u.replaces !== undefined
                    ? {
                        replaces: {
                            id: u.replaces,
                            inherits: [
                                ...(u.scopes === undefined ? ['scopes'] : []),
                                ...(u.where === undefined ? ['places'] : []),
                                ...(u.triggers === undefined ? ['triggers'] : []),
                            ],
                        },
                    }
                    : {}),
            })),
        },
    ]));
    return {
        config: { exact, wildcards, onUndeclared: cfg.on_undeclared ?? 'warn', allModels, scopes, session, subagents, routing, classifier },
        preset,
        presetVersions: { name: presetName, accepted, onChange, installed },
        declared,
        allModels: (cfg.all_models?.add ?? []).map((u) => describeRule(u, origin(u))),
    };
}
/** A user rule as commands list it: its file as the configuration that writes it writes it. */
function describeRule(u, origin) {
    return origin ? { id: u.id, file: origin.file, project: true } : { id: u.id, file: u.file };
}
/**
 * The rules of the "all_models" block, read and checked once, in the same way as a model's own
 * "add". The id of each rule must also be new for every model that receives it; the loader checks
 * that where it assembles each model's rules.
 */
function loadAllModels(raw, configDir, scopes, report, origin) {
    const ids = new Set();
    const rules = [];
    raw.forEach((u, i) => {
        const at = origin(u)?.at ?? `/all_models/add/${i}`;
        if (ids.has(u.id))
            report(`${at}/id`, `rule id "${u.id}" is used more than once in "all_models"`);
        ids.add(u.id);
        const ruleScopes = u.scopes ?? [ANY_SCOPE];
        const where = placesOf(u.where, `${at}/where`, report) ?? [...PLACES];
        const triggers = u.triggers ?? [];
        checkScopes(ruleScopes, scopes, `${at}/scopes`, report);
        checkTriggers(ruleScopes, where, triggers, `${at}/triggers`, report);
        const text = readRuleText(path.resolve(configDir, u.file), `${at}/file`, report);
        if (text !== undefined)
            rules.push({ id: u.id, origin: 'user', scopes: ruleScopes, where, triggers, text, allModels: true, ...(origin(u) ? { project: true } : {}) });
    });
    return rules;
}
/**
 * Read and check the preset in one directory: the installed preset (version null), or the copy of
 * one earlier version, which must say it is that version. A missing preset is a problem only when
 * needed.
 */
function loadPreset(name, presetDir, version, needed, problems) {
    const file = path.join(presetDir, 'preset.json');
    if (!fs.existsSync(file)) {
        if (needed)
            problems.push(`/preset: preset "${name}" is not installed (looked for ${file})`);
        return null;
    }
    const own = [];
    const report = (at, message) => {
        own.push(`${at}: ${message}`);
    };
    const raw = readJson(file, own, 'cannot read the preset');
    if (raw !== undefined)
        own.push(...validateSchema(schema('preset.schema.json'), raw));
    if (own.length) {
        problems.push(...own.map((p) => `preset ${file}: ${p}`));
        return null;
    }
    const p = raw;
    if (p.id !== name)
        report('/id', `is "${p.id}", but the preset is installed as "${name}"`);
    if (version !== null && p.version !== version)
        report('/version', `is "${p.version}", but the copy is kept as version ${version}`);
    const scopes = new Map(Object.entries(p.scopes ?? {}).map(([name, raw]) => [name, toScope(name, raw, `/scopes/${name}`, report)]));
    const scopeSources = new Map(Object.entries(p.scopes ?? {}).flatMap(([name, raw]) => (raw.source ? [[name, raw.source]] : [])));
    const routing = new Map();
    for (const [scope, entry] of Object.entries(p.routing?.table ?? {})) {
        const at = `/routing/table/${scope}`;
        if (!scopes.has(scope))
            report(at, `scope "${scope}" is not one of the preset's scopes`);
        routing.set(scope, { row: toRow(entry.route, `${at}/route`, report), basis: entry.basis, sources: entry.sources });
    }
    const models = new Map();
    for (const [key, entry] of Object.entries(p.models)) {
        const at = `/models/${key}`;
        if (normalizeModel(key) !== key)
            report(at, `write the bare model identifier "${normalizeModel(key)}"`);
        const ids = new Set();
        const rules = [];
        entry.rules.forEach((r, i) => {
            const ruleAt = `${at}/rules/${i}`;
            if (ids.has(r.id))
                report(`${ruleAt}/id`, `rule id "${r.id}" is used more than once for ${key}`);
            ids.add(r.id);
            checkScopes(r.scopes, scopes, `${ruleAt}/scopes`, report);
            const where = placesOf(r.where, `${ruleAt}/where`, report) ?? [...PLACES];
            checkTriggers(r.scopes, where, r.triggers ?? [], `${ruleAt}/triggers`, report);
            const text = readRuleText(path.resolve(presetDir, r.file), `${ruleAt}/file`, report);
            if (text !== undefined)
                rules.push({
                    id: r.id,
                    origin: 'preset',
                    scopes: r.scopes,
                    where,
                    triggers: r.triggers ?? [],
                    text,
                    enabled: r.enabled ?? true,
                    renamedFrom: r.renamed_from ?? [],
                    file: r.file,
                    source: r.source,
                    effect: r.effect,
                    cost: r.cost,
                });
        });
        checkRenames(key, entry.rules, at, report);
        // A user can turn on any preset rule, so the preset must fit with every rule on, not only as it ships.
        if (rules.length === entry.rules.length)
            checkPresetSize(key, rules, scopes, at, report);
        models.set(key, rules);
    }
    if (own.length) {
        problems.push(...own.map((p) => `preset ${file}: ${p}`));
        return null;
    }
    return { name, version: p.version, claudeCode: p.claude_code ?? null, scopes, scopeSources, routing, models };
}
/**
 * A rule's earlier ids map an enable or disable entry, and an earlier version's rule, to the rule, so
 * each earlier id names one rule and no rule the version has.
 */
function checkRenames(model, rules, at, report) {
    const current = new Set(rules.map((r) => r.id));
    const owner = new Map();
    rules.forEach((r, i) => (r.renamed_from ?? []).forEach((old, j) => {
        const oldAt = `${at}/rules/${i}/renamed_from/${j}`;
        if (current.has(old))
            report(oldAt, `"${old}" is the id of a rule of ${model} in this version; renamed_from lists only ids the rule had in earlier versions`);
        else if (owner.has(old))
            report(oldAt, `"${old}" is already an earlier id of rule "${owner.get(old)}"`);
        owner.set(old, r.id);
    }));
}
/**
 * The declared scopes: the preset's, in its order, then the user's new ones, in theirs. A user scope
 * with a preset scope's name keeps that scope's place and replaces only the keys it gives.
 */
function mergeScopes(preset, user, report) {
    const scopes = new Map(preset);
    for (const [name, raw] of Object.entries(user))
        scopes.set(name, toScope(name, raw, `/scopes/${name}`, report, scopes.get(name)));
    return scopes;
}
function toScope(name, raw, at, report, base) {
    const description = raw.description ?? base?.description;
    return {
        name,
        ...(description !== undefined ? { description } : {}),
        match: raw.match !== undefined ? compileMatchers(name, raw.match, `${at}/match`, report) : (base?.match ?? []),
    };
}
/** Plain task texts. A matcher that matches every one of them is a catch-all, such as `.`, `\b` or `\w`. */
const CATCH_ALL_PROBES = ['a', 'Z', '0', ' a ', 'A B', 'x_1 y'];
/**
 * Matchers are JavaScript regular expressions, compiled case-insensitive and Unicode-aware. A matcher
 * that matches every probe text in CATCH_ALL_PROBES is a catch-all, so it is refused. Passing the
 * probes does not prove a matcher is not broad; it only catches the obvious catch-alls. A matcher with
 * one of the shapes backtracking.ts recognizes is refused too, since the hook runs it over every
 * subagent's task text before the subagent starts.
 */
function compileMatchers(scope, sources, at, report) {
    const out = [];
    sources.forEach((source, i) => {
        let regex;
        try {
            regex = new RegExp(source, MATCHER_FLAGS);
        }
        catch (e) {
            report(`${at}/${i}`, `not a valid regular expression (${e.message})`);
            return;
        }
        if (CATCH_ALL_PROBES.every((text) => regex.test(text))) {
            const probes = CATCH_ALL_PROBES.map((text) => JSON.stringify(text)).join(', ');
            report(`${at}/${i}`, `"${source}" matches each of the probe texts ${probes}, which are plain task texts used to detect catch-all matchers`);
            return;
        }
        const risk = backtrackingRisk(source, MATCHER_FLAGS);
        if (risk !== null) {
            report(`${at}/${i}`, `scope "${scope}": "${source}" ${describeRisk(risk)}`);
            return;
        }
        out.push({ source, regex });
    });
    return out;
}
function describeRisk(risk) {
    // Quoted as the pattern itself is quoted: as the configuration writes it.
    const [a = '', b = ''] = risk.parts.map((p) => `"${p}"`);
    switch (risk.kind) {
        case 'leading-any':
            return (`starts with ${a}, an unbounded repeat of any character with no "^" and only parts that can match nothing before it, so matching retries it from every position of the task text; ` +
                'start with a word instead (such as "\\binvestigat"), or anchor it with "^"');
        case 'nested':
            return `has the unbounded quantifier ${b} inside the unbounded quantifier ${a}, a shape whose matching time can grow exponentially with the task text`;
        case 'adjacent':
            return `has the unbounded quantifiers ${a} and ${b} in a row, able to match the same characters with nothing required between them, a shape whose matching time can grow much faster than the task text`;
    }
}
/**
 * The routing settings: the user's keys over the defaults, and the preset's table with each row the
 * user writes for the same scope replacing the preset's. Every scope in the table must be declared,
 * and every model an option names must be an alias or a model declared under an exact key.
 */
function loadRouting(raw, preset, scopes, exact, report) {
    const table = new Map();
    for (const [scope, entry] of preset?.routing ?? [])
        table.set(scope, entry.row);
    for (const [scope, rawRow] of Object.entries(raw.table ?? {})) {
        const at = `/routing/table/${scope}`;
        if (!scopes.has(scope))
            report(at, `scope "${scope}" is not declared`);
        checkRouteModels(rawRow, at, exact, report);
        table.set(scope, toRow(rawRow, at, report));
    }
    let fallback = null;
    if (raw.default !== undefined && raw.default !== 'inherit') {
        checkRouteModels(raw.default, '/routing/default', exact, report);
        fallback = toRow(raw.default, '/routing/default', report);
    }
    return {
        enabled: raw.enabled ?? DEFAULT_ROUTING_SETTINGS.enabled,
        targets: raw.targets ?? DEFAULT_ROUTING_SETTINGS.targets,
        respectExplicit: raw.respect_explicit ?? DEFAULT_ROUTING_SETTINGS.respectExplicit,
        yieldWhenEnv: raw.yield_when_env ?? DEFAULT_ROUTING_SETTINGS.yieldWhenEnv,
        table,
        default: fallback,
    };
}
/** A row as the core reads it: a list written for every target becomes the same list for each. */
function toRow(raw, at, report) {
    if (Array.isArray(raw))
        return Object.fromEntries(ROUTE_TARGETS.map((t) => [t, raw]));
    if (Object.keys(raw).length === 0)
        report(at, `list the options for ${ROUTE_TARGETS.join(', ')} or both, or write the options as one list for every target`);
    return raw;
}
function checkRouteModels(raw, at, exact, report) {
    const lists = Array.isArray(raw)
        ? [[at, raw]]
        : ROUTE_TARGETS.flatMap((t) => (raw[t] !== undefined ? [[`${at}/${t}`, raw[t]]] : []));
    for (const [listAt, options] of lists)
        options.forEach((option, i) => {
            if (ROUTE_ALIASES.includes(option.model) || exact.has(option.model))
                return;
            report(`${listAt}/${i}/model`, `"${option.model}" is neither a model alias (${ROUTE_ALIASES.join(', ')}) nor a model declared under "models" with its exact identifier`);
        });
}
/**
 * A rule's places as "where" writes them: each place by its name or an earlier one, such as
 * "session" for "attended", or "all" alone for every place. Undefined when "where" is not given.
 */
function placesOf(raw, at, report) {
    if (raw === undefined)
        return undefined;
    if (raw.includes(ALL_PLACES)) {
        if (raw.length > 1)
            report(at, `"${ALL_PLACES}" already covers every place; list it alone`);
        return [...PLACES];
    }
    const places = [];
    for (const value of raw) {
        const place = placeName(value);
        if (place === null)
            continue; // The schema already refused it.
        if (!places.includes(place))
            places.push(place);
        else {
            const earlier = Object.keys(PLACE_ALIASES).find((name) => PLACE_ALIASES[name] === place && raw.includes(name));
            report(at, `names the place "${place}" twice${earlier === undefined ? '' : ` ("${earlier}" is its earlier name)`}`);
        }
    }
    return places;
}
function checkScopes(ruleScopes, declared, at, report) {
    if (ruleScopes.includes(ANY_SCOPE) && ruleScopes.length > 1)
        report(at, `"${ANY_SCOPE}" already covers every scope; list it alone`);
    for (const s of ruleScopes)
        if (s !== ANY_SCOPE && !declared.has(s))
            report(at, `scope "${s}" is not declared`);
}
/**
 * A trigger delivers a rule to a session whose scope is not one of the rule's scopes, so it adds
 * nothing to a rule for every scope, and it acts only in a session's places.
 */
function checkTriggers(ruleScopes, where, triggers, at, report, inheritedFrom) {
    if (triggers.length === 0)
        return;
    const from = inheritedFrom === undefined ? '' : ` (the rule takes its triggers from "${inheritedFrom}", which it replaces; give "triggers": [] to drop them)`;
    if (ruleScopes.includes(ANY_SCOPE))
        report(at, `the rule is for every scope ("${ANY_SCOPE}"), so it already reaches every session; a trigger adds nothing${from}`);
    if (!where.some((p) => p !== 'subagent'))
        report(at, `a trigger acts only in a session, but the rule is only for the place "subagent"; add "attended" or "unattended" to "where"${from}`);
}
/** The trigger sets a delivery can be made with: none, and every trigger revealed. */
const TRIGGER_SETS = [[], TRIGGERS];
/**
 * The text limit applies to what is delivered, so every combination of scope, place and revealed
 * triggers is checked. Part of Claude Code's limit is kept for the note sent along when the session's
 * model changes.
 */
function checkDeliverySize(model, rules, scopes, at, report, prefix = '') {
    for (const scope of [null, ...[...scopes.keys()].sort()])
        for (const place of PLACES)
            for (const triggers of TRIGGER_SETS) {
                const picked = selectRules(rules, scope, place, triggers);
                // Without a trigger the rules are those checked without one.
                if (picked.length === 0 || (triggers.length && picked.length === selectRules(rules, scope, place).length))
                    continue;
                const size = deliveryText(model, picked, scope, triggers).text.length;
                if (size > RULES_TEXT_LIMIT) {
                    const shared = picked.filter((r) => r.allModels).length;
                    report(at, `${prefix}the rules delivered for ${scope === null ? 'no scope' : `scope "${scope}"`} in place "${place}"` +
                        `${triggers.length ? ` once a session reveals ${triggers.join(', ')}` : ''} come to ${size} characters` +
                        `${shared ? ` (${shared} of the ${picked.length} rules are from "all_models", which every model declared with "use": "preset" or "use": "custom" receives)` : ''}; ${LIMIT_TEXT}`);
                }
            }
}
const LIMIT_TEXT = `the limit is ${RULES_TEXT_LIMIT} (Claude Code's ${DELIVERY_TEXT_LIMIT}, less ${SWITCH_NOTE_RESERVE} kept for the model-change note)`;
/**
 * A preset rule must fit on its own, and the preset's rules for a model must fit together with every
 * rule on, since the user decides which of them are on.
 */
function checkPresetSize(model, rules, scopes, at, report) {
    let alone = true;
    rules.forEach((r, i) => {
        // The envelope names the scope, so the rule is measured under each scope it can be delivered in.
        const under = r.scopes.includes(ANY_SCOPE) ? [null, ...scopes.keys()] : r.scopes;
        const size = Math.max(...under.map((scope) => envelope(model, scope, [r.id], r.text).length), 
        // Delivered by a trigger: under no scope, or under a scope the rule does not list.
        ...(r.triggers.length
            ? [null, ...[...scopes.keys()].filter((s) => !r.scopes.includes(s))].map((scope) => envelope(model, scope, [r.id], r.text, r.triggers).length)
            : []));
        if (size > RULES_TEXT_LIMIT) {
            alone = false;
            report(`${at}/rules/${i}/file`, `rule "${r.id}" comes to ${size} characters on its own, envelope included; ${LIMIT_TEXT}`);
        }
    });
    if (alone)
        checkDeliverySize(model, rules, scopes, at, report, 'with every rule on, ');
}
function readRuleText(file, at, report) {
    let text;
    try {
        text = fs.readFileSync(file, 'utf8');
    }
    catch (e) {
        report(at, `cannot read ${file} (${e.code ?? String(e)})`);
        return undefined;
    }
    // Line endings are normalized so the same rule gives the same text and hash on every system.
    const normalized = text.replace(/\r\n?/g, '\n').trim();
    if (!normalized) {
        report(at, `${file} is empty`);
        return undefined;
    }
    return normalized;
}
function readJson(file, problems, missing) {
    let text;
    try {
        text = fs.readFileSync(file, 'utf8');
    }
    catch (e) {
        const code = e.code;
        problems.push(code === 'ENOENT' ? missing : `cannot read the file (${code ?? String(e)})`);
        return undefined;
    }
    return parseJson(text, problems);
}
function parseJson(text, problems) {
    try {
        return JSON.parse(text);
    }
    catch (e) {
        problems.push(`not valid JSON: ${e.message}`);
        return undefined;
    }
}
function compileWildcard(key) {
    const source = [...key]
        .map((c) => (c === '*' ? '.*' : c === '?' ? '.' : c.replace(/[.+^${}()|[\]\\-]/g, '\\$&')))
        .join('');
    return { key, pattern: new RegExp(`^${source}$`), literal: key.replace(/[*?]/g, '').length };
}
const schemaCache = new Map();
function schema(name) {
    let s = schemaCache.get(name);
    if (!s) {
        s = JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, name), 'utf8'));
        assertSupported(s);
        schemaCache.set(name, s);
    }
    return s;
}
//# sourceMappingURL=load.js.map