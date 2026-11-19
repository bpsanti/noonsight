// The tables a pilot's reading is written from, computed from its result files alone: what each
// condition delivered to each run and how much of it was written for the run's model (the primary
// measure), what a run cost under each condition, and the verifier's and the judge's verdicts.
// `npm run benchmark -- summarize --results <dir>` prints them for a folder holding runs.jsonl,
// decisions.jsonl, grades.jsonl and, if present, signals.jsonl and delivery-probe/delivery.json.

import path from 'node:path';
import fs from 'node:fs';
import { defaultOnRules, ownShare } from './conditions.js';
import { PROBE, type Delivery } from './delivery.js';
import type { Grade } from './judge.js';
import { readJsonl, type Recorded, type RunRecord } from './run.js';
import type { Signals } from './score.js';
import { OPEN_SETS } from './tasks.js';

/** The conditions in the order the tables show them. */
export const CONDITION_ORDER = ['off', 'on', 'claudemd', 'scattered'] as const;

/** One line of noonsight's decision log, as far as the summary reads it. */
export interface DecisionLine {
  readonly event: string;
  readonly model?: string;
  readonly from_model?: string;
  readonly source?: string;
  readonly status?: string;
  readonly delivered?: string;
  readonly experiment_run?: string;
}

export interface Results {
  readonly runs: readonly RunRecord[];
  readonly decisions: readonly DecisionLine[];
  readonly grades: readonly Grade[];
  /** The delivery probe's rows per condition, when the folder holds them. */
  readonly probe: Readonly<Record<string, readonly Delivery[]>> | null;
}

/** The result files of one pilot. Infrastructure failures leave the analysis; a rescored signal replaces the recorded one. */
export function readResults(dir: string): Results {
  const rescored = new Map(readJsonl<{ key: string; signals: Signals }>(path.join(dir, 'signals.jsonl')).map((s) => [s.key, s.signals]));
  const runs = readJsonl<Recorded>(path.join(dir, 'runs.jsonl'))
    .filter((r): r is RunRecord => r.infra_failure === null)
    .map((r) => ({ ...r, signals: rescored.get(r.key) ?? r.signals }));
  const probeFile = path.join(dir, 'delivery-probe', 'delivery.json');
  const probe = fs.existsSync(probeFile) ? (JSON.parse(fs.readFileSync(probeFile, 'utf8')) as Record<string, Delivery[]>) : null;
  return { runs, decisions: readJsonl<DecisionLine>(path.join(dir, 'decisions.jsonl')), grades: readJsonl<Grade>(path.join(dir, 'grades.jsonl')), probe };
}

/** The rules noonsight's preset gives a model in a scope and place, in the preset's order. */
export function expectedRules(model: string, scope: string, place: string): string[] {
  return defaultOnRules(model)
    .filter((r) => !r.scopes || r.scopes.includes('*') || r.scopes.includes(scope))
    .filter((r) => !r.where || r.where.includes(place))
    .map((r) => r.id);
}

/** A user CLAUDE.md the InstructionsLoaded hook saw load at the session's start. */
function loadedUserClaudeMd(r: RunRecord): boolean {
  return (r.instruction_loads ?? []).some((l) => l.memory_type === 'User' && l.load_reason === 'session_start' && (l.file_path ?? '').endsWith('/CLAUDE.md'));
}

export interface DeliveryCheck {
  readonly condition: string;
  readonly runs: number;
  /** Runs that received exactly what the condition is meant to deliver. */
  readonly as_expected: number;
  /** Keys of the runs that did not. */
  readonly unexpected: readonly string[];
  /** Distinct condition texts per model: 1 means every run of a model got the same text. */
  readonly texts_per_model: Readonly<Record<string, number>>;
}

/**
 * Whether each run received what its condition delivers: under `off`, nothing from noonsight; under
 * `on`, exactly the preset's rules for the run's model, scope and place; under `claudemd` and
 * `scattered`, nothing from noonsight and the user CLAUDE.md loaded at the session's start. That `off`
 * and `on` get no CLAUDE.md holds by construction (their condition writes none, and installs no
 * InstructionsLoaded hook), so it is not observed here.
 */
export function deliveryCheck(runs: readonly RunRecord[]): DeliveryCheck[] {
  return CONDITION_ORDER.map((condition) => {
    const rs = runs.filter((r) => r.condition === condition);
    const ok = (r: RunRecord): boolean => {
      const n = r.noonsight;
      const quiet = n.status === 'none' && n.reason === 'declared-none' && n.rules.length === 0;
      if (condition === 'off') return quiet;
      if (condition === 'on') return n.status === 'matched' && n.scope !== null && n.place !== null && JSON.stringify(n.rules) === JSON.stringify(expectedRules(r.model_id, n.scope, n.place));
      return quiet && loadedUserClaudeMd(r);
    };
    const texts: Record<string, Set<string>> = {};
    for (const r of rs) (texts[r.model] ??= new Set()).add(r.pins.condition_sha256);
    return {
      condition,
      runs: rs.length,
      as_expected: rs.filter(ok).length,
      unexpected: rs.filter((r) => !ok(r)).map((r) => r.key),
      texts_per_model: Object.fromEntries(Object.entries(texts).map(([m, s]) => [m, s.size])),
    };
  });
}

/**
 * The share of the rule text a run received that was written for its model, or null when it received
 * none: under `on`, the rules noonsight's decision log shows; under `claudemd`, and under `scattered`
 * once the agent opened the rules file, every default-on rule of every model in the plan.
 */
export function runOwnShare(r: RunRecord, modelIds: readonly string[]): number | null {
  const all = modelIds.flatMap((m) => defaultOnRules(m));
  if (r.condition === 'on') return ownShare(r.model_id, all.filter((x) => r.noonsight.rules.includes(x.id)));
  if (r.condition === 'claudemd' || (r.condition === 'scattered' && r.signals.read_rules.read)) return ownShare(r.model_id, all);
  return null;
}

export interface ShareCell {
  readonly runs: number;
  /** Runs that received any rule text. */
  readonly with_rules: number;
  readonly mean: number | null;
}

/** The mean share of received rule text written for the run's model, by model and condition. */
export function ownShareByCondition(runs: readonly RunRecord[], models: readonly string[], modelIds: readonly string[]): Record<string, Record<string, ShareCell>> {
  const out: Record<string, Record<string, ShareCell>> = {};
  for (const model of models) {
    out[model] = {};
    for (const condition of CONDITION_ORDER) {
      const rs = runs.filter((r) => r.condition === condition && r.model === model);
      const shares = rs.flatMap((r) => {
        const s = runOwnShare(r, modelIds);
        return s === null ? [] : [s];
      });
      out[model]![condition] = { runs: rs.length, with_rules: shares.length, mean: mean(shares) };
    }
  }
  return out;
}

/**
 * The share of the rule text in a probe request that was written for the request's model, or null
 * when the request carries none. Each model present is sized by the rule text its arm delivers: under
 * `on`, the preset's rules for the probe's scope and place; under the others, every default-on rule.
 */
export function probeOwnShare(arm: string, d: Delivery): number | null {
  const present = d.own ? [d.model, ...d.others] : [...d.others];
  const delivered = (m: string) => (arm === 'on' ? defaultOnRules(m).filter((r) => expectedRules(m, PROBE.scope, PROBE.place).includes(r.id)) : defaultOnRules(m));
  return ownShare(d.model, present.flatMap(delivered));
}

export interface RulesRead {
  readonly model: string;
  readonly runs: number;
  /** Runs whose agent opened the scattered rules file. */
  readonly read: number;
  /** Runs whose agent opened it before its first edit. */
  readonly before_first_edit: number;
}

/** Under `scattered` the rules reach a session only if its agent opens the file: how often it did, per model. */
export function rulesRead(runs: readonly RunRecord[], models: readonly string[]): RulesRead[] {
  return models.map((model) => {
    const rs = runs.filter((r) => r.condition === 'scattered' && r.model === model);
    return { model, runs: rs.length, read: rs.filter((r) => r.signals.read_rules.read).length, before_first_edit: rs.filter((r) => r.signals.read_rules.before_first_edit).length };
  });
}

export interface ModelSwitch {
  readonly run: string;
  readonly condition: string;
  readonly from: string;
  readonly to: string;
  readonly source: string;
  /** What noonsight delivered at the switch: `note` when it tells the session the earlier model's rules no longer apply. */
  readonly delivered: string;
}

/** The model switches noonsight's hook saw during the paid runs. */
export function modelSwitches(decisions: readonly DecisionLine[]): ModelSwitch[] {
  return decisions
    .filter((d) => d.event === 'model-switch' && d.experiment_run)
    .map((d) => ({
      run: d.experiment_run as string,
      condition: (d.experiment_run as string).split('.').at(-2) ?? '',
      from: d.from_model ?? '',
      to: d.model ?? '',
      source: d.source ?? '',
      delivered: d.delivered ?? '',
    }));
}

function mean(xs: readonly number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

/** Every input token the model read: fresh, cache writes and cache reads. */
function inputTokens(r: RunRecord): number {
  return r.tokens.input + r.tokens.cache_creation + r.tokens.cache_read;
}

export interface CostCell {
  readonly runs: number;
  readonly mean_usd: number | null;
  readonly mean_input_tokens: number | null;
}

/** Mean cost and input tokens per run, by model (and `all`) and condition, over the runs the filter keeps. */
export function costByCondition(runs: readonly RunRecord[], models: readonly string[], keep: (r: RunRecord) => boolean = () => true): Record<string, Record<string, CostCell>> {
  const out: Record<string, Record<string, CostCell>> = {};
  for (const model of [...models, 'all']) {
    out[model] = {};
    for (const condition of CONDITION_ORDER) {
      const rs = runs.filter((r) => keep(r) && r.condition === condition && (model === 'all' || r.model === model) && r.cost_usd !== null);
      out[model]![condition] = { runs: rs.length, mean_usd: mean(rs.map((r) => r.cost_usd as number)), mean_input_tokens: mean(rs.map(inputTokens)) };
    }
  }
  return out;
}

/** Resolved runs of the sets with a verifier, by model (and `all`) and condition. */
export function resolution(runs: readonly RunRecord[], models: readonly string[]): Record<string, Record<string, { resolved: number; runs: number }>> {
  const out: Record<string, Record<string, { resolved: number; runs: number }>> = {};
  for (const model of [...models, 'all']) {
    out[model] = {};
    for (const condition of CONDITION_ORDER) {
      const rs = runs.filter((r) => r.resolved !== null && r.condition === condition && (model === 'all' || r.model === model));
      out[model]![condition] = { resolved: rs.filter((r) => r.resolved === true).length, runs: rs.length };
    }
  }
  return out;
}

/** The judge's mean score of the open answers, by set and condition. */
export function openScores(runs: readonly RunRecord[], grades: readonly Grade[]): Record<string, Record<string, { graded: number; answers: number; mean: number | null }>> {
  const byKey = new Map(grades.filter((g) => g.score !== null).map((g) => [g.key, g.score as number]));
  const out: Record<string, Record<string, { graded: number; answers: number; mean: number | null }>> = {};
  for (const set of OPEN_SETS) {
    const rs = runs.filter((r) => r.set === set);
    if (!rs.length) continue;
    out[set] = {};
    for (const condition of CONDITION_ORDER) {
      const answers = rs.filter((r) => r.condition === condition);
      const scores = answers.flatMap((r) => (byKey.has(r.key) ? [byKey.get(r.key) as number] : []));
      out[set]![condition] = { graded: scores.length, answers: answers.length, mean: mean(scores) };
    }
  }
  return out;
}

const percent = (x: number | null): string => (x === null ? 'no rule text' : `${Math.round(x * 100)}%`);
const usd = (x: number | null): string => (x === null ? '' : `$${x.toFixed(3)}`);
const thousands = (x: number | null): string => (x === null ? '' : `${Math.round(x / 1000)}k`);

function table(head: readonly string[], rows: readonly (readonly string[])[]): string {
  return [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
}

/** The summary as Markdown: the tables the pilot's reading cites. */
export function summaryMarkdown(res: Results, models: readonly string[], modelIds: readonly string[]): string {
  const out: string[] = ['# Summary', '', '`npm run benchmark -- summarize --results <this folder>` prints this file from the result files beside it.', ''];

  const checks = deliveryCheck(res.runs);
  const byModel = (rec: Readonly<Record<string, number>>): string =>
    Object.entries(rec)
      .sort(([a], [b]) => models.indexOf(a) - models.indexOf(b))
      .map(([m, n]) => `${m} ${n}`)
      .join(', ');
  out.push('## Delivery check of the paid runs', '');
  out.push(table(['Condition', 'Runs', 'Received what the condition delivers', 'Condition texts per model'], checks.map((d) => [`\`${d.condition}\``, String(d.runs), `${d.as_expected} of ${d.runs}`, byModel(d.texts_per_model)])), '');
  const unexpected = checks.flatMap((d) => d.unexpected);
  if (unexpected.length) out.push(`Runs that did not: ${unexpected.join(', ')}.`, '');

  out.push('## Share of the received rule text written for the run\'s model', '');
  out.push(
    table(
      ['Model', ...CONDITION_ORDER.map((c) => `\`${c}\``)],
      Object.entries(ownShareByCondition(res.runs, models, modelIds)).map(([model, byCond]) => [
        model,
        ...CONDITION_ORDER.map((c) => {
          const s = byCond[c];
          return s && s.with_rules ? `${percent(s.mean)} (${s.with_rules} of ${s.runs} runs received rule text)` : `no rule text (${s?.runs ?? 0} runs)`;
        }),
      ]),
    ),
    '',
  );
  if (res.probe) {
    const arms = Object.keys(res.probe);
    const paths = [...new Set(arms.flatMap((a) => (res.probe?.[a] ?? []).map((d) => d.path)))];
    out.push('## Share of the rule text written for the request\'s model, per path of the delivery probe', '');
    out.push(
      table(
        ['Path', 'Model of the request', ...arms.map((a) => `\`${a}\``)],
        paths.map((p) => {
          const rows = arms.map((a) => res.probe?.[a]?.find((d) => d.path === p));
          return [p, rows.find(Boolean)?.model ?? '', ...rows.map((d, i) => (d ? percent(probeOwnShare(arms[i] as string, d)) : 'not reached'))];
        }),
      ),
      '',
    );
  }

  out.push('## The scattered rules file, opened', '');
  out.push(table(['Model', 'Runs', 'Opened the rules file', 'Before its first edit'], rulesRead(res.runs, models).map((r) => [r.model, String(r.runs), `${r.read} of ${r.runs}`, `${r.before_first_edit} of ${r.runs}`])), '');

  const switches = modelSwitches(res.decisions);
  out.push('## Model switches during the paid runs', '');
  if (!switches.length) out.push('None.', '');
  else out.push(table(['Run', 'From', 'To', 'Source', 'noonsight delivered'], switches.map((s) => [`\`${s.run}\``, s.from, s.to, s.source, s.delivered])), '');

  const costTable = (cells: Record<string, Record<string, CostCell>>, conditions: readonly string[]): string =>
    table(
      ['Model', ...conditions.flatMap((c) => [`\`${c}\` $/run`, `\`${c}\` input tokens/run`]), 'Runs per condition'],
      Object.entries(cells).map(([model, byCond]) => [
        model,
        ...conditions.flatMap((c) => [usd(byCond[c]?.mean_usd ?? null), thousands(byCond[c]?.mean_input_tokens ?? null)]),
        conditions.map((c) => byCond[c]?.runs ?? 0).join(' / '),
      ]),
    );
  out.push('## Cost per run, round 1 (every condition)', '');
  out.push(costTable(costByCondition(res.runs, models, (r) => r.rep === 1), CONDITION_ORDER), '');
  out.push('## Cost per run, both rounds (the conditions run twice)', '');
  out.push(costTable(costByCondition(res.runs, models), ['off', 'on', 'claudemd']), '');

  out.push('## Resolved by the verifier (build and routine)', '');
  out.push(table(['Model', ...CONDITION_ORDER.map((c) => `\`${c}\``)], Object.entries(resolution(res.runs, models)).map(([model, byCond]) => [model, ...CONDITION_ORDER.map((c) => `${byCond[c]?.resolved ?? 0} of ${byCond[c]?.runs ?? 0}`)])), '');

  out.push('## Open answers, judge score (uncalibrated)', '');
  out.push(
    table(
      ['Set', ...CONDITION_ORDER.map((c) => `\`${c}\``)],
      Object.entries(openScores(res.runs, res.grades)).map(([set, byCond]) => [
        set,
        ...CONDITION_ORDER.map((c) => {
          const s = byCond[c];
          return s && s.answers ? `${s.mean === null ? '' : s.mean.toFixed(2)} (${s.graded} of ${s.answers} graded)` : '';
        }),
      ]),
    ),
    '',
  );
  return `${out.join('\n').trimEnd()}\n`;
}
