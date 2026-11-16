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
  env: { SEXTANT_LAUNCH_FILE: pick('SEXTANT_LAUNCH_FILE'), SEXTANT_SCOPE: pick('SEXTANT_SCOPE'), SEXTANT_SCOPE_VIA: pick('SEXTANT_SCOPE_VIA'), ANTHROPIC_MODEL: pick('ANTHROPIC_MODEL') },
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
  assert.deepEqual(r.started?.env, { SEXTANT_LAUNCH_FILE: file, SEXTANT_SCOPE: 'investigate', SEXTANT_SCOPE_VIA: 'explicit', ANTHROPIC_MODEL: null });
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
  assert.deepEqual(none.started, { args: ['-p', 'hi'], env: { SEXTANT_LAUNCH_FILE: null, SEXTANT_SCOPE: null, SEXTANT_SCOPE_VIA: null, ANTHROPIC_MODEL: null } });
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

// Routing in the launcher.

/** The lab configuration with matchers for its scopes and a routing table, with `routing` merged over it. */
function routingConfig(routing: Record<string, unknown> = {}): string {
  const labConfig = JSON.parse(fs.readFileSync(LAB_CONFIG, 'utf8')) as Record<string, any>;
  const dir = tempTree({
    'sextant.json': {
      ...labConfig,
      scopes: { ...labConfig.scopes, summarize: { match: ['\\bsummari[sz]e'] }, investigate: { match: ['\\binvestigat'] } },
      routing: {
        enabled: true,
        table: {
          summarize: [{ model: 'haiku', effort: 'low' }],
          investigate: [
            { model: 'fable', effort: 'high' },
            { model: 'claude-sonnet-5-5', effort: 'high' },
          ],
        },
        ...routing,
      },
    },
  });
  fs.cpSync(path.join(path.dirname(LAB_CONFIG), 'rules'), path.join(dir, 'rules'), { recursive: true });
  return path.join(dir, 'sextant.json');
}

const routeOf = (d: Record<string, any> | undefined): unknown[] => [d?.routing, d?.routing_reason, d?.route_model, d?.route_effort, d?.model, d?.scope];

test('launcher routing: the scope\'s row adds --model and --effort first, and the rules in the system prompt are the routed model\'s', () => {
  const l = lab(routingConfig());
  const r = l.run(['--scope', 'summarize', '-p', 'hi']);
  const file = fileArg(r.started);
  assert.deepEqual(r.started?.args.slice(2), ['--model', 'haiku', '--effort', 'low', '-p', 'hi']);
  assert.match(fs.readFileSync(file, 'utf8'), /HAIKU-GEN-9047[\s\S]*HAIKU-SUM-6610/);
  assert.equal(r.started?.env.SEXTANT_SCOPE, 'summarize');
  const [launch] = launches(l.h);
  assert.deepEqual(routeOf(launch), ['routed', 'table', 'claude-haiku-5-5', 'low', 'claude-haiku-5-5', 'summarize']);
  assert.deepEqual([launch?.model_source, launch?.model_from, launch?.route_value, launch?.delivered], ['claude-args', '--model', 'haiku', 'system-prompt']);

  // An identifier is passed as the table writes it, after an option whose model is not declared.
  const investigate = l.run(['--scope', 'investigate', '-p', 'hi']);
  assert.deepEqual(investigate.started?.args.slice(2), ['--model', 'claude-sonnet-5-5', '--effort', 'high', '-p', 'hi']);
  assert.deepEqual(launches(l.h)[1]?.route_skipped, [{ model: 'fable', why: 'claude-fable-5-2 is not declared under "models"' }]);
});

test('launcher routing: without a scope, the task text of --task or of the prompt after -p picks one, which the session gets as SEXTANT_SCOPE', () => {
  const l = lab(routingConfig());
  const printed = l.run(['-p', 'Summarize the release notes', '--output-format', 'json']);
  assert.deepEqual(printed.started?.args.slice(2), ['--model', 'haiku', '--effort', 'low', '-p', 'Summarize the release notes', '--output-format', 'json']);
  assert.equal(printed.started?.env.SEXTANT_SCOPE, 'summarize');
  const task = l.run(['--task', 'Investigate the outage', '--', '--resume', 'abc']);
  assert.deepEqual(task.started?.args.slice(2), ['--model', 'claude-sonnet-5-5', '--effort', 'high', '--resume', 'abc']);
  // A prompt that is not right after -p is not read, and an interactive session has no task.
  const elsewhere = l.run(['-p', '--verbose', 'Summarize the notes']);
  assert.deepEqual(elsewhere.started?.args, ['-p', '--verbose', 'Summarize the notes']);
  assert.deepEqual(
    launches(l.h).map((d) => [d.scope, d.scope_source, d.scope_matcher ?? null, d.routing, d.routing_reason]),
    [
      ['summarize', 'task-text', '\\bsummari[sz]e', 'routed', 'table'],
      ['investigate', 'task-text', '\\binvestigat', 'routed', 'table'],
      [null, null, null, 'inherit', 'no-scope'],
    ],
  );
});

test('launcher routing: a nested sextant run ignores a scope the outer one inferred, and keeps one that was given', () => {
  const l = lab(routingConfig());
  const outer = l.run(['-p', 'Investigate the outage']);
  assert.deepEqual([outer.started?.env.SEXTANT_SCOPE, outer.started?.env.SEXTANT_SCOPE_VIA], ['investigate', 'inferred']);
  const inherited = { SEXTANT_SCOPE: 'investigate', SEXTANT_SCOPE_VIA: 'inferred' };

  // The worker's own task decides its scope and route.
  const worker = l.run(['--', '-p', 'Summarize the notes'], inherited);
  assert.deepEqual(worker.started?.args.slice(2), ['--model', 'haiku', '--effort', 'low', '-p', 'Summarize the notes']);
  assert.deepEqual([worker.started?.env.SEXTANT_SCOPE, worker.started?.env.SEXTANT_SCOPE_VIA], ['summarize', 'inferred']);
  // A worker whose task names no scope has none, and its session does not keep the outer one.
  const plain = l.run(['-p', 'Reply OK'], inherited);
  assert.deepEqual(plain.started?.args, ['-p', 'Reply OK']);
  assert.deepEqual([plain.started?.env.SEXTANT_SCOPE, plain.started?.env.SEXTANT_SCOPE_VIA], [null, null]);

  // A scope given explicitly, or set by hand without a source, still wins over the task text.
  const given = l.run(['-p', 'Summarize the notes'], { SEXTANT_SCOPE: 'investigate', SEXTANT_SCOPE_VIA: 'explicit' });
  assert.deepEqual(given.started?.args.slice(2, 6), ['--model', 'claude-sonnet-5-5', '--effort', 'high']);
  assert.deepEqual([given.started?.env.SEXTANT_SCOPE, given.started?.env.SEXTANT_SCOPE_VIA], ['investigate', 'explicit']);
  const byHand = l.run(['-p', 'Summarize the notes'], { SEXTANT_SCOPE: 'investigate' });
  assert.deepEqual([byHand.started?.env.SEXTANT_SCOPE, byHand.started?.env.SEXTANT_SCOPE_VIA], ['investigate', null]);
  assert.deepEqual(
    launches(l.h).map((d) => [d.scope, d.scope_source]),
    [
      ['investigate', 'task-text'],
      ['summarize', 'task-text'],
      [null, null],
      ['investigate', 'env'],
      ['investigate', 'env'],
    ],
  );
});

test('explicit-model, launcher: a --model on the command line wins under respect_explicit, and an --effort is kept', () => {
  const l = lab(routingConfig());
  const kept = l.run(['--scope', 'summarize', '--model', 'sonnet', '-p', 'hi']);
  assert.deepEqual(kept.started?.args.slice(2), ['--model', 'sonnet', '-p', 'hi']);
  assert.match(fs.readFileSync(fileArg(kept.started), 'utf8'), /SONNET-GEN-3306/);
  const effort = l.run(['--scope', 'summarize', '--effort', 'max', '-p', 'hi']);
  assert.deepEqual(effort.started?.args.slice(2), ['--model', 'haiku', '--effort', 'max', '-p', 'hi']);
  assert.deepEqual(
    launches(l.h).map((d) => [d.routing, d.routing_reason, d.route_effort_kept ?? null]),
    [
      ['yielded', 'explicit-model', null],
      ['routed', 'table', true],
    ],
  );

  const table = lab(routingConfig({ respect_explicit: false }));
  const replaced = table.run(['--scope', 'summarize', '--model=sonnet', '--effort', 'max', '-p', 'hi']);
  assert.deepEqual(replaced.started?.args.slice(2), ['--model', 'haiku', '--effort', 'low', '-p', 'hi']);
});

test('orchestrator-env, launcher: a variable of yield_when_env, SEXTANT_ROUTING=off, or a targets list without the launcher leave the command line alone', () => {
  for (const [config, env, reason] of [
    [routingConfig({ yield_when_env: ['ORCH_TASK_ID'] }), { ORCH_TASK_ID: 't-1' }, 'yield-env'],
    [routingConfig(), { SEXTANT_ROUTING: 'off' }, 'routing-env'],
    [routingConfig({ targets: ['subagents'] }), {}, 'target-off'],
  ] as const) {
    const l = lab(config);
    const r = l.run(['--scope', 'summarize', '-p', 'hi'], env);
    assert.deepEqual(r.started?.args, ['-p', 'hi'], reason);
    assert.deepEqual(routeOf(launches(l.h)[0]), ['yielded', reason, undefined, undefined, null, 'summarize'], reason);
  }
});

test('launcher routing off: the command line is the one sextant run gives without a routing table, and the log says routing is off', () => {
  for (const args of [['--scope', 'summarize', '--model', 'sonnet', '-p', 'hi'], ['-p', 'Summarize the notes'], ['--model', 'haiku']]) {
    const plain = lab().run(args);
    const off = lab(routingConfig({ enabled: false }));
    const r = off.run(args);
    assert.deepEqual(r.started?.args.slice(r.started.args[0] === '--append-system-prompt-file' ? 2 : 0), plain.started?.args.slice(plain.started.args[0] === '--append-system-prompt-file' ? 2 : 0));
    assert.deepEqual([launches(off.h)[0]?.routing, launches(off.h)[0]?.routing_reason], ['off', 'disabled']);
  }
  const refused = lab(path.join(tempTree({ 'sextant.json': { version: 1, routing: { enabled: 1 } } }), 'sextant.json'));
  refused.run(['-p', 'hi']);
  assert.deepEqual([launches(refused.h)[0]?.status, launches(refused.h)[0]?.routing, launches(refused.h)[0]?.routing_reason], ['config-invalid', 'off', 'config-invalid']);
});

test('launcher routing with the hook: the hook finds the routed model\'s rules in the system prompt and does not deliver them again', () => {
  const l = lab(routingConfig());
  const r = l.run(['--scope', 'summarize', '-p', 'hi'], { FAKE_HOOK_INPUT: printStart('routed') });
  assert.equal(r.stdout, '');
  const start = l.h.log().find((d) => d.event === 'session-start');
  assert.deepEqual([start?.model, start?.model_source, start?.scope, start?.delivered], ['claude-haiku-5-5', 'claude-args', 'summarize', 'launcher']);
});

test('launcher: --task needs a value', () => {
  const usage = lab().run(['--task']);
  assert.equal(usage.status, 2);
  assert.match(usage.stderr, /--task needs a value/);
});

test('withoutOption takes out every value of an option, in both forms, and nothing after --', () => {
  assert.deepEqual(
    withoutOption(['a', '--x', '1', '--x=2', '--xy', '3', '--', '--x', '4'], '--x'),
    ['a', '--xy', '3', '--', '--x', '4'],
  );
});
