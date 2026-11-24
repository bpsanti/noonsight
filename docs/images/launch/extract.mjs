// Takes what the GIF replays out of the recorded event streams of repetition 1 of each arm, into sessions.json.
// Usage: node docs/images/launch/extract.mjs <results dir of the design `harder`, with its runs/>
// The streams hold paths of the machine that ran them, so only the steps, one line of each final report and the hidden check's parts are kept, with the sha256 of each stream.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { HERE, RUNS } from './result.mjs';

const REP = 1;
const root = process.argv[2];
const sessions = {};
for (const arm of ['none', 'carry']) {
  const dir = path.join(root, 'runs', `triage.sonnet.${arm}.${REP}`);
  const raw = fs.readFileSync(path.join(dir, 'stream.jsonl'));
  const events = raw.toString().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const run = RUNS.find((r) => r.arm === arm && r.rep === REP);
  const blocks = (type) => events.filter((e) => e.type === type).flatMap((e) => (Array.isArray(e.message.content) ? e.message.content : []));
  const results = new Map(blocks('user').filter((b) => b.type === 'tool_result').map((b) => [b.tool_use_id, b]));
  const denied = new Set(events.filter((e) => e.subtype === 'permission_denied').map((e) => e.tool_use_id));
  const steps = blocks('assistant').filter((b) => b.type === 'tool_use').map((b) => {
    const file = b.input.file_path?.split('/project/')[1];
    const command = b.input.command?.replace(/^cd \S+\/project; /, '').split('\n')[0];
    return { tool: b.name, what: file ?? command, ...(denied.has(b.id) ? { refused: true } : {}), ...(!denied.has(b.id) && results.get(b.id)?.is_error ? { error: true } : {}) };
  });
  const result = events.filter((e) => e.type === 'result').at(-1);
  if (result.total_cost_usd !== run.cost_usd || steps.length !== run.tool_calls || steps.filter((s) => s.refused).length !== run.denied) {
    throw new Error(`the stream of ${arm} is not the recorded run`);
  }
  const report = result.result.split('\n').find((l) => l.startsWith('- **PAN-24')).slice(2).replaceAll('**', '').replaceAll('`', '');
  const check = [...fs.readFileSync(path.join(dir, 'check.tap'), 'utf8').matchAll(/^(not ok|ok) \d+ - part (.+)$/gm)].map(([, s, part]) => ({ part, ok: s === 'ok' }));
  const undone = check.filter((p) => !p.ok).map((p) => p.part);
  if (check.length !== run.signals.parts.total || undone.join() !== run.signals.parts.undone.join()) throw new Error(`the check of ${arm} is not the recorded one`);
  sessions[arm] = { run: `triage.sonnet.${arm}.${REP}`, started: run.started, stream_sha256: crypto.createHash('sha256').update(raw).digest('hex'), steps, report, check };
}
const text = `${JSON.stringify(sessions, null, 2)}\n`;
if (/\/(private|Users|home|var)\//.test(text)) throw new Error('a path of the machine is left');
fs.writeFileSync(path.join(HERE, 'sessions.json'), text);
