// The corpus level: short hand-kept sequences, one per file in corpus/, each with the outcome it must
// have under `on`. A sequence expected to pass must break no part of the invariant; a sequence that
// reproduces a known failure or a documented limit names the violations it must show, so the corpus
// stays green while the failure is open and goes red the day it changes, when the entry's expectation
// becomes "pass".

import fs from 'node:fs';
import path from 'node:path';
import { PACKAGE_ROOT } from '../../src/config/paths.js';
import { valid, type Sequence } from './generate.js';
import { signature, type Line } from './fuzz.js';
import { isAgent } from './oracle.js';

export const CORPUS_DIR = path.join(PACKAGE_ROOT, 'experiments', 'delivery', 'corpus');

export interface Entry extends Sequence {
  readonly name: string;
  /** What the sequence checks, in a sentence or two. */
  readonly about: string;
  /** "pass", or the known failure the sequence reproduces and the `class/kind` violations it must show. */
  readonly expect: 'pass' | { readonly failure: string; readonly shows: readonly string[] };
  /**
   * Also hold every request to no rule of its model that is not due there (`own-unexpected`), which the
   * invariant leaves to the precision measure: a trigger revealed by mistake shows only this way.
   */
  readonly exact?: true;
}

export function readCorpus(dir = CORPUS_DIR): Entry[] {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      const e = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as Entry;
      if (`${e.name}.json` !== f) throw new Error(`corpus/${f}: its name is ${e.name}`);
      if (!valid(e)) throw new Error(`corpus/${f}: the sequence cannot be driven`);
      return e;
    });
}

/**
 * - as-expected: a passing entry passed, or a failing one showed every violation it names;
 * - fixed: an entry expected to fail broke nothing: the failure is gone, so the entry should now pass;
 * - regressed: an entry expected to pass broke the invariant;
 * - changed: an entry expected to fail broke it, but not in every way it names;
 * - nothing-due: no request had a rule due, so a pass would say nothing;
 * - harness: the driver could not run the sequence, so nothing was measured.
 */
export type Outcome = 'as-expected' | 'fixed' | 'regressed' | 'changed' | 'nothing-due' | 'harness';

export interface Checked {
  readonly name: string;
  readonly expect: Entry['expect'];
  readonly outcome: Outcome;
  readonly harness: string;
  /** The `class/kind` of every unexplained violation the session showed. */
  readonly shows: readonly string[];
  /** Requests of the session or a subagent that had a rule due. */
  readonly due: number;
  readonly seconds: number;
}

export function check(entry: Entry, line: Line): Checked {
  const unexpected = entry.exact ? [...new Set(line.facts.filter((f) => isAgent(f) && f.chars.ownUnexpected > 0).map((f) => `own-unexpected/${f.kind}`))] : [];
  const shows = [...signature(line), ...unexpected].sort();
  const due = line.facts.filter((f) => isAgent(f) && f.covered !== null).length;
  let outcome: Outcome;
  if (line.harness !== 'ok') outcome = 'harness';
  else if (!due) outcome = 'nothing-due';
  else if (entry.expect === 'pass') outcome = shows.length ? 'regressed' : 'as-expected';
  else if (!shows.length) outcome = 'fixed';
  else outcome = entry.expect.shows.every((s) => shows.includes(s)) ? 'as-expected' : 'changed';
  return { name: entry.name, expect: entry.expect, outcome, harness: line.harness, shows, due, seconds: Math.round(line.ms / 1000) };
}
