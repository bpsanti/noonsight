// The decision log: one JSON object per line, one line per decision a hook makes. It is only ever
// appended to, so it can be read with any line tool while sessions write to it.

import fs from 'node:fs';
import path from 'node:path';

export const LOG_FILE = 'decisions.jsonl';

/** Past this size the log is moved to decisions.1.jsonl (replacing an older one) and a new log starts. */
export const LOG_MAX_BYTES = 20 * 1024 * 1024;

export function logFile(stateDir: string): string {
  return path.join(stateDir, LOG_FILE);
}

/** Append one decision. The caller decides what a failure means; hooks ignore it. */
export function appendDecision(stateDir: string, record: Readonly<Record<string, unknown>>): void {
  fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 });
  const file = logFile(stateDir);
  try {
    if (fs.statSync(file).size >= LOG_MAX_BYTES) fs.renameSync(file, path.join(stateDir, 'decisions.1.jsonl'));
  } catch {
    // No log yet, or another session rotated it first.
  }
  // One write call per line, opened for append, so lines from concurrent sessions never interleave.
  fs.appendFileSync(file, `${JSON.stringify(record)}\n`, { mode: 0o600 });
}

/** The last line of the log, parsed, or null when there is no log or no readable line. */
export function lastDecision(stateDir: string): Record<string, unknown> | null {
  let text: string;
  try {
    // Only the end of the file is read, so the cost does not grow with the log.
    const fd = fs.openSync(logFile(stateDir), 'r');
    try {
      const size = fs.fstatSync(fd).size;
      const length = Math.min(size, 64 * 1024);
      const buffer = Buffer.alloc(length);
      fs.readSync(fd, buffer, 0, length, size - length);
      text = buffer.toString('utf8');
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return null;
  }
  const lines = text.trimEnd().split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const value = JSON.parse(lines[i] ?? '') as unknown;
      if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
    } catch {
      // A torn or foreign line; look further back.
    }
  }
  return null;
}
