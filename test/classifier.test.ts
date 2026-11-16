// The classifier: its settings, the question it is asked and how its answer is read, and the agent
// call hook and the launcher that ask it, driven as Claude Code and a person drive them. A stand-in
// `claude` first on PATH plays the classifier: it records how it was started and answers as each test
// asks, and it can run noonsight's hook as its own child, with the environment it was given, as a hook
// installed for the person would run inside the classifier's session. Each test has its own home
// directory, so the decision log and the records start empty.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { ConfigError, loadConfig } from '../src/config/load.js';
import { CLASSIFY_TEXT_LIMIT, classifierQuestion, readAnswer, wantsClassifier } from '../src/core/classify.js';
import { resolve } from '../src/core/resolve.js';
import type { Config } from '../src/core/types.js';
import { CLI, hookHome, hookInput, LAB_CONFIG, LAB_PRESETS, NO_NETWORK, runCli, tempTree, type HookHome } from './helpers.js';

/** The lab configuration with `fields` merged over it, its scopes one by one, and its rule files beside it. */
function config(fields: Record<string, unknown> = {}): string {
  const lab = JSON.parse(fs.readFileSync(LAB_CONFIG, 'utf8')) as Record<string, any>;
  const scopes = { ...lab.scopes } as Record<string, Record<string, unknown>>;
  for (const [name, scope] of Object.entries((fields.scopes ?? {}) as Record<string, Record<string, unknown>>)) scopes[name] = { ...scopes[name], ...scope };
  const dir = tempTree({ 'noonsight.json': { ...lab, ...fields, scopes } });
  fs.cpSync(path.join(path.dirname(LAB_CONFIG), 'rules'), path.join(dir, 'rules'), { recursive: true });
  return path.join(dir, 'noonsight.json');
}

const load = (file: string): Config => loadConfig(file, { presetsDir: LAB_PRESETS });

/** The recorded agent call, with the tool input changed as given. */
function call(toolInput: Record<string, unknown> = {}): string {
  const recorded = JSON.parse(hookInput('pre-tool-use-agent')) as Record<string, any>;
  return JSON.stringify({ ...recorded, tool_input: { ...recorded.tool_input, ...toolInput } });
}

/** A task text no lab scope's matcher reads. */
const PLAIN_TASK = { description: 'Condense the notes', prompt: 'Read docs/notes.md and write five bullet points for the team.' };

interface Started {
  readonly args: string[];
  readonly input: string;
  readonly env: Record<string, string | null>;
  /** What noonsight's hook printed when the stand-in ran it as its child; absent when it did not. */
  readonly hook?: { status: number | null; stdout: string; stderr: string };
}

interface Stand {
  readonly bin: string;
  readonly dir: string;
  /** Every start of the stand-in, in order. */
  started(): Started[];
  env(behavior: string, extra?: Record<string, string>): Record<string, string>;
}

/**
 * A stand-in claude. FAKE_CLASSIFIER says how it answers: answer:<scope>, sleep, fail, error,
 * garbage. With FAKE_HOOK_INPUT set, it first runs noonsight's agent-call hook with that input.
 */
function standIn(): Stand {
  const bin = tempTree({});
  const dir = tempTree({});
  fs.writeFileSync(
    path.join(bin, 'claude'),
    `#!${process.execPath}
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const input = fs.readFileSync(0, 'utf8');
const pick = (n) => process.env[n] ?? null;
const record = { args: process.argv.slice(2), input, env: { NOONSIGHT_DISABLE: pick('NOONSIGHT_DISABLE'), CLAUDE_CODE_EFFORT_LEVEL: pick('CLAUDE_CODE_EFFORT_LEVEL') } };
if (process.env.FAKE_HOOK_INPUT) {
  const r = spawnSync(process.execPath, ${JSON.stringify([...NO_NETWORK, CLI, 'hook', 'agent-call'])}, { input: process.env.FAKE_HOOK_INPUT, encoding: 'utf8', env: process.env });
  record.hook = { status: r.status, stdout: r.stdout, stderr: r.stderr };
}
fs.writeFileSync(path.join(${JSON.stringify(dir)}, String(process.hrtime.bigint()) + '.json'), JSON.stringify(record));
const how = process.env.FAKE_CLASSIFIER || '';
const reply = (o) => process.stdout.write(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, total_cost_usd: 0.0004, ...o }));
if (how.startsWith('answer:')) {
  const scope = how.slice('answer:'.length);
  reply({ result: JSON.stringify({ scope }), structured_output: { scope } });
} else if (how.startsWith('result-only:')) {
  reply({ result: JSON.stringify({ scope: how.slice('result-only:'.length) }) });
} else if (how === 'sleep') {
  setTimeout(() => reply({ structured_output: { scope: 'summarize' } }), 30000);
} else if (how === 'error') {
  reply({ is_error: true, subtype: 'error_during_execution', result: 'API Error: overloaded' });
  process.exitCode = 1;
} else if (how === 'garbage') {
  process.stdout.write('not json');
} else {
  process.stderr.write('Not logged in. Please run /login\\n');
  process.exitCode = 1;
}
`,
    { mode: 0o755 },
  );
  return {
    bin,
    dir,
    started() {
      return fs
        .readdirSync(dir)
        .sort()
        .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as Started);
    },
    env(behavior, extra = {}) {
      return { PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}`, FAKE_CLASSIFIER: behavior, ...extra };
    },
  };
}

const agentCalls = (h: HookHome): Record<string, any>[] => h.log().filter((l) => l.event === 'agent-call');

// ---------------------------------------------------------------------------------------------
// Settings.

test('classifier settings: off by default, with haiku at low effort and an 8000 ms limit', () => {
  assert.deepEqual(load(LAB_CONFIG).classifier, { mode: 'off', model: 'haiku', effort: 'low', timeoutMs: 8000 });
  const c = load(config({ classifier: { mode: 'fallback', model: 'claude-haiku-5-5', effort: 'medium', timeout_ms: 8000 } })).classifier;
  assert.deepEqual(c, { mode: 'fallback', model: 'claude-haiku-5-5', effort: 'medium', timeoutMs: 8000 });
});

test('classifier settings that the hook could not honor, or that are not settings, refuse the configuration', () => {
  const problems = (classifier: unknown, extra: Record<string, unknown> = {}): string[] => {
    try {
      load(config({ classifier, ...extra }));
    } catch (e) {
      if (e instanceof ConfigError) return [...e.problems];
      throw e;
    }
    return [];
  };
  assert.deepEqual(problems({ timeout_ms: 9000 }), ['/classifier/timeout_ms: must be at most 8000']);
  assert.deepEqual(problems({ timeout_ms: 500 }), ['/classifier/timeout_ms: must be at least 1000']);
  assert.deepEqual(problems({ timeout_ms: 2500.5 }), ['/classifier/timeout_ms: must be an integer']);
  assert.deepEqual(problems({ mode: 'sometimes' }), ['/classifier/mode: must be one of "off", "fallback", "always"']);
  assert.deepEqual(problems({ model: '' }), ['/classifier/model: must not be empty']);
  assert.deepEqual(problems({ in_hooks: true }), ['/classifier/in_hooks: unknown key']);
  // The classifier's word for "no scope" cannot also name a scope.
  const none = { scopes: { none: { description: 'Nothing.' } } };
  assert.deepEqual(problems({ mode: 'fallback' }, none), [
    '/scopes/none: the classifier answers "none" for a task that fits no scope, so no scope can have that name while classifier.mode is on',
  ]);
  assert.deepEqual(problems({ mode: 'off' }, none), []);
});

// ---------------------------------------------------------------------------------------------
// The core: when it is asked, what it is asked, how the answer is read.

test('the mode decides when the classifier is asked; an explicit scope is never replaced', () => {
  const withMode = (mode: string): Config => load(config({ classifier: { mode } }));
  const none = { scope: null, source: null } as const;
  const matched = { scope: 'summarize', source: 'task-text', matcher: 'x' } as const;
  const explicit = { scope: 'summarize', source: 'env' } as const;
  assert.deepEqual(
    [none, matched, explicit].map((c) => wantsClassifier(withMode('off'), c)),
    [false, false, false],
  );
  assert.deepEqual(
    [none, matched, explicit].map((c) => wantsClassifier(withMode('fallback'), c)),
    [true, false, false],
  );
  assert.deepEqual(
    [none, matched, explicit].map((c) => wantsClassifier(withMode('always'), c)),
    [true, true, false],
  );
});

test('the question lists every declared scope with its description, and none; the task text is cut', () => {
  const c = load(config({ classifier: { mode: 'fallback' } }));
  const q = classifierQuestion(c, 'x'.repeat(CLASSIFY_TEXT_LIMIT + 50));
  assert.equal(q.task.length, CLASSIFY_TEXT_LIMIT);
  for (const s of c.scopes.values()) assert.ok(q.system.includes(`- ${s.name}: ${s.description}`), s.name);
  assert.match(q.system, /\n- none: none of the scopes above fits\./);
  assert.deepEqual(q.schema, {
    type: 'object',
    properties: { scope: { type: 'string', enum: [...c.scopes.keys(), 'none'] } },
    required: ['scope'],
    additionalProperties: false,
  });
});

test('an answer is a declared scope, none, or invalid', () => {
  const c = load(LAB_CONFIG);
  assert.deepEqual(readAnswer(c, { scope: 'summarize' }), { kind: 'scoped', scope: 'summarize' });
  assert.deepEqual(readAnswer(c, { scope: 'none' }), { kind: 'none' });
  assert.deepEqual(readAnswer(c, { scope: 'refactor' }), { kind: 'invalid', why: '"refactor" is not a declared scope' });
  assert.deepEqual(readAnswer(c, { label: 'summarize' }), { kind: 'invalid', why: 'the answer has no scope' });
  assert.deepEqual(readAnswer(c, undefined), { kind: 'invalid', why: 'the answer has no scope' });
});

// ---------------------------------------------------------------------------------------------
// The agent call hook.

test('classifier off (the default): the hook never starts the classifier and logs no classifier field', () => {
  const s = standIn();
  const h = hookHome(LAB_CONFIG);
  const r = h.hook('agent-call', call(PLAIN_TASK), s.env('answer:summarize'));
  assert.equal(r.status, 0);
  assert.equal(s.started().length, 0);
  const [line] = agentCalls(h);
  assert.equal(line?.scope, null);
  assert.equal(line?.scope_source, null);
  assert.equal('classifier' in (line ?? {}), false);
});

test('fallback: a task no matcher placed takes the classifier\'s scope, and gets that scope\'s rules', () => {
  const s = standIn();
  const h = hookHome(config({ classifier: { mode: 'fallback' } }));
  const r = h.hook('agent-call', call(PLAIN_TASK), s.env('answer:summarize'));
  const expected = resolve(load(h.env.NOONSIGHT_CONFIG ?? ''), { model: 'claude-haiku-5-5', scope: 'summarize', place: 'subagent' });
  assert.equal(expected.status, 'matched');
  assert.ok(expected.status === 'matched' && expected.rules.includes('user/haiku-summarize'));
  assert.ok(r.out?.hookSpecificOutput.updatedInput.prompt.endsWith(expected.status === 'matched' ? expected.text : '?'));
  const [line] = agentCalls(h);
  assert.equal(line?.scope, 'summarize');
  assert.equal(line?.scope_source, 'classifier');
  assert.equal(line?.classifier, 'scoped');
  assert.equal(typeof line?.classifier_ms, 'number');
  assert.equal(line?.classifier_cost_usd, 0.0004);
  assert.equal(line?.warned, false);

  // What the classifier was asked, and how it was started.
  const [started] = s.started();
  assert.ok(started);
  assert.equal(started.input, `${PLAIN_TASK.description}\n\n${PLAIN_TASK.prompt}`);
  const option = (name: string): string | undefined => started.args[started.args.indexOf(name) + 1];
  assert.equal(started.args[0], '-p');
  assert.equal(option('--model'), 'haiku');
  assert.equal(option('--effort'), 'low');
  assert.equal(option('--tools'), '');
  assert.equal(option('--output-format'), 'json');
  assert.deepEqual(JSON.parse(option('--json-schema') ?? '{}').properties.scope.enum, ['investigate', 'summarize', 'search', 'implement', 'none']);
  for (const flag of ['--safe-mode', '--no-session-persistence']) assert.ok(started.args.includes(flag), flag);
});

test('the classifier\'s answer is read from the result text when Claude Code gives no structured output', () => {
  const s = standIn();
  const h = hookHome(config({ classifier: { mode: 'fallback' } }));
  h.hook('agent-call', call(PLAIN_TASK), s.env('result-only:investigate'));
  assert.equal(agentCalls(h)[0]?.scope, 'investigate');
});

test('fallback: a task a matcher placed keeps that scope, and the classifier is not asked', () => {
  const s = standIn();
  const h = hookHome(config({ classifier: { mode: 'fallback' }, scopes: { summarize: { match: ['\\bbullet points\\b'] } } }));
  h.hook('agent-call', call(PLAIN_TASK), s.env('answer:investigate'));
  assert.equal(s.started().length, 0);
  const [line] = agentCalls(h);
  assert.equal(line?.scope, 'summarize');
  assert.equal(line?.scope_source, 'task-text');
  assert.equal('classifier' in (line ?? {}), false);
});

test('always: the classifier decides over a matcher, and the log keeps the scope the matcher chose', () => {
  const s = standIn();
  const h = hookHome(config({ classifier: { mode: 'always' }, scopes: { summarize: { match: ['\\bbullet points\\b'] } } }));
  h.hook('agent-call', call(PLAIN_TASK), s.env('answer:investigate'));
  const [line] = agentCalls(h);
  assert.equal(line?.scope, 'investigate');
  assert.equal(line?.scope_source, 'classifier');
  assert.equal(line?.matcher_scope, 'summarize');
});

test('the classifier\'s none gives no scope, without a warning', () => {
  const s = standIn();
  const h = hookHome(config({ classifier: { mode: 'fallback' } }));
  const r = h.hook('agent-call', call(PLAIN_TASK), s.env('answer:none'));
  assert.equal(r.out?.systemMessage, undefined);
  const [line] = agentCalls(h);
  assert.equal(line?.scope, null);
  assert.equal(line?.classifier, 'none');
  assert.equal(line?.warned, false);
});

test('a classifier that fails or answers outside the scopes: no scope, the reason in the log, a warning, and the rules for no scope', () => {
  const cases: [string, string, RegExp][] = [
    ['fail', 'failed', /^claude exited with status 1: Not logged in\. Please run \/login$/],
    ['error', 'failed', /^API Error: overloaded$/],
    ['garbage', 'failed', /^claude exited with status 0: not json$/],
    ['answer:refactor', 'invalid', /^"refactor" is not a declared scope$/],
  ];
  for (const [behavior, result, error] of cases) {
    const s = standIn();
    const h = hookHome(config({ classifier: { mode: 'fallback' } }));
    const r = h.hook('agent-call', call(PLAIN_TASK), s.env(behavior));
    const [line] = agentCalls(h);
    assert.equal(line?.scope, null, behavior);
    assert.equal(line?.scope_source, null, behavior);
    assert.equal(line?.classifier, result, behavior);
    assert.match(String(line?.classifier_error), error, behavior);
    assert.equal(line?.warned, true, behavior);
    assert.match(String(r.out?.systemMessage), /^noonsight: the classifier could not place the task of subagent general-purpose \(.+\), so it has no scope\.$/, behavior);
    // The rules for no scope still go with the call.
    const general = resolve(load(h.env.NOONSIGHT_CONFIG ?? ''), { model: 'claude-haiku-5-5', scope: null, place: 'subagent' });
    assert.ok(general.status === 'matched' && r.out?.hookSpecificOutput.updatedInput.prompt.endsWith(general.text), behavior);
  }
});

test('a classifier that takes longer than timeout_ms is stopped: the call goes on with no scope, and the log says timeout', () => {
  const s = standIn();
  const h = hookHome(config({ classifier: { mode: 'fallback', timeout_ms: 1000 } }));
  const started = Date.now();
  const r = h.hook('agent-call', call(PLAIN_TASK), s.env('sleep'));
  assert.ok(Date.now() - started < 8000, 'the hook answered well before Claude Code would stop it');
  assert.equal(r.status, 0);
  const [line] = agentCalls(h);
  assert.equal(line?.scope, null);
  assert.equal(line?.classifier, 'timeout');
  assert.equal(line?.classifier_error, 'no answer within 1000 ms');
  assert.ok(line?.classifier_ms >= 1000);
  assert.match(String(r.out?.systemMessage), /\(it gave no answer within 1000 ms\)/);
});

test('without claude on PATH, the classification fails and is logged', () => {
  const h = hookHome(config({ classifier: { mode: 'fallback' } }));
  h.hook('agent-call', call(PLAIN_TASK), { PATH: tempTree({}) });
  const [line] = agentCalls(h);
  assert.equal(line?.classifier, 'failed');
  assert.equal(line?.classifier_error, 'claude is not on PATH');
});

test('the classifier is not asked when the scope can change nothing: same rules in every scope, and no route to choose', () => {
  const s = standIn();
  const h = hookHome(config({ classifier: { mode: 'fallback' } }));
  // claude-opus-* is declared with "use": "none", and routing is off.
  h.hook('agent-call', call({ ...PLAIN_TASK, model: 'opus' }), s.env('answer:summarize'));
  assert.equal(s.started().length, 0);
  assert.equal(agentCalls(h)[0]?.classifier, 'not-needed');

  // With routing on, the scope can choose the route, so the classifier is asked.
  const routed = hookHome(
    config({ classifier: { mode: 'fallback' }, routing: { enabled: true, table: { summarize: [{ model: 'haiku', effort: 'low' }] } } }),
  );
  const r = routed.hook('agent-call', call({ ...PLAIN_TASK, model: undefined }), s.env('answer:summarize'));
  assert.equal(s.started().length, 1);
  const [line] = agentCalls(routed);
  assert.equal(line?.scope_source, 'classifier');
  assert.equal(line?.routing, 'routed');
  assert.equal(r.out?.hookSpecificOutput.updatedInput.model, 'haiku');
});

test('the classifier runs with noonsight turned off: a noonsight hook in its session does nothing and logs nothing', () => {
  const s = standIn();
  const h = hookHome(config({ classifier: { mode: 'fallback' } }));
  // CLAUDE_CODE_EFFORT_LEVEL would win over the classifier's own --effort, so it is left out.
  h.hook('agent-call', call(PLAIN_TASK), s.env('answer:summarize', { FAKE_HOOK_INPUT: call(PLAIN_TASK), CLAUDE_CODE_EFFORT_LEVEL: 'max' }));
  const started = s.started();
  // One start only: the hook inside the classifier's session did not start a classifier of its own.
  assert.equal(started.length, 1);
  assert.equal(started[0]?.env.NOONSIGHT_DISABLE, '1');
  assert.equal(started[0]?.env.CLAUDE_CODE_EFFORT_LEVEL, null);
  assert.deepEqual(started[0]?.hook, { status: 0, stdout: '', stderr: '' });
  // The log holds the session's call alone.
  assert.equal(h.log().length, 1);
  assert.equal(agentCalls(h)[0]?.scope, 'summarize');
});

test('a session started with NOONSIGHT_DISABLE=1, as the classifier\'s is, never starts a classifier', () => {
  const s = standIn();
  const h = hookHome(config({ classifier: { mode: 'fallback' } }));
  const r = h.hook('agent-call', call(PLAIN_TASK), s.env('answer:summarize', { NOONSIGHT_DISABLE: '1' }));
  assert.equal(r.raw, '');
  assert.equal(s.started().length, 0);
  assert.deepEqual(h.log(), []);
});

// ---------------------------------------------------------------------------------------------
// The launcher.

/** A stand-in claude that answers as the classifier when asked with --json-schema, and records the session start otherwise. */
function launcherStandIn(): Stand & { session(): Started | null } {
  const s = standIn();
  const real = path.join(s.bin, 'claude');
  const classifier = path.join(s.bin, 'classifier.cjs');
  fs.renameSync(real, classifier);
  const session = path.join(s.dir, '..', `${path.basename(s.dir)}-session.json`);
  fs.writeFileSync(
    real,
    `#!${process.execPath}
const fs = require('node:fs');
const pick = (n) => process.env[n] ?? null;
if (process.argv.includes('--json-schema')) require(${JSON.stringify(classifier)});
else fs.writeFileSync(${JSON.stringify(session)}, JSON.stringify({ args: process.argv.slice(2), input: '', env: { NOONSIGHT_SCOPE: pick('NOONSIGHT_SCOPE'), NOONSIGHT_SCOPE_VIA: pick('NOONSIGHT_SCOPE_VIA') } }));
`,
    { mode: 0o755 },
  );
  return {
    ...s,
    session() {
      return fs.existsSync(session) ? (JSON.parse(fs.readFileSync(session, 'utf8')) as Started) : null;
    },
  };
}

test('launcher: the prompt after -p is classified, and the scope is passed to the session as inferred', () => {
  const s = launcherStandIn();
  const h = hookHome(config({ classifier: { mode: 'fallback' } }));
  const r = runCli(['run', '--', '--model', 'claude-sonnet-5-5', '-p', 'Why does the nightly export write an empty file?'], { ...h.env, ...s.env('answer:investigate') }, NO_NETWORK);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(s.started()[0]?.input, 'Why does the nightly export write an empty file?');
  assert.deepEqual(s.session()?.env, { NOONSIGHT_SCOPE: 'investigate', NOONSIGHT_SCOPE_VIA: 'inferred' });
  const launch = h.log().find((l) => l.event === 'launch');
  assert.equal(launch?.scope, 'investigate');
  assert.equal(launch?.scope_source, 'classifier');
  assert.equal(launch?.classifier, 'scoped');
  assert.ok(launch?.rules.includes('sonnet/investigate'));
});

test('launcher: with no model named before the session starts, the task is classified, as the session learns its model only then', () => {
  const s = launcherStandIn();
  const h = hookHome(config({ classifier: { mode: 'fallback' } }));
  const r = runCli(['run', '--', '-p', 'Why does the nightly export write an empty file?'], { ...h.env, ...s.env('answer:investigate') }, NO_NETWORK);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(s.started().length, 1);
  assert.deepEqual(s.session()?.env, { NOONSIGHT_SCOPE: 'investigate', NOONSIGHT_SCOPE_VIA: 'inferred' });
  const launch = h.log().find((l) => l.event === 'launch');
  assert.equal(launch?.classifier, 'scoped');
  assert.equal(launch?.scope, 'investigate');
});

test('launcher: --scope is never classified, and a launch without a task text records no-task', () => {
  const s = launcherStandIn();
  const h = hookHome(config({ classifier: { mode: 'always' } }));
  runCli(['run', '--scope', 'summarize', '--', '--model', 'claude-sonnet-5-5', '-p', 'Find the cause'], { ...h.env, ...s.env('answer:investigate') }, NO_NETWORK);
  runCli(['run', '--', '--model', 'claude-sonnet-5-5'], { ...h.env, ...s.env('answer:investigate') }, NO_NETWORK);
  assert.equal(s.started().length, 0);
  const [explicit, interactive] = h.log().filter((l) => l.event === 'launch');
  assert.equal(explicit?.scope, 'summarize');
  assert.equal('classifier' in (explicit ?? {}), false);
  assert.equal(interactive?.classifier, 'no-task');
  assert.equal(interactive?.scope, null);
});

test('launcher: a failed classification starts the session with no scope, and says why', () => {
  const s = launcherStandIn();
  const h = hookHome(config({ classifier: { mode: 'fallback' } }));
  const r = runCli(['run', '--', '--model', 'claude-sonnet-5-5', '-p', 'Find the cause'], { ...h.env, ...s.env('fail') }, NO_NETWORK);
  assert.equal(r.status, 0);
  assert.match(r.stderr, /^noonsight: the classifier could not place the task \(it failed: claude exited with status 1: Not logged in\. Please run \/login\), so the session has no scope\.$/m);
  assert.deepEqual(s.session()?.env, { NOONSIGHT_SCOPE: null, NOONSIGHT_SCOPE_VIA: null });
  const launch = h.log().find((l) => l.event === 'launch');
  assert.equal(launch?.scope, null);
  assert.equal(launch?.classifier, 'failed');
});

test('noonsight check says whether the classifier is on, for which tasks, and its time limit', () => {
  const base = { NOONSIGHT_PRESETS_DIR: LAB_PRESETS, NOONSIGHT_SYSTEM_ROOT: tempTree({}) };
  const off = runCli(['check'], { ...base, NOONSIGHT_CONFIG: LAB_CONFIG });
  assert.match(off.stdout, /^ok: classifier: off, so a task without an explicit scope takes its scope from the matchers alone$/m);
  const on = runCli(['check'], { ...base, NOONSIGHT_CONFIG: config({ classifier: { mode: 'fallback', timeout_ms: 4000 } }) });
  assert.match(on.stdout, /^ok: classifier: fallback, for a task no explicit scope and no matcher placed; haiku at low effort, at most 4000 ms per task$/m);
});
