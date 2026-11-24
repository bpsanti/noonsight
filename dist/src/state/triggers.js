// The triggers each session has revealed: one file per session and trigger, under triggers/, named
// <session id>.<trigger>.json and holding what revealed it. A file is created once and never replaced,
// so a session's triggers only grow, and the first hook to create it is the one that delivers the
// rules: several edits of one response run their hooks at the same time, and exactly one of them wins.
import fs from 'node:fs';
import path from 'node:path';
import { TRIGGERS } from '../core/types.js';
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
export function triggerFile(stateDir, sessionId, trigger) {
    return SAFE_ID.test(sessionId) ? path.join(stateDir, 'triggers', `${sessionId}.${trigger}.json`) : null;
}
/** The triggers a session has revealed, in the order of TRIGGERS. */
export function sessionTriggers(stateDir, sessionId) {
    if (sessionId === null)
        return [];
    return TRIGGERS.filter((t) => {
        const file = triggerFile(stateDir, sessionId, t);
        return file !== null && fs.existsSync(file);
    });
}
/**
 * Record that a session revealed a trigger. Returns false when the session had already revealed it,
 * so another hook delivered its rules. Any other failure throws.
 */
export function claimTrigger(stateDir, sessionId, record) {
    const file = triggerFile(stateDir, sessionId, record.trigger);
    if (file === null)
        return false;
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    try {
        fs.writeFileSync(file, `${JSON.stringify(record)}\n`, { flag: 'wx', mode: 0o600 });
        return true;
    }
    catch (e) {
        if (e.code === 'EEXIST')
            return false;
        throw e;
    }
}
/**
 * Give a session the triggers another revealed, as when a fork starts with the conversation that
 * revealed them. The records are copied as they are; a trigger the session already has stays.
 */
export function inheritTriggers(stateDir, from, to) {
    for (const trigger of sessionTriggers(stateDir, from)) {
        const source = triggerFile(stateDir, from, trigger);
        if (source === null)
            continue;
        try {
            claimTrigger(stateDir, to, JSON.parse(fs.readFileSync(source, 'utf8')));
        }
        catch {
            // Without the record, the fork reveals the trigger again on its next edit of tracked code.
        }
    }
}
//# sourceMappingURL=triggers.js.map