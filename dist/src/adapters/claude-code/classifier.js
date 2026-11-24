// The classifier in Claude Code: one `claude -p` call on a small model, with the login Claude Code
// already has, so noonsight never handles a credential. The question and the reading of the answer are
// the core's (core/classify.ts); this file runs the call and says what the decision log records.
//
// The call is bounded and kept apart from the session that asked:
//   - It is stopped after classifier.timeout_ms, and a task it has not placed by then gets no scope.
//   - It runs with NOONSIGHT_DISABLE=1, so noonsight's hooks, wherever they are installed, do nothing in
//     the classifier's own session and never start a classifier from inside it.
//   - --safe-mode leaves out the person's hooks, plugins, MCP servers and CLAUDE.md, --tools "" leaves
//     it no tool, so it cannot start a subagent, and --no-session-persistence keeps it out of the
//     person's session history.
import { spawnSync } from 'node:child_process';
import { classifierQuestion, readAnswer, wantsClassifier } from '../../core/classify.js';
import { EFFORT_ENV } from './routing.js';
/** The command the classifier runs, looked up on PATH as Claude Code's own hooks see it. */
export const CLASSIFIER_COMMAND = 'claude';
/**
 * The task's scope: the one the explicit scope or the matchers chose, unless classifier.mode asks the
 * classifier. Then the classifier's scope, or no scope when it fails, takes too long or answers
 * outside the declared scopes.
 */
export function classifiedScope(config, req) {
    const kept = { scope: req.chosen, fields: {}, failure: null };
    if (!wantsClassifier(config, req.chosen))
        return kept;
    const replaced = req.chosen.scope !== null ? { matcher_scope: req.chosen.scope } : {};
    if (req.text === null || req.text.trim() === '')
        return { ...kept, fields: { classifier: 'no-task' } };
    if (!req.matters())
        return { ...kept, fields: { classifier: 'not-needed' } };
    const c = classify(config, req.text, req.env);
    const fields = { ...replaced, ...classificationFields(c) };
    const scope = c.result === 'scoped' ? { scope: c.scope, source: 'classifier' } : { scope: null, source: null };
    return { scope, fields, failure: 'error' in c ? describeFailure(c) : null };
}
/** Ask the classifier to place a task. Never throws: a call that goes wrong is a classification that failed. */
export function classify(config, text, env) {
    const question = classifierQuestion(config, text);
    const c = config.classifier;
    const args = [
        '-p',
        '--model',
        c.model,
        '--effort',
        c.effort,
        '--system-prompt',
        question.system,
        '--json-schema',
        JSON.stringify(question.schema),
        '--output-format',
        'json',
        '--tools',
        '',
        '--no-session-persistence',
        '--safe-mode',
    ];
    const childEnv = {};
    for (const [k, v] of Object.entries(env))
        if (v !== undefined)
            childEnv[k] = v;
    // The classifier's own effort holds: this variable wins over --effort.
    delete childEnv[EFFORT_ENV];
    childEnv.NOONSIGHT_DISABLE = '1';
    const started = Date.now();
    const r = spawnSync(CLASSIFIER_COMMAND, args, {
        input: question.task,
        encoding: 'utf8',
        env: childEnv,
        timeout: c.timeoutMs,
        killSignal: 'SIGKILL',
        maxBuffer: 4 * 1024 * 1024,
    });
    const ms = Date.now() - started;
    const code = r.error?.code;
    if (code === 'ETIMEDOUT')
        return { result: 'timeout', ms, error: `no answer within ${c.timeoutMs} ms` };
    if (code === 'ENOENT')
        return { result: 'failed', ms, error: `${CLASSIFIER_COMMAND} is not on PATH` };
    if (r.error !== undefined)
        return { result: 'failed', ms, error: short(r.error.message) };
    let out;
    try {
        const parsed = JSON.parse(r.stdout);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
            throw new Error('not an object');
        out = parsed;
    }
    catch {
        const said = short(r.stderr || r.stdout);
        return { result: 'failed', ms, error: `${CLASSIFIER_COMMAND} exited with status ${r.status ?? 'none'}${said ? `: ${said}` : ''}` };
    }
    if (out.is_error === true || r.status !== 0)
        return { result: 'failed', ms, error: short(String(out.result ?? out.subtype ?? `${CLASSIFIER_COMMAND} exited with status ${r.status ?? 'none'}`)) };
    const cost = typeof out.total_cost_usd === 'number' ? { costUsd: out.total_cost_usd } : {};
    const answer = readAnswer(config, out.structured_output ?? parseJson(out.result));
    switch (answer.kind) {
        case 'scoped':
            return { result: 'scoped', scope: answer.scope, ms, ...cost };
        case 'none':
            return { result: 'none', ms, ...cost };
        case 'invalid':
            return { result: 'invalid', ms, error: answer.why };
    }
}
/** What the decision log records about a classification. */
export function classificationFields(c) {
    return {
        classifier: c.result,
        classifier_ms: c.ms,
        ...('error' in c ? { classifier_error: c.error } : {}),
        ...('costUsd' in c && c.costUsd !== undefined ? { classifier_cost_usd: c.costUsd } : {}),
    };
}
function describeFailure(c) {
    switch (c.result) {
        case 'timeout':
            return `it gave ${c.error}`;
        case 'invalid':
            return `its answer was not a declared scope: ${c.error}`;
        case 'failed':
            return `it failed: ${c.error}`;
    }
}
function parseJson(value) {
    if (typeof value !== 'string')
        return undefined;
    try {
        return JSON.parse(value);
    }
    catch {
        return undefined;
    }
}
function short(text) {
    const line = text.trim().split('\n').find((l) => l.trim() !== '') ?? '';
    return line.length > 200 ? `${line.slice(0, 200)}...` : line;
}
//# sourceMappingURL=classifier.js.map