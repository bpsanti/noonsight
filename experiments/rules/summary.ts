// The summary of an experiment: what the decision log says was delivered, the signals and the cost
// of each task, model and arm, and for each rule the signals its source claims, with the rule and
// without. Counts come with their intervals and each comparison with a two-sided p; a design's
// pre-registered comparisons are read with Holm's correction, and its cost against its projection.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildReport, renderReport } from '../../src/commands/report.js';
import type { Design, Plan, Primary, RunRecord } from './run.js';
import { fisher, formatP, holm, mannWhitney, median, wilson } from './stats.js';

type Row = readonly string[];

function table(head: Row, rows: readonly Row[]): string {
  return [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
}

function mean(xs: readonly number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN;
}

/** A mean with its range, such as "1,204 (980 to 1,530)". */
function spread(xs: readonly number[], digits = 0): string {
  if (!xs.length) return 'n/a';
  const f = (n: number): string => n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  return lo === hi ? f(lo) : `${f(mean(xs))} (${f(lo)} to ${f(hi)})`;
}

function share(runs: readonly RunRecord[], test: (r: RunRecord) => boolean | undefined): string {
  const known = runs.filter((r) => test(r) !== undefined);
  return known.length ? `${known.filter((r) => test(r)).length} of ${known.length}` : 'n/a';
}

/** Successes and tries among the runs where the signal applies. */
function count(runs: readonly RunRecord[], test: (r: RunRecord) => boolean | undefined): { k: number; n: number } {
  const known = runs.filter((r) => test(r) !== undefined);
  return { k: known.filter((r) => test(r)).length, n: known.length };
}

/** A share with its Wilson 95 percent interval, such as "28 of 30 (79-98%)". */
function shareWithInterval(c: { k: number; n: number }): string {
  if (!c.n) return 'n/a';
  const [lo, hi] = wilson(c.k, c.n);
  return `${c.k} of ${c.n} (${Math.round(lo * 100)}-${Math.round(hi * 100)}%)`;
}

const BINARY: Readonly<Record<string, (r: RunRecord) => boolean | undefined>> = {
  finished: (r) => r.signals.finished,
  verified: (r) => (r.signals.edited ? r.signals.verified : undefined),
  extra_files: (r) => r.signals.extra_files.length > 0,
};

const PROSE = new Set(['words_per_sentence', 'semicolons_per_1k_words', 'parentheses_per_1k_words']);

/** The two-sided p of one signal between two groups of runs: Fisher's exact test for a share, Mann-Whitney U for a measure. */
function compare(name: string, on: readonly RunRecord[], off: readonly RunRecord[]): number {
  const test = BINARY[name];
  if (test) {
    const a = count(on, test);
    const b = count(off, test);
    return a.n && b.n ? fisher(a.k, a.n, b.k, b.n) : NaN;
  }
  if (PROSE.has(name) || name === 'cost_usd') return mannWhitney(measure(on, name), measure(off, name)).p;
  return NaN;
}

function prose(runs: readonly RunRecord[], name: string): number[] {
  return runs.map((r) => r.signals.report[name as 'words_per_sentence']);
}

/** A measured signal of each run: a prose measure of its report, or its cost. */
function measure(runs: readonly RunRecord[], name: string): number[] {
  return name === 'cost_usd' ? runs.map((r) => r.cost_usd) : prose(runs, name);
}

const inputTokens = (r: RunRecord): number => r.tokens.input + r.tokens.cache_creation + r.tokens.cache_read;

/** The value of one signal over a group of runs, as the per-rule table shows it. */
function signal(name: string, runs: readonly RunRecord[]): string {
  const test = BINARY[name];
  if (test) return shareWithInterval(count(runs, test));
  if (PROSE.has(name)) return spread(prose(runs, name), 1);
  return 'n/a';
}

const SIGNAL_NAMES: Readonly<Record<string, string>> = {
  finished: 'Runs finished (deliverable present, work not handed back)',
  verified: 'Runs that ran the tests after their last edit, of those that edited code',
  extra_files: 'Runs that changed files beyond the ones asked',
  words_per_sentence: 'Words per sentence in the report',
  semicolons_per_1k_words: 'Semicolons per 1,000 words in the report',
  parentheses_per_1k_words: 'Parentheses per 1,000 words in the report',
};

export function summarize(plan: Plan, runs: readonly RunRecord[], decisions: string, design?: Design): string {
  const lines: string[] = [];
  const versions = [...new Set(runs.map((r) => r.claude_code))].join(', ');
  const spent = runs.reduce((s, r) => s + r.cost_usd, 0);
  const days = [...new Set(runs.map((r) => r.started.slice(0, 10)))].sort();
  const stubbed = runs.filter((r) => r.api === 'stub').length;
  lines.push('# Rule effect experiment: summary', '');
  if (stubbed)
    lines.push(
      `${stubbed === runs.length ? 'Every run' : `${stubbed} of the ${runs.length} runs`} answered by the scripted stub (\`stub.ts\`), not by a model: these numbers, the cost included, check the harness and say nothing about any model or rule.`,
      '',
    );
  lines.push(
    `${runs.length} runs, Claude Code ${versions || 'n/a'}, effort ${plan.effort}, ${days.length ? (days.length > 1 ? `${days[0]} to ${days.at(-1)}` : days[0]) : 'n/a'}; $${spent.toFixed(2)} spent in total, as Claude Code reports cost.`,
    'A share comes with its Wilson 95% interval, and p is two-sided: Fisher\'s exact test for a share, the Mann-Whitney U test for a measure. With few runs per arm, a difference is a direction to look at again, not a measured effect.',
    '',
  );

  // Delivery, from the decision log the runs left, through `noonsight report`.
  const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noonsight-summary-'));
  const config = path.join(configDir, 'noonsight.json');
  fs.writeFileSync(config, JSON.stringify({ version: 1, models: Object.fromEntries(Object.values(plan.models).map((m) => [m.id, { use: 'preset' }])) }));
  const report = buildReport({ NOONSIGHT_CONFIG: config }, { log: decisions, project: null });
  // The first line names the log file; the configuration is named for what it is, not where it was.
  const delivery = renderReport({ ...report, config: { ...report.config, file: 'every model of the plan with "use": "preset"' } }).split('\n').slice(1);
  lines.push(
    '## What noonsight delivered',
    '',
    'From the decision log of every run, as `noonsight report --log decisions.jsonl` prints it, against a configuration that declares every model of the plan with the preset:',
    '',
    '```text',
    ...delivery,
    '```',
    '',
  );
  fs.rmSync(configDir, { recursive: true, force: true });

  // Per task, model and arm.
  lines.push('## Each task, model and arm', '');
  const groups = new Map<string, RunRecord[]>();
  for (const r of runs) {
    const key = `${r.task}\u0000${r.model}\u0000${r.arm}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const rows: Row[] = [];
  for (const [key, g] of [...groups].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const [task, model, arm] = key.split('\u0000') as [string, string, string];
    const rules = [...new Set(g.flatMap((r) => r.noonsight.rules))];
    rows.push([
      task,
      model,
      plan.arms[arm]?.use === 'none' ? arm : `${arm}: ${rules.length ? rules.join(', ') : 'none apply'}`,
      String(g.length),
      share(g, (r) => r.signals.finished),
      share(g, (r) => r.signals.handed_back),
      share(g, (r) => (r.signals.edited ? r.signals.verified : undefined)),
      share(g, (r) => r.signals.extra_files.length > 0),
      g[0]?.signals.answer ? `${spread(g.map((r) => r.signals.answer?.found ?? 0), 1)} of ${g[0].signals.answer.expected}, ${spread(g.map((r) => r.signals.answer?.wrong ?? 0), 1)} wrong` : share(g, (r) => r.signals.check_passed),
      spread(g.map((r) => r.signals.report.words_per_sentence), 1),
      spread(g.map((r) => r.signals.report.semicolons_per_1k_words), 1),
      spread(g.map((r) => r.tokens.output)),
      spread(g.map(inputTokens)),
      spread(g.map((r) => r.cost_usd), 3),
    ]);
  }
  lines.push(
    table(
      ['Task', 'Model', 'Arm', 'Runs', 'Finished', 'Handed back', 'Tests after last edit', 'Extra files', 'Correct', 'Words per sentence', 'Semicolons per 1k words', 'Output tokens', 'Input tokens', 'Cost USD'],
      rows,
    ),
    '',
    'Numbers are the mean with the range in parentheses. "Correct" is, for the question, the jobs named that ignore a control, of the three that do, and the jobs named wrongly; for the fix, the runs whose change passes the hidden check. Input tokens include the cached ones.',
    '',
  );

  // Per rule.
  lines.push('## Each rule', '');
  for (const [rule, names] of Object.entries(plan.signals)) {
    // Every arm whose runs received the rule, each against the arm `none` of the same task and model.
    const withRule = runs.filter((r) => plan.arms[r.arm]?.use !== 'none' && r.noonsight.rules.includes(rule));
    lines.push(`### \`${rule}\``, '');
    if (!withRule.length) {
      lines.push('Not delivered in any run of this experiment, so not measured.', '');
      continue;
    }
    const groupsRule = [...new Set(withRule.map((r) => `${r.task}\u0000${r.model}\u0000${r.arm}`))];
    const rowsRule: Row[] = [];
    for (const group of groupsRule) {
      const [task, model, arm] = group.split('\u0000') as [string, string, string];
      const on = withRule.filter((r) => r.task === task && r.model === model && r.arm === arm);
      const off = runs.filter((r) => r.arm === 'none' && r.task === task && r.model === model);
      const others = [...new Set(on.flatMap((r) => r.noonsight.rules).filter((x) => x !== rule))];
      for (const name of names) rowsRule.push([task, model, arm, SIGNAL_NAMES[name] ?? name, signal(name, on), signal(name, off), formatP(compare(name, on, off))]);
      const dOut = mean(on.map((r) => r.tokens.output)) - mean(off.map((r) => r.tokens.output));
      const dIn = mean(on.map(inputTokens)) - mean(off.map(inputTokens));
      const dCost = mean(on.map((r) => r.cost_usd)) - mean(off.map((r) => r.cost_usd));
      const pOut = mannWhitney(on.map((r) => r.tokens.output), off.map((r) => r.tokens.output)).p;
      rowsRule.push([task, model, arm, 'Output tokens per run', spread(on.map((r) => r.tokens.output)), spread(off.map((r) => r.tokens.output)), formatP(pOut)]);
      rowsRule.push([task, model, arm, 'Difference of the means', `${signed(dOut)} output, ${signed(dIn)} input tokens`, `${signedUsd(dCost)} per run`, '']);
      rowsRule.push([task, model, arm, 'Delivered in the same runs', others.length ? others.join(', ') : 'no other rule', '', '']);
    }
    lines.push(table(['Task', 'Model', 'Arm', 'Signal', 'With the rule', 'Without (arm none)', 'p'], rowsRule), '');
  }
  if (design) lines.push(...preregistered(design, runs), ...(design.arms.length > 2 ? eachArm(design, runs) : []), ...costAgainstProjection(design, runs));
  return `${lines.join('\n')}\n`;
}

/** Holm's adjustment runs over every comparison a design fixed, at this familywise level. */
export const ALPHA = 0.05;

export interface Comparison {
  readonly primary: Primary;
  readonly task: string;
  /** The two arms compared: the one with the rule, then the one without it. */
  readonly arms: readonly [string, string];
  readonly with: string;
  readonly without: string;
  readonly p: number;
  readonly holm: number;
  /**
   * After Holm's adjustment: whether the runs show the difference the rule's source claims, or, where
   * the source claims no direction, which way the arm with the rule goes.
   */
  readonly reading: 'supports the source' | 'not shown' | 'opposite to the source' | 'higher' | 'lower';
}

/** The pre-registered comparisons of a design, each task apart, with Holm's adjustment over all of them. */
export function comparisons(design: Design, runs: readonly RunRecord[]): Comparison[] {
  const raw = design.primary.flatMap((primary) =>
    primary.tasks.map((task) => {
      const arms = [primary.arm ?? 'rules', primary.against ?? 'none'] as const;
      const on = runs.filter((r) => r.model === primary.model && r.task === task && r.arm === arms[0]);
      const off = runs.filter((r) => r.model === primary.model && r.task === task && r.arm === arms[1]);
      let up: boolean | null;
      let shown: [string, string];
      if (primary.signal === 'verified') {
        const a = count(on, BINARY.verified as (r: RunRecord) => boolean | undefined);
        const b = count(off, BINARY.verified as (r: RunRecord) => boolean | undefined);
        up = a.n && b.n && a.k / a.n !== b.k / b.n ? a.k / a.n > b.k / b.n : null;
        shown = [shareWithInterval(a), shareWithInterval(b)];
      } else {
        const xs = measure(on, primary.signal);
        const ys = measure(off, primary.signal);
        // The direction is the test's own: U above half its range means the runs with the rule rank higher.
        // Medians can tie (at 0 semicolons, say) while the ranks still differ.
        const { u } = mannWhitney(xs, ys);
        const middle = (xs.length * ys.length) / 2;
        up = Number.isNaN(u) || u === middle ? null : u > middle;
        const f = (n: number): string => (primary.signal === 'cost_usd' ? `$${n.toFixed(4)}` : n.toFixed(1));
        const describe = (vs: number[]): string => (vs.length ? `mean ${f(mean(vs))}, median ${f(median(vs))} (${vs.length} run${vs.length === 1 ? '' : 's'})` : 'n/a');
        shown = [describe(xs), describe(ys)];
      }
      return { primary, task, arms, with: shown[0], without: shown[1], p: compare(primary.signal, on, off), up };
    }),
  );
  const adjusted = holm(raw.map((c) => (Number.isNaN(c.p) ? 1 : c.p)));
  return raw.map(({ up, ...c }, i) => {
    const h = adjusted[i] ?? 1;
    let reading: Comparison['reading'];
    if (h >= ALPHA || up === null) reading = 'not shown';
    else if (c.primary.direction === undefined) reading = up ? 'higher' : 'lower';
    else reading = up === (c.primary.direction === 'higher') ? 'supports the source' : 'opposite to the source';
    return { ...c, holm: h, reading };
  });
}

const PRIMARY_SIGNAL: Readonly<Record<Primary['signal'], string>> = {
  verified: 'Tests after the last edit',
  words_per_sentence: 'Words per sentence',
  semicolons_per_1k_words: 'Semicolons per 1,000 words',
  cost_usd: 'Cost per run',
};

function preregistered(design: Design, runs: readonly RunRecord[]): string[] {
  const cs = comparisons(design, runs);
  return [
    '## Pre-registered comparisons',
    '',
    `The comparisons the design fixed before it ran, each task apart. p is two-sided; Holm's adjustment runs over all ${cs.length}, and a comparison supports the rule's source when its adjusted p is below ${ALPHA} and the difference goes the way the source claims. Where the source claims no direction, the reading is the direction found, or "not shown".`,
    '',
    table(
      ['Rule', 'Task', 'Arms', 'Signal', 'With the rule', 'Without', 'p', 'Holm p', 'Reading'],
      cs.map((c) => [
        `\`${c.primary.rule}\``,
        c.task,
        `${c.arms[0]} against ${c.arms[1]}`,
        `${PRIMARY_SIGNAL[c.primary.signal]} (${c.primary.direction ? `${c.primary.direction} claimed` : 'no direction claimed'})`,
        c.with,
        c.without,
        formatP(c.p),
        formatP(c.holm),
        c.reading,
      ]),
    ),
    '',
  ];
}

/**
 * Each arm of a design against the arm `none`, for a design with more than two arms: the share of
 * runs that tested after their last edit and the cost per run, with each difference from `none` and
 * the part it is of the difference of the arm `rules`. Descriptive only: the tests are the
 * pre-registered comparisons above.
 */
function eachArm(design: Design, runs: readonly RunRecord[]): string[] {
  const rows: Row[] = [];
  const verified = BINARY.verified as (r: RunRecord) => boolean | undefined;
  const rate = (g: readonly RunRecord[]): number => {
    const c = count(g, verified);
    return c.n ? c.k / c.n : NaN;
  };
  const pct = (n: number): string => (Number.isNaN(n) ? 'n/a' : `${Math.round(n * 100)}%`);
  const points = (n: number): string => (Number.isNaN(n) ? 'n/a' : `${n >= 0 ? '+' : '-'}${Math.abs(Math.round(n * 100))} points`);
  const part = (d: number, whole: number): string => (Number.isNaN(d) || Number.isNaN(whole) || whole === 0 ? 'n/a' : `${Math.round((d / whole) * 100)}%`);
  for (const [model, tasks] of Object.entries(design.cells))
    for (const task of tasks) {
      const of = (arm: string): RunRecord[] => runs.filter((r) => r.model === model && r.task === task && r.arm === arm);
      const none = of('none');
      const all = of('rules');
      const dCostAll = mean(all.map((r) => r.cost_usd)) - mean(none.map((r) => r.cost_usd));
      const dRateAll = rate(all) - rate(none);
      for (const arm of design.arms) {
        const g = of(arm);
        if (!g.length) continue;
        const rules = [...new Set(g.flatMap((r) => r.noonsight.rules))];
        const dCost = mean(g.map((r) => r.cost_usd)) - mean(none.map((r) => r.cost_usd));
        const dRate = rate(g) - rate(none);
        const base = arm === 'none';
        rows.push([
          model,
          task,
          arm,
          rules.length ? rules.join(', ') : 'none',
          String(g.length),
          `${shareWithInterval(count(g, verified))}`,
          base ? '' : points(dRate),
          base || arm === 'rules' ? '' : part(dRate, dRateAll),
          `$${mean(g.map((r) => r.cost_usd)).toFixed(4)}`,
          base ? '' : signedUsd4(dCost),
          base || arm === 'rules' ? '' : part(dCost, dCostAll),
          mean(g.map((r) => r.turns)).toFixed(1),
        ]);
      }
    }
  return [
    '## Each arm against none',
    '',
    'Descriptive, beside the comparisons above: for each arm, the tests after the last edit and the mean cost per run, each with its difference from the arm `none` and, for an arm with fewer rules than `rules`, that difference as a part of the difference of the arm `rules`. Parts need not add up to 100%: rules can overlap or add to each other, and chance moves every mean.',
    '',
    table(['Model', 'Task', 'Arm', 'Rules delivered', 'Runs', 'Tests after last edit', 'Against none', 'Part of rules', 'Cost per run', 'Against none', 'Part of rules', 'Turns per run'], rows),
    '',
  ];
}

function costAgainstProjection(design: Design, runs: readonly RunRecord[]): string[] {
  const rows: Row[] = [];
  let expected = 0;
  for (const [model, tasks] of Object.entries(design.cells))
    for (const task of tasks) {
      const g = runs.filter((r) => r.model === model && r.task === task);
      const per = design.expected_usd[model]?.[task] ?? NaN;
      expected += per * g.length;
      // Below a cent, three decimals would round Haiku's costs to a single digit.
      const usd = (n: number): string => `$${n.toFixed(per < 0.01 ? 4 : 3)}`;
      rows.push([model, task, String(g.length), usd(per), g.length ? usd(mean(g.map((r) => r.cost_usd))) : 'n/a', `$${g.reduce((s, r) => s + r.cost_usd, 0).toFixed(2)}`]);
    }
  const spent = runs.reduce((s, r) => s + r.cost_usd, 0);
  return [
    '## Cost against the projection',
    '',
    table(['Model', 'Task', 'Runs', 'Expected per run', 'Measured per run', 'Measured'], rows),
    '',
    `Measured: $${spent.toFixed(2)} for the recorded runs, against $${expected.toFixed(2)} expected for the same runs and a cap of $${design.cap_usd}.`,
    '',
  ];
}

function signed(n: number): string {
  if (Number.isNaN(n)) return 'n/a';
  const r = Math.round(n);
  return `${r >= 0 ? '+' : '-'}${Math.abs(r).toLocaleString('en-US')}`;
}

function signedUsd4(n: number): string {
  if (Number.isNaN(n)) return 'n/a';
  return `${n >= 0 ? '+' : '-'}$${Math.abs(n).toFixed(4)}`;
}

function signedUsd(n: number): string {
  if (Number.isNaN(n)) return 'n/a';
  return `${n >= 0 ? '+' : '-'}$${Math.abs(n).toFixed(3)}`;
}
