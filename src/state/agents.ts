// What the subagent hooks keep between the call that starts a subagent, its start, and its result.
//
//   agent-calls/<tool_use_id>.json  written before the subagent starts: the model noonsight predicted,
//                                   and the rules to hand the subagent when it starts. The result of
//                                   the same call, which carries the same tool_use_id, compares the
//                                   prediction with the model that ran.
//   agent-pools/<session id>.json   the calls of a session whose subagent has not started yet, which a
//                                   subagent's start chooses from, since its input does not name the
//                                   call that started it. Read and changed under agent-pools/<session
//                                   id>.lock only.
//   agent-starts/<agent id>.json    written when a subagent starts: the call it was matched with and
//                                   the rules it was given, given again when the same subagent resumes.
//   agent-links/<agent id>.json     written when a call's result names its subagent before that
//                                   subagent's start has been seen, so the start finds its own call.
//   agents/<agent id>.json          written when a call's result names the subagent and the model it
//                                   started on, so a call made inside that subagent knows the model it
//                                   would inherit.
//
// Every key comes from Claude Code's hook input, and every kind of record is pruned with the others.

import fs from 'node:fs';
import path from 'node:path';
import { writeFileAtomic } from './files.js';

export interface AgentCall {
  readonly session_id: string | null;
  readonly subagent_type: string;
  /** The model the rules were chosen for, or null when noonsight could not tell. */
  readonly predicted: string | null;
  readonly status: 'matched' | 'none' | 'undeclared';
  readonly sha256: string | null;
  /**
   * at-start: the rules are handed to the subagent when it starts. A record an earlier version wrote
   * says rules, for rules it added to the task text.
   */
  readonly delivered: 'at-start' | 'rules' | 'already-delivered' | 'nothing';
  /** The rules to hand the subagent when it starts, with their ids and scope; absent when there are none. */
  readonly text?: string;
  readonly rules?: readonly string[];
  readonly scope?: string | null;
  /** What routing decided for the call; absent in a record an earlier version wrote. */
  readonly routing?: string;
  /** Why routing decided so; absent in a record an earlier version wrote. */
  readonly routing_reason?: string;
  readonly at: string;
}

export interface AgentModel {
  readonly model: string;
  readonly at: string;
}

/** A call whose subagent has not started yet. */
export interface OpenCall {
  readonly id: string;
  readonly type: string;
  readonly at: string;
}

/** A session's calls whose subagent has not started yet. */
export interface Pool {
  readonly open: readonly OpenCall[];
}

/** How a subagent's start was matched with the call that started it. */
export type StartMatch = 'single' | 'result' | 'recent';

export interface AgentStart {
  readonly session_id: string;
  readonly subagent_type: string;
  readonly match: StartMatch;
  /** The call the start was matched with. */
  readonly call: string;
  /** The rules given, or null when it was given none. */
  readonly text: string | null;
  readonly at: string;
}

export interface AgentLink {
  readonly call: string;
  readonly at: string;
}

const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

function keyed(stateDir: string, dir: string, id: string | null, ext = '.json'): string | null {
  return id !== null && SAFE_ID.test(id) ? path.join(stateDir, dir, `${id}${ext}`) : null;
}

export function agentCallFile(stateDir: string, toolUseId: string | null): string | null {
  return keyed(stateDir, 'agent-calls', toolUseId);
}

export function agentFile(stateDir: string, agentId: string | null): string | null {
  return keyed(stateDir, 'agents', agentId);
}

export function poolFile(stateDir: string, sessionId: string | null): string | null {
  return keyed(stateDir, 'agent-pools', sessionId);
}

export function agentStartFile(stateDir: string, agentId: string | null): string | null {
  return keyed(stateDir, 'agent-starts', agentId);
}

export function agentLinkFile(stateDir: string, agentId: string | null): string | null {
  return keyed(stateDir, 'agent-links', agentId);
}

export function readAgentCall(file: string | null): AgentCall | null {
  const v = readJson(file);
  if (
    v !== null &&
    (v.session_id === null || typeof v.session_id === 'string') &&
    typeof v.subagent_type === 'string' &&
    (v.predicted === null || typeof v.predicted === 'string') &&
    (v.status === 'matched' || v.status === 'none' || v.status === 'undeclared') &&
    (v.sha256 === null || typeof v.sha256 === 'string') &&
    (v.delivered === 'at-start' || v.delivered === 'rules' || v.delivered === 'already-delivered' || v.delivered === 'nothing') &&
    (v.text === undefined || typeof v.text === 'string') &&
    (v.rules === undefined || (Array.isArray(v.rules) && v.rules.every((r) => typeof r === 'string'))) &&
    (v.scope === undefined || v.scope === null || typeof v.scope === 'string') &&
    (v.routing === undefined || typeof v.routing === 'string') &&
    (v.routing_reason === undefined || typeof v.routing_reason === 'string')
  )
    return v as unknown as AgentCall;
  return null;
}

export function readAgentModel(file: string | null): string | null {
  const v = readJson(file);
  return v !== null && typeof v.model === 'string' && v.model !== '' ? v.model : null;
}

export function readAgentStart(file: string | null): AgentStart | null {
  const v = readJson(file);
  if (
    v !== null &&
    typeof v.session_id === 'string' &&
    typeof v.subagent_type === 'string' &&
    (v.match === 'single' || v.match === 'result' || v.match === 'recent') &&
    typeof v.call === 'string' &&
    (v.text === null || typeof v.text === 'string')
  )
    return v as unknown as AgentStart;
  return null;
}

export function readAgentLink(file: string | null): AgentLink | null {
  const v = readJson(file);
  return v !== null && typeof v.call === 'string' ? (v as unknown as AgentLink) : null;
}

/** The pool as recorded; an empty pool when there is none or it cannot be read. */
export function readPool(file: string | null): Pool {
  const v = readJson(file);
  const open = Array.isArray(v?.open)
    ? v.open.filter((c): c is OpenCall => isObject(c) && typeof c.id === 'string' && typeof c.type === 'string' && typeof c.at === 'string')
    : [];
  return { open };
}

export function writeRecord(file: string | null, record: AgentCall | AgentModel | AgentStart | AgentLink | Pool): void {
  if (file === null) return;
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  writeFileAtomic(file, `${JSON.stringify(record)}\n`, 0o600);
}

export function removeRecord(file: string | null): void {
  if (file === null) return;
  try {
    fs.rmSync(file, { force: true });
  } catch {
    // Pruned later.
  }
}

/** A lock older than this was left by a hook that was stopped while holding it. */
const LOCK_STALE_MS = 5000;
/** How long a hook waits for another hook of the same session to release the lock. */
const LOCK_WAIT_MS = 3000;
const PAUSE = new Int32Array(new SharedArrayBuffer(4));

/** Pause the hook, which runs synchronously, for a few milliseconds. */
export function pause(ms: number): void {
  Atomics.wait(PAUSE, 0, 0, ms);
}

/**
 * Change a session's pool. The subagent hooks of one session run at the same time, one process each,
 * so the pool is read and written under a lock: a directory, which only one process can create. The
 * change returns the new pool, or null to leave it as it was, and a value for the caller.
 */
export function changePool<T>(stateDir: string, sessionId: string, change: (pool: Pool) => { pool: Pool | null; value: T }): T {
  const file = poolFile(stateDir, sessionId);
  if (file === null) throw new Error('the session id cannot name a file');
  const lock = `${file.slice(0, -'.json'.length)}.lock`;
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const deadline = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    try {
      fs.mkdirSync(lock, { mode: 0o700 });
      break;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
    }
    try {
      if (Date.now() - fs.statSync(lock).mtimeMs > LOCK_STALE_MS) fs.rmSync(lock, { recursive: true, force: true });
    } catch {
      // Released meanwhile.
    }
    if (Date.now() > deadline) throw new Error("another hook of the session held its subagent records too long");
    pause(5);
  }
  try {
    const { pool, value } = change(readPool(file));
    if (pool !== null) {
      if (pool.open.length === 0) removeRecord(file);
      else writeRecord(file, pool);
    }
    return value;
  } finally {
    fs.rmSync(lock, { recursive: true, force: true });
  }
}

function readJson(file: string | null): Record<string, unknown> | null {
  if (file === null) return null;
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
    return isObject(value) ? value : null;
  } catch {
    return null;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
