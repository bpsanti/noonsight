// The delivery benchmark's command line. Every command runs real Claude Code sessions against the local
// stub, or reads their results; none sends anything to Anthropic or spends a token.
//
//   npm run delivery -- corpus     [--only <name,...>] [--concurrency 4]
//   npm run delivery -- fuzz       [--arm on|claudemd|rules|skills|off] [--n 300] [--seed 1] [--from 0] [--concurrency 6] [--fresh]
//   npm run delivery -- selfcheck  [--plant <name>|all] [--n 60] [--seed 1] [--concurrency 6]
//   npm run delivery -- shrink     --sessions <file> --id <session> [--class <class> --kind main|subagent] [--plant <name>]
//   npm run delivery -- measure    the four measures of every sessions/*.jsonl in the results folder
//   npm run delivery -- agree      the decision log against the stub, on the `on` sessions of the results folder
//   npm run delivery -- hooktime   [--runs 40]
//   npm run delivery -- log        [--file <decisions.jsonl>]   aggregates of a real decision log, printed only
//   npm run delivery -- all        corpus, fuzz under `on` and under each native arm, selfcheck, measure, agree, hooktime
//
// Common options: --claude <binary> (default `claude`), --results <dir> (default
// results/claude-code-<version>/<date>-<commit>/), --work <dir> (default a new folder in the system's
// temporary directory, which must not be inside a Claude Code scratchpad folder). A fuzz run continues the
// sessions file an interrupted run of the same arm, seed and size left, unless --fresh.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readSettings } from '../../src/adapters/claude-code/install.js';
import { managedTarget } from '../../src/adapters/claude-code/locations.js';
import { findNoonsightHandlers } from '../../src/adapters/claude-code/settings.js';
import { PACKAGE_ROOT, stateDir } from '../../src/config/paths.js';
import { check, readCorpus, type Checked } from './corpus.js';
import { failed, fuzzRuns, readLines, runMany, sessionKey, signature, violationsOf, type Line } from './fuzz.js';
import { hasQuietPair, type Sequence } from './generate.js';
import { hookTime } from './hooktime.js';
import { agree, aggregate, readLog, replay, ruleLibrary } from './log-measure.js';
import { measure, renderMarkdown, type Measures } from './measure.js';
import { ARMS, loadReference, type Arm } from './oracle.js';
import { buildPlant, comparePlant, plantNamed, PLANTS } from './plants.js';
import { claudeVersion, runSession, type Run, type RunOptions } from './session.js';
import { shrink, type Target } from './shrink.js';

type Args = Record<string, string | true>;

function parse(argv: readonly string[]): { command: string; args: Args } {
  const args: Args = {};
  const [command = 'help', ...rest] = argv;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i] as string;
    if (!a.startsWith('--')) throw new Error(`unexpected argument ${a}`);
    const next = rest[i + 1];
    args[a.slice(2)] = next === undefined || next.startsWith('--') ? true : (i++, next);
  }
  return { command, args };
}

const str = (args: Args, k: string, fallback: string): string => (typeof args[k] === 'string' ? (args[k] as string) : fallback);
const num = (args: Args, k: string, fallback: number): number => {
  const n = Number(str(args, k, String(fallback)));
  if (!Number.isInteger(n) || n < 0) throw new Error(`--${k} takes a whole number`);
  return n;
};

/** The commit this checkout is at, with `-dirty` when anything outside the results has changed; `unknown` outside a git checkout of its own. */
function commit(): string {
  const git = (...a: string[]): string => spawnSync('git', ['-C', PACKAGE_ROOT, ...a], { encoding: 'utf8' }).stdout.trim();
  const top = git('rev-parse', '--show-toplevel');
  if (!top || fs.realpathSync(top) !== fs.realpathSync(PACKAGE_ROOT)) return 'unknown';
  const head = git('rev-parse', '--short', 'HEAD') || 'unknown';
  return git('status', '--porcelain', '--', '.', ':!experiments/delivery/results') ? `${head}-dirty` : head;
}

/** Nothing installed machine-wide would run noonsight's hooks in the benchmark sessions a second time. */
function preconditions(claude: string): void {
  for (const [tool, a] of [
    [claude, ['--version']],
    ['python3', ['--version']],
    ['git', ['--version']],
  ] as const)
    if (spawnSync(tool, [...a]).status !== 0) throw new Error(`${tool} does not run here`);
  let managed = null;
  try {
    managed = managedTarget(process.env);
  } catch {
    // An unsupported system has no machine-wide install.
  }
  if (managed !== null && fs.existsSync(managed.settingsFile) && findNoonsightHandlers(readSettings(managed.settingsFile)).length)
    throw new Error(`noonsight is installed machine-wide (${managed.settingsFile}); its hooks would run in the benchmark sessions too`);
}

interface Context {
  readonly args: Args;
  readonly results: string;
  readonly work: string;
  readonly opts: RunOptions;
}

function context(args: Args): Context {
  const claude = str(args, 'claude', 'claude');
  preconditions(claude);
  const version = claudeVersion(claude);
  const results = path.resolve(str(args, 'results', path.join(PACKAGE_ROOT, 'experiments', 'delivery', 'results', `claude-code-${version}`, `${new Date().toISOString().slice(0, 10)}-${commit()}`)));
  const work = path.resolve(str(args, 'work', fs.mkdtempSync(path.join(os.tmpdir(), 'noonsight-delivery-'))));
  fs.mkdirSync(path.join(results, 'sessions'), { recursive: true });
  fs.mkdirSync(work, { recursive: true });
  const ref = loadReference(work);
  const meta = path.join(results, 'run.json');
  // The folder's commit is the first command's; each command records its own.
  const prior = fs.existsSync(meta) ? (JSON.parse(fs.readFileSync(meta, 'utf8')) as { commit?: string; commands?: unknown[] }) : {};
  fs.writeFileSync(
    meta,
    `${JSON.stringify({ claudeCode: version, commit: prior.commit ?? commit(), preset: ref.presetVersion, node: process.version, platform: `${process.platform}-${process.arch}`, commands: prior.commands ?? [] }, null, 1)}\n`,
  );
  process.stderr.write(`Claude Code ${version}; results in ${results}; sessions in ${work}\n`);
  return { args, results, work, opts: { ref, workRoot: work, claude, claudeCode: version, noonsightRoot: PACKAGE_ROOT } };
}

/** Record a command in run.json, with how long it took. */
function logCommand(ctx: Context, command: string, started: number): void {
  const meta = path.join(ctx.results, 'run.json');
  const m = JSON.parse(fs.readFileSync(meta, 'utf8')) as { commands: unknown[] };
  // The options that name a path of this machine are left out.
  const args = Object.fromEntries(Object.entries(ctx.args).filter(([k]) => !['results', 'work', 'claude', 'sessions'].includes(k)));
  m.commands.push({ command, args, commit: commit(), at: new Date(started).toISOString(), seconds: Math.round((Date.now() - started) / 1000) });
  fs.writeFileSync(meta, `${JSON.stringify(m, null, 1)}\n`);
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 1)}\n`);
}

function sessionsFile(ctx: Context, name: string): string {
  return path.join(ctx.results, 'sessions', `${name}.jsonl`);
}

async function corpus(ctx: Context): Promise<Checked[]> {
  const only = typeof ctx.args.only === 'string' ? new Set(ctx.args.only.split(',')) : null;
  const entries = readCorpus().filter((e) => !only || only.has(e.name));
  const runs: Run[] = entries.map((e) => ({ id: `corpus-${e.name}`, arm: 'on', plant: null, model: e.model, scope: e.scope, unattended: e.unattended, steps: e.steps }));
  const lines = await runMany(runs, ctx.opts, num(ctx.args, 'concurrency', 4), null);
  const checked = entries.map((e) => check(e, lines.find((l) => l.id === `corpus-${e.name}`) as Line));
  writeJson(path.join(ctx.results, 'corpus.json'), checked);
  for (const c of checked) process.stdout.write(`${c.outcome === 'as-expected' ? 'ok  ' : 'FAIL'} ${c.name}: ${c.outcome}${c.shows.length ? ` (${c.shows.join(', ')})` : ''}${c.harness !== 'ok' ? ` [${c.harness}]` : ''}\n`);
  return checked;
}

async function fuzz(ctx: Context, arm: Arm, n: number, plant: string | null = null): Promise<{ file: string; lines: Line[] }> {
  const seed = num(ctx.args, 'seed', 1);
  const from = num(ctx.args, 'from', 0);
  const name = `${plant ? `plant-${plant}` : arm}-s${seed}-${from ? `${from}-` : ''}n${n}`;
  const file = sessionsFile(ctx, name);
  // A sessions file left by an interrupted run is continued: the sessions it holds are not run again.
  const done = fs.existsSync(file) && !ctx.args.fresh ? readLines(file) : [];
  if (!done.length) fs.writeFileSync(file, '');
  const have = new Set(done.map((l) => l.id));
  const opts = plant ? { ...ctx.opts, noonsightRoot: buildPlant(plantNamed(plant), path.join(ctx.work, `plant-${plant}-build`)) } : ctx.opts;
  const runs = fuzzRuns(seed, n, arm, plant, from);
  const lines = [...done, ...(await runMany(runs.filter((r) => !have.has(r.id)), opts, num(ctx.args, 'concurrency', 6), file))].sort((a, b) => a.id.localeCompare(b.id));
  const ok = lines.filter((l) => l.harness === 'ok');
  process.stdout.write(`${name}: ${ok.length} of ${lines.length} sessions ran; ${ok.filter(failed).length} with an unexplained violation\n`);
  return { file, lines };
}

/** A target to shrink toward: the first unexplained violation of the session, or the one asked for. */
function targetOf(line: Line, cls?: string, kind?: string): Target {
  const v = line.violations.find((x) => !x.known && (!cls || x.class === cls) && (!kind || x.kind === kind));
  if (!v || (v.kind !== 'main' && v.kind !== 'subagent')) throw new Error(`${line.id} has no such violation`);
  return { class: v.class, kind: v.kind };
}

/** Whether a sequence, run once as a real session with `opts`, shows the target. */
function checker(opts: RunOptions, label: string, target: Target, plant: string | null) {
  let n = 0;
  return async (spec: Sequence): Promise<boolean> => {
    const id = `shrink-${label}-${n++}`;
    const r = await runSession({ model: spec.model, scope: spec.scope, unattended: spec.unattended, steps: spec.steps, id, arm: 'on', plant }, opts);
    const hit = r.harness === 'ok' && violationsOf(r).some((v) => !v.known && v.class === target.class && v.kind === target.kind);
    process.stderr.write(`  ${id}: ${spec.steps.length} steps, ${r.harness}, ${hit ? 'still fails' : 'passes'}\n`);
    return hit;
  };
}

async function shrinkCommand(ctx: Context): Promise<void> {
  const file = str(ctx.args, 'sessions', '');
  const id = str(ctx.args, 'id', '');
  if (!file || !id) throw new Error('shrink needs --sessions <file> and --id <session>');
  const line = readLines(file).find((l) => l.id === id);
  if (!line) throw new Error(`no session ${id} in ${file}`);
  const plant = typeof ctx.args.plant === 'string' ? ctx.args.plant : null;
  const opts = plant ? { ...ctx.opts, noonsightRoot: buildPlant(plantNamed(plant), path.join(ctx.work, `plant-${plant}-build`)) } : ctx.opts;
  const target = targetOf(line, typeof ctx.args.class === 'string' ? ctx.args.class : undefined, typeof ctx.args.kind === 'string' ? ctx.args.kind : undefined);
  const result = await shrink(line.spec, target, checker(opts, id, target, plant), num(ctx.args, 'concurrency', 4));
  writeJson(path.join(ctx.results, 'failures', `shrink-${id}-${target.class}-${target.kind}.json`), { session: id, ...result });
  process.stdout.write(`${result.original}\n  shrank to (${result.runs} runs, ${result.seconds} s)\n${result.minimal}\n`);
}

/** The `on` sessions of a seed already in the results folder, at least `n` of them, or null. */
function existingOn(ctx: Context, seed: number, n: number): Line[] | null {
  const dir = path.join(ctx.results, 'sessions');
  for (const f of fs.readdirSync(dir).filter((x) => x.startsWith(`on-s${seed}-n`))) {
    const lines = readLines(path.join(dir, f));
    if (lines.length >= n) return lines.filter((l) => Number(sessionKey(l.id).split('-')[1]) < n);
  }
  return null;
}

async function selfcheck(ctx: Context): Promise<boolean> {
  const n = num(ctx.args, 'n', 60);
  const seed = num(ctx.args, 'seed', 1);
  const which = str(ctx.args, 'plant', 'all');
  const plants = which === 'all' ? PLANTS : [plantNamed(which)];
  const real = existingOn(ctx, seed, n) ?? (await fuzz(ctx, 'on', n)).lines;
  const out: Record<string, unknown> = {};
  let allCaught = true;
  for (const plant of plants) {
    const planted = (await fuzz(ctx, 'on', n, plant.name)).lines;
    const compared = comparePlant(plant, real, planted);
    let shrunk = null;
    let minimalOnReal: string | null = null;
    const first = planted.find((p) => p.id === compared.failedOnlyOnPlanted[0]);
    if (first) {
      const realLine = real.find((r) => sessionKey(r.id) === sessionKey(first.id));
      const fresh = first.violations.find((v) => !v.known && !(realLine ? signature(realLine) : []).includes(`${v.class}/${v.kind}`)) ?? first.violations.find((v) => !v.known);
      const target = targetOf(first, fresh?.class, fresh?.kind);
      const opts = { ...ctx.opts, noonsightRoot: path.join(ctx.work, `plant-${plant.name}-build`) };
      shrunk = await shrink(first.spec, target, checker(opts, `plant-${plant.name}`, target, plant.name), num(ctx.args, 'concurrency', 4));
      const onReal = await checker(ctx.opts, `plant-${plant.name}-real`, target, null)(shrunk.spec);
      minimalOnReal = onReal ? 'fails' : 'passes';
      writeJson(path.join(ctx.results, 'failures', `shrink-plant-${plant.name}.json`), { session: first.id, ...shrunk, minimalOnReal });
    }
    const caught = compared.failedOnlyOnPlanted.length > 0 && minimalOnReal === 'passes';
    allCaught &&= caught;
    out[plant.name] = { about: plant.about, caught, ...compared, minimal: shrunk?.minimal ?? null, shrinkRuns: shrunk?.runs ?? null, minimalOnReal };
    process.stdout.write(`plant ${plant.name}: ${caught ? 'caught' : 'NOT CAUGHT'}; ${compared.exposedAndCaught} of ${compared.exposed} exposed sessions failed${shrunk ? `; shrank to ${shrunk.minimal}` : ''}\n`);
  }
  const file = path.join(ctx.results, 'selfcheck.json');
  const prior = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>) : {};
  writeJson(file, { ...prior, ...out });
  return allCaught;
}

function measureCommand(ctx: Context): void {
  const dir = path.join(ctx.results, 'sessions');
  const runs: Record<string, Measures> = {};
  for (const f of fs
    .readdirSync(dir)
    .filter((x) => x.endsWith('.jsonl'))
    .sort())
    runs[f.replace(/\.jsonl$/, '')] = measure(readLines(path.join(dir, f)));
  writeJson(path.join(ctx.results, 'summary.json'), runs);
  fs.writeFileSync(path.join(ctx.results, 'summary.md'), renderMarkdown(runs));
  process.stdout.write(renderMarkdown(runs));
}

function agreeCommand(ctx: Context): void {
  const dir = path.join(ctx.results, 'sessions');
  const lib = ruleLibrary();
  const out: Record<string, unknown> = {};
  for (const f of fs.readdirSync(dir).filter((x) => /^on-.*\.jsonl$/.test(x))) out[f.replace(/\.jsonl$/, '')] = agree(readLines(path.join(dir, f)), lib, (l) => hasQuietPair(l.spec));
  writeJson(path.join(ctx.results, 'agree.json'), out);
  process.stdout.write(`${JSON.stringify(out, null, 1)}\n`);
}

function logCommandMeasure(args: Args): void {
  const file = str(args, 'file', path.join(stateDir(), 'decisions.jsonl'));
  const all = readLog(file);
  // Aggregates only, by the place each session started in: no session id, path, rule text or prompt.
  const place = new Map<string, string>();
  for (const d of all) if (d.event === 'session-start' && d.place && !place.has(d.session_id)) place.set(d.session_id, String(d.place));
  const lib = ruleLibrary();
  const groups: Record<string, Record<string, any>[]> = { all };
  for (const p of ['session', 'unattended']) groups[`place ${p}`] = all.filter((d) => place.get(d.session_id) === p);
  groups['place not recorded'] = all.filter((d) => !place.has(d.session_id));
  const out = Object.fromEntries(
    Object.entries(groups).map(([k, rows]) => [k, { decisions: rows.length, from: String(rows[0]?.ts ?? '').slice(0, 10), to: String(rows.at(-1)?.ts ?? '').slice(0, 10), ...aggregate(replay(rows, lib)) }]),
  );
  process.stdout.write(`${JSON.stringify(out, null, 1)}\n`);
}

async function main(): Promise<number> {
  const { command, args } = parse(process.argv.slice(2));
  if (command === 'log') {
    logCommandMeasure(args);
    return 0;
  }
  if (!['corpus', 'fuzz', 'selfcheck', 'shrink', 'measure', 'agree', 'hooktime', 'all'].includes(command)) {
    process.stdout.write(fs.readFileSync(path.join(PACKAGE_ROOT, 'experiments', 'delivery', 'run.ts'), 'utf8').split('\n\n')[0]?.replace(/^\/\/ ?/gm, '') ?? '');
    process.stdout.write('\n');
    return command === 'help' ? 0 : 2;
  }
  const ctx = context(args);
  const started = Date.now();
  let ok = true;
  if (command === 'corpus') ok = (await corpus(ctx)).every((c) => c.outcome === 'as-expected');
  if (command === 'fuzz') {
    const arm = str(args, 'arm', 'on') as Arm;
    if (!ARMS.includes(arm)) throw new Error(`--arm is one of ${ARMS.join(', ')}`);
    await fuzz(ctx, arm, num(args, 'n', 300));
  }
  if (command === 'selfcheck') ok = await selfcheck(ctx);
  if (command === 'shrink') await shrinkCommand(ctx);
  if (command === 'measure') measureCommand(ctx);
  if (command === 'agree') agreeCommand(ctx);
  if (command === 'hooktime') writeJson(path.join(ctx.results, 'hooktime.json'), hookTime(path.join(ctx.work, 'hooktime'), num(args, 'runs', 40)));
  if (command === 'all') {
    const corpusOk = (await corpus(ctx)).every((c) => c.outcome === 'as-expected');
    await fuzz(ctx, 'on', num(args, 'n', 300));
    for (const arm of ['claudemd', 'rules', 'skills'] as const) await fuzz(ctx, arm, num(args, 'arms-n', 60));
    const caught = await selfcheck({ ...ctx, args: { ...args, n: String(num(args, 'arms-n', 60)) } });
    measureCommand(ctx);
    agreeCommand(ctx);
    writeJson(path.join(ctx.results, 'hooktime.json'), hookTime(path.join(ctx.work, 'hooktime'), num(args, 'runs', 40)));
    ok = corpusOk && caught;
  }
  logCommand(ctx, command, started);
  return ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.join(PACKAGE_ROOT, 'dist', 'experiments', 'delivery', 'run.js'))
  main().then(
    (code) => process.exit(code),
    (e: unknown) => {
      process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
      process.exit(2);
    },
  );
