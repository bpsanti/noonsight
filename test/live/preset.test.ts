// Live tests of the shipped preset: real Claude Code sessions, run from the login of the person
// running them, with noonsight's hooks given through --settings. They send prompts to the models, so
// they spend a little usage, and they only run when asked:
//
//   NOONSIGHT_LIVE_LOGIN=1 npm run test:live
//
// login.ts describes what they need, and what they touch in the person's Claude Code directory.
//
// system-prompt: what Claude Code already sends each model, read from the system prompt Claude Code
// records in the session transcript, compared with the preset, so the preset never delivers advice
// in a place where Claude Code already sends it. It sends one short request on each of the four
// models, Fable 5.2 included, as a main session and as a subagent. In `claude -p` Claude Code does
// not ask before billing Fable usage to usage credits, on plans where Fable draws on them.
//
// preset-hash: the real preset reaches a session and a subagent, and the decision log records the
// hash of the exact text `noonsight resolve` gives for them.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { loadConfigDetails, type Preset } from '../../src/config/load.js';
import { resolve } from '../../src/core/resolve.js';
import type { Place } from '../../src/core/types.js';
import { calls, enabled, lab, preconditions, print, reply, type Lab } from './login.js';

const MODELS = { fable: 'claude-fable-5-2', opus: 'claude-opus-5-5', sonnet: 'claude-sonnet-5-5', haiku: 'claude-haiku-5-5' } as const;

/** The real preset for the four models, with an environment variable that marks a session unattended. */
function presetLab(name: string): Lab {
  return lab(
    name,
    {
      version: 1,
      preset: 'claude',
      models: Object.fromEntries(Object.values(MODELS).map((m) => [m, { use: 'preset' }])),
      session: { unattended_when_env: ['NOONSIGHT_LIVE_UNATTENDED'] },
    },
    {},
  );
}

/**
 * Text that shows Claude Code itself sends the advice a preset rule carries: a phrase of the guide's
 * own wording for that advice, which an embedded copy of it would hold.
 */
const MARKERS: Readonly<Record<string, RegExp>> = {
  'fable-5-2/finish-work': /# Finishing work|still owe work the user asked for/i,
  'fable-5-2/low-context-report': /low-context reader/i,
  'fable-5-2/code-ownership': /owner and long-term maintainer/i,
  'fable-5-2/progress-updates': /say in a line what you're about to do/i,
  'opus-5-5/unattended-run': /how your turns end|inviting the user to redirect you/i,
  'opus-5-5/progress-updates': /before (?:your|the) first tool call/i,
  'opus-5-5/explore-before-acting': /explore broadly with tool calls/i,
  'sonnet-5-5/carry-through': /keep working until everything the user asked for is done/i,
  'sonnet-5-5/stay-in-scope': /don't add features, tests, files, docs, or refactors/i,
  'sonnet-5-5/verify-changes': /run a real check that exercises/i,
  'sonnet-5-5/no-self-review-rounds': /extra rounds of review or hardening/i,
  'sonnet-5-5/ideas-first': /asks for ideas, options, or a plan/i,
  'sonnet-5-5/check-current-facts': /may have changed since your training/i,
  'haiku-5-5/carry-through': /keep working until everything the user asked for is done/i,
  'haiku-5-5/verify-changes': /run a real check that exercises/i,
  'haiku-5-5/search-recent-facts': /your training data ends well before today's date/i,
};

/**
 * Where Claude Code 2.1.325 was seen to send a preset rule's advice itself: model, then "main" (a
 * session, watched or not) or "subagent", then the rules. The test fails when this changes, so the
 * preset's places are looked at again.
 */
const KNOWN_OVERLAPS: Readonly<Record<string, Readonly<Record<'main' | 'subagent', readonly string[]>>>> = {
  'claude-fable-5-2': { main: ['fable-5-2/finish-work'], subagent: [] },
  'claude-opus-5-5': { main: [], subagent: [] },
  'claude-sonnet-5-5': { main: [], subagent: [] },
  'claude-haiku-5-5': { main: [], subagent: [] },
};

const PLACE_READER: Readonly<Record<Place, 'main' | 'subagent'>> = { session: 'main', unattended: 'main', subagent: 'subagent' };

interface SystemPrompt {
  readonly model: string;
  readonly text: string;
}

function claudeConfigDir(): string {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
}

/** The session's transcript, found by its id under the Claude Code configuration directory. */
function transcriptOf(sessionId: string): string {
  const projects = path.join(claudeConfigDir(), 'projects');
  for (const dir of fs.readdirSync(projects)) {
    const file = path.join(projects, dir, `${sessionId}.jsonl`);
    if (fs.existsSync(file)) return file;
  }
  assert.fail(`no transcript for session ${sessionId} under ${projects}`);
}

/**
 * The system prompt of the first model request a transcript records: Claude Code writes the request
 * shape (`api-request-shape`) and the request (`api-request`, which names the model) as lines of the
 * transcript.
 */
function systemPrompt(transcript: string): SystemPrompt {
  const shapes = new Map<string, string>();
  let first: { model: string; hash: string } | null = null;
  for (const line of fs.readFileSync(transcript, 'utf8').split('\n')) {
    if (!line.startsWith('{')) continue;
    const r = JSON.parse(line) as Record<string, any>;
    if (r.type === 'api-request-shape')
      shapes.set(String(r.shapeHash), ((r.shape?.system ?? []) as { text?: string }[]).map((b) => b.text ?? '').join('\n'));
    if (r.type === 'api-request' && first === null && typeof r.params?.model === 'string') first = { model: r.params.model, hash: String(r.shapeHash) };
  }
  assert.ok(first, `${transcript} records no model request`);
  const text = shapes.get(first.hash);
  assert.ok(text !== undefined, `${transcript} records no request shape for its first request`);
  return { model: first.model, text };
}

function sessionIdOf(stream: Record<string, any>[]): string {
  const id = stream.find((e) => typeof e.session_id === 'string')?.session_id;
  assert.ok(typeof id === 'string', 'the session reported no session id');
  return id;
}

function readPreset(l: Lab): Preset {
  const { preset } = loadConfigDetails(path.join(l.root, 'rules', 'noonsight.json'));
  assert.ok(preset, 'the preset is installed');
  return preset;
}

/** The preset rules of a model whose advice a system prompt already holds. */
function overlaps(preset: Preset, prompt: SystemPrompt): string[] {
  return (preset.models.get(prompt.model) ?? []).filter((r) => MARKERS[r.id]?.test(prompt.text)).map((r) => r.id);
}

function headings(text: string): string[] {
  return text.match(/^# .+$/gm) ?? [];
}

const OK = 'Reply with the single word OK. Do not use any tool.';

test('live, login: system-prompt: the preset never delivers a rule where Claude Code already sends the same advice', { skip: !enabled }, (t) => {
  preconditions();
  const l = presetLab('system-prompt');
  const preset = readPreset(l);
  assert.deepEqual(Object.keys(MARKERS).sort(), [...preset.models.values()].flat().map((r) => r.id).sort(), 'every preset rule has a marker');

  const prompts: Record<string, { main?: SystemPrompt; subagent?: SystemPrompt }> = {};
  for (const [alias, model] of Object.entries(MODELS)) {
    const r = print(l, OK, ['--model', alias, '--effort', 'low']);
    assert.equal(r.status, 0, r.result);
    const main = systemPrompt(transcriptOf(sessionIdOf(r.stream)));
    assert.equal(main.model, model);
    prompts[model] = { main };
  }

  const r = print(
    l,
    'This is a configuration test. Make exactly four Agent tool calls in a single message, so that they run in parallel. ' +
      `All four use subagent_type "general-purpose", the description "Probe", and exactly this prompt: "${OK}" ` +
      'Call 1 sets the model parameter to "fable", call 2 to "opus", call 3 to "sonnet", and call 4 to "haiku". ' +
      'After the four results arrive, reply with the single word DONE.',
    ['--effort', 'low'],
  );
  assert.equal(r.status, 0, r.result);
  const dir = path.join(transcriptOf(sessionIdOf(r.stream)).replace(/\.jsonl$/, ''), 'subagents');
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'))) {
    const sub = systemPrompt(path.join(dir, file));
    (prompts[sub.model] ??= {}).subagent = sub;
  }

  const seen: Record<string, Record<string, string[]>> = {};
  const summary: Record<string, unknown> = {};
  for (const model of Object.values(MODELS)) {
    seen[model] = {};
    for (const reader of ['main', 'subagent'] as const) {
      const prompt = prompts[model]?.[reader];
      assert.ok(prompt, `no ${reader} system prompt was recorded for ${model}`);
      seen[model][reader] = overlaps(preset, prompt);
      summary[`${model} ${reader}`] = { characters: prompt.text.length, headings: headings(prompt.text), overlaps: seen[model][reader] };
    }
  }
  fs.writeFileSync(path.join(l.root, 'system-prompts.json'), JSON.stringify(summary, null, 2));
  t.diagnostic(JSON.stringify(summary));

  assert.deepEqual(seen, KNOWN_OVERLAPS, 'what Claude Code sends changed: look at the preset rules\' places again, then update KNOWN_OVERLAPS');
  for (const [model, rules] of preset.models)
    for (const rule of rules)
      for (const place of rule.where)
        assert.ok(
          !seen[model]?.[PLACE_READER[place]]?.includes(rule.id),
          `${rule.id} is delivered in the place "${place}", where Claude Code already sends the same advice`,
        );
});

test('live, login: preset-hash: the real preset reaches a session and a subagent, and the log records the hash resolve gives', { skip: !enabled }, (t) => {
  preconditions();
  const l = presetLab('preset-hash');
  const probe = 'Reply with only the ids of the noonsight working rules you were given in this conversation, separated by single spaces, or the single word NONE if you were given none. Do not use any tool.';
  const r = print(
    l,
    'This is a configuration test. Make exactly one Agent tool call with subagent_type "general-purpose", the model parameter "haiku", ' +
      `the description "Probe", and exactly this prompt: "${probe}" ` +
      'After the result arrives, reply with exactly one line in this form: session=<the ids of the noonsight working rules you were given, separated by single spaces> subagent=<the reply of the subagent, verbatim>',
    [],
    { NOONSIGHT_SCOPE: 'routine', NOONSIGHT_LIVE_UNATTENDED: '1' },
  );
  assert.equal(r.status, 0, r.result);

  const { config } = loadConfigDetails(path.join(l.root, 'rules', 'noonsight.json'));
  const session = resolve(config, { model: MODELS.sonnet, scope: 'routine', place: 'unattended' });
  const subagent = resolve(config, { model: MODELS.haiku, scope: null, place: 'subagent' });
  assert.ok(session.status === 'matched' && subagent.status === 'matched');
  assert.deepEqual(session.rules, ['sonnet-5-5/carry-through', 'sonnet-5-5/stay-in-scope', 'sonnet-5-5/verify-changes']);
  assert.deepEqual(subagent.rules, ['haiku-5-5/carry-through']);

  const log = l.log();
  const start = log.find((d) => d.event === 'session-start');
  assert.deepEqual(
    [start?.model, start?.scope, start?.place, start?.delivered, start?.rules, start?.sha256],
    [MODELS.sonnet, 'routine', 'unattended', 'rules', session.rules, session.sha256],
  );
  const call = calls(log).at(0);
  assert.deepEqual([call?.model, call?.place, call?.delivered, call?.rules, call?.sha256], [MODELS.haiku, 'subagent', 'at-start', subagent.rules, subagent.sha256]);
  const given = log.find((d) => d.event === 'subagent-start');
  assert.deepEqual([given?.model, given?.delivered, given?.rules, given?.sha256], [MODELS.haiku, 'rules', subagent.rules, subagent.sha256]);
  t.diagnostic(`session ${session.rules.join(', ')}: sha256 ${session.sha256}; subagent ${subagent.rules.join(', ')}: sha256 ${subagent.sha256}`);

  for (const id of session.rules) assert.ok(reply(r.result, 'session').includes(id), r.result);
  assert.ok(reply(r.result, 'subagent').includes('haiku-5-5/carry-through'), r.result);
});
