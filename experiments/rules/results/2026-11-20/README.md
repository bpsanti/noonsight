# Rule effect, 2026-11-20

This run splits the `rules` arm of [2026-11-19](../2026-11-19/README.md) for Sonnet 5.5 and Haiku 5.5: `verify-changes` alone, `carry-through` alone, both, and neither, on the two tasks where the rules changed what the models did.
It also delivers `verify-changes` as a pointer, one sentence naming a file that holds the rule's text, against the same rule inline.
It is the design `single-rule` of [the experiment's README](../../README.md#the-single-rule-design), whose twenty-one comparisons were fixed before it ran.

Nine comparisons support the rule's source, four show a direction where the source claims none, eight are not shown, and none goes against a source.

- The tests after a precisely described fix come from `verify-changes` alone. With it alone, Sonnet ran the tests after its last edit in 29 of 30 runs and Haiku in 27 of 30; with `carry-through` alone, and without rules, in none of 30.
- On Sonnet's bug, either rule alone was enough. `verify-changes` alone and `carry-through` alone each gave 30 of 30, against 11 of 30 without rules, so there `carry-through` adds the tests too.
- `verify-changes` carries most of the cost where it changes what the model does. Alone it cost about as much as both rules together for Haiku (104% of the `rules` arm's extra cost on the fix, 99% on the bug). `carry-through` alone cost almost nothing where it changed nothing: +$0.0007 per run on Sonnet's fix, 3%.
- On Sonnet's fix, `verify-changes` alone cost more than all three rules together: +$0.0265 per run against +$0.0139, with 9.4 turns against 6.5. Four of its 30 runs added test files nobody asked for, against none in the `rules` arm, which also delivers `sonnet-5-5/stay-in-scope` there. This is a direction, not a tested result: the design does not deliver `stay-in-scope` alone.
- The pointer worked as well as the rule inline. All 120 pointer runs read the file, before their first edit of code and at their first tool call (one Haiku run at its second). The tests after the last edit matched the inline rule on all three tasks compared, and the cost differed only on Sonnet's fix, where the pointer was cheaper ($0.0440 per run against $0.0505).

Every one of the 600 runs passed its hidden check and the project's own suite.
No rule earned a change to the preset from this data, so the preset stays as it is.

## What ran

| Item | Value |
| --- | --- |
| Date | 2026-11-20, 16:30 to 17:40 (UTC) |
| Claude Code | 2.1.329 |
| Preset | `claude` 1.3.1 |
| Effort | `medium` for both models |
| Place and scopes | `unattended`; `routine` for `fix`, `build` for `bug` |
| Runs | 600 recorded, none lost: 30 per arm, task and model; at most 2 at a time |
| Cost | $13.41, as Claude Code reports it (list price), against $14.55 projected and a cap of $25; the costliest run was $0.070, within every budget |

`runs.jsonl` holds every recorded run, and `summary.md` is what `npm run experiment -- summarize <dir> --design single-rule` printed from it.
The decision log holds one session start per run: 480 delivered rules and 120 logged `declared-none`, each rule only to its own model (`summary.md`, "What noonsight delivered").
Each one-rule arm received its one rule and nothing else: `verify` the model's `verify-changes`, `carry` its `carry-through`, and `pointer` the rule `experiment/verify-changes-pointer`, which replaces `verify-changes`.

## The comparisons

p is two-sided: Fisher's exact test for a share, the Mann-Whitney U test for a cost.
Holm's adjustment runs over the twenty-one.
A share comes with its Wilson 95% interval.

### Each rule alone against no rule

| Rule | Task | Signal | With the rule alone | Without rules | Holm p | Reading |
| --- | --- | --- | --- | --- | --- | --- |
| `sonnet-5-5/verify-changes` | `fix` | Tests after the last edit | 29 of 30 (83-99%) | 0 of 30 (0-11%) | < 0.001 | Supports the source |
| `sonnet-5-5/verify-changes` | `bug` | Tests after the last edit | 30 of 30 (89-100%) | 11 of 30 (22-54%) | < 0.001 | Supports the source |
| `haiku-5-5/verify-changes` | `fix` | Tests after the last edit | 27 of 30 (74-97%) | 0 of 30 (0-11%) | < 0.001 | Supports the source |
| `sonnet-5-5/carry-through` | `fix` | Tests after the last edit | 0 of 30 (0-11%) | 0 of 30 (0-11%) | 1.00 | Not shown |
| `sonnet-5-5/carry-through` | `bug` | Tests after the last edit | 30 of 30 (89-100%) | 11 of 30 (22-54%) | < 0.001 | Higher (no direction claimed) |
| `haiku-5-5/carry-through` | `fix` | Tests after the last edit | 0 of 30 (0-11%) | 0 of 30 (0-11%) | 1.00 | Not shown |
| `sonnet-5-5/verify-changes` | `fix` | Cost per run | $0.0505 | $0.0240 | < 0.001 | Supports the source |
| `sonnet-5-5/verify-changes` | `bug` | Cost per run | $0.0494 | $0.0321 | < 0.001 | Supports the source |
| `haiku-5-5/verify-changes` | `fix` | Cost per run | $0.0033 | $0.0015 | < 0.001 | Supports the source |
| `haiku-5-5/verify-changes` | `bug` | Cost per run | $0.0047 | $0.0037 | < 0.001 | Supports the source |
| `sonnet-5-5/carry-through` | `fix` | Cost per run | $0.0247 | $0.0240 | < 0.001 | Supports the source |
| `sonnet-5-5/carry-through` | `bug` | Cost per run | $0.0461 | $0.0321 | < 0.001 | Supports the source |
| `haiku-5-5/carry-through` | `fix` | Cost per run | $0.0018 | $0.0015 | < 0.001 | Higher (no direction claimed) |
| `haiku-5-5/carry-through` | `bug` | Cost per run | $0.0043 | $0.0037 | 0.001 | Higher (no direction claimed) |

Costs are means per run.
Sonnet's 30 `carry-through` runs on the bug all ran the tests, and all after their last edit.
Haiku's 3 runs with `verify-changes` alone on the fix that do not count ran the tests, then edited again.

### The rule as a pointer against the rule inline

| Rule | Task | Signal | As a pointer | Inline | Holm p | Reading |
| --- | --- | --- | --- | --- | --- | --- |
| `sonnet-5-5/verify-changes` | `fix` | Tests after the last edit | 30 of 30 (89-100%) | 29 of 30 (83-99%) | 1.00 | Not shown |
| `sonnet-5-5/verify-changes` | `bug` | Tests after the last edit | 30 of 30 (89-100%) | 30 of 30 (89-100%) | 1.00 | Not shown |
| `haiku-5-5/verify-changes` | `fix` | Tests after the last edit | 27 of 30 (74-97%) | 27 of 30 (74-97%) | 1.00 | Not shown |
| `sonnet-5-5/verify-changes` | `fix` | Cost per run | $0.0440 | $0.0505 | < 0.001 | Lower (no direction claimed) |
| `sonnet-5-5/verify-changes` | `bug` | Cost per run | $0.0515 | $0.0494 | 1.00 | Not shown |
| `haiku-5-5/verify-changes` | `fix` | Cost per run | $0.0038 | $0.0033 | 0.08 | Not shown |
| `haiku-5-5/verify-changes` | `bug` | Cost per run | $0.0045 | $0.0047 | 1.00 | Not shown |

| Model | Task | Read the file | Before the first edit | First read at tool call |
| --- | --- | --- | --- | --- |
| Sonnet 5.5 | `fix` | 30 of 30 | 30 of 30 | 1 in every run |
| Sonnet 5.5 | `bug` | 30 of 30 | 30 of 30 | 1 in every run |
| Haiku 5.5 | `fix` | 30 of 30 | 30 of 30 | 1 in every run |
| Haiku 5.5 | `bug` | 30 of 30 | 30 of 30 | 1, and 2 in one run |

No attempt to read the file was refused.

## Where the effect and the cost of the rules arm come from

The difference of each arm from no rules, and, for an arm of one rule, that difference as a part of the `rules` arm's difference (`summary.md`, "Each arm against none").
Parts need not add up to 100%: two rules can overlap or add to each other, and chance moves every mean.

| Model | Task | Arm | Tests after the last edit | Part of `rules` | Extra cost per run | Part of `rules` | Turns per run |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Sonnet 5.5 | `fix` | `rules` (three rules) | +100 points |  | +$0.0139 |  | 6.5 |
| Sonnet 5.5 | `fix` | `verify` | +97 points | 97% | +$0.0265 | 191% | 9.4 |
| Sonnet 5.5 | `fix` | `carry` | +0 points | 0% | +$0.0007 | 5% | 4.0 |
| Sonnet 5.5 | `bug` | `rules` | +63 points |  | +$0.0192 |  | 10.4 |
| Sonnet 5.5 | `bug` | `verify` | +63 points | 100% | +$0.0173 | 90% | 10.2 |
| Sonnet 5.5 | `bug` | `carry` | +63 points | 100% | +$0.0140 | 73% | 9.4 |
| Haiku 5.5 | `fix` | `rules` | +90 points |  | +$0.0018 |  | 8.4 |
| Haiku 5.5 | `fix` | `verify` | +90 points | 100% | +$0.0018 | 104% | 8.9 |
| Haiku 5.5 | `fix` | `carry` | +0 points | 0% | +$0.0003 | 18% | 4.8 |
| Haiku 5.5 | `bug` | `rules` | +3 points |  | +$0.0010 |  | 15.5 |
| Haiku 5.5 | `bug` | `verify` | +0 points |  | +$0.0010 | 99% | 14.5 |
| Haiku 5.5 | `bug` | `carry` | +3 points |  | +$0.0006 | 59% | 14.3 |

Without rules, Sonnet's fix cost $0.0240 per run, its bug $0.0321, Haiku's fix $0.0015 and its bug $0.0037.
On Haiku's bug, every arm ran the tests after the last edit in 29 or 30 runs of 30, so its parts of the tests say nothing.

On Sonnet's fix, the `verify` arm cost more than the `rules` arm for two visible reasons.
Four of its runs added a test file (`test/digest.test.js` or `test/scheduler.test.js`), and they cost $0.058 to $0.070 each.
The other 26 still cost $0.0485 per run on average, with 9.1 turns, against $0.0378 and 6.5 turns in the `rules` arm.
The `rules` arm differs from `verify` there by `carry-through`, which alone changed nothing on that task, and by `sonnet-5-5/stay-in-scope`, which asks for a report and a stop once the work is done and checked, and for no unrequested tests.
That points at `stay-in-scope` keeping the verify rule's runs short, but the design has no arm that delivers it alone, so this is a direction to test, not a result.

The `rules` and `none` arms repeat 2026-11-19 and agree with it: tests after the last edit 30 of 30 against 0 of 30 on Sonnet's fix (the same), 30 of 30 against 11 of 30 on its bug (15 of 30 then, superseded), and 27 of 30 against 0 of 30 on Haiku's fix (the same); Sonnet's fix cost $0.0378 per run with the rules, against $0.0377 then.

## Cost against the projection

| Model | Task | Expected per run | Measured per run |
| --- | --- | --- | --- |
| Sonnet 5.5 | `fix` | $0.038 | $0.036 |
| Sonnet 5.5 | `bug` | $0.051 | $0.046 |
| Haiku 5.5 | `fix` | $0.0034 | $0.0027 |
| Haiku 5.5 | `bug` | $0.0046 | $0.0044 |
| In total | | $14.55 | $13.41 |

Every arm was projected at the cost of the `rules` arm of 2026-11-19, and the measured total came 8 percent below it.
Seven of the twenty arms cost more per run than projected, by up to a third (Sonnet's `verify` on the fix, $0.0505 against $0.038), and the cheaper `carry` and `none` arms more than made up for them.

## Secondary signals

- Finished: 599 of 600. The one other, a Sonnet `pointer` run on the bug, finished its work and reported it; the hand-back check flagged its last sentence, "I did not add a regression test", a false positive of the wording check.
- Correct: every run passed its hidden check and the project's own suite.
- Extra files: 7 of 600, all test files on the fix, in one-rule arms that deliver `verify-changes`: Sonnet's `verify` 4 of 30, Haiku's `pointer` 2 of 30 and Haiku's `verify` 1 of 30; none in either model's `rules` arm.

## What was not measured

- `sonnet-5-5/stay-in-scope` alone, which the `rules` arm delivers with the other two on Sonnet's fix.
- The task `feature`, where the rules changed little on 2026-11-19.
- Other wordings of the pointer, a pointer to a file inside the project, a longer rule, and sessions long enough for a pointer read at the start to be compacted away; here every session read the file at its first call and was short.
- Fable 5.2, Opus 5.5, other efforts, the place `session`, subagents, and projects in other languages or of real size.
- The quality of the code or tests a session wrote, beyond the hidden checks.

## Limits

- The allow list lets `Bash` run only `npm test`, `node`, `ls` and `cat`, so compound shell commands were refused in every arm, as on 2026-11-19; a refused test attempt does not count as a test run.
- Two small JavaScript fixtures written for the experiment, one bug and one fix.
- One run of the design, on one day and one Claude Code version.
- The hand-back check reads wording.
