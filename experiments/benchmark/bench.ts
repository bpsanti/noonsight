// The pilot of the noonsight benchmark study: SWE-bench Verified, Terminal-Bench 2.1, SWE Atlas,
// ReviewBench and digest tasks, run through Harbor with noonsight inside each task's container.
// README.md says how to reproduce it; preregistration.md is the plan the results are read against.
//
//   npm run benchmark -- fetch  --work <dir> [--python python3.12] [--arm64]
//   npm run benchmark -- gold   --work <dir> [--sets build,routine,...]
//   npm run benchmark -- run    --work <dir> --account <claude config dir> --token-file <file> [--night-usd 45] [--until 07:30] [--stop-by 07:45] [--quota-floor 50] [--quota-floor-fallback 35] [--concurrency 1] [--retry-infra] [--dry-run]
//   npm run benchmark -- smoke  --work <dir> --account <dir> --token-file <file> --set build --task <id> --model fable --condition off --budget 0.9
//   npm run benchmark -- grade  --work <dir> --account <dir>
//   npm run benchmark -- rescore --work <dir>     (the signals again, from the saved streams, into results/signals.jsonl)
//   npm run benchmark -- calibration --work <dir> [--n 15]
//   npm run benchmark -- status --work <dir> [--account <dir>]
//   npm run benchmark -- project --work <dir> [--night-usd 45] [--night-hours 6.5] [--concurrency 2]
//   npm run benchmark -- summarize --results <dir> [--out <file>]   (the reading's tables, from a folder of result files)
//
// `fetch` and `gold` call no model. `run` and `grade` do, from the login of the account given.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportCalibration } from './calibration.js';
import { goldCheck, readGold } from './gold.js';
import { BENCH_DIR, loadPlan, selection, type Plan, type Selection } from './plan.js';
import { arm64Instances, fetchSwebenchRows, hubImageHasArm64, readSwebenchRows, readTerminalBench, tomlValue } from './sources.js';
import { readQuota } from './quota.js';
import { bundleBase, gradePending, measured, readJsonl, resultsDir, runCell, runNight, summaryLine, type NightSummary, type Recorded } from './run.js';
import { cellKey, expectedCost, planNight, rounds, type Cell } from './schedule.js';
import { readResults, summaryMarkdown } from './summary.js';
import { parseStream, signals } from './score.js';
import { ANSWER_FILE, materialize, OPEN_SETS, SETS, type SetName, type Sources } from './tasks.js';

export const ARM64_FILE = path.join(BENCH_DIR, 'tasks', 'swebench-arm64.json');
export const GOLD_FILE = path.join(BENCH_DIR, 'tasks', 'gold.json');
export const PILOT_FILE = path.join(BENCH_DIR, 'tasks', 'pilot.json');

const log = (s: string): void => void process.stdout.write(`${new Date().toISOString().slice(11, 19)} ${s}\n`);

/** The layout of a work directory: downloaded sources, written tasks, Harbor jobs and results. */
export function workPaths(work: string) {
  const sources = path.join(work, 'sources');
  return {
    sources,
    rows: path.join(sources, 'swebench-rows'),
    datasets: path.join(sources, 'datasets'),
    sweAtlas: path.join(sources, 'swe-atlas'),
    venv: path.join(work, 'venv'),
    harbor: path.join(work, 'venv', 'bin', 'harbor'),
  };
}

function run(cmd: string, args: readonly string[], cwd?: string): void {
  const r = spawnSync(cmd, [...args], { stdio: 'inherit', ...(cwd ? { cwd } : {}) });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed with status ${r.status}`);
}

/** Download what the pilot reads: Harbor, the datasets, the SWE-bench rows and, with `arm64`, the list of arm64 images. */
async function fetchAll(plan: Plan, work: string, python: string, refreshArm64: boolean): Promise<void> {
  const p = workPaths(work);
  fs.mkdirSync(p.datasets, { recursive: true });
  if (!fs.existsSync(p.harbor)) {
    run(python, ['-m', 'venv', p.venv]);
    run(path.join(p.venv, 'bin', 'pip'), ['install', '-q', `harbor==${plan.pins.harbor}`]);
  }
  for (const set of ['build', 'routine', 'review'] as const) run(p.harbor, ['download', plan.pins.datasets[set] as string, '-o', p.datasets]);
  const [repo, commit] = (plan.pins.datasets.investigate as string).split('@') as [string, string];
  if (!fs.existsSync(path.join(p.sweAtlas, '.git'))) {
    run('git', ['clone', '--quiet', '--filter=blob:none', '--no-checkout', `https://github.com/${repo}.git`, p.sweAtlas]);
    run('git', ['-C', p.sweAtlas, 'sparse-checkout', 'set', ...plan.sets.investigate.ranked.map((id) => `data/qa/${id}`)]);
  }
  run('git', ['-C', p.sweAtlas, 'checkout', '--quiet', commit]);
  await fetchSwebenchRows(p.rows);
  if (refreshArm64 || !fs.existsSync(ARM64_FILE)) {
    const ids = readSwebenchRows(p.rows).map((r) => r.instance_id);
    const arm64 = await arm64Instances(ids);
    fs.writeFileSync(ARM64_FILE, `${JSON.stringify({ checked: new Date().toISOString().slice(0, 10), source: 'hub.docker.com/v2/repositories/swebench/sweb.eval.arm64.<id>/tags/latest', count: arm64.length, instances: arm64 }, null, 1)}\n`);
    log(`${arm64.length} of ${ids.length} instances have an arm64 image`);
  }
}

interface Loaded {
  readonly plan: Plan;
  readonly sources: Sources;
  readonly swebench: ReturnType<typeof readSwebenchRows>;
  readonly arm64: Set<string>;
  readonly terminalBench: ReturnType<typeof readTerminalBench>;
}

export function load(work: string): Loaded {
  const plan = loadPlan();
  const p = workPaths(work);
  const swebench = readSwebenchRows(p.rows);
  const arm64 = new Set((JSON.parse(fs.readFileSync(ARM64_FILE, 'utf8')) as { instances: string[] }).instances);
  const terminalBench = readTerminalBench(path.join(p.datasets, 'terminal-bench-2-1'));
  const threads = new Map(swebench.map((r) => [r.instance_id, { problem_statement: r.problem_statement, hints_text: r.hints_text }]));
  const sources: Sources = {
    swebench: path.join(p.datasets, 'swebench-verified'),
    terminalBench: path.join(p.datasets, 'terminal-bench-2-1'),
    reviewBench: path.join(p.datasets, 'reviewbench-public'),
    sweAtlas: p.sweAtlas,
    threads,
  };
  return { plan, sources, swebench, arm64, terminalBench };
}

/** The current pilot set: the selection after the gold check's exclusions, as committed in tasks/pilot.json. */
export function currentSelection(l: Loaded): Selection {
  const gold = readGold(GOLD_FILE);
  const latest = new Map(gold.entries.map((e) => [`${e.set}/${e.id}`, e]));
  const excluded: Partial<Record<SetName, Set<string>>> = {};
  for (const e of latest.values()) if (!e.passed) (excluded[e.set] ??= new Set()).add(e.id);
  const sel = selection(l.plan, l.swebench, l.arm64, l.terminalBench, excluded);
  // A set that could not be checked here takes no part in the pilot.
  return Object.fromEntries(SETS.map((s) => [s, gold.skipped[s] ? [] : sel[s]])) as Selection;
}

function writePilot(sel: Selection): void {
  const gold = readGold(GOLD_FILE);
  const sha = new Map(gold.entries.map((e) => [`${e.set}/${e.id}`, e.sha256]));
  const sets = Object.fromEntries(SETS.map((s) => [s, sel[s].map((id) => ({ id, sha256: sha.get(`${s}/${id}`) ?? null }))]));
  fs.writeFileSync(PILOT_FILE, `${JSON.stringify({ seed: loadPlan().seed, sets, not_run_here: gold.skipped }, null, 2)}\n`);
}

/** Which prebuilt Terminal-Bench images can run here as they are. */
async function prebuiltArm64(l: Loaded): Promise<(image: string) => boolean> {
  const images = l.terminalBench.map((t) => tomlValue(fs.readFileSync(path.join(l.sources.terminalBench, t.id, 'task.toml'), 'utf8'), 'docker_image', 'environment')).filter((i): i is string => i !== null);
  const ok = new Set<string>();
  for (const image of images) if (await hubImageHasArm64(image)) ok.add(image);
  return (image) => ok.has(image);
}

function required(opts: Map<string, string>, name: string): string {
  const v = opts.get(name);
  if (v === undefined || v === 'true') throw new Error(`--${name} is required`);
  return v;
}

/** The OAuth token of the account, from a file only its owner can read, or from CLAUDE_CODE_OAUTH_TOKEN. */
function readToken(opts: Map<string, string>): string {
  const file = opts.get('token-file');
  if (file) {
    const mode = fs.statSync(file).mode & 0o077;
    if (mode !== 0) throw new Error(`${file} can be read by others; chmod 600 it`);
    return fs.readFileSync(file, 'utf8').trim();
  }
  const env = (process.env.CLAUDE_CODE_OAUTH_TOKEN ?? '').trim();
  if (!env) throw new Error('give --token-file <file> with a token from `claude setup-token`, or set CLAUDE_CODE_OAUTH_TOKEN');
  return env;
}

/** The commit every result line records. A pilot night runs only from a clean checkout, so the commit is the code that ran. */
function headCommit(allowDirty: boolean): string {
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: BENCH_DIR, encoding: 'utf8' }).stdout.trim();
  const dirty = spawnSync('git', ['status', '--porcelain'], { cwd: BENCH_DIR, encoding: 'utf8' }).stdout.trim() !== '';
  if (dirty && !allowDirty) throw new Error('the checkout has uncommitted changes; commit them so the results name the code that ran');
  return dirty ? `${head}+dirty` : head;
}

/** The next time of day HH:MM, today or tomorrow. */
function nextTime(hhmm: string): Date {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) throw new Error(`--until takes HH:MM, got ${hhmm}`);
  const d = new Date();
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d;
}

function options(argv: readonly string[]): { command: string | undefined; opts: Map<string, string> } {
  const [command, ...rest] = argv;
  const opts = new Map<string, string>();
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i] as string;
    if (!a.startsWith('--')) throw new Error(`unexpected argument ${a}`);
    const next = rest[i + 1];
    if (next === undefined || next.startsWith('--')) opts.set(a.slice(2), 'true');
    else opts.set(a.slice(2), rest[++i] as string);
  }
  return { command, opts };
}

export async function main(argv: readonly string[]): Promise<number> {
  const { command, opts } = options(argv);
  if (command === 'summarize') {
    const plan = loadPlan();
    const text = summaryMarkdown(readResults(path.resolve(required(opts, 'results'))), Object.keys(plan.models), Object.values(plan.models).map((m) => m.id));
    if (opts.has('out')) fs.writeFileSync(path.resolve(required(opts, 'out')), text);
    else process.stdout.write(text);
    return 0;
  }
  const work = path.resolve(opts.get('work') ?? path.join(os.tmpdir(), 'noonsight-benchmark'));
  fs.mkdirSync(work, { recursive: true });
  if (command === 'fetch') {
    // Harbor needs Python 3.12 or later.
    await fetchAll(loadPlan(), work, opts.get('python') ?? 'python3', opts.has('arm64'));
    return 0;
  }
  if (command === 'gold') {
    const l = load(work);
    const sets = (opts.get('sets') ?? SETS.join(',')).split(',') as SetName[];
    const { selection: sel } = await goldCheck({
      plan: l.plan,
      harbor: workPaths(work).harbor,
      work,
      record: GOLD_FILE,
      sources: l.sources,
      swebench: l.swebench,
      arm64: l.arm64,
      terminalBench: l.terminalBench,
      hasArm64: await prebuiltArm64(l),
      machine: `${os.platform()} ${os.arch()}, ${os.cpus().length} CPUs, ${Math.round(os.totalmem() / 2 ** 30)} GB`,
      sets,
      log,
    });
    writePilot(currentSelection(l));
    for (const s of SETS) log(`${s}: ${sel[s].join(', ') || '(none)'}`);
    return 0;
  }
  if (command === 'run' || command === 'smoke') {
    const l = load(work);
    const account = required(opts, 'account');
    const dryRun = opts.has('dry-run');
    const token = dryRun ? '' : readToken(opts);
    const commit = headCommit(command === 'smoke' || dryRun);
    const sel = currentSelection(l);
    // A night runs exactly the committed task list; a smoke runs one cell outside it.
    const pilot = command === 'run' ? (JSON.parse(fs.readFileSync(PILOT_FILE, 'utf8')) as { sets: Record<SetName, { id: string; sha256: string | null }[]> }) : { sets: {} as Record<SetName, { id: string; sha256: string | null }[]> };
    const taskSha = new Map(SETS.flatMap((s) => (pilot.sets[s] ?? []).filter((t) => t.sha256 !== null).map((t) => [`${s}/${t.id}`, t.sha256 as string] as const)));
    if (command === 'run')
      for (const s of SETS)
        if (JSON.stringify(sel[s]) !== JSON.stringify((pilot.sets[s] ?? []).map((t) => t.id))) throw new Error(`tasks/pilot.json is not the current selection for ${s}; run gold first`);
    const hasArm64 = await prebuiltArm64(l);
    if (command === 'smoke') {
      const set = required(opts, 'set') as SetName;
      const cell = { set, task: required(opts, 'task'), model: required(opts, 'model'), condition: required(opts, 'condition'), rep: 1 };
      const smokeWork = path.join(work, 'smoke');
      fs.mkdirSync(resultsDir(smokeWork), { recursive: true });
      const task = materialize(set, cell.task, l.sources, work, hasArm64);
      const base = bundleBase(l.plan, work, log);
      log(`smoke ${cellKey(cell)} with a $${required(opts, 'budget')} budget`);
      const res = await runCell({ plan: l.plan, work: smokeWork, harbor: workPaths(work).harbor, token, commit }, base, task, cell, 0, 1, path.join(smokeWork, 'jobs'), Number(required(opts, 'budget')));
      if (res.record) fs.appendFileSync(path.join(resultsDir(smokeWork), 'runs.jsonl'), `${JSON.stringify(res.record)}\n`);
      process.stdout.write(`${JSON.stringify(res.record ?? { failure: res.failure, cost_usd: res.cost_usd }, null, 2)}\n`);
      return res.record ? 0 : 1;
    }
    const until = opts.has('until') ? nextTime(required(opts, 'until')) : null;
    const stopBy = opts.has('stop-by') ? nextTime(required(opts, 'stop-by')) : null;
    await runNight({
      plan: l.plan,
      work,
      harbor: workPaths(work).harbor,
      sources: l.sources,
      selection: sel,
      hasArm64,
      taskSha,
      models: (opts.get('models') ?? Object.keys(l.plan.models).join(',')).split(','),
      account,
      token,
      nightUsd: Number(opts.get('night-usd') ?? l.plan.night_usd),
      until,
      stopBy,
      ...(opts.has('quota-floor') ? { quotaFloor: Number(required(opts, 'quota-floor')) } : {}),
      ...(opts.has('quota-floor-fallback') ? { quotaFloorFallback: Number(required(opts, 'quota-floor-fallback')) } : {}),
      ...(opts.has('concurrency') ? { concurrency: Number(required(opts, 'concurrency')) } : {}),
      ...(opts.has('retry-infra') ? { retryInfra: true } : {}),
      dryRun,
      commit,
      log,
    });
    return 0;
  }
  if (command === 'rescore') {
    // The signals of every recorded run, computed again from its saved event stream by this checkout's scorer.
    const results = resultsDir(work);
    const out: string[] = [];
    for (const r of readJsonl<Recorded>(path.join(results, 'runs.jsonl'))) {
      if (r.infra_failure !== null) continue;
      const job = path.join(work, 'jobs', `night-${r.night}`, `${r.key}.a${r.attempts}`);
      const trial = fs.existsSync(job) ? fs.readdirSync(job, { withFileTypes: true }).find((d) => d.isDirectory()) : undefined;
      const stream = trial ? path.join(job, trial.name, 'agent', 'claude-code.txt') : '';
      if (!stream || !fs.existsSync(stream)) {
        log(`no saved stream for ${r.key}`);
        continue;
      }
      const events = parseStream(fs.readFileSync(stream, 'utf8'));
      const answerFile = path.join(results, 'answers', `${r.key}${path.extname(ANSWER_FILE[r.set] ?? '')}`);
      const answer = OPEN_SETS.includes(r.set) ? (fs.existsSync(answerFile) ? fs.readFileSync(answerFile, 'utf8') : '') : null;
      out.push(JSON.stringify({ key: r.key, scorer: headCommit(true), signals: signals(events, answer ?? String(events.filter((e) => e.type === 'result').at(-1)?.result ?? '')) }));
    }
    fs.writeFileSync(path.join(results, 'signals.jsonl'), out.length ? `${out.join('\n')}\n` : '');
    log(`${out.length} runs scored again into ${path.join(results, 'signals.jsonl')}`);
    return 0;
  }
  if (command === 'grade') {
    gradePending({ plan: loadPlan(), work, account: required(opts, 'account'), log });
    return 0;
  }
  if (command === 'calibration') {
    exportCalibration(work, Number(opts.get('n') ?? 15), log);
    return 0;
  }
  if (command === 'project') {
    // The nights the rest of the pilot would take, at the measured costs and wall times where there are some, else the plan's.
    const l = load(work);
    const results = resultsDir(work);
    const runs = readJsonl<Recorded>(path.join(results, 'runs.jsonl'));
    const models = (opts.get('models') ?? Object.keys(l.plan.models).join(',')).split(',');
    const all = rounds(l.plan, currentSelection(l), models);
    const means = measured(runs);
    const cost = (c: Cell): number => expectedCost(l.plan, c, means, OPEN_SETS);
    const wall = new Map<string, { n: number; sum: number }>();
    for (const r of runs) if (r.infra_failure === null && 'wall_s' in r) {
      const w = wall.get(r.set) ?? { n: 0, sum: 0 };
      wall.set(r.set, { n: w.n + 1, sum: w.sum + r.wall_s.total / 60 });
    }
    const minutes = (c: Cell): number => {
      const w = wall.get(c.set);
      return w && w.n >= 3 ? w.sum / w.n : (l.plan.expected_wall_min[c.set] ?? 10);
    };
    const concurrency = Number(opts.get('concurrency') ?? l.plan.concurrency);
    const done = new Set(runs.map((r) => r.key));
    let left = l.plan.cap_usd - runs.reduce((a, r) => a + r.cost_counted_usd, 0);
    const nightHours = Number(opts.get('night-hours') ?? 0);
    for (let night = 1; night <= 20; night++) {
      const n = planNight(all, done, cost, Number(opts.get('night-usd') ?? l.plan.night_usd), left);
      let cells = n.rounds.flatMap((r) => r.units.flatMap((u) => u.cells)).filter((c) => !done.has(cellKey(c)));
      if (cells.length === 0) break;
      if (nightHours > 0) {
        // A night with an end time stops between units once its hours are used.
        const kept: Cell[] = [];
        let used = 0;
        for (const r of n.rounds) for (const u of r.units) {
          const us = u.cells.filter((c) => !done.has(cellKey(c)));
          const m = us.reduce((a, c) => a + minutes(c), 0) / concurrency;
          if (used + m > nightHours * 60) break;
          used += m;
          kept.push(...us);
        }
        cells = kept;
      }
      const usd = cells.reduce((a, c) => a + cost(c), 0);
      const hours = cells.reduce((a, c) => a + minutes(c), 0) / concurrency / 60;
      const perModel = models.map((m) => `${m} ${cells.filter((c) => c.model === m).length}`).join(', ');
      log(`night ${night}: ${cells.length} runs (${perModel}), $${usd.toFixed(2)}, ${hours.toFixed(1)} h at ${concurrency} at a time; ${n.rounds.map((r) => `${r.phase} #${r.rep}`).join(' + ')}`);
      for (const c of cells) done.add(cellKey(c));
      left -= usd;
    }
    const remaining = all.flatMap((r) => r.units.flatMap((u) => u.cells)).filter((c) => !done.has(cellKey(c)));
    log(`${remaining.length} runs would not fit the cap or the nights simulated`);
    return 0;
  }
  if (command === 'status') {
    const l = load(work);
    const results = resultsDir(work);
    const runs = readJsonl<Recorded>(path.join(results, 'runs.jsonl'));
    const done = new Set(runs.map((r) => r.key));
    for (const r of rounds(l.plan, currentSelection(l), Object.keys(l.plan.models))) {
      const cells = r.units.flatMap((u) => u.cells);
      log(`${r.phase}, round ${r.rep}: ${cells.filter((c) => done.has(cellKey(c))).length} of ${cells.length} runs`);
    }
    for (const n of readJsonl<NightSummary>(path.join(results, 'nights.jsonl'))) log(summaryLine(n));
    if (opts.has('account')) log(`quota: ${readQuota(required(opts, 'account')).all_models ?? '?'}% of the week left`);
    return 0;
  }
  process.stderr.write('usage: fetch|gold|run|smoke|grade|rescore|calibration|project|status --work <dir> [options], or summarize --results <dir>; see the header of experiments/benchmark/bench.ts\n');
  return 2;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url))
  void main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (e: Error) => {
      process.stderr.write(`${e.stack ?? e.message}\n`);
      process.exitCode = 1;
    },
  );
