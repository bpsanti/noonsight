# Rule effect experiment: summary

112 runs, Claude Code 2.1.326, effort medium, 2026-11-16; $7.57 spent in total, as Claude Code reports cost.
With a few runs per arm, every difference below is a direction to look at again, not a measured effect.

## What noonsight delivered

From the decision log of every run, as `noonsight report --log decisions.jsonl` prints it, against a configuration that declares every model of the plan with the preset:

```text
112 decisions, from 2026-11-16T22:51:24.984Z to 2026-11-16T23:01:28.248Z
  delivered rules: 56 (session-start 56)
  delivered no rules: 56 (declared-none 56)

Rules delivered, most often first:
  haiku-5-5/carry-through: 20 deliveries in 20 sessions, last 2026-11-16T22:58:52.720Z
     models: claude-haiku-5-5 20
     scopes: investigate 10, routine 10
     places: unattended 20
     events: session-start 20
     text: 375 characters for claude-haiku-5-5
  haiku-5-5/verify-changes: 20 deliveries in 20 sessions, last 2026-11-16T22:58:52.720Z
     models: claude-haiku-5-5 20
     scopes: investigate 10, routine 10
     places: unattended 20
     events: session-start 20
     text: 705 characters for claude-haiku-5-5
  sonnet-5-5/carry-through: 20 deliveries in 20 sessions, last 2026-11-16T22:58:40.929Z
     models: claude-sonnet-5-5 20
     scopes: investigate 10, routine 10
     places: unattended 20
     events: session-start 20
     text: 360 characters for claude-sonnet-5-5
  sonnet-5-5/verify-changes: 20 deliveries in 20 sessions, last 2026-11-16T22:58:40.929Z
     models: claude-sonnet-5-5 20
     scopes: investigate 10, routine 10
     places: unattended 20
     events: session-start 20
     text: 705 characters for claude-sonnet-5-5
  fable-5-2/low-context-report: 10 deliveries in 10 sessions, last 2026-11-16T22:54:54.759Z
     models: claude-fable-5-2 10
     scopes: investigate 5, routine 5
     places: unattended 10
     events: session-start 10
     text: 594 characters for claude-fable-5-2
  sonnet-5-5/stay-in-scope: 10 deliveries in 10 sessions, last 2026-11-16T22:58:40.929Z
     models: claude-sonnet-5-5 10
     scopes: routine 10
     places: unattended 10
     events: session-start 10
     text: 241 characters for claude-sonnet-5-5
  opus-5-5/unattended-run: 6 deliveries in 6 sessions, last 2026-11-16T23:00:14.465Z
     models: claude-opus-5-5 6
     scopes: investigate 3, routine 3
     places: unattended 6
     events: session-start 6
     text: 921 characters for claude-opus-5-5

On in the configuration (every model of the plan with "use": "preset"), never delivered in this log:
  fable-5-2/finish-work for claude-fable-5-2 (scopes: investigate, build; places: subagent)
```

## Each task, model and arm

| Task | Model | Arm | Runs | Finished | Handed back | Tests after last edit | Extra files | Correct | Words per sentence | Semicolons per 1k words | Output tokens | Input tokens | Cost USD |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| fix | fable | none | 5 | 5 of 5 | 0 of 5 | 5 of 5 | 0 of 5 | 5 of 5 | 18.7 (16.5 to 20.3) | 4.2 (0.0 to 12.3) | 1,335 (1,126 to 1,695) | 46,116 (40,559 to 54,102) | 0.169 (0.153 to 0.194) |
| fix | fable | rules: fable-5-2/low-context-report | 5 | 5 of 5 | 0 of 5 | 5 of 5 | 0 of 5 | 5 of 5 | 15.6 (13.7 to 18.6) | 0.0 | 1,186 (1,083 to 1,532) | 44,190 (41,451 to 54,428) | 0.161 (0.154 to 0.188) |
| fix | haiku | none | 10 | 10 of 10 | 0 of 10 | 0 of 10 | 0 of 10 | 10 of 10 | 11.3 (9.8 to 13.5) | 1.4 (0.0 to 13.9) | 681 (651 to 731) | 27,574 (27,553 to 27,606) | 0.001 (0.001 to 0.002) |
| fix | haiku | rules: haiku-5-5/carry-through, haiku-5-5/verify-changes | 10 | 10 of 10 | 0 of 10 | 8 of 10 | 0 of 10 | 10 of 10 | 10.7 (8.9 to 12.4) | 0.9 (0.0 to 8.9) | 2,089 (1,614 to 3,621) | 69,789 (52,129 to 119,417) | 0.003 (0.003 to 0.005) |
| fix | opus | none | 3 | 3 of 3 | 0 of 3 | 3 of 3 | 0 of 3 | 3 of 3 | 12.2 (12.0 to 12.4) | 5.3 (0.0 to 9.1) | 1,186 (1,013 to 1,295) | 35,345 (35,130 to 35,473) | 0.068 (0.063 to 0.071) |
| fix | opus | rules: opus-5-5/unattended-run | 3 | 3 of 3 | 0 of 3 | 3 of 3 | 0 of 3 | 3 of 3 | 9.8 (9.1 to 10.3) | 0.0 | 1,281 (1,102 to 1,411) | 43,781 (36,773 to 47,403) | 0.075 (0.068 to 0.079) |
| fix | sonnet | none | 10 | 10 of 10 | 0 of 10 | 0 of 10 | 0 of 10 | 10 of 10 | 11.1 (9.6 to 13.2) | 0.0 | 790 (683 to 915) | 26,131 (25,033 to 34,026) | 0.026 (0.024 to 0.028) |
| fix | sonnet | rules: sonnet-5-5/carry-through, sonnet-5-5/stay-in-scope, sonnet-5-5/verify-changes | 10 | 10 of 10 | 0 of 10 | 10 of 10 | 0 of 10 | 10 of 10 | 11.3 (10.5 to 12.1) | 0.0 | 1,312 (1,142 to 1,538) | 42,764 (37,355 to 48,635) | 0.038 (0.035 to 0.043) |
| question | fable | none | 5 | 5 of 5 | 0 of 5 | n/a | 0 of 5 | 3.0 of 3, 0.0 wrong | 15.3 (13.8 to 16.7) | 19.9 (13.2 to 32.4) | 3,103 (2,767 to 4,245) | 68,989 (58,961 to 76,435) | 0.311 (0.286 to 0.373) |
| question | fable | rules: fable-5-2/low-context-report | 5 | 5 of 5 | 0 of 5 | n/a | 0 of 5 | 3.0 of 3, 0.0 wrong | 11.7 (9.7 to 12.9) | 0.8 (0.0 to 4.1) | 3,016 (2,698 to 3,231) | 72,072 (69,691 to 74,445) | 0.296 (0.271 to 0.308) |
| question | haiku | none | 10 | 10 of 10 | 0 of 10 | n/a | 0 of 10 | 3.0 of 3, 0.0 wrong | 11.2 (8.0 to 15.9) | 4.4 (0.0 to 18.2) | 3,161 (2,275 to 3,529) | 56,406 (51,104 to 64,327) | 0.004 (0.003 to 0.004) |
| question | haiku | rules: haiku-5-5/carry-through, haiku-5-5/verify-changes | 10 | 10 of 10 | 0 of 10 | n/a | 0 of 10 | 3.0 of 3, 0.0 wrong | 12.0 (8.9 to 17.4) | 4.0 (0.0 to 19.6) | 3,492 (2,531 to 4,031) | 63,620 (53,445 to 71,535) | 0.004 (0.003 to 0.005) |
| question | opus | none | 3 | 3 of 3 | 0 of 3 | n/a | 0 of 3 | 3.0 of 3, 0.0 wrong | 9.8 (7.6 to 11.5) | 0.0 | 1,910 (1,780 to 2,008) | 54,978 (49,774 to 58,258) | 0.110 (0.107 to 0.115) |
| question | opus | rules: opus-5-5/unattended-run | 3 | 3 of 3 | 0 of 3 | n/a | 0 of 3 | 3.0 of 3, 0.0 wrong | 11.8 (11.1 to 12.4) | 0.0 | 1,942 (1,859 to 2,012) | 51,651 (51,591 to 51,714) | 0.114 (0.112 to 0.116) |
| question | sonnet | none | 10 | 10 of 10 | 0 of 10 | n/a | 0 of 10 | 3.0 of 3, 0.0 wrong | 10.8 (9.4 to 12.3) | 7.2 (0.0 to 26.7) | 1,761 (1,445 to 2,158) | 45,161 (39,041 to 51,408) | 0.049 (0.043 to 0.054) |
| question | sonnet | rules: sonnet-5-5/carry-through, sonnet-5-5/verify-changes | 10 | 10 of 10 | 0 of 10 | n/a | 0 of 10 | 3.0 of 3, 0.0 wrong | 8.3 (6.8 to 13.0) | 1.9 (0.0 to 19.2) | 1,877 (1,345 to 2,445) | 48,435 (40,606 to 54,104) | 0.052 (0.044 to 0.061) |

Numbers are the mean with the range in parentheses. "Correct" is, for the question, the jobs named that ignore a control, of the three that do, and the jobs named wrongly; for the fix, the runs whose change passes the hidden check. Input tokens include the cached ones.

## Each rule

### `fable-5-2/low-context-report`

| Task | Model | Signal | With the rule | Without |
| --- | --- | --- | --- | --- |
| question | fable | Words per sentence in the report | 11.7 (9.7 to 12.9) | 15.3 (13.8 to 16.7) |
| question | fable | Semicolons per 1,000 words in the report | 0.8 (0.0 to 4.1) | 19.9 (13.2 to 32.4) |
| question | fable | Parentheses per 1,000 words in the report | 31.6 (27.0 to 38.6) | 36.1 (24.0 to 54.1) |
| question | fable | Output tokens per run | 3,016 (2,698 to 3,231) | 3,103 (2,767 to 4,245) |
| question | fable | Difference of the means | -87 output, +3,083 input tokens | -$0.015 per run |
| fix | fable | Words per sentence in the report | 15.6 (13.7 to 18.6) | 18.7 (16.5 to 20.3) |
| fix | fable | Semicolons per 1,000 words in the report | 0.0 | 4.2 (0.0 to 12.3) |
| fix | fable | Parentheses per 1,000 words in the report | 6.6 (0.0 to 11.5) | 8.5 (0.0 to 15.2) |
| fix | fable | Output tokens per run | 1,186 (1,083 to 1,532) | 1,335 (1,126 to 1,695) |
| fix | fable | Difference of the means | -149 output, -1,927 input tokens | -$0.008 per run |

### `fable-5-2/finish-work`

Not delivered in any run of this experiment, so not measured.

### `opus-5-5/unattended-run`

| Task | Model | Signal | With the rule | Without |
| --- | --- | --- | --- | --- |
| fix | opus | Runs finished (deliverable present, work not handed back) | 3 of 3 | 3 of 3 |
| fix | opus | Output tokens per run | 1,281 (1,102 to 1,411) | 1,186 (1,013 to 1,295) |
| fix | opus | Difference of the means | +94 output, +8,436 input tokens | +$0.007 per run |
| question | opus | Runs finished (deliverable present, work not handed back) | 3 of 3 | 3 of 3 |
| question | opus | Output tokens per run | 1,942 (1,859 to 2,012) | 1,910 (1,780 to 2,008) |
| question | opus | Difference of the means | +32 output, -3,326 input tokens | +$0.004 per run |

### `sonnet-5-5/carry-through`

| Task | Model | Signal | With the rule | Without |
| --- | --- | --- | --- | --- |
| question | sonnet | Runs finished (deliverable present, work not handed back) | 10 of 10 | 10 of 10 |
| question | sonnet | Output tokens per run | 1,877 (1,345 to 2,445) | 1,761 (1,445 to 2,158) |
| question | sonnet | Difference of the means | +116 output, +3,274 input tokens | +$0.004 per run |
| question | sonnet | Delivered in the same runs | sonnet-5-5/verify-changes |  |
| fix | sonnet | Runs finished (deliverable present, work not handed back) | 10 of 10 | 10 of 10 |
| fix | sonnet | Output tokens per run | 1,312 (1,142 to 1,538) | 790 (683 to 915) |
| fix | sonnet | Difference of the means | +522 output, +16,632 input tokens | +$0.013 per run |
| fix | sonnet | Delivered in the same runs | sonnet-5-5/stay-in-scope, sonnet-5-5/verify-changes |  |

### `sonnet-5-5/verify-changes`

| Task | Model | Signal | With the rule | Without |
| --- | --- | --- | --- | --- |
| question | sonnet | Runs that ran the tests after their last edit, of those that edited code | n/a | n/a |
| question | sonnet | Output tokens per run | 1,877 (1,345 to 2,445) | 1,761 (1,445 to 2,158) |
| question | sonnet | Difference of the means | +116 output, +3,274 input tokens | +$0.004 per run |
| question | sonnet | Delivered in the same runs | sonnet-5-5/carry-through |  |
| fix | sonnet | Runs that ran the tests after their last edit, of those that edited code | 10 of 10 | 0 of 10 |
| fix | sonnet | Output tokens per run | 1,312 (1,142 to 1,538) | 790 (683 to 915) |
| fix | sonnet | Difference of the means | +522 output, +16,632 input tokens | +$0.013 per run |
| fix | sonnet | Delivered in the same runs | sonnet-5-5/carry-through, sonnet-5-5/stay-in-scope |  |

### `sonnet-5-5/stay-in-scope`

| Task | Model | Signal | With the rule | Without |
| --- | --- | --- | --- | --- |
| fix | sonnet | Runs that changed files beyond the ones asked | 0 of 10 | 0 of 10 |
| fix | sonnet | Output tokens per run | 1,312 (1,142 to 1,538) | 790 (683 to 915) |
| fix | sonnet | Difference of the means | +522 output, +16,632 input tokens | +$0.013 per run |
| fix | sonnet | Delivered in the same runs | sonnet-5-5/carry-through, sonnet-5-5/verify-changes |  |

### `haiku-5-5/carry-through`

| Task | Model | Signal | With the rule | Without |
| --- | --- | --- | --- | --- |
| fix | haiku | Runs finished (deliverable present, work not handed back) | 10 of 10 | 10 of 10 |
| fix | haiku | Runs that changed files beyond the ones asked | 0 of 10 | 0 of 10 |
| fix | haiku | Output tokens per run | 2,089 (1,614 to 3,621) | 681 (651 to 731) |
| fix | haiku | Difference of the means | +1,408 output, +42,215 input tokens | +$0.002 per run |
| fix | haiku | Delivered in the same runs | haiku-5-5/verify-changes |  |
| question | haiku | Runs finished (deliverable present, work not handed back) | 10 of 10 | 10 of 10 |
| question | haiku | Runs that changed files beyond the ones asked | 0 of 10 | 0 of 10 |
| question | haiku | Output tokens per run | 3,492 (2,531 to 4,031) | 3,161 (2,275 to 3,529) |
| question | haiku | Difference of the means | +332 output, +7,214 input tokens | +$0.000 per run |
| question | haiku | Delivered in the same runs | haiku-5-5/verify-changes |  |

### `haiku-5-5/verify-changes`

| Task | Model | Signal | With the rule | Without |
| --- | --- | --- | --- | --- |
| fix | haiku | Runs that ran the tests after their last edit, of those that edited code | 8 of 10 | 0 of 10 |
| fix | haiku | Output tokens per run | 2,089 (1,614 to 3,621) | 681 (651 to 731) |
| fix | haiku | Difference of the means | +1,408 output, +42,215 input tokens | +$0.002 per run |
| fix | haiku | Delivered in the same runs | haiku-5-5/carry-through |  |
| question | haiku | Runs that ran the tests after their last edit, of those that edited code | n/a | n/a |
| question | haiku | Output tokens per run | 3,492 (2,531 to 4,031) | 3,161 (2,275 to 3,529) |
| question | haiku | Difference of the means | +332 output, +7,214 input tokens | +$0.000 per run |
| question | haiku | Delivered in the same runs | haiku-5-5/carry-through |  |

