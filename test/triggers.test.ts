// Triggers: what counts as a code edit, how the core and the configuration treat a rule that lists a
// trigger, and the file edit hook driven as Claude Code drives it, a separate process that gets the
// hook input on stdin, each test with its own home directory and its own git repository.

import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { codeEdit } from '../src/adapters/claude-code/code-edit.js';
import { ConfigError, loadConfig } from '../src/config/load.js';
import { resolve, resolveAdded } from '../src/core/resolve.js';
import { hasCodeExtension } from '../src/core/triggers.js';
import { CLI, hookHome, hookInput, LAB_PRESETS, labPresetWith, NO_NETWORK, runCli, tempTree } from './helpers.js';

/** The session of the recorded start; the edits replay in it. */
const SESSION = 'd1004f3b-4cb3-4ac6-a052-4e3fd53b2592';
const VERIFY = 'VERIFY-EDIT-5150';
const HAIKU_VERIFY = 'HAIKU-VERIFY-6261';

/** A git repository holding the files, of which `tracked` are committed and the rest left untracked. */
function repo(files: Record<string, string>, tracked: readonly string[]): string {
  const dir = tempTree(files);
  const git = (...args: string[]): void => {
    const r = spawnSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  };
  git('init', '-q');
  if (tracked.length) {
    git('add', '--', ...tracked);
    git('commit', '-q', '-m', 'files');
  }
  return dir;
}

const PROJECT = {
  'src/app.ts': 'export const x = 1;\n',
  'src/b[1].ts': 'export const y = 1;\n',
  'README.md': '# project\n',
  'docs/report.html': '<p>old</p>\n',
  '.gitignore': 'tmp/\n',
};
const TRACKED = ['src/app.ts', 'src/b[1].ts', 'README.md', 'docs/report.html', '.gitignore'];

/** A PostToolUse input for an edit of the file, in the project. */
function edit(project: string, file: string, fields: Record<string, unknown> = {}, tool: 'Edit' | 'Write' = 'Edit'): Record<string, unknown> {
  const recorded = JSON.parse(hookInput(tool === 'Edit' ? 'post-tool-use-edit' : 'post-tool-use-write')) as Record<string, any>;
  return {
    ...recorded,
    session_id: SESSION,
    cwd: project,
    tool_input: { ...recorded.tool_input, file_path: path.isAbsolute(file) ? file : path.join(project, file) },
    ...fields,
  };
}

const env = { PATH: process.env.PATH ?? '' };

test('code-edit: an edit of a code file the project tracks counts, wherever the path goes through a symbolic link', () => {
  const project = repo(PROJECT, TRACKED);
  // The temporary directory is reached through a symbolic link on macOS; git reports the real path.
  assert.deepEqual(codeEdit(edit(project, 'src/app.ts'), env), { kind: 'code', tool: 'Edit', file: 'src/app.ts' });
  assert.deepEqual(codeEdit(edit(fs.realpathSync(project), 'src/app.ts'), env), { kind: 'code', tool: 'Edit', file: 'src/app.ts' });
  assert.deepEqual(codeEdit(edit(project, 'src/app.ts', {}, 'Write'), env), { kind: 'code', tool: 'Write', file: 'src/app.ts' });
  assert.deepEqual(codeEdit(edit(project, 'src/b[1].ts'), env), { kind: 'code', tool: 'Edit', file: 'src/b[1].ts' }, 'a name with brackets is taken literally');
  // A relative path is read from the cwd, as the tool reads it.
  assert.deepEqual(codeEdit(edit(project, 'x', { tool_input: { file_path: 'src/app.ts' } }), env), { kind: 'code', tool: 'Edit', file: 'src/app.ts' });
});

test('code-edit: reports, notes, new files, ignored files and files outside the project never count', () => {
  const project = repo(PROJECT, TRACKED);
  fs.writeFileSync(path.join(project, 'src', 'new.ts'), 'export {};\n');
  fs.mkdirSync(path.join(project, 'tmp'));
  fs.writeFileSync(path.join(project, 'tmp', 'scratch.ts'), 'export {};\n');
  // A file named like a pattern that would match a tracked file.
  fs.writeFileSync(path.join(project, 'src', '*.ts'), 'export {};\n');
  const outside = path.join(tempTree({ 'elsewhere.ts': 'export {};\n' }), 'elsewhere.ts');
  const why = (input: Record<string, unknown>, e: Record<string, string | undefined> = env): string | undefined => {
    const r = codeEdit(input, e);
    return r.kind === 'not' ? r.why : undefined;
  };
  assert.equal(why(edit(project, 'README.md')), 'not-code');
  assert.equal(why(edit(project, 'docs/report.html')), 'not-code');
  assert.equal(why(edit(project, 'src/new.ts', {}, 'Write')), 'untracked', 'a new file');
  assert.equal(why(edit(project, 'tmp/scratch.ts', {}, 'Write')), 'untracked', 'an ignored file');
  assert.equal(why(edit(project, 'src/*.ts', {}, 'Write')), 'untracked', 'a name with "*" is not a pattern');
  assert.equal(why(edit(project, outside, {}, 'Write')), 'untracked', 'a file outside the project');
  const notRepo = tempTree({ 'a.ts': 'export {};\n' });
  assert.equal(why(edit(notRepo, 'a.ts')), 'untracked', 'a project that is not a git repository');
  assert.equal(why(edit(project, 'src/app.ts', { tool_name: 'NotebookEdit' })), 'not-edit-tool');
  assert.equal(why(edit(project, 'src/app.ts', { tool_name: 'Bash' })), 'not-edit-tool');
  assert.equal(why(edit(project, 'x', { tool_input: {} })), 'no-file');
  assert.equal(why(edit(project, 'src/gone.ts')), 'no-file');
  assert.equal(why(edit(project, 'src')), 'no-file', 'a directory is not a file');
});

test('code-edit: the project is CLAUDE_PROJECT_DIR when Claude Code sets it, else the cwd', () => {
  const project = repo(PROJECT, TRACKED);
  const elsewhere = tempTree({});
  const input = edit(project, 'src/app.ts', { cwd: elsewhere });
  assert.deepEqual(codeEdit(input, env), { kind: 'not', why: 'untracked' }, "the project is the cwd, and the file is not in the cwd's repository");
  assert.deepEqual(codeEdit(input, { ...env, CLAUDE_PROJECT_DIR: project }), { kind: 'code', tool: 'Edit', file: 'src/app.ts' });
  const other = repo({ 'c.ts': 'export {};\n' }, ['c.ts']);
  assert.deepEqual(codeEdit(edit(project, 'src/app.ts'), { ...env, CLAUDE_PROJECT_DIR: other }), { kind: 'not', why: 'untracked' }, "the file is not in the project's repository");
});

test('code extensions are those of programming languages, compared without case', () => {
  for (const f of ['a.ts', 'b.PY', 'c.go', 'd.rs', 'e.sh', 'f.sql', 'g.tsx', 'dir.d/h.java']) assert.equal(hasCodeExtension(f), true, f);
  for (const f of ['a.md', 'b.html', 'c.htm', 'd.json', 'e.yaml', 'f.css', 'g.txt', 'h.ipynb', 'Makefile', '.ts', 'a.ts.bak']) assert.equal(hasCodeExtension(f), false, f);
});

/** A configuration on the lab preset: Sonnet's preset rules plus a verify rule for investigate that lists code-edit. */
function configTree(extra: Record<string, unknown> = {}, models: Record<string, unknown> = {}): string {
  const dir = tempTree({
    'verify.md': `- The verification word for the edit rule is ${VERIFY}.`,
    'haiku-verify.md': `- The verification word for Haiku's edit rule is ${HAIKU_VERIFY}.`,
    'other.md': '- An investigate rule without a trigger.',
  });
  fs.writeFileSync(
    path.join(dir, 'noonsight.json'),
    JSON.stringify({
      version: 1,
      preset: 'lab',
      models: {
        'claude-sonnet-5-5': {
          use: 'preset',
          add: [
            { id: 'user/verify', file: 'verify.md', scopes: ['investigate'], triggers: ['code-edit'] },
            { id: 'user/other', file: 'other.md', scopes: ['investigate'] },
          ],
        },
        'claude-haiku-5-5': { use: 'custom', add: [{ id: 'user/haiku-verify', file: 'haiku-verify.md', scopes: ['investigate'], where: ['session'], triggers: ['code-edit'] }] },
        'claude-opus-5-5': { use: 'none' },
        ...models,
      },
      ...extra,
    }),
  );
  return path.join(dir, 'noonsight.json');
}

test('the core: a rule that lists a revealed trigger applies whatever the scope, and only the rules a trigger adds are sent', () => {
  const config = loadConfig(configTree(), { presetsDir: LAB_PRESETS });
  const base = { model: 'claude-sonnet-5-5', scope: null, place: 'session' } as const;
  const without = resolve(config, base);
  assert.equal(without.status, 'matched');
  assert.deepEqual(without.status === 'matched' && without.rules, ['sonnet/general']);
  assert.equal(without.status === 'matched' && without.triggered, undefined);

  const withTrigger = resolve(config, { ...base, triggers: ['code-edit'] });
  assert.equal(withTrigger.status, 'matched');
  if (withTrigger.status !== 'matched') return;
  assert.deepEqual(withTrigger.rules, ['sonnet/general', 'user/verify']);
  assert.deepEqual(withTrigger.triggered, ['user/verify']);
  assert.match(withTrigger.text, /^<noonsight-rules model="claude-sonnet-5-5" trigger="code-edit">\n/);
  assert.match(withTrigger.text, /for a session that has edited the project's code \(delivered by noonsight, rules sonnet\/general, user\/verify\)/);
  assert.notEqual(withTrigger.sha256, without.status === 'matched' && without.sha256);

  const added = resolveAdded(config, { ...base, triggers: ['code-edit'] }, []);
  assert.equal(added.status, 'matched');
  assert.deepEqual(added.status === 'matched' && [added.rules, added.triggered], [['user/verify'], ['user/verify']]);
  assert.match(added.status === 'matched' ? added.text : '', new RegExp(VERIFY));
  assert.doesNotMatch(added.status === 'matched' ? added.text : '', /SONNET-GEN-3306/);

  // Under a scope that lists the rule, the trigger adds nothing and the envelope names no trigger.
  const scoped = resolve(config, { ...base, scope: 'investigate', triggers: ['code-edit'] });
  assert.equal(scoped.status === 'matched' && scoped.triggered, undefined);
  assert.doesNotMatch(scoped.status === 'matched' ? scoped.text : '', /trigger=/);
  assert.deepEqual(resolveAdded(config, { ...base, scope: 'investigate', triggers: ['code-edit'] }, []), {
    status: 'none',
    reason: 'no-rule-applies',
    model: 'claude-sonnet-5-5',
    key: 'claude-sonnet-5-5',
    scope: 'investigate',
    place: 'session',
  });
  // A rule without a trigger stays with its scopes.
  assert.ok(withTrigger.rules.every((id) => id !== 'user/other'));
});

test('the configuration: triggers default on, can be turned off, and are refused on a rule for every scope or for subagents only', () => {
  assert.deepEqual(loadConfig(configTree(), { presetsDir: LAB_PRESETS }).session.triggers, ['code-edit']);
  assert.deepEqual(loadConfig(configTree({ session: { triggers: [] } }), { presetsDir: LAB_PRESETS }).session.triggers, []);

  const refused = (models: Record<string, unknown>, extra: Record<string, unknown> = {}): readonly string[] => {
    try {
      loadConfig(configTree(extra, models), { presetsDir: LAB_PRESETS });
    } catch (e) {
      if (e instanceof ConfigError) return e.problems;
      throw e;
    }
    assert.fail('the configuration was accepted');
  };
  const every = refused({ 'claude-haiku-5-5': { use: 'custom', add: [{ id: 'x', file: 'verify.md', triggers: ['code-edit'] }] } });
  assert.deepEqual(every, ['/models/claude-haiku-5-5/add/0/triggers: the rule is for every scope ("*"), so it already reaches every session; a trigger adds nothing']);
  const subagent = refused({ 'claude-haiku-5-5': { use: 'custom', add: [{ id: 'x', file: 'verify.md', scopes: ['investigate'], where: ['subagent'], triggers: ['code-edit'] }] } });
  assert.deepEqual(subagent, ['/models/claude-haiku-5-5/add/0/triggers: a trigger acts only in a session, but the rule is only for the place "subagent"; add "session" or "unattended" to "where"']);
  assert.match(refused({ 'claude-haiku-5-5': { use: 'custom', add: [{ id: 'x', file: 'verify.md', scopes: ['investigate'], triggers: ['deploy'] }] } }).join('\n'), /triggers\/0/);
  assert.match(refused({}, { session: { triggers: ['deploy'] } }).join('\n'), /\/session\/triggers\/0/);
});

test('the configuration: a preset rule can list a trigger, and the delivered text with the trigger revealed must fit', () => {
  const presets = labPresetWith((p) => {
    p.models['claude-sonnet-5-5'].rules[1].triggers = ['code-edit'];
  });
  const config = loadConfig(configTree(), { presetsDir: presets });
  const entry = config.exact.get('claude-sonnet-5-5');
  assert.deepEqual(entry?.use === 'rules' && entry.rules.find((r) => r.id === 'sonnet/investigate')?.triggers, ['code-edit']);

  const big = tempTree({ 'a.md': 'a'.repeat(5000), 'b.md': 'b'.repeat(5000) });
  fs.writeFileSync(
    path.join(big, 'noonsight.json'),
    JSON.stringify({
      version: 1,
      preset: 'lab',
      models: {
        'claude-haiku-5-5': {
          use: 'custom',
          add: [
            { id: 'a', file: 'a.md' },
            { id: 'b', file: 'b.md', scopes: ['investigate'], where: ['session'], triggers: ['code-edit'] },
          ],
        },
      },
    }),
  );
  assert.throws(
    () => loadConfig(path.join(big, 'noonsight.json'), { presetsDir: LAB_PRESETS }),
    (e: unknown) => e instanceof ConfigError && e.problems.some((p) => /for no scope in place "session" once a session reveals code-edit come to \d+ characters/.test(p)),
  );
});

/** A home and a project in which to drive the hooks of one session. */
function lab(config: string = configTree(), extraEnv: Record<string, string> = {}) {
  const h = hookHome(config, extraEnv);
  const project = repo(PROJECT, TRACKED);
  const start = (model: string, fields: Record<string, unknown> = {}, extra: Record<string, string> = {}) =>
    h.hook('session-start', hookInput('session-start-startup', { session_id: SESSION, model, cwd: project, ...fields }), extra);
  const fileEdit = (file: string, fields: Record<string, unknown> = {}, tool: 'Edit' | 'Write' = 'Edit', extra: Record<string, string> = {}) =>
    h.hook('file-edit', JSON.stringify(edit(project, file, fields, tool)), extra);
  return { ...h, project, start, fileEdit };
}

test('a session with no scope gets the code-edit rules with its first edit of a tracked code file, and only then', () => {
  const l = lab();
  const started = l.start('claude-sonnet-5-5');
  assert.match(started.out?.hookSpecificOutput.additionalContext, /SONNET-GEN-3306/);
  assert.doesNotMatch(started.out?.hookSpecificOutput.additionalContext, new RegExp(VERIFY));

  fs.writeFileSync(path.join(l.project, 'docs', 'findings.html'), '<p>findings</p>\n');
  assert.equal(l.fileEdit('docs/findings.html', {}, 'Write').raw, '', 'a new report');
  assert.equal(l.fileEdit('docs/report.html').raw, '', 'a tracked report');
  assert.equal(l.fileEdit('README.md').raw, '', 'a tracked note');
  fs.writeFileSync(path.join(l.project, 'src', 'probe.ts'), 'export {};\n');
  assert.equal(l.fileEdit('src/probe.ts', {}, 'Write').raw, '', 'a new script');
  assert.equal(l.log().length, 1, 'edits that reveal nothing leave no log line');

  const first = l.fileEdit('src/app.ts');
  assert.deepEqual(Object.keys(first.out ?? {}), ['hookSpecificOutput']);
  assert.equal(first.out?.hookSpecificOutput.hookEventName, 'PostToolUse');
  const text: string = first.out?.hookSpecificOutput.additionalContext;
  assert.match(text, /^<noonsight-rules model="claude-sonnet-5-5" trigger="code-edit">\n/);
  assert.match(text, new RegExp(VERIFY));
  assert.doesNotMatch(text, /SONNET-GEN-3306/, 'the session already holds the rules for every scope');

  assert.equal(l.fileEdit('src/app.ts').raw, '', 'a second edit delivers nothing again');
  assert.equal(l.fileEdit('src/b[1].ts', {}, 'Write').raw, '');

  const lines = l.log();
  assert.equal(lines.length, 2);
  const line = lines[1] ?? {};
  assert.deepEqual(
    [line.event, line.tool_name, line.trigger, line.file, line.model, line.model_source, line.status, line.rules, line.triggered_rules, line.triggers, line.scope, line.place, line.delivered, line.warned],
    ['file-edit', 'Edit', 'code-edit', 'src/app.ts', 'claude-sonnet-5-5', 'session-record', 'matched', ['user/verify'], ['user/verify'], ['code-edit'], null, 'session', 'rules', false],
  );
  const record = JSON.parse(fs.readFileSync(path.join(l.dir, '.local', 'state', 'noonsight', 'triggers', `${SESSION}.code-edit.json`), 'utf8'));
  assert.deepEqual([record.trigger, record.tool, record.file], ['code-edit', 'Edit', 'src/app.ts']);
});

test("a session's triggers hold: compaction delivers their rules again, a resume does not, and a switch gives the new model its own", () => {
  const l = lab();
  l.start('claude-sonnet-5-5');
  assert.match(l.fileEdit('src/app.ts').out?.hookSpecificOutput.additionalContext, new RegExp(VERIFY));

  const compacted = l.start('claude-sonnet-5-5', { source: 'compact' });
  const text: string = compacted.out?.hookSpecificOutput.additionalContext;
  assert.match(text, /SONNET-GEN-3306/);
  assert.match(text, new RegExp(VERIFY));
  assert.match(text, /trigger="code-edit"/);
  assert.equal(l.start('claude-sonnet-5-5', { source: 'resume' }).raw, '', 'the resumed conversation holds them');

  const switched = l.hook('model-switch', hookInput('model-switch-command', { session_id: SESSION, from_model: 'claude-sonnet-5-5', to_model: 'claude-haiku-5-5' }));
  assert.match(switched.out?.hookSpecificOutput.additionalContext, new RegExp(HAIKU_VERIFY));
  assert.deepEqual(
    l.log().map((d) => [d.event, d.source ?? null, d.delivered, d.triggers ?? null, d.triggered_rules ?? null]),
    [
      ['session-start', 'startup', 'rules', null, null],
      ['file-edit', null, 'rules', ['code-edit'], ['user/verify']],
      ['session-start', 'compact', 'rules', ['code-edit'], ['user/verify']],
      ['session-start', 'resume', 'already-delivered', ['code-edit'], ['user/verify']],
      ['model-switch', 'command', 'rules+note', ['code-edit'], ['user/haiku-verify']],
    ],
  );
  // After /clear the session is a new one, and has revealed nothing.
  const cleared = l.hook('session-start', hookInput('session-start-clear', { session_id: 'after-clear' }));
  assert.doesNotMatch(cleared.raw, new RegExp(HAIKU_VERIFY));
});

test('a session reveals the trigger even when its model gets no rule from it, and a later switch delivers the rule', () => {
  const l = lab();
  l.start('claude-opus-5-5');
  assert.equal(l.fileEdit('src/app.ts').raw, '');
  const switched = l.hook('model-switch', hookInput('model-switch-command', { session_id: SESSION, from_model: 'claude-opus-5-5', to_model: 'claude-sonnet-5-5' }));
  assert.match(switched.out?.hookSpecificOutput.additionalContext, new RegExp(VERIFY));
  assert.deepEqual(
    l.log().map((d) => [d.event, d.status, d.reason ?? null, d.delivered]),
    [
      ['session-start', 'none', 'declared-none', 'nothing'],
      ['file-edit', 'none', 'declared-none', 'nothing'],
      ['model-switch', 'matched', null, 'rules'],
    ],
  );
});

test("a subagent's edit, a trigger turned off, a refused configuration and a scope that already holds the rule deliver nothing more", () => {
  const l = lab();
  l.start('claude-sonnet-5-5');
  assert.equal(l.fileEdit('src/app.ts', { agent_id: 'a1b2c3', agent_type: 'general-purpose' }).raw, '', "a subagent's edit");
  assert.equal(l.log().length, 1);

  const off = lab(configTree({ session: { triggers: [] } }));
  off.start('claude-sonnet-5-5');
  assert.equal(off.fileEdit('src/app.ts').raw, '');
  assert.equal(off.log().length, 1);
  assert.equal(off.start('claude-sonnet-5-5', { source: 'compact' }).out?.hookSpecificOutput.additionalContext.includes(VERIFY), false);

  const broken = path.join(tempTree({ 'noonsight.json': { version: 1, models: { 'claude-sonnet-5-5': { use: 'custom', add: [{ id: 'x', file: 'gone.md' }] } } } }), 'noonsight.json');
  const refused = lab(broken);
  assert.equal(refused.fileEdit('src/app.ts').raw, '', 'the session start already warned');
  assert.equal(refused.log().length, 0);

  const scoped = lab(configTree(), { NOONSIGHT_SCOPE: 'investigate' });
  assert.match(scoped.start('claude-sonnet-5-5').out?.hookSpecificOutput.additionalContext, new RegExp(VERIFY));
  assert.equal(scoped.fileEdit('src/app.ts').raw, '');
  assert.deepEqual(
    scoped.log().map((d) => [d.event, d.scope, d.scope_source, d.status, d.reason ?? null, d.delivered]),
    [
      ['session-start', 'investigate', 'env', 'matched', null, 'rules'],
      ['file-edit', 'investigate', 'env', 'none', 'no-rule-applies', 'nothing'],
    ],
  );
});

test('of several edits whose hooks run at once, exactly one delivers', async () => {
  const l = lab();
  l.start('claude-sonnet-5-5');
  const input = JSON.stringify(edit(l.project, 'src/app.ts'));
  const run = (): Promise<string> =>
    new Promise((done, fail) => {
      const child = spawn(process.execPath, [...NO_NETWORK, CLI, 'hook', 'file-edit'], { env: { PATH: process.env.PATH ?? '', ...l.env } });
      let out = '';
      child.stdout.on('data', (d: Buffer) => (out += d.toString()));
      child.on('error', fail);
      child.on('close', () => done(out));
      child.stdin.end(input);
    });
  const outs = await Promise.all(Array.from({ length: 6 }, run));
  assert.equal(outs.filter((o) => o.includes(VERIFY)).length, 1, outs.join('\n'));
  assert.equal(outs.filter((o) => o === '').length, 5);
  assert.equal(l.log().filter((d) => d.event === 'file-edit').length, 1);
});

test('noonsight report shows what brought each delivery, and the edits that revealed each trigger', () => {
  const l = lab();
  l.start('claude-sonnet-5-5');
  l.fileEdit('src/app.ts');
  l.start('claude-sonnet-5-5', { source: 'compact' });
  const r = runCli(['report', '--json'], l.env, NO_NETWORK);
  assert.equal(r.status, 0, r.stderr);
  const report = JSON.parse(r.stdout);
  const verify = report.rules.find((x: { id: string }) => x.id === 'user/verify');
  assert.deepEqual(verify.brought_by, { 'code-edit': 2 });
  assert.deepEqual(verify.events, { 'file-edit': 1, 'session-start': 1 });
  assert.deepEqual(report.rules.find((x: { id: string }) => x.id === 'sonnet/general').brought_by, { scope: 2 });
  assert.deepEqual(report.triggers, {
    'code-edit': { revealed: 1, delivered: 1, tools: { Edit: 1 }, extensions: { '.ts': 1 }, files: { 'src/app.ts': 1 } },
  });
  assert.deepEqual(report.delivering, { 'session-start': 2, 'file-edit': 1 });

  const text = runCli(['report'], l.env, NO_NETWORK).stdout;
  assert.match(text, /^ {2}user\/verify: 2 deliveries in 1 session, .*\n(?: {5}.*\n)* {5}brought by: code-edit 2$/m);
  assert.doesNotMatch(text, /sonnet\/general[^]*?brought by[^]*?user\/verify/);
  assert.match(text, /^Triggers revealed:\n {2}code-edit: in 1 session, 1 with rules delivered\n {5}tools: Edit 1\n {5}extensions: \.ts 1\n {5}files: src\/app\.ts 1$/m);
});

test('noonsight check names the rules each trigger delivers, or that triggers are off', () => {
  const on = runCli(['check'], { NOONSIGHT_CONFIG: configTree(), NOONSIGHT_PRESETS_DIR: LAB_PRESETS }, NO_NETWORK).stdout;
  assert.match(
    on,
    /^ok: triggers: code-edit, which delivers user\/verify for claude-sonnet-5-5, user\/haiku-verify for claude-haiku-5-5 to a session once it edits a code file its project's git already tracks$/m,
  );
  const off = runCli(['check'], { NOONSIGHT_CONFIG: configTree({ session: { triggers: [] } }), NOONSIGHT_PRESETS_DIR: LAB_PRESETS }, NO_NETWORK).stdout;
  assert.match(off, /^ok: triggers: off \(session\.triggers is empty\), so user\/verify for claude-sonnet-5-5, user\/haiku-verify for claude-haiku-5-5 reach a session only by their scopes$/m);
});

test('the file edit hook leaves foreign input and other tools alone', () => {
  const l = lab();
  l.start('claude-sonnet-5-5');
  assert.equal(l.fileEdit('src/app.ts', { tool_name: 'Read' }).raw, '');
  assert.equal(l.fileEdit('src/app.ts', { hook_event_name: 'PreToolUse' }).raw, '');
  assert.equal(l.hook('file-edit', 'not json').raw, '');
  assert.equal(l.log().length, 1);
});
