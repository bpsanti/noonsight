# Summary

`npm run benchmark -- summarize --results <this folder>` prints this file from the result files beside it.

## Delivery check of the paid runs

| Condition | Runs | Received what the condition delivers | Condition texts per model |
| --- | --- | --- | --- |
| `off` | 168 | 168 of 168 | fable 1, opus 1, sonnet 1, haiku 1 |
| `on` | 168 | 168 of 168 | fable 1, opus 1, sonnet 1, haiku 1 |
| `claudemd` | 168 | 168 of 168 | fable 1, opus 1, sonnet 1, haiku 1 |
| `scattered` | 84 | 84 of 84 | fable 1, opus 1, sonnet 1, haiku 1 |

## The scattered rules file, opened

| Model | Runs | Opened the rules file | Before its first edit |
| --- | --- | --- | --- |
| fable | 21 | 21 of 21 | 21 of 21 |
| opus | 21 | 21 of 21 | 21 of 21 |
| sonnet | 21 | 21 of 21 | 20 of 21 |
| haiku | 21 | 21 of 21 | 21 of 21 |

## Model switches during the paid runs

| Run | From | To | Source | noonsight delivered |
| --- | --- | --- | --- | --- |
| `routine.vulnerable-secret.sonnet.on.1` | claude-sonnet-5-5 | claude-sonnet-5 | auto | note |
| `routine.vulnerable-secret.sonnet.off.1` | claude-sonnet-5-5 | claude-sonnet-5 | auto | nothing |
| `routine.vulnerable-secret.opus.off.1` | claude-opus-5-5 | claude-opus-4-8 | auto | nothing |
| `routine.vulnerable-secret.opus.on.1` | claude-opus-5-5 | claude-opus-4-8 | auto | note |
| `routine.vulnerable-secret.fable.off.1` | claude-fable-5-2 | claude-opus-4-8 | auto | nothing |
| `routine.vulnerable-secret.fable.on.1` | claude-fable-5-2 | claude-opus-4-8 | auto | note |
| `routine.vulnerable-secret.sonnet.on.2` | claude-sonnet-5-5 | claude-sonnet-5 | auto | note |
| `routine.vulnerable-secret.sonnet.off.2` | claude-sonnet-5-5 | claude-sonnet-5 | auto | nothing |
| `routine.vulnerable-secret.fable.on.2` | claude-fable-5-2 | claude-opus-4-8 | auto | note |
| `routine.vulnerable-secret.fable.off.2` | claude-fable-5-2 | claude-opus-4-8 | auto | nothing |
| `routine.vulnerable-secret.opus.off.2` | claude-opus-5-5 | claude-opus-4-8 | auto | nothing |
| `routine.vulnerable-secret.opus.claudemd.1` | claude-opus-5-5 | claude-opus-4-8 | auto | nothing |
| `routine.vulnerable-secret.sonnet.claudemd.1` | claude-sonnet-5-5 | claude-sonnet-5 | auto | nothing |
| `routine.vulnerable-secret.fable.claudemd.1` | claude-fable-5-2 | claude-opus-4-8 | auto | nothing |
| `routine.vulnerable-secret.fable.claudemd.2` | claude-fable-5-2 | claude-opus-4-8 | auto | nothing |
| `routine.vulnerable-secret.sonnet.claudemd.2` | claude-sonnet-5-5 | claude-sonnet-5 | auto | nothing |
| `routine.vulnerable-secret.opus.claudemd.2` | claude-opus-5-5 | claude-opus-4-8 | auto | nothing |
| `routine.vulnerable-secret.fable.scattered.1` | claude-fable-5-2 | claude-opus-4-8 | auto | nothing |
| `routine.vulnerable-secret.sonnet.scattered.1` | claude-sonnet-5-5 | claude-sonnet-5 | auto | nothing |
| `routine.vulnerable-secret.opus.scattered.1` | claude-opus-5-5 | claude-opus-4-8 | auto | nothing |

## Cost per run, round 1 (every condition)

| Model | `off` $/run | `off` input tokens/run | `on` $/run | `on` input tokens/run | `claudemd` $/run | `claudemd` input tokens/run | `scattered` $/run | `scattered` input tokens/run | Runs per condition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| fable | $0.319 | 147k | $0.330 | 151k | $0.369 | 160k | $0.383 | 170k | 21 / 21 / 21 / 21 |
| opus | $0.184 | 172k | $0.194 | 183k | $0.223 | 216k | $0.239 | 237k | 21 / 21 / 21 / 21 |
| sonnet | $0.070 | 121k | $0.086 | 155k | $0.090 | 162k | $0.091 | 167k | 21 / 21 / 21 / 21 |
| haiku | $0.009 | 267k | $0.010 | 364k | $0.010 | 306k | $0.010 | 312k | 21 / 21 / 21 / 21 |
| all | $0.145 | 177k | $0.155 | 213k | $0.173 | 211k | $0.181 | 221k | 84 / 84 / 84 / 84 |

## Cost per run, both rounds (the conditions run twice)

| Model | `off` $/run | `off` input tokens/run | `on` $/run | `on` input tokens/run | `claudemd` $/run | `claudemd` input tokens/run | Runs per condition |
| --- | --- | --- | --- | --- | --- | --- | --- |
| fable | $0.298 | 134k | $0.325 | 148k | $0.362 | 158k | 42 / 42 / 42 |
| opus | $0.188 | 175k | $0.185 | 178k | $0.213 | 200k | 42 / 42 / 42 |
| sonnet | $0.071 | 129k | $0.084 | 162k | $0.087 | 151k | 42 / 42 / 42 |
| haiku | $0.009 | 253k | $0.010 | 323k | $0.009 | 279k | 42 / 42 / 42 |
| all | $0.141 | 173k | $0.151 | 203k | $0.168 | 197k | 168 / 168 / 168 |

## Resolved by the verifier (build and routine)

| Model | `off` | `on` | `claudemd` | `scattered` |
| --- | --- | --- | --- | --- |
| fable | 36 of 36 | 36 of 36 | 36 of 36 | 18 of 18 |
| opus | 36 of 36 | 35 of 36 | 36 of 36 | 18 of 18 |
| sonnet | 31 of 36 | 31 of 36 | 32 of 36 | 14 of 18 |
| haiku | 30 of 36 | 30 of 36 | 29 of 36 | 16 of 18 |
| all | 133 of 144 | 132 of 144 | 133 of 144 | 66 of 72 |

## Open answers, judge score (uncalibrated)

| Set | `off` | `on` | `claudemd` | `scattered` |
| --- | --- | --- | --- | --- |
| digest | 0.72 (16 of 16 graded) | 0.68 (16 of 16 graded) | 0.70 (16 of 16 graded) | 0.72 (8 of 8 graded) |
| review | 0.21 (8 of 8 graded) | 0.19 (8 of 8 graded) | 0.21 (8 of 8 graded) | 0.21 (4 of 4 graded) |
