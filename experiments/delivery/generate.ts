// The sequences of the delivery benchmark: a session's start (model, scope, place) and the steps that
// follow it, either random from a seed (the fuzz level) or written by hand (the corpus). The same seed
// and index always give the same sequence, so a run is reproduced from its seed and nothing else.

export const ALIASES = ['fable', 'opus', 'sonnet', 'haiku'] as const;
export type Alias = (typeof ALIASES)[number];

/** The subagent types every Claude Code session has. */
export const AGENT_TYPES = ['general-purpose', 'Explore', 'Plan'] as const;

export interface Call {
  readonly type: string;
  /** The agent tool's `model` parameter, or null to leave it out. */
  readonly model: Alias | null;
}

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
 *   set. A hand-written sequence can also change the user's `model` setting (`setting`) or set
 *   `ANTHROPIC_MODEL` (`env`) for the new process; the generator never does.
 */
export type Step =
  | { readonly k: 'turn' }
  | { readonly k: 'spawn'; readonly calls: readonly Call[] }
  | { readonly k: 'edit'; readonly target: EditTarget }
  | { readonly k: 'model'; readonly to: Alias }
  | { readonly k: 'compact' }
  | { readonly k: 'clear' }
  | { readonly k: 'resume'; readonly model: Alias | null; readonly setting?: Alias; readonly env?: Alias };

export interface Sequence {
  /** The model the session starts on, with `--model`. */
  readonly model: Alias;
  /** NOONSIGHT_SCOPE, or null for none. */
  readonly scope: string | null;
  /** Whether the session runs in the place `unattended`; otherwise `session`. */
  readonly unattended: boolean;
  readonly steps: readonly Step[];
}

/** The steps that change what the conversation holds or which model runs it; a plain turn is not one. */
export const LIFECYCLE: ReadonlySet<Step['k']> = new Set(['spawn', 'edit', 'model', 'compact', 'clear', 'resume']);

/** The steps that send no request by themselves: two of them in a row leave a hook's output waiting. */
export const QUIET: ReadonlySet<Step['k']> = new Set(['model', 'compact', 'clear', 'resume']);

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

const WEIGHTS: Readonly<Record<Step['k'], number>> = { turn: 22, spawn: 20, edit: 14, model: 18, compact: 9, clear: 8, resume: 9 };

function pick<T>(r: () => number, xs: readonly T[]): T {
  return xs[Math.floor(r() * xs.length)] as T;
}

function weighted(r: () => number): Step['k'] {
  const entries = Object.entries(WEIGHTS) as [Step['k'], number][];
  const total = entries.reduce((a, [, w]) => a + w, 0);
  let x = r() * total;
  for (const [k, w] of entries) if ((x -= w) < 0) return k;
  return entries[0]![0];
}

/**
 * Whether a sequence can be driven: `/compact` and a resume need a conversation with at least one turn
 * since the session started or was cleared, and a `/model` must name another model than the current one.
 */
export function valid(spec: Sequence): boolean {
  let turns = 0;
  let model: Alias = spec.model;
  for (const s of spec.steps) {
    if (s.k === 'turn' || s.k === 'spawn' || s.k === 'edit') turns++;
    else if (s.k === 'compact' || s.k === 'resume') {
      if (!turns) return false;
      if (s.k === 'resume' && s.model) model = s.model;
    } else if (s.k === 'clear') turns = 0;
    else if (s.k === 'model') {
      if (s.to === model) return false;
      model = s.to;
    }
  }
  return spec.steps.length > 0;
}

/**
 * The `index`-th random sequence of a seed: a start drawn from the four models, three scopes (none
 * twice as often) and the two places (unattended 70 percent of the time), then 3 to 12 steps by the
 * weights above, always ending with a turn so the last step's effect reaches a request.
 */
export function generate(seed: number, index: number): Sequence {
  const r = rng(seed * 100003 + index);
  const start = { model: pick(r, ALIASES), scope: pick(r, [null, null, 'build', 'routine']), unattended: r() < 0.7 };
  const steps: Step[] = [];
  const n = 3 + Math.floor(r() * 10);
  let turns = 0;
  let model: Alias = start.model;
  while (steps.length < n) {
    const k = weighted(r);
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

export function showStep(s: Step): string {
  switch (s.k) {
    case 'spawn':
      return `spawn(${s.calls.map((c) => `${c.type}${c.model ? `:${c.model}` : ''}`).join(' + ')})`;
    case 'edit':
      return `edit(${s.target})`;
    case 'model':
      return `/model ${s.to}`;
    case 'resume':
      return `resume${s.model ? ` --model ${s.model}` : ''}${s.setting ? ` (setting model=${s.setting})` : ''}${s.env ? ` (ANTHROPIC_MODEL=${s.env})` : ''}`;
    case 'turn':
      return 'turn';
    default:
      return `/${s.k}`;
  }
}

/** One line a reader can follow: `start(haiku, scope=none, unattended) > /model sonnet > turn`. */
export function show(spec: Sequence): string {
  return `start(${spec.model}, scope=${spec.scope ?? 'none'}, ${spec.unattended ? 'unattended' : 'session'}) > ${spec.steps.map(showStep).join(' > ')}`;
}

/** Whether a sequence has two quiet steps in a row: the shape every delivery failure seen so far needs. */
export function hasQuietPair(spec: Sequence): boolean {
  return spec.steps.some((s, i) => QUIET.has(s.k) && QUIET.has(spec.steps[i + 1]?.k ?? 'turn'));
}
