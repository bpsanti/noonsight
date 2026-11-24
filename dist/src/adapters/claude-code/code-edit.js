// Whether an edit reveals the code-edit trigger: the session edited, with Edit or Write, a file with a
// code extension that the git repository holding it already tracks, where that repository is the
// session's project or one of its worktrees.
//
// Each condition keeps out an edit that does not show the session building:
//   - a code extension keeps out reports, notes, documents, styles, data and settings (core/triggers.ts);
//   - a tracked file keeps out every new file, so a script or a report the session writes for itself
//     never counts, nor does a file git ignores, such as a build output or a temporary file;
//   - the project's repository keeps out files elsewhere on the machine, such as another
//     repository's, or a temporary directory's. The repository holding the file is asked, not the
//     project's checkout, so an edit in a worktree of the project counts, including one under the
//     project's own directory, which the checkout's index does not track: a session that moved into a
//     worktree still has the original checkout as its project.
// The check runs git at most three times, each bounded: `git ls-files --error-unmatch` in the file's
// directory, then `git rev-parse --git-common-dir` there and in the project. Both read and change nothing.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { hasCodeExtension } from '../../core/triggers.js';
import { EDIT_TOOLS } from './settings.js';
/** How long git may take before the edit counts as not revealing anything. */
export const GIT_TIMEOUT_MS = 3000;
/**
 * Whether a PostToolUse input reveals code-edit. The project is CLAUDE_PROJECT_DIR, which Claude Code
 * sets for its hooks, else the input's cwd. Two repositories are the same, or worktrees of each other,
 * when they share their common git directory.
 */
export function codeEdit(input, env) {
    const not = (why) => ({ kind: 'not', why });
    const tool = typeof input.tool_name === 'string' ? input.tool_name : '';
    if (!EDIT_TOOLS.includes(tool))
        return not('not-edit-tool');
    const cwd = typeof input.cwd === 'string' && input.cwd !== '' ? input.cwd : null;
    const project = env.CLAUDE_PROJECT_DIR || cwd;
    const file = real(namedFile(input));
    if (file === null || !isFile(file))
        return not('no-file');
    if (!hasCodeExtension(file))
        return not('not-code');
    const projectDir = real(project ?? null);
    if (projectDir === null)
        return not('no-project');
    const fileDir = path.dirname(file);
    const tracked = trackedPath(fileDir, file, env);
    if (tracked === null)
        return not('untracked');
    const repository = commonDir(fileDir, env);
    if (repository === null || repository !== commonDir(projectDir, env))
        return not('foreign');
    return { kind: 'code', tool, file: tracked };
}
/**
 * The file an edit names, as an absolute path. Claude Code asks for an absolute path; a relative one
 * is read the way the tool would, from the cwd.
 */
export function namedFile(input) {
    const toolInput = input.tool_input;
    const named = toolInput !== null && typeof toolInput === 'object' ? toolInput.file_path : undefined;
    if (typeof named !== 'string' || named === '')
        return null;
    if (path.isAbsolute(named))
        return named;
    return typeof input.cwd === 'string' && input.cwd !== '' ? path.resolve(input.cwd, named) : null;
}
/**
 * The file's path relative to its repository's root when the git repository of the directory tracks
 * it; null when it does not, or git cannot tell. Paths are taken literally, so a name with "*" or "?"
 * is never read as a pattern.
 */
function trackedPath(dir, file, env) {
    const first = git(dir, ['ls-files', '--error-unmatch', '--full-name', '-z', '--', file], env)?.split('\0')[0];
    return first ? first : null;
}
/** The real path of the common git directory of the repository holding the directory, or null when there is none. */
function commonDir(dir, env) {
    const out = git(dir, ['rev-parse', '--git-common-dir'], env);
    const named = out?.replace(/\n$/, '');
    return named ? real(path.resolve(dir, named)) : null;
}
function git(dir, args, env) {
    const r = spawnSync('git', ['--literal-pathspecs', '-C', dir, ...args], {
        encoding: 'utf8',
        env,
        timeout: GIT_TIMEOUT_MS,
        stdio: ['ignore', 'pipe', 'ignore'],
    });
    return r.status === 0 && typeof r.stdout === 'string' ? r.stdout : null;
}
/** The real path, with every symbolic link resolved, or null when it cannot be read. */
function real(p) {
    if (p === null)
        return null;
    try {
        return fs.realpathSync(p);
    }
    catch {
        return null;
    }
}
function isFile(file) {
    try {
        return fs.statSync(file).isFile();
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=code-edit.js.map