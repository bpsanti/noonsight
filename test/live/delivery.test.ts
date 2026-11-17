// The delivery probe of the benchmark pilot (experiments/benchmark): where the rules reach the model,
// under noonsight (`on`), under one CLAUDE.md every model reads (`claudemd`), and under a CLAUDE.md
// that only points to the rules (`scattered`). It drives real interactive Claude Code sessions with
// expect against a local stand-in for the API (stub-api.ts), so it sends nothing to Anthropic and
// costs no tokens, and it reads every request Claude Code sends:
//
//   NOONSIGHT_LIVE_DELIVERY=1 npm run test:live
//
// Each arm runs the same session: a first turn, three turns that each start a subagent (general-
// purpose, Explore, Plan), /model haiku and a turn, /compact and a turn, /clear and a turn. The table
// goes to the test's output, and with NOONSIGHT_DELIVERY_OUT=<dir> to <dir>/delivery.md and .json.

import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { POINTER_CLAUDE_MD, unionRules } from '../../experiments/benchmark/conditions.js';
import { deliveries, deliveryTable, type Delivery } from '../../experiments/benchmark/delivery.js';
import { PACKAGE_ROOT } from '../../src/config/paths.js';
import { runCli } from '../helpers.js';
import { startStub } from './stub-api.js';

const enabled = process.env.NOONSIGHT_LIVE_DELIVERY === '1';
const DRIVER = path.join(PACKAGE_ROOT, 'test', 'live', 'drive.exp');
const MODELS = ['claude-fable-5-2', 'claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'];
const PATHS = ['start', 'subagent general-purpose', 'subagent Explore', 'subagent Plan', 'after-model-switch', 'after-compact', 'after-clear'];
const STEPS = [
  'wait:8',
  'ask:PROBE-STEP start: reply ok',
  'ask:PROBE-STEP spawn general-purpose',
  'ask:PROBE-STEP spawn Explore',
  'ask:PROBE-STEP spawn Plan',
  'type:/model haiku',
  // Claude Code asks to confirm a switch in a conversation already cached for another model.
  'type:',
  'wait:3',
  'ask:PROBE-STEP after-model-switch: reply ok',
  'type:/compact',
  'wait:8',
  'ask:PROBE-STEP after-compact: reply ok',
  'type:/clear',
  'wait:4',
  'ask:PROBE-STEP after-clear: reply ok',
];

type Arm = 'on' | 'claudemd' | 'scattered';

/** One arm: a fresh Claude Code configuration with noonsight installed, the arm's configuration and Markdown, and the session against the stub. */
async function runArm(arm: Arm): Promise<Delivery[]> {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `noonsight-delivery-${arm}-`)));
  const [home, claudeDir, project, probe] = ['home', 'claude', 'project', 'probe'].map((d) => path.join(root, d)) as [string, string, string, string];
  for (const d of [home, claudeDir, project, probe]) fs.mkdirSync(d);
  fs.writeFileSync(path.join(claudeDir, '.claude.json'), JSON.stringify({ hasCompletedOnboarding: true, projects: { [project]: { hasTrustDialogAccepted: true } } }));
  const stop = { type: 'command', command: '/bin/sh', args: ['-c', 'cat > "$0/stop-$$.json"', probe], timeout: 10 };
  fs.writeFileSync(path.join(claudeDir, 'settings.json'), JSON.stringify({ theme: 'dark', hooks: { Stop: [{ hooks: [stop] }] } }));
  const use = arm === 'on' ? 'preset' : 'none';
  const config = path.join(root, 'noonsight.json');
  fs.writeFileSync(config, JSON.stringify({ version: 1, models: Object.fromEntries(MODELS.map((m) => [m, { use }])), session: { unattended_when_env: ['NOONSIGHT_EXPERIMENT'] } }));
  if (arm === 'claudemd') fs.writeFileSync(path.join(claudeDir, 'CLAUDE.md'), unionRules(MODELS));
  if (arm === 'scattered') fs.writeFileSync(path.join(claudeDir, 'CLAUDE.md'), POINTER_CLAUDE_MD);
  const installed = runCli(['install', '--account', claudeDir], { HOME: home, NOONSIGHT_CONFIG: config });
  assert.equal(installed.status, 0, installed.stderr);

  const stub = await startStub();
  try {
    const env = {
      PATH: process.env.PATH ?? '',
      HOME: home,
      TERM: 'xterm-256color',
      LANG: 'en_US.UTF-8',
      CLAUDE_CONFIG_DIR: claudeDir,
      NOONSIGHT_CONFIG: config,
      NOONSIGHT_SCOPE: 'build',
      NOONSIGHT_EXPERIMENT: '1',
      DISABLE_AUTOUPDATER: '1',
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
      CLAUDE_CODE_OAUTH_TOKEN: 'noonsight-delivery-placeholder',
      ANTHROPIC_BASE_URL: stub.url,
    };
    // The driver waits; the stub answers from the same process, so the session runs asynchronously.
    const r = await new Promise<{ status: number | null }>((resolve) => {
      const child = spawn('expect', [DRIVER, probe, ...STEPS, '--', '--model', 'sonnet', '--permission-mode', 'default', '--allowedTools', 'Agent'], { cwd: project, env, stdio: ['ignore', 'pipe', 'pipe'] });
      let screen = '';
      child.stdout.setEncoding('utf8').on('data', (d: string) => (screen += d));
      child.stderr.setEncoding('utf8').on('data', (d: string) => (screen += d));
      child.on('close', (status) => {
        // With an output directory, each arm leaves its screen and the requests the stub saw, for reading a failure.
        const out = process.env.NOONSIGHT_DELIVERY_OUT;
        if (out) {
          fs.mkdirSync(out, { recursive: true });
          fs.writeFileSync(path.join(out, `${arm}.screen.txt`), screen);
          fs.writeFileSync(path.join(out, `${arm}.requests.json`), JSON.stringify(stub.requests, null, 1));
        }
        resolve({ status });
      });
    });
    assert.equal(r.status, 0, `the ${arm} session did not finish its steps (expect exit ${r.status})`);
    return deliveries(stub.requests, MODELS);
  } finally {
    await stub.close();
  }
}

test('delivery probe: where the rules reach the model, under noonsight, one CLAUDE.md, and a CLAUDE.md that only points to them', { skip: !enabled && 'set NOONSIGHT_LIVE_DELIVERY=1', timeout: 1_800_000 }, async (t) => {
  assert.equal(spawnSync('expect', ['-v']).status, 0, 'expect is not on PATH');
  const only = process.env.NOONSIGHT_DELIVERY_ARM as Arm | undefined;
  const arms: Record<Arm, Delivery[]> = { on: only && only !== 'on' ? [] : await runArm('on'), claudemd: only && only !== 'claudemd' ? [] : await runArm('claudemd'), scattered: only && only !== 'scattered' ? [] : await runArm('scattered') };
  const table = deliveryTable(arms, PATHS);
  t.diagnostic(`\n${table}`);
  const out = process.env.NOONSIGHT_DELIVERY_OUT;
  if (out) {
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'delivery.md'), table);
    fs.writeFileSync(path.join(out, 'delivery.json'), `${JSON.stringify(arms, null, 2)}\n`);
  }
  const at = (arm: Arm, p: string): Delivery | undefined => arms[arm].find((d) => d.path === p);
  for (const p of PATHS) for (const arm of ['on', 'claudemd', 'scattered'] as const) assert.ok(at(arm, p), `${arm} reached the path ${p}`);
  // noonsight: the session and each subagent get the rules of their own model, and nobody else's at the start.
  assert.deepEqual(at('on', 'start'), { path: 'start', model: 'claude-sonnet-5-5', own: true, others: [] });
  for (const p of ['subagent general-purpose', 'subagent Explore', 'subagent Plan']) assert.equal(at('on', p)?.own, true, `on: ${p}`);
  assert.equal(at('on', 'after-model-switch')?.own, true);
  // One CLAUDE.md: every model's rules wherever it loads; Explore and Plan start without it.
  assert.equal(at('claudemd', 'start')?.own, true);
  assert.equal(at('claudemd', 'start')?.others.length, MODELS.length - 1);
  assert.equal(at('claudemd', 'subagent Explore')?.own, false);
  assert.equal(at('claudemd', 'subagent Plan')?.own, false);
  // A pointer delivers nothing until the agent reads the file, and the stub never does.
  for (const d of arms.scattered) assert.equal(d.own || d.others.length > 0, false, `scattered: ${d.path}`);
});
