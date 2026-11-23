// The triggers each session has revealed: one file per session and trigger, under triggers/, named
// <session id>.<trigger>.json and holding what revealed it. A file is created once and never replaced,
// so a session's triggers only grow, and the first hook to create it is the one that delivers the
// rules: several edits of one response run their hooks at the same time, and exactly one of them wins.

import fs from 'node:fs';
import path from 'node:path';
import { TRIGGERS, type Trigger } from '../core/types.js';

/** What revealed a trigger, as the hook saw it. */
export interface TriggerRecord {
  readonly trigger: Trigger;
  readonly tool: string | null;
  /** The file, relative to the root of its repository. */
  readonly file: string;
  readonly at: string;
}

const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

export function triggerFile(stateDir: string, sessionId: string, trigger: Trigger): string | null {
  return SAFE_ID.test(sessionId) ? path.join(stateDir, 'triggers', `${sessionId}.${trigger}.json`) : null;
}

/** The triggers a session has revealed, in the order of TRIGGERS. */
export function sessionTriggers(stateDir: string, sessionId: string | null): Trigger[] {
  if (sessionId === null) return [];
  return TRIGGERS.filter((t) => {
    const file = triggerFile(stateDir, sessionId, t);
    return file !== null && fs.existsSync(file);
  });
}

/**
 * Record that a session revealed a trigger. Returns false when the session had already revealed it,
 * so another hook delivered its rules. Any other failure throws.
 */
export function claimTrigger(stateDir: string, sessionId: string, record: TriggerRecord): boolean {
  const file = triggerFile(stateDir, sessionId, record.trigger);
  if (file === null) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  try {
    fs.writeFileSync(file, `${JSON.stringify(record)}\n`, { flag: 'wx', mode: 0o600 });
    return true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EEXIST') return false;
    throw e;
  }
}

/**
 * Give a session the triggers another revealed, as when a fork starts with the conversation that
 * revealed them. The records are copied as they are; a trigger the session already has stays.
 */
export function inheritTriggers(stateDir: string, from: string, to: string): void {
  for (const trigger of sessionTriggers(stateDir, from)) {
    const source = triggerFile(stateDir, from, trigger);
    if (source === null) continue;
    try {
      claimTrigger(stateDir, to, JSON.parse(fs.readFileSync(source, 'utf8')) as TriggerRecord);
    } catch {
      // Without the record, the fork reveals the trigger again on its next edit of tracked code.
    }
  }
}
