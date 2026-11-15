// Live subagent tests: real Claude Code sessions that start subagents, run from the login of the
// person running them, with sextant's hooks given through --settings. They send prompts to the
// models, so they spend a little usage, and they only run when asked:
//
//   SEXTANT_LIVE_LOGIN=1 npm run test:live
//
// Needs `claude`, logged in (`claude auth status`), and `expect`. Each session uses the person's own
// Claude Code configuration directory (CLAUDE_CONFIG_DIR, or ~/.claude) for the login only: sextant
// is not installed there, the hook entries come from a temporary --settings file, and
// --setting-sources project,local keeps the person's own settings, hooks included, out of these
// sessions. No token is read or passed. Claude Code still records the sessions in that directory as
// it records any session, and the interactive case answers the folder trust question for the
// temporary project there.
//
// sextant's own state goes to a temporary home: the hook entries run a copy of the hook pointer that
// sets HOME for sextant alone.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { managedTarget } from '../../src/adapters/claude-code/locations.js';
import { findSextantHandlers, withSextantHooks } from '../../src/adapters/claude-code/settings.js';
import { CLI_FILE, PACKAGE_ROOT } from '../../src/config/paths.js';
import { readSettings } from '../../src/adapters/claude-code/install.js';

const DRIVER = path.join(PACKAGE_ROOT, 'test', 'live', 'drive.exp');
const SONNET_WORD = 'SONNET-SUB-5521';
const HAIKU_WORD = 'HAIKU-SUB-8093';
/** What every subagent is asked; the answer names the rules it received. */
const PROBE =
  'Reply with only the verification words of any sextant working rules you were given in this conversation, ' +
  'separated by single spaces, or the single word NONE if you were given none. Do not use any tool.';

const enabled = process.env.SEXTANT_LIVE_LOGIN === '1';

interface Lab {
  readonly root: string;
  /** sextant's home: the decision log lands here. */
  readonly home: string;
  readonly project: string;
  readonly probe: string;
  readonly settings: string;
  readonly plugin: string;
  log(): Record<string, any>[];
  answers(): string[];
}

/** What the tests need on this machine, and nothing that would run sextant's hooks in the test sessions a second time. */
function preconditions(): void {
  for (const [tool, args] of [
    ['claude', ['--version']],
    ['expect', ['-v']],
  ] as const)
    assert.equal(spawnSync(tool, [...args]).status, 0, `${tool} is not on PATH`);
  const auth = spawnSync('claude', ['auth', 'status'], { env: baseEnv(), encoding: 'utf8' });
  assert.equal(auth.status, 0, 'claude is not logged in for this account: run `claude` once and sign in, or `claude auth login`');
  // Machine-wide hooks run in every session and cannot be left out by --setting-sources.
  let managed = null;
  try {
    managed = managedTarget(process.env);
  } catch {
    // An unsupported system has no machine-wide install.
  }
  if (managed !== null && fs.existsSync(managed.settingsFile))
    assert.equal(
      findSextantHandlers(readSettings(managed.settingsFile)).length,
      0,
      `sextant is installed machine-wide (${managed.settingsFile}); its hooks would run in the test sessions too. Run these tests where it is not.`,
    );
}

/** The environment Claude Code needs to reach the person's login, and nothing from the shell that runs the tests. */
function baseEnv(): Record<string, string> {
  const env: Record<string, string> = { DISABLE_AUTOUPDATER: '1', LANG: 'en_US.UTF-8', TERM: 'xterm-256color' };
  for (const name of ['PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'TMPDIR', 'CLAUDE_CONFIG_DIR']) {
    const value = process.env[name];
    if (value) env[name] = value;
  }
  return env;
}

function lab(config: Record<string, unknown>): Lab {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sextant-live-sub-')));
  const home = path.join(root, 'home');
  const project = path.join(root, 'project');
  const probe = path.join(root, 'probe');
  const bin = path.join(root, 'bin');
  const rules = path.join(root, 'rules');
  for (const d of [home, project, probe, bin, rules]) fs.mkdirSync(d);
  fs.writeFileSync(path.join(rules, 'sonnet.md'), `- The verification word for claude-sonnet-5-5 is ${SONNET_WORD}.`);
  fs.writeFileSync(path.join(rules, 'haiku.md'), `- The verification word for claude-haiku-5-5 is ${HAIKU_WORD}.`);
  fs.writeFileSync(path.join(rules, 'sextant.json'), JSON.stringify(config));

  // The hook pointer as install writes it, except that sextant's home is the lab's.
  const pointer = path.join(bin, 'sextant-hook');
  fs.writeFileSync(
    pointer,
    `#!/bin/sh\nHOME=${quote(home)} SEXTANT_CONFIG=${quote(path.join(rules, 'sextant.json'))} exec ${quote(process.execPath)} ${quote(fs.realpathSync(CLI_FILE))} hook --install account "$@"\n`,
    { mode: 0o755 },
  );
  // The entries install writes, plus a Stop hook that records each answer of an interactive session.
  const stop = { type: 'command', command: '/bin/sh', args: ['-c', 'cat > "$0/stop-$$.json"', probe], timeout: 10 };
  const settings = path.join(root, 'settings.json');
  fs.writeFileSync(settings, JSON.stringify(withSextantHooks({ hooks: { Stop: [{ hooks: [stop] }] } }, pointer).settings, null, 2));

  // A plugin whose subagent sets its own model: sextant does not read plugin definitions, so it
  // predicts the parent's model, and the subagent starts on Haiku.
  const plugin = path.join(root, 'plugin');
  fs.mkdirSync(path.join(plugin, '.claude-plugin'), { recursive: true });
  fs.mkdirSync(path.join(plugin, 'agents'));
  fs.writeFileSync(path.join(plugin, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'sextant-live', version: '0.0.0', description: 'sextant live test' }));
  fs.writeFileSync(path.join(plugin, 'agents', 'probe.md'), '---\nname: probe\ndescription: Answers the sextant live test probe.\nmodel: haiku\n---\nAnswer the task exactly as asked.\n');

  return {
    root,
    home,
    project,
    probe,
    settings,
    plugin,
    log() {
      const file = path.join(home, '.local', 'state', 'sextant', 'decisions.jsonl');
      return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trimEnd().split('\n').map((l) => JSON.parse(l)) : [];
    },
    answers() {
      return fs
        .readdirSync(probe)
        .map((f) => path.join(probe, f))
        .sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs)
        .map((f) => String(JSON.parse(fs.readFileSync(f, 'utf8')).last_assistant_message ?? ''));
    },
  };
}

function quote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/** sonnet and haiku have rules; opus is not declared. */
const CONFIG = {
  version: 1,
  models: {
    'claude-sonnet-5-5': { use: 'custom', add: [{ id: 'live/sonnet', file: 'sonnet.md' }] },
    'claude-haiku-5-5': { use: 'custom', add: [{ id: 'live/haiku', file: 'haiku.md' }] },
  },
};

/** The claude options every session shares: the lab's hooks, none of the person's own settings files. */
function claudeArgs(l: Lab, extra: readonly string[] = []): string[] {
  // A fixed permission mode: in auto mode a classifier reviews each agent call sextant leaves unchanged.
  return ['--model', 'sonnet', '--permission-mode', 'default', '--setting-sources', 'project,local', '--settings', l.settings, '--allowedTools', 'Agent', ...extra];
}

interface PrintRun {
  readonly status: number | null;
  /** The session's final answer. */
  readonly result: string;
  /** Every stream event, for the messages sextant showed. */
  readonly stream: Record<string, any>[];
}

function print(l: Lab, prompt: string, extra: readonly string[] = []): PrintRun {
  const r = spawnSync('claude', ['-p', prompt, '--output-format', 'stream-json', '--verbose', ...claudeArgs(l, extra)], {
    cwd: l.project,
    env: baseEnv(),
    encoding: 'utf8',
    timeout: 600_000,
  });
  const stream = r.stdout
    .split('\n')
    .filter((line) => line.startsWith('{'))
    .map((line) => JSON.parse(line) as Record<string, any>);
  const result = String(stream.filter((e) => e.type === 'result').at(-1)?.result ?? '');
  fs.writeFileSync(path.join(l.root, 'stream.jsonl'), r.stdout);
  return { status: r.status, result, stream };
}

/** The reply a line of the form "name=<reply> other=<reply>" gives for one name. */
function reply(line: string, name: string): string {
  const m = new RegExp(`${name}=(.*?)(?=\\s+[a-z]+=|$)`, 's').exec(line);
  return (m?.[1] ?? '').trim();
}

const calls = (log: Record<string, any>[]): Record<string, any>[] => log.filter((d) => d.event === 'agent-call');
const results = (log: Record<string, any>[]): Record<string, any>[] => log.filter((d) => d.event === 'agent-result');

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
      ['haiku', 'claude-haiku-5-5', 'matched', 'rules', false],
      ['opus', 'claude-opus-5-5', 'undeclared', 'nothing', true],
      ['sonnet', 'claude-sonnet-5-5', 'matched', 'rules', false],
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
      ['Explore', 'claude-sonnet-5-5', 'built-in', 'session-record', 'rules'],
      ['general-purpose', 'claude-sonnet-5-5', 'parent', 'session-record', 'rules'],
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
  assert.deepEqual([outer?.agent_id, outer?.model, outer?.delivered], [undefined, 'claude-haiku-5-5', 'rules']);
  assert.equal(children.length, 3);
  for (const child of children) assert.ok(typeof child.agent_id === 'string' && child.agent_id.length > 0, 'a call made inside a subagent carries its agent_id');
  const inherited = children.find((d) => d.requested_model === null);
  assert.deepEqual([inherited?.parent_model, inherited?.model, inherited?.delivered], ['claude-haiku-5-5', 'claude-haiku-5-5', 'rules']);
  assert.ok(['agent-record', 'agent-transcript'].includes(inherited?.parent_source), String(inherited?.parent_source));
  assert.ok(results(log).every((d) => d.result === 'match'), JSON.stringify(results(log)));
});

test('live, login: a subagent that starts on another model than predicted: a warning and a MISMATCH line', { skip: !enabled }, () => {
  preconditions();
  const l = lab(CONFIG);
  const r = print(
    l,
    `This is a configuration test. Make exactly one Agent tool call with subagent_type "sextant-live:probe", no model parameter, and exactly this prompt: "${PROBE}" ` +
      'After the result arrives, reply with exactly the subagent\'s reply, copied verbatim.',
    ['--plugin-dir', l.plugin],
  );
  assert.equal(r.status, 0, r.result);
  const [call] = calls(l.log());
  assert.deepEqual([call?.subagent_type, call?.model, call?.definition, call?.delivered], ['sextant-live:probe', 'claude-sonnet-5-5', 'not-read', 'rules']);
  const [checked] = results(l.log());
  assert.deepEqual([checked?.predicted, checked?.model, checked?.result, checked?.warned], ['claude-sonnet-5-5', 'claude-haiku-5-5', 'MISMATCH', true]);
  assert.ok(
    JSON.stringify(r.stream).includes('not on claude-sonnet-5-5 as sextant predicted'),
    'the warning reaches the person through the session output',
  );
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
