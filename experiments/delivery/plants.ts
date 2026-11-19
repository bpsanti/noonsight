// The self-check level: failures planted in a copy of the built hook, which the fuzzer must catch and
// the shrinker must reduce to a short sequence that passes on the real build. Each plant changes one
// line of dist/src/adapters/claude-code/hook.js; a plant whose line is no longer in the build refuses
// to apply, so a change to the hook that moves the line shows up here rather than as a plant that
// silently changes nothing.

import fs from 'node:fs';
import path from 'node:path';
import { PACKAGE_ROOT } from '../../src/config/paths.js';
import { failed, sessionKey, signature, type Line } from './fuzz.js';

export interface Plant {
  readonly name: string;
  /** What the change does to noonsight, in a sentence. */
  readonly about: string;
  /** The file it changes, relative to the package root. */
  readonly file: string;
  readonly find: string;
  readonly replace: string;
  /**
   * Whether a session, as it ran on the real build, could show this plant at all: the plant can only
   * be caught in such a session. It counts how many of the exposed sessions the fuzzer caught.
   */
  readonly exposed: (real: Line) => boolean;
}

const HOOK = 'dist/src/adapters/claude-code/hook.js';

type Decision = Record<string, any>;

/** A note a `/model` delivered sits in a request that also holds another model's rule that a note retires. */
function exposedToSwitchNote(r: Line): boolean {
  const switches = (r.decisions as Decision[]).filter((d) => d.event === 'model-switch' && (d.delivered === 'rules+note' || d.delivered === 'note'));
  const fromSwitch = (note: string, d: Decision): boolean => {
    const [from = '', to = ''] = note.split('>');
    return to === d.model && (from === '*' || from.split(' ').includes(String(d.from_model)));
  };
  return r.facts.some((f) => f.kind === 'main' && f.chars.foreignRetired > 0 && switches.some((d) => d.session_id === f.session && String(d.ts) <= f.at && f.notes.some((n) => fromSwitch(n, d))));
}

/** A compaction delivered the rules again, and a request with rules due came after it, before any later delivery. */
function exposedToCompaction(r: Line): boolean {
  const lines = [...(r.decisions as Decision[])].sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
  return lines.some((d, i) => {
    if (!(d.event === 'session-start' && d.source === 'compact' && d.delivered === 'rules')) return false;
    const next = lines.slice(i + 1).find((x) => x.session_id === d.session_id && ['session-start', 'model-switch'].includes(x.event) && /rules/.test(String(x.delivered)));
    return r.facts.some((f) => f.kind === 'main' && f.session === d.session_id && f.covered !== null && f.at >= String(d.ts) && (!next || f.at < String(next.ts)));
  });
}

export const PLANTS: readonly Plant[] = [
  {
    name: 'no-switch-note',
    about: 'A /model switch delivers the new model rules without the note that retires the earlier model rules.',
    file: HOOK,
    find: 'const note = retired.length ? switchNote(from || session?.model || null, to, retired) : null;',
    replace: 'const note = null; /* planted: no model-change note */',
    exposed: exposedToSwitchNote,
  },
  {
    name: 'compact-as-resume',
    about: 'A compaction is treated as a resume, so the rules compaction dropped are not delivered again.',
    file: HOOK,
    find: "const resumed = source === 'resume' || source === 'fork';",
    replace: "const resumed = source === 'resume' || source === 'fork' || source === 'compact'; /* planted: compaction treated as a resume */",
    exposed: exposedToCompaction,
  },
];

export function plantNamed(name: string): Plant {
  const p = PLANTS.find((x) => x.name === name);
  if (!p) throw new Error(`unknown plant ${name}; the plants are ${PLANTS.map((x) => x.name).join(', ')}`);
  return p;
}

/** How many times a plant's line is in this checkout's build: exactly once, or the plant cannot apply. */
export function occurrences(plant: Plant, root = PACKAGE_ROOT): number {
  const text = fs.readFileSync(path.join(root, plant.file), 'utf8');
  return text.split(plant.find).length - 1;
}

/** A copy of the built package in `dir` with the plant applied; returns `dir`. */
export function buildPlant(plant: Plant, dir: string): string {
  const n = occurrences(plant);
  if (n !== 1) throw new Error(`plant ${plant.name}: its line is in ${plant.file} ${n} times, not once; update the plant to the hook as it is now`);
  fs.rmSync(dir, { recursive: true, force: true });
  for (const part of ['dist/src', 'presets', 'schema', 'package.json']) fs.cpSync(path.join(PACKAGE_ROOT, part), path.join(dir, part), { recursive: true });
  const file = path.join(dir, plant.file);
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(plant.find, plant.replace));
  return dir;
}

export interface PlantCheck {
  readonly plant: string;
  readonly sessions: number;
  readonly failedOnReal: number;
  readonly failedOnPlanted: number;
  /** Sessions that fail on the planted build and not on the real one: the plant caught. */
  readonly failedOnlyOnPlanted: readonly string[];
  readonly exposed: number;
  readonly exposedAndCaught: number;
  /** Exposed sessions the planted build did not fail: each one needs a reading. */
  readonly exposedNotCaught: readonly string[];
  /** Sessions failing only on the planted build without being exposed: noise from the harness, or a criterion too narrow. */
  readonly caughtNotExposed: readonly string[];
}

/** Compare the same sessions on the real build and on the planted one. */
export function comparePlant(plant: Plant, real: readonly Line[], planted: readonly Line[]): PlantCheck {
  const realById = new Map(real.map((r) => [sessionKey(r.id), r]));
  const pairs = planted.map((p) => [realById.get(sessionKey(p.id)), p] as const).filter((x): x is readonly [Line, Line] => x[0] !== undefined && x[0].harness === 'ok' && x[1].harness === 'ok');
  // Caught: the planted build fails where the real one did not, in a new way, or in more requests.
  const violating = (l: Line): number => new Set(l.violations.filter((v) => !v.known).map((v) => v.request)).size;
  const caught = pairs.filter(([r, p]) => failed(p) && (!failed(r) || signature(p).some((s) => !signature(r).includes(s)) || violating(p) > violating(r)));
  const exposed = pairs.filter(([r]) => plant.exposed(r));
  const caughtIds = new Set(caught.map(([, p]) => p.id));
  const exposedIds = new Set(exposed.map(([, p]) => p.id));
  return {
    plant: plant.name,
    sessions: pairs.length,
    failedOnReal: pairs.filter(([r]) => failed(r)).length,
    failedOnPlanted: pairs.filter(([, p]) => failed(p)).length,
    failedOnlyOnPlanted: caught.map(([, p]) => p.id),
    exposed: exposed.length,
    exposedAndCaught: exposed.filter(([, p]) => caughtIds.has(p.id)).length,
    exposedNotCaught: exposed.filter(([, p]) => !caughtIds.has(p.id)).map(([, p]) => p.id),
    caughtNotExposed: caught.filter(([, p]) => !exposedIds.has(p.id)).map(([, p]) => p.id),
  };
}
