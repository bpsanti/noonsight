# Rule effect experiment: summary

540 runs, Claude Code 2.1.328, effort medium, 2026-11-19 to 2026-11-20; $73.82 spent in total, as Claude Code reports cost.
A share comes with its Wilson 95% interval, and p is two-sided: Fisher's exact test for a share, the Mann-Whitney U test for a measure. With few runs per arm, a difference is a direction to look at again, not a measured effect.

## What noonsight delivered

From the decision log of every run, as `noonsight report --log decisions.jsonl` prints it, against a configuration that declares every model of the plan with the preset:

```text
540 decisions, from 2026-11-19T22:17:20.888Z to 2026-11-20T00:07:30.248Z
  delivered rules: 270 (session-start 270)
  delivered no rules: 270 (declared-none 270)

Rules delivered, most often first:
  fable-5-2/low-context-report: 90 deliveries in 90 sessions, last 2026-11-20T00:05:59.376Z
     models: claude-fable-5-2 90
     scopes: build 60, investigate 30
     places: unattended 90
     events: session-start 90
     text: 594 characters for claude-fable-5-2
  haiku-5-5/carry-through: 90 deliveries in 90 sessions, last 2026-11-20T00:07:16.749Z
     models: claude-haiku-5-5 90
     scopes: build 60, routine 30
     places: unattended 90
     events: session-start 90
     text: 580 characters for claude-haiku-5-5
  haiku-5-5/verify-changes: 90 deliveries in 90 sessions, last 2026-11-20T00:07:16.749Z
     models: claude-haiku-5-5 90
     scopes: build 60, routine 30
     places: unattended 90
     events: session-start 90
     text: 705 characters for claude-haiku-5-5
  sonnet-5-5/carry-through: 90 deliveries in 90 sessions, last 2026-11-20T00:06:46.300Z
     models: claude-sonnet-5-5 90
     scopes: build 60, routine 30
     places: unattended 90
     events: session-start 90
     text: 360 characters for claude-sonnet-5-5
  sonnet-5-5/verify-changes: 90 deliveries in 90 sessions, last 2026-11-20T00:06:46.300Z
     models: claude-sonnet-5-5 90
     scopes: build 60, routine 30
     places: unattended 90
     events: session-start 90
     text: 705 characters for claude-sonnet-5-5
  sonnet-5-5/stay-in-scope: 30 deliveries in 30 sessions, last 2026-11-20T00:04:40.094Z
     models: claude-sonnet-5-5 30
     scopes: routine 30
     places: unattended 30
     events: session-start 30
     text: 446 characters for claude-sonnet-5-5

On in the configuration (every model of the plan with "use": "preset"), never delivered in this log:
  fable-5-2/finish-work for claude-fable-5-2 (scopes: investigate, build; places: subagent)
  opus-5-5/unattended-run for claude-opus-5-5 (scopes: every scope; places: unattended)
```

## Each task, model and arm

| Task | Model | Arm | Runs | Finished | Handed back | Tests after last edit | Extra files | Correct | Words per sentence | Semicolons per 1k words | Output tokens | Input tokens | Cost USD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| bug | fable | none | 30 | 30 of 30 | 0 of 30 | 30 of 30 | 0 of 30 | 30 of 30 | 20.1 (15.4 to 27.7) | 4.2 (0.0 to 12.3) | 1,697 (1,310 to 2,332) | 55,655 (52,201 to 64,953) | 0.201 (0.175 to 0.242) |
| bug | fable | rules: fable-5-2/low-context-report | 30 | 30 of 30 | 0 of 30 | 30 of 30 | 0 of 30 | 30 of 30 | 17.8 (15.0 to 19.8) | 0.7 (0.0 to 4.9) | 1,745 (1,302 to 2,655) | 56,515 (53,472 to 68,771) | 0.206 (0.178 to 0.263) |
| bug | haiku | none | 30 | 30 of 30 | 0 of 30 | 30 of 30 | 0 of 30 | 30 of 30 | 15.1 (12.5 to 19.7) | 0.2 (0.0 to 5.1) | 2,723 (2,075 to 3,879) | 75,162 (51,559 to 103,468) | 0.004 (0.003 to 0.005) |
| bug | haiku | rules: haiku-5-5/carry-through, haiku-5-5/verify-changes | 30 | 30 of 30 | 0 of 30 | 30 of 30 | 0 of 30 | 30 of 30 | 15.6 (12.5 to 18.8) | 0.1 (0.0 to 4.4) | 3,549 (2,619 to 4,804) | 84,266 (58,509 to 121,473) | 0.005 (0.004 to 0.006) |
| bug | sonnet | none | 30 | 30 of 30 | 0 of 30 | 15 of 30 | 0 of 30 | 30 of 30 | 15.0 (12.4 to 17.7) | 0.0 | 1,034 (904 to 1,151) | 36,964 (34,319 to 44,139) | 0.032 (0.030 to 0.034) |
| bug | sonnet | rules: sonnet-5-5/carry-through, sonnet-5-5/verify-changes | 30 | 30 of 30 | 0 of 30 | 30 of 30 | 0 of 30 | 30 of 30 | 14.7 (11.4 to 19.0) | 0.0 | 1,798 (1,492 to 2,327) | 65,708 (38,427 to 97,168) | 0.051 (0.043 to 0.062) |
| feature | fable | none | 30 | 30 of 30 | 0 of 30 | 30 of 30 | 0 of 30 | 30 of 30 | 16.2 (13.2 to 22.1) | 3.3 (0.0 to 12.4) | 7,415 (4,801 to 11,670) | 91,294 (58,383 to 129,695) | 0.546 (0.390 to 0.790) |
| feature | fable | rules: fable-5-2/low-context-report | 30 | 30 of 30 | 0 of 30 | 30 of 30 | 0 of 30 | 30 of 30 | 12.2 (10.0 to 15.1) | 0.0 | 5,927 (5,013 to 9,560) | 77,378 (60,263 to 124,424) | 0.464 (0.411 to 0.674) |
| feature | haiku | none | 30 | 30 of 30 | 0 of 30 | 29 of 30 | 0 of 30 | 30 of 30 | 12.0 (10.0 to 14.9) | 1.5 (0.0 to 10.1) | 6,365 (5,438 to 7,785) | 109,369 (73,225 to 168,038) | 0.007 (0.006 to 0.009) |
| feature | haiku | rules: haiku-5-5/carry-through, haiku-5-5/verify-changes | 30 | 30 of 30 | 0 of 30 | 29 of 30 | 0 of 30 | 30 of 30 | 11.5 (9.0 to 13.9) | 1.6 (0.0 to 9.6) | 6,895 (6,086 to 8,255) | 127,255 (96,066 to 170,298) | 0.007 (0.007 to 0.009) |
| feature | sonnet | none | 30 | 30 of 30 | 0 of 30 | 30 of 30 | 0 of 30 | 30 of 30 | 13.6 (11.2 to 17.0) | 0.4 (0.0 to 6.0) | 6,749 (4,652 to 9,773) | 98,827 (65,437 to 147,095) | 0.127 (0.096 to 0.173) |
| feature | sonnet | rules: sonnet-5-5/carry-through, sonnet-5-5/verify-changes | 30 | 30 of 30 | 0 of 30 | 30 of 30 | 0 of 30 | 30 of 30 | 14.1 (12.3 to 16.4) | 0.5 (0.0 to 5.6) | 6,978 (4,879 to 9,010) | 120,698 (83,733 to 167,677) | 0.135 (0.102 to 0.170) |
| fix | haiku | none | 30 | 30 of 30 | 0 of 30 | 0 of 30 | 0 of 30 | 30 of 30 | 12.0 (9.5 to 14.0) | 0.0 | 694 (663 to 741) | 27,769 (27,736 to 27,810) | 0.001 (0.001 to 0.002) |
| fix | haiku | rules: haiku-5-5/carry-through, haiku-5-5/verify-changes | 30 | 30 of 30 | 0 of 30 | 27 of 30 | 1 of 30 | 30 of 30 | 10.5 (8.4 to 13.4) | 2.4 (0.0 to 24.8) | 2,328 (1,580 to 5,012) | 72,728 (52,788 to 177,593) | 0.003 (0.003 to 0.006) |
| fix | sonnet | none | 30 | 30 of 30 | 0 of 30 | 0 of 30 | 0 of 30 | 30 of 30 | 10.5 (8.3 to 13.0) | 0.0 | 680 (639 to 791) | 25,245 (25,219 to 25,532) | 0.024 (0.023 to 0.026) |
| fix | sonnet | rules: sonnet-5-5/carry-through, sonnet-5-5/stay-in-scope, sonnet-5-5/verify-changes | 30 | 30 of 30 | 0 of 30 | 30 of 30 | 0 of 30 | 30 of 30 | 11.9 (9.7 to 14.7) | 0.0 | 1,257 (966 to 1,584) | 42,777 (37,583 to 48,902) | 0.038 (0.033 to 0.043) |
| question | fable | none | 30 | 30 of 30 | 0 of 30 | n/a | 0 of 30 | 3.0 of 3, 0.0 wrong | 16.4 (11.9 to 19.6) | 13.0 (0.0 to 26.9) | 2,873 (2,301 to 3,432) | 70,701 (58,737 to 76,773) | 0.301 (0.262 to 0.323) |
| question | fable | rules: fable-5-2/low-context-report | 30 | 30 of 30 | 0 of 30 | n/a | 0 of 30 | 3.0 of 3, 0.0 wrong | 12.3 (10.7 to 14.7) | 2.5 (0.0 to 9.6) | 3,171 (2,548 to 4,520) | 75,653 (60,212 to 93,948) | 0.309 (0.260 to 0.378) |

Numbers are the mean with the range in parentheses. "Correct" is, for the question, the jobs named that ignore a control, of the three that do, and the jobs named wrongly; for the fix, the runs whose change passes the hidden check. Input tokens include the cached ones.

## Each rule

### `fable-5-2/low-context-report`

| Task | Model | Signal | With the rule | Without | p |
| --- | --- | --- | --- | --- | --- |
| question | fable | Words per sentence in the report | 12.3 (10.7 to 14.7) | 16.4 (11.9 to 19.6) | < 0.001 |
| question | fable | Semicolons per 1,000 words in the report | 2.5 (0.0 to 9.6) | 13.0 (0.0 to 26.9) | < 0.001 |
| question | fable | Parentheses per 1,000 words in the report | 30.5 (15.5 to 51.0) | 45.6 (32.1 to 63.2) | < 0.001 |
| question | fable | Output tokens per run | 3,171 (2,548 to 4,520) | 2,873 (2,301 to 3,432) | 0.008 |
| question | fable | Difference of the means | +298 output, +4,953 input tokens | +$0.008 per run |  |
| bug | fable | Words per sentence in the report | 17.8 (15.0 to 19.8) | 20.1 (15.4 to 27.7) | 0.002 |
| bug | fable | Semicolons per 1,000 words in the report | 0.7 (0.0 to 4.9) | 4.2 (0.0 to 12.3) | < 0.001 |
| bug | fable | Parentheses per 1,000 words in the report | 4.1 (0.0 to 8.9) | 13.7 (5.3 to 24.4) | < 0.001 |
| bug | fable | Output tokens per run | 1,745 (1,302 to 2,655) | 1,697 (1,310 to 2,332) | 0.14 |
| bug | fable | Difference of the means | +48 output, +860 input tokens | +$0.005 per run |  |
| feature | fable | Words per sentence in the report | 12.2 (10.0 to 15.1) | 16.2 (13.2 to 22.1) | < 0.001 |
| feature | fable | Semicolons per 1,000 words in the report | 0.0 | 3.3 (0.0 to 12.4) | < 0.001 |
| feature | fable | Parentheses per 1,000 words in the report | 2.1 (0.0 to 17.6) | 15.3 (4.8 to 37.3) | < 0.001 |
| feature | fable | Output tokens per run | 5,927 (5,013 to 9,560) | 7,415 (4,801 to 11,670) | 0.04 |
| feature | fable | Difference of the means | -1,488 output, -13,916 input tokens | -$0.082 per run |  |

### `fable-5-2/finish-work`

Not delivered in any run of this experiment, so not measured.

### `opus-5-5/unattended-run`

Not delivered in any run of this experiment, so not measured.

### `sonnet-5-5/carry-through`

| Task | Model | Signal | With the rule | Without | p |
| --- | --- | --- | --- | --- | --- |
| fix | sonnet | Runs finished (deliverable present, work not handed back) | 30 of 30 (89-100%) | 30 of 30 (89-100%) | 1.00 |
| fix | sonnet | Output tokens per run | 1,257 (966 to 1,584) | 680 (639 to 791) | < 0.001 |
| fix | sonnet | Difference of the means | +577 output, +17,532 input tokens | +$0.014 per run |  |
| fix | sonnet | Delivered in the same runs | sonnet-5-5/stay-in-scope, sonnet-5-5/verify-changes |  |  |
| bug | sonnet | Runs finished (deliverable present, work not handed back) | 30 of 30 (89-100%) | 30 of 30 (89-100%) | 1.00 |
| bug | sonnet | Output tokens per run | 1,798 (1,492 to 2,327) | 1,034 (904 to 1,151) | < 0.001 |
| bug | sonnet | Difference of the means | +764 output, +28,744 input tokens | +$0.019 per run |  |
| bug | sonnet | Delivered in the same runs | sonnet-5-5/verify-changes |  |  |
| feature | sonnet | Runs finished (deliverable present, work not handed back) | 30 of 30 (89-100%) | 30 of 30 (89-100%) | 1.00 |
| feature | sonnet | Output tokens per run | 6,978 (4,879 to 9,010) | 6,749 (4,652 to 9,773) | 0.25 |
| feature | sonnet | Difference of the means | +229 output, +21,871 input tokens | +$0.009 per run |  |
| feature | sonnet | Delivered in the same runs | sonnet-5-5/verify-changes |  |  |

### `sonnet-5-5/verify-changes`

| Task | Model | Signal | With the rule | Without | p |
| --- | --- | --- | --- | --- | --- |
| fix | sonnet | Runs that ran the tests after their last edit, of those that edited code | 30 of 30 (89-100%) | 0 of 30 (0-11%) | < 0.001 |
| fix | sonnet | Output tokens per run | 1,257 (966 to 1,584) | 680 (639 to 791) | < 0.001 |
| fix | sonnet | Difference of the means | +577 output, +17,532 input tokens | +$0.014 per run |  |
| fix | sonnet | Delivered in the same runs | sonnet-5-5/carry-through, sonnet-5-5/stay-in-scope |  |  |
| bug | sonnet | Runs that ran the tests after their last edit, of those that edited code | 30 of 30 (89-100%) | 15 of 30 (33-67%) | < 0.001 |
| bug | sonnet | Output tokens per run | 1,798 (1,492 to 2,327) | 1,034 (904 to 1,151) | < 0.001 |
| bug | sonnet | Difference of the means | +764 output, +28,744 input tokens | +$0.019 per run |  |
| bug | sonnet | Delivered in the same runs | sonnet-5-5/carry-through |  |  |
| feature | sonnet | Runs that ran the tests after their last edit, of those that edited code | 30 of 30 (89-100%) | 30 of 30 (89-100%) | 1.00 |
| feature | sonnet | Output tokens per run | 6,978 (4,879 to 9,010) | 6,749 (4,652 to 9,773) | 0.25 |
| feature | sonnet | Difference of the means | +229 output, +21,871 input tokens | +$0.009 per run |  |
| feature | sonnet | Delivered in the same runs | sonnet-5-5/carry-through |  |  |

### `sonnet-5-5/stay-in-scope`

| Task | Model | Signal | With the rule | Without | p |
| --- | --- | --- | --- | --- | --- |
| fix | sonnet | Runs that changed files beyond the ones asked | 0 of 30 (0-11%) | 0 of 30 (0-11%) | 1.00 |
| fix | sonnet | Output tokens per run | 1,257 (966 to 1,584) | 680 (639 to 791) | < 0.001 |
| fix | sonnet | Difference of the means | +577 output, +17,532 input tokens | +$0.014 per run |  |
| fix | sonnet | Delivered in the same runs | sonnet-5-5/carry-through, sonnet-5-5/verify-changes |  |  |

### `haiku-5-5/carry-through`

| Task | Model | Signal | With the rule | Without | p |
| --- | --- | --- | --- | --- | --- |
| fix | haiku | Runs finished (deliverable present, work not handed back) | 30 of 30 (89-100%) | 30 of 30 (89-100%) | 1.00 |
| fix | haiku | Runs that changed files beyond the ones asked | 1 of 30 (1-17%) | 0 of 30 (0-11%) | 1.00 |
| fix | haiku | Output tokens per run | 2,328 (1,580 to 5,012) | 694 (663 to 741) | < 0.001 |
| fix | haiku | Difference of the means | +1,634 output, +44,959 input tokens | +$0.002 per run |  |
| fix | haiku | Delivered in the same runs | haiku-5-5/verify-changes |  |  |
| bug | haiku | Runs finished (deliverable present, work not handed back) | 30 of 30 (89-100%) | 30 of 30 (89-100%) | 1.00 |
| bug | haiku | Runs that changed files beyond the ones asked | 0 of 30 (0-11%) | 0 of 30 (0-11%) | 1.00 |
| bug | haiku | Output tokens per run | 3,549 (2,619 to 4,804) | 2,723 (2,075 to 3,879) | < 0.001 |
| bug | haiku | Difference of the means | +826 output, +9,105 input tokens | +$0.001 per run |  |
| bug | haiku | Delivered in the same runs | haiku-5-5/verify-changes |  |  |
| feature | haiku | Runs finished (deliverable present, work not handed back) | 30 of 30 (89-100%) | 30 of 30 (89-100%) | 1.00 |
| feature | haiku | Runs that changed files beyond the ones asked | 0 of 30 (0-11%) | 0 of 30 (0-11%) | 1.00 |
| feature | haiku | Output tokens per run | 6,895 (6,086 to 8,255) | 6,365 (5,438 to 7,785) | < 0.001 |
| feature | haiku | Difference of the means | +530 output, +17,885 input tokens | +$0.001 per run |  |
| feature | haiku | Delivered in the same runs | haiku-5-5/verify-changes |  |  |

### `haiku-5-5/verify-changes`

| Task | Model | Signal | With the rule | Without | p |
| --- | --- | --- | --- | --- | --- |
| fix | haiku | Runs that ran the tests after their last edit, of those that edited code | 27 of 30 (74-97%) | 0 of 30 (0-11%) | < 0.001 |
| fix | haiku | Output tokens per run | 2,328 (1,580 to 5,012) | 694 (663 to 741) | < 0.001 |
| fix | haiku | Difference of the means | +1,634 output, +44,959 input tokens | +$0.002 per run |  |
| fix | haiku | Delivered in the same runs | haiku-5-5/carry-through |  |  |
| bug | haiku | Runs that ran the tests after their last edit, of those that edited code | 30 of 30 (89-100%) | 30 of 30 (89-100%) | 1.00 |
| bug | haiku | Output tokens per run | 3,549 (2,619 to 4,804) | 2,723 (2,075 to 3,879) | < 0.001 |
| bug | haiku | Difference of the means | +826 output, +9,105 input tokens | +$0.001 per run |  |
| bug | haiku | Delivered in the same runs | haiku-5-5/carry-through |  |  |
| feature | haiku | Runs that ran the tests after their last edit, of those that edited code | 29 of 30 (83-99%) | 29 of 30 (83-99%) | 1.00 |
| feature | haiku | Output tokens per run | 6,895 (6,086 to 8,255) | 6,365 (5,438 to 7,785) | < 0.001 |
| feature | haiku | Difference of the means | +530 output, +17,885 input tokens | +$0.001 per run |  |
| feature | haiku | Delivered in the same runs | haiku-5-5/carry-through |  |  |

## Pre-registered comparisons

The comparisons the design fixed before it ran, each task apart. p is two-sided; Holm's adjustment runs over all 12, and a comparison supports the rule's source when its adjusted p is below 0.05 and the difference goes the way the source claims.

| Rule | Task | Signal | With the rule | Without | p | Holm p | Reading |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `sonnet-5-5/verify-changes` | fix | Tests after the last edit (higher claimed) | 30 of 30 (89-100%) | 0 of 30 (0-11%) | < 0.001 | < 0.001 | supports the source |
| `sonnet-5-5/verify-changes` | bug | Tests after the last edit (higher claimed) | 30 of 30 (89-100%) | 15 of 30 (33-67%) | < 0.001 | < 0.001 | supports the source |
| `sonnet-5-5/verify-changes` | feature | Tests after the last edit (higher claimed) | 30 of 30 (89-100%) | 30 of 30 (89-100%) | 1.00 | 1.00 | not shown |
| `haiku-5-5/verify-changes` | fix | Tests after the last edit (higher claimed) | 27 of 30 (74-97%) | 0 of 30 (0-11%) | < 0.001 | < 0.001 | supports the source |
| `haiku-5-5/verify-changes` | bug | Tests after the last edit (higher claimed) | 30 of 30 (89-100%) | 30 of 30 (89-100%) | 1.00 | 1.00 | not shown |
| `haiku-5-5/verify-changes` | feature | Tests after the last edit (higher claimed) | 29 of 30 (83-99%) | 29 of 30 (83-99%) | 1.00 | 1.00 | not shown |
| `fable-5-2/low-context-report` | question | Words per sentence (lower claimed) | mean 12.3, median 12.4 (30 runs) | mean 16.4, median 16.6 (30 runs) | < 0.001 | < 0.001 | supports the source |
| `fable-5-2/low-context-report` | bug | Words per sentence (lower claimed) | mean 17.8, median 17.8 (30 runs) | mean 20.1, median 19.4 (30 runs) | 0.002 | 0.006 | supports the source |
| `fable-5-2/low-context-report` | feature | Words per sentence (lower claimed) | mean 12.2, median 11.6 (30 runs) | mean 16.2, median 15.9 (30 runs) | < 0.001 | < 0.001 | supports the source |
| `fable-5-2/low-context-report` | question | Semicolons per 1,000 words (lower claimed) | mean 2.5, median 1.4 (30 runs) | mean 13.0, median 13.1 (30 runs) | < 0.001 | < 0.001 | supports the source |
| `fable-5-2/low-context-report` | bug | Semicolons per 1,000 words (lower claimed) | mean 0.7, median 0.0 (30 runs) | mean 4.2, median 6.0 (30 runs) | < 0.001 | < 0.001 | supports the source |
| `fable-5-2/low-context-report` | feature | Semicolons per 1,000 words (lower claimed) | mean 0.0, median 0.0 (30 runs) | mean 3.3, median 0.0 (30 runs) | < 0.001 | < 0.001 | supports the source |

## Cost against the projection

| Model | Task | Runs | Expected per run | Measured per run | Measured |
| --- | --- | --- | --- | --- | --- |
| fable | question | 60 | $0.300 | $0.305 | $18.28 |
| fable | bug | 60 | $0.360 | $0.203 | $12.20 |
| fable | feature | 60 | $0.460 | $0.505 | $30.32 |
| sonnet | fix | 60 | $0.032 | $0.031 | $1.84 |
| sonnet | bug | 60 | $0.061 | $0.042 | $2.50 |
| sonnet | feature | 60 | $0.077 | $0.131 | $7.85 |
| haiku | fix | 60 | $0.002 | $0.002 | $0.15 |
| haiku | bug | 60 | $0.005 | $0.004 | $0.25 |
| haiku | feature | 60 | $0.006 | $0.007 | $0.43 |

Measured: $73.82 for the recorded runs, against $78.18 expected for the same runs and a cap of $120.

