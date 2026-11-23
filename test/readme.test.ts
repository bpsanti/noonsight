// The README's path to a first delivered rule, run in a sandbox: every shell block of README.md is
// either run here, line by line, or named below with the reason it is not, so a block added or
// changed without a decision fails. The interactive session the README shows is played by the
// installed hook itself, with the input Claude Code sends at a session's start, and the rules the
// README says the model will name must be the ones it delivers and `noonsight report` then counts.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { validateSchema } from '../src/config/json-schema.js';
import { PACKAGE_ROOT, SCHEMA_DIR } from '../src/config/paths.js';
import { CLI } from './helpers.js';

const README = fs.readFileSync(path.join(PACKAGE_ROOT, 'README.md'), 'utf8');

interface Block {
  readonly lang: string;
  readonly code: string;
  readonly line: number;
}

/** The fenced code blocks of a Markdown text, with their language and first line. */
export function codeBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const open = /^```(\w*)\s*$/.exec(lines[i] ?? '');
    if (!open) continue;
    const start = i;
    const body: string[] = [];
    for (i++; i < lines.length && !/^```\s*$/.test(lines[i] ?? ''); i++) body.push(lines[i] ?? '');
    blocks.push({ lang: open[1] ?? '', code: body.join('\n'), line: start + 1 });
  }
  return blocks;
}

/**
 * The shell blocks this test does not run, each with why. The install from npm would
 * download the published version: the sandbox puts the `noonsight` built from this checkout on PATH
 * in its place, and the package check below covers what the package exposes.
 */
const NOT_RUN: Record<string, string> = {
  'npm install -g noonsight':
    'the install from npm; the sandbox runs this checkout, already built',
  'npm test             # builds, then runs every test with node --test\nnpm run test:live    # real interactive Claude Code sessions; needs claude and expect, sends no prompt':
    'the development commands; this test runs inside the first of them',
};

const shellBlocks = codeBlocks(README).filter((b) => b.lang === 'bash' || b.lang === 'sh');

test('README: every shell block is run here or named with the reason it is not', () => {
  const unknown = shellBlocks.filter((b) => !(b.code in NOT_RUN) && !b.code.split('\n').every((l) => /^noonsight\b/.test(l.trim()) || l.trim() === ''));
  assert.deepEqual(
    unknown.map((b) => `README.md:${b.line}`),
    [],
    'a shell block that is neither noonsight commands nor in NOT_RUN: decide how this test runs it',
  );
  for (const code of Object.keys(NOT_RUN)) assert.ok(shellBlocks.some((b) => b.code === code), `NOT_RUN names a block the README no longer has:\n${code}`);
});

/** A sandbox account: an empty home, `noonsight` on PATH, and a git repository to start sessions in. */
function sandbox(): { home: string; project: string; env: Record<string, string> } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'noonsight-readme-'));
  const home = path.join(root, 'home');
  const bin = path.join(root, 'bin');
  const project = path.join(root, 'project');
  for (const d of [home, bin, project]) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(bin, 'noonsight'), `#!/bin/sh\nexec "${process.execPath}" "${CLI}" "$@"\n`, { mode: 0o755 });
  spawnSync('git', ['init', '-q', project]);
  // No CLAUDE_CONFIG_DIR, NOONSIGHT_* or Claude Code variable of the person running the tests leaks in.
  const env = { PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}`, HOME: home, LANG: 'en_US.UTF-8' };
  return { home, project, env };
}

function sh(command: string, cwd: string, env: Record<string, string>, input?: string): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync('/bin/sh', ['-c', command], { cwd, env, encoding: 'utf8', input: input ?? '' });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

/** The session the README shows: its environment, its model alias, and the rules it says the model names. */
function readmeSession(): { scope: string; alias: string; rules: string[] } {
  const session = codeBlocks(README).find((b) => b.lang === 'text' && /\bclaude --model\b/.test(b.code));
  assert.ok(session, 'the README shows the session it starts');
  const m = /NOONSIGHT_SCOPE=(\w+) claude --model (\w+)/.exec(session.code);
  assert.ok(m, `the session line names a scope and a model: ${session.code}`);
  const named = /The model names ((?:`[^`]+`(?:, | and )?)+)\./.exec(README);
  assert.ok(named, 'the README says which rules the model names');
  return { scope: m[1] as string, alias: m[2] as string, rules: [...(named[1] as string).matchAll(/`([^`]+)`/g)].map((x) => x[1] as string) };
}

test('README: the first delivered rule, from install to report, in a sandbox account', () => {
  const box = sandbox();
  const ran: string[] = [];
  const runBlock = (block: Block): void => {
    for (const line of block.code.split('\n').filter((l) => l.trim() !== '')) {
      const r = sh(line, box.project, box.env);
      assert.equal(r.status, 0, `README.md:${block.line}: \`${line}\` exited ${r.status}\n${r.stdout}${r.stderr}`);
      ran.push(line.trim());
    }
  };
  const blocks = shellBlocks.filter((b) => !(b.code in NOT_RUN));
  const before = blocks.filter((b) => !/^noonsight report\b/.test(b.code.trim()));
  const after = blocks.filter((b) => /^noonsight report\b/.test(b.code.trim()));
  for (const b of before) runBlock(b);

  // The session the README starts, played by the hook Claude Code runs at its start.
  const { scope, alias, rules } = readmeSession();
  const model = `claude-${alias}-5-5`;
  const settings = JSON.parse(fs.readFileSync(path.join(box.home, '.claude', 'settings.json'), 'utf8'));
  const entry = settings.hooks.SessionStart[0].hooks[0] as { command: string; args?: string[] };
  const input = JSON.stringify({ session_id: 'readme-session', transcript_path: path.join(box.home, 't.jsonl'), cwd: box.project, hook_event_name: 'SessionStart', source: 'startup', model });
  const hook = spawnSync(entry.command, entry.args ?? [], { cwd: box.project, env: { ...box.env, NOONSIGHT_SCOPE: scope, CLAUDE_PROJECT_DIR: box.project }, input, encoding: 'utf8' });
  assert.equal(hook.status, 0, hook.stderr);
  assert.ok(hook.stdout.trim(), `the hook delivered nothing: ${hook.stderr}`);
  const context = JSON.parse(hook.stdout).hookSpecificOutput.additionalContext as string;
  assert.match(context, new RegExp(`delivered by noonsight, rules ${rules.join(', ')}\\)`), 'the session receives exactly the rules the README says the model names');

  for (const b of after) runBlock(b);
  const report = sh('noonsight report --json', box.project, box.env);
  const delivered = (JSON.parse(report.stdout).rules as { id: string; deliveries: number }[]).filter((r) => r.deliveries > 0).map((r) => r.id);
  assert.deepEqual(delivered.sort(), [...rules].sort(), 'noonsight report counts the delivery of exactly those rules');

  assert.ok(ran.includes('noonsight install') && ran.includes('noonsight report'), `the README's path runs install and report: ${ran.join('; ')}`);
});

test('README: the resolve example prints the rules the session then receives', () => {
  const box = sandbox();
  const { scope, alias, rules } = readmeSession();
  const resolve = shellBlocks.find((b) => /^noonsight resolve\b/.test(b.code.trim()));
  assert.ok(resolve, 'the README shows noonsight resolve');
  assert.match(resolve.code, new RegExp(`claude-${alias}-5-5 ${scope}\\b`), 'the resolve example asks for the model and scope of the session it shows');
  assert.equal(sh('noonsight init', box.project, box.env).status, 0);
  const decision = JSON.parse(sh(resolve.code.trim(), box.project, box.env).stdout);
  assert.equal(decision.status, 'matched');
  assert.deepEqual(decision.rules, rules);
});

/** The configuration examples the README and docs/usage.md show, each with the file it is for. */
const CONFIG_DOCS = ['README.md', 'docs/usage.md'];
const MACHINE_FILE = '~/.config/noonsight/noonsight.json';
const PROJECT_FILE = '.noonsight/noonsight.json';

interface ConfigExample {
  readonly where: string;
  readonly kind: 'machine' | 'project';
  readonly config: any;
}

/**
 * Every JSON block of the documents, placed by the file the text between it and the block before
 * names last: an example that names neither file fails, so a reader always knows where it goes.
 */
function configExamples(): ConfigExample[] {
  const examples: ConfigExample[] = [];
  for (const doc of CONFIG_DOCS) {
    const text = fs.readFileSync(path.join(PACKAGE_ROOT, doc), 'utf8');
    const lines = text.split('\n');
    let previousEnd = 0;
    for (const block of codeBlocks(text)) {
      const lead = lines.slice(previousEnd, block.line - 1).join('\n');
      previousEnd = block.line + block.code.split('\n').length + 1;
      if (block.lang !== 'json') continue;
      const where = `${doc}:${block.line}`;
      const machineAt = lead.lastIndexOf(MACHINE_FILE);
      const projectAt = lead.lastIndexOf(PROJECT_FILE);
      assert.ok(machineAt >= 0 || projectAt >= 0, `${where}: the text before a configuration example names the file it goes in`);
      examples.push({ where, kind: machineAt > projectAt ? 'machine' : 'project', config: JSON.parse(block.code) });
    }
  }
  return examples;
}

/** Writes a placeholder for each rule file a configuration names, relative to the configuration's directory. */
function writeRuleFiles(config: any, dir: string): void {
  const rules = [...Object.values<any>(config.models ?? {}).flatMap((m) => m.add ?? []), ...(config.all_models?.add ?? [])];
  for (const rule of rules) {
    const file = path.resolve(dir, rule.file);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `Placeholder text of ${rule.id}.\n`);
  }
}

test('README and docs/usage.md: every configuration example passes noonsight check', () => {
  const examples = configExamples();
  assert.ok(examples.some((e) => e.where.startsWith('README.md') && e.kind === 'machine'), 'the README shows a machine configuration');
  assert.ok(examples.some((e) => e.where.startsWith('README.md') && e.kind === 'project'), 'the README shows a repository configuration');
  const schemas = {
    machine: JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, 'noonsight.schema.json'), 'utf8')),
    project: JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, 'noonsight-project.schema.json'), 'utf8')),
  };
  const preset = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'presets', 'claude', 'preset.json'), 'utf8'));
  for (const example of examples) {
    assert.deepEqual(validateSchema(schemas[example.kind], example.config), [], `${example.where}: the example satisfies the ${example.kind} schema`);
    if (example.config.preset_version !== undefined) assert.equal(example.config.preset_version, preset.version, `${example.where}: preset_version is the shipped preset's`);

    const box = sandbox();
    assert.equal(sh('noonsight install', box.project, box.env).status, 0);
    const machineFile = path.join(box.home, '.config', 'noonsight', 'noonsight.json');
    const file = example.kind === 'machine' ? machineFile : path.join(box.project, '.noonsight', 'noonsight.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(example.config, null, 2));
    writeRuleFiles(example.config, path.dirname(file));
    if (example.kind === 'project') {
      const trust = sh('noonsight trust', box.project, box.env);
      assert.equal(trust.status, 0, `${example.where}: noonsight trust exited ${trust.status}\n${trust.stdout}${trust.stderr}`);
    }
    const check = sh('noonsight check', box.project, box.env);
    const problems = `${check.stdout}${check.stderr}`.split('\n').filter((l) => /^(problem|error)\b/.test(l));
    assert.deepEqual(problems, [], `${example.where}: noonsight check reports no problem`);
    assert.equal(check.status, 0, `${example.where}: noonsight check exited ${check.status}\n${check.stdout}${check.stderr}`);

    // noonsight models, run where the sessions run, lists every rule the example adds.
    const models = sh('noonsight models --json', box.project, box.env);
    assert.equal(models.status, 0, `${example.where}: noonsight models exited ${models.status}\n${models.stderr}`);
    for (const rule of [...Object.values<any>(example.config.models ?? {}).flatMap((m) => m.add ?? []), ...(example.config.all_models?.add ?? [])])
      assert.ok(models.stdout.includes(`"${rule.id}"`), `${example.where}: noonsight models lists ${rule.id}`);
  }
});

test('the package holds what the README\'s commands need once installed from npm', () => {
  const r = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: PACKAGE_ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const files = new Set((JSON.parse(r.stdout)[0].files as { path: string }[]).map((f) => f.path));
  for (const f of ['README.md', 'dist/src/cli.js', 'presets/claude/preset.json', 'schema/noonsight.schema.json', 'schema/noonsight-project.schema.json']) assert.ok(files.has(f), `the package lacks ${f}`);
  const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.bin.noonsight, 'dist/src/cli.js');
});

/** A preset rule's row in the README's table of the preset's rules, written from preset.json. */
function presetRow(r: { id: string; scopes: string[]; where: string[]; triggers?: string[]; enabled?: boolean }): string {
  const code = (xs: readonly string[]): string => xs.map((x) => `\`${x}\``).join(', ');
  const scopes = r.scopes.includes('*') ? 'every scope' : code(r.scopes);
  return `| \`${r.id}\` | ${scopes} | ${code(r.where)} | ${r.triggers?.length ? code(r.triggers) : 'none'} | ${r.enabled === false ? 'off' : 'on'} |`;
}

test('README: the table of the preset\'s rules gives every rule of preset.json, in its order, with its scopes, places, triggers and whether it ships on', () => {
  const preset = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'presets', 'claude', 'preset.json'), 'utf8'));
  const expected = Object.values<any>(preset.models).flatMap((m) => m.rules.map(presetRow));
  const section = README.slice(README.indexOf("## The preset's rules"), README.indexOf('\n## ', README.indexOf("## The preset's rules") + 1));
  const rows = section.split('\n').filter((l) => /^\| `[a-z0-9-]+\/[a-z0-9-]+` \|/.test(l));
  assert.deepEqual(rows, expected);
  // The count the README gives of the rules for attended sessions.
  const rules = Object.values<any>(preset.models).flatMap((m) => m.rules as { where: string[] }[]);
  const attended = rules.filter((r) => r.where.includes('attended')).length;
  assert.ok(README.includes(`${attended} of its ${rules.length} rules list \`attended\``), `the README gives ${attended} of ${rules.length} rules for attended sessions`);
});
