// The quota floor: between batches, the runner reads what is left of the account's weekly quota with
// `quota-axi --provider claude` and stops the night when it falls below the plan's floor. The account
// is the Claude Code configuration directory whose login the runs use, given as CLAUDE_CONFIG_DIR.

import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

export interface QuotaReading {
  /** Percent left of the binding all-models window. */
  readonly all_models: number | null;
  /** Percent left of each model's own window, when the plan has one (such as Fable's weekly limit). */
  readonly models: Readonly<Record<string, number>>;
  readonly resets_at: string | null;
  readonly error: string | null;
}

/** Parse `quota-axi --provider claude --json` (schema 5): the effective availability of each scope. */
export function parseQuota(json: string): QuotaReading {
  let data: any;
  try {
    data = JSON.parse(json);
  } catch {
    return { all_models: null, models: {}, resets_at: null, error: 'quota-axi printed no JSON' };
  }
  const claude = ((data?.providers ?? []) as Record<string, any>[]).find((p) => p.provider === 'claude');
  const scopes = (claude?.quotaSemantics?.effectiveAvailability ?? []) as Record<string, any>[];
  const all = scopes.find((q) => q.scope === 'all_models');
  const models: Record<string, number> = {};
  for (const q of scopes) {
    const m = /^model:(.+)$/.exec(String(q.scope));
    if (m && typeof q.effectivePercentRemaining === 'number') models[m[1] as string] = q.effectivePercentRemaining;
  }
  const weekly = ((claude?.windows ?? []) as Record<string, any>[]).find((w) => w.id === 'seven_day');
  const allLeft = typeof all?.effectivePercentRemaining === 'number' ? all.effectivePercentRemaining : null;
  return { all_models: allLeft, models, resets_at: weekly?.resetsAt ?? null, error: allLeft === null ? 'no all-models quota in the reading' : null };
}

/**
 * The environment that selects an account's login: CLAUDE_CONFIG_DIR for a configuration directory of
 * its own, and no CLAUDE_CONFIG_DIR at all for the default one (~/.claude), whose login Claude Code
 * keeps under a different key, so naming the directory finds no login.
 */
export function accountEnv(configDir: string, base: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const env = Object.fromEntries(Object.entries(base).filter((e): e is [string, string] => e[1] !== undefined));
  delete env.CLAUDE_CONFIG_DIR;
  if (path.resolve(configDir) !== path.join(os.homedir(), '.claude')) env.CLAUDE_CONFIG_DIR = configDir;
  return env;
}

/** Read the quota of the account in `configDir`, asking the vendor each time. */
export function readQuota(configDir: string): QuotaReading {
  const r = spawnSync('quota-axi', ['--provider', 'claude', '--json'], { encoding: 'utf8', env: accountEnv(configDir), timeout: 60_000 });
  if (r.error) return { all_models: null, models: {}, resets_at: null, error: `quota-axi: ${r.error.message}` };
  return parseQuota(r.stdout);
}

/**
 * Whether the next batch may start. An unreadable quota stops the night: the floor protects the
 * account, so a reading that cannot be had counts as below it. `model` is the alias of the model
 * the batch runs on (fable, opus, ...), checked also against that model's own window.
 */
export function aboveFloor(q: QuotaReading, floor: number, model: string): { ok: boolean; why: string } {
  if (q.all_models === null) return { ok: false, why: q.error ?? 'quota unreadable' };
  if (q.all_models < floor) return { ok: false, why: `weekly quota at ${q.all_models}%, below the ${floor}% floor` };
  const own = q.models[model];
  if (own !== undefined && own < floor) return { ok: false, why: `${model}'s weekly quota at ${own}%, below the ${floor}% floor` };
  return { ok: true, why: `weekly quota at ${q.all_models}%` };
}
