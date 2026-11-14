// The resolver cases of the two lab prototypes, carried over as core tests.
// The scope prototype (Node) used a lab preset plus a user rule; the subagent prototype (Python)
// used one rule file per model. The verification words are the ones those prototypes used.

import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { loadConfig, ConfigError } from '../src/config/load.js';
import { resolve } from '../src/core/resolve.js';
import type { Decision, MatchedDecision } from '../src/core/types.js';
import { FIXTURES, LAB_CONFIG, LAB_PRESETS, tempTree } from './helpers.js';

const lab = loadConfig(LAB_CONFIG, { presetsDir: LAB_PRESETS });
const session = (model: string, scope: string | null = null): Decision => resolve(lab, { model, scope, place: 'session' });
const matched = (d: Decision): MatchedDecision => {
  assert.equal(d.status, 'matched', JSON.stringify(d));
  return d as MatchedDecision;
};

test('scope prototype: general rules only when the scope is unknown', () => {
  const d = matched(session('claude-sonnet-5-5[1m]'));
  assert.deepEqual(d.rules, ['sonnet/general']);
});

test('scope prototype: the scope adds the scope rule after the general one', () => {
  const d = matched(session('anthropic/claude-sonnet-5-5#high', 'investigate'));
  assert.deepEqual(d.rules, ['sonnet/general', 'sonnet/investigate']);
  assert.match(d.text, /SONNET-GEN-3306[\s\S]*SONNET-INV-5182/);
});

test('scope prototype: a scope with no scope rule keeps the general rules', () => {
  assert.deepEqual(matched(session('claude-sonnet-5-5', 'summarize')).rules, ['sonnet/general']);
});

test('scope prototype: a user-added scope rule joins the preset rules, after them', () => {
  assert.deepEqual(matched(session('claude-haiku-5-5', 'summarize')).rules, ['haiku/general', 'user/haiku-summarize']);
});

test('scope prototype: a wildcard declares no rules on purpose', () => {
  const d = session('claude-opus-5-5', 'investigate');
  assert.equal(d.status, 'none');
  assert.equal(d.status === 'none' && d.reason, 'declared-none');
  assert.equal(d.status === 'none' && d.key, 'claude-opus-*');
});

test('scope prototype: a model with no entry is undeclared', () => {
  const d = session('claude-fable-5-2');
  assert.equal(d.status, 'undeclared');
  assert.equal(d.status === 'undeclared' && d.reason, 'no-entry');
});

test('scope prototype: a new version of a declared model does not inherit its rules', () => {
  assert.equal(session('claude-sonnet-5-6').status, 'undeclared');
});

test('scope prototype: a model that was not reported', () => {
  const d = session('');
  assert.equal(d.status, 'undeclared');
  assert.equal(d.status === 'undeclared' && d.reason, 'model-not-reported');
  assert.equal(d.model, null);
});

test('scope prototype: the same request always gives the same text and hash', () => {
  const a = matched(session('claude-sonnet-5-5', 'investigate'));
  const b = matched(resolve(loadConfig(LAB_CONFIG, { presetsDir: LAB_PRESETS }), { model: 'claude-sonnet-5-5', scope: 'investigate', place: 'session' }));
  assert.equal(a.sha256, b.sha256);
  assert.equal(a.text, b.text);
  assert.match(a.sha256, /^[0-9a-f]{16}$/);
});

test('scope prototype: disable removes a preset rule; with nothing left the result is none', () => {
  const dir = tempTree({
    'sextant.json': {
      version: 1,
      preset: 'lab',
      models: { 'claude-sonnet-5-5': { use: 'preset', disable: ['sonnet/general'] } },
    },
  });
  const cfg = loadConfig(path.join(dir, 'sextant.json'), { presetsDir: LAB_PRESETS });
  assert.deepEqual(matched(resolve(cfg, { model: 'claude-sonnet-5-5', scope: 'investigate', place: 'session' })).rules, [
    'sonnet/investigate',
  ]);
  const d = resolve(cfg, { model: 'claude-sonnet-5-5', place: 'session' });
  assert.equal(d.status, 'none');
  assert.equal(d.status === 'none' && d.reason, 'no-rule-applies');
});

test('scope prototype: wildcard entries that would give rules are refused (the old "ambiguous entries" case)', () => {
  // The prototype accepted {"claude-opus-?-5": "none", "claude-opus-5-?": "preset"} and failed only
  // when a model hit both. Wildcards now only declare "none", so the file is refused up front.
  const dir = tempTree({
    'sextant.json': {
      version: 1,
      preset: 'lab',
      models: { 'claude-opus-?-5': { use: 'none' }, 'claude-opus-5-?': { use: 'preset' } },
    },
  });
  assert.throws(
    () => loadConfig(path.join(dir, 'sextant.json'), { presetsDir: LAB_PRESETS }),
    (e: unknown) => e instanceof ConfigError && e.problems.some((p) => p.startsWith('/models/claude-opus-5-?/use')),
  );
});

const proto = loadConfig(path.join(FIXTURES, 'subagent-proto', 'sextant.json'), { presetsDir: LAB_PRESETS });
const protoB = loadConfig(path.join(FIXTURES, 'subagent-proto', 'config-b', 'sextant.json'), { presetsDir: LAB_PRESETS });
const sub = (cfg: typeof proto, model: string): Decision => resolve(cfg, { model, place: 'subagent' });

test('subagent prototype: fable is matched through the [1m] suffix', () => {
  const d = matched(sub(proto, 'claude-fable-5-2[1m]'));
  assert.equal(d.model, 'claude-fable-5-2');
  assert.match(d.text, /FABLE-RULES-7421/);
});

test('subagent prototype: sonnet is an explicit none', () => {
  const d = sub(proto, 'claude-sonnet-5-5');
  assert.equal(d.status, 'none');
  assert.equal(d.status === 'none' && d.key, 'claude-sonnet-5-5');
});

test('subagent prototype: haiku is undeclared', () => {
  assert.equal(sub(proto, 'claude-haiku-5-5').status, 'undeclared');
});

test('subagent prototype: fable 5.3 is undeclared', () => {
  assert.equal(sub(proto, 'claude-fable-5-3').status, 'undeclared');
});

test('subagent prototype: opus under a wildcard none gets nothing', () => {
  assert.equal(sub(proto, 'claude-opus-5-5').status, 'none');
});

test('subagent prototype, config B: each model gets its own rules and never the other one', () => {
  const s = matched(sub(protoB, 'claude-sonnet-5-5'));
  assert.match(s.text, /SONNET-RULES-3306/);
  assert.doesNotMatch(s.text, /FABLE-RULES/);
  const f = matched(sub(protoB, 'claude-fable-5-2'));
  assert.match(f.text, /FABLE-RULES-7421/);
  assert.doesNotMatch(f.text, /SONNET-RULES/);
});
