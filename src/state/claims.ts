// One claim per event occurrence. Claude Code runs the hooks of every place noonsight is installed in,
// a settings file and a plugin alike, so two installs would each deliver the same event, and change the
// records of open subagent calls at the same time. Both copies get the same bytes on standard input from
// the same Claude Code process, which identifies the occurrence, so the first copy to claim it runs and
// the others do nothing:
//
//   nothing claimed it, or the claim is older than WINDOW_MS: claim it and run
//   another kind of install claimed it: do nothing
//   this kind of install claimed it: the same input came again, so claim it again and run
//
// A failure to read, write or lock a claim runs the hook: delivering twice is the safe direction.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { InstallKind } from './installs.js';
import { writeFileAtomic } from './files.js';

/** Far longer than the copies of one occurrence are apart: Claude Code starts them together and stops each after 10 seconds. */
const WINDOW_MS = 60_000;
/** How long a copy waits for the lock before it runs without a claim. */
const LOCK_WAIT_MS = 500;
/** A lock this old was left by a copy that was stopped while it held it. */
const LOCK_STALE_MS = 5_000;

const WAIT = new Int32Array(new SharedArrayBuffer(4));

export interface Occurrence {
  /** The hook argument, such as "session-start". */
  readonly event: string;
  /** The Claude Code process that started the hook. */
  readonly parentPid: number;
  /** The hook input, exactly as read. */
  readonly input: string;
}

/** Whether this copy is the one that runs the occurrence. */
export function claimOccurrence(stateDir: string, kind: InstallKind, o: Occurrence, now: number): boolean {
  const key = createHash('sha256').update(`${o.event}\0${o.parentPid}\0${o.input}`).digest('hex');
  const dir = path.join(stateDir, 'claims');
  const file = path.join(dir, `${key}.json`);
  const lock = path.join(dir, `${key}.lock`);
  try {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    if (!takeLock(lock)) return true;
    try {
      const claim = readClaim(file);
      if (claim !== null && claim.kind !== kind && Math.abs(now - claim.at) < WINDOW_MS) return false;
      writeFileAtomic(file, `${JSON.stringify({ kind, at: now })}\n`, 0o600);
      return true;
    } finally {
      fs.rmSync(lock, { force: true });
    }
  } catch {
    return true;
  }
}

function readClaim(file: string): { kind: string; at: number } | null {
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8')) as { kind?: unknown; at?: unknown };
    return typeof value.kind === 'string' && typeof value.at === 'number' ? { kind: value.kind, at: value.at } : null;
  } catch {
    return null;
  }
}

function takeLock(lock: string): boolean {
  const until = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    try {
      fs.writeFileSync(lock, '', { flag: 'wx', mode: 0o600 });
      return true;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
    }
    try {
      if (Date.now() - fs.statSync(lock).mtimeMs > LOCK_STALE_MS) fs.rmSync(lock, { force: true });
    } catch {
      // Released meanwhile.
    }
    if (Date.now() >= until) return false;
    Atomics.wait(WAIT, 0, 0, 2);
  }
}
