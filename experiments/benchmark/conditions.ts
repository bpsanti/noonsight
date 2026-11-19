// The conditions of the pilot. Every condition runs the same agent, the same Claude Code, the same
// hooks and the same noonsight build; what differs is noonsight's configuration file and, for the
// conditions that stand for the usual alternative to noonsight, a CLAUDE.md:
//
// - off: the model declared "use": "none"; the hook runs and logs declared-none.
// - on: "use": "preset"; the preset's default-on rules for the model, scope and place.
// - claudemd: as off, plus the user's CLAUDE.md holding every default-on rule of every model, under
//   one heading per model, each with its scopes and places as a line of text: one Markdown file that
//   every model reads.
// - scattered: as off, plus a user CLAUDE.md that only points to a file holding those same rules, so
//   the rules reach the session only if the agent decides to read that file.
//
// The pre-registered placebo was replaced by claudemd and scattered before it ran; its texts stay in
// placebo/ as pre-registration artifacts, and no condition reads them.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { withNoonsightHooks } from '../../src/adapters/claude-code/settings.js';
import { PACKAGE_ROOT } from '../../src/config/paths.js';
import type { Plan } from './plan.js';

/** Where the agent installs noonsight inside a task container. */
export const CONTAINER = {
  root: '/opt/noonsight',
  pointer: '/opt/noonsight/bin/noonsight-hook',
  config: '/opt/noonsight/config/noonsight.json',
  /** noonsight's home for the hook, under the logs Harbor copies out, so the decision log comes back with the run. */
  home: '/logs/agent/noonsight-home',
  /** Where the instruction-load hook writes, under the logs Harbor copies out. */
  instructions: '/logs/agent/instructions',
  /** The rules file of the scattered condition, outside the task's repository. */
  rulesFile: '/opt/agent-notes/rules.md',
} as const;

export interface PresetRule {
  readonly id: string;
  readonly file: string;
  readonly scopes?: readonly string[];
  readonly where?: readonly string[];
  readonly enabled?: boolean;
}

interface Preset {
  readonly models: Record<string, { rules: PresetRule[] }>;
}

function preset(): Preset {
  return JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'presets', 'claude', 'preset.json'), 'utf8')) as Preset;
}

/** The rules a model receives under "use": "preset": those not shipped off. */
export function defaultOnRules(model: string): PresetRule[] {
  return (preset().models[model]?.rules ?? []).filter((r) => r.enabled !== false);
}

export function presetText(rule: PresetRule): string {
  return fs.readFileSync(path.join(PACKAGE_ROOT, 'presets', 'claude', rule.file), 'utf8');
}

/** A model id as a reader would name it: `claude-sonnet-5-5` is "Claude Sonnet 5.5". */
export function modelName(id: string): string {
  const [vendor, family, ...version] = id.split('-');
  const cap = (s: string | undefined): string => (s ? s[0]!.toUpperCase() + s.slice(1) : '');
  return `${cap(vendor)} ${cap(family)} ${version.join('.')}`;
}

const PLACES: Readonly<Record<string, string>> = { session: 'when someone is watching', unattended: 'when nobody is watching', subagent: 'in subagents' };

/**
 * Every default-on rule of the given models as one Markdown file: a heading per model, and under it
 * each rule with its scopes and places as one line of text, then the rule's text unchanged.
 */
export function unionRules(models: readonly string[]): string {
  const out = ['# Working rules', '', 'Each section is written for one model.', ''];
  for (const model of models) {
    out.push(`## For ${modelName(model)}`, '');
    for (const r of defaultOnRules(model)) {
      const scopes = !r.scopes || r.scopes.includes('*') ? 'every kind of task' : `tasks of kind ${r.scopes.join(', ')}`;
      const places = (r.where ?? Object.keys(PLACES)).map((w) => PLACES[w] ?? w).join(', ');
      out.push(`### ${r.id.split('/')[1] ?? r.id}`, '', `Applies to: ${scopes}; ${places}.`, '', presetText(r).trim(), '');
    }
  }
  return `${out.join('\n').trimEnd()}\n`;
}

/** The user CLAUDE.md of the scattered condition: a pointer, not an import, so nothing loads with it. */
export const POINTER_CLAUDE_MD = `Working rules for each model are in ${CONTAINER.rulesFile}; read them before you start.\n`;

/**
 * The share of the given rule text that was written for `model`, by length, or null when there is no
 * rule text: what a request or run of that model received, written for it, over all it received.
 */
export function ownShare(model: string, rules: readonly PresetRule[]): number | null {
  const size = (rs: readonly PresetRule[]): number => rs.reduce((n, r) => n + presetText(r).trim().length, 0);
  const all = size(rules);
  if (all === 0) return null;
  const own = new Set(defaultOnRules(model).map((r) => r.id));
  return size(rules.filter((r) => own.has(r.id))) / all;
}

export interface ConditionFiles {
  /** noonsight's configuration. */
  readonly config: Record<string, unknown>;
  /** The user CLAUDE.md the session gets, if any. */
  readonly claudeMd: string | null;
  /** The scattered condition's rules file, if any. */
  readonly rulesFile: string | null;
}

/** One condition for one model: noonsight's configuration and the Markdown the condition adds. */
export function conditionConfig(plan: Plan, model: string, condition: string): ConditionFiles {
  const c = plan.conditions[condition];
  if (!c) throw new Error(`unknown condition ${condition}`);
  const session = { unattended_when_env: [plan.unattended_env] };
  const models = Object.values(plan.models).map((m) => m.id);
  if (c.claude_md === 'union') return { config: { version: 1, models: { [model]: { use: 'none' } }, session }, claudeMd: unionRules(models), rulesFile: null };
  if (c.claude_md === 'pointer') return { config: { version: 1, models: { [model]: { use: 'none' } }, session }, claudeMd: POINTER_CLAUDE_MD, rulesFile: unionRules(models) };
  return { config: { version: 1, models: { [model]: { use: c.use } }, session }, claudeMd: null, rulesFile: null };
}

/**
 * The Claude Code settings: noonsight's hooks through the pointer the agent installs, and, where the
 * condition adds a CLAUDE.md, an InstructionsLoaded hook that only records each instruction load.
 */
export function hookSettings(logInstructions = false): Record<string, unknown> {
  const settings = withNoonsightHooks({}, CONTAINER.pointer).settings as Record<string, any>;
  if (logInstructions)
    settings.hooks.InstructionsLoaded = [{ hooks: [{ type: 'command', command: `mkdir -p ${CONTAINER.instructions} && cat > ${CONTAINER.instructions}/$(date +%s%N)-$$.json`, timeout: 10 }] }];
  return settings;
}

/**
 * Write a condition into `dir`: config/noonsight.json, claude/ (CLAUDE.md and
 * the rules file, when the condition has them) and settings.json for Claude Code. Returns the
 * sha256 of everything the condition delivers.
 */
export function writeCondition(plan: Plan, model: string, condition: string, dir: string): string {
  const { config, claudeMd, rulesFile } = conditionConfig(plan, model, condition);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'config'), { recursive: true });
  const text = `${JSON.stringify(config, null, 2)}\n`;
  fs.writeFileSync(path.join(dir, 'config', 'noonsight.json'), text);
  const extra: Record<string, string> = {};
  if (claudeMd !== null) extra['CLAUDE.md'] = claudeMd;
  if (rulesFile !== null) extra['rules.md'] = rulesFile;
  if (Object.keys(extra).length) fs.mkdirSync(path.join(dir, 'claude'), { recursive: true });
  for (const [name, body] of Object.entries(extra)) fs.writeFileSync(path.join(dir, 'claude', name), body);
  fs.writeFileSync(path.join(dir, 'settings.json'), `${JSON.stringify(hookSettings(claudeMd !== null), null, 2)}\n`);
  const h = createHash('sha256').update(text);
  for (const name of Object.keys(extra).sort()) h.update(`claude/${name}`).update(extra[name] as string);
  return h.digest('hex');
}
