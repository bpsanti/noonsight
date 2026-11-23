# Rule effect, 2026-11-16

> **Superseded in part.** On `fix` for Sonnet 5.5 and Haiku 5.5, by [2026-11-20](../2026-11-20/README.md) (Claude Code 2.1.329); on `question` for Fable 5.2, by [2026-11-19](../2026-11-19/README.md) (Claude Code 2.1.328).

The preset rules noonsight delivers moved two of the three outcomes this experiment could observe, in the direction their sources describe.
Sonnet 5.5 and Haiku 5.5 ran the tests after fixing the code far more often with their rules (10 of 10 and 8 of 10) than without (0 of 10 each).
Fable 5.2 wrote reports with shorter sentences and almost no semicolons with its report rule.
The finished signal could not tell the arms apart: every run of both arms finished.
No rule earned a change to the preset from this data, so the preset stays as it is.

These are small samples: 3 to 10 runs per arm, one fixture project, two tasks, one effort level.
Every difference below is a direction with its counts, not a significant result.

## What ran

| Item | Value |
| --- | --- |
| Date | 2026-11-16 |
| Claude Code | 2.1.326 |
| Preset | `claude` 1.2.0, the rules on by default |
| Effort | `medium` for every model |
| Place and scopes | `unattended`; `investigate` for the question, `routine` for the fix |
| Runs per arm | Fable 5.2: 5, Opus 5.5: 3, Sonnet 5.5: 10, Haiku 5.5: 10; 112 runs in all |
| Cost | $7.57 for the 112 recorded runs, as Claude Code reports it; $7.93 with one run thrown away and one trial run, against a cap of $10 |

The run thrown away was a no-rules Fable run whose `SessionStart` hook failed because `dist/` was rebuilt while it loaded; it was run again, and the harness now refuses to record a run without the hook's decision.
`runs.jsonl` holds every recorded run, and `summary.md` is what `npm run experiment -- summarize` printed from it.

## What noonsight delivered

The decision log of the 112 runs holds one session start per run: 56 delivered rules and 56 logged `declared-none`, the no-rules arm.
`noonsight report` shows each rule delivered only to the model it was written for, in the scopes and the place its preset entry names.
That is the earlier controlled test's point, that only the model a rule targets applies it, now held by delivery: a Sonnet session never receives the Fable rule, so it cannot apply it.
`fable-5-2/finish-work` was never delivered, because it reaches subagents only and these tasks start none.

## Each rule

Cost is the difference between the means of the two arms, per run; it includes the rule text the model reads on every turn and what the rule makes it do, such as an extra test run.

| Rule | Signal its source claims | With the rule | Without | Output tokens per run | Cost per run | Reading |
| --- | --- | --- | --- | --- | --- | --- |
| `sonnet-5-5/verify-changes` | Tests run after the last edit (fix) | 10 of 10 | 0 of 10 | +522 (790 to 1,312) | +$0.013 (+46%) | The effect the source describes, at a cost of about half again the run |
| `haiku-5-5/verify-changes` | Tests run after the last edit (fix) | 8 of 10 | 0 of 10 | +1,408 (681 to 2,089) | +$0.002 | The effect the source describes; the other 2 runs ran the tests, then edited again |
| `fable-5-2/low-context-report` | Words per sentence (question) | 11.7, range 9.7 to 12.9 | 15.3, range 13.8 to 16.7 | -87 | -$0.015 | Shorter sentences, as the source describes; the ranges do not overlap |
| | Semicolons per 1,000 words (question) | 0.8, range 0 to 4.1 | 19.9, range 13.2 to 32.4 | | | Fewer semicolons, as the source describes; the ranges do not overlap |
| | Words per sentence (fix) | 15.6, range 13.7 to 18.6 | 18.7, range 16.5 to 20.3 | -149 | -$0.008 | Same direction, with overlapping ranges |
| `sonnet-5-5/carry-through` | Finished | 20 of 20 | 20 of 20 | +116 (question), +522 (fix) | +$0.004, +$0.013 | Inconclusive: both arms always finished; the fix's cost is shared with the rules delivered beside it |
| `haiku-5-5/carry-through` | Finished; extra files | 20 of 20; 0 of 20 | 20 of 20; 0 of 20 | +332 (question), +1,408 (fix) | +$0.000, +$0.002 | Inconclusive, as above |
| `opus-5-5/unattended-run` | Finished | 6 of 6 | 6 of 6 | +32 (question), +94 (fix) | +$0.004, +$0.007 | Inconclusive: both arms always finished |
| `sonnet-5-5/stay-in-scope` | Extra files (fix) | 0 of 10 | 0 of 10 | shared with the two above | | Inconclusive: Sonnet added no file in either arm |
| `fable-5-2/finish-work` | Finished | | | | | Not measured: it reaches subagents only |

Where an arm delivers more than one rule (Sonnet's two or three, Haiku's two), the arm cannot tell them apart.
The test runs are credited to the verify rules because their sources claim that effect and the carry-through rules' do not; the token cost is the whole arm's.

Two observations outside the rules:

- Fable 5.2 and Opus 5.5 ran the tests after their fix in every run without any rule (5 of 5 and 3 of 3), which fits the preset giving a verify rule to Sonnet and Haiku only.
- Every run of every arm answered the question correctly (the three jobs, none wrong) and passed the fix's hidden check, so no rule changed correctness on these tasks.

## The preset, reviewed

| Rule | On by default | Finding | Change |
| --- | --- | --- | --- |
| `sonnet-5-5/verify-changes` | Yes | Its effect showed, at a measured cost | None |
| `haiku-5-5/verify-changes` | Yes | Its effect showed, at a small cost | None |
| `fable-5-2/low-context-report` | Yes | Its effect showed, with no added cost | None |
| `sonnet-5-5/carry-through` | Yes | Inconclusive: these tasks are too short to stop early | None |
| `haiku-5-5/carry-through` | Yes | Inconclusive, as above | None |
| `opus-5-5/unattended-run` | Yes | Inconclusive, as above | None |
| `sonnet-5-5/stay-in-scope` | Yes | Inconclusive: no additions to prevent | None |
| `fable-5-2/finish-work` | Yes | Not measured | None |
| The eight rules that ship off | No | Not measured | None |

Turning a rule off or narrowing its scopes needs data that it does not deliver its effect or costs more than it gives back, and none of these runs shows that.
The three carry-through rules need longer tasks, where a model can stop before the work is done, to be measured at all.

## Limits

- One small fixture and two short tasks; real work is longer, and the rules aimed at early stopping only matter there.
- One effort level, `medium`; the Sonnet and Haiku sources report their effects at low and medium effort.
- The place `session` and subagents were not run.
- Denied tool calls, mostly shell commands the allow list does not cover, such as writing a file through a heredoc, were similar across arms except for Haiku's fix, where the rule arm tried more test commands (6 denied, against none).
- The hand-back check reads wording, and the prose measures leave tables out.
