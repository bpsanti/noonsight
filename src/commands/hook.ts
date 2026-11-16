import fs from 'node:fs';
import os from 'node:os';
import { runHook } from '../adapters/claude-code/hook.js';
import type { InstallKind } from '../adapters/claude-code/locations.js';
import type { Env } from '../config/paths.js';
import { packageVersion } from '../version.js';

export const HOOK_USAGE = `usage: sextant hook [--install managed|account] <session-start|model-switch|agent-call|agent-result>

The Claude Code hook adapter; the hook pointer written by \`sextant install\` runs it. It reads the
hook input on stdin, prints at most one JSON object, writes the decision log, and always exits 0.`;

/** Runs a hook event. Always returns 0: a hook never holds or fails the session. */
export function runHookCommand(args: readonly string[], env: Env, out: (text: string) => void): number {
  let install: InstallKind | null = null;
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--install') {
      const kind = args[++i];
      if (kind === 'managed' || kind === 'account') install = kind;
    } else if (a !== undefined) rest.push(a);
  }
  if (rest.length !== 1) return 0;
  const stdout = runHook(rest[0] ?? '', readStdin(), {
    env,
    home: os.homedir(),
    now: new Date(),
    version: safeVersion(),
    install,
    parentPid: process.ppid,
  });
  if (stdout) out(stdout);
  return 0;
}

const RETRY_WAIT = new Int32Array(new SharedArrayBuffer(4));

/** The whole hook input. A pipe that is not yet written makes a read fail with EAGAIN, so it is retried. */
function readStdin(): string {
  // A terminal would block the read; hooks always get a pipe.
  if (process.stdin.isTTY) return '';
  const chunks: Buffer[] = [];
  const chunk = Buffer.alloc(64 * 1024);
  for (;;) {
    let n: number;
    try {
      n = fs.readSync(0, chunk, 0, chunk.length, null);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'EAGAIN') {
        Atomics.wait(RETRY_WAIT, 0, 0, 1);
        continue;
      }
      return '';
    }
    if (n === 0) return Buffer.concat(chunks).toString('utf8');
    chunks.push(Buffer.from(chunk.subarray(0, n)));
  }
}

function safeVersion(): string {
  try {
    return packageVersion();
  } catch {
    return 'unknown';
  }
}
