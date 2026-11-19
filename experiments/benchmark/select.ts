// The seeded choice of the pilot's tasks. Every list comes from one ordering, sha256 of the seed and
// the task id, so anyone with the same inputs gets the same tasks, and a task dropped by the gold
// check is replaced by the next one in that order. The functions are pure over their inputs: the
// metadata comes from sources.ts, and the list of dropped tasks from the gold check's record.

import { createHash } from 'node:crypto';

/** A task's place in the seeded order: lower comes first. */
export function rank(seed: string, set: string | null, id: string): string {
  return createHash('sha256')
    .update(set === null ? `${seed}:${id}` : `${seed}:${set}:${id}`)
    .digest('hex');
}

/** What the selection reads of one SWE-bench Verified instance. */
export interface SwebenchInstance {
  readonly instance_id: string;
  readonly repo: string;
  readonly difficulty: string;
  /** Characters in the issue discussion (`hints_text`). */
  readonly hints_chars: number;
}

export interface BuildRule {
  /** Instances per difficulty stratum, in the order the strata are filled. */
  readonly strata: Readonly<Record<string, number>>;
  /** The repository that dominates the source (`django/django`, about 40 percent of it), held to a share of each stratum. */
  readonly capped_repo: string;
  readonly capped_share: number;
  /** The most instances any other repository may have over the whole build list. */
  readonly max_per_other_repo: number;
}

export interface DigestRule {
  readonly n: number;
  readonly strata: readonly string[];
  readonly min_hints_chars: number;
  readonly max_per_repo: number;
}

export interface SwebenchChoice {
  /** Per stratum, in rank order. */
  readonly build: Readonly<Record<string, readonly string[]>>;
  readonly digest: readonly string[];
}

/**
 * The build and digest lists from the instances that have a native arm64 image. The digest tasks
 * are drawn first, so the two lists never share an instance; each stratum of the build list takes
 * the next instances in rank order, while the dominant repository stays within its share of the
 * stratum and every other repository within its total. The instances `excluded` from a list, those
 * whose reference solution or environment failed here, are skipped for that list only: an instance
 * whose patch fails can still serve a digest, which needs only its environment.
 */
export function chooseSwebench(
  seed: string,
  pool: readonly SwebenchInstance[],
  arm64: ReadonlySet<string>,
  build: BuildRule,
  digest: DigestRule,
  excluded: { readonly build?: ReadonlySet<string>; readonly digest?: ReadonlySet<string> } = {},
): SwebenchChoice {
  const eligible = pool.filter((r) => arm64.has(r.instance_id));
  const ordered = [...eligible].sort((a, b) => cmp(rank(seed, null, a.instance_id), rank(seed, null, b.instance_id)));
  const used = new Set<string>();

  const digestIds: string[] = [];
  const digestPerRepo = new Map<string, number>();
  for (const r of ordered) {
    if (digestIds.length === digest.n) break;
    if (excluded.digest?.has(r.instance_id) || !digest.strata.includes(r.difficulty) || r.hints_chars < digest.min_hints_chars) continue;
    if ((digestPerRepo.get(r.repo) ?? 0) >= digest.max_per_repo) continue;
    digestIds.push(r.instance_id);
    used.add(r.instance_id);
    digestPerRepo.set(r.repo, (digestPerRepo.get(r.repo) ?? 0) + 1);
  }

  const total = new Map<string, number>();
  const chosen: Record<string, string[]> = {};
  for (const [stratum, n] of Object.entries(build.strata)) {
    const share = Math.max(1, Math.floor(n * build.capped_share));
    let capped = 0;
    const ids: string[] = [];
    for (const r of ordered) {
      if (ids.length === n) break;
      if (r.difficulty !== stratum || used.has(r.instance_id) || excluded.build?.has(r.instance_id)) continue;
      if (r.repo === build.capped_repo ? capped >= share : (total.get(r.repo) ?? 0) >= build.max_per_other_repo) continue;
      ids.push(r.instance_id);
      used.add(r.instance_id);
      if (r.repo === build.capped_repo) capped++;
      else total.set(r.repo, (total.get(r.repo) ?? 0) + 1);
    }
    chosen[stratum] = ids;
  }
  return { build: chosen, digest: digestIds };
}

/** What the selection reads of one Terminal-Bench task, from its task.toml. */
export interface TerminalBenchTask {
  readonly id: string;
  readonly expert_time_estimate_min: number | null;
  readonly agent_timeout_sec: number;
  readonly memory_mb: number;
}

export interface RoutineRule {
  readonly n: number;
  readonly max_expert_min: number;
  readonly max_agent_timeout_sec: number;
  readonly max_memory_mb: number;
}

/** Routine work: the tasks an expert does in at most half an hour that fit the time and memory limits, first n by rank. */
export function chooseTerminalBench(seed: string, tasks: readonly TerminalBenchTask[], rule: RoutineRule, excluded: ReadonlySet<string> = new Set()): string[] {
  return tasks
    .filter((t) => t.expert_time_estimate_min !== null && t.expert_time_estimate_min <= rule.max_expert_min)
    .filter((t) => t.agent_timeout_sec <= rule.max_agent_timeout_sec && t.memory_mb <= rule.max_memory_mb)
    .filter((t) => !excluded.has(t.id))
    .sort((a, b) => cmp(rank(seed, 'tb', a.id), rank(seed, 'tb', b.id)))
    .slice(0, rule.n)
    .map((t) => t.id);
}

/** The first n of a list that is already in rank order (the pre-registered SWE Atlas and ReviewBench lists), skipping excluded ones. */
export function firstOf(ranked: readonly string[], n: number, excluded: ReadonlySet<string> = new Set()): string[] {
  return ranked.filter((id) => !excluded.has(id)).slice(0, n);
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
