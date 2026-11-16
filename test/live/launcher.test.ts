// Live launcher tests: real `claude -p` sessions started through `sextant run`, from the login of the
// person running them. They send prompts to the models, so they spend a little usage, and they only
// run when asked:
//
//   SEXTANT_LIVE_LOGIN=1 npm run test:live
//
// login.ts describes what they need, and what they touch in the person's Claude Code directory.
// sextant run keeps its state, the system prompt files included, in the lab's home: it runs with HOME
// set to that home, and starts a `claude` that sets HOME back before it runs the real one.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { CLI_FILE } from '../../src/config/paths.js';
import { baseEnv, claudeArgs, enabled, lab, preconditions, type Lab } from './login.js';

const GENERAL_WORD = 'LAUNCH-GENERAL-4807';
const INVESTIGATE_WORD = 'LAUNCH-INVESTIGATE-2519';
const THEIR_WORD = 'ORCHESTRATOR-LIVE-7731';
const THEIR_FILE_WORD = 'ORCHESTRATOR-FILE-6094';
const HAIKU_WORD = 'LAUNCH-HAIKU-8355';

const QUESTION =
  'Reply with only every verification word you were given, in your system prompt or anywhere else in this conversation, ' +
  'separated by single spaces, or the single word NONE when there are none. Do not use any tool.';

function launcherLab(): Lab {
  return lab(
    'launcher',
    {
      version: 1,
      models: {
        'claude-sonnet-5-5': {
          use: 'custom',
          add: [
            { id: 'live/general', file: 'general.md' },
            { id: 'live/investigate', file: 'investigate.md', scopes: ['investigate'] },
          ],
        },
      },
      scopes: { investigate: {} },
    },
    {
      'general.md': `- The verification word for claude-sonnet-5-5 is ${GENERAL_WORD}.`,
      'investigate.md': `- The verification word for claude-sonnet-5-5 in the investigate scope is ${INVESTIGATE_WORD}.`,
    },
  );
}

interface Run {
  readonly status: number | null;
  readonly result: string;
}

/** One `sextant run [sextantArgs] -- -p QUESTION [claude arguments]` session in the lab. */
function launch(l: Lab, sextantArgs: readonly string[], claude: readonly string[]): Run {
  const realClaude = spawnSync('/bin/sh', ['-c', 'command -v claude'], { encoding: 'utf8', env: baseEnv() }).stdout.trim();
  assert.ok(realClaude, 'claude is not on PATH');
  const bin = path.join(l.root, 'launcher-bin');
  fs.mkdirSync(bin, { recursive: true });
  fs.writeFileSync(path.join(bin, 'claude'), `#!/bin/sh\nHOME="$SEXTANT_LIVE_HOME" exec '${realClaude.replace(/'/g, `'\\''`)}' "$@"\n`, { mode: 0o755 });
  const env = baseEnv();
  const r = spawnSync(
    process.execPath,
    [CLI_FILE, 'run', ...sextantArgs, '--', '-p', QUESTION, '--output-format', 'stream-json', '--verbose', ...claude],
    {
      cwd: l.project,
      env: {
        ...env,
        HOME: l.home,
        SEXTANT_LIVE_HOME: env.HOME ?? '',
        SEXTANT_CONFIG: path.join(l.root, 'rules', 'sextant.json'),
        PATH: `${bin}${path.delimiter}${env.PATH ?? ''}`,
      },
      encoding: 'utf8',
      timeout: 600_000,
    },
  );
  fs.writeFileSync(path.join(l.root, 'stream.jsonl'), r.stdout);
  const stream = r.stdout
    .split('\n')
    .filter((line) => line.startsWith('{'))
    .map((line) => JSON.parse(line) as Record<string, any>);
  return { status: r.status, result: String(stream.filter((e) => e.type === 'result').at(-1)?.result ?? '').trim() };
}

const starts = (l: Lab): unknown[][] =>
  l.log().map((d) => [d.event, d.model, d.scope, d.status, d.delivered]);

test('live, login: launcher route: an explicit --model gets its rules in the system prompt, and the hook does not deliver them again', { skip: !enabled }, () => {
  preconditions();
  const l = launcherLab();
  const r = launch(l, ['--scope', 'investigate'], claudeArgs(l, ['--model', 'sonnet']));
  assert.equal(r.status, 0, r.result);
  assert.match(r.result, new RegExp(GENERAL_WORD));
  assert.match(r.result, new RegExp(INVESTIGATE_WORD));
  assert.deepEqual(starts(l), [
    ['launch', 'claude-sonnet-5-5', 'investigate', 'matched', 'system-prompt'],
    ['session-start', 'claude-sonnet-5-5', 'investigate', 'matched', 'launcher'],
  ]);
});

test('live, login: in -p mode without the hooks, the rules arrive through the system prompt alone', { skip: !enabled }, () => {
  preconditions();
  const l = launcherLab();
  const r = launch(l, [], ['--model', 'sonnet', '--permission-mode', 'default', '--setting-sources', 'project,local']);
  assert.equal(r.status, 0, r.result);
  assert.match(r.result, new RegExp(GENERAL_WORD));
  assert.doesNotMatch(r.result, new RegExp(INVESTIGATE_WORD));
  assert.deepEqual(starts(l), [['launch', 'claude-sonnet-5-5', null, 'matched', 'system-prompt']]);
});

test('live, login: an --append-system-prompt from someone else on the same command line arrives with the rules', { skip: !enabled }, () => {
  preconditions();
  const l = launcherLab();
  const theirs = `- The verification word of the orchestrator's own instructions is ${THEIR_WORD}.`;
  const r = launch(l, [], claudeArgs(l, ['--model', 'sonnet', '--append-system-prompt', theirs]));
  assert.equal(r.status, 0, r.result);
  assert.match(r.result, new RegExp(GENERAL_WORD));
  assert.match(r.result, new RegExp(THEIR_WORD));
  assert.deepEqual(starts(l), [
    ['launch', 'claude-sonnet-5-5', null, 'matched', 'system-prompt'],
    ['session-start', 'claude-sonnet-5-5', null, 'matched', 'launcher'],
  ]);
});

test('live, login: an --append-system-prompt-file from someone else is merged, so both texts arrive', { skip: !enabled }, () => {
  preconditions();
  const l = launcherLab();
  const theirs = path.join(l.root, 'theirs.md');
  fs.writeFileSync(theirs, `- The verification word of the orchestrator's own file is ${THEIR_FILE_WORD}.\n`);
  const r = launch(l, [], claudeArgs(l, ['--model', 'sonnet', '--append-system-prompt-file', theirs]));
  assert.equal(r.status, 0, r.result);
  assert.match(r.result, new RegExp(GENERAL_WORD));
  assert.match(r.result, new RegExp(THEIR_FILE_WORD));
});

test('live, login: launcher routing: with no --model, the scope\'s row picks the model and the effort, and the routed model\'s rules arrive once', { skip: !enabled }, () => {
  preconditions();
  const l = lab(
    'launcher-route',
    {
      version: 1,
      models: {
        'claude-sonnet-5-5': { use: 'custom', add: [{ id: 'live/general', file: 'general.md' }] },
        'claude-haiku-5-5': { use: 'custom', add: [{ id: 'live/haiku', file: 'haiku.md' }] },
      },
      scopes: { investigate: {} },
      routing: { enabled: true, table: { investigate: [{ model: 'haiku', effort: 'low' }] } },
    },
    {
      'general.md': `- The verification word for claude-sonnet-5-5 is ${GENERAL_WORD}.`,
      'haiku.md': `- The verification word for claude-haiku-5-5 is ${HAIKU_WORD}.`,
    },
  );
  const r = launch(l, ['--scope', 'investigate'], ['--permission-mode', 'default', '--setting-sources', 'project,local', '--settings', l.settings]);
  assert.equal(r.status, 0, r.result);
  assert.match(r.result, new RegExp(HAIKU_WORD));
  assert.doesNotMatch(r.result, new RegExp(GENERAL_WORD));
  assert.deepEqual(starts(l), [
    ['launch', 'claude-haiku-5-5', 'investigate', 'matched', 'system-prompt'],
    ['session-start', 'claude-haiku-5-5', 'investigate', 'matched', 'launcher'],
  ]);
  const [launched] = l.log();
  assert.deepEqual([launched?.routing, launched?.route_value, launched?.route_effort], ['routed', 'haiku', 'low']);
});
