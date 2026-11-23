// The evidence map (docs/evidence.md) against the raw results it points to, and the pages that cite
// it: every value and every other number of an entry is computed again from its raw file, each entry
// and each run of the map's table carries the date and the Claude Code version of its run, a run or an
// entry that a later run measured again is marked superseded, and every line of README.md,
// docs/usage.md and docs/sources.md that states a measurement cites an entry whose value it quotes and
// the version it ran on. No page outside a superseded run's own folder states a superseded value, or
// links to a superseded run, without saying so.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { renderMarkdown } from '../experiments/delivery/measure.js';
import { PACKAGE_ROOT } from '../src/config/paths.js';
import { PRIMARY, proseLines, readMap, readSources } from './docs-lib.js';

/** The pages whose measurements must each cite an entry of the map. */
export const CITING_PAGES = ['README.md', 'docs/usage.md', 'docs/sources.md'];

// --- Reading the raw results ---------------------------------------------------------------

/** The superseded run of 2026-11-21, on Claude Code 2.1.328. */
const DELIVERY_OLD = 'experiments/delivery/results/claude-code-2.1.328/2026-11-21-d5fd71f';
/** The superseded run before that, whose comparisons hold the build before the fixes of F1 and F2 and the native alternatives against `on`. */
const DELIVERY_BEFORE = 'experiments/delivery/results/claude-code-2.1.328/2026-11-20-4e18c43';
/** The current delivery run, with generator 2 (experiments/delivery/generate.ts), on Claude Code 2.1.330. */
const DELIVERY = 'experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130';
const RULES = 'experiments/rules/results';

/** What a computation read, recorded so that its entry's source, date, version and status are checked against it. */
const filesRead = new Set<string>();
const cellsRead = new Set<string>();

const load = (rel: string): any => JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, rel), 'utf8'));
const loadLines = (rel: string): any[] =>
  fs
    .readFileSync(path.join(PACKAGE_ROOT, rel), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
const json = (rel: string): any => {
  filesRead.add(rel);
  return load(rel);
};
const runs = (rel: string): any[] => {
  filesRead.add(rel);
  return loadLines(rel);
};

const n = (x: number): string => x.toLocaleString('en-US');
/** A share as a percentage to one decimal; none and all are written 0% and 100%. */
const pct = (x: number): string => (x === 0 ? '0%' : x === 1 ? '100%' : `${(x * 100).toFixed(1)}%`);
const of = (a: number, b: number): string => `${n(a)} of ${n(b)}`;
const pctOf = (a: number, b: number): string => `${pct(a / b)} (${of(a, b)})`;
const usd = (x: number): string => `$${x.toFixed(4)}`;
const mean = (xs: readonly number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;
/** The own share from its counts, since a share already rounded to four decimals can round again the wrong way. */
const ownShare = (m: any): number => {
  const p = m.precision.parts;
  const own = p.ownFirst + p.ownDuplicate + p.ownUnexpected;
  return own / (own + p.foreignRetired + p.foreignUnretired);
};
const and = (xs: readonly string[]): string => (xs.length <= 2 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

const summary = (key: string): any => json(`${DELIVERY_OLD}/summary.json`)[key];
const now = (key: string): any => json(`${DELIVERY}/summary.json`)[key];
const g2 = (): any => now('on-g2-s1-n300');
/** The paths only generator 2 draws, as measure.ts names them. */
const G2_PATHS = [
  'a /fork session',
  'after /fork',
  'after /branch',
  'after a forking resume',
  'after a forking resume with --model',
  'after /resume in the session',
  'in plan mode',
  'after leaving plan mode',
  'after starting subagents that edit',
];
/** Sessions that broke the invariant of those that ran to the end, checked against the counts the entry's claim gives. */
function failedOfRan(m: any, generated: number, ran: number): string {
  assert.deepEqual([m.sessions, m.harness.ok], [generated, ran], 'the sessions generated and run to the end');
  return of(m.robustness.sessionsFailed, m.harness.ok);
}
const comparison = (id: string): any => (json(`${DELIVERY_BEFORE}/comparison.json`).comparisons as any[]).find((c) => c.id === id);

/** A cell of a rule effect result: what a later run would have to measure again to supersede it. */
const cellOf = (r: any): string => [r.task, r.model, r.arm, r.effort].join('/');
/** The runs of one cell of a rule effect result. */
function cell(result: string, filter: { task?: string; model?: string; arm?: string }, file = 'runs.jsonl'): any[] {
  const found = runs(`${RULES}/${result}/${file}`).filter((r) => Object.entries(filter).every(([k, v]) => r[k] === v));
  for (const r of found) cellsRead.add(cellOf(r));
  return found;
}
/** "Tests after the last edit": runs that ran the tests after their last edit, of those that edited code. */
function tested(rs: readonly any[]): string {
  const edited = rs.filter((r) => r.signals.edited);
  return of(edited.filter((r) => r.signals.verified).length, edited.length);
}
const completed = (rs: readonly any[]): string => of(rs.filter((r) => r.signals.completed).length, rs.length);
const cost = (rs: readonly any[]): string => usd(mean(rs.map((r) => r.cost_usd)));

/** The arms an entry that compares them reads, in the order it gives them. */
const ARMS = ['on-g2-s1-n300', 'claudemd-g2-s1-n60', 'rules-g2-s1-n60'];
function hookTime(file: string): string {
  const medians = Object.values(json(file).hooks as Record<string, any>).map((h) => h.cpu.median as number);
  return `${Math.min(...medians)} to ${Math.max(...medians)} ms`;
}
/** The paid pilot's runs, infrastructure failures left out. */
const pilot = (): any[] => runs('experiments/benchmark/results/2026-11-19/runs.jsonl').filter((r) => !r.infra_failure);

/** How each entry's value is computed from its raw file, as its Measurement field says. */
const COMPUTE: Record<string, () => string> = {
  D1: () => failedOfRan(summary('on-s1-n300'), 300, 300),
  D2: () => pctOf(summary('on-s1-n300').coverage.covered, summary('on-s1-n300').coverage.due),
  D3: () => pctOf(summary('on-s1-n300').coverage.subagents.covered, summary('on-s1-n300').coverage.subagents.due),
  D4: () => {
    const earlier = json('experiments/delivery/results/claude-code-2.1.328/2026-11-19-467d465/summary.json')['on-s1-n300'];
    assert.deepEqual([earlier.sessions, earlier.harness], [300, { ok: 296, 'step-timeout': 4 }], 'D4: the earlier run\'s sessions generated and run');
    return of(comparison('P1').a, comparison('P1').pairs.sessions);
  },
  D5: () => pct(comparison('P3').b),
  D6: () => pctOf(summary('claudemd-s1-n60').coverage.covered, summary('claudemd-s1-n60').coverage.due),
  D7: () => pctOf(summary('rules-s1-n60').coverage.covered, summary('rules-s1-n60').coverage.due),
  D8: () => pctOf(summary('skills-s1-n60').coverage.covered, summary('skills-s1-n60').coverage.due),
  D9: () => pct(comparison('P6').b),
  D10: () => {
    const [a, b] = ['claudemd-s1-n60', 'rules-s1-n60'].map((k) => pctOf(summary(k).coverage.subagents.covered, summary(k).coverage.subagents.due));
    assert.equal(a, b, 'D10: the CLAUDE.md and .claude/rules arms differ');
    return a as string;
  },
  D11: () => of(summary('skills-s1-n60').coverage.subagents.covered, summary('skills-s1-n60').coverage.subagents.due),
  D12: () => and(['on-s1-n300', 'claudemd-s1-n60', 'rules-s1-n60'].map((k) => pct(ownShare(summary(k))))),
  D13: () => and(['on-s1-n300', 'claudemd-s1-n60', 'rules-s1-n60'].map((k) => n(summary(k).cost.addedCharsPerAgentRequest))),
  D14: () => and(['on-s1-n300', 'claudemd-s1-n60', 'rules-s1-n60'].map((k) => n(summary(k).robustness.requestsWithViolation['foreign-unretired']))),
  D15: () => hookTime(`${DELIVERY_OLD}/hooktime.json`),
  D16: () => {
    const corpus = json(`${DELIVERY_OLD}/corpus.json`) as any[];
    return of(corpus.filter((e) => e.outcome === 'as-expected').length, corpus.length);
  },
  D17: () => {
    const c = summary('claudemd-s1-n60').coverage;
    return pctOf(c.covered - c.subagents.covered, c.due - c.subagents.due);
  },
  D18: () => failedOfRan(g2(), 300, 299),
  D19: () => pctOf(g2().coverage.covered, g2().coverage.due),
  D20: () => pctOf(g2().coverage.subagents.covered, g2().coverage.subagents.due),
  D21: () => {
    const paths = G2_PATHS.map((p) => g2().byPath[p]);
    assert.ok(paths.every((p) => p !== undefined), 'D21: a path generator 2 added has no requests');
    return pctOf(paths.reduce((n, p) => n + Math.round(p.coverage * p.due), 0), paths.reduce((n, p) => n + p.due, 0));
  },
  D22: () => {
    const starts = Object.entries(g2().robustness.byStart as Record<string, any>).filter(([k]) => k !== 'claude').map(([, v]) => v);
    return pctOf(starts.reduce((n, x) => n + x.covered, 0), starts.reduce((n, x) => n + x.due, 0));
  },
  D23: () => {
    const corpus = json(`${DELIVERY}/corpus.json`) as any[];
    return of(corpus.filter((e) => e.outcome === 'as-expected').length, corpus.length);
  },
  D24: () => {
    const corpus = json(`${DELIVERY}/before-fix/corpus.json`) as any[];
    return of(corpus.filter((e) => e.outcome === 'regressed').length, corpus.length);
  },
  D25: () => pctOf(now('claudemd-g2-s1-n60').coverage.covered, now('claudemd-g2-s1-n60').coverage.due),
  D26: () => pctOf(now('rules-g2-s1-n60').coverage.covered, now('rules-g2-s1-n60').coverage.due),
  D27: () => pctOf(now('skills-g2-s1-n60').coverage.covered, now('skills-g2-s1-n60').coverage.due),
  D28: () => {
    const [a, b] = ['claudemd-g2-s1-n60', 'rules-g2-s1-n60'].map((k) => pctOf(now(k).coverage.subagents.covered, now(k).coverage.subagents.due));
    assert.equal(a, b, 'D28: the CLAUDE.md and .claude/rules arms differ');
    return a as string;
  },
  D29: () => of(now('skills-g2-s1-n60').coverage.subagents.covered, now('skills-g2-s1-n60').coverage.subagents.due),
  D30: () => and(ARMS.map((k) => pct(ownShare(now(k))))),
  D31: () => and(ARMS.map((k) => n(now(k).cost.addedCharsPerAgentRequest))),
  D32: () => and(ARMS.map((k) => n(now(k).robustness.requestsWithViolation['foreign-unretired']))),
  D33: () => hookTime(`${DELIVERY}/hooktime.json`),
  D34: () => {
    const m = now('claudemd-g2-s1-n60');
    for (const [p, x] of Object.entries(m.byPath as Record<string, any>)) if (p !== 'subagent') assert.equal(x.coverage, 1, `D34: ${p}`);
    return pctOf(m.coverage.covered - m.coverage.subagents.covered, m.coverage.due - m.coverage.subagents.due);
  },
  B1: () => {
    const passed = (c: string): string => {
      const rs = pilot().filter((r) => r.condition === c && typeof r.resolved === 'boolean');
      return of(rs.filter((r) => r.resolved).length, rs.length);
    };
    return and(['off', 'on', 'claudemd'].map(passed));
  },
  B2: () => and(['off', 'on', 'claudemd', 'scattered'].map((c) => `$${mean(pilot().filter((r) => r.condition === c && r.rep === 1).map((r) => r.cost_usd)).toFixed(3)}`)),
  R1: () => {
    const t = (model: string, arm: string): string => tested(cell('2026-11-19', { task: 'fix', model, arm }));
    return `${t('sonnet', 'rules')} against ${t('sonnet', 'none')}, and ${t('haiku', 'rules')} against ${t('haiku', 'none')}`;
  },
  R2: () => `${tested(cell('2026-11-19', { task: 'bug', model: 'sonnet', arm: 'rules' }))} against ${tested(cell('2026-11-19', { task: 'bug', model: 'sonnet', arm: 'none' }))}`,
  R3: () => {
    const t = (model: string, arm: string): string => tested(cell('2026-11-20', { task: 'fix', model, arm }));
    return `${t('sonnet', 'verify')} and ${t('haiku', 'verify')}; ${t('sonnet', 'carry')} and ${t('haiku', 'carry')}`;
  },
  R4: () => {
    const pointer = cell('2026-11-20', { arm: 'pointer' });
    return of(pointer.filter((r) => r.signals.pointer?.read === true).length, pointer.length);
  },
  R5: () => {
    const t = (model: string, arm: string): string => tested(cell('2026-11-20', { task: 'fix', model, arm }));
    return `${t('sonnet', 'pointer')} against ${t('sonnet', 'verify')}, and ${t('haiku', 'pointer')} against ${t('haiku', 'verify')}`;
  },
  R6: () => and(['none', 'carry', 'verify', 'pointer', 'rules'].map((arm) => cost(cell('2026-11-20', { task: 'fix', model: 'sonnet', arm })))),
  R7: () => and(['none', 'carry', 'verify', 'pointer', 'rules'].map((arm) => cost(cell('2026-11-20', { task: 'fix', model: 'haiku', arm })))),
  R8: () => {
    const all = cell('2026-11-20', {});
    return of(all.filter((r) => r.signals.check_passed === true && r.signals.suite_passed === true).length, all.length);
  },
  R9: () =>
    ['question', 'bug', 'feature']
      .map((task) => {
        const wps = (arm: string): string => mean(cell('2026-11-19', { task, model: 'fable', arm }).map((r) => r.signals.report.words_per_sentence)).toFixed(1);
        return `${wps('rules')} against ${wps('none')}`;
      })
      .join(', '),
  R10: () => `${completed(cell('2026-11-20-harder', { task: 'triage', model: 'sonnet', arm: 'carry' }))} against ${completed(cell('2026-11-20-harder', { task: 'triage', model: 'sonnet', arm: 'none' }))}`,
  R11: () => `${completed(cell('2026-11-20-harder', { task: 'triage', model: 'haiku', arm: 'carry' }))} against ${completed(cell('2026-11-20-harder', { task: 'triage', model: 'haiku', arm: 'none' }))}`,
  R12: () => completed(cell('2026-11-20-long', {}, 'pilot/runs.jsonl')),
  R14: () => {
    const t = (model: string, arm: string): string => tested(cell('2026-11-20', { task: 'fix', model, arm }));
    return `${t('sonnet', 'rules')} against ${t('sonnet', 'none')}, and ${t('haiku', 'rules')} against ${t('haiku', 'none')}`;
  },
  R15: () => `${tested(cell('2026-11-20', { task: 'bug', model: 'sonnet', arm: 'rules' }))} against ${tested(cell('2026-11-20', { task: 'bug', model: 'sonnet', arm: 'none' }))}`,
  R16: () => and(['verify', 'carry'].map((arm) => tested(cell('2026-11-20', { task: 'bug', model: 'sonnet', arm })))),
  R17: () => and(['none', 'carry', 'verify', 'rules'].map((arm) => cost(cell('2026-11-20', { task: 'bug', model: 'sonnet', arm })))),
  R18: () => {
    const c = (model: string, arm: string): string => cost(cell('2026-11-20-harder', { task: 'triage', model, arm }));
    return `${c('sonnet', 'carry')} against ${c('sonnet', 'none')}, and ${c('haiku', 'carry')} against ${c('haiku', 'none')}`;
  },
  R19: () =>
    ['question', 'bug', 'feature']
      .map((task) => `${cost(cell('2026-11-19', { task, model: 'fable', arm: 'rules' }))} against ${cost(cell('2026-11-19', { task, model: 'fable', arm: 'none' }))}`)
      .join(', '),
  R13: () => `${tested(cell('2026-11-19', { task: 'feature', model: 'sonnet', arm: 'none' }))} and ${tested(cell('2026-11-19', { task: 'feature', model: 'haiku', arm: 'none' }))}`,
};

/**
 * The numbers an entry's claim and measurement state besides its value, read from the raw files too.
 * Every other number there fails the test.
 */
const ALSO: Record<string, () => (number | string)[]> = {
  D1: () => [summary('on-s1-n300').sessions],
  D4: () => {
    const earlier = json('experiments/delivery/results/claude-code-2.1.328/2026-11-19-467d465/summary.json')['on-s1-n300'];
    return [earlier.sessions, earlier.harness['step-timeout']];
  },
  D5: () => [comparison('P3').pairs.sessions],
  D9: () => [comparison('P6').pairs.sessions],
  D15: () => hookTimeSetup(`${DELIVERY_OLD}/hooktime.json`),
  D18: () => [g2().sessions],
  D25: () => [now('claudemd-g2-s1-n60').harness.ok],
  D26: () => [now('rules-g2-s1-n60').harness.ok],
  D27: () => [now('skills-g2-s1-n60').harness.ok],
  D28: () => [now('claudemd-g2-s1-n60').harness.ok],
  D29: () => [now('skills-g2-s1-n60').harness.ok],
  D33: () => hookTimeSetup(`${DELIVERY}/hooktime.json`),
  D34: () => [now('claudemd-g2-s1-n60').harness.ok],
  R12: () => [...new Set(Object.values(counts(cell('2026-11-20-long', {}, 'pilot/runs.jsonl'))))],
  R10: () => [(fs.readFileSync(path.join(PACKAGE_ROOT, 'experiments/rules/fixtures/pantry-stock/TICKETS.md'), 'utf8').split('\n## Done')[0]?.match(/^### PAN-\d+/gm) ?? []).length],
};
function hookTimeSetup(file: string): number[] {
  const h = json(file);
  return [h.runsPerHook, h.baseline.cpu.median, h.cpus, ...h.loadAverage];
}
const counts = (rs: readonly any[]): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const r of rs) out[cellOf(r)] = (out[cellOf(r)] ?? 0) + 1;
  return out;
};

// --- The committed runs --------------------------------------------------------------------

interface Run {
  /** Its folder, from the repository's root. */
  readonly folder: string;
  readonly family: string;
  readonly date: string;
  readonly version: string;
  /** When it started, to order the runs of one day. */
  readonly started: string;
  /** What a later run would have to measure again to supersede it; empty for a run with no raw file. */
  readonly cells: ReadonlySet<string>;
}

const exists = (rel: string): boolean => fs.existsSync(path.join(PACKAGE_ROOT, rel));

/** Every folder of results with a README, of the three experiments the map covers, oldest first. */
function committedRuns(): Run[] {
  const out: Run[] = [];
  const under = (rel: string): string[] => fs.readdirSync(path.join(PACKAGE_ROOT, rel)).filter((d) => exists(`${rel}/${d}/README.md`));
  for (const v of fs.readdirSync(path.join(PACKAGE_ROOT, 'experiments/delivery/results')))
    for (const d of under(`experiments/delivery/results/${v}`)) {
      const folder = `experiments/delivery/results/${v}/${d}`;
      const run = load(`${folder}/run.json`);
      assert.equal(v, `claude-code-${run.claudeCode}`, `${folder}: its run.json names another Claude Code version`);
      const arms = exists(`${folder}/summary.json`) ? Object.values(load(`${folder}/summary.json`) as Record<string, any>).filter((m) => !m.plant).map((m) => m.arm as string) : [];
      out.push({ folder, family: 'delivery', date: d.slice(0, 10), version: run.claudeCode, started: run.commands[0].at, cells: new Set(['corpus', ...arms]) });
    }
  for (const family of ['rules', 'benchmark'])
    for (const d of under(`experiments/${family}/results`)) {
      const folder = `experiments/${family}/results/${d}`;
      const rows = ['runs.jsonl', 'pilot/runs.jsonl'].filter((f) => exists(`${folder}/${f}`)).flatMap((f) => loadLines(`${folder}/${f}`));
      const versions = new Set(rows.map((r) => (r.claude_code ?? r.pins?.claude_code) as string | undefined).filter((v) => v !== undefined));
      if (rows.length === 0) versions.add(/^\| Claude Code \| (\S+) \|$/m.exec(fs.readFileSync(path.join(PACKAGE_ROOT, folder, 'README.md'), 'utf8'))?.[1] ?? 'none');
      assert.equal(versions.size, 1, `${folder}: ran on ${[...versions].join(', ')}`);
      const cells = rows.map((r) => (family === 'rules' ? cellOf(r) : [r.set, r.task, r.model, r.condition].join('/')));
      out.push({ folder, family, date: d.slice(0, 10), version: [...versions][0] as string, started: rows.map((r) => r.started as string).sort()[0] ?? d, cells: new Set(cells) });
    }
  return out.sort((x, y) => x.started.localeCompare(y.started));
}
const RUNS = committedRuns();
/** The runs after one, of the same experiment, that measured a cell again. */
const laterWith = (run: Run, cell: string): Run[] => RUNS.filter((r) => r.family === run.family && r.started > run.started && r.cells.has(cell));
function statusOf(run: Run): 'current' | 'superseded' | 'superseded in part' {
  const again = [...run.cells].filter((c) => laterWith(run, c).length > 0).length;
  return again === 0 ? 'current' : again === run.cells.size ? 'superseded' : 'superseded in part';
}
const runOf = (file: string): Run => {
  const run = RUNS.find((r) => file.startsWith(`${r.folder}/`));
  assert.ok(run, `${file} is in no committed run`);
  return run;
};

// --- The checks ----------------------------------------------------------------------------

const MAP = fs.readFileSync(path.join(PACKAGE_ROOT, 'docs', 'evidence.md'), 'utf8');
const ENTRIES = readMap(MAP);
const BY_ID = new Map(ENTRIES.map((e) => [e.id.toLowerCase(), e]));
const VERSION = /\b2\.1\.\d{3}\b/g;
const versionsOf = (e: { fields: Readonly<Record<string, string>> }): string[] => (e.fields.date ?? '').match(VERSION) ?? [];
const supersededBy = (e: { fields: Readonly<Record<string, string>> }): string | undefined => /^superseded by \[([A-Z]\d+)\]\(#[a-z]\d+\)\.$/.exec(e.fields.status ?? '')?.[1];
const SUPERSEDED_SECTION = MAP.indexOf('\n## Superseded results\n');

/** The numbers of a text, without those of code, links, dates, versions, entry and failure ids and model names. */
function numbersIn(text: string): string[] {
  return (
    text
      .replace(/`[^`]*`/g, ' ')
      .replace(/\]\([^)]*\)/g, ']')
      .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
      .replace(/\b\d+\.\d+\.\d+\b/g, ' ')
      .replace(/\b[A-Z]\d+\b/g, ' ')
      .replace(/\b(?:Fable|Opus|Sonnet|Haiku) \d\.\d\b/g, ' ')
      .replace(/\bgenerator \d\b/g, ' ')
      .match(/\d[\d,]*(?:\.\d+)?/g) ?? []
  ).map((x) => x.replace(/[.,]+$/, ''));
}

/** Run one entry's computation and say what it read. */
function compute(id: string): { value: string | undefined; also: Set<string>; files: string[]; cells: string[] } {
  filesRead.clear();
  cellsRead.clear();
  const value = COMPUTE[id]?.();
  const also = new Set((ALSO[id]?.() ?? []).map((x) => (typeof x === 'number' && x >= 1000 ? n(x) : String(x))));
  return { value, also, files: [...filesRead], cells: [...cellsRead] };
}

test('every entry of the evidence map has the fields a reader needs and a computation', () => {
  assert.ok(ENTRIES.length > 0);
  for (const e of ENTRIES) {
    for (const field of ['claim', 'value', 'source', 'measurement', 'date', 'status']) assert.ok(e.fields[field], `${e.id}: no ${field}`);
    assert.match(e.fields.date ?? '', /^\d{4}-\d{2}-\d{2}\b.*\*\*Claude Code:\*\* \d+\.\d+\.\d+\.$/, `${e.id}: the date line names the date and the Claude Code version`);
    assert.ok(e.fields.status === 'current.' || supersededBy(e), `${e.id}: its status is "current." or "superseded by" a linked entry`);
    assert.ok(COMPUTE[e.id], `${e.id}: no computation in test/evidence.test.ts`);
  }
  assert.deepEqual([...Object.keys(COMPUTE), ...Object.keys(ALSO)].filter((id) => !ENTRIES.some((e) => e.id === id)), [], 'computations without an entry');
  assert.equal(new Set(ENTRIES.map((e) => e.id)).size, ENTRIES.length, 'duplicate entry ids');
});

for (const e of ENTRIES) {
  test(`evidence ${e.id} is what its raw file gives`, () => {
    assert.equal(compute(e.id).value, e.value);
  });

  test(`evidence ${e.id}: every other number it states is in its raw file`, () => {
    const { also } = compute(e.id);
    const known = new Set([...also, ...numbersIn(e.value)]);
    assert.deepEqual(numbersIn(`${e.fields.claim} ${e.fields.measurement}`).filter((x) => !known.has(x)), []);
  });

  test(`evidence ${e.id} names the files it is computed from, and their date and Claude Code version`, () => {
    const { files } = compute(e.id);
    const named = [...(e.fields.source ?? '').matchAll(/`(experiments\/[^`]+)`/g)].map((m) => m[1] as string);
    assert.deepEqual([...new Set(files)].sort(), [...named].sort());
    assert.deepEqual(versionsOf(e), [...new Set(files.map((f) => runOf(f).version))]);
    for (const f of files) assert.ok(e.fields.date?.includes(runOf(f).date), `${e.id}: its date line lacks ${runOf(f).date}, the date of ${f}`);
  });

  test(`evidence ${e.id} is superseded if, and only if, a later run measured it again`, () => {
    const { files, cells } = compute(e.id);
    const later = files.flatMap((f) => {
      const run = runOf(f);
      return (run.family === 'rules' ? cells : [...run.cells]).flatMap((c) => laterWith(run, c));
    });
    const by = supersededBy(e);
    const at = MAP.indexOf(`\n### ${e.id}\n`);
    assert.equal(by !== undefined, later.length > 0, later.length ? `${[...new Set(later.map((r) => r.folder))].join(', ')} measured it again` : 'no later run measured it');
    assert.equal(at > SUPERSEDED_SECTION, by !== undefined, 'the superseded entries, and no others, are under "Superseded results"');
    if (by) assert.equal(BY_ID.get(by.toLowerCase())?.fields.status, 'current.', `${by} is a current entry`);
  });
}

test('the table of runs lists every committed run with its version, date, status and entries', () => {
  const rows = [...MAP.matchAll(/^\| \[([^\]]+)\]\(\.\.\/([^)]+)\/README\.md\) \| (\S+) \| (\S+) \| ([a-z ]+) \| (.+) \|$/gm)];
  const expand = (text: string): string[] =>
    text === 'none'
      ? []
      : text.split(', ').flatMap((p) => {
          const [from, to] = p.split(' to ') as [string, string | undefined];
          const [a, z] = [Number(from.slice(1)), Number((to ?? from).slice(1))];
          return Array.from({ length: z - a + 1 }, (_, i) => `${from[0]}${a + i}`);
        });
  const read = rows.map(([, , folder, date, version, status, entries]) => ({ folder: folder as string, date: date as string, version: version as string, status: status as string, entries: expand(entries as string).sort() }));
  const expected = RUNS.map((r) => ({
    folder: r.folder,
    date: r.date,
    version: r.version,
    status: statusOf(r) as string,
    entries: ENTRIES.filter((e) => (e.fields.source ?? '').includes(`${r.folder}/`)).map((e) => e.id).sort(),
  }));
  const by = (x: { folder: string }, y: { folder: string }): number => x.folder.localeCompare(y.folder);
  assert.deepEqual(read.sort(by), expected.sort(by));
});

test('the summary of each delivery run renders its summary.json', () => {
  for (const r of RUNS.filter((x) => exists(`${x.folder}/summary.json`)))
    assert.equal(fs.readFileSync(path.join(PACKAGE_ROOT, r.folder, 'summary.md'), 'utf8'), renderMarkdown(load(`${r.folder}/summary.json`)), r.folder);
});

test('the prose of the evidence map states no number and no version of its own', () => {
  const prose = MAP.split(/^### .*$/m)
    .map((part, i) => (i === 0 ? part : part.split('\n').filter((l) => !l.startsWith('- **')).join('\n')))
    .join('\n');
  assert.deepEqual(numbersIn(prose.split('\n').filter((l) => !l.startsWith('|')).join('\n')), []);
  const known = new Set(RUNS.map((r) => r.version));
  assert.deepEqual((MAP.match(VERSION) ?? []).filter((v) => !known.has(v)), [], 'versions no run ran on');
});

/** What reads as a measurement in prose: a percentage, "N of M", a dollar amount or a time in ms. */
const MEASUREMENT = /\d+(?:\.\d+)?%|\b\d[\d,]* of \d[\d,]*\b|\$\d[\d.,]*\d|\b\d+ (?:to \d+ )?ms\b/g;
const CITATION = /\[([^\]]*)\]\((?:\.\.\/|\.\/)?(?:docs\/)?evidence\.md#([a-z]\d+)\)/g;
/** A line may quote an entry's value whole, or its parts where the entry lists several. */
const partsOf = (value: string): string[] => [value, ...value.split(/, and |; | and |, | against /)].filter((p) => p.trim() !== '');

/** What a line is read with: for a row of a table, the sentence that introduces the table too. */
function inContext(lines: readonly string[], i: number): string {
  if (!lines[i]?.startsWith('|')) return lines[i] ?? '';
  let j = i;
  while (j > 0 && (lines[j]?.startsWith('|') || lines[j]?.trim() === '')) j--;
  return `${lines[j]} ${lines[i]}`;
}

for (const page of CITING_PAGES) {
  test(`${page}: every measurement cites the evidence map, quotes the value of the entry it cites, and names its Claude Code version`, () => {
    const text = fs.readFileSync(path.join(PACKAGE_ROOT, page), 'utf8');
    const lines = text.split('\n');
    const problems: string[] = [];
    for (const { line, text: prose, raw } of proseLines(text)) {
      const cited = [...raw.matchAll(CITATION)].map((m) => ({ shown: m[1] as string, id: m[2] as string }));
      let rest = prose;
      const context = inContext(lines, line - 1);
      const versions = new Set<string>();
      for (const { shown, id } of cited) {
        const entry = BY_ID.get(id);
        if (!entry) {
          problems.push(`${page}:${line} cites ${id.toUpperCase()}, which the map does not have`);
          continue;
        }
        // A line may also cite an entry for a statement without a number, such as which rule made a difference.
        const parts = partsOf(entry.value);
        if (!/^[A-Z]\d+$/.test(shown) && !parts.includes(shown)) problems.push(`${page}:${line} links "${shown}" to ${entry.id}, whose value is ${entry.value}`);
        for (const p of parts.sort((a, b) => b.length - a.length)) rest = rest.split(p).join(' ');
        for (const v of versionsOf(entry)) {
          versions.add(v);
          if (!context.includes(v)) problems.push(`${page}:${line} cites ${entry.id} without its Claude Code version, ${v}`);
        }
        if (supersededBy(entry) && !/superseded/i.test(context)) problems.push(`${page}:${line} cites ${entry.id}, which is superseded, without saying so`);
      }
      const left = rest.match(MEASUREMENT);
      if (left) problems.push(`${page}:${line} states ${left.join(', ')} without an evidence entry that gives it`);
      const others = cited.length ? (context.match(VERSION) ?? []).filter((v) => !versions.has(v)) : [];
      if (others.length) problems.push(`${page}:${line} names ${others.join(', ')}, which none of the entries it cites ran on`);
    }
    assert.deepEqual(problems, []);
  });
}

/** The tracked Markdown files outside the folder whose own tests fix what it says. */
const MARKDOWN = spawnSync('git', ['-C', PACKAGE_ROOT, 'ls-files', '-z', '*.md'], { encoding: 'utf8' })
  .stdout.split('\0')
  .filter((f) => f && !f.startsWith('experiments/adoption/') && exists(f));
const inSupersededRun = (file: string): boolean => RUNS.some((r) => file.startsWith(`${r.folder}/`) && statusOf(r) !== 'current');
const inAnyRun = (file: string): boolean => RUNS.some((r) => file.startsWith(`${r.folder}/`));

test('each superseded run says so at the top of its README, and links to the runs that replaced it', () => {
  assert.ok(MARKDOWN.length > 0);
  for (const r of RUNS) {
    const head = fs.readFileSync(path.join(PACKAGE_ROOT, r.folder, 'README.md'), 'utf8').split('\n').slice(0, 8).join('\n');
    const status = statusOf(r);
    const banner = /^> \*\*(Superseded(?: in part)?)\.\*\* /m.exec(head)?.[1]?.toLowerCase();
    assert.equal(banner ?? 'current', status, `${r.folder}: the README's banner`);
    if (status === 'current') continue;
    const latest = new Set([...r.cells].map((c) => laterWith(r, c).at(-1)).filter((x) => x !== undefined));
    for (const l of latest) assert.ok(head.includes(`${path.relative(r.folder, l.folder)}/README.md`), `${r.folder}: its banner does not link to ${l.folder}`);
  }
});

/** The measurements only superseded entries give, which read as a claim about noonsight today when nothing says they are history. */
const STALE = (() => {
  const tokens = (value: string): string[] => [...(value.match(MEASUREMENT) ?? []), ...(value.match(/\b\d{1,3}(?:,\d{3})+\b/g) ?? [])];
  const current = new Set(ENTRIES.filter((e) => !supersededBy(e)).flatMap((e) => tokens(e.value)));
  return [...new Set(ENTRIES.filter((e) => supersededBy(e)).flatMap((e) => tokens(e.value)))].filter((x) => !current.has(x));
})();

test('no page states a superseded value, or links to a superseded run, without saying that it is superseded', () => {
  assert.ok(STALE.includes('87.3%') && STALE.includes('15 of 30'), STALE.join(', '));
  const stale = STALE.map((x) => ({ x, plain: /^[\d,]+$/.test(x), re: new RegExp(`(?<![\\d.,])${x.replace(/[.$]/g, '\\$&')}(?![\\d])`) }));
  const gone = RUNS.filter((r) => statusOf(r) === 'superseded').map((r) => path.basename(r.folder));
  const problems: string[] = [];
  for (const file of MARKDOWN.filter((f) => !inSupersededRun(f) && !(inAnyRun(f) && path.basename(f) === 'summary.md'))) {
    const text = fs.readFileSync(path.join(PACKAGE_ROOT, file), 'utf8');
    const lines = text.split('\n');
    const end = file === 'docs/evidence.md' ? text.slice(0, SUPERSEDED_SECTION).split('\n').length : lines.length;
    for (let i = 0; i < end; i++) {
      const l = lines[i] ?? '';
      const found = [...stale.filter((s) => s.re.test(l) && !(s.plain && inAnyRun(file))).map((s) => s.x), ...gone.filter((g) => l.includes(g))];
      if (found.length && !/superseded/i.test(inContext(lines, i))) problems.push(`${file}:${i + 1} has ${found.join(', ')}`);
    }
  }
  assert.deepEqual(problems, []);
});

test('every page that names the folder of a run names the Claude Code version it ran on', () => {
  const problems: string[] = [];
  for (const file of MARKDOWN.filter((f) => !inAnyRun(f) && f !== 'docs/evidence.md')) {
    const lines = fs.readFileSync(path.join(PACKAGE_ROOT, file), 'utf8').split('\n');
    lines.forEach((l, i) => {
      for (const r of RUNS) {
        // The folder's name under its experiment's results, whole: "results/2026-11-20" is not "results/2026-11-20-long".
        const tail = r.folder.slice(r.folder.indexOf('/results/') + 1);
        const family = file.startsWith(`experiments/${r.family}/`) ? `(?:experiments/${r.family}/)?` : `experiments/${r.family}/`;
        const named = new RegExp(`(?:^|[^\\w/])(?:\\.\\./)*${family}${tail.replace(/\./g, '\\.')}(?![\\w-])`).test(l);
        if (named && !inContext(lines, i).includes(r.version)) problems.push(`${file}:${i + 1} names ${r.folder} without ${r.version}`);
      }
    });
  }
  assert.deepEqual(problems, []);
});

// --- Citations of Anthropic's documents ------------------------------------------------------

test('every source is a primary Anthropic page with a retrieval date and a literal excerpt', () => {
  const sources = readSources();
  assert.ok(sources.length > 0);
  for (const s of sources) {
    assert.match(s.id, /^S\d+$/, `source heading ${s.id}`);
    assert.match(s.url, PRIMARY, `${s.id}: ${s.url} is not one of Anthropic's own pages`);
    assert.match(s.retrieved, /^\d{4}-\d{2}-\d{2}$/, `${s.id}: retrieval date`);
    assert.ok(s.excerpts.length > 0, `${s.id}: no excerpt`);
  }
});

for (const page of ['README.md', 'docs/usage.md']) {
  test(`${page}: every citation of a source names one that docs/sources.md has`, () => {
    const ids = new Set(readSources().map((s) => s.id.toLowerCase()));
    const text = fs.readFileSync(path.join(PACKAGE_ROOT, page), 'utf8');
    const cited = [...text.matchAll(/sources\.md#(s\d+)\)/g)].map((m) => m[1] as string);
    assert.deepEqual(cited.filter((id) => !ids.has(id)), []);
  });
}
