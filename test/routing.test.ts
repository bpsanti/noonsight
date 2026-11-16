// Routing: the core's choice of a model and an effort, the configuration that declares it, and the
// agent call hook that applies it, driven as Claude Code drives it. Each hook test has its own home
// directory, so the decision log and the records start empty. The launcher's routing is in run.test.ts.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { ConfigError, loadConfig, readPreset } from '../src/config/load.js';
import { runHook } from '../src/adapters/claude-code/hook.js';
import { route, type RouteRequest } from '../src/core/route.js';
import type { Config } from '../src/core/types.js';
import { hookHome, hookInput, LAB_CONFIG, LAB_PRESETS, labPresetWith, runCli, tempTree, type HookHome } from './helpers.js';

const SESSION = 'dbef0a98-a930-44c9-9a0c-9f41dae960c8';

/** The lab configuration with matchers for its scopes and a routing table, with `routing` merged over it. */
function routingConfig(routing: Record<string, unknown> = {}, extra: Record<string, unknown> = {}): string {
  const lab = JSON.parse(fs.readFileSync(LAB_CONFIG, 'utf8')) as Record<string, any>;
  const dir = tempTree({
    'noonsight.json': {
      ...lab,
      scopes: {
        ...lab.scopes,
        summarize: { match: ['\\bsummari[sz]e'] },
        investigate: { match: ['\\binvestigat'] },
        implement: { match: ['\\bimplement'] },
      },
      routing: {
        enabled: true,
        table: {
          summarize: [{ model: 'haiku', effort: 'low' }],
          investigate: [
            { model: 'fable', effort: 'high' },
            { model: 'sonnet', effort: 'high' },
          ],
          implement: { launcher: [{ model: 'sonnet', effort: 'medium' }], subagents: [] },
        },
        ...routing,
      },
      ...extra,
    },
  });
  fs.cpSync(path.join(path.dirname(LAB_CONFIG), 'rules'), path.join(dir, 'rules'), { recursive: true });
  return path.join(dir, 'noonsight.json');
}

const load = (file: string): Config => loadConfig(file, { presetsDir: LAB_PRESETS });

// ---------------------------------------------------------------------------------------------
// The core.

/** A request for the subagents target where every alias selects the latest model of its family. */
function request(fields: Partial<RouteRequest> = {}): RouteRequest {
  const latest: Record<string, string> = { fable: 'claude-fable-5-2', opus: 'claude-opus-5-5', sonnet: 'claude-sonnet-5-5', haiku: 'claude-haiku-5-5' };
  return {
    target: 'subagents',
    scope: 'summarize',
    env: {},
    held: null,
    explicitEffort: false,
    translate: (m) => (latest[m] !== undefined ? { value: m, model: latest[m] } : { value: m, model: m }),
    ...fields,
  };
}

test('route: off unless enabled, whatever the table says', () => {
  assert.deepEqual(route(load(routingConfig({ enabled: false })), request()), { routing: 'off', reason: 'disabled' });
  assert.deepEqual(route(load(LAB_CONFIG), request()), { routing: 'off', reason: 'disabled' });
});

test('route: the scope\'s row gives the model and the effort, and the first option whose model is declared wins', () => {
  const config = load(routingConfig());
  assert.deepEqual(route(config, request()), {
    routing: 'routed',
    reason: 'table',
    value: 'haiku',
    model: 'claude-haiku-5-5',
    effort: 'low',
    option: 0,
    skipped: [],
  });
  // claude-fable-5-2 is not declared, so the second option wins.
  assert.deepEqual(route(config, request({ scope: 'investigate' })), {
    routing: 'routed',
    reason: 'table',
    value: 'sonnet',
    model: 'claude-sonnet-5-5',
    effort: 'high',
    option: 1,
    skipped: [{ model: 'fable', why: 'claude-fable-5-2 is not declared under "models"' }],
  });
  // A model declared by a wildcard with "use": "none" is declared too.
  const opus = load(routingConfig({ table: { summarize: [{ model: 'opus' }] } }));
  assert.deepEqual(route(opus, request()), { routing: 'routed', reason: 'table', value: 'opus', model: 'claude-opus-5-5', option: 0, skipped: [] });
  // An option the adapter cannot write for the target is passed over.
  const why = route(config, request({ scope: 'investigate', translate: () => ({ why: 'no alias' }) }));
  assert.deepEqual(why, {
    routing: 'inherit',
    reason: 'no-declared-option',
    from: 'table',
    skipped: [
      { model: 'fable', why: 'no alias' },
      { model: 'sonnet', why: 'no alias' },
    ],
  });
});

test('route: no scope, no row, an empty row, and a row that leaves a target out', () => {
  const config = load(routingConfig());
  assert.deepEqual(route(config, request({ scope: null })), { routing: 'inherit', reason: 'no-scope', skipped: [] });
  assert.deepEqual(route(config, request({ scope: 'search' })), { routing: 'inherit', reason: 'no-row', skipped: [] });
  assert.deepEqual(route(config, request({ scope: 'implement' })), { routing: 'inherit', reason: 'empty-row', from: 'table', skipped: [] });
  assert.equal((route(config, request({ scope: 'implement', target: 'launcher' })) as { model?: string }).model, 'claude-sonnet-5-5');

  const withDefault = load(
    routingConfig({ default: [{ model: 'sonnet', effort: 'medium' }], table: { summarize: { launcher: [{ model: 'haiku' }] } } }),
  );
  for (const scope of [null, 'search', 'summarize'])
    assert.deepEqual(
      route(withDefault, request({ scope })),
      { routing: 'routed', reason: 'default', value: 'sonnet', model: 'claude-sonnet-5-5', effort: 'medium', option: 0, skipped: [] },
      String(scope),
    );
});

test('route: it yields to a target it does not list, to NOONSIGHT_ROUTING=off, and to a variable of yield_when_env', () => {
  const config = load(routingConfig({ targets: ['launcher'], yield_when_env: ['ORCH_TASK_ID'] }));
  assert.deepEqual(route(config, request()), { routing: 'yielded', reason: 'target-off' });
  const both = load(routingConfig({ yield_when_env: ['ORCH_TASK_ID', 'OTHER'] }));
  assert.deepEqual(route(both, request({ env: { OTHER: '1' } })), { routing: 'yielded', reason: 'yield-env', env: 'OTHER' });
  assert.equal(route(both, request({ env: { ORCH_TASK_ID: '' } })).routing, 'routed', 'an empty variable is not set');
  for (const value of ['off', 'OFF', '0', 'false', 'no'])
    assert.deepEqual(route(both, request({ env: { NOONSIGHT_ROUTING: value } })), { routing: 'yielded', reason: 'routing-env', env: 'NOONSIGHT_ROUTING' });
  assert.equal(route(both, request({ env: { NOONSIGHT_ROUTING: 'on' } })).routing, 'routed');
});

test('route: a model the caller chose wins under respect_explicit, a model Claude Code fixes always wins, and an explicit effort is kept', () => {
  const config = load(routingConfig());
  assert.deepEqual(route(config, request({ held: { reason: 'explicit-model', explicit: true } })), { routing: 'yielded', reason: 'explicit-model' });
  assert.deepEqual(route(config, request({ held: { reason: 'fork', explicit: false } })), { routing: 'yielded', reason: 'fork' });
  const kept = route(config, request({ explicitEffort: true }));
  assert.deepEqual(kept, { routing: 'routed', reason: 'table', value: 'haiku', model: 'claude-haiku-5-5', effortKept: true, option: 0, skipped: [] });

  const table = load(routingConfig({ respect_explicit: false }));
  assert.equal(route(table, request({ held: { reason: 'explicit-model', explicit: true } })).routing, 'routed');
  assert.deepEqual(route(table, request({ held: { reason: 'fork', explicit: false } })), { routing: 'yielded', reason: 'fork' });
  assert.equal((route(table, request({ explicitEffort: true })) as { effort?: string }).effort, 'low');
});

// ---------------------------------------------------------------------------------------------
// The configuration.

function problemsOf(file: string, presetsDir: string = LAB_PRESETS): readonly string[] {
  try {
    loadConfig(file, { presetsDir });
  } catch (e) {
    if (e instanceof ConfigError) return e.problems;
    throw e;
  }
  assert.fail('the configuration was accepted');
}

test('config: routing defaults to off, both targets, respect_explicit, no yield variable, and the preset\'s table', () => {
  const r = load(LAB_CONFIG).routing;
  assert.deepEqual([r.enabled, r.targets, r.respectExplicit, r.yieldWhenEnv, r.table.size, r.default], [false, ['launcher', 'subagents'], true, [], 0, null]);

  // The package's preset ships a table; a user row replaces the preset's row for its scope.
  const dir = tempTree({ 'noonsight.json': { version: 1, routing: { table: { build: [{ model: 'sonnet' }] } } } });
  const real = loadConfig(path.join(dir, 'noonsight.json')).routing;
  assert.deepEqual([...real.table.keys()], ['investigate', 'build', 'review', 'routine', 'digest']);
  assert.deepEqual(real.table.get('investigate')?.subagents, [
    { model: 'fable', effort: 'high' },
    { model: 'opus', effort: 'high' },
  ]);
  assert.deepEqual(real.table.get('build'), { launcher: [{ model: 'sonnet' }], subagents: [{ model: 'sonnet' }] });
  assert.deepEqual(real.table.get('digest'), { launcher: [{ model: 'sonnet', effort: 'medium' }], subagents: [{ model: 'haiku', effort: 'medium' }] });
});

test('config: every preset routing row names its basis and its sources, and names only the preset\'s scopes', () => {
  const preset = readPreset('claude');
  assert.equal(preset.routing.size, 5);
  for (const [scope, entry] of preset.routing) {
    assert.ok(preset.scopes.has(scope), scope);
    assert.ok(entry.basis.length > 0 && entry.sources.length > 0, scope);
  }
  const strange = labPresetWith((p) => {
    p.routing = { table: { nowhere: { route: [{ model: 'haiku' }], basis: 'b', sources: [{ url: 'https://example.com', section: 's', date: '2026-11-16' }] } } };
  });
  assert.ok(problemsOf(LAB_CONFIG, strange).some((p) => /\/routing\/table\/nowhere: scope "nowhere" is not one of the preset's scopes/.test(p)));
  const identifier = labPresetWith((p) => {
    p.routing = { table: { investigate: { route: [{ model: 'claude-haiku-5-5' }], basis: 'b', sources: [] } } };
  });
  const problems = problemsOf(LAB_CONFIG, identifier).join('\n');
  assert.match(problems, /\/routing\/table\/investigate\/route\/0\/model: must be one of "fable", "opus", "sonnet", "haiku"/);
  assert.match(problems, /\/routing\/table\/investigate\/sources: must not be empty/);
});

test('config: a table scope must be declared, and an option\'s model must be an alias or a model declared with its exact key', () => {
  const problems = problemsOf(
    routingConfig({
      table: {
        nowhere: [{ model: 'haiku' }],
        summarize: [{ model: 'claude-sonnet-5-5' }, { model: 'claude-fable-5-2' }, { model: 'claude-opus-5-5' }],
        search: { subagents: [{ model: 'gpt-5' }] },
        investigate: {},
      },
      default: [{ model: 'mystery-1' }],
    }),
  ).join('\n');
  assert.match(problems, /\/routing\/table\/nowhere: scope "nowhere" is not declared/);
  assert.doesNotMatch(problems, /summarize\/0/, 'a declared exact key is accepted');
  assert.match(problems, /\/routing\/table\/summarize\/1\/model: "claude-fable-5-2" is neither a model alias \(fable, opus, sonnet, haiku\) nor a model declared under "models"/);
  // claude-opus-5-5 is declared only through the wildcard claude-opus-*.
  assert.match(problems, /\/routing\/table\/summarize\/2\/model: "claude-opus-5-5" is neither/);
  assert.match(problems, /\/routing\/table\/search\/subagents\/0\/model: "gpt-5" is neither/);
  assert.match(problems, /\/routing\/table\/investigate: list the options for launcher, subagents or both/);
  assert.match(problems, /\/routing\/default\/0\/model: "mystery-1" is neither/);
});

test('config: the schema refuses an unknown target, effort or default text', () => {
  const problems = problemsOf(
    routingConfig({ targets: ['session'], table: { summarize: [{ model: 'haiku', effort: 'huge' }] }, default: 'nearest', yield_when_env: ['1X'] }),
  ).join('\n');
  assert.match(problems, /\/routing\/targets\/0: must be one of "launcher", "subagents"/);
  assert.match(problems, /\/routing\/table\/summarize\/0\/effort: must be one of "low", "medium", "high", "xhigh", "max"/);
  assert.match(problems, /\/routing\/default: must be "inherit"/);
  assert.match(problems, /\/routing\/yield_when_env\/0: "1X" does not have the expected form/);
  assert.equal(load(routingConfig({ default: 'inherit' })).routing.default, null);
});

// ---------------------------------------------------------------------------------------------
// The agent call hook.

const startOn = (h: HookHome, model: string): void => {
  assert.equal(h.hook('session-start', hookInput('session-start-startup', { session_id: SESSION, model })).status, 0);
};

/** The recorded agent call made by the session, with no model and the tool input changed as given. */
function call(toolInput: Record<string, unknown> = {}, fields: Record<string, unknown> = {}): string {
  const recorded = JSON.parse(hookInput('pre-tool-use-agent')) as Record<string, any>;
  return JSON.stringify({ ...recorded, ...fields, tool_input: { ...recorded.tool_input, model: undefined, ...toolInput } });
}

const CALL_ID = (JSON.parse(hookInput('pre-tool-use-agent')) as { tool_use_id: string }).tool_use_id;

function result(resolvedModel: string): string {
  const recorded = JSON.parse(hookInput('post-tool-use-agent')) as Record<string, any>;
  return JSON.stringify({ ...recorded, session_id: SESSION, agent_id: undefined, tool_use_id: CALL_ID, tool_response: { ...recorded.tool_response, resolvedModel } });
}

const SUMMARY = { description: 'Summarize the log', prompt: 'Summarize the build log in five lines.' };
const calls = (h: HookHome): Record<string, any>[] => h.log().filter((l) => l.event === 'agent-call');

test('route-subagents: the hook sets the call\'s model and effort from its scope, and the rules are the routed model\'s', () => {
  const h = hookHome(routingConfig());
  startOn(h, 'claude-sonnet-5-5');
  const input = JSON.parse(call(SUMMARY)) as Record<string, any>;
  const out = h.hook('agent-call', call(SUMMARY)).out?.hookSpecificOutput;
  const { prompt, model, effort, ...rest } = out.updatedInput;
  const { prompt: original, ...originalRest } = input.tool_input;
  assert.deepEqual([model, effort], ['haiku', 'low']);
  assert.deepEqual(rest, originalRest, 'every other field of the call is kept');
  assert.ok(prompt.startsWith(`${original}\n\n<noonsight-rules model="claude-haiku-5-5" scope="summarize">`), prompt);
  assert.match(prompt, /HAIKU-GEN-9047[\s\S]*HAIKU-SUM-6610/);
  assert.equal(out.permissionDecision, 'allow');
  assert.equal(
    out.permissionDecisionReason,
    "noonsight set the subagent's model haiku and effort low from its task scope, and added the working rules for the subagent's model to the end of its task text",
  );

  const [line] = calls(h);
  assert.deepEqual(
    [line?.routing, line?.routing_reason, line?.route_model, line?.route_value, line?.route_effort, line?.route_option],
    ['routed', 'table', 'claude-haiku-5-5', 'haiku', 'low', 0],
  );
  assert.deepEqual([line?.model, line?.model_source, line?.scope, line?.scope_source, line?.delivered], ['claude-haiku-5-5', 'parameter', 'summarize', 'task-text', 'rules']);

  // The check after the start compares with the routed model, and the result line says the call was routed.
  h.hook('agent-result', result('claude-haiku-5-5'));
  const checked = h.log().find((l) => l.event === 'agent-result');
  assert.deepEqual([checked?.predicted, checked?.result, checked?.routing, checked?.routing_reason], ['claude-haiku-5-5', 'match', 'routed', 'table']);
});

test('route-subagents: an option that is not declared is passed over, and the log says why', () => {
  const h = hookHome(routingConfig());
  startOn(h, 'claude-haiku-5-5');
  const out = h.hook('agent-call', call({ description: 'Investigate the outage', prompt: 'Find the root cause.' })).out?.hookSpecificOutput;
  assert.deepEqual([out.updatedInput.model, out.updatedInput.effort], ['sonnet', 'high']);
  assert.match(out.updatedInput.prompt, /SONNET-INV-5182/);
  const [line] = calls(h);
  assert.deepEqual(line?.route_skipped, [{ model: 'fable', why: 'claude-fable-5-2 is not declared under "models"' }]);
  assert.equal(line?.route_option, 1);
});

test('explicit-model: a call that names a model keeps it under respect_explicit, and is routed without it', () => {
  const h = hookHome(routingConfig());
  startOn(h, 'claude-sonnet-5-5');
  const kept = h.hook('agent-call', call({ ...SUMMARY, model: 'sonnet' })).out?.hookSpecificOutput;
  assert.deepEqual([kept.updatedInput.model, kept.updatedInput.effort], ['sonnet', undefined]);
  assert.match(kept.updatedInput.prompt, /SONNET-GEN-3306/);
  assert.equal(kept.permissionDecisionReason, "noonsight added the working rules for the subagent's model to the end of its task text");
  assert.deepEqual([calls(h)[0]?.routing, calls(h)[0]?.routing_reason, calls(h)[0]?.model], ['yielded', 'explicit-model', 'claude-sonnet-5-5']);

  // An effort the call sets is kept, and only the model is routed.
  const effort = h.hook('agent-call', call({ ...SUMMARY, effort: 'high' })).out?.hookSpecificOutput;
  assert.deepEqual([effort.updatedInput.model, effort.updatedInput.effort], ['haiku', 'high']);
  assert.deepEqual([calls(h)[1]?.requested_effort, calls(h)[1]?.route_effort, calls(h)[1]?.route_effort_kept], ['high', undefined, true]);

  const table = hookHome(routingConfig({ respect_explicit: false }));
  startOn(table, 'claude-sonnet-5-5');
  const replaced = table.hook('agent-call', call({ ...SUMMARY, model: 'sonnet', effort: 'high' })).out?.hookSpecificOutput;
  assert.deepEqual([replaced.updatedInput.model, replaced.updatedInput.effort], ['haiku', 'low']);
  assert.match(replaced.updatedInput.prompt, /HAIKU-GEN-9047/);
});

test('explicit-model: a definition\'s model and a built-in subagent\'s own model are kept; a fork always is', () => {
  const project = tempTree({
    '.claude/agents/reviewer.md': '---\nname: reviewer\nmodel: sonnet\n---\nReview.\n',
    '.claude/agents/careful.md': '---\nname: careful\neffort: max\n---\nCareful.\n',
  });
  const env = { CLAUDE_PROJECT_DIR: project };
  const run = (config: string, subagentType: string): Record<string, any> => {
    const h = hookHome(config, env);
    startOn(h, 'claude-sonnet-5-5');
    const out = h.hook('agent-call', call({ ...SUMMARY, subagent_type: subagentType })).out?.hookSpecificOutput;
    return { input: out?.updatedInput ?? {}, line: calls(h)[0] ?? {} };
  };
  const config = routingConfig();
  for (const [type, reason] of [
    ['reviewer', 'definition-model'],
    ['Explore', 'built-in-model'],
    ['claude-code-guide', 'built-in-model'],
    ['kit:helper', 'plugin-definition'],
    ['fork', 'fork'],
  ] as const) {
    const { input, line } = run(config, type);
    assert.deepEqual([input.model, line.routing, line.routing_reason], [undefined, 'yielded', reason], type);
  }
  // A definition that sets only an effort: the model is routed, the effort kept.
  const careful = run(config, 'careful');
  assert.deepEqual([careful.input.model, careful.input.effort, careful.line.route_effort_kept], ['haiku', undefined, true]);
  // Without respect_explicit the table wins over a definition, but never over a fork.
  const table = routingConfig({ respect_explicit: false });
  assert.equal(run(table, 'reviewer').input.model, 'haiku');
  assert.equal(run(table, 'fork').line.routing_reason, 'fork');
});

test('explicit-model: CLAUDE_CODE_SUBAGENT_MODEL_FORCE fixes the model, so routing yields, and CLAUDE_CODE_EFFORT_LEVEL is noted', () => {
  const forced = hookHome(routingConfig({ respect_explicit: false }), { CLAUDE_CODE_SUBAGENT_MODEL_FORCE: '1', CLAUDE_CODE_SUBAGENT_MODEL: 'sonnet' });
  startOn(forced, 'claude-sonnet-5-5');
  forced.hook('agent-call', call(SUMMARY));
  assert.deepEqual([calls(forced)[0]?.routing, calls(forced)[0]?.routing_reason], ['yielded', 'model-forced']);

  const level = hookHome(routingConfig(), { CLAUDE_CODE_EFFORT_LEVEL: 'medium' });
  startOn(level, 'claude-sonnet-5-5');
  level.hook('agent-call', call(SUMMARY));
  assert.equal(calls(level)[0]?.route_effort_overridden_by, 'CLAUDE_CODE_EFFORT_LEVEL');
});

test('orchestrator-env: a variable of yield_when_env, or NOONSIGHT_ROUTING=off, leaves the model alone and still delivers the rules', () => {
  const config = routingConfig({ yield_when_env: ['ORCH_TASK_ID'] });
  for (const [env, reason, variable] of [
    [{ ORCH_TASK_ID: 'task-7' }, 'yield-env', 'ORCH_TASK_ID'],
    [{ NOONSIGHT_ROUTING: 'off' }, 'routing-env', 'NOONSIGHT_ROUTING'],
  ] as const) {
    const h = hookHome(config, env);
    startOn(h, 'claude-sonnet-5-5');
    const out = h.hook('agent-call', call(SUMMARY)).out?.hookSpecificOutput;
    assert.deepEqual([out.updatedInput.model, out.updatedInput.effort], [undefined, undefined]);
    assert.match(out.updatedInput.prompt, /SONNET-GEN-3306/, 'the rules for the model the subagent inherits');
    const [line] = calls(h);
    assert.deepEqual([line?.routing, line?.routing_reason, line?.routing_env, line?.scope], ['yielded', reason, variable, 'summarize']);
  }
});

test('routing off: no call changes beyond the rules, and every call line says routing is off and why', () => {
  for (const config of [routingConfig({ enabled: false }), LAB_CONFIG]) {
    const h = hookHome(config);
    startOn(h, 'claude-sonnet-5-5');
    for (const toolInput of [SUMMARY, { ...SUMMARY, model: 'haiku' }, { prompt: 'Reply OK.', subagent_type: 'Explore' }]) {
      const input = JSON.parse(call(toolInput)) as Record<string, any>;
      const out = h.hook('agent-call', call(toolInput)).out?.hookSpecificOutput;
      const { prompt, ...rest } = out.updatedInput;
      const { prompt: original, ...originalRest } = input.tool_input;
      assert.deepEqual(rest, originalRest);
      assert.ok(prompt.startsWith(`${original}\n\n<noonsight-rules `));
    }
    assert.deepEqual(
      calls(h).map((l) => [l.routing, l.routing_reason]),
      [
        ['off', 'disabled'],
        ['off', 'disabled'],
        ['off', 'disabled'],
      ],
    );
  }
});

test('routing for subagents with subagents.delivery "off": the model and effort are set, and no rules are added', () => {
  const h = hookHome(routingConfig({}, { subagents: { delivery: 'off' } }));
  startOn(h, 'claude-sonnet-5-5');
  const input = JSON.parse(call(SUMMARY)) as Record<string, any>;
  const out = h.hook('agent-call', call(SUMMARY)).out?.hookSpecificOutput;
  assert.deepEqual(out.updatedInput, { ...input.tool_input, model: 'haiku', effort: 'low' });
  assert.equal(out.permissionDecisionReason, "noonsight set the subagent's model haiku and effort low from its task scope");
  assert.deepEqual([calls(h)[0]?.delivered, calls(h)[0]?.routing, calls(h)[0]?.permission], ['off', 'routed', 'allow']);
});

test('a row that leaves subagents out, a call with no scope, and a refused configuration: each call line says why it was not routed', () => {
  const h = hookHome(routingConfig());
  startOn(h, 'claude-sonnet-5-5');
  h.hook('agent-call', call({ description: 'Implement it', prompt: 'Implement the parser.' }));
  h.hook('agent-call', call({ description: 'Reply', prompt: 'Reply OK.' }));
  assert.deepEqual(
    calls(h).map((l) => [l.scope, l.routing, l.routing_reason, l.route_from]),
    [
      ['implement', 'inherit', 'empty-row', 'table'],
      [null, 'inherit', 'no-scope', undefined],
    ],
  );
  const bad = hookHome(path.join(tempTree({ 'noonsight.json': { version: 1, routing: { enabled: 'yes' } } }), 'noonsight.json'));
  bad.hook('agent-call', call(SUMMARY));
  assert.deepEqual(
    bad.log().map((l) => [l.event, l.status, l.routing, l.routing_reason]),
    [['agent-call', 'config-invalid', 'off', 'config-invalid']],
  );
});

test('every agent-result line says what routing did and why: a call that yielded, a refused configuration, and a failed hook', () => {
  const h = hookHome(routingConfig());
  startOn(h, 'claude-sonnet-5-5');
  h.hook('agent-call', call({ ...SUMMARY, model: 'sonnet' }));
  h.hook('agent-result', result('claude-sonnet-5-5'));
  const yielded = h.log().find((l) => l.event === 'agent-result');
  assert.deepEqual([yielded?.result, yielded?.routing, yielded?.routing_reason], ['match', 'yielded', 'explicit-model']);

  const bad = hookHome(path.join(tempTree({ 'noonsight.json': { version: 1, routing: { enabled: 'yes' } } }), 'noonsight.json'));
  bad.hook('agent-call', call(SUMMARY));
  assert.equal(bad.hook('agent-result', result('claude-haiku-5-5')).raw, '', 'the call already warned');
  assert.deepEqual(
    bad.log().map((l) => [l.event, l.status, l.routing, l.routing_reason, l.warned]),
    [
      ['agent-call', 'config-invalid', 'off', 'config-invalid', true],
      ['agent-result', 'config-invalid', 'off', 'config-invalid', false],
    ],
  );

  // A failure inside the hook: here the environment cannot be read once the hook has started.
  const failing = hookHome(routingConfig());
  const env = new Proxy({ ...failing.env } as Record<string, string | undefined>, {
    get: (target, key) => {
      if (key === 'NOONSIGHT_CONFIG') throw new Error('environment unreadable');
      return Reflect.get(target, key);
    },
  });
  const out = runHook('agent-result', result('claude-haiku-5-5'), { env, home: failing.dir, now: new Date(), version: 'test', install: null, parentPid: process.pid });
  assert.match(JSON.parse(out).systemMessage, /the hook failed \(environment unreadable\), so the subagent's model was not checked/);
  assert.deepEqual(
    failing.log().map((l) => [l.event, l.status, l.routing, l.routing_reason]),
    [['agent-result', 'error', 'off', 'error']],
  );
});

test('noonsight check shows whether routing is on, its table, and whether sessions from this environment yield', () => {
  const off = runCli(['check'], { NOONSIGHT_CONFIG: LAB_CONFIG, NOONSIGHT_PRESETS_DIR: LAB_PRESETS, NOONSIGHT_SYSTEM_ROOT: tempTree({}) });
  assert.match(off.stdout, /^ok: routing: off, so noonsight never changes a model or an effort$/m);
  const on = runCli(['check'], {
    NOONSIGHT_CONFIG: routingConfig({ yield_when_env: ['ORCH_TASK_ID'] }),
    NOONSIGHT_PRESETS_DIR: LAB_PRESETS,
    NOONSIGHT_SYSTEM_ROOT: tempTree({}),
    ORCH_TASK_ID: '1',
  });
  assert.match(
    on.stdout,
    /^ok: routing: on for launcher and subagents, a model the caller chose wins, yields when ORCH_TASK_ID is set; table: summarize \[haiku low\]; investigate \[fable high, sonnet high\]; implement \[launcher: sonnet medium; subagents: none\]; default: inherit$/m,
  );
  assert.match(on.stdout, /^ok: routing yields for sessions started from this environment \(ORCH_TASK_ID is set\)$/m);
});
