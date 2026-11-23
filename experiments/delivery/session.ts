// Runs one session of the delivery benchmark: a real interactive Claude Code, in its own home,
// configuration directory and git project, talking to the local stub (stub.ts) with a placeholder token,
// so nothing reaches Anthropic. It types each step into a pseudo-terminal (pty-bridge.py) and waits for
// a signal rather than a fixed time: the file the Stop hook writes, the decision log line the step
// causes, or no new request for a while. It returns what every request held (oracle.ts), the session's
// decision log, and whether the driver got through every step.

import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { PACKAGE_ROOT } from '../../src/config/paths.js';
import type { Trigger } from '../../src/core/types.js';
import { armMarker, writeArm } from './arms.js';
import type { Alias, Sequence, Step } from './generate.js';
import { configFor, flatten, inspect, kindOf, sessionIdOf, UNATTENDED_ENV, type Arm, type Fact, type Reference } from './oracle.js';
import { ANCHOR, FILES, startStub } from './stub.js';

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
  /** Where each session's home, configuration and project go; outside any Claude Code scratchpad folder. */
  readonly workRoot: string;
  /** The claude binary, and the version it prints. */
  readonly claude: string;
  readonly claudeCode: string;
  /** The noonsight package the session installs: this checkout, or a planted copy of it. */
  readonly noonsightRoot: string;
  /** Keep the session's directory, with every request body in requests.json. */
  readonly keep?: boolean;
}

/** One request, as measured, with when it came. */
export interface RequestFact extends Omit<Fact, 'present'> {
  readonly i: number;
  /** The step the driver was on when it came; the step count for requests after the last step. */
  readonly step: number;
  readonly at: string;
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
  if (step.k === 'spawn') return `DB ${n} spawn ${step.calls.map((c) => `${c.type}.${c.model ?? '-'}`).join(' ')}`;
  if (step.k === 'edit') return `DB ${n} edit ${step.target}`;
  return null;
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
  if (spec.arm !== 'off') {
    const installed = spawnSync(process.execPath, [path.join(opts.noonsightRoot, 'dist', 'src', 'cli.js'), 'install', '--account', claudeDir], {
      env: { PATH: process.env.PATH ?? '', HOME: home, NOONSIGHT_CONFIG: config },
      encoding: 'utf8',
    });
    if (installed.status !== 0) throw new Error(`noonsight install failed: ${installed.stderr}`);
  }

  const where = { scope: spec.scope, place: spec.unattended ? ('unattended' as const) : ('attended' as const) };
  const marker = armMarker(spec.arm);
  const seen: { marker: boolean | null } = { marker: null };
  const facts: RequestFact[] = [];
  const bodies: unknown[] = [];
  // A session reveals the code-edit trigger when an Edit of the tracked code file succeeds.
  const pendingEdits = new Map<string, string | null>();
  const revealed = new Set<string | null>();
  let current = -1;
  let lastRequestAt = Date.now();
  const stub = await startStub(real, (body, answer) => {
    lastRequestAt = Date.now();
    const session = sessionIdOf(body);
    const kind = kindOf(body);
    if (kind === 'main') {
      const lastUser = ((body.messages ?? []) as Record<string, any>[]).filter((m) => m.role === 'user').at(-1);
      for (const b of Array.isArray(lastUser?.content) ? (lastUser.content as Record<string, any>[]) : [])
        if (b.type === 'tool_result' && pendingEdits.has(b.tool_use_id) && !b.is_error) revealed.add(pendingEdits.get(b.tool_use_id) ?? null);
      if (marker !== null && seen.marker === null) seen.marker = flatten(body).includes(marker);
    }
    const triggers: Trigger[] = revealed.has(session) ? ['code-edit'] : [];
    const { present: _present, ...f } = inspect(opts.ref, body, { ...where, triggers });
    facts.push({ i: facts.length, step: current, at: new Date().toISOString(), ...f });
    if (opts.keep) bodies.push(body);
    if (kind === 'main')
      for (const b of answer.content) if (b.type === 'tool_use' && b.name === 'Edit' && String((b.input as Record<string, unknown>).file_path).endsWith(FILES.code)) pendingEdits.set(String(b.id), session);
  });

  const env: Record<string, string> = {
    PATH: process.env.PATH ?? '',
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
  const screen = path.join(root, 'screen.log');
  const tools = ['--permission-mode', 'default', '--allowedTools', 'Agent Read Edit Write'];

  let child: ChildProcess | null = null;
  let exited = true;
  // The bridge can exit between a check and a write (the session ended by itself); that write is lost, not an error.
  const send = (cmd: Record<string, unknown>): void => {
    if (!exited) child?.stdin?.write(`${JSON.stringify(cmd)}\n`);
  };
  const launch = (args: readonly string[], extraEnv: Record<string, string> = {}): void => {
    const c = spawn('python3', [BRIDGE, screen, opts.claude, ...args, ...tools], { cwd: project, env: { ...env, ...extraEnv }, stdio: ['pipe', 'ignore', 'ignore'] });
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
  /** Every arm but `off` runs noonsight's hook, whose log line marks that the session is up. */
  const ready = async (source: string, before: number): Promise<boolean> => {
    const ok = spec.arm === 'off' ? true : await waitFor(() => countLog((d) => d.event === 'session-start' && d.source === source) > before, 20000);
    await sleep(spec.arm === 'off' ? 6000 : 2500);
    return ok;
  };

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
        else await quiet(step.k === 'spawn' ? 1800 : 500, 30000);
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
        const starts = (): number => countLog((d) => d.event === 'session-start' && d.source === step.k);
        const before = starts();
        await type(`/${step.k}`);
        if (spec.arm === 'off') await sleep(step.k === 'compact' ? 8000 : 3000);
        else if (!(await waitFor(() => starts() > before, step.k === 'compact' ? 25000 : 8000))) outcome = `no-${step.k}-seen`;
        await quiet(600, 15000);
      } else if (step.k === 'resume') {
        await quit();
        const before = countLog((d) => d.event === 'session-start' && d.source === 'resume');
        if (step.setting) fs.writeFileSync(settingsFile, JSON.stringify({ ...(JSON.parse(fs.readFileSync(settingsFile, 'utf8')) as object), model: step.setting }));
        launch(['--continue', ...(step.model ? ['--model', step.model] : [])], step.env ? { ANTHROPIC_MODEL: MODEL_ID[step.env] } : {});
        if (!(await ready('resume', before))) outcome = 'no-resume-seen';
      }
      stepLog.push({ i, k: step.k, ms: Date.now() - t0, requests: facts.length - requestsBefore, outcome });
      if (outcome === 'no-answer') harness = `step-timeout:${i}`;
    }
  } catch (e) {
    harness = `error:${e instanceof Error ? e.message : String(e)}`;
  } finally {
    current = spec.steps.length;
    await quit().catch(() => undefined);
    await stub.close();
  }
  if (harness === 'ok' && seen.marker === false) harness = 'arm-not-loaded';
  const log = decisions();
  if (opts.keep) fs.writeFileSync(path.join(root, 'requests.json'), JSON.stringify(bodies));
  else fs.rmSync(root, { recursive: true, force: true });
  return { id: spec.id, spec, harness, claudeCode: opts.claudeCode, ms: Date.now() - started, steps: stepLog, facts, decisions: log.map(scrub) };
}
