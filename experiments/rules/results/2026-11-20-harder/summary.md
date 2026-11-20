# Rule effect experiment: summary

160 runs, Claude Code 2.1.329, effort low, 2026-11-20; $24.61 spent in total, as Claude Code reports cost.
A share comes with its Wilson 95% interval, and p is two-sided: Fisher's exact test for a share, the Mann-Whitney U test for a measure. With few runs per arm, a difference is a direction to look at again, not a measured effect.

## What noonsight delivered

From the decision log of every run, as `noonsight report --log decisions.jsonl` prints it, against a configuration that declares every model of the plan with the preset:

```text
160 decisions, from 2026-11-20T19:17:02.981Z to 2026-11-20T21:18:24.836Z
  delivered rules: 80 (session-start 80)
  delivered no rules: 80 (declared-none 80)

Rules delivered, most often first:
  haiku-5-5/carry-through: 40 deliveries in 40 sessions, last 2026-11-20T21:18:19.234Z
     models: claude-haiku-5-5 40
     scopes: build 40
     places: unattended 40
     events: session-start 40
     text: 580 characters for claude-haiku-5-5
  sonnet-5-5/carry-through: 40 deliveries in 40 sessions, last 2026-11-20T21:16:45.275Z
     models: claude-sonnet-5-5 40
     scopes: build 40
     places: unattended 40
     events: session-start 40
     text: 360 characters for claude-sonnet-5-5

On in the configuration (every model of the plan with "use": "preset"), never delivered in this log:
  fable-5-2/finish-work for claude-fable-5-2 (scopes: investigate, build; places: subagent)
  fable-5-2/low-context-report for claude-fable-5-2 (scopes: every scope; places: unattended, subagent)
  opus-5-5/unattended-run for claude-opus-5-5 (scopes: every scope; places: unattended)
  sonnet-5-5/stay-in-scope for claude-sonnet-5-5 (scopes: routine; places: session, unattended, subagent)
  sonnet-5-5/verify-changes for claude-sonnet-5-5 (scopes: investigate, build, routine; places: session, unattended, subagent)
  haiku-5-5/verify-changes for claude-haiku-5-5 (scopes: investigate, build, routine; places: session, unattended, subagent)
```

## Each task, model and arm

| Task | Model | Arm | Runs | Finished | Handed back | Tests after last edit | Extra files | Correct | Words per sentence | Semicolons per 1k words | Output tokens | Input tokens | Cost USD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| triage | haiku | carry: haiku-5-5/carry-through | 40 | 40 of 40 | 0 of 40 | 4 of 40 | 1 of 40 | 6 of 40 every part; parts 11.1 (10.0 to 12.0) of 12 | 11.2 (9.1 to 14.2) | 1.7 (0.0 to 11.2) | 20,504 (16,350 to 26,083) | 404,993 (218,647 to 644,698) | 0.020 (0.016 to 0.025) |
| triage | haiku | none | 40 | 40 of 40 | 0 of 40 | 4 of 40 | 0 of 40 | 2 of 40 every part; parts 10.9 (9.0 to 12.0) of 12 | 11.4 (8.9 to 14.0) | 1.8 (0.0 to 10.3) | 18,343 (11,414 to 23,994) | 307,955 (124,852 to 605,187) | 0.018 (0.011 to 0.025) |
| triage | sonnet | carry: sonnet-5-5/carry-through | 40 | 40 of 40 | 0 of 40 | 17 of 40 | 0 of 40 | 32 of 40 every part; parts 11.8 (10.0 to 12.0) of 12 | 11.9 (10.5 to 13.3) | 0.6 (0.0 to 3.3) | 15,526 (11,531 to 21,912) | 298,865 (186,324 to 432,574) | 0.285 (0.217 to 0.396) |
| triage | sonnet | none | 40 | 40 of 40 | 0 of 40 | 18 of 40 | 0 of 40 | 9 of 40 every part; parts 11.1 (10.0 to 12.0) of 12 | 11.6 (9.8 to 13.2) | 0.5 (0.0 to 5.5) | 16,046 (11,431 to 21,135) | 298,461 (161,469 to 499,988) | 0.292 (0.214 to 0.404) |

Numbers are the mean with the range in parentheses. "Correct" is, for the question, the jobs named that ignore a control, of the three that do, and the jobs named wrongly; for a task with a hidden check, the runs whose change passes it; for a long task, the runs that did every part, and the parts done. Input tokens include the cached ones.

## Each rule

### `fable-5-2/low-context-report`

Not delivered in any run of this experiment, so not measured.

### `fable-5-2/finish-work`

Not delivered in any run of this experiment, so not measured.

### `opus-5-5/unattended-run`

Not delivered in any run of this experiment, so not measured.

### `sonnet-5-5/carry-through`

| Task | Model | Arm | Signal | With the rule | Without (arm none) | p |
| --- | --- | --- | --- | --- | --- | --- |
| triage | sonnet | carry | Runs finished (deliverable present, work not handed back) | 40 of 40 (91-100%) | 40 of 40 (91-100%) | 1.00 |
| triage | sonnet | carry | Runs that did every part of a long task | 32 of 40 (65-90%) | 9 of 40 (12-38%) | < 0.001 |
| triage | sonnet | carry | Output tokens per run | 15,526 (11,531 to 21,912) | 16,046 (11,431 to 21,135) | 0.26 |
| triage | sonnet | carry | Difference of the means | -520 output, +405 input tokens | -$0.007 per run |  |
| triage | sonnet | carry | Delivered in the same runs | no other rule |  |  |

### `sonnet-5-5/verify-changes`

Not delivered in any run of this experiment, so not measured.

### `sonnet-5-5/stay-in-scope`

Not delivered in any run of this experiment, so not measured.

### `haiku-5-5/carry-through`

| Task | Model | Arm | Signal | With the rule | Without (arm none) | p |
| --- | --- | --- | --- | --- | --- | --- |
| triage | haiku | carry | Runs finished (deliverable present, work not handed back) | 40 of 40 (91-100%) | 40 of 40 (91-100%) | 1.00 |
| triage | haiku | carry | Runs that did every part of a long task | 6 of 40 (7-29%) | 2 of 40 (1-17%) | 0.26 |
| triage | haiku | carry | Runs that changed files beyond the ones asked | 1 of 40 (0-13%) | 0 of 40 (0-9%) | 1.00 |
| triage | haiku | carry | Output tokens per run | 20,504 (16,350 to 26,083) | 18,343 (11,414 to 23,994) | < 0.001 |
| triage | haiku | carry | Difference of the means | +2,160 output, +97,038 input tokens | +$0.002 per run |  |
| triage | haiku | carry | Delivered in the same runs | no other rule |  |  |

### `haiku-5-5/verify-changes`

Not delivered in any run of this experiment, so not measured.

## Long tasks: how the runs ended

| Task | Model | Arm | Runs | Every part done | Parts done | Ended as | Incomplete runs that ended on their own | Of those, handed back | Parts most often left undone |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| triage | haiku | carry | 40 | 6 of 40 (7-29%) | 11.1 (10.0 to 12.0) of 12 | success 40 | 34 of 34 | 0 of 34 | PAN-27 (34), closing (1) |
| triage | haiku | none | 40 | 2 of 40 (1-17%) | 10.9 (9.0 to 12.0) of 12 | success 40 | 38 of 38 | 0 of 38 | PAN-27 (38), closing (6), PAN-24 (1) |
| triage | sonnet | carry | 40 | 32 of 40 (65-90%) | 11.8 (10.0 to 12.0) of 12 | success 40 | 8 of 8 | 0 of 8 | PAN-24 (6), PAN-27 (3) |
| triage | sonnet | none | 40 | 9 of 40 (12-38%) | 11.1 (10.0 to 12.0) of 12 | success 40 | 31 of 31 | 0 of 31 | PAN-24 (30), closing (5), PAN-27 (1) |

A run that ended on its own reported success; one stopped by its budget reports `error_max_budget_usd`, and one stopped at its time limit reports no result (`no-result`). Either kind counts as incomplete when a part is left undone.

## Pre-registered comparisons

The comparisons the design fixed before it ran, each task apart. p is two-sided; Holm's adjustment runs over the 2 that ran (2 of the 4 have no run in one of their arms, so they are not run), and a comparison supports the rule's source when its adjusted p is below 0.05 and the difference goes the way the source claims. Where the source claims no direction, the reading is the direction found, or "not shown".

| Rule | Task | Arms | Signal | With the rule | Without | p | Holm p | Reading |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `sonnet-5-5/carry-through` | codes | carry against none | Every part done (higher claimed) | n/a | n/a | n/a | n/a | not run |
| `sonnet-5-5/carry-through` | triage | carry against none | Every part done (higher claimed) | 32 of 40 (65-90%) | 9 of 40 (12-38%) | < 0.001 | < 0.001 | supports the source |
| `haiku-5-5/carry-through` | codes | carry against none | Every part done (higher claimed) | n/a | n/a | n/a | n/a | not run |
| `haiku-5-5/carry-through` | triage | carry against none | Every part done (higher claimed) | 6 of 40 (7-29%) | 2 of 40 (1-17%) | 0.26 | 0.26 | not shown |

## Cost against the projection

| Model | Task | Runs | Expected per run | Measured per run | Measured |
| --- | --- | --- | --- | --- | --- |
| sonnet | codes | 0 | $0.600 | n/a | $0.00 |
| sonnet | triage | 80 | $0.350 | $0.288 | $23.07 |
| haiku | codes | 0 | $0.035 | n/a | $0.00 |
| haiku | triage | 80 | $0.025 | $0.019 | $1.53 |

Measured: $24.61 for the recorded runs, against $30.00 expected for the same runs and a cap of $110.

