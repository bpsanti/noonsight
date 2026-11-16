// Overlapping scopes: two scopes a single task can fall in. sextant still picks one, by fixed rules
// (scope.ts), but the person declared two scopes for the same task, and `sextant check` says so.
//
// Two scopes overlap when a text that one scope's matcher matches is also matched by the other's.
// That text is the evidence: it comes from the examples regex-sample.ts builds, each of which really
// matches. A matcher whose examples are incomplete cannot be fully tested, so it is reported.

import { regexSamples } from './regex-sample.js';
import { taskScope } from './scope.js';
import { MATCHER_FLAGS, type Config, type Scope } from './types.js';

export interface Overlap {
  readonly scopes: readonly [string, string];
  /** A task text both scopes match, exactly as it was tested. */
  readonly text: string;
  /** The scope a task with exactly that text gets. */
  readonly winner: string | null;
}

export interface OverlapReport {
  readonly overlaps: readonly Overlap[];
  /** How many matchers were compared. */
  readonly matchers: number;
  /** Matchers whose example texts are incomplete, so their overlaps are not fully checked. */
  readonly untested: readonly { readonly scope: string; readonly matcher: string }[];
}

export function scopeOverlaps(config: Config): OverlapReport {
  const scopes = [...config.scopes.values()];
  const overlaps: Overlap[] = [];

  const untested: { scope: string; matcher: string }[] = [];
  const samples = new Map<Scope, string[]>();
  for (const s of scopes) {
    const all: string[] = [];
    for (const m of s.match) {
      const found = regexSamples(m.source, MATCHER_FLAGS);
      if (!found.complete) untested.push({ scope: s.name, matcher: m.source });
      all.push(...found.texts);
    }
    samples.set(s, all);
  }

  scopes.forEach((a, i) => {
    for (const b of scopes.slice(i + 1)) {
      const text = witness(samples.get(a) ?? [], b) ?? witness(samples.get(b) ?? [], a);
      if (text === undefined) continue;
      overlaps.push({ scopes: [a.name, b.name], text, winner: taskScope(config, { prompt: text }) });
    }
  });

  return { overlaps, matchers: scopes.reduce((n, s) => n + s.match.length, 0), untested };
}

/** The first example text that one of the scope's matchers also matches. */
function witness(texts: readonly string[], scope: Scope): string | undefined {
  return texts.find((t) => scope.match.some((m) => m.regex.test(t)));
}
