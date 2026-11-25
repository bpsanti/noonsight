// noonsight as a Claude Code plugin: the generated files, the launcher, the first configuration, the
// messages, and what check, install, uninstall and watch make of it.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { LAUNCHER, pluginFiles } from '../src/adapters/claude-code/plugin-files.js';
import { noonsightPlugins, runsFromPlugin } from '../src/adapters/claude-code/plugins.js';
import { HOOK_HANDLERS, matcherOf } from '../src/adapters/claude-code/settings.js';
import { CLI_FILE, PACKAGE_ROOT } from '../src/config/paths.js';
import { forPlugin, SKILL_COMMANDS } from '../src/wording.js';
import { fakeClaude, hookInput, LAB_CONFIG, LAB_PRESETS, NO_NETWORK, runCli, tempTree } from './helpers.js';

const read = (rel: string): string => fs.readFileSync(path.join(PACKAGE_ROOT, rel), 'utf8');
const VERSION = (JSON.parse(read('package.json')) as { version: string }).version;

test('the committed plugin files are the generated ones (npm run plugin-files)', () => {
  const files = pluginFiles(VERSION);
  for (const [rel, content] of Object.entries(files)) assert.equal(read(rel), content, rel);
  assert.deepEqual(
    fs.readdirSync(path.join(PACKAGE_ROOT, 'skills')).sort(),
    Object.keys(files).filter((f) => f.startsWith('skills/')).map((f) => f.split('/')[1]).sort(),
  );
});

test('package.json, package-lock.json, plugin.json and the marketplace entry carry one version', () => {
  const plugin = JSON.parse(read('.claude-plugin/plugin.json')) as { version: string };
  const market = JSON.parse(read('.claude-plugin/marketplace.json')) as { plugins: { version?: string; source: { version: string; package: string } }[] };
  const pkg = JSON.parse(read('package.json')) as { name: string };
  assert.equal(plugin.version, VERSION);
  assert.deepEqual(market.plugins.map((p) => [p.source.package, p.source.version]), [[pkg.name, VERSION]]);
  // The plugin.json of the package decides; a second version in the entry could only disagree.
  assert.equal(market.plugins[0]?.version, undefined);
  assert.equal((JSON.parse(read('package-lock.json')) as { version: string }).version, VERSION);
});

test('hooks.json holds one entry per hook of the settings install, with its event, matcher and argument', () => {
  const hooks = (JSON.parse(read('hooks/hooks.json')) as { hooks: Record<string, { matcher?: string; hooks: { args: string[] }[] }[]> }).hooks;
  const entries = Object.entries(hooks).flatMap(([event, groups]) => groups.map((g) => [event, g.matcher, g.hooks[0]?.args.at(-1)]));
  const key = (e: unknown[]): string => JSON.stringify(e);
  assert.deepEqual(entries.map(key).sort(), HOOK_HANDLERS.map((h) => key([h.event, matcherOf(h), h.arg])).sort());
});

test('the npm package carries everything the plugin runs', () => {
  const files = (JSON.parse(read('package.json')) as { files: string[] }).files;
  for (const f of ['dist/src', 'presets', 'schema', '.claude-plugin', 'hooks', 'scripts', 'skills']) assert.ok(files.includes(f), f);
  assert.ok(fs.statSync(path.join(PACKAGE_ROOT, LAUNCHER)).mode & 0o100);
});

test('npm would publish the package, with the files the command line, the hooks, the presets and the plugin read, and no others', () => {
  const pkg = JSON.parse(read('package.json')) as { private?: boolean; publishConfig: { access: string }; bin: Record<string, string> };
  assert.equal(pkg.private, undefined);
  assert.equal(pkg.publishConfig.access, 'public');
  // --ignore-scripts: prepack would rebuild the dist/ the tests are running from.
  const r = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { cwd: PACKAGE_ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  // An array up to npm 11, and an object by package name after it.
  const out = JSON.parse(r.stdout) as Record<string, { files: { path: string }[] }>;
  const packed = (Object.values(out)[0]?.files ?? []).map((f) => f.path);
  const under = (dir: string): string[] =>
    fs.readdirSync(path.join(PACKAGE_ROOT, dir), { recursive: true, encoding: 'utf8' })
      .map((f) => path.join(dir, f))
      .filter((f) => fs.statSync(path.join(PACKAGE_ROOT, f)).isFile());
  const expected = [
    'LICENSE', 'README.md', 'package.json', LAUNCHER,
    ...['.claude-plugin', 'hooks', 'presets', 'schema', 'skills'].flatMap(under),
    ...under('src').map((f) => `dist/${f.replace(/\.ts$/, '.js')}`),
  ];
  assert.deepEqual(packed.sort(), expected.sort(), 'dist/ left over from a removed source file? Run `npm run clean`');
  for (const bin of Object.values(pkg.bin)) assert.ok(packed.includes(bin), bin);
});

test('tools/plugin-folder.mjs writes a folder that delivers rules, with no lockfile and no relative README link left', () => {
  const out = path.join(tempTree({}), 'plugin');
  const r = spawnSync(process.execPath, [path.join(PACKAGE_ROOT, 'tools', 'plugin-folder.mjs'), out], { cwd: PACKAGE_ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.existsSync(path.join(out, 'package-lock.json')), false, 'a lockfile makes Claude Code install packages');
  for (const f of ['LICENSE', '.claude-plugin/plugin.json', '.claude-plugin/icon.png']) assert.ok(fs.existsSync(path.join(out, f)), f);
  const links = [...fs.readFileSync(path.join(out, 'README.md'), 'utf8').matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1] as string);
  assert.deepEqual(links.filter((l) => !/^(#|https:\/\/)/.test(l)), []);
  assert.ok(links.includes(`https://github.com/bpsanti/noonsight/blob/v${VERSION}/docs/privacy.md`));
  const hook = spawnSync('/bin/sh', [path.join(out, LAUNCHER), 'hook', 'session-start'], {
    encoding: 'utf8',
    input: unattended('folder'),
    env: { PATH: process.env.PATH, HOME: tempTree({}), NOONSIGHT_NODE: process.execPath, NOONSIGHT_SYSTEM_ROOT: tempTree({}), CLAUDE_CODE_SESSION_ATTENDED: '0' },
  });
  assert.match(hook.stdout, /haiku-5-5\/carry-through/);
  assert.equal(spawnSync(process.execPath, [path.join(PACKAGE_ROOT, 'tools', 'plugin-folder.mjs'), out]).status, 1, 'a folder with files is left alone');
});

test('messages name the commands a plugin has: its skills, and npx for the rest', () => {
  assert.equal(forPlugin('Run `noonsight check` now, or `noonsight trust` there.'), 'Run `/noonsight:check` now, or `/noonsight:trust` there.');
  assert.equal(forPlugin('`noonsight init`, `noonsight install --account /x`'), '`/noonsight:setup`, `npx noonsight install --account /x`');
  assert.equal(forPlugin('noonsight check, and the `noonsight` command'), 'noonsight check, and the `noonsight` command');
  for (const c of SKILL_COMMANDS) assert.ok(fs.existsSync(path.join(PACKAGE_ROOT, 'skills', c, 'SKILL.md')), c);
});

// ---------------------------------------------------------------------------------------------
// The hook under --install plugin.

function pluginHome(files: Record<string, unknown> = {}) {
  const home = tempTree(files);
  const env = { HOME: home, NOONSIGHT_SYSTEM_ROOT: tempTree({}) };
  const hook = (kind: string, event: string, input: string, extra: Record<string, string> = {}) => {
    const r = runCli(['hook', '--install', kind, event], { ...env, ...extra }, NO_NETWORK, input);
    assert.equal(r.stderr, '');
    assert.equal(r.status, 0);
    return r.stdout ? (JSON.parse(r.stdout) as Record<string, any>) : null;
  };
  const log = (): Record<string, any>[] =>
    fs.readFileSync(path.join(home, '.local', 'state', 'noonsight', 'decisions.jsonl'), 'utf8').trimEnd().split('\n').map((l) => JSON.parse(l));
  return { home, env, hook, log, config: path.join(home, '.config', 'noonsight', 'noonsight.json') };
}

const unattended = (id: string): string => hookInput('session-start-startup', { session_id: id, model: 'claude-haiku-5-5' });

test('the first session under the plugin writes the configuration, says so once, and delivers', () => {
  const h = pluginHome();
  const first = h.hook('plugin', 'session-start', unattended('a'), { CLAUDE_CODE_SESSION_ATTENDED: '0' });
  assert.match(first?.systemMessage, /no configuration was found, so .*noonsight\.json was written from the preset/);
  assert.match(first?.systemMessage, /Run `\/noonsight:check`/);
  assert.match(first?.hookSpecificOutput.additionalContext, /haiku-5-5\/carry-through/);
  assert.equal(JSON.parse(fs.readFileSync(h.config, 'utf8')).preset, 'claude');
  assert.deepEqual([h.log()[0]?.install, h.log()[0]?.config_written], ['plugin', true]);

  const written = fs.readFileSync(h.config, 'utf8');
  const second = h.hook('plugin', 'session-start', unattended('b'), { CLAUDE_CODE_SESSION_ATTENDED: '0' });
  assert.equal(second?.systemMessage, undefined);
  assert.match(second?.hookSpecificOutput.additionalContext, /haiku-5-5\/carry-through/);
  assert.equal(fs.readFileSync(h.config, 'utf8'), written);
  assert.deepEqual(fs.readdirSync(path.dirname(h.config)), ['noonsight.json'], 'no temporary file is left');
});

test('only a session start under the plugin writes the configuration, and NOONSIGHT_CONFIG is never created', () => {
  const h = pluginHome();
  assert.equal(h.hook('account', 'session-start', unattended('a')), null);
  assert.equal(h.hook('plugin', 'model-switch', hookInput('model-switch-command')), null);
  assert.equal(fs.existsSync(h.config), false);
  // The account copy, which does nothing without a configuration, leaves the same start to the plugin.
  assert.match(h.hook('plugin', 'session-start', unattended('a'))?.systemMessage, /was written from the preset/);

  const missing = path.join(h.home, 'elsewhere.json');
  const out = h.hook('plugin', 'session-start', unattended('c'), { NOONSIGHT_CONFIG: missing });
  assert.match(out?.systemMessage, /was refused .*Run `\/noonsight:check`/);
  assert.equal(fs.existsSync(missing), false);
});

test('the same warning names noonsight check for a settings install', () => {
  const h = pluginHome({ '.config/noonsight/noonsight.json': { version: 9 } });
  assert.match(h.hook('account', 'session-start', unattended('a'))?.systemMessage, /Run `noonsight check`/);
});

test('the hook under the plugin records the Node.js it runs on, and keeps one that still runs', () => {
  const h = pluginHome({ '.config/noonsight/noonsight.json': JSON.parse(fs.readFileSync(LAB_CONFIG, 'utf8')) as unknown });
  const file = path.join(h.home, '.local', 'share', 'noonsight', 'node');
  h.hook('account', 'session-start', unattended('a'));
  assert.equal(fs.existsSync(file), false, 'only the plugin looks for Node.js there');
  h.hook('plugin', 'session-start', unattended('b'));
  assert.equal(fs.readFileSync(file, 'utf8'), `${process.execPath}\n`);
  fs.writeFileSync(file, '/bin/sh\n');
  h.hook('plugin', 'session-start', unattended('c'));
  assert.equal(fs.readFileSync(file, 'utf8'), '/bin/sh\n');
  fs.writeFileSync(file, '/nowhere/node\n');
  h.hook('plugin', 'session-start', unattended('d'));
  assert.equal(fs.readFileSync(file, 'utf8'), `${process.execPath}\n`);
});

// ---------------------------------------------------------------------------------------------
// The launcher.

/** A plugin folder as Claude Code caches it, whose noonsight prints its arguments. */
function pluginFolder(): string {
  const root = path.join(tempTree({}), 'a folder', 'plugins', 'cache', 'noonsight', 'noonsight', '0.1.0');
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'dist', 'src'), { recursive: true });
  // Not executable: the hooks run it through /bin/sh.
  fs.writeFileSync(path.join(root, LAUNCHER), read(LAUNCHER), { mode: 0o644 });
  fs.writeFileSync(path.join(root, 'dist', 'src', 'cli.js'), 'console.log(JSON.stringify([process.execPath, process.env.CLAUDE_PLUGIN_ROOT ?? null, ...process.argv.slice(2)]))');
  return root;
}

/** Whether this machine has a Node.js in a folder the launcher searches and a test cannot hide. */
const SYSTEM_NODE = ['/opt/homebrew/bin/node', '/usr/local/bin/node', '/usr/bin/node', '/snap/bin/node'].some((f) => fs.existsSync(f));

function launch(root: string, args: readonly string[], env: Record<string, string>) {
  const r = spawnSync('/bin/sh', [path.join(root, LAUNCHER), ...args], { env: { PATH: '/usr/bin:/bin', ...env }, input: '{}', encoding: 'utf8' });
  return { status: r.status, out: r.stdout, err: r.stderr, args: r.stdout.startsWith('[') ? (JSON.parse(r.stdout) as (string | null)[]) : null };
}

/** A home directory with a Node.js that is this one, at a path under it. */
function nodeAt(rel: string): string {
  const home = tempTree({});
  fs.mkdirSync(path.dirname(path.join(home, rel)), { recursive: true });
  fs.symlinkSync(process.execPath, path.join(home, rel));
  return home;
}

test('the launcher runs a hook event with --install plugin, and a command as it is', () => {
  const root = pluginFolder();
  const env = { HOME: tempTree({}), NOONSIGHT_NODE: process.execPath };
  assert.deepEqual(launch(root, ['hook', 'session-start'], env).args?.slice(2), ['hook', '--install', 'plugin', 'session-start']);
  const command = launch(root, ['resolve', 'claude-opus-5-5', 'a b'], env).args;
  assert.deepEqual(command?.slice(2), ['resolve', 'claude-opus-5-5', 'a b']);
  assert.equal(fs.realpathSync(String(command?.[1])), fs.realpathSync(root), 'the command knows the plugin it runs from');
});

test('the launcher finds Node.js on PATH, recorded by an earlier hook, or in the folders it is usually in', { skip: SYSTEM_NODE && 'a system Node.js comes first here' }, () => {
  const root = pluginFolder();
  const ran = (env: Record<string, string>): string => fs.realpathSync(String(launch(root, ['hook', 'session-start'], env).args?.[0]));
  const real = fs.realpathSync(process.execPath);
  assert.equal(ran({ HOME: tempTree({}), PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin` }), real);
  assert.equal(ran({ HOME: tempTree({ '.local/share/noonsight/node': `${process.execPath}\n` }) }), real);
  for (const rel of ['.nvm/versions/node/v22.1.0/bin/node', '.volta/bin/node', '.asdf/installs/nodejs/22.1.0/bin/node', '.local/share/mise/installs/node/22/bin/node', '.local/share/fnm/node-versions/v22/installation/bin/node'])
    assert.equal(ran({ HOME: nodeAt(rel) }), real, rel);
});

test('the launcher passes over a Node.js that is too old, and a recorded one that is gone', { skip: SYSTEM_NODE && 'a system Node.js comes first here' }, () => {
  const root = pluginFolder();
  const home = nodeAt('.volta/bin/node');
  const old = path.join(tempTree({}), 'node');
  fs.writeFileSync(old, '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  fs.mkdirSync(path.join(home, '.local', 'share', 'noonsight'), { recursive: true });
  fs.writeFileSync(path.join(home, '.local', 'share', 'noonsight', 'node'), '/nowhere/node\n');
  const r = launch(root, ['hook', 'session-start'], { HOME: home, PATH: `${path.dirname(old)}:/usr/bin:/bin` });
  assert.equal(fs.realpathSync(String(r.args?.[0])), fs.realpathSync(process.execPath));
});

test('with no Node.js, only the session start says so, and every hook exits 0', { skip: SYSTEM_NODE && 'a system Node.js comes first here' }, () => {
  const root = pluginFolder();
  const env = { HOME: tempTree({}) };
  const start = launch(root, ['hook', 'session-start'], env);
  assert.equal(start.status, 0);
  assert.match((JSON.parse(start.out) as { systemMessage: string }).systemMessage, /found no Node\.js 20 or newer/);
  for (const h of HOOK_HANDLERS.filter((x) => x.arg !== 'session-start')) {
    const r = launch(root, ['hook', h.arg], env);
    assert.deepEqual([r.status, r.out, r.err], [0, '', ''], h.arg);
  }
  assert.equal(launch(root, ['hook', 'session-start'], { ...env, NOONSIGHT_DISABLE: '1' }).out, '');
  const command = launch(root, ['check'], env);
  assert.equal(command.status, 1);
  assert.match(command.err, /no Node\.js 20 or newer/);
});

test('a hook whose plugin folder was deleted exits 0 in silence', () => {
  const root = pluginFolder();
  fs.rmSync(path.join(root, 'dist'), { recursive: true });
  const r = launch(root, ['hook', 'session-start'], { HOME: tempTree({}), NOONSIGHT_NODE: process.execPath });
  assert.deepEqual([r.status, r.out, r.err], [0, '', '']);
});

// ---------------------------------------------------------------------------------------------
// check, install, uninstall and watch.

/** Record noonsight's plugin in a login, as Claude Code does. */
function addPlugin(configDir: string, opts: { version?: string; enabled?: boolean; folder?: boolean; scope?: string; projectPath?: string } = {}): string {
  const version = opts.version ?? VERSION;
  const root = path.join(configDir, 'plugins', 'cache', 'noonsight', 'noonsight', version);
  if (opts.folder !== false) {
    fs.mkdirSync(path.join(root, 'dist', 'src'), { recursive: true });
    fs.mkdirSync(path.join(root, '.claude-plugin'), { recursive: true });
    fs.writeFileSync(path.join(root, 'dist', 'src', 'cli.js'), '');
    fs.writeFileSync(path.join(root, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'noonsight', version }));
  }
  fs.mkdirSync(path.join(configDir, 'plugins'), { recursive: true });
  fs.writeFileSync(
    path.join(configDir, 'plugins', 'installed_plugins.json'),
    JSON.stringify({ version: 2, plugins: { 'noonsight@noonsight': [{ scope: opts.scope ?? 'user', installPath: root, version, ...(opts.projectPath ? { projectPath: opts.projectPath } : {}) }] } }),
  );
  const file = path.join(configDir, 'settings.json');
  const settings = fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>) : {};
  fs.writeFileSync(file, JSON.stringify({ ...settings, enabledPlugins: { 'noonsight@noonsight': opts.enabled ?? true } }));
  return root;
}

function machine() {
  const home = tempTree({ '.claude/.keep': '' });
  const env = { HOME: home, PATH: fakeClaude('2.1.330'), NOONSIGHT_CONFIG: LAB_CONFIG, NOONSIGHT_PRESETS_DIR: LAB_PRESETS, NOONSIGHT_SYSTEM_ROOT: tempTree({}) };
  return { home, env, claudeDir: path.join(home, '.claude') };
}

test('check: a login with the plugin is reached, with its version and folder', () => {
  const { env, claudeDir } = machine();
  const root = addPlugin(claudeDir);
  const r = runCli(['check'], env, NO_NETWORK);
  assert.equal(r.status, 0, r.stdout);
  assert.ok(r.stdout.includes(`ok: plugin noonsight@noonsight in ${claudeDir}: runs noonsight ${VERSION} (${root})`), r.stdout);
  assert.doesNotMatch(r.stdout, /noonsight is not installed|no noonsight hooks/);
});

test('check: a plugin that is off, missing or turned on without being installed reaches nothing', () => {
  const off = machine();
  addPlugin(off.claudeDir, { enabled: false });
  const r = runCli(['check'], off.env, NO_NETWORK);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /ok: plugin noonsight@noonsight in .*: installed and turned off; `claude plugin enable noonsight@noonsight`/);
  assert.match(r.stdout, /problem: noonsight is not installed: run `noonsight install`, or install the Claude Code plugin/);

  const gone = machine();
  addPlugin(gone.claudeDir, { folder: false });
  assert.match(runCli(['check'], gone.env, NO_NETWORK).stdout, /problem: plugin noonsight@noonsight in .*: its folder .* holds no noonsight that can run/);

  const absent = machine();
  fs.writeFileSync(path.join(absent.claudeDir, 'settings.json'), JSON.stringify({ enabledPlugins: { 'noonsight@noonsight': true } }));
  assert.match(runCli(['check'], absent.env, NO_NETWORK).stdout, /problem: plugin noonsight@noonsight in .*: turned on in the settings and not installed/);
});

test('check: disableAllHooks stops the plugin too', () => {
  const { env, claudeDir } = machine();
  addPlugin(claudeDir);
  const file = path.join(claudeDir, 'settings.json');
  fs.writeFileSync(file, JSON.stringify({ ...JSON.parse(fs.readFileSync(file, 'utf8')), disableAllHooks: true }));
  assert.match(runCli(['check'], env, NO_NETWORK).stdout, /problem: plugin noonsight@noonsight in .* sets disableAllHooks/);
});

test('check: the plugin and an install in one login are a warning, which names two versions', () => {
  const { env, claudeDir } = machine();
  assert.equal(runCli(['install'], env).status, 0);
  addPlugin(claudeDir);
  const same = runCli(['check'], env, NO_NETWORK);
  assert.equal(same.status, 0, same.stdout);
  assert.match(same.stdout, /warning: Claude Code configuration .*: both the plugin noonsight@noonsight and the account install reach this login; each event is delivered once, by whichever copy runs first\. One is enough/);
  addPlugin(claudeDir, { version: '9.9.9' });
  assert.match(runCli(['check'], env, NO_NETWORK).stdout, new RegExp(`they run different versions \\(the plugin 9\\.9\\.9, the account install ${VERSION.replaceAll('.', '\\.')}\\)`));
});

test('check: moving to the plugin leaves no problem behind', () => {
  const { env, claudeDir } = machine();
  assert.equal(runCli(['install'], env).status, 0);
  addPlugin(claudeDir);
  const removed = runCli(['uninstall', '--account', claudeDir], env);
  assert.equal(removed.status, 0, removed.stderr);
  assert.match(removed.stdout, /note: the plugin noonsight@noonsight in .* still delivers there; to remove it too: `claude plugin uninstall noonsight@noonsight`/);
  const r = runCli(['check'], env, NO_NETWORK);
  assert.equal(r.status, 0, r.stdout);
  assert.doesNotMatch(r.stdout, /warning: Claude Code configuration/);
});

test('a project-scope plugin counts in its own project only', () => {
  const { env, claudeDir } = machine();
  const project = tempTree({});
  addPlugin(claudeDir, { scope: 'project', projectPath: project });
  const at = (projectDir: string | null) => noonsightPlugins({ projectDir, configDir: claudeDir, env: { ...env } }).filter((p) => p.dir !== null).length;
  assert.deepEqual([at(project), at(tempTree({})), at(null)], [1, 0, 0]);
});

test('install says that the plugin is there too', () => {
  const { env, claudeDir } = machine();
  addPlugin(claudeDir);
  const r = runCli(['install'], env);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /note: the plugin noonsight@noonsight in .* reaches this login too; each event is delivered once/);
});

test('install and watch enable refuse to run from a plugin folder, and write nothing', () => {
  const { home, env, claudeDir } = machine();
  for (const args of [['install'], ['install', '--account', claudeDir], ['install', '--managed'], ['watch', 'enable']]) {
    const r = runCli(args, { ...env, CLAUDE_PLUGIN_ROOT: PACKAGE_ROOT });
    assert.equal(r.status, 1, args.join(' '));
    assert.match(r.stderr, /this copy of noonsight is the one a Claude Code plugin runs/, args.join(' '));
  }
  assert.deepEqual(fs.readdirSync(claudeDir), ['.keep']);
  assert.equal(fs.existsSync(path.join(home, '.local')), false);
});

test('a copy of noonsight in a plugin cache knows it; a package, a clone and another plugin do not count', () => {
  const root = pluginFolder();
  assert.equal(runsFromPlugin({}, root), false, 'no plugin.json');
  fs.mkdirSync(path.join(root, '.claude-plugin'));
  fs.writeFileSync(path.join(root, '.claude-plugin', 'plugin.json'), '{}');
  assert.equal(runsFromPlugin({}, root), true);
  assert.equal(runsFromPlugin({}, PACKAGE_ROOT), false);
  assert.equal(runsFromPlugin({ CLAUDE_PLUGIN_ROOT: root }, PACKAGE_ROOT), false);
  assert.equal(runsFromPlugin({ CLAUDE_PLUGIN_ROOT: PACKAGE_ROOT }, PACKAGE_ROOT), true);
});

test('run by a skill, check names the plugin\'s commands, and resolve prints the rules untouched', () => {
  const { env } = machine();
  const from = { ...env, CLAUDE_PLUGIN_ROOT: PACKAGE_ROOT };
  assert.match(runCli(['check'], from, NO_NETWORK).stdout, /run `npx noonsight install`/);
  assert.equal(runCli(['resolve', 'claude-haiku-5-5'], from).stdout, runCli(['resolve', 'claude-haiku-5-5'], env).stdout);
  assert.ok(fs.existsSync(CLI_FILE));
});
