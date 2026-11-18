// The gold check: before any paid run, each chosen task's reference solution runs here through
// Harbor's oracle agent, with no model. A task whose reference fails, or whose environment does not
// start on this machine, is dropped from every condition and replaced by the next task in the seeded
// order, until each set is complete or its pool runs out. The record (tasks/gold.json) is committed,
// so the dropped tasks and the reasons are part of the pre-registration.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { runTrial } from './harbor.js';
import { BENCH_DIR, selection, wanted, type Excluded, type Plan, type Selection } from './plan.js';
import type { SwebenchInstance, TerminalBenchTask } from './select.js';
import { bundleBase, writeBundle } from './run.js';
import { materialize, SETS, type Materialized, type SetName, type Sources } from './tasks.js';

export interface GoldEntry {
  readonly set: SetName;
  readonly id: string;
  readonly sha256: string;
  readonly passed: boolean;
  readonly reward: number | null;
  readonly error: string | null;
  /** Wall time of the whole trial and of its parts, in seconds; the first trial of an image includes its pull or build. */
  readonly seconds: { readonly total: number; readonly environment: number; readonly agent: number; readonly verifier: number };
  /** Whether the noonsight agent installed on the task's image (checked once the oracle passes). */
  readonly agent_setup?: boolean;
  readonly at: string;
}

export interface GoldRecord {
  readonly machine: string;
  readonly entries: readonly GoldEntry[];
  /** Sets that could not be checked here at all, with the reason, such as images built only for amd64. */
  readonly skipped: Readonly<Partial<Record<SetName, string>>>;
}

export function readGold(file: string): GoldRecord {
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as GoldRecord) : { machine: '', entries: [], skipped: {} };
}

/**
 * The tasks each set has dropped: the latest entry of a task decides, so a recheck can bring one back.
 * With `currentSha`, a failure recorded for an earlier version of a task (a task the pilot has since
 * changed, such as an image now built for this machine) drops nothing, so the task is checked again.
 */
export function excludedBy(record: GoldRecord, currentSha?: (set: SetName, id: string) => string): Excluded {
  const latest = new Map<string, GoldEntry>();
  for (const e of record.entries) latest.set(`${e.set}/${e.id}`, e);
  const out: Partial<Record<SetName, Set<string>>> = {};
  for (const e of latest.values()) if (!e.passed && (!currentSha || currentSha(e.set, e.id) === e.sha256)) (out[e.set] ??= new Set()).add(e.id);
  return out;
}

/** The tasks of a selection that have no gold entry yet. */
export function unchecked(sel: Selection, record: GoldRecord): { set: SetName; id: string }[] {
  const seen = new Set(record.entries.map((e) => `${e.set}/${e.id}`));
  return SETS.flatMap((set) => sel[set].filter((id) => !seen.has(`${set}/${id}`)).map((id) => ({ set, id })));
}

/** Whether the Docker daemon answers. */
export function dockerUp(): boolean {
  return spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], { encoding: 'utf8', timeout: 30_000 }).status === 0;
}

/**
 * Whether the agent can run in an amd64 image here: SWE Atlas publishes its images only for amd64, and
 * Claude Code's x64 binary needs a CPU with AVX, which amd64 emulation on Apple silicon does not offer.
 */
export function canRunAmd64(): boolean {
  const r = spawnSync('docker', ['run', '--rm', '--platform', 'linux/amd64', 'alpine:3.20', 'sh', '-c', 'uname -m; grep -c -w avx /proc/cpuinfo || true'], { encoding: 'utf8', timeout: 180_000 });
  const [arch, avx] = r.stdout.trim().split('\n');
  return r.status === 0 && arch === 'x86_64' && Number(avx) > 0;
}

export interface GoldOptions {
  readonly plan: Plan;
  readonly harbor: string;
  readonly work: string;
  readonly record: string;
  readonly sources: Sources;
  readonly swebench: readonly SwebenchInstance[];
  readonly arm64: ReadonlySet<string>;
  readonly terminalBench: readonly TerminalBenchTask[];
  readonly hasArm64: (image: string) => boolean;
  readonly machine: string;
  readonly sets: readonly SetName[];
  readonly log: (line: string) => void;
}

/**
 * Whether the noonsight agent installs on a task's image: Claude Code, the pinned Node.js and
 * noonsight, through Harbor's install-only mode, with no token and no model. The oracle proves the
 * task; this proves the agent can run on it, which an image without xz, or an amd64 image under
 * emulation without AVX, does not allow.
 */
async function agentInstalls(o: GoldOptions, task: Materialized): Promise<{ ok: boolean; error: string | null }> {
  const base = bundleBase(o.plan, o.work, o.log);
  const bundle = path.join(o.work, 'bundles', 'gold-agent-check');
  const model = o.plan.models.haiku?.id ?? Object.values(o.plan.models)[0]!.id;
  writeBundle(o.plan, base, bundle, model, 'off');
  const trial = await runTrial({
    harbor: o.harbor,
    task: task.dir,
    jobsDir: path.join(o.work, 'gold'),
    jobName: `${task.set}-${task.id}-agent-${Date.now()}`,
    agentArgs: ['--install-only', '--skip-credential-checks', '--agent', 'noonsight_agent:NoonsightClaudeCode', '-m', `anthropic/${model}`, '--ak', `version=${o.plan.pins.claude_code}`, '--ak', `config=${path.join(bundle, 'condition', 'settings.json')}`],
    env: { PYTHONPATH: path.join(BENCH_DIR, 'harbor'), NOONSIGHT_BENCH_BUNDLE: bundle },
    timeoutMs: 30 * 60 * 1000,
  });
  if (trial.dir === null || !dockerUp()) throw new Error(`the agent check of ${task.set}/${task.id} ended without a result or with Docker unreachable; nothing was recorded for it`);
  return { ok: trial.error === null, error: trial.error ? `agent setup: ${clean(trial.error)}` : null };
}

/** An error as the committed record keeps it: without Harbor's command line and without this machine's paths. */
function clean(error: string): string {
  return (error.split('. Command: ')[0] ?? error).replace(/\/(Users|home|private|var|tmp)\/\S*/g, '<path>');
}

/**
 * Check every chosen task whose latest entry does not settle it, one at a time, refilling the sets
 * until nothing new is chosen. An entry settles a task when it is for the task as written now (the
 * same sha256) and either failed, or passed both the oracle and the agent check.
 */
export async function goldCheck(o: GoldOptions): Promise<{ selection: Selection; record: GoldRecord }> {
  let record = readGold(o.record);
  const skipped: Partial<Record<SetName, string>> = { ...record.skipped };
  if (o.sets.includes('investigate') && !canRunAmd64()) skipped.investigate = "SWE Atlas images are built only for amd64, and Claude Code's x64 binary cannot run here (no amd64, or no AVX under emulation)";
  else delete skipped.investigate;
  const save = (): void => {
    record = { ...record, machine: o.machine, skipped };
    fs.writeFileSync(o.record, `${JSON.stringify(record, null, 2)}\n`);
  };
  save();
  for (;;) {
    const sha = new Map<string, string>();
    const currentSha = (set: SetName, id: string): string => {
      const k = `${set}/${id}`;
      if (!sha.has(k)) sha.set(k, materialize(set, id, o.sources, o.work, o.hasArm64).sha256);
      return sha.get(k) as string;
    };
    const sel = selection(o.plan, o.swebench, o.arm64, o.terminalBench, excludedBy(record, (set, id) => (skipped[set] ? '' : currentSha(set, id))));
    let checked = 0;
    for (const set of SETS) {
      if (!o.sets.includes(set) || skipped[set]) continue;
      for (const id of sel[set]) {
        const m = materialize(set, id, o.sources, o.work, o.hasArm64);
        const latest = [...record.entries].reverse().find((e) => e.set === set && e.id === id);
        if (latest && latest.sha256 === m.sha256 && (!latest.passed || latest.agent_setup === true)) continue;
        if (!dockerUp()) throw new Error('Docker is not reachable; the gold check stops without recording anything for the tasks left');
        checked++;
        // The oracle runs again only when the task changed or has no oracle result yet.
        let oracle: Pick<GoldEntry, 'passed' | 'reward' | 'error' | 'seconds'>;
        if (latest && latest.sha256 === m.sha256 && latest.passed) oracle = latest;
        else {
          o.log(`gold ${set}/${id}`);
          const trial = await runTrial({ harbor: o.harbor, task: m.dir, jobsDir: path.join(o.work, 'gold'), jobName: `${set}-${id}-${Date.now()}`, agentArgs: ['-a', 'oracle'], timeoutMs: 90 * 60 * 1000 });
          // A trial that failed because Docker went away says nothing about the task: stop, and check it again on the next call.
          if (trial.dir === null || !dockerUp()) throw new Error(`the trial of ${set}/${id} ended without a result or with Docker unreachable (${trial.error ?? 'no error recorded'}); nothing was recorded for it`);
          const passed = trial.reward === 1 && trial.error === null;
          oracle = { passed, reward: trial.reward, error: trial.error ? clean(trial.error) : passed ? null : `reward ${trial.reward}`, seconds: { total: trial.seconds.total, environment: trial.seconds.environment, agent: trial.seconds.agent, verifier: trial.seconds.verifier } };
        }
        let agent: { ok: boolean; error: string | null } | null = null;
        if (oracle.passed) {
          o.log(`agent ${set}/${id}`);
          agent = await agentInstalls(o, m);
        }
        const entry: GoldEntry = {
          set,
          id,
          sha256: m.sha256,
          passed: oracle.passed && agent?.ok === true,
          reward: oracle.reward,
          error: oracle.error ?? agent?.error ?? null,
          seconds: oracle.seconds,
          ...(agent ? { agent_setup: agent.ok } : {}),
          at: new Date().toISOString(),
        };
        record = { ...record, entries: [...record.entries, entry] };
        save();
        o.log(`     ${entry.passed ? 'pass' : 'FAIL'}${entry.error ? `: ${entry.error.slice(0, 160)}` : ''}`);
      }
    }
    if (checked === 0) {
      const want = wanted(o.plan);
      for (const set of o.sets) if (!skipped[set] && sel[set].length < want[set]) o.log(`${set}: the pool ran out with ${sel[set].length} of ${want[set]} tasks`);
      return { selection: sel, record };
    }
  }
}
