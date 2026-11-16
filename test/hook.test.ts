// The SessionStart and PostModelSwitch hook adapter, driven as Claude Code drives it: a separate
// process that gets the hook input on stdin. Each test has its own home directory, so the decision
// log and the session records start empty.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { modelArgument, optionCandidates } from '../src/adapters/claude-code/launch.js';
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

test('the longest rules a configuration may hold, plus the model-change note, fit in the 10,000 characters Claude Code keeps', () => {
  const from = `claude-${'f'.repeat(120)}-5-5`;
  const to = `claude-${'t'.repeat(120)}-5-5`;
  const withRule = (length: number): Home => {
    const custom = (file: string) => ({ use: 'custom', add: [{ id: `user/${file}`, file }] });
    const dir = tempTree({ 'sextant.json': { version: 1, models: { [from]: custom('from.md'), [to]: custom('to.md') } }, 'from.md': 'FROM', 'to.md': 'x'.repeat(length) });
    return home(path.join(dir, 'sextant.json'));
  };
  const overhead = (withRule(1).hook('session-start', start(to)).out?.hookSpecificOutput.additionalContext as string).length - 1;
  const longest = RULES_TEXT_LIMIT - overhead;
  const over = withRule(longest + 1);
  over.hook('session-start', start(to));
  assert.equal(over.log()[0]?.status, 'config-invalid', 'one character more is refused');

  const h = withRule(longest);
  assert.match(h.hook('session-start', start(from)).out?.hookSpecificOutput.additionalContext, /FROM/);
  const text: string = h.hook('model-switch', switchTo(from, to)).out?.hookSpecificOutput.additionalContext;
  assert.match(text, /^<sextant-rules-change [^]*<\/sextant-rules-change>\n\n<sextant-rules model="claude-t+-5-5">[^]*x{100}/);
  assert.ok(text.length <= 10000, String(text.length));
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

// claude -p: the SessionStart input names no model (recorded in session-start-print.json), so the hook
// takes it from what the session was started with. Each run below is the child of a stand-in for the
// claude process, started with the claude arguments the test gives.

const FAKE_CLAUDE = path.join(FIXTURES, 'fake-claude.cjs');
const print = (id: string): string => hookInput('session-start-print', { session_id: id });
const context = (r: { out: Record<string, any> | null }): string => r.out?.hookSpecificOutput?.additionalContext ?? '';

function underClaude(h: Home, claudeArgs: readonly string[], input: string, extra: Record<string, string> = {}) {
  const hook = [process.execPath, ...NO_NETWORK, CLI, 'hook', 'session-start'];
  const r = runProgram(process.execPath, [FAKE_CLAUDE, ...claudeArgs], { ...h.env, ...extra, SEXTANT_FAKE_HOOK: JSON.stringify(hook) }, input);
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

test('claude -p: a model setting sextant cannot pin down warns with what was set and where, and delivers nothing', () => {
  const h = home();
  const plan = underClaude(h, ['-p', '--model', 'opusplan', 'hello'], print('plan'));
  assert.match(plan.out?.systemMessage, /model is set to "opusplan" \(--model\), and sextant cannot tell which model that is \(Claude Code chooses that model while the session runs\)/);
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

test('a reported model, or the record of the session, always outranks the launch settings', () => {
  const h = home();
  const r = underClaude(h, ['-p', '--model', 'claude-haiku-5-5'], start('claude-sonnet-5-5', { session_id: 'reported' }));
  assert.match(context(r), /SONNET-GEN-3306/);
  assert.equal(underClaude(h, ['-p', '--model', 'claude-haiku-5-5'], start(null, { session_id: 'reported', source: 'resume' })).raw, '');
  assert.deepEqual(h.log().map((l) => [l.model, l.model_source, l.delivered]), [
    ['claude-sonnet-5-5', 'hook-input', 'rules'],
    ['claude-sonnet-5-5', 'session-record', 'already-delivered'],
  ]);
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
    'sextant.json': {
      ...lab,
      scopes: { ...lab.scopes, investigate: { match: ['\\binvestigat'] }, summarize: { match: ['\\bsummar'] } },
      session: { unattended_when_env: ['CI'] },
    },
  });
  fs.cpSync(path.join(path.dirname(LAB_CONFIG), 'rules'), path.join(dir, 'rules'), { recursive: true });
  return path.join(dir, 'sextant.json');
}

test('SEXTANT_SCOPE gives the session the rules of that scope, and the log says where the scope came from', () => {
  const h = home(scopedConfig());
  const context = (env: Record<string, string>, model = 'claude-sonnet-5-5'): string =>
    h.hook('session-start', start(model, { session_id: `s-${Object.values(env).join('-')}-${model}` }), env).out?.hookSpecificOutput.additionalContext ?? '';
  const investigate = context({ SEXTANT_SCOPE: 'investigate' });
  assert.match(investigate, /^<sextant-rules model="claude-sonnet-5-5" scope="investigate">\n/);
  assert.match(investigate, /SONNET-GEN-3306[\s\S]*SONNET-INV-5182/);
  const summarize = context({ SEXTANT_SCOPE: 'summarize' }, 'claude-haiku-5-5');
  assert.match(summarize, /HAIKU-SUM-6610/);
  assert.doesNotMatch(context({ SEXTANT_SCOPE: 'investigate' }, 'claude-haiku-5-5'), /HAIKU-SUM-6610/);
  assert.doesNotMatch(context({}), /SONNET-INV-5182/);

  assert.deepEqual(
    h.log().map((l) => [l.model, l.scope, l.scope_source, l.place, l.unknown_scope ?? null]),
    [
      ['claude-sonnet-5-5', 'investigate', 'env', 'session', null],
      ['claude-haiku-5-5', 'summarize', 'env', 'session', null],
      ['claude-haiku-5-5', 'investigate', 'env', 'session', null],
      ['claude-sonnet-5-5', null, null, 'session', null],
    ],
  );
});

test('an undeclared SEXTANT_SCOPE gets the rules for every scope, with no warning, and the log names it', () => {
  const h = home(scopedConfig());
  const r = h.hook('session-start', start('claude-sonnet-5-5'), { SEXTANT_SCOPE: 'release' });
  assert.deepEqual(Object.keys(r.out ?? {}), ['hookSpecificOutput'], 'no systemMessage');
  assert.match(r.out?.hookSpecificOutput.additionalContext, /^<sextant-rules model="claude-sonnet-5-5">\n/);
  assert.deepEqual(h.log().map((l) => [l.scope, l.unknown_scope, l.scope_source, l.warned]), [[null, 'release', 'env', false]]);
});

test('a variable of session.unattended_when_env puts the session in the place unattended, for startup and /model alike', () => {
  const h = home(scopedConfig());
  const r = h.hook('session-start', start('claude-haiku-5-5', { session_id: SESSION }), { CI: 'true' });
  assert.match(r.out?.hookSpecificOutput.additionalContext, /HAIKU-GEN-9047/);
  const switched = h.hook('model-switch', switchTo('claude-haiku-5-5', 'claude-sonnet-5-5'), { CI: 'true', SEXTANT_SCOPE: 'investigate' });
  const text: string = switched.out?.hookSpecificOutput.additionalContext;
  assert.match(text, /SONNET-CARRY-4471/, 'the rule for unattended sessions is delivered');
  assert.match(text, /SONNET-INV-5182/);
  assert.match(text, /^<sextant-rules-change from="claude-haiku-5-5" to="claude-sonnet-5-5">/);
  assert.doesNotMatch(h.hook('session-start', start('claude-sonnet-5-5', { session_id: 'attended' }), { CI: '' }).out?.hookSpecificOutput.additionalContext, /SONNET-CARRY-4471/);
  assert.deepEqual(
    h.log().map((l) => [l.event, l.place, l.unattended_env ?? null, l.scope]),
    [
      ['session-start', 'unattended', 'CI', null],
      ['model-switch', 'unattended', 'CI', 'investigate'],
      ['session-start', 'session', null, null],
    ],
  );
});

test('a resumed session whose scope changed gets the rules of the new scope', () => {
  const h = home(scopedConfig());
  h.hook('session-start', start('claude-sonnet-5-5'));
  assert.equal(h.hook('session-start', start('claude-sonnet-5-5', { source: 'resume' })).raw, '');
  assert.match(h.hook('session-start', start('claude-sonnet-5-5', { source: 'resume' }), { SEXTANT_SCOPE: 'investigate' }).out?.hookSpecificOutput.additionalContext, /SONNET-INV-5182/);
});
