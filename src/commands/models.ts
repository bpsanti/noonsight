// sextant models: the models the configuration declares and the rules each one receives, with the
// source, effect and cost the preset gives for each rule; the preset's models that are not
// declared; and the models the decision log has seen that are not declared. It reads local files
// only and changes nothing.

import os from 'node:os';
import { loadConfigDetails, type DeclaredModel, type Preset, type PresetRule, type Source } from '../config/load.js';
import { configPath, stateDir, type Env } from '../config/paths.js';
import { ANY_SCOPE, type Config, type Place, type Rule } from '../core/types.js';
import { readDecisions } from '../state/log.js';
import { UsageError } from './usage.js';

export const MODELS_USAGE = `usage: sextant models [--json]

List the models the configuration declares and the rules each one receives, with the source,
effect and cost of each preset rule; the preset's models that are not declared; and the models
seen in the decision log that are not declared. --json prints the same as JSON.
Exits 0, or 2 for a usage error or a refused configuration.`;

export interface Seen {
  readonly decisions: number;
  /** The time of the latest decision for the model, as the log writes it. */
  readonly last: string | null;
}

export interface ListedRule {
  readonly id: string;
  readonly origin: 'preset' | 'user';
  readonly on: boolean;
  readonly scopes: readonly string[];
  readonly where: readonly Place[];
  /** User rules: the file as the configuration writes it. */
  readonly file?: string;
  readonly source?: Source;
  readonly effect?: string;
  readonly cost?: string;
}

export interface ListedModel {
  readonly key: string;
  readonly use: DeclaredModel['use'];
  readonly wildcard: boolean;
  readonly rules: readonly ListedRule[];
  /** Exact keys: how often the decision log saw the model. */
  readonly seen?: Seen;
  /** Wildcard keys: the models seen in the decision log that the key covers, and how often. */
  readonly covers?: Readonly<Record<string, Seen>>;
}

export interface ModelsReport {
  readonly config: string;
  readonly log: string;
  readonly preset: {
    readonly name: string;
    readonly version: string;
    readonly claude_code: { readonly version: string; readonly checked: string } | null;
  } | null;
  readonly declared: readonly ListedModel[];
  /** Models the preset has rules for that the configuration does not declare. */
  readonly preset_undeclared: readonly { readonly key: string; readonly rules: number; readonly on_by_default: number }[];
  /** Models the decision log saw that the configuration does not declare. */
  readonly seen_undeclared: readonly (Seen & { readonly model: string; readonly in_preset: boolean })[];
}

export function runModels(args: readonly string[], env: Env, out: (text: string) => void): number {
  const json = args.includes('--json');
  const other = args.find((a) => a !== '--json');
  if (other !== undefined) throw new UsageError(other.startsWith('-') ? `unknown option ${other}` : `unexpected argument "${other}"`, MODELS_USAGE);
  const report = modelsReport(env);
  out(json ? JSON.stringify(report, null, 2) : renderModels(report));
  return 0;
}

export function modelsReport(env: Env, home: string = os.homedir()): ModelsReport {
  const file = configPath(env, home);
  const { config, preset, declared } = loadConfigDetails(file, {}, env);
  const log = stateDir(home);
  const seen = seenModels(log);

  const listed: ListedModel[] = [];
  for (const [key, entry] of declared) {
    if (entry.wildcard) {
      const pattern = config.wildcards.find((w) => w.key === key)?.pattern;
      // A seen model is covered by the wildcard that decides for it: none when an exact key or a stronger wildcard wins.
      const covers = Object.fromEntries([...seen].filter(([model]) => pattern?.test(model) && decidingKey(config, model) === key));
      listed.push({ key, use: entry.use, wildcard: true, rules: [], covers });
      continue;
    }
    listed.push({ key, use: entry.use, wildcard: false, rules: listRules(key, entry, config, preset), seen: seen.get(key) ?? { decisions: 0, last: null } });
  }

  const presetUndeclared = [...(preset?.models ?? [])]
    .filter(([key]) => decidingKey(config, key) === null)
    .map(([key, rules]) => ({ key, rules: rules.length, on_by_default: rules.filter((r) => r.enabled).length }));
  const seenUndeclared = [...seen]
    .filter(([model]) => decidingKey(config, model) === null)
    .map(([model, s]) => ({ model, ...s, in_preset: preset?.models.has(model) ?? false }));

  return {
    config: file,
    log,
    preset: preset && { name: preset.name, version: preset.version, claude_code: preset.claudeCode },
    declared: listed,
    preset_undeclared: presetUndeclared,
    seen_undeclared: seenUndeclared,
  };
}

/** The rules of one exact model: every preset rule, on or off, for "use": "preset", then the user's own. */
function listRules(key: string, entry: DeclaredModel, config: Config, preset: Preset | null): ListedRule[] {
  const resolved = config.exact.get(key);
  const on = new Set(resolved?.use === 'rules' ? resolved.rules.map((r) => `${r.origin}:${r.id}`) : []);
  const rules: ListedRule[] = [];
  if (entry.use === 'preset')
    for (const r of preset?.models.get(key) ?? []) rules.push(presetRule(r, on.has(`preset:${r.id}`)));
  if (resolved?.use === 'rules')
    for (const r of resolved.rules.filter((x) => x.origin === 'user')) rules.push(userRule(r, entry.add.find((a) => a.id === r.id)?.file));
  return rules;
}

function presetRule(r: PresetRule, on: boolean): ListedRule {
  return { id: r.id, origin: 'preset', on, scopes: r.scopes, where: r.where, source: r.source, effect: r.effect, cost: r.cost };
}

function userRule(r: Rule, file: string | undefined): ListedRule {
  return { id: r.id, origin: 'user', on: true, scopes: r.scopes, where: r.where, ...(file !== undefined ? { file } : {}) };
}

/** The key that decides for a model, as the core resolves it: the exact key, else the strongest wildcard. */
function decidingKey(config: Config, model: string): string | null {
  if (config.exact.has(model)) return model;
  return config.wildcards.find((w) => w.pattern.test(model))?.key ?? null;
}

/** Every model the decision log names, with how many decisions named it and the latest time. */
function seenModels(dir: string): Map<string, Seen> {
  const seen = new Map<string, { decisions: number; last: string | null }>();
  for (const record of readDecisions(dir)) {
    const model = record.model;
    if (typeof model !== 'string' || model === '') continue;
    const s = seen.get(model) ?? { decisions: 0, last: null };
    s.decisions++;
    if (typeof record.ts === 'string' && (s.last === null || record.ts > s.last)) s.last = record.ts;
    seen.set(model, s);
  }
  return new Map([...seen].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

export function renderModels(r: ModelsReport): string {
  const lines: string[] = [`config ${r.config}`];
  if (r.preset)
    lines.push(
      `preset ${r.preset.name} ${r.preset.version}` +
        (r.preset.claude_code
          ? `: its rules were compared with the system prompts of Claude Code ${r.preset.claude_code.version} on ${r.preset.claude_code.checked}, so none is delivered where that version already sends the same advice`
          : ''),
    );
  else lines.push('preset: not installed');

  for (const m of r.declared) {
    lines.push('');
    if (m.wildcard) {
      const covered = Object.entries(m.covers ?? {});
      lines.push(
        `${m.key}: none, a wildcard` +
          (covered.length ? `; covers ${covered.map(([model, s]) => `${model} (${times(s.decisions)})`).join(', ')} from the decision log` : ''),
      );
      continue;
    }
    const on = m.rules.filter((x) => x.on).length;
    const head =
      m.use === 'none'
        ? 'none, by decision'
        : m.use === 'preset'
          ? `preset, ${on} of ${m.rules.length} rules on`
          : `custom, ${m.rules.length} ${m.rules.length === 1 ? 'rule' : 'rules'}`;
    lines.push(`${m.key}: ${head}; ${seenText(m.seen)}`);
    for (const rule of m.rules) {
      lines.push(`  ${rule.on ? 'on ' : 'off'}  ${rule.id}  (scopes: ${scopesText(rule.scopes)}; places: ${rule.where.join(', ')})`);
      if (rule.source) lines.push(`       source: ${rule.source.url}, "${rule.source.section}", read ${rule.source.date}`);
      if (rule.effect !== undefined) lines.push(`       effect: ${rule.effect}`);
      if (rule.cost !== undefined) lines.push(`       cost: ${rule.cost}`);
      if (rule.file !== undefined) lines.push(`       file: ${rule.file}`);
    }
  }

  if (r.preset_undeclared.length) {
    lines.push('', 'In the preset, not declared (add an entry with "use": "preset" to receive these rules):');
    for (const p of r.preset_undeclared) lines.push(`  ${p.key}: ${p.rules} rules, ${p.on_by_default} on by default`);
  }
  if (r.seen_undeclared.length) {
    lines.push('', `Seen in the decision log (${r.log}), not declared, so they get no rules and a warning:`);
    for (const s of r.seen_undeclared)
      lines.push(
        `  ${s.model}: ${seenText(s)}; ` +
          (s.in_preset ? 'the preset has rules for it ("use": "preset")' : 'the preset has no rules for it ("use": "custom" with your own, or "use": "none")'),
      );
  }
  return lines.join('\n');
}

function scopesText(scopes: readonly string[]): string {
  return scopes.includes(ANY_SCOPE) ? 'every scope' : scopes.join(', ');
}

function seenText(s: Seen | undefined): string {
  return !s || s.decisions === 0 ? 'not seen in the decision log' : `seen in ${times(s.decisions)}, last ${s.last ?? 'at an unknown time'}`;
}

function times(n: number): string {
  return `${n} ${n === 1 ? 'decision' : 'decisions'}`;
}
