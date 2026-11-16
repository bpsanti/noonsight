// noonsight report: what the decision log says the hooks and the launcher did. For each rule, how
// often it was delivered, and to which models, scopes, places and events; the rules the
// configuration has on that the log never shows delivered; and the decisions that delivered
// nothing, by why. It reads local files only and changes nothing.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ConfigError, loadConfigDetails } from '../config/load.js';
import { configPath, stateDir, type Env } from '../config/paths.js';
import { ANY_SCOPE, type Config, type Place } from '../core/types.js';
import { LOG_FILE, readDecisionFile, readDecisions, ROTATED_LOG_FILE } from '../state/log.js';
import { UsageError } from './usage.js';

export const REPORT_USAGE = `usage: noonsight report [--json] [--log <file>]

Report what the decision log records: for each rule, how often it was delivered and to which
models, scopes, places and events, with the length of its text; the rules the configuration has on
that the log never shows delivered; and the decisions that delivered nothing, by why.

  --log <file>  read this log file instead of the account's decision log
  --json        print the same as JSON

Exits 0, or 2 for a usage error.`;

/** How a tally names a field the log line does not carry, such as the place on lines older than places. */
export const NOT_RECORDED = '(not recorded)';

/** How a tally names a task with no scope. */
export const NO_SCOPE = '(none)';

/** The values of `delivered` that mean the rules reached the model: by the hook, or in the system prompt. */
export const DELIVERING = ['rules', 'rules+note', 'system-prompt'] as const;

export interface Tally {
  readonly [key: string]: number;
}

export interface RuleReport {
  readonly id: string;
  readonly deliveries: number;
  /** Distinct session ids among the deliveries that carry one. */
  readonly sessions: number;
  readonly first: string | null;
  readonly last: string | null;
  readonly models: Tally;
  /** Scope name, NO_SCOPE for a task with no scope, or NOT_RECORDED. */
  readonly scopes: Tally;
  readonly places: Tally;
  readonly events: Tally;
  /** The rule's current text length in characters, per model, from the configuration; absent when it cannot be read. */
  readonly characters?: Readonly<Record<string, number>>;
}

export interface IdleRule {
  readonly id: string;
  readonly model: string;
  readonly scopes: readonly string[];
  readonly where: readonly Place[];
}

export interface Report {
  readonly log: readonly string[];
  readonly decisions: number;
  readonly first: string | null;
  readonly last: string | null;
  /** Decisions that delivered rules, by event. */
  readonly delivering: Tally;
  /** Decisions that delivered no rules, by why: a status, or a reason for status "none", or the `delivered` value. */
  readonly not_delivering: Tally;
  /** Subagent checks after the start, by result. */
  readonly agent_results: Tally;
  readonly rules: readonly RuleReport[];
  /** Read from the configuration: null when there is none or it is refused, with why. */
  readonly config: { readonly file: string; readonly status: 'read' | 'missing' | 'refused' };
  /** Rules on in the configuration for an exact model that no delivery in this log carries. */
  readonly never_delivered: readonly IdleRule[];
}

interface Options {
  readonly json: boolean;
  readonly log: string | null;
}

export function runReport(args: readonly string[], env: Env, out: (text: string) => void): number {
  const options = parseArgs(args);
  const report = buildReport(env, options);
  out(options.json ? JSON.stringify(report, null, 2) : renderReport(report));
  return 0;
}

function parseArgs(args: readonly string[]): Options {
  let json = false;
  let log: string | null = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i] as string;
    if (a === '--json') json = true;
    else if (a === '--log') {
      const value = args[++i];
      if (value === undefined || value === '') throw new UsageError(`${a} needs a value`, REPORT_USAGE);
      log = value;
    } else throw new UsageError(a.startsWith('-') ? `unknown option ${a}` : `unexpected argument "${a}"`, REPORT_USAGE);
  }
  return { json, log };
}

export function buildReport(env: Env, options: Pick<Options, 'log'>, home: string = os.homedir()): Report {
  const dir = stateDir(home);
  const files = options.log !== null ? [path.resolve(options.log)] : [path.join(dir, ROTATED_LOG_FILE), path.join(dir, LOG_FILE)];
  if (options.log !== null && !readableFile(files[0] as string)) throw new UsageError(`cannot read the log file ${options.log}`, REPORT_USAGE);
  const records = options.log !== null ? readDecisionFile(files[0] as string) : readDecisions(dir);

  const delivering: Record<string, number> = {};
  const notDelivering: Record<string, number> = {};
  const agentResults: Record<string, number> = {};
  const rules = new Map<string, MutableRule>();
  let first: string | null = null;
  let last: string | null = null;

  for (const r of records) {
    const ts = typeof r.ts === 'string' ? r.ts : null;
    if (ts !== null) {
      if (first === null || ts < first) first = ts;
      if (last === null || ts > last) last = ts;
    }
    const event = text(r.event) ?? NOT_RECORDED;
    if (event === 'agent-result') {
      count(agentResults, text(r.result) ?? NOT_RECORDED);
      continue;
    }
    const ids = Array.isArray(r.rules) ? r.rules.filter((x): x is string => typeof x === 'string') : [];
    if (!(DELIVERING as readonly unknown[]).includes(r.delivered) || ids.length === 0) {
      count(notDelivering, whyNothing(r));
      continue;
    }
    count(delivering, event);
    for (const id of ids) {
      const rule = rules.get(id) ?? newRule(id);
      rules.set(id, rule);
      rule.deliveries++;
      const session = text(r.session_id);
      if (session !== null) rule.sessions.add(session);
      if (ts !== null) {
        if (rule.first === null || ts < rule.first) rule.first = ts;
        if (rule.last === null || ts > rule.last) rule.last = ts;
      }
      count(rule.models, text(r.model) ?? NOT_RECORDED);
      // Lines older than scopes carry no scope field; a null scope is a task with no scope.
      count(rule.scopes, 'scope' in r ? (text(r.scope) ?? NO_SCOPE) : NOT_RECORDED);
      count(rule.places, text(r.place) ?? NOT_RECORDED);
      count(rule.events, event);
    }
  }

  const file = configPath(env, home);
  let config: Config | null = null;
  let status: Report['config']['status'] = fs.existsSync(file) ? 'read' : 'missing';
  if (status === 'read')
    try {
      config = loadConfigDetails(file, {}, env).config;
    } catch (e) {
      if (!(e instanceof ConfigError)) throw e;
      status = 'refused';
    }

  const lengths = config ? ruleLengths(config) : new Map<string, Map<string, number>>();
  const listed: RuleReport[] = [...rules.values()]
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
        ...(Object.keys(shown).length ? { characters: shown } : {}),
      };
    });

  const neverDelivered: IdleRule[] = [];
  if (config)
    for (const [model, entry] of config.exact) {
      if (entry.use !== 'rules') continue;
      for (const rule of entry.rules)
        if (!((rules.get(rule.id)?.models[model] ?? 0) > 0)) neverDelivered.push({ id: rule.id, model, scopes: rule.scopes, where: rule.where });
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
    config: { file, status },
    never_delivered: neverDelivered,
  };
}

interface MutableRule {
  readonly id: string;
  deliveries: number;
  readonly sessions: Set<string>;
  first: string | null;
  last: string | null;
  readonly models: Record<string, number>;
  readonly scopes: Record<string, number>;
  readonly places: Record<string, number>;
  readonly events: Record<string, number>;
}

function newRule(id: string): MutableRule {
  return { id, deliveries: 0, sessions: new Set(), first: null, last: null, models: {}, scopes: {}, places: {}, events: {} };
}

/**
 * Why a decision delivered no rules, in the log's own words: the reason of a "none" decision
 * (declared-none, no-rule-applies), the `delivered` value of a matched one (already-delivered,
 * launcher, off), or the status (undeclared, config-invalid, error).
 */
function whyNothing(r: Record<string, unknown>): string {
  const status = text(r.status);
  if (status === 'none') return text(r.reason) ?? 'none';
  if (status === 'matched') return text(r.delivered) ?? NOT_RECORDED;
  return status ?? NOT_RECORDED;
}

/** Each rule's text length, per exact model. */
function ruleLengths(config: Config): Map<string, Map<string, number>> {
  const lengths = new Map<string, Map<string, number>>();
  for (const [model, entry] of config.exact) {
    if (entry.use !== 'rules') continue;
    for (const rule of entry.rules) {
      const perModel = lengths.get(rule.id) ?? new Map<string, number>();
      perModel.set(model, rule.text.length);
      lengths.set(rule.id, perModel);
    }
  }
  return lengths;
}

function readableFile(file: string): boolean {
  try {
    fs.accessSync(file, fs.constants.R_OK);
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

function text(v: unknown): string | null {
  return typeof v === 'string' && v !== '' ? v : null;
}

function count(tally: Record<string, number>, key: string): void {
  tally[key] = (tally[key] ?? 0) + 1;
}

/** Most first, then by name. */
function sorted(tally: Record<string, number>): Tally {
  return Object.fromEntries(Object.entries(tally).sort(([a, x], [b, y]) => y - x || (a < b ? -1 : 1)));
}

export function renderReport(r: Report): string {
  const lines: string[] = [];
  lines.push(`log ${r.log.join(', ')}`);
  if (r.decisions === 0) {
    lines.push('No decisions in the log.');
  } else {
    lines.push(`${r.decisions} ${r.decisions === 1 ? 'decision' : 'decisions'}, from ${r.first ?? 'an unknown time'} to ${r.last ?? 'an unknown time'}`);
    lines.push(`  delivered rules: ${total(r.delivering)}${tallyText(r.delivering)}`);
    lines.push(`  delivered no rules: ${total(r.not_delivering)}${tallyText(r.not_delivering)}`);
    if (total(r.agent_results) > 0) lines.push(`  subagent checks: ${total(r.agent_results)}${tallyText(r.agent_results)}`);
  }

  if (r.rules.length) {
    lines.push('', 'Rules delivered, most often first:');
    for (const rule of r.rules) {
      lines.push(
        `  ${rule.id}: ${rule.deliveries} ${rule.deliveries === 1 ? 'delivery' : 'deliveries'}` +
          (rule.sessions ? ` in ${rule.sessions} ${rule.sessions === 1 ? 'session' : 'sessions'}` : '') +
          `, last ${rule.last ?? 'at an unknown time'}`,
      );
      lines.push(`     models: ${pairs(rule.models)}`);
      lines.push(`     scopes: ${pairs(rule.scopes)}`);
      lines.push(`     places: ${pairs(rule.places)}`);
      lines.push(`     events: ${pairs(rule.events)}`);
      if (rule.characters)
        lines.push(`     text: ${Object.entries(rule.characters).map(([model, n]) => `${n} characters for ${model}`).join(', ')}`);
    }
  }

  if (r.config.status === 'read') {
    if (r.never_delivered.length) {
      lines.push('', `On in the configuration (${r.config.file}), never delivered in this log:`);
      for (const idle of r.never_delivered)
        lines.push(`  ${idle.id} for ${idle.model} (scopes: ${idle.scopes.includes(ANY_SCOPE) ? 'every scope' : idle.scopes.join(', ')}; places: ${idle.where.join(', ')})`);
    } else if (r.rules.length) lines.push('', `Every rule on in the configuration (${r.config.file}) was delivered at least once in this log.`);
  } else
    lines.push(
      '',
      r.config.status === 'missing'
        ? `No configuration at ${r.config.file}, so rule lengths and the rules never delivered are not shown.`
        : `The configuration at ${r.config.file} is refused (\`noonsight check\` lists why), so rule lengths and the rules never delivered are not shown.`,
    );
  return lines.join('\n');
}

function total(t: Tally): number {
  return Object.values(t).reduce((a, b) => a + b, 0);
}

function tallyText(t: Tally): string {
  return total(t) ? ` (${pairs(t)})` : '';
}

function pairs(t: Tally): string {
  return Object.entries(t)
    .map(([k, n]) => `${k} ${n}`)
    .join(', ');
}
