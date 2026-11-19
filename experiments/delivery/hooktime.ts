// The cost in time: how long one run of each noonsight hook takes, measured from outside. Each run is
// the hook pointer's command (node cli.js hook <event>) started as a process with a recorded hook input
// on stdin, as Claude Code starts it, in a temporary home with the benchmark's reference configuration.
// The inputs are the recorded ones under test/fixtures/hook-inputs/, with the session id replaced so a
// run is a new session where it needs to be. The baseline is `node -e 0`: what starting Node costs.
//
// Wall time depends on what else the machine is doing; processor time (user plus system, from
// /usr/bin/time, in steps of 10 ms) much less, so both are kept.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CLI_FILE, PACKAGE_ROOT } from '../../src/config/paths.js';
import { configFor, UNATTENDED_ENV } from './oracle.js';

type Input = Record<string, any>;

function fixture(version: string, file: string): Input {
  return JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'test', 'fixtures', 'hook-inputs', version, file), 'utf8')) as Input;
}

interface Sample {
  readonly ms: number;
  readonly cpu: number;
  readonly printed: boolean;
}

function stats(xs: readonly number[]): { median: number; p90: number; max: number } {
  const s = [...xs].sort((a, b) => a - b);
  const q = (p: number): number => s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0;
  return { median: Math.round(q(0.5)), p90: Math.round(q(0.9)), max: Math.round(s.at(-1) ?? 0) };
}

/** Time every hook `runs` times in `work`, a directory this function owns. */
export function hookTime(work: string, runs: number) {
  fs.rmSync(work, { recursive: true, force: true });
  const home = path.join(work, 'home');
  const project = path.join(work, 'project');
  fs.mkdirSync(home, { recursive: true });
  fs.mkdirSync(path.join(project, 'src'), { recursive: true });
  fs.writeFileSync(path.join(project, 'src', 'app.ts'), 'export const x = 1;\n');
  for (const args of [['init', '-q'], ['add', '.'], ['-c', 'user.name=bench', '-c', 'user.email=bench@example.com', 'commit', '-q', '-m', 'start']]) spawnSync('git', ['-C', project, ...args]);
  const config = path.join(work, 'noonsight.json');
  fs.writeFileSync(config, JSON.stringify(configFor('on')));
  const env = { PATH: process.env.PATH ?? '', HOME: home, NOONSIGHT_CONFIG: config, [UNATTENDED_ENV]: '1', CLAUDE_PROJECT_DIR: project };
  const edit = (i: number, session: string): Input => ({ ...fixture('2.1.326', 'post-tool-use-edit.json'), session_id: session, cwd: project, tool_input: { file_path: path.join(project, 'src', 'app.ts') }, tool_use_id: `toolu_e${i}` });
  const cases: Record<string, { arg: string; input: (i: number) => Input; when: string }> = {
    'session-start': { arg: 'session-start', input: (i) => ({ ...fixture('2.1.325', 'session-start-startup.json'), session_id: `s-${i}`, cwd: project, model: 'claude-sonnet-5-5' }), when: 'start, /clear, compaction, resume' },
    'model-switch': {
      arg: 'model-switch',
      input: (i) => ({ ...fixture('2.1.325', 'model-switch-command.json'), session_id: 's-0', cwd: project, from_model: i % 2 ? 'claude-haiku-5-5' : 'claude-sonnet-5-5', to_model: i % 2 ? 'claude-sonnet-5-5' : 'claude-haiku-5-5' }),
      when: 'each /model',
    },
    'file-edit, first edit of tracked code': { arg: 'file-edit', input: (i) => edit(i, `s-${i}`), when: 'once per session; runs git' },
    'file-edit, later edits': { arg: 'file-edit', input: (i) => edit(i, 's-0'), when: 'each Edit or Write after that' },
    'agent-call': { arg: 'agent-call', input: (i) => ({ ...fixture('2.1.325', 'pre-tool-use-agent.json'), session_id: 's-0', cwd: project, tool_use_id: `toolu_${i}` }), when: 'each subagent call, before' },
    'subagent-start': { arg: 'subagent-start', input: (i) => ({ ...fixture('2.1.326', 'subagent-start.json'), session_id: 's-0', cwd: project, agent_id: `a-${i}` }), when: 'each subagent, as it starts' },
    'agent-result': {
      arg: 'agent-result',
      input: (i) => {
        // The recorded result is of a call made inside a subagent; here it is the session's own call, naming the subagent that just started.
        const { agent_id: _id, agent_type: _type, ...rest } = fixture('2.1.325', 'post-tool-use-agent.json');
        return { ...rest, session_id: 's-0', cwd: project, tool_use_id: `toolu_${i}`, tool_response: { ...rest.tool_response, agentId: `a-${i}` } };
      },
      when: 'each subagent call, after',
    },
  };
  const time = (argv: readonly string[], input: string): Sample => {
    const t0 = process.hrtime.bigint();
    const r = spawnSync('/usr/bin/time', ['-p', process.execPath, ...argv], { env, input, encoding: 'utf8' });
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    const t = Object.fromEntries([...r.stderr.matchAll(/^(real|user|sys)\s+([\d.]+)$/gm)].map((m) => [m[1], Number(m[2])]));
    return { ms, cpu: Math.round(((t.user ?? 0) + (t.sys ?? 0)) * 1000), printed: r.stdout.length > 0 };
  };
  const base = Array.from({ length: runs }, () => time(['-e', '0'], ''));
  // One round runs every hook once, in the order a session would: the three hooks of one subagent call
  // follow each other, so each start finds exactly one open call.
  const samples: Record<string, Sample[]> = Object.fromEntries(Object.keys(cases).map((name) => [name, []]));
  for (let i = 0; i < runs; i++) for (const [name, c] of Object.entries(cases)) samples[name]?.push(time([CLI_FILE, 'hook', '--install', 'account', c.arg], JSON.stringify(c.input(i))));
  return {
    runsPerHook: runs,
    node: process.version,
    cpus: os.cpus().length,
    loadAverage: os.loadavg().map((x) => Math.round(x * 10) / 10),
    baseline: { wall: stats(base.map((x) => x.ms)), cpu: stats(base.map((x) => x.cpu)) },
    hooks: Object.fromEntries(
      Object.entries(cases).map(([name, c]) => {
        const s = samples[name] ?? [];
        return [name, { when: c.when, wall: stats(s.map((x) => x.ms)), cpu: stats(s.map((x) => x.cpu)), printedSomething: s.filter((x) => x.printed).length }];
      }),
    ),
  };
}
