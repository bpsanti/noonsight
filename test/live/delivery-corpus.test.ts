// The corpus level of the delivery benchmark (experiments/delivery): every sequence in
// experiments/delivery/corpus/ as a real interactive Claude Code session against the benchmark's local
// stand-in for the API, so it sends nothing to Anthropic and costs no tokens:
//
//   NOONSIGHT_LIVE_DELIVERY=1 npm run test:live
//
// Needs `claude` and `python3`. An entry expected to pass must break no part of the invariant; an entry
// that reproduces a known failure must still show it, so this test goes red the day the failure is
// fixed, and the entry's expectation then becomes "pass".

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { check, readCorpus } from '../../experiments/delivery/corpus.js';
import { runMany } from '../../experiments/delivery/fuzz.js';
import { loadReference } from '../../experiments/delivery/oracle.js';
import { claudeVersion } from '../../experiments/delivery/session.js';
import { PACKAGE_ROOT } from '../../src/config/paths.js';

const enabled = process.env.NOONSIGHT_LIVE_DELIVERY === '1';

test('delivery benchmark corpus: each sequence has the outcome it records', { skip: !enabled && 'set NOONSIGHT_LIVE_DELIVERY=1', timeout: 1_800_000 }, async (t) => {
  const work = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'noonsight-delivery-corpus-')));
  const entries = readCorpus();
  const opts = { ref: loadReference(work), workRoot: work, claude: 'claude', claudeCode: claudeVersion('claude'), noonsightRoot: PACKAGE_ROOT };
  const runs = entries.map((e) => ({ id: `corpus-${e.name}`, arm: 'on' as const, plant: null, model: e.model, scope: e.scope, unattended: e.unattended, steps: e.steps }));
  const lines = await runMany(runs, opts, 4, null, false);
  const checked = entries.map((e) => {
    const l = lines.find((x) => x.id === `corpus-${e.name}`);
    assert.ok(l, e.name);
    return check(e, l);
  });
  t.diagnostic(checked.map((c) => `${c.name}: ${c.outcome}${c.shows.length ? ` (${c.shows.join(', ')})` : ''}`).join('\n'));
  for (const c of checked) assert.equal(c.outcome, 'as-expected', `${c.name}: ${c.outcome}${c.shows.length ? `, shows ${c.shows.join(', ')}` : ''}${c.harness !== 'ok' ? ` (${c.harness})` : ''}`);
});
