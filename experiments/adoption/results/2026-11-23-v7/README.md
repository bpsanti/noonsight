# Adoption evaluation, 2026-11-23, v7

The design pre-registered in [the v7 section](../../README.md#v7-consistent-delivery-denominators-ten-sessions-per-model) of the evaluation's README: `after` is `bf929c2`, `before` is `f061f03`, with ten `after` sessions per model.
The prompt, the reference, the judge's instructions, the calibration answers, the scoring and the pass bar are v6's; the README and the evidence map now give the delivery runs' denominators consistently.
Sessions ran on Claude Code 2.1.330 at `medium` effort, at most two at once; the judge is Claude Opus 5.5 at `medium` effort, and its calibration agreed on 9 of 9 answers ([calibration.json](calibration.json)).

## Result

**The README does not pass the pre-registered bar.**
26 of 40 `after` answers were grounded, 65% (Wilson interval 50-78%), against 1 of 12 `before`, 8% (1-35%); Fisher's exact test, two-sided, p < 0.001 ([summary.md](summary.md)).
The overall condition (80%, 32 of 40) is not met.
The per-model condition (60%, 6 of 10) is not met, because Haiku 5.5 has 5 of 10.
The third condition, at least as often as `before`, is met.

| Model | v3 | v4 | v5 | v6 | v7 | v7 interval | Bar |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Fable 5.2 | 2 of 3 | 2 of 3 | 5 of 5 | 2 of 5 | 8 of 10 | 49-94% | 60% |
| Opus 5.5 | 2 of 3 | 1 of 5 | 5 of 5 | 2 of 5 | 6 of 10 | 31-83% | 60% |
| Sonnet 5.5 | 3 of 3 | 1 of 5 | 5 of 5 | 5 of 5 | 7 of 10 | 40-89% | 60% |
| Haiku 5.5 | 1 of 3 | 1 of 5 | 3 of 5 | 1 of 5 | 5 of 10 | 24-76% | 60% |
| All | 8 of 12 (67%) | 5 of 18 (28%) | 18 of 20 (90%) | 10 of 20 (50%) | 26 of 40 (65%) | 50-78% | 80% |

Every one of the 40 answers recommended adopting with conditions, named a real limit and invented no feature; 39 stated the delivery claim correctly, and 26 gave no false reason or claim.
The 14 not grounded all adopt on wrong grounds (35%).

Fisher's exact test of v7 against v6: p 0.28; against v5, p 0.06; against v4, p 0.011; against v3, p 1.0.
v3 to v6 were judged with other evidence maps, and v3 and v4 also with an earlier L4, so these comparisons are read as a direction.
v5 and v6 pooled are 28 of 40 (70%); with v7, 54 of 80 (68%), a reading made after the results.

## Read this result with these in mind

**The judge is not steady on the same text.**
The twelve `before` answers are the same as in v6, and `before-sonnet-1` went from not grounded to grounded.
The statement that results cover Claude Code 2.1.328 and 2.1.330 failed `after-haiku-5` and `after-opus-4` here and `after-opus-2` in v6, and passed for two v5 answers.

**Three failures state numbers that a committed result gives.**
`after-fable-7` cites 88.2% and 46.9% for a `CLAUDE.md`, which are the values of the delivery run of 2026-11-23 ([its README](../../../delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/README.md)); the judge compared them with D6 and D10, from the run of 2026-11-21.
`after-opus-2` and `after-opus-9` give 50 to 150 ms of hook processor time, which joins D15's lower end to the 80 to 150 ms that same run's README reports.
Counting these three as grounded, a reading made after the results and not the pre-registered one, gives 29 of 40 (72.5%), with Fable 9 of 10 and Opus 8 of 10.
It still does not pass: it is below 80%, and Haiku stays at 5 of 10.

**The version statements are not counted the same way.**
`after-opus-4`, `after-haiku-5` and `after-haiku-9` also failed only on which Claude Code versions the results cover.
Adding them would reach 32 of 40 with Haiku at 7 of 10, numerically the bar, but each statement is inaccurate as written: the rule effects R3 to R8 and R10 to R12 ran on 2.1.329, and no entry of the evidence map ran on 2.1.325.
So that reading is not a pass.

**Ten answers a model is still a small sample.**
The per-model intervals all include 60%, Haiku's among them, so this run cannot say that any one model is above or below that line.

## Where the answers went wrong

All judgments stand as made; the notes are a reading of them against the repository.
None was judged not grounded for agreeing with the evidence map against the reference's stale L5 or delivery claim, so the reading the pre-registration names is the same 26 of 40.

- **A number from another run or arm (5).** `after-fable-7` and `after-opus-2`, `after-opus-9` as above.
  `after-sonnet-4` calls the 2.1.328 alternatives' figures the same sequences as the 2.1.330 run.
  `after-sonnet-6` credits forks and plan mode to the 2.1.328 benchmark.
- **Which versions were measured (3).** `after-opus-4`, `after-haiku-5`, `after-haiku-9`, as above.
- **Understating the rule effects (2).** `after-fable-8`: "no evidence it improves results", against R2, R9 and R10, and that the tool adds nothing over `CLAUDE.md` when rules are shared, against D10.
  `after-haiku-4`: `verify-changes` is the one rule with a measured effect, against R9 and R10; it also gives D21's 453 of 453 as overall coverage, the one answer whose delivery claim was judged wrong.
- **Other misreadings (4).** `after-haiku-2` places the evidence test at `docs/evidence.test.ts`; it is `test/evidence.test.ts`.
  `after-haiku-6` says the rules that add cost ship off, though `verify-changes` ships on, and calls the classifier the only dependency-free path.
  `after-opus-5` says the benchmark used a fake API "rather than real sessions"; the sessions are real and the API is the stand-in.
  `after-sonnet-2` says all nine failures have a pre-fix reproduction under D24, which covers F5 to F9.

## Files read

[files-read.md](files-read.md) lists them per session.
No session opened `test/adoption.test.ts`, no Grep returned a line of it, and no tool result holds the evaluation's scoring vocabulary.
Every session listed the repository with Glob, which shows that file's name.
Thirteen read `package.json`, which names the `adoption` script.
All 40 read `README.md`, and 35 read `docs/evidence.md`: 23 of those 35 are grounded, and 3 of the other 5.
Sixteen read `CHANGELOG.md`, which no longer describes the evaluation: 12 of those 16 are grounded, and 14 of the other 24.

## What the copy held

The archive of `bf929c2`, without this folder, has no Markdown file containing the word "adoption" and no result of a run of this evaluation.
`package.json`, `.gitignore` and `test/adoption.test.ts` name the evaluation, and the test holds the scoring's shape.
`src/config/preset-changes.ts` and `src/config/load.ts` match only through the identifier `LoadOptions`.

## Departures from the plan

- **Round ten ran after a first judging pass.** The runner stopped before `after-fable-10`, because its guard counts a session's whole budget ($4) and the $27.40 it was given left less.
  Before any answer was judged, a money-only rule was fixed: judge the 48 answers then held without reading a score, then run round ten one session at a time, each only if calibration, sessions, judgments so far, that session's whole budget and $0.26 per judgment owed stayed within $40.
  All four gates passed, the highest at $38.98, and the four answers were judged before any score was read.
- One judgment cost $0.2602, above the $0.26 that rule reserved and the $0.256 of v6; the cap was not reached.
- No session ended without an answer, so there were no reruns.

## Cost

| Item | Cost |
| --- | --- |
| Calibration, one pass | $1.16 |
| 40 `after` sessions | $26.47 |
| 52 judgments | $9.95 |
| **v7 total** | **$37.58, against a cap of $40** |

The `Cost` line of [summary.md](summary.md) also counts the 12 reused `before` sessions, which v3 paid for.
