// The model a subagent will run on, decided before it starts, the way Claude Code decides it
// (https://code.claude.com/docs/en/sub-agents, "Choose a model" and "Built-in subagents"):
//
//   1. the model parameter of the agent call, an alias;
//   2. the model field of the subagent's definition, or of a built-in subagent;
//   3. the CLAUDE_CODE_SUBAGENT_MODEL environment variable;
//   4. the model of whoever starts it: the session, or the subagent that starts a nested one.
//
// A family alias (opus, sonnet, haiku, fable) selects the parent's own model when the parent is of
// that family. With CLAUDE_CODE_SUBAGENT_MODEL_FORCE set, definitions and the call's parameter are
// ignored. A fork always runs on its parent's model.
//
// The prediction is checked after the subagent starts: the result of the agent call names the model
// it started on (resolvedModel), and a difference is logged and shown.
import fs from 'node:fs';
import path from 'node:path';
import { normalizeModel } from '../../core/normalize.js';
import { isSet, otherProvider, resolveModelValue } from './launch.js';
/**
 * The built-in subagents whose model does not simply follow the order above, from
 * https://code.claude.com/docs/en/sub-agents, "Built-in subagents" (read 2026-11-15). A definition
 * of the same name replaces a built-in, with its own model field.
 */
const BUILT_IN_MODELS = {
    'statusline-setup': 'sonnet',
    'claude-code-guide': 'haiku',
};
/** Built-ins that run on their parent's model even when CLAUDE_CODE_SUBAGENT_MODEL is set. */
const PARENT_BUILT_INS = new Set(['Explore', 'Plan']);
/**
 * The built-in web-fetch subagent, which the documentation does not list. Claude Code 2.1.326 gives it
 * the model the haiku alias selects when it runs on the Anthropic API, and its parent's model on
 * another provider, as its built-in definition reads.
 */
const WEB_FETCH = 'web-fetch';
const FAMILIES = ['opus', 'sonnet', 'haiku', 'fable'];
export function predict(input) {
    const { subagentType: type, requested, parent, env } = input;
    const subagentModel = env.CLAUDE_CODE_SUBAGENT_MODEL?.trim() || null;
    if (type === 'fork')
        return fromParent(parent, 'fork');
    if (isSet(env.CLAUDE_CODE_SUBAGENT_MODEL_FORCE)) {
        if (subagentModel !== null)
            return fromValue(subagentModel, parent, env, 'forced');
        // Forced onto the session's model, except that Explore keeps its own rule.
        if (type === 'Explore')
            return explore(parent, env);
        return fromParent(parent, 'forced');
    }
    if (requested !== null)
        return fromValue(requested, parent, env, 'parameter');
    const lookup = input.findDefinition(type);
    if (lookup.kind === 'found') {
        const { definition } = lookup;
        if (definition.model !== null)
            return { ...fromValue(definition.model, parent, env, 'definition'), definition: definition.file, definitionSource: definition.source };
    }
    else if (lookup.kind === 'unread') {
        // A place that may define the subagent cannot be read, so a model it sets is not seen; the check
        // after the subagent starts reports a difference.
        const fallback = subagentModel !== null ? fromValue(subagentModel, parent, env, 'env') : fromParent(parent, 'parent');
        return { ...fallback, definition: 'not-read', definitionWhy: lookup.why };
    }
    else if (!type.includes(':')) {
        if (type === 'Explore')
            return explore(parent, env);
        if (PARENT_BUILT_INS.has(type))
            return fromParent(parent, 'built-in');
        if (type === WEB_FETCH)
            return otherProvider(env) !== undefined ? fromParent(parent, 'built-in') : fromValue('haiku', parent, env, 'built-in');
        const builtIn = BUILT_IN_MODELS[type];
        if (builtIn !== undefined)
            return fromValue(builtIn, parent, env, 'built-in');
    }
    if (subagentModel !== null)
        return fromValue(subagentModel, parent, env, 'env');
    return fromParent(parent, 'parent');
}
/**
 * The built-in Explore subagent runs on its parent's model, except under a Fable parent: with a
 * Claude subscription, an Anthropic Console account or a gateway reached through ANTHROPIC_BASE_URL
 * it runs on the model the opus alias selects; on Amazon Bedrock, Google Cloud and Microsoft
 * Foundry it stays on Fable.
 */
function explore(parent, env) {
    if (parent === null || familyOf(parent) !== 'fable' || otherProvider(env) !== undefined)
        return fromParent(parent, 'built-in');
    return fromValue('opus', parent, env, 'built-in');
}
function fromParent(parent, source) {
    if (parent === null)
        return { model: null, source, why: 'the model of the session or subagent that starts it is not known' };
    return { model: parent, source };
}
/** The model a value names for a subagent: inherit, a family alias, another alias or a model identifier. */
function fromValue(value, parent, env, source) {
    const bare = value.trim().toLowerCase();
    if (bare === 'inherit')
        return { ...fromParent(parent, source), value };
    const family = FAMILIES.find((f) => f === bare.replace(/\[1m\]$/, ''));
    if (family !== undefined && parent !== null && familyOf(parent) === family)
        return { model: parent, source, value };
    const r = resolveModelValue(value, env);
    if (r.kind === 'unresolved')
        return { model: null, source, value, why: `"${value}" cannot be pinned down: ${r.why}` };
    return { model: r.model, source, value };
}
/** The family of a normalized model identifier, such as sonnet for claude-sonnet-5-5. */
export function familyOf(model) {
    return FAMILIES.find((f) => new RegExp(`(?:^|-)${f}(?:-|$)`).test(model)) ?? null;
}
// ---------------------------------------------------------------------------------------------
// Transcripts. Claude Code writes each assistant message with the model that wrote it. A subagent's
// transcript sits next to the session's, at <session transcript dir>/<session id>/subagents/
// agent-<agent id>.jsonl, as the agent_transcript_path of the SubagentStop input shows
// (https://code.claude.com/docs/en/hooks, "SubagentStop input"). The documentation warns that a
// transcript can lag behind the conversation, so a transcript is read only when no record knows,
// except at a resume, when the conversation's earlier process has finished writing it.
//
// A compaction writes a system record with subtype compact_boundary, and the messages it kept are
// referred to there, not written again after it.
/** How much of a transcript is read at a time, from its end. */
const CHUNK_BYTES = 1024 * 1024;
/** How far back from its end a transcript is read at most, so the hook stays within its bound. */
const MAX_SCAN_BYTES = 64 * 1024 * 1024;
/** The model of the last assistant message in a transcript; for the session, its own messages only. */
export function transcriptModel(file, ownOnly) {
    return lastResponse(file, ownOnly, false)?.model ?? null;
}
/**
 * The conversation's last response since its last compaction, its own messages only: its model is
 * the one Claude Code resumes a conversation on when nothing it was started with names one. Null when
 * the conversation has no response since, or the transcript cannot be read.
 */
export function conversationResponse(file) {
    return lastResponse(file, true, true);
}
/** The model of conversationResponse. */
export function conversationModel(file) {
    return conversationResponse(file)?.model ?? null;
}
function lastResponse(file, ownOnly, sinceCompaction) {
    if (file === null)
        return null;
    let found = null;
    try {
        scanLinesBackward(file, (line) => {
            const boundary = sinceCompaction && line.includes('"compact_boundary"');
            if (!boundary && !line.includes('"assistant"'))
                return false;
            let r;
            try {
                r = JSON.parse(line);
            }
            catch {
                // A torn line being written, or not a record.
                return false;
            }
            if (ownOnly && r.isSidechain === true)
                return false;
            if (boundary && r.type === 'system' && r.subtype === 'compact_boundary')
                return true;
            if (r.type !== 'assistant')
                return false;
            const model = typeof r.message?.model === 'string' ? normalizeModel(r.message.model) : '';
            if (!model || model === '<synthetic>')
                return false;
            const at = typeof r.timestamp === 'string' ? Date.parse(r.timestamp) : NaN;
            found = { model, at: Number.isNaN(at) ? null : at };
            return true;
        });
    }
    catch {
        return null;
    }
    return found;
}
/**
 * The calls among `ids` that a transcript shows refused: their tool result is an error, as Claude Code
 * writes it at once when a person rejects the call at its permission prompt, or a rule or a hook denies
 * it. A call whose result is not an error, or not written yet, is not among them. The transcript is
 * read from its end back to the calls themselves.
 */
export function refusedCalls(file, ids) {
    const refused = new Set();
    const pending = new Set(ids);
    if (file === null || pending.size === 0)
        return refused;
    const blocks = (line) => {
        try {
            const content = JSON.parse(line).message?.content;
            return Array.isArray(content) ? content.filter((b) => typeof b === 'object' && b !== null) : [];
        }
        catch {
            return [];
        }
    };
    try {
        scanLinesBackward(file, (line) => {
            if (line.includes('"tool_result"'))
                for (const b of blocks(line))
                    if (b.type === 'tool_result' && b.is_error === true && typeof b.tool_use_id === 'string' && pending.has(b.tool_use_id))
                        refused.add(b.tool_use_id);
            if (line.includes('"tool_use"'))
                for (const b of blocks(line))
                    if (b.type === 'tool_use' && typeof b.id === 'string')
                        pending.delete(b.id);
            return pending.size === 0;
        });
    }
    catch {
        // An unreadable transcript shows nothing refused.
    }
    return refused;
}
/** Each line of a file, the last first, until `visit` returns true or MAX_SCAN_BYTES are read. */
function scanLinesBackward(file, visit) {
    const fd = fs.openSync(file, 'r');
    try {
        let position = fs.fstatSync(fd).size;
        const floor = Math.max(0, position - MAX_SCAN_BYTES);
        // The start of the line the previous chunk ended in, which this chunk completes.
        let carry = Buffer.alloc(0);
        while (position > floor) {
            const length = Math.min(CHUNK_BYTES, position - floor);
            position -= length;
            const chunk = Buffer.alloc(length);
            fs.readSync(fd, chunk, 0, length, position);
            const buffer = carry.length ? Buffer.concat([chunk, carry]) : chunk;
            let end = buffer.length;
            for (let i = end - 1; i >= 0; i--) {
                if (buffer[i] !== 0x0a)
                    continue;
                if (visit(buffer.toString('utf8', i + 1, end)))
                    return;
                end = i;
            }
            carry = buffer.subarray(0, end);
        }
        // The file's first line; a line the scan's limit cut is not whole, so it is left out.
        if (position === 0 && carry.length)
            visit(carry.toString('utf8'));
    }
    finally {
        fs.closeSync(fd);
    }
}
/** Where a subagent's transcript is, given the session's transcript path from the hook input. */
export function subagentTranscript(sessionTranscript, sessionId, agentId) {
    if (sessionTranscript === null || sessionId === null || !/^[A-Za-z0-9_-]+$/.test(agentId) || !/^[A-Za-z0-9_-]+$/.test(sessionId))
        return null;
    return path.join(path.dirname(sessionTranscript), sessionId, 'subagents', `agent-${agentId}.jsonl`);
}
/**
 * The call that started a subagent, from the metadata Claude Code writes next to the subagent's
 * transcript (agent-<agent id>.meta.json, its toolUseId), or null when there is none yet. Claude Code
 * 2.1.330 writes it after the subagent's SubagentStart hooks have run, so only a later hook finds it.
 */
export function subagentCall(sessionTranscript, sessionId, agentId) {
    const transcript = subagentTranscript(sessionTranscript, sessionId, agentId);
    if (transcript === null)
        return null;
    try {
        const meta = JSON.parse(fs.readFileSync(transcript.replace(/\.jsonl$/, '.meta.json'), 'utf8'));
        return typeof meta.toolUseId === 'string' && meta.toolUseId !== '' ? meta.toolUseId : null;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=predict.js.map