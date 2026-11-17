// The pilot's plan (plan.json) and the task lists it yields. The lists are recomputed from the
// fetched metadata and the gold check's record every time, so the committed tasks/pilot.json is a
// copy anyone can check, not an input.

import fs from 'node:fs';
import path from 'node:path';
import { PACKAGE_ROOT } from '../../src/config/paths.js';
import { chooseSwebench, chooseTerminalBench, firstOf, type BuildRule, type DigestRule, type RoutineRule, type SwebenchInstance, type TerminalBenchTask } from './select.js';
import type { SetName } from './tasks.js';

export const BENCH_DIR = path.join(PACKAGE_ROOT, 'experiments', 'benchmark');

export interface ModelPlan {
  readonly id: string;
  /** Claude Code's --max-budget-usd for one run. */
  readonly budget_usd: number;
  /** The cost of one run used to plan rounds until the pilot has measured its own. */
  readonly expected_usd: number;
}

export interface Phase {
  readonly name: string;
  readonly sets: readonly SetName[];
  readonly conditions: readonly string[];
}

export interface Placebo {
  readonly id: string;
  readonly file: string;
  /** The preset rule whose scopes, places and length this text copies. */
  readonly mirrors: string;
}

export interface Plan {
  readonly seed: string;
  readonly effort: string;
  readonly unattended_env: string;
  readonly rounds: number;
  readonly cap_usd: number;
  readonly night_usd: number;
  readonly quota_floor_percent: number;
  readonly concurrency: number;
  readonly pins: {
    readonly claude_code: string;
    readonly harbor: string;
    /** The Node.js that runs noonsight's hooks inside the task containers, whose own Node is often too old. */
    readonly node: { readonly version: string; readonly sha256: Readonly<Record<'arm64' | 'x64', string>> };
    readonly datasets: Readonly<Record<string, string>>;
  };
  readonly models: Readonly<Record<string, ModelPlan>>;
  readonly conditions: Readonly<Record<string, { readonly use: 'none' | 'preset' | 'custom'; readonly placebo?: boolean }>>;
  readonly phases: readonly Phase[];
  readonly sets: {
    readonly build: BuildRule & { readonly scope: string };
    readonly routine: RoutineRule & { readonly scope: string };
    readonly digest: DigestRule & { readonly scope: string };
    readonly investigate: { readonly scope: string; readonly n: number; readonly ranked: readonly string[] };
    readonly review: { readonly scope: string; readonly n: number; readonly ranked: readonly string[] };
  };
  /** Minutes one run takes from container start to verdict, used to plan nights until the pilot has measured its own. */
  readonly expected_wall_min: Readonly<Record<SetName, number>>;
  readonly judge: { readonly model: string; readonly effort: string; readonly votes: number; readonly budget_usd: number; readonly expected_usd: number };
  readonly placebo: Readonly<Record<string, readonly Placebo[]>>;
}

export function loadPlan(file = path.join(BENCH_DIR, 'plan.json')): Plan {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Plan;
}

export type Selection = Readonly<Record<SetName, readonly string[]>>;

/** The tasks the gold check dropped, set by set. */
export type Excluded = Readonly<Partial<Record<SetName, ReadonlySet<string>>>>;

/** The pilot's tasks, set by set, leaving out the tasks `excluded` from each set. */
export function selection(plan: Plan, swebench: readonly SwebenchInstance[], arm64: ReadonlySet<string>, terminalBench: readonly TerminalBenchTask[], excluded: Excluded = {}): Selection {
  const swe = chooseSwebench(plan.seed, swebench, arm64, plan.sets.build, plan.sets.digest, { ...(excluded.build ? { build: excluded.build } : {}), ...(excluded.digest ? { digest: excluded.digest } : {}) });
  return {
    build: Object.values(swe.build).flat(),
    routine: chooseTerminalBench(plan.seed, terminalBench, plan.sets.routine, excluded.routine),
    digest: swe.digest,
    investigate: firstOf(plan.sets.investigate.ranked, plan.sets.investigate.n, excluded.investigate),
    review: firstOf(plan.sets.review.ranked, plan.sets.review.n, excluded.review),
  };
}

/** How many tasks each set asks for. */
export function wanted(plan: Plan): Record<SetName, number> {
  return {
    build: Object.values(plan.sets.build.strata).reduce((a, b) => a + b, 0),
    routine: plan.sets.routine.n,
    digest: plan.sets.digest.n,
    investigate: plan.sets.investigate.n,
    review: plan.sets.review.n,
  };
}
