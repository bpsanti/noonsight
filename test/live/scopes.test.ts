// Live scope tests: one model, two task scopes, two verification words. Real Claude Code sessions,
// run from the login of the person running them, with noonsight's hooks given through --settings.
// They send prompts to the models, so they spend a little usage, and they only run when asked:
//
//   NOONSIGHT_LIVE_LOGIN=1 npm run test:live
//
// login.ts describes what they need, and what they touch in the person's Claude Code directory.

import assert from 'node:assert/strict';
import test from 'node:test';
import { calls, enabled, lab, preconditions, print, reply, type Lab } from './login.js';

const INVESTIGATE_WORD = 'INVESTIGATE-LIVE-6143';
const SUMMARIZE_WORD = 'SUMMARIZE-LIVE-2758';

/** Sonnet has one rule for each of two scopes and none for every scope. */
function scopeLab(): Lab {
  return lab(
    'scope',
    {
      version: 1,
      models: {
        'claude-sonnet-5-5': {
          use: 'custom',
          add: [
            { id: 'live/investigate', file: 'investigate.md', scopes: ['investigate'] },
            { id: 'live/summarize', file: 'summarize.md', scopes: ['summarize'] },
          ],
        },
      },
      scopes: {
        investigate: { match: ['\\binvestigat'] },
        summarize: { match: ['\\bsummar'] },
      },
    },
    {
      'investigate.md': `- The verification word for claude-sonnet-5-5 in the investigate scope is ${INVESTIGATE_WORD}.`,
      'summarize.md': `- The verification word for claude-sonnet-5-5 in the summarize scope is ${SUMMARIZE_WORD}.`,
    },
  );
}

const QUESTION =
  'Reply with only the verification words of the noonsight working rules that apply to you now, separated by spaces, ' +
  'or the single word NONE when there are none. Do not use any tool.';

test('live, login: NOONSIGHT_SCOPE: two sessions on the same model in two scopes receive different rules, and a session with no scope none', { skip: !enabled }, () => {
  preconditions();
  const l = scopeLab();
  const answer = (env: Record<string, string>): string => {
    const r = print(l, QUESTION, [], env);
    assert.equal(r.status, 0, r.result);
    return r.result.trim();
  };
  const investigate = answer({ NOONSIGHT_SCOPE: 'investigate' });
  const summarize = answer({ NOONSIGHT_SCOPE: 'summarize' });
  const none = answer({});
  assert.match(investigate, new RegExp(INVESTIGATE_WORD));
  assert.doesNotMatch(investigate, new RegExp(SUMMARIZE_WORD));
  assert.match(summarize, new RegExp(SUMMARIZE_WORD));
  assert.doesNotMatch(summarize, new RegExp(INVESTIGATE_WORD));
  assert.match(none, /^NONE\.?$/);
  assert.deepEqual(
    l.log()
      .filter((d) => d.event === 'session-start')
      .map((d) => [d.model, d.scope, d.scope_source, d.status, d.delivered]),
    [
      ['claude-sonnet-5-5', 'investigate', 'env', 'matched', 'rules'],
      ['claude-sonnet-5-5', 'summarize', 'env', 'matched', 'rules'],
      ['claude-sonnet-5-5', null, null, 'none', 'nothing'],
    ],
  );
});

test('live, login: matchers: two subagents on the same model, whose tasks fall in two scopes, receive different rules', { skip: !enabled }, () => {
  preconditions();
  const l = scopeLab();
  const probe = 'Reply with only the verification words of any noonsight working rules you were given in this conversation, separated by single spaces, or the single word NONE if you were given none. Do not use any tool.';
  const r = print(
    l,
    'This is a configuration test. Make exactly two Agent tool calls in a single message, so that they run in parallel. ' +
      'Both use subagent_type "general-purpose" and set the model parameter to "sonnet". ' +
      `Call 1 has the description "Investigate probe" and exactly this prompt: "Investigation probe. ${probe}" ` +
      `Call 2 has the description "Summarize probe" and exactly this prompt: "Summary probe. ${probe}" ` +
      'After both results arrive, reply with exactly one line in this form, copying each reply verbatim: investigate=<reply> summarize=<reply>',
  );
  assert.equal(r.status, 0, r.result);
  const investigate = reply(r.result, 'investigate');
  const summarize = reply(r.result, 'summarize');
  assert.match(investigate, new RegExp(INVESTIGATE_WORD), r.result);
  assert.doesNotMatch(investigate, new RegExp(SUMMARIZE_WORD), r.result);
  assert.match(summarize, new RegExp(SUMMARIZE_WORD), r.result);
  assert.doesNotMatch(summarize, new RegExp(INVESTIGATE_WORD), r.result);
  assert.deepEqual(
    calls(l.log())
      .map((d) => [d.model, d.scope, d.scope_source, d.place, d.delivered])
      .sort(),
    [
      ['claude-sonnet-5-5', 'investigate', 'task-text', 'subagent', 'rules'],
      ['claude-sonnet-5-5', 'summarize', 'task-text', 'subagent', 'rules'],
    ],
  );
});
