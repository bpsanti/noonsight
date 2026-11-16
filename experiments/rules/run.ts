// The live experiment that measures what the preset's rules change when sextant delivers them. It
// runs the same small task on each target model twice over: once with the model's preset rules,
// delivered by sextant's SessionStart hook, and once with the model declared "use": "none", so the
// same hook runs and delivers nothing. It records the outcome signals each rule's source claims and
// the tokens and cost Claude Code reports, one JSON line per run. README.md describes the design.
//
// It sends prompts to the models from the login of the person running it, so it spends usage. It
// never runs in CI:
//
//   npm run experiment -- run [--models fable,sonnet] [--tasks question,fix] [--reps 3] [--cap-usd 10] [--out <dir>]
//   npm run experiment -- summarize <dir> [--to <dir>]
//
// Each run gets the lab of the live tests (test/live/login.ts): a temporary sextant home and
// configuration, the hook entries in a --settings file, and none of the person's own settings files,
// CLAUDE.md included.

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PACKAGE_ROOT } from '../../src/config/paths.js';
import { baseEnv, lab, preconditions } from '../../test/live/login.js';
import { answerLine, answerScore, changedFiles, handsBack, prose, toolCalls, verification, type Prose } from './score.js';
import { summarize } from './summary.js';

export const EXPERIMENT_DIR = path.join(PACKAGE_ROOT, 'experiments', 'rules');

export interface Task {
  readonly scope: string;
  readonly prompt: string;
  /** The file the task asks for, when it asks for one; else the final message is the report. */
  readonly report?: string;
  readonly answer_prefix?: string;
  readonly expected?: readonly string[];
  /** The hidden check, copied into the project only after the run. */
  readonly check?: string;
  /** The files the task asks to change; any other change counts as an extra file. */
  readonly allowed_changes: readonly string[];
}

export interface Plan {
  readonly effort: string;
  readonly reps: number;
  readonly cap_usd: number;
  readonly unattended_env: string;
  readonly models: Readonly<Record<string, { readonly id: string; readonly budget_usd: number }>>;
  /** The models a run covers unless --models names others. */
  readonly default_models: readonly string[];
  readonly arms: Readonly<Record<string, Record<string, unknown>>>;
  readonly tasks: Readonly<Record<string, Task>>;
  /** Rule id to the signals that stand for the effect its source claims. */
  readonly signals: Readonly<Record<string, readonly string[]>>;
}

export interface Cell {
  readonly task: string;
  readonly model: string;
  readonly arm: string;
  readonly rep: number;
}

/** One run, as runs.jsonl records it. It holds no path of the machine that ran it. */
export interface RunRecord extends Cell {
  readonly model_id: string;
  readonly effort: string;
  readonly claude_code: string;
  readonly started: string;
  readonly scope: string;
  /** What sextant's SessionStart hook decided, from the run's decision log. */
  readonly sextant: { readonly status: string | null; readonly reason: string | null; readonly place: string | null; readonly rules: readonly string[]; readonly sha256: string | null; readonly delivered: string | null };
  readonly exit: number | null;
  /** The result event's subtype: success, or why the run stopped, such as the budget. */
  readonly outcome: string;
  readonly cost_usd: number;
  readonly tokens: { readonly input: number; readonly cache_creation: number; readonly cache_read: number; readonly output: number };
  readonly turns: number;
  readonly duration_ms: number;
  readonly models_used: readonly string[];
  readonly tool_calls: number;
  readonly denied: number;
  readonly signals: Signals;
}

export interface Signals {
  /** The deliverable exists and the final message does not hand the work back. */
  readonly finished: boolean;
  readonly deliverable: boolean;
  readonly handed_back: boolean;
  readonly edited: boolean;
  readonly ran_tests: boolean;
  readonly verified: boolean;
  /** Files changed beyond the ones the task asks to change. */
  readonly extra_files: readonly string[];
  /** Question task: the jobs named, scored against the expected ones. */
  readonly answer?: { readonly found: number; readonly expected: number; readonly wrong: number; readonly line: boolean };
  /** Fix task: the hidden check and the project's own tests, run after the session ended. */
  readonly check_passed?: boolean;
  readonly suite_passed?: boolean;
  readonly report: Prose;
}

export function loadPlan(file = path.join(EXPERIMENT_DIR, 'plan.json')): Plan {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Plan;
}

/** Every cell, rep by rep, so that a run cut short by the cap still leaves balanced arms. */
export function cells(plan: Plan, models: readonly string[], tasks: readonly string[], arms: readonly string[], reps: number): Cell[] {
  const out: Cell[] = [];
  for (let rep = 1; rep <= reps; rep++) for (const task of tasks) for (const model of models) for (const arm of arms) out.push({ task, model, arm, rep });
  return out;
}

export function cellKey(c: Cell): string {
  return `${c.task}.${c.model}.${c.arm}.${c.rep}`;
}

const TOOLS = 'Bash,Read,Grep,Glob,Edit,Write';
const ALLOWED = 'Read,Grep,Glob,Edit,Write,Bash(npm test),Bash(npm test:*),Bash(npm run test:*),Bash(node:*),Bash(ls:*),Bash(cat:*)';
const RUN_TIMEOUT_MS = 15 * 60 * 1000;

/** A run that ended but cannot be recorded; it still spent its cost, null when Claude Code reported none. */
class RunFailed extends Error {
  constructor(
    message: string,
    readonly cost_usd: number | null,
  ) {
    super(message);
    this.name = 'RunFailed';
  }
}

/** One run of one cell: a fresh lab and project, one `claude -p` session, then the signals. */
async function runCell(plan: Plan, cell: Cell, out: string, claudeVersion: string): Promise<RunRecord> {
  const model = plan.models[cell.model];
  const task = plan.tasks[cell.task];
  const arm = plan.arms[cell.arm];
  if (!model || !task || !arm) throw new Error(`unknown cell ${cellKey(cell)}`);
  const l = lab(`exp-${cellKey(cell)}`, { version: 1, models: { [model.id]: arm }, session: { unattended_when_env: [plan.unattended_env] } }, {});
  const fixture = path.join(EXPERIMENT_DIR, 'fixture');
  fs.cpSync(fixture, l.project, { recursive: true });

  const started = new Date().toISOString();
  const args = [
    '-p', task.prompt,
    '--output-format', 'stream-json', '--verbose',
    '--model', model.id, '--effort', plan.effort, '--max-budget-usd', String(model.budget_usd),
    '--permission-mode', 'default', '--setting-sources', 'project,local', '--settings', l.settings,
    '--strict-mcp-config', '--disable-slash-commands', '--no-session-persistence',
    '--tools', TOOLS, '--allowedTools', ALLOWED,
  ];
  const env = { ...baseEnv(), SEXTANT_SCOPE: task.scope, [plan.unattended_env]: '1' };
  const { status, stdout } = await spawnClaude(args, l.project, env);
  const stream = stdout
    .split('\n')
    .filter((line) => line.startsWith('{'))
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as Record<string, any>];
      } catch {
        return [];
      }
    });
  const result = stream.filter((e) => e.type === 'result').at(-1) ?? {};
  const final = String(result.result ?? '');

  const dir = path.join(out, 'runs', cellKey(cell));
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'stream.jsonl'), stdout);
  const log = l.log();
  // Without the hook's decision, the run cannot say what it received, so it is not recorded and a resume runs it again.
  if (!log.some((d) => d.event === 'session-start')) {
    fs.rmSync(l.root, { recursive: true, force: true });
    throw new RunFailed(`sextant logged no session start, so the hook did not run or failed; ${path.join(dir, 'stream.jsonl')} holds its output`, result.total_cost_usd === undefined ? null : Number(result.total_cost_usd));
  }
  fs.appendFileSync(path.join(out, 'decisions.jsonl'), log.map((d) => `${JSON.stringify({ ...d, experiment_run: cellKey(cell) })}\n`).join(''));

  const calls = toolCalls(stream);
  const changed = changedFiles(fixture, l.project);
  const reportText = task.report ? readText(path.join(l.project, task.report)) : final;
  if (task.report && reportText !== null) fs.writeFileSync(path.join(dir, task.report), reportText);
  fs.writeFileSync(path.join(dir, 'final.md'), final);
  const named = task.answer_prefix && reportText !== null ? answerLine(reportText, task.answer_prefix) : null;
  const handedBack = handsBack(final);
  const deliverable = task.report ? reportText !== null && reportText.trim() !== '' : changed.some((f) => task.allowed_changes.includes(f));
  const ok = result.subtype === 'success' && !result.is_error;

  let check: { check_passed?: boolean; suite_passed?: boolean } = {};
  if (task.check) {
    fs.writeFileSync(path.join(dir, 'changes.diff'), diff(fixture, l.project));
    const node = (files: string[]): boolean => spawnSync(process.execPath, ['--test', ...files], { cwd: l.project, encoding: 'utf8', timeout: 60_000 }).status === 0;
    const suitePassed = node([]);
    const hidden = path.join(l.project, 'check');
    fs.mkdirSync(hidden, { recursive: true });
    fs.copyFileSync(path.join(EXPERIMENT_DIR, task.check), path.join(hidden, path.basename(task.check)));
    check = { check_passed: node([path.join('check', path.basename(task.check))]), suite_passed: suitePassed };
  }

  const session = log.find((d) => d.event === 'session-start') ?? {};
  const usage = totals(result);
  const record: RunRecord = {
    ...cell,
    model_id: model.id,
    effort: plan.effort,
    claude_code: claudeVersion,
    started,
    scope: task.scope,
    sextant: {
      status: session.status ?? null,
      reason: session.reason ?? null,
      place: session.place ?? null,
      rules: session.rules ?? [],
      sha256: session.sha256 ?? null,
      delivered: session.delivered ?? null,
    },
    exit: status,
    outcome: String(result.subtype ?? 'no-result'),
    cost_usd: Number(result.total_cost_usd ?? 0),
    tokens: usage,
    turns: Number(result.num_turns ?? 0),
    duration_ms: Number(result.duration_ms ?? 0),
    models_used: Object.keys(result.modelUsage ?? {}),
    tool_calls: calls.length,
    denied: calls.filter((c) => c.denied).length,
    signals: {
      finished: ok && deliverable && !handedBack,
      deliverable,
      handed_back: handedBack,
      ...verification(calls, l.project, task.report ? [task.report] : []),
      extra_files: changed.filter((f) => !task.allowed_changes.includes(f)),
      ...(task.expected ? { answer: { ...answerScore(named, task.expected), line: named !== null } } : {}),
      ...check,
      report: prose(reportText ?? ''),
    },
  };
  fs.rmSync(l.root, { recursive: true, force: true });
  return record;
}

/** Token totals over every model the session used, as the result event's modelUsage reports them. */
function totals(result: Record<string, any>): RunRecord['tokens'] {
  const t = { input: 0, cache_creation: 0, cache_read: 0, output: 0 };
  for (const u of Object.values((result.modelUsage ?? {}) as Record<string, Record<string, number>>)) {
    t.input += u.inputTokens ?? 0;
    t.cache_creation += u.cacheCreationInputTokens ?? 0;
    t.cache_read += u.cacheReadInputTokens ?? 0;
    t.output += u.outputTokens ?? 0;
  }
  return t;
}

function readText(file: string): string | null {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function diff(before: string, after: string): string {
  const r = spawnSync('diff', ['-ruN', '-x', '.claude', '-x', 'check', before, after], { encoding: 'utf8' });
  return (r.stdout ?? '').split(before).join('a').split(after).join('b');
}

function spawnClaude(args: readonly string[], cwd: string, env: Record<string, string>): Promise<{ status: number | null; stdout: string }> {
  return new Promise((resolve) => {
    const child = spawn('claude', [...args], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    child.stdout.setEncoding('utf8').on('data', (d: string) => (stdout += d));
    child.stderr.resume();
    const timer = setTimeout(() => child.kill('SIGTERM'), RUN_TIMEOUT_MS);
    child.on('close', (status) => {
      clearTimeout(timer);
      resolve({ status, stdout });
    });
  });
}

/** The runs already recorded in a results directory, so a stopped experiment resumes where it was. */
export function readRuns(out: string): RunRecord[] {
  const text = readText(path.join(out, 'runs.jsonl')) ?? '';
  return text
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as RunRecord);
}

interface RunOptions {
  readonly models: readonly string[];
  readonly tasks: readonly string[];
  readonly arms: readonly string[];
  readonly reps: number;
  readonly cap: number;
  readonly concurrency: number;
  readonly out: string;
}

/**
 * Run every cell not yet recorded, a few at a time. A run starts only while the money already spent,
 * plus the budgets of the runs in flight, plus its own budget stays within the cap; Claude Code
 * checks a run's budget between turns, so one run can pass its budget by the cost of its last turn.
 */
async function runAll(plan: Plan, o: RunOptions): Promise<void> {
  preconditions();
  fs.mkdirSync(o.out, { recursive: true });
  const version = spawnSync('claude', ['--version'], { encoding: 'utf8', env: baseEnv() }).stdout.trim().split(' ')[0] ?? 'unknown';
  const done = new Set(readRuns(o.out).map(cellKey));
  // A run with no result event reported no cost, so the cap counts its whole budget.
  const charged = (r: Pick<RunRecord, 'model' | 'outcome' | 'cost_usd'>): number => (r.outcome === 'no-result' ? (plan.models[r.model]?.budget_usd ?? 0) : r.cost_usd);
  let spent = readRuns(o.out).reduce((s, r) => s + charged(r), 0);
  const queue = cells(plan, o.models, o.tasks, o.arms, o.reps).filter((c) => !done.has(cellKey(c)));
  let reserved = 0;
  let skipped = 0;
  const log = (s: string): void => void process.stdout.write(`${new Date().toISOString().slice(11, 19)} ${s}\n`);
  log(`${queue.length} runs to do, ${done.size} already recorded, $${spent.toFixed(2)} spent of the $${o.cap} cap`);

  // Resolved each time a run ends, for a worker waiting until the budgets in flight free up.
  let waiting: (() => void)[] = [];
  const runEnded = (): Promise<void> => new Promise((resolve) => waiting.push(resolve));

  const worker = async (): Promise<void> => {
    for (;;) {
      const cell = queue.shift();
      if (!cell) return;
      const budget = plan.models[cell.model]?.budget_usd ?? 0;
      if (spent + reserved + budget > o.cap) {
        // It may fit once the runs in flight end and their unspent budget is released.
        if (reserved > 0) {
          queue.unshift(cell);
          await runEnded();
          continue;
        }
        skipped++;
        continue;
      }
      reserved += budget;
      log(`start ${cellKey(cell)}`);
      try {
        const record = await runCell(plan, cell, o.out, version);
        spent += charged(record);
        fs.appendFileSync(path.join(o.out, 'runs.jsonl'), `${JSON.stringify(record)}\n`);
        log(`done  ${cellKey(cell)}: ${record.outcome}, $${record.cost_usd.toFixed(3)}, ${record.tokens.output} output tokens, finished=${record.signals.finished}; spent $${spent.toFixed(2)}`);
      } catch (e) {
        const cost = e instanceof RunFailed && e.cost_usd !== null ? e.cost_usd : budget;
        spent += cost;
        log(`fail  ${cellKey(cell)}: ${(e as Error).message}; $${cost.toFixed(3)} counted, spent $${spent.toFixed(2)}`);
      } finally {
        reserved -= budget;
        const wake = waiting;
        waiting = [];
        for (const resolve of wake) resolve();
      }
    }
  };
  await Promise.all(Array.from({ length: o.concurrency }, worker));
  log(`finished: $${spent.toFixed(2)} spent${skipped ? `, ${skipped} runs left out to stay within the cap` : ''}`);
}

function list(value: string | undefined, all: readonly string[], what: string): string[] {
  if (value === undefined) return [...all];
  const items = value.split(',').filter(Boolean);
  for (const i of items) if (!all.includes(i)) throw new Error(`unknown ${what} "${i}"; known: ${all.join(', ')}`);
  return items;
}

async function main(argv: readonly string[]): Promise<number> {
  const [command, ...rest] = argv;
  const opts = new Map<string, string>();
  const positional: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i] as string;
    if (a.startsWith('--')) opts.set(a.slice(2), rest[++i] ?? '');
    else positional.push(a);
  }
  const plan = loadPlan();
  if (command === 'run') {
    const day = new Date().toISOString().slice(0, 10);
    await runAll(plan, {
      models: opts.has('models') ? list(opts.get('models'), Object.keys(plan.models), 'model') : [...plan.default_models],
      tasks: list(opts.get('tasks'), Object.keys(plan.tasks), 'task'),
      arms: list(opts.get('arms'), Object.keys(plan.arms), 'arm'),
      reps: Number(opts.get('reps') ?? plan.reps),
      cap: Number(opts.get('cap-usd') ?? plan.cap_usd),
      concurrency: Number(opts.get('concurrency') ?? 3),
      out: path.resolve(opts.get('out') ?? path.join(os.tmpdir(), `sextant-experiment-${day}`)),
    });
    return 0;
  }
  if (command === 'summarize' && positional[0]) {
    const out = path.resolve(positional[0]);
    const text = summarize(plan, readRuns(out), path.join(out, 'decisions.jsonl'));
    fs.writeFileSync(path.join(out, 'summary.md'), text);
    const to = opts.get('to');
    if (to) {
      fs.mkdirSync(to, { recursive: true });
      fs.copyFileSync(path.join(out, 'runs.jsonl'), path.join(to, 'runs.jsonl'));
      fs.writeFileSync(path.join(to, 'summary.md'), text);
    }
    process.stdout.write(text);
    return 0;
  }
  process.stderr.write('usage: run [--models fable,sonnet] [--tasks question,fix] [--arms rules,none] [--reps N] [--cap-usd N] [--concurrency N] [--out <dir>]\n       summarize <dir> [--to <dir>]\n');
  return 2;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url))
  void main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
