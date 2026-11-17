// Live subagent tests: real Claude Code sessions that start subagents, run from the login of the
// person running them, with noonsight's hooks given through --settings. They send prompts to the
// models, so they spend a little usage, and they only run when asked:
//
//   NOONSIGHT_LIVE_LOGIN=1 npm run test:live
//
// login.ts describes what they need, and what they touch in the person's Claude Code directory.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { PACKAGE_ROOT } from '../../src/config/paths.js';
import { baseEnv, calls, claudeArgs, enabled, lab as loginLab, preconditions, print, reply, results, type Lab as LoginLab } from './login.js';

const DRIVER = path.join(PACKAGE_ROOT, 'test', 'live', 'drive.exp');
const SONNET_WORD = 'SONNET-SUB-5521';
const HAIKU_WORD = 'HAIKU-SUB-8093';
/** What every subagent is asked; the answer names the rules it received. */
const PROBE =
  'Reply with only the verification words of any noonsight working rules you were given in this conversation, ' +
  'separated by single spaces, or the single word NONE if you were given none. Do not use any tool.';

interface Lab extends LoginLab {
  readonly plugin: string;
}

function lab(config: Record<string, unknown>): Lab {
  const l = loginLab('sub', config, {
    'sonnet.md': `- The verification word for claude-sonnet-5-5 is ${SONNET_WORD}.`,
    'haiku.md': `- The verification word for claude-haiku-5-5 is ${HAIKU_WORD}.`,
  });
  // A plugin whose subagent sets its own model: noonsight does not read plugin definitions, so it
  // predicts the parent's model, and the subagent starts on Haiku.
  const plugin = path.join(l.root, 'plugin');
  fs.mkdirSync(path.join(plugin, '.claude-plugin'), { recursive: true });
  fs.mkdirSync(path.join(plugin, 'agents'));
  fs.writeFileSync(path.join(plugin, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'noonsight-live', version: '0.0.0', description: 'noonsight live test' }));
  fs.writeFileSync(path.join(plugin, 'agents', 'probe.md'), '---\nname: probe\ndescription: Answers the noonsight live test probe.\nmodel: haiku\n---\nAnswer the task exactly as asked.\n');
  return { ...l, plugin };
}

/** sonnet and haiku have rules; opus is not declared. */
const CONFIG = {
  version: 1,
  models: {
    'claude-sonnet-5-5': { use: 'custom', add: [{ id: 'live/sonnet', file: 'sonnet.md' }] },
    'claude-haiku-5-5': { use: 'custom', add: [{ id: 'live/haiku', file: 'haiku.md' }] },
  },
};

const THREE_MODELS =
  'This is a configuration test. Make exactly three Agent tool calls in a single message, so that they run in parallel. ' +
  `All three use subagent_type "general-purpose" and exactly this prompt: "${PROBE}" ` +
  'Call 1 sets the model parameter to "sonnet". Call 2 sets the model parameter to "haiku". Call 3 sets the model parameter to "opus". ' +
  'After the three results arrive, reply with exactly one line in this form, copying each reply verbatim: sonnet=<reply> haiku=<reply> opus=<reply>';

function assertThreeModels(l: Lab, line: string): void {
  assert.match(reply(line, 'sonnet'), new RegExp(SONNET_WORD), line);
  assert.doesNotMatch(reply(line, 'sonnet'), new RegExp(HAIKU_WORD), line);
  assert.match(reply(line, 'haiku'), new RegExp(HAIKU_WORD), line);
  assert.doesNotMatch(reply(line, 'haiku'), new RegExp(SONNET_WORD), line);
  assert.match(reply(line, 'opus'), /^NONE\.?$/, line);
  const log = l.log();
  assert.deepEqual(
    calls(log)
      .map((d) => [d.requested_model, d.model, d.status, d.delivered, d.warned])
      .sort(),
    [
      ['haiku', 'claude-haiku-5-5', 'matched', 'at-start', false],
      ['opus', 'claude-opus-5-5', 'undeclared', 'nothing', true],
      ['sonnet', 'claude-sonnet-5-5', 'matched', 'at-start', false],
    ],
  );
  assert.deepEqual(
    results(log)
      .map((d) => [d.predicted, d.model, d.result])
      .sort(),
    [
      ['claude-haiku-5-5', 'claude-haiku-5-5', 'match'],
      ['claude-opus-5-5', 'claude-opus-5-5', 'match'],
      ['claude-sonnet-5-5', 'claude-sonnet-5-5', 'match'],
    ],
  );
}

test('live, login: three-models: three parallel subagents each get their own model\'s rules, and the undeclared one warns', { skip: !enabled }, () => {
  preconditions();
  const l = lab(CONFIG);
  const r = print(l, THREE_MODELS);
  assert.equal(r.status, 0, r.result);
  assertThreeModels(l, r.result);
  assert.ok(JSON.stringify(r.stream).includes('will run on claude-opus-5-5, which is not declared'), 'the warning reaches the person through the session output');
});

test('live, login: inherit-explore: a subagent with no model and the built-in Explore inherit the session\'s model and its rules', { skip: !enabled }, () => {
  preconditions();
  const l = lab(CONFIG);
  const r = print(
    l,
    'This is a configuration test. Make exactly two Agent tool calls in a single message, so that they run in parallel, neither with a model parameter. ' +
      `Call 1 uses subagent_type "general-purpose" and call 2 uses subagent_type "Explore", both with exactly this prompt: "${PROBE}" ` +
      'After both results arrive, reply with exactly one line in this form, copying each reply verbatim: general=<reply> explore=<reply>',
  );
  assert.equal(r.status, 0, r.result);
  assert.match(reply(r.result, 'general'), new RegExp(SONNET_WORD), r.result);
  assert.match(reply(r.result, 'explore'), new RegExp(SONNET_WORD), r.result);
  assert.deepEqual(
    calls(l.log())
      .map((d) => [d.subagent_type, d.model, d.model_source, d.parent_source, d.delivered])
      .sort(),
    [
      ['Explore', 'claude-sonnet-5-5', 'built-in', 'session-record', 'at-start'],
      ['general-purpose', 'claude-sonnet-5-5', 'parent', 'session-record', 'at-start'],
    ],
  );
  assert.deepEqual(results(l.log()).map((d) => d.result), ['match', 'match']);
});

test('live, login: nested: a subagent that starts subagents passes on its own model, and each child gets its own rules', { skip: !enabled }, () => {
  preconditions();
  const l = lab(CONFIG);
  const inner =
    'This is a configuration test of nested subagents. Make exactly three Agent tool calls, one after the other, each with subagent_type general-purpose ' +
    `and exactly this prompt: '${PROBE}' Call 1 does not set the model parameter. Call 2 sets the model parameter to sonnet. Call 3 sets the model parameter to opus. ` +
    'Wait for all three results. Then reply with exactly one line in this form, copying each reply verbatim: inherit=<reply> sonnet=<reply> opus=<reply>';
  const r = print(
    l,
    'This is a configuration test. Make exactly one Agent tool call with subagent_type "general-purpose", the model parameter set to "haiku", ' +
      `and exactly this prompt: "${inner}" After the result arrives, reply with exactly that subagent's reply line, copied verbatim.`,
  );
  assert.equal(r.status, 0, r.result);
  assert.match(reply(r.result, 'inherit'), new RegExp(HAIKU_WORD), r.result);
  assert.match(reply(r.result, 'sonnet'), new RegExp(SONNET_WORD), r.result);
  assert.match(reply(r.result, 'opus'), /^NONE\.?$/, r.result);
  const log = l.log();
  const [outer, ...children] = calls(log);
  assert.deepEqual([outer?.agent_id, outer?.model, outer?.delivered], [undefined, 'claude-haiku-5-5', 'at-start']);
  assert.equal(children.length, 3);
  for (const child of children) assert.ok(typeof child.agent_id === 'string' && child.agent_id.length > 0, 'a call made inside a subagent carries its agent_id');
  const inherited = children.find((d) => d.requested_model === null);
  assert.deepEqual([inherited?.parent_model, inherited?.model, inherited?.delivered], ['claude-haiku-5-5', 'claude-haiku-5-5', 'at-start']);
  assert.ok(['agent-record', 'agent-transcript'].includes(inherited?.parent_source), String(inherited?.parent_source));
  assert.ok(results(log).every((d) => d.result === 'match'), JSON.stringify(results(log)));
});

test('live, login: a subagent that starts on another model than predicted: a warning and a MISMATCH line', { skip: !enabled }, () => {
  preconditions();
  const l = lab(CONFIG);
  const r = print(
    l,
    `This is a configuration test. Make exactly one Agent tool call with subagent_type "noonsight-live:probe", no model parameter, and exactly this prompt: "${PROBE}" ` +
      'After the result arrives, reply with exactly the subagent\'s reply, copied verbatim.',
    ['--plugin-dir', l.plugin],
  );
  assert.equal(r.status, 0, r.result);
  const [call] = calls(l.log());
  assert.deepEqual([call?.subagent_type, call?.model, call?.definition, call?.delivered], ['noonsight-live:probe', 'claude-sonnet-5-5', 'not-read', 'at-start']);
  const [checked] = results(l.log());
  assert.deepEqual([checked?.predicted, checked?.model, checked?.result, checked?.warned], ['claude-sonnet-5-5', 'claude-haiku-5-5', 'MISMATCH', true]);
  assert.ok(
    JSON.stringify(r.stream).includes('not on claude-sonnet-5-5 as noonsight predicted'),
    'the warning reaches the person through the session output',
  );
});

test('live, login: auto-mode: in auto mode, a subagent call with rules leaves the other calls of its response to the classifier, which lets them run', { skip: !enabled }, () => {
  preconditions();
  const l = lab(CONFIG);
  const marker = 'sibling-ran.txt';
  const r = print(
    l,
    'This is a configuration test. In one single message, make exactly two tool calls so that they run in parallel: ' +
      `(1) an Agent call with subagent_type "general-purpose", description "Probe", the model parameter set to "haiku", and exactly this prompt: "${PROBE}"; ` +
      `(2) a Bash call that runs: touch ${marker} . Do not retry any call. ` +
      'After both results arrive, reply with exactly one line in this form, copying the subagent reply verbatim: agent=<reply> bash=<ran, or the error message copied verbatim>',
    ['--permission-mode', 'auto', '--model', 'haiku'],
  );
  assert.equal(r.status, 0, r.result);
  assert.ok(fs.existsSync(path.join(l.project, marker)), `the Bash call next to the agent call ran\n${r.result}`);
  const stream = JSON.stringify(r.stream);
  assert.doesNotMatch(stream, /gave no verdict/, 'no call of the response lost its auto mode review');
  const bashCalls = r.stream
    .filter((e) => e.type === 'assistant')
    .flatMap((e) => (Array.isArray(e.message?.content) ? e.message.content : []))
    .filter((c: Record<string, any>) => c.type === 'tool_use' && c.name === 'Bash');
  assert.equal(bashCalls.length, 1, 'the Bash call ran the first time, without being issued again');
  assert.match(reply(r.result, 'agent'), new RegExp(HAIKU_WORD), r.result);
  const [call] = calls(l.log());
  assert.deepEqual([call?.permission_mode, call?.model, call?.delivered, call?.permission], ['auto', 'claude-haiku-5-5', 'at-start', undefined]);
  const given = l.log().find((d) => d.event === 'subagent-start');
  assert.deepEqual([given?.model, given?.delivered], ['claude-haiku-5-5', 'rules']);
});

test('live, login: interactive: three-models in an interactive session', { skip: !enabled }, () => {
  preconditions();
  const l = lab(CONFIG);
  // In an interactive session the subagents may run in the background: the turn ends, and resumes with the answer line when they finish.
  const r = spawnSync('expect', [DRIVER, l.probe, 'trust:15', 'wait:6', `ask:${THREE_MODELS}`, 'until:sonnet=.*haiku=.*opus=', '--', ...claudeArgs(l)], {
    cwd: l.project,
    env: baseEnv(),
    encoding: 'utf8',
    timeout: 900_000,
  });
  assert.equal(r.status, 0, (r.stdout + r.stderr).slice(-2000));
  const answer = l.answers().filter((a) => /sonnet=.*haiku=.*opus=/s.test(a)).at(-1);
  assertThreeModels(l, answer ?? '');
});
