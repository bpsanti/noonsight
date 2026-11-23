// The conversation a fork copied. Claude Code forks a conversation three ways, each a session with a
// new id whose SessionStart has the source "fork":
//
//   claude --resume <id> --fork-session    a new process
//   claude --continue --fork-session       a new process
//   /branch                                the same process
//   /fork                                  a background session
//
// The new id has no record of its own, while the conversation it starts with holds what the original
// held: the rules delivered to it, a delivery that may not have arrived yet, and the triggers it
// revealed. A fork in a new process also runs on the model the original last answered on, as a resume
// does. When the hook runs, the fork's own transcript holds the copied conversation only after /branch,
// so the original is found, in this order:
//
//   1. the fork's transcript: the entries /branch copies name the original in `forkedFrom.sessionId`;
//   2. the background job of /fork: `forkParentSessionId` in `state.json`, in the directory
//      CLAUDE_JOB_DIR names, which also gives the model the job was started with (`--model` among its
//      `respawnFlags`);
//   3. the Claude Code command line, with `--fork-session`: the session id given to `--resume` or
//      `-r`; or, with `--continue` or `-c`, the transcript Claude Code continues, the most recently
//      written one in the fork's transcript folder other than the fork's own.
//
// None of these is documented by Claude Code; each was recorded on 2.1.330 (docs/verification/claude-code.md).

import fs from 'node:fs';
import path from 'node:path';
import type { Env } from '../../config/paths.js';
import { optionCandidates, type CommandLine } from './launch.js';

export interface ForkOrigin {
  /** The session id of the conversation the fork copied. */
  readonly sessionId: string;
  /** That conversation's transcript, or null when it is not where the fork's own transcript is. */
  readonly transcript: string | null;
  /** How it was found, as the decision log records it. */
  readonly via: 'fork-transcript' | 'background-job' | 'resume-argument' | 'continue';
  /** The `--model` value a background job was started with, as written. */
  readonly model?: string;
}

const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

/** A Claude Code session id. */
const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** How far into the fork's transcript the link to the original is looked for. */
const HEAD_BYTES = 256 * 1024;

export function forkOrigin(transcriptPath: string | null, env: Env, commandLine: () => CommandLine | null): ForkOrigin | null {
  const folder = transcriptPath !== null ? path.dirname(transcriptPath) : null;
  const own = transcriptPath !== null ? path.basename(transcriptPath, '.jsonl') : null;
  const transcriptOf = (id: string): string | null => {
    if (folder === null) return null;
    const file = path.join(folder, `${id}.jsonl`);
    return fs.existsSync(file) ? file : null;
  };
  const found = (sessionId: string, via: ForkOrigin['via'], model?: string): ForkOrigin | null =>
    SAFE_ID.test(sessionId) && sessionId !== own ? { sessionId, transcript: transcriptOf(sessionId), via, ...(model !== undefined ? { model } : {}) } : null;

  const branched = transcriptPath !== null ? forkedFrom(transcriptPath) : null;
  if (branched !== null) return found(branched, 'fork-transcript');

  const job = backgroundJob(env);
  if (job !== null) return found(job.parent, 'background-job', job.model ?? undefined);

  const cmd = commandLine();
  if (cmd === null || !cmd.args.includes('--fork-session')) return null;
  const resumed = [...optionCandidates(cmd, '--resume'), ...optionCandidates(cmd, '-r')];
  // `--resume` also takes a name or a search term, and alone opens a picker: only a session id names the original.
  if (resumed.length === 1 && SESSION_ID.test(resumed[0] as string)) return found(resumed[0] as string, 'resume-argument');
  if (resumed.length === 0 && (cmd.args.includes('--continue') || cmd.args.includes('-c'))) {
    const latest = latestTranscript(folder, own);
    if (latest !== null) return found(latest, 'continue');
  }
  return null;
}

/** The session id the first entry of a transcript that names one was forked from. */
function forkedFrom(file: string): string | null {
  let head: string;
  try {
    const fd = fs.openSync(file, 'r');
    try {
      const buffer = Buffer.alloc(HEAD_BYTES);
      head = buffer.toString('utf8', 0, fs.readSync(fd, buffer, 0, HEAD_BYTES, 0));
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return null;
  }
  for (const line of head.split('\n')) {
    if (!line.includes('"forkedFrom"')) continue;
    try {
      const id = (JSON.parse(line) as { forkedFrom?: { sessionId?: unknown } }).forkedFrom?.sessionId;
      if (typeof id === 'string') return id;
    } catch {
      // A line the read cut, or not a record.
    }
  }
  return null;
}

/** The original of a background job's session, and the model the job was started with. */
function backgroundJob(env: Env): { parent: string; model: string | null } | null {
  const dir = env.CLAUDE_JOB_DIR;
  if (!dir) return null;
  try {
    const state = JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8')) as { forkParentSessionId?: unknown; respawnFlags?: unknown };
    if (typeof state.forkParentSessionId !== 'string') return null;
    const flags = Array.isArray(state.respawnFlags) ? state.respawnFlags : [];
    const at = flags.lastIndexOf('--model');
    const model = at >= 0 && typeof flags[at + 1] === 'string' ? (flags[at + 1] as string) : null;
    return { parent: state.forkParentSessionId, model };
  } catch {
    return null;
  }
}

/** The session id of the most recently written transcript in a folder, other than `own`. */
function latestTranscript(folder: string | null, own: string | null): string | null {
  if (folder === null) return null;
  let best: { id: string; at: number } | null = null;
  try {
    for (const name of fs.readdirSync(folder)) {
      if (!name.endsWith('.jsonl')) continue;
      const id = name.slice(0, -'.jsonl'.length);
      if (id === own) continue;
      const at = fs.statSync(path.join(folder, name)).mtimeMs;
      if (best === null || at > best.at) best = { id, at };
    }
  } catch {
    return null;
  }
  return best?.id ?? null;
}
