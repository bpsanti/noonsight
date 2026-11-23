// The adoption evaluation: fresh Claude Code sessions, given only a clean copy of this repository at
// a commit, are asked whether a team should adopt noonsight, and a judge scores each answer against
// a fixed reference (rubric.md) and the evidence map. README.md is the pre-registration.
//
//   npm run adoption -- run --before <ref> --after <ref> --out <dir> [--pilot] [--reps N] [--models a,b] [--conditions before,after] [--stub | --token-file <file>]
//   npm run adoption -- judge <dir> [--stub | --token-file <file>]
//   npm run adoption -- calibrate --after <ref> --out <dir> [--stub | --token-file <file>]
//   npm run adoption -- estimate <pilot dir>
//   npm run adoption -- summarize <dir>
//
// Every session runs in a sandbox: an empty home and Claude Code configuration directory, so no
// person's settings, hooks, CLAUDE.md or memory reach it; the repository copy is `git archive` of the
// commit, without this folder; and the session may only read (Read, Grep, Glob). With --stub, a local
// stand-in for the Messages API plays the calibration answers and their judgments, so the whole
// pipeline runs with no login and no tokens; with --token-file, the sessions spend from the account
// whose OAuth token the file holds, and the token is written nowhere.

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PACKAGE_ROOT } from '../../src/config/paths.js';
import { type Answer, type Body, serveMessages, type Stub } from '../delivery/stub.js';
import { readToken } from '../rules/run.js';
import { fisher, formatP, wilson } from '../rules/stats.js';

export const DIR = path.join(PACKAGE_ROOT, 'experiments', 'adoption');
const read = (f: string): string => fs.readFileSync(path.join(DIR, f), 'utf8');

export interface Plan {
  readonly models: Readonly<Record<string, string>>;
  readonly conditions: readonly string[];
  readonly effort: string;
  readonly tools: string;
  readonly budget_usd: Readonly<Record<string, number>>;
  readonly timeout_ms: number;
  readonly exclude: readonly string[];
  readonly reps: { readonly min: number; readonly max: number };
  readonly cap_usd: number;
  readonly concurrency: number;
  readonly judge: { readonly model: string; readonly effort: string; readonly budget_usd: number; readonly timeout_ms: number };
  readonly pass: { readonly grounded_after: number; readonly grounded_after_per_model: number };
}

export const plan = (): Plan => JSON.parse(read('plan.json')) as Plan;
export const PROMPT = (): string => read('prompt.md').trim();

interface CalibrationAnswer {
  readonly id: string;
  readonly text: string;
  readonly expected: Judgment & { readonly reasons: readonly Status[]; readonly grounded: boolean };
}
export const calibration = (): CalibrationAnswer[] => (JSON.parse(read('calibration.json')) as { answers: CalibrationAnswer[] }).answers;

// --- Scoring ---------------------------------------------------------------------------------

export const VERDICTS = ['adopt', 'adopt with conditions', 'do not adopt'] as const;
export type Verdict = (typeof VERDICTS)[number] | 'none';
type Status = 'true' | 'false' | 'unsupported';

export interface Judgment {
  readonly verdict: Verdict;
  readonly delivery_claim: 'correct' | 'partly' | 'wrong' | 'absent';
  readonly delivery_claim_why?: string;
  readonly reasons: readonly ({ readonly reason: string; readonly status: Status; readonly why?: string } | Status)[];
  readonly limits_named: readonly string[];
  readonly hallucinated_features: readonly string[];
  readonly false_claims: readonly string[];
}

export interface Score {
  readonly verdict: Verdict;
  readonly claim_correct: boolean;
  readonly no_false_reason: boolean;
  readonly no_hallucination: boolean;
  readonly names_a_limit: boolean;
  /** All four: the answer's verdict, whatever it is, rests on what the repository supports. */
  readonly grounded: boolean;
  /** A verdict to adopt, with or without conditions, that is not grounded. */
  readonly adopt_on_wrong_grounds: boolean;
}

const statusOf = (r: Judgment['reasons'][number]): Status => (typeof r === 'string' ? r : r.status);

/** The score of one judgment, as README.md ("Scoring") defines it. */
export function score(j: Judgment): Score {
  const claim_correct = j.delivery_claim === 'correct';
  const no_false_reason = j.reasons.every((r) => statusOf(r) !== 'false') && j.false_claims.length === 0;
  const no_hallucination = j.hallucinated_features.length === 0;
  const names_a_limit = j.limits_named.some((l) => /^L\d+$/.test(l));
  const grounded = claim_correct && no_false_reason && no_hallucination && names_a_limit;
  return { verdict: j.verdict, claim_correct, no_false_reason, no_hallucination, names_a_limit, grounded, adopt_on_wrong_grounds: (j.verdict === 'adopt' || j.verdict === 'adopt with conditions') && !grounded };
}

/**
 * The verdict an answer states on its "Verdict" line, or on the next line when that line holds only
 * the word, as under a heading; none when it states none of the three. The judge reads the verdict
 * again; this one is recorded with the run.
 */
export function parseVerdict(answer: string): Verdict {
  const lines = answer.split('\n');
  const at = lines.findIndex((l) => /^\W*verdict\b/i.test(l));
  if (at === -1) return 'none';
  const own = (lines[at] ?? '').replace(/^\W*verdict\W*/i, '');
  const line = (/adopt/i.test(own) ? own : (lines.slice(at + 1).find((l) => l.trim() !== '') ?? '')).toLowerCase();
  if (/do not adopt|don't adopt|not adopt/.test(line)) return 'do not adopt';
  if (/adopt with conditions|conditional/.test(line)) return 'adopt with conditions';
  if (/\badopt\b/.test(line)) return 'adopt';
  return 'none';
}

/** The last JSON object in a text: parsed from each `{`, keeping the last value that parses whole. */
export function lastJson(text: string): unknown {
  let found: unknown;
  for (let i = text.indexOf('{'); i !== -1; i = text.indexOf('{', i + 1)) {
    for (let j = text.lastIndexOf('}'); j > i; j = text.lastIndexOf('}', j - 1)) {
      try {
        found = JSON.parse(text.slice(i, j + 1));
        i = j;
        break;
      } catch {
        // Try a shorter span.
      }
    }
  }
  return found;
}

/** A judgment with every field the scoring reads, or null. */
export function asJudgment(value: unknown): Judgment | null {
  const v = value as Record<string, unknown> | null;
  if (!v || typeof v !== 'object') return null;
  const lists = ['reasons', 'limits_named', 'hallucinated_features', 'false_claims'] as const;
  if (!lists.every((k) => Array.isArray(v[k]))) return null;
  if (![...VERDICTS, 'none'].includes(v.verdict as string)) return null;
  if (!['correct', 'partly', 'wrong', 'absent'].includes(v.delivery_claim as string)) return null;
  return v as unknown as Judgment;
}

// --- The sandbox -------------------------------------------------------------------------------

/** The Markdown files of a copy of the repository that mention this evaluation, which a session must not read. */
export function evaluationMentions(dir: string): string[] {
  return fs
    .readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.md') && /adoption/i.test(fs.readFileSync(path.join(dir, f), 'utf8')))
    .sort();
}

/** Prepares a copy of each commit and refuses any whose Markdown mentions this evaluation, before a session is paid for. */
function checkTrees(refs: readonly string[], exclude: readonly string[]): void {
  for (const ref of refs) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-'));
    try {
      prepareTree(ref, dir, exclude);
      const files = evaluationMentions(dir);
      if (files.length) throw new Error(`${ref}: ${files.join(', ')} mention the adoption evaluation, so a session could read its results; run on a commit where they do not (experiments/adoption/README.md)`);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
}

/** A clean copy of the repository at a commit, without the excluded paths; returns the commit and its tree. */
export function prepareTree(ref: string, dest: string, exclude: readonly string[]): { commit: string; tree: string } {
  const git = (...args: string[]): string => {
    const r = spawnSync('git', ['-C', PACKAGE_ROOT, ...args], { encoding: 'utf8', maxBuffer: 1 << 30 });
    if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
    return r.stdout.trim();
  };
  const commit = git('rev-parse', '--verify', `${ref}^{commit}`);
  fs.mkdirSync(dest, { recursive: true });
  const archive = spawnSync('sh', ['-c', `git -C "${PACKAGE_ROOT}" archive "${commit}" | tar -x -C "${dest}"`], { encoding: 'utf8' });
  if (archive.status !== 0) throw new Error(`git archive ${commit}: ${archive.stderr}`);
  for (const p of exclude) fs.rmSync(path.join(dest, p), { recursive: true, force: true });
  return { commit, tree: git('rev-parse', `${commit}^{tree}`) };
}

/** The environment of one session: an empty home and configuration directory, and either the stub or a token. */
export function sandboxEnv(root: string, api: { url: string } | null, token: string | null): Record<string, string> {
  const home = path.join(root, 'home');
  const config = path.join(root, 'claude');
  for (const d of [home, config]) fs.mkdirSync(d, { recursive: true });
  const env: Record<string, string> = {
    PATH: process.env.PATH ?? '',
    HOME: home,
    CLAUDE_CONFIG_DIR: config,
    LANG: 'en_US.UTF-8',
    TERM: 'xterm-256color',
    DISABLE_AUTOUPDATER: '1',
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    // No noonsight install reaches the sandbox, but a machine-wide one would: keep it out.
    NOONSIGHT_DISABLE: '1',
  };
  if (api) Object.assign(env, { ANTHROPIC_BASE_URL: api.url, CLAUDE_CODE_OAUTH_TOKEN: 'noonsight-adoption-stub' });
  else if (token) env.CLAUDE_CODE_OAUTH_TOKEN = token;
  return env;
}

interface Outcome {
  readonly status: number | null;
  readonly stdout: string;
}

function spawnClaude(args: readonly string[], cwd: string, env: Record<string, string>, timeoutMs: number): Promise<Outcome> {
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

const events = (stdout: string): Record<string, any>[] =>
  stdout
    .split('\n')
    .filter((l) => l.startsWith('{'))
    .flatMap((l) => {
      try {
        return [JSON.parse(l) as Record<string, any>];
      } catch {
        return [];
      }
    });

// --- The stub ----------------------------------------------------------------------------------

/** The stub's session: read the README, then answer with one calibration answer. */
function stubSession(tree: string, answer: string): (body: Body) => Answer {
  return (body) => {
    const text = (t: string): Answer => ({ content: [{ type: 'text', text: t }], stop: 'end_turn', usage: { input_tokens: Math.ceil(JSON.stringify(body).length / 4), output_tokens: Math.ceil(t.length / 4) } });
    if (!Array.isArray(body.tools) || body.tools.length === 0) return text('ok');
    const turn = ((body.messages ?? []) as Body[]).filter((m) => m.role === 'assistant').length;
    if (turn === 0) return { content: [{ type: 'tool_use', id: `toolu_adopt_${process.pid}_${Date.now().toString(36)}`, name: 'Read', input: { file_path: path.join(tree, 'README.md') } }], stop: 'tool_use', usage: { input_tokens: 1000, output_tokens: 20 } };
    return text(answer);
  };
}

/** The stub's judge: the expected judgment of the calibration answer the request holds, or no JSON. */
function stubJudge(body: Body): Answer {
  const request = JSON.stringify(body.messages ?? []);
  const known = calibration().find((c) => request.includes(JSON.stringify(c.text).slice(1, 80)));
  const e = known?.expected;
  const judgment = e ? { ...e, reasons: e.reasons.map((s, i) => ({ reason: `reason ${i + 1}`, status: s, why: 'stub' })), delivery_claim_why: 'stub' } : null;
  const t = judgment ? `Scored.\n${JSON.stringify(judgment)}` : 'I cannot score this answer.';
  return { content: [{ type: 'text', text: t }], stop: 'end_turn', usage: { input_tokens: Math.ceil(request.length / 4), output_tokens: Math.ceil(t.length / 4) } };
}

// --- Sessions ----------------------------------------------------------------------------------

export interface Cell {
  readonly condition: string;
  readonly model: string;
  readonly rep: number;
}
export const cellKey = (c: Cell): string => `${c.condition}-${c.model}-${c.rep}`;

export interface RunRecord extends Cell {
  readonly api: 'anthropic' | 'stub';
  readonly ref: string;
  readonly commit: string;
  readonly tree: string;
  readonly model_id: string;
  readonly effort: string;
  readonly claude_code: string;
  readonly started: string;
  readonly outcome: string;
  readonly cost_usd: number;
  readonly turns: number;
  readonly duration_ms: number;
  readonly tool_calls: Readonly<Record<string, number>>;
  /** The repository files the session read, relative to the repository, in the order first read. */
  readonly files_read: readonly string[];
  readonly verdict: Verdict;
  /** The answer, with the sandbox's paths replaced by <repo>, also in answers/<cell>.md. */
  readonly answer: string;
}

/** One session of one cell: a fresh sandbox and copy of the repository, one `claude -p`, its answer. */
async function runSession(p: Plan, cell: Cell, ref: string, out: string, stub: boolean, token: string | null, version: string): Promise<RunRecord> {
  // A name that says nothing of the experiment, the condition or the model: the session sees its working directory.
  // The real path, which is the one the session reports (on macOS the temporary directory is a link).
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cc-')));
  try {
    const repo = path.join(root, 'noonsight');
    const { commit, tree } = prepareTree(ref, repo, p.exclude);
    const answers = calibration();
    const api: Stub | null = stub ? await serveMessages(stubSession(repo, (answers[(cell.rep - 1) % answers.length] as CalibrationAnswer).text)) : null;
    const modelId = p.models[cell.model] as string;
    const args = [
      '-p', PROMPT(),
      '--output-format', 'stream-json', '--verbose',
      '--model', modelId, '--effort', p.effort, '--max-budget-usd', String(p.budget_usd[cell.model]),
      '--permission-mode', 'default', '--setting-sources', 'project,local',
      '--strict-mcp-config', '--disable-slash-commands', '--no-session-persistence',
      '--tools', p.tools, '--allowedTools', p.tools,
    ];
    const started = new Date().toISOString();
    const t0 = Date.now();
    const { stdout } = await spawnClaude(args, repo, sandboxEnv(root, api, token), p.timeout_ms).finally(() => api?.close());
    const stream = events(stdout);
    fs.mkdirSync(path.join(out, 'streams'), { recursive: true });
    fs.writeFileSync(path.join(out, 'streams', `${cellKey(cell)}.jsonl`), stdout.split(repo).join('<repo>').split(root).join('<sandbox>'));
    const result = stream.filter((e) => e.type === 'result').at(-1) ?? {};
    const uses = stream.flatMap((e) => (e.type === 'assistant' ? ((e.message?.content ?? []) as Record<string, any>[]) : [])).filter((b) => b.type === 'tool_use');
    const tool_calls: Record<string, number> = {};
    const files_read: string[] = [];
    for (const u of uses) {
      tool_calls[u.name] = (tool_calls[u.name] ?? 0) + 1;
      const f = u.name === 'Read' && typeof u.input?.file_path === 'string' ? path.relative(repo, path.resolve(repo, u.input.file_path)) : null;
      if (f && !files_read.includes(f)) files_read.push(f);
    }
    const answer = String(result.result ?? '').split(repo).join('<repo>').split(root).join('<sandbox>');
    const ok = result.subtype === 'success' && !result.is_error && answer.trim() !== '';
    fs.mkdirSync(path.join(out, 'answers'), { recursive: true });
    fs.writeFileSync(path.join(out, 'answers', `${cellKey(cell)}.md`), `${answer}\n`);
    return {
      ...cell,
      api: stub ? 'stub' : 'anthropic',
      ref,
      commit,
      tree,
      model_id: modelId,
      effort: p.effort,
      claude_code: version,
      started,
      outcome: ok ? 'answered' : String(result.subtype ?? 'no-result'),
      cost_usd: Number(result.total_cost_usd ?? 0),
      turns: Number(result.num_turns ?? 0),
      duration_ms: Date.now() - t0,
      tool_calls,
      files_read,
      verdict: parseVerdict(answer),
      answer,
    };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

export const readJsonl = <T>(file: string): T[] =>
  fs.existsSync(file)
    ? fs
        .readFileSync(file, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l) as T)
    : [];

const log = (s: string): void => {
  process.stderr.write(`${new Date().toISOString().slice(11, 19)} ${s}\n`);
};

/**
 * Run every cell not yet recorded, at most `concurrency` at once. A session starts only while the
 * money spent, plus the budgets of the sessions in flight, plus its own budget stays within the cap.
 */
async function runAll(p: Plan, cells: readonly Cell[], refs: Readonly<Record<string, string>>, out: string, stub: boolean, token: string | null, cap: number): Promise<void> {
  fs.mkdirSync(out, { recursive: true });
  const file = path.join(out, 'runs.jsonl');
  const previous = readJsonl<RunRecord>(file);
  const api = stub ? 'stub' : 'anthropic';
  if (previous.some((r) => r.api !== api)) throw new Error(`${out} holds runs against another API; use another --out`);
  const done = new Set(previous.filter((r) => r.outcome === 'answered').map(cellKey));
  const queue = cells.filter((c) => !done.has(cellKey(c)));
  const version = spawnSync('claude', ['--version'], { encoding: 'utf8' }).stdout.trim().split(' ')[0] ?? 'unknown';
  let spent = previous.reduce((s, r) => s + r.cost_usd, 0);
  let reserved = 0;
  let stopped = false;
  checkTrees([...new Set(queue.map((c) => refs[c.condition] as string))], p.exclude);
  log(`${queue.length} sessions to run, $${spent.toFixed(2)} already spent, cap $${cap}`);
  const worker = async (): Promise<void> => {
    while (!stopped) {
      const cell = queue.shift();
      if (!cell) return;
      const budget = p.budget_usd[cell.model] ?? 1;
      if (spent + reserved + budget > cap) {
        stopped = true;
        log(`stop: ${cellKey(cell)} could cost $${budget} more than the cap allows ($${spent.toFixed(2)} spent, $${reserved.toFixed(2)} in flight)`);
        return;
      }
      reserved += budget;
      try {
        const r = await runSession(p, cell, refs[cell.condition] as string, out, stub, token, version);
        spent += r.cost_usd;
        fs.appendFileSync(file, `${JSON.stringify(r)}\n`);
        log(`${r.outcome.padEnd(8)} ${cellKey(cell)} ${r.verdict} $${r.cost_usd.toFixed(3)} ${r.turns} turns; spent $${spent.toFixed(2)}`);
      } catch (e) {
        log(`fail ${cellKey(cell)}: ${(e as Error).message}`);
      } finally {
        reserved -= budget;
      }
    }
  };
  await Promise.all(Array.from({ length: p.concurrency }, worker));
  log(`finished: $${spent.toFixed(2)} spent`);
}

// --- The judge ---------------------------------------------------------------------------------

export interface JudgeRecord {
  readonly key: string;
  readonly api: 'anthropic' | 'stub';
  readonly judge: string;
  readonly cost_usd: number;
  readonly attempts: number;
  readonly judgment: Judgment | null;
  readonly score: Score | null;
}

/** The judge's prompt for one answer: its instructions, the reference, the evidence map, the answer. */
export function judgePrompt(answer: string, evidence: string): string {
  return [read('judge.md').trim(), '# Reference', read('rubric.md').trim(), '# Evidence map (docs/evidence.md)', evidence.trim(), '# The answer', '<answer>', answer.trim(), '</answer>'].join('\n\n');
}

async function judgeOne(p: Plan, key: string, answer: string, evidence: string, stub: boolean, token: string | null): Promise<JudgeRecord> {
  let cost = 0;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-'));
    const api = stub ? await serveMessages(stubJudge) : null;
    try {
      const args = ['-p', '--output-format', 'json', '--model', p.judge.model, '--effort', p.judge.effort, '--max-budget-usd', String(p.judge.budget_usd), '--setting-sources', 'project,local', '--strict-mcp-config', '--disable-slash-commands', '--no-session-persistence', '--tools', ''];
      const env = sandboxEnv(root, api, token);
      const r = await new Promise<Outcome>((resolve) => {
        const child = spawn('claude', args, { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
        let stdout = '';
        child.stdout.setEncoding('utf8').on('data', (d: string) => (stdout += d));
        child.stderr.resume();
        const timer = setTimeout(() => child.kill('SIGTERM'), p.judge.timeout_ms);
        child.on('close', (status) => {
          clearTimeout(timer);
          resolve({ status, stdout });
        });
        child.stdin.end(judgePrompt(answer, evidence));
      });
      const result = (lastJson(r.stdout) ?? {}) as Record<string, any>;
      cost += Number(result.total_cost_usd ?? 0);
      const judgment = asJudgment(lastJson(String(result.result ?? '')));
      if (judgment) return { key, api: stub ? 'stub' : 'anthropic', judge: p.judge.model, cost_usd: cost, attempts: attempt, judgment, score: score(judgment) };
    } finally {
      await api?.close();
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
  return { key, api: stub ? 'stub' : 'anthropic', judge: p.judge.model, cost_usd: cost, attempts: 2, judgment: null, score: null };
}

/** Judge every answered run of a results folder not yet judged, against the evidence map of the `after` commit. */
async function judgeAll(p: Plan, out: string, stub: boolean, token: string | null): Promise<void> {
  const runs = readJsonl<RunRecord>(path.join(out, 'runs.jsonl')).filter((r) => r.outcome === 'answered');
  const file = path.join(out, 'judgments.jsonl');
  const judged = new Set(readJsonl<JudgeRecord>(file).filter((j) => j.judgment).map((j) => j.key));
  const after = runs.find((r) => r.condition === 'after')?.commit ?? runs[0]?.commit;
  if (!after) throw new Error(`${out} has no answered run`);
  const evidence = gitShow(after, 'docs/evidence.md');
  const queue = runs.filter((r) => !judged.has(cellKey(r)));
  const worker = async (): Promise<void> => {
    for (let r = queue.shift(); r; r = queue.shift()) {
      const j = await judgeOne(p, cellKey(r), r.answer, evidence, stub, token);
      fs.appendFileSync(file, `${JSON.stringify(j)}\n`);
      log(`judged ${j.key}: ${j.score ? (j.score.grounded ? 'grounded' : 'not grounded') : 'no judgment'} $${j.cost_usd.toFixed(3)}`);
    }
  };
  await Promise.all(Array.from({ length: p.concurrency }, worker));
}

function gitShow(commit: string, file: string): string {
  const r = spawnSync('git', ['-C', PACKAGE_ROOT, 'show', `${commit}:${file}`], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${file} is not in ${commit}`);
  return r.stdout;
}

/** The judge on the calibration answers; it must reach the expected `grounded` on every one. */
async function calibrate(p: Plan, after: string, out: string, stub: boolean, token: string | null): Promise<boolean> {
  const evidence = gitShow(spawnSync('git', ['-C', PACKAGE_ROOT, 'rev-parse', after], { encoding: 'utf8' }).stdout.trim(), 'docs/evidence.md');
  fs.mkdirSync(out, { recursive: true });
  const rows: Record<string, unknown>[] = [];
  let all = true;
  for (const c of calibration()) {
    const j = await judgeOne(p, c.id, c.text, evidence, stub, token);
    const agrees = j.score?.grounded === c.expected.grounded;
    all &&= agrees;
    rows.push({ id: c.id, expected_grounded: c.expected.grounded, judged_grounded: j.score?.grounded ?? null, agrees, cost_usd: j.cost_usd, judgment: j.judgment });
    log(`calibration ${c.id}: expected ${c.expected.grounded}, judged ${j.score?.grounded ?? 'nothing'}${agrees ? '' : '  DISAGREES'}`);
  }
  fs.writeFileSync(path.join(out, 'calibration.json'), `${JSON.stringify({ api: stub ? 'stub' : 'anthropic', judge: p.judge.model, agrees: all, answers: rows }, null, 1)}\n`);
  return all;
}

// --- Estimate and summary ----------------------------------------------------------------------

/**
 * The repetitions the pilot's measured costs allow, by the rule README.md fixes: the most, from
 * `reps.max` down to `reps.min`, for which the pilot, the rest of the sessions, their judgments and
 * the calibration fit in the cap; Fable is left out first if none fits with it.
 */
export function allocate(p: Plan, pilot: readonly { model: string; cost_usd: number }[], judgeCost: number, calibrationCost: number): { reps: number; models: string[]; projected: number } | null {
  const spent = pilot.reduce((s, r) => s + r.cost_usd, 0);
  const meanOf = (m: string): number => {
    const xs = pilot.filter((r) => r.model === m).map((r) => r.cost_usd);
    return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : (p.budget_usd[m] ?? 1);
  };
  for (const models of [Object.keys(p.models), Object.keys(p.models).filter((m) => m !== 'fable')]) {
    for (let reps = p.reps.max; reps >= p.reps.min; reps--) {
      const more = models.reduce((s, m) => s + p.conditions.length * Math.max(0, reps - 1) * meanOf(m), 0);
      const sessions = models.length * p.conditions.length * reps;
      const projected = spent + more + sessions * judgeCost + calibrationCost;
      if (projected <= p.cap_usd) return { reps, models, projected };
    }
  }
  return null;
}

const pct = (k: number, n: number): string => (n === 0 ? 'none' : `${k} of ${n} (${Math.round((100 * k) / n)}%)`);
const interval = (k: number, n: number): string => {
  if (n === 0) return '';
  const [lo, hi] = wilson(k, n);
  return `${Math.round(lo * 100)}-${Math.round(hi * 100)}%`;
};

/** The summary of a results folder, as README.md ("Pass bar") reads it. */
export function summarize(p: Plan, runs: readonly RunRecord[], judgments: readonly JudgeRecord[]): string {
  const byKey = new Map(judgments.filter((j) => j.score).map((j) => [j.key, j]));
  const scored = runs.filter((r) => r.outcome === 'answered' && byKey.has(cellKey(r))).map((r) => ({ r, s: byKey.get(cellKey(r))?.score as Score }));
  const lines: string[] = ['# Adoption evaluation: summary', ''];
  const commits = [...new Set(runs.map((r) => `${r.condition} ${r.commit.slice(0, 7)}`))].sort();
  lines.push(`Runs: ${runs.length} (${runs.filter((r) => r.outcome === 'answered').length} answered), judged: ${scored.length}; API: ${[...new Set(runs.map((r) => r.api))].join(', ')}; Claude Code ${[...new Set(runs.map((r) => r.claude_code))].join(', ')}; commits: ${commits.join(', ')}.`);
  lines.push(`Cost: sessions $${runs.reduce((s, r) => s + r.cost_usd, 0).toFixed(2)}, judgments $${judgments.reduce((s, j) => s + j.cost_usd, 0).toFixed(2)}.`, '');
  lines.push('| Condition | Model | Answers | Adopt | With conditions | Do not adopt | Claim correct | No false reason | No invented feature | Names a limit | Grounded | Adopt on wrong grounds |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  const row = (cond: string, model: string, xs: typeof scored): string => {
    const n = xs.length;
    const k = (f: (s: Score) => boolean): number => xs.filter((x) => f(x.s)).length;
    return `| ${cond} | ${model} | ${n} | ${k((s) => s.verdict === 'adopt')} | ${k((s) => s.verdict === 'adopt with conditions')} | ${k((s) => s.verdict === 'do not adopt')} | ${pct(k((s) => s.claim_correct), n)} | ${pct(k((s) => s.no_false_reason), n)} | ${pct(k((s) => s.no_hallucination), n)} | ${pct(k((s) => s.names_a_limit), n)} | ${pct(k((s) => s.grounded), n)} | ${pct(k((s) => s.adopt_on_wrong_grounds), n)} |`;
  };
  for (const cond of p.conditions) {
    for (const model of Object.keys(p.models)) {
      const xs = scored.filter((x) => x.r.condition === cond && x.r.model === model);
      if (xs.length) lines.push(row(cond, model, xs));
    }
    lines.push(row(cond, '**all**', scored.filter((x) => x.r.condition === cond)));
  }
  lines.push('');
  const g = (cond: string): [number, number] => {
    const xs = scored.filter((x) => x.r.condition === cond);
    return [xs.filter((x) => x.s.grounded).length, xs.length];
  };
  const [ka, na] = g('after');
  const [kb, nb] = g('before');
  if (na && nb) lines.push(`Grounded, after against before: ${pct(ka, na)} (${interval(ka, na)}) against ${pct(kb, nb)} (${interval(kb, nb)}); Fisher's exact test, two-sided, p ${formatP(fisher(ka, na, kb, nb))}.`, '');
  lines.push('## Pass bar', '');
  const perModel = Object.keys(p.models).map((m) => {
    const xs = scored.filter((x) => x.r.condition === 'after' && x.r.model === m);
    return { m, k: xs.filter((x) => x.s.grounded).length, n: xs.length };
  });
  const overall = na > 0 && ka / na >= p.pass.grounded_after;
  const each = perModel.filter((x) => x.n > 0).every((x) => x.k / x.n >= p.pass.grounded_after_per_model);
  const notWorse = !(na && nb) || ka / na >= kb / nb;
  lines.push(`- Grounded answers after, overall, at least ${p.pass.grounded_after * 100}%: ${overall ? 'met' : 'not met'} (${pct(ka, na)}).`);
  lines.push(`- Grounded answers after, for each model, at least ${p.pass.grounded_after_per_model * 100}%: ${each ? 'met' : 'not met'} (${perModel.filter((x) => x.n).map((x) => `${x.m} ${x.k} of ${x.n}`).join(', ')}).`);
  lines.push(`- Grounded answers after at least as often as before: ${notWorse ? 'met' : 'not met'}.`);
  lines.push(`- **The README passes: ${overall && each && notWorse ? 'yes' : 'no'}.**`, '');
  return `${lines.join('\n')}\n`;
}

// --- Command line ------------------------------------------------------------------------------

async function main(argv: readonly string[]): Promise<number> {
  const [command, ...rest] = argv;
  const opts = new Map<string, string>();
  const positional: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i] as string;
    if (!a.startsWith('--')) positional.push(a);
    else if (a === '--stub' || a === '--pilot') opts.set(a.slice(2), '1');
    else opts.set(a.slice(2), rest[++i] ?? '');
  }
  const p = plan();
  const stub = opts.has('stub');
  const token = opts.has('token-file') ? readToken(opts.get('token-file') ?? '', stub) : null;
  if (!stub && !token && command !== 'estimate' && command !== 'summarize') throw new Error('give --stub, or --token-file with the OAuth token of the account the sessions spend from');
  const list = (v: string | undefined, all: readonly string[]): string[] => (v ? v.split(',').filter((x) => all.includes(x)) : [...all]);
  switch (command) {
    case 'run': {
      const out = opts.get('out');
      const before = opts.get('before');
      const after = opts.get('after');
      if (!out || !before || !after) throw new Error('run needs --out, --before and --after');
      const reps = opts.has('pilot') ? 1 : Number(opts.get('reps') ?? p.reps.max);
      const cells: Cell[] = [];
      for (let rep = 1; rep <= reps; rep++)
        for (const model of list(opts.get('models'), Object.keys(p.models))) for (const condition of list(opts.get('conditions'), p.conditions)) cells.push({ condition, model, rep });
      await runAll(p, cells, { before, after }, out, stub, token, Number(opts.get('cap-usd') ?? p.cap_usd));
      return 0;
    }
    case 'judge':
      await judgeAll(p, positional[0] ?? '', stub, token);
      fs.writeFileSync(path.join(positional[0] ?? '', 'summary.md'), summarize(p, readJsonl(path.join(positional[0] ?? '', 'runs.jsonl')), readJsonl(path.join(positional[0] ?? '', 'judgments.jsonl'))));
      return 0;
    case 'calibrate': {
      const out = opts.get('out');
      const after = opts.get('after');
      if (!out || !after) throw new Error('calibrate needs --out and --after');
      return (await calibrate(p, after, out, stub, token)) ? 0 : 1;
    }
    case 'estimate': {
      const dir = positional[0] ?? '';
      const runs = readJsonl<RunRecord>(path.join(dir, 'runs.jsonl'));
      const judgments = readJsonl<JudgeRecord>(path.join(dir, 'judgments.jsonl'));
      const cal = fs.existsSync(path.join(dir, 'calibration.json')) ? (JSON.parse(fs.readFileSync(path.join(dir, 'calibration.json'), 'utf8')).answers as { cost_usd: number }[]) : [];
      const judgeCost = judgments.length ? judgments.reduce((s, j) => s + j.cost_usd, 0) / judgments.length : p.judge.budget_usd;
      const a = allocate(p, runs, judgeCost, cal.reduce((s, c) => s + c.cost_usd, 0));
      for (const m of Object.keys(p.models)) {
        const xs = runs.filter((r) => r.model === m);
        if (xs.length) process.stdout.write(`${m}: ${xs.length} pilot sessions, $${(xs.reduce((s, r) => s + r.cost_usd, 0) / xs.length).toFixed(3)} each on average\n`);
      }
      process.stdout.write(`judge: $${judgeCost.toFixed(3)} per answer\n`);
      process.stdout.write(a ? `allocation: ${a.reps} sessions per model and condition, models ${a.models.join(', ')}; projected total $${a.projected.toFixed(2)} against a cap of $${p.cap_usd}\n` : `no allocation fits the cap of $${p.cap_usd}\n`);
      return a ? 0 : 1;
    }
    case 'summarize': {
      const dir = positional[0] ?? '';
      process.stdout.write(summarize(p, readJsonl(path.join(dir, 'runs.jsonl')), readJsonl(path.join(dir, 'judgments.jsonl'))));
      return 0;
    }
    default:
      process.stderr.write('usage: run | judge <dir> | calibrate | estimate <dir> | summarize <dir>; see the comment at the top of experiments/adoption/run.ts\n');
      return 2;
  }
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url))
  void main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (e: unknown) => {
      process.stderr.write(`${(e as Error).message}\n`);
      process.exitCode = 2;
    },
  );
