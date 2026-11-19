// The four measures from noonsight's decision log alone, and how far the log can be trusted for them.
//
// The log has one line per decision, not one per request, so this replays each session's lines into
// what its conversation holds after each decision (a "decision point"): an ordered list of the rule
// deliveries and model-change notes still in the conversation. A start or /clear empties it, compaction
// empties it before the delivery that follows, a resume keeps it. The state after a point holds until
// the session's next point, so a request is measured by the last point before it; agree() checks that
// against what the requests of benchmark sessions really held.
//
// The accounting is the oracle's (oracle.ts), on rule ids instead of request text:
//   due       the point's decision is `matched`: the model has rules for this scope, place and triggers
//   covered   every due rule is in the conversation, with no later note that retires the model
//
// The log records what the hook returned to Claude Code, not what reached the model, so it never sees
// a delivery Claude Code dropped. Its numbers are a ceiling wherever two lifecycle events follow each
// other with no request between them.

import fs from 'node:fs';
import path from 'node:path';
import { PACKAGE_ROOT } from '../../src/config/paths.js';
import { envelope, switchNote } from '../../src/core/resolve.js';
import type { Trigger } from '../../src/core/types.js';
import type { Line } from './fuzz.js';
import type { Chars } from './oracle.js';

type Decision = Record<string, any>;

const SESSION_EVENTS = new Set(['session-start', 'model-switch', 'file-edit']);
const PARTS = ['ownFirst', 'ownDuplicate', 'ownUnexpected', 'foreignRetired', 'foreignUnretired'] as const;
type Parts = Pick<Chars, (typeof PARTS)[number] | 'rule'>;

interface Entry {
  readonly key: string;
  readonly length: number | null;
  readonly owners: ReadonlySet<string>;
}

export interface Library {
  get(id: string): Entry | null;
  envelopeOverhead(model: string, scope: string | null, ids: readonly string[], triggers?: readonly Trigger[]): number;
  noteLength(from: string | null, to: string | null): number;
}

/** The preset's rule texts by id: a length, a key identical texts share, and the models that have each. */
export function ruleLibrary(): Library {
  const dir = path.join(PACKAGE_ROOT, 'presets', 'claude');
  const preset = JSON.parse(fs.readFileSync(path.join(dir, 'preset.json'), 'utf8')) as { models: Record<string, { rules: { id: string; file: string }[] }> };
  const byText = new Map<string, { key: string; length: number; owners: Set<string> }>();
  const byId = new Map<string, Entry>();
  for (const [model, entry] of Object.entries(preset.models))
    for (const r of entry.rules) {
      const t = fs.readFileSync(path.join(dir, r.file), 'utf8').trim();
      const e = byText.get(t) ?? { key: r.id, length: t.length, owners: new Set<string>() };
      e.owners.add(model);
      byText.set(t, e);
      byId.set(r.id, e);
    }
  return {
    get: (id) => byId.get(id) ?? null,
    envelopeOverhead: (model, scope, ids, triggers = []) => envelope(model, scope, ids, '', triggers).length,
    noteLength: (from, to) => switchNote(from ?? '', to ?? '').length,
  };
}

interface Item {
  readonly type: 'note' | 'rules';
  readonly from?: string | null;
  readonly model?: string;
  readonly ids?: readonly string[];
}

interface Account {
  readonly chars: Parts;
  /** A delivered rule the preset does not have (a user's own rule): its length is unknown. */
  readonly unknownLength: boolean;
  readonly missing: number;
  readonly ownRetired: boolean;
  readonly foreignUnretired: boolean;
}

/** What a conversation holds for a request of `model` that should have the rules `expected`. */
function account(items: readonly Item[], model: string, expected: readonly string[], lib: Library, unknown: Set<string>): Account {
  const entryOf = (id: string, owner: string): Entry => {
    const e = lib.get(id);
    if (e) return e;
    unknown.add(id);
    return { key: id, length: null, owners: new Set([owner]) };
  };
  const keys = new Map<string, { e: Entry; copies: number; last: number }>();
  const notes: { at: number; from: string | null }[] = [];
  items.forEach((it, at) => {
    if (it.type === 'note') {
      notes.push({ at, from: it.from ?? null });
      return;
    }
    for (const id of it.ids ?? []) {
      const e = entryOf(id, it.model ?? model);
      const k = keys.get(e.key) ?? { e, copies: 0, last: -1 };
      k.copies++;
      k.last = at;
      keys.set(e.key, k);
    }
  });
  const retiredAfter = (owners: ReadonlySet<string>, at: number): boolean => notes.some((n) => n.from !== null && owners.has(n.from) && n.at > at);
  const want = new Set(expected.map((id) => entryOf(id, model).key));
  const c = { ownFirst: 0, ownDuplicate: 0, ownUnexpected: 0, foreignRetired: 0, foreignUnretired: 0 };
  let unknownLength = false;
  let ownRetired = false;
  let foreignUnretired = false;
  for (const [key, k] of keys) {
    const len = k.e.length ?? 0;
    if (k.e.length === null) unknownLength = true;
    if (k.e.owners.has(model)) {
      if (want.has(key)) {
        c.ownFirst += len;
        c.ownDuplicate += (k.copies - 1) * len;
        if (retiredAfter(new Set([model]), k.last)) ownRetired = true;
      } else c.ownUnexpected += k.copies * len;
    } else if (retiredAfter(k.e.owners, k.last)) c.foreignRetired += k.copies * len;
    else {
      c.foreignUnretired += k.copies * len;
      foreignUnretired = true;
    }
  }
  const rule = PARTS.reduce((n, p) => n + c[p], 0);
  return { chars: { ...c, rule }, unknownLength, missing: [...want].filter((key) => !keys.has(key)).length, ownRetired, foreignUnretired };
}

export interface Point extends Account {
  readonly session: string;
  readonly ts: string;
  readonly event: string;
  readonly source: string | null;
  readonly model: string | null;
  readonly due: boolean;
  readonly covered: boolean | null;
  readonly modelSource: string | null;
  readonly warned: boolean;
  /** What this decision added to the conversation, envelope and note included. */
  readonly deliveredChars: number;
}

export interface Subagent {
  readonly due: boolean;
  readonly delivered: boolean;
  readonly covered: boolean | null;
  readonly why: string | null;
  readonly match: string | null;
  readonly result: string | null;
  readonly chars: number;
  /** Rules delivered for a model the result says the subagent did not run on. */
  readonly foreign: boolean;
}

export interface Replay {
  readonly points: readonly Point[];
  readonly subagents: readonly Subagent[];
  readonly lifecycleBySession: readonly number[];
  readonly failures: readonly { event: string; status: string }[];
  readonly unknownRules: number;
}

/** Replay a decision log, sorted by time. */
export function replay(decisions: readonly Decision[], lib: Library): Replay {
  const unknown = new Set<string>();
  const sessions = new Map<string, { items: Item[]; expected: string[]; model: string | null; known: boolean; events: string[] }>();
  const points: Point[] = [];
  const calls = new Map<string, { call: Decision; start: Decision | null; result: Decision | null }>();
  const subagents: Subagent[] = [];
  const failures: { event: string; status: string }[] = [];
  for (const d of decisions) {
    const sid = String(d.session_id ?? '');
    if (d.status === 'error' || d.status === 'config-invalid') failures.push({ event: String(d.event), status: String(d.status) });
    if (d.event === 'agent-call') {
      calls.set(String(d.tool_use_id), { call: d, start: null, result: null });
      continue;
    }
    if (d.event === 'subagent-start') {
      const c = d.call_id ? calls.get(String(d.call_id)) : undefined;
      if (c) c.start = d;
      else {
        const due = d.status === 'matched';
        const delivered = d.delivered === 'rules';
        subagents.push({ due, delivered, covered: due ? delivered : null, why: d.reason ?? null, match: d.start_match ?? null, result: null, chars: 0, foreign: false });
      }
      continue;
    }
    if (d.event === 'agent-result') {
      const c = calls.get(String(d.tool_use_id));
      if (c) c.result = d;
      continue;
    }
    if (!SESSION_EVENTS.has(String(d.event))) continue;
    let s = sessions.get(sid);
    const fresh = d.event === 'session-start' && (d.source === 'startup' || d.source === 'clear');
    if (!s || fresh) {
      // A resume of a conversation whose earlier lines are not in the log: what it holds is not known.
      s = { items: [], expected: [], model: null, known: fresh || !s ? fresh : true, events: s?.events ?? [] };
      sessions.set(sid, s);
    }
    if (d.event === 'session-start' && d.source === 'compact') s.items = [];
    const delivered = String(d.delivered ?? '');
    let deliveredChars = 0;
    if (delivered === 'rules+note' || delivered === 'note') {
      s.items.push({ type: 'note', from: d.from_model ?? null });
      deliveredChars += lib.noteLength(d.from_model ?? null, d.model ?? null);
    }
    const ids = (d.rules ?? []) as string[];
    if (delivered === 'rules' || delivered === 'rules+note' || delivered === 'launcher') {
      s.items.push({ type: 'rules', model: d.model, ids });
      if (delivered !== 'launcher') {
        deliveredChars += lib.envelopeOverhead(String(d.model), d.scope ?? null, ids, d.trigger ? [d.trigger] : []);
        for (const id of ids) deliveredChars += lib.get(id)?.length ?? 0;
      }
    } else if (delivered === 'already-delivered' && !s.known && d.status === 'matched' && !s.items.some((it) => it.type === 'rules' && it.model === d.model)) {
      // The session's record says the conversation holds them; the log has no line of that delivery.
      s.items.push({ type: 'rules', model: d.model, ids });
    }
    if (d.status === 'matched') s.expected = d.event === 'file-edit' && d.model === s.model ? [...new Set([...s.expected, ...ids])] : ids;
    // An edit that adds no rule leaves the session's rules as they were.
    else if (d.event !== 'file-edit' && (d.status === 'none' || d.status === 'undeclared')) s.expected = [];
    s.model = d.model ?? s.model;
    s.events.push(d.event === 'session-start' ? String(d.source) : String(d.event));
    const a = account(s.items, s.model ?? '', s.expected, lib, unknown);
    const due = d.event === 'file-edit' ? s.expected.length > 0 : d.status === 'matched';
    points.push({
      session: sid,
      ts: String(d.ts),
      event: String(d.event),
      source: d.source ?? null,
      model: s.model,
      due,
      covered: due ? a.missing === 0 && !a.ownRetired : null,
      modelSource: d.model_source ?? null,
      warned: Boolean(d.warned),
      deliveredChars,
      ...a,
    });
  }
  for (const { call, start, result } of calls.values()) {
    if (!start && !result) continue; // a call whose subagent never started
    const ids = ((start ?? call).rules ?? []) as string[];
    const delivered = start?.delivered === 'rules';
    const mismatch = result?.result === 'MISMATCH';
    const due = call.status === 'matched';
    subagents.push({
      due,
      delivered,
      covered: due ? delivered && !mismatch : null,
      why: start?.reason ?? (due && !delivered ? `call-${call.delivered}` : null),
      match: start?.start_match ?? null,
      result: result?.result ?? null,
      chars: delivered ? ids.reduce((n, id) => n + (lib.get(id)?.length ?? 0), 0) + lib.envelopeOverhead(String(call.model), null, ids) : 0,
      foreign: delivered && mismatch,
    });
  }
  return {
    points,
    subagents,
    lifecycleBySession: [...sessions.values()].map((s) => s.events.filter((e) => e !== 'startup').length),
    failures,
    unknownRules: unknown.size,
  };
}

const share = (n: number, d: number): number | null => (d ? Math.round((10000 * n) / d) / 10000 : null);

function count<T>(xs: readonly T[], f: (x: T) => string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of xs) out[f(x)] = (out[f(x)] ?? 0) + 1;
  return out;
}

/** The measures of a replayed log, as aggregates: no session id, path, rule text or prompt. */
export function aggregate(r: Replay) {
  const { points, subagents } = r;
  const due = points.filter((p) => p.due);
  const sum = <T>(xs: readonly T[], f: (x: T) => number): number => xs.reduce((n, x) => n + f(x), 0);
  const own = (p: Point): number => p.chars.ownFirst + p.chars.ownDuplicate + p.chars.ownUnexpected;
  const withRules = points.filter((p) => p.chars.rule > 0);
  const subDue = subagents.filter((s) => s.due);
  const delivering = points.filter((p) => p.deliveredChars > 0);
  const bySession = new Map<string, number>();
  for (const p of points) bySession.set(p.session, (bySession.get(p.session) ?? 0) + p.deliveredChars);
  const later = due.filter((p) => !(p.event === 'session-start' && p.source === 'startup'));
  return {
    sessions: bySession.size,
    decisionPoints: points.length,
    subagents: subagents.length,
    coverage: {
      points: { due: due.length, covered: due.filter((p) => p.covered).length, share: share(due.filter((p) => p.covered).length, due.length) },
      afterALifecycleEvent: { due: later.length, covered: later.filter((p) => p.covered).length },
      subagents: { due: subDue.length, covered: subDue.filter((s) => s.covered).length, share: share(subDue.filter((s) => s.covered).length, subDue.length), notCoveredWhy: count(subDue.filter((s) => !s.covered), (s) => (s.foreign ? 'MISMATCH' : (s.why ?? 'unknown'))) },
    },
    precision: {
      pointsWithRules: withRules.length,
      ownShare: share(sum(withRules, own), sum(withRules, (p) => p.chars.rule)),
      pointsWithForeignNoNote: points.filter((p) => p.foreignUnretired).length,
      pointsWithUnknownLength: withRules.filter((p) => p.unknownLength).length,
      subagentsWithForeign: subagents.filter((s) => s.foreign).length,
    },
    cost: {
      deliveries: delivering.length,
      charsPerDelivery: delivering.length ? Math.round(sum(delivering, (p) => p.deliveredChars) / delivering.length) : null,
      maxCharsPerDelivery: delivering.reduce((m, p) => Math.max(m, p.deliveredChars), 0),
      sessionsWithNoDelivery: [...bySession.values()].filter((x) => x === 0).length,
      loggedHookRuns: points.length + subagents.length,
    },
    robustness: {
      failures: count(r.failures, (f) => `${f.event}:${f.status}`),
      warnedPoints: points.filter((p) => p.warned).length,
      modelSource: count(points, (p) => String(p.modelSource)),
      events: count(points, (p) => (p.event === 'session-start' ? `start:${p.source}` : p.event)),
      sessionsByLifecycleEvents: count(r.lifecycleBySession, (n) => (n === 0 ? '0' : n <= 2 ? '1-2' : n <= 5 ? '3-5' : '6+')),
      subagentResults: count(subagents, (s) => String(s.result)),
    },
    unknownRules: r.unknownRules,
  };
}

export function readLog(file: string): Decision[] {
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .flatMap((l) => {
      try {
        return [JSON.parse(l) as Decision];
      } catch {
        return [];
      }
    })
    .sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
}

/**
 * Does the log tell the truth about the requests? For benchmark sessions, where the stub saw every
 * request, compare request by request what the replayed log says the conversation held with what the
 * request really held, and say whether every session where they differ has two quiet steps in a row.
 */
export function agree(lines: readonly Line[], lib: Library, quietPair: (l: Line) => boolean) {
  const t = { sessions: 0, mainRequests: 0, model: 0, due: 0, covered: 0, chars: 0, all: 0 };
  const log = { due: 0, covered: 0, own: 0, rule: 0 };
  const stub = { due: 0, covered: 0, own: 0, rule: 0 };
  const differ: { id: string; quietPair: boolean }[] = [];
  for (const r of lines.filter((x) => x.harness === 'ok')) {
    t.sessions++;
    const { points } = replay(
      [...(r.decisions as Decision[])].sort((a, b) => String(a.ts).localeCompare(String(b.ts))),
      lib,
    );
    let wrong = false;
    for (const f of r.facts.filter((x) => x.kind === 'main')) {
      t.mainRequests++;
      const p = points.filter((x) => x.session === f.session && x.ts <= f.at).at(-1);
      if (!p) {
        wrong = true;
        continue;
      }
      const sameModel = p.model === f.model;
      const sameDue = p.due === (f.covered !== null);
      const sameCovered = (p.due ? p.covered : null) === f.covered;
      const sameChars = PARTS.every((k) => p.chars[k] === f.chars[k]);
      t.model += Number(sameModel);
      t.due += Number(sameDue);
      t.covered += Number(sameCovered);
      t.chars += Number(sameChars);
      if (sameModel && sameDue && sameCovered && sameChars) t.all++;
      else wrong = true;
      if (p.due) {
        log.due++;
        if (p.covered) log.covered++;
      }
      if (f.covered !== null) {
        stub.due++;
        if (f.covered) stub.covered++;
      }
      log.own += p.chars.ownFirst + p.chars.ownDuplicate + p.chars.ownUnexpected;
      log.rule += p.chars.rule;
      stub.own += f.chars.ownFirst + f.chars.ownDuplicate + f.chars.ownUnexpected;
      stub.rule += f.chars.rule;
    }
    if (wrong) differ.push({ id: r.id, quietPair: quietPair(r) });
  }
  return {
    ...t,
    coverage: { log: share(log.covered, log.due), stub: share(stub.covered, stub.due) },
    ownShare: { log: share(log.own, log.rule), stub: share(stub.own, stub.rule) },
    sessionsWhereTheyDiffer: differ.length,
    ofWhichWithoutTwoQuietStepsInARow: differ.filter((d) => !d.quietPair).map((d) => d.id),
  };
}
