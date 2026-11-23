// The oracle of the delivery benchmark: what one request to the Messages API holds, measured against
// the rules its model should have.
//
// The reference is noonsight's own resolver on a configuration that gives every model its preset
// rules: for a request of model M in a session of scope S and place P that has revealed the triggers T,
// the right rules are resolve(config, {model: M, scope: S, place: P, triggers: T}). Every arm is measured
// against this same reference, so the numbers of noonsight and of the native alternatives compare. A
// subagent's request is measured for the place `subagent`, with no scope and no trigger. A session in
// the benchmark's project (project/) is measured against the same configuration with the project's
// laid over it, as for a project this account trusts.
//
// The invariant, checked on every request of a session's own conversation and of each subagent:
//   missing-own        every right rule of the request's model is in the request;
//   own-retired        no model-change note that says the request's model's rules no longer apply comes
//                      after the last copy of one of them (a note names the models it retires, or says
//                      `*` for every model but the one the session now runs on);
//   foreign-unretired  a rule written only for other models is in the request only when a model-change
//                      note naming one of its models comes after its last copy.
//
// A rule is in a request when the first 160 characters of its text are in the request's text, read in
// the order the model reads it: the system prompt, then every message. A text two models share belongs
// to both.

import fs from 'node:fs';
import path from 'node:path';
import { loadConfigDetails } from '../../src/config/load.js';
import { PACKAGE_ROOT } from '../../src/config/paths.js';
import { PROJECT_FILE } from '../../src/config/project.js';
import { normalizeModel } from '../../src/core/normalize.js';
import { resolve } from '../../src/core/resolve.js';
import type { Config, Place, Trigger } from '../../src/core/types.js';
import { isCompaction, type Body } from './stub.js';

export const MODELS = ['claude-fable-5-2', 'claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'] as const;

/** The variable that puts a session in the place `unattended`, through `session.unattended_when_env`. */
export const UNATTENDED_ENV = 'NOONSIGHT_EXPERIMENT';

export const CLASSES = ['missing-own', 'own-retired', 'foreign-unretired'] as const;
export type ViolationClass = (typeof CLASSES)[number];

/** How long a prefix of a rule's text says the rule is in a request. */
const SIGNATURE = 160;

/** One distinct rule text of the preset, with every id and model that has it. */
export interface RuleText {
  readonly text: string;
  readonly sig: string;
  readonly ids: readonly string[];
  readonly owners: ReadonlySet<string>;
}

export interface Reference {
  readonly config: Config;
  readonly lib: readonly RuleText[];
  readonly byId: ReadonlyMap<string, RuleText>;
  readonly presetVersion: string;
}

/** The arms: noonsight with the preset, the three native alternatives, and nothing at all. */
export const ARMS = ['on', 'claudemd', 'rules', 'skills', 'off'] as const;
export type Arm = (typeof ARMS)[number];

/** noonsight's configuration for an arm: every model's preset rules under `on`, none under the others. */
export function configFor(arm: Arm): Record<string, unknown> {
  const use = arm === 'on' ? 'preset' : 'none';
  return { version: 1, models: Object.fromEntries(MODELS.map((m) => [m, { use }])), session: { unattended_when_env: [UNATTENDED_ENV] } };
}

interface PresetFile {
  readonly version: string;
  readonly models: Record<string, { rules: { id: string; file: string }[] }>;
}

/** The benchmark's project configuration, which a session with `project` has in `.noonsight/`. */
export const PROJECT_DIR = path.join(PACKAGE_ROOT, 'experiments', 'delivery', 'project');

/** Put the benchmark's project configuration into a project directory. */
export function writeProject(project: string): void {
  const dir = path.dirname(path.join(project, PROJECT_FILE));
  fs.mkdirSync(dir, { recursive: true });
  fs.cpSync(PROJECT_DIR, dir, { recursive: true });
}

/**
 * The reference configuration and every rule text it can deliver, from this checkout: with `project`,
 * the benchmark's project configuration laid over it, as for a project this account trusts. `workDir`
 * receives the configuration file, and the project directory when there is one.
 */
export function loadReference(workDir: string, project = false): Reference {
  const file = path.join(workDir, 'reference.noonsight.json');
  fs.mkdirSync(workDir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(configFor('on')));
  let layer = null;
  if (project) {
    const dir = path.join(workDir, 'reference-project');
    writeProject(dir);
    layer = { dir, file: path.join(dir, PROJECT_FILE), trusted: true };
  }
  const details = loadConfigDetails(file, { project: layer }, { NOONSIGHT_CONFIG: file });
  if (project && details.project?.status !== 'applied') throw new Error(`the benchmark's project configuration is ${details.project?.status}: ${details.project?.problems.join('; ')}`);
  const config = details.config;
  const byText = new Map<string, { text: string; sig: string; ids: string[]; owners: Set<string> }>();
  const add = (model: string, id: string, raw: string): void => {
    const text = raw.trim();
    const e = byText.get(text) ?? { text, sig: text.slice(0, SIGNATURE), ids: [], owners: new Set<string>() };
    if (!e.ids.includes(id)) e.ids.push(id);
    e.owners.add(model);
    byText.set(text, e);
  };
  // Every rule of the preset, those it turns off included, so that one a native arm writes is known;
  // then the rules the configuration adds, such as the project's.
  const dir = path.join(PACKAGE_ROOT, 'presets', 'claude');
  const preset = JSON.parse(fs.readFileSync(path.join(dir, 'preset.json'), 'utf8')) as PresetFile;
  for (const model of MODELS) for (const r of preset.models[model]?.rules ?? []) add(model, r.id, fs.readFileSync(path.join(dir, r.file), 'utf8'));
  for (const model of MODELS) {
    const entry = config.exact.get(model);
    for (const r of entry?.use === 'rules' ? entry.rules : []) add(model, r.id, r.text);
  }
  const lib = [...byText.values()];
  return { config, lib, byId: new Map(lib.flatMap((e) => e.ids.map((id) => [id, e] as const))), presetVersion: preset.version };
}

function blockText(b: unknown): string {
  if (typeof b === 'string') return b;
  const x = b as Body;
  if (x.type === 'text') return String(x.text ?? '');
  if (x.type === 'tool_result') return typeof x.content === 'string' ? x.content : ((x.content ?? []) as unknown[]).map(blockText).join('\n');
  if (x.type === 'tool_use') return JSON.stringify(x.input ?? {});
  return '';
}

/** The request's text in the order the model reads it: the system prompt, then every message. */
export function flatten(body: Body): string {
  const system = typeof body.system === 'string' ? [body.system] : ((body.system ?? []) as unknown[]).map(blockText);
  const messages = ((body.messages ?? []) as Body[]).flatMap((m) => (typeof m.content === 'string' ? [m.content] : ((m.content ?? []) as unknown[]).map(blockText)));
  return [...system, ...messages].join('\n');
}

function userText(m: Body | undefined): string {
  if (typeof m?.content === 'string') return m.content;
  return ((m?.content ?? []) as Body[])
    .filter((b) => b.type === 'text')
    .map((b) => String(b.text))
    .join('\n');
}

export type Kind = 'main' | 'subagent' | 'compact' | 'other';

/** main: a turn of the session; subagent: a turn of a subagent; compact: the summary Claude Code asks for; other: anything else. */
export function kindOf(body: Body): Kind {
  const users = ((body.messages ?? []) as Body[]).filter((m) => m.role === 'user');
  if (userText(users[0]).includes('DB-SUB')) return 'subagent';
  if (isCompaction(body)) return 'compact';
  if (!((body.tools ?? []) as unknown[]).length) return 'other';
  return 'main';
}

/** The Claude Code session a request belongs to, from the request's metadata. */
export function sessionIdOf(body: Body): string | null {
  try {
    return (JSON.parse(String(body.metadata?.user_id ?? '{}')) as { session_id?: string }).session_id ?? null;
  } catch {
    return null;
  }
}

function positions(hay: string, needle: string): number[] {
  const out: number[] = [];
  for (let at = hay.indexOf(needle); at >= 0; at = hay.indexOf(needle, at + needle.length)) out.push(at);
  return out;
}

/**
 * Which models a note retires, from its `from` attribute: one model, several separated by spaces, or
 * `*` for every model but the one the session now runs on.
 */
export function retiredBy(from: string, to: string): (model: string) => boolean {
  if (from === '*') return (m) => m !== to;
  const names = new Set(from.split(' ').filter(Boolean));
  return (m) => names.has(m);
}

const NOTE = /<noonsight-rules-change from="([^"]+)" to="([^"]+)">[\s\S]*?<\/noonsight-rules-change>/g;
const ENVELOPE_HEAD = /<noonsight-rules model="[^"]*"[^>]*>\n[^\n]*\n/g;
const ENVELOPE_TAIL = /<\/noonsight-rules>/g;

/** The characters of rule text in a request, by what they are to the request's model. */
export interface Chars {
  /** The first copy of each right rule. */
  readonly ownFirst: number;
  /** Every later copy of a right rule. */
  readonly ownDuplicate: number;
  /** Rules of the request's model that are not right here (another scope or place). */
  readonly ownUnexpected: number;
  /** Other models' rules that a later model-change note retires. */
  readonly foreignRetired: number;
  /** Other models' rules no later note retires. */
  readonly foreignUnretired: number;
  /** noonsight's envelopes and notes. */
  readonly overhead: number;
  /** All rule text: the five parts above but the overhead. */
  readonly rule: number;
  /** The whole request's text. */
  readonly request: number;
}

export interface Violation {
  readonly class: ViolationClass;
  readonly rules: readonly string[];
}

/** What one request held. */
export interface Fact {
  readonly kind: Kind;
  readonly model: string;
  readonly session: string | null;
  /** The right rules, by the first id of each text. */
  readonly expected: readonly string[];
  /** Every preset rule in the request, with its number of copies. */
  readonly present: readonly { id: string; copies: number }[];
  /** null when no rule is due; otherwise whether missing-own and own-retired both hold. */
  readonly covered: boolean | null;
  readonly expectedPresent: number;
  readonly chars: Chars;
  /** The model-change notes in the request, as `from>to`, `from` as the note's attribute writes it. */
  readonly notes: readonly string[];
  readonly violations: readonly Violation[];
}

export interface Where {
  readonly scope: string | null;
  readonly place: Place;
  /** The triggers the session had revealed when the request was sent. */
  readonly triggers: readonly Trigger[];
}

/** Measure one request against the reference. */
export function inspect(ref: Reference, body: Body, where: Where): Fact {
  const kind = kindOf(body);
  const model = normalizeModel(String(body.model ?? ''));
  const flat = flatten(body);
  const request = kind === 'subagent' ? { model, scope: null, place: 'subagent' as const, triggers: [] } : { model, scope: where.scope, place: where.place, triggers: where.triggers };
  const decision = resolve(ref.config, request);
  const expected = decision.status === 'matched' ? [...new Set(decision.rules.map((id) => ref.byId.get(id)).filter((e): e is RuleText => e !== undefined))] : [];
  const notes = [...flat.matchAll(NOTE)].map((m) => ({ at: m.index ?? 0, attr: m[1] ?? '', from: retiredBy(m[1] ?? '', m[2] ?? ''), to: m[2] ?? '', length: m[0].length }));
  const retiredAfter = (models: ReadonlySet<string>, at: number): boolean => notes.some((n) => n.at > at && [...models].some((m) => n.from(m)));

  let ownFirst = 0;
  let ownDuplicate = 0;
  let ownUnexpected = 0;
  let foreignRetired = 0;
  let foreignUnretired = 0;
  const missing: string[] = [];
  const ownRetired: string[] = [];
  const foreign: string[] = [];
  const present: { id: string; copies: number }[] = [];
  for (const e of ref.lib) {
    const at = positions(flat, e.sig);
    const id = e.ids[0] ?? '';
    const last = at.at(-1) ?? -1;
    if (e.owners.has(model)) {
      const wanted = expected.includes(e);
      if (!at.length) {
        if (wanted) missing.push(id);
        continue;
      }
      present.push({ id, copies: at.length });
      if (wanted) {
        ownFirst += e.text.length;
        ownDuplicate += (at.length - 1) * e.text.length;
        if (retiredAfter(new Set([model]), last)) ownRetired.push(id);
      } else ownUnexpected += at.length * e.text.length;
    } else if (at.length) {
      present.push({ id, copies: at.length });
      if (retiredAfter(e.owners, last)) foreignRetired += at.length * e.text.length;
      else {
        foreignUnretired += at.length * e.text.length;
        foreign.push(id);
      }
    }
  }
  const sum = (re: RegExp): number => [...flat.matchAll(re)].reduce((n, m) => n + m[0].length, 0);
  const overhead = notes.reduce((n, x) => n + x.length, 0) + sum(ENVELOPE_HEAD) + sum(ENVELOPE_TAIL);
  const violations: Violation[] = [];
  if (missing.length) violations.push({ class: 'missing-own', rules: missing });
  if (ownRetired.length) violations.push({ class: 'own-retired', rules: ownRetired });
  if (foreign.length) violations.push({ class: 'foreign-unretired', rules: foreign });
  return {
    kind,
    model,
    session: sessionIdOf(body),
    expected: expected.map((e) => e.ids[0] ?? ''),
    present,
    covered: expected.length === 0 ? null : missing.length === 0 && ownRetired.length === 0,
    expectedPresent: expected.length - missing.length,
    chars: { ownFirst, ownDuplicate, ownUnexpected, foreignRetired, foreignUnretired, overhead, rule: ownFirst + ownDuplicate + ownUnexpected + foreignRetired + foreignUnretired, request: flat.length },
    notes: notes.map((n) => `${n.attr}>${n.to}`),
    violations,
  };
}

/** A request of the session's conversation or of a subagent: the requests the measures count. */
export function isAgent(f: { kind: Kind }): boolean {
  return f.kind === 'main' || f.kind === 'subagent';
}
