// The conditions of the pilot. Every condition runs the same agent, the same Claude Code, the same
// hooks and the same noonsight build; only noonsight's configuration file differs, and with it the
// text the SessionStart hook delivers:
//
// - off: the model declared "use": "none"; the hook runs and logs declared-none.
// - on: "use": "preset"; the preset's default-on rules for the model, scope and place.
// - placebo: "use": "custom" with one neutral text per default-on rule of the model, each with that
//   rule's scopes and places and its length within 2 percent, so the same number of rules of the
//   same size arrives in the same places, saying nothing the rules say.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { withNoonsightHooks } from '../../src/adapters/claude-code/settings.js';
import { PACKAGE_ROOT } from '../../src/config/paths.js';
import { BENCH_DIR, type Plan } from './plan.js';

/** Where the agent installs noonsight inside a task container. */
export const CONTAINER = {
  root: '/opt/noonsight',
  pointer: '/opt/noonsight/bin/noonsight-hook',
  config: '/opt/noonsight/config/noonsight.json',
  /** noonsight's home for the hook, under the logs Harbor copies out, so the decision log comes back with the run. */
  home: '/logs/agent/noonsight-home',
} as const;

interface PresetRule {
  readonly id: string;
  readonly file: string;
  readonly scopes?: readonly string[];
  readonly where?: readonly string[];
  readonly enabled?: boolean;
}

function presetRules(model: string): PresetRule[] {
  const preset = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'presets', 'claude', 'preset.json'), 'utf8')) as { models: Record<string, { rules: PresetRule[] }> };
  return preset.models[model]?.rules ?? [];
}

/** The rules a model receives under "use": "preset": those not shipped off. */
export function defaultOnRules(model: string): PresetRule[] {
  return presetRules(model).filter((r) => r.enabled !== false);
}

export function presetText(rule: PresetRule): string {
  return fs.readFileSync(path.join(PACKAGE_ROOT, 'presets', 'claude', rule.file), 'utf8');
}

export function placeboText(file: string): string {
  return fs.readFileSync(path.join(BENCH_DIR, 'placebo', file), 'utf8');
}

/** One condition's noonsight configuration for one model, and the rule files it names, by file name. */
export function conditionConfig(plan: Plan, model: string, condition: string): { config: Record<string, unknown>; files: Record<string, string> } {
  const c = plan.conditions[condition];
  if (!c) throw new Error(`unknown condition ${condition}`);
  const session = { unattended_when_env: [plan.unattended_env] };
  if (!c.placebo) return { config: { version: 1, models: { [model]: { use: c.use } }, session }, files: {} };
  const placebos = plan.placebo[model] ?? [];
  const rules = defaultOnRules(model);
  if (placebos.length !== rules.length) throw new Error(`${model} has ${rules.length} default-on rules but ${placebos.length} placebo texts`);
  const files: Record<string, string> = {};
  const add = placebos.map((p) => {
    const mirror = rules.find((r) => r.id === p.mirrors);
    if (!mirror) throw new Error(`placebo ${p.id} mirrors ${p.mirrors}, which is not a default-on rule of ${model}`);
    files[p.file] = placeboText(p.file);
    return { id: p.id, file: p.file, ...(mirror.scopes ? { scopes: mirror.scopes } : {}), ...(mirror.where ? { where: mirror.where } : {}) };
  });
  return { config: { version: 1, models: { [model]: { use: 'custom', add } }, session }, files };
}

/** The Claude Code settings that run noonsight's hooks through the pointer the agent installs. */
export function hookSettings(): Record<string, unknown> {
  return withNoonsightHooks({}, CONTAINER.pointer).settings as Record<string, unknown>;
}

/** Write a condition into `dir`: noonsight.json, its rule files, and settings.json for Claude Code. Returns the sha256 of the configuration. */
export function writeCondition(plan: Plan, model: string, condition: string, dir: string): string {
  const { config, files } = conditionConfig(plan, model, condition);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'config'), { recursive: true });
  const text = `${JSON.stringify(config, null, 2)}\n`;
  fs.writeFileSync(path.join(dir, 'config', 'noonsight.json'), text);
  for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, 'config', name), body);
  fs.writeFileSync(path.join(dir, 'settings.json'), `${JSON.stringify(hookSettings(), null, 2)}\n`);
  const h = createHash('sha256').update(text);
  for (const name of Object.keys(files).sort()) h.update(name).update(files[name] as string);
  return h.digest('hex');
}
