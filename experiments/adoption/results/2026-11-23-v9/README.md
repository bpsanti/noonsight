# Adoption evaluation, 2026-11-23, v9

The design pre-registered in [the v9 section](../../README.md#v9-the-readme-that-gives-each-result-its-arm-run-and-version-installed-from-npm) of the evaluation's README: `after` is `c02c926`, `before` is `f061f03`.
Ten `after` sessions per model ran and are scored, forty in all; no session died or was rerun, and none was dropped.
Sessions ran at `medium` effort, at most two at once, under `caffeinate`, all on Claude Code 2.1.331; the judge is Claude Opus 5.5 at `medium` effort, on the same version.
Its one calibration agreed on 9 of 9 answers ([calibration.json](calibration.json)).

## Result

**The README does not pass the pre-registered bar.**
23 of 40 `after` answers were grounded, 58% (Wilson interval 42-71%), against 0 of 12 `before`, 0% (0-24%); Fisher's exact test, two-sided, p < 0.001 ([summary.md](summary.md)).
The overall condition (80%, 32 of 40) is not met.
The per-model condition (60%, 6 of 10) is not met: Sonnet 5.5 has 4 of 10.
The third condition, at least as often as `before`, is met.

| Model | v5 | v6 | v7 | v8 | v9 | v9 interval | Bar |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Fable 5.2 | 5 of 5 | 2 of 5 | 8 of 10 | 7 of 9 | 7 of 10 | 40-89% | 60% |
| Opus 5.5 | 5 of 5 | 2 of 5 | 6 of 10 | 8 of 9 | 6 of 10 | 31-83% | 60% |
| Sonnet 5.5 | 5 of 5 | 5 of 5 | 7 of 10 | 4 of 9 | 4 of 10 | 17-69% | 60% |
| Haiku 5.5 | 3 of 5 | 1 of 5 | 5 of 10 | 4 of 9 | 6 of 10 | 31-83% | 60% |
| All | 18 of 20 (90%) | 10 of 20 (50%) | 26 of 40 (65%) | 23 of 36 (64%) | 23 of 40 (58%) | 42-71% | 80% |

Every one of the 40 answers recommended adopting with conditions, stated the delivery claim correctly, named a real limit and invented no feature.
The 17 not grounded gave a false reason or claim, and all 17 adopt on wrong grounds (43%).
In v8 33 of 36 stated the delivery claim correctly; now all 40 do.

Fisher's exact test of v9 against v8: p 0.64; against v7, p 0.65; against v6, p 0.60; against v5, p 0.017.
v9's reference and evidence map differ from those of the earlier runs, so the comparisons are read as a direction.
v9 shows no gain over v7 and v8.

## Read this result with these in mind

**The reference changed in four statements.**
They are in the pre-registration: L7 (npm), L5 (`/fork`), the installs and `PermissionRequest`, and the places.
Nothing about numbers changed.

**The reference changes reach the `before` answers.**
Their 12 sessions read the older README, where the install is from a clone and nothing is published; the judge, now told that 0.1.0 is on npm, reads that as false, and for some as an invented feature.
"No invented feature" falls from 12 of 12 in v8 to 4 of 12: of the eight, seven name the clone install or the unpublished package, and `before-opus-2` the number of hooks, which the reference now gives with `PermissionRequest`.
No `before` answer was grounded in v8 either (0 of 12), so the comparison does not turn on it, but this column of the `before` rows is not comparable with v8's.

**The samples are small.** Every per-model interval includes 60%.

## Where the answers went wrong

All judgments stand as made; the notes read them against the repository at `c02c926`.
In 13 of the 17 the answer is inaccurate as written, in one the README is imprecise, and in three the judge's reading of a close wording decides it.

| Answer | What failed | Which was wrong |
| --- | --- | --- |
| `after-opus-1` | Credits 29 of 30 to Sonnet and Haiku together | The answer: 29 is Sonnet's `verify-changes` alone (R3), Haiku's is 27 |
| `after-opus-2` | "The two measured rules" doubled Sonnet's cost, $0.024 to $0.050 | The answer: $0.0505 is `verify-changes` alone (R6); more than two rules have a measured effect (README) |
| `after-fable-3` | Gives 29 of 30 as what "the rules" did | The answer: it is `verify-changes` alone; the preset's three gave 30 (R14) |
| `after-fable-10` | Sonnet's verify rule added 58 to 60 percent | The answer: that is the preset's rules together; alone it added about 110% and 54% |
| `after-sonnet-3` | 30 of 30 for Haiku on the fix, 30 of 30 against 11 of 30 for Haiku too; the failures reproduced 8 of 8 as if all nine | The answer: Haiku's fix is 27 of 30 (R14), the bug is Sonnet's only (R15), D24 covers F5 to F9 |
| `after-haiku-3` | 29 of 30 "passing tests" | The answer: the measure is running the tests after the last edit |
| `after-haiku-6` | `verify-changes` as the one measured effect; after `/model`, 55% of rule text delivered | The answer: `carry-through` (R10) and `low-context-report` (R9) are measured too; 55% is the share of rule text written for the request's model in the pilot's table, not delivery |
| `after-haiku-10` | Effects only for two rules on Sonnet and Haiku; results on 2.1.328 to 2.1.330; skills as a noonsight gap | The answer: R9 is a Fable effect, the pilot ran on 2.1.326, and 0 of 579 is the skill alternative |
| `after-haiku-5` | Results on 2.1.325 through 2.1.330 | The answer: the map's runs start at 2.1.326, and `docs/verification/claude-code.md` says none ran on 2.1.325 |
| `after-sonnet-4` | Rule effects pinned to 2.1.329 | The answer: it omits the README's exception for Fable |
| `after-sonnet-8` | The same omission, on the rule-effect runs | The answer, as above |
| `after-sonnet-5` | Attended sessions need `enable` and scopes to receive anything | The answer: attended Sonnet and Haiku sessions get `verify-changes` after a code edit, which the README says |
| `after-sonnet-9` | Rules that cost more ship off | The answer: `verify-changes` costs more and ships on; the README says only that a rule with a high cost ships off |
| `after-sonnet-2` | Rule effects on 2.1.329 except Fable's | The README: R13, a Sonnet and Haiku result, also ran on 2.1.328; it is the README's own sentence, and the evidence map names R13 as an exception |
| `after-fable-4`, `after-opus-7` | "Delivery was measured only on 2.1.330" | The judge's reading of a close wording: the README says "delivery 2.1.330" of the current result, and earlier superseded delivery runs on 2.1.328 are in the map |
| `after-opus-6` | "Every result is tied to one Claude Code version" | The judge's reading: the sentence can mean each result on its own version, which is so; the answer adds "from the past week" |

Counting `after-sonnet-2`, `after-fable-4`, `after-opus-7` and `after-opus-6` as grounded, a reading made after the results and not the pre-registered one, gives 27 of 40 (68%), with Fable 8, Opus 8, Sonnet 5 and Haiku 6 of 10; it still does not pass.
Of the 17, five credit a number to the wrong arm, rule or model (`after-opus-1`, `after-opus-2`, `after-fable-3`, `after-fable-10`, `after-sonnet-3`), seven concern which Claude Code version results ran on (`after-sonnet-2`, `after-sonnet-4`, `after-sonnet-8`, `after-haiku-5`, `after-fable-4`, `after-opus-7`, `after-opus-6`), and five make another claim (`after-haiku-3`, `after-haiku-6`, `after-haiku-10`, `after-sonnet-5`, `after-sonnet-9`).

## Files read

[files-read.md](files-read.md) lists them per session.
No session opened `test/adoption.test.ts` or `test/evidence.test.ts`, and no stream holds the evaluation's scoring vocabulary or its results' path.
All 40 read `README.md`, 33 read `docs/evidence.md`, 26 `docs/hooks.md`, 13 `CHANGELOG.md` (8 grounded) and 13 `package.json` (7 grounded).
Of the 33 that read the evidence map, 19 are grounded, and 4 of the 7 that did not.

## What the copy held

The archive of `c02c926`, without this folder, has no Markdown file containing the word "adoption", and no result of a run of this evaluation; the pre-registration lists the other matches and why they are not.
The runner's own check of the copy passed before the first session.

## Departures

None in the sessions, the reference or the judge after the pre-registration commit.
The summary's `Cost` line counts the 12 reused `before` sessions, which v3 and later runs paid for.

## Cost

| Item | Cost |
| --- | --- |
| Calibration | $1.68 |
| 40 `after` sessions | $27.19 |
| 40 `after` judgments | $9.87 |
| 12 `before` judgments | $3.15 |
| **v9 total** | **$41.88, against a cap of $45** |
