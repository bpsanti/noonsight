// noonsight models: the models the configuration declares and the rules each one receives, with the
// source, effect and cost the preset gives for each rule; the preset's models that are not
// declared; and the models the decision log has seen that are not declared. It reads local files
// only and changes nothing.
import os from 'node:os';
import { loadConfigDetails } from '../config/load.js';
import { configPath, stateDir } from '../config/paths.js';
import { describeProject, projectFor } from '../config/project.js';
import { ANY_SCOPE } from '../core/types.js';
import { readDecisions } from '../state/log.js';
import { UsageError } from './usage.js';
export const MODELS_USAGE = `usage: noonsight models [--json]

List the models the configuration declares and the rules each one receives, with the source,
effect and cost of each preset rule; the preset's models that are not declared; and the models
seen in the decision log that are not declared. A project configuration found from the current
directory applies as it would to a session started here. --json prints the same as JSON.
Exits 0, or 2 for a usage error or a refused configuration.`;
export function runModels(args, env, out) {
    const json = args.includes('--json');
    const other = args.find((a) => a !== '--json');
    if (other !== undefined)
        throw new UsageError(other.startsWith('-') ? `unknown option ${other}` : `unexpected argument "${other}"`, MODELS_USAGE);
    const report = modelsReport(env);
    out(json ? JSON.stringify(report, null, 2) : renderModels(report));
    return 0;
}
export function modelsReport(env, home = os.homedir()) {
    const file = configPath(env, home);
    const log = stateDir(home);
    const project = projectFor(env.CLAUDE_PROJECT_DIR || process.cwd(), file, log);
    const { config, preset, presetVersions, declared, allModels, project: layer } = loadConfigDetails(file, { project }, env);
    const seen = seenModels(log);
    const listed = [];
    for (const [key, entry] of declared) {
        if (entry.wildcard) {
            const pattern = config.wildcards.find((w) => w.key === key)?.pattern;
            // A seen model is covered by the wildcard that decides for it: none when an exact key or a stronger wildcard wins.
            const covers = Object.fromEntries([...seen].filter(([model]) => pattern?.test(model) && decidingKey(config, model) === key));
            listed.push({ key, use: entry.use, wildcard: true, rules: [], covers });
            continue;
        }
        listed.push({ key, use: entry.use, wildcard: false, rules: listRules(key, entry, config, preset, allModels), seen: seen.get(key) ?? { decisions: 0, last: null } });
    }
    const presetUndeclared = [...(preset?.models ?? [])]
        .filter(([key]) => decidingKey(config, key) === null)
        .map(([key, rules]) => ({ key, rules: rules.length, on_by_default: rules.filter((r) => r.enabled).length }));
    const seenUndeclared = [...seen]
        .filter(([model]) => decidingKey(config, model) === null)
        .map(([model, s]) => ({ model, ...s, in_preset: preset?.models.has(model) ?? false }));
    return {
        config: file,
        project: layer && { file: layer.file, dir: layer.dir, allow: layer.allow, status: layer.status, summary: describeProject(layer) },
        log,
        preset: preset && {
            name: preset.name,
            version: preset.version,
            claude_code: preset.claudeCode,
            accepted: presetVersions.accepted,
            installed: presetVersions.installed?.version ?? null,
        },
        all_models: config.allModels.map((r) => userRule(r, allModels.find((a) => a.id === r.id)?.file)),
        declared: listed,
        preset_undeclared: presetUndeclared,
        seen_undeclared: seenUndeclared,
    };
}
/**
 * The rules of one exact model, in the order they are delivered: every preset rule, on or off, for
 * "use": "preset", each replaced one followed by the user rule delivered in its place, then the rules
 * of "all_models", then the model's own.
 */
function listRules(key, entry, config, preset, allModels) {
    const resolved = config.exact.get(key);
    const delivered = resolved?.use === 'rules' ? resolved.rules : [];
    const on = new Set(delivered.map((r) => `${r.origin}:${r.id}`));
    const own = (r) => userRule(r, entry.add.find((a) => a.id === r.id)?.file);
    const rules = [];
    if (entry.use === 'preset')
        for (const r of preset?.models.get(key) ?? []) {
            const by = delivered.find((x) => x.replaces === r.id);
            rules.push(presetRule(r, on.has(`preset:${r.id}`), by?.id));
            if (by !== undefined)
                rules.push(own(by));
        }
    for (const r of delivered.filter((x) => x.allModels))
        rules.push(userRule(r, allModels.find((a) => a.id === r.id)?.file));
    for (const r of delivered.filter((x) => x.origin === 'user' && !x.allModels && x.replaces === undefined))
        rules.push(own(r));
    return rules;
}
function presetRule(r, on, replacedBy) {
    return {
        id: r.id,
        origin: 'preset',
        on,
        scopes: r.scopes,
        where: r.where,
        triggers: r.triggers,
        source: r.source,
        effect: r.effect,
        cost: r.cost,
        ...(replacedBy !== undefined ? { replaced_by: replacedBy } : {}),
    };
}
function userRule(r, file) {
    return {
        id: r.id,
        origin: 'user',
        on: true,
        scopes: r.scopes,
        where: r.where,
        triggers: r.triggers,
        ...(r.allModels ? { from: 'all_models' } : {}),
        ...(r.project ? { project: true } : {}),
        ...(file !== undefined ? { file } : {}),
        ...(r.replaces !== undefined ? { replaces: r.replaces } : {}),
    };
}
/** The key that decides for a model, as the core resolves it: the exact key, else the strongest wildcard. */
function decidingKey(config, model) {
    if (config.exact.has(model))
        return model;
    return config.wildcards.find((w) => w.pattern.test(model))?.key ?? null;
}
/** Every model the decision log names, with how many decisions named it and the latest time. */
function seenModels(dir) {
    const seen = new Map();
    for (const record of readDecisions(dir)) {
        const model = record.model;
        if (typeof model !== 'string' || model === '')
            continue;
        const s = seen.get(model) ?? { decisions: 0, last: null };
        s.decisions++;
        if (typeof record.ts === 'string' && (s.last === null || record.ts > s.last))
            s.last = record.ts;
        seen.set(model, s);
    }
    return new Map([...seen].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}
export function renderModels(r) {
    const lines = [`config ${r.config}`];
    if (r.project)
        lines.push(`project ${r.project.file}: ${r.project.summary}`);
    if (r.preset)
        lines.push(`preset ${r.preset.name} ${r.preset.version}` +
            (r.preset.installed !== null && r.preset.installed !== r.preset.version ? ` (held; the package ships ${r.preset.installed})` : '') +
            (r.preset.claude_code
                ? `: its rules were compared with the system prompts of Claude Code ${r.preset.claude_code.version} on ${r.preset.claude_code.checked}, so none is delivered where that version already sends the same advice`
                : ''));
    else
        lines.push('preset: not installed');
    if (r.all_models.length) {
        lines.push('', `all_models: ${r.all_models.length} ${r.all_models.length === 1 ? 'rule' : 'rules'} for every model declared with "use": "preset" or "use": "custom", after the preset's rules and before the model's own`);
        for (const rule of r.all_models)
            lines.push(ruleLine(rule), ...(rule.file !== undefined ? [`       file: ${rule.file}`] : []));
    }
    for (const m of r.declared) {
        lines.push('');
        if (m.wildcard) {
            const covered = Object.entries(m.covers ?? {});
            lines.push(`${m.key}: none, a wildcard` +
                (covered.length ? `; covers ${covered.map(([model, s]) => `${model} (${times(s.decisions)})`).join(', ')} from the decision log` : ''));
            continue;
        }
        const on = m.rules.filter((x) => x.on).length;
        const head = m.use === 'none'
            ? 'none, by decision'
            : m.use === 'preset'
                ? `preset, ${on} of ${m.rules.length} rules on`
                : `custom, ${m.rules.length} ${m.rules.length === 1 ? 'rule' : 'rules'}`;
        lines.push(`${m.key}: ${head}; ${seenText(m.seen)}`);
        for (const rule of m.rules) {
            lines.push(ruleLine(rule));
            if (rule.source)
                lines.push(`       source: ${rule.source.url}, "${rule.source.section}", read ${rule.source.date}`);
            if (rule.effect !== undefined)
                lines.push(`       effect: ${rule.effect}`);
            if (rule.cost !== undefined)
                lines.push(`       cost: ${rule.cost}`);
            if (rule.file !== undefined)
                lines.push(`       file: ${rule.file}`);
        }
    }
    if (r.preset_undeclared.length) {
        lines.push('', 'In the preset, not declared (add an entry with "use": "preset" to receive these rules):');
        for (const p of r.preset_undeclared)
            lines.push(`  ${p.key}: ${p.rules} rules, ${p.on_by_default} on by default`);
    }
    if (r.seen_undeclared.length) {
        lines.push('', `Seen in the decision log (${r.log}), not declared, so they get no rules and a warning:`);
        for (const s of r.seen_undeclared)
            lines.push(`  ${s.model}: ${seenText(s)}; ` +
                (s.in_preset ? 'the preset has rules for it ("use": "preset")' : 'the preset has no rules for it ("use": "custom" with your own, or "use": "none")'));
    }
    return lines.join('\n');
}
function ruleLine(rule) {
    const triggers = rule.triggers.length ? `; triggers: ${rule.triggers.join(', ')}` : '';
    const from = (rule.from === 'all_models' ? '; from all_models' : '') + (rule.project ? '; from the project' : '');
    const pair = rule.replaced_by !== undefined ? `; replaced by ${rule.replaced_by}` : rule.replaces !== undefined ? `; replaces ${rule.replaces}` : '';
    return `  ${rule.on ? 'on ' : 'off'}  ${rule.id}  (scopes: ${scopesText(rule.scopes)}; places: ${rule.where.join(', ')}${triggers}${from}${pair})`;
}
function scopesText(scopes) {
    return scopes.includes(ANY_SCOPE) ? 'every scope' : scopes.join(', ');
}
function seenText(s) {
    return !s || s.decisions === 0 ? 'not seen in the decision log' : `seen in ${times(s.decisions)}, last ${s.last ?? 'at an unknown time'}`;
}
function times(n) {
    return `${n} ${n === 1 ? 'decision' : 'decisions'}`;
}
//# sourceMappingURL=models.js.map