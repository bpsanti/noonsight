// noonsight check, against temporary installs and a fake `claude` on PATH.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { managedTarget } from '../src/adapters/claude-code/locations.js';
import { PACKAGE_ROOT } from '../src/config/paths.js';
import { fakeClaude, FIXTURES, hookInput, LAB_CONFIG, LAB_PRESETS, runCli, tempTree } from './helpers.js';

const supported = process.platform === 'darwin' || process.platform === 'linux';
const NO_NETWORK = ['--require', path.join(FIXTURES, 'no-network.cjs')];

function setup(claudeVersion = '2.1.325') {
  const home = tempTree({});
  const env = {
    HOME: home,
    NOONSIGHT_SYSTEM_ROOT: tempTree({}),
    NOONSIGHT_CONFIG: LAB_CONFIG,
    NOONSIGHT_PRESETS_DIR: LAB_PRESETS,
    PATH: fakeClaude(claudeVersion),
  };
  return { home, env };
}

function lines(stdout: string): string[] {
  return stdout.trimEnd().split('\n');
}

/** The decision log in the home the environment names. */
function logLines(env: { HOME: string }): Record<string, unknown>[] {
  const file = path.join(env.HOME, '.local', 'state', 'noonsight', 'decisions.jsonl');
  return lines(fs.readFileSync(file, 'utf8')).map((l) => JSON.parse(l) as Record<string, unknown>);
}

test('after an account install, check reports every part as ok and exits 0', () => {
  const { env } = setup();
  const claudeDir = tempTree({});
  assert.equal(runCli(['install', '--account', claudeDir], env).status, 0);
  runCli(['hook', 'session-start'], env, [], hookInput('session-start-startup'));
  const r = runCli(['check'], env, NO_NETWORK);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const out = lines(r.stdout);
  assert.ok(out.every((l) => /^(ok|warning|problem): /.test(l)), r.stdout);
  assert.ok(out.every((l) => l.startsWith('ok: ')), r.stdout);
  assert.match(r.stdout, /ok: config .*noonsight\.json: valid \(3 model entries; subagents: rules when each subagent starts, permission allow for a routed call, on mismatch warn\)/);
  assert.match(r.stdout, /^ok: triggers: code-edit, which no rule lists$/m);
  assert.match(r.stdout, new RegExp(`ok: account install ${claudeDir}: hooks in .*settings\\.json \\(SessionStart, PostModelSwitch, PreToolUse on Agent\\|Task, SubagentStart, PostToolUse on Agent\\|Task, PostToolUse on Edit\\|Write\\)`));
  // The version comes from package.json, in check and in every line of the decision log.
  const version = (JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8')) as { version: string }).version;
  assert.equal(version, '0.0.1');
  assert.match(r.stdout, new RegExp(`ok: account install .*: hook pointer .*noonsight-hook runs noonsight ${version.replaceAll('.', '\\.')}\n`));
  assert.ok(logLines(env).every((l) => l.version === version), 'every log line records the version');
  assert.match(r.stdout, /ok: claude: 2\.1\.325/);
  assert.match(r.stdout, /ok: last decision: \S+ session-start matched claude-haiku-5-5 \(rules\)/);
  assert.doesNotMatch(r.stderr, /NETWORK-ATTEMPT/);
});

test('nothing installed is a problem', () => {
  const { env } = setup();
  const r = runCli(['check'], env);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /problem: noonsight is not installed: run `noonsight install`/);
  assert.match(r.stdout, /ok: no decisions logged yet/);
});

test('a Claude Code older than the PostModelSwitch event is a problem; no claude on PATH is a warning', () => {
  const old = setup('2.1.200');
  assert.equal(runCli(['install', '--account', tempTree({})], old.env).status, 0);
  const r = runCli(['check'], old.env);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /problem: claude: installed 2\.1\.200; the PostModelSwitch hook event needs 2\.1\.251 or later \(upgrade: claude update\)/);

  const none = setup();
  assert.equal(runCli(['install', '--account', tempTree({})], none.env).status, 0);
  const missing = runCli(['check'], { ...none.env, PATH: tempTree({}) });
  assert.equal(missing.status, 0, missing.stdout);
  assert.match(missing.stdout, /warning: claude: not found on PATH/);
});

test('a hook pointer whose copy of noonsight is gone, or missing, is a problem', () => {
  const { env, home } = setup();
  assert.equal(runCli(['install', '--account', tempTree({})], env).status, 0);
  const pointer = path.join(home, '.local', 'share', 'noonsight', 'noonsight-hook');
  fs.writeFileSync(pointer, fs.readFileSync(pointer, 'utf8').replace(/^cli=.*$/m, "cli='/gone/cli.js'"));
  const gone = runCli(['check'], env);
  assert.equal(gone.status, 1);
  assert.match(gone.stdout, /problem: account install .*: the hook pointer runs \/gone\/cli\.js, which no longer exists; hooks do nothing/);
  fs.rmSync(pointer);
  assert.match(runCli(['check'], env).stdout, /problem: account install .*: the hook pointer .* is missing or unreadable/);
});

test('a hook pointer whose copy of noonsight this account cannot reach is reported as unreachable, not gone', { skip: process.getuid?.() === 0 }, () => {
  const { env, home } = setup();
  assert.equal(runCli(['install', '--account', tempTree({})], env).status, 0);
  const pointer = path.join(home, '.local', 'share', 'noonsight', 'noonsight-hook');
  const locked = tempTree({ 'cli.js': '' });
  fs.writeFileSync(pointer, fs.readFileSync(pointer, 'utf8').replace(/^cli=.*$/m, `cli='${path.join(locked, 'cli.js')}'`));
  fs.chmodSync(locked, 0o000);
  try {
    const r = runCli(['check'], env);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /problem: account install .*: this account cannot run .*cli\.js, so its hooks do nothing; install noonsight from a Node\.js and a copy of noonsight that every account can read and run/);
    assert.doesNotMatch(r.stdout, /no longer exists/);
  } finally {
    fs.chmodSync(locked, 0o755);
  }
});

test('an account install whose entries were removed by hand, or that sets disableAllHooks, is a problem', () => {
  const { env } = setup();
  const claudeDir = tempTree({});
  assert.equal(runCli(['install', '--account', claudeDir], env).status, 0);
  fs.writeFileSync(path.join(claudeDir, 'settings.json'), JSON.stringify({ disableAllHooks: true }));
  const r = runCli(['check'], env);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /problem: account install .*: no noonsight hooks in .*settings\.json; run `noonsight install --account/);

  assert.equal(runCli(['install', '--account', claudeDir], env).status, 0);
  assert.match(runCli(['check'], env).stdout, /problem: account install .*sets disableAllHooks, so Claude Code runs none of this account's hooks/);
});

test('an install from before the subagent hooks, the SubagentStart hook or the file edit hook, or one whose agent-tool matcher was widened, is a problem until install runs again', () => {
  const { env } = setup();
  const claudeDir = tempTree({});
  assert.equal(runCli(['install', '--account', claudeDir], env).status, 0);
  const file = path.join(claudeDir, 'settings.json');
  const settings = JSON.parse(fs.readFileSync(file, 'utf8'));
  const full = structuredClone(settings);
  delete settings.hooks.PreToolUse;
  delete settings.hooks.PostToolUse;
  fs.writeFileSync(file, JSON.stringify(settings));
  const old = runCli(['check'], env);
  assert.equal(old.status, 1);
  assert.match(old.stdout, /problem: account install .*: the hooks in .*settings\.json are incomplete or point elsewhere \(missing: PreToolUse on Agent\|Task, PostToolUse on Agent\|Task, PostToolUse on Edit\|Write\); run `noonsight install` again/);

  // An install from before SubagentStart delivered the rules: its subagents would get none.
  const beforeStart = structuredClone(full);
  delete beforeStart.hooks.SubagentStart;
  fs.writeFileSync(file, JSON.stringify(beforeStart));
  assert.match(runCli(['check'], env).stdout, /problem: account install .*: the hooks in .*settings\.json are incomplete or point elsewhere \(missing: SubagentStart\); run `noonsight install` again/);

  // An install from before triggers: its sessions never reveal code-edit.
  const beforeTriggers = structuredClone(full);
  beforeTriggers.hooks.PostToolUse = beforeTriggers.hooks.PostToolUse.filter((g: { matcher: string }) => g.matcher !== 'Edit|Write');
  fs.writeFileSync(file, JSON.stringify(beforeTriggers));
  assert.match(runCli(['check'], env).stdout, /problem: account install .*: the hooks in .*settings\.json are incomplete or point elsewhere \(missing: PostToolUse on Edit\|Write\); run `noonsight install` again/);

  full.hooks.PreToolUse[0].matcher = '*';
  fs.writeFileSync(file, JSON.stringify(full));
  assert.match(runCli(['check'], env).stdout, /problem: account install .*: the hooks in .*settings\.json are incomplete or point elsewhere \(missing: PreToolUse on Agent\|Task\); run/);
  assert.equal(runCli(['install', '--account', claudeDir], env).status, 0);
  assert.equal(runCli(['check'], env, NO_NETWORK).status, 0);
});

test('the last decision can be a subagent result', () => {
  const { env } = setup();
  assert.equal(runCli(['install', '--account', tempTree({})], env).status, 0);
  const session = JSON.parse(hookInput('pre-tool-use-agent')) as Record<string, any>;
  runCli(['hook', 'session-start'], env, [], hookInput('session-start-startup', { session_id: session.session_id, model: 'claude-sonnet-5-5' }));
  runCli(['hook', 'agent-call'], env, [], JSON.stringify(session));
  const post = JSON.parse(hookInput('post-tool-use-agent')) as Record<string, any>;
  runCli(['hook', 'subagent-start'], env, [], hookInput('subagent-start', { session_id: session.session_id, agent_id: post.tool_response.agentId }));
  runCli(['hook', 'agent-result'], env, [], JSON.stringify({ ...post, session_id: session.session_id, tool_use_id: session.tool_use_id }));
  assert.match(runCli(['check'], env, NO_NETWORK).stdout, /ok: last decision: \S+ agent-result match claude-haiku-5-5 \(rules\)/);
});

test('a refused or missing configuration exits 2 and lists the problems', () => {
  const { env } = setup();
  assert.equal(runCli(['install', '--account', tempTree({})], env).status, 0);
  const bad = path.join(tempTree({ 'noonsight.json': { version: 1, models: { sonnet: { use: 'none' } } } }), 'noonsight.json');
  const r = runCli(['check'], { ...env, NOONSIGHT_CONFIG: bad });
  assert.equal(r.status, 2);
  assert.match(r.stdout, /problem: config .*noonsight\.json: refused, so sessions get no rules:\n {2}- \/models\/sonnet: key/);
  const missing = runCli(['check'], { ...env, NOONSIGHT_CONFIG: path.join(tempTree({}), 'none.json') });
  assert.equal(missing.status, 2);
  assert.match(missing.stdout, /no configuration file here/);
});

test('machine-wide: check reads the managed settings that decide whether hooks run', { skip: !supported }, () => {
  const { env } = setup();
  assert.equal(runCli(['install', '--managed'], env).status, 0);
  const ok = runCli(['check'], env);
  assert.equal(ok.status, 0, ok.stdout);
  assert.match(ok.stdout, /ok: machine-wide install: hooks in .*managed-settings\.d\/noonsight\.json/);
  assert.match(ok.stdout, /ok: machine-wide install: hook pointer .* runs noonsight/);

  const managedDir = managedTarget(env).managedDir ?? '';
  fs.writeFileSync(path.join(managedDir, 'managed-settings.json'), JSON.stringify({ disableAllHooks: true, allowManagedHooksOnly: true }));
  const off = runCli(['check'], env);
  assert.equal(off.status, 1);
  assert.match(off.stdout, /problem: managed settings set disableAllHooks: Claude Code runs no hooks at all/);
  assert.match(off.stdout, /warning: managed settings set allowManagedHooksOnly/);

  // A later drop-in file wins over the managed settings file.
  fs.writeFileSync(path.join(managedDir, 'managed-settings.d', '90-later.json'), JSON.stringify({ disableAllHooks: false }));
  assert.doesNotMatch(runCli(['check'], env).stdout, /disableAllHooks/);

  fs.writeFileSync(path.join(managedDir, 'managed-settings.json'), '{ broken');
  assert.match(runCli(['check'], env).stdout, /problem: managed settings .*managed-settings\.json cannot be read as a JSON object .*Claude Code refuses to start/);
});

test('machine-wide on macOS: an MDM profile for Claude Code is a warning, because it can shadow the managed files', { skip: process.platform !== 'darwin' }, () => {
  const { env } = setup();
  assert.equal(runCli(['install', '--managed'], env).status, 0);
  const profile = path.join(env.NOONSIGHT_SYSTEM_ROOT, 'Library', 'Managed Preferences', 'com.anthropic.claudecode.plist');
  fs.mkdirSync(path.dirname(profile), { recursive: true });
  fs.writeFileSync(profile, '<plist/>');
  assert.match(runCli(['check'], env).stdout, /warning: an MDM profile for Claude Code is present .*managedSourcesBehavior/);
});

test('check takes no arguments', () => {
  assert.equal(runCli(['check', 'x']).status, 2);
  assert.match(runCli(['check', '--help']).stdout, /usage: noonsight check/);
});

test('a login whose server-managed settings shadow the managed files is a problem until the default install reaches it', { skip: !supported }, () => {
  const { home, env } = setup();
  const claudeDir = path.join(home, '.claude');
  fs.mkdirSync(claudeDir);
  fs.writeFileSync(path.join(claudeDir, 'remote-settings.json'), JSON.stringify({ permissions: { deny: ['WebFetch'] } }));
  const other = path.join(home, '.claude-max');
  fs.mkdirSync(other);
  fs.writeFileSync(path.join(other, '.claude.json'), '{}');
  assert.equal(runCli(['install', '--managed'], env).status, 0);

  const shadowed = runCli(['check'], env);
  assert.equal(shadowed.status, 1, shadowed.stdout);
  assert.ok(
    shadowed.stdout.includes(`problem: Claude Code configuration ${claudeDir}: no noonsight hooks reach it (its login receives server-managed settings`),
    shadowed.stdout,
  );
  assert.ok(shadowed.stdout.includes(`ok: Claude Code configuration ${other}: reached by the machine-wide install`), shadowed.stdout);

  assert.equal(runCli(['install', '--account', claudeDir], env).status, 0);
  const reached = runCli(['check'], env);
  assert.equal(reached.status, 0, reached.stdout);
  assert.ok(reached.stdout.includes(`ok: account install ${claudeDir}: hooks in`), reached.stdout);
  assert.ok(reached.stdout.includes(`ok: Claude Code configuration ${claudeDir}: this login receives server-managed settings`), reached.stdout);
  assert.doesNotMatch(reached.stdout, /twice/);
});

test('server-managed settings that turn hooks off for a login are a problem', () => {
  const { home, env } = setup();
  const claudeDir = path.join(home, '.claude');
  fs.mkdirSync(claudeDir);
  assert.equal(runCli(['install'], env).status, 0);
  fs.writeFileSync(path.join(claudeDir, 'remote-settings.json'), JSON.stringify({ allowManagedHooksOnly: true }));
  assert.match(runCli(['check'], env).stdout, /problem: Claude Code configuration .*set allowManagedHooksOnly, so Claude Code runs only the hooks the organization delivers/);
  fs.writeFileSync(path.join(claudeDir, 'remote-settings.json'), JSON.stringify({ disableAllHooks: true }));
  const off = runCli(['check'], env);
  assert.equal(off.status, 1);
  assert.match(off.stdout, /problem: Claude Code configuration .*set disableAllHooks, so Claude Code runs no hooks there/);
});

test('a Claude Code configuration directory added after the install is a problem until install runs again', () => {
  const { home, env } = setup();
  assert.equal(runCli(['install'], env).status, 0);
  const added = path.join(home, '.claude-new');
  fs.mkdirSync(added);
  fs.writeFileSync(path.join(added, '.claude.json'), '{}');
  const r = runCli(['check'], env);
  assert.equal(r.status, 1);
  assert.ok(r.stdout.includes(`problem: Claude Code configuration ${added}: no noonsight hooks reach it; run \`noonsight install\``), r.stdout);
  assert.equal(runCli(['install'], env).status, 0);
  assert.equal(runCli(['check'], env).status, 0);
});

test('a Claude Code older than the documented aliases is a warning', () => {
  const { env } = setup('2.1.300');
  assert.equal(runCli(['install'], env).status, 0);
  const r = runCli(['check'], env);
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /warning: claude: installed 2\.1\.300; when a session without a reported model, such as `claude -p`, names it by an alias, noonsight assumes what the aliases select from Claude Code 2\.1\.321 on/);
});

test('check reports scopes whose matchers overlap as warnings that keep exit 0', () => {
  const { env } = setup();
  assert.equal(runCli(['install', '--account', tempTree({})], env).status, 0);
  const dir = tempTree({
    'noonsight.json': {
      version: 1,
      scopes: {
        investigate: { match: ['\\bdiagnos', '(x)\\1'] },
        triage: { match: ['\\bdiagnosis\\b'] },
        summarize: { match: ['\\bsummar'] },
      },
    },
  });
  const r = runCli(['check'], { ...env, NOONSIGHT_CONFIG: path.join(dir, 'noonsight.json') });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(
    r.stdout,
    /^ok: scopes: 3 scopes declared, 4 matchers; not all example texts could be built for scope "investigate": "\(x\)\\\\1", so their overlaps are not fully checked$/m,
  );
  assert.match(
    r.stdout,
    /^warning: scopes "investigate" and "triage" overlap: the task text "diagnosis" matches both, and a task with only that text gets "investigate"; the scope whose matcher matches earliest in a task wins, and at the same place the one declared first$/m,
  );
  assert.doesNotMatch(r.stdout, /"summarize" overlap|and "summarize"/);
});

test('check does not claim that no two scopes overlap while a matcher has more examples than it keeps', () => {
  const { env } = setup();
  assert.equal(runCli(['install', '--account', tempTree({})], env).status, 0);
  const words = Array.from({ length: 24 }, (_, i) => `w${String(i).padStart(2, '0')}`);
  const dir = tempTree({
    'noonsight.json': {
      version: 1,
      scopes: { a: { match: [`\\b(?:${[...words, 'zeta'].join('|')})\\b`] }, b: { match: ['\\bz[a-z]{3}\\b'] } },
    },
  });
  const r = runCli(['check'], { ...env, NOONSIGHT_CONFIG: path.join(dir, 'noonsight.json') });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^ok: scopes: 2 scopes declared, 2 matchers; not all example texts could be built for scope "a": /m);
  assert.doesNotMatch(r.stdout, /no two scopes overlap/);
});

test('check says which scope and place sessions started from its environment get, and warns about an undeclared NOONSIGHT_SCOPE', () => {
  const { env } = setup();
  assert.equal(runCli(['install', '--account', tempTree({})], env).status, 0);
  const dir = tempTree({ 'noonsight.json': { version: 1, scopes: { investigate: { match: ['\\binvestigat'] } }, session: { unattended_when_env: ['CI'] } } });
  const scoped = { ...env, NOONSIGHT_CONFIG: path.join(dir, 'noonsight.json') };
  const quiet = runCli(['check'], scoped);
  assert.match(quiet.stdout, /^ok: scopes: 1 scope declared, 1 matcher; no two scopes overlap$/m);
  assert.doesNotMatch(quiet.stdout, /sessions started from this environment/);
  assert.match(runCli(['check'], { ...scoped, NOONSIGHT_SCOPE: 'investigate', CI: '1' }).stdout, /^ok: sessions started from this environment get scope "investigate" \(NOONSIGHT_SCOPE\), place "unattended" \(CI is set\)$/m);
  const unknown = runCli(['check'], { ...scoped, NOONSIGHT_SCOPE: 'release' });
  assert.equal(unknown.status, 0);
  assert.match(unknown.stdout, /^warning: NOONSIGHT_SCOPE is "release" here, which is not a declared scope, so sessions started from this environment get only the rules for every scope$/m);
});
