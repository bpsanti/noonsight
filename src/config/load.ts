// Reads the configuration, the preset and every rule file, checks all of it, and builds the value
// the core resolves against. A configuration with any problem is refused whole and no partial
// configuration is ever applied. Problems are reported in passes: schema problems first, then
// preset problems, then every remaining problem together.

import fs from 'node:fs';
import path from 'node:path';
import { backtrackingRisk, type BacktrackingRisk } from '../core/backtracking.js';
import { NO_SCOPE_ANSWER } from '../core/classify.js';
import { normalizeModel } from '../core/normalize.js';
import { deliveryText, envelope, selectRules } from '../core/resolve.js';
import {
  ANY_SCOPE,
  DEFAULT_CLASSIFIER_SETTINGS,
  DEFAULT_ROUTING_SETTINGS,
  DEFAULT_SESSION_SETTINGS,
  DEFAULT_SUBAGENT_SETTINGS,
  DELIVERY_TEXT_LIMIT,
  MATCHER_FLAGS,
  PLACES,
  ROUTE_ALIASES,
  ROUTE_TARGETS,
  RULES_TEXT_LIMIT,
  SWITCH_NOTE_RESERVE,
  TRIGGERS,
} from '../core/types.js';
import type {
  ClassifierMode,
  Config,
  Effort,
  ModelEntry,
  Place,
  RouteRow,
  RouteTarget,
  RoutingSettings,
  Rule,
  Scope,
  ScopeMatcher,
  Trigger,
  WildcardKey,
} from '../core/types.js';
import { assertSupported, validateSchema, type Schema } from './json-schema.js';
import { presetsDir as defaultPresetsDir, SCHEMA_DIR, type Env } from './paths.js';

export class ConfigError extends Error {
  constructor(
    readonly file: string,
    readonly problems: readonly string[],
  ) {
    super(`configuration refused (${file}):\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'ConfigError';
  }
}

export interface LoadOptions {
  /** Directory that holds the presets; defaults to the package's own (see presetsDir). */
  readonly presetsDir?: string;
  /** The configuration file's content, read instead of the file; rule files are still found next to the file. */
  readonly content?: string;
}

// Shapes after schema validation. The schemas are the owners of these shapes.
interface RawUserRule {
  id: string;
  file: string;
  scopes?: string[];
  where?: Place[];
  triggers?: Trigger[];
}
interface RawModelEntry {
  use: 'preset' | 'custom' | 'none';
  enable?: string[];
  disable?: string[];
  add?: RawUserRule[];
}
interface RawScope {
  description?: string;
  match?: string[];
  /** Preset scopes only. */
  source?: Source;
}
interface RawRouteOption {
  model: string;
  effort?: Effort;
}
/** A list for every target, or a list per target. */
type RawRouteRow = RawRouteOption[] | Partial<Record<RouteTarget, RawRouteOption[]>>;
interface RawConfig {
  version: 1;
  preset?: string;
  preset_version?: string;
  on_preset_change?: PresetChangePolicy;
  all_models?: { add: RawUserRule[] };
  models?: Record<string, RawModelEntry>;
  on_undeclared?: 'warn' | 'ignore';
  scopes?: Record<string, RawScope>;
  session?: { unattended_when_env?: string[] };
  subagents?: { delivery?: 'prompt' | 'off'; permission?: 'allow' | 'ask' | 'passthrough'; on_mismatch?: 'warn' | 'ignore' };
  routing?: {
    enabled?: boolean;
    targets?: RouteTarget[];
    respect_explicit?: boolean;
    yield_when_env?: string[];
    table?: Record<string, RawRouteRow>;
    default?: 'inherit' | RawRouteRow;
  };
  classifier?: { mode?: ClassifierMode; model?: string; effort?: Effort; timeout_ms?: number };
}
interface RawPresetRule {
  id: string;
  file: string;
  scopes: string[];
  where: Place[];
  triggers?: Trigger[];
  renamed_from?: string[];
  enabled?: boolean;
  source: Source;
  effect: string;
  cost: string;
}
interface RawPreset {
  id: string;
  version: string;
  claude_code?: { version: string; checked: string };
  scopes?: Record<string, RawScope>;
  routing?: { table: Record<string, { route: RawRouteRow; basis: string; sources: Source[] }> };
  models: Record<string, { rules: RawPresetRule[] }>;
}

/** Where a preset rule or scope comes from: the page, the section and the date it was read. */
export interface Source {
  readonly url: string;
  readonly section: string;
  readonly date: string;
}

/** A preset rule, with what the preset says about it beside its text. */
export interface PresetRule extends Rule {
  /** Whether the rule is on unless the user turns it off. */
  readonly enabled: boolean;
  /** The ids this rule had in earlier versions of the preset, for the same model. */
  readonly renamedFrom: readonly string[];
  /** The rule file, relative to the preset directory. */
  readonly file: string;
  readonly source: Source;
  /** What the source reports the text changes. */
  readonly effect: string;
  /** What the source reports the text costs. */
  readonly cost: string;
}

/** A row of a preset's routing table, with what it rests on. */
export interface PresetRoute {
  readonly row: RouteRow;
  readonly basis: string;
  readonly sources: readonly Source[];
}

/** A preset as the package ships it, checked. */
export interface Preset {
  readonly name: string;
  readonly version: string;
  /** The Claude Code version whose system prompts the rules were compared with, and when. */
  readonly claudeCode: { readonly version: string; readonly checked: string } | null;
  /** The preset's scopes, in its order. */
  readonly scopes: ReadonlyMap<string, Scope>;
  readonly scopeSources: ReadonlyMap<string, Source>;
  /** The preset's routing table, by scope, in its order. */
  readonly routing: ReadonlyMap<string, PresetRoute>;
  readonly models: ReadonlyMap<string, readonly PresetRule[]>;
}

/** How the configuration file declares one model, as `noonsight models` shows it. */
export interface DeclaredModel {
  readonly use: 'preset' | 'custom' | 'none';
  readonly wildcard: boolean;
  /** The preset rule ids the entry turns on and off, as the configuration writes them. */
  readonly enable: readonly string[];
  readonly disable: readonly string[];
  /** The user's own rules, with their files as the configuration writes them. */
  readonly add: readonly { readonly id: string; readonly file: string }[];
}

/** One rule of the "all_models" block, with its file as the configuration writes it. */
export interface AllModelsRule {
  readonly id: string;
  readonly file: string;
}

/**
 * What a preset update does to a configuration: "warn" delivers the installed preset's rules and
 * reports what changed since the accepted version; "hold" keeps delivering the accepted version's.
 */
export type PresetChangePolicy = 'warn' | 'hold';

/** The preset version a configuration accepted, against the one the package ships. */
export interface PresetVersions {
  readonly name: string;
  /** The "preset_version" of the configuration, or null when it records none. */
  readonly accepted: string | null;
  readonly onChange: PresetChangePolicy;
  /** The preset the installed package ships, or null when it is not installed. */
  readonly installed: Preset | null;
}

/** The loaded configuration, plus what describes it: the preset it draws from and each model as declared. */
export interface ConfigDetails {
  readonly config: Config;
  /** The preset the rules come from, or null when it is not installed and nothing needs it. Under "hold", the accepted version's copy. */
  readonly preset: Preset | null;
  /** The accepted preset version and the installed one. */
  readonly presetVersions: PresetVersions;
  /** The model keys in the order the file writes them. */
  readonly declared: ReadonlyMap<string, DeclaredModel>;
  /** The rules of the "all_models" block, in the order the file writes them; empty when there is none. */
  readonly allModels: readonly AllModelsRule[];
}

/** The preset a configuration draws from when it names none. */
export const DEFAULT_PRESET = 'claude';

/** What a configuration does on a preset update when it names no policy. */
export const DEFAULT_PRESET_CHANGE_POLICY: PresetChangePolicy = 'warn';

/** Where a preset keeps the earlier versions the package still ships, inside its own directory. */
export const PRESET_VERSIONS_DIR = 'versions';

/** Read and check one installed preset on its own; a missing or failing preset throws a ConfigError. */
export function readPreset(name: string, options: LoadOptions = {}, env: Env = process.env): Preset {
  const dir = options.presetsDir ?? defaultPresetsDir(env);
  const problems: string[] = [];
  const preset = loadPreset(name, path.join(dir, name), null, true, problems);
  if (preset === null || problems.length) throw new ConfigError(path.join(dir, name, 'preset.json'), problems);
  return preset;
}

/**
 * Read and check one version of a preset: the installed preset when it is that version, else the
 * copy of that version the package keeps. Returns null when the package ships neither; a copy that
 * fails its checks throws a ConfigError.
 */
export function readPresetVersion(name: string, version: string, options: LoadOptions = {}, env: Env = process.env): Preset | null {
  const dir = options.presetsDir ?? defaultPresetsDir(env);
  const installed = readPreset(name, options, env);
  if (installed.version === version) return installed;
  const problems: string[] = [];
  const copy = loadPreset(name, versionDir(dir, name, version), version, false, problems);
  if (problems.length) throw new ConfigError(path.join(versionDir(dir, name, version), 'preset.json'), problems);
  return copy;
}

/** The directory of the copy of one earlier version of a preset. */
function versionDir(presetsDir: string, name: string, version: string): string {
  return path.join(presetsDir, name, PRESET_VERSIONS_DIR, version);
}

export function loadConfig(file: string, options: LoadOptions = {}, env: Env = process.env): Config {
  return loadConfigDetails(file, options, env).config;
}

/** As loadConfig, and also returns the preset and each model as the file declares it. */
export function loadConfigDetails(file: string, options: LoadOptions = {}, env: Env = process.env): ConfigDetails {
  const configFile = path.resolve(file);
  const problems: string[] = [];
  const report = (at: string, message: string): void => {
    problems.push(`${at}: ${message}`);
  };
  const refuse = (): never => {
    throw new ConfigError(configFile, problems);
  };

  const raw =
    options.content !== undefined
      ? parseJson(options.content, problems)
      : readJson(configFile, problems, 'no configuration file here; create one, or point NOONSIGHT_CONFIG at one');
  if (raw === undefined) refuse();
  problems.push(...validateSchema(schema('noonsight.schema.json'), raw));
  if (problems.length) refuse();
  const cfg = raw as RawConfig;
  const models = cfg.models ?? {};

  // The preset: always read when present, required when named or when a model uses it.
  const presetName = cfg.preset ?? DEFAULT_PRESET;
  const presetNeeded = cfg.preset !== undefined || Object.values(models).some((m) => m.use === 'preset');
  const presetsRoot = options.presetsDir ?? defaultPresetsDir(env);
  const installed = loadPreset(presetName, path.join(presetsRoot, presetName), null, presetNeeded, problems);
  if (problems.length) refuse();

  // Under "hold", the rules, scopes and routing table come from the accepted version, as the package keeps it.
  const accepted = cfg.preset_version ?? null;
  const onChange = cfg.on_preset_change ?? DEFAULT_PRESET_CHANGE_POLICY;
  let preset = installed;
  if (onChange === 'hold') {
    if (accepted === null)
      report(
        '/on_preset_change',
        `"hold" keeps the rules of the preset version in "preset_version", and the configuration records none; ` +
          `run \`noonsight accept\` to record ${installed ? `${installed.version}, the installed version` : 'the installed version'}`,
      );
    else if (installed !== null && installed.version !== accepted) {
      preset = loadPreset(presetName, versionDir(presetsRoot, presetName, accepted), accepted, false, problems);
      if (preset === null && !problems.length)
        report(
          '/preset_version',
          `preset "${presetName}" ${accepted} is held ("on_preset_change": "hold"), but the installed package ships ${installed.version} and keeps no copy of ${accepted}; ` +
            `run \`noonsight accept\` to take ${installed.version}, or install a noonsight version that ships ${accepted}`,
        );
    }
  }
  if (problems.length) refuse();

  // Under "warn", an enable or disable entry can name a rule the accepted version had and the installed
  // one no longer has: the update dropped it, so the entry is left out and reported, not refused.
  let former: Preset | null | undefined;
  const formerIds = (model: string): ReadonlySet<string> => {
    if (former === undefined) {
      former = null;
      if (accepted !== null && installed !== null && preset === installed && accepted !== installed.version) {
        const own: string[] = [];
        former = loadPreset(presetName, versionDir(presetsRoot, presetName, accepted), accepted, false, own);
        if (own.length) former = null;
      }
    }
    return new Set(former?.models.get(model)?.map((r) => r.id) ?? []);
  };

  const scopes = mergeScopes(preset?.scopes ?? new Map(), cfg.scopes ?? {}, report);
  const configDir = path.dirname(configFile);
  const exact = new Map<string, ModelEntry>();
  const wildcards: WildcardKey[] = [];
  const allModels = loadAllModels(cfg.all_models?.add ?? [], configDir, scopes, report);

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

    const rules: Rule[] = [];
    const presetIds = new Set(preset?.models.get(key)?.map((r) => r.id) ?? []);
    if (entry.use === 'preset') {
      const presetRules = preset?.models.get(key);
      if (preset && !presetRules) {
        report(at, `preset "${presetName}" has no rules for ${key}; declare it with "use": "custom" or "use": "none"`);
      } else if (presetRules) {
        const ids = new Set(presetRules.map((r) => r.id));
        // An entry that names a rule by an id it had before a rename still applies to the rule.
        const renamed = new Map(presetRules.flatMap((r) => r.renamedFrom.map((old) => [old, r.id] as const)));
        const pick = (list: 'enable' | 'disable'): Map<string, string> => {
          const picked = new Map<string, string>();
          for (const id of entry[list] ?? []) {
            const current = ids.has(id) ? id : renamed.get(id);
            if (current !== undefined) picked.set(current, id);
            else if (!formerIds(key).has(id)) report(`${at}/${list}`, `preset "${presetName}" has no rule "${id}" for ${key}`);
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
        for (const r of presetRules) {
          const on = (r.enabled || enable.has(r.id)) && !disable.has(r.id);
          if (on) rules.push({ id: r.id, origin: r.origin, scopes: r.scopes, where: r.where, triggers: r.triggers, text: r.text });
        }
      }
    }

    // The rules of every model come after the preset's and before the model's own.
    const taken = new Set(presetIds);
    allModels.forEach((r, i) => {
      if (presetIds.has(r.id)) report(`/all_models/add/${i}/id`, `rule id "${r.id}" is already a preset rule for ${key}; every model declared with "use": "preset" or "use": "custom" receives the rules of "all_models"`);
      taken.add(r.id);
      rules.push(r);
    });
    (entry.add ?? []).forEach((u, i) => {
      const ruleAt = `${at}/add/${i}`;
      if (allModels.some((r) => r.id === u.id)) report(`${ruleAt}/id`, `rule id "${u.id}" is already used for ${key} by "all_models"`);
      else if (taken.has(u.id)) report(`${ruleAt}/id`, `rule id "${u.id}" is already used for ${key}`);
      taken.add(u.id);
      const ruleScopes = u.scopes ?? [ANY_SCOPE];
      const where = u.where ?? [...PLACES];
      const triggers = u.triggers ?? [];
      checkScopes(ruleScopes, scopes, `${ruleAt}/scopes`, report);
      checkTriggers(ruleScopes, where, triggers, `${ruleAt}/triggers`, report);
      const text = readRuleText(path.resolve(configDir, u.file), `${ruleAt}/file`, report);
      if (text !== undefined) rules.push({ id: u.id, origin: 'user', scopes: ruleScopes, where, triggers, text });
    });

    checkDeliverySize(key, rules, scopes, at, report);
    exact.set(key, { use: 'rules', rules });
  }

  if (problems.length) refuse();
  wildcards.sort((a, b) => b.literal - a.literal || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const sub = cfg.subagents ?? {};
  const subagents = {
    delivery: sub.delivery ?? DEFAULT_SUBAGENT_SETTINGS.delivery,
    permission: sub.permission ?? DEFAULT_SUBAGENT_SETTINGS.permission,
    onMismatch: sub.on_mismatch ?? DEFAULT_SUBAGENT_SETTINGS.onMismatch,
  };
  const session = {
    unattendedWhenEnv: cfg.session?.unattended_when_env ?? DEFAULT_SESSION_SETTINGS.unattendedWhenEnv,
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
  if (problems.length) refuse();
  const declared = new Map<string, DeclaredModel>(
    Object.entries(models).map(([key, entry]) => [
      key,
      {
        use: entry.use,
        wildcard: /[*?]/.test(key),
        enable: entry.enable ?? [],
        disable: entry.disable ?? [],
        add: (entry.add ?? []).map((u) => ({ id: u.id, file: u.file })),
      },
    ]),
  );
  return {
    config: { exact, wildcards, onUndeclared: cfg.on_undeclared ?? 'warn', allModels, scopes, session, subagents, routing, classifier },
    preset,
    presetVersions: { name: presetName, accepted, onChange, installed },
    declared,
    allModels: (cfg.all_models?.add ?? []).map((u) => ({ id: u.id, file: u.file })),
  };
}

/**
 * The rules of the "all_models" block, read and checked once, in the same way as a model's own
 * "add". The id of each rule must also be new for every model that receives it; the loader checks
 * that where it assembles each model's rules.
 */
function loadAllModels(
  raw: readonly RawUserRule[],
  configDir: string,
  scopes: ReadonlyMap<string, Scope>,
  report: (at: string, message: string) => void,
): Rule[] {
  const ids = new Set<string>();
  const rules: Rule[] = [];
  raw.forEach((u, i) => {
    const at = `/all_models/add/${i}`;
    if (ids.has(u.id)) report(`${at}/id`, `rule id "${u.id}" is used more than once in "all_models"`);
    ids.add(u.id);
    const ruleScopes = u.scopes ?? [ANY_SCOPE];
    const where = u.where ?? [...PLACES];
    const triggers = u.triggers ?? [];
    checkScopes(ruleScopes, scopes, `${at}/scopes`, report);
    checkTriggers(ruleScopes, where, triggers, `${at}/triggers`, report);
    const text = readRuleText(path.resolve(configDir, u.file), `${at}/file`, report);
    if (text !== undefined) rules.push({ id: u.id, origin: 'user', scopes: ruleScopes, where, triggers, text, allModels: true });
  });
  return rules;
}

/**
 * Read and check the preset in one directory: the installed preset (version null), or the copy of
 * one earlier version, which must say it is that version. A missing preset is a problem only when
 * needed.
 */
function loadPreset(name: string, presetDir: string, version: string | null, needed: boolean, problems: string[]): Preset | null {
  const file = path.join(presetDir, 'preset.json');
  if (!fs.existsSync(file)) {
    if (needed) problems.push(`/preset: preset "${name}" is not installed (looked for ${file})`);
    return null;
  }
  const own: string[] = [];
  const report = (at: string, message: string): void => {
    own.push(`${at}: ${message}`);
  };
  const raw = readJson(file, own, 'cannot read the preset');
  if (raw !== undefined) own.push(...validateSchema(schema('preset.schema.json'), raw));
  if (own.length) {
    problems.push(...own.map((p) => `preset ${file}: ${p}`));
    return null;
  }

  const p = raw as RawPreset;
  if (p.id !== name) report('/id', `is "${p.id}", but the preset is installed as "${name}"`);
  if (version !== null && p.version !== version) report('/version', `is "${p.version}", but the copy is kept as version ${version}`);
  const scopes = new Map(Object.entries(p.scopes ?? {}).map(([name, raw]) => [name, toScope(name, raw, `/scopes/${name}`, report)]));
  const scopeSources = new Map(Object.entries(p.scopes ?? {}).flatMap(([name, raw]) => (raw.source ? [[name, raw.source] as const] : [])));
  const routing = new Map<string, PresetRoute>();
  for (const [scope, entry] of Object.entries(p.routing?.table ?? {})) {
    const at = `/routing/table/${scope}`;
    if (!scopes.has(scope)) report(at, `scope "${scope}" is not one of the preset's scopes`);
    routing.set(scope, { row: toRow(entry.route, `${at}/route`, report), basis: entry.basis, sources: entry.sources });
  }
  const models = new Map<string, PresetRule[]>();
  for (const [key, entry] of Object.entries(p.models)) {
    const at = `/models/${key}`;
    if (normalizeModel(key) !== key) report(at, `write the bare model identifier "${normalizeModel(key)}"`);
    const ids = new Set<string>();
    const rules: PresetRule[] = [];
    entry.rules.forEach((r, i) => {
      const ruleAt = `${at}/rules/${i}`;
      if (ids.has(r.id)) report(`${ruleAt}/id`, `rule id "${r.id}" is used more than once for ${key}`);
      ids.add(r.id);
      checkScopes(r.scopes, scopes, `${ruleAt}/scopes`, report);
      checkTriggers(r.scopes, r.where, r.triggers ?? [], `${ruleAt}/triggers`, report);
      const text = readRuleText(path.resolve(presetDir, r.file), `${ruleAt}/file`, report);
      if (text !== undefined)
        rules.push({
          id: r.id,
          origin: 'preset',
          scopes: r.scopes,
          where: r.where,
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
    if (rules.length === entry.rules.length) checkPresetSize(key, rules, scopes, at, report);
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
function checkRenames(model: string, rules: readonly RawPresetRule[], at: string, report: (at: string, message: string) => void): void {
  const current = new Set(rules.map((r) => r.id));
  const owner = new Map<string, string>();
  rules.forEach((r, i) =>
    (r.renamed_from ?? []).forEach((old, j) => {
      const oldAt = `${at}/rules/${i}/renamed_from/${j}`;
      if (current.has(old)) report(oldAt, `"${old}" is the id of a rule of ${model} in this version; renamed_from lists only ids the rule had in earlier versions`);
      else if (owner.has(old)) report(oldAt, `"${old}" is already an earlier id of rule "${owner.get(old)}"`);
      owner.set(old, r.id);
    }),
  );
}

/**
 * The declared scopes: the preset's, in its order, then the user's new ones, in theirs. A user scope
 * with a preset scope's name keeps that scope's place and replaces only the keys it gives.
 */
function mergeScopes(
  preset: ReadonlyMap<string, Scope>,
  user: Readonly<Record<string, RawScope>>,
  report: (at: string, message: string) => void,
): Map<string, Scope> {
  const scopes = new Map(preset);
  for (const [name, raw] of Object.entries(user)) scopes.set(name, toScope(name, raw, `/scopes/${name}`, report, scopes.get(name)));
  return scopes;
}

function toScope(name: string, raw: RawScope, at: string, report: (at: string, message: string) => void, base?: Scope): Scope {
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
function compileMatchers(
  scope: string,
  sources: readonly string[],
  at: string,
  report: (at: string, message: string) => void,
): ScopeMatcher[] {
  const out: ScopeMatcher[] = [];
  sources.forEach((source, i) => {
    let regex: RegExp;
    try {
      regex = new RegExp(source, MATCHER_FLAGS);
    } catch (e) {
      report(`${at}/${i}`, `not a valid regular expression (${(e as Error).message})`);
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

function describeRisk(risk: BacktrackingRisk): string {
  // Quoted as the pattern itself is quoted: as the configuration writes it.
  const [a = '', b = ''] = risk.parts.map((p) => `"${p}"`);
  switch (risk.kind) {
    case 'leading-any':
      return (
        `starts with ${a}, an unbounded repeat of any character with no "^" and only parts that can match nothing before it, so matching retries it from every position of the task text; ` +
        'start with a word instead (such as "\\binvestigat"), or anchor it with "^"'
      );
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
function loadRouting(
  raw: NonNullable<RawConfig['routing']>,
  preset: Preset | null,
  scopes: ReadonlyMap<string, Scope>,
  exact: ReadonlyMap<string, ModelEntry>,
  report: (at: string, message: string) => void,
): RoutingSettings {
  const table = new Map<string, RouteRow>();
  for (const [scope, entry] of preset?.routing ?? []) table.set(scope, entry.row);
  for (const [scope, rawRow] of Object.entries(raw.table ?? {})) {
    const at = `/routing/table/${scope}`;
    if (!scopes.has(scope)) report(at, `scope "${scope}" is not declared`);
    checkRouteModels(rawRow, at, exact, report);
    table.set(scope, toRow(rawRow, at, report));
  }
  let fallback: RouteRow | null = null;
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
function toRow(raw: RawRouteRow, at: string, report: (at: string, message: string) => void): RouteRow {
  if (Array.isArray(raw)) return Object.fromEntries(ROUTE_TARGETS.map((t) => [t, raw])) as RouteRow;
  if (Object.keys(raw).length === 0)
    report(at, `list the options for ${ROUTE_TARGETS.join(', ')} or both, or write the options as one list for every target`);
  return raw;
}

function checkRouteModels(
  raw: RawRouteRow,
  at: string,
  exact: ReadonlyMap<string, ModelEntry>,
  report: (at: string, message: string) => void,
): void {
  const lists: [string, RawRouteOption[]][] = Array.isArray(raw)
    ? [[at, raw]]
    : ROUTE_TARGETS.flatMap((t) => (raw[t] !== undefined ? [[`${at}/${t}`, raw[t]] as [string, RawRouteOption[]]] : []));
  for (const [listAt, options] of lists)
    options.forEach((option, i) => {
      if ((ROUTE_ALIASES as readonly string[]).includes(option.model) || exact.has(option.model)) return;
      report(
        `${listAt}/${i}/model`,
        `"${option.model}" is neither a model alias (${ROUTE_ALIASES.join(', ')}) nor a model declared under "models" with its exact identifier`,
      );
    });
}

function checkScopes(
  ruleScopes: readonly string[],
  declared: { has(name: string): boolean },
  at: string,
  report: (at: string, message: string) => void,
): void {
  if (ruleScopes.includes(ANY_SCOPE) && ruleScopes.length > 1)
    report(at, `"${ANY_SCOPE}" already covers every scope; list it alone`);
  for (const s of ruleScopes) if (s !== ANY_SCOPE && !declared.has(s)) report(at, `scope "${s}" is not declared`);
}

/**
 * A trigger delivers a rule to a session whose scope is not one of the rule's scopes, so it adds
 * nothing to a rule for every scope, and it acts only in a session's places.
 */
function checkTriggers(
  ruleScopes: readonly string[],
  where: readonly Place[],
  triggers: readonly Trigger[],
  at: string,
  report: (at: string, message: string) => void,
): void {
  if (triggers.length === 0) return;
  if (ruleScopes.includes(ANY_SCOPE)) report(at, `the rule is for every scope ("${ANY_SCOPE}"), so it already reaches every session; a trigger adds nothing`);
  if (!where.some((p) => p !== 'subagent')) report(at, 'a trigger acts only in a session, but the rule is only for the place "subagent"; add "session" or "unattended" to "where"');
}

/** The trigger sets a delivery can be made with: none, and every trigger revealed. */
const TRIGGER_SETS: readonly (readonly Trigger[])[] = [[], TRIGGERS];

/**
 * The text limit applies to what is delivered, so every combination of scope, place and revealed
 * triggers is checked. Part of Claude Code's limit is kept for the note sent along when the session's
 * model changes.
 */
function checkDeliverySize(
  model: string,
  rules: readonly Rule[],
  scopes: ReadonlyMap<string, Scope>,
  at: string,
  report: (at: string, message: string) => void,
  prefix = '',
): void {
  for (const scope of [null, ...[...scopes.keys()].sort()])
    for (const place of PLACES)
      for (const triggers of TRIGGER_SETS) {
        const picked = selectRules(rules, scope, place, triggers);
        // Without a trigger the rules are those checked without one.
        if (picked.length === 0 || (triggers.length && picked.length === selectRules(rules, scope, place).length)) continue;
        const size = deliveryText(model, picked, scope, triggers).text.length;
        if (size > RULES_TEXT_LIMIT) {
          const shared = picked.filter((r) => r.allModels).length;
          report(
            at,
            `${prefix}the rules delivered for ${scope === null ? 'no scope' : `scope "${scope}"`} in place "${place}"` +
              `${triggers.length ? ` once a session reveals ${triggers.join(', ')}` : ''} come to ${size} characters` +
              `${shared ? ` (${shared} of the ${picked.length} rules are from "all_models", which every model declared with "use": "preset" or "use": "custom" receives)` : ''}; ${LIMIT_TEXT}`,
          );
        }
      }
}

const LIMIT_TEXT =
  `the limit is ${RULES_TEXT_LIMIT} (Claude Code's ${DELIVERY_TEXT_LIMIT}, less ${SWITCH_NOTE_RESERVE} kept for the model-change note)`;

/**
 * A preset rule must fit on its own, and the preset's rules for a model must fit together with every
 * rule on, since the user decides which of them are on.
 */
function checkPresetSize(
  model: string,
  rules: readonly PresetRule[],
  scopes: ReadonlyMap<string, Scope>,
  at: string,
  report: (at: string, message: string) => void,
): void {
  let alone = true;
  rules.forEach((r, i) => {
    // The envelope names the scope, so the rule is measured under each scope it can be delivered in.
    const under = r.scopes.includes(ANY_SCOPE) ? [null, ...scopes.keys()] : r.scopes;
    const size = Math.max(
      ...under.map((scope) => envelope(model, scope, [r.id], r.text).length),
      // Delivered by a trigger: under no scope, or under a scope the rule does not list.
      ...(r.triggers.length
        ? [null, ...[...scopes.keys()].filter((s) => !r.scopes.includes(s))].map((scope) => envelope(model, scope, [r.id], r.text, r.triggers).length)
        : []),
    );
    if (size > RULES_TEXT_LIMIT) {
      alone = false;
      report(`${at}/rules/${i}/file`, `rule "${r.id}" comes to ${size} characters on its own, envelope included; ${LIMIT_TEXT}`);
    }
  });
  if (alone) checkDeliverySize(model, rules, scopes, at, report, 'with every rule on, ');
}

function readRuleText(file: string, at: string, report: (at: string, message: string) => void): string | undefined {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    report(at, `cannot read ${file} (${(e as NodeJS.ErrnoException).code ?? String(e)})`);
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

function readJson(file: string, problems: string[], missing: string): unknown {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    problems.push(code === 'ENOENT' ? missing : `cannot read the file (${code ?? String(e)})`);
    return undefined;
  }
  return parseJson(text, problems);
}

function parseJson(text: string, problems: string[]): unknown {
  try {
    return JSON.parse(text);
  } catch (e) {
    problems.push(`not valid JSON: ${(e as Error).message}`);
    return undefined;
  }
}

function compileWildcard(key: string): WildcardKey {
  const source = [...key]
    .map((c) => (c === '*' ? '.*' : c === '?' ? '.' : c.replace(/[.+^${}()|[\]\\-]/g, '\\$&')))
    .join('');
  return { key, pattern: new RegExp(`^${source}$`), literal: key.replace(/[*?]/g, '').length };
}

const schemaCache = new Map<string, Schema>();
function schema(name: string): Schema {
  let s = schemaCache.get(name);
  if (!s) {
    s = JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, name), 'utf8')) as Schema;
    assertSupported(s);
    schemaCache.set(name, s);
  }
  return s;
}
