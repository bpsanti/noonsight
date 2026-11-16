// Overlapping scopes: two scopes a single task can fall in. sextant still picks one, by fixed rules
// (scope.ts), but the person declared two scopes for the same task, and `sextant check` says so.
//
// Two scopes overlap when they list the same subagent type, or when a text that one scope's matcher
// matches is also matched by the other's. That text is the evidence: it comes from the examples
// regex-sample.ts builds, each of which really matches. A matcher with no example cannot be tested.

import { regexSamples } from './regex-sample.js';
import { taskScope } from './scope.js';
import { MATCHER_FLAGS, type Config, type Scope } from './types.js';

export type Overlap =
  | {
      readonly kind: 'agent-type';
      readonly agentType: string;
      /** Every scope that lists the type, in declaration order; the first one wins. */
      readonly scopes: readonly string[];
    }
  | {
      readonly kind: 'match';
      readonly scopes: readonly [string, string];
      /** A task text both scopes match. */
      readonly text: string;
      /** The scope a task with exactly that text gets. */
      readonly winner: string | null;
    };

export interface OverlapReport {
  readonly overlaps: readonly Overlap[];
  /** How many matchers were compared. */
  readonly matchers: number;
  /** Matchers no example text could be built for, so their overlaps are not known. */
  readonly untested: readonly { readonly scope: string; readonly matcher: string }[];
}

export function scopeOverlaps(config: Config): OverlapReport {
  const scopes = [...config.scopes.values()];
  const overlaps: Overlap[] = [];

  const byType = new Map<string, string[]>();
  for (const s of scopes) for (const t of s.agentTypes) byType.set(t, [...(byType.get(t) ?? []), s.name]);
  for (const [agentType, names] of byType) if (names.length > 1) overlaps.push({ kind: 'agent-type', agentType, scopes: names });

  const untested: { scope: string; matcher: string }[] = [];
  const samples = new Map<Scope, string[]>();
  for (const s of scopes) {
    const all: string[] = [];
    for (const m of s.match) {
      const found = regexSamples(m.source, MATCHER_FLAGS);
      if (found.length === 0) untested.push({ scope: s.name, matcher: m.source });
      all.push(...found);
    }
    samples.set(s, all);
  }

  scopes.forEach((a, i) => {
    for (const b of scopes.slice(i + 1)) {
      const text = witness(samples.get(a) ?? [], b) ?? witness(samples.get(b) ?? [], a);
      if (text === undefined) continue;
      const winner = taskScope(config, { agentType: null, prompt: text }).scope;
      overlaps.push({ kind: 'match', scopes: [a.name, b.name], text: text.trim(), winner });
    }
  });

  return { overlaps, matchers: scopes.reduce((n, s) => n + s.match.length, 0), untested };
}

/** The first example text that one of the scope's matchers also matches. */
function witness(texts: readonly string[], scope: Scope): string | undefined {
  return texts.find((t) => scope.match.some((m) => m.regex.test(t)));
}
