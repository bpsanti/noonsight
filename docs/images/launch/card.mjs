// The launch result card: a 1200x675 PNG of one measured result.
// Every figure is computed from the committed raw runs, and the report lines are copied from the run's summary.md.
// Usage: node docs/images/launch/card.mjs <claim> <light|dark> <out.png>
// Needs Google Chrome; set CHROME to its executable when it is not in the default place.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const CLAIMS = {
  // R3 (verify alone) against R14 (no rule); R8 and R6 for the two sentences of the note.
  'verify-fix': {
    result: '2026-11-20', model: 'sonnet', task: 'fix', arm: 'verify', rule: 'sonnet-5-5/verify-changes',
    hit: (r) => r.signals.edited && r.signals.verified,
    sentence: (a, b) => `With the rule <code>verify-changes</code> delivered alone, Sonnet 5.5 ran the tests after its last edit in <b>${a}</b> runs of a small one-file fix, against <b>${b}</b> without any rule.`,
    column: 'Ran the tests after its last edit', taskName: 'one-file fix', armName: '<code>verify-changes</code> alone',
    note: 'Every run of both arms passed the hidden check: the rule changed whether the work was checked, not whether it passed. Runs with the rule cost more.',
    logNote: 'Delivery log of the whole experiment, so its counts cover every arm and task that received this rule.',
    evidence: 'R3, R14, R8, R6',
    premises: (all, a, b) => {
      const runs = [...a, ...b];
      if (!runs.every((r) => r.signals.check_passed && r.signals.suite_passed)) throw new Error('a run failed a check');
      if (!(mean(a) > mean(b))) throw new Error('the rule did not cost more');
    },
  },
  // R10; R18 for the cost.
  'carry-triage': {
    result: '2026-11-20-harder', model: 'sonnet', task: 'triage', arm: 'carry', rule: 'sonnet-5-5/carry-through',
    hit: (r) => r.signals.completed,
    sentence: (a, b) => `With the rule <code>carry-through</code> delivered alone, Sonnet 5.5 did every part of a 13-ticket backlog in <b>${a}</b> runs, against <b>${b}</b> without any rule.`,
    column: 'Did every part (hidden check)', taskName: '13-ticket backlog', armName: '<code>carry-through</code> alone',
    note: 'Almost all of the difference is one ticket that leaves a decision open: without the rule, most runs handed it back.',
    logNote: 'Delivery log of the same experiment.',
    evidence: 'R10',
    premises: (all, a, b) => {
      if (![...a, ...b].every((r) => r.signals.completed === r.signals.check_passed)) throw new Error('parts and hidden check differ');
    },
  },
};

const mean = (rs) => rs.reduce((s, r) => s + r.cost_usd, 0) / rs.length;

function data(name) {
  const c = CLAIMS[name];
  if (!c) throw new Error(`unknown claim ${name}: use one of ${Object.keys(CLAIMS).join(', ')}`);
  const dir = path.join(ROOT, 'experiments/rules/results', c.result);
  const all = fs.readFileSync(path.join(dir, 'runs.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    .filter((r) => r.model === c.model && r.task === c.task);
  const of = (arm) => {
    const runs = all.filter((r) => r.arm === arm);
    return { runs, hits: runs.filter(c.hit).length, text: `${runs.filter(c.hit).length} of ${runs.length}` };
  };
  const ruled = of(c.arm);
  const none = of('none');
  c.premises(all, ruled.runs, none.runs);
  if (!ruled.runs.every((r) => r.noonsight.rules.join() === c.rule)) throw new Error('the arm is not the rule alone');
  const [version] = new Set(all.map((r) => r.claude_code));
  const summary = fs.readFileSync(path.join(dir, 'summary.md'), 'utf8').split('\n');
  const at = summary.findIndex((l) => l.startsWith(`  ${c.rule}: `));
  if (at < 0) throw new Error('no report lines for the rule');
  return { c, ruled, none, version, report: summary.slice(at, at + 4).map((l) => l.slice(2)) };
}

function html(name, theme) {
  const { c, ruled, none, version, report } = data(name);
  const lockup = fs.readFileSync(path.join(HERE, '..', theme === 'dark' ? 'noonsight-lockup-dark.svg' : 'noonsight-lockup.svg'), 'utf8');
  const row = (arm, d, cls) => `<tr class="${cls}"><td>${arm}</td><td>Sonnet 5.5</td><td>${c.taskName}</td><td class="v">${d.text}</td></tr>`;
  return `<!doctype html><meta charset="utf-8"><style>
:root{--bg:#FBF8F2;--fg:#14283C;--mute:#4C5D6E;--line:#D9D2C4;--acc:#9A5C08;--panel:#F1ECE1}
.dark{--bg:#0F1B28;--fg:#F3EFE6;--mute:#B3C0CC;--line:#2C3E50;--acc:#F0A63A;--panel:#172737}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:675px;background:var(--bg);color:var(--fg);padding:36px 52px;font:20px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden}
svg{width:210px;height:auto;display:block}
h1{font-size:33px;line-height:1.28;font-weight:600;letter-spacing:-.01em}
h1 b{color:var(--acc);font-weight:750;white-space:nowrap}
code,pre{font-family:ui-monospace,Menlo,Consolas,monospace}
h1 code{font-size:.9em}
table{border-collapse:collapse;width:100%;font-size:19px}
th{text-align:left;font-weight:500;color:var(--mute);font-size:16px;padding:0 0 5px;border-bottom:2px solid var(--line)}
td{padding:7px 0;border-bottom:1px solid var(--line)}
.v{font-weight:700;text-align:left}.rule .v{color:var(--acc)}
.note{font-size:17px;color:var(--mute)}
.log{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:11px 16px}
.log pre{font-size:15px;line-height:1.4}.log p{font-size:15px;color:var(--mute);margin-bottom:4px}
.foot{display:flex;justify-content:space-between;align-items:baseline;font-size:18px}
.foot code{font-weight:600}.src{font-size:14px;color:var(--mute)}
</style><body class="${theme}">
${lockup}
<h1>${c.sentence(ruled.text, none.text)}</h1>
<table><tr><th>Arm</th><th>Model</th><th>Task</th><th>${c.column}</th></tr>
${row('No rule', none, '')}${row(c.armName, ruled, 'rule')}</table>
<p class="note">${c.note}</p>
<div class="log"><p>From <code>noonsight report</code>. ${c.logNote}</p><pre>${report.join('\n')}</pre></div>
<div class="foot"><code>npm install -g noonsight &amp;&amp; noonsight install</code><span>github.com/bpsanti/noonsight</span></div>
<p class="src">Evidence ${c.evidence} in docs/evidence.md. Claude Code ${version}, effort ${ruled.runs[0].effort}, ${c.result.slice(0, 10)}.</p>
</body>`;
}

const [name, theme, out] = process.argv.slice(2);
if (!out || !['light', 'dark'].includes(theme)) throw new Error('usage: card.mjs <claim> <light|dark> <out.png>');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'card-'));
const page = path.join(tmp, 'card.html');
fs.writeFileSync(page, html(name, theme));
const shot = path.join(tmp, 'card.png');
// Headless Chrome can stay up after it wrote the screenshot, so it is ended once the PNG is whole.
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', `--user-data-dir=${path.join(tmp, 'profile')}`, '--force-device-scale-factor=1', '--window-size=1200,675', `--screenshot=${shot}`, pathToFileURL(page).href], { stdio: 'ignore' });
const IEND = Buffer.from('IEND');
const whole = () => fs.existsSync(shot) && fs.readFileSync(shot).subarray(-8, -4).equals(IEND);
for (let i = 0; i < 300 && !whole(); i++) await new Promise((r) => setTimeout(r, 100));
chrome.kill('SIGKILL');
await new Promise((r) => (chrome.exitCode !== null || chrome.signalCode !== null ? r() : chrome.once('exit', r)));
if (!whole()) throw new Error('Chrome wrote no screenshot');
fs.copyFileSync(shot, out);
fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
