// The four measures of a set of sessions, from what the stub saw:
//
// - coverage: among the requests whose model has at least one right rule ("rules due"), the share
//   where missing-own and own-retired both hold; also by rule, and for subagents alone;
// - precision: the own share, the characters of rules written for the request's model over all rule
//   text in the request, each copy counted; and the right share, the first copy of the right rules
//   over all rule text plus noonsight's envelopes and notes;
// - cost: the characters noonsight or the native alternative adds to each request (rules, envelopes,
//   notes), whose tokens are estimated at four characters each; the hook's own time is hooktime.ts;
// - robustness: violations by request and by session, by number of lifecycle events in the session,
//   by whether two quiet steps follow each other, by how the session started (`claude`, `noonsight
//   run`, in a project with its own configuration), and by path (the last lifecycle step before the
//   request); every distinct class of violation with an example session.

import { hasQuietPair, LIFECYCLE, type Sequence } from './generate.js';
import { CLASSES, isAgent } from './oracle.js';
import { failed, signature, type Line } from './fuzz.js';
import type { RequestFact } from './session.js';

const ratio = (n: number, d: number): number | null => (d ? Math.round((10000 * n) / d) / 10000 : null);

interface Tally {
  requests: number;
  due: number;
  covered: number;
}

function tally(facts: readonly RequestFact[]): Tally {
  const due = facts.filter((f) => f.covered !== null);
  return { requests: facts.length, due: due.length, covered: due.filter((f) => f.covered).length };
}

const withShare = (t: Tally): Tally & { coverage: number | null } => ({ ...t, coverage: ratio(t.covered, t.due) });

/**
 * The path a request stands for: `subagent`, a request of a session /fork runs in the background,
 * `start`, or the last lifecycle step at or before its step.
 */
export function pathOf(spec: Sequence, f: Pick<RequestFact, 'kind' | 'step' | 'background'>): string {
  if (f.kind === 'subagent') return 'subagent';
  if (f.background) return 'a /fork session';
  for (let i = Math.min(f.step, spec.steps.length - 1); i >= 0; i--) {
    const s = spec.steps[i];
    if (!s || !LIFECYCLE.has(s.k)) continue;
    if (s.k === 'edit') return s.target === 'code' ? 'after an edit of tracked code' : 'after another edit';
    if (s.k === 'spawn') return s.calls.some((c) => c.edit) ? 'after starting subagents that edit' : 'after starting subagents';
    if (s.k === 'model') return 'after /model';
    if (s.k === 'resume') return `after a ${s.fork ? 'forking ' : ''}resume${s.model ? ' with --model' : ''}`;
    if (s.k === 'back') return 'after /resume in the session';
    if (s.k === 'plan') return s.on ? 'in plan mode' : 'after leaving plan mode';
    return `after /${s.k}`;
  }
  return 'start';
}

/** How a session started: through `noonsight run` or `claude`, and whether in the benchmark's project. */
export function startOf(spec: Sequence & { readonly arm?: string }): string {
  // Under a native arm, both are left out (session.ts).
  const on = spec.arm === undefined || spec.arm === 'on';
  return `${on && spec.launcher ? 'noonsight run' : 'claude'}${on && spec.project ? ', in a project' : ''}`;
}

function lengthBand(spec: Sequence): string {
  const n = spec.steps.filter((x) => LIFECYCLE.has(x.k)).length;
  return n <= 2 ? '0-2 events' : n <= 5 ? '3-5 events' : n <= 8 ? '6-8 events' : '9+ events';
}

function count<T>(xs: readonly T[], f: (x: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of xs) out[f(x)] = (out[f(x)] ?? 0) + 1;
  return out;
}

export type Measures = ReturnType<typeof measure>;

/** The four measures of one run: the sessions of one arm, seed and build. */
export function measure(lines: readonly Line[]) {
  const ok = lines.filter((r) => r.harness === 'ok');
  const agent = (r: Line): RequestFact[] => r.facts.filter(isAgent);
  const facts = ok.flatMap(agent);
  const sum = (xs: readonly RequestFact[], f: (x: RequestFact) => number): number => xs.reduce((n, x) => n + f(x), 0);
  const c = (k: keyof RequestFact['chars']): number => sum(facts, (f) => f.chars[k]);
  const own = (f: RequestFact): number => f.chars.ownFirst + f.chars.ownDuplicate + f.chars.ownUnexpected;
  const rule = c('rule');
  const added = rule + c('overhead');
  const withRules = facts.filter((f) => f.chars.rule > 0);
  const due = facts.filter((f) => f.covered !== null);
  const steps = lines.flatMap((r) => r.steps);

  const byPath: Record<string, Tally & { own: number; rule: number; foreignUnretired: number }> = {};
  for (const r of ok)
    for (const f of agent(r)) {
      const p = (byPath[pathOf(r.spec, f)] ??= { requests: 0, due: 0, covered: 0, own: 0, rule: 0, foreignUnretired: 0 });
      p.requests++;
      if (f.covered !== null) {
        p.due++;
        if (f.covered) p.covered++;
      }
      p.own += own(f);
      p.rule += f.chars.rule;
      if (f.violations.some((v) => v.class === 'foreign-unretired')) p.foreignUnretired++;
    }
  const bySessions = (groups: Record<string, Line[]>) =>
    Object.fromEntries(
      Object.entries(groups)
        .sort()
        .map(([k, rs]) => [k, { sessions: rs.length, ...withShare(tally(rs.flatMap(agent))), sessionsFailed: rs.filter(failed).length }]),
    );
  const group = (f: (r: Line) => string): Record<string, Line[]> => {
    const out: Record<string, Line[]> = {};
    for (const r of ok) (out[f(r)] ??= []).push(r);
    return out;
  };
  const classes: Record<string, { sessions: number; example: string }> = {};
  for (const r of ok.filter(failed))
    for (const s of signature(r)) {
      const e = (classes[s] ??= { sessions: 0, example: r.id });
      e.sessions++;
    }
  const known: Record<string, number> = {};
  for (const r of ok) for (const v of r.violations) if (v.known) known[v.known] = (known[v.known] ?? 0) + 1;

  return {
    claudeCode: lines[0]?.claudeCode ?? null,
    arm: lines[0]?.spec.arm ?? null,
    plant: lines[0]?.spec.plant ?? null,
    sessions: lines.length,
    harness: count(lines, (r) => r.harness.replace(/:.*$/, '')),
    stepOutcomes: count(steps, (s) => `${s.k}:${s.outcome}`),
    steps: steps.length,
    lifecycleEvents: ok.reduce((n, r) => n + r.spec.steps.filter((x) => LIFECYCLE.has(x.k)).length, 0),
    secondsPerSession: lines.length ? Math.round(lines.reduce((n, r) => n + r.ms, 0) / lines.length / 1000) : null,
    requests: ok.reduce((n, r) => n + r.facts.length, 0),
    byKind: count(
      ok.flatMap((r) => r.facts),
      (f) => f.kind,
    ),
    coverage: {
      ...withShare(tally(facts)),
      rules: { due: sum(due, (f) => f.expected.length), present: sum(due, (f) => f.expectedPresent), share: ratio(sum(due, (f) => f.expectedPresent), sum(due, (f) => f.expected.length)) },
      subagents: withShare(tally(facts.filter((f) => f.kind === 'subagent'))),
    },
    precision: {
      ownShare: ratio(sum(facts, own), rule),
      rightShare: ratio(c('ownFirst'), added),
      meanOwnSharePerRequest: withRules.length ? ratio(sum(withRules, (f) => own(f) / f.chars.rule), withRules.length) : null,
      parts: { ownFirst: c('ownFirst'), ownDuplicate: c('ownDuplicate'), ownUnexpected: c('ownUnexpected'), foreignRetired: c('foreignRetired'), foreignUnretired: c('foreignUnretired'), overhead: c('overhead') },
    },
    cost: {
      addedCharsPerAgentRequest: facts.length ? Math.round(added / facts.length) : null,
      approxTokensPerAgentRequest: facts.length ? Math.round(added / facts.length / 4) : null,
      shareOfRequestText: ratio(added, c('request')),
      addedCharsPerSession: ok.length ? Math.round(added / ok.length) : null,
      agentRequestsPerSession: ok.length ? Math.round((10 * facts.length) / ok.length) / 10 : null,
    },
    robustness: {
      requestsWithViolation: Object.fromEntries(CLASSES.map((k) => [k, facts.filter((f) => f.violations.some((v) => v.class === k)).length])),
      sessionsFailed: ok.filter(failed).length,
      knownViolations: known,
      classes,
      byLength: bySessions(group((r) => lengthBand(r.spec))),
      byQuietPair: bySessions(group((r) => (hasQuietPair(r.spec) ? 'two quiet steps in a row' : 'every quiet step followed by a request'))),
      byStart: bySessions(group((r) => startOf(r.spec))),
    },
    byPath: Object.fromEntries(
      Object.entries(byPath)
        .sort()
        .map(([k, p]) => [k, { requests: p.requests, due: p.due, coverage: ratio(p.covered, p.due), ownShare: ratio(p.own, p.rule), foreignUnretired: p.foreignUnretired }]),
    ),
  };
}

const pct = (x: number | null | undefined): string => (x === null || x === undefined ? 'n/a' : `${(100 * x).toFixed(1)}%`);

/** The measures of several runs as Markdown: one column per run, then each run's paths and robustness. */
export function renderMarkdown(runs: Readonly<Record<string, Measures>>): string {
  const names = Object.keys(runs);
  const rows: [string, (m: Measures) => string][] = [
    ['Arm', (m) => `\`${m.arm}\`${m.plant ? ` (planted: ${m.plant})` : ''}`],
    ['Sessions measured / run', (m) => `${m.harness.ok ?? 0} / ${m.sessions}`],
    ['Requests (main, subagent, compaction)', (m) => `${m.requests} (${m.byKind.main ?? 0}, ${m.byKind.subagent ?? 0}, ${m.byKind.compact ?? 0})`],
    ['Coverage', (m) => `${pct(m.coverage.coverage)} (${m.coverage.covered} of ${m.coverage.due})`],
    ['Coverage, subagents', (m) => `${pct(m.coverage.subagents.coverage)} (${m.coverage.subagents.covered} of ${m.coverage.subagents.due})`],
    ['Coverage, by rule', (m) => pct(m.coverage.rules.share)],
    ['Own share', (m) => (m.precision.ownShare === null ? 'no rule text' : pct(m.precision.ownShare))],
    ['Right share', (m) => (m.precision.rightShare === null ? 'no rule text' : pct(m.precision.rightShare))],
    ['Characters added per request', (m) => String(m.cost.addedCharsPerAgentRequest ?? 'n/a')],
    ['Share of the request text', (m) => pct(m.cost.shareOfRequestText)],
    ['Requests with a rule of another model and no note', (m) => String(m.robustness.requestsWithViolation['foreign-unretired'] ?? 0)],
    ['Sessions with an unexplained violation', (m) => String(m.robustness.sessionsFailed)],
  ];
  const out = ['# Delivery benchmark: measures', '', `| | ${names.join(' | ')} |`, `| --- | ${names.map(() => '---').join(' | ')} |`];
  for (const [label, f] of rows) out.push(`| ${label} | ${names.map((n) => f(runs[n] as Measures)).join(' | ')} |`);
  for (const n of names) {
    const m = runs[n] as Measures;
    out.push('', `## ${n}`, '', '| Path | Requests | Rules due | Coverage | Own share | Rule of another model, no note |', '| --- | --- | --- | --- | --- | --- |');
    for (const [p, x] of Object.entries(m.byPath)) out.push(`| ${p} | ${x.requests} | ${x.due} | ${pct(x.coverage)} | ${x.ownShare === null ? 'no rule text' : pct(x.ownShare)} | ${x.foreignUnretired} |`);
    out.push('', '| Sessions | Count | Rules due | Coverage | With an unexplained violation |', '| --- | --- | --- | --- | --- |');
    for (const [k, x] of [...Object.entries(m.robustness.byQuietPair), ...Object.entries(m.robustness.byStart), ...Object.entries(m.robustness.byLength)])
      out.push(`| ${k} | ${x.sessions} | ${x.due} | ${pct(x.coverage)} | ${x.sessionsFailed} |`);
    const classes = Object.entries(m.robustness.classes);
    if (classes.length) {
      out.push('', '| Violation | Sessions | Example |', '| --- | --- | --- |');
      for (const [k, x] of classes.sort()) out.push(`| ${k} | ${x.sessions} | ${x.example} |`);
    }
  }
  return `${out.join('\n')}\n`;
}
