// The pre-registered comparisons of a design in plan.json, evaluated on two results folders: the run
// the design names as `before`, and the one being compared (`after`).
//
// Each comparison reads one measure on two sides, a and b, each a run of one folder (a sessions file,
// or its first sessions), and says how b relates to a: `higher`, `lower`, `not-lower`, `same`, or null
// for a measure only reported. A `paired` comparison also pairs the sessions of the same sequence that
// ran on both sides and counts those where only one side shows an outcome:
//
//   failed              the session broke the invariant in a way nothing documented explains;
//   uncovered           a request of the session lacked a right rule, or held it retired;
//   uncovered-subagent  the same, for a subagent's request.
//
// The paired p is the exact McNemar test, and Holm's adjustment runs over the primary comparisons.
// A primary comparison is supported when the measure moves the way it expects and its adjusted p is
// below the design's alpha, and goes against it when the measure moves the other way with such a p.
// Every other comparison is read from the measure alone.

import fs from 'node:fs';
import path from 'node:path';
import { formatP, holm, mcnemar } from '../rules/stats.js';
import { failed, readLines, sessionKey, type Line } from './fuzz.js';
import { measure } from './measure.js';
import { isAgent } from './oracle.js';

export type Expect = 'higher' | 'lower' | 'not-lower' | 'same' | null;
export type Paired = 'failed' | 'uncovered' | 'uncovered-subagent';

export interface Side {
  readonly folder: 'before' | 'after';
  /** The sessions file's name, as summary.json keys it. */
  readonly run: string;
  /** Only the sessions with an index below this. */
  readonly first?: number;
  /** Where the measure is read: the measures of the sessions (default), or agree.json. */
  readonly file?: 'summary' | 'agree';
  /** A dotted path into the measures, when this side reads another one than the comparison's. */
  readonly measure?: string;
}

export interface Comparison {
  readonly id: string;
  readonly primary?: boolean;
  readonly question: string;
  readonly a: Side;
  readonly b: Side;
  readonly measure?: string;
  readonly expect: Expect;
  readonly paired?: Paired;
}

export interface Design {
  readonly description: string;
  readonly claudeCode: string;
  readonly command: string;
  readonly before: string;
  readonly alpha: number;
  readonly comparisons: readonly Comparison[];
}

export interface Pairs {
  /** Sessions of the same sequence measured on both sides. */
  readonly sessions: number;
  readonly both: number;
  readonly onlyA: number;
  readonly onlyB: number;
  readonly onlyAExamples: readonly string[];
  readonly onlyBExamples: readonly string[];
}

export interface Evaluated {
  readonly id: string;
  readonly primary: boolean;
  readonly question: string;
  readonly measure: string;
  /** Whether the measure is a share, shown as a percentage. */
  readonly share: boolean;
  readonly expect: Expect;
  readonly a: number | null;
  readonly b: number | null;
  readonly pairs: Pairs | null;
  readonly p: number | null;
  readonly adjustedP: number | null;
  readonly verdict: 'supported' | 'against' | 'inconclusive' | 'holds' | 'does not hold' | 'reported' | 'not measured';
}

/** A folder's sessions and its committed files, as the comparisons read them. */
export interface Folder {
  readonly sessions: (run: string) => Line[] | null;
  readonly file: (name: 'summary' | 'agree') => Record<string, unknown> | null;
}

export function folderAt(dir: string): Folder {
  const json = (f: string): Record<string, unknown> | null => (fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as Record<string, unknown>) : null);
  return {
    sessions: (run) => {
      const f = path.join(dir, 'sessions', `${run}.jsonl`);
      return fs.existsSync(f) ? readLines(f) : null;
    },
    file: (name) => json(path.join(dir, `${name}.json`)),
  };
}

export function readDesign(planFile: string, name: string): Design {
  const plan = JSON.parse(fs.readFileSync(planFile, 'utf8')) as { designs: Record<string, Design> };
  const d = plan.designs[name];
  if (!d) throw new Error(`plan.json has no design ${name}; it has ${Object.keys(plan.designs).join(', ')}`);
  return d;
}

function at(value: unknown, dotted: string): number | null {
  let v: unknown = value;
  for (const k of dotted.split('.')) v = v !== null && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined;
  return typeof v === 'number' ? v : null;
}

const index = (l: Line): number => Number(sessionKey(l.id).split('-')[1]);

function linesOf(folder: Folder, side: Side): Line[] | null {
  const lines = folder.sessions(side.run);
  return lines && side.first !== undefined ? lines.filter((l) => index(l) < (side.first as number)) : lines;
}

/** The measure on one side: from its sessions when the folder keeps them, else from the committed file. */
function valueOf(folder: Folder, side: Side, dotted: string): number | null {
  if (side.file === 'agree') return at(folder.file('agree')?.[side.run], dotted);
  const lines = linesOf(folder, side);
  if (lines) return at(measure(lines), dotted);
  return side.first === undefined ? at(folder.file('summary')?.[side.run], dotted) : null;
}

function shows(line: Line, outcome: Paired): boolean {
  if (outcome === 'failed') return failed(line);
  return line.facts.some((f) => isAgent(f) && f.covered === false && (outcome === 'uncovered' || f.kind === 'subagent'));
}

export function pair(a: readonly Line[], b: readonly Line[], outcome: Paired): Pairs {
  const bByKey = new Map(b.filter((l) => l.harness === 'ok').map((l) => [sessionKey(l.id), l]));
  let sessions = 0;
  let both = 0;
  const onlyA: string[] = [];
  const onlyB: string[] = [];
  for (const la of [...a].sort((x, y) => index(x) - index(y))) {
    const lb = bByKey.get(sessionKey(la.id));
    if (la.harness !== 'ok' || !lb) continue;
    sessions++;
    const [x, y] = [shows(la, outcome), shows(lb, outcome)];
    if (x && y) both++;
    else if (x) onlyA.push(sessionKey(la.id));
    else if (y) onlyB.push(sessionKey(lb.id));
  }
  return { sessions, both, onlyA: onlyA.length, onlyB: onlyB.length, onlyAExamples: onlyA.slice(0, 5), onlyBExamples: onlyB.slice(0, 5) };
}

function moved(a: number, b: number, expect: Exclude<Expect, null>): boolean {
  if (expect === 'higher') return b > a;
  if (expect === 'lower') return b < a;
  if (expect === 'not-lower') return b >= a;
  return b === a;
}

/** Every comparison of a design, with Holm's adjustment over the primary ones. */
export function evaluate(design: Design, folders: Readonly<Record<Side['folder'], Folder>>): Evaluated[] {
  const first = design.comparisons.map((c) => {
    const ma = c.a.measure ?? c.measure ?? '';
    const mb = c.b.measure ?? c.measure ?? '';
    const a = valueOf(folders[c.a.folder], c.a, ma);
    const b = valueOf(folders[c.b.folder], c.b, mb);
    const la = c.paired ? linesOf(folders[c.a.folder], c.a) : null;
    const lb = c.paired ? linesOf(folders[c.b.folder], c.b) : null;
    const pairs = c.paired && la && lb ? pair(la, lb, c.paired) : null;
    return { c, measure: ma === mb ? ma : `${ma} against ${mb}`, share: isShare(ma), a, b, pairs, p: pairs ? mcnemar(pairs.onlyA, pairs.onlyB) : null };
  });
  const tested = first.filter((x) => x.c.primary && x.p !== null);
  const adjusted = new Map(holm(tested.map((x) => x.p as number)).map((p, i) => [tested[i]?.c.id, p]));
  return first.map(({ c, measure: m, share, a, b, pairs, p }) => {
    const adjustedP = adjusted.get(c.id) ?? null;
    let verdict: Evaluated['verdict'];
    if (a === null || b === null) verdict = 'not measured';
    else if (c.expect === null) verdict = 'reported';
    else if (c.primary && adjustedP !== null && c.expect !== 'same' && c.expect !== 'not-lower') {
      const opposite = c.expect === 'higher' ? b < a : b > a;
      verdict = adjustedP < design.alpha && moved(a, b, c.expect) ? 'supported' : adjustedP < design.alpha && opposite ? 'against' : 'inconclusive';
    } else verdict = moved(a, b, c.expect) && (c.expect !== 'same' || !pairs || pairs.onlyA + pairs.onlyB === 0) ? 'holds' : 'does not hold';
    return { id: c.id, primary: c.primary === true, question: c.question, measure: m, share, expect: c.expect, a, b, pairs, p, adjustedP, verdict };
  });
}

/** The measures that are shares: a coverage, an own or right share, or agree.json's log and stub coverage. */
const isShare = (dotted: string): boolean => /(coverage|Share|^coverage\.log|^coverage\.stub)$/.test(dotted);

const show = (share: boolean, v: number | null): string => (v === null ? 'n/a' : share ? `${(100 * v).toFixed(1)}%` : String(v));

export function renderComparison(name: string, design: Design, rows: readonly Evaluated[]): string {
  const out = [
    `# Delivery benchmark: the comparisons of \`${name}\``,
    '',
    design.description,
    `a is the first side of each comparison, b the second; the run before is \`${design.before}\`.`,
    `A primary comparison is supported when its measure moves the way it expects and its p, adjusted by Holm over the primary comparisons, is below ${design.alpha}.`,
    '',
    '| | Question | Measure | Expects b | a | b | Paired sessions: both, only a, only b | p (adjusted) | Verdict |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const r of rows) {
    const pairs = r.pairs ? `${r.pairs.sessions}: ${r.pairs.both}, ${r.pairs.onlyA}, ${r.pairs.onlyB}` : '';
    const p = r.p === null ? '' : `${formatP(r.p)}${r.adjustedP === null ? '' : ` (${formatP(r.adjustedP)})`}`;
    out.push(`| ${r.id}${r.primary ? ' (primary)' : ''} | ${r.question} | \`${r.measure}\` | ${r.expect ?? 'reported only'} | ${show(r.share, r.a)} | ${show(r.share, r.b)} | ${pairs} | ${p} | ${r.verdict} |`);
  }
  const examples = rows.filter((r) => r.pairs && (r.pairs.onlyAExamples.length || r.pairs.onlyBExamples.length));
  if (examples.length) {
    out.push('', '| | Sessions only a shows (first five) | Sessions only b shows (first five) |', '| --- | --- | --- |');
    for (const r of examples) out.push(`| ${r.id} | ${r.pairs?.onlyAExamples.join(', ') || 'none'} | ${r.pairs?.onlyBExamples.join(', ') || 'none'} |`);
  }
  return `${out.join('\n')}\n`;
}
