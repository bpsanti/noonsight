// The shrinker: reduces a failing session to a shortest sequence that still shows the same class of
// violation, in the same kind of request. Every candidate is run again as a real session, so a result
// is a reproduction, not a guess.
//
// 1. Delta debugging over the steps: drop chunks, halving the chunk size, while the failure stays.
// 2. Simplify what is left: fewer calls in a spawn, no model parameter, a spawn or an edit as a plain
//    turn, a resume without --model, no scope.
//
// It keeps the class of the violation, not its cause: a session failing for one reason can shrink to a
// shorter sequence that fails the same way for another. After a fix, run the fuzz level again, not
// only the corpus.

import { show, valid, type Sequence, type Step } from './generate.js';
import type { ViolationClass } from './oracle.js';

export interface Target {
  readonly class: ViolationClass;
  readonly kind: 'main' | 'subagent';
}

/** Whether a sequence, run as a real session, still shows the target; false when the session itself did not run. */
export type Check = (spec: Sequence) => Promise<boolean>;

export interface Shrunk {
  readonly target: Target;
  readonly originalSteps: number;
  readonly minimalSteps: number;
  readonly runs: number;
  readonly seconds: number;
  readonly original: string;
  readonly minimal: string;
  readonly spec: Sequence;
}

function key(spec: Sequence): string {
  return JSON.stringify([spec.model, spec.scope, spec.unattended, spec.steps]);
}

function simpler(spec: Sequence): Sequence[] {
  const out: Sequence[] = [];
  spec.steps.forEach((s, i) => {
    const put = (step: Step): void => void out.push({ ...spec, steps: spec.steps.map((x, j) => (j === i ? step : x)) });
    if (s.k === 'spawn') {
      if (s.calls.length > 1) s.calls.forEach((_, c) => put({ ...s, calls: s.calls.filter((__, j) => j !== c) }));
      s.calls.forEach((call, c) => call.model && put({ ...s, calls: s.calls.map((x, j) => (j === c ? { ...x, model: null } : x)) }));
      if (s.calls.length === 1 && !s.calls[0]?.model) put({ k: 'turn' });
    }
    if (s.k === 'edit') put({ k: 'turn' });
    if (s.k === 'resume' && s.model) put({ ...s, model: null });
  });
  if (spec.scope) out.push({ ...spec, scope: null });
  return out;
}

/**
 * Shrink `base`, which must fail under `check`. Candidates are tried `concurrency` at a time, and the
 * first that still fails, in order, is kept, so a run is reproducible for a given `check`.
 */
export async function shrink(base: Sequence, target: Target, check: Check, concurrency = 4): Promise<Shrunk> {
  const started = Date.now();
  const cache = new Map<string, boolean>();
  let runs = 0;
  const fails = async (spec: Sequence): Promise<boolean> => {
    if (!valid(spec)) return false;
    const k = key(spec);
    const known = cache.get(k);
    if (known !== undefined) return known;
    runs++;
    const hit = await check(spec);
    cache.set(k, hit);
    return hit;
  };
  const firstFailing = async (candidates: readonly Sequence[]): Promise<Sequence | null> => {
    for (let i = 0; i < candidates.length; i += concurrency) {
      const batch = candidates.slice(i, i + concurrency);
      const hits = await Promise.all(batch.map(fails));
      const at = hits.indexOf(true);
      if (at >= 0) return batch[at] as Sequence;
    }
    return null;
  };

  if (!(await fails(base))) throw new Error(`the failure does not reproduce: ${show(base)}`);
  let spec = base;
  let n = 2;
  while (spec.steps.length >= 2) {
    const size = Math.ceil(spec.steps.length / n);
    const complements: Sequence[] = [];
    for (let at = 0; at < spec.steps.length; at += size) complements.push({ ...spec, steps: [...spec.steps.slice(0, at), ...spec.steps.slice(at + size)] });
    const smaller = await firstFailing(complements.filter((c) => c.steps.length > 0));
    if (smaller) {
      spec = smaller;
      n = Math.max(n - 1, 2);
    } else if (size === 1) break;
    else n = Math.min(n * 2, spec.steps.length);
  }
  for (let hit = await firstFailing(simpler(spec)); hit; hit = await firstFailing(simpler(spec))) spec = hit;
  return {
    target,
    originalSteps: base.steps.length,
    minimalSteps: spec.steps.length,
    runs,
    seconds: Math.round((Date.now() - started) / 1000),
    original: show(base),
    minimal: show(spec),
    spec: { model: spec.model, scope: spec.scope, unattended: spec.unattended, steps: spec.steps },
  };
}
