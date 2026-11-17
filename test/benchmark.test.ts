// The pilot harness of the benchmark study (experiments/benchmark), on written inputs: no model,
// no Docker and no network are used here.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { pickCalibration } from '../experiments/benchmark/calibration.js';
import { conditionConfig, defaultOnRules, hookSettings, placeboText, presetText } from '../experiments/benchmark/conditions.js';
import { excludedBy, unchecked, type GoldRecord } from '../experiments/benchmark/gold.js';
import { reward } from '../experiments/benchmark/harbor.js';
import { judgeMessage, parseRatings, scrub, tally, type Item } from '../experiments/benchmark/judge.js';
import { BENCH_DIR, loadPlan, selection, wanted } from '../experiments/benchmark/plan.js';
import { aboveFloor, parseQuota } from '../experiments/benchmark/quota.js';
import { interrupted, measured, spent, type Recorded } from '../experiments/benchmark/run.js';
import { cellKey, expectedCost, planNight, rounds, type Cell } from '../experiments/benchmark/schedule.js';
import { parseStream, usage, verification } from '../experiments/benchmark/score.js';
import { chooseSwebench, chooseTerminalBench, rank, type SwebenchInstance } from '../experiments/benchmark/select.js';
import { tomlValue } from '../experiments/benchmark/sources.js';
import { dropKey, dropSection, useArm64Image } from '../experiments/benchmark/tasks.js';
import { tempTree } from './helpers.js';

const plan = loadPlan();

function instances(): SwebenchInstance[] {
  const out: SwebenchInstance[] = [];
  const strata = ['<15 min fix', '15 min - 1 hour', '1-4 hours'];
  const repos = ['django/django', 'django/django', 'sympy/sympy', 'sphinx-doc/sphinx', 'pytest-dev/pytest', 'astropy/astropy', 'psf/requests', 'pylint-dev/pylint', 'pallets/flask'];
  for (let i = 0; i < 300; i++)
    out.push({ instance_id: `inst-${i}`, repo: repos[i % repos.length] as string, difficulty: strata[i % 3] as string, hints_chars: i % 7 === 0 ? 5000 : 100 });
  return out;
}

test('rank orders by sha256 of the seed, the set and the id, the way the pre-registration states', () => {
  assert.equal(rank('s', null, 'a'), createHash('sha256').update('s:a').digest('hex'));
  assert.equal(rank('s', 'tb', 'a'), createHash('sha256').update('s:tb:a').digest('hex'));
});

test('the build list fills each stratum in rank order, keeps django within its share and other repositories within their total, and never shares an instance with the digest list', () => {
  const pool = instances();
  const arm64 = new Set(pool.filter((_, i) => i % 5 !== 0).map((r) => r.instance_id));
  const choice = chooseSwebench(plan.seed, pool, arm64, plan.sets.build, plan.sets.digest);
  const build = Object.values(choice.build).flat();
  assert.equal(build.length, wanted(plan).build);
  assert.equal(choice.digest.length, plan.sets.digest.n);
  assert.ok(build.every((id) => arm64.has(id)), 'only arm64 instances');
  assert.ok(!choice.digest.some((id) => build.includes(id)), 'digest and build lists are disjoint');
  const byId = new Map(pool.map((r) => [r.instance_id, r]));
  for (const [stratum, ids] of Object.entries(choice.build)) {
    const n = plan.sets.build.strata[stratum] as number;
    assert.equal(ids.length, n);
    assert.ok(ids.filter((id) => byId.get(id)?.repo === 'django/django').length <= Math.max(1, Math.floor(n * plan.sets.build.capped_share)));
    const ranks = ids.map((id) => rank(plan.seed, null, id));
    assert.ok(ids.every((id) => byId.get(id)?.difficulty === stratum));
    // Rank order is kept among the chosen ones.
    assert.deepEqual([...ranks].sort(), ranks);
  }
  const others = new Map<string, number>();
  for (const id of build) {
    const repo = byId.get(id)?.repo as string;
    if (repo !== 'django/django') others.set(repo, (others.get(repo) ?? 0) + 1);
  }
  for (const n of others.values()) assert.ok(n <= plan.sets.build.max_per_other_repo);
});

test('an instance the gold check dropped from the build list is replaced by the next in rank, and stays available to the digest list', () => {
  const pool = instances();
  const arm64 = new Set(pool.map((r) => r.instance_id));
  const first = chooseSwebench(plan.seed, pool, arm64, plan.sets.build, plan.sets.digest);
  const dropped = Object.values(first.build).flat()[0] as string;
  const second = chooseSwebench(plan.seed, pool, arm64, plan.sets.build, plan.sets.digest, { build: new Set([dropped]) });
  const build2 = Object.values(second.build).flat();
  assert.ok(!build2.includes(dropped));
  assert.equal(build2.length, Object.values(first.build).flat().length);
  assert.deepEqual(second.digest, first.digest);
});

test('Terminal-Bench routine tasks: an expert estimate of at most 30 minutes, within the time and memory limits, first n by rank', () => {
  const tasks = [
    { id: 'a', expert_time_estimate_min: 10, agent_timeout_sec: 900, memory_mb: 2048 },
    { id: 'b', expert_time_estimate_min: 60, agent_timeout_sec: 900, memory_mb: 2048 },
    { id: 'c', expert_time_estimate_min: 30, agent_timeout_sec: 3600, memory_mb: 2048 },
    { id: 'd', expert_time_estimate_min: 20, agent_timeout_sec: 900, memory_mb: 8192 },
    { id: 'e', expert_time_estimate_min: null, agent_timeout_sec: 900, memory_mb: 2048 },
    { id: 'f', expert_time_estimate_min: 5, agent_timeout_sec: 600, memory_mb: 1024 },
  ];
  const rule = { n: 5, max_expert_min: 30, max_agent_timeout_sec: 1800, max_memory_mb: 4096 };
  assert.deepEqual(new Set(chooseTerminalBench('s', tasks, rule)), new Set(['a', 'f']));
  assert.deepEqual(chooseTerminalBench('s', tasks, rule, new Set(['a'])), ['f']);
});

test('the Terminal-Bench selection reproduces the pre-registered order of the design', () => {
  const ids = ['pytorch-model-recovery', 'vulnerable-secret', 'qemu-alpine-ssh', 'prove-plus-comm', 'sanitize-git-repo', 'nginx-request-logging'];
  const tasks = [...ids].reverse().map((id) => ({ id, expert_time_estimate_min: 15, agent_timeout_sec: 900, memory_mb: 2048 }));
  assert.deepEqual(chooseTerminalBench('noonsight-eval-2026-11-16', tasks, { n: 6, max_expert_min: 30, max_agent_timeout_sec: 1800, max_memory_mb: 4096 }), ids);
});

test('the gold record excludes a task by its latest entry, per set, and lists the chosen tasks still unchecked', () => {
  const entry = (set: 'build' | 'digest', id: string, passed: boolean) => ({ set, id, sha256: 'x', passed, reward: passed ? 1 : 0, error: null, seconds: { total: 1, environment: 0, agent: 0, verifier: 0 }, at: '' });
  const record: GoldRecord = { machine: '', skipped: {}, entries: [entry('build', 'a', false), entry('build', 'b', false), entry('build', 'b', true), entry('digest', 'c', false)] };
  const ex = excludedBy(record);
  assert.deepEqual([...(ex.build ?? [])], ['a']);
  assert.deepEqual([...(ex.digest ?? [])], ['c']);
  const sel = { build: ['a', 'b', 'd'], routine: [], digest: ['c'], investigate: [], review: ['r'] };
  assert.deepEqual(unchecked(sel, record), [
    { set: 'build', id: 'd' },
    { set: 'review', id: 'r' },
  ]);
});

test('Harbor rewards are read from rewards.reward, or the only reward', () => {
  assert.equal(reward({ rewards: { reward: 1 } }), 1);
  assert.equal(reward({ rewards: { pass: 0 } }), 0);
  assert.equal(reward({ rewards: { a: 1, b: 0 } }), null);
  assert.equal(reward(null), null);
});

const twoTasks = { build: ['b1', 'b2'], routine: ['r1'], digest: ['d1'], investigate: [], review: [] } as const;

test('rounds run in the priority order: build off and on, then the other sets off and on, then placebo, round by round', () => {
  const all = rounds(plan, twoTasks, ['opus', 'haiku']);
  assert.deepEqual(
    all.map((r) => `${r.phase}#${r.rep}`),
    ['build off-on#1', 'build off-on#2', 'other sets off-on#1', 'other sets off-on#2', 'placebo#1', 'placebo#2'],
  );
  const first = all[0];
  assert.ok(first);
  // A unit is one task and model with every condition of the phase, so a stop between units leaves complete pairs.
  for (const u of first.units) {
    assert.deepEqual(new Set(u.cells.map((c) => c.condition)), new Set(['off', 'on']));
    assert.equal(new Set(u.cells.map((c) => `${c.task}.${c.model}.${c.rep}`)).size, 1);
  }
  assert.equal(first.units.length, 4);
  assert.deepEqual(rounds(plan, twoTasks, ['opus', 'haiku']), all, 'the order is the same every time');
  const keys = all.flatMap((r) => r.units.flatMap((u) => u.cells.map(cellKey)));
  assert.equal(new Set(keys).size, keys.length, 'no run twice');
  assert.equal(keys.length, (2 * 2 + 2 * 2) * 2 * 2 + 4 * 2 * 2);
});

test('a night continues the unfinished round and starts whole rounds while they fit its budget and the cap', () => {
  const all = rounds(plan, twoTasks, ['opus']);
  const cost = (): number => 1;
  // Each build round has 2 tasks x 1 model x 2 conditions = 4 runs of $1.
  const n1 = planNight(all, new Set(), cost, 9, 100);
  assert.deepEqual(n1.rounds.map((r) => r.phase), ['build off-on', 'build off-on']);
  assert.match(n1.stop, /night's budget/);
  const done = new Set(n1.rounds.flatMap((r) => r.units.flatMap((u) => u.cells.map(cellKey))));
  const firstOfRound = all[0]?.units[0]?.cells.map(cellKey) ?? [];
  // Half a round done: the night picks it up and counts only what is left.
  const partial = new Set(firstOfRound);
  const n2 = planNight(all, partial, cost, 3, 100);
  assert.equal(n2.rounds.length, 1);
  assert.equal(n2.projected_usd, 2);
  const n3 = planNight(all, done, cost, 100, 3);
  assert.equal(n3.rounds.length, 1, 'a night always takes at least the next round');
  assert.match(n3.stop, /cap/);
  // Planning again within a night takes a round only if it fits what is left.
  assert.equal(planNight(all, done, cost, 3, 100, false).rounds.length, 0);
  assert.equal(planNight(all, done, cost, 4, 100, false).rounds.length, 1);
  const everything = new Set(all.flatMap((r) => r.units.flatMap((u) => u.cells.map(cellKey))));
  assert.equal(planNight(all, everything, cost, 100, 100).rounds.length, 0);
});

test('a run is expected to cost the mean measured for its model and set once three runs exist, else the plan figure, plus the judge on open sets', () => {
  const cell: Cell = { set: 'digest', task: 'd', model: 'opus', condition: 'on', rep: 1 };
  assert.equal(expectedCost(plan, cell, new Map(), ['digest']), (plan.models.opus?.expected_usd ?? 0) + plan.judge.expected_usd);
  assert.equal(expectedCost(plan, { ...cell, set: 'build' }, new Map([['opus/build', { n: 3, mean: 0.5 }]]), ['digest']), 0.5);
  assert.equal(expectedCost(plan, { ...cell, set: 'build' }, new Map([['opus/build', { n: 2, mean: 0.5 }]]), ['digest']), plan.models.opus?.expected_usd);
});

test('a run started and never ended is interrupted: it counts at its budget once, and closing it stops counting it twice', () => {
  const journal = [
    { event: 'start' as const, key: 'a', night: 1, at: '1', budget_usd: 1.5 },
    { event: 'end' as const, key: 'a', night: 1, at: '2', cost_usd: 0.4 },
    { event: 'start' as const, key: 'b', night: 1, at: '3', budget_usd: 3.5 },
  ];
  assert.deepEqual(
    interrupted(journal).map((j) => j.key),
    ['b'],
  );
  const runs = [{ key: 'a', cost_counted_usd: 0.4, infra_failure: null } as unknown as Recorded];
  assert.equal(spent(runs, journal), 0.4 + 3.5);
  const closed = [...journal, { event: 'retry' as const, key: 'b', night: 1, at: '4', cost_usd: 3.5, why: 'interrupted' }];
  assert.equal(interrupted(closed).length, 0);
  assert.equal(spent(runs, closed, [{ cost_usd: 0.1 }]), 0.4 + 3.5 + 0.1);
  assert.deepEqual(measured([{ model: 'opus', set: 'build', cost_usd: 0.2, infra_failure: null } as unknown as Recorded, { model: 'opus', set: 'build', infra_failure: 'x' } as unknown as Recorded]).get('opus/build'), { n: 1, mean: 0.2 });
});

test('the quota reading takes the all-models scope and each model scope of quota-axi, and an unreadable quota stops the night', () => {
  const json = JSON.stringify({
    providers: [
      {
        provider: 'claude',
        windows: [{ id: 'seven_day', resetsAt: '2026-11-22T04:00:00Z', percentRemaining: 86 }],
        quotaSemantics: { effectiveAvailability: [{ scope: 'all_models', effectivePercentRemaining: 62 }, { scope: 'model:fable', effectivePercentRemaining: 48 }] },
      },
    ],
  });
  const q = parseQuota(json);
  assert.equal(q.all_models, 62);
  assert.deepEqual(q.models, { fable: 48 });
  assert.equal(q.resets_at, '2026-11-22T04:00:00Z');
  assert.equal(aboveFloor(q, 50, 'opus').ok, true);
  assert.equal(aboveFloor(q, 50, 'fable').ok, false);
  assert.equal(aboveFloor({ ...q, all_models: 49 }, 50, 'opus').ok, false);
  assert.equal(aboveFloor(parseQuota('not json'), 50, 'opus').ok, false);
});

test('off and on differ only in "use"; placebo delivers one neutral text per default-on rule with its scopes and places', () => {
  for (const model of ['claude-fable-5-2', 'claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5']) {
    const off = conditionConfig(plan, model, 'off').config as any;
    const on = conditionConfig(plan, model, 'on').config as any;
    assert.deepEqual(off.models[model], { use: 'none' });
    assert.deepEqual(on.models[model], { use: 'preset' });
    assert.deepEqual(off.session, on.session);
    const { config, files } = conditionConfig(plan, model, 'placebo');
    const add = (config as any).models[model].add as { id: string; file: string; scopes?: string[]; where?: string[] }[];
    const rules = defaultOnRules(model);
    assert.equal(add.length, rules.length);
    for (const p of plan.placebo[model] ?? []) {
      const rule = rules.find((r) => r.id === p.mirrors);
      const a = add.find((x) => x.id === p.id);
      assert.ok(rule && a);
      assert.deepEqual(a.scopes, rule.scopes);
      assert.deepEqual(a.where, rule.where);
      const ratio = (files[p.file] as string).length / presetText(rule).length;
      assert.ok(Math.abs(ratio - 1) <= 0.02, `${p.id} is ${ratio} times the length of ${rule.id}`);
    }
  }
});

test('the placebo texts give no instruction and name none of the things the rules are about', () => {
  for (const f of fs.readdirSync(path.join(BENCH_DIR, 'placebo')).filter((f) => f.endsWith('.md'))) {
    const t = placeboText(f).toLowerCase();
    for (const w of ['test', 'check', 'verif', 'finish', 'scope', 'report', 'stop', 'continue', 'confirm', 'should', 'must', 'please', 'ask', 'done', 'task', 'work '])
      assert.ok(!t.includes(w), `${f} contains "${w}"`);
    assert.match(placeboText(f), /^The user/);
  }
  const sums = fs.readFileSync(path.join(BENCH_DIR, 'placebo', 'SHA256SUMS'), 'utf8');
  for (const f of fs.readdirSync(path.join(BENCH_DIR, 'placebo')).filter((f) => f.endsWith('.md'))) assert.match(sums, new RegExp(`  ${f}$`, 'm'));
});

test('the hook settings run every noonsight hook through the pointer the agent installs', () => {
  const text = JSON.stringify(hookSettings());
  assert.match(text, /\/opt\/noonsight\/bin\/noonsight-hook/);
  assert.match(text, /SessionStart/);
});

test('verification counts a check command after the last edit outside /logs, in the ecosystems of the tasks', () => {
  const call = (name: string, input: Record<string, unknown>, denied = false) => ({ id: name, name, input, denied });
  assert.deepEqual(verification([call('Edit', { file_path: '/testbed/a.py' }), call('Bash', { command: 'python -m pytest tests/x.py' })]), { edited: true, ran_checks: true, verified: true });
  assert.deepEqual(verification([call('Bash', { command: './tests/runtests.py admin_utils' }), call('Edit', { file_path: '/testbed/a.py' })]), { edited: true, ran_checks: true, verified: false });
  assert.equal(verification([call('Edit', { file_path: '/testbed/a.py' }), call('Write', { file_path: '/logs/agent/digest.md' }), call('Bash', { command: 'bin/test sympy/core' })]).verified, true);
  assert.equal(verification([call('Edit', { file_path: '/testbed/a.py' }), call('Bash', { command: 'ls' })]).verified, false);
  // Edits made through the shell count as edits, and a check after the edit in the same command counts.
  assert.deepEqual(verification([call('bash', { command: "cd /testbed && sed -i '697s/a/b/' sympy/x.py && sed -n 695,699p sympy/x.py" }), call('Bash', { command: 'python -c "import sympy"' })]), { edited: true, ran_checks: true, verified: true });
  assert.equal(verification([call('Bash', { command: 'python -m pytest x' }), call('Bash', { command: "sed -i 's/a/b/' x.py" })]).verified, false);
  assert.equal(verification([call('Bash', { command: "sed -i 's/a/b/' x.py && python -m pytest x" })]).verified, true);
  assert.equal(verification([call('Bash', { command: 'cat > src/fix.py <<EOF\nx\nEOF' })]).edited, true);
  assert.equal(verification([call('Bash', { command: 'echo done > /logs/agent/answer.txt 2>&1' })]).edited, false);
  assert.equal(verification([call('Bash', { command: 'python -m pytest x 2>&1 | tail' })]).edited, false);
  assert.equal(verification([call('Bash', { command: "python - <<'E'\np='a.py'\ns=open(p).read()\nopen(p,'w').write(s)\nE" }), call('Bash', { command: 'conda run -n testbed python -m pytest t -q' })]).verified, true);
  assert.equal(verification([call('Bash', { command: "python -c 'import a; print(a.f())'" })]).edited, false);
});

test('usage reads the last result event: subtype, cost, tokens over every model, turns and the final message', () => {
  const stream = parseStream(
    [
      'not json',
      JSON.stringify({ type: 'assistant', message: { content: [] } }),
      JSON.stringify({ type: 'result', subtype: 'success', total_cost_usd: 0.12, num_turns: 7, duration_ms: 900, result: 'Done.', modelUsage: { a: { inputTokens: 1, outputTokens: 2, cacheReadInputTokens: 3, cacheCreationInputTokens: 4 }, b: { inputTokens: 10, outputTokens: 20 } } }),
    ].join('\n'),
  );
  const u = usage(stream);
  assert.equal(u.outcome, 'success');
  assert.equal(u.cost_usd, 0.12);
  assert.deepEqual(u.tokens, { input: 11, cache_creation: 4, cache_read: 3, output: 22 });
  assert.equal(u.final, 'Done.');
  assert.equal(usage([]).outcome, 'no-result');
});

test('the judge sees no condition, reads ratings by statement or order, and takes the majority per item', () => {
  assert.equal(scrub('noonsight-rules said opus-5-5/unattended-run and local/workspace-notes-3'), '[removed] said [removed] and [removed]');
  const items: Item[] = [
    { id: '1', statement: 'A', scored: true },
    { id: '2', statement: 'B', scored: true },
    { id: '3', statement: 'C', scored: false },
  ];
  assert.match(judgeMessage({ system: '', prompt: 'P', items }, 'answer'), /"rubric_statement": "B"/);
  const v1 = parseRatings('```json\n{"ratings":[{"rubric_statement":"B","status":"YES","score":"1"},{"rubric_statement":"A","status":"NO","score":"0"}]}\n```', items);
  assert.deepEqual(v1, [false, true, null]);
  const t = tally(items, [
    [true, true, false],
    [false, true, false],
    [true, false, true],
  ]);
  assert.deepEqual(
    t.items.map((i) => i.verdict),
    [true, true, false],
  );
  assert.equal(t.score, 1);
  assert.equal(tally(items, [[null, true, true]]).score, null, 'an undecided scored item leaves the score open');
});

test('calibration picks take the conditions in turn', () => {
  const items = ['off', 'off', 'off', 'on', 'on', 'placebo'].map((condition, i) => ({ condition, i }));
  assert.deepEqual(
    pickCalibration(items, 5).map((x) => x.condition),
    ['off', 'on', 'placebo', 'off', 'on'],
  );
});

test('task files: one key or one section leaves a task.toml, and a SWE-bench task moves to its arm64 image', () => {
  const toml = '[environment]\ndocker_image = "x:1"\ncpus = 1\n\n[verifier.env]\nKEY = "v"\n\n[agent]\ntimeout_sec = 900\n';
  assert.equal(tomlValue(dropKey(toml, 'docker_image', 'environment'), 'docker_image', 'environment'), null);
  assert.equal(tomlValue(dropKey(toml, 'docker_image', 'environment'), 'cpus', 'environment'), '1');
  assert.equal(tomlValue(dropSection(toml, 'verifier.env'), 'KEY'), null);
  assert.equal(tomlValue(dropSection(toml, 'verifier.env'), 'timeout_sec', 'agent'), '900');
  const dir = tempTree({ 'environment/Dockerfile': 'FROM swebench/sweb.eval.x86_64.django_1776_django-12308:latest\nWORKDIR /testbed\n' });
  useArm64Image(dir, 'django__django-12308');
  assert.match(fs.readFileSync(path.join(dir, 'environment', 'Dockerfile'), 'utf8'), /^FROM swebench\/sweb\.eval\.arm64\.django_1776_django-12308:latest$/m);
  assert.throws(() => useArm64Image(dir, 'django__django-1'));
});

test('the committed pilot list is the selection of the committed arm64 list after the gold check', () => {
  const pilot = JSON.parse(fs.readFileSync(path.join(BENCH_DIR, 'tasks', 'pilot.json'), 'utf8')) as { seed: string; sets: Record<string, { id: string }[]> };
  assert.equal(pilot.seed, plan.seed);
  const arm64 = new Set((JSON.parse(fs.readFileSync(path.join(BENCH_DIR, 'tasks', 'swebench-arm64.json'), 'utf8')) as { instances: string[] }).instances);
  for (const t of [...(pilot.sets.build ?? []), ...(pilot.sets.digest ?? [])]) assert.ok(arm64.has(t.id), `${t.id} has an arm64 image`);
  assert.ok(typeof selection === 'function');
});
