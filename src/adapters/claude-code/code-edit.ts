// Whether an edit reveals the code-edit trigger: the session edited, with Edit or Write, a file with a
// code extension that the git repository of the session's project already tracks.
//
// Each condition keeps out an edit that does not show the session building:
//   - a code extension keeps out reports, notes, documents, styles, data and settings (core/triggers.ts);
//   - a tracked file keeps out every new file, so a script or a report the session writes for itself
//     never counts, nor does a file git ignores, such as a build output or a temporary file;
//   - the project's repository keeps out files elsewhere on the machine, such as another
//     repository's, or a temporary directory's.
// The check runs git once, `git ls-files --error-unmatch`, which reads the index and changes nothing.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { Env } from '../../config/paths.js';
import { hasCodeExtension } from '../../core/triggers.js';
import { EDIT_TOOLS } from './settings.js';

/** How long git may take before the edit counts as not revealing anything. */
export const GIT_TIMEOUT_MS = 3000;

export type CodeEdit =
  | { readonly kind: 'code'; readonly tool: string; /** The file, relative to its repository's root. */ readonly file: string }
  | { readonly kind: 'not'; readonly why: NotCodeEdit };

/**
 * not-edit-tool: the tool is not Edit or Write. no-file: the input names no file, or it is not a
 * regular file now. not-code: the extension is not a code extension. no-project: the project
 * directory is not known. untracked: the project's git does not track the file, because it is new,
 * ignored, outside the project's repository, or the project is not a git repository.
 */
export type NotCodeEdit = 'not-edit-tool' | 'no-file' | 'not-code' | 'no-project' | 'untracked';

/**
 * Whether a PostToolUse input reveals code-edit. The project is CLAUDE_PROJECT_DIR, which Claude Code
 * sets for its hooks, else the input's cwd.
 */
export function codeEdit(input: Record<string, unknown>, env: Env): CodeEdit {
  const not = (why: NotCodeEdit): CodeEdit => ({ kind: 'not', why });
  const tool = typeof input.tool_name === 'string' ? input.tool_name : '';
  if (!EDIT_TOOLS.includes(tool)) return not('not-edit-tool');
  const cwd = typeof input.cwd === 'string' && input.cwd !== '' ? input.cwd : null;
  const project = env.CLAUDE_PROJECT_DIR || cwd;
  const file = real(namedFile(input));
  if (file === null || !isFile(file)) return not('no-file');
  if (!hasCodeExtension(file)) return not('not-code');
  const projectDir = real(project ?? null);
  if (projectDir === null) return not('no-project');
  const tracked = trackedPath(projectDir, file, env);
  return tracked === null ? not('untracked') : { kind: 'code', tool, file: tracked };
}

/**
 * The file an edit names, as an absolute path. Claude Code asks for an absolute path; a relative one
 * is read the way the tool would, from the cwd.
 */
export function namedFile(input: Record<string, unknown>): string | null {
  const toolInput = input.tool_input;
  const named = toolInput !== null && typeof toolInput === 'object' ? (toolInput as Record<string, unknown>).file_path : undefined;
  if (typeof named !== 'string' || named === '') return null;
  if (path.isAbsolute(named)) return named;
  return typeof input.cwd === 'string' && input.cwd !== '' ? path.resolve(input.cwd, named) : null;
}

/**
 * The file's path relative to its repository's root when the git repository of the directory tracks
 * it; null when it does not, or git cannot tell. Paths are taken literally, so a name with "*" or "?"
 * is never read as a pattern.
 */
function trackedPath(dir: string, file: string, env: Env): string | null {
  const r = spawnSync('git', ['--literal-pathspecs', '-C', dir, 'ls-files', '--error-unmatch', '--full-name', '-z', '--', file], {
    encoding: 'utf8',
    env,
    timeout: GIT_TIMEOUT_MS,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  if (r.status !== 0 || typeof r.stdout !== 'string') return null;
  const first = r.stdout.split('\0')[0];
  return first ? first : null;
}

/** The real path, with every symbolic link resolved, or null when it cannot be read. */
function real(p: string | null): string | null {
  if (p === null) return null;
  try {
    return fs.realpathSync(p);
  } catch {
    return null;
  }
}

function isFile(file: string): boolean {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}
