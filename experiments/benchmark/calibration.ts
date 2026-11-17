// The author's calibration of the judge: about 15 graded open-task answers, spread over the
// conditions, exported blind. Each answer gets a random id and is scrubbed of noonsight's strings;
// the sheet lists the rubric items to mark yes or no. The map from id to run is written apart, and
// its sha256 is printed so it can be recorded (sealed) before the author starts grading.

import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { scrub, type Grade } from './judge.js';
import { readJsonl, resultsDir, rubricFor, type Recorded } from './run.js';
import { ANSWER_FILE } from './tasks.js';

/** Up to n graded answers, taking the conditions in turn so each is about equally represented. */
export function pickCalibration<T extends { condition: string }>(items: readonly T[], n: number): T[] {
  const byCondition = new Map<string, T[]>();
  for (const i of items) byCondition.set(i.condition, [...(byCondition.get(i.condition) ?? []), i]);
  const queues = [...byCondition.keys()].sort().map((k) => byCondition.get(k) as T[]);
  const out: T[] = [];
  while (out.length < n && queues.some((q) => q.length)) for (const q of queues) if (q.length && out.length < n) out.push(q.shift() as T);
  return out;
}

export function exportCalibration(work: string, n: number, log: (s: string) => void): void {
  const results = resultsDir(work);
  const graded = new Set(readJsonl<Grade>(path.join(results, 'grades.jsonl')).filter((g) => g.error === null && g.votes > 0).map((g) => g.key));
  const runs = readJsonl<Recorded>(path.join(results, 'runs.jsonl')).filter((r) => r.infra_failure === null && graded.has(r.key));
  // The order of the answers in the sheet is random, so it says nothing about the conditions.
  const shuffled = runs.map((r) => ({ r, k: randomBytes(8).toString('hex') })).sort((a, b) => (a.k < b.k ? -1 : 1)).map((x) => x.r);
  const chosen = pickCalibration(shuffled, n);
  const dir = path.join(work, 'calibration');
  fs.mkdirSync(dir, { recursive: true });
  const mapping: Record<string, string> = {};
  const sheet: string[] = ['# Calibration sheet', '', 'For each answer, mark each rubric item yes or no, without looking at the judge grades.', ''];
  for (const r of chosen) {
    const id = randomBytes(4).toString('hex');
    mapping[id] = r.key;
    const ext = path.extname(ANSWER_FILE[r.set] ?? '.txt');
    const answer = fs.readFileSync(path.join(results, 'answers', `${r.key}${ext}`), 'utf8');
    fs.writeFileSync(path.join(dir, `${id}${ext}`), scrub(answer));
    const rubric = rubricFor(work, r.set, r.task);
    sheet.push(`## ${id} (${r.set})`, '', `Answer: ${id}${ext}`, '');
    if (typeof rubric !== 'string') for (const item of rubric.items) sheet.push(`- [ ] yes  [ ] no  ${item.id}: ${item.statement}`);
    sheet.push('');
  }
  fs.writeFileSync(path.join(dir, 'sheet.md'), `${sheet.join('\n')}\n`);
  const sealed = `${JSON.stringify(mapping, null, 2)}\n`;
  fs.writeFileSync(path.join(dir, 'mapping.sealed.json'), sealed);
  log(`${chosen.length} answers in ${dir}; record this before grading: mapping sha256 ${createHash('sha256').update(sealed).digest('hex')}`);
}
