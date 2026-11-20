# Rule effect experiment: summary

600 runs, Claude Code 2.1.329, effort medium, 2026-11-20; $13.41 spent in total, as Claude Code reports cost.
A share comes with its Wilson 95% interval, and p is two-sided: Fisher's exact test for a share, the Mann-Whitney U test for a measure. With few runs per arm, a difference is a direction to look at again, not a measured effect.

## What noonsight delivered

From the decision log of every run, as `noonsight report --log decisions.jsonl` prints it, against a configuration that declares every model of the plan with the preset:

```text
600 decisions, from 2026-11-20T16:30:41.976Z to 2026-11-20T17:40:07.311Z
  delivered rules: 480 (session-start 480)
  delivered no rules: 120 (declared-none 120)

Rules delivered, most often first:
  experiment/verify-changes-pointer: 120 deliveries in 120 sessions, last 2026-11-20T17:39:50.726Z
     models: claude-haiku-5-5 60, claude-sonnet-5-5 60
     scopes: build 60, routine 60
     places: unattended 120
     events: session-start 120
  haiku-5-5/carry-through: 120 deliveries in 120 sessions, last 2026-11-20T17:39:54.862Z
     models: claude-haiku-5-5 120
     scopes: build 60, routine 60
     places: unattended 120
     events: session-start 120
     text: 580 characters for claude-haiku-5-5
  haiku-5-5/verify-changes: 120 deliveries in 120 sessions, last 2026-11-20T17:39:38.147Z
     models: claude-haiku-5-5 120
     scopes: build 60, routine 60
     places: unattended 120
     events: session-start 120
     text: 705 characters for claude-haiku-5-5
  sonnet-5-5/carry-through: 120 deliveries in 120 sessions, last 2026-11-20T17:39:11.382Z
     models: claude-sonnet-5-5 120
     scopes: build 60, routine 60
     places: unattended 120
     events: session-start 120
     text: 360 characters for claude-sonnet-5-5
  sonnet-5-5/verify-changes: 120 deliveries in 120 sessions, last 2026-11-20T17:38:56.864Z
     models: claude-sonnet-5-5 120
     scopes: build 60, routine 60
     places: unattended 120
     events: session-start 120
     text: 705 characters for claude-sonnet-5-5
  sonnet-5-5/stay-in-scope: 30 deliveries in 30 sessions, last 2026-11-20T17:37:49.299Z
     models: claude-sonnet-5-5 30
     scopes: routine 30
     places: unattended 30
     events: session-start 30
     text: 446 characters for claude-sonnet-5-5

On in the configuration (every model of the plan with "use": "preset"), never delivered in this log:
  fable-5-2/finish-work for claude-fable-5-2 (scopes: investigate, build; places: subagent)
  fable-5-2/low-context-report for claude-fable-5-2 (scopes: every scope; places: unattended, subagent)
  opus-5-5/unattended-run for claude-opus-5-5 (scopes: every scope; places: unattended)
```

## Each task, model and arm

| Task | Model | Arm | Runs | Finished | Handed back | Tests after last edit | Extra files | Correct | Words per sentence | Semicolons per 1k words | Output tokens | Input tokens | Cost USD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| bug | haiku | carry: haiku-5-5/carry-through | 30 | 30 of 30 | 0 of 30 | 30 of 30 | 0 of 30 | 30 of 30 | 15.3 (12.8 to 17.9) | 0.3 (0.0 to 5.6) | 3,352 (2,530 to 4,591) | 75,034 (54,659 to 109,275) | 0.004 (0.004 to 0.005) |
| bug | haiku | none | 30 | 30 of 30 | 0 of 30 | 29 of 30 | 0 of 30 | 30 of 30 | 15.1 (12.0 to 18.7) | 0.4 (0.0 to 5.6) | 2,615 (1,611 to 4,351) | 76,819 (50,262 to 137,137) | 0.004 (0.003 to 0.006) |
| bug | haiku | pointer: experiment/verify-changes-pointer | 30 | 30 of 30 | 0 of 30 | 30 of 30 | 0 of 30 | 30 of 30 | 15.6 (13.2 to 19.0) | 0.6 (0.0 to 4.7) | 3,438 (2,415 to 6,511) | 90,844 (55,722 to 169,746) | 0.005 (0.003 to 0.007) |
| bug | haiku | rules: haiku-5-5/carry-through, haiku-5-5/verify-changes | 30 | 30 of 30 | 0 of 30 | 30 of 30 | 0 of 30 | 30 of 30 | 15.6 (13.0 to 17.7) | 0.1 (0.0 to 3.7) | 3,692 (2,829 to 5,944) | 84,896 (67,673 to 176,928) | 0.005 (0.004 to 0.007) |
| bug | haiku | verify: haiku-5-5/verify-changes | 30 | 30 of 30 | 0 of 30 | 29 of 30 | 0 of 30 | 30 of 30 | 15.5 (13.0 to 18.6) | 1.7 (0.0 to 7.7) | 3,665 (2,493 to 7,545) | 90,717 (58,290 to 216,796) | 0.005 (0.004 to 0.009) |
| bug | sonnet | carry: sonnet-5-5/carry-through | 30 | 30 of 30 | 0 of 30 | 30 of 30 | 0 of 30 | 30 of 30 | 14.3 (11.1 to 19.2) | 0.0 | 1,631 (916 to 2,415) | 59,448 (35,448 to 104,113) | 0.046 (0.032 to 0.065) |
| bug | sonnet | none | 30 | 30 of 30 | 0 of 30 | 11 of 30 | 0 of 30 | 30 of 30 | 14.9 (12.3 to 19.3) | 0.0 | 1,014 (866 to 1,222) | 38,470 (34,294 to 46,869) | 0.032 (0.029 to 0.036) |
| bug | sonnet | pointer: experiment/verify-changes-pointer | 30 | 29 of 30 | 1 of 30 | 30 of 30 | 0 of 30 | 30 of 30 | 14.5 (12.9 to 16.8) | 0.0 | 1,924 (1,280 to 2,571) | 61,075 (37,111 to 98,851) | 0.052 (0.037 to 0.066) |
| bug | sonnet | rules: sonnet-5-5/carry-through, sonnet-5-5/verify-changes | 30 | 30 of 30 | 0 of 30 | 30 of 30 | 0 of 30 | 30 of 30 | 14.6 (11.9 to 17.8) | 0.0 | 1,809 (1,204 to 2,338) | 66,862 (37,218 to 98,902) | 0.051 (0.037 to 0.064) |
| bug | sonnet | verify: sonnet-5-5/verify-changes | 30 | 30 of 30 | 0 of 30 | 30 of 30 | 0 of 30 | 30 of 30 | 14.6 (11.6 to 17.3) | 0.0 | 1,757 (1,284 to 2,249) | 62,824 (38,516 to 94,083) | 0.049 (0.039 to 0.059) |
| fix | haiku | carry: haiku-5-5/carry-through | 30 | 30 of 30 | 0 of 30 | 0 of 30 | 0 of 30 | 30 of 30 | 12.3 (10.1 to 16.5) | 0.4 (0.0 to 13.3) | 913 (669 to 1,349) | 37,316 (28,555 to 61,532) | 0.002 (0.002 to 0.002) |
| fix | haiku | none | 30 | 30 of 30 | 0 of 30 | 0 of 30 | 0 of 30 | 30 of 30 | 12.2 (9.7 to 16.4) | 0.0 | 701 (671 to 754) | 27,769 (27,736 to 27,818) | 0.001 (0.001 to 0.002) |
| fix | haiku | pointer: experiment/verify-changes-pointer | 30 | 30 of 30 | 0 of 30 | 27 of 30 | 2 of 30 | 30 of 30 | 10.2 (7.8 to 12.9) | 0.8 (0.0 to 8.2) | 2,796 (1,714 to 6,580) | 81,694 (42,210 to 161,400) | 0.004 (0.003 to 0.007) |
| fix | haiku | rules: haiku-5-5/carry-through, haiku-5-5/verify-changes | 30 | 30 of 30 | 0 of 30 | 27 of 30 | 0 of 30 | 30 of 30 | 10.6 (7.7 to 15.1) | 0.3 (0.0 to 8.3) | 2,188 (1,509 to 5,037) | 69,865 (52,542 to 131,914) | 0.003 (0.003 to 0.006) |
| fix | haiku | verify: haiku-5-5/verify-changes | 30 | 30 of 30 | 0 of 30 | 27 of 30 | 1 of 30 | 30 of 30 | 10.1 (7.6 to 13.3) | 1.5 (0.0 to 10.8) | 2,277 (1,183 to 4,610) | 73,325 (39,790 to 141,136) | 0.003 (0.002 to 0.006) |
| fix | sonnet | carry: sonnet-5-5/carry-through | 30 | 30 of 30 | 0 of 30 | 0 of 30 | 0 of 30 | 30 of 30 | 11.3 (8.9 to 14.6) | 0.0 | 688 (661 to 810) | 25,882 (25,855 to 26,151) | 0.025 (0.024 to 0.027) |
| fix | sonnet | none | 30 | 30 of 30 | 0 of 30 | 0 of 30 | 0 of 30 | 30 of 30 | 11.1 (9.0 to 14.2) | 0.0 | 696 (657 to 817) | 25,263 (25,201 to 25,501) | 0.024 (0.023 to 0.026) |
| fix | sonnet | pointer: experiment/verify-changes-pointer | 30 | 30 of 30 | 0 of 30 | 30 of 30 | 0 of 30 | 30 of 30 | 11.0 (8.1 to 13.1) | 0.0 | 1,653 (1,405 to 2,148) | 52,651 (47,745 to 60,757) | 0.044 (0.040 to 0.052) |
| fix | sonnet | rules: sonnet-5-5/carry-through, sonnet-5-5/stay-in-scope, sonnet-5-5/verify-changes | 30 | 30 of 30 | 0 of 30 | 30 of 30 | 0 of 30 | 30 of 30 | 11.2 (9.3 to 13.4) | 0.0 | 1,263 (1,118 to 1,525) | 42,174 (37,845 to 49,062) | 0.038 (0.035 to 0.043) |
| fix | sonnet | verify: sonnet-5-5/verify-changes | 30 | 30 of 30 | 0 of 30 | 29 of 30 | 4 of 30 | 30 of 30 | 10.9 (8.8 to 14.0) | 0.0 | 2,007 (1,498 to 2,945) | 62,717 (47,770 to 97,619) | 0.051 (0.041 to 0.070) |

Numbers are the mean with the range in parentheses. "Correct" is, for the question, the jobs named that ignore a control, of the three that do, and the jobs named wrongly; for the fix, the runs whose change passes the hidden check. Input tokens include the cached ones.

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
| fix | sonnet | rules | Runs finished (deliverable present, work not handed back) | 30 of 30 (89-100%) | 30 of 30 (89-100%) | 1.00 |
| fix | sonnet | rules | Output tokens per run | 1,263 (1,118 to 1,525) | 696 (657 to 817) | < 0.001 |
| fix | sonnet | rules | Difference of the means | +567 output, +16,911 input tokens | +$0.014 per run |  |
| fix | sonnet | rules | Delivered in the same runs | sonnet-5-5/stay-in-scope, sonnet-5-5/verify-changes |  |  |
| fix | sonnet | carry | Runs finished (deliverable present, work not handed back) | 30 of 30 (89-100%) | 30 of 30 (89-100%) | 1.00 |
| fix | sonnet | carry | Output tokens per run | 688 (661 to 810) | 696 (657 to 817) | 0.28 |
| fix | sonnet | carry | Difference of the means | -8 output, +620 input tokens | +$0.001 per run |  |
| fix | sonnet | carry | Delivered in the same runs | no other rule |  |  |
| bug | sonnet | rules | Runs finished (deliverable present, work not handed back) | 30 of 30 (89-100%) | 30 of 30 (89-100%) | 1.00 |
| bug | sonnet | rules | Output tokens per run | 1,809 (1,204 to 2,338) | 1,014 (866 to 1,222) | < 0.001 |
| bug | sonnet | rules | Difference of the means | +796 output, +28,393 input tokens | +$0.019 per run |  |
| bug | sonnet | rules | Delivered in the same runs | sonnet-5-5/verify-changes |  |  |
| bug | sonnet | carry | Runs finished (deliverable present, work not handed back) | 30 of 30 (89-100%) | 30 of 30 (89-100%) | 1.00 |
| bug | sonnet | carry | Output tokens per run | 1,631 (916 to 2,415) | 1,014 (866 to 1,222) | < 0.001 |
| bug | sonnet | carry | Difference of the means | +617 output, +20,978 input tokens | +$0.014 per run |  |
| bug | sonnet | carry | Delivered in the same runs | no other rule |  |  |

### `sonnet-5-5/verify-changes`

| Task | Model | Arm | Signal | With the rule | Without (arm none) | p |
| --- | --- | --- | --- | --- | --- | --- |
| fix | sonnet | rules | Runs that ran the tests after their last edit, of those that edited code | 30 of 30 (89-100%) | 0 of 30 (0-11%) | < 0.001 |
| fix | sonnet | rules | Output tokens per run | 1,263 (1,118 to 1,525) | 696 (657 to 817) | < 0.001 |
| fix | sonnet | rules | Difference of the means | +567 output, +16,911 input tokens | +$0.014 per run |  |
| fix | sonnet | rules | Delivered in the same runs | sonnet-5-5/carry-through, sonnet-5-5/stay-in-scope |  |  |
| fix | sonnet | verify | Runs that ran the tests after their last edit, of those that edited code | 29 of 30 (83-99%) | 0 of 30 (0-11%) | < 0.001 |
| fix | sonnet | verify | Output tokens per run | 2,007 (1,498 to 2,945) | 696 (657 to 817) | < 0.001 |
| fix | sonnet | verify | Difference of the means | +1,311 output, +37,454 input tokens | +$0.027 per run |  |
| fix | sonnet | verify | Delivered in the same runs | no other rule |  |  |
| bug | sonnet | verify | Runs that ran the tests after their last edit, of those that edited code | 30 of 30 (89-100%) | 11 of 30 (22-54%) | < 0.001 |
| bug | sonnet | verify | Output tokens per run | 1,757 (1,284 to 2,249) | 1,014 (866 to 1,222) | < 0.001 |
| bug | sonnet | verify | Difference of the means | +743 output, +24,355 input tokens | +$0.017 per run |  |
| bug | sonnet | verify | Delivered in the same runs | no other rule |  |  |
| bug | sonnet | rules | Runs that ran the tests after their last edit, of those that edited code | 30 of 30 (89-100%) | 11 of 30 (22-54%) | < 0.001 |
| bug | sonnet | rules | Output tokens per run | 1,809 (1,204 to 2,338) | 1,014 (866 to 1,222) | < 0.001 |
| bug | sonnet | rules | Difference of the means | +796 output, +28,393 input tokens | +$0.019 per run |  |
| bug | sonnet | rules | Delivered in the same runs | sonnet-5-5/carry-through |  |  |

### `sonnet-5-5/stay-in-scope`

| Task | Model | Arm | Signal | With the rule | Without (arm none) | p |
| --- | --- | --- | --- | --- | --- | --- |
| fix | sonnet | rules | Runs that changed files beyond the ones asked | 0 of 30 (0-11%) | 0 of 30 (0-11%) | 1.00 |
| fix | sonnet | rules | Output tokens per run | 1,263 (1,118 to 1,525) | 696 (657 to 817) | < 0.001 |
| fix | sonnet | rules | Difference of the means | +567 output, +16,911 input tokens | +$0.014 per run |  |
| fix | sonnet | rules | Delivered in the same runs | sonnet-5-5/carry-through, sonnet-5-5/verify-changes |  |  |

### `haiku-5-5/carry-through`

| Task | Model | Arm | Signal | With the rule | Without (arm none) | p |
| --- | --- | --- | --- | --- | --- | --- |
| fix | haiku | rules | Runs finished (deliverable present, work not handed back) | 30 of 30 (89-100%) | 30 of 30 (89-100%) | 1.00 |
| fix | haiku | rules | Runs that changed files beyond the ones asked | 0 of 30 (0-11%) | 0 of 30 (0-11%) | 1.00 |
| fix | haiku | rules | Output tokens per run | 2,188 (1,509 to 5,037) | 701 (671 to 754) | < 0.001 |
| fix | haiku | rules | Difference of the means | +1,487 output, +42,096 input tokens | +$0.002 per run |  |
| fix | haiku | rules | Delivered in the same runs | haiku-5-5/verify-changes |  |  |
| fix | haiku | carry | Runs finished (deliverable present, work not handed back) | 30 of 30 (89-100%) | 30 of 30 (89-100%) | 1.00 |
| fix | haiku | carry | Runs that changed files beyond the ones asked | 0 of 30 (0-11%) | 0 of 30 (0-11%) | 1.00 |
| fix | haiku | carry | Output tokens per run | 913 (669 to 1,349) | 701 (671 to 754) | < 0.001 |
| fix | haiku | carry | Difference of the means | +212 output, +9,547 input tokens | +$0.000 per run |  |
| fix | haiku | carry | Delivered in the same runs | no other rule |  |  |
| bug | haiku | rules | Runs finished (deliverable present, work not handed back) | 30 of 30 (89-100%) | 30 of 30 (89-100%) | 1.00 |
| bug | haiku | rules | Runs that changed files beyond the ones asked | 0 of 30 (0-11%) | 0 of 30 (0-11%) | 1.00 |
| bug | haiku | rules | Output tokens per run | 3,692 (2,829 to 5,944) | 2,615 (1,611 to 4,351) | < 0.001 |
| bug | haiku | rules | Difference of the means | +1,077 output, +8,077 input tokens | +$0.001 per run |  |
| bug | haiku | rules | Delivered in the same runs | haiku-5-5/verify-changes |  |  |
| bug | haiku | carry | Runs finished (deliverable present, work not handed back) | 30 of 30 (89-100%) | 30 of 30 (89-100%) | 1.00 |
| bug | haiku | carry | Runs that changed files beyond the ones asked | 0 of 30 (0-11%) | 0 of 30 (0-11%) | 1.00 |
| bug | haiku | carry | Output tokens per run | 3,352 (2,530 to 4,591) | 2,615 (1,611 to 4,351) | < 0.001 |
| bug | haiku | carry | Difference of the means | +737 output, -1,785 input tokens | +$0.001 per run |  |
| bug | haiku | carry | Delivered in the same runs | no other rule |  |  |

### `haiku-5-5/verify-changes`

| Task | Model | Arm | Signal | With the rule | Without (arm none) | p |
| --- | --- | --- | --- | --- | --- | --- |
| fix | haiku | rules | Runs that ran the tests after their last edit, of those that edited code | 27 of 30 (74-97%) | 0 of 30 (0-11%) | < 0.001 |
| fix | haiku | rules | Output tokens per run | 2,188 (1,509 to 5,037) | 701 (671 to 754) | < 0.001 |
| fix | haiku | rules | Difference of the means | +1,487 output, +42,096 input tokens | +$0.002 per run |  |
| fix | haiku | rules | Delivered in the same runs | haiku-5-5/carry-through |  |  |
| fix | haiku | verify | Runs that ran the tests after their last edit, of those that edited code | 27 of 30 (74-97%) | 0 of 30 (0-11%) | < 0.001 |
| fix | haiku | verify | Output tokens per run | 2,277 (1,183 to 4,610) | 701 (671 to 754) | < 0.001 |
| fix | haiku | verify | Difference of the means | +1,576 output, +45,556 input tokens | +$0.002 per run |  |
| fix | haiku | verify | Delivered in the same runs | no other rule |  |  |
| bug | haiku | rules | Runs that ran the tests after their last edit, of those that edited code | 30 of 30 (89-100%) | 29 of 30 (83-99%) | 1.00 |
| bug | haiku | rules | Output tokens per run | 3,692 (2,829 to 5,944) | 2,615 (1,611 to 4,351) | < 0.001 |
| bug | haiku | rules | Difference of the means | +1,077 output, +8,077 input tokens | +$0.001 per run |  |
| bug | haiku | rules | Delivered in the same runs | haiku-5-5/carry-through |  |  |
| bug | haiku | verify | Runs that ran the tests after their last edit, of those that edited code | 29 of 30 (83-99%) | 29 of 30 (83-99%) | 1.00 |
| bug | haiku | verify | Output tokens per run | 3,665 (2,493 to 7,545) | 2,615 (1,611 to 4,351) | < 0.001 |
| bug | haiku | verify | Difference of the means | +1,050 output, +13,898 input tokens | +$0.001 per run |  |
| bug | haiku | verify | Delivered in the same runs | no other rule |  |  |

## Pre-registered comparisons

The comparisons the design fixed before it ran, each task apart. p is two-sided; Holm's adjustment runs over all 21, and a comparison supports the rule's source when its adjusted p is below 0.05 and the difference goes the way the source claims. Where the source claims no direction, the reading is the direction found, or "not shown".

| Rule | Task | Arms | Signal | With the rule | Without | p | Holm p | Reading |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `sonnet-5-5/verify-changes` | fix | verify against none | Tests after the last edit (higher claimed) | 29 of 30 (83-99%) | 0 of 30 (0-11%) | < 0.001 | < 0.001 | supports the source |
| `sonnet-5-5/verify-changes` | bug | verify against none | Tests after the last edit (higher claimed) | 30 of 30 (89-100%) | 11 of 30 (22-54%) | < 0.001 | < 0.001 | supports the source |
| `haiku-5-5/verify-changes` | fix | verify against none | Tests after the last edit (higher claimed) | 27 of 30 (74-97%) | 0 of 30 (0-11%) | < 0.001 | < 0.001 | supports the source |
| `sonnet-5-5/carry-through` | fix | carry against none | Tests after the last edit (no direction claimed) | 0 of 30 (0-11%) | 0 of 30 (0-11%) | 1.00 | 1.00 | not shown |
| `sonnet-5-5/carry-through` | bug | carry against none | Tests after the last edit (no direction claimed) | 30 of 30 (89-100%) | 11 of 30 (22-54%) | < 0.001 | < 0.001 | higher |
| `haiku-5-5/carry-through` | fix | carry against none | Tests after the last edit (no direction claimed) | 0 of 30 (0-11%) | 0 of 30 (0-11%) | 1.00 | 1.00 | not shown |
| `sonnet-5-5/verify-changes` | fix | verify against none | Cost per run (higher claimed) | mean $0.0505, median $0.0495 (30 runs) | mean $0.0240, median $0.0237 (30 runs) | < 0.001 | < 0.001 | supports the source |
| `sonnet-5-5/verify-changes` | bug | verify against none | Cost per run (higher claimed) | mean $0.0494, median $0.0490 (30 runs) | mean $0.0321, median $0.0320 (30 runs) | < 0.001 | < 0.001 | supports the source |
| `haiku-5-5/verify-changes` | fix | verify against none | Cost per run (higher claimed) | mean $0.0033, median $0.0031 (30 runs) | mean $0.0015, median $0.0015 (30 runs) | < 0.001 | < 0.001 | supports the source |
| `haiku-5-5/verify-changes` | bug | verify against none | Cost per run (higher claimed) | mean $0.0047, median $0.0047 (30 runs) | mean $0.0037, median $0.0035 (30 runs) | < 0.001 | < 0.001 | supports the source |
| `sonnet-5-5/carry-through` | fix | carry against none | Cost per run (higher claimed) | mean $0.0247, median $0.0246 (30 runs) | mean $0.0240, median $0.0237 (30 runs) | < 0.001 | < 0.001 | supports the source |
| `sonnet-5-5/carry-through` | bug | carry against none | Cost per run (higher claimed) | mean $0.0461, median $0.0487 (30 runs) | mean $0.0321, median $0.0320 (30 runs) | < 0.001 | < 0.001 | supports the source |
| `haiku-5-5/carry-through` | fix | carry against none | Cost per run (no direction claimed) | mean $0.0018, median $0.0018 (30 runs) | mean $0.0015, median $0.0015 (30 runs) | < 0.001 | < 0.001 | higher |
| `haiku-5-5/carry-through` | bug | carry against none | Cost per run (no direction claimed) | mean $0.0043, median $0.0042 (30 runs) | mean $0.0037, median $0.0035 (30 runs) | < 0.001 | 0.001 | higher |
| `sonnet-5-5/verify-changes` | fix | pointer against verify | Tests after the last edit (no direction claimed) | 30 of 30 (89-100%) | 29 of 30 (83-99%) | 1.00 | 1.00 | not shown |
| `sonnet-5-5/verify-changes` | bug | pointer against verify | Tests after the last edit (no direction claimed) | 30 of 30 (89-100%) | 30 of 30 (89-100%) | 1.00 | 1.00 | not shown |
| `haiku-5-5/verify-changes` | fix | pointer against verify | Tests after the last edit (no direction claimed) | 27 of 30 (74-97%) | 27 of 30 (74-97%) | 1.00 | 1.00 | not shown |
| `sonnet-5-5/verify-changes` | fix | pointer against verify | Cost per run (no direction claimed) | mean $0.0440, median $0.0417 (30 runs) | mean $0.0505, median $0.0495 (30 runs) | < 0.001 | < 0.001 | lower |
| `sonnet-5-5/verify-changes` | bug | pointer against verify | Cost per run (no direction claimed) | mean $0.0515, median $0.0531 (30 runs) | mean $0.0494, median $0.0490 (30 runs) | 0.22 | 1.00 | not shown |
| `haiku-5-5/verify-changes` | fix | pointer against verify | Cost per run (no direction claimed) | mean $0.0038, median $0.0035 (30 runs) | mean $0.0033, median $0.0031 (30 runs) | 0.010 | 0.08 | not shown |
| `haiku-5-5/verify-changes` | bug | pointer against verify | Cost per run (no direction claimed) | mean $0.0045, median $0.0044 (30 runs) | mean $0.0047, median $0.0047 (30 runs) | 0.33 | 1.00 | not shown |

## Each arm against none

Descriptive, beside the comparisons above: for each arm, the tests after the last edit and the mean cost per run, each with its difference from the arm `none` and, for an arm with fewer rules than `rules`, that difference as a part of the difference of the arm `rules`. Parts need not add up to 100%: rules can overlap or add to each other, and chance moves every mean.

| Model | Task | Arm | Rules delivered | Runs | Tests after last edit | Against none | Part of rules | Cost per run | Against none | Part of rules | Turns per run |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sonnet | fix | rules | sonnet-5-5/carry-through, sonnet-5-5/stay-in-scope, sonnet-5-5/verify-changes | 30 | 30 of 30 (89-100%) | +100 points |  | $0.0378 | +$0.0139 |  | 6.5 |
| sonnet | fix | verify | sonnet-5-5/verify-changes | 30 | 29 of 30 (83-99%) | +97 points | 97% | $0.0505 | +$0.0265 | 191% | 9.4 |
| sonnet | fix | pointer | experiment/verify-changes-pointer | 30 | 30 of 30 (89-100%) | +100 points | 100% | $0.0440 | +$0.0201 | 145% | 8.6 |
| sonnet | fix | carry | sonnet-5-5/carry-through | 30 | 0 of 30 (0-11%) | +0 points | 0% | $0.0247 | +$0.0007 | 5% | 4.0 |
| sonnet | fix | none | none | 30 | 0 of 30 (0-11%) |  |  | $0.0240 |  |  | 4.1 |
| sonnet | bug | rules | sonnet-5-5/carry-through, sonnet-5-5/verify-changes | 30 | 30 of 30 (89-100%) | +63 points |  | $0.0513 | +$0.0192 |  | 10.4 |
| sonnet | bug | verify | sonnet-5-5/verify-changes | 30 | 30 of 30 (89-100%) | +63 points | 100% | $0.0494 | +$0.0173 | 90% | 10.2 |
| sonnet | bug | pointer | experiment/verify-changes-pointer | 30 | 30 of 30 (89-100%) | +63 points | 100% | $0.0515 | +$0.0194 | 101% | 11.0 |
| sonnet | bug | carry | sonnet-5-5/carry-through | 30 | 30 of 30 (89-100%) | +63 points | 100% | $0.0461 | +$0.0140 | 73% | 9.4 |
| sonnet | bug | none | none | 30 | 11 of 30 (22-54%) |  |  | $0.0321 |  |  | 6.3 |
| haiku | fix | rules | haiku-5-5/carry-through, haiku-5-5/verify-changes | 30 | 27 of 30 (74-97%) | +90 points |  | $0.0033 | +$0.0018 |  | 8.4 |
| haiku | fix | verify | haiku-5-5/verify-changes | 30 | 27 of 30 (74-97%) | +90 points | 100% | $0.0033 | +$0.0018 | 104% | 8.9 |
| haiku | fix | pointer | experiment/verify-changes-pointer | 30 | 27 of 30 (74-97%) | +90 points | 100% | $0.0038 | +$0.0023 | 131% | 10.5 |
| haiku | fix | carry | haiku-5-5/carry-through | 30 | 0 of 30 (0-11%) | +0 points | 0% | $0.0018 | +$0.0003 | 18% | 4.8 |
| haiku | fix | none | none | 30 | 0 of 30 (0-11%) |  |  | $0.0015 |  |  | 4.0 |
| haiku | bug | rules | haiku-5-5/carry-through, haiku-5-5/verify-changes | 30 | 30 of 30 (89-100%) | +3 points |  | $0.0047 | +$0.0010 |  | 15.5 |
| haiku | bug | verify | haiku-5-5/verify-changes | 30 | 29 of 30 (83-99%) | +0 points | 0% | $0.0047 | +$0.0010 | 99% | 14.5 |
| haiku | bug | pointer | experiment/verify-changes-pointer | 30 | 30 of 30 (89-100%) | +3 points | 100% | $0.0045 | +$0.0009 | 83% | 12.0 |
| haiku | bug | carry | haiku-5-5/carry-through | 30 | 30 of 30 (89-100%) | +3 points | 100% | $0.0043 | +$0.0006 | 59% | 14.3 |
| haiku | bug | none | none | 30 | 29 of 30 (83-99%) |  |  | $0.0037 |  |  | 10.2 |

## The pointer arm: reading the rule file

The runs that received a rule as a pointer to a file holding its text: whether the session read that file (with Read, Grep or a Bash command naming it), whether the read came before its first edit of code, and at which tool call the first read came.

| Model | Task | Arm | Runs | Read the file | Read before the first edit, of those that read it | First read at tool call (median, range) | Tried and refused, never read | Tests after last edit | Tests after last edit, of those that read it |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sonnet | fix | pointer | 30 | 30 of 30 (89-100%) | 30 of 30 | 1 (1 to 1) | 0 | 30 of 30 (89-100%) | 30 of 30 (89-100%) |
| haiku | fix | pointer | 30 | 30 of 30 (89-100%) | 30 of 30 | 1 (1 to 1) | 0 | 27 of 30 (74-97%) | 27 of 30 (74-97%) |
| sonnet | bug | pointer | 30 | 30 of 30 (89-100%) | 30 of 30 | 1 (1 to 1) | 0 | 30 of 30 (89-100%) | 30 of 30 (89-100%) |
| haiku | bug | pointer | 30 | 30 of 30 (89-100%) | 30 of 30 | 1 (1 to 2) | 0 | 30 of 30 (89-100%) | 30 of 30 (89-100%) |

## Cost against the projection

| Model | Task | Runs | Expected per run | Measured per run | Measured |
| --- | --- | --- | --- | --- | --- |
| sonnet | fix | 150 | $0.038 | $0.036 | $5.43 |
| sonnet | bug | 150 | $0.051 | $0.046 | $6.91 |
| haiku | fix | 150 | $0.0034 | $0.0027 | $0.41 |
| haiku | bug | 150 | $0.0046 | $0.0044 | $0.65 |

Measured: $13.41 for the recorded runs, against $14.55 expected for the same runs and a cap of $25.

