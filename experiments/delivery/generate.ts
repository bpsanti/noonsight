// The sequences of the delivery benchmark: a session's start (model, scope, place, and how it starts)
// and the steps that follow it, either random from a seed (the fuzz level) or written by hand (the
// corpus). The same generator version, seed and index always give the same sequence, so a run is
// reproduced from its seed and generator version and nothing else.
//
// Version 1 draws the steps the runs up to 2026-11-21 measured. Version 2, the default, also starts
// sessions through `noonsight run` and in a project with a trusted configuration, and adds forks
// (`--fork-session`, /branch, /fork), /resume typed in the session, plan mode, and subagents that edit
// a file.

export const ALIASES = ['fable', 'opus', 'sonnet', 'haiku'] as const;
export type Alias = (typeof ALIASES)[number];

/** The subagent types every Claude Code session has. */
export const AGENT_TYPES = ['general-purpose', 'Explore', 'Plan'] as const;

export interface Call {
  readonly type: string;
  /** The agent tool's `model` parameter, or null to leave it out. */
  readonly model: Alias | null;
  /** The subagent reads and edits the tracked code file before it answers; only general-purpose can. */
  readonly edit?: true;
}

/** The generator versions: 1 for the runs up to 2026-11-21, 2 with the paths those runs did not measure. */
export const GENERATORS = [1, 2] as const;
export type Generator = (typeof GENERATORS)[number];
export const GENERATOR: Generator = 2;

export type EditTarget = 'code' | 'doc' | 'new';

/**
 * One step of a session.
 *
 * - turn: a prompt answered with a short text.
 * - spawn: a prompt answered with one agent call per item, all in the same response.
 * - edit: a prompt answered with a Read and an Edit of a tracked code file (`code`) or a tracked
 *   document (`doc`), or a Write of a new code file (`new`).
 * - model: `/model <to>`.
 * - compact, clear: `/compact`, `/clear`.
 * - resume: leave the session and come back with `claude --continue`, with `--model` when `model` is
 *   set, and with `--fork-session` when `fork` is set, which continues a copy of the conversation
 *   under a new session id. A hand-written sequence can also change the user's `model` setting
 *   (`setting`) or set `ANTHROPIC_MODEL` (`env`) for the new process; the generator never does.
 * - branch: `/branch`, which goes on in a copy of the conversation under a new session id.
 * - fork: `/fork` with a prompt, which runs a copy of the conversation as a background session; the
 *   session itself goes on as it was.
 * - back: `/resume <id>` typed in the session, back to the conversation it was in before the current
 *   one, the one `/clear`, `/branch` or a forking resume left.
 * - plan: `/plan` turns plan mode on; shift+tab turns it off. In plan mode, an agent call or an edit
 *   waits for the person's approval, so no spawn or edit is drawn there.
 */
export type Step =
  | { readonly k: 'turn' }
  | { readonly k: 'spawn'; readonly calls: readonly Call[] }
  | { readonly k: 'edit'; readonly target: EditTarget }
  | { readonly k: 'model'; readonly to: Alias }
  | { readonly k: 'compact' }
  | { readonly k: 'clear' }
  | { readonly k: 'resume'; readonly model: Alias | null; readonly fork?: true; readonly setting?: Alias; readonly env?: Alias }
  | { readonly k: 'branch' }
  | { readonly k: 'fork' }
  | { readonly k: 'back' }
  | { readonly k: 'plan'; readonly on: boolean };

export interface Sequence {
  /** The model the session starts on, with `--model`. */
  readonly model: Alias;
  /** NOONSIGHT_SCOPE, or null for none. */
  readonly scope: string | null;
  /** Whether the session runs in the place `unattended`; otherwise `session`. */
  readonly unattended: boolean;
  /** Every launch goes through `noonsight run`, which puts the rules in the system prompt. */
  readonly launcher?: true;
  /** The project has a noonsight configuration of its own, which the account trusts. */
  readonly project?: true;
  readonly steps: readonly Step[];
}

/** Only the sequence of an object that carries one, such as a run or a corpus entry. */
export function sequenceOf(x: Sequence): Sequence {
  return { model: x.model, scope: x.scope, unattended: x.unattended, ...(x.launcher ? { launcher: true } : {}), ...(x.project ? { project: true } : {}), steps: x.steps };
}

/** The steps that change what the conversation holds or which model runs it; a plain turn is not one. */
export const LIFECYCLE: ReadonlySet<Step['k']> = new Set(['spawn', 'edit', 'model', 'compact', 'clear', 'resume', 'branch', 'fork', 'back', 'plan']);

/**
 * The steps that send no request of the session's own conversation by themselves: two of them in a
 * row leave a hook's output waiting.
 */
export const QUIET: ReadonlySet<Step['k']> = new Set(['model', 'compact', 'clear', 'resume', 'branch', 'fork', 'back', 'plan']);

/** A small seeded generator (mulberry32): the same seed gives the same numbers on every machine. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Weights = Readonly<Partial<Record<Step['k'], number>>>;
const WEIGHTS: Readonly<Record<Generator, Weights>> = {
  1: { turn: 22, spawn: 20, edit: 14, model: 18, compact: 9, clear: 8, resume: 9 },
  2: { turn: 22, spawn: 18, edit: 12, model: 16, compact: 7, clear: 7, resume: 9, branch: 5, fork: 3, back: 4, plan: 5 },
};

function pick<T>(r: () => number, xs: readonly T[]): T {
  return xs[Math.floor(r() * xs.length)] as T;
}

function weighted(r: () => number, weights: Weights): Step['k'] {
  const entries = Object.entries(weights) as [Step['k'], number][];
  const total = entries.reduce((a, [, w]) => a + w, 0);
  let x = r() * total;
  for (const [k, w] of entries) if ((x -= w) < 0) return k;
  return entries[0]![0];
}

/**
 * What the driver needs to know as a sequence goes: the conversations the session has been in, most
 * recent first, each with the turns it holds, the current one first; the model; and plan mode.
 */
interface Walk {
  conversations: number[];
  model: Alias;
  plan: boolean;
}

/**
 * Apply one step, or return why it cannot be driven:
 * - `/compact`, a resume, `/branch` and `/fork` need a conversation with at least one turn;
 * - `/resume` in the session needs an earlier conversation with at least one turn to go back to;
 * - a `/model` must name another model than the current one;
 * - in plan mode, a spawn or an edit would wait for approval, and plan mode must be on to be turned off
 *   and off to be turned on.
 * A resume starts a new process in the default permission mode, so it leaves plan mode.
 */
function walk(w: Walk, s: Step): string | null {
  const turns = w.conversations[0] ?? 0;
  if (s.k === 'turn' || s.k === 'spawn' || s.k === 'edit') {
    if (w.plan && s.k !== 'turn') return 'waits for approval in plan mode';
    if (s.k === 'spawn' && s.calls.some((c) => c.edit && c.type !== 'general-purpose')) return 'only general-purpose can edit';
    w.conversations[0] = turns + 1;
  } else if (s.k === 'compact' || s.k === 'resume' || s.k === 'branch' || s.k === 'fork') {
    if (!turns) return 'needs a turn';
    if (s.k === 'resume') {
      if (s.model) w.model = s.model;
      w.plan = false;
      if (s.fork) w.conversations.unshift(turns);
    }
    if (s.k === 'branch') w.conversations.unshift(turns);
  } else if (s.k === 'clear') w.conversations.unshift(0);
  else if (s.k === 'back') {
    const to = w.conversations.findIndex((t, i) => i > 0 && t > 0);
    if (to < 0) return 'no earlier conversation with a turn';
    w.conversations.unshift(...w.conversations.splice(to, 1));
  } else if (s.k === 'model') {
    if (s.to === w.model) return 'already on that model';
    w.model = s.to;
  } else if (s.k === 'plan') {
    if (s.on === w.plan) return s.on ? 'already in plan mode' : 'not in plan mode';
    w.plan = s.on;
  }
  return null;
}

/** Whether a sequence can be driven (walk). */
export function valid(spec: Sequence): boolean {
  const w: Walk = { conversations: [0], model: spec.model, plan: false };
  return spec.steps.length > 0 && spec.steps.every((s) => walk(w, s) === null);
}

/**
 * The `index`-th random sequence of a seed: a start drawn from the four models, three scopes (none
 * twice as often) and the two places (unattended 70 percent of the time), then 3 to 12 steps by the
 * weights above, always ending with a turn so the last step's effect reaches a request.
 *
 * Version 2 draws from a second stream of the same seed whether the session starts through `noonsight
 * run` (one in five) and in a project with a trusted configuration (one in four), and draws the steps
 * version 1 does not have: forks, /resume in the session, plan mode, and subagent calls that edit
 * (one general-purpose call in three). In plan mode it draws only turns, /model, /compact and leaving
 * plan mode, and a sequence never ends in plan mode, so no conversation is left in it.
 */
export function generate(seed: number, index: number, version: Generator = GENERATOR): Sequence {
  return version === 1 ? generateV1(seed, index) : generateV2(seed, index);
}

function generateV1(seed: number, index: number): Sequence {
  const r = rng(seed * 100003 + index);
  const start = { model: pick(r, ALIASES), scope: pick(r, [null, null, 'build', 'routine']), unattended: r() < 0.7 };
  const steps: Step[] = [];
  const n = 3 + Math.floor(r() * 10);
  let turns = 0;
  let model: Alias = start.model;
  while (steps.length < n) {
    const k = weighted(r, WEIGHTS[1]);
    if ((k === 'compact' || k === 'resume') && !turns) continue;
    if (k === 'turn') steps.push({ k });
    if (k === 'spawn') {
      const calls = Array.from({ length: 1 + Math.floor(r() * 3) }, () => ({ type: pick(r, AGENT_TYPES), model: pick(r, [null, null, null, ...ALIASES]) }));
      steps.push({ k, calls });
    }
    if (k === 'edit') steps.push({ k, target: pick(r, ['code', 'code', 'code', 'code', 'doc', 'doc', 'new'] as const) });
    if (k === 'model') {
      const to = pick(
        r,
        ALIASES.filter((a) => a !== model),
      );
      steps.push({ k, to });
      model = to;
    }
    if (k === 'compact') steps.push({ k });
    if (k === 'clear') {
      steps.push({ k });
      turns = 0;
    }
    if (k === 'resume') {
      const to = r() < 0.5 ? null : pick(r, ALIASES);
      steps.push({ k, model: to });
      if (to) model = to;
    }
    if (k === 'turn' || k === 'spawn' || k === 'edit') turns++;
  }
  if (steps.at(-1)?.k !== 'turn') steps.push({ k: 'turn' });
  return { ...start, steps };
}

function generateV2(seed: number, index: number): Sequence {
  const r = rng(seed * 100003 + index);
  const extra = rng(seed * 100003 + index + 0x9e3779b9);
  const start = { model: pick(r, ALIASES), scope: pick(r, [null, null, 'build', 'routine']), unattended: r() < 0.7 };
  const how = { ...(extra() < 0.2 ? { launcher: true as const } : {}), ...(extra() < 0.25 ? { project: true as const } : {}) };
  const steps: Step[] = [];
  const n = 3 + Math.floor(r() * 10);
  const w: Walk = { conversations: [0], model: start.model, plan: false };
  for (let tries = 0; steps.length < n && tries < 1000; tries++) {
    const k = weighted(r, WEIGHTS[2]);
    // Plan mode stays in its conversation: a conversation left in plan mode comes back in plan mode
    // when another process resumes it, which the sequence would not know.
    if (w.plan && !IN_PLAN_MODE.has(k)) continue;
    const step = draw(r, k, w);
    if (step !== null && walk(w, step) === null) steps.push(step);
  }
  if (w.plan) steps.push({ k: 'plan', on: false });
  if (steps.at(-1)?.k !== 'turn') steps.push({ k: 'turn' });
  return { ...start, ...how, steps };
}

/** The steps version 2 draws in plan mode. */
const IN_PLAN_MODE: ReadonlySet<Step['k']> = new Set(['turn', 'model', 'compact', 'plan']);

/** One step of kind `k` with its parameters drawn, or null for one that cannot follow here. */
function draw(r: () => number, k: Step['k'], w: Walk): Step | null {
  if (k === 'turn' || k === 'compact' || k === 'clear' || k === 'branch' || k === 'fork' || k === 'back') return { k };
  if (k === 'spawn') {
    const calls = Array.from({ length: 1 + Math.floor(r() * 3) }, (): Call => {
      const type = pick(r, AGENT_TYPES);
      const model = pick(r, [null, null, null, ...ALIASES]);
      return type === 'general-purpose' && r() < 1 / 3 ? { type, model, edit: true } : { type, model };
    });
    return { k, calls };
  }
  if (k === 'edit') return { k, target: pick(r, ['code', 'code', 'code', 'code', 'doc', 'doc', 'new'] as const) };
  if (k === 'model') return { k, to: pick(r, ALIASES.filter((a) => a !== w.model)) };
  if (k === 'resume') {
    const to = r() < 0.5 ? null : pick(r, ALIASES);
    return r() < 0.3 ? { k, model: to, fork: true } : { k, model: to };
  }
  if (k === 'plan') return { k, on: !w.plan };
  return null;
}

export function showStep(s: Step): string {
  switch (s.k) {
    case 'spawn':
      return `spawn(${s.calls.map((c) => `${c.type}${c.model ? `:${c.model}` : ''}${c.edit ? ' edits' : ''}`).join(' + ')})`;
    case 'edit':
      return `edit(${s.target})`;
    case 'model':
      return `/model ${s.to}`;
    case 'resume':
      return `resume${s.fork ? ' --fork-session' : ''}${s.model ? ` --model ${s.model}` : ''}${s.setting ? ` (setting model=${s.setting})` : ''}${s.env ? ` (ANTHROPIC_MODEL=${s.env})` : ''}`;
    case 'turn':
      return 'turn';
    case 'back':
      return '/resume (back)';
    case 'plan':
      return s.on ? '/plan' : 'plan off';
    default:
      return `/${s.k}`;
  }
}

/** One line a reader can follow: `start(haiku, scope=none, unattended) > /model sonnet > turn`. */
export function show(spec: Sequence): string {
  const how = `${spec.launcher ? ', noonsight run' : ''}${spec.project ? ', project' : ''}`;
  return `start(${spec.model}, scope=${spec.scope ?? 'none'}, ${spec.unattended ? 'unattended' : 'attended'}${how}) > ${spec.steps.map(showStep).join(' > ')}`;
}

/** Whether a sequence has two quiet steps in a row: the shape every delivery failure seen so far needs. */
export function hasQuietPair(spec: Sequence): boolean {
  return spec.steps.some((s, i) => QUIET.has(s.k) && QUIET.has(spec.steps[i + 1]?.k ?? 'turn'));
}
