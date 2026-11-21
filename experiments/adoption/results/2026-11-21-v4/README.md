# Adoption evaluation, 2026-11-21, v4

The design pre-registered in [the v4 section](../../README.md#v4-the-readme-of-your-own-rules) of the evaluation's README, on the README that presents noonsight as delivery of each model's instructions, with a section on writing your own rules: `after` is `ceecdb2`, `before` is `f061f03`.
The prompt, the reference ([rubric.md](../../rubric.md)), the judge's instructions, the scoring and the pass bar are those of v2 and v3; the judge reads the evidence map of `ceecdb2`.
Sessions ran on Claude Code 2.1.330 at `medium` effort, at most two at once; the judge is Claude Opus 5.5 at `medium` effort.

## Result

**The README does not pass the pre-registered bar, and it scores below v3's README.**
5 of 18 `after` answers were grounded (Fable 5.2 2 of 3, Opus 5.5 1 of 5, Sonnet 5.5 1 of 5, Haiku 5.5 1 of 5), 28%, against 0 of 12 `before`; Fisher's exact test, two-sided, p 0.07 ([summary.md](summary.md)).
The bar asks 80% overall and 60% for each model; both are missed, and the third condition, no worse than `before`, is met.
v3's `after` answers were 8 of 12 grounded (67%); against them v4's 5 of 18 gives p 0.06.

Every one of the 18 `after` answers recommended adopting with conditions, stated the delivery claim correctly and named a real limit; 17 invented no feature.
13 were not grounded, so 13 of 18 count as adopting on wrong grounds.

## Where the answers went wrong

Each of the 13 misses, by the judgment's false claim (`judgments.jsonl`):

- **The reference's L4, five answers** (`after-opus-1`, `-opus-2`, `-opus-3`, `-sonnet-3`, `-fable-1`).
  Each says a watched Sonnet 5.5 or Haiku 5.5 session with no scope receives `verify-changes` once it edits a tracked code file, and the judge read that against L4, "a watched session with no task scope receives nothing from the shipped preset".
  The answers are right: the README's table of `triggers` and `docs/configuration.md` say a `code-edit` rule arrives whatever the scope, and v3 recorded L4 as wrong for this reason.
  The new README states the trigger more plainly than v3's did, and more answers repeated it; the reference was left as pre-registered.
- **The Claude Code version of the results, five answers** (`after-sonnet-1`, `-sonnet-4`, `-sonnet-5`, `-haiku-3`, `-opus-5`).
  The README names only 2.1.328, for the delivery run; the evidence map gives 2.1.328 for some rule effect runs and 2.1.329 for others.
  Two answers said every measurement was on 2.1.328, two that the rule effect runs were on 2.1.329 (one of them also that the evidence is one run on one date), and one that the results come from 2.1.328 and 2.1.330.
  Of these, `after-sonnet-1` ("verified on Claude Code 2.1.328, with rule-effect runs on 2.1.329") is right for most rule effect runs and was judged false for the four on 2.1.328, and 2.1.330 in `after-opus-5` is the version `docs/verification/claude-code.md` records for the session variable; both judgments are kept as made.
- **Fable 5.2's measured rule effect, two answers** (`after-haiku-2`, `after-haiku-5`), which said only Sonnet and Haiku rules were measured, where R9 measures Fable 5.2's `low-context-report`; `after-haiku-5` also dated the 300-session delivery run to 2026-11-19.
- **An invented feature, one answer** (`after-haiku-4`), which said `noonsight report` finds rules that never change anything; it only reports deliveries.

With L4 read as the code and the README have it, and nothing else changed, 10 of 18 would be grounded (56%; Fable 3 of 3, Opus 4 of 5, Sonnet 2 of 5, Haiku 1 of 5), still short of the bar; v3 read the same way had 9 of 12.

## The `before` answers

The 12 `before` answers are v3's, reused as they are; they were judged again with the v4 evidence map, as pre-registered, and are 0 of 12 grounded, as in v3.
Several of their false claims are numbers the README of `f061f03` cited from the delivery run of 2026-11-20 (99.5% coverage, 3 of 300 sessions, 70.9% for `.claude/rules`), which the v4 evidence map gives as 99.9%, 1 of 300 and 70.6%; with v3's judgments they were also 0 of 12, for other reasons.

## Departures from the plan

- **Calibration.** The first calibration agreed on 8 of 9 answers ([calibration-first.json](calibration-first.json)): `rounding` cited the values of the run of 2026-11-20 that the v4 evidence map replaces, and the judge was right to call them false.
  Before any session, two calibration answers were brought to the v4 values and the calibration ran again, 9 of 9 ([calibration.json](calibration.json)); the revision is recorded in the evaluation's README.
- **Fable 5.2 has 3 answers, not 5.** The machine running the sessions went to sleep, and five Fable 5.2 sessions ended with no answer (`no-result` in `runs.jsonl`): three of the first five, and two of the three sessions run again.
  Their spending is not in the records (Claude Code reported no cost for them); from the token usage in their streams it was about $4.24 for the first three and little for the other two, which ran for about 30 seconds and not at all before the sleep.
  With that spending and the same risk on every further session, the remaining two were not run again; the bar is read on the answers scored, as pre-registered.
- **Before judged again.** Four `before` judgments failed on the first pass, during a sleep, and were made on a second pass.

## Cost

| Item | Cost |
| --- | --- |
| Calibration, two passes | $2.13 |
| 18 answered `after` sessions | $9.51 |
| Interrupted Fable 5.2 sessions, estimated | about $4.5 |
| 30 judgments | $5.64 |
| **v4 total** | **about $21.8, against a cap of $25** |

The `Cost` line of [summary.md](summary.md) also counts the 12 reused `before` sessions, which v3 paid for.
