// The SessionStart and PostModelSwitch hook adapter, driven as Claude Code drives it: a separate
// process that gets the hook input on stdin. Each test has its own home directory, so the decision
// log and the session records start empty.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { FIXTURES, hookInput, LAB_CONFIG, LAB_PRESETS, runCli, runProgram, tempTree } from './helpers.js';

const NO_NETWORK = ['--require', path.join(FIXTURES, 'no-network.cjs')];

interface Home {
  readonly env: Record<string, string>;
  readonly dir: string;
  hook(event: string, input: string, extra?: Record<string, string>): { status: number | null; out: Record<string, any> | null; raw: string };
  log(): Record<string, any>[];
}

function home(config: string = LAB_CONFIG): Home {
  const dir = tempTree({});
  const env = { HOME: dir, SEXTANT_CONFIG: config, SEXTANT_PRESETS_DIR: LAB_PRESETS };
  return {
    env,
    dir,
    hook(event, input, extra = {}) {
      const r = runCli(['hook', event], { ...env, ...extra }, NO_NETWORK, input);
      assert.equal(r.stderr, '', r.stderr);
      return { status: r.status, out: r.stdout ? (JSON.parse(r.stdout) as Record<string, any>) : null, raw: r.stdout };
    },
    log() {
      const file = path.join(dir, '.local', 'state', 'sextant', 'decisions.jsonl');
      if (!fs.existsSync(file)) return [];
      return fs
        .readFileSync(file, 'utf8')
        .trimEnd()
        .split('\n')
        .map((l) => JSON.parse(l) as Record<string, any>);
    },
  };
}

const start = (model: string | null, fields: Record<string, unknown> = {}): string =>
  hookInput('session-start-startup', model === null ? { model: undefined, ...fields } : { model, ...fields });
/** The recorded switch came from another session; tests replay it in the same session as the start. */
const SESSION = 'd1004f3b-4cb3-4ac6-a052-4e3fd53b2592';
const switchTo = (from: string, to: string, fields: Record<string, unknown> = {}): string =>
  hookInput('model-switch-command', { session_id: SESSION, from_model: from, to_model: to, ...fields });

test('a model with rules gets them as session context, and the log records the delivery', () => {
  const h = home();
  const r = h.hook('session-start', start('claude-sonnet-5-5'));
  assert.equal(r.status, 0);
  assert.deepEqual(Object.keys(r.out ?? {}), ['hookSpecificOutput']);
  assert.equal(r.out?.hookSpecificOutput.hookEventName, 'SessionStart');
  const text: string = r.out?.hookSpecificOutput.additionalContext;
  assert.match(text, /^<sextant-rules model="claude-sonnet-5-5">\n/);
  assert.match(text, /SONNET-GEN-3306/);
  assert.doesNotMatch(text, /SONNET-CARRY-4471/, 'a rule for unattended sessions only is not delivered to a session');

  const [line] = h.log();
  assert.equal(line?.event, 'session-start');
  assert.equal(line?.status, 'matched');
  assert.equal(line?.model, 'claude-sonnet-5-5');
  assert.equal(line?.model_source, 'hook-input');
  assert.equal(line?.delivered, 'rules');
  assert.equal(line?.session_id, 'd1004f3b-4cb3-4ac6-a052-4e3fd53b2592');
  assert.deepEqual(line?.rules, ['sonnet/general']);
  assert.match(line?.sha256, /^[0-9a-f]{16}$/);
});

test('the recorded Claude Code input works as it is, [1m] suffix and all', () => {
  const h = home();
  assert.match(h.hook('session-start', hookInput('session-start-startup')).out?.hookSpecificOutput.additionalContext, /HAIKU-GEN-9047/);
  assert.match(h.hook('session-start', start('claude-sonnet-5-5[1m]', { session_id: 'other' })).out?.hookSpecificOutput.additionalContext, /SONNET-GEN-3306/);
});

test('a model declared "none" gets nothing, and the log says so', () => {
  const h = home();
  const r = h.hook('session-start', start('claude-opus-5-5'));
  assert.equal(r.status, 0);
  assert.equal(r.raw, '');
  assert.deepEqual(
    h.log().map((l) => [l.status, l.reason, l.key, l.delivered, l.warned]),
    [['none', 'declared-none', 'claude-opus-*', 'nothing', false]],
  );
});

test('an undeclared model only warns the person, never Claude, and writes a log line', () => {
  const h = home();
  const r = h.hook('session-start', start('claude-fable-5-2'));
  assert.equal(r.status, 0);
  assert.deepEqual(Object.keys(r.out ?? {}), ['systemMessage']);
  assert.match(r.out?.systemMessage, /^sextant: claude-fable-5-2 is not declared in .*sextant\.json, so this session gets no rules\./);
  assert.deepEqual(h.log().map((l) => [l.status, l.reason, l.delivered, l.warned]), [['undeclared', 'no-entry', 'nothing', true]]);

  const quiet = home(path.join(tempTree({ 'sextant.json': { version: 1, on_undeclared: 'ignore' } }), 'sextant.json'));
  assert.equal(quiet.hook('session-start', start('claude-fable-5-2')).raw, '');
  assert.deepEqual(quiet.log().map((l) => [l.status, l.warned]), [['undeclared', false]]);
});

test('an invalid configuration: the session opens, nothing is delivered, the log records config-invalid', () => {
  const config = path.join(tempTree({ 'sextant.json': { version: 1, models: { 'claude-sonnet-5-5': { use: 'custom', add: [{ id: 'r', file: 'missing.md' }] } } } }), 'sextant.json');
  const h = home(config);
  for (const [event, input] of [
    ['session-start', start('claude-sonnet-5-5')],
    ['model-switch', switchTo('claude-haiku-5-5', 'claude-sonnet-5-5')],
  ] as const) {
    const r = h.hook(event, input);
    assert.equal(r.status, 0);
    assert.deepEqual(Object.keys(r.out ?? {}), ['systemMessage']);
    assert.match(r.out?.systemMessage, /configuration at .* was refused \(1 problem\), so no rules were delivered\. Run `sextant check`/);
  }
  assert.deepEqual(h.log().map((l) => [l.event, l.status, l.problems, l.delivered]), [
    ['session-start', 'config-invalid', 1, 'nothing'],
    ['model-switch', 'config-invalid', 1, 'nothing'],
  ]);

  const unreadable = home(path.join(tempTree({ 'sextant.json': '{ "version": 1, ' }), 'sextant.json'));
  assert.match(unreadable.hook('session-start', start('claude-sonnet-5-5')).out?.systemMessage, /refused/);
  assert.equal(unreadable.log()[0]?.status, 'config-invalid');
});

test('an account with no configuration is left alone: no output and no files', () => {
  const dir = tempTree({});
  const r = runCli(['hook', 'session-start'], { HOME: dir }, NO_NETWORK, start('claude-sonnet-5-5'));
  assert.deepEqual([r.status, r.stdout, r.stderr], [0, '', '']);
  assert.deepEqual(fs.readdirSync(dir), []);

  // A configuration path given on purpose that does not exist is a refused configuration.
  const h = home(path.join(dir, 'nope.json'));
  assert.match(h.hook('session-start', start('claude-sonnet-5-5')).out?.systemMessage, /refused/);
});

test('SEXTANT_DISABLE=1 turns every hook off', () => {
  const h = home();
  assert.equal(h.hook('session-start', start('claude-sonnet-5-5'), { SEXTANT_DISABLE: '1' }).raw, '');
  assert.equal(h.hook('model-switch', switchTo('claude-haiku-5-5', 'claude-sonnet-5-5'), { SEXTANT_DISABLE: '1' }).raw, '');
  assert.deepEqual(h.log(), []);
});

test('input that is not this Claude Code event is ignored silently, with exit 0', () => {
  const h = home();
  for (const [args, input] of [
    [['hook', 'session-start'], 'not json'],
    [['hook', 'session-start'], '[]'],
    [['hook', 'session-start'], ''],
    [['hook', 'session-start'], switchTo('a', 'b')],
    [['hook', 'model-switch'], start('claude-sonnet-5-5')],
    [['hook', 'stop'], hookInput('session-start-startup', { hook_event_name: 'Stop' })],
    [['hook'], start('claude-sonnet-5-5')],
    [['hook', 'session-start', 'extra'], start('claude-sonnet-5-5')],
  ] as const) {
    const r = runCli(args, h.env, NO_NETWORK, input);
    assert.deepEqual([r.status, r.stdout, r.stderr], [0, '', ''], `${args.join(' ')} with ${input}`);
  }
  assert.deepEqual(h.log(), []);
});

test('SessionStart by start type: resume and fork skip rules the session already holds; clear and compact deliver again', () => {
  const h = home();
  const words = (r: { out: Record<string, any> | null }): string | undefined => r.out?.hookSpecificOutput?.additionalContext;
  assert.match(words(h.hook('session-start', start('claude-sonnet-5-5'))) ?? '', /SONNET-GEN/);
  assert.equal(h.hook('session-start', start('claude-sonnet-5-5', { source: 'resume' })).raw, '');
  assert.equal(h.hook('session-start', start('claude-sonnet-5-5', { source: 'fork' })).raw, '');
  assert.match(words(h.hook('session-start', start('claude-sonnet-5-5', { source: 'compact' }))) ?? '', /SONNET-GEN/);
  assert.match(words(h.hook('session-start', start('claude-sonnet-5-5', { source: 'something-new' }))) ?? '', /SONNET-GEN/);
  // A resume on another model, or into a session with no record, delivers.
  assert.match(words(h.hook('session-start', start('claude-haiku-5-5', { source: 'resume' }))) ?? '', /HAIKU-GEN/);
  assert.match(words(h.hook('session-start', start('claude-sonnet-5-5', { source: 'resume', session_id: 'never-seen' }))) ?? '', /SONNET-GEN/);
  assert.deepEqual(
    h.log().map((l) => [l.source, l.delivered]),
    [
      ['startup', 'rules'],
      ['resume', 'already-delivered'],
      ['fork', 'already-delivered'],
      ['compact', 'rules'],
      ['something-new', 'rules'],
      ['resume', 'rules'],
      ['resume', 'rules'],
    ],
  );
});

test('a resume after the rules changed delivers the new rules', () => {
  const dir = tempTree({ 'sextant.json': { version: 1, models: { 'claude-sonnet-5-5': { use: 'custom', add: [{ id: 'r', file: 'r.md' }] } } }, 'r.md': 'WORD-ONE' });
  const h = home(path.join(dir, 'sextant.json'));
  assert.match(h.hook('session-start', start('claude-sonnet-5-5')).out?.hookSpecificOutput.additionalContext, /WORD-ONE/);
  fs.writeFileSync(path.join(dir, 'r.md'), 'WORD-TWO');
  assert.match(h.hook('session-start', start('claude-sonnet-5-5', { source: 'resume' })).out?.hookSpecificOutput.additionalContext, /WORD-TWO/);
});

test('when Claude Code leaves the model out, the session or its Claude Code process supplies it, never a guess', () => {
  const h = home();
  // A new session with no model (as `claude -p` starts): nothing to go on, so it warns.
  const blind = h.hook('session-start', start(null));
  assert.match(blind.out?.systemMessage, /did not report this session's model/);
  assert.equal(blind.out?.hookSpecificOutput, undefined);

  // Every hook of these tests has the same parent process, standing in for one Claude Code process.
  h.hook('session-start', start('claude-sonnet-5-5'));
  const cleared = h.hook('session-start', hookInput('session-start-clear'));
  assert.match(cleared.out?.hookSpecificOutput.additionalContext, /SONNET-GEN-3306/);
  // A start that is not /clear or a compaction never borrows the process's model.
  assert.match(h.hook('session-start', start(null, { session_id: 'brand-new' })).out?.systemMessage, /did not report/);
  // A resumed session without a model uses its own record.
  assert.equal(h.hook('session-start', start(null, { source: 'resume' })).raw, '');
  assert.deepEqual(
    h.log().map((l) => [l.source, l.status, l.model_source, l.delivered]),
    [
      ['startup', 'undeclared', null, 'nothing'],
      ['startup', 'matched', 'hook-input', 'rules'],
      ['clear', 'matched', 'process-record', 'rules'],
      ['startup', 'undeclared', null, 'nothing'],
      ['resume', 'matched', 'session-record', 'already-delivered'],
    ],
  );
});

test('/model: the new model gets its rules, with a note that the earlier rules no longer apply', () => {
  const h = home();
  h.hook('session-start', start('claude-haiku-5-5'));
  const toSonnet = h.hook('model-switch', switchTo('claude-haiku-5-5', 'claude-sonnet-5-5'));
  assert.equal(toSonnet.status, 0);
  assert.equal(toSonnet.out?.hookSpecificOutput.hookEventName, 'PostModelSwitch');
  const text: string = toSonnet.out?.hookSpecificOutput.additionalContext;
  assert.match(text, /^<sextant-rules-change from="claude-haiku-5-5" to="claude-sonnet-5-5">\nThe session's model changed from claude-haiku-5-5 to claude-sonnet-5-5\. The working rules sextant delivered earlier in this conversation for claude-haiku-5-5 no longer apply\.\n<\/sextant-rules-change>\n\n<sextant-rules model="claude-sonnet-5-5">/);
  assert.match(text, /SONNET-GEN-3306/);
  assert.doesNotMatch(text, /HAIKU-GEN-9047/);

  // To a model with no rules: only the note. Back from it: only the rules, there is nothing to withdraw.
  const toOpus = h.hook('model-switch', switchTo('claude-sonnet-5-5', 'claude-opus-5-5'));
  assert.match(toOpus.out?.hookSpecificOutput.additionalContext, /^<sextant-rules-change from="claude-sonnet-5-5" to="claude-opus-5-5">[^]*<\/sextant-rules-change>$/);
  const back = h.hook('model-switch', switchTo('claude-opus-5-5', 'claude-sonnet-5-5'));
  assert.match(back.out?.hookSpecificOutput.additionalContext, /^<sextant-rules model="claude-sonnet-5-5">/);

  // Resuming restores the model and reports it as a switch: the rules are already there.
  assert.equal(h.hook('model-switch', switchTo('claude-sonnet-5-5', 'claude-sonnet-5-5', { source: 'resume' })).raw, '');
  // To an undeclared model: the note for Claude and a warning for the person.
  const toFable = h.hook('model-switch', switchTo('claude-sonnet-5-5', 'claude-fable-5-2'));
  assert.match(toFable.out?.systemMessage, /claude-fable-5-2 is not declared/);
  assert.match(toFable.out?.hookSpecificOutput.additionalContext, /^<sextant-rules-change from="claude-sonnet-5-5" to="claude-fable-5-2">/);

  assert.deepEqual(
    h.log().map((l) => [l.event, l.from_model ?? null, l.model, l.status, l.delivered]),
    [
      ['session-start', null, 'claude-haiku-5-5', 'matched', 'rules'],
      ['model-switch', 'claude-haiku-5-5', 'claude-sonnet-5-5', 'matched', 'rules+note'],
      ['model-switch', 'claude-sonnet-5-5', 'claude-opus-5-5', 'none', 'note'],
      ['model-switch', 'claude-opus-5-5', 'claude-sonnet-5-5', 'matched', 'rules'],
      ['model-switch', 'claude-sonnet-5-5', 'claude-sonnet-5-5', 'matched', 'already-delivered'],
      ['model-switch', 'claude-sonnet-5-5', 'claude-fable-5-2', 'undeclared', 'note'],
    ],
  );
});

test('/model with no record of the session: the note follows from the previous model the input names', () => {
  const h = home();
  assert.match(h.hook('model-switch', switchTo('claude-sonnet-5-5', 'claude-haiku-5-5')).out?.hookSpecificOutput.additionalContext, /^<sextant-rules-change from="claude-sonnet-5-5"[^]*HAIKU-GEN-9047/);
  const fresh = home();
  assert.match(fresh.hook('model-switch', switchTo('claude-opus-5-5', 'claude-haiku-5-5')).out?.hookSpecificOutput.additionalContext, /^<sextant-rules model="claude-haiku-5-5">/);
});

test('a decision log that cannot be written never costs the session its rules', () => {
  const h = home();
  fs.mkdirSync(path.join(h.dir, '.local'), { recursive: true });
  fs.writeFileSync(path.join(h.dir, '.local', 'state'), 'a file where a directory should be');
  assert.match(h.hook('session-start', start('claude-sonnet-5-5')).out?.hookSpecificOutput.additionalContext, /SONNET-GEN-3306/);
  assert.match(h.hook('model-switch', switchTo('claude-opus-5-5', 'claude-sonnet-5-5')).out?.hookSpecificOutput.additionalContext, /SONNET-GEN-3306/);
});

test('the hook pointer written by install runs the hook, and exits 0 quietly once its copy is gone', () => {
  const h = home();
  const claudeDir = tempTree({});
  const installed = runCli(['install', '--account', claudeDir], h.env);
  assert.equal(installed.status, 0, installed.stderr);
  const pointer = path.join(h.dir, '.local', 'share', 'sextant', 'sextant-hook');
  const r = runProgram(pointer, ['session-start'], h.env, start('claude-sonnet-5-5'));
  assert.equal(r.status, 0, r.stderr);
  assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /SONNET-GEN-3306/);
  assert.equal(h.log()[0]?.install, 'account');

  // A pointer whose copy of sextant was removed: no output, no error, exit 0.
  const script = fs.readFileSync(pointer, 'utf8').replace(/^cli=.*$/m, `cli='${path.join(h.dir, 'gone', 'cli.js')}'`);
  fs.writeFileSync(pointer, script);
  assert.deepEqual(Object.values(runProgram(pointer, ['session-start'], h.env, start('claude-sonnet-5-5'))), [0, '', '']);
});

test('the documented resume input, cost fields and all, finds the rules already delivered', () => {
  const h = home();
  assert.match(h.hook('session-start', hookInput('session-start-startup')).out?.hookSpecificOutput.additionalContext, /HAIKU-GEN-9047/);
  assert.equal(h.hook('session-start', hookInput('session-start-resume')).raw, '');
  assert.deepEqual(h.log().map((l) => [l.source, l.delivered]), [['startup', 'rules'], ['resume', 'already-delivered']]);
});
