# Rule effect, 2026-11-19

> **Superseded in part.** On `fix` and `bug` for Sonnet 5.5 and Haiku 5.5, by [2026-11-20](../2026-11-20/README.md) (Claude Code 2.1.329), where Sonnet's bug without rules gives 11 of 30; the rest is current.

This run tests again the three rules whose effect showed on [2026-11-16](../2026-11-16/README.md), each on three tasks of different shapes, with 30 runs per arm and task.
It is the design `expanded` of [the experiment's README](../../README.md#the-expanded-design), whose twelve comparisons were fixed before it ran.

Nine of the twelve comparisons support the rule's source after Holm's adjustment, and none goes against it.

- `fable-5-2/low-context-report` did what its source describes on all three tasks: shorter sentences and fewer semicolons in every one (6 of 6 comparisons).
- `sonnet-5-5/verify-changes` made Sonnet 5.5 run the tests after its last edit on the precise fix (30 of 30 against 0 of 30) and on the bug (30 of 30 against 15 of 30). On the feature, Sonnet ran them in every run of both arms, so there was nothing left to change.
- `haiku-5-5/verify-changes` made Haiku 5.5 run the tests after the precise fix (27 of 30 against 0 of 30). On the bug and the feature, Haiku already ran them without the rule (30 of 30 and 29 of 30), so there was nothing left to change.

So the verify rules change behavior where the task is described precisely enough that the model skips the tests without them, and cost little elsewhere.
Every one of the 540 runs passed its hidden check and the project's own suite, so no rule changed correctness on these tasks.
No rule earned a change to the preset from this data, so the preset stays as it is.

## What ran

| Item | Value |
| --- | --- |
| Date | 2026-11-19, 22:17 to 2026-11-20, 00:07 (UTC) |
| Claude Code | 2.1.328 |
| Preset | `claude` 1.3.1, the rules on by default |
| Effort | `medium` for every model |
| Place and scopes | `unattended`; `investigate` for `question`, `routine` for `fix`, `build` for `bug` and `feature` |
| Runs | 540 recorded, none lost: 30 per arm, task and model; at most 2 at a time |
| Cost | $73.82, as Claude Code reports it (list price), against $78.18 projected and a cap of $120; the costliest run was $0.79, within every budget |

`runs.jsonl` holds every recorded run, and `summary.md` is what `npm run experiment -- summarize <dir> --design expanded` printed from it.
The decision log holds one session start per run: 270 delivered rules and 270 logged `declared-none`, each rule only to its own model, in the scopes and the place its preset entry names (`summary.md`, "What noonsight delivered").

## The comparisons

p is two-sided: Fisher's exact test for a share, the Mann-Whitney U test for a measure.
Holm's adjustment runs over the twelve.
A share comes with its Wilson 95% interval.

| Rule | Task | Signal | With the rule | Without | Holm p | Reading |
| --- | --- | --- | --- | --- | --- | --- |
| `sonnet-5-5/verify-changes` | `fix` | Tests after the last edit | 30 of 30 (89-100%) | 0 of 30 (0-11%) | < 0.001 | Supports the source |
| `sonnet-5-5/verify-changes` | `bug` | Tests after the last edit | 30 of 30 (89-100%) | 15 of 30 (33-67%) | < 0.001 | Supports the source |
| `sonnet-5-5/verify-changes` | `feature` | Tests after the last edit | 30 of 30 (89-100%) | 30 of 30 (89-100%) | 1.00 | Not shown: both at the ceiling |
| `haiku-5-5/verify-changes` | `fix` | Tests after the last edit | 27 of 30 (74-97%) | 0 of 30 (0-11%) | < 0.001 | Supports the source |
| `haiku-5-5/verify-changes` | `bug` | Tests after the last edit | 30 of 30 (89-100%) | 30 of 30 (89-100%) | 1.00 | Not shown: both at the ceiling |
| `haiku-5-5/verify-changes` | `feature` | Tests after the last edit | 29 of 30 (83-99%) | 29 of 30 (83-99%) | 1.00 | Not shown: both near the ceiling |
| `fable-5-2/low-context-report` | `question` | Words per sentence | mean 12.3 | mean 16.4 | < 0.001 | Supports the source |
| `fable-5-2/low-context-report` | `bug` | Words per sentence | mean 17.8 | mean 20.1 | 0.006 | Supports the source |
| `fable-5-2/low-context-report` | `feature` | Words per sentence | mean 12.2 | mean 16.2 | < 0.001 | Supports the source |
| `fable-5-2/low-context-report` | `question` | Semicolons per 1,000 words | mean 2.5 | mean 13.0 | < 0.001 | Supports the source |
| `fable-5-2/low-context-report` | `bug` | Semicolons per 1,000 words | mean 0.7 | mean 4.2 | < 0.001 | Supports the source |
| `fable-5-2/low-context-report` | `feature` | Semicolons per 1,000 words | mean 0.0 (no report with one) | mean 3.3 (14 of 30 with one) | < 0.001 | Supports the source |

The reading of the last row was corrected after the run.
The summary first took a measure's direction from the two medians, and here both are 0, so it read "not shown" although the test found the difference.
The direction now comes from the test's own statistic, U, as the comparison it was written for intends; the test, the adjustment and the threshold are the ones fixed before the run.

On the verify comparisons, a run counts when it ran a test or run command after its last edit; a test command the allow list refused does not count (see [Limits](#limits)).
Sonnet's 15 runs without the rule on the bug split cleanly: the 15 that ran a test all ran it after their last edit, and the other 15 ran none.
Haiku's 3 runs with the rule on the fix that do not count ran the tests, then edited again.

## Cost of each rule

The difference of the arms' means per run; it includes the rule text the model reads on every turn and what the rule makes it do, such as an extra test run.

| Model | Task | Cost per run, with and without | Difference | Output tokens per run, with and without |
| --- | --- | --- | --- | --- |
| Sonnet 5.5 | `fix` | $0.038 and $0.024 | +$0.014 (+59%) | 1,257 and 680 |
| Sonnet 5.5 | `bug` | $0.051 and $0.032 | +$0.019 (+58%) | 1,798 and 1,034 |
| Sonnet 5.5 | `feature` | $0.135 and $0.127 | +$0.009 (+7%) | 6,978 and 6,749 |
| Haiku 5.5 | `fix` | $0.0034 and $0.0015 | +$0.0019 (+127%) | 2,328 and 694 |
| Haiku 5.5 | `bug` | $0.0046 and $0.0037 | +$0.0008 (+22%) | 3,549 and 2,723 |
| Haiku 5.5 | `feature` | $0.0074 and $0.0068 | +$0.0006 (+9%) | 6,895 and 6,365 |
| Fable 5.2 | `question` | $0.309 and $0.301 | +$0.008 (+3%) | 3,171 and 2,873 |
| Fable 5.2 | `bug` | $0.206 and $0.201 | +$0.005 (+3%) | 1,745 and 1,697 |
| Fable 5.2 | `feature` | $0.464 and $0.546 | -$0.082 (-15%) | 5,927 and 7,415 |

Sonnet's rules cost about half again the run where they changed what it did, and little where they did not; Haiku's more than doubled the fix's cost, from a fraction of a cent.
Where Sonnet's arm delivers more than one rule, the cost is the whole arm's, and the test runs are credited to the verify rule because its source claims them.

## Cost against the projection

| Model | Task | Expected per run | Measured per run |
| --- | --- | --- | --- |
| Fable 5.2 | `question` | $0.300 | $0.305 |
| Fable 5.2 | `bug` | $0.360 | $0.203 |
| Fable 5.2 | `feature` | $0.460 | $0.505 |
| Sonnet 5.5 | `fix` | $0.032 | $0.031 |
| Sonnet 5.5 | `bug` | $0.061 | $0.042 |
| Sonnet 5.5 | `feature` | $0.077 | $0.131 |
| Haiku 5.5 | `fix` | $0.002 | $0.002 |
| Haiku 5.5 | `bug` | $0.005 | $0.004 |
| Haiku 5.5 | `feature` | $0.006 | $0.007 |
| In total | | $78.18 | $73.82 |

The two tasks measured before (`question`, `fix`) came within a few percent of 2026-11-16.
Of the two new ones, `bug` cost less than assumed and `feature` more, by up to 70 percent for Sonnet, and the total stayed within 6 percent of the projection.

## Secondary signals

- Finished: 540 of 540; no final message handed the work back.
- Correct: every run passed its hidden check and the project's own suite, and every `question` report named `digest`, `metrics` and `sync` and no other job.
- Extra files: 1 of 540, a temporary check script (`test/tmp-digest-check.mjs`) left by one Haiku run with the rules on the fix; `sonnet-5-5/stay-in-scope` stays inconclusive, with no extra file in either arm (0 of 30 each).
- Parentheses per 1,000 words in Fable's reports, which its rule also discourages: 30.4 against 45.6 on `question`, 4.0 against 13.7 on `bug`, and 2.1 against 15.2 on `feature`.
- Turns per run went up with the verify rules where they changed behavior: Sonnet's fix from 4 to 6.5, Haiku's fix from 4 to 8.5.

## What was not measured

- Opus 5.5 and its rule, `opus-5-5/unattended-run`: these tasks cannot tell its signal apart, as on 2026-11-16.
- The carry-through rules: every run finished in both arms, as on 2026-11-16, so the tasks are still too short for early stopping to show.
- `fable-5-2/finish-work`, which reaches subagents only, and the rules that ship off.
- The rules one by one within an arm: Sonnet's and Haiku's arms deliver two or three rules together.
- Other efforts, the place `session`, subagents, and projects in other languages or of real size.
- The quality of the code or tests a session wrote, beyond the hidden checks.

## Limits

- The allow list lets `Bash` run only `npm test`, `node`, `ls` and `cat`, so compound shell commands were refused in both arms: pipes, `&&`, loops and heredocs, such as `npm test 2>&1 | tail -20`. Every Fable run had at least one refused call, and the feature task drew the most in every model. A refused test attempt does not count as a test run, which counts against both arms the same way but may lower the shares of tests after the last edit.
- Three small JavaScript fixtures with no dependencies, written for the experiment; the bug and the feature are of one size each.
- One run of the design, on one day and one Claude Code version.
- The prose measures leave tables out, and the hand-back check reads wording.
