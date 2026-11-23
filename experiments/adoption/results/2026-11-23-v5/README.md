# Adoption evaluation, 2026-11-23, v5

The design pre-registered in [the v5 section](../../README.md#v5-the-readme-after-the-attended-places-and-the-new-delivery-paths) of the evaluation's README: `after` is `516914f`, `before` is `f061f03`.
The reference is [rubric.md](../../rubric.md) with limit L4 corrected after v4; the prompt, the judge's instructions, the scoring and the pass bar are those of v4, and the judge reads the evidence map of `516914f`.
Sessions ran on Claude Code 2.1.330 at `medium` effort, at most two at once; the judge is Claude Opus 5.5 at `medium` effort, and its calibration agreed on 9 of 9 answers ([calibration.json](calibration.json)).

## Result

**The README passes the pre-registered bar, the first time a version does, with Haiku 5.5 exactly at its 60%.**
18 of 20 `after` answers were grounded, 90% (Wilson interval 70-97%), against 0 of 12 `before`; Fisher's exact test, two-sided, p < 0.001 ([summary.md](summary.md)).

| Model | Earlier `after` answers | v5 | Bar |
| --- | --- | --- | --- |
| Fable 5.2 | v4 2 of 3 | 5 of 5 | 60% |
| Opus 5.5 | v4 1 of 5 | 5 of 5 | 60% |
| Sonnet 5.5 | v4 1 of 5 | 5 of 5 | 60% |
| Haiku 5.5 | v4 1 of 5 | 3 of 5 | 60% |
| All | v3 8 of 12 (67%), v4 5 of 18 (28%) | 18 of 20 (90%) | 80% |

Every one of the 20 answers recommended adopting with conditions, stated the delivery claim correctly and named a real limit; 19 invented no feature.
The 2 not grounded are the 2 that adopt on wrong grounds (10%), both Haiku 5.5.

Against v4, p < 0.001; against v3, p 0.17.
Neither is a comparison of READMEs alone: v3 and v4 were judged with the old L4 and their own evidence maps.
Read with the corrected L4, v4 had 10 of 18 and v3 9 of 12.

## Read this result with these in mind

**Five sessions read this evaluation's own findings.**
The copy a session gets leaves out `experiments/adoption` but not `CHANGELOG.md`, which says what the fourth run found, what the README now says about it, and that the reference's L4 was corrected.
`after-fable-1`, `after-fable-4`, `after-haiku-1`, `after-opus-2` and `after-opus-5` read that text, and all five were grounded.
v4 had the same gap, with v3's findings (its streams show sessions that read the entry on the third run).
Without those five, which is a reading made after the results and not the pre-registered one, 13 of 15 are grounded (87%): Fable 3 of 3, Opus 3 of 3, Sonnet 5 of 5, Haiku 2 of 4.
Haiku would then be at 50%, below its 60%.
A later run should leave `CHANGELOG.md` out of the copy or out of the evaluation's findings; that is a change to the sandbox, so it belongs to a new pre-registration.

**The per-model bar rests on one answer.**
Haiku 5.5 passes at 3 of 5; one more miss would fail it.
Haiku's 60% of five answers is compatible with a wide range of true rates.

**The README was revised to answer v4's misses.**
The changes since v4 include statements that answer its misses (the Claude Code versions, R9, what `report` does), and the reference was corrected, so v5 measures the README after it was shaped by earlier runs, on the same prompt and judge.

**`before` is scored against a newer map.**
Several false claims of the `before` answers are values of the delivery run of 2026-11-20 that the map replaces.
v3 and v4 also scored these answers 0 of 12, for other reasons too.
So 0 of 12 says more about the gap than about its size.

## Where the answers went wrong

- **`after-haiku-4`**, one false claim: "the '99.9%' headline is from an earlier build (2.1.328), before the fixes".
  The judge read "the fixes" as F1 to F4, which that build includes; the answer, which sets it against the 0 of 300 of 2.1.330, can be read as meaning F5 to F9, which it does not include, and that reading is true.
  The judgment is kept as made.
- **`after-haiku-5`**, three findings, of which two stand: Fable and Opus rules "never fired in the rule-effect experiment" (R9 measures Fable 5.2's `low-context-report`); and the invented feature that hook latency "adds to every tool call" (noonsight's hooks run only on the agent tool, Edit and Write, and session events).
  The README states R9, and this answer still missed it.
  The third, hooks at "80 to 150 ms each on a loaded machine", was judged false against D15 (50 to 90 ms) but is what the delivery run of 2026-11-23 reports; even without it, the answer is not grounded.

No answer was judged not grounded for agreeing with the evidence map against the reference's stale L5 or delivery claim, the two statements the pre-registration named, so the pre-registered reading without those judgments is the same 18 of 20.

## Departures from the plan

- The runner stopped before the last two sessions (`after-sonnet-5`, `after-haiku-5`), because an Opus session's reserved budget left no room under its cap of $16 for sessions; they ran once the sessions in flight had finished.
  The first passes used a sessions cap of $16 and the last $15.97, the figure the pre-registered formula gives ($25, less the $1.16 calibration and 32 judgments at $0.246); nothing was spent past $14.21.
- No session ended without an answer, so there were no reruns.

## Cost

| Item | Cost |
| --- | --- |
| Calibration, one pass | $1.16 |
| 20 `after` sessions | $14.21 |
| 32 judgments | $6.16 |
| **v5 total** | **$21.53, against a cap of $25** |

The `Cost` line of [summary.md](summary.md) also counts the 12 reused `before` sessions, which v3 paid for.
