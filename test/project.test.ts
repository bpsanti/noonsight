// Project configuration: a repository's .noonsight/noonsight.json laid over the machine's
// configuration for the sessions that run in it. How the file is found, how far "projects.allow" lets
// it change the machine's configuration, how it merges, what a problem in it costs (only itself), and
// how this account's trust decides whether it applies at all.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { ConfigError, loadConfigDetails, type ConfigDetails, type ProjectLayer } from '../src/config/load.js';
import { SCHEMA_DIR } from '../src/config/paths.js';
import { describeProject, findProject, PROJECT_ALLOW, projectFor, setTrust, trustOf } from '../src/config/project.js';
import { resolve } from '../src/core/resolve.js';
import type { Decision } from '../src/core/types.js';
import { hookHome, hookInput, LAB_PRESETS, labPresetWith, runCli, tempTree } from './helpers.js';

const OWN = 'OWN-STYLE-5528';
const TEAM = 'TEAM-COMMITS-4417';
const TEAM_SONNET = 'TEAM-SONNET-7731';

/** A machine configuration next to its rule files. */
function machineTree(config: Record<string, unknown> = {}): string {
  const dir = tempTree({
    'own.md': `Prefer small functions. ${OWN}`,
    'two.md': 'Name things plainly. TWO-NAMES-8842',
    'noonsight.json': {
      version: 1,
      preset: 'lab',
      models: {
        'claude-sonnet-5-5': { use: 'preset', add: [{ id: 'user/own', file: 'own.md' }] },
        'claude-haiku-5-5': { use: 'preset' },
        'claude-opus-5-5': { use: 'none' },
      },
      ...config,
    },
  });
  return path.join(dir, 'noonsight.json');
}

/** A git repository with a project configuration at its root, and a subdirectory. */
function projectTree(project: Record<string, unknown>, files: Record<string, string> = {}): string {
  const dir = tempTree({
    '.git/HEAD': 'ref: refs/heads/main\n',
    'src/app/main.ts': 'export {};\n',
    '.noonsight/team.md': `Commits use the imperative mood. ${TEAM}`,
    '.noonsight/team-sonnet.md': `Sonnet checks the build. ${TEAM_SONNET}`,
    ...files,
    '.noonsight/noonsight.json': { version: 1, ...project },
  });
  return dir;
}

function load(machine: string, dir: string, trusted: boolean | null = true): ConfigDetails {
  const found = findProject(dir);
  assert.ok(found, 'a project file is found');
  return loadConfigDetails(machine, { presetsDir: LAB_PRESETS, project: { ...found, trusted } });
}

function rulesOf(details: ConfigDetails, model: string, scope: string | null = null): readonly string[] {
  const d: Decision = resolve(details.config, { model, scope, place: 'attended' });
  return d.status === 'matched' ? d.rules : [];
}

const team = { id: 'team/commits', file: 'team.md' };
const teamSonnet = { id: 'team/sonnet', file: 'team-sonnet.md' };

test('the project file is the nearest one from the directory up to the repository root, and never above it', () => {
  const repo = projectTree({});
  assert.deepEqual(findProject(path.join(repo, 'src', 'app')), { dir: repo, file: path.join(repo, '.noonsight', 'noonsight.json') });
  assert.equal(findProject(repo)?.dir, repo);

  // A nested project, such as one package of a monorepo, is closer.
  fs.mkdirSync(path.join(repo, 'src', '.noonsight'));
  fs.writeFileSync(path.join(repo, 'src', '.noonsight', 'noonsight.json'), '{"version":1}');
  assert.equal(findProject(path.join(repo, 'src', 'app'))?.dir, path.join(repo, 'src'));

  // A file above the repository root belongs to no project of the repository.
  const outer = tempTree({ '.noonsight/noonsight.json': { version: 1 }, 'repo/.git/HEAD': 'x', 'repo/sub/a.txt': 'x' });
  assert.equal(findProject(path.join(outer, 'repo', 'sub')), null);
  // Outside a repository, only the directory itself counts.
  assert.equal(findProject(path.join(outer, 'repo', 'sub', '..', '..'))?.dir, outer);
  const plain = tempTree({ '.noonsight/noonsight.json': { version: 1 }, 'sub/a.txt': 'x' });
  assert.equal(findProject(path.join(plain, 'sub')), null);
  assert.equal(findProject(null), null);
});

test('the machine configuration file is never also read as a project file', () => {
  const repo = projectTree({});
  const state = tempTree({});
  assert.equal(projectFor(repo, path.join(repo, '.noonsight', 'noonsight.json'), state), null);
  assert.equal(projectFor(repo, machineTree(), state)?.dir, repo);
});

test('trust is kept per project directory, by its real path, and a decline is kept too', () => {
  const state = tempTree({});
  const repo = projectTree({});
  const link = path.join(tempTree({}), 'link');
  fs.symlinkSync(repo, link);
  assert.equal(trustOf(state, repo), null);
  assert.equal(setTrust(state, link, true, new Date()), null);
  assert.equal(trustOf(state, repo), true);
  assert.equal(setTrust(state, repo, false, new Date()), true);
  assert.equal(trustOf(state, link), false);
  assert.equal(projectFor(path.join(repo, 'src'), machineTree(), state)?.trusted, false);
});

test('an untrusted, declined or ignored project changes nothing, and says why', () => {
  const machine = machineTree();
  const repo = projectTree({ all_models: { add: [team] } });
  for (const [trusted, status] of [
    [null, 'untrusted'],
    [false, 'declined'],
  ] as const) {
    const d = load(machine, repo, trusted);
    assert.equal(d.project?.status, status);
    assert.deepEqual(rulesOf(d, 'claude-sonnet-5-5'), ['sonnet/general', 'user/own']);
  }
  const off = load(machineTree({ projects: { allow: 'none' } }), repo);
  assert.equal(off.project?.status, 'ignored');
  assert.deepEqual(rulesOf(off, 'claude-sonnet-5-5'), ['sonnet/general', 'user/own']);
});

test('"add", the default: the project\'s rules follow the machine\'s in each list', () => {
  const machine = machineTree({ all_models: { add: [{ id: 'user/all', file: 'own.md' }] } });
  const d = load(machine, projectTree({ all_models: { add: [team] }, models: { 'claude-sonnet-5-5': { add: [teamSonnet] } } }));
  assert.equal(d.project?.status, 'applied');
  assert.equal(d.project?.allow, 'add');
  assert.deepEqual(rulesOf(d, 'claude-sonnet-5-5'), ['sonnet/general', 'user/all', 'team/commits', 'user/own', 'team/sonnet']);
  assert.deepEqual(rulesOf(d, 'claude-haiku-5-5'), ['haiku/general', 'user/all', 'team/commits']);
  // A model the person declared "none" stays without rules.
  assert.equal(resolve(d.config, { model: 'claude-opus-5-5', place: 'attended' }).status, 'none');
  const sonnet = resolve(d.config, { model: 'claude-sonnet-5-5', place: 'attended' });
  assert.match(sonnet.status === 'matched' ? sonnet.text : '', new RegExp(`${OWN}[\\s\\S]*${TEAM_SONNET}`));
  // Commands show the project's rules with the file as the project writes it.
  assert.deepEqual(d.allModels, [{ id: 'user/all', file: 'own.md' }, { id: 'team/commits', file: 'team.md', project: true }]);
  assert.deepEqual(d.declared.get('claude-sonnet-5-5')?.add.map((r) => r.id), ['user/own', 'team/sonnet']);
});

test('"add": an entry for a model the machine leaves undeclared or declares "none" does not apply, and is noted', () => {
  const d = load(machineTree(), projectTree({ models: { 'claude-opus-5-5': { add: [team] }, 'claude-fable-5-2': { add: [team] } } }));
  assert.equal(d.project?.status, 'applied');
  assert.equal(d.project?.notes.length, 2);
  assert.match(d.project?.notes.join('\n') ?? '', /claude-opus-5-5 with "use": "none"/);
  assert.match(d.project?.notes.join('\n') ?? '', /does not declare claude-fable-5-2/);
  assert.equal(resolve(d.config, { model: 'claude-fable-5-2', place: 'attended' }).status, 'undeclared');
  // What became of the project lists only the rules that reach a model.
  assert.deepEqual(d.project?.rules, []);
  assert.equal(describeProject(d.project as ProjectLayer), `applied over the machine's configuration ("projects.allow": "add"), trusted for this account`);
  const some = load(machineTree(), projectTree({ all_models: { add: [team] }, models: { 'claude-opus-5-5': { add: [teamSonnet] }, 'claude-sonnet-5-5': { add: [teamSonnet] } } }));
  assert.match(describeProject(some.project as ProjectLayer), /; rules: team\/commits \(all_models\), team\/sonnet \(claude-sonnet-5-5\)$/);
});

test('"add": a project that changes anything else is refused, and the machine\'s rules still apply', () => {
  const machine = machineTree();
  const cases: [Record<string, unknown>, RegExp][] = [
    [{ models: { 'claude-sonnet-5-5': { use: 'none' } } }, /\/models\/claude-sonnet-5-5\/use: "use" for a model needs "projects": \{ "allow": "rules" \}/],
    [{ models: { 'claude-sonnet-5-5': { disable: ['sonnet/general'] } } }, /"disable" for a model needs .*"rules"/],
    [{ scopes: { team: { description: 'Team work.' } } }, /\/scopes: "scopes" needs .*"rules"/],
    [{ routing: { enabled: true } }, /\/routing: "routing" needs "projects": \{ "allow": "all" \} in the machine's configuration, which allows "add"/],
    [{ subagents: { permission: 'allow' } }, /\/subagents: .*"all"/],
    // A rule with the id of one of the machine's rules does not replace it under "add".
    [{ models: { 'claude-sonnet-5-5': { add: [{ id: 'user/own', file: 'team.md' }] } } }, /rule id "user\/own" is already used for claude-sonnet-5-5/],
  ];
  for (const [project, problem] of cases) {
    const d = load(machine, projectTree(project));
    assert.equal(d.project?.status, 'refused', JSON.stringify(project));
    assert.match(d.project?.problems.join('\n') ?? '', problem);
    assert.deepEqual(rulesOf(d, 'claude-sonnet-5-5'), ['sonnet/general', 'user/own']);
  }
});

test('a project with a problem of its own is refused alone: a bad schema, a missing rule file, an overflow', () => {
  const machine = machineTree();
  const big = 'x'.repeat(9600);
  const cases: [Record<string, unknown>, RegExp, Record<string, string>?][] = [
    [{ preset_version: '1.0.0' }, /preset_version/],
    [{ all_models: { add: [{ id: 'team/gone', file: 'gone.md' }] } }, /\/all_models\/add\/0\/file: cannot read .*gone\.md/],
    [{ models: { 'claude-sonnet-5-5': { add: [{ id: 'team/big', file: 'big.md' }] } } }, /claude-sonnet-5-5: the rules delivered .* come to \d+ characters/, { '.noonsight/big.md': big }],
  ];
  for (const [project, problem, files] of cases) {
    const d = load(machine, projectTree(project, files));
    assert.equal(d.project?.status, 'refused', JSON.stringify(project));
    assert.match(d.project?.problems.join('\n') ?? '', problem);
    assert.deepEqual(rulesOf(d, 'claude-sonnet-5-5'), ['sonnet/general', 'user/own']);
  }
  const broken = projectTree({});
  fs.writeFileSync(path.join(broken, '.noonsight', 'noonsight.json'), '{ not json');
  assert.match(load(machine, broken).project?.problems[0] ?? '', /not valid JSON/);
});

test('a project rule file must stay inside the project directory, symlinks followed; the machine\'s may be anywhere', () => {
  const outside = tempTree({ 'secret.md': 'Account secret. SECRET-OUTSIDE-6093' });
  const secret = path.join(outside, 'secret.md');
  const machine = machineTree({ all_models: { add: [{ id: 'user/far', file: secret }] } });

  const escape = projectTree({});
  fs.writeFileSync(
    path.join(escape, '.noonsight', 'noonsight.json'),
    JSON.stringify({ version: 1, all_models: { add: [{ id: 'team/x', file: path.relative(path.join(escape, '.noonsight'), secret) }] } }),
  );
  const absolute = projectTree({ all_models: { add: [{ id: 'team/x', file: secret }] } });
  // An absolute path is refused even when it names a file inside the project.
  const absoluteInside = projectTree({});
  fs.writeFileSync(
    path.join(absoluteInside, '.noonsight', 'noonsight.json'),
    JSON.stringify({ version: 1, all_models: { add: [{ id: 'team/x', file: path.join(absoluteInside, '.noonsight', 'team.md') }] } }),
  );
  const linked = projectTree({ all_models: { add: [{ id: 'team/x', file: 'linked.md' }] } });
  fs.symlinkSync(secret, path.join(linked, '.noonsight', 'linked.md'));

  const outsideProblem = /\/all_models\/add\/0\/file: .* is outside the project directory/;
  const absoluteProblem = /\/all_models\/add\/0\/file: .* is an absolute path; a project rule file must be relative to the project file/;
  const cases: [string, RegExp][] = [
    [escape, outsideProblem],
    [absolute, absoluteProblem],
    [absoluteInside, absoluteProblem],
    [linked, outsideProblem],
  ];
  for (const [dir, problem] of cases) {
    const d = load(machine, dir);
    assert.equal(d.project?.status, 'refused', dir);
    const problems = d.project?.problems.join('\n') ?? '';
    assert.match(problems, problem);
    if (problem === absoluteProblem) assert.doesNotMatch(problems, outsideProblem);
    // The machine's rules, its own absolute path outside every project included, still apply.
    assert.deepEqual(rulesOf(d, 'claude-sonnet-5-5'), ['sonnet/general', 'user/far', 'user/own']);
  }

  // A symlink that stays inside the project, even out of .noonsight/, still works.
  const inside = projectTree({ all_models: { add: [{ id: 'team/x', file: 'inside.md' }] } }, { 'docs/team.md': `Shared. ${TEAM}` });
  fs.symlinkSync(path.join(inside, 'docs', 'team.md'), path.join(inside, '.noonsight', 'inside.md'));
  const ok = load(machine, inside);
  assert.equal(ok.project?.status, 'applied');
  const text = resolve(ok.config, { model: 'claude-sonnet-5-5', place: 'attended' });
  assert.match(text.status === 'matched' ? text.text : '', new RegExp(TEAM));
});

test('"replaces": a project needs "rules" to replace a preset rule, and a preset rule the machine replaced stays replaced', () => {
  const finish = { id: 'team/finish-work', file: 'team-sonnet.md', replaces: 'sonnet/investigate' };
  // Under "add", a project never turns a preset rule off.
  const refused = load(machineTree(), projectTree({ models: { 'claude-sonnet-5-5': { add: [finish] } } }));
  assert.equal(refused.project?.status, 'refused');
  assert.match(
    refused.project?.problems.join('\n') ?? '',
    /\/models\/claude-sonnet-5-5\/add\/0\/replaces: "replaces" for a rule needs "projects": \{ "allow": "rules" \} in the machine's configuration, which allows "add"/,
  );
  assert.deepEqual(rulesOf(refused, 'claude-sonnet-5-5'), ['sonnet/general', 'user/own']);

  const rules = (add: unknown[]) =>
    machineTree({ projects: { allow: 'rules' }, models: { 'claude-sonnet-5-5': { use: 'preset', add }, 'claude-haiku-5-5': { use: 'preset' } } });
  const investigating = (d: ConfigDetails) => resolve(d.config, { model: 'claude-sonnet-5-5', scope: 'investigate', place: 'attended' });

  // Under "rules", the project's rule is delivered in the preset rule's place, with its scopes.
  const own = load(rules([{ id: 'user/own', file: 'own.md' }]), projectTree({ models: { 'claude-sonnet-5-5': { add: [finish] } } }));
  assert.equal(own.project?.status, 'applied', own.project?.problems.join('\n'));
  assert.deepEqual(rulesOf(own, 'claude-sonnet-5-5', 'investigate'), ['sonnet/general', 'team/finish-work', 'user/own']);

  // A project rule that takes the place of a machine rule, by id, keeps the preset rule it replaced off.
  const machineFinish = { id: 'team/finish-work', file: 'own.md', replaces: 'sonnet/investigate' };
  const byId = load(rules([machineFinish]), projectTree({ models: { 'claude-sonnet-5-5': { add: [{ id: 'team/finish-work', file: 'team-sonnet.md' }] } } }));
  assert.equal(byId.project?.status, 'applied', byId.project?.problems.join('\n'));
  const d = investigating(byId);
  assert.deepEqual(d.status === 'matched' && d.rules, ['sonnet/general', 'team/finish-work']);
  assert.match(d.status === 'matched' ? d.text : '', new RegExp(TEAM_SONNET));
  assert.doesNotMatch(d.status === 'matched' ? d.text : '', new RegExp(OWN));

  // A project rule that replaces the preset rule a machine rule replaces wins, in that rule's place.
  const rival = load(rules([{ id: 'user/finish', file: 'own.md', replaces: 'sonnet/investigate' }, { id: 'user/two', file: 'two.md' }]), projectTree({ models: { 'claude-sonnet-5-5': { add: [finish] } } }));
  assert.equal(rival.project?.status, 'applied', rival.project?.problems.join('\n'));
  assert.deepEqual(rulesOf(rival, 'claude-sonnet-5-5', 'investigate'), ['sonnet/general', 'team/finish-work', 'user/two']);

  // A problem with a project rule's "replaces" is located in the project file.
  const unknown = load(
    rules([{ id: 'user/own', file: 'own.md' }, { id: 'user/two', file: 'two.md' }]),
    projectTree({ models: { 'claude-sonnet-5-5': { add: [{ id: 'team/x', file: 'team.md', replaces: 'sonnet/gone' }] } } }),
  );
  assert.equal(unknown.project?.status, 'refused');
  assert.match(unknown.project?.problems.join('\n') ?? '', /^\/models\/claude-sonnet-5-5\/add\/0\/replaces: preset "lab" has no rule "sonnet\/gone"/m);
});

test('"replaces" meets "enable" and "disable": the project\'s choice wins, and the project is not refused', () => {
  const machine = (entry: Record<string, unknown>) =>
    machineTree({ projects: { allow: 'rules' }, models: { 'claude-sonnet-5-5': { use: 'preset', ...entry }, 'claude-haiku-5-5': { use: 'preset' } } });
  const sonnet = (d: ConfigDetails) => {
    assert.equal(d.project?.status, 'applied', d.project?.problems.join('\n'));
    return rulesOf(d, 'claude-sonnet-5-5', 'investigate');
  };
  const machineFinish = { add: [{ id: 'user/finish', file: 'own.md', replaces: 'sonnet/investigate' }] };
  const projectFinish = { id: 'team/finish-work', file: 'team-sonnet.md' };

  // The machine replaced sonnet/investigate. A project "enable" brings it back, and the machine's rule
  // is delivered as one of the model's own; a project "disable" leaves the replacement as it is.
  assert.deepEqual(sonnet(load(machine(machineFinish), projectTree({ models: { 'claude-sonnet-5-5': { enable: ['sonnet/investigate'] } } }))), [
    'sonnet/general',
    'sonnet/investigate',
    'user/finish',
  ]);
  assert.deepEqual(sonnet(load(machine(machineFinish), projectTree({ models: { 'claude-sonnet-5-5': { disable: ['sonnet/investigate'] } } }))), [
    'sonnet/general',
    'user/finish',
  ]);

  // A project rule that takes a machine rule's place with its own "replaces" leaves the machine's
  // replaced rule to the project's "disable".
  assert.deepEqual(
    sonnet(
      load(
        machine(machineFinish),
        projectTree({
          models: { 'claude-sonnet-5-5': { add: [{ id: 'user/finish', file: 'team-sonnet.md', replaces: 'sonnet/progress-updates' }], disable: ['sonnet/investigate'] } },
        }),
      ),
    ),
    ['sonnet/general', 'user/finish'],
  );

  // The machine turned a preset rule off, or an off-by-default one on; a project rule replacing it wins.
  assert.deepEqual(
    sonnet(
      load(
        machine({ disable: ['sonnet/investigate'] }),
        projectTree({ models: { 'claude-sonnet-5-5': { add: [{ ...projectFinish, replaces: 'sonnet/investigate' }] } } }),
      ),
    ),
    ['sonnet/general', 'team/finish-work'],
  );
  assert.deepEqual(
    sonnet(
      load(
        machine({ enable: ['sonnet/progress-updates'] }),
        projectTree({ models: { 'claude-sonnet-5-5': { add: [{ ...projectFinish, replaces: 'sonnet/progress-updates' }] } } }),
      ),
    ),
    ['sonnet/general', 'sonnet/investigate', 'team/finish-work'],
  );

  // A conflict inside the project file itself is still refused, located in the project file.
  const own = load(
    machine({ add: [{ id: 'user/own', file: 'own.md' }, { id: 'user/two', file: 'two.md' }] }),
    projectTree({ models: { 'claude-sonnet-5-5': { enable: ['sonnet/progress-updates'], add: [{ ...projectFinish, replaces: 'sonnet/progress-updates' }] } } }),
  );
  assert.equal(own.project?.status, 'refused');
  assert.match(own.project?.problems.join('\n') ?? '', /^\/models\/claude-sonnet-5-5\/add\/0\/replaces: rule "sonnet\/progress-updates" is both replaced and enabled/m);
});

test('a project and the machine that name one preset rule by its id before and after a rename still meet', () => {
  // The preset renamed sonnet/investigate to sonnet/look-into; the machine still writes the former id.
  const presetsDir = labPresetWith((p) => {
    const rule = p.models['claude-sonnet-5-5'].rules.find((r: { id: string }) => r.id === 'sonnet/investigate');
    Object.assign(rule, { id: 'sonnet/look-into', renamed_from: ['sonnet/investigate'] });
  });
  const machine = (entry: Record<string, unknown>) =>
    machineTree({ projects: { allow: 'rules' }, models: { 'claude-sonnet-5-5': { use: 'preset', ...entry }, 'claude-haiku-5-5': { use: 'preset' } } });
  const sonnet = (machineFile: string, project: Record<string, unknown>) => {
    const found = findProject(projectTree({ models: { 'claude-sonnet-5-5': project } }));
    assert.ok(found);
    const d = loadConfigDetails(machineFile, { presetsDir, project: { ...found, trusted: true } });
    assert.equal(d.project?.status, 'applied', d.project?.problems.join('\n'));
    return rulesOf(d, 'claude-sonnet-5-5', 'investigate');
  };
  const machineFinish = machine({ add: [{ id: 'user/finish', file: 'own.md', replaces: 'sonnet/investigate' }] });
  const projectFinish = { id: 'team/finish-work', file: 'team-sonnet.md' };

  assert.deepEqual(sonnet(machineFinish, { disable: ['sonnet/look-into'] }), ['sonnet/general', 'user/finish']);
  assert.deepEqual(sonnet(machineFinish, { enable: ['sonnet/look-into'] }), ['sonnet/general', 'sonnet/look-into', 'user/finish']);
  assert.deepEqual(sonnet(machineFinish, { add: [{ ...projectFinish, replaces: 'sonnet/look-into' }] }), ['sonnet/general', 'team/finish-work']);
  assert.deepEqual(sonnet(machine({ disable: ['sonnet/investigate'] }), { add: [{ ...projectFinish, replaces: 'sonnet/look-into' }] }), [
    'sonnet/general',
    'team/finish-work',
  ]);
});

test('`noonsight models` shows a project rule that replaces a preset rule as a pair, from the project', () => {
  const machine = machineTree({ projects: { allow: 'rules' } });
  const repo = projectTree({ models: { 'claude-sonnet-5-5': { add: [{ id: 'team/finish-work', file: 'team-sonnet.md', replaces: 'sonnet/investigate' }] } } });
  const h = hookHome(machine, { NOONSIGHT_PRESETS_DIR: LAB_PRESETS });
  const cli = (args: string[]) => runCli(args, { ...h.env, CLAUDE_PROJECT_DIR: repo });
  cli(['trust', repo]);
  const text = cli(['models']).stdout;
  assert.match(text, /sonnet\/investigate .*replaced by team\/finish-work/);
  assert.match(text, /team\/finish-work .*from the project; replaces sonnet\/investigate/);
});

test('a machine configuration with a problem is refused whatever the project', () => {
  const machine = machineTree({ models: { 'claude-sonnet-5-5': { use: 'custom', add: [{ id: 'user/gone', file: 'gone.md' }] } } });
  assert.throws(() => load(machine, projectTree({ all_models: { add: [team] } })), (e: unknown) => e instanceof ConfigError && e.file === machine);
});

test('"rules": a project changes how a model is declared, turns preset rules on and off, replaces a rule by id, and adds scopes', () => {
  const machine = machineTree({
    projects: { allow: 'rules' },
    models: {
      'claude-sonnet-5-5': { use: 'preset', disable: ['sonnet/carry-through'], add: [{ id: 'user/own', file: 'own.md' }, { id: 'user/two', file: 'two.md' }] },
      'claude-haiku-5-5': { use: 'preset' },
      'claude-opus-5-5': { use: 'none' },
    },
  });
  const d = load(
    machine,
    projectTree({
      models: {
        // Same "use": merged. The project turns a rule off and one back on, and replaces user/own in its place.
        'claude-sonnet-5-5': { disable: ['sonnet/investigate'], enable: ['sonnet/carry-through'], add: [{ id: 'user/own', file: 'team-sonnet.md' }] },
        // Another "use": the project's entry replaces the machine's.
        'claude-haiku-5-5': { use: 'none' },
        'claude-opus-5-5': { use: 'custom', add: [team] },
      },
      scopes: { review: { description: 'Review a change.' } },
      on_undeclared: 'ignore',
    }),
  );
  assert.equal(d.project?.status, 'applied', d.project?.problems.join('\n'));
  const sonnet = resolve(d.config, { model: 'claude-sonnet-5-5', scope: 'investigate', place: 'unattended' });
  assert.deepEqual(sonnet.status === 'matched' && sonnet.rules, ['sonnet/general', 'sonnet/carry-through', 'user/own', 'user/two']);
  assert.match(sonnet.status === 'matched' ? sonnet.text : '', new RegExp(TEAM_SONNET));
  assert.doesNotMatch(sonnet.status === 'matched' ? sonnet.text : '', new RegExp(OWN));
  assert.equal(resolve(d.config, { model: 'claude-haiku-5-5', place: 'attended' }).status, 'none');
  assert.deepEqual(rulesOf(d, 'claude-opus-5-5'), ['team/commits']);
  assert.ok(d.config.scopes.has('review'));
  assert.equal(d.config.onUndeclared, 'ignore');

  // A project rule replaces one of the machine's rules, never another of the project's.
  const twice = load(machine, projectTree({ all_models: { add: [team, { id: 'team/commits', file: 'team-sonnet.md' }] } }));
  assert.equal(twice.project?.status, 'refused');
  assert.match(twice.project?.problems.join('\n') ?? '', /\/all_models\/add\/1\/id: rule id "team\/commits" is used more than once in "all_models"/);

  const routed = load(machine, projectTree({ routing: { enabled: true } }));
  assert.equal(routed.project?.status, 'refused');
  assert.match(routed.project?.problems[0] ?? '', /"routing" needs "projects": \{ "allow": "all" \}.* which allows "rules"/);
});

test('"rules": an entry merged into another "use" that the combination cannot take is refused', () => {
  const machine = machineTree({ projects: { allow: 'rules' }, models: { 'claude-sonnet-5-5': { use: 'custom', add: [{ id: 'user/own', file: 'own.md' }] } } });
  const d = load(machine, projectTree({ models: { 'claude-sonnet-5-5': { enable: ['sonnet/progress-updates'] } } }));
  assert.equal(d.project?.status, 'refused');
  assert.match(d.project?.problems.join('\n') ?? '', /\/models\/claude-sonnet-5-5/);
});

test('"all": a project also sets routing, the classifier and the subagent settings, row by row', () => {
  const machine = machineTree({
    projects: { allow: 'all' },
    scopes: { review: { description: 'Review a change.' } },
    routing: { enabled: true, table: { investigate: [{ model: 'opus' }], review: [{ model: 'sonnet' }] } },
  });
  const d = load(
    machine,
    projectTree({ routing: { table: { review: [{ model: 'haiku', effort: 'low' }] } }, subagents: { permission: 'ask' }, classifier: { mode: 'fallback' } }),
  );
  assert.equal(d.project?.status, 'applied', d.project?.problems.join('\n'));
  assert.equal(d.config.routing.enabled, true);
  assert.deepEqual(d.config.routing.table.get('investigate')?.launcher, [{ model: 'opus' }]);
  assert.deepEqual(d.config.routing.table.get('review')?.subagents, [{ model: 'haiku', effort: 'low' }]);
  assert.equal(d.config.subagents.permission, 'ask');
  assert.equal(d.config.subagents.delivery, 'prompt');
  assert.equal(d.config.classifier.mode, 'fallback');
});

/** A machine configuration and a project, with a home of their own to run the hook and commands in. */
function session(project: Record<string, unknown> = { all_models: { add: [team] } }) {
  const machine = machineTree();
  const repo = projectTree(project);
  const h = hookHome(machine, { NOONSIGHT_PRESETS_DIR: LAB_PRESETS });
  const start = (fields: Record<string, unknown> = {}) =>
    h.hook('session-start', hookInput('session-start-startup', { model: 'claude-sonnet-5-5', cwd: path.join(repo, 'src'), ...fields }));
  const cli = (args: string[], extra: Record<string, string> = {}) => runCli(args, { ...h.env, ...extra });
  return { machine, repo, h, start, cli };
}

test('a session in an untrusted project gets the machine\'s rules and a warning that names `noonsight trust`', () => {
  const { repo, h, start } = session();
  const r = start();
  assert.doesNotMatch(r.out?.hookSpecificOutput.additionalContext, new RegExp(TEAM));
  assert.match(r.out?.systemMessage, /this project has its own noonsight configuration \(.*\.noonsight\/noonsight\.json\), which this account has not trusted/);
  assert.match(r.out?.systemMessage, /run `noonsight trust` in /);
  const [line] = h.log();
  assert.equal(line?.project, repo);
  assert.equal(line?.project_status, 'untrusted');
  assert.equal(line?.warned, true);
  // Only the start of a new session warns.
  assert.equal(start({ source: 'resume', session_id: 'resumed' }).out?.systemMessage, undefined);
});

test('`noonsight trust` applies the project to its sessions, later changes apply without asking, and `untrust` declines it quietly', () => {
  const { repo, h, start, cli } = session();
  const trusted = cli(['trust', path.join(repo, 'src', 'app')]);
  assert.equal(trusted.status, 0, trusted.stderr);
  assert.match(trusted.stdout, /noonsight\.json: trusted for this account/);
  assert.match(trusted.stdout, /applied over the machine's configuration \("projects\.allow": "add"\), trusted for this account; rules: team\/commits \(all_models\)/);
  assert.match(cli(['trust', repo]).stdout, /already trusted/);

  const r = start();
  assert.match(r.out?.hookSpecificOutput.additionalContext, new RegExp(`${OWN}[\\s\\S]*`));
  assert.match(r.out?.hookSpecificOutput.additionalContext, new RegExp(TEAM));
  assert.equal(r.out?.systemMessage, undefined);
  assert.equal(h.log().at(-1)?.project_status, 'applied');
  assert.deepEqual(h.log().at(-1)?.rules, ['sonnet/general', 'team/commits', 'user/own']);

  // A changed project file applies as it is, with no new decision.
  fs.writeFileSync(path.join(repo, '.noonsight', 'noonsight.json'), JSON.stringify({ version: 1, all_models: { add: [teamSonnet] } }));
  assert.match(start({ session_id: 'second' }).out?.hookSpecificOutput.additionalContext, new RegExp(TEAM_SONNET));

  // CLAUDE_PROJECT_DIR names the project over the input's cwd.
  const elsewhere = start({ session_id: 'third', cwd: tempTree({}) });
  assert.doesNotMatch(elsewhere.out?.hookSpecificOutput.additionalContext, new RegExp(TEAM_SONNET));
  const named = h.hook('session-start', hookInput('session-start-startup', { model: 'claude-sonnet-5-5', session_id: 'fourth', cwd: tempTree({}) }), { CLAUDE_PROJECT_DIR: repo });
  assert.match(named.out?.hookSpecificOutput.additionalContext, new RegExp(TEAM_SONNET));

  const declined = cli(['untrust', repo]);
  assert.equal(declined.status, 0);
  assert.match(declined.stdout, /declined for this account/);
  const after = start({ session_id: 'fifth' });
  assert.doesNotMatch(after.out?.hookSpecificOutput.additionalContext, new RegExp(TEAM_SONNET));
  assert.equal(after.out?.systemMessage, undefined);
  assert.equal(h.log().at(-1)?.project_status, 'declined');
});

test('a refused project warns as the session starts, and `noonsight check` names its problems', () => {
  const { repo, start, cli } = session({ routing: { enabled: true } });
  cli(['trust', repo]);
  const r = start();
  assert.match(r.out?.hookSpecificOutput.additionalContext, new RegExp(OWN));
  assert.match(r.out?.systemMessage, /the project's configuration at .* was refused \(1 problem\), so only the machine's configuration applies here/);
  const check = cli(['check'], { CLAUDE_PROJECT_DIR: repo });
  assert.match(check.stdout, /^problem: project .*noonsight\.json: refused, so sessions in .* get only the machine's configuration: \/routing: "routing" needs/m);
});

test('`noonsight models`, `check` and `resolve` read the project of the directory they run for', () => {
  const { repo, cli } = session();
  const env = { CLAUDE_PROJECT_DIR: path.join(repo, 'src') };
  assert.match(cli(['check'], env).stdout, /^warning: project .*: not trusted for this account/m);
  cli(['trust', repo]);
  assert.match(cli(['check'], env).stdout, /^ok: project .*: applied over the machine's configuration/m);
  const models = cli(['models'], env).stdout;
  assert.match(models, /^project .*noonsight\.json: applied/m);
  assert.match(models, /team\/commits {2}\(scopes: every scope; places: attended, unattended, subagent; from all_models; from the project\)\n {7}file: team\.md/);
  const json = JSON.parse(cli(['models', '--json'], env).stdout);
  assert.equal(json.project.status, 'applied');
  assert.deepEqual(json.all_models[0], { id: 'team/commits', origin: 'user', on: true, scopes: ['*'], where: ['attended', 'unattended', 'subagent'], triggers: [], from: 'all_models', project: true, file: 'team.md' });
  const resolved = JSON.parse(cli(['resolve', 'claude-sonnet-5-5'], env).stdout);
  assert.deepEqual(resolved.rules, ['sonnet/general', 'team/commits', 'user/own']);
  // Outside the project, the machine's configuration alone.
  assert.deepEqual(JSON.parse(cli(['resolve', 'claude-sonnet-5-5'], { CLAUDE_PROJECT_DIR: tempTree({}) }).stdout).rules, ['sonnet/general', 'user/own']);
});

test('`noonsight trust` without a project configuration says where it looked', () => {
  const { cli } = session();
  const dir = tempTree({});
  const r = cli(['trust', dir]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /no project configuration \(\.noonsight\/noonsight\.json\) from .* up to its repository root/);
  assert.equal(cli(['trust', '--force']).status, 2);
});

test('the project schema is the configuration schema without the preset keys and "projects", with "use" optional', () => {
  const read = (name: string): any => JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, name), 'utf8'));
  const machine = read('noonsight.schema.json');
  const project = read('noonsight-project.schema.json');
  const machineKeys = Object.keys(machine.properties).filter((k) => !['preset', 'preset_version', 'on_preset_change', 'projects'].includes(k));
  assert.deepEqual(Object.keys(project.properties), machineKeys);
  for (const key of machineKeys) assert.deepEqual(project.properties[key], machine.properties[key], key);
  const { modelEntry: projectEntry, ...projectDefs } = project.$defs;
  const { modelEntry: machineEntry, ...machineDefs } = machine.$defs;
  // Only the description of a rule's file differs: a project's must stay inside the project.
  const withoutFileText = (defs: any): any => ({
    ...defs,
    userRule: { ...defs.userRule, properties: { ...defs.userRule.properties, file: { ...defs.userRule.properties.file, description: undefined } } },
  });
  assert.deepEqual(withoutFileText(projectDefs), withoutFileText(machineDefs));
  assert.deepEqual(machineEntry.required, ['use']);
  assert.equal(projectEntry.required, undefined);
  assert.deepEqual(projectEntry.properties.use.enum, machineEntry.properties.use.enum);
  assert.deepEqual(projectEntry.allOf, machineEntry.allOf);
  assert.deepEqual(projectEntry.properties.add, machineEntry.properties.add);
  assert.deepEqual(machine.properties.projects.properties.allow.enum, [...PROJECT_ALLOW]);
});

test('`noonsight run` puts the project\'s rules in the system prompt once trusted, and warns before', () => {
  const { repo, h, cli } = session();
  const bin = tempTree({});
  const record = path.join(bin, 'args.json');
  fs.writeFileSync(path.join(bin, 'claude'), `#!${process.execPath}\nrequire('node:fs').writeFileSync(${JSON.stringify(record)}, JSON.stringify(process.argv.slice(2)));\n`, { mode: 0o755 });
  const run = () => {
    const r = cli(['run', '--model', 'claude-sonnet-5-5', '-p', 'hello'], { PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}`, CLAUDE_PROJECT_DIR: repo });
    const args = JSON.parse(fs.readFileSync(record, 'utf8')) as string[];
    return { ...r, prompt: fs.readFileSync(args[args.indexOf('--append-system-prompt-file') + 1] ?? '', 'utf8') };
  };
  const before = run();
  assert.equal(before.status, 0, before.stderr);
  assert.match(before.stderr, /which this account has not trusted, so only the machine's configuration applies here/);
  assert.doesNotMatch(before.prompt, new RegExp(TEAM));
  assert.equal(h.log().at(-1)?.project_status, 'untrusted');

  cli(['trust', repo]);
  const after = run();
  assert.equal(after.stderr, '');
  assert.match(after.prompt, new RegExp(TEAM));
  assert.equal(h.log().at(-1)?.project_status, 'applied');
});
