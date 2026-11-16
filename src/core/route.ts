// Routing: from a task's scope to a model and an effort. Pure, like the rest of the core: the adapter
// passes the environment, what the caller already chose, and how an option's model is written for the
// target, as data.
//
// Routing acts only when it is on, for a target it lists, outside an environment that makes it yield,
// and where the caller has not already chosen the model. Then the scope's row for the target, else
// routing.default, lists options in order of preference, and the first whose model is declared under
// "models" wins. In every other case the call is left as it is, and the decision says why. The scope
// and the rules never depend on routing: they are decided the same way whether a route applies or not.

import { declares } from './resolve.js';
import type { Config, Effort, RouteOption, RouteRow, RouteTarget } from './types.js';

/** The environment variable that turns routing off for a session and everything it starts. */
export const ROUTING_ENV = 'SEXTANT_ROUTING';

/** SEXTANT_ROUTING values that turn routing off. */
const OFF_VALUES = ['off', '0', 'false', 'no'];

/** A model the call already has, which routing may not replace. */
export interface Held {
  /** Why the model is held, as the decision log records it, such as explicit-model. */
  readonly reason: string;
  /**
   * true: the caller chose the model, so routing.respect_explicit decides whether it stands.
   * false: Claude Code fixes the model whatever the call asks, so routing always yields.
   */
  readonly explicit: boolean;
}

/** How the adapter writes an option's model for the target, and the model that selects; or why it cannot. */
export type Translation = { readonly value: string; readonly model: string } | { readonly why: string };

export interface RouteRequest {
  readonly target: RouteTarget;
  /** The declared scope of the task, or null. */
  readonly scope: string | null;
  readonly env: Readonly<Record<string, string | undefined>>;
  /** A model the call already has, or null. */
  readonly held: Held | null;
  /** Whether the call already sets an effort. */
  readonly explicitEffort: boolean;
  readonly translate: (model: string) => Translation;
}

/** An option passed over, and why. */
export interface SkippedOption {
  readonly model: string;
  readonly why: string;
}

export type RouteDecision =
  | { readonly routing: 'off'; readonly reason: 'disabled' }
  | {
      readonly routing: 'yielded';
      /** target-off, routing-env, yield-env, or the reason a model is held. */
      readonly reason: string;
      /** For yield-env and routing-env: the variable. */
      readonly env?: string;
    }
  | {
      readonly routing: 'inherit';
      /** no-scope or no-row: nothing to consult. empty-row: the row lists no option. no-declared-option: none could be used. */
      readonly reason: 'no-scope' | 'no-row' | 'empty-row' | 'no-declared-option';
      /** The row consulted: the scope's row in the table, or routing.default. */
      readonly from?: 'table' | 'default';
      readonly skipped: readonly SkippedOption[];
    }
  | {
      readonly routing: 'routed';
      readonly reason: 'table' | 'default';
      /** What the call gets, as the adapter writes it, such as an alias. */
      readonly value: string;
      /** The normalized model that value selects. */
      readonly model: string;
      /** The effort to set, unless the call keeps its own. */
      readonly effort?: Effort;
      /** For an option with an effort, when the call already sets one and keeps it. */
      readonly effortKept?: true;
      /** The position of the chosen option in its row, from 0. */
      readonly option: number;
      readonly skipped: readonly SkippedOption[];
    };

/** Whether SEXTANT_ROUTING turns routing off. */
export function routingEnvOff(env: Readonly<Record<string, string | undefined>>): boolean {
  return OFF_VALUES.includes((env[ROUTING_ENV] ?? '').trim().toLowerCase());
}

/**
 * Whether routing can act at all for a target in an environment: the decision every task there gets
 * before its scope or its model is looked at, or null when routing may act.
 */
export function routingGate(config: Config, target: RouteTarget, env: Readonly<Record<string, string | undefined>>): RouteDecision | null {
  const r = config.routing;
  if (!r.enabled) return { routing: 'off', reason: 'disabled' };
  if (!r.targets.includes(target)) return { routing: 'yielded', reason: 'target-off' };
  if (routingEnvOff(env)) return { routing: 'yielded', reason: 'routing-env', env: ROUTING_ENV };
  const yieldEnv = r.yieldWhenEnv.find((name) => (env[name] ?? '') !== '');
  if (yieldEnv !== undefined) return { routing: 'yielded', reason: 'yield-env', env: yieldEnv };
  return null;
}

/** Whether a model the call already has keeps routing out. */
function holds(config: Config, held: Held | null): boolean {
  return held !== null && (!held.explicit || config.routing.respectExplicit);
}

/**
 * Whether routing would read the task's scope for a call: it may act for the target in the
 * environment, and no model the call already has keeps it out.
 */
export function routeReadsScope(config: Config, request: Pick<RouteRequest, 'target' | 'env' | 'held'>): boolean {
  return routingGate(config, request.target, request.env) === null && !holds(config, request.held);
}

/** Decide the model and effort a task is routed to, or why it is left as it is. */
export function route(config: Config, request: RouteRequest): RouteDecision {
  const r = config.routing;
  const gate = routingGate(config, request.target, request.env);
  if (gate !== null) return gate;
  if (request.held !== null && holds(config, request.held)) return { routing: 'yielded', reason: request.held.reason };

  const fromTable = request.scope !== null ? rowFor(r.table.get(request.scope), request.target) : undefined;
  const fromDefault = rowFor(r.default ?? undefined, request.target);
  const [options, from] = fromTable !== undefined ? [fromTable, 'table' as const] : [fromDefault, 'default' as const];
  if (options === undefined) return { routing: 'inherit', reason: request.scope === null ? 'no-scope' : 'no-row', skipped: [] };
  if (options.length === 0) return { routing: 'inherit', reason: 'empty-row', from, skipped: [] };

  const skipped: SkippedOption[] = [];
  for (const [i, option] of options.entries()) {
    const t = request.translate(option.model);
    if ('why' in t) {
      skipped.push({ model: option.model, why: t.why });
      continue;
    }
    if (!declares(config, t.model)) {
      skipped.push({ model: option.model, why: `${t.model} is not declared under "models"` });
      continue;
    }
    return {
      routing: 'routed',
      reason: from,
      value: t.value,
      model: t.model,
      ...effortOf(option, request.explicitEffort && r.respectExplicit),
      option: i,
      skipped,
    };
  }
  return { routing: 'inherit', reason: 'no-declared-option', from, skipped };
}

function rowFor(row: RouteRow | undefined, target: RouteTarget): readonly RouteOption[] | undefined {
  return row?.[target];
}

function effortOf(option: RouteOption, keep: boolean): { effort?: Effort; effortKept?: true } {
  if (option.effort === undefined) return {};
  return keep ? { effortKept: true } : { effort: option.effort };
}
