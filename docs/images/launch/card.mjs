// The launch result card: a 1200x675 PNG of one measured result (result.mjs computes it).
// Usage: node docs/images/launch/card.mjs <light|dark> <out.png>
// Needs Google Chrome; set CHROME to its executable when it is not in the default place.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DATE, EFFORT, HEADLINE, HERE, INSTALL, NOTE, PLACE, REPO, REPORT, SUBHEAD, VERSION, WITH, WITHOUT } from './result.mjs';

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

function html(theme) {
  const lockup = fs.readFileSync(path.join(HERE, '..', theme === 'dark' ? 'noonsight-lockup-dark.svg' : 'noonsight-lockup.svg'), 'utf8');
  const row = (arm, value, cls) => `<tr class="${cls}"><td>${arm}</td><td>Sonnet 5.5</td><td>13-ticket backlog</td><td class="v">${value}</td></tr>`;
  return `<!doctype html><meta charset="utf-8"><style>
:root{--bg:#FBF8F2;--fg:#14283C;--mute:#4C5D6E;--line:#D9D2C4;--acc:#9A5C08;--panel:#F1ECE1}
.dark{--bg:#0F1B28;--fg:#F3EFE6;--mute:#B3C0CC;--line:#2C3E50;--acc:#F0A63A;--panel:#172737}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:675px;background:var(--bg);color:var(--fg);padding:34px 52px 30px;font:20px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden}
svg{width:190px;height:auto;display:block}
h1{font-size:44px;line-height:1.15;font-weight:700;letter-spacing:-.02em}
.sub{font-size:24px;color:var(--mute);margin-top:4px}
code,pre{font-family:ui-monospace,Menlo,Consolas,monospace}
.ex{font-size:22px;line-height:1.35}.ex b{color:var(--acc);white-space:nowrap}
table{border-collapse:collapse;width:100%;font-size:18px}
th{text-align:left;font-weight:500;color:var(--mute);font-size:15px;padding:0 0 4px;border-bottom:2px solid var(--line)}
td{padding:5px 0;border-bottom:1px solid var(--line)}
.v{font-weight:700}.rule .v{color:var(--acc)}
.note{font-size:16px;color:var(--mute)}
.log{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:8px 16px}
.log pre{font-size:15px;line-height:1.35}.log p{font-size:15px;color:var(--mute);margin-bottom:2px}
.foot{display:flex;justify-content:space-between;align-items:baseline;font-size:19px}
.foot code{font-weight:600}.src{font-size:14px;color:var(--mute)}
</style><body class="${theme}">
${lockup}
<div><h1>${HEADLINE}</h1><p class="sub">${SUBHEAD}</p></div>
<p class="ex">One measured example: with the rule <code>carry-through</code> delivered alone, Sonnet 5.5 did every part of a 13-ticket backlog in <b>${WITH}</b>, against <b>${WITHOUT}</b> without any rule.</p>
<table><tr><th>Arm</th><th>Model</th><th>Task</th><th>Runs that did every part (hidden check)</th></tr>
${row('No rule', WITHOUT, '')}${row('<code>carry-through</code> alone', WITH, 'rule')}</table>
<p class="note">${NOTE}</p>
<div class="log"><p>From <code>noonsight report</code>, on the log of the same experiment: the rule's deliveries.</p><pre>${REPORT.join('\n')}</pre></div>
<div class="foot"><code>${INSTALL.replaceAll('&', '&amp;')}</code><span>${REPO}</span></div>
<p class="src">Evidence R10 in docs/evidence.md. Claude Code ${VERSION}, effort ${EFFORT}, ${PLACE}, ${DATE}.</p>
</body>`;
}

const [theme, out] = process.argv.slice(2);
if (!out || !['light', 'dark'].includes(theme)) throw new Error('usage: card.mjs <light|dark> <out.png>');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'card-'));
const page = path.join(tmp, 'card.html');
fs.writeFileSync(page, html(theme));
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
