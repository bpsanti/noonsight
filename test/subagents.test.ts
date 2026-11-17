// The subagent hooks, PreToolUse and PostToolUse on the agent tool and SubagentStart, driven as Claude
// Code drives them: a separate process per event, with recorded Claude Code inputs. Each test has its
// own home directory, so the decision log and the records start empty.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { frontmatter } from '../src/adapters/claude-code/predict.js';
import { CLI, hookHome, hookInput, LAB_CONFIG, LAB_PRESETS, runCli, runProgram, tempTree, type HookHome } from './helpers.js';

/** The recorded calls and results come from different sessions; tests replay them in one. */
const SESSION = 'dbef0a98-a930-44c9-9a0c-9f41dae960c8';
const NESTED_AGENT = 'a3d49b7cc8d3bb7bc';

/** A session start in SESSION on the given model, so noonsight records the session's model. */
const startOn = (h: HookHome, model: string): void => {
  assert.equal(h.hook('session-start', hookInput('session-start-startup', { session_id: SESSION, model })).status, 0);
};

/** The recorded agent call made by the session, with the tool input changed as given. */
function call(toolInput: Record<string, unknown> = {}, fields: Record<string, unknown> = {}): string {
  const recorded = JSON.parse(hookInput('pre-tool-use-agent')) as Record<string, any>;
  return JSON.stringify({ ...recorded, ...fields, tool_input: { ...recorded.tool_input, ...toolInput } });
}

/** The recorded agent call made inside a subagent. */
function nestedCall(toolInput: Record<string, unknown> = {}, fields: Record<string, unknown> = {}): string {
  const recorded = JSON.parse(hookInput('pre-tool-use-agent-nested')) as Record<string, any>;
  return JSON.stringify({ ...recorded, session_id: SESSION, ...fields, tool_input: { ...recorded.tool_input, ...toolInput } });
}

/** The recorded result of a foreground call, for the given call and the model the subagent started on. */
function result(toolUseId: string, resolvedModel: string | undefined, response: Record<string, unknown> = {}): string {
  const recorded = JSON.parse(hookInput('post-tool-use-agent')) as Record<string, any>;
  const tool_response = { ...recorded.tool_response, resolvedModel, ...response };
  return JSON.stringify({ ...recorded, session_id: SESSION, agent_id: undefined, tool_use_id: toolUseId, tool_response });
}

const MAIN_CALL_ID = (JSON.parse(hookInput('pre-tool-use-agent')) as { tool_use_id: string }).tool_use_id;

/** The id Claude Code would give the subagent a call starts; any id works, so tests derive one from the call's. */
const agentOf = (toolUseId: string): string => `a-${toolUseId}`;

/** The start of a subagent, as SubagentStart reports it: its id and its type, not the call. */
function start(agentId: string, agentType = 'general-purpose', fields: Record<string, unknown> = {}): string {
  return hookInput('subagent-start', { session_id: SESSION, agent_id: agentId, agent_type: agentType, ...fields });
}

/** The context SubagentStart gave a subagent, or the empty string. */
const contextOf = (r: { out: Record<string, any> | null }): string => r.out?.hookSpecificOutput?.additionalContext ?? '';

/** Run an agent call, then the start of the subagent it starts; the rules that subagent received. */
function rulesFor(h: HookHome, input: string, extra: Record<string, string> = {}): string {
  const parsed = JSON.parse(input) as { session_id: string; tool_use_id: string; tool_input: { subagent_type?: string } };
  assert.equal(h.hook('agent-call', input, extra).status, 0);
  const r = h.hook('subagent-start', start(agentOf(parsed.tool_use_id), parsed.tool_input.subagent_type ?? 'general-purpose', { session_id: parsed.session_id }), extra);
  assert.equal(r.status, 0);
  return contextOf(r);
}

function config(fields: Record<string, unknown>): string {
  const lab = JSON.parse(fs.readFileSync(LAB_CONFIG, 'utf8')) as Record<string, unknown>;
  const dir = tempTree({ 'noonsight.json': { ...lab, ...fields } });
  fs.cpSync(path.join(path.dirname(LAB_CONFIG), 'rules'), path.join(dir, 'rules'), { recursive: true });
  return path.join(dir, 'noonsight.json');
}

const agentLines = (h: HookHome): Record<string, any>[] => h.log().filter((l) => l.event === 'agent-call' || l.event === 'agent-result');
const startLines = (h: HookHome): Record<string, any>[] => h.log().filter((l) => l.event === 'subagent-start');

test('a call that names a model: the call is left untouched, and its subagent gets the rules for its model when it starts', () => {
  const h = hookHome();
  startOn(h, 'claude-sonnet-5-5');
  const r = h.hook('agent-call', call());
  assert.equal(r.status, 0);
  assert.equal(r.raw, '', 'no updatedInput and no permission decision, so auto mode keeps its review of the response');
  const s = h.hook('subagent-start', start(agentOf(MAIN_CALL_ID)));
  assert.deepEqual(Object.keys(s.out ?? {}), ['hookSpecificOutput']);
  assert.equal(s.out?.hookSpecificOutput.hookEventName, 'SubagentStart');
  const context: string = s.out?.hookSpecificOutput.additionalContext;
  assert.ok(context.startsWith('<noonsight-rules model="claude-haiku-5-5">\n'), context);
  assert.match(context, /HAIKU-GEN-9047/);
  assert.match(context, /<\/noonsight-rules>$/);

  const [line] = agentLines(h);
  assert.equal(line?.event, 'agent-call');
  assert.equal(line?.tool_name, 'Agent');
  assert.equal(line?.tool_use_id, MAIN_CALL_ID);
  assert.equal(line?.session_id, SESSION);
  assert.equal(line?.agent_id, undefined, 'the session made the call, not a subagent');
  assert.deepEqual(
    [line?.subagent_type, line?.requested_model, line?.parent_model, line?.parent_source, line?.model, line?.model_source, line?.model_value],
    ['general-purpose', 'haiku', 'claude-sonnet-5-5', 'session-record', 'claude-haiku-5-5', 'parameter', 'haiku'],
  );
  assert.deepEqual([line?.status, line?.delivered, line?.permission, line?.warned], ['matched', 'at-start', undefined, false]);
  assert.deepEqual(line?.rules, ['haiku/general']);
  const [started] = startLines(h);
  assert.deepEqual(
    [started?.session_id, started?.agent_id, started?.agent_type, started?.start_match, started?.call_id, started?.model, started?.delivered, started?.place],
    [SESSION, agentOf(MAIN_CALL_ID), 'general-purpose', 'single', MAIN_CALL_ID, 'claude-haiku-5-5', 'rules', 'subagent'],
  );
  assert.deepEqual([started?.rules, started?.sha256], [line?.rules, line?.sha256]);

  // The same subagent resumed: the same rules again, which Claude Code adds only when its context no longer holds them.
  assert.equal(contextOf(h.hook('subagent-start', start(agentOf(MAIN_CALL_ID)))), context);
  assert.deepEqual([startLines(h)[1]?.start_match, startLines(h)[1]?.delivered], ['resumed', 'already-delivered']);
  // A subagent no call noonsight saw started, such as a teammate: nothing, and no line.
  assert.equal(h.hook('subagent-start', start('a-teammate')).raw, '');
  assert.equal(startLines(h).length, 2);
});

test('a call that names no model: the subagent inherits the session\'s model and gets the rules for the place "subagent"', () => {
  const h = hookHome();
  startOn(h, 'claude-sonnet-5-5');
  const prompt = rulesFor(h, call({ model: undefined }));
  assert.match(prompt, /<noonsight-rules model="claude-sonnet-5-5">/);
  assert.match(prompt, /SONNET-GEN-3306/);
  assert.match(prompt, /SONNET-CARRY-4471/, 'a rule for subagents is delivered to a subagent');
  const line = agentLines(h)[0];
  assert.deepEqual([line?.model, line?.model_source, line?.parent_source], ['claude-sonnet-5-5', 'parent', 'session-record']);
  assert.deepEqual(line?.rules, ['sonnet/general', 'sonnet/carry-through']);
});

test('a call that only gets rules is never changed and gets no permission decision, whatever subagents.permission says', () => {
  for (const permission of ['allow', 'ask', 'passthrough'] as const) {
    const h = hookHome(config({ subagents: { permission } }));
    startOn(h, 'claude-sonnet-5-5');
    assert.equal(h.hook('agent-call', call()).raw, '', permission);
    assert.match(contextOf(h.hook('subagent-start', start(agentOf(MAIN_CALL_ID)))), /HAIKU-GEN-9047/);
  }
  const h = hookHome();
  startOn(h, 'claude-sonnet-5-5');
  assert.equal(rulesFor(h, call({ model: 'opus' })), '', 'a model declared "none" gets nothing');
  assert.deepEqual(startLines(h).map((l) => [l.status, l.delivered]), [['none', 'nothing']]);
});

test('parallel calls: each subagent gets its own call\'s rules when only one call of its type is open, or when a result names it first', () => {
  const h = hookHome();
  startOn(h, 'claude-sonnet-5-5');
  const haiku = call({ model: 'haiku' }, { tool_use_id: 'toolu_h' });
  const sonnet = call({ model: 'sonnet', subagent_type: 'Explore' }, { tool_use_id: 'toolu_s' });
  h.hook('agent-call', haiku);
  h.hook('agent-call', sonnet);
  // One open call of each type: each start finds its own.
  assert.match(contextOf(h.hook('subagent-start', start('a-s', 'Explore'))), /SONNET-GEN-3306/);
  assert.match(contextOf(h.hook('subagent-start', start('a-h'))), /HAIKU-GEN-9047/);
  h.hook('agent-result', result('toolu_s', 'claude-sonnet-5-5', { agentId: 'a-s' }));
  h.hook('agent-result', result('toolu_h', 'claude-haiku-5-5', { agentId: 'a-h' }));

  // Two open calls of one type: the result of a call that runs in the background names its subagent,
  // before or after that subagent's start, so each start still finds its own call.
  const second = call({ model: 'sonnet' }, { tool_use_id: 'toolu_s2' });
  h.hook('agent-call', haiku.replace('toolu_h', 'toolu_h2'));
  h.hook('agent-call', second);
  const async = (toolUseId: string, agentId: string, model: string): string => {
    const launched = JSON.parse(hookInput('post-tool-use-agent-async')) as Record<string, any>;
    return JSON.stringify({ ...launched, session_id: SESSION, tool_use_id: toolUseId, tool_response: { ...launched.tool_response, agentId, resolvedModel: model } });
  };
  assert.equal(h.hook('agent-result', async('toolu_s2', 'a-s2', 'claude-sonnet-5-5')).raw, '');
  assert.match(contextOf(h.hook('subagent-start', start('a-s2'))), /SONNET-GEN-3306/);
  assert.match(contextOf(h.hook('subagent-start', start('a-h2'))), /HAIKU-GEN-9047/, 'the other call is then the only one open');
  assert.equal(h.hook('agent-result', async('toolu_h2', 'a-h2', 'claude-haiku-5-5')).raw, '');
  assert.deepEqual(
    startLines(h).map((l) => [l.agent_id, l.start_match, l.call_id, l.model]),
    [
      ['a-s', 'single', 'toolu_s', 'claude-sonnet-5-5'],
      ['a-h', 'single', 'toolu_h', 'claude-haiku-5-5'],
      ['a-s2', 'result', 'toolu_s2', 'claude-sonnet-5-5'],
      ['a-h2', 'single', 'toolu_h2', 'claude-haiku-5-5'],
    ],
  );
  assert.deepEqual(agentLines(h).filter((l) => l.event === 'agent-result').map((l) => l.result), ['match', 'match', 'match', 'match']);
  const state = path.join(h.dir, '.local', 'state', 'noonsight');
  assert.deepEqual(fs.readdirSync(path.join(state, 'agent-calls')), [], 'every call record is removed once its start and its result are both seen');
  assert.ok(!fs.existsSync(path.join(state, 'agent-pools', `${SESSION}.json`)), 'no call is left open');
});

test('parallel calls of one type that no result names in time: the start takes the most recent open call, and the next start the one left', () => {
  const h = hookHome(SCOPED());
  startOn(h, 'claude-haiku-5-5');
  h.hook('agent-call', call({ model: undefined, description: 'Rename', prompt: 'Rename the variable.' }, { tool_use_id: 'toolu_a' }));
  h.hook('agent-call', call({ model: undefined, description: 'Condense', prompt: 'Summarize the notes.' }, { tool_use_id: 'toolu_b' }));
  const first = contextOf(h.hook('subagent-start', start('a-1')));
  assert.match(first, /HAIKU-SUM-6610/, 'the summarize call, the most recent, gives its rules');
  const second = contextOf(h.hook('subagent-start', start('a-2')));
  assert.match(second, /HAIKU-GEN-9047/);
  assert.doesNotMatch(second, /HAIKU-SUM-6610/);
  assert.deepEqual(
    startLines(h).map((l) => [l.start_match, l.call_id, l.delivered]),
    [
      ['recent', 'toolu_b', 'rules'],
      ['single', 'toolu_a', 'rules'],
    ],
  );
  const state = path.join(h.dir, '.local', 'state', 'noonsight');
  assert.ok(!fs.existsSync(path.join(state, 'agent-pools', `${SESSION}.json`)), 'no call is left open');
});

test('a call denied inside the open window does not cost a later call of its type its own rules', () => {
  const h = hookHome(SCOPED());
  startOn(h, 'claude-haiku-5-5');
  h.hook('agent-call', call({ model: undefined, description: 'Rename', prompt: 'Rename the variable.' }, { tool_use_id: 'toolu_denied' }));
  assert.match(rulesFor(h, call({ model: undefined, description: 'Condense', prompt: 'Summarize the notes.' }, { tool_use_id: 'toolu_later' })), /HAIKU-SUM-6610/);
  assert.deepEqual([startLines(h).at(-1)?.start_match, startLines(h).at(-1)?.call_id], ['recent', 'toolu_later']);
});

test('after a denied sibling and a subagent that runs past the open window, a later call of the type still gets its own rules', () => {
  const h = hookHome(SCOPED());
  startOn(h, 'claude-haiku-5-5');
  h.hook('agent-call', call({ model: undefined, description: 'Rename', prompt: 'Rename the variable.' }, { tool_use_id: 'toolu_a' }));
  h.hook('agent-call', call({ model: undefined, description: 'Rename', prompt: 'Rename the file.' }, { tool_use_id: 'toolu_b' }));
  assert.equal(h.hook('subagent-start', start('a-a')).status, 0);
  const poolPath = path.join(h.dir, '.local', 'state', 'noonsight', 'agent-pools', `${SESSION}.json`);
  const age = (): void => {
    const pool = JSON.parse(fs.readFileSync(poolPath, 'utf8')) as { open: { at: string }[] };
    for (const c of pool.open) c.at = new Date(Date.parse(c.at) - 5 * 60 * 1000).toISOString();
    fs.writeFileSync(poolPath, JSON.stringify(pool));
  };
  age();
  h.hook('agent-result', result('toolu_a', 'claude-haiku-5-5', { agentId: 'a-a' }));
  assert.match(rulesFor(h, call({ model: undefined, description: 'Condense', prompt: 'Summarize the notes.' }, { tool_use_id: 'toolu_c' })), /HAIKU-SUM-6610/);
  assert.deepEqual([startLines(h).at(-1)?.start_match, startLines(h).at(-1)?.call_id], ['single', 'toolu_c']);
});

test('a call whose subagent never starts, such as one denied after its hook, is left out after 2 minutes, so a later call of its type is matched alone', () => {
  const h = hookHome(SCOPED());
  startOn(h, 'claude-haiku-5-5');
  h.hook('agent-call', call({ model: undefined, description: 'Rename', prompt: 'Rename the variable.' }, { tool_use_id: 'toolu_denied' }));
  const poolPath = path.join(h.dir, '.local', 'state', 'noonsight', 'agent-pools', `${SESSION}.json`);
  const pool = JSON.parse(fs.readFileSync(poolPath, 'utf8')) as { open: { at: string }[] };
  for (const c of pool.open) c.at = new Date(Date.parse(c.at) - 3 * 60 * 1000).toISOString();
  fs.writeFileSync(poolPath, JSON.stringify(pool));

  assert.match(rulesFor(h, call({ model: undefined, description: 'Condense', prompt: 'Summarize the notes.' }, { tool_use_id: 'toolu_later' })), /HAIKU-SUM-6610/);
  assert.deepEqual([startLines(h).at(-1)?.start_match, startLines(h).at(-1)?.call_id], ['single', 'toolu_later']);
});

test('a call whose subagent starts after the open window gives it no rules, and its result says so', () => {
  const h = hookHome();
  startOn(h, 'claude-sonnet-5-5');
  h.hook('agent-call', call({ model: 'haiku' }, { tool_use_id: 'toolu_late' }));
  const state = path.join(h.dir, '.local', 'state', 'noonsight');
  const poolPath = path.join(state, 'agent-pools', `${SESSION}.json`);
  const pool = JSON.parse(fs.readFileSync(poolPath, 'utf8')) as { open: { at: string }[] };
  for (const c of pool.open) c.at = new Date(Date.parse(c.at) - 3 * 60 * 1000).toISOString();
  fs.writeFileSync(poolPath, JSON.stringify(pool));

  assert.equal(h.hook('subagent-start', start('a-late')).raw, '', 'the subagent gets no rules');
  const r = h.hook('agent-result', result('toolu_late', 'claude-sonnet-5-5', { agentId: 'a-late' }));
  assert.match(r.out?.systemMessage, /started on claude-sonnet-5-5, not on claude-haiku-5-5 as noonsight predicted, so it received no rules\./);
  const line = agentLines(h).at(-1);
  assert.deepEqual([line?.event, line?.result, line?.delivered], ['agent-result', 'MISMATCH', 'nothing']);
  assert.ok(!fs.existsSync(path.join(state, 'agent-links', 'a-late.json')), 'no link is left for a start that already passed');
  assert.deepEqual(fs.readdirSync(path.join(state, 'agent-calls')), [], 'the call record is removed');
});

test('an undeclared model warns the person and leaves the call alone; on_undeclared "ignore" silences it', () => {
  const h = hookHome();
  startOn(h, 'claude-sonnet-5-5');
  const r = h.hook('agent-call', call({ model: 'fable' }));
  assert.deepEqual(Object.keys(r.out ?? {}), ['systemMessage']);
  assert.match(r.out?.systemMessage, /^noonsight: subagent general-purpose will run on claude-fable-5-2, which is not declared in .*noonsight\.json, so it gets no rules\./);
  assert.deepEqual(agentLines(h).map((l) => [l.model, l.status, l.reason, l.delivered, l.warned]), [['claude-fable-5-2', 'undeclared', 'no-entry', 'nothing', true]]);

  const quiet = hookHome(config({ on_undeclared: 'ignore' }));
  startOn(quiet, 'claude-sonnet-5-5');
  assert.equal(quiet.hook('agent-call', call({ model: 'fable' })).raw, '');
  assert.deepEqual(agentLines(quiet).map((l) => [l.status, l.warned]), [['undeclared', false]]);
});

test('the result of the call: the model the subagent started on matches the prediction, and is recorded', () => {
  const h = hookHome();
  startOn(h, 'claude-sonnet-5-5');
  h.hook('agent-call', call());
  // The subagent the recorded result names.
  h.hook('subagent-start', start('a92fbba5fa2c7141c'));
  const calls = path.join(h.dir, '.local', 'state', 'noonsight', 'agent-calls');
  assert.deepEqual(fs.readdirSync(calls), [`${MAIN_CALL_ID}.json`]);
  const r = h.hook('agent-result', result(MAIN_CALL_ID, 'claude-haiku-5-5'));
  assert.equal(r.raw, '');
  const line = agentLines(h)[1];
  assert.deepEqual(
    [line?.event, line?.subagent_type, line?.predicted, line?.model, line?.result, line?.delivered, line?.warned],
    ['agent-result', 'general-purpose', 'claude-haiku-5-5', 'claude-haiku-5-5', 'match', 'rules', false],
  );
  assert.equal(line?.subagent_id, 'a92fbba5fa2c7141c');
  assert.deepEqual(fs.readdirSync(calls), [], 'the record of the call is removed once checked');
  const agent = JSON.parse(fs.readFileSync(path.join(h.dir, '.local', 'state', 'noonsight', 'agents', 'a92fbba5fa2c7141c.json'), 'utf8'));
  assert.equal(agent.model, 'claude-haiku-5-5');
});

test('a subagent that starts on another model than predicted: a warning and a MISMATCH line; on_mismatch "ignore" only logs', () => {
  const h = hookHome();
  startOn(h, 'claude-sonnet-5-5');
  rulesFor(h, call());
  const r = h.hook('agent-result', result(MAIN_CALL_ID, 'claude-sonnet-5-5', { agentId: agentOf(MAIN_CALL_ID), modelsUsed: ['claude-sonnet-5-5', 'claude-opus-5-5'] }));
  assert.deepEqual(Object.keys(r.out ?? {}), ['systemMessage']);
  assert.equal(
    r.out?.systemMessage,
    `noonsight: subagent general-purpose (${agentOf(MAIN_CALL_ID)}) started on claude-sonnet-5-5, not on claude-haiku-5-5 as noonsight predicted, so it received the rules for claude-haiku-5-5.`,
  );
  const line = agentLines(h)[1];
  assert.deepEqual([line?.result, line?.predicted, line?.model, line?.warned], ['MISMATCH', 'claude-haiku-5-5', 'claude-sonnet-5-5', true]);
  assert.deepEqual(line?.models_used, ['claude-sonnet-5-5', 'claude-opus-5-5']);

  const quiet = hookHome(config({ subagents: { on_mismatch: 'ignore' } }));
  startOn(quiet, 'claude-sonnet-5-5');
  quiet.hook('agent-call', call({ model: 'opus' }));
  assert.equal(quiet.hook('agent-result', result(MAIN_CALL_ID, 'claude-haiku-5-5')).raw, '');
  assert.deepEqual(agentLines(quiet).map((l) => [l.result ?? l.status, l.delivered, l.warned]), [
    ['none', 'nothing', false],
    ['MISMATCH', 'nothing', false],
  ]);
});

test('a result without resolvedModel, or for a call noonsight never saw, is not a mismatch', () => {
  const h = hookHome();
  startOn(h, 'claude-sonnet-5-5');
  h.hook('agent-call', call());
  assert.equal(h.hook('agent-result', result(MAIN_CALL_ID, undefined)).raw, '');
  assert.equal(agentLines(h)[1]?.result, 'unknown');
  assert.equal(h.hook('agent-result', result('toolu_never_seen', 'claude-haiku-5-5')).raw, '');
  assert.equal(agentLines(h).length, 2, 'no line for a call noonsight did not see start');
});

test('a call made inside a subagent inherits that subagent\'s model: from the result of a background launch, else from its transcript', () => {
  // The subagent was launched in the background: its result named it and its model at once.
  const background = hookHome();
  startOn(background, 'claude-sonnet-5-5');
  const launched = JSON.parse(hookInput('post-tool-use-agent-async')) as Record<string, any>;
  background.hook('agent-result', JSON.stringify({ ...launched, session_id: SESSION, tool_response: { ...launched.tool_response, agentId: NESTED_AGENT, resolvedModel: 'claude-haiku-5-5' } }));
  assert.match(rulesFor(background, nestedCall()), /HAIKU-GEN-9047/);
  const line = agentLines(background).at(-1);
  assert.deepEqual([line?.agent_id, line?.parent_model, line?.parent_source, line?.model, line?.model_source], [NESTED_AGENT, 'claude-haiku-5-5', 'agent-record', 'claude-haiku-5-5', 'parent']);

  // A foreground subagent: no result yet, so its own transcript says which model it runs on.
  const foreground = hookHome();
  startOn(foreground, 'claude-haiku-5-5');
  const project = tempTree({});
  const sessionTranscript = path.join(project, `${SESSION}.jsonl`);
  const own = path.join(project, SESSION, 'subagents', `agent-${NESTED_AGENT}.jsonl`);
  fs.mkdirSync(path.dirname(own), { recursive: true });
  fs.writeFileSync(
    own,
    [
      { type: 'user', message: { role: 'user', content: 'task' } },
      { type: 'assistant', isSidechain: true, message: { model: 'claude-sonnet-5-5', content: [] } },
      '{"type":"assistant", torn',
    ]
      .map((l) => (typeof l === 'string' ? l : JSON.stringify(l)))
      .join('\n') + '\n',
  );
  assert.match(rulesFor(foreground, nestedCall({}, { transcript_path: sessionTranscript })), /SONNET-GEN-3306/);
  const nestedLine = agentLines(foreground).at(-1);
  assert.deepEqual([nestedLine?.parent_model, nestedLine?.parent_source, nestedLine?.model], ['claude-sonnet-5-5', 'agent-transcript', 'claude-sonnet-5-5']);

  // Neither: noonsight cannot tell, so it warns and delivers nothing rather than guess the session's model.
  const unknown = hookHome();
  startOn(unknown, 'claude-haiku-5-5');
  const u = unknown.hook('agent-call', nestedCall({}, { transcript_path: path.join(tempTree({}), `${SESSION}.jsonl`) }));
  assert.deepEqual(Object.keys(u.out ?? {}), ['systemMessage']);
  assert.match(u.out?.systemMessage, /^noonsight: noonsight cannot tell which model subagent general-purpose will run on \(the model of the session or subagent that starts it is not known\), so it gets no rules\./);
  assert.deepEqual(agentLines(unknown).map((l) => [l.model, l.status, l.reason, l.parent_source, l.delivered]), [[null, 'undeclared', 'model-not-reported', null, 'nothing']]);

  // A model named in the nested call needs no parent; the earlier call's subagent started with no rules.
  assert.equal(unknown.hook('subagent-start', start(agentOf(JSON.parse(nestedCall()).tool_use_id))).raw, '');
  assert.match(rulesFor(unknown, nestedCall({ model: 'sonnet' }, { tool_use_id: 'toolu_nested_sonnet' })), /SONNET-GEN-3306/);
});

test('without a record of the session, the session\'s transcript, then the settings it started with, name the parent\'s model', () => {
  const h = hookHome();
  const project = tempTree({});
  const transcript = path.join(project, `${SESSION}.jsonl`);
  fs.writeFileSync(
    transcript,
    [
      { type: 'assistant', message: { model: 'claude-haiku-5-5' } },
      { type: 'assistant', isSidechain: true, message: { model: 'claude-sonnet-5-5' } },
      { type: 'assistant', message: { model: '<synthetic>' } },
    ]
      .map((l) => JSON.stringify(l))
      .join('\n'),
  );
  assert.match(rulesFor(h, call({ model: undefined }, { transcript_path: transcript })), /HAIKU-GEN-9047/);
  assert.equal(agentLines(h)[0]?.parent_source, 'session-transcript');

  const fromEnv = rulesFor(h, call({ model: undefined }, { transcript_path: path.join(project, 'missing.jsonl'), tool_use_id: 'toolu_env' }), { ANTHROPIC_MODEL: 'sonnet' });
  assert.match(fromEnv, /SONNET-GEN-3306/);
  assert.deepEqual([agentLines(h)[1]?.parent_model, agentLines(h)[1]?.parent_source], ['claude-sonnet-5-5', 'env']);
});

test('built-in subagents: Explore follows its parent, except on Opus under a Fable parent on the Anthropic API; the guide and web-fetch run on Haiku', () => {
  const h = hookHome();
  const explore = (parent: string, extra: Record<string, string> = {}): Record<string, any> | undefined => {
    startOn(h, parent);
    h.hook('agent-call', call({ model: undefined, subagent_type: 'Explore' }), extra);
    return agentLines(h).at(-1);
  };
  assert.deepEqual([explore('claude-sonnet-5-5')?.model, agentLines(h).at(-1)?.model_source], ['claude-sonnet-5-5', 'built-in']);
  assert.deepEqual([explore('claude-fable-5-2')?.model, agentLines(h).at(-1)?.model_value], ['claude-opus-5-5', 'opus']);
  assert.equal(explore('claude-fable-5-2', { ANTHROPIC_DEFAULT_OPUS_MODEL: 'claude-opus-4-7' })?.model, 'claude-opus-4-7');
  assert.equal(explore('claude-fable-5-2', { CLAUDE_CODE_USE_BEDROCK: '1' })?.model, 'claude-fable-5-2');
  assert.equal(explore('claude-sonnet-5-5', { CLAUDE_CODE_SUBAGENT_MODEL: 'haiku' })?.model, 'claude-sonnet-5-5', 'Explore ignores CLAUDE_CODE_SUBAGENT_MODEL');

  startOn(h, 'claude-sonnet-5-5');
  h.hook('agent-call', call({ model: undefined, subagent_type: 'claude-code-guide' }));
  assert.deepEqual([agentLines(h).at(-1)?.model, agentLines(h).at(-1)?.model_source], ['claude-haiku-5-5', 'built-in']);

  // web-fetch: the model the haiku alias selects on the Anthropic API, its parent's on another provider.
  const webFetch = (extra: Record<string, string> = {}): unknown[] => {
    h.hook('agent-call', call({ model: undefined, subagent_type: 'web-fetch' }), extra);
    const l = agentLines(h).at(-1);
    return [l?.model, l?.model_source, l?.rules];
  };
  assert.deepEqual(webFetch(), ['claude-haiku-5-5', 'built-in', ['haiku/general']]);
  assert.deepEqual(webFetch({ CLAUDE_CODE_SUBAGENT_MODEL: 'sonnet' }).slice(0, 2), ['claude-haiku-5-5', 'built-in'], 'its own model wins over CLAUDE_CODE_SUBAGENT_MODEL');
  assert.deepEqual(webFetch({ ANTHROPIC_DEFAULT_HAIKU_MODEL: 'claude-haiku-4-5' }).slice(0, 2), ['claude-haiku-4-5', 'built-in']);
  assert.deepEqual(webFetch({ CLAUDE_CODE_USE_VERTEX: '1' }).slice(0, 2), ['claude-sonnet-5-5', 'built-in']);
});

test('a subagent type noonsight does not know follows the model order, as general-purpose does', () => {
  const h = hookHome();
  startOn(h, 'claude-sonnet-5-5');
  assert.match(rulesFor(h, call({ model: undefined, subagent_type: 'deep-research' })), /SONNET-GEN-3306/);
  assert.deepEqual([agentLines(h).at(-1)?.model, agentLines(h).at(-1)?.model_source], ['claude-sonnet-5-5', 'parent']);
  h.hook('agent-call', call({ model: undefined, subagent_type: 'deep-research' }, { tool_use_id: 'toolu_env' }), { CLAUDE_CODE_SUBAGENT_MODEL: 'haiku' });
  assert.deepEqual([agentLines(h).at(-1)?.model, agentLines(h).at(-1)?.model_source], ['claude-haiku-5-5', 'env']);
});

test('subagent definitions: the closest project definition, then the user\'s, set the model; inherit and a definition without a model follow the parent', () => {
  const repo = tempTree({
    '.git/HEAD': 'ref: refs/heads/main\n',
    '.claude/agents/team/reviewer.md': '---\nname: reviewer\ndescription: Reviews.\nmodel: "haiku"\n---\nReview the change.\n',
    '.claude/agents/plain.md': '---\nname: plain\ndescription: No model.\n---\nDo it.\n',
    'app/.claude/agents/reviewer-close.md': '---\nname: reviewer\ndescription: Closer.\nmodel: claude-opus-5-5 # pinned\n---\n',
    'app/src/.keep': '',
  });
  const configDir = tempTree({ 'agents/mine.md': '---\nname: mine\ndescription: Mine.\nmodel: inherit\n---\n', 'agents/Explore.md': '---\nname: Explore\ndescription: Cheap.\nmodel: haiku\n---\n' });
  const h = hookHome(undefined, { CLAUDE_CONFIG_DIR: configDir });
  startOn(h, 'claude-sonnet-5-5');
  const predicted = (type: string, cwd: string): unknown[] => {
    h.hook('agent-call', call({ model: undefined, subagent_type: type }, { cwd }));
    const l = agentLines(h).at(-1);
    return [l?.model, l?.model_source, l?.definition === undefined ? undefined : path.relative(fs.realpathSync(repo), fs.realpathSync(l.definition)) || l.definition];
  };
  assert.deepEqual(predicted('reviewer', path.join(repo, 'app', 'src')), ['claude-opus-5-5', 'definition', path.join('app', '.claude', 'agents', 'reviewer-close.md')]);
  assert.deepEqual(predicted('reviewer', repo), ['claude-haiku-5-5', 'definition', path.join('.claude', 'agents', 'team', 'reviewer.md')]);
  assert.deepEqual(predicted('plain', repo), ['claude-sonnet-5-5', 'parent', undefined]);
  assert.deepEqual(predicted('mine', repo).slice(0, 2), ['claude-sonnet-5-5', 'definition']);
  assert.deepEqual(predicted('Explore', repo).slice(0, 2), ['claude-haiku-5-5', 'definition'], 'a user definition named Explore replaces the built-in');
  // CLAUDE_PROJECT_DIR, which Claude Code gives hooks, is where the walk starts, wherever the session has moved to.
  h.hook('agent-call', call({ model: undefined, subagent_type: 'reviewer' }, { cwd: tempTree({}) }), { CLAUDE_PROJECT_DIR: path.join(repo, 'app') });
  assert.equal(agentLines(h).at(-1)?.model, 'claude-opus-5-5');
});

test('subagent definitions without a repository: only the working directory\'s own .claude/agents is read, never its parents\'', () => {
  const parent = tempTree({ '.claude/agents/reviewer.md': '---\nname: reviewer\ndescription: Elsewhere.\nmodel: haiku\n---\n' });
  const scratch = path.join(parent, 'scratch');
  fs.mkdirSync(path.join(scratch, '.claude', 'agents'), { recursive: true });
  fs.writeFileSync(path.join(scratch, '.claude', 'agents', 'helper.md'), '---\nname: helper\ndescription: Own.\nmodel: claude-opus-5-5\n---\n');
  const configDir = tempTree({});
  const h = hookHome(undefined, { CLAUDE_CONFIG_DIR: configDir });
  startOn(h, 'claude-sonnet-5-5');
  const predicted = (type: string): unknown[] => {
    h.hook('agent-call', call({ model: undefined, subagent_type: type }, { cwd: scratch }));
    const l = agentLines(h).at(-1);
    return [l?.model, l?.model_source];
  };
  assert.deepEqual(predicted('reviewer'), ['claude-sonnet-5-5', 'parent'], 'the haiku definition in a parent directory is not the session\'s');
  assert.deepEqual(predicted('helper'), ['claude-opus-5-5', 'definition'], 'the working directory\'s own definition is still read');
});

test('model order: the call\'s parameter beats a definition, CLAUDE_CODE_SUBAGENT_MODEL fills in, FORCE overrides, a fork follows its parent', () => {
  const repo = tempTree({ '.git/HEAD': '', '.claude/agents/r.md': '---\nname: reviewer\nmodel: haiku\n---\n' });
  const h = hookHome();
  startOn(h, 'claude-sonnet-5-5');
  const predicted = (toolInput: Record<string, unknown>, extra: Record<string, string> = {}): unknown[] => {
    h.hook('agent-call', call({ model: undefined, ...toolInput }, { cwd: repo }), extra);
    const l = agentLines(h).at(-1);
    return [l?.model, l?.model_source];
  };
  assert.deepEqual(predicted({ subagent_type: 'reviewer', model: 'opus' }), ['claude-opus-5-5', 'parameter']);
  assert.deepEqual(predicted({ subagent_type: 'general-purpose' }, { CLAUDE_CODE_SUBAGENT_MODEL: 'haiku' }), ['claude-haiku-5-5', 'env']);
  assert.deepEqual(predicted({ subagent_type: 'reviewer' }, { CLAUDE_CODE_SUBAGENT_MODEL: 'opus' }), ['claude-haiku-5-5', 'definition']);
  const force = { CLAUDE_CODE_SUBAGENT_MODEL_FORCE: '1', CLAUDE_CODE_SUBAGENT_MODEL: 'haiku' };
  assert.deepEqual(predicted({ subagent_type: 'reviewer', model: 'opus' }, force), ['claude-haiku-5-5', 'forced']);
  assert.deepEqual(predicted({ subagent_type: 'reviewer', model: 'opus' }, { CLAUDE_CODE_SUBAGENT_MODEL_FORCE: '1' }), ['claude-sonnet-5-5', 'forced']);
  assert.deepEqual(predicted({ subagent_type: 'fork', model: 'haiku' }, force), ['claude-sonnet-5-5', 'fork']);
  assert.deepEqual(predicted({ subagent_type: undefined }), ['claude-sonnet-5-5', 'parent']);
  assert.equal(agentLines(h).at(-1)?.subagent_type, 'general-purpose', 'a call that names no type starts the general-purpose subagent');
});

test('a family alias keeps the parent\'s own version, and a plugin\'s subagent is predicted on its parent with its definition unread', () => {
  const h = hookHome();
  startOn(h, 'claude-sonnet-4-5');
  h.hook('agent-call', call({ model: 'sonnet' }));
  assert.deepEqual([agentLines(h).at(-1)?.model, agentLines(h).at(-1)?.status], ['claude-sonnet-4-5', 'undeclared']);
  h.hook('agent-call', call({ model: 'haiku' }));
  assert.equal(agentLines(h).at(-1)?.model, 'claude-haiku-5-5');

  startOn(h, 'claude-sonnet-5-5');
  h.hook('agent-call', call({ model: undefined, subagent_type: 'review-kit:security' }));
  const l = agentLines(h).at(-1);
  assert.deepEqual([l?.model, l?.model_source, l?.definition], ['claude-sonnet-5-5', 'parent', 'not-read']);
});

test('subagents.delivery "off": calls are left alone and their results are not checked', () => {
  const h = hookHome(config({ subagents: { delivery: 'off' } }));
  startOn(h, 'claude-sonnet-5-5');
  assert.equal(h.hook('agent-call', call({ model: 'fable' })).raw, '');
  assert.equal(h.hook('subagent-start', start(agentOf(MAIN_CALL_ID))).raw, '');
  assert.equal(h.hook('agent-result', result(MAIN_CALL_ID, 'claude-opus-5-5')).raw, '');
  assert.deepEqual(h.log().filter((l) => l.event !== 'session-start').map((l) => [l.event, l.delivered, l.warned]), [['agent-call', 'off', false]]);
});

test('a task text that already holds the exact rules is not given them again', () => {
  const h = hookHome();
  startOn(h, 'claude-sonnet-5-5');
  const rules = rulesFor(h, call());
  const original = (JSON.parse(call()) as { tool_input: { prompt: string } }).tool_input.prompt;
  assert.equal(rulesFor(h, call({ prompt: `${original}\n\n${rules}` }, { tool_use_id: 'toolu_again' })), '');
  assert.equal(agentLines(h).at(-1)?.delivered, 'already-delivered');
  assert.equal(startLines(h).at(-1)?.delivered, 'already-delivered');
});

test('only the agent tool, under either name, reaches the subagent hooks; other input is ignored silently', () => {
  const h = hookHome();
  startOn(h, 'claude-sonnet-5-5');
  assert.equal(h.hook('agent-call', call({}, { tool_name: 'Bash', tool_input: { command: 'ls' } })).raw, '');
  assert.equal(h.hook('agent-result', call({}, { hook_event_name: 'PostToolUse', tool_name: 'Read' })).raw, '');
  assert.equal(h.hook('agent-call', call({}, { hook_event_name: 'PostToolUse' })).raw, '');
  assert.equal(h.hook('agent-call', 'not json').raw, '');
  assert.equal(agentLines(h).length, 0);
  assert.match(rulesFor(h, call({}, { tool_name: 'Task' })), /HAIKU-GEN-9047/);
  assert.equal(agentLines(h)[0]?.tool_name, 'Task');
  assert.equal(h.hook('subagent-start', start(agentOf(MAIN_CALL_ID), 'general-purpose', { hook_event_name: 'SubagentStop' })).raw, '');
});

test('a refused configuration: the call goes ahead unchanged, the person is warned once per call, and its result is logged without a warning', () => {
  const bad = path.join(tempTree({ 'noonsight.json': { version: 1, subagents: { delivery: 'start-context' } } }), 'noonsight.json');
  const h = hookHome(bad);
  const r = h.hook('agent-call', call());
  assert.deepEqual(Object.keys(r.out ?? {}), ['systemMessage']);
  assert.match(r.out?.systemMessage, /was refused \(1 problem\), so no rules were delivered/);
  assert.equal(h.hook('subagent-start', start(agentOf(MAIN_CALL_ID))).raw, '', 'the start neither warns again nor logs');
  assert.equal(h.hook('agent-result', result(MAIN_CALL_ID, 'claude-haiku-5-5')).raw, '');
  assert.deepEqual(
    h.log().map((l) => [l.event, l.status, l.warned]),
    [
      ['agent-call', 'config-invalid', true],
      ['agent-result', 'config-invalid', false],
    ],
  );
});

test('the hook pointer written by install runs the subagent hooks', () => {
  const home = tempTree({});
  const claudeDir = tempTree({});
  const env = { HOME: home, NOONSIGHT_CONFIG: LAB_CONFIG, NOONSIGHT_PRESETS_DIR: LAB_PRESETS, NOONSIGHT_SYSTEM_ROOT: tempTree({}) };
  assert.equal(runCli(['install', '--account', claudeDir], env).status, 0);
  const settings = JSON.parse(fs.readFileSync(path.join(claudeDir, 'settings.json'), 'utf8'));
  const [entry] = settings.hooks.PreToolUse;
  assert.equal(entry.matcher, 'Agent|Task');
  const pointer = entry.hooks[0].command;
  assert.equal(runProgram(pointer, ['session-start'], env, hookInput('session-start-startup', { session_id: SESSION, model: 'claude-sonnet-5-5' })).status, 0);
  const r = runProgram(pointer, entry.hooks[0].args, env, call());
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, '');
  const [startEntry] = settings.hooks.SubagentStart;
  assert.equal(startEntry.matcher, undefined, 'every subagent type starts noonsight');
  const s = runProgram(pointer, startEntry.hooks[0].args, env, start(agentOf(MAIN_CALL_ID)));
  assert.match(JSON.parse(s.stdout).hookSpecificOutput.additionalContext, /HAIKU-GEN-9047/);
  const post = runProgram(pointer, settings.hooks.PostToolUse[0].hooks[0].args, env, result(MAIN_CALL_ID, 'claude-sonnet-5-5'));
  assert.match(JSON.parse(post.stdout).systemMessage, /not on claude-haiku-5-5 as noonsight predicted/);
  assert.ok(fs.existsSync(CLI));
});

test('definition frontmatter: top-level name and model only, quotes and comments removed, and no frontmatter means no definition', () => {
  assert.deepEqual(frontmatter('---\nname: "reviewer"\nmodel: haiku # cheap\ndescription: |\n  name: nested\n---\nbody'), { name: 'reviewer', model: 'haiku' });
  assert.deepEqual(frontmatter('---\r\nname: r\r\n---\r\n'), { name: 'r' });
  assert.equal(frontmatter('name: r\n'), null);
  assert.equal(frontmatter('---\nname: r\n'), null, 'an unterminated frontmatter is not read');
});

test('subagent records nobody wrote for 7 days are removed when a session starts, the others kept', () => {
  const h = hookHome();
  const state = path.join(h.dir, '.local', 'state', 'noonsight');
  const old = Date.now() / 1000 - 8 * 24 * 60 * 60;
  for (const [dir, name, age] of [
    ['agent-calls', 'toolu_old.json', old],
    ['agent-pools', 'old-session.json', old],
    ['agent-starts', 'aold.json', old],
    ['agent-links', 'aold.json', old],
    ['agents', 'aold.json', old],
    ['agents', 'anew.json', Date.now() / 1000],
  ] as const) {
    fs.mkdirSync(path.join(state, dir), { recursive: true });
    const file = path.join(state, dir, name);
    fs.writeFileSync(file, '{}');
    fs.utimesSync(file, age, age);
  }
  startOn(h, 'claude-sonnet-5-5');
  for (const dir of ['agent-calls', 'agent-pools', 'agent-starts', 'agent-links']) assert.deepEqual(fs.readdirSync(path.join(state, dir)), [], dir);
  assert.deepEqual(fs.readdirSync(path.join(state, 'agents')), ['anew.json']);
});

/** The lab configuration with matchers on two scopes and a search and an implement scope with none. */
const SCOPED = (): string =>
  config({
    scopes: {
      summarize: { match: ['\\bsummar', '\\bdigest\\b'] },
      investigate: { match: ['\\binvestigat', '\\broot cause\\b'] },
      search: {},
      implement: {},
    },
  });

test('a subagent\'s scope comes from its own task text, so two tasks on one model get different rules', () => {
  const h = hookHome(SCOPED());
  startOn(h, 'claude-sonnet-5-5');
  const prompt = (input: string): string => rulesFor(h, input);
  const summarize = prompt(call({ model: 'haiku', description: 'Condense the notes', prompt: 'Summarize the meeting notes.' }, { tool_use_id: 'toolu_sum' }));
  assert.match(summarize, /<noonsight-rules model="claude-haiku-5-5" scope="summarize">/);
  assert.match(summarize, /HAIKU-SUM-6610/);
  const investigate = prompt(call({ model: 'sonnet', description: 'Find the root cause', prompt: 'Look at the failing build.' }, { tool_use_id: 'toolu_inv' }));
  assert.match(investigate, /SONNET-INV-5182/);
  assert.match(investigate, /SONNET-CARRY-4471/, 'a subagent is in the place subagent');
  const plain = prompt(call({ model: 'haiku', description: 'Rename', prompt: 'Rename the variable.' }, { tool_use_id: 'toolu_none' }));
  assert.doesNotMatch(plain, /HAIKU-SUM-6610/);
  assert.match(plain, /^<noonsight-rules model="claude-haiku-5-5">\n/);

  assert.deepEqual(
    agentLines(h).map((l) => [l.model, l.scope, l.scope_source, l.scope_matcher ?? null, l.place]),
    [
      ['claude-haiku-5-5', 'summarize', 'task-text', '\\bsummar', 'subagent'],
      ['claude-sonnet-5-5', 'investigate', 'task-text', '\\broot cause\\b', 'subagent'],
      ['claude-haiku-5-5', null, null, null, 'subagent'],
    ],
  );
});

test('a task text longer than the matchers read is logged as cut, so a scope missing for that reason can be traced', () => {
  const h = hookHome(SCOPED());
  startOn(h, 'claude-haiku-5-5');
  h.hook('agent-call', call({ model: undefined, prompt: `${'x '.repeat(50_000)}Investigate the logs.` }), {});
  h.hook('agent-call', call({ model: undefined, prompt: 'Investigate the logs.' }, { tool_use_id: 'toolu_short' }), {});
  assert.deepEqual(
    agentLines(h).map((l) => [l.scope, l.task_text_cut ?? null]),
    [
      [null, true],
      ['investigate', null],
    ],
  );
});

test('the session\'s NOONSIGHT_SCOPE never carries over to a subagent, whose scope comes from its own task only', () => {
  const h = hookHome(SCOPED());
  startOn(h, 'claude-haiku-5-5');
  const other = rulesFor(h, call({ model: undefined, prompt: 'Rename the variable.' }), { NOONSIGHT_SCOPE: 'summarize' });
  assert.match(other, /HAIKU-GEN-9047/);
  assert.doesNotMatch(other, /HAIKU-SUM-6610/);
  assert.deepEqual(
    agentLines(h).map((l) => [l.subagent_type, l.scope, l.scope_source]),
    [['general-purpose', null, null]],
  );
});
