// The pilot's runner: one call is one night. It takes on the rounds that fit the night's budget
// (schedule.ts), runs each unit's runs through Harbor with the noonsight agent, checks the account's
// quota between units, and records every run as soon as it ends, so a night cut short by a reboot,
// sleep or crash resumes the next night exactly where it stopped.
//
// Files under <work>/results:
//   runs.jsonl     one line per recorded run (it holds no path of the machine)
//   journal.jsonl  a start line before each run and an end line after it; a start with no end is a
//                  run that was interrupted, run again on resume and counted at its full budget
//   nights.jsonl   one summary line per night
//   decisions.jsonl the decision log of every run, for `noonsight report --log`
//   answers/       the answer of every open-task run
//   grades.jsonl   the judge's grade of each answer

import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { PACKAGE_ROOT } from '../../src/config/paths.js';
import { writeCondition } from './conditions.js';
import { digestRubric, grade, reviewRubric, sweAtlasRubric, type Grade, type Rubric } from './judge.js';
import { dockerUp } from './gold.js';
import { runTrial } from './harbor.js';
import { BENCH_DIR, type Plan, type Selection } from './plan.js';
import { aboveFloor, readQuota, type QuotaReading } from './quota.js';
import { cellKey, expectedCost, planNight, rounds, type Cell } from './schedule.js';
import { hitUsageLimit, parseStream, signals, usage, type Signals, type Usage } from './score.js';
import { ANSWER_FILE, materialize, OPEN_SETS, type Materialized, type SetName, type Sources } from './tasks.js';

export interface RunRecord extends Cell {
  readonly key: string;
  readonly model_id: string;
  readonly effort: string;
  readonly night: number;
  readonly started: string;
  readonly attempts: number;
  readonly pins: { readonly noonsight_commit: string; readonly claude_code: string; readonly harbor: string; readonly task_sha256: string; readonly condition_sha256: string };
  /** What noonsight's SessionStart hook decided, from the run's own decision log. */
  readonly noonsight: { readonly status: string | null; readonly reason: string | null; readonly place: string | null; readonly scope: string | null; readonly rules: readonly string[]; readonly sha256: string | null };
  readonly outcome: string;
  /** Claude Code's estimate at list price; null when the run reported none. */
  readonly cost_usd: number | null;
  /** What the cap counted: the reported cost, or the whole budget when none was reported. */
  readonly cost_counted_usd: number;
  readonly tokens: Usage['tokens'];
  readonly turns: number;
  readonly duration_ms: number;
  readonly wall_s: { readonly total: number; readonly environment: number; readonly agent_setup: number; readonly agent: number; readonly verifier: number };
  readonly models_used: readonly string[];
  /** Build and routine: the verifier's verdict. Open sets: null, graded later (grades.jsonl). */
  readonly resolved: boolean | null;
  readonly answer_written: boolean | null;
  readonly changed_files: readonly string[];
  /** Every instruction load the InstructionsLoaded hook recorded (claudemd and scattered only): file, memory type, reason, and the subagent it was for. */
  readonly instruction_loads?: readonly { readonly file_path: string | null; readonly memory_type: string | null; readonly load_reason: string | null; readonly agent_id: string | null }[];
  readonly signals: Signals;
  /** Set when the run never reached the model or its hook, after every retry: the task leaves the analysis. */
  readonly infra_failure: string | null;
}

/** A cell that never reached the model and the hook in three attempts: recorded so it is not run again, and dropped from the analysis. */
export interface InfraFailure extends Cell {
  readonly key: string;
  readonly model_id: string;
  readonly night: number;
  readonly started: string;
  readonly attempts: number;
  readonly infra_failure: string;
  readonly cost_counted_usd: 0;
  readonly cost_usd?: undefined;
}

export type Recorded = RunRecord | InfraFailure;

export interface RunnerOptions {
  readonly plan: Plan;
  readonly work: string;
  readonly harbor: string;
  readonly sources: Sources;
  readonly selection: Selection;
  /** Whether a routine task's prebuilt image runs here as it is, as the gold check decided. */
  readonly hasArm64: (image: string) => boolean;
  /** sha256 of each task as the gold check wrote it, by `set/id`. */
  readonly taskSha: ReadonlyMap<string, string>;
  readonly models: readonly string[];
  /** The Claude Code configuration directory of the account the runs use: its quota is checked, and the judge runs from its login. */
  readonly account: string;
  /** A long-lived OAuth token of that account (`claude setup-token`), for Claude Code inside the containers. */
  readonly token: string;
  readonly nightUsd: number;
  /** No unit starts after this time. */
  readonly until: Date | null;
  /** The quota floor for this night, when it is not the plan's (a deviation the pre-registration records). */
  readonly quotaFloor?: number;
  /** A lower floor the night falls back to when its floor would stop it (a deviation the pre-registration records). */
  readonly quotaFloorFallback?: number;
  /** Runs at a time for this night, when it is not the plan's. */
  readonly concurrency?: number;
  /** Run again the cells recorded as infrastructure failures (they stay recorded; a later run of the same key is the result). */
  readonly retryInfra?: boolean;
  /** Runs still going at this time are stopped and left interrupted: counted at their budget, and run again on the next night. */
  readonly stopBy: Date | null;
  readonly dryRun: boolean;
  readonly commit: string;
  readonly log: (line: string) => void;
}

const MAX_ATTEMPTS = 3;

export function resultsDir(work: string): string {
  return path.join(work, 'results');
}

export function readJsonl<T>(file: string): T[] {
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as T);
}

function append(file: string, value: unknown): void {
  // One write per line, flushed before the next run starts, so an interruption loses at most the run in flight.
  const fd = fs.openSync(file, 'a');
  fs.writeSync(fd, `${JSON.stringify(value)}\n`);
  fs.fsyncSync(fd);
  fs.closeSync(fd);
}

interface JournalLine {
  readonly event: 'start' | 'end' | 'retry';
  readonly key: string;
  readonly night: number;
  readonly at: string;
  readonly budget_usd?: number;
  readonly cost_usd?: number;
  readonly why?: string;
}

/** Runs that started and never ended or were closed: interrupted, so they run again and their budget counts as spent. */
export function interrupted(journal: readonly JournalLine[]): JournalLine[] {
  const open = new Map<string, JournalLine>();
  for (const j of journal) {
    const k = `${j.key}#${j.night}`;
    if (j.event === 'start') open.set(k, j);
    else open.delete(k);
  }
  return [...open.values()];
}

/** The cells that need no run: those with a result, and those recorded as infrastructure failures unless the night retries them. */
export function doneKeys(runs: readonly Recorded[], retryInfra: boolean): Set<string> {
  const results = new Set(runs.filter((r) => r.infra_failure === null).map((r) => r.key));
  return new Set(runs.filter((r) => results.has(r.key) || !retryInfra).map((r) => r.key));
}

/** The money counted against the cap so far: every recorded run, every grade, every retry, and every interrupted run at its budget. */
export function spent(runs: readonly Recorded[], journal: readonly JournalLine[], grades: readonly Pick<Grade, 'cost_usd'>[] = []): number {
  const runsCost = runs.reduce((s, r) => s + r.cost_counted_usd, 0) + grades.reduce((s, g) => s + g.cost_usd, 0);
  const retries = journal.filter((j) => j.event === 'retry').reduce((s, j) => s + (j.cost_usd ?? 0), 0);
  const lost = interrupted(journal).reduce((s, j) => s + (j.budget_usd ?? 0), 0);
  return runsCost + retries + lost;
}

/** Mean measured cost per model and set, for planning the next rounds. */
export function measured(runs: readonly Recorded[]): Map<string, { n: number; mean: number }> {
  const acc = new Map<string, { n: number; sum: number }>();
  for (const r of runs) {
    if (r.infra_failure !== null || typeof r.cost_usd !== 'number') continue;
    const k = `${r.model}/${r.set}`;
    const a = acc.get(k) ?? { n: 0, sum: 0 };
    acc.set(k, { n: a.n + 1, sum: a.sum + r.cost_usd });
  }
  return new Map([...acc].map(([k, v]) => [k, { n: v.n, mean: v.sum / v.n }]));
}

/** The package and the Node.js tarballs every run's bundle shares, built once per night. */
export function bundleBase(plan: Plan, work: string, log: (s: string) => void): { dir: string; package: string; node: Record<'arm64' | 'x64', { file: string; sha256: string }> } {
  const dir = path.join(work, 'bundle-base');
  fs.mkdirSync(dir, { recursive: true });
  const node = {} as Record<'arm64' | 'x64', { file: string; sha256: string }>;
  for (const arch of ['arm64', 'x64'] as const) {
    // gzip, not xz: some task images (Terminal-Bench's) have no xz to unpack it.
    const file = `node-v${plan.pins.node.version}-linux-${arch}.tar.gz`;
    const target = path.join(dir, file);
    const want = plan.pins.node.sha256[arch];
    if (!fs.existsSync(target) || sha256(target) !== want) {
      log(`downloading ${file}`);
      const r = spawnSync('curl', ['-fsSL', '-o', target, `https://nodejs.org/dist/v${plan.pins.node.version}/${file}`], { stdio: 'inherit' });
      if (r.status !== 0 || sha256(target) !== want) throw new Error(`${file} did not download or does not match its pinned sha256`);
    }
    node[arch] = { file, sha256: want };
  }
  // The package of this checkout, as built; `npm run benchmark` builds before it runs.
  for (const f of fs.readdirSync(dir)) if (f.endsWith('.tgz')) fs.rmSync(path.join(dir, f));
  const r = spawnSync('npm', ['pack', '--silent', '--pack-destination', dir], { cwd: PACKAGE_ROOT, encoding: 'utf8' });
  const pkg = r.stdout.trim().split('\n').at(-1) ?? '';
  if (r.status !== 0 || !pkg.endsWith('.tgz')) throw new Error(`npm pack failed: ${r.stderr}`);
  return { dir, package: pkg, node };
}

function sha256(file: string): string {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/** One run's bundle: the shared files linked in, the condition written, and the manifest the agent reads. */
export function writeBundle(plan: Plan, base: ReturnType<typeof bundleBase>, dir: string, modelId: string, condition: string): string {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (const f of [base.package, base.node.arm64.file, base.node.x64.file]) fs.linkSync(path.join(base.dir, f), path.join(dir, f));
  const conditionSha = writeCondition(plan, modelId, condition, path.join(dir, 'condition'));
  fs.writeFileSync(path.join(dir, 'bundle.json'), JSON.stringify({ package: base.package, node: base.node }));
  return conditionSha;
}

export interface CellRun {
  readonly record: RunRecord | null;
  /** Why the attempt could not be recorded, when it could not. */
  readonly failure: string | null;
  readonly cost_usd: number | null;
  /** The run stopped at the account's usage limit: not a result, not a failure of the harness. */
  readonly usage_limit?: boolean;
}

/** One attempt of one cell: a fresh Harbor trial, then its result line. */
export async function runCell(
  o: Pick<RunnerOptions, 'plan' | 'work' | 'harbor' | 'token' | 'commit'>,
  base: ReturnType<typeof bundleBase>,
  task: Materialized,
  cell: Cell,
  night: number,
  attempt: number,
  jobsDir: string,
  budgetUsd?: number,
  timeoutMs = 3 * 60 * 60 * 1000,
): Promise<CellRun> {
  const model = o.plan.models[cell.model];
  if (!model) throw new Error(`unknown model ${cell.model}`);
  const key = cellKey(cell);
  const bundle = path.join(o.work, 'bundles', key);
  const conditionSha = writeBundle(o.plan, base, bundle, model.id, cell.condition);
  const scope = o.plan.sets[cell.set].scope;
  const budget = budgetUsd ?? model.budget_usd;
  const started = new Date().toISOString();
  const trial = await runTrial({
    harbor: o.harbor,
    task: task.dir,
    jobsDir,
    jobName: `${key}.a${attempt}`,
    agentArgs: [
      '--agent', 'noonsight_agent:NoonsightClaudeCode',
      '-m', `anthropic/${model.id}`,
      '--ak', `version=${o.plan.pins.claude_code}`,
      '--ak', `reasoning_effort=${o.plan.effort}`,
      '--ak', `max_budget_usd=${budget}`,
      '--ak', 'disable_web_search=true',
      // Tasks that hold the agent to a network allowlist (SWE Atlas, ReviewBench) must still reach the API, as their own configs allow; Harbor ignores it where the network is open.
      '--allow-agent-host', 'api.anthropic.com',
      '--ak', `config=${path.join(bundle, 'condition', 'settings.json')}`,
      '--ae', `NOONSIGHT_SCOPE=${scope}`,
      '--ae', `${o.plan.unattended_env}=1`,
    ],
    env: {
      PYTHONPATH: path.join(BENCH_DIR, 'harbor'),
      NOONSIGHT_BENCH_BUNDLE: bundle,
      CLAUDE_CODE_OAUTH_TOKEN: o.token,
      CLAUDE_FORCE_OAUTH: '1',
    },
    timeoutMs,
  });
  const agentDir = trial.dir ? path.join(trial.dir, 'agent') : null;
  const read = (rel: string): string | null => {
    if (!agentDir) return null;
    const f = path.join(agentDir, rel);
    return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
  };
  const stream = parseStream(read('claude-code.txt') ?? '');
  const u = usage(stream);
  const decisions = (read(path.join('noonsight-home', '.local', 'state', 'noonsight', 'decisions.jsonl')) ?? '')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as Record<string, any>);
  const session = decisions.find((d) => d.event === 'session-start');
  // Without the hook's decision the run cannot say what it received, and without a result event it never reached the model.
  if (session && hitUsageLimit(stream)) return { record: null, failure: "the account's usage limit", cost_usd: u.cost_usd, usage_limit: true };
  if (!session || u.outcome === 'no-result') {
    const why = !session ? 'noonsight logged no session start' : 'Claude Code reported no result';
    return { record: null, failure: `${why}${trial.error ? `; ${trial.error}` : ''}`, cost_usd: u.cost_usd };
  }
  const results = resultsDir(o.work);
  // One decision per line, as `noonsight report --log` reads it.
  for (const d of decisions) append(path.join(results, 'decisions.jsonl'), { ...d, experiment_run: key });
  const open = OPEN_SETS.includes(cell.set);
  const answerPath = ANSWER_FILE[cell.set];
  const answer = open && trial.dir && answerPath ? readAnswer(trial.dir, answerPath) : null;
  if (answer !== null && answerPath) {
    fs.mkdirSync(path.join(results, 'answers'), { recursive: true });
    fs.writeFileSync(path.join(results, 'answers', `${key}${path.extname(answerPath)}`), answer);
  }
  const record: RunRecord = {
    ...cell,
    key,
    model_id: model.id,
    effort: o.plan.effort,
    night,
    started,
    attempts: attempt,
    pins: { noonsight_commit: o.commit, claude_code: o.plan.pins.claude_code, harbor: o.plan.pins.harbor, task_sha256: task.sha256, condition_sha256: conditionSha },
    noonsight: {
      status: session.status ?? null,
      reason: session.reason ?? null,
      place: session.place ?? null,
      scope: session.scope ?? null,
      rules: session.rules ?? [],
      sha256: session.sha256 ?? null,
    },
    outcome: u.outcome,
    cost_usd: u.cost_usd,
    cost_counted_usd: u.cost_usd ?? budget,
    tokens: u.tokens,
    turns: u.turns,
    duration_ms: u.duration_ms,
    wall_s: trial.seconds,
    models_used: u.models_used,
    resolved: open ? null : trial.reward === 1,
    answer_written: open ? answer !== null && answer.trim() !== '' : null,
    changed_files: (read('changed-files.txt') ?? '').split('\n').filter(Boolean),
    ...(o.plan.conditions[cell.condition]?.claude_md ? { instruction_loads: instructionLoads(agentDir) } : {}),
    signals: signals(stream, open ? (answer ?? '') : u.final),
    infra_failure: null,
  };
  return { record, failure: null, cost_usd: u.cost_usd };
}

/** The instruction loads the InstructionsLoaded hook wrote under the agent's logs, in the order they happened. */
export function instructionLoads(agentDir: string | null): NonNullable<RunRecord['instruction_loads']> {
  const dir = agentDir ? path.join(agentDir, 'instructions') : null;
  if (!dir || !fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .flatMap((f) => {
      try {
        const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as Record<string, unknown>;
        const str = (k: string): string | null => (typeof d[k] === 'string' ? (d[k] as string) : null);
        return [{ file_path: str('file_path'), memory_type: str('memory_type'), load_reason: str('load_reason'), agent_id: str('agent_id') }];
      } catch {
        return [];
      }
    });
}

/** An open task's answer: under /logs/agent it comes back with the agent's logs; elsewhere Harbor downloads it as an artifact. */
function readAnswer(trialDir: string, answerPath: string): string | null {
  const candidates = answerPath.startsWith('/logs/agent/')
    ? [path.join(trialDir, 'agent', answerPath.slice('/logs/agent/'.length))]
    : [path.join(trialDir, 'artifacts', answerPath.replace(/^\//, '')), path.join(trialDir, 'artifacts', path.basename(answerPath))];
  for (const c of candidates) if (fs.existsSync(c)) return fs.readFileSync(c, 'utf8');
  return null;
}

/** The rubric of an open task, or why it has none yet. */
export function rubricFor(work: string, set: SetName, id: string): Rubric | string {
  const taskDir = path.join(work, 'tasks', set, id);
  const instruction = fs.existsSync(path.join(taskDir, 'instruction.md')) ? fs.readFileSync(path.join(taskDir, 'instruction.md'), 'utf8') : '';
  const grading = path.join(work, 'grading', set, id);
  if (set === 'investigate') return sweAtlasRubric(grading, instruction);
  if (set === 'review') return reviewRubric(grading, instruction);
  if (set === 'digest') {
    const file = path.join(BENCH_DIR, 'rubrics', 'digest', `${id}.json`);
    try {
      return digestRubric(file, instruction);
    } catch (e) {
      return (e as Error).message;
    }
  }
  return `${set} is not an open set`;
}

/** Grade every recorded open-task answer that has a rubric and no grade yet; returns what the grades cost. */
export function gradePending(o: Pick<RunnerOptions, 'plan' | 'work' | 'account' | 'log'>, only?: string): number {
  const results = resultsDir(o.work);
  const gradesFile = path.join(results, 'grades.jsonl');
  const graded = new Set(readJsonl<Grade>(gradesFile).filter((g) => g.error === null).map((g) => g.key));
  let cost = 0;
  for (const r of readJsonl<Recorded>(path.join(results, 'runs.jsonl'))) {
    if (r.infra_failure !== null || !OPEN_SETS.includes(r.set) || graded.has(r.key) || (only !== undefined && r.key !== only)) continue;
    const ext = path.extname(ANSWER_FILE[r.set] ?? '');
    const answerFile = path.join(results, 'answers', `${r.key}${ext}`);
    const answer = fs.existsSync(answerFile) ? fs.readFileSync(answerFile, 'utf8') : '';
    const rubric = rubricFor(o.work, r.set, r.task);
    if (typeof rubric === 'string') {
      o.log(`not graded ${r.key}: ${rubric}`);
      continue;
    }
    // An answer never written scores zero without asking the judge.
    const g: Grade = answer.trim() === '' ? { key: r.key, set: r.set, score: 0, items: [], votes: 0, cost_usd: 0, error: null } : grade(o.plan, o.account, r.key, r.set, rubric, answer);
    append(gradesFile, g);
    cost += g.cost_usd;
    o.log(`graded ${r.key}: score ${g.score ?? '?'}, $${g.cost_usd.toFixed(3)}${g.error ? `, ${g.error}` : ''}`);
  }
  return cost;
}

/** Hold off system sleep for as long as this process lives (macOS); elsewhere nothing to do. */
function keepAwake(log: (s: string) => void): ChildProcess | null {
  if (process.platform !== 'darwin') return null;
  const child = spawn('caffeinate', ['-ims', '-w', String(process.pid)], { stdio: 'ignore' });
  child.on('error', (e) => log(`caffeinate could not start: ${e.message}`));
  return child;
}

export interface NightSummary {
  readonly night: number;
  readonly started: string;
  readonly ended: string;
  readonly planned_runs: number;
  readonly completed_runs: number;
  readonly interrupted_runs: number;
  readonly failed_attempts: number;
  readonly infra_failures: number;
  readonly spend_usd: number;
  readonly total_spend_usd: number;
  readonly quota_before: number | null;
  readonly quota_after: number | null;
  /** The quota floor in force that night, and the lowest weekly quota read before a batch. */
  readonly quota_floor?: number;
  readonly quota_min?: number | null;
  readonly stop: string;
}

/** One night of the pilot. */
export async function runNight(o: RunnerOptions): Promise<NightSummary | null> {
  const results = resultsDir(o.work);
  fs.mkdirSync(results, { recursive: true });
  const runsFile = path.join(results, 'runs.jsonl');
  const journalFile = path.join(results, 'journal.jsonl');
  const nightsFile = path.join(results, 'nights.jsonl');
  const runs = readJsonl<Recorded>(runsFile);
  const journal = readJsonl<JournalLine>(journalFile);
  const done = doneKeys(runs, o.retryInfra === true);
  const night = readJsonl<NightSummary>(nightsFile).length + 1;
  const wasInterrupted = interrupted(journal);
  const all = rounds(o.plan, o.selection, o.models);
  const totalBefore = spent(runs, journal, readJsonl<Grade>(path.join(results, 'grades.jsonl')));
  const capLeft = o.plan.cap_usd - totalBefore;
  let means = measured(runs);
  const cost = (c: Cell): number => expectedCost(o.plan, c, means, OPEN_SETS);
  let plan = planNight(all, done, cost, o.nightUsd, capLeft);
  const plannedCells = plan.rounds.flatMap((r) => r.units.flatMap((u) => u.cells)).filter((c) => !done.has(cellKey(c)));
  const quotaBefore = readQuota(o.account);
  o.log(`night ${night}: ${plannedCells.length} runs in ${plan.rounds.length} round(s), projected $${plan.projected_usd.toFixed(2)}; $${totalBefore.toFixed(2)} of $${o.plan.cap_usd} spent; quota ${quotaBefore.all_models ?? '?'}% left; ${plan.stop}`);
  for (const r of plan.rounds) o.log(`  ${r.phase}, round ${r.rep}: ${r.units.length} units`);
  if (wasInterrupted.length) {
    // An interrupted run is closed at its full budget; it runs again only if its cell is still in the plan (a set dropped since is not).
    const planned = new Set(all.flatMap((r) => r.units.flatMap((u) => u.cells.map(cellKey))));
    const again = wasInterrupted.filter((j) => planned.has(j.key)).map((j) => j.key);
    const dropped = wasInterrupted.filter((j) => !planned.has(j.key)).map((j) => j.key);
    if (again.length) o.log(`  ${again.length} run(s) interrupted earlier will run again: ${again.join(', ')}`);
    if (dropped.length) o.log(`  ${dropped.length} run(s) interrupted earlier are closed and not run again, their task being out of the pilot: ${dropped.join(', ')}`);
  }
  if (o.dryRun || plannedCells.length === 0) return null;

  const awake = keepAwake(o.log);
  // Grades the judge could not give earlier (an error, or a rubric that came later) are tried again first.
  const regraded = gradePending(o);
  const startedAt = new Date().toISOString();
  const base = bundleBase(o.plan, o.work, o.log);
  const tasks = new Map<string, Materialized>();
  const taskFor = (c: Cell): Materialized => {
    const k = `${c.set}/${c.task}`;
    let m = tasks.get(k);
    if (!m) {
      m = materialize(c.set, c.task, o.sources, o.work, o.hasArm64);
      // A task must be the one the gold check ran; a changed source would change the task under test.
      const want = o.taskSha.get(k);
      if (want !== undefined && want !== m.sha256) throw new Error(`${k} differs from the task the gold check ran (sha256 ${m.sha256}, gold ${want})`);
      tasks.set(k, m);
    }
    return m;
  };

  let total = totalBefore + regraded;
  let tonight = regraded;
  let completed = 0;
  let failedAttempts = 0;
  let infra = 0;
  let stop = plan.stop;
  const jobsDir = path.join(o.work, 'jobs', `night-${night}`);
  // Close the interrupted runs in the journal at their full budget: counted once, and run again below.
  for (const j of wasInterrupted) append(journalFile, { event: 'retry', key: j.key, night: j.night, at: new Date().toISOString(), cost_usd: j.budget_usd ?? 0, why: 'interrupted' } satisfies JournalLine);

  let planned = plannedCells.length;
  const runOne = async (cell: Cell): Promise<void> => {
    const key = cellKey(cell);
    const budget = o.plan.models[cell.model]?.budget_usd ?? 0;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      append(journalFile, { event: 'start', key, night, at: new Date().toISOString(), budget_usd: budget } satisfies JournalLine);
      o.log(`start ${key}${attempt > 1 ? ` (attempt ${attempt})` : ''}`);
      const left = o.stopBy ? o.stopBy.getTime() - Date.now() : 3 * 60 * 60 * 1000;
      const res = await runCell(o, base, taskFor(cell), cell, night, attempt, jobsDir, undefined, Math.max(60_000, Math.min(3 * 60 * 60 * 1000, left)));
      if (o.stopBy && Date.now() >= o.stopBy.getTime() - 5_000 && !res.record) {
        // Stopped by the morning deadline: the open start line makes it an interrupted run for the next night.
        stop = `the night's stop time (${o.stopBy.toISOString()}) ended runs in flight`;
        o.log(`stopped ${key} at the night's stop time; it runs again next night`);
        return;
      }
      if (res.usage_limit) {
        // The account ran out: the run is set aside for a later night, and no further run starts tonight.
        append(journalFile, { event: 'retry', key, night, at: new Date().toISOString(), cost_usd: res.cost_usd ?? 0, why: 'usage limit' } satisfies JournalLine);
        total += res.cost_usd ?? 0;
        tonight += res.cost_usd ?? 0;
        usageLimit = true;
        stop = "the account's weekly quota is used up";
        o.log(`limit ${key}: the account reached its usage limit; it runs again on a later night`);
        return;
      }
      if (res.record) {
        append(runsFile, res.record);
        append(journalFile, { event: 'end', key, night, at: new Date().toISOString(), cost_usd: res.record.cost_counted_usd } satisfies JournalLine);
        total += res.record.cost_counted_usd;
        tonight += res.record.cost_counted_usd;
        completed++;
        done.add(key);
        o.log(`done  ${key}: ${res.record.outcome}, $${(res.record.cost_usd ?? 0).toFixed(3)}, resolved=${res.record.resolved}, rules=${res.record.noonsight.rules.join('+') || res.record.noonsight.status}; tonight $${tonight.toFixed(2)}, total $${total.toFixed(2)}`);
        if (OPEN_SETS.includes(cell.set)) {
          const g = gradePending(o, key);
          total += g;
          tonight += g;
        }
        return;
      }
      const lost = res.cost_usd ?? 0;
      append(journalFile, { event: 'retry', key, night, at: new Date().toISOString(), cost_usd: lost, why: res.failure ?? 'unknown' } satisfies JournalLine);
      total += lost;
      tonight += lost;
      failedAttempts++;
      o.log(`fail  ${key}: ${res.failure}`);
    }
    // Three attempts never reached the model or the hook: an infrastructure failure, recorded so it is not run again.
    infra++;
    const failed: InfraFailure = { ...cell, key, model_id: o.plan.models[cell.model]?.id ?? cell.model, night, started: new Date().toISOString(), attempts: MAX_ATTEMPTS, infra_failure: 'no run reached the model and the hook in three attempts', cost_counted_usd: 0 };
    append(runsFile, failed);
    done.add(key);
  };
  const pool = Math.max(1, o.concurrency ?? o.plan.concurrency);
  // Whole units are gathered into a batch until it holds `pool` runs, and the batch runs together, so a
  // placebo unit (one run) does not leave the second slot idle; every stop falls between batches, so
  // between units, and the quota is read before each batch.
  let batch: Cell[] = [];
  let quota: QuotaReading | null = null;
  let usageLimit = false;
  let quotaFloor = o.quotaFloor ?? o.plan.quota_floor_percent;
  let quotaMin: number | null = quotaBefore.all_models;
  const flush = async (): Promise<void> => {
    const cells = batch;
    batch = [];
    quota = null;
    for (let i = 0; i < cells.length; i += pool) await Promise.all(cells.slice(i, i + pool).map(runOne));
  };
  outer: for (;;) {
    let startedThisPass = 0;
    for (const r of plan.rounds)
      for (const unit of r.units) {
        const cells = unit.cells.filter((c) => !done.has(cellKey(c)));
        if (cells.length === 0) continue;
        // A digest runs only once its rubric is committed, so the key points are written before anyone sees a summary.
        const first = cells[0] as Cell;
        if (first.set === 'digest') {
          const rubric = rubricFor(o.work, first.set, first.task);
          if (typeof rubric === 'string') {
            o.log(`skip  ${unit.key}: ${rubric}`);
            continue;
          }
        }
        if (usageLimit) break outer;
        if (batch.length === 0) {
          if (o.until && Date.now() >= o.until.getTime()) {
            stop = `the night's end time (${o.until.toISOString()}) was reached`;
            break outer;
          }
          if (!dockerUp()) {
            stop = 'Docker is not reachable';
            break outer;
          }
          quota = readQuota(o.account);
          if (quota.all_models !== null) quotaMin = Math.min(quotaMin ?? quota.all_models, quota.all_models);
        }
        const budgetOf = (cs: readonly Cell[]): number => cs.reduce((s, c) => s + (o.plan.models[c.model]?.budget_usd ?? 0) + (OPEN_SETS.includes(c.set) ? o.plan.judge.budget_usd : 0), 0);
        if (total + budgetOf([...batch, ...cells]) > o.plan.cap_usd) {
          await flush();
          stop = `the next unit could pass the $${o.plan.cap_usd} cap`;
          break outer;
        }
        let floor = aboveFloor(quota ?? readQuota(o.account), quotaFloor, first.model);
        if (!floor.ok && o.quotaFloorFallback !== undefined && o.quotaFloorFallback < quotaFloor) {
          o.log(`quota floor: ${floor.why}; the night goes on with the ${o.quotaFloorFallback}% floor the author allowed`);
          quotaFloor = o.quotaFloorFallback;
          floor = aboveFloor(quota ?? readQuota(o.account), quotaFloor, first.model);
        }
        if (!floor.ok) {
          await flush();
          stop = `quota floor: ${floor.why}`;
          break outer;
        }
        batch.push(...cells);
        startedThisPass++;
        if (batch.length >= pool) await flush();
      }
    await flush();
    // Units held back (a digest without its rubric) leave their round open; with nothing else to start, the night ends.
    if (startedThisPass === 0) {
      stop = 'the units left wait for something outside the night (a digest rubric)';
      break;
    }
    // The planned rounds are done: plan again with the costs measured so far and what is left of the night's budget.
    means = measured(readJsonl<Recorded>(runsFile));
    plan = planNight(all, done, cost, o.nightUsd - tonight, o.plan.cap_usd - total, false);
    stop = plan.stop;
    if (plan.rounds.length === 0) break;
    const more = plan.rounds.flatMap((r) => r.units.flatMap((u) => u.cells)).filter((c) => !done.has(cellKey(c))).length;
    planned += more;
    o.log(`planning again: ${more} more runs in ${plan.rounds.map((r) => `${r.phase} round ${r.rep}`).join(', ')}, projected $${plan.projected_usd.toFixed(2)}, $${(o.nightUsd - tonight).toFixed(2)} of the night's budget left`);
  }

  const quotaAfter = readQuota(o.account);
  const summary: NightSummary = {
    night,
    started: startedAt,
    ended: new Date().toISOString(),
    planned_runs: planned,
    completed_runs: completed,
    interrupted_runs: wasInterrupted.length,
    failed_attempts: failedAttempts,
    infra_failures: infra,
    spend_usd: round(tonight),
    total_spend_usd: round(total),
    quota_before: quotaBefore.all_models,
    quota_after: quotaAfter.all_models,
    quota_floor: quotaFloor,
    quota_min: quotaMin,
    stop,
  };
  append(nightsFile, summary);
  o.log(summaryLine(summary));
  awake?.kill();
  return summary;
}

export function summaryLine(s: NightSummary): string {
  return `night ${s.night}: planned ${s.planned_runs}, completed ${s.completed_runs}, interrupted earlier ${s.interrupted_runs}, failed attempts ${s.failed_attempts}, infra failures ${s.infra_failures}; spend $${s.spend_usd.toFixed(2)} (total $${s.total_spend_usd.toFixed(2)}); quota ${s.quota_before ?? '?'}% -> ${s.quota_after ?? '?'}%${s.quota_floor !== undefined ? ` (floor ${s.quota_floor}%, lowest ${s.quota_min ?? '?'}%)` : ''}; stopped: ${s.stop}`;
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export type { QuotaReading, SetName };
