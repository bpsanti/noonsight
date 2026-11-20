// The live experiment that measures what the preset's rules change when noonsight delivers them. It
// runs the same small task on each target model in several arms: with the model's preset rules,
// delivered by noonsight's SessionStart hook; with the model declared "use": "none", so the same hook
// runs and delivers nothing; and, for some designs, with one preset rule alone. It records the
// outcome signals each rule's source claims and the tokens and cost Claude Code reports, one JSON
// line per run. README.md describes the design.
//
// It sends prompts to the models from the login of the person running it, so it spends usage. It
// never runs in CI. With --stub, every request goes instead to a scripted stand-in on this machine
// (stub.ts), which sends nothing to Anthropic and spends nothing:
//
//   npm run experiment -- run [--design expanded [--pilot | --gate <pilot dir>]] [--models fable,sonnet] [--tasks question,fix] [--arms rules,none] [--reps 3] [--cap-usd 10] [--stub | --token-file <file>] [--out <dir>]
//   npm run experiment -- estimate [--design expanded] [--reps 30]
//   npm run experiment -- summarize <dir> [--design expanded [--pilot]] [--to <dir>]
//
// Each run gets the lab of the live tests (test/live/login.ts): a temporary noonsight home and
// configuration, the hook entries in a --settings file, and none of the person's own settings files,
// CLAUDE.md included.

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PRESET, readPreset, type Preset } from '../../src/config/load.js';
import { PACKAGE_ROOT } from '../../src/config/paths.js';
import { baseEnv, lab, preconditions } from '../../test/live/login.js';
import { serveMessages } from '../delivery/stub.js';
import { answerLine, answerScore, changedFiles, handsBack, partResults, prose, ruleFileRead, toolCalls, verification, type Prose, type RuleFileRead } from './score.js';
import { script, solutionFiles, stubReply } from './stub.js';
import { gate, summarize, summarizePilot } from './summary.js';

export const EXPERIMENT_DIR = path.join(PACKAGE_ROOT, 'experiments', 'rules');

export interface Task {
  /** The project the session works in, a folder of fixtures/. */
  readonly fixture: string;
  readonly scope: string;
  readonly prompt: string;
  /** The file the task asks for, when it asks for one; else the final message is the report. */
  readonly report?: string;
  readonly answer_prefix?: string;
  readonly expected?: readonly string[];
  /** The hidden check, copied into the project only after the run. */
  readonly check?: string;
  /** A long task's number of parts: its hidden check has one top-level test per part, named `part <name>`, and the run records which pass. */
  readonly parts?: number;
  /** The files the task asks to change, where `*` stands for any characters; any other change counts as an extra file. */
  readonly allowed_changes: readonly string[];
  /** A reference solution: the files a correct run leaves, relative to the project. The stub plays it, and the tests check it passes the hidden check. */
  readonly solution: string;
}

/** A named set of cells with its repetitions, cap, cost projection and pre-registered comparisons. */
export interface Design {
  readonly description: string;
  readonly reps: number;
  readonly cap_usd: number;
  readonly arms: readonly string[];
  /** Model to the tasks it runs. */
  readonly cells: Readonly<Record<string, readonly string[]>>;
  /** Model to task to the expected cost of one run, in US dollars at list price; README.md gives where each comes from. */
  readonly expected_usd: Readonly<Record<string, Readonly<Record<string, number>>>>;
  /** The comparisons the design is run to test, fixed before it runs. */
  readonly primary: readonly Primary[];
  /** Model to effort, for the models that do not run at the plan's effort. */
  readonly effort?: Readonly<Record<string, string>>;
  /** Model to the budget of one run, in US dollars, for the models whose runs need another budget than the plan's. */
  readonly budget_usd?: Readonly<Record<string, number>>;
  /** The time limit of one run, in minutes; 15 when not given. */
  readonly timeout_min?: number;
  /** Runs of one arm made before the design, in a results directory of their own, that decide which cells the design runs. */
  readonly pilot?: Pilot;
}

/**
 * A pilot of a design: `reps` runs of `arm` in each cell, kept apart from the design's own runs. A cell
 * enters the design only when at least `min_incomplete` of its pilot runs left a part of the task
 * undone, since the rules it tests can only show where runs without them stop short.
 */
export interface Pilot {
  readonly reps: number;
  readonly arm: string;
  readonly min_incomplete: number;
  /** The pilot's own cap, apart from the design's: the pilot spends in its own results directory. */
  readonly cap_usd: number;
}

export interface Primary {
  readonly rule: string;
  readonly model: string;
  readonly tasks: readonly string[];
  readonly signal: 'verified' | 'completed' | 'words_per_sentence' | 'semicolons_per_1k_words' | 'cost_usd';
  /** The arm with the rule; `rules` unless named. */
  readonly arm?: string;
  /** The arm it is compared with; `none` unless named. */
  readonly against?: string;
  /** The direction the rule's source claims, with the rule against without it; absent when the source claims none, so either direction is read as found. */
  readonly direction?: 'higher' | 'lower';
}

export interface Plan {
  readonly effort: string;
  readonly reps: number;
  readonly cap_usd: number;
  readonly unattended_env: string;
  readonly models: Readonly<Record<string, { readonly id: string; readonly budget_usd: number }>>;
  /** The models a run covers unless --models names others. */
  readonly default_models: readonly string[];
  /** The arms a run covers unless --arms names others. */
  readonly default_arms: readonly string[];
  /** Arm to the noonsight entry each model gets in it; `only` makes it the preset with that one rule (see armEntry). */
  readonly arms: Readonly<Record<string, Arm>>;
  /** The tasks a run without a design covers unless --tasks names others. */
  readonly default_tasks: readonly string[];
  readonly tasks: Readonly<Record<string, Task>>;
  readonly designs: Readonly<Record<string, Design>>;
  /** Rule id to the signals that stand for the effect its source claims. */
  readonly signals: Readonly<Record<string, readonly string[]>>;
}

/**
 * An arm: a noonsight model entry, such as `{ "use": "preset" }`, or the preset reduced to one rule
 * with `only`, the rule's name without its model prefix, delivered inline or, with `pointer`, as a
 * short rule that says to read a file holding its text (see armSetup).
 */
export type Arm = Readonly<Record<string, unknown>> & { readonly only?: string; readonly pointer?: boolean };

export interface Cell {
  readonly task: string;
  readonly model: string;
  readonly arm: string;
  readonly rep: number;
}

/** One run, as runs.jsonl records it. It holds no path of the machine that ran it. */
export interface RunRecord extends Cell {
  /** Where the requests went: the real API, or the scripted stand-in, whose numbers say nothing about a model. Absent in runs recorded before the stand-in existed, which all went to the API. */
  readonly api?: 'anthropic' | 'stub';
  readonly model_id: string;
  readonly effort: string;
  readonly claude_code: string;
  readonly started: string;
  readonly scope: string;
  /** What noonsight's SessionStart hook decided, from the run's decision log. */
  readonly noonsight: { readonly status: string | null; readonly reason: string | null; readonly place: string | null; readonly rules: readonly string[]; readonly sha256: string | null; readonly delivered: string | null };
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
  /** A task with a hidden check: whether it passes, and whether the project's own tests do, run after the session ended. */
  readonly check_passed?: boolean;
  readonly suite_passed?: boolean;
  /** A long task: how many of its parts the hidden check passes, and the names of those it does not. */
  readonly parts?: { readonly done: number; readonly total: number; readonly undone: readonly string[] };
  /** A long task: every part done. */
  readonly completed?: boolean;
  readonly report: Prose;
  /** Pointer arm: whether and when the session read the file holding the rule's text. */
  readonly pointer?: RuleFileRead;
}

export function loadPlan(file = path.join(EXPERIMENT_DIR, 'plan.json')): Plan {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Plan;
}

/** The preset the experiment delivers: the package's own, never one the environment points to. */
export function experimentPreset(): Preset {
  return readPreset(DEFAULT_PRESET, { presetsDir: path.join(PACKAGE_ROOT, 'presets') });
}

/** What a model gets in an arm: its noonsight entry, and the rule files the entry names, beside the configuration. */
export interface ArmSetup {
  readonly entry: Record<string, unknown>;
  /** File name, in the configuration's directory, to its text. */
  readonly files: Readonly<Record<string, string>>;
  /** For a pointer arm, the file that holds the rule's text, which the session is told to read. */
  readonly ruleFile: string | null;
}

/** The id of the rule a pointer arm delivers in place of the preset rule it keeps. */
export function pointerRuleId(only: string): string {
  return `experiment/${only}-pointer`;
}

/** The short rule a pointer arm delivers: where the rule's text is, and to read it. */
export function pointerText(ruleFile: string): string {
  return `A working rule for code changes is in the file ${ruleFile}. Read that file before you change any code, and follow it.`;
}

/**
 * What a model gets in an arm. An arm with `only` is the preset with every other rule that ships on
 * for the model in `disable`, so it delivers that one rule wherever the preset would, and nothing
 * else; a model whose preset has no such rule cannot run in it. An arm that also has `pointer`
 * delivers, in that rule's place, a short rule of the user's that names a file holding the rule's
 * text and says to read it: noonsight's `replaces` keeps the rule's scopes, places and triggers, so
 * only the delivered text differs from the arm of the rule alone. `dir` is the configuration's
 * directory, where the rule's text is written.
 */
export function armSetup(plan: Plan, arm: string, modelId: string, dir: string, preset: Preset = experimentPreset()): ArmSetup {
  const entry = plan.arms[arm];
  if (!entry) throw new Error(`unknown arm "${arm}"`);
  const { only, pointer, ...rest } = entry;
  if (only === undefined) {
    if (pointer) throw new Error(`the arm "${arm}" is a pointer arm, so it needs "only"`);
    return { entry: rest, files: {}, ruleFile: null };
  }
  const rules = preset.models.get(modelId) ?? [];
  const kept = rules.find((r) => r.id.slice(r.id.indexOf('/') + 1) === only);
  if (!kept) throw new Error(`the arm "${arm}" keeps the rule "${only}", which the preset does not have for ${modelId}`);
  if (!kept.enabled) throw new Error(`the arm "${arm}" keeps ${kept.id}, which ships off`);
  const disable = rules.filter((r) => r.enabled && r !== kept).map((r) => r.id);
  const reduced = { ...rest, ...(disable.length ? { disable } : {}) };
  if (!pointer) return { entry: reduced, files: {}, ruleFile: null };
  const ruleFile = path.join(dir, `${only}.md`);
  const short = `${only}-pointer.md`;
  return {
    entry: { ...reduced, add: [{ id: pointerRuleId(only), file: short, replaces: kept.id }] },
    files: { [short]: `${pointerText(ruleFile)}\n`, [`${only}.md`]: `${kept.text.trim()}\n` },
    ruleFile,
  };
}

/** The noonsight entry a model gets in an arm, which does not depend on where its files go (see armSetup). */
export function armEntry(plan: Plan, arm: string, modelId: string, preset: Preset = experimentPreset()): Record<string, unknown> {
  return armSetup(plan, arm, modelId, '.', preset).entry;
}

/** Every cell, rep by rep, so that a run cut short by the cap still leaves balanced arms. */
export function cells(plan: Plan, models: readonly string[], tasks: readonly string[], arms: readonly string[], reps: number): Cell[] {
  return matrixCells(Object.fromEntries(models.map((m) => [m, tasks])), Object.keys(plan.tasks), arms, reps);
}

/** The cells of a design, rep by rep in the same order, each model on its own tasks. */
export function designCells(plan: Plan, design: Design, reps = design.reps): Cell[] {
  return matrixCells(design.cells, Object.keys(plan.tasks), design.arms, reps);
}

function matrixCells(matrix: Readonly<Record<string, readonly string[]>>, taskOrder: readonly string[], arms: readonly string[], reps: number): Cell[] {
  const out: Cell[] = [];
  for (let rep = 1; rep <= reps; rep++)
    for (const task of taskOrder) for (const [model, tasks] of Object.entries(matrix)) if (tasks.includes(task)) for (const arm of arms) out.push({ task, model, arm, rep });
  return out;
}

/** Whether a changed file is one the task asks to change. */
export function allowedChange(file: string, patterns: readonly string[]): boolean {
  return patterns.some((p) => new RegExp(`^${p.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`).test(file));
}

/** The cost a design is expected to spend at `reps` repetitions of `arms`, per model and task, and the most its runs' budgets allow. */
export function projection(
  plan: Plan,
  design: Design,
  reps = design.reps,
  arms: readonly string[] = design.arms,
): { rows: { model: string; task: string; runs: number; per_run: number; expected: number; ceiling: number }[]; expected: number; ceiling: number } {
  const rows = Object.entries(design.cells).flatMap(([model, tasks]) =>
    tasks.map((task) => {
      const runs = reps * arms.length;
      const perRun = design.expected_usd[model]?.[task];
      if (perRun === undefined) throw new Error(`the design has no expected cost for ${model} on ${task}`);
      return { model, task, runs, per_run: perRun, expected: runs * perRun, ceiling: runs * runSettings(plan, design, model).budget_usd };
    }),
  );
  return { rows, expected: rows.reduce((s, r) => s + r.expected, 0), ceiling: rows.reduce((s, r) => s + r.ceiling, 0) };
}

/** How one model's runs are made: at what effort, within what budget and time limit. */
export interface RunSettings {
  readonly effort: string;
  readonly budget_usd: number;
  readonly timeout_ms: number;
}

const DEFAULT_TIMEOUT_MIN = 15;

/** The settings of a model's runs: the design's where it sets them, else the plan's. */
export function runSettings(plan: Plan, design: Design | undefined, model: string): RunSettings {
  const m = plan.models[model];
  if (!m) throw new Error(`unknown model ${model}`);
  return {
    effort: design?.effort?.[model] ?? plan.effort,
    budget_usd: design?.budget_usd?.[model] ?? m.budget_usd,
    timeout_ms: (design?.timeout_min ?? DEFAULT_TIMEOUT_MIN) * 60 * 1000,
  };
}

/** The cells of a design's pilot: its arm only, rep by rep. */
export function pilotCells(plan: Plan, design: Design): Cell[] {
  if (!design.pilot) throw new Error('the design has no pilot');
  return matrixCells(design.cells, Object.keys(plan.tasks), [design.pilot.arm], design.pilot.reps);
}

export function cellKey(c: Cell): string {
  return `${c.task}.${c.model}.${c.arm}.${c.rep}`;
}

const TOOLS = 'Bash,Read,Grep,Glob,Edit,Write';
const ALLOWED = 'Read,Grep,Glob,Edit,Write,Bash(npm test),Bash(npm test:*),Bash(npm run test:*),Bash(node:*),Bash(ls:*),Bash(cat:*)';

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

/**
 * The environment of a stub run: a fresh home and Claude Code configuration directory, a placeholder
 * login, and every request sent to the local stand-in, so nothing of the person's login is used and
 * nothing reaches Anthropic.
 */
export function stubEnv(root: string, url: string): Record<string, string> {
  const home = path.join(root, 'stub-home');
  const config = path.join(root, 'stub-claude');
  for (const d of [home, config]) fs.mkdirSync(d, { recursive: true });
  return {
    PATH: process.env.PATH ?? '',
    HOME: home,
    CLAUDE_CONFIG_DIR: config,
    LANG: 'en_US.UTF-8',
    TERM: 'xterm-256color',
    DISABLE_AUTOUPDATER: '1',
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    CLAUDE_CODE_OAUTH_TOKEN: 'noonsight-rules-experiment-stub',
    ANTHROPIC_BASE_URL: url,
  };
}

/** One run of one cell: a fresh lab and project, one `claude -p` session, then the signals. */
async function runCell(plan: Plan, design: Design | undefined, cell: Cell, out: string, claudeVersion: string, stub: boolean, token: string | null): Promise<RunRecord> {
  const model = plan.models[cell.model];
  const task = plan.tasks[cell.task];
  if (!model || !task) throw new Error(`unknown cell ${cellKey(cell)}`);
  const settings = runSettings(plan, design, cell.model);
  const l = lab(`exp-${cellKey(cell)}`, { version: 1, models: { [model.id]: armEntry(plan, cell.arm, model.id) }, session: { unattended_when_env: [plan.unattended_env] } }, {});
  // The rule files sit beside the lab's configuration, where noonsight reads them; a pointer arm's
  // short rule names the file that holds the rule's text by its absolute path.
  const setup = armSetup(plan, cell.arm, model.id, path.join(l.root, 'rules'));
  for (const [file, text] of Object.entries(setup.files)) fs.writeFileSync(path.join(l.root, 'rules', file), text);
  const fixture = path.join(EXPERIMENT_DIR, 'fixtures', task.fixture);
  fs.cpSync(fixture, l.project, { recursive: true });

  const started = new Date().toISOString();
  const args = [
    '-p', task.prompt,
    '--output-format', 'stream-json', '--verbose',
    '--model', model.id, '--effort', settings.effort, '--max-budget-usd', String(settings.budget_usd),
    '--permission-mode', 'default', '--setting-sources', 'project,local', '--settings', l.settings,
    '--strict-mcp-config', '--disable-slash-commands', '--no-session-persistence',
    '--tools', TOOLS, '--allowedTools', ALLOWED,
  ];
  const solution = stub ? solutionFiles(path.join(EXPERIMENT_DIR, task.solution)) : {};
  const api = stub ? await serveMessages((body) => stubReply(body, (rules) => script(task, solution, fixture, l.project, rules, setup.ruleFile))) : null;
  const env = { ...(api ? stubEnv(l.root, api.url) : { ...baseEnv(), ...(token ? { CLAUDE_CODE_OAUTH_TOKEN: token } : {}) }), NOONSIGHT_SCOPE: task.scope, [plan.unattended_env]: '1' };
  const { status, stdout } = await spawnClaude(args, l.project, env, settings.timeout_ms).finally(() => api?.close());
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
    throw new RunFailed(`noonsight logged no session start, so the hook did not run or failed; ${path.join(dir, 'stream.jsonl')} holds its output`, result.total_cost_usd === undefined ? null : Number(result.total_cost_usd));
  }
  fs.appendFileSync(path.join(out, 'decisions.jsonl'), log.map((d) => `${JSON.stringify({ ...d, experiment_run: cellKey(cell) })}\n`).join(''));

  const calls = toolCalls(stream);
  const changed = changedFiles(fixture, l.project);
  const reportText = task.report ? readText(path.join(l.project, task.report)) : final;
  if (task.report && reportText !== null) fs.writeFileSync(path.join(dir, task.report), reportText);
  fs.writeFileSync(path.join(dir, 'final.md'), final);
  const named = task.answer_prefix && reportText !== null ? answerLine(reportText, task.answer_prefix) : null;
  const handedBack = handsBack(final);
  const deliverable = task.report ? reportText !== null && reportText.trim() !== '' : changed.some((f) => allowedChange(f, task.allowed_changes));
  const ok = result.subtype === 'success' && !result.is_error;

  let check: Pick<Signals, 'check_passed' | 'suite_passed' | 'parts' | 'completed'> = {};
  if (task.check) {
    fs.writeFileSync(path.join(dir, 'changes.diff'), diff(fixture, l.project));
    const node = (files: string[]) => spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files], { cwd: l.project, encoding: 'utf8', timeout: 60_000 });
    const suitePassed = node([]).status === 0;
    const hidden = path.join(l.project, 'check');
    fs.mkdirSync(hidden, { recursive: true });
    fs.copyFileSync(path.join(EXPERIMENT_DIR, task.check), path.join(hidden, path.basename(task.check)));
    const r = node([path.join('check', path.basename(task.check))]);
    check = { check_passed: r.status === 0, suite_passed: suitePassed };
    if (task.parts !== undefined) {
      fs.writeFileSync(path.join(dir, 'check.tap'), r.stdout ?? '');
      // A part the report does not list, because the check could not run, counts as undone.
      const results = partResults(r.stdout ?? '');
      const done = results.filter((p) => p.ok).length;
      const undone = results.filter((p) => !p.ok).map((p) => p.name);
      check = { ...check, parts: { done, total: task.parts, undone }, completed: r.status === 0 && done === task.parts };
    }
  }

  const session = log.find((d) => d.event === 'session-start') ?? {};
  const usage = totals(result);
  const record: RunRecord = {
    ...cell,
    api: stub ? 'stub' : 'anthropic',
    model_id: model.id,
    effort: settings.effort,
    claude_code: claudeVersion,
    started,
    scope: task.scope,
    noonsight: {
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
      ...(setup.ruleFile ? { pointer: ruleFileRead(calls, setup.ruleFile, l.project, task.report ? [task.report] : []) } : {}),
      extra_files: changed.filter((f) => !allowedChange(f, task.allowed_changes)),
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

function spawnClaude(args: readonly string[], cwd: string, env: Record<string, string>, timeoutMs: number): Promise<{ status: number | null; stdout: string }> {
  return new Promise((resolve) => {
    const child = spawn('claude', [...args], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    child.stdout.setEncoding('utf8').on('data', (d: string) => (stdout += d));
    child.stderr.resume();
    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs);
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
  readonly cells: readonly Cell[];
  readonly cap: number;
  readonly concurrency: number;
  readonly out: string;
  readonly stub: boolean;
  /** A long-lived OAuth token of the account the runs spend from (`claude setup-token`); without it, Claude Code uses the login of its configuration directory. */
  readonly token: string | null;
  /** The design the cells come from, whose effort, budgets, time limit and arms they run with. */
  readonly design: Design | undefined;
}

/**
 * Run every cell not yet recorded, a few at a time. A run starts only while the money already spent,
 * plus the budgets of the runs in flight, plus its own budget stays within the cap; Claude Code
 * checks a run's budget between turns, so one run can pass its budget by the cost of its last turn.
 * The first run that cannot fit ends the queue, so a stopped experiment leaves whole repetitions.
 */
async function runAll(plan: Plan, o: RunOptions): Promise<void> {
  // Every arm resolves for every model it runs before anything is spent.
  const preset = experimentPreset();
  for (const c of o.cells) armEntry(plan, c.arm, plan.models[c.model]?.id ?? c.model, preset);
  if (!o.stub) preconditions();
  fs.mkdirSync(o.out, { recursive: true });
  const version = spawnSync('claude', ['--version'], { encoding: 'utf8', env: baseEnv() }).stdout.trim().split(' ')[0] ?? 'unknown';
  const previous = readRuns(o.out);
  // Stub runs and real ones never share a results directory, so a summary can never mix them.
  const api = o.stub ? 'stub' : 'anthropic';
  const other = previous.find((r) => (r.api ?? 'anthropic') !== api);
  if (other) throw new Error(`${o.out} already holds runs against the ${other.api ?? 'anthropic'} API; use another --out for runs against the ${api} one`);
  const done = new Set(previous.map(cellKey));
  const budgetOf = (model: string): number => runSettings(plan, o.design, model).budget_usd;
  // A run with no result event reported no cost, so the cap counts its whole budget.
  const charged = (r: Pick<RunRecord, 'model' | 'outcome' | 'cost_usd'>): number => (r.outcome === 'no-result' ? budgetOf(r.model) : r.cost_usd);
  let spent = readRuns(o.out).reduce((s, r) => s + charged(r), 0);
  const queue = o.cells.filter((c) => !done.has(cellKey(c)));
  let reserved = 0;
  let skipped = 0;
  const log = (s: string): void => void process.stdout.write(`${new Date().toISOString().slice(11, 19)} ${s}\n`);
  log(`${queue.length} runs to do, ${done.size} already recorded, $${spent.toFixed(2)} spent of the $${o.cap} cap${o.stub ? '; every request goes to the local stub, so the cost is simulated' : ''}`);

  // Resolved each time a run ends, for a worker waiting until the budgets in flight free up.
  let waiting: (() => void)[] = [];
  const runEnded = (): Promise<void> => new Promise((resolve) => waiting.push(resolve));

  const worker = async (): Promise<void> => {
    for (;;) {
      const cell = queue.shift();
      if (!cell) return;
      const budget = budgetOf(cell.model);
      if (spent + reserved + budget > o.cap) {
        // It may fit once the runs in flight end and their unspent budget is released.
        if (reserved > 0) {
          queue.unshift(cell);
          await runEnded();
          continue;
        }
        // With nothing in flight it never fits: stop here rather than go on with cheaper cells, so
        // every cell keeps the same number of repetitions, up to the one under way.
        skipped += queue.length + 1;
        queue.length = 0;
        return;
      }
      reserved += budget;
      log(`start ${cellKey(cell)}`);
      try {
        const record = await runCell(plan, o.design, cell, o.out, version, o.stub, o.token);
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

/** The options that take no value. */
const SWITCHES = new Set(['stub', 'pilot']);

/** The OAuth token in a file only its owner can read; it goes to each session's environment and is never written anywhere. */
export function readToken(file: string, stub: boolean): string {
  if (stub) throw new Error('--token-file is for runs against the API; a stub run uses a placeholder login');
  if ((fs.statSync(file).mode & 0o077) !== 0) throw new Error(`${file} can be read by others; chmod 600 it`);
  const token = fs.readFileSync(file, 'utf8').trim();
  if (!token) throw new Error(`${file} is empty`);
  return token;
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
    if (!a.startsWith('--')) positional.push(a);
    else if (SWITCHES.has(a.slice(2))) opts.set(a.slice(2), '');
    else opts.set(a.slice(2), rest[++i] ?? '');
  }
  const plan = loadPlan();
  const designName = opts.get('design');
  const design = designName === undefined ? undefined : plan.designs[designName];
  if (designName !== undefined && !design) throw new Error(`unknown design "${designName}"; known: ${Object.keys(plan.designs).join(', ')}`);
  const pilot = opts.has('pilot');
  if (pilot && !design?.pilot) throw new Error('--pilot needs a --design that has a pilot');
  if (command === 'run') {
    const day = new Date().toISOString().slice(0, 10);
    const stub = opts.has('stub');
    const reps = Number(opts.get('reps') ?? design?.reps ?? plan.reps);
    // A design fixes its matrix; --models, --tasks and --arms narrow it, and its pilot's reading (--gate) leaves out the cells that did not enter.
    const models = opts.has('models') ? list(opts.get('models'), Object.keys(plan.models), 'model') : design ? Object.keys(design.cells) : [...plan.default_models];
    const tasks = opts.has('tasks') ? list(opts.get('tasks'), Object.keys(plan.tasks), 'task') : design ? Object.keys(plan.tasks) : [...plan.default_tasks];
    const arms = opts.has('arms') ? list(opts.get('arms'), design ? design.arms : Object.keys(plan.arms), 'arm') : design ? [...design.arms] : [...plan.default_arms];
    const gateDir = opts.get('gate');
    if (gateDir !== undefined && (!design?.pilot || pilot)) throw new Error('--gate needs a --design that has a pilot, and reads the pilot of a run of the design itself');
    const entering = gateDir === undefined || !design ? null : gate(design, readRuns(path.resolve(gateDir))).filter((g) => g.enters);
    if (entering) process.stdout.write(`The pilot in ${gateDir} lets in ${entering.length ? entering.map((g) => `${g.model} on ${g.task}`).join(', ') : 'no cell'}.\n`);
    const matrix = design ? (pilot ? pilotCells(plan, design) : designCells(plan, design, reps)) : cells(plan, models, tasks, arms, reps);
    await runAll(plan, {
      cells: matrix.filter((c) => models.includes(c.model) && tasks.includes(c.task) && (pilot || arms.includes(c.arm)) && (!entering || entering.some((g) => g.model === c.model && g.task === c.task))),
      cap: Number(opts.get('cap-usd') ?? (pilot ? design?.pilot?.cap_usd : design?.cap_usd) ?? plan.cap_usd),
      concurrency: Number(opts.get('concurrency') ?? 3),
      out: path.resolve(opts.get('out') ?? path.join(os.tmpdir(), `noonsight-experiment-${stub ? 'stub-' : ''}${pilot ? 'pilot-' : ''}${day}`)),
      stub,
      token: opts.has('token-file') ? readToken(opts.get('token-file') ?? '', stub) : null,
      design,
    });
    return 0;
  }
  if (command === 'estimate') {
    const d = design ?? plan.designs.expanded;
    if (!d) throw new Error('the plan has no design to estimate');
    process.stdout.write(renderProjection(plan, d, Number(opts.get('reps') ?? d.reps)));
    return 0;
  }
  if (command === 'summarize' && positional[0]) {
    const out = path.resolve(positional[0]);
    const text = pilot && design ? summarizePilot(plan, design, readRuns(out)) : summarize(plan, readRuns(out), path.join(out, 'decisions.jsonl'), design);
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
  process.stderr.write(
    'usage: run [--design <name> [--pilot | --gate <pilot dir>]] [--models fable,sonnet] [--tasks question,fix] [--arms rules,none] [--reps N] [--cap-usd N] [--concurrency N] [--stub | --token-file <file>] [--out <dir>]\n       estimate [--design <name>] [--reps N]\n       summarize <dir> [--design <name> [--pilot]] [--to <dir>]\n',
  );
  return 2;
}

/** The cost projection of a design, as `estimate` prints it. */
export function renderProjection(plan: Plan, design: Design, reps = design.reps): string {
  const p = projection(plan, design, reps);
  const usd = (n: number, digits = 2): string => `$${n.toFixed(digits)}`;
  const lines = [
    `${p.rows.reduce((s, r) => s + r.runs, 0)} runs: ${reps} per arm and task, arms ${design.arms.join(' and ')}.`,
    '',
    '| Model | Task | Runs | Expected per run | Expected | Ceiling (every run at its budget) |',
    '| --- | --- | --- | --- | --- | --- |',
    // Below a cent, three decimals would round Haiku's costs to a single digit.
    ...p.rows.map((r) => `| ${r.model} | ${r.task} | ${r.runs} | ${usd(r.per_run, r.per_run < 0.01 ? 4 : 3)} | ${usd(r.expected)} | ${usd(r.ceiling)} |`),
  ];
  const byModel = Object.keys(design.cells).map((m) => {
    const rows = p.rows.filter((r) => r.model === m);
    return `| ${m} | ${rows.reduce((s, r) => s + r.runs, 0)} | ${usd(rows.reduce((s, r) => s + r.expected, 0))} |`;
  });
  lines.push('', '| Model | Runs | Expected |', '| --- | --- | --- |', ...byModel, '');
  lines.push(`Expected in total: ${usd(p.expected)}, at list price as Claude Code reports it. The cap is ${usd(design.cap_usd)}; the runs stop before passing it, leaving whole repetitions.`, '');
  if (design.pilot) {
    const q = projection(plan, design, design.pilot.reps, [design.pilot.arm]);
    lines.push(
      `Before it, the pilot runs ${q.rows.reduce((s, r) => s + r.runs, 0)} times: ${design.pilot.reps} runs of the arm ${design.pilot.arm} per model and task, expected ${usd(q.expected)}, within a cap of ${usd(design.pilot.cap_usd)}.`,
      `A cell enters the design only when at least ${design.pilot.min_incomplete} of its pilot runs left a part undone; each cell it keeps out lowers the design's expectation.`,
      `Expected for the pilot and the design together: ${usd(q.expected + p.expected)}; the two caps together: ${usd(design.pilot.cap_usd + design.cap_usd)}.`,
      '',
    );
  }
  return `${lines.join('\n')}\n`;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url))
  void main(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
