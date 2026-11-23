// Where the agent call hook reads subagent definitions, and which one wins when several places define a
// name: managed, --agents, project (then --add-dir), user, and plugins. The order follows Claude Code
// 2.1.330, as a stub session recorded it (docs/verification/claude-code.md).

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { definitionFinder, type Lookup } from '../src/adapters/claude-code/definitions.js';
import type { CommandLine } from '../src/adapters/claude-code/launch.js';
import { FIXTURES, hookHome, hookInput, NO_NETWORK, CLI, runProgram, tempTree } from './helpers.js';

const agent = (name: string | null, model: string | null, extra = ''): string =>
  `---\n${name !== null ? `name: ${name}\n` : ''}description: A test agent.\n${model !== null ? `model: ${model}\n` : ''}${extra}---\nDo the task.\n`;

interface World {
  readonly repo: string;
  readonly configDir: string;
  readonly system: string;
}

function world(files: { repo?: Record<string, unknown>; config?: Record<string, unknown>; managed?: Record<string, unknown> } = {}): World {
  const repo = tempTree({ '.git/HEAD': 'ref: refs/heads/main\n', ...(files.repo ?? {}) });
  const configDir = tempTree(files.config ?? {});
  const system = tempTree(
    Object.fromEntries(Object.entries(files.managed ?? {}).map(([k, v]) => [path.join('Library', 'Application Support', 'ClaudeCode', k), v])),
  );
  if (process.platform === 'linux')
    for (const [k, v] of Object.entries(files.managed ?? {})) {
      const f = path.join(system, 'etc', 'claude-code', k);
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, typeof v === 'string' ? v : JSON.stringify(v));
    }
  return { repo, configDir, system };
}

function find(w: World, name: string, args: readonly string[] | null = null, env: Record<string, string> = {}, exact = true): Lookup {
  const cmd: CommandLine | null = args === null ? null : { args: ['claude', ...args], exact };
  return definitionFinder({ projectDir: w.repo, configDir: w.configDir, env: { NOONSIGHT_SYSTEM_ROOT: w.system, ...env }, commandLine: () => cmd })(name);
}

/** What a lookup found, in short: the model and source of a definition, none, or unread. */
function short(l: Lookup): unknown[] {
  if (l.kind === 'found') return [l.definition.model, l.definition.source];
  if (l.kind === 'unread') return ['unread'];
  return ['none'];
}

test('managed definitions outrank --agents, which outranks the project, which outranks the user', () => {
  const w = world({
    managed: { '.claude/agents/m.md': agent('ranked', 'fable') },
    repo: { '.claude/agents/r.md': agent('ranked', 'sonnet'), '.claude/agents/p.md': agent('project-only', 'opus') },
    config: { 'agents/r.md': agent('ranked', 'haiku'), 'agents/u.md': agent('user-only', 'haiku') },
  });
  const flag = ['--agents', JSON.stringify({ ranked: { description: 'd', prompt: 'p', model: 'opus' }, 'flag-only': { description: 'd', prompt: 'p', model: 'sonnet', effort: 'low' } })];
  assert.deepEqual(short(find(w, 'ranked', flag)), ['fable', 'managed']);
  assert.deepEqual(short(find(w, 'flag-only', flag)), ['sonnet', 'flag']);
  const flagged = find(w, 'flag-only', flag);
  assert.equal(flagged.kind === 'found' ? flagged.definition.effort : null, 'low');
  assert.deepEqual(short(find(w, 'project-only', flag)), ['opus', 'project']);
  assert.deepEqual(short(find(w, 'user-only', flag)), ['haiku', 'user']);
  // Without the managed definition, --agents decides; without --agents, the project's.
  const unmanaged = { ...w, system: tempTree({}) };
  assert.deepEqual(short(find(unmanaged, 'ranked', flag)), ['opus', 'flag']);
  assert.deepEqual(short(find(unmanaged, 'ranked')), ['sonnet', 'project']);
  assert.deepEqual(short(find(unmanaged, 'nobody')), ['none']);
});

test('--agents is read as Claude Code takes it: inline JSON, a JSON file, or text ps printed without argument boundaries', () => {
  const w = world();
  const file = path.join(tempTree({ 'agents.json': { helper: { description: 'd', prompt: 'p', model: 'haiku' } } }), 'agents.json');
  assert.deepEqual(short(find(w, 'helper', ['-p', 'go', '--agents', file])), ['haiku', 'flag']);
  assert.deepEqual(short(find(w, 'helper', ['--agents={"helper":{"model":"opus"}}'])), ['opus', 'flag']);
  // ps on macOS joins the arguments with spaces and writes a newline as \012.
  const loose = ['-p', 'go', '--agents', '{\\012', '"helper":', '{"description":', '"two', 'words",', '"model":', '"sonnet"}\\012}', '--model', 'opus'];
  assert.deepEqual(short(find(w, 'helper', loose, {}, false)), ['sonnet', 'flag']);
  // A value that cannot be read leaves every name it might define unread, rather than guessed.
  assert.deepEqual(short(find(w, 'helper', ['--agents', '{"helper": '])), ['unread']);
  assert.deepEqual(short(find(w, 'helper', ['--agents', path.join(w.repo, 'missing.json')])), ['unread']);
  const twice = ['-p', 'compare --agents {"helper":{"model":"opus"}} with', '--agents', '{"helper":{"model":"haiku"}}'];
  assert.deepEqual(short(find(w, 'helper', twice.join(' ').split(' '), {}, false)), ['unread'], 'two values on a command line without boundaries cannot be told apart');
  assert.deepEqual(short(find(w, 'helper', twice)), ['haiku', 'flag'], 'with boundaries, the option is the option');
});

test('project folders: the closest first up to the repository root, then each --add-dir; --setting-sources leaves out what it does not list', () => {
  const added = tempTree({ '.claude/agents/a.md': agent('added', 'fable'), '.claude/agents/s.md': agent('shadowed', 'haiku') });
  const w = world({
    repo: { '.claude/agents/s.md': agent('shadowed', 'opus'), '.claude/agents/p.md': agent('proj', 'sonnet') },
    config: { 'agents/u.md': agent('mine', 'haiku') },
  });
  assert.deepEqual(short(find(w, 'added', ['--add-dir', added, path.join(added, 'missing')])), ['fable', 'project']);
  assert.deepEqual(short(find(w, 'added', [`--add-dir=${added}`])), ['fable', 'project']);
  assert.deepEqual(short(find(w, 'shadowed', ['--add-dir', added])), ['opus', 'project'], "the project's own folder outranks an added directory's");
  assert.deepEqual(short(find(w, 'proj', ['--setting-sources', 'user'])), ['none']);
  assert.deepEqual(short(find(w, 'mine', ['--setting-sources', 'project,local'])), ['none']);
  assert.deepEqual(short(find(w, 'mine', ['--setting-sources', 'user,project'])), ['haiku', 'user']);
});

test('plugins given with --plugin-dir or CLAUDE_CODE_PLUGIN_DIRS: names carry the plugin, its subfolders and the frontmatter name or file name', () => {
  const kit = tempTree({
    '.claude-plugin/plugin.json': { name: 'kit' },
    'agents/rev.md': agent('reviewer', 'haiku'),
    'agents/deep/scan.md': agent(null, 'fable'),
    'agents/same.md': agent('same', 'inherit'),
  });
  const listed = tempTree({ '.claude-plugin/plugin.json': { name: 'listed', agents: ['./custom/x.md'] }, 'custom/x.md': agent('x', 'sonnet'), 'agents/ignored.md': agent('ignored', 'haiku') });
  const bare = tempTree({ 'agents/b.md': agent('b', 'opus') });
  const w = world();
  const args = ['--plugin-dir', kit, '--plugin-dir-no-mcp', listed];
  assert.deepEqual(short(find(w, 'kit:reviewer', args)), ['haiku', 'plugin']);
  assert.deepEqual(short(find(w, 'kit:deep:scan', args)), ['fable', 'plugin']);
  assert.deepEqual(short(find(w, 'kit:same', args)), ['inherit', 'plugin']);
  assert.deepEqual(short(find(w, 'listed:x', args)), ['sonnet', 'plugin']);
  assert.deepEqual(short(find(w, 'listed:ignored', args)), ['unread'], 'a manifest that lists its agents replaces the agents/ folder');
  assert.deepEqual(short(find(w, `${path.basename(bare)}:b`, [], { CLAUDE_CODE_PLUGIN_DIRS: `${bare}${path.delimiter}${kit}` })), ['opus', 'plugin'], 'a plugin without a manifest is named after its folder');
  assert.deepEqual(short(find(w, 'other:reviewer', args)), ['unread'], 'a plugin noonsight does not read');
  // Two plugins of one name that define the agent differently: Claude Code loads one, noonsight cannot tell which.
  const twin = tempTree({ '.claude-plugin/plugin.json': { name: 'kit' }, 'agents/rev.md': agent('reviewer', 'opus') });
  assert.deepEqual(short(find(w, 'kit:reviewer', [...args, '--plugin-dir', twin])), ['unread']);
});

test('plugins installed from a marketplace: those the settings enable, and a project install only in its own project', () => {
  const cache = tempTree({
    'kit/.claude-plugin/plugin.json': { name: 'kit' },
    'kit/agents/rev.md': agent('reviewer', 'haiku'),
    'local/.claude-plugin/plugin.json': { name: 'localkit' },
    'local/agents/a.md': agent('a', 'fable'),
    'off/.claude-plugin/plugin.json': { name: 'offkit' },
    'off/agents/a.md': agent('a', 'sonnet'),
  });
  const w = world({ repo: { '.claude/settings.local.json': { enabledPlugins: { 'offkit@mkt': false } } } });
  const install = (scope: string, dir: string, projectPath?: string) => [{ scope, installPath: path.join(cache, dir), version: '1.0.0', ...(projectPath !== undefined ? { projectPath } : {}) }];
  fs.mkdirSync(path.join(w.configDir, 'plugins'), { recursive: true });
  fs.writeFileSync(
    path.join(w.configDir, 'plugins', 'installed_plugins.json'),
    JSON.stringify({
      version: 2,
      plugins: { 'kit@mkt': install('user', 'kit'), 'localkit@mkt': install('project', 'local', w.repo), 'offkit@mkt': install('user', 'off') },
    }),
  );
  fs.writeFileSync(path.join(w.configDir, 'settings.json'), JSON.stringify({ enabledPlugins: { 'kit@mkt': true, 'offkit@mkt': true } }));
  fs.mkdirSync(path.join(w.repo, '.claude'), { recursive: true });
  fs.writeFileSync(path.join(w.repo, '.claude', 'settings.json'), JSON.stringify({ enabledPlugins: { 'localkit@mkt': true } }));
  assert.deepEqual(short(find(w, 'kit:reviewer')), ['haiku', 'plugin']);
  assert.deepEqual(short(find(w, 'localkit:a')), ['fable', 'plugin']);
  assert.deepEqual(short(find(w, 'offkit:a')), ['unread'], 'the local settings turn the plugin off');
  assert.deepEqual(short(find(w, 'kit:reviewer', ['--settings', JSON.stringify({ enabledPlugins: { 'kit@mkt': false } })])), ['unread'], '--settings has the last word');
  const elsewhere = { ...w, repo: tempTree({ '.git/HEAD': '' }) };
  assert.deepEqual(short(find(elsewhere, 'localkit:a')), ['unread'], 'a project install does not reach another project');
});

// The hook itself, run as the child of a stand-in for claude whose command line holds --agents and
// --plugin-dir: the prediction follows the definitions, and the log says where each came from.
test('the agent call hook predicts a subagent from --agents and a plugin given on the claude command line', () => {
  const kit = tempTree({ '.claude-plugin/plugin.json': { name: 'kit' }, 'agents/rev.md': agent('reviewer', 'haiku') });
  const h = hookHome();
  assert.equal(h.hook('session-start', hookInput('session-start-startup', { session_id: 'sess-defs', model: 'claude-sonnet-5-5' })).status, 0);
  const claudeArgs = ['--agents', JSON.stringify({ helper: { description: 'Helps', prompt: 'Help.', model: 'haiku' } }), '--plugin-dir', kit];
  const callAs = (type: string, id: string): Record<string, any> => {
    const recorded = JSON.parse(hookInput('pre-tool-use-agent')) as Record<string, any>;
    const input = JSON.stringify({ ...recorded, session_id: 'sess-defs', tool_use_id: id, tool_input: { ...recorded.tool_input, subagent_type: type, model: undefined } });
    const hook = [process.execPath, ...NO_NETWORK, CLI, 'hook', 'agent-call'];
    const r = runProgram(process.execPath, [path.join(FIXTURES, 'fake-claude.cjs'), ...claudeArgs], { ...h.env, NOONSIGHT_FAKE_HOOK: JSON.stringify(hook) }, input);
    assert.equal(r.status, 0);
    assert.equal(r.stderr, '', r.stderr);
    return h.log().at(-1) ?? {};
  };
  const helper = callAs('helper', 'toolu_flag');
  assert.deepEqual([helper.model, helper.model_source, helper.definition, helper.definition_source], ['claude-haiku-5-5', 'definition', '--agents', 'flag']);
  const reviewer = callAs('kit:reviewer', 'toolu_plugin');
  assert.deepEqual([reviewer.model, reviewer.model_source, reviewer.definition_source], ['claude-haiku-5-5', 'definition', 'plugin']);
  const unknown = callAs('other:reviewer', 'toolu_unread');
  assert.deepEqual([unknown.model, unknown.model_source, unknown.definition], ['claude-sonnet-5-5', 'parent', 'not-read']);
  assert.match(unknown.definition_why, /no plugin noonsight reads defines other:reviewer/);
});
