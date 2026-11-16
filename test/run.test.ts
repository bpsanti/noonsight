// The launcher, `sextant run`, driven as a person runs it, with a stand-in `claude` first on PATH. The
// stand-in records the arguments and environment it was started with and, when a test asks, runs the
// SessionStart hook as its child, so the hook reads the stand-in's command line as it reads Claude
// Code's. Each test has its own home directory, so the decision log and the state start empty.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { withoutOption } from '../src/adapters/claude-code/launcher.js';
import { loadConfig } from '../src/config/load.js';
import { resolve } from '../src/core/resolve.js';
import { CLI, hookHome, hookInput, LAB_CONFIG, LAB_PRESETS, NO_NETWORK, runCli, tempTree, type HookHome } from './helpers.js';

interface Started {
  readonly args: string[];
  readonly env: Record<string, string | null>;
}

interface Lab {
  readonly h: HookHome;
  readonly bin: string;
  readonly record: string;
  run(args: readonly string[], extra?: Record<string, string>): { status: number | null; stdout: string; stderr: string; started: Started | null };
}

/** A home, and a stand-in claude on PATH. */
function lab(config: string = LAB_CONFIG): Lab {
  const h = hookHome(config);
  const bin = tempTree({});
  const record = path.join(bin, 'started.json');
  fs.writeFileSync(
    path.join(bin, 'claude'),
    `#!${process.execPath}
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const pick = (n) => process.env[n] ?? null;
fs.writeFileSync(${JSON.stringify(record)}, JSON.stringify({
  args: process.argv.slice(2),
  env: { SEXTANT_LAUNCH_FILE: pick('SEXTANT_LAUNCH_FILE'), SEXTANT_SCOPE: pick('SEXTANT_SCOPE'), ANTHROPIC_MODEL: pick('ANTHROPIC_MODEL') },
}));
if (process.env.FAKE_HOOK_INPUT) {
  const r = spawnSync(process.execPath, ${JSON.stringify([...NO_NETWORK, CLI, 'hook', 'session-start'])}, { input: process.env.FAKE_HOOK_INPUT, encoding: 'utf8', env: process.env });
  process.stdout.write(r.stdout);
  process.stderr.write(r.stderr);
}
process.exit(Number(process.env.FAKE_EXIT || 0));
`,
    { mode: 0o755 },
  );
  return {
    h,
    bin,
    record,
    run(args, extra = {}) {
      fs.rmSync(record, { force: true });
      const r = runCli(['run', ...args], { ...h.env, PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}`, ...extra }, NO_NETWORK);
      const started = fs.existsSync(record) ? (JSON.parse(fs.readFileSync(record, 'utf8')) as Started) : null;
      return { ...r, started };
    },
  };
}

const config = () => loadConfig(LAB_CONFIG, {}, { SEXTANT_PRESETS_DIR: LAB_PRESETS });
const rulesFor = (model: string, scope: string | null = null): string => {
  const d = resolve(config(), { model, scope, place: 'session' });
  assert.equal(d.status, 'matched');
  return d.status === 'matched' ? d.text : '';
};
const launches = (h: HookHome) => h.log().filter((l) => l.event === 'launch');
const fileArg = (s: Started | null): string => {
  assert.ok(s);
  assert.equal(s.args[0], '--append-system-prompt-file');
  return s.args[1] ?? '';
};

test('launcher route: an explicit --model gets its rules in the system prompt file, and every other argument passes unchanged', () => {
  const l = lab();
  const r = l.run(['--scope', 'investigate', '--', '--model', 'claude-sonnet-5-5', '-p', 'Find the cause'], { FAKE_EXIT: '3' });
  assert.equal(r.status, 3, 'claude exit status');
  assert.equal(r.stderr, '');
  const file = fileArg(r.started);
  assert.deepEqual(r.started?.args.slice(2), ['--model', 'claude-sonnet-5-5', '-p', 'Find the cause']);
  assert.equal(fs.readFileSync(file, 'utf8'), `${rulesFor('claude-sonnet-5-5', 'investigate')}\n`);
  assert.match(fs.readFileSync(file, 'utf8'), /SONNET-INV-5182/);
  assert.equal(path.dirname(file), path.join(l.h.dir, '.local', 'state', 'sextant', 'launch'));
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.deepEqual(r.started?.env, { SEXTANT_LAUNCH_FILE: file, SEXTANT_SCOPE: 'investigate', ANTHROPIC_MODEL: null });
  assert.deepEqual(
    launches(l.h).map((d) => [d.model, d.model_source, d.model_from, d.status, d.scope, d.scope_source, d.place, d.delivered, d.launch_file]),
    [['claude-sonnet-5-5', 'claude-args', '--model', 'matched', 'investigate', 'env', 'session', 'system-prompt', file]],
  );
});

test('launcher: the model is taken the way Claude Code takes it: an alias, --model=, then ANTHROPIC_MODEL', () => {
  const l = lab();
  const alias = l.run(['--model=haiku', '-p', 'hi']);
  assert.match(fs.readFileSync(fileArg(alias.started), 'utf8'), /HAIKU-GEN-9047/);
  assert.deepEqual(alias.started?.args.slice(2), ['--model=haiku', '-p', 'hi']);
  const env = l.run(['-p', 'hi'], { ANTHROPIC_MODEL: 'claude-sonnet-5-5' });
  assert.match(fs.readFileSync(fileArg(env.started), 'utf8'), /SONNET-GEN-3306/);
  assert.deepEqual(
    launches(l.h).map((d) => [d.model, d.model_source, d.model_from, d.model_alias ?? null]),
    [
      ['claude-haiku-5-5', 'claude-args', '--model', 'haiku'],
      ['claude-sonnet-5-5', 'env', 'ANTHROPIC_MODEL', null],
    ],
  );
});

test('launcher: an --append-system-prompt from someone else stays as it is, next to the rules file', () => {
  const l = lab();
  const r = l.run(['--model', 'sonnet', '--append-system-prompt', 'Their own text.', '-p', 'hi']);
  const file = fileArg(r.started);
  assert.deepEqual(r.started?.args.slice(2), ['--model', 'sonnet', '--append-system-prompt', 'Their own text.', '-p', 'hi']);
  assert.equal(fs.readFileSync(file, 'utf8'), `${rulesFor('claude-sonnet-5-5')}\n`);
});

test('launcher: an --append-system-prompt-file from someone else is merged ahead of the rules, since Claude Code keeps only the last one', () => {
  const l = lab();
  const theirs = path.join(tempTree({ 'theirs.md': 'Their file text.\n\n' }), 'theirs.md');
  const r = l.run(['--model', 'sonnet', `--append-system-prompt-file=${theirs}`, '-p', 'hi']);
  const file = fileArg(r.started);
  assert.deepEqual(r.started?.args.slice(2), ['--model', 'sonnet', '-p', 'hi']);
  assert.equal(fs.readFileSync(file, 'utf8'), `Their file text.\n\n${rulesFor('claude-sonnet-5-5')}\n`);
  assert.equal(launches(l.h)[0]?.merged_file, theirs);

  // One that cannot be read is left to Claude Code, and the launcher adds nothing.
  const missing = l.run(['--model', 'sonnet', '--append-system-prompt-file', '/nonexistent/theirs.md', '-p', 'hi']);
  assert.deepEqual(missing.started?.args, ['--model', 'sonnet', '--append-system-prompt-file', '/nonexistent/theirs.md', '-p', 'hi']);
  assert.match(missing.stderr, /could not read \/nonexistent\/theirs\.md, given to --append-system-prompt-file \(ENOENT\)/);
  assert.equal(launches(l.h)[1]?.delivered, 'nothing');
});

test('launcher: with no rules to add, claude starts with its arguments unchanged', () => {
  const l = lab();
  // Nothing names a model: the hooks decide from what Claude Code reports. An outer launch's file is not passed on.
  const none = l.run(['-p', 'hi'], { SEXTANT_LAUNCH_FILE: '/outer/launch.md' });
  assert.deepEqual(none.started, { args: ['-p', 'hi'], env: { SEXTANT_LAUNCH_FILE: null, SEXTANT_SCOPE: null, ANTHROPIC_MODEL: null } });
  assert.equal(none.stderr, '');
  // A model declared with no rules.
  const opus = l.run(['--model', 'claude-opus-5-5', '-p', 'hi']);
  assert.deepEqual(opus.started?.args, ['--model', 'claude-opus-5-5', '-p', 'hi']);
  // An undeclared model warns.
  const fable = l.run(['--model', 'claude-fable-5-2', '-p', 'hi']);
  assert.deepEqual(fable.started?.args, ['--model', 'claude-fable-5-2', '-p', 'hi']);
  assert.match(fable.stderr, /claude-fable-5-2 is not declared in .*, so sextant run added no rules/);
  assert.deepEqual(
    launches(l.h).map((d) => [d.model, d.status, d.delivered, d.warned]),
    [
      [null, 'undeclared', 'nothing', false],
      ['claude-opus-5-5', 'none', 'nothing', false],
      ['claude-fable-5-2', 'undeclared', 'nothing', true],
    ],
  );
});

test('launcher: a missing or refused configuration, or SEXTANT_DISABLE, still starts claude, unchanged', () => {
  const missing = lab(path.join(tempTree({}), 'none.json'));
  const r = missing.run(['--model', 'sonnet', '-p', 'hi'], { SEXTANT_CONFIG: '' });
  assert.deepEqual(r.started?.args, ['--model', 'sonnet', '-p', 'hi']);
  assert.match(r.stderr, /there is no configuration at .*sextant\.json, so sextant run added no rules/);

  const refused = lab(path.join(tempTree({ 'sextant.json': { version: 1, models: { x: { use: 'nope' } } } }), 'sextant.json'));
  const bad = refused.run(['--model', 'sonnet', '-p', 'hi']);
  assert.deepEqual(bad.started?.args, ['--model', 'sonnet', '-p', 'hi']);
  assert.match(bad.stderr, /was refused \(\d+ problems?\), so sextant run added no rules/);
  assert.equal(launches(refused.h)[0]?.status, 'config-invalid');

  const off = lab();
  const disabled = off.run(['--scope', 'investigate', '--model', 'sonnet', '-p', 'hi'], { SEXTANT_DISABLE: '1' });
  assert.deepEqual(disabled.started?.args, ['--model', 'sonnet', '-p', 'hi']);
  assert.deepEqual(off.h.log(), []);
});

test('launcher: its own options come first; everything from the first other argument, or after --, is claude\'s', () => {
  const l = lab();
  assert.deepEqual(l.run(['--', '--help']).started?.args, ['--help']);
  assert.deepEqual(l.run(['-p', '--scope', 'x']).started?.args, ['-p', '--scope', 'x']);
  assert.equal(l.run(['--scope=investigate', '-p', 'hi']).started?.env.SEXTANT_SCOPE, 'investigate');
  const help = l.run(['--help']);
  assert.equal(help.status, 0);
  assert.equal(help.started, null);
  assert.match(help.stdout, /^usage: sextant run/);
  const usage = l.run(['--scope']);
  assert.equal(usage.status, 2);
  assert.match(usage.stderr, /--scope needs a value/);
  const noClaude = runCli(['run', '-p', 'hi'], { ...l.h.env, PATH: tempTree({}) });
  assert.equal(noClaude.status, 127);
  assert.match(noClaude.stderr, /could not start claude/);
});

// The hook and the launcher together: the rules reach the session once.

const printStart = (id: string): string => hookInput('session-start-print', { session_id: id });

test('launcher route with the hook: in -p mode the hook finds the rules in the system prompt and does not deliver them again', () => {
  const l = lab();
  const r = l.run(['--scope', 'investigate', '--model', 'sonnet', '-p', 'hi'], { FAKE_HOOK_INPUT: printStart('launched') });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '', 'no hook context');
  assert.equal(r.stderr, '');
  const file = fileArg(r.started);
  const [launch, start] = l.h.log();
  assert.equal(launch?.event, 'launch');
  assert.equal(start?.event, 'session-start');
  assert.deepEqual(
    [start?.model, start?.model_source, start?.scope, start?.status, start?.sha256, start?.delivered, start?.launch_file, start?.launch_model],
    ['claude-sonnet-5-5', 'claude-args', 'investigate', 'matched', launch?.sha256, 'launcher', file, 'claude-sonnet-5-5'],
  );
});

test('launcher route with the hook: an interactive start that reports the model, /clear and compaction find the rules too; a resume follows the session record', () => {
  const l = lab();
  const id = 'f00dcafe-0000-4000-8000-000000000001';
  for (const input of [
    hookInput('session-start-startup', { session_id: id, model: 'claude-sonnet-5-5' }),
    hookInput('session-start-clear', { session_id: id }),
    hookInput('session-start-startup', { session_id: id, source: 'compact', model: 'claude-sonnet-5-5' }),
    hookInput('session-start-resume', { session_id: id, model: 'claude-sonnet-5-5' }),
  ])
    assert.equal(l.run(['--model', 'sonnet'], { FAKE_HOOK_INPUT: input }).stdout, '');
  assert.deepEqual(
    l.h.log().filter((d) => d.event === 'session-start').map((d) => [d.source, d.delivered]),
    [
      ['startup', 'launcher'],
      ['clear', 'launcher'],
      ['compact', 'launcher'],
      ['resume', 'already-delivered'],
    ],
  );
});

test('launcher route with the hook: a session on another model than the launcher prepared gets its own rules and a note that the others do not apply', () => {
  const l = lab();
  // The settings' env pins the alias for Claude Code and its hooks, and the launcher does not see it.
  const input = hookInput('session-start-startup', { session_id: 'other-model', model: 'claude-haiku-5-5' });
  const r = l.run(['--model', 'sonnet'], { FAKE_HOOK_INPUT: input });
  const out = JSON.parse(r.stdout) as Record<string, any>;
  const text: string = out.hookSpecificOutput.additionalContext;
  assert.match(text, /^<sextant-rules-change from="claude-sonnet-5-5" to="claude-haiku-5-5">\nThis session runs on claude-haiku-5-5\./);
  assert.match(text, /HAIKU-GEN-9047/);
  assert.match(out.systemMessage, /sextant run put the rules for claude-sonnet-5-5 in the system prompt, but this session runs on claude-haiku-5-5/);
  const start = l.h.log().at(-1);
  assert.deepEqual([start?.delivered, start?.launch_model, start?.warned], ['rules+note', 'claude-sonnet-5-5', true]);
});

test('launcher route with the hook: a claude started from inside a launched session inherits the variable but not the option, so its hook delivers', () => {
  const l = lab();
  const r = l.run(['--model', 'sonnet', '-p', 'hi'], { FAKE_HOOK_INPUT: printStart('outer') });
  const file = fileArg(r.started);
  // The inner claude's hook: the same variable, under a process started without the option.
  const nested = runCli(['hook', 'session-start'], { ...l.h.env, SEXTANT_LAUNCH_FILE: file, ANTHROPIC_MODEL: 'claude-sonnet-5-5' }, NO_NETWORK, printStart('inner'));
  assert.match((JSON.parse(nested.stdout) as Record<string, any>).hookSpecificOutput.additionalContext, /SONNET-GEN-3306/);
  assert.equal(l.h.log().at(-1)?.delivered, 'rules');
});

test('withoutOption takes out every value of an option, in both forms, and nothing after --', () => {
  assert.deepEqual(
    withoutOption(['a', '--x', '1', '--x=2', '--xy', '3', '--', '--x', '4'], '--x'),
    ['a', '--xy', '3', '--', '--x', '4'],
  );
});
