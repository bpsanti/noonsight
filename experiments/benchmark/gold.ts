// The gold check: before any paid run, each chosen task's reference solution runs here through
// Harbor's oracle agent, with no model. A task whose reference fails, or whose environment does not
// start on this machine, is dropped from every condition and replaced by the next task in the seeded
// order, until each set is complete or its pool runs out. The record (tasks/gold.json) is committed,
// so the dropped tasks and the reasons are part of the pre-registration.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { runTrial } from './harbor.js';
import { selection, wanted, type Excluded, type Plan, type Selection } from './plan.js';
import type { SwebenchInstance, TerminalBenchTask } from './select.js';
import { materialize, SETS, type SetName, type Sources } from './tasks.js';

export interface GoldEntry {
  readonly set: SetName;
  readonly id: string;
  readonly sha256: string;
  readonly passed: boolean;
  readonly reward: number | null;
  readonly error: string | null;
  /** Wall time of the whole trial and of its parts, in seconds; the first trial of an image includes its pull or build. */
  readonly seconds: { readonly total: number; readonly environment: number; readonly agent: number; readonly verifier: number };
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

/** The tasks each set has dropped: the latest entry of a task decides, so a recheck can bring one back. */
export function excludedBy(record: GoldRecord): Excluded {
  const latest = new Map<string, GoldEntry>();
  for (const e of record.entries) latest.set(`${e.set}/${e.id}`, e);
  const out: Partial<Record<SetName, Set<string>>> = {};
  for (const e of latest.values()) if (!e.passed) (out[e.set] ??= new Set()).add(e.id);
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

/** Whether this Docker can run an amd64 image: SWE Atlas publishes its images only for amd64. */
export function canRunAmd64(): boolean {
  const r = spawnSync('docker', ['run', '--rm', '--platform', 'linux/amd64', 'alpine:3.20', 'uname', '-m'], { encoding: 'utf8', timeout: 180_000 });
  return r.status === 0 && r.stdout.trim() === 'x86_64';
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

/** Check every chosen task not yet checked, one at a time, refilling the sets until nothing new is chosen. */
export async function goldCheck(o: GoldOptions): Promise<{ selection: Selection; record: GoldRecord }> {
  let record = readGold(o.record);
  const skipped: Partial<Record<SetName, string>> = { ...record.skipped };
  if (o.sets.includes('investigate') && !canRunAmd64()) skipped.investigate = 'SWE Atlas images are built only for amd64, and this Docker cannot run amd64 images';
  else delete skipped.investigate;
  const save = (): void => {
    record = { ...record, machine: o.machine, skipped };
    fs.writeFileSync(o.record, `${JSON.stringify(record, null, 2)}\n`);
  };
  save();
  for (;;) {
    const sel = selection(o.plan, o.swebench, o.arm64, o.terminalBench, excludedBy(record));
    const todo = unchecked(sel, record).filter((t) => o.sets.includes(t.set) && !skipped[t.set]);
    if (todo.length === 0) {
      const want = wanted(o.plan);
      for (const set of o.sets) if (sel[set].length < want[set]) o.log(`${set}: the pool ran out with ${sel[set].length} of ${want[set]} tasks`);
      return { selection: sel, record };
    }
    for (const t of todo) {
      const m = materialize(t.set, t.id, o.sources, o.work, o.hasArm64);
      if (!dockerUp()) throw new Error('Docker is not reachable; the gold check stops without recording anything for the tasks left');
      o.log(`gold ${t.set}/${t.id}`);
      const trial = await runTrial({ harbor: o.harbor, task: m.dir, jobsDir: path.join(o.work, 'gold'), jobName: `${t.set}-${t.id}-${Date.now()}`, agentArgs: ['-a', 'oracle'], timeoutMs: 90 * 60 * 1000 });
      // A trial that failed because Docker went away says nothing about the task: stop, and check it again on the next call.
      if (trial.dir === null || !dockerUp()) throw new Error(`the trial of ${t.set}/${t.id} ended without a result or with Docker unreachable (${trial.error ?? 'no error recorded'}); nothing was recorded for it`);
      const passed = trial.reward === 1 && trial.error === null;
      const entry: GoldEntry = {
        set: t.set,
        id: t.id,
        sha256: m.sha256,
        passed,
        reward: trial.reward,
        // The record is committed: the reason without Harbor's command line and without this machine's paths.
        error: trial.error ? trial.error.split('. Command: ')[0]!.replace(/\/(Users|home|private|var|tmp)\/\S*/g, '<path>') : passed ? null : `reward ${trial.reward}`,
        seconds: { total: trial.seconds.total, environment: trial.seconds.environment, agent: trial.seconds.agent, verifier: trial.seconds.verifier },
        at: new Date().toISOString(),
      };
      record = { ...record, entries: [...record.entries, entry] };
      save();
      o.log(`     ${passed ? 'pass' : 'FAIL'} in ${entry.seconds.total}s${entry.error ? `: ${entry.error.slice(0, 160)}` : ''}`);
    }
  }
}
