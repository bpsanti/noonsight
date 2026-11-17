// Running one Harbor trial and reading what it left. Every pilot run and every gold check is one
// `harbor run` of one task with one attempt, so a job directory holds exactly one trial.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export interface HarborCall {
  /** The harbor executable, from a virtual environment with the pinned Harbor version. */
  readonly harbor: string;
  readonly task: string;
  readonly jobsDir: string;
  readonly jobName: string;
  /** Agent arguments: `-a oracle`, or the noonsight agent with its kwargs. */
  readonly agentArgs: readonly string[];
  readonly env?: Readonly<Record<string, string>>;
  /** Wall time after which the whole call is stopped. */
  readonly timeoutMs: number;
}

export interface Trial {
  readonly dir: string | null;
  readonly reward: number | null;
  /** The exception type and message Harbor recorded, if the trial failed before or during verification. */
  readonly error: string | null;
  readonly seconds: { readonly total: number; readonly environment: number; readonly agent_setup: number; readonly agent: number; readonly verifier: number };
  readonly exit: number | null;
}

/** Run one Harbor trial and wait for it. Harbor's own output goes to `<jobsDir>/<jobName>.log`. */
export function runTrial(c: HarborCall): Promise<Trial> {
  fs.mkdirSync(c.jobsDir, { recursive: true });
  const args = ['run', '-p', c.task, '-o', c.jobsDir, '--job-name', c.jobName, '-n', '1', '-q', ...c.agentArgs];
  const log = fs.openSync(path.join(c.jobsDir, `${c.jobName}.log`), 'w');
  return new Promise((resolve) => {
    const child = spawn(c.harbor, args, { env: { ...process.env, ...c.env }, stdio: ['ignore', log, log] });
    // At the time limit Harbor gets a minute to stop its trial and remove the container, then is killed.
    let hard: NodeJS.Timeout | undefined;
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      hard = setTimeout(() => child.kill('SIGKILL'), 60_000);
    }, c.timeoutMs);
    child.on('close', (status) => {
      clearTimeout(timer);
      if (hard) clearTimeout(hard);
      fs.closeSync(log);
      resolve({ ...readTrial(path.join(c.jobsDir, c.jobName)), exit: status });
    });
  });
}

/** The single trial of a job directory. */
export function readTrial(jobDir: string): Omit<Trial, 'exit'> {
  const trials = fs.existsSync(jobDir) ? fs.readdirSync(jobDir, { withFileTypes: true }).filter((d) => d.isDirectory() && fs.existsSync(path.join(jobDir, d.name, 'result.json'))) : [];
  const none = { total: 0, environment: 0, agent_setup: 0, agent: 0, verifier: 0 };
  if (trials.length !== 1) return { dir: null, reward: null, error: trials.length ? `expected one trial in ${jobDir}, found ${trials.length}` : 'harbor wrote no trial result', seconds: none };
  const dir = path.join(jobDir, (trials[0] as fs.Dirent).name);
  const r = JSON.parse(fs.readFileSync(path.join(dir, 'result.json'), 'utf8')) as Record<string, any>;
  return { dir, reward: reward(r.verifier_result), error: r.exception_info ? `${r.exception_info.exception_type}: ${String(r.exception_info.exception_message).slice(0, 500)}` : null, seconds: timings(r) };
}

/** The trial's reward: `rewards.reward` in Harbor's verifier result, or its only reward. */
export function reward(verifierResult: any): number | null {
  const rewards = verifierResult?.rewards;
  if (!rewards || typeof rewards !== 'object') return null;
  if (typeof rewards.reward === 'number') return rewards.reward;
  const values = Object.values(rewards).filter((v): v is number => typeof v === 'number');
  return values.length === 1 ? (values[0] as number) : null;
}

function timings(r: Record<string, any>): Trial['seconds'] {
  const span = (p: { started_at?: string; finished_at?: string } | null | undefined): number =>
    p?.started_at && p.finished_at ? Math.round((Date.parse(p.finished_at) - Date.parse(p.started_at)) / 100) / 10 : 0;
  return { total: span(r), environment: span(r.environment_setup), agent_setup: span(r.agent_setup), agent: span(r.agent_execution), verifier: span(r.verifier) };
}
