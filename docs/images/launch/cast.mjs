// Writes launch.cast, the terminal recording that agg renders to launch.gif, from sessions.json and the committed run.
// Usage: node docs/images/launch/cast.mjs, then the agg command in README.md of this folder.

import fs from 'node:fs';
import path from 'node:path';
import { DATE, EFFORT, HEADLINE, HERE, INSTALL, PLACE, REPO, REPORT, SUBHEAD, VERSION, WITH, WITHOUT } from './result.mjs';

const sessions = JSON.parse(fs.readFileSync(path.join(HERE, 'sessions.json'), 'utf8'));
const W = 100;
const H = 27;
const PANEL = 48;
const LEFT = 2;
const RIGHT = 52;
const VISIBLE = 9;

const style = (code) => (s) => `\x1b[${code}m${s}\x1b[0m`;
const bold = style('1');
const dim = style('90');
const amber = style('1;33');
const red = style('1;31');
const green = style('1;32');
const at = (row, col, s) => `\x1b[${row};${col}H${s}`;
const cut = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
function wrap(text, width) {
  const lines = [''];
  for (const word of text.split(' ')) {
    if (lines.at(-1) && lines.at(-1).length + 1 + word.length > width) lines.push('');
    lines[lines.length - 1] += (lines.at(-1) ? ' ' : '') + word;
  }
  return lines;
}

/** Keeps a number on one line through wrap(). */
const solid = (s) => s.replaceAll(' ', '\u00a0');

const events = [];
let now = 0;
const frame = (seconds, draw) => {
  events.push([Number(now.toFixed(3)), 'o', `\x1b[2J${draw}`]);
  now += seconds;
};

// Opening: the idea first, then what the example is.
frame(3.6, [
  at(8, 8, amber(HEADLINE)),
  at(10, 8, SUBHEAD),
  at(14, 8, bold('One example:') + ' the rule carry-through, Sonnet 5.5, a 13-ticket backlog.'),
  at(16, 8, dim('Two recorded sessions, repetition 1 of each arm, sped up.')),
  at(17, 8, dim(`Claude Code ${VERSION}, effort ${EFFORT}, ${PLACE}, ${DATE}.`)),
].join(''));

const ARMS = [['none', LEFT, 'Without any rule'], ['carry', RIGHT, 'With carry-through alone']];
const head = () => [
  at(1, LEFT, dim('Same task, same model: Sonnet 5.5 on a 13-ticket backlog. Recorded sessions, sped up.')),
  ...Array.from({ length: H - 2 }, (_, i) => at(i + 3, 50, dim('│'))),
  ...ARMS.map(([arm, col, title]) => at(3, col, (arm === 'none' ? bold : amber)(title)) + at(4, col, dim('─'.repeat(PANEL - 1)))),
].join('');
const label = (s) => {
  const mark = s.refused ? ' (refused)' : s.error ? ' (error)' : '';
  return cut(`${s.tool} ${s.what}`, PANEL - 3 - mark.length) + mark;
};
const steps = (upTo) => ARMS.map(([arm, col]) => sessions[arm].steps.slice(0, upTo).slice(-VISIBLE)
  .map((s, i) => at(5 + i, col, dim('● ') + (s.refused || s.error ? dim(label(s)) : label(s)))).join('')).join('');
const reports = () => ARMS.map(([arm, col]) => at(15, col, bold('Its report on the open decision:'))
  + wrap(sessions[arm].report, PANEL - 2).map((l, i) => at(16 + i, col, l)).join('')).join('');
const checks = () => ARMS.map(([arm, col]) => {
  const bad = sessions[arm].check.filter((p) => !p.ok).map((p) => p.part);
  return at(24, col, bold('Hidden check, run after the session:'))
    + at(25, col, bad.length ? red('✗ not every part done: ') + bad.join(', ') : green('✓ every part done'));
}).join('');

const n = Math.max(...ARMS.map(([arm]) => sessions[arm].steps.length));
for (let i = 1; i <= n; i++) frame(0.4, head() + steps(i));
frame(4.2, head() + steps(n) + reports());
frame(3.2, head() + steps(n) + reports() + checks());

// Closing: the delivery, then the number in its full sentence.
const sentence = wrap(`With the rule carry-through delivered alone, Sonnet 5.5 did every part of a 13-ticket backlog in ${solid(WITH)}, against ${solid(WITHOUT)} without any rule.`, 84).map((l) => l.replaceAll('\u00a0', ' '));
frame(7, [
  at(3, 6, bold('$ noonsight report --log decisions.jsonl')),
  at(4, 6, dim("… the experiment's log, this rule's lines:")),
  ...REPORT.map((l, i) => at(5 + i, 6, l)),
  at(11, 6, bold('The measured example')),
  ...sentence.map((l, i) => at(12 + i, 6, l.replaceAll(WITH, amber(WITH)).replaceAll(WITHOUT, amber(WITHOUT)))),
  at(16, 6, dim('Most of the difference is the one ticket shown. Evidence: R10 in docs/evidence.md.')),
  at(19, 6, amber(HEADLINE) + ' ' + SUBHEAD),
  at(21, 6, bold(`$ ${INSTALL}`)),
  at(23, 6, REPO),
].join(''));

fs.writeFileSync(path.join(HERE, 'launch.cast'), [JSON.stringify({ version: 2, width: W, height: H, env: { TERM: 'xterm-256color' } }), JSON.stringify([0, 'o', '\x1b[?25l']), ...events.map((e) => JSON.stringify(e))].join('\n') + '\n');
