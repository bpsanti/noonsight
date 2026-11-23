// The subagent facts the agent call hook relies on beyond the agent tool's own input, checked against
// the installed Claude Code with `claude -p` sessions that talk to a local stand-in for the API
// (experiments/delivery/stub.ts), so nothing reaches Anthropic and no login is needed:
//
//   NOONSIGHT_LIVE_DELIVERY=1 npm run test:live
//
// - where subagent definitions come from and which wins: --agents, --plugin-dir, CLAUDE_CODE_PLUGIN_DIRS,
//   --add-dir, the project and the user, each subagent starting on the model noonsight predicted, with
//   that model's rules in its first request;
// - two foreground calls of one type on different models, whose starts cannot be told apart: each
//   subagent gets its own call's rules in the request after its first Write;
// - a workflow's agents: SubagentStart fires for them, with no agent call before it.

import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { serveMessages, type Answer, type Body } from '../../experiments/delivery/stub.js';
import { runCli } from '../helpers.js';

const enabled = process.env.NOONSIGHT_LIVE_DELIVERY === '1';
const MODELS = ['claude-fable-5-2', 'claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'];
const MARK = (model: string): string => `SUBAGENT-RULE-${model}`;

function text(m: Body | undefined): string {
  if (!m) return '';
  if (typeof m.content === 'string') return m.content;
  return ((m.content ?? []) as Body[])
    .filter((b) => b.type === 'text')
    .map((b) => String(b.text))
    .join('\n');
}

let ids = 0;
const id = (): string => `toolu_live_${process.pid}_${ids++}`;

/**
 * The stand-in's answers. A session's prompt "LIVE spawn type[.model][.fg] ..." makes one agent call per
 * item in one response, and "LIVE workflow" one Workflow call whose script starts two agents. A
 * subagent whose task says "WRITE <file>" writes it, then answers.
 */
function respond(body: Body): Answer {
  const users = ((body.messages ?? []) as Body[]).filter((m) => m.role === 'user');
  const first = text(users[0]);
  const last = users.at(-1);
  const results = typeof last?.content !== 'string' && ((last?.content ?? []) as Body[]).some((b) => b.type === 'tool_result');
  const say = (t: string): Answer => ({ content: [{ type: 'text', text: t }], stop: 'end_turn' });
  const sub = /LIVE-SUB \d+ \S+(?: WRITE (\S+))?/.exec(first);
  if (sub) {
    if (sub[1] === undefined || results) return say('done');
    return { content: [{ type: 'tool_use', id: id(), name: 'Write', input: { file_path: sub[1], content: 'written\n' } }], stop: 'tool_use' };
  }
  if (results) return say('ok');
  const spawnStep = /LIVE spawn ([^\n]*?)(?: WRITE (\S+))?$/m.exec(text(last));
  if (spawnStep) {
    const items = (spawnStep[1] ?? '').split(/\s+/).filter(Boolean);
    return {
      content: items.map((item, i) => {
        const [type = 'general-purpose', model, fg] = item.split('.');
        const write = spawnStep[2] !== undefined ? ` WRITE ${path.join(spawnStep[2], `out-${i}.txt`)}` : '';
        return {
          type: 'tool_use',
          id: id(),
          name: 'Agent',
          input: {
            description: `live ${i} ${type}`,
            prompt: `LIVE-SUB ${i} ${type}${write}: reply done`,
            subagent_type: type,
            ...(model && model !== '-' ? { model } : {}),
            ...(fg === 'fg' ? { run_in_background: false } : {}),
          },
        };
      }),
      stop: 'tool_use',
    };
  }
  if (/LIVE workflow/.test(text(last)))
    return {
      content: [
        {
          type: 'tool_use',
          id: id(),
          name: 'Workflow',
          input: {
            script:
              "export const meta = { name: 'live', description: 'live check', phases: [{ title: 'A' }] }\n" +
              "await agent('LIVE-SUB 0 wf: reply done', { label: 'one', phase: 'A' })\n" +
              "await agent('LIVE-SUB 1 wf: reply done', { label: 'two', phase: 'A', model: 'haiku' })\n",
          },
        },
      ],
      stop: 'tool_use',
    };
  return say('ok');
}

interface Lab {
  readonly root: string;
  readonly home: string;
  readonly claudeDir: string;
  readonly project: string;
  readonly starts: string;
  readonly requests: Body[];
  run(prompt: string, args: readonly string[], env?: Record<string, string>): Promise<void>;
  log(): Record<string, any>[];
  close(): Promise<void>;
}

const write = (file: string, content: string): void => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};
const agent = (name: string, model: string): string => `---\nname: ${name}\ndescription: A live check agent.\nmodel: ${model}\n---\nReply done.\n`;

async function lab(): Promise<Lab> {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'noonsight-subagent-sources-')));
  const [home, claudeDir, project, starts] = ['home', 'claude', 'project', 'starts'].map((d) => path.join(root, d)) as [string, string, string, string];
  for (const d of [home, claudeDir, project, starts]) fs.mkdirSync(d);
  spawnSync('git', ['-C', project, 'init', '-q']);
  fs.writeFileSync(path.join(claudeDir, '.claude.json'), JSON.stringify({ hasCompletedOnboarding: true, projects: { [project]: { hasTrustDialogAccepted: true } } }));
  // Every SubagentStart input, written to a file of its own, beside noonsight's hooks.
  const record = { type: 'command', command: '/bin/sh', args: ['-c', 'cat > "$0/start-$$.json"', starts], timeout: 10 };
  fs.writeFileSync(path.join(claudeDir, 'settings.json'), JSON.stringify({ theme: 'dark', hooks: { SubagentStart: [{ hooks: [record] }] } }));
  for (const m of MODELS) write(path.join(root, 'rules', `${m}.md`), `- ${MARK(m)}: reply briefly.\n`);
  const config = path.join(root, 'noonsight.json');
  fs.writeFileSync(config, JSON.stringify({ version: 1, models: Object.fromEntries(MODELS.map((m) => [m, { use: 'custom', add: [{ id: `live/${m}`, file: `rules/${m}.md` }] }])) }));
  const installed = runCli(['install', '--account', claudeDir], { HOME: home, NOONSIGHT_CONFIG: config });
  assert.equal(installed.status, 0, installed.stderr);
  const requests: Body[] = [];
  const stub = await serveMessages(respond, (body) => void requests.push(body));
  const env = {
    PATH: process.env.PATH ?? '',
    HOME: home,
    LANG: 'en_US.UTF-8',
    CLAUDE_CONFIG_DIR: claudeDir,
    NOONSIGHT_CONFIG: config,
    DISABLE_AUTOUPDATER: '1',
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
    CLAUDE_CODE_OAUTH_TOKEN: 'noonsight-live-placeholder',
    ANTHROPIC_BASE_URL: stub.url,
  };
  return {
    root,
    home,
    claudeDir,
    project,
    starts,
    requests,
    // The stand-in answers from this process, so the session runs asynchronously.
    run: (prompt, args, extra = {}) =>
      new Promise((resolve, reject) => {
        const child = spawn('claude', ['-p', prompt, '--model', 'sonnet', '--allowedTools', 'Agent', 'Write', 'Workflow', ...args], {
          cwd: project,
          env: { ...env, ...extra },
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        let out = '';
        child.stdout.setEncoding('utf8').on('data', (d: string) => (out += d));
        child.stderr.setEncoding('utf8').on('data', (d: string) => (out += d));
        const timer = setTimeout(() => child.kill(), 180_000);
        child.on('close', (status) => {
          clearTimeout(timer);
          if (status === 0) resolve();
          else reject(new Error(`claude -p exited ${status}: ${out}`));
        });
      }),
    log: () => {
      const file = path.join(home, '.local', 'state', 'noonsight', 'decisions.jsonl');
      return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trimEnd().split('\n').map((l) => JSON.parse(l) as Record<string, any>) : [];
    },
    close: () => stub.close(),
  };
}

/** The requests of the subagent whose task is `task`, with the model each went to and the rules each held. */
function subagentRequests(l: Lab, task: RegExp): { model: string; rules: string[] }[] {
  return l.requests
    .filter((b) => task.test(text(((b.messages ?? []) as Body[]).find((m) => m.role === 'user'))))
    .map((b) => ({ model: String(b.model), rules: MODELS.filter((m) => JSON.stringify(b.messages ?? []).includes(MARK(m))) }));
}

test('subagent definitions from --agents, plugins, --add-dir, the project and the user: each subagent starts on the predicted model with its rules', { skip: !enabled && 'set NOONSIGHT_LIVE_DELIVERY=1', timeout: 600_000 }, async () => {
  const l = await lab();
  try {
    const kit = path.join(l.root, 'kit');
    write(path.join(kit, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'kit' }));
    write(path.join(kit, 'agents', 'review', 'scan.md'), '---\ndescription: No name, so the file names it.\nmodel: fable\n---\nReply done.\n');
    const envKit = path.join(l.root, 'envkit');
    write(path.join(envKit, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: 'envkit' }));
    write(path.join(envKit, 'agents', 'b.md'), agent('b', 'haiku'));
    const added = path.join(l.root, 'added');
    write(path.join(added, '.claude', 'agents', 'a.md'), agent('added', 'opus'));
    write(path.join(l.project, '.claude', 'agents', 'ranked.md'), agent('ranked', 'fable'));
    write(path.join(l.claudeDir, 'agents', 'ranked.md'), agent('ranked', 'opus'));
    write(path.join(l.claudeDir, 'agents', 'mine.md'), agent('mine', 'haiku'));
    const flag = JSON.stringify({ flagged: { description: 'From the command line.', prompt: 'Reply done.', model: 'haiku' } });
    await l.run('LIVE spawn flagged kit:review:scan envkit:b added ranked mine', ['--agents', flag, '--plugin-dir', kit, '--add-dir', added], { CLAUDE_CODE_PLUGIN_DIRS: envKit });
    const expected: Record<string, string> = {
      flagged: 'claude-haiku-5-5',
      'kit:review:scan': 'claude-fable-5-2',
      'envkit:b': 'claude-haiku-5-5',
      added: 'claude-opus-5-5',
      ranked: 'claude-fable-5-2',
      mine: 'claude-haiku-5-5',
    };
    const log = l.log();
    for (const [type, model] of Object.entries(expected)) {
      const call = log.find((d) => d.event === 'agent-call' && d.subagent_type === type);
      assert.deepEqual([call?.model, call?.model_source], [model, 'definition'], type);
      const result = log.find((d) => d.event === 'agent-result' && d.subagent_type === type);
      assert.deepEqual([result?.model, result?.result], [model, 'match'], type);
      const [firstRequest] = subagentRequests(l, new RegExp(`LIVE-SUB \\d+ ${type.replace(/[:]/g, '\\:')}:`));
      assert.deepEqual(firstRequest, { model, rules: [model] }, type);
    }
  } finally {
    await l.close();
  }
});

test('two foreground calls of one type on different models: each subagent gets its own call\'s rules after its first Write', { skip: !enabled && 'set NOONSIGHT_LIVE_DELIVERY=1', timeout: 600_000 }, async () => {
  const l = await lab();
  try {
    await l.run(`LIVE spawn general-purpose.haiku.fg general-purpose.opus.fg WRITE ${l.project}`, []);
    const log = l.log();
    const starts = log.filter((d) => d.event === 'subagent-start');
    assert.deepEqual(
      starts.map((d) => [d.start_match, d.reason]),
      [
        ['shared', 'calls-differ'],
        ['shared', 'calls-differ'],
      ],
    );
    const late = log.filter((d) => d.event === 'subagent-rules');
    assert.deepEqual(late.map((d) => d.model).sort(), ['claude-haiku-5-5', 'claude-opus-5-5']);
    for (const [i, model] of [[0, 'claude-haiku-5-5'], [1, 'claude-opus-5-5']] as const) {
      const requests = subagentRequests(l, new RegExp(`LIVE-SUB ${i} general-purpose`));
      assert.equal(requests.length, 2, `subagent ${i}: one request before its Write, one after`);
      assert.deepEqual(requests[0], { model, rules: [] });
      assert.deepEqual(requests[1], { model, rules: [model] });
    }
  } finally {
    await l.close();
  }
});

test('a workflow\'s agents fire SubagentStart with no agent call before it, and get nothing', { skip: !enabled && 'set NOONSIGHT_LIVE_DELIVERY=1', timeout: 600_000 }, async () => {
  const l = await lab();
  try {
    await l.run('LIVE workflow', []);
    const starts = fs.readdirSync(l.starts).map((f) => JSON.parse(fs.readFileSync(path.join(l.starts, f), 'utf8')) as Record<string, any>);
    assert.deepEqual(starts.map((s) => s.agent_type), ['workflow-subagent', 'workflow-subagent']);
    assert.deepEqual(l.log().filter((d) => d.event !== 'session-start'), [], 'no agent call, no start matched, no line');
    assert.deepEqual(subagentRequests(l, /LIVE-SUB \d wf/).map((r) => r.model).sort(), ['claude-haiku-5-5', 'claude-sonnet-5-5']);
  } finally {
    await l.close();
  }
});
