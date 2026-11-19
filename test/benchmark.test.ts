// The pilot harness of the benchmark study (experiments/benchmark), on written inputs: no model,
// no Docker and no network are used here.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { pickCalibration } from '../experiments/benchmark/calibration.js';
import { CONTAINER, conditionConfig, defaultOnRules, hookSettings, modelName, ownShare, POINTER_CLAUDE_MD, presetText, unionRules, writeCondition } from '../experiments/benchmark/conditions.js';
import { deliveries, deliveryTable, pathOf, rulesIn, signatures } from '../experiments/benchmark/delivery.js';
import { excludedBy, unchecked, type GoldRecord } from '../experiments/benchmark/gold.js';
import { reward } from '../experiments/benchmark/harbor.js';
import { judgeMessage, parseRatings, scrub, tally, type Grade, type Item } from '../experiments/benchmark/judge.js';
import { BENCH_DIR, loadPlan, selection, wanted } from '../experiments/benchmark/plan.js';
import { PACKAGE_ROOT } from '../src/config/paths.js';
import { accountEnv, aboveFloor, parseQuota } from '../experiments/benchmark/quota.js';
import os from 'node:os';
import { doneKeys, interrupted, measured, spent, type Recorded, type RunRecord } from '../experiments/benchmark/run.js';
import { cellKey, expectedCost, planNight, rounds, type Cell } from '../experiments/benchmark/schedule.js';
import { hitUsageLimit, parseStream, readFile, usage, verification } from '../experiments/benchmark/score.js';
import { chooseSwebench, chooseTerminalBench, rank, type SwebenchInstance } from '../experiments/benchmark/select.js';
import { costByCondition, deliveryCheck, expectedRules, modelSwitches, openScores, ownShareByCondition, probeOwnShare, readResults, resolution, rulesRead, runOwnShare, summaryMarkdown } from '../experiments/benchmark/summary.js';
import { tomlValue } from '../experiments/benchmark/sources.js';
import { dropKey, dropSection, unpinBase, useArm64Image } from '../experiments/benchmark/tasks.js';
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
  // A failure of an earlier version of the task drops nothing once the task changed.
  assert.deepEqual([...(excludedBy(record, () => 'y').build ?? [])], []);
  assert.deepEqual([...(excludedBy(record, () => 'x').build ?? [])], ['a']);
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

test('rounds run in the priority order: build off and on, then the other sets off and on, then claudemd and scattered, round by round', () => {
  const all = rounds(plan, twoTasks, ['opus', 'haiku']);
  assert.deepEqual(
    all.map((r) => `${r.phase}#${r.rep}`),
    ['build off-on#1', 'build off-on#2', 'other sets off-on#1', 'other sets off-on#2', 'claudemd#1', 'claudemd#2', 'scattered#1'],
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
  // Build and the other sets under off and on, 2 rounds; every set under claudemd, 2 rounds, and under scattered, 1.
  assert.equal(keys.length, (2 * 2 + 2 * 2) * 2 * 2 + 4 * 2 * 2 + 4 * 2);
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

test('an infrastructure failure is done unless the night retries it, and a later result of the same key is done either way', () => {
  const ok = { key: 'a', infra_failure: null } as unknown as Recorded;
  const infra = { key: 'b', infra_failure: 'setup failed' } as unknown as Recorded;
  const retried = [infra, { key: 'b', infra_failure: null } as unknown as Recorded];
  assert.deepEqual([...doneKeys([ok, infra], false)].sort(), ['a', 'b']);
  assert.deepEqual([...doneKeys([ok, infra], true)], ['a']);
  assert.deepEqual([...doneKeys([ok, ...retried], true)].sort(), ['a', 'b']);
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
  // With no floor the night still ends when the quota is used up.
  assert.equal(aboveFloor({ ...q, all_models: 1, models: {} }, 0, 'opus').ok, true);
  assert.equal(aboveFloor({ ...q, all_models: 0, models: {} }, 0, 'opus').ok, false);
});

test('an account is selected by its configuration directory, except the default one, which is selected by naming none', () => {
  assert.equal(accountEnv('/x/.claude-other', { PATH: 'p', CLAUDE_CONFIG_DIR: '/elsewhere' }).CLAUDE_CONFIG_DIR, '/x/.claude-other');
  const def = accountEnv(path.join(os.homedir(), '.claude'), { PATH: 'p', CLAUDE_CONFIG_DIR: '/elsewhere' });
  assert.equal('CLAUDE_CONFIG_DIR' in def, false);
  assert.equal(def.PATH, 'p');
});

test('off and on differ only in "use"', () => {
  for (const model of ['claude-fable-5-2', 'claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5']) {
    const off = conditionConfig(plan, model, 'off').config as any;
    const on = conditionConfig(plan, model, 'on').config as any;
    assert.deepEqual(off.models[model], { use: 'none' });
    assert.deepEqual(on.models[model], { use: 'preset' });
    assert.deepEqual(off.session, on.session);
  }
  assert.throws(() => conditionConfig(plan, 'claude-haiku-5-5', 'placebo'), /unknown condition placebo/);
});

const MODELS = ['claude-fable-5-2', 'claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'];

test('claudemd puts every default-on rule of every model, unchanged, under a heading per model, in the user CLAUDE.md, with noonsight declared none', () => {
  const c = conditionConfig(plan, 'claude-sonnet-5-5', 'claudemd');
  assert.deepEqual((c.config as any).models, { 'claude-sonnet-5-5': { use: 'none' } });
  assert.equal(c.rulesFile, null);
  const md = c.claudeMd as string;
  for (const model of MODELS) {
    assert.match(md, new RegExp(`^## For ${modelName(model).replace('.', '\\.')}$`, 'm'));
    for (const r of defaultOnRules(model)) assert.ok(md.includes(presetText(r).trim()), `${r.id} is in the CLAUDE.md as written`);
  }
  assert.equal(modelName('claude-sonnet-5-5'), 'Claude Sonnet 5.5');
  assert.match(md, /Applies to: tasks of kind investigate, build, routine; when someone is watching, when nobody is watching, in subagents\./);
  assert.ok(!md.includes('enabled'), 'no rule shipped off');
  assert.equal(md, unionRules(MODELS), 'the same text for every model');
});

test('scattered puts only a pointer in the user CLAUDE.md, without an import, and the same rules in a file outside the repository', () => {
  const c = conditionConfig(plan, 'claude-opus-5-5', 'scattered');
  assert.equal(c.claudeMd, POINTER_CLAUDE_MD);
  assert.ok(POINTER_CLAUDE_MD.includes(CONTAINER.rulesFile));
  assert.ok(!POINTER_CLAUDE_MD.includes('@'), 'a pointer, not an @ import that would load the file');
  assert.equal(c.rulesFile, unionRules(MODELS));
});

test("the share of the rules written for the receiving model is 1 for its own, 0 for another's, null for none, and sums to one over every model", () => {
  const all = MODELS.flatMap((m) => defaultOnRules(m));
  const shares = MODELS.map((m) => ownShare(m, all) as number);
  assert.ok(Math.abs(shares.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  for (const s of shares) assert.ok(s > 0.1 && s < 0.4);
  assert.equal(ownShare('claude-sonnet-5-5', defaultOnRules('claude-sonnet-5-5')), 1);
  assert.equal(ownShare('claude-sonnet-5-5', defaultOnRules('claude-haiku-5-5')), 0);
  assert.equal(ownShare('claude-sonnet-5-5', []), null);
});

test('a condition writes its Markdown beside the configuration, and only claudemd and scattered log instruction loads', () => {
  const dir = tempTree({});
  const onSha = writeCondition(plan, 'claude-haiku-5-5', 'on', path.join(dir, 'on'));
  assert.ok(!fs.existsSync(path.join(dir, 'on', 'claude')));
  assert.ok(!('InstructionsLoaded' in (JSON.parse(fs.readFileSync(path.join(dir, 'on', 'settings.json'), 'utf8')).hooks as object)));
  const sha = writeCondition(plan, 'claude-haiku-5-5', 'scattered', path.join(dir, 'sc'));
  assert.notEqual(sha, onSha);
  assert.equal(fs.readFileSync(path.join(dir, 'sc', 'claude', 'CLAUDE.md'), 'utf8'), POINTER_CLAUDE_MD);
  assert.equal(fs.readFileSync(path.join(dir, 'sc', 'claude', 'rules.md'), 'utf8'), unionRules(MODELS));
  const hooks = JSON.parse(fs.readFileSync(path.join(dir, 'sc', 'settings.json'), 'utf8')).hooks as Record<string, unknown>;
  assert.match(JSON.stringify(hooks.InstructionsLoaded), new RegExp(CONTAINER.instructions));
  assert.ok(hooks.SessionStart, 'noonsight hooks stay');
  assert.ok(JSON.stringify(hookSettings(true)).includes('InstructionsLoaded'));
});

test('read_rules: the scattered rules file read by Read, Grep or a shell command, and whether before the first edit', () => {
  const call = (name: string, input: Record<string, unknown>) => ({ id: name, name, input, denied: false });
  const f = CONTAINER.rulesFile;
  assert.deepEqual(readFile([call('Read', { file_path: f }), call('Edit', { file_path: '/testbed/a.py' })], f), { read: true, before_first_edit: true });
  assert.deepEqual(readFile([call('Bash', { command: "sed -i 's/a/b/' x.py" }), call('Bash', { command: `cat ${f}` })], f), { read: true, before_first_edit: false });
  assert.deepEqual(readFile([call('Bash', { command: 'ls /opt' })], f), { read: false, before_first_edit: false });
  assert.deepEqual(readFile([call('Grep', { pattern: 'rules', path: f })], f), { read: true, before_first_edit: true });
});

test('delivery: only rule texts that belong to one model identify it, and every model keeps at least one', () => {
  const sigs = signatures(MODELS);
  for (const m of MODELS) assert.ok((sigs.get(m) ?? []).length > 0, m);
  // Sonnet and Haiku ship the same verify-changes text, so it names neither.
  const verify = presetText(defaultOnRules('claude-sonnet-5-5').find((r) => r.id.endsWith('verify-changes'))!).trim().slice(0, 120);
  for (const m of MODELS) assert.ok(!(sigs.get(m) ?? []).some((x) => x === JSON.stringify(verify).slice(1, -1)));
  const body = { messages: [{ role: 'user', content: unionRules(['claude-opus-5-5']) }] };
  assert.deepEqual(rulesIn(body, sigs), ['claude-opus-5-5']);
});

test('delivery: each request stands for a path, the first of a path counts, and the table has a column per arm', () => {
  const user = (content: unknown) => ({ role: 'user', content });
  const opusText = presetText(defaultOnRules('claude-opus-5-5')[0]!);
  const start = { model: 'claude-opus-5-5', messages: [user([{ type: 'text', text: opusText }, { type: 'text', text: 'PROBE-STEP start: reply ok' }])] };
  const spawnParent = { model: 'claude-opus-5-5', messages: [user('PROBE-STEP spawn Explore')] };
  const sub = { model: 'claude-opus-5-5', messages: [user('PROBE-SUBAGENT-TASK Explore: reply with the word done.')] };
  const result = { model: 'claude-opus-5-5', messages: [user('PROBE-STEP spawn Explore'), { role: 'assistant', content: [] }, user([{ type: 'tool_result', content: 'done' }])] };
  assert.equal(pathOf(start), 'start');
  assert.equal(pathOf(spawnParent), null, "the parent's turn before the subagent is not a path");
  assert.equal(pathOf(sub), 'subagent Explore');
  assert.equal(pathOf(result), null);
  const rows = deliveries([{ body: start }, { body: spawnParent }, { body: sub }, { body: start }], MODELS);
  assert.deepEqual(rows, [
    { path: 'start', model: 'claude-opus-5-5', own: true, others: [] },
    { path: 'subagent Explore', model: 'claude-opus-5-5', own: false, others: [] },
  ]);
  const table = deliveryTable({ on: rows, claudemd: [] }, ['start', 'subagent Explore', 'after-clear']);
  assert.match(table, /^\| Path \| Model of the request \| on \| claudemd \|$/m);
  assert.match(table, /^\| start \| claude-opus-5-5 \| yes \| not reached \|$/m);
  assert.match(table, /^\| after-clear \|  \| not reached \| not reached \|$/m);
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
  assert.equal(hitUsageLimit([{ type: 'result', is_error: true, api_error_status: 429, result: 'x' }]), true);
  assert.equal(hitUsageLimit([{ type: 'result', is_error: true, result: "Claude AI usage limit reached|1794990000" }]), true);
  assert.equal(hitUsageLimit([{ type: 'result', is_error: false, result: 'The quota module is fixed.' }]), false, 'a word in a successful answer is not the limit');
  assert.equal(hitUsageLimit([{ type: 'result', is_error: true, api_error: 'connection_failed', result: 'API Error' }]), false);
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
  const items = ['off', 'off', 'off', 'on', 'on', 'claudemd'].map((condition, i) => ({ condition, i }));
  assert.deepEqual(
    pickCalibration(items, 5).map((x) => x.condition),
    ['claudemd', 'off', 'on', 'off', 'on'],
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
  const review = tempTree({ 'environment/Dockerfile': 'FROM node:22-bookworm-slim@sha256:' + 'e'.repeat(64) + '\nRUN true\n' });
  unpinBase(review);
  assert.equal(fs.readFileSync(path.join(review, 'environment', 'Dockerfile'), 'utf8'), 'FROM node:22-bookworm-slim\nRUN true\n');
});

test('the committed pilot list is the selection of the committed arm64 list after the gold check', () => {
  const pilot = JSON.parse(fs.readFileSync(path.join(BENCH_DIR, 'tasks', 'pilot.json'), 'utf8')) as { seed: string; sets: Record<string, { id: string }[]> };
  assert.equal(pilot.seed, plan.seed);
  const arm64 = new Set((JSON.parse(fs.readFileSync(path.join(BENCH_DIR, 'tasks', 'swebench-arm64.json'), 'utf8')) as { instances: string[] }).instances);
  for (const t of [...(pilot.sets.build ?? []), ...(pilot.sets.digest ?? [])]) assert.ok(arm64.has(t.id), `${t.id} has an arm64 image`);
  assert.ok(typeof selection === 'function');
});

/** A recorded run with only the fields the summary reads. */
function recorded(over: Partial<RunRecord> & Pick<RunRecord, 'key' | 'condition' | 'model' | 'model_id'>): RunRecord {
  return {
    set: 'build',
    task: 't',
    rep: 1,
    effort: 'medium',
    night: 1,
    started: '2026-11-17T00:00:00Z',
    attempts: 1,
    pins: { noonsight_commit: 'c', claude_code: '2.1.326', harbor: '0.26.0', task_sha256: 't', condition_sha256: `${over.condition}-${over.model}` },
    noonsight: { status: 'none', reason: 'declared-none', place: 'unattended', scope: 'build', rules: [], sha256: null },
    outcome: 'success',
    cost_usd: 0.1,
    cost_counted_usd: 0.1,
    tokens: { input: 10, cache_creation: 1000, cache_read: 9000, output: 100 },
    turns: 3,
    duration_ms: 1000,
    wall_s: { total: 1, environment: 0, agent_setup: 0, agent: 1, verifier: 0 },
    models_used: [over.model_id],
    resolved: true,
    answer_written: null,
    changed_files: [],
    signals: { read_rules: { read: false, before_first_edit: false } } as RunRecord['signals'],
    infra_failure: null,
    ...over,
  };
}

const userClaudeMd = [{ file_path: '/logs/agent/sessions/CLAUDE.md', memory_type: 'User', load_reason: 'session_start', agent_id: null }];

test('the preset rules a run expects follow the model, the scope and the place', () => {
  assert.deepEqual(expectedRules('claude-sonnet-5-5', 'routine', 'unattended'), ['sonnet-5-5/carry-through', 'sonnet-5-5/stay-in-scope', 'sonnet-5-5/verify-changes']);
  assert.deepEqual(expectedRules('claude-sonnet-5-5', 'digest', 'unattended'), ['sonnet-5-5/carry-through']);
  assert.deepEqual(expectedRules('claude-fable-5-2', 'build', 'unattended'), ['fable-5-2/low-context-report']);
  assert.deepEqual(expectedRules('claude-opus-5-5', 'build', 'session'), []);
});

test('the delivery check holds each condition to what it delivers', () => {
  const sonnet = { model: 'sonnet', model_id: 'claude-sonnet-5-5' } as const;
  const matched = { status: 'matched', reason: null, place: 'unattended', scope: 'build', rules: ['sonnet-5-5/carry-through', 'sonnet-5-5/verify-changes'], sha256: 'x' };
  const runs = [
    recorded({ key: 'off-ok', condition: 'off', ...sonnet }),
    recorded({ key: 'off-noonsight-delivered', condition: 'off', ...sonnet, noonsight: matched }),
    recorded({ key: 'on-ok', condition: 'on', ...sonnet, noonsight: matched }),
    recorded({ key: 'on-wrong-rules', condition: 'on', ...sonnet, noonsight: { ...matched, rules: ['sonnet-5-5/carry-through'] } }),
    recorded({ key: 'claudemd-ok', condition: 'claudemd', ...sonnet, instruction_loads: userClaudeMd }),
    recorded({ key: 'claudemd-not-loaded', condition: 'claudemd', ...sonnet, instruction_loads: [] }),
    recorded({ key: 'scattered-noonsight-too', condition: 'scattered', ...sonnet, instruction_loads: userClaudeMd, noonsight: matched }),
  ];
  const byCondition = Object.fromEntries(deliveryCheck(runs).map((d) => [d.condition, d]));
  assert.deepEqual(byCondition.off?.unexpected, ['off-noonsight-delivered']);
  assert.deepEqual(byCondition.on?.unexpected, ['on-wrong-rules']);
  assert.deepEqual(byCondition.claudemd?.unexpected, ['claudemd-not-loaded']);
  assert.deepEqual(byCondition.scattered?.unexpected, ['scattered-noonsight-too']);
  assert.equal(byCondition.on?.as_expected, 1);
  assert.deepEqual(byCondition.off?.texts_per_model, { sonnet: 1 });
});

test("a run's own share follows what its condition delivered: all under on, its part of the union under claudemd and a read scattered file, none otherwise", () => {
  const sonnet = { model: 'sonnet', model_id: 'claude-sonnet-5-5' } as const;
  const read = { read_rules: { read: true, before_first_edit: true } } as RunRecord['signals'];
  const union = ownShare('claude-sonnet-5-5', MODELS.flatMap((m) => defaultOnRules(m)));
  const matched = { status: 'matched', reason: null, place: 'unattended', scope: 'build', rules: ['sonnet-5-5/carry-through'], sha256: 'x' };
  assert.equal(runOwnShare(recorded({ key: 'a', condition: 'on', ...sonnet, noonsight: matched }), MODELS), 1);
  assert.equal(runOwnShare(recorded({ key: 'b', condition: 'on', ...sonnet, noonsight: { ...matched, rules: [] } }), MODELS), null);
  assert.equal(runOwnShare(recorded({ key: 'c', condition: 'off', ...sonnet }), MODELS), null);
  assert.equal(runOwnShare(recorded({ key: 'd', condition: 'claudemd', ...sonnet }), MODELS), union);
  assert.equal(runOwnShare(recorded({ key: 'e', condition: 'scattered', ...sonnet }), MODELS), null);
  assert.equal(runOwnShare(recorded({ key: 'f', condition: 'scattered', ...sonnet, signals: read }), MODELS), union);
  const cells = ownShareByCondition([recorded({ key: 'e', condition: 'scattered', ...sonnet }), recorded({ key: 'f', condition: 'scattered', ...sonnet, signals: read })], ['sonnet'], MODELS);
  assert.deepEqual(cells.sonnet?.scattered, { runs: 2, with_rules: 1, mean: union });
  assert.deepEqual(cells.sonnet?.off, { runs: 0, with_rules: 0, mean: null });
  assert.equal(probeOwnShare('on', { path: 'start', model: 'claude-sonnet-5-5', own: true, others: [] }), 1);
  assert.equal(probeOwnShare('claudemd', { path: 'start', model: 'claude-sonnet-5-5', own: true, others: MODELS.filter((m) => m !== 'claude-sonnet-5-5') }), union);
  assert.equal(probeOwnShare('claudemd', { path: 'subagent Explore', model: 'claude-sonnet-5-5', own: false, others: [] }), null);
  assert.equal(probeOwnShare('on', { path: 'after-model-switch', model: 'claude-haiku-5-5', own: false, others: ['claude-sonnet-5-5'] }), 0);
  // A build task run unattended gets carry-through and verify-changes from each of Sonnet and Haiku; Sonnet's stay-in-scope is for routine tasks only.
  const size = (file: string): number => fs.readFileSync(path.join(PACKAGE_ROOT, 'presets', 'claude', 'rules', file), 'utf8').trim().length;
  const haikuText = size('haiku-5-5/carry-through.md') + size('haiku-5-5/verify-changes.md');
  const sonnetText = size('sonnet-5-5/carry-through.md') + size('sonnet-5-5/verify-changes.md');
  const switched = probeOwnShare('on', { path: 'after-model-switch', model: 'claude-haiku-5-5', own: true, others: ['claude-sonnet-5-5'] }) as number;
  assert.ok(Math.abs(switched - haikuText / (haikuText + sonnetText)) < 1e-9, `${switched}`);
});

test('the scattered rules file counts as read per model, and model switches come from the decision log', () => {
  const read = { read: true, before_first_edit: false };
  const runs = [
    recorded({ key: 'a', condition: 'scattered', model: 'haiku', model_id: 'claude-haiku-5-5', signals: { read_rules: read } as RunRecord['signals'] }),
    recorded({ key: 'b', condition: 'scattered', model: 'haiku', model_id: 'claude-haiku-5-5' }),
    recorded({ key: 'c', condition: 'claudemd', model: 'haiku', model_id: 'claude-haiku-5-5', signals: { read_rules: read } as RunRecord['signals'] }),
  ];
  assert.deepEqual(rulesRead(runs, ['haiku', 'opus']), [
    { model: 'haiku', runs: 2, read: 1, before_first_edit: 0 },
    { model: 'opus', runs: 0, read: 0, before_first_edit: 0 },
  ]);
  const switches = modelSwitches([
    { event: 'session-start', experiment_run: 'routine.t.opus.on.1' },
    { event: 'model-switch', experiment_run: 'routine.t.opus.on.1', from_model: 'claude-opus-5-5', model: 'claude-opus-4-8', source: 'auto', delivered: 'note' },
    { event: 'model-switch', from_model: 'claude-opus-5-5', model: 'claude-haiku-5-5', source: 'user', delivered: 'rules' },
  ]);
  assert.deepEqual(switches, [{ run: 'routine.t.opus.on.1', condition: 'on', from: 'claude-opus-5-5', to: 'claude-opus-4-8', source: 'auto', delivered: 'note' }]);
});

test('cost, resolution and open scores are per model and condition, over the runs kept', () => {
  const opus = { model: 'opus', model_id: 'claude-opus-5-5' } as const;
  const runs = [
    recorded({ key: 'o1', condition: 'off', ...opus, cost_usd: 0.1 }),
    recorded({ key: 'o2', condition: 'off', ...opus, cost_usd: 0.3, rep: 2, resolved: false }),
    recorded({ key: 'c1', condition: 'claudemd', ...opus, cost_usd: null }),
    recorded({ key: 'd1', condition: 'on', ...opus, set: 'digest', resolved: null }),
    recorded({ key: 'd2', condition: 'on', ...opus, set: 'digest', resolved: null }),
  ];
  const all = costByCondition(runs, ['opus']);
  assert.equal(all.opus?.off?.runs, 2);
  assert.ok(Math.abs((all.opus?.off?.mean_usd ?? 0) - 0.2) < 1e-9);
  assert.equal(all.opus?.off?.mean_input_tokens, 10010);
  assert.deepEqual(all.opus?.claudemd, { runs: 0, mean_usd: null, mean_input_tokens: null });
  assert.equal(costByCondition(runs, ['opus'], (r) => r.rep === 1).opus?.off?.runs, 1);
  assert.deepEqual(resolution(runs, ['opus']).all?.off, { resolved: 1, runs: 2 });
  assert.deepEqual(resolution(runs, ['opus']).opus?.on, { resolved: 0, runs: 0 });
  const grades: Grade[] = [
    { key: 'd1', set: 'digest', score: 0.5, items: [], votes: 3, cost_usd: 0.1, error: null },
    { key: 'd2', set: 'digest', score: null, items: [], votes: 3, cost_usd: 0.1, error: 'no answer' },
  ];
  assert.deepEqual(openScores(runs, grades).digest?.on, { graded: 1, answers: 2, mean: 0.5 });
  assert.equal(openScores(runs, grades).review, undefined);
});

test('summarize reads a results folder, leaves infrastructure failures out and prefers rescored signals', () => {
  const dir = tempTree({});
  const run = recorded({ key: 'build.t.haiku.scattered.1', condition: 'scattered', model: 'haiku', model_id: 'claude-haiku-5-5', instruction_loads: userClaudeMd });
  const failure = { key: 'build.u.haiku.scattered.1', set: 'build', task: 'u', model: 'haiku', condition: 'scattered', rep: 1, model_id: 'claude-haiku-5-5', night: 1, started: '', attempts: 3, infra_failure: 'setup failed', cost_counted_usd: 0 };
  fs.writeFileSync(path.join(dir, 'runs.jsonl'), `${JSON.stringify(run)}\n${JSON.stringify(failure)}\n`);
  fs.writeFileSync(path.join(dir, 'signals.jsonl'), `${JSON.stringify({ key: run.key, scorer: 'c', signals: { read_rules: { read: true, before_first_edit: true } } })}\n`);
  const res = readResults(dir);
  assert.equal(res.runs.length, 1);
  assert.deepEqual(res.decisions, []);
  assert.equal(res.runs[0]?.signals.read_rules.read, true);
  assert.equal(res.probe, null);
  const text = summaryMarkdown(res, ['haiku'], MODELS);
  assert.match(text, /\| `scattered` \| 1 \| 1 of 1 \| haiku 1 \|/);
  assert.match(text, /\| haiku \| 1 \| 1 of 1 \| 1 of 1 \|/);
  assert.match(text, /## Model switches during the paid runs\n\nNone\./);
});
