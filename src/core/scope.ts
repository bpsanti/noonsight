// Where a decision's scope and place come from. Pure, like the rest of the core: the adapters pass
// the environment and the task text in as data.
//
//   Session    scope: SEXTANT_SCOPE, when whoever starts the session exports it; else none.
//              place: unattended when a variable named in session.unattended_when_env is set; else session.
//   Subagent   scope: the scope whose matcher matches earliest in the task text; else none. Never
//              inherited from the session.
//
// With the classifier on, a task without an explicit scope may take its scope from the classifier
// instead (classify.ts).
//              place: always subagent.

import type { Config, Place } from './types.js';

/** The environment variable that names a session's task scope. */
export const SCOPE_ENV = 'SEXTANT_SCOPE';

/**
 * How much of a subagent's task text the matchers read. The matchers run inside the hook before every
 * agent call, and a matcher's time grows with the text it reads, so the bound keeps that time limited.
 */
export const TASK_TEXT_LIMIT = 100_000;

export type ScopeSource = 'env' | 'task-text' | 'classifier';

export interface ScopeChoice {
  /** The scope to resolve with, or null for none. From the environment it may be undeclared. */
  readonly scope: string | null;
  readonly source: ScopeSource | null;
  /** For a scope chosen from the task text: the matcher that decided, as the configuration writes it. */
  readonly matcher?: string;
}

export interface PlaceChoice {
  readonly place: Place;
  /** For an unattended session: the variable that marked it. */
  readonly because?: string;
}

const NO_SCOPE: ScopeChoice = { scope: null, source: null };

/** A session's scope: SEXTANT_SCOPE, trimmed; empty or unset means none. */
export function sessionScope(env: Readonly<Record<string, string | undefined>>): ScopeChoice {
  const value = (env[SCOPE_ENV] ?? '').trim();
  return value ? { scope: value, source: 'env' } : NO_SCOPE;
}

/** A session's place: unattended when any variable in session.unattended_when_env is set and not empty. */
export function sessionPlace(config: Config, env: Readonly<Record<string, string | undefined>>): PlaceChoice {
  const because = config.session.unattendedWhenEnv.find((name) => (env[name] ?? '') !== '');
  return because !== undefined ? { place: 'unattended', because } : { place: 'session' };
}

/**
 * The scope whose matcher matches earliest in a subagent's task text. Two scopes that match at the
 * same place go to the one declared first: the preset's scopes before the user's.
 */
export function taskScope(config: Config, text: string): ScopeChoice {
  let best: { scope: string; matcher: string; at: number } | null = null;
  for (const scope of config.scopes.values())
    for (const m of scope.match) {
      const at = text.search(m.regex);
      if (at >= 0 && (best === null || at < best.at)) best = { scope: scope.name, matcher: m.source, at };
    }
  return best === null ? NO_SCOPE : { scope: best.scope, source: 'task-text', matcher: best.matcher };
}

/** The text the matchers read, and whether the task text was longer than that and so cut. */
export interface TaskText {
  readonly text: string;
  readonly cut: boolean;
}

/**
 * The text the matchers read: the description, then the task text, without any sextant envelope a
 * parent copied into it (the rules' own words must not pick the scope), cut to TASK_TEXT_LIMIT.
 */
export function taskText(description: string | null, prompt: string | null): TaskText {
  const strip = (s: string): string => s.replace(/<sextant-rules(-change)?\b[^>]*>[\s\S]*?<\/sextant-rules\1>/g, '');
  const whole = [description, prompt]
    .filter((s): s is string => s !== null && s !== '')
    .map(strip)
    .join('\n\n');
  return { text: whole.slice(0, TASK_TEXT_LIMIT), cut: whole.length > TASK_TEXT_LIMIT };
}
