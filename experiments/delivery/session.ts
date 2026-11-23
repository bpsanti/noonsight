// Runs one session of the delivery benchmark: a real interactive Claude Code, in its own home,
// configuration directory and git project, talking to the local stub (stub.ts) with a placeholder token,
// so nothing reaches Anthropic. It types each step into a pseudo-terminal (pty-bridge.py) and waits for
// a signal rather than a fixed time: the file the Stop hook writes, the decision log line the step
// causes, or no new request for a while. It returns what every request held (oracle.ts), the session's
// decision log, and whether the driver got through every step.
//
// A session that starts through `noonsight run`, or in a project with noonsight's configuration, does
// so only under the arm `on`: the native arms have no counterpart of either, so under them the session
// starts as without.

import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { PACKAGE_ROOT } from '../../src/config/paths.js';
import type { Trigger } from '../../src/core/types.js';
import { armMarker, writeArm } from './arms.js';
import type { Alias, Sequence, Step } from './generate.js';
import { configFor, flatten, inspect, kindOf, sessionIdOf, UNATTENDED_ENV, writeProject, type Arm, type Fact, type Reference } from './oracle.js';
import { installPlugin, marketplaceFor, type Install } from './plugin.js';
import { ANCHOR, FILES, startStub, type Body } from './stub.js';

const BRIDGE = path.join(PACKAGE_ROOT, 'experiments', 'delivery', 'pty-bridge.py');

export const MODEL_ID: Readonly<Record<Alias, string>> = { fable: 'claude-fable-5-2', opus: 'claude-opus-5-5', sonnet: 'claude-sonnet-5-5', haiku: 'claude-haiku-5-5' };

/** A sequence to run, under one arm, on this checkout or on a copy with a planted failure. */
export interface Run extends Sequence {
  readonly id: string;
  readonly arm: Arm;
  /** The planted failure's name (plants.ts), or null for this checkout as it is. */
  readonly plant: string | null;
}

export interface RunOptions {
  readonly ref: Reference;
  /** The reference with the benchmark's project configuration laid over it (loadReference). */
  readonly projectRef: Reference;
  /** Where each session's home, configuration and project go; outside any Claude Code scratchpad folder. */
  readonly workRoot: string;
  /** The claude binary, and the version it prints. */
  readonly claude: string;
  readonly claudeCode: string;
  /** The noonsight package the session installs: this checkout, or a planted copy of it. */
  readonly noonsightRoot: string;
  /** What delivers in the session; the settings hooks when absent. */
  readonly install?: Install;
  /** Keep the session's directory, with every request body in requests.json. */
  readonly keep?: boolean;
}

/** One request, as measured, with when it came. */
export interface RequestFact extends Omit<Fact, 'present'> {
  readonly i: number;
  /** The step the driver was on when it came; the step count for requests after the last step. */
  readonly step: number;
  readonly at: string;
  /** A request of a session /fork runs in the background. */
  readonly background?: true;
}

export interface StepLog {
  readonly i: number;
  readonly k: Step['k'];
  readonly ms: number;
  readonly requests: number;
  /** ok, or the signal that did not come: no-answer ends the session, the others do not. */
  readonly outcome: string;
}

export interface SessionResult {
  readonly id: string;
  readonly spec: Run;
  /** ok, or why the driver could not run the sequence: such a session is not measured. */
  readonly harness: string;
  readonly claudeCode: string;
  readonly ms: number;
  readonly steps: readonly StepLog[];
  readonly facts: readonly RequestFact[];
  readonly decisions: readonly Record<string, unknown>[];
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function waitFor(cond: () => boolean, timeoutMs: number, pollMs = 100): Promise<boolean> {
  const until = Date.now() + timeoutMs;
  for (;;) {
    if (cond()) return true;
    if (Date.now() >= until) return false;
    await sleep(pollMs);
  }
}

/** The prompt that makes the stub answer a step: null for the steps that are commands. */
export function directive(step: Step, n: number): string | null {
  if (step.k === 'turn') return `DB ${n} turn`;
  if (step.k === 'spawn') return `DB ${n} spawn ${step.calls.map((c) => `${c.type}.${c.model ?? '-'}${c.edit ? '.edit' : ''}`).join(' ')}`;
  if (step.k === 'edit') return `DB ${n} edit ${step.target}`;
  return null;
}

/** The last permission mode a terminal footer names in some printed text: `plan`, `auto`, `accept`, `manual`, `bypass`, or null. */
export function footerMode(printed: string): string | null {
  const found = [...printed.matchAll(/(plan|auto|manual|bypass\s*permissions)\s*mode\s*on|(accept)\s*edits\s*on/g)].at(-1);
  return found ? (found[1] ?? found[2] ?? '').replace(/\s.*$/, '') || null : null;
}

/** The tool_use ids of every successful tool result in a request's user messages. */
function toolResults(body: Body): string[] {
  const out: string[] = [];
  for (const m of (body.messages ?? []) as Body[])
    if (m.role === 'user' && Array.isArray(m.content)) for (const b of m.content as Body[]) if (b.type === 'tool_result' && !b.is_error) out.push(String(b.tool_use_id));
  return out;
}

/** The absolute path of a program, as PATH finds it. */
function which(program: string): string {
  if (program.includes('/')) return path.resolve(program);
  const found = spawnSync('/bin/sh', ['-c', 'command -v "$0"', program], { encoding: 'utf8' }).stdout.trim();
  if (!found) throw new Error(`${program} is not on PATH`);
  return found;
}

/**
 * Stop the background processes a session's /fork left: Claude Code runs a forked conversation in a
 * daemon it starts for the configuration directory, which outlives the session. The daemon names the
 * session's project as the directory it was started from; everything below it goes too, and the
 * daemon's folder in the temporary directory with them.
 */
export function stopBackground(projectDirs: readonly string[]): void {
  const ps = spawnSync('ps', ['-axo', 'pid=,ppid=,args='], { encoding: 'utf8' }).stdout ?? '';
  const rows = ps
    .split('\n')
    .map((l) => /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(l))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ pid: Number(m[1]), ppid: Number(m[2]), args: m[3] ?? '' }));
  const ours = new Set(rows.filter((r) => r.args.includes(' daemon run ') && projectDirs.some((d) => r.args.includes(`"cwd":${JSON.stringify(d)}`))).map((r) => r.pid));
  for (let grew = true; grew; ) {
    grew = false;
    for (const r of rows)
      if (!ours.has(r.pid) && ours.has(r.ppid)) {
        ours.add(r.pid);
        grew = true;
      }
  }
  const folders = new Set<string>();
  for (const r of rows) if (ours.has(r.pid)) for (const m of r.args.matchAll(/(\/tmp\/cc-daemon-\d+\/[0-9a-f]+)\//g)) folders.add(m[1] as string);
  for (const pid of ours)
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // Already gone.
    }
  for (const f of folders) fs.rmSync(f, { recursive: true, force: true });
}

/** A decision log line without the machine's paths. */
function scrub(d: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(d).map(([k, v]) => [k, typeof v === 'string' && v.startsWith('/') ? '<path>' : v]));
}

/** The version `claude --version` prints, such as "2.1.328". */
export function claudeVersion(claude: string): string {
  const out = spawnSync(claude, ['--version'], { encoding: 'utf8' }).stdout ?? '';
  const m = /\d+\.\d+\.\d+/.exec(out);
  if (!m) throw new Error(`${claude} --version printed no version`);
  return m[0];
}

export async function runSession(spec: Run, opts: RunOptions): Promise<SessionResult> {
  const started = Date.now();
  const root = path.join(opts.workRoot, spec.id);
  fs.rmSync(root, { recursive: true, force: true });
  const [home, claudeDir, project, probe] = ['home', 'claude', 'project', 'probe'].map((d) => path.join(root, d)) as [string, string, string, string];
  for (const d of [home, claudeDir, path.join(project, 'src'), path.join(project, 'docs'), probe]) fs.mkdirSync(d, { recursive: true });
  const real = fs.realpathSync(project);
  fs.writeFileSync(path.join(claudeDir, '.claude.json'), JSON.stringify({ hasCompletedOnboarding: true, projects: { [real]: { hasTrustDialogAccepted: true } } }));
  fs.writeFileSync(path.join(project, FILES.code), `// ${ANCHOR}\nexport const x = 1;\n`);
  fs.writeFileSync(path.join(project, FILES.doc), `${ANCHOR}\n\nNotes.\n`);
  for (const args of [['init', '-q'], ['add', FILES.code, FILES.doc], ['-c', 'user.name=bench', '-c', 'user.email=bench@example.com', 'commit', '-q', '-m', 'start']])
    spawnSync('git', ['-C', project, ...args]);
  const stopHook = { type: 'command', command: '/bin/sh', args: ['-c', 'cat > "$0/stop-$$-$(date +%s).json"', probe], timeout: 10 };
  const settingsFile = path.join(claudeDir, 'settings.json');
  fs.writeFileSync(settingsFile, JSON.stringify({ theme: 'dark', hooks: { Stop: [{ hooks: [stopHook] }] } }));
  const config = path.join(root, 'noonsight.json');
  fs.writeFileSync(config, JSON.stringify(configFor(spec.arm)));
  writeArm(spec.arm, claudeDir, project);
  const cli = path.join(opts.noonsightRoot, 'dist', 'src', 'cli.js');
  const inProject = spec.arm === 'on' && spec.project === true;
  const launcher = spec.arm === 'on' && spec.launcher === true;
  if (inProject) writeProject(project);
  if (spec.arm !== 'off') {
    const nsEnv = { PATH: process.env.PATH ?? '', HOME: home, NOONSIGHT_CONFIG: config };
    const install = opts.install ?? 'settings';
    if (install !== 'plugin') {
      const installed = spawnSync(process.execPath, [cli, 'install', '--account', claudeDir], { env: nsEnv, encoding: 'utf8' });
      if (installed.status !== 0) throw new Error(`noonsight install failed: ${installed.stderr}`);
    }
    if (install !== 'settings') installPlugin(opts.claude, marketplaceFor(opts.noonsightRoot, opts.workRoot), { home, claudeDir, cwd: project });
    if (inProject) {
      const trusted = spawnSync(process.execPath, [cli, 'trust', project], { env: nsEnv, encoding: 'utf8' });
      if (trusted.status !== 0) throw new Error(`noonsight trust failed: ${trusted.stdout}${trusted.stderr}`);
    }
  }
  // `noonsight run` starts the `claude` on PATH: the one this run measures.
  const bin = path.join(root, 'bin');
  if (launcher) {
    fs.mkdirSync(bin, { recursive: true });
    fs.symlinkSync(which(opts.claude), path.join(bin, 'claude'));
  }

  const ref = inProject ? opts.projectRef : opts.ref;
  const place = spec.unattended ? ('unattended' as const) : ('attended' as const);
  const marker = armMarker(spec.arm);
  const seen: { marker: boolean | null } = { marker: null };
  const facts: RequestFact[] = [];
  const bodies: unknown[] = [];
  // A session reveals the code-edit trigger when an Edit of the tracked code file succeeds: from the
  // request that carries its result on, in that conversation and in every copy of it a fork makes.
  const pendingEdits = new Set<string>();
  const revealed = new Set<string | null>();
  // The sessions /fork runs in the background: Claude Code runs them headless, so in the place
  // `unattended` (docs/hooks.md, "SessionStart").
  const background = new Set<string | null>();
  // The conversations the session has been in, the most recent first, for /resume in the session.
  const conversations: (string | null)[] = [];
  let conversation: string | null = null;
  let current = -1;
  let lastRequestAt = Date.now();
  const stub = await startStub(real, (body, answer) => {
    lastRequestAt = Date.now();
    const session = sessionIdOf(body);
    const kind = kindOf(body);
    if (kind === 'main') {
      if (spec.steps[current]?.k === 'fork' && !conversations.includes(session)) background.add(session);
      if (!background.has(session)) {
        conversations.splice(0, conversations.length, session, ...conversations.filter((c) => c !== session));
        conversation = session;
      }
      if (toolResults(body).some((id) => pendingEdits.has(id))) revealed.add(session);
      if (marker !== null && seen.marker === null) seen.marker = flatten(body).includes(marker);
    }
    const triggers: Trigger[] = revealed.has(session) ? ['code-edit'] : [];
    const where = { scope: spec.scope, place: background.has(session) ? ('unattended' as const) : place, triggers };
    const { present: _present, ...f } = inspect(ref, body, where);
    facts.push({ i: facts.length, step: current, at: new Date().toISOString(), ...f, ...(background.has(session) ? { background: true as const } : {}) });
    if (opts.keep) bodies.push(body);
    if (kind === 'main')
      for (const b of answer.content) if (b.type === 'tool_use' && b.name === 'Edit' && String((b.input as Record<string, unknown>).file_path).endsWith(FILES.code)) pendingEdits.add(String(b.id));
  });

  const env: Record<string, string> = {
    PATH: launcher ? `${bin}${path.delimiter}${process.env.PATH ?? ''}` : (process.env.PATH ?? ''),
    HOME: home,
    TERM: 'xterm-256color',
    LANG: 'en_US.UTF-8',
    CLAUDE_CONFIG_DIR: claudeDir,
    NOONSIGHT_CONFIG: config,
    ...(spec.scope ? { NOONSIGHT_SCOPE: spec.scope } : {}),
    ...(spec.unattended ? { [UNATTENDED_ENV]: '1' } : {}),
    DISABLE_AUTOUPDATER: '1',
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    CLAUDE_CODE_OAUTH_TOKEN: 'noonsight-delivery-bench-placeholder',
    ANTHROPIC_BASE_URL: stub.url,
  };
  const logFile = path.join(home, '.local', 'state', 'noonsight', 'decisions.jsonl');
  const decisions = (): Record<string, unknown>[] => {
    try {
      return fs
        .readFileSync(logFile, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l) as Record<string, unknown>);
    } catch {
      return [];
    }
  };
  const countLog = (pred: (d: Record<string, unknown>) => boolean): number => decisions().filter(pred).length;
  const stops = (): number => fs.readdirSync(probe).length;
  /** The permission mode the newest Stop hook input names. */
  const lastMode = (): string | null => {
    const newest = fs
      .readdirSync(probe)
      .map((f) => path.join(probe, f))
      .sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs)
      .at(-1);
    try {
      return newest ? String((JSON.parse(fs.readFileSync(newest, 'utf8')) as { permission_mode?: unknown }).permission_mode ?? '') : null;
    } catch {
      return null;
    }
  };
  const screen = path.join(root, 'screen.log');
  const screenSize = (): number => (fs.existsSync(screen) ? fs.statSync(screen).size : 0);
  /** What the terminal printed since `at`, without its control sequences. */
  const printedSince = (at: number): string => {
    const fd = fs.openSync(screen, 'r');
    try {
      const size = fs.fstatSync(fd).size;
      const buffer = Buffer.alloc(Math.max(0, size - at));
      fs.readSync(fd, buffer, 0, buffer.length, at);
      return buffer.toString('utf8').replace(/\u001b\[[0-9;?]*[A-Za-z]|\u001b\][^\u0007]*\u0007/g, '');
    } finally {
      fs.closeSync(fd);
    }
  };
  const tools = ['--permission-mode', 'default', '--allowedTools', 'Agent Read Edit Write'];

  let child: ChildProcess | null = null;
  let exited = true;
  // The bridge can exit between a check and a write (the session ended by itself); that write is lost, not an error.
  const send = (cmd: Record<string, unknown>): void => {
    if (!exited) child?.stdin?.write(`${JSON.stringify(cmd)}\n`);
  };
  const program = launcher ? [process.execPath, cli, 'run', '--'] : [opts.claude];
  const launch = (args: readonly string[], extraEnv: Record<string, string> = {}): void => {
    const c = spawn('python3', [BRIDGE, screen, ...program, ...args, ...tools], { cwd: project, env: { ...env, ...extraEnv }, stdio: ['pipe', 'ignore', 'ignore'] });
    child = c;
    c.stdin?.on('error', () => undefined);
    exited = false;
    c.on('close', () => (exited = true));
  };
  const type = async (text: string): Promise<void> => {
    send({ send: text });
    await sleep(350);
    send({ send: '\r' });
  };
  const quit = async (): Promise<void> => {
    if (exited) return;
    await type('/exit');
    if (!(await waitFor(() => exited, 8000))) {
      send({ kill: true });
      if (!(await waitFor(() => exited, 3000))) (child as ChildProcess | null)?.kill('SIGKILL');
    }
  };
  /** No new request and no new answer for `quietMs`. */
  const quiet = async (quietMs: number, timeoutMs: number): Promise<boolean> => {
    let seen = stops();
    let at = Date.now();
    return waitFor(() => {
      const now = stops();
      if (now !== seen) {
        seen = now;
        at = Date.now();
      }
      return Date.now() - Math.max(at, lastRequestAt) >= quietMs;
    }, timeoutMs);
  };
  const starts = (source: string): number => countLog((d) => d.event === 'session-start' && d.source === source);
  /** Every arm but `off` runs noonsight's hook, whose log line marks that the session is up. */
  const ready = async (source: string, before: number): Promise<boolean> => {
    const ok = spec.arm === 'off' ? true : await waitFor(() => starts(source) > before, 20000);
    await sleep(spec.arm === 'off' ? 6000 : 2500);
    return ok;
  };
  /** A command that starts another conversation in the same process: wait for its start, or a while under `off`. */
  const opened = async (source: string, before: number, timeoutMs = 10000): Promise<boolean> => {
    if (spec.arm === 'off') {
      await sleep(3000);
      return true;
    }
    return waitFor(() => starts(source) > before, timeoutMs);
  };
  let plan = false;

  let harness = 'ok';
  const stepLog: StepLog[] = [];
  try {
    launch(['--model', spec.model]);
    if (!(await ready('startup', 0))) harness = 'startup-timeout';
    for (let i = 0; i < spec.steps.length && harness === 'ok'; i++) {
      const step = spec.steps[i] as Step;
      current = i;
      const t0 = Date.now();
      const requestsBefore = facts.length;
      let outcome = 'ok';
      if (exited) {
        harness = `session-ended-before-step:${i}`;
        break;
      }
      if (step.k === 'turn' || step.k === 'spawn' || step.k === 'edit') {
        const before = stops();
        await type(directive(step, i) as string);
        if (!(await waitFor(() => stops() > before, 60000))) outcome = 'no-answer';
        else {
          await quiet(step.k === 'spawn' ? 1800 : 500, 30000);
          // The answer's Stop hook names the permission mode: a session not in the mode the sequence says was not driven as written.
          if (lastMode() !== (plan ? 'plan' : 'default')) outcome = 'wrong-mode';
        }
      } else if (step.k === 'plan') {
        // The footer names the mode. /plan turns plan mode on; shift+tab goes on to the next mode, which
        // after plan mode is auto mode on some models and the default ("manual") mode on others, so it
        // is pressed until the footer names the default mode.
        plan = step.on;
        const want = step.on ? 'plan' : 'manual';
        let mode: string | null = null;
        for (let press = 0; press < (step.on ? 1 : 4) && mode !== want; press++) {
          const at = screenSize();
          if (step.on) await type('/plan');
          else send({ send: '\u001b[Z' });
          mode = null;
          await waitFor(() => (mode = footerMode(printedSince(at))) !== null, 15000);
        }
        if (mode !== want) outcome = 'wrong-mode';
        await sleep(500);
      } else if (step.k === 'branch') {
        const before = starts('fork');
        await type('/branch');
        if (!(await opened('fork', before))) outcome = 'no-branch-seen';
        await quiet(600, 15000);
      } else if (step.k === 'fork') {
        const before = stops();
        const at = screenSize();
        await type(`/fork DB ${i} turn`);
        // The background session answers its prompt, and its Stop hook writes a file as the session's does.
        // Claude Code refuses to fork a session started with a system prompt of its own, as `noonsight run`
        // starts one with rules, and says so: nothing is forked, and the session goes on.
        // A session whose fork has not answered is not measured: a late request of the fork could not be
        // told from one of the session's own conversation.
        const refused = (): boolean => /Can'?t\s*fork/.test(printedSince(at));
        if (!(await waitFor(() => stops() > before || refused(), 120000))) outcome = 'no-fork-answer';
        else if (refused()) outcome = 'fork-refused';
        await quiet(1500, 30000);
      } else if (step.k === 'back') {
        const to = conversations.find((c) => c !== conversation) ?? null;
        if (to === null) outcome = 'no-earlier-conversation';
        else {
          const before = starts('resume');
          await type(`/resume ${to}`);
          if (!(await opened('resume', before))) outcome = 'no-resume-seen';
          conversations.splice(0, conversations.length, to, ...conversations.filter((c) => c !== to));
          conversation = to;
          await quiet(600, 15000);
        }
      } else if (step.k === 'model') {
        const switches = (): number => countLog((d) => d.event === 'model-switch');
        const before = switches();
        await type(`/model ${step.to}`);
        if (spec.arm === 'off') await sleep(2500);
        else if (!(await waitFor(() => switches() > before, 2500))) {
          // Claude Code asks to confirm a switch in a conversation already cached for another model.
          send({ send: '\r' });
          if (!(await waitFor(() => switches() > before, 5000))) outcome = 'no-switch-seen';
        }
        await sleep(600);
      } else if (step.k === 'compact' || step.k === 'clear') {
        const before = starts(step.k);
        await type(`/${step.k}`);
        if (spec.arm === 'off') await sleep(step.k === 'compact' ? 8000 : 3000);
        else if (!(await waitFor(() => starts(step.k) > before, step.k === 'compact' ? 25000 : 8000))) outcome = `no-${step.k}-seen`;
        await quiet(600, 15000);
        // The conversation /clear leaves is the one /resume in the session goes back to; the new one has had no request yet.
        if (step.k === 'clear') conversation = null;
      } else if (step.k === 'resume') {
        await quit();
        const source = step.fork ? 'fork' : 'resume';
        const before = starts(source);
        if (step.setting) fs.writeFileSync(settingsFile, JSON.stringify({ ...(JSON.parse(fs.readFileSync(settingsFile, 'utf8')) as object), model: step.setting }));
        launch(['--continue', ...(step.fork ? ['--fork-session'] : []), ...(step.model ? ['--model', step.model] : [])], step.env ? { ANTHROPIC_MODEL: MODEL_ID[step.env] } : {});
        plan = false;
        if (!(await ready(source, before))) outcome = `no-${source}-seen`;
        if (step.fork) conversation = null;
      }
      if (step.k === 'branch') conversation = null;
      stepLog.push({ i, k: step.k, ms: Date.now() - t0, requests: facts.length - requestsBefore, outcome });
      if (outcome === 'no-answer') harness = `step-timeout:${i}`;
      if (outcome === 'wrong-mode') harness = `wrong-mode:${i}`;
      if (outcome === 'no-fork-answer') harness = `fork-timeout:${i}`;
    }
  } catch (e) {
    harness = `error:${e instanceof Error ? e.message : String(e)}`;
  } finally {
    current = spec.steps.length;
    await quit().catch(() => undefined);
    if (spec.steps.some((s) => s.k === 'fork')) stopBackground([project, real]);
    await stub.close();
  }
  if (harness === 'ok' && seen.marker === false) harness = 'arm-not-loaded';
  const log = decisions();
  if (opts.keep) fs.writeFileSync(path.join(root, 'requests.json'), JSON.stringify(bodies));
  else fs.rmSync(root, { recursive: true, force: true });
  return { id: spec.id, spec, harness, claudeCode: opts.claudeCode, ms: Date.now() - started, steps: stepLog, facts, decisions: log.map(scrub) };
}
