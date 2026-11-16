// The summary of an experiment: what the decision log says was delivered, the signals and the cost
// of each task, model and arm, and for each rule the signals its source claims, with the rule and
// without. Small samples only give a direction, so the summary gives counts and ranges and claims
// no significance.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildReport, renderReport } from '../../src/commands/report.js';
import type { Plan, RunRecord } from './run.js';

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

const inputTokens = (r: RunRecord): number => r.tokens.input + r.tokens.cache_creation + r.tokens.cache_read;

/** The value of one signal over a group of runs, as the per-rule table shows it. */
function signal(name: string, runs: readonly RunRecord[]): string {
  switch (name) {
    case 'finished':
      return share(runs, (r) => r.signals.finished);
    case 'verified':
      return share(runs, (r) => (r.signals.edited ? r.signals.verified : undefined));
    case 'extra_files':
      return share(runs, (r) => r.signals.extra_files.length > 0);
    case 'words_per_sentence':
    case 'semicolons_per_1k_words':
    case 'parentheses_per_1k_words':
      return spread(
        runs.map((r) => r.signals.report[name]),
        1,
      );
    default:
      return 'n/a';
  }
}

const SIGNAL_NAMES: Readonly<Record<string, string>> = {
  finished: 'Runs finished (deliverable present, work not handed back)',
  verified: 'Runs that ran the tests after their last edit, of those that edited code',
  extra_files: 'Runs that changed files beyond the ones asked',
  words_per_sentence: 'Words per sentence in the report',
  semicolons_per_1k_words: 'Semicolons per 1,000 words in the report',
  parentheses_per_1k_words: 'Parentheses per 1,000 words in the report',
};

export function summarize(plan: Plan, runs: readonly RunRecord[], decisions: string): string {
  const lines: string[] = [];
  const versions = [...new Set(runs.map((r) => r.claude_code))].join(', ');
  const spent = runs.reduce((s, r) => s + r.cost_usd, 0);
  lines.push('# Rule effect experiment: summary', '');
  lines.push(
    `${runs.length} runs, Claude Code ${versions || 'n/a'}, effort ${plan.effort}, ${runs.length ? runs[0]?.started.slice(0, 10) : 'n/a'}; $${spent.toFixed(2)} spent in total, as Claude Code reports cost.`,
    'With a few runs per arm, every difference below is a direction to look at again, not a measured effect.',
    '',
  );

  // Delivery, from the decision log the runs left, through `sextant report`.
  const configDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sextant-summary-'));
  const config = path.join(configDir, 'sextant.json');
  fs.writeFileSync(config, JSON.stringify({ version: 1, models: Object.fromEntries(Object.values(plan.models).map((m) => [m.id, { use: 'preset' }])) }));
  const report = buildReport({ SEXTANT_CONFIG: config }, { since: null, log: decisions });
  // The first line names the log file; the configuration is named for what it is, not where it was.
  const delivery = renderReport({ ...report, config: { ...report.config, file: 'every model of the plan with "use": "preset"' } }).split('\n').slice(1);
  lines.push(
    '## What sextant delivered',
    '',
    'From the decision log of every run, as `sextant report --log decisions.jsonl` prints it, against a configuration that declares every model of the plan with the preset:',
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
    const rules = [...new Set(g.flatMap((r) => r.sextant.rules))];
    rows.push([
      task,
      model,
      arm === 'rules' ? `rules: ${rules.length ? rules.join(', ') : 'none apply'}` : arm,
      String(g.length),
      share(g, (r) => r.signals.finished),
      share(g, (r) => r.signals.handed_back),
      share(g, (r) => (r.signals.edited ? r.signals.verified : undefined)),
      share(g, (r) => r.signals.extra_files.length > 0),
      task === 'question' ? `${spread(g.map((r) => r.signals.answer?.found ?? 0), 1)} of ${g[0]?.signals.answer?.expected ?? '?'}, ${spread(g.map((r) => r.signals.answer?.wrong ?? 0), 1)} wrong` : share(g, (r) => r.signals.check_passed),
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
    const withRule = runs.filter((r) => r.arm === 'rules' && r.sextant.rules.includes(rule));
    lines.push(`### \`${rule}\``, '');
    if (!withRule.length) {
      lines.push('Not delivered in any run of this experiment, so not measured.', '');
      continue;
    }
    const pairs = [...new Set(withRule.map((r) => `${r.task}\u0000${r.model}`))];
    const rowsRule: Row[] = [];
    for (const pair of pairs) {
      const [task, model] = pair.split('\u0000') as [string, string];
      const on = withRule.filter((r) => r.task === task && r.model === model);
      const off = runs.filter((r) => r.arm === 'none' && r.task === task && r.model === model);
      const others = [...new Set(on.flatMap((r) => r.sextant.rules).filter((x) => x !== rule))];
      for (const name of names) rowsRule.push([task, model, SIGNAL_NAMES[name] ?? name, signal(name, on), signal(name, off)]);
      const dOut = mean(on.map((r) => r.tokens.output)) - mean(off.map((r) => r.tokens.output));
      const dIn = mean(on.map(inputTokens)) - mean(off.map(inputTokens));
      const dCost = mean(on.map((r) => r.cost_usd)) - mean(off.map((r) => r.cost_usd));
      rowsRule.push([task, model, 'Output tokens per run', spread(on.map((r) => r.tokens.output)), spread(off.map((r) => r.tokens.output))]);
      rowsRule.push([task, model, 'Difference of the means', `${signed(dOut)} output, ${signed(dIn)} input tokens`, `${signedUsd(dCost)} per run`]);
      if (others.length) rowsRule.push([task, model, 'Delivered in the same runs', others.join(', '), '']);
    }
    lines.push(table(['Task', 'Model', 'Signal', 'With the rule', 'Without'], rowsRule), '');
  }
  return `${lines.join('\n')}\n`;
}

function signed(n: number): string {
  if (Number.isNaN(n)) return 'n/a';
  const r = Math.round(n);
  return `${r >= 0 ? '+' : '-'}${Math.abs(r).toLocaleString('en-US')}`;
}

function signedUsd(n: number): string {
  if (Number.isNaN(n)) return 'n/a';
  return `${n >= 0 ? '+' : '-'}$${Math.abs(n).toFixed(3)}`;
}
