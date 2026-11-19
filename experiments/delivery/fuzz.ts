// The fuzz level: many random sessions, run in parallel, one result line per session.

import fs from 'node:fs';
import { generate, type Sequence, type Step } from './generate.js';
import { isAgent, type ViolationClass } from './oracle.js';
import { runSession, type RequestFact, type Run, type RunOptions, type SessionResult } from './session.js';

/** One violation of the invariant, in one request. */
export interface Found {
  readonly request: number;
  readonly step: number;
  readonly kind: RequestFact['kind'];
  readonly model: string;
  readonly class: ViolationClass;
  readonly rules: readonly string[];
  /** Why this violation is not noonsight failing its contract, or null when nothing explains it. */
  readonly known: string | null;
}

/**
 * The documented reason a violation is not noonsight failing its contract, or null. docs/hooks.md
 * ("SubagentStart: the rules"): several open calls of one type that would get different rules give
 * their subagents none, since the start does not say which call it belongs to.
 */
export function knownReason(spec: Sequence, fact: Pick<RequestFact, 'kind' | 'step'>, cls: ViolationClass): string | null {
  if (fact.kind !== 'subagent' || cls !== 'missing-own') return null;
  const step = spec.steps[fact.step] as Step | undefined;
  if (step?.k !== 'spawn') return null;
  const byType = new Map<string, Set<string>>();
  for (const c of step.calls) byType.set(c.type, (byType.get(c.type) ?? new Set()).add(c.model ?? '-'));
  return [...byType.values()].some((models) => models.size > 1) ? 'shared-start-calls-differ' : null;
}

export function violationsOf(result: Pick<SessionResult, 'spec' | 'facts'>): Found[] {
  const out: Found[] = [];
  for (const f of result.facts) {
    if (!isAgent(f)) continue;
    for (const v of f.violations) out.push({ request: f.i, step: f.step, kind: f.kind, model: f.model, class: v.class, rules: v.rules, known: knownReason(result.spec, f, v.class) });
  }
  return out;
}

/** A session's result with its violations, as one line of a results file. */
export interface Line extends SessionResult {
  readonly violations: readonly Found[];
}

/** Whether a session broke the invariant in a way nothing documented explains. */
export function failed(line: Pick<Line, 'harness' | 'violations'>): boolean {
  return line.harness === 'ok' && line.violations.some((v) => !v.known);
}

/** The distinct `class/kind` of a session's unexplained violations, sorted. */
export function signature(line: Pick<Line, 'violations'>): string[] {
  return [...new Set(line.violations.filter((v) => !v.known).map((v) => `${v.class}/${v.kind}`))].sort();
}

/** The part of a session id that names its sequence, `s<seed>-<index>`, the same under every arm and plant. */
export function sessionKey(id: string): string {
  return id.replace(/^.*-(s\d+-\d+)$/, '$1');
}

/** The sessions `from` to `from + n - 1` of a seed, under one arm. */
export function fuzzRuns(seed: number, n: number, arm: Run['arm'], plant: string | null = null, from = 0): Run[] {
  return Array.from({ length: n }, (_, k) => k + from).map((i) => ({ id: `${plant ? `plant-${plant}` : arm}-s${seed}-${String(i).padStart(4, '0')}`, arm, plant, ...generate(seed, i) }));
}

async function pool<T>(items: readonly T[], size: number, work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.max(1, size) }, async () => {
      while (next < items.length) await work(items[next++] as T);
    }),
  );
}

/** Run sessions `concurrency` at a time; each line is appended to `out` as it ends, when given. */
export async function runMany(runs: readonly Run[], opts: RunOptions, concurrency: number, out: string | null = null, progress = true): Promise<Line[]> {
  const all: Line[] = [];
  let done = 0;
  await pool(runs, concurrency, async (spec) => {
    let result: SessionResult;
    try {
      result = await runSession(spec, opts);
    } catch (e) {
      result = { id: spec.id, spec, harness: `error:${e instanceof Error ? e.message : String(e)}`, claudeCode: opts.claudeCode, ms: 0, steps: [], facts: [], decisions: [] };
    }
    const line: Line = { ...result, violations: violationsOf(result) };
    all.push(line);
    if (out) fs.appendFileSync(out, `${JSON.stringify(line)}\n`);
    done++;
    if (progress) {
      const bad = signature(line);
      process.stderr.write(`[${done}/${runs.length}] ${line.id} ${line.harness} ${Math.round(line.ms / 1000)}s requests=${line.facts.length}${bad.length ? ` VIOLATIONS=${bad.join(',')}` : ''}\n`);
    }
  });
  const order = new Map(runs.map((r, i) => [r.id, i]));
  return all.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export function readLines(file: string): Line[] {
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Line);
}
