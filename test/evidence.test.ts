// The evidence map (docs/evidence.md) against the raw results it points to, and the pages that cite
// it: every entry's value is computed again from its raw file, and every line of README.md,
// docs/usage.md and docs/sources.md that states a measurement cites an entry whose value it quotes.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { PACKAGE_ROOT } from '../src/config/paths.js';
import { PRIMARY, proseLines, readMap, readSources } from './docs-lib.js';

/** The pages whose measurements must each cite an entry of the map. */
export const CITING_PAGES = ['README.md', 'docs/usage.md', 'docs/sources.md'];

// --- Reading the raw results ---------------------------------------------------------------

const DELIVERY = 'experiments/delivery/results/claude-code-2.1.328/2026-11-21-d5fd71f';
/** The run before it, whose comparisons hold the build before the fixes of F1 and F2 and the native alternatives against `on`. */
const DELIVERY_BEFORE = 'experiments/delivery/results/claude-code-2.1.328/2026-11-20-4e18c43';
/** The run with generator 2 (experiments/delivery/generate.ts), on Claude Code 2.1.330. */
const DELIVERY_G2 = 'experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130';
const RULES = 'experiments/rules/results';

const json = (rel: string): any => JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, rel), 'utf8'));
const runs = (rel: string): any[] =>
  fs
    .readFileSync(path.join(PACKAGE_ROOT, rel), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));

const n = (x: number): string => x.toLocaleString('en-US');
/** A share as a percentage to one decimal; none and all are written 0% and 100%. */
const pct = (x: number): string => (x === 0 ? '0%' : x === 1 ? '100%' : `${(x * 100).toFixed(1)}%`);
const of = (a: number, b: number): string => `${n(a)} of ${n(b)}`;
const pctOf = (a: number, b: number): string => `${pct(a / b)} (${of(a, b)})`;
const usd = (x: number): string => `$${x.toFixed(4)}`;
const mean = (xs: readonly number[]): number => xs.reduce((s, x) => s + x, 0) / xs.length;
const and = (xs: readonly string[]): string => (xs.length <= 2 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

const summary = (key: string): any => json(`${DELIVERY}/summary.json`)[key];
const g2 = (): any => json(`${DELIVERY_G2}/summary.json`)['on-g2-s1-n300'];
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
const comparison = (id: string): any => (json(`${DELIVERY_BEFORE}/comparison.json`).comparisons as any[]).find((c) => c.id === id);

/** The runs of one cell of a rule effect result. */
function cell(result: string, filter: { task?: string; model?: string; arm?: string }, file = 'runs.jsonl'): any[] {
  return runs(`${RULES}/${result}/${file}`).filter((r) => Object.entries(filter).every(([k, v]) => r[k] === v));
}
/** "Tests after the last edit": runs that ran the tests after their last edit, of those that edited code. */
function tested(rs: readonly any[]): string {
  const edited = rs.filter((r) => r.signals.edited);
  return of(edited.filter((r) => r.signals.verified).length, edited.length);
}
const completed = (rs: readonly any[]): string => of(rs.filter((r) => r.signals.completed).length, rs.length);
const cost = (rs: readonly any[]): string => usd(mean(rs.map((r) => r.cost_usd)));

/** How each entry's value is computed from its raw file, as its Measurement field says. */
const COMPUTE: Record<string, () => string> = {
  D1: () => of(summary('on-s1-n300').robustness.sessionsFailed, summary('on-s1-n300').sessions),
  D2: () => pctOf(summary('on-s1-n300').coverage.covered, summary('on-s1-n300').coverage.due),
  D3: () => pctOf(summary('on-s1-n300').coverage.subagents.covered, summary('on-s1-n300').coverage.subagents.due),
  D4: () => of(comparison('P1').a, comparison('P1').pairs.sessions),
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
  D12: () => and(['on-s1-n300', 'claudemd-s1-n60', 'rules-s1-n60'].map((k) => pct(summary(k).precision.ownShare))),
  D13: () => and(['on-s1-n300', 'claudemd-s1-n60', 'rules-s1-n60'].map((k) => n(summary(k).cost.addedCharsPerAgentRequest))),
  D14: () => and(['on-s1-n300', 'claudemd-s1-n60', 'rules-s1-n60'].map((k) => n(summary(k).robustness.requestsWithViolation['foreign-unretired']))),
  D15: () => {
    const medians = Object.values(json(`${DELIVERY}/hooktime.json`).hooks as Record<string, any>).map((h) => h.cpu.median as number);
    return `${Math.min(...medians)} to ${Math.max(...medians)} ms`;
  },
  D16: () => {
    const corpus = json(`${DELIVERY}/corpus.json`) as any[];
    return of(corpus.filter((e) => e.outcome === 'as-expected').length, corpus.length);
  },
  D17: () => {
    const c = summary('claudemd-s1-n60').coverage;
    return pctOf(c.covered - c.subagents.covered, c.due - c.subagents.due);
  },
  D18: () => of(g2().robustness.sessionsFailed, g2().sessions),
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
    const corpus = json(`${DELIVERY_G2}/corpus.json`) as any[];
    return of(corpus.filter((e) => e.outcome === 'as-expected').length, corpus.length);
  },
  D24: () => {
    const corpus = json(`${DELIVERY_G2}/before-fix/corpus.json`) as any[];
    return of(corpus.filter((e) => e.outcome === 'regressed').length, corpus.length);
  },
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
  R13: () => `${tested(cell('2026-11-19', { task: 'feature', model: 'sonnet', arm: 'none' }))} and ${tested(cell('2026-11-19', { task: 'feature', model: 'haiku', arm: 'none' }))}`,
};

// --- The checks ----------------------------------------------------------------------------

test('every entry of the evidence map has the fields a reader needs and a computation', () => {
  const entries = readMap();
  assert.ok(entries.length > 0);
  for (const e of entries) {
    for (const field of ['claim', 'value', 'source', 'measurement', 'date']) assert.ok(e.fields[field], `${e.id}: no ${field}`);
    assert.match(e.fields.date ?? '', /^\d{4}-\d{2}-\d{2}\b.*\*\*Claude Code:\*\* \d+\.\d+\.\d+/, `${e.id}: the date line names the date and the Claude Code version`);
    assert.ok(COMPUTE[e.id], `${e.id}: no computation in test/evidence.test.ts`);
  }
  assert.deepEqual(Object.keys(COMPUTE).filter((id) => !entries.some((e) => e.id === id)), [], 'computations without an entry');
  assert.equal(new Set(entries.map((e) => e.id)).size, entries.length, 'duplicate entry ids');
});

for (const e of readMap()) {
  test(`evidence ${e.id} is what its raw file gives`, () => {
    assert.equal(COMPUTE[e.id]?.(), e.value);
  });
}

/** What reads as a measurement in prose: a percentage, "N of M", a dollar amount or a time in ms. */
const MEASUREMENT = /\d+(?:\.\d+)?%|\b\d[\d,]* of \d[\d,]*\b|\$\d[\d.,]*|\b\d+ (?:to \d+ )?ms\b/g;
const CITATION = /\]\((?:\.\.\/|\.\/)?(?:docs\/)?evidence\.md#([a-z]\d+)\)/g;

for (const page of CITING_PAGES) {
  test(`${page}: every measurement cites the evidence map, and quotes the value of the entry it cites`, () => {
    const file = path.join(PACKAGE_ROOT, page);
    const text = fs.readFileSync(file, 'utf8');
    const map = new Map(readMap().map((e) => [e.id.toLowerCase(), e]));
    const problems: string[] = [];
    for (const { line, text: prose, raw } of proseLines(text)) {
      const cited = [...raw.matchAll(CITATION)].map((m) => m[1] as string);
      let rest = prose;
      for (const id of cited) {
        const entry = map.get(id);
        if (!entry) {
          problems.push(`${page}:${line} cites ${id.toUpperCase()}, which the map does not have`);
          continue;
        }
        // A line may quote the value whole, or its parts where the entry lists several; a line may
        // also cite an entry for a statement without a number, such as which rule made a difference.
        const parts = [entry.value, ...entry.value.split(/, and |; | and |, | against /)].filter((p) => p.trim() !== '');
        for (const p of parts.sort((a, b) => b.length - a.length)) rest = rest.split(p).join(' ');
      }
      const left = rest.match(MEASUREMENT);
      if (left) problems.push(`${page}:${line} states ${left.join(', ')} without an evidence entry that gives it`);
    }
    assert.deepEqual(problems, []);
  });
}

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
