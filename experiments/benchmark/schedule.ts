// The order of the pilot's runs, and when a night stops. Pure over its inputs, so it is tested
// without Harbor or a model.
//
// Runs go phase by phase in the plan's priority order (build off and on first, then the other sets'
// off and on, then placebo), and within a phase round by round. A round is cut into units, one per
// task and model, holding that pair's runs under each condition of the phase; the units and the
// conditions inside each unit are shuffled with the seed. A stop inside a round (the cap, the quota
// floor, an interruption) therefore leaves only whole units: every recorded run has its partners
// under the other conditions of the phase.

import { createHash } from 'node:crypto';
import type { Plan } from './plan.js';
import type { SetName } from './tasks.js';

export interface Cell {
  readonly set: SetName;
  readonly task: string;
  readonly model: string;
  readonly condition: string;
  readonly rep: number;
}

export interface Unit {
  readonly key: string;
  readonly cells: readonly Cell[];
}

export interface Round {
  readonly phase: string;
  readonly rep: number;
  readonly units: readonly Unit[];
}

export function cellKey(c: Cell): string {
  return `${c.set}.${c.task}.${c.model}.${c.condition}.${c.rep}`;
}

function seeded(seed: string, label: string): string {
  return createHash('sha256').update(`${seed}:order:${label}`).digest('hex');
}

/** Every round of the pilot, in the order they run. */
export function rounds(plan: Plan, tasks: Readonly<Record<SetName, readonly string[]>>, models: readonly string[]): Round[] {
  const out: Round[] = [];
  for (const phase of plan.phases)
    for (let rep = 1; rep <= plan.rounds; rep++) {
      const units: Unit[] = [];
      for (const set of phase.sets)
        for (const task of tasks[set] ?? [])
          for (const model of models) {
            const key = `${set}.${task}.${model}.${rep}`;
            const conditions = [...phase.conditions].sort((a, b) => (seeded(plan.seed, `${phase.name}:${key}:${a}`) < seeded(plan.seed, `${phase.name}:${key}:${b}`) ? -1 : 1));
            units.push({ key: `${phase.name}:${key}`, cells: conditions.map((condition) => ({ set, task, model, condition, rep })) });
          }
      units.sort((a, b) => (seeded(plan.seed, a.key) < seeded(plan.seed, b.key) ? -1 : 1));
      if (units.length) out.push({ phase: phase.name, rep, units });
    }
  return out;
}

/** What one run is expected to cost: the mean measured so far for its model and set, or the plan's figure, plus the judge for an open set. */
export function expectedCost(plan: Plan, cell: Cell, measured: ReadonlyMap<string, { n: number; mean: number }>, openSets: readonly SetName[]): number {
  const m = measured.get(`${cell.model}/${cell.set}`);
  const agent = m && m.n >= 3 ? m.mean : (plan.models[cell.model]?.expected_usd ?? 0);
  return agent + (openSets.includes(cell.set) ? plan.judge.expected_usd : 0);
}

export interface NightDecision {
  /** The rounds this night will run, from the first one not finished. */
  readonly rounds: readonly Round[];
  readonly projected_usd: number;
  /** Why no further round fits tonight. */
  readonly stop: string;
}

/**
 * The rounds a night takes on. It continues the first unfinished round, then starts whole rounds
 * while tonight's projected spend stays within the night's budget and the total within the cap;
 * a night always takes at least the unfinished round, so a round larger than one night still ends.
 */
export function planNight(all: readonly Round[], done: ReadonlySet<string>, cost: (c: Cell) => number, nightUsd: number, capLeftUsd: number): NightDecision {
  const pending = all
    .map((r) => ({ ...r, units: r.units.filter((u) => u.cells.some((c) => !done.has(cellKey(c)))) }))
    .filter((r) => r.units.length > 0);
  const chosen: Round[] = [];
  let projected = 0;
  for (const r of pending) {
    const c = r.units.flatMap((u) => u.cells.filter((x) => !done.has(cellKey(x)))).reduce((s, x) => s + cost(x), 0);
    if (chosen.length > 0 && projected + c > nightUsd) return { rounds: chosen, projected_usd: projected, stop: `the next round (${r.phase}, round ${r.rep}) would pass the night's budget` };
    if (projected + c > capLeftUsd) {
      if (chosen.length === 0) chosen.push(r);
      return { rounds: chosen, projected_usd: projected + (chosen.length === 1 && chosen[0] === r ? c : 0), stop: `the round (${r.phase}, round ${r.rep}) would pass the total cap` };
    }
    chosen.push(r);
    projected += c;
  }
  return { rounds: chosen, projected_usd: projected, stop: chosen.length ? 'every round is planned' : 'every round is done' };
}
