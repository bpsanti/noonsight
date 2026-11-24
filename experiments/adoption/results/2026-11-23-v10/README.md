# Adoption evaluation, 2026-11-23, v10

The design pre-registered in [the v10 section](../../README.md#v10-the-readme-that-leaves-versions-to-the-evidence-map-and-names-each-numbers-rule-and-model) of the evaluation's README: `after` is `5e20724`, `before` is `f061f03`.
Ten `after` sessions per model ran and are scored, forty in all; no session died or was rerun, and none was dropped.
Sessions ran at `medium` effort, at most two at once, under `caffeinate`, all on Claude Code 2.1.331; the judge is Claude Opus 5.5 at `medium` effort, on the same version.
Its one calibration agreed on 9 of 9 answers ([calibration.json](calibration.json)).

## Result

**The README does not pass the pre-registered bar.**
18 of 40 `after` answers were grounded, 45% (Wilson interval 31-60%), against 0 of 12 `before`, 0% (0-24%); Fisher's exact test, two-sided, p 0.004 ([summary.md](summary.md)).
The overall condition (80%, 32 of 40) is not met.
The per-model condition (60%, 6 of 10) is not met: Opus 5.5 and Sonnet 5.5 have 5 of 10, and Haiku 5.5 has 1 of 10.
The third condition, at least as often as `before`, is met.

| Model | v5 | v6 | v7 | v8 | v9 | v10 | v10 interval | Bar |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fable 5.2 | 5 of 5 | 2 of 5 | 8 of 10 | 7 of 9 | 7 of 10 | 7 of 10 | 40-89% | 60% |
| Opus 5.5 | 5 of 5 | 2 of 5 | 6 of 10 | 8 of 9 | 6 of 10 | 5 of 10 | 24-76% | 60% |
| Sonnet 5.5 | 5 of 5 | 5 of 5 | 7 of 10 | 4 of 9 | 4 of 10 | 5 of 10 | 24-76% | 60% |
| Haiku 5.5 | 3 of 5 | 1 of 5 | 5 of 10 | 4 of 9 | 6 of 10 | 1 of 10 | 2-40% | 60% |
| All | 18 of 20 (90%) | 10 of 20 (50%) | 26 of 40 (65%) | 23 of 36 (64%) | 23 of 40 (58%) | 18 of 40 (45%) | 31-60% | 80% |

39 of the 40 answers recommended adopting with conditions, and `after-haiku-2` not adopting.
39 stated the delivery claim correctly, 39 invented no feature, and all 40 named a real limit; `after-haiku-2` is the exception in both of the first two.
All 22 not grounded gave a false reason or claim; 21 of the 40 adopt on wrong grounds (53%), against 17 of 40 in v9.

Fisher's exact test of v10 against v9: p 0.37; against v8, p 0.11; against v7, p 0.12; against v6, p 0.79; against v5, p < 0.001.
v9's reference is the same and its evidence map differs in two lines, so v9 is the closest comparison; the earlier ones are read as a direction.
v10 shows no gain over v9.
The drop is Haiku's, 6 of 10 to 1 of 10 (p 0.057); without Haiku, v9 is 17 of 30 and v10 is 17 of 30.

## The two classes the README was changed for

Counted by the pre-registered rule: an answer is in a class when any failing statement of its judgment is, and may be in both.

| Class | v9, 17 not grounded | v10, 22 not grounded |
| --- | --- | --- |
| Which Claude Code version results ran on | 8 (7 by v9's one class per answer) | 9 |
| A number credited to the wrong arm, rule or model | 6 (5 by v9's one class per answer) | 4 |
| Either | 13 | 12 |
| Neither | 4 | 10 |

- **Versions, v10**: `after-fable-3`, `after-fable-8`, `after-sonnet-3`, `after-sonnet-7`, `after-sonnet-8`, `after-haiku-3`, `after-haiku-4`, `after-haiku-5`, `after-haiku-7`.
- **Wrong arm, rule or model, v10**: `after-opus-1`, `after-opus-2`, `after-opus-5`, `after-sonnet-8`.
  `after-opus-5` is a close call, since the number it gives is right and it extends it to every rule that changed behavior; without it the class is 3.
- **v9**: versions are its seven and `after-haiku-10`; wrong arm, rule or model are its five and `after-haiku-10`, which credits the skill arm's 0 of 579 to noonsight.
- `after-haiku-10` and `after-opus-8` of v10 are near this class and outside it: the first gives the all-requests figures as the main conversation's, and the second credits an effect to Haiku without a number.

The version class did not fall, so the README naming no version did not remove it.
Four of the nine (`after-fable-3`, `after-fable-8`, `after-sonnet-7`, `after-sonnet-8`) give a range from 2.1.325, the version of facts and hook fixtures, not of any result; all four had it on screen in the file names of `test/fixtures/hook-inputs/` from their Glob, though the evidence map they read says that no run covers it.
Three (`after-haiku-3`, `after-haiku-4`, `after-haiku-7`) give 2.1.330, the delivery run's version, as that of all the evidence; one (`after-sonnet-3`) gives 2.1.329 for all rule results; one (`after-haiku-5`) gives a wrong range.
The README's line to the evidence map was there for eight of these nine sessions to read (`after-haiku-5` did not read the README), and the same eight opened the map.

The new loss is in statements about what the rules do: five Haiku answers (`after-haiku-3`, `-4`, `-5`, `-6`, `-8`) say that one or two effects are the only ones measured, when the README lists three rules with an effect alone; two v9 answers did.

## Where the answers went wrong

All judgments stand as made; the notes read them against the repository at `5e20724`.
In 20 of the 22 the answer is inaccurate as written, and in two the judge's reading of a close case decides it; in none is the README at `5e20724` wrong, though for `after-haiku-2` and `after-haiku-5` the session never opened it.

| Answer | What failed | Which was wrong |
| --- | --- | --- |
| `after-opus-1` | 30 and 27 of 30 (R14) given as `verify-changes`'s | The answer: those are the preset's rules together; alone it is 29 and 27 (R3) |
| `after-opus-2` | 29 of 30 for Sonnet and Haiku together | The answer: Haiku's is 27 |
| `after-opus-5` | Where the rules changed behavior, cost per run roughly doubled | The answer: `verify-changes` alone; `carry-through` on the backlog cost less (R18) |
| `after-opus-8` | `carry-through` has a proven effect on Haiku | The answer: none shown (R11, R3) |
| `after-opus-3` | F1 to F9 each shown to fail on the build before its fix | The judge's reading: D24 covers F5 to F9, as the answer's citation does not say, but `experiments/delivery/README.md` says the fuzzer found F1 to F4, so they did fail before their fixes |
| `after-fable-3` | Results hold for 2.1.325 to 2.1.330 | The answer: no run on 2.1.325 |
| `after-fable-8` | Failures found and fixed across 2.1.325 to 2.1.330 | The answer, as above |
| `after-fable-7` | Pilot cost rose from $0.141 to $0.151 | The judge's reading: both figures are the pilot's, over both rounds (`experiments/benchmark/results/2026-11-19/README.md`), and B2 gives the first round's, $0.145 and $0.155 |
| `after-sonnet-3` | Rule results pinned to 2.1.329 | The answer: Fable's, which it cites, ran on 2.1.328 |
| `after-sonnet-4` | A `CLAUDE.md` puts the other models' rules into every request | The answer: it does not reach every subagent request (D28); the README says every model |
| `after-sonnet-6` | About 4,400 characters per request under a `CLAUDE.md` | The answer: D31 gives 4,472; 4,415 is a superseded value |
| `after-sonnet-7` | Results on 2.1.325 to 2.1.330 | The answer: no run on 2.1.325 |
| `after-sonnet-8` | The same range; rules raised cost wherever they changed behavior; the pilot's costs reversed; each fix's earlier build failed (D24) | The answer: `carry-through` on the backlog cost less (R18), $0.145 is without rules, and D24 covers F5 to F9 |
| `after-haiku-2` | Delivery breaks: 55% after a model switch; plan mode, resume and fork not followed; no README in the repository | The answer: it did not find the README, read the pilot as the delivery benchmark, and the delivery run measured those paths (D21) |
| `after-haiku-3` | Only `verify-changes` and `carry-through` have an effect; current results on 2.1.330 only | The answer: `low-context-report` has one (R9), and rule results ran on 2.1.328 and 2.1.329 |
| `after-haiku-4` | The same effects, each on one task; one run, 2.1.330; `low-context-report` showed no cost change | The answer: the list omits R9 and the bug (R16); the cost differences were not tested (R19) |
| `after-haiku-5` | One measured gain; tests unchanged; results on 2.1.328 to 2.1.330 | The answer: it read one rule run and not the README, so missed R14 to R16 and R9 |
| `after-haiku-6` | One rule with a measured effect | The answer: `carry-through` (R10) and `low-context-report` (R9) too |
| `after-haiku-7` | Evidence on 2.1.330 only; 1,343 characters per subagent request | The answer: D31 is per request of any kind |
| `after-haiku-8` | One measured change; the delivery benchmark's paid runs cost more | The answer: R10 and R9; the costs are the pilot's, and the delivery benchmark pays for none |
| `after-haiku-9` | 299 sessions simulated; the decision log measured the coverage | The answer: the README says not simulated, and the stand-in API measured it |
| `after-haiku-10` | Main-session coverage 100% against 88.2% | The answer: those are all requests; a `CLAUDE.md` reached all of the main conversation's (D34) |

Counting `after-fable-7` and `after-opus-3` as grounded, a reading made after the results and not the pre-registered one, gives 20 of 40 (50%), with Fable 8, Opus 6, Sonnet 5 and Haiku 1 of 10; it still does not pass.

## Read this result with these in mind

**The samples are small.** Fable's, Opus's and Sonnet's intervals include 60%; Haiku's does not.

**Two Haiku sessions never opened the README.**
`after-haiku-2` and `after-haiku-5` listed files with Glob, whose output did not include the root `README.md`, and did not look further; `after-haiku-2` then said that the repository has none.
Both are not grounded.

## Files read

[files-read.md](files-read.md) lists them per session.
No session opened `test/adoption.test.ts` or `test/evidence.test.ts`, and no stream holds the evaluation's scoring vocabulary or its results' path.
38 read `README.md` and 31 `docs/evidence.md` (16 grounded; of the 9 that did not, 2).
28 read `docs/hooks.md` (16 grounded), 13 `CHANGELOG.md` (7), 17 `package.json` (11) and 5 `docs/install.md` (3).

## What the copy held

The archive of `5e20724`, without this folder, has no Markdown file containing the word "adoption", and no result of a run of this evaluation; the pre-registration lists the other matches and why they are not.
The runner's own check of the copy passed before the first session.

## Departures

None in the sessions, the reference or the judge after the pre-registration commit.
The summary's `Cost` line counts the 12 reused `before` sessions, which v3 and later runs paid for.

## Cost

| Item | Cost |
| --- | --- |
| Calibration | $1.68 |
| 40 `after` sessions | $27.79 |
| 40 `after` judgments | $9.94 |
| 12 `before` judgments | $3.15 |
| **v10 total** | **$42.56, against a cap of $45** |
