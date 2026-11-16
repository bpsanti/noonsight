// Live routing tests: real `claude -p` sessions on Sonnet at low effort that start subagents, run from
// the login of the person running them, with noonsight's hooks given through --settings. They send
// prompts to the models, so they spend a little usage, and they only run when asked:
//
//   NOONSIGHT_LIVE_LOGIN=1 npm run test:live
//
// login.ts describes what they need, and what they touch in the person's Claude Code directory.
// A task text with the probe word falls in the scope "probe", which the routing table sends to Haiku
// at high effort. The proof of the model is the resolvedModel of each agent call's result; the proof
// of the effort is the effort level Claude Code reports to a hook when each subagent runs a command.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { calls, enabled, lab as loginLab, preconditions, print, reply, results, type Lab as LoginLab } from './login.js';

const SONNET_WORD = 'SONNET-ROUTE-6142';
const HAIKU_WORD = 'HAIKU-ROUTE-3087';
const PROBE_WORD = 'ROUTE-PROBE';
/** The variable an orchestrator sets in the sessions it starts, for yield_when_env. */
const ORCHESTRATOR_ENV = 'NOONSIGHT_LIVE_ORCHESTRATOR';

const QUESTION =
  'Reply with only the verification words of any noonsight working rules you were given in this conversation, ' +
  'separated by single spaces, or the single word NONE if you were given none.';

interface Lab extends LoginLab {
  /** The effort level Claude Code reported for each subagent's command, by agent id. */
  efforts(): Map<string, string>;
}

function lab(): Lab {
  const l = loginLab(
    'route',
    {
      version: 1,
      models: {
        'claude-sonnet-5-5': { use: 'custom', add: [{ id: 'live/sonnet', file: 'sonnet.md' }] },
        'claude-haiku-5-5': { use: 'custom', add: [{ id: 'live/haiku', file: 'haiku.md' }] },
      },
      scopes: { probe: { description: 'The routing probe.', match: [`\\b${PROBE_WORD}\\b`] } },
      routing: { enabled: true, yield_when_env: [ORCHESTRATOR_ENV], table: { probe: [{ model: 'haiku', effort: 'high' }] } },
    },
    {
      'sonnet.md': `- The verification word for claude-sonnet-5-5 is ${SONNET_WORD}.`,
      'haiku.md': `- The verification word for claude-haiku-5-5 is ${HAIKU_WORD}.`,
    },
  );
  // A hook on the shell tool that records its input: inside a subagent it carries the agent id and the effort level.
  const commands = path.join(l.root, 'commands');
  fs.mkdirSync(commands);
  const settings = JSON.parse(fs.readFileSync(l.settings, 'utf8')) as { hooks: Record<string, unknown[]> };
  const record = { type: 'command', command: '/bin/sh', args: ['-c', 'cat > "$0/bash-$$.json"', commands], timeout: 10 };
  settings.hooks.PreToolUse = [...(settings.hooks.PreToolUse ?? []), { matcher: 'Bash', hooks: [record] }];
  fs.writeFileSync(l.settings, JSON.stringify(settings, null, 2));
  return {
    ...l,
    efforts() {
      const out = new Map<string, string>();
      for (const f of fs.readdirSync(commands)) {
        const input = JSON.parse(fs.readFileSync(path.join(commands, f), 'utf8')) as Record<string, any>;
        if (typeof input.agent_id === 'string' && typeof input.effort?.level === 'string') out.set(input.agent_id, input.effort.level);
      }
      return out;
    },
  };
}

/** A subagent task: run a command, so its effort is recorded, then answer the question. */
const task = (n: number, probe: boolean): string =>
  `${probe ? `${PROBE_WORD}. ` : ''}First run the Bash command: echo probe-${n} . Then: ${QUESTION}`;

/**
 * Claude arguments after the lab's own, whose last option is --allowedTools Agent: the shell command
 * joins that list, and the session runs on Sonnet at low effort, so a subagent on Haiku at high effort
 * got both from the route.
 */
const SESSION = ['Bash(echo *)', '--effort', 'low'];

/** The model and effort each subagent of the log started with, in call order. */
function started(l: Lab): { routing: string; reason: string; model: string; effort: string | undefined }[] {
  const log = l.log();
  const efforts = l.efforts();
  const byCall = new Map(results(log).map((r) => [r.tool_use_id, r]));
  return calls(log).map((c) => {
    const r = byCall.get(c.tool_use_id);
    return { routing: c.routing, reason: c.routing_reason, model: r?.model, effort: efforts.get(r?.subagent_id) };
  });
}

test('live, login: route-subagents: the hook sets a subagent\'s model and effort from its scope, and it gets the routed model\'s rules', { skip: !enabled }, () => {
  preconditions();
  const l = lab();
  const r = print(
    l,
    'This is a configuration test. Make exactly two Agent tool calls in a single message, so that they run in parallel, ' +
      'both with subagent_type "general-purpose" and neither with a model parameter. ' +
      `Call 1 has exactly this prompt: "${task(1, true)}" Call 2 has exactly this prompt: "${task(2, false)}" ` +
      'After both results arrive, reply with exactly one line in this form, copying each reply verbatim: routed=<reply of call 1> plain=<reply of call 2>',
    SESSION,
  );
  assert.equal(r.status, 0, r.result);
  assert.match(reply(r.result, 'routed'), new RegExp(HAIKU_WORD), r.result);
  assert.doesNotMatch(reply(r.result, 'routed'), new RegExp(SONNET_WORD), r.result);
  assert.match(reply(r.result, 'plain'), new RegExp(SONNET_WORD), r.result);
  const log = l.log();
  const routed = calls(log).find((c) => c.scope === 'probe');
  assert.deepEqual(
    [routed?.routing, routed?.route_value, routed?.route_effort, routed?.model, routed?.model_source, routed?.delivered],
    ['routed', 'haiku', 'high', 'claude-haiku-5-5', 'parameter', 'rules'],
  );
  assert.deepEqual(
    started(l).sort((a, b) => a.routing.localeCompare(b.routing)),
    [
      { routing: 'inherit', reason: 'no-scope', model: 'claude-sonnet-5-5', effort: 'low' },
      { routing: 'routed', reason: 'table', model: 'claude-haiku-5-5', effort: 'high' },
    ],
  );
  assert.ok(results(log).every((d) => d.result === 'match'), JSON.stringify(results(log)));
});

test('live, login: explicit-model: a call that names a model keeps it, and gets that model\'s rules', { skip: !enabled }, () => {
  preconditions();
  const l = lab();
  const r = print(
    l,
    'This is a configuration test. Make exactly one Agent tool call with subagent_type "general-purpose", the model parameter set to "sonnet", ' +
      `and exactly this prompt: "${task(1, true)}" After the result arrives, reply with exactly the subagent's reply, copied verbatim.`,
    SESSION,
  );
  assert.equal(r.status, 0, r.result);
  assert.match(r.result, new RegExp(SONNET_WORD));
  assert.doesNotMatch(r.result, new RegExp(HAIKU_WORD));
  const [call] = calls(l.log());
  assert.deepEqual([call?.scope, call?.routing, call?.routing_reason, call?.requested_model, call?.model], ['probe', 'yielded', 'explicit-model', 'sonnet', 'claude-sonnet-5-5']);
  assert.deepEqual(started(l).map((s) => [s.model, s.effort]), [['claude-sonnet-5-5', 'low']]);
});

test('live, login: orchestrator-env: with a variable of yield_when_env set, routing yields and the rules still arrive', { skip: !enabled }, () => {
  preconditions();
  const l = lab();
  const r = print(
    l,
    'This is a configuration test. Make exactly one Agent tool call with subagent_type "general-purpose", no model parameter, ' +
      `and exactly this prompt: "${task(1, true)}" After the result arrives, reply with exactly the subagent's reply, copied verbatim.`,
    SESSION,
    { [ORCHESTRATOR_ENV]: 'task-1' },
  );
  assert.equal(r.status, 0, r.result);
  assert.match(r.result, new RegExp(SONNET_WORD));
  assert.doesNotMatch(r.result, new RegExp(HAIKU_WORD));
  const [call] = calls(l.log());
  assert.deepEqual([call?.scope, call?.routing, call?.routing_reason, call?.routing_env, call?.model], ['probe', 'yielded', 'yield-env', ORCHESTRATOR_ENV, 'claude-sonnet-5-5']);
  assert.deepEqual(started(l).map((s) => [s.model, s.effort]), [['claude-sonnet-5-5', 'low']]);
});
