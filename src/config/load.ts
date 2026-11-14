// Reads the configuration, the preset and every rule file, checks all of it, and builds the value
// the core resolves against. A configuration with any problem is refused whole and no partial
// configuration is ever applied. Problems are reported in passes: schema problems first, then
// preset problems, then every remaining problem together.

import fs from 'node:fs';
import path from 'node:path';
import { normalizeModel } from '../core/normalize.js';
import { envelope, joinRules, selectRules } from '../core/resolve.js';
import { ANY_SCOPE, DELIVERY_TEXT_LIMIT, PLACES } from '../core/types.js';
import type { Config, ModelEntry, Place, Rule, WildcardKey } from '../core/types.js';
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
}

// Shapes after schema validation. The schemas are the owners of these shapes.
interface RawUserRule {
  id: string;
  file: string;
  scopes?: string[];
  where?: Place[];
}
interface RawModelEntry {
  use: 'preset' | 'custom' | 'none';
  enable?: string[];
  disable?: string[];
  add?: RawUserRule[];
}
interface RawConfig {
  version: 1;
  preset?: string;
  models?: Record<string, RawModelEntry>;
  on_undeclared?: 'warn' | 'ignore';
  scopes?: Record<string, { description?: string }>;
}
interface RawPresetRule {
  id: string;
  file: string;
  scopes: string[];
  where: Place[];
  enabled?: boolean;
}
interface RawPreset {
  id: string;
  version: string;
  scopes?: Record<string, { description?: string }>;
  models: Record<string, { rules: RawPresetRule[] }>;
}

interface PresetRule extends Rule {
  readonly enabled: boolean;
}
interface Preset {
  readonly scopes: ReadonlySet<string>;
  readonly models: ReadonlyMap<string, readonly PresetRule[]>;
}

const DEFAULT_PRESET = 'claude';

export function loadConfig(file: string, options: LoadOptions = {}, env: Env = process.env): Config {
  const configFile = path.resolve(file);
  const problems: string[] = [];
  const report = (at: string, message: string): void => {
    problems.push(`${at}: ${message}`);
  };
  const refuse = (): never => {
    throw new ConfigError(configFile, problems);
  };

  const raw = readJson(configFile, problems, 'no configuration file here; create one, or point SEXTANT_CONFIG at one');
  if (raw === undefined) refuse();
  problems.push(...validateSchema(schema('sextant.schema.json'), raw));
  if (problems.length) refuse();
  const cfg = raw as RawConfig;
  const models = cfg.models ?? {};

  // The preset: always read when present, required when named or when a model uses it.
  const presetName = cfg.preset ?? DEFAULT_PRESET;
  const presetNeeded = cfg.preset !== undefined || Object.values(models).some((m) => m.use === 'preset');
  const preset = loadPreset(presetName, options.presetsDir ?? defaultPresetsDir(env), presetNeeded, problems);
  if (problems.length) refuse();

  const scopes = new Set<string>([...(preset?.scopes ?? []), ...Object.keys(cfg.scopes ?? {})]);
  const configDir = path.dirname(configFile);
  const exact = new Map<string, ModelEntry>();
  const wildcards: WildcardKey[] = [];

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
    if (entry.use === 'preset') {
      const presetRules = preset?.models.get(key);
      if (preset && !presetRules) {
        report(at, `preset "${presetName}" has no rules for ${key}; declare it with "use": "custom" or "use": "none"`);
      } else if (presetRules) {
        const ids = new Set(presetRules.map((r) => r.id));
        const enable = new Set(entry.enable ?? []);
        const disable = new Set(entry.disable ?? []);
        for (const [list, set] of [['enable', enable], ['disable', disable]] as const)
          for (const id of set) if (!ids.has(id)) report(`${at}/${list}`, `preset "${presetName}" has no rule "${id}" for ${key}`);
        for (const id of enable) if (disable.has(id)) report(at, `rule "${id}" is both enabled and disabled`);
        for (const r of presetRules) {
          const on = (r.enabled || enable.has(r.id)) && !disable.has(r.id);
          if (on) rules.push({ id: r.id, origin: r.origin, scopes: r.scopes, where: r.where, text: r.text });
        }
      }
    }

    const taken = new Set(preset?.models.get(key)?.map((r) => r.id) ?? []);
    (entry.add ?? []).forEach((u, i) => {
      const ruleAt = `${at}/add/${i}`;
      if (taken.has(u.id)) report(`${ruleAt}/id`, `rule id "${u.id}" is already used for ${key}`);
      taken.add(u.id);
      const ruleScopes = u.scopes ?? [ANY_SCOPE];
      checkScopes(ruleScopes, scopes, `${ruleAt}/scopes`, report);
      const text = readRuleText(path.resolve(configDir, u.file), `${ruleAt}/file`, report);
      if (text !== undefined)
        rules.push({ id: u.id, origin: 'user', scopes: ruleScopes, where: u.where ?? [...PLACES], text });
    });

    checkDeliverySize(key, rules, scopes, at, report);
    exact.set(key, { use: 'rules', rules });
  }

  if (problems.length) refuse();
  wildcards.sort((a, b) => b.literal - a.literal || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return { exact, wildcards, onUndeclared: cfg.on_undeclared ?? 'warn', scopes };
}

function loadPreset(name: string, dir: string, needed: boolean, problems: string[]): Preset | null {
  const presetDir = path.join(dir, name);
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
  const scopes = new Set(Object.keys(p.scopes ?? {}));
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
      const text = readRuleText(path.resolve(presetDir, r.file), `${ruleAt}/file`, report);
      if (text !== undefined)
        rules.push({ id: r.id, origin: 'preset', scopes: r.scopes, where: r.where, text, enabled: r.enabled ?? true });
    });
    models.set(key, rules);
  }
  if (own.length) {
    problems.push(...own.map((p) => `preset ${file}: ${p}`));
    return null;
  }
  return { scopes, models };
}

function checkScopes(
  ruleScopes: readonly string[],
  declared: ReadonlySet<string>,
  at: string,
  report: (at: string, message: string) => void,
): void {
  if (ruleScopes.includes(ANY_SCOPE) && ruleScopes.length > 1)
    report(at, `"${ANY_SCOPE}" already covers every scope; list it alone`);
  for (const s of ruleScopes) if (s !== ANY_SCOPE && !declared.has(s)) report(at, `scope "${s}" is not declared`);
}

/** The text limit applies to what is delivered, so every combination of scope and place is checked. */
function checkDeliverySize(
  model: string,
  rules: readonly Rule[],
  scopes: ReadonlySet<string>,
  at: string,
  report: (at: string, message: string) => void,
): void {
  for (const scope of [null, ...[...scopes].sort()])
    for (const place of PLACES) {
      const picked = selectRules(rules, scope, place);
      if (picked.length === 0) continue;
      const size = envelope(model, scope, picked.map((r) => r.id), joinRules(picked)).length;
      if (size > DELIVERY_TEXT_LIMIT)
        report(
          at,
          `the rules delivered for ${scope === null ? 'no scope' : `scope "${scope}"`} in place "${place}" ` +
            `come to ${size} characters; the limit is ${DELIVERY_TEXT_LIMIT}`,
        );
    }
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
