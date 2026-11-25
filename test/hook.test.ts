// The SessionStart and PostModelSwitch hook adapter, driven as Claude Code drives it: a separate
// process that gets the hook input on stdin. Each test has its own home directory, so the decision
// log and the session records start empty.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { modelArgument, optionCandidates } from '../src/adapters/claude-code/launch.js';
import { conversationModel } from '../src/adapters/claude-code/predict.js';
import { managedTarget } from '../src/adapters/claude-code/locations.js';
import { RULES_TEXT_LIMIT } from '../src/core/types.js';
import { CLI, FIXTURES, hookHome, hookInput, LAB_CONFIG, LAB_PRESETS, NO_NETWORK, runCli, runProgram, tempTree, type HookHome as Home } from './helpers.js';

const home = hookHome;

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
  assert.match(text, /^<noonsight-rules model="claude-sonnet-5-5">\n/);
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
  assert.match(r.out?.systemMessage, /^noonsight: claude-fable-5-2 is not declared in .*noonsight\.json, so this session gets no rules\./);
  assert.deepEqual(h.log().map((l) => [l.status, l.reason, l.delivered, l.warned]), [['undeclared', 'no-entry', 'nothing', true]]);

  const quiet = home(path.join(tempTree({ 'noonsight.json': { version: 1, on_undeclared: 'ignore' } }), 'noonsight.json'));
  assert.equal(quiet.hook('session-start', start('claude-fable-5-2')).raw, '');
  assert.deepEqual(quiet.log().map((l) => [l.status, l.warned]), [['undeclared', false]]);
});

test('an invalid configuration: the session opens, nothing is delivered, the log records config-invalid', () => {
  const config = path.join(tempTree({ 'noonsight.json': { version: 1, models: { 'claude-sonnet-5-5': { use: 'custom', add: [{ id: 'r', file: 'missing.md' }] } } } }), 'noonsight.json');
  const h = home(config);
  for (const [event, input] of [
    ['session-start', start('claude-sonnet-5-5')],
    ['model-switch', switchTo('claude-haiku-5-5', 'claude-sonnet-5-5')],
  ] as const) {
    const r = h.hook(event, input);
    assert.equal(r.status, 0);
    assert.deepEqual(Object.keys(r.out ?? {}), ['systemMessage']);
    assert.match(r.out?.systemMessage, /configuration at .* was refused \(1 problem\), so no rules were delivered\. Run `noonsight check`/);
  }
  assert.deepEqual(h.log().map((l) => [l.event, l.status, l.problems, l.delivered]), [
    ['session-start', 'config-invalid', 1, 'nothing'],
    ['model-switch', 'config-invalid', 1, 'nothing'],
  ]);

  const unreadable = home(path.join(tempTree({ 'noonsight.json': '{ "version": 1, ' }), 'noonsight.json'));
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

test('NOONSIGHT_DISABLE=1 turns every hook off', () => {
  const h = home();
  assert.equal(h.hook('session-start', start('claude-sonnet-5-5'), { NOONSIGHT_DISABLE: '1' }).raw, '');
  assert.equal(h.hook('model-switch', switchTo('claude-haiku-5-5', 'claude-sonnet-5-5'), { NOONSIGHT_DISABLE: '1' }).raw, '');
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
  const words = (r: { out: Record<string, any> | null }): string => context(r);
  assert.match(words(h.hook('session-start', start('claude-sonnet-5-5'))) ?? '', /SONNET-GEN/);
  assert.equal(h.hook('session-start', start('claude-sonnet-5-5', { source: 'resume' })).raw, '');
  assert.equal(h.hook('session-start', start('claude-sonnet-5-5', { source: 'fork' })).raw, '');
  assert.match(words(h.hook('session-start', start('claude-sonnet-5-5', { source: 'compact' }))) ?? '', /SONNET-GEN/);
  assert.match(words(h.hook('session-start', start('claude-sonnet-5-5', { source: 'something-new' }))) ?? '', /SONNET-GEN/);
  // A resume on another model, or into a session with no record, delivers; on another model, with a
  // note that the rules the conversation holds no longer apply.
  assert.match(
    words(underClaude(h, ['--continue', '--model', 'haiku'], start('claude-haiku-5-5', { source: 'resume', model: undefined }))) ?? '',
    /^<noonsight-rules-change from="claude-sonnet-5-5" to="claude-haiku-5-5">[\s\S]*HAIKU-GEN/,
  );
  assert.match(words(h.hook('session-start', start('claude-sonnet-5-5', { source: 'resume', session_id: 'never-seen' }))) ?? '', /SONNET-GEN/);
  assert.deepEqual(
    h.log().map((l) => [l.source, l.delivered]),
    [
      ['startup', 'rules'],
      ['resume', 'already-delivered'],
      ['fork', 'already-delivered'],
      ['compact', 'rules'],
      ['something-new', 'rules'],
      ['resume', 'rules+note'],
      ['resume', 'rules'],
    ],
  );
});

test('a resume after the rules changed delivers the new rules', () => {
  const dir = tempTree({ 'noonsight.json': { version: 1, models: { 'claude-sonnet-5-5': { use: 'custom', add: [{ id: 'r', file: 'r.md' }] } } }, 'r.md': 'WORD-ONE' });
  const h = home(path.join(dir, 'noonsight.json'));
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
  assert.match(text, /^<noonsight-rules-change from="claude-haiku-5-5" to="claude-sonnet-5-5">\nThe session's model changed from claude-haiku-5-5 to claude-sonnet-5-5\. The working rules noonsight delivered earlier in this conversation for claude-haiku-5-5 no longer apply\.\n<\/noonsight-rules-change>\n\n<noonsight-rules model="claude-sonnet-5-5">/);
  assert.match(text, /SONNET-GEN-3306/);
  assert.doesNotMatch(text, /HAIKU-GEN-9047/);

  // To a model with no rules: only the note. The switch to Sonnet may never have reached the
  // conversation, so the note names Haiku again with Sonnet.
  const toOpus = h.hook('model-switch', switchTo('claude-sonnet-5-5', 'claude-opus-5-5'));
  assert.equal(
    toOpus.out?.hookSpecificOutput.additionalContext,
    '<noonsight-rules-change from="claude-haiku-5-5 claude-sonnet-5-5" to="claude-opus-5-5">\n' +
      "The session's model changed from claude-sonnet-5-5 to claude-opus-5-5. " +
      'The working rules noonsight delivered earlier in this conversation for claude-haiku-5-5 and claude-sonnet-5-5 no longer apply.\n' +
      '</noonsight-rules-change>',
  );
  // Back to Sonnet: its rules, and the note for Haiku, whose rules no delivered note may have retired.
  const back: string = h.hook('model-switch', switchTo('claude-opus-5-5', 'claude-sonnet-5-5')).out?.hookSpecificOutput.additionalContext;
  assert.match(back, /^<noonsight-rules-change from="claude-haiku-5-5" to="claude-sonnet-5-5">[^]*<\/noonsight-rules-change>\n\n<noonsight-rules model="claude-sonnet-5-5">/);
  // To an undeclared model: the note for Claude and a warning for the person.
  const toFable = h.hook('model-switch', switchTo('claude-sonnet-5-5', 'claude-fable-5-2'));
  assert.match(toFable.out?.systemMessage, /claude-fable-5-2 is not declared/);
  assert.match(toFable.out?.hookSpecificOutput.additionalContext, /^<noonsight-rules-change from="claude-haiku-5-5 claude-sonnet-5-5" to="claude-fable-5-2">/);

  assert.deepEqual(
    h.log().map((l) => [l.event, l.from_model ?? null, l.model, l.status, l.delivered]),
    [
      ['session-start', null, 'claude-haiku-5-5', 'matched', 'rules'],
      ['model-switch', 'claude-haiku-5-5', 'claude-sonnet-5-5', 'matched', 'rules+note'],
      ['model-switch', 'claude-sonnet-5-5', 'claude-opus-5-5', 'none', 'note'],
      ['model-switch', 'claude-opus-5-5', 'claude-sonnet-5-5', 'matched', 'rules+note'],
      ['model-switch', 'claude-sonnet-5-5', 'claude-fable-5-2', 'undeclared', 'note'],
    ],
  );

  // Resuming restores the model and reports it as a switch: after a start, whose delivery the
  // conversation keeps, the rules are already there.
  const resumed = home();
  resumed.hook('session-start', start('claude-sonnet-5-5'));
  assert.equal(resumed.hook('model-switch', switchTo('claude-sonnet-5-5', 'claude-sonnet-5-5', { source: 'resume' })).raw, '');
  assert.equal(resumed.log()[1]?.delivered, 'already-delivered');
});

test('the longest rules a configuration may hold, plus the model-change note, fit in the 10,000 characters Claude Code keeps', () => {
  const from = `claude-${'f'.repeat(120)}-5-5`;
  const to = `claude-${'t'.repeat(120)}-5-5`;
  const withRule = (length: number): Home => {
    const custom = (file: string) => ({ use: 'custom', add: [{ id: `user/${file}`, file }] });
    const dir = tempTree({ 'noonsight.json': { version: 1, models: { [from]: custom('from.md'), [to]: custom('to.md') } }, 'from.md': 'FROM', 'to.md': 'x'.repeat(length) });
    return home(path.join(dir, 'noonsight.json'));
  };
  const overhead = (withRule(1).hook('session-start', start(to)).out?.hookSpecificOutput.additionalContext as string).length - 1;
  const longest = RULES_TEXT_LIMIT - overhead;
  const over = withRule(longest + 1);
  over.hook('session-start', start(to));
  assert.equal(over.log()[0]?.status, 'config-invalid', 'one character more is refused');

  const h = withRule(longest);
  assert.match(h.hook('session-start', start(from)).out?.hookSpecificOutput.additionalContext, /FROM/);
  const text: string = h.hook('model-switch', switchTo(from, to)).out?.hookSpecificOutput.additionalContext;
  assert.match(text, /^<noonsight-rules-change [^]*<\/noonsight-rules-change>\n\n<noonsight-rules model="claude-t+-5-5">[^]*x{100}/);
  assert.ok(text.length <= 10000, String(text.length));
});

test('/model with no record of the session: the note follows from the previous model the input names', () => {
  const h = home();
  assert.match(h.hook('model-switch', switchTo('claude-sonnet-5-5', 'claude-haiku-5-5')).out?.hookSpecificOutput.additionalContext, /^<noonsight-rules-change from="claude-sonnet-5-5"[^]*HAIKU-GEN-9047/);
  const fresh = home();
  assert.match(fresh.hook('model-switch', switchTo('claude-opus-5-5', 'claude-haiku-5-5')).out?.hookSpecificOutput.additionalContext, /^<noonsight-rules model="claude-haiku-5-5">/);
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
  const pointer = path.join(h.dir, '.local', 'share', 'noonsight', 'noonsight-hook');
  const r = runProgram(pointer, ['session-start'], h.env, start('claude-sonnet-5-5'));
  assert.equal(r.status, 0, r.stderr);
  assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /SONNET-GEN-3306/);
  assert.equal(h.log()[0]?.install, 'account');

  // A pointer whose copy of noonsight was removed: no output, no error, exit 0.
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

// claude -p: the SessionStart input names no model (recorded in session-start-print.json), so the hook
// takes it from what the session was started with. Each run below is the child of a stand-in for the
// claude process, started with the claude arguments the test gives.

const FAKE_CLAUDE = path.join(FIXTURES, 'fake-claude.cjs');
const print = (id: string): string => hookInput('session-start-print', { session_id: id });
/** What a hook returned for the model, without the time a resume's or a fork's delivery carries (see the test on it). */
const context = (r: { out: Record<string, any> | null }): string => (r.out?.hookSpecificOutput?.additionalContext ?? '').replace(/ at="[^"]*"/g, '');

function underClaude(h: Home, claudeArgs: readonly string[], input: string, extra: Record<string, string> = {}) {
  const hook = [process.execPath, ...NO_NETWORK, CLI, 'hook', 'session-start'];
  const r = runProgram(process.execPath, [FAKE_CLAUDE, ...claudeArgs], { ...h.env, ...extra, NOONSIGHT_FAKE_HOOK: JSON.stringify(hook) }, input);
  assert.equal(r.status, 0);
  assert.equal(r.stderr, '', r.stderr);
  return { out: r.stdout ? (JSON.parse(r.stdout) as Record<string, any>) : null, raw: r.stdout };
}

const launchLog = (h: Home): unknown[][] =>
  h.log().map((l) => [l.model, l.model_source, l.model_from ?? null, l.model_alias ?? null, l.alias_from ?? null, l.delivered]);

test('claude -p: with nothing naming the model, the hook warns and delivers nothing', () => {
  const h = home();
  const r = underClaude(h, ['-p', 'hello'], hookInput('session-start-print'));
  assert.deepEqual(Object.keys(r.out ?? {}), ['systemMessage']);
  assert.match(r.out?.systemMessage, /did not report this session's model, and neither its command line, ANTHROPIC_MODEL nor a model setting names one/);
  assert.deepEqual(h.log().map((l) => [l.status, l.reason, l.model_source, l.delivered, l.warned]), [['undeclared', 'model-not-reported', null, 'nothing', true]]);
});

test('claude -p: the --model argument of the Claude Code process names the model, by alias or full name', () => {
  const h = home();
  assert.match(context(underClaude(h, ['-p', 'hello', '--model', 'claude-sonnet-5-5'], print('full'))), /SONNET-GEN-3306/);
  assert.match(context(underClaude(h, ['--model=haiku', '-p', 'hello'], print('alias'))), /HAIKU-GEN-9047/);
  // An alias follows the variable that pins it.
  const pinned = { ANTHROPIC_DEFAULT_HAIKU_MODEL: 'claude-sonnet-5-5' };
  assert.match(context(underClaude(h, ['-p', '--model', 'haiku', 'hello'], print('pinned'), pinned)), /SONNET-GEN-3306/);
  // The argument outranks ANTHROPIC_MODEL, as it does in Claude Code.
  assert.match(context(underClaude(h, ['-p', '--model', 'sonnet[1m]', 'hello'], print('over-env'), { ANTHROPIC_MODEL: 'claude-haiku-5-5' })), /SONNET-GEN-3306/);
  // A prompt that mentions the option is not the option where arguments keep their boundaries; where
  // they do not, as on macOS, the hook cannot tell them apart and warns instead of guessing.
  const prompt = underClaude(h, ['-p', 'what does --model nope do?'], print('prompt'));
  assert.equal(context(prompt), '');
  assert.match(prompt.out?.systemMessage, process.platform === 'darwin' ? /set to "nope" \(--model\)/ : /did not report/);
  assert.deepEqual(launchLog(h), [
    ['claude-sonnet-5-5', 'claude-args', '--model', null, null, 'rules'],
    ['claude-haiku-5-5', 'claude-args', '--model', 'haiku', 'built-in', 'rules'],
    ['claude-sonnet-5-5', 'claude-args', '--model', 'haiku', 'ANTHROPIC_DEFAULT_HAIKU_MODEL', 'rules'],
    ['claude-sonnet-5-5', 'claude-args', '--model', 'sonnet[1m]', 'built-in', 'rules'],
    [null, null, process.platform === 'darwin' ? '--model' : null, null, null, 'nothing'],
  ]);
});

test('claude -p: without --model, ANTHROPIC_MODEL in the environment Claude Code passes to hooks names the model', () => {
  const h = home();
  assert.match(context(underClaude(h, ['-p', 'hello'], print('env'), { ANTHROPIC_MODEL: 'claude-sonnet-5-5' })), /SONNET-GEN-3306/);
  assert.equal(underClaude(h, ['-p', 'hello'], print('env-alias'), { ANTHROPIC_MODEL: 'opus' }).raw, '');
  assert.deepEqual(launchLog(h), [
    ['claude-sonnet-5-5', 'env', 'ANTHROPIC_MODEL', null, null, 'rules'],
    ['claude-opus-5-5', 'env', 'ANTHROPIC_MODEL', 'opus', 'built-in', 'nothing'],
  ]);
});

test('claude -p: without --model or ANTHROPIC_MODEL, the highest-ranked settings file that sets a model names it', () => {
  const h = home();
  const claudeDir = tempTree({ 'settings.json': { model: 'haiku' } });
  const project = tempTree({});
  const env = { CLAUDE_CONFIG_DIR: claudeDir, CLAUDE_PROJECT_DIR: project };
  const run = (id: string, args: readonly string[] = ['-p', 'hello'], extra: Record<string, string> = {}) =>
    underClaude(h, args, print(id), { ...env, ...extra });
  const write = (file: string, value: unknown): void => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(value));
  };

  run('user');
  write(path.join(project, '.claude', 'settings.json'), { model: 'claude-sonnet-5-5' });
  run('project');
  write(path.join(project, '.claude', 'settings.local.json'), { model: 'claude-opus-5-5' });
  run('local');
  run('sources', ['-p', 'hello', '--setting-sources', 'user']);
  run('inline', ['-p', 'hello', '--settings', '{"model":"claude-sonnet-5-5"}']);
  const managedDir = managedTarget(h.env).managedDir ?? '';
  write(path.join(managedDir, 'managed-settings.d', '50-models.json'), { model: 'claude-haiku-5-5' });
  run('managed');
  // Server-managed settings cached for this login outrank the managed settings files.
  write(path.join(claudeDir, 'remote-settings.json'), { model: 'claude-sonnet-5-5', permissions: { allow: [] } });
  run('remote');
  // The environment outranks every settings file.
  run('env', ['-p', 'hello'], { ANTHROPIC_MODEL: 'claude-opus-5-5' });

  const P = (rel: string): string => path.join(project, '.claude', rel);
  assert.deepEqual(launchLog(h), [
    ['claude-haiku-5-5', 'settings', path.join(claudeDir, 'settings.json'), 'haiku', 'built-in', 'rules'],
    ['claude-sonnet-5-5', 'settings', P('settings.json'), null, null, 'rules'],
    ['claude-opus-5-5', 'settings', P('settings.local.json'), null, null, 'nothing'],
    ['claude-haiku-5-5', 'settings', path.join(claudeDir, 'settings.json'), 'haiku', 'built-in', 'rules'],
    ['claude-sonnet-5-5', 'settings', '--settings', null, null, 'rules'],
    ['claude-haiku-5-5', 'settings', path.join(managedDir, 'managed-settings.d', '50-models.json'), null, null, 'rules'],
    ['claude-sonnet-5-5', 'settings', path.join(claudeDir, 'remote-settings.json'), null, null, 'rules'],
    ['claude-opus-5-5', 'env', 'ANTHROPIC_MODEL', null, null, 'nothing'],
  ]);
});

test('claude -p: a model setting noonsight cannot pin down warns with what was set and where, and delivers nothing', () => {
  const h = home();
  const plan = underClaude(h, ['-p', '--model', 'opusplan', 'hello'], print('plan'));
  assert.match(plan.out?.systemMessage, /model is set to "opusplan" \(--model\), and noonsight cannot tell which model that is \(Claude Code chooses that model while the session runs\)/);
  const bedrock = underClaude(h, ['-p', 'hello'], print('bedrock'), { ANTHROPIC_MODEL: 'haiku', CLAUDE_CODE_USE_BEDROCK: '1' });
  assert.match(bedrock.out?.systemMessage, /set to "haiku" \(ANTHROPIC_MODEL\).*when CLAUDE_CODE_USE_BEDROCK is set; set ANTHROPIC_DEFAULT_HAIKU_MODEL/);
  // Pinning the alias settles it on any provider.
  const pinned = { ANTHROPIC_MODEL: 'haiku', CLAUDE_CODE_USE_BEDROCK: '1', ANTHROPIC_DEFAULT_HAIKU_MODEL: 'us.anthropic.claude-haiku-5-5-v1:0' };
  assert.match(context(underClaude(h, ['-p', 'hello'], print('pinned'), pinned)), /HAIKU-GEN-9047/);
  assert.deepEqual(
    h.log().map((l) => [l.status, l.model, l.model_from ?? null, l.model_unresolved ?? null, l.delivered]),
    [
      ['undeclared', null, '--model', 'opusplan', 'nothing'],
      ['undeclared', null, 'ANTHROPIC_MODEL', 'haiku', 'nothing'],
      ['matched', 'claude-haiku-5-5', 'ANTHROPIC_MODEL', null, 'rules'],
    ],
  );
});

test('a reported model outranks the launch settings, and so does the record of the session after /clear', () => {
  const h = home();
  const r = underClaude(h, ['-p', '--model', 'claude-haiku-5-5'], start('claude-sonnet-5-5', { session_id: 'reported' }));
  assert.match(context(r), /SONNET-GEN-3306/);
  // After /model, the process runs another model than its --model names; the record knows which.
  assert.match(context(underClaude(h, ['--model', 'claude-haiku-5-5'], hookInput('session-start-clear', { session_id: 'reported' }))), /SONNET-GEN-3306/);
  assert.deepEqual(h.log().map((l) => [l.source, l.model, l.model_source, l.delivered]), [
    ['startup', 'claude-sonnet-5-5', 'hook-input', 'rules'],
    ['clear', 'claude-sonnet-5-5', 'session-record', 'rules'],
  ]);
});

// A conversation resumed in a new Claude Code process gets a SessionStart input that names no model,
// and no PostModelSwitch. Claude Code runs it on the model its --model or ANTHROPIC_MODEL names, else on
// the model of the conversation's last response since its last compaction, else on the model setting
// (test/fixtures/hook-inputs/2.1.327/README.md, and on 2.1.328 test/live/lifecycle.test.ts), except
// that the setting `haiku` outranks a last response from Haiku or Sonnet (docs/verification/claude-code.md).
const resumeOf = (id: string, transcript?: string): string =>
  hookInput('session-start-resume-continue', { session_id: id, ...(transcript !== undefined ? { transcript_path: transcript } : {}) });

/** A transcript holding these records, one JSON line each, as Claude Code writes it. */
function conversation(...records: readonly Record<string, unknown>[]): string {
  const file = path.join(tempTree({}), 'conversation.jsonl');
  fs.writeFileSync(file, records.map((r) => `${JSON.stringify(r)}\n`).join(''));
  return file;
}
const turn = { type: 'user', isSidechain: false, message: { role: 'user', content: 'hello' } };
const reply = (model: string, fields: Record<string, unknown> = {}) => ({ type: 'assistant', isSidechain: false, message: { model, role: 'assistant', content: [] }, ...fields });
/** A conversation whose last response came now, after every hook that already ran: a request carried what they returned. */
const answeredNow = (model: string): string => conversation(turn, reply(model, { timestamp: new Date().toISOString() }));
const COMPACTED = { type: 'system', subtype: 'compact_boundary', isSidechain: false, content: 'Conversation compacted' };
const SUMMARY = { type: 'user', isSidechain: false, isCompactSummary: true, message: { role: 'user', content: 'summary' } };

test('a resume started with --model gets that model\'s rules over the session record, with a note that the earlier ones no longer apply', () => {
  const h = home();
  // Sonnet, then /model haiku, then /clear: the new session's record holds Haiku and its rules.
  h.hook('session-start', start('claude-sonnet-5-5', { session_id: 'first' }));
  h.hook('model-switch', switchTo('claude-sonnet-5-5', 'claude-haiku-5-5', { session_id: 'first' }));
  assert.match(context(h.hook('session-start', hookInput('session-start-clear', { session_id: 'cleared' }))), /HAIKU-GEN-9047/);

  // `claude --continue --model sonnet` resumes it on Sonnet.
  const resumed = context(underClaude(h, ['--continue', '--model', 'sonnet'], resumeOf('cleared')));
  assert.match(resumed, /^<noonsight-rules-change from="claude-haiku-5-5" to="claude-sonnet-5-5">\nThe session's model changed from claude-haiku-5-5 to claude-sonnet-5-5\./);
  assert.match(resumed, /<noonsight-rules model="claude-sonnet-5-5">[\s\S]*SONNET-GEN-3306/);
  assert.doesNotMatch(resumed, /HAIKU-GEN-9047/);
  // The conversation answered since, so the resume's delivery arrived: the same resume again delivers nothing.
  assert.equal(underClaude(h, ['--continue', '--model', 'sonnet'], resumeOf('cleared', answeredNow('claude-sonnet-5-5'))).raw, '');
  // ANTHROPIC_MODEL decides the same way; Opus is declared "none", so only the note goes.
  const onOpus = context(underClaude(h, ['--continue'], resumeOf('cleared'), { ANTHROPIC_MODEL: 'claude-opus-5-5' }));
  assert.match(onOpus, /^<noonsight-rules-change from="claude-sonnet-5-5" to="claude-opus-5-5">[\s\S]*<\/noonsight-rules-change>$/);

  assert.deepEqual(
    h.log().map((l) => [l.event, l.source, l.model, l.model_source, l.model_from ?? null, l.from_model ?? null, l.delivered]),
    [
      ['session-start', 'startup', 'claude-sonnet-5-5', 'hook-input', null, null, 'rules'],
      ['model-switch', 'command', 'claude-haiku-5-5', 'hook-input', null, 'claude-sonnet-5-5', 'rules+note'],
      ['session-start', 'clear', 'claude-haiku-5-5', 'process-record', null, null, 'rules'],
      ['session-start', 'resume', 'claude-sonnet-5-5', 'claude-args', '--model', 'claude-haiku-5-5', 'rules+note'],
      ['session-start', 'resume', 'claude-sonnet-5-5', 'claude-args', '--model', null, 'already-delivered'],
      ['session-start', 'resume', 'claude-opus-5-5', 'env', 'ANTHROPIC_MODEL', 'claude-sonnet-5-5', 'note'],
    ],
  );
});

test('a resume whose launch names no model, or one noonsight cannot pin down, keeps the model of the session record', () => {
  const h = home();
  h.hook('session-start', start('claude-haiku-5-5', { session_id: 'kept' }));
  assert.equal(underClaude(h, ['--continue'], resumeOf('kept')).raw, '');
  assert.equal(underClaude(h, ['--resume', 'kept', '--model', 'opusplan'], resumeOf('kept')).raw, '');
  // A conversation noonsight has no record of gets the rules of what the launch names, as any start.
  assert.match(context(underClaude(h, ['--resume', 'unseen', '--model', 'sonnet'], resumeOf('unseen'))), /^<noonsight-rules model="claude-sonnet-5-5">/);
  // /resume inside a running session reports the model the process runs, which outranks its command line.
  const command = hookInput('session-start-resume-command', { session_id: 'kept' });
  assert.equal(underClaude(h, ['--model', 'sonnet'], command).raw, '');
  assert.deepEqual(
    h.log().map((l) => [l.model, l.model_source, l.model_from ?? null, l.model_unresolved ?? null, l.delivered]),
    [
      ['claude-haiku-5-5', 'hook-input', null, null, 'rules'],
      ['claude-haiku-5-5', 'session-record', null, null, 'already-delivered'],
      ['claude-haiku-5-5', 'session-record', '--model', 'opusplan', 'already-delivered'],
      ['claude-sonnet-5-5', 'claude-args', '--model', null, 'rules'],
      ['claude-haiku-5-5', 'hook-input', null, null, 'already-delivered'],
    ],
  );
});

test('a resume whose command line and ANTHROPIC_MODEL name no model runs on the conversation\'s last response since its last compaction, over the model setting', () => {
  const h = home();
  // A /model in any session saves the choice as the model setting, here Sonnet.
  const sonnetSetting = { CLAUDE_CONFIG_DIR: tempTree({ 'settings.json': { model: 'sonnet' } }) };
  h.hook('session-start', start('claude-haiku-5-5', { session_id: 'ran' }));
  // The conversation last answered on Haiku, before or after a compaction: it resumes on Haiku.
  const answered = conversation(turn, reply('claude-haiku-5-5'));
  assert.equal(underClaude(h, ['--continue'], resumeOf('ran', answered), sonnetSetting).raw, '');
  const answeredSince = conversation(turn, reply('claude-sonnet-5-5'), COMPACTED, SUMMARY, turn, reply('claude-haiku-5-5'));
  assert.equal(underClaude(h, ['--continue'], resumeOf('ran', answeredSince), sonnetSetting).raw, '');
  // A label noonsight cannot pin down outranks the setting, and the conversation decides.
  assert.equal(underClaude(h, ['--continue', '--model', 'opusplan'], resumeOf('ran', answered), sonnetSetting).raw, '');
  // No response since the last compaction: the model setting decides.
  const compacted = conversation(turn, reply('claude-haiku-5-5'), COMPACTED, SUMMARY);
  assert.match(
    context(underClaude(h, ['--continue'], resumeOf('ran', compacted), sonnetSetting)),
    /^<noonsight-rules-change from="claude-haiku-5-5" to="claude-sonnet-5-5">[\s\S]*SONNET-GEN-3306/,
  );
  // Nor a setting: the session's record. Nothing has answered since the resume that delivered Sonnet's
  // rules, so they may never have arrived, and go again.
  assert.match(context(underClaude(h, ['--continue'], resumeOf('ran', compacted))), /^<noonsight-rules-change from="claude-haiku-5-5" to="claude-sonnet-5-5">[\s\S]*SONNET-GEN-3306/);
  // --model and ANTHROPIC_MODEL outrank the conversation, as the resume fix for an explicit --model keeps.
  assert.match(context(underClaude(h, ['--continue', '--model', 'haiku'], resumeOf('ran', answered), sonnetSetting)), /HAIKU-GEN-9047/);
  assert.match(context(underClaude(h, ['--continue'], resumeOf('ran', answered), { ANTHROPIC_MODEL: 'claude-sonnet-5-5' })), /SONNET-GEN-3306/);
  assert.deepEqual(
    h.log().map((l) => [l.model, l.model_source, l.model_from ?? null, l.model_unresolved ?? null, l.from_model ?? null, l.delivered]),
    [
      ['claude-haiku-5-5', 'hook-input', null, null, null, 'rules'],
      ['claude-haiku-5-5', 'session-transcript', null, null, null, 'already-delivered'],
      ['claude-haiku-5-5', 'session-transcript', null, null, null, 'already-delivered'],
      ['claude-haiku-5-5', 'session-transcript', '--model', 'opusplan', null, 'already-delivered'],
      ['claude-sonnet-5-5', 'settings', sonnetSetting.CLAUDE_CONFIG_DIR + '/settings.json', null, 'claude-haiku-5-5', 'rules+note'],
      ['claude-sonnet-5-5', 'session-record', null, null, null, 'rules+note'],
      ['claude-haiku-5-5', 'claude-args', '--model', null, 'claude-sonnet-5-5', 'rules+note'],
      ['claude-sonnet-5-5', 'env', 'ANTHROPIC_MODEL', null, 'claude-haiku-5-5', 'rules+note'],
    ],
  );
});

test('a resume under the model setting haiku runs on Haiku when the conversation last answered on Haiku or Sonnet, and on the conversation\'s model otherwise', () => {
  const h = home();
  const setting = (model: string) => ({ CLAUDE_CONFIG_DIR: tempTree({ 'settings.json': { model } }) });
  // Sonnet, a turn, /model haiku, exit, `claude --continue`: Claude Code runs Haiku, so Haiku's rules
  // go, with a note retiring Sonnet's (F4).
  h.hook('session-start', start('claude-sonnet-5-5', { session_id: 'f4' }));
  const resumed = context(underClaude(h, ['--continue'], resumeOf('f4', conversation(turn, reply('claude-sonnet-5-5'))), setting('haiku')));
  assert.match(resumed, /^<noonsight-rules-change from="claude-sonnet-5-5" to="claude-haiku-5-5">[\s\S]*<noonsight-rules model="claude-haiku-5-5">[\s\S]*HAIKU-GEN-9047/);
  assert.doesNotMatch(resumed, /SONNET-GEN-3306/);
  // Once Haiku has answered, the same resume runs on Haiku again and finds its rules.
  assert.equal(underClaude(h, ['--continue'], resumeOf('f4', answeredNow('claude-haiku-5-5')), setting('haiku')).raw, '');
  // Any other setting, opusplan and a capitalized Haiku included, leaves the conversation's model.
  for (const other of ['opusplan', 'Haiku', 'opus'])
    assert.equal(underClaude(h, ['--continue'], resumeOf('f4', answeredNow('claude-haiku-5-5')), setting(other)).raw, '');
  h.hook('session-start', start('claude-opus-5-5', { session_id: 'opus' }));
  // Opus's last response keeps Opus under haiku too.
  assert.equal(underClaude(h, ['--continue'], resumeOf('opus', conversation(turn, reply('claude-opus-5-5'))), setting('haiku')).raw, '');
  assert.deepEqual(
    h.log().map((l) => [l.session_id, l.model, l.model_source, l.from_model ?? null, l.delivered]),
    [
      ['f4', 'claude-sonnet-5-5', 'hook-input', null, 'rules'],
      ['f4', 'claude-haiku-5-5', 'settings', 'claude-sonnet-5-5', 'rules+note'],
      ['f4', 'claude-haiku-5-5', 'settings', null, 'already-delivered'],
      ['f4', 'claude-haiku-5-5', 'session-transcript', null, 'already-delivered'],
      ['f4', 'claude-haiku-5-5', 'session-transcript', null, 'already-delivered'],
      ['f4', 'claude-haiku-5-5', 'session-transcript', null, 'already-delivered'],
      ['opus', 'claude-opus-5-5', 'hook-input', null, 'nothing'],
      ['opus', 'claude-opus-5-5', 'session-transcript', null, 'already-delivered'],
    ],
  );
});

test('the conversation\'s model is that of its own last response: not a subagent\'s, not a synthetic message, and none since a compaction', () => {
  assert.equal(conversationModel(conversation(reply('claude-sonnet-5-5'), reply('claude-haiku-5-5', { isSidechain: true }), reply('<synthetic>'))), 'claude-sonnet-5-5');
  assert.equal(conversationModel(conversation(reply('claude-sonnet-5-5'), COMPACTED, SUMMARY, turn)), null);
  assert.equal(conversationModel(conversation(turn)), null);
  assert.equal(conversationModel(path.join(tempTree({}), 'missing.jsonl')), null);
  // A transcript longer than one read, with a line across the reads' boundary.
  const file = conversation(reply('claude-opus-5-5', { padding: 'p'.repeat(1536 * 1024) }), ...Array.from({ length: 3 }, () => ({ ...turn, padding: 'q'.repeat(700 * 1024) })));
  assert.equal(conversationModel(file), 'claude-opus-5-5');
  // A line that is not whole, as when Claude Code is writing it, is passed over.
  fs.appendFileSync(file, '{"type":"assistant","message":{"model":"claude-haiku');
  assert.equal(conversationModel(file), 'claude-opus-5-5');
});

test('the messages a compaction kept still hold the conversation\'s last response, which a resume runs on over the model setting', () => {
  const compacted = (...uuids: string[]) => ({ ...COMPACTED, compactMetadata: { preservedMessages: { uuids } } });
  const replied = (model: string, uuid: string) => reply(model, { uuid });
  // The last response among those kept; one it did not keep, or one a later compaction did not keep, is gone.
  assert.equal(conversationModel(conversation(replied('claude-fable-5-2', 'a'), replied('claude-haiku-5-5', 'b'), compacted('b'), SUMMARY)), 'claude-haiku-5-5');
  assert.equal(conversationModel(conversation(replied('claude-fable-5-2', 'a'), replied('claude-haiku-5-5', 'b'), compacted('a'), SUMMARY)), 'claude-fable-5-2');
  assert.equal(conversationModel(conversation(replied('claude-fable-5-2', 'a'), compacted('a'), SUMMARY, compacted(), SUMMARY)), null);
  assert.equal(conversationModel(conversation(replied('claude-fable-5-2', 'a'), compacted('a'), SUMMARY, compacted('a'), SUMMARY)), 'claude-fable-5-2');
  assert.equal(conversationModel(conversation(replied('claude-fable-5-2', 'a'), compacted('gone'), SUMMARY)), null);
  // A response since the compaction outranks those it kept.
  assert.equal(conversationModel(conversation(replied('claude-haiku-5-5', 'b'), compacted('b'), SUMMARY, turn, replied('claude-sonnet-5-5', 'c'))), 'claude-sonnet-5-5');

  // F11: the setting names another model, and the conversation's own rules are not retired.
  const h = home();
  h.hook('session-start', start('claude-haiku-5-5', { session_id: 'f11', source: 'compact' }));
  const kept = conversation(turn, replied('claude-haiku-5-5', 'b'), compacted('b'), SUMMARY);
  assert.equal(underClaude(h, ['--continue'], resumeOf('f11', kept), { CLAUDE_CONFIG_DIR: tempTree({ 'settings.json': { model: 'sonnet' } }) }).raw, '');
  const line = h.log().at(-1);
  assert.deepEqual([line?.model, line?.model_source, line?.delivered], ['claude-haiku-5-5', 'session-transcript', 'already-delivered']);
});

test('a /model delivery is unconfirmed: a switch right after it, or a resume, delivers again what may have been lost', () => {
  const custom = (word: string) => ({ use: 'custom', add: [{ id: `user/${word}`, file: `${word}.md` }] });
  const dir = tempTree({
    'noonsight.json': { version: 1, models: { 'claude-haiku-5-5': custom('haiku'), 'claude-sonnet-5-5': custom('sonnet'), 'claude-fable-5-2': custom('fable') } },
    'haiku.md': 'HAIKU-WORD',
    'sonnet.md': 'SONNET-WORD',
    'fable.md': 'FABLE-WORD',
  });
  const config = path.join(dir, 'noonsight.json');

  // Haiku, /model sonnet, /model fable, a turn: the first switch's return never reaches a request, so
  // the second one's note must retire Haiku, whose rules the conversation holds, as well as Sonnet.
  const twice = home(config);
  twice.hook('session-start', start('claude-haiku-5-5'));
  twice.hook('model-switch', switchTo('claude-haiku-5-5', 'claude-sonnet-5-5'));
  const second: string = context(twice.hook('model-switch', switchTo('claude-sonnet-5-5', 'claude-fable-5-2')));
  assert.match(second, /^<noonsight-rules-change from="claude-haiku-5-5 claude-sonnet-5-5" to="claude-fable-5-2">\n/);
  assert.match(second, /for claude-haiku-5-5 and claude-sonnet-5-5 no longer apply\.\n<\/noonsight-rules-change>\n\n<noonsight-rules model="claude-fable-5-2">[^]*FABLE-WORD/);

  // Fable, a turn, /model haiku, exit, `claude --continue --model haiku`: the switch's return was lost
  // with the process, so the resume delivers Haiku's rules again, with the note for Fable.
  const exited = home(config);
  exited.hook('session-start', start('claude-fable-5-2', { session_id: 'exited' }));
  exited.hook('model-switch', switchTo('claude-fable-5-2', 'claude-haiku-5-5', { session_id: 'exited' }));
  const again = context(underClaude(exited, ['--continue', '--model', 'haiku'], resumeOf('exited')));
  assert.match(again, /^<noonsight-rules-change from="claude-fable-5-2" to="claude-haiku-5-5">\nThis session runs on claude-haiku-5-5\. The working rules noonsight delivered earlier in this conversation for claude-fable-5-2 no longer apply\./);
  assert.match(again, /<noonsight-rules model="claude-haiku-5-5">[^]*HAIKU-WORD/);
  // Haiku answered after the resume, so its delivery arrived: the next resume finds it.
  assert.equal(underClaude(exited, ['--continue', '--model', 'haiku'], resumeOf('exited', answeredNow('claude-haiku-5-5'))).raw, '');
  assert.deepEqual(
    exited.log().map((l) => [l.event, l.model, l.delivered]),
    [
      ['session-start', 'claude-fable-5-2', 'rules'],
      ['model-switch', 'claude-haiku-5-5', 'rules+note'],
      ['session-start', 'claude-haiku-5-5', 'rules+note'],
      ['session-start', 'claude-haiku-5-5', 'already-delivered'],
    ],
  );

  // Fable, /model haiku, a turn, /model sonnet, a turn, /model haiku, exit, resume on Haiku: the resume
  // retires every other model whose rules the conversation may hold, and delivers Haiku's after.
  const many = home(config);
  many.hook('session-start', start('claude-fable-5-2', { session_id: 'many' }));
  for (const [from, to] of [
    ['claude-fable-5-2', 'claude-haiku-5-5'],
    ['claude-haiku-5-5', 'claude-sonnet-5-5'],
    ['claude-sonnet-5-5', 'claude-haiku-5-5'],
  ] as const)
    many.hook('model-switch', switchTo(from, to, { session_id: 'many' }));
  const last = context(underClaude(many, ['--continue', '--model', 'haiku'], resumeOf('many')));
  assert.match(last, /^<noonsight-rules-change from="claude-fable-5-2 claude-sonnet-5-5" to="claude-haiku-5-5">\n/);
  assert.match(last, /<\/noonsight-rules-change>\n\n<noonsight-rules model="claude-haiku-5-5">[^]*HAIKU-WORD/);
});

test('a resume\'s delivery is unconfirmed until the conversation answers: a resume right after it retires every model it may hold', () => {
  const custom = (word: string) => ({ use: 'custom', add: [{ id: `user/${word}`, file: `${word}.md` }] });
  const dir = tempTree({
    'noonsight.json': { version: 1, models: { 'claude-haiku-5-5': custom('haiku'), 'claude-sonnet-5-5': custom('sonnet'), 'claude-fable-5-2': custom('fable') } },
    'haiku.md': 'HAIKU-WORD',
    'sonnet.md': 'SONNET-WORD',
    'fable.md': 'FABLE-WORD',
  });
  const h = home(path.join(dir, 'noonsight.json'));
  // Sonnet, a turn, `claude --continue --model fable`, exit before any request, `claude --continue
  // --model haiku`, a turn: the first resume's return never reached a request, so the conversation still
  // holds Sonnet's rules with nothing retiring them, and the second resume's note must name Sonnet too (F3).
  h.hook('session-start', start('claude-sonnet-5-5', { session_id: 'f3' }));
  const answered = conversation(turn, reply('claude-sonnet-5-5', { timestamp: new Date().toISOString() }));
  const first = context(underClaude(h, ['--continue', '--model', 'fable'], resumeOf('f3', answered)));
  assert.match(first, /^<noonsight-rules-change from="claude-sonnet-5-5" to="claude-fable-5-2">[\s\S]*FABLE-WORD/);
  const second = context(underClaude(h, ['--continue', '--model', 'haiku'], resumeOf('f3', answered)));
  assert.match(second, /^<noonsight-rules-change from="claude-sonnet-5-5 claude-fable-5-2" to="claude-haiku-5-5">\n/);
  assert.match(second, /for claude-sonnet-5-5 and claude-fable-5-2 no longer apply\.\n<\/noonsight-rules-change>\n\n<noonsight-rules model="claude-haiku-5-5">[^]*HAIKU-WORD/);
  // The same resume once more, still with no response since: Haiku's rules may not have arrived either.
  assert.match(context(underClaude(h, ['--continue', '--model', 'haiku'], resumeOf('f3', answered))), /HAIKU-WORD/);
  // Haiku answered: the delivery arrived, its note retired the others, and nothing goes again.
  assert.equal(underClaude(h, ['--continue', '--model', 'haiku'], resumeOf('f3', answeredNow('claude-haiku-5-5'))).raw, '');
  // A response the transcript does not date confirms nothing.
  const resumedOnFable = context(underClaude(h, ['--continue', '--model', 'fable'], resumeOf('f3', answeredNow('claude-haiku-5-5'))));
  assert.match(resumedOnFable, /^<noonsight-rules-change from="claude-haiku-5-5" to="claude-fable-5-2">/);
  const undated = conversation(turn, reply('claude-fable-5-2'));
  assert.match(context(underClaude(h, ['--continue', '--model', 'fable'], resumeOf('f3', undated))), /^<noonsight-rules-change from="claude-haiku-5-5" to="claude-fable-5-2">[\s\S]*FABLE-WORD/);
  assert.deepEqual(
    h.log().map((l) => [l.model, l.from_model ?? null, l.delivered]),
    [
      ['claude-sonnet-5-5', null, 'rules'],
      ['claude-fable-5-2', 'claude-sonnet-5-5', 'rules+note'],
      ['claude-haiku-5-5', 'claude-fable-5-2', 'rules+note'],
      ['claude-haiku-5-5', null, 'rules+note'],
      ['claude-haiku-5-5', null, 'already-delivered'],
      ['claude-fable-5-2', 'claude-haiku-5-5', 'rules+note'],
      ['claude-fable-5-2', null, 'rules+note'],
    ],
  );
});

// A fork copies a conversation under a new session id (src/adapters/claude-code/fork.ts): `claude
// --continue --fork-session` and `claude --resume <id> --fork-session` in a new process, `/branch` in
// the same process, `/fork` as a background session. The inputs were recorded on Claude Code 2.1.330
// (test/fixtures/hook-inputs/2.1.330/README.md); the conversation the hook finds stands in for the
// fork's own record, which does not exist yet.

/** A configuration that gives Haiku, Sonnet and Fable one word each, and Sonnet one more on a code edit. */
function forkConfig(): string {
  const custom = (word: string, extra: object[] = []) => ({ use: 'custom', add: [{ id: `user/${word}`, file: `${word}.md` }, ...extra] });
  const dir = tempTree({
    'noonsight.json': {
      version: 1,
      models: {
        'claude-haiku-5-5': custom('haiku'),
        'claude-sonnet-5-5': custom('sonnet', [{ id: 'user/sonnet-code', file: 'sonnet-code.md', scopes: ['build'], triggers: ['code-edit'] }]),
        'claude-fable-5-2': custom('fable'),
      },
      scopes: { build: { description: 'Change the code.' } },
    },
    'haiku.md': 'HAIKU-WORD',
    'sonnet.md': 'SONNET-WORD',
    'sonnet-code.md': 'SONNET-CODE-WORD',
    'fable.md': 'FABLE-WORD',
  });
  return path.join(dir, 'noonsight.json');
}

const ORIGINAL = '2f6c1d8e-4b3a-4c2d-9e1f-0a1b2c3d4e5f';
/** A transcript folder with the original conversation, which last answered on `model`; the fork's own transcript is not written yet. */
function forkFolder(model: string, extra: Record<string, unknown>[] = []): { folder: string; fork: (name: string, fields?: Record<string, unknown>) => string } {
  const folder = tempTree({});
  fs.writeFileSync(path.join(folder, `${ORIGINAL}.jsonl`), [turn, reply(model, { timestamp: new Date().toISOString() })].map((r) => `${JSON.stringify(r)}\n`).join(''));
  for (const [i, r] of extra.entries()) fs.writeFileSync(path.join(folder, `other-${i}.jsonl`), `${JSON.stringify(r)}\n`);
  return {
    folder,
    fork: (name, fields = {}) => {
      const id = JSON.parse(hookInput(name)).session_id as string;
      return hookInput(name, { transcript_path: path.join(folder, `${id}.jsonl`), ...fields });
    },
  };
}

test('a fork from a new process runs on the copied conversation\'s last response, and retires what that conversation may hold', () => {
  const h = home(forkConfig());
  const opusSetting = { CLAUDE_CONFIG_DIR: tempTree({ 'settings.json': { model: 'opus' } }) };
  // Sonnet, a turn, /model haiku, exit before any request, `claude --continue --fork-session`: Claude
  // Code runs the fork on Sonnet, the model of the conversation's last response, and the switch's
  // delivery never reached the conversation, so Haiku's rules may be in it with nothing retiring them.
  h.hook('session-start', start('claude-sonnet-5-5', { session_id: ORIGINAL }));
  h.hook('model-switch', switchTo('claude-sonnet-5-5', 'claude-haiku-5-5', { session_id: ORIGINAL }));
  const { fork } = forkFolder('claude-sonnet-5-5');
  const forked = context(underClaude(h, ['--continue', '--fork-session'], fork('session-start-fork-session'), opusSetting));
  assert.match(forked, /^<noonsight-rules-change from="claude-haiku-5-5" to="claude-sonnet-5-5">\n/);
  assert.match(forked, /<noonsight-rules model="claude-sonnet-5-5">[\s\S]*SONNET-WORD/);
  // `claude --resume <id> --fork-session --model fable` names the original and the model.
  const named = context(underClaude(h, ['--resume', ORIGINAL, '--fork-session', '--model', 'fable'], fork('session-start-fork-session', { session_id: 'fork-two' })));
  assert.match(named, /^<noonsight-rules-change from="claude-sonnet-5-5 claude-haiku-5-5" to="claude-fable-5-2">\n/);
  assert.match(named, /FABLE-WORD/);
  assert.deepEqual(
    h.log().slice(2).map((l) => [l.source, l.model, l.model_source, l.fork_origin, l.forked_from, l.from_model ?? null, l.delivered]),
    [
      ['fork', 'claude-sonnet-5-5', 'session-transcript', 'continue', ORIGINAL, 'claude-haiku-5-5', 'rules+note'],
      ['fork', 'claude-fable-5-2', 'claude-args', 'resume-argument', ORIGINAL, 'claude-haiku-5-5', 'rules+note'],
    ],
  );
});

test('a fork of a conversation whose delivery arrived, on the same model, gets nothing again; on another model, a note', () => {
  const h = home(forkConfig());
  h.hook('session-start', start('claude-sonnet-5-5', { session_id: ORIGINAL }));
  // /branch: the fork's transcript holds the copied entries, which name the original.
  const { folder, fork } = forkFolder('claude-sonnet-5-5');
  const branchId = JSON.parse(hookInput('session-start-fork-branch')).session_id as string;
  fs.writeFileSync(path.join(folder, `${branchId}.jsonl`), `${JSON.stringify({ ...turn, forkedFrom: { sessionId: ORIGINAL, messageUuid: 'm1' } })}\n`);
  assert.equal(h.hook('session-start', fork('session-start-fork-branch', { model: 'claude-sonnet-5-5' })).raw, '');
  // The same /branch after /model haiku: the switch's delivery may be lost with the original's next request.
  h.hook('model-switch', switchTo('claude-sonnet-5-5', 'claude-haiku-5-5', { session_id: ORIGINAL }));
  fs.rmSync(path.join(h.dir, '.local', 'state', 'noonsight', 'sessions', `${branchId}.json`));
  const branched = context(h.hook('session-start', fork('session-start-fork-branch', { model: 'claude-haiku-5-5' })));
  assert.match(branched, /^<noonsight-rules-change from="claude-sonnet-5-5" to="claude-haiku-5-5">[\s\S]*HAIKU-WORD/);
  assert.deepEqual(
    h.log().map((l) => [l.event, l.fork_origin ?? null, l.forked_from ?? null, l.delivered]),
    [
      ['session-start', null, null, 'rules'],
      ['session-start', 'fork-transcript', ORIGINAL, 'already-delivered'],
      ['model-switch', null, null, 'rules+note'],
      ['session-start', 'fork-transcript', ORIGINAL, 'rules+note'],
    ],
  );
});

test('a /fork background session runs on the model its job was started with, and keeps the triggers the conversation revealed', () => {
  const h = home(forkConfig());
  h.hook('session-start', start('claude-sonnet-5-5', { session_id: ORIGINAL }));
  // The original revealed code-edit; Sonnet's code rule is in its conversation, and the fork copies it.
  const triggers = path.join(h.dir, '.local', 'state', 'noonsight', 'triggers');
  fs.mkdirSync(triggers, { recursive: true });
  fs.writeFileSync(path.join(triggers, `${ORIGINAL}.code-edit.json`), JSON.stringify({ trigger: 'code-edit', tool: 'Edit', file: 'src/app.ts', at: new Date().toISOString() }));
  const { fork } = forkFolder('claude-sonnet-5-5');
  const job = tempTree({ 'state.json': { forkParentSessionId: ORIGINAL, respawnFlags: ['--permission-mode', 'default', '--model', 'haiku'] } });
  const forked = context(underClaude(h, ['bg-spare', '--bg-spare', '/tmp/claim.sock'], fork('session-start-fork-background'), { CLAUDE_JOB_DIR: job }));
  assert.match(forked, /^<noonsight-rules-change from="claude-sonnet-5-5" to="claude-haiku-5-5">[\s\S]*HAIKU-WORD/);
  const forkId = JSON.parse(hookInput('session-start-fork-background')).session_id as string;
  assert.ok(fs.existsSync(path.join(triggers, `${forkId}.code-edit.json`)), 'the fork has revealed code-edit');
  // A /model sonnet in the fork then delivers Sonnet's code rule with the others.
  assert.match(context(h.hook('model-switch', switchTo('claude-haiku-5-5', 'claude-sonnet-5-5', { session_id: forkId }))), /SONNET-CODE-WORD/);
  assert.deepEqual(
    h.log().slice(1, 2).map((l) => [l.model, l.model_source, l.model_from, l.fork_origin, l.forked_from, l.triggers]),
    [['claude-haiku-5-5', 'claude-args', '--model of the background job', 'background-job', ORIGINAL, ['code-edit']]],
  );
});

test('a fork whose original cannot be found retires the rules of every model but its own', () => {
  const h = home(forkConfig());
  // A second conversation written last: `--continue` would pick it, but without --fork-session the
  // command line says nothing of a fork, so nothing names the original.
  const { fork } = forkFolder('claude-sonnet-5-5');
  const forked = context(underClaude(h, ['--model', 'haiku'], fork('session-start-fork-session')));
  assert.match(forked, /^<noonsight-rules-change from="\*" to="claude-haiku-5-5">\nThis session runs on claude-haiku-5-5\. The working rules noonsight delivered earlier in this conversation for every model other than claude-haiku-5-5 no longer apply\./);
  assert.match(forked, /HAIKU-WORD/);
  // Until the fork answers, its delivery may not have arrived, and a /model in it retires every model too.
  const forkId = JSON.parse(hookInput('session-start-fork-session')).session_id as string;
  assert.match(context(h.hook('model-switch', switchTo('claude-haiku-5-5', 'claude-fable-5-2', { session_id: forkId }))), /^<noonsight-rules-change from="\*" to="claude-fable-5-2">/);
  assert.deepEqual(
    h.log().map((l) => [l.event, l.fork_origin ?? null, l.forked_from ?? null, l.delivered]),
    [
      ['session-start', 'unknown', null, 'rules+note'],
      ['model-switch', null, null, 'rules+note'],
    ],
  );
});

// Plan mode on Haiku runs Sonnet: Claude Code switches by itself (`source: "auto"`) as plan mode
// starts and ends, and turns `/model haiku` typed in plan mode into Sonnet with `requested_model:
// "haiku"`; a compaction's start in plan mode still reports Haiku, and the requests keep running Sonnet
// (recorded on Claude Code 2.1.330, docs/verification/claude-code.md).

test('a compaction or /clear in plan mode on Haiku keeps Sonnet, the model Claude Code runs in its place', () => {
  const h = home(forkConfig());
  h.hook('session-start', start('claude-haiku-5-5'));
  assert.match(context(h.hook('model-switch', switchTo('claude-haiku-5-5', 'claude-sonnet-5-5', { source: 'auto', requested_model: null }))), /SONNET-WORD/);
  // /compact reports Haiku, while Sonnet still runs: Sonnet's rules go again, not Haiku's.
  const compacted = context(h.hook('session-start', hookInput('session-start-startup', { session_id: SESSION, source: 'compact', model: 'claude-haiku-5-5' })));
  assert.match(compacted, /^<noonsight-rules model="claude-sonnet-5-5">[\s\S]*SONNET-WORD/);
  assert.doesNotMatch(compacted, /HAIKU-WORD/);
  // /clear reports no model; the process still runs Sonnet.
  assert.match(context(h.hook('session-start', hookInput('session-start-clear', { session_id: 'cleared' }))), /SONNET-WORD/);
  // Plan mode ends: Claude Code switches back to Haiku by itself, and Haiku's rules go with a note.
  assert.match(context(h.hook('model-switch', switchTo('claude-sonnet-5-5', 'claude-haiku-5-5', { session_id: 'cleared', source: 'auto', requested_model: null }))), /^<noonsight-rules-change from="claude-sonnet-5-5" to="claude-haiku-5-5">[\s\S]*HAIKU-WORD/);
  // Back on the chosen model, a compaction's report decides again.
  assert.match(context(h.hook('session-start', hookInput('session-start-startup', { session_id: 'cleared', source: 'compact', model: 'claude-haiku-5-5' }))), /HAIKU-WORD/);
  assert.deepEqual(
    h.log().map((l) => [l.event, l.source, l.model, l.model_source, l.chosen_model ?? null, l.reported_model ?? null]),
    [
      ['session-start', 'startup', 'claude-haiku-5-5', 'hook-input', null, null],
      ['model-switch', 'auto', 'claude-sonnet-5-5', 'hook-input', 'claude-haiku-5-5', null],
      ['session-start', 'compact', 'claude-sonnet-5-5', 'process-record', 'claude-haiku-5-5', 'claude-haiku-5-5'],
      ['session-start', 'clear', 'claude-sonnet-5-5', 'process-record', 'claude-haiku-5-5', null],
      ['model-switch', 'auto', 'claude-haiku-5-5', 'hook-input', null, null],
      ['session-start', 'compact', 'claude-haiku-5-5', 'hook-input', null, null],
    ],
  );
});

test('/resume or /branch typed in plan mode on Haiku keeps Sonnet, which the process runs, though the start reports Haiku', () => {
  const h = home(forkConfig());
  // A Haiku conversation, /clear, plan mode in the new one: Claude Code runs Sonnet.
  h.hook('session-start', start('claude-haiku-5-5', { session_id: 'first' }));
  h.hook('session-start', hookInput('session-start-clear', { session_id: 'second' }));
  h.hook('model-switch', switchTo('claude-haiku-5-5', 'claude-sonnet-5-5', { session_id: 'second', source: 'auto', requested_model: null }));
  // /resume first, still in plan mode: the input reports Haiku, the process runs Sonnet.
  const resumed = context(h.hook('session-start', hookInput('session-start-resume-command', { session_id: 'first', model: 'claude-haiku-5-5' })));
  assert.match(resumed, /^<noonsight-rules-change from="claude-haiku-5-5" to="claude-sonnet-5-5">[\s\S]*SONNET-WORD/);
  // A resume in a new process reports no model and starts on the model it is given, whatever the last process ran.
  assert.match(context(underClaude(h, ['--continue', '--model', 'haiku'], resumeOf('first'))), /HAIKU-WORD/);
  assert.deepEqual(
    h.log().slice(3).map((l) => [l.source, l.model, l.model_source, l.chosen_model ?? null]),
    [
      ['resume', 'claude-sonnet-5-5', 'process-record', 'claude-haiku-5-5'],
      ['resume', 'claude-haiku-5-5', 'claude-args', null],
    ],
  );
});

test('/model haiku in plan mode on Sonnet, which no switch announces, keeps Sonnet through a compaction, /branch and /resume', () => {
  const compact = (model: string) => hookInput('session-start-startup', { session_id: SESSION, source: 'compact', model });
  const h = home(forkConfig());
  h.hook('session-start', start('claude-sonnet-5-5', { session_id: 'earlier' }));
  h.hook('session-start', start('claude-sonnet-5-5'));
  // The start reports Haiku, the chosen model, and no switch said that anything but Sonnet runs.
  const compacted = context(h.hook('session-start', compact('claude-haiku-5-5')));
  assert.match(compacted, /^<noonsight-rules model="claude-sonnet-5-5">[\s\S]*SONNET-WORD/);
  assert.doesNotMatch(compacted, /HAIKU-WORD/);
  assert.equal(h.hook('session-start', hookInput('session-start-resume-command', { session_id: 'earlier', model: 'claude-haiku-5-5' })).raw, '');
  // Plan mode ends: Claude Code switches to Haiku by itself, the chosen model from then on.
  assert.match(context(h.hook('model-switch', switchTo('claude-sonnet-5-5', 'claude-haiku-5-5', { source: 'auto', requested_model: null }))), /HAIKU-WORD/);
  assert.match(context(h.hook('session-start', compact('claude-haiku-5-5'))), /HAIKU-WORD/);
  assert.deepEqual(
    h.log().slice(2).map((l) => [l.event, l.source, l.model, l.model_source, l.chosen_model ?? null, l.reported_model ?? null]),
    [
      ['session-start', 'compact', 'claude-sonnet-5-5', 'process-record', 'claude-haiku-5-5', 'claude-haiku-5-5'],
      ['session-start', 'resume', 'claude-sonnet-5-5', 'process-record', 'claude-haiku-5-5', 'claude-haiku-5-5'],
      ['model-switch', 'auto', 'claude-haiku-5-5', 'hook-input', null, null],
      ['session-start', 'compact', 'claude-haiku-5-5', 'hook-input', null, null],
    ],
  );
  // No other pair: a start that reports another model than the record's is taken at its word.
  h.hook('session-start', start('claude-fable-5-2'));
  assert.match(context(h.hook('session-start', compact('claude-haiku-5-5'))), /HAIKU-WORD/);
});

test('a switch from Sonnet to Haiku with no chosen model recorded, as plan mode ends, leaves none', () => {
  const h = home(forkConfig());
  h.hook('session-start', start('claude-sonnet-5-5'));
  h.hook('model-switch', switchTo('claude-sonnet-5-5', 'claude-haiku-5-5', { source: 'auto', requested_model: null }));
  assert.equal(h.log().at(-1)?.chosen_model, undefined);
});

test('a switch under a refused configuration still says which model the process runs', () => {
  const file = forkConfig();
  const good = fs.readFileSync(file, 'utf8');
  const h = home(file);
  h.hook('session-start', start('claude-sonnet-5-5'));
  fs.writeFileSync(file, '{');
  h.hook('model-switch', switchTo('claude-sonnet-5-5', 'claude-haiku-5-5', { requested_model: 'haiku' }));
  fs.writeFileSync(file, good);
  // Haiku does run: the record of the process says so, and the report is taken at its word.
  assert.match(context(h.hook('session-start', hookInput('session-start-startup', { session_id: SESSION, source: 'compact', model: 'claude-haiku-5-5' }))), /HAIKU-WORD/);
});

test('/model haiku in plan mode, which Claude Code runs as Sonnet, keeps Sonnet through a compaction', () => {
  const h = home(forkConfig());
  h.hook('session-start', start('claude-fable-5-2'));
  assert.match(context(h.hook('model-switch', switchTo('claude-fable-5-2', 'claude-sonnet-5-5', { requested_model: 'haiku' }))), /SONNET-WORD/);
  assert.match(context(h.hook('session-start', hookInput('session-start-startup', { session_id: SESSION, source: 'compact', model: 'claude-haiku-5-5' }))), /SONNET-WORD/);
  // A /model whose request is the model it switched to chose that model: no substitution.
  h.hook('model-switch', switchTo('claude-sonnet-5-5', 'claude-fable-5-2', { requested_model: 'fable' }));
  assert.match(context(h.hook('session-start', hookInput('session-start-startup', { session_id: SESSION, source: 'compact', model: 'claude-fable-5-2' }))), /FABLE-WORD/);
  assert.deepEqual(
    h.log().map((l) => [l.model, l.chosen_model ?? null]),
    [
      ['claude-fable-5-2', null],
      ['claude-sonnet-5-5', 'claude-haiku-5-5'],
      ['claude-sonnet-5-5', 'claude-haiku-5-5'],
      ['claude-fable-5-2', null],
      ['claude-fable-5-2', null],
    ],
  );
});

// Claude Code leaves out a SessionStart context identical to one an earlier SessionStart added to the
// same conversation (recorded on 2.1.330, docs/verification/claude-code.md): Sonnet, /model opus with no
// rules for Opus (a note alone), then `claude --continue --model sonnet` delivered Sonnet's rules again,
// the very text of the startup, and the request held them only before the note that retired them (F9).

test('a resume\'s or a fork\'s delivery carries its time, so it never repeats an earlier start\'s text', () => {
  const h = home(forkConfig());
  const first = h.hook('session-start', start('claude-sonnet-5-5', { session_id: ORIGINAL })).out?.hookSpecificOutput.additionalContext as string;
  assert.doesNotMatch(first, / at="/, 'a startup is a new conversation');
  const raw = (r: { out: Record<string, any> | null }): string => r.out?.hookSpecificOutput?.additionalContext ?? '';
  assert.doesNotMatch(raw(h.hook('model-switch', switchTo('claude-sonnet-5-5', 'claude-haiku-5-5', { session_id: ORIGINAL }))), / at="/, 'a switch is not compared');
  const resumed = raw(underClaude(h, ['--continue', '--model', 'sonnet'], resumeOf(ORIGINAL)));
  assert.match(resumed, /^<noonsight-rules-change from="claude-haiku-5-5" to="claude-sonnet-5-5" at="\d{4}-\d\d-\d\dT[\d:.]+Z">\n/);
  assert.match(resumed, /<noonsight-rules model="claude-sonnet-5-5" at="[^"]+">\n[\s\S]*SONNET-WORD/);
  assert.notEqual(resumed.replace(/^[\s\S]*?(?=<noonsight-rules model)/, ''), first, 'the rules differ from the startup\'s by their time');
  const { fork } = forkFolder('claude-sonnet-5-5');
  assert.match(raw(underClaude(h, ['--model', 'haiku'], fork('session-start-fork-session'))), /<noonsight-rules model="claude-haiku-5-5" at="/);
});

test('a note that names more retired models than fit its room retires every model but the session\'s own', () => {
  const name = (c: string) => `claude-${c.repeat(30)}-5-5`;
  const models = ['a', 'b', 'c', 'd'].map(name);
  const dir = tempTree({
    'noonsight.json': { version: 1, models: Object.fromEntries(models.map((m, i) => [m, { use: 'custom', add: [{ id: `user/r${i}`, file: 'r.md' }] }])) },
    'r.md': 'WORD',
  });
  const h = home(path.join(dir, 'noonsight.json'));
  h.hook('session-start', start(models[0] as string));
  for (let i = 1; i < models.length; i++) h.hook('model-switch', switchTo(models[i - 1] as string, models[i] as string));
  const text = context(h.hook('model-switch', switchTo(models[3] as string, models[0] as string)));
  assert.match(text, /^<noonsight-rules-change from="\*" to="claude-a+-5-5">\n[^]*for every model other than claude-a+-5-5 no longer apply\./);
});

test('a command line read without argument boundaries, as on macOS, reports a --model it cannot read instead of falling through', () => {
  const joined = (line: string) => modelArgument({ args: line.split(' '), exact: false }, {});
  assert.equal(joined('claude -p hello'), null);
  assert.deepEqual(joined('claude -p hi --model claude-opus-5-5'), { kind: 'found', model: 'claude-opus-5-5', source: 'claude-args', from: '--model' });
  // A custom model identifier, as behind a gateway, cannot be told from prompt text; a lower source must not decide.
  assert.deepEqual(joined('claude -p --model my-gateway-opus hi')?.kind, 'unresolved');
  // A prompt that mentions --model warns rather than letting ANTHROPIC_MODEL or a settings file decide.
  assert.equal(joined('claude -p explain --model flags')?.kind, 'unresolved');
  assert.equal(joined('claude -p use --model haiku --model claude-opus-5-5')?.kind, 'unresolved');
  const exact = modelArgument({ args: ['claude', '-p', 'use --model haiku', '--model', 'sonnet'], exact: true }, {});
  assert.equal(exact?.kind === 'found' && exact.model, 'claude-sonnet-5-5');
});

test('claude -p: a --model naming a custom model identifier decides, so a lower settings file never delivers its model\'s rules', () => {
  const h = home();
  const env = { CLAUDE_CONFIG_DIR: tempTree({ 'settings.json': { model: 'haiku' } }), ANTHROPIC_MODEL: 'claude-sonnet-5-5' };
  const r = underClaude(h, ['-p', '--model', 'my-gateway-opus', 'hello'], print('gateway'), env);
  assert.doesNotMatch(context(r), /HAIKU-GEN-9047|SONNET-GEN-3306/);
  assert.deepEqual(h.log().map((l) => [l.model_from ?? null, l.delivered]), [['--model', 'nothing']]);
});

test('a command line without argument boundaries: a --setting-sources value that is no list of settings files warns instead of skipping every file', () => {
  const h = home();
  const env = { CLAUDE_CONFIG_DIR: tempTree({ 'settings.json': { model: 'claude-haiku-5-5' } }) };
  const r = underClaude(h, ['-p', 'what does --setting-sources do'], print('sources-prompt'), env);
  if (process.platform === 'darwin') {
    assert.match(r.out?.systemMessage, /set to "do" \(--setting-sources\)/);
    assert.deepEqual(h.log().map((l) => [l.model_from ?? null, l.delivered]), [['--setting-sources', 'nothing']]);
  } else {
    assert.match(context(r), /HAIKU-GEN-9047/);
  }
});

test('an option given more than one value on a command line without argument boundaries has every value as a candidate', () => {
  assert.deepEqual(optionCandidates({ args: 'claude -p read --settings foo --settings /tmp/s.json'.split(' '), exact: false }, '--settings'), ['foo', '/tmp/s.json']);
  assert.deepEqual(optionCandidates({ args: ['claude', '-p', 'read --settings foo', '--settings', '/tmp/s.json'], exact: true }, '--settings'), ['/tmp/s.json']);
  assert.deepEqual(optionCandidates({ args: 'claude -p hello'.split(' '), exact: false }, '--settings'), []);
});

/** The lab configuration with matchers on two scopes, and sessions marked unattended by CI. */
function scopedConfig(): string {
  const lab = JSON.parse(fs.readFileSync(LAB_CONFIG, 'utf8')) as Record<string, any>;
  const dir = tempTree({
    'noonsight.json': {
      ...lab,
      scopes: { ...lab.scopes, investigate: { match: ['\\binvestigat'] }, summarize: { match: ['\\bsummar'] } },
      session: { unattended_when_env: ['CI'] },
    },
  });
  fs.cpSync(path.join(path.dirname(LAB_CONFIG), 'rules'), path.join(dir, 'rules'), { recursive: true });
  return path.join(dir, 'noonsight.json');
}

test('NOONSIGHT_SCOPE gives the session the rules of that scope, and the log says where the scope came from', () => {
  const h = home(scopedConfig());
  const context = (env: Record<string, string>, model = 'claude-sonnet-5-5'): string =>
    h.hook('session-start', start(model, { session_id: `s-${Object.values(env).join('-')}-${model}` }), env).out?.hookSpecificOutput.additionalContext ?? '';
  const investigate = context({ NOONSIGHT_SCOPE: 'investigate' });
  assert.match(investigate, /^<noonsight-rules model="claude-sonnet-5-5" scope="investigate">\n/);
  assert.match(investigate, /SONNET-GEN-3306[\s\S]*SONNET-INV-5182/);
  const summarize = context({ NOONSIGHT_SCOPE: 'summarize' }, 'claude-haiku-5-5');
  assert.match(summarize, /HAIKU-SUM-6610/);
  assert.doesNotMatch(context({ NOONSIGHT_SCOPE: 'investigate' }, 'claude-haiku-5-5'), /HAIKU-SUM-6610/);
  assert.doesNotMatch(context({}), /SONNET-INV-5182/);

  assert.deepEqual(
    h.log().map((l) => [l.model, l.scope, l.scope_source, l.place, l.unknown_scope ?? null]),
    [
      ['claude-sonnet-5-5', 'investigate', 'env', 'attended', null],
      ['claude-haiku-5-5', 'summarize', 'env', 'attended', null],
      ['claude-haiku-5-5', 'investigate', 'env', 'attended', null],
      ['claude-sonnet-5-5', null, null, 'attended', null],
    ],
  );
});

test('an undeclared NOONSIGHT_SCOPE gets the rules for every scope, with no warning, and the log names it', () => {
  const h = home(scopedConfig());
  const r = h.hook('session-start', start('claude-sonnet-5-5'), { NOONSIGHT_SCOPE: 'release' });
  assert.deepEqual(Object.keys(r.out ?? {}), ['hookSpecificOutput'], 'no systemMessage');
  assert.match(r.out?.hookSpecificOutput.additionalContext, /^<noonsight-rules model="claude-sonnet-5-5">\n/);
  assert.deepEqual(h.log().map((l) => [l.scope, l.unknown_scope, l.scope_source, l.warned]), [[null, 'release', 'env', false]]);
});

test('a variable of session.unattended_when_env puts the session in the place unattended, for startup and /model alike', () => {
  const h = home(scopedConfig());
  const r = h.hook('session-start', start('claude-haiku-5-5', { session_id: SESSION }), { CI: 'true' });
  assert.match(r.out?.hookSpecificOutput.additionalContext, /HAIKU-GEN-9047/);
  const switched = h.hook('model-switch', switchTo('claude-haiku-5-5', 'claude-sonnet-5-5'), { CI: 'true', NOONSIGHT_SCOPE: 'investigate' });
  const text: string = switched.out?.hookSpecificOutput.additionalContext;
  assert.match(text, /SONNET-CARRY-4471/, 'the rule for unattended sessions is delivered');
  assert.match(text, /SONNET-INV-5182/);
  assert.match(text, /^<noonsight-rules-change from="claude-haiku-5-5" to="claude-sonnet-5-5">/);
  assert.doesNotMatch(h.hook('session-start', start('claude-sonnet-5-5', { session_id: 'attended' }), { CI: '' }).out?.hookSpecificOutput.additionalContext, /SONNET-CARRY-4471/);
  assert.deepEqual(
    h.log().map((l) => [l.event, l.place, l.unattended_because ?? null, l.unattended_env ?? null, l.scope]),
    [
      ['session-start', 'unattended', 'env', 'CI', null],
      ['model-switch', 'unattended', 'env', 'CI', 'investigate'],
      ['session-start', 'attended', null, null, null],
    ],
  );
});

test('a headless run, which Claude Code marks with CLAUDE_CODE_SESSION_ATTENDED=0, is unattended by default, and the log says why', () => {
  const h = home(scopedConfig());
  const headless = { CLAUDE_CODE_SESSION_ATTENDED: '0' };
  const begun = h.hook('session-start', hookInput('session-start-print', { session_id: 'headless', model: 'claude-sonnet-5-5' }), headless);
  assert.match(begun.out?.hookSpecificOutput.additionalContext, /SONNET-CARRY-4471/, 'the rule for unattended sessions is delivered');
  const switched = h.hook('model-switch', switchTo('claude-sonnet-5-5', 'claude-haiku-5-5', { session_id: 'headless' }), headless);
  assert.match(switched.out?.hookSpecificOutput.additionalContext, /HAIKU-GEN-9047/);
  const watched = h.hook('session-start', start('claude-sonnet-5-5', { session_id: 'watched' }), { CLAUDE_CODE_SESSION_ATTENDED: '1' });
  assert.doesNotMatch(watched.out?.hookSpecificOutput.additionalContext, /SONNET-CARRY-4471/);
  // A variable of session.unattended_when_env is named over the headless run.
  h.hook('session-start', start('claude-sonnet-5-5', { session_id: 'both' }), { ...headless, CI: '1' });
  assert.deepEqual(
    h.log().map((l) => [l.event, l.place, l.unattended_because ?? null, l.unattended_env ?? null]),
    [
      ['session-start', 'unattended', 'headless', null],
      ['model-switch', 'unattended', 'headless', null],
      ['session-start', 'attended', null, null],
      ['session-start', 'unattended', 'env', 'CI'],
    ],
  );
});

test('session.headless_is_unattended false leaves a headless run in the place attended', () => {
  const file = scopedConfig();
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, any>;
  fs.writeFileSync(file, JSON.stringify({ ...raw, session: { ...raw.session, headless_is_unattended: false } }));
  const h = home(file);
  const r = h.hook('session-start', hookInput('session-start-print', { model: 'claude-sonnet-5-5' }), { CLAUDE_CODE_SESSION_ATTENDED: '0' });
  assert.doesNotMatch(r.out?.hookSpecificOutput.additionalContext, /SONNET-CARRY-4471/);
  assert.deepEqual(h.log().map((l) => [l.place, l.unattended_because ?? null]), [['attended', null]]);
});

test('a resumed session whose scope changed gets the rules of the new scope', () => {
  const h = home(scopedConfig());
  h.hook('session-start', start('claude-sonnet-5-5'));
  assert.equal(h.hook('session-start', start('claude-sonnet-5-5', { source: 'resume' })).raw, '');
  assert.match(h.hook('session-start', start('claude-sonnet-5-5', { source: 'resume' }), { NOONSIGHT_SCOPE: 'investigate' }).out?.hookSpecificOutput.additionalContext, /SONNET-INV-5182/);
});
