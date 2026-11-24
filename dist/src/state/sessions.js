// What each session last received, so a hook can tell a resumed conversation that already holds the
// rules from one that needs them, and can say "the earlier rules no longer apply" after a switch.
//
// Two keys, both structural facts rather than inherited environment variables:
//   - the session id Claude Code puts in every hook input;
//   - the Claude Code process that runs the hook (the hook's parent process). After /clear the new
//     session has a new id and Claude Code may leave the model out, but it is the same process,
//     still on the same model.
import fs from 'node:fs';
import path from 'node:path';
import { writeFileAtomic } from './files.js';
/** Records older than this are removed; any write refreshes a record. */
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
export function sessionFile(stateDir, sessionId) {
    return SAFE_ID.test(sessionId) ? path.join(stateDir, 'sessions', `${sessionId}.json`) : null;
}
export function processFile(stateDir, pid) {
    return Number.isSafeInteger(pid) && pid > 1 ? path.join(stateDir, 'processes', `${pid}.json`) : null;
}
export function readState(file) {
    if (file === null)
        return null;
    try {
        const value = JSON.parse(fs.readFileSync(file, 'utf8'));
        if ((value.model === null || typeof value.model === 'string') &&
            (value.status === 'matched' || value.status === 'none' || value.status === 'undeclared') &&
            (value.sha256 === null || typeof value.sha256 === 'string'))
            return {
                model: value.model,
                status: value.status,
                sha256: value.sha256,
                held: Array.isArray(value.held)
                    ? value.held.filter((m) => typeof m === 'string' && m !== '')
                    : value.status === 'matched' && value.model
                        ? [value.model]
                        : [],
                // A record written before resumes were told apart holds true for a switch's delivery.
                ...(value.unconfirmed === true || value.unconfirmed === 'switch'
                    ? { unconfirmed: 'switch' }
                    : value.unconfirmed === 'resume'
                        ? { unconfirmed: 'resume' }
                        : {}),
                ...(typeof value.chosen === 'string' && value.chosen !== '' ? { chosen: value.chosen } : {}),
                at: String(value.at),
            };
    }
    catch {
        // Missing or unreadable: the same as never recorded.
    }
    return null;
}
/** The models whose rules a conversation may hold, as a record keeps them. */
export function heldModels(state) {
    if (state === null)
        return [];
    return [...(state.held ?? (state.status === 'matched' && state.model ? [state.model] : []))];
}
export function writeState(file, state) {
    if (file === null)
        return;
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    writeFileAtomic(file, `${JSON.stringify(state)}\n`, 0o600);
}
/**
 * Records of subagents only serve while their session runs, and a session makes many, so they are
 * kept for less time. A call whose result never came (another hook denied it) leaves its record here.
 */
const AGENT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** A claim (claims.ts) serves only while the copies of one event run. */
const CLAIM_MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** Remove records nobody has written for a long time. */
export function pruneState(stateDir, now) {
    for (const [sub, maxAge] of [
        ['sessions', MAX_AGE_MS],
        ['processes', MAX_AGE_MS],
        // The triggers each session revealed (triggers.ts), kept as long as the session's own record.
        ['triggers', MAX_AGE_MS],
        // The system prompt files of `noonsight run`, which every launch writes again.
        ['launch', MAX_AGE_MS],
        ['agent-calls', AGENT_MAX_AGE_MS],
        ['agent-pools', AGENT_MAX_AGE_MS],
        ['agent-starts', AGENT_MAX_AGE_MS],
        ['agent-links', AGENT_MAX_AGE_MS],
        ['agent-pending', AGENT_MAX_AGE_MS],
        ['agents', AGENT_MAX_AGE_MS],
        ['claims', CLAIM_MAX_AGE_MS],
    ]) {
        const dir = path.join(stateDir, sub);
        let names;
        try {
            names = fs.readdirSync(dir);
        }
        catch {
            continue;
        }
        for (const name of names) {
            const file = path.join(dir, name);
            try {
                if (now - fs.statSync(file).mtimeMs > maxAge)
                    fs.rmSync(file, { force: true });
            }
            catch {
                // Removed by another session meanwhile.
            }
        }
    }
}
//# sourceMappingURL=sessions.js.map