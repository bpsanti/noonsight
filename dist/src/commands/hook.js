import fs from 'node:fs';
import os from 'node:os';
import { runHook } from '../adapters/claude-code/hook.js';
import { INSTALL_KINDS } from '../state/installs.js';
import { recordNode } from '../state/node.js';
import { packageVersion } from '../version.js';
export const HOOK_USAGE = `usage: noonsight hook [--install managed|account|plugin] <session-start|model-switch|agent-call|subagent-start|agent-result|file-edit|agent-held>

The Claude Code hook adapter; the hook pointer written by \`noonsight install\`, or the plugin's launcher, runs it. It reads the
hook input on stdin, prints at most one JSON object, writes the decision log, and always exits 0.`;
/** Runs a hook event. Always returns 0: a hook never holds or fails the session. */
export function runHookCommand(args, env, out) {
    let install = null;
    const rest = [];
    for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '--install') {
            const kind = args[++i];
            install = INSTALL_KINDS.find((k) => k === kind) ?? null;
        }
        else if (a !== undefined)
            rest.push(a);
    }
    if (rest.length !== 1)
        return 0;
    if (install === 'plugin')
        recordNode(os.homedir(), process.execPath);
    const stdout = runHook(rest[0] ?? '', readStdin(), {
        env,
        home: os.homedir(),
        now: new Date(),
        version: safeVersion(),
        install,
        parentPid: process.ppid,
    });
    if (stdout)
        out(stdout);
    return 0;
}
const RETRY_WAIT = new Int32Array(new SharedArrayBuffer(4));
/** The whole hook input. A pipe that is not yet written makes a read fail with EAGAIN, so it is retried. */
function readStdin() {
    // A terminal would block the read; hooks always get a pipe.
    if (process.stdin.isTTY)
        return '';
    const chunks = [];
    const chunk = Buffer.alloc(64 * 1024);
    for (;;) {
        let n;
        try {
            n = fs.readSync(0, chunk, 0, chunk.length, null);
        }
        catch (e) {
            if (e.code === 'EAGAIN') {
                Atomics.wait(RETRY_WAIT, 0, 0, 1);
                continue;
            }
            return '';
        }
        if (n === 0)
            return Buffer.concat(chunks).toString('utf8');
        chunks.push(Buffer.from(chunk.subarray(0, n)));
    }
}
function safeVersion() {
    try {
        return packageVersion();
    }
    catch {
        return 'unknown';
    }
}
//# sourceMappingURL=hook.js.map