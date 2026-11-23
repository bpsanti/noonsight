# Adoption evaluation, 2026-11-23, v6

The design pre-registered in [the v6 section](../../README.md#v6-the-same-readme-with-no-account-of-the-evaluation-in-the-copy) of the evaluation's README: `after` is `6342101`, `before` is `f061f03`.
The README and the evidence map of `6342101` are those of v5's `516914f`, byte for byte, and the prompt, the reference, the judge's instructions, the calibration answers, the scoring and the pass bar are v5's; what changed is that `CHANGELOG.md` no longer describes the evaluation.
Sessions ran on Claude Code 2.1.330 at `medium` effort, at most two at once; the judge is Claude Opus 5.5 at `medium` effort, and its calibration agreed on 9 of 9 answers ([calibration.json](calibration.json)).

## Result

**The README does not pass the pre-registered bar.**
10 of 20 `after` answers were grounded, 50% (Wilson interval 30-70%), against 0 of 12 `before`; Fisher's exact test, two-sided, p 0.004 ([summary.md](summary.md)).
Of the bar's three conditions, only the third (at least as often as `before`) is met.

| Model | v3 | v4 | v5 | v6 | Bar |
| --- | --- | --- | --- | --- | --- |
| Fable 5.2 | 2 of 3 | 2 of 3 | 5 of 5 | 2 of 5 | 60% |
| Opus 5.5 | 2 of 3 | 1 of 5 | 5 of 5 | 2 of 5 | 60% |
| Sonnet 5.5 | 3 of 3 | 1 of 5 | 5 of 5 | 5 of 5 | 60% |
| Haiku 5.5 | 1 of 3 | 1 of 5 | 3 of 5 | 1 of 5 | 60% |
| All | 8 of 12 (67%) | 5 of 18 (28%) | 18 of 20 (90%) | 10 of 20 (50%) | 80% |

Every one of the 20 answers recommended adopting with conditions and named a real limit; 18 stated the delivery claim correctly, 18 invented no feature, and 11 gave no false reason or claim.
The 10 not grounded all adopt on wrong grounds (50%; v5 had 10%).

Fisher's exact test of v6 against v5: p 0.014; against v4, p 0.20; against v3, p 0.47.
v3 and v4 were judged with an earlier L4 and their own evidence maps (with the corrected L4: v4 10 of 18, v3 9 of 12), so only v5's comparison has the same reference.

## Read this result with these in mind

**v5's pass did not hold.**
With the same README, v5 gave 18 of 20 and v6 10 of 20.
v5's five sessions that read the evaluation's findings do not account for all of the difference: its other 15 were 13 of 15, against v6's 10 of 20 p 0.034, a comparison made after v6's results.
Those five may have raised v5; this run cannot say how much, since the two runs also differ by the draw of the sessions and of the judgments.
v5 and v6 pooled are 28 of 40 (70%), below the 80% bar; this too is a reading made after the results.

**The judge is not steady on the same claim.**
v6 judged `after-opus-2` false for saying that the published results cover only Claude Code 2.1.328 and 2.1.330; in v5, `after-haiku-2` and `after-haiku-3` said every measurement is tied to those versions and were judged grounded.
The calibration's nine answers hold no such case.

**Five answers a model is a small sample**, for the per-model bar above all.

## Where the answers went wrong

All judgments stand as made; the notes are a reading of them against the repository.

- **`after-fable-1` and `after-fable-3`**: said that "0 of 300 sessions" is 0 of 299, since one session did not run. The judge read D18's `0 of 300` against it, but the delivery run's own README says "299 of 300 sessions ran" and names the one that did not. This is the repository's evidence map and results README giving different denominators; the claim is true of the results. It was each answer's only failure.
- **`after-fable-2`**: "No evidence it improves results", which the map contradicts (R1, R2, R10).
- **`after-opus-2`**: the versions claim above. The delivery results are on 2.1.328 and 2.1.330; the rule effects R3 to R8 and R10 to R12 are on 2.1.329.
- **`after-opus-3`**: hook CPU "50-150 ms (D15)" (D15 says 50 to 90 ms; the delivery run of 2026-11-23 reports 80 to 150 ms on a loaded machine), 29 of 30 credited to both Sonnet and Haiku (Haiku's is 27 of 30), and rules "in the context of every request", read as perfect delivery.
- **`after-opus-4`**: no rules "left over from another model", against D14's 2 requests.
- **`after-haiku-1`**: "every request" receives its rules, read as perfect delivery.
- **`after-haiku-2`**: `low-context-report` "never delivered" in the rule experiment (R9 measures it), and fixes "verified by hand, not by a test run" (D16, D23, D24).
- **`after-haiku-4`**: `verify-changes` is "the one measured behavior change" (R2, R9, R10), and an invented `noonsight report` feature, spend per rule.
- **`after-haiku-5`**: an invented feature, hooks on every tool call; the same false claim as v5's `after-haiku-5`.

None was judged not grounded for agreeing with the evidence map against the reference's stale L5 or delivery claim, so the reading the pre-registration names is the same 10 of 20.
Counting the two 299 answers as grounded, a reading made after the results and not the pre-registered one, gives 12 of 20 (60%) with Fable 4 of 5; adding `after-opus-2` gives 13 of 20 (65%) with Opus 3 of 5.
Neither passes: both are below 80%, and Haiku stays at 1 of 5.

## Files read

[files-read.md](files-read.md) lists them per session.
No session opened `test/adoption.test.ts`, and no stream holds the test's text or a result of a run.
Every session listed the repository with Glob, which shows that file's name; seven (`after-fable-1` to `-5`, `after-opus-4`, `after-sonnet-5`) read `package.json` and saw the `adoption` script, and `after-fable-2` then listed `experiments/{delivery,adoption}`, where the second folder is not in the copy.
Seven read `CHANGELOG.md` (`after-fable-1`, `-2`, `-4`, `after-opus-1` to `-4`), which no longer describes the evaluation: 2 of those 7 are grounded, and 8 of the other 13.
All 20 read `README.md`, and 16 read `docs/evidence.md`; of the four that did not read the evidence map, all Haiku 5.5, none is grounded.

## Departures from the plan

- The judge ran in two passes. The first judged 28 answers, because the copy of the `before` records had left out the four of them whose JSON is formatted differently; the second judged those four, before `summary.md` was read.
  The prompt, the model and the settings are the same.
- One judgment cost $0.256, above the $0.246 the reserve was computed from; the cap was not reached.
- The twenty sessions ran in the pre-registered order and none ended without an answer, so there were no reruns and the runner never stopped.

## Cost

| Item | Cost |
| --- | --- |
| Calibration, one pass | $1.16 |
| 20 `after` sessions | $13.37 |
| 32 judgments | $6.32 |
| **v6 total** | **$20.85, against a cap of $25** |

The `Cost` line of [summary.md](summary.md) also counts the 12 reused `before` sessions, which v3 paid for.
