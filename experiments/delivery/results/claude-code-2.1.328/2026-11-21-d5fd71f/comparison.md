# Delivery benchmark: the comparisons of `after-f3-f4`

The whole benchmark again, on noonsight with the fixes of F3 and F4, with the seed, sizes, command and Claude Code version of the run that found them. Too few sessions can change for a paired test to reach the alpha, so no comparison is primary and each is read from its measure alone.
a is the first side of each comparison, b the second; the run before is `claude-code-2.1.328/2026-11-20-4e18c43`.
A primary comparison is supported when its measure moves the way it expects and its p, adjusted by Holm over the primary comparisons, is below 0.05.

| | Question | Measure | Expects b | a | b | Paired sessions: both, only a, only b | p (adjusted) | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| K1 | Fewer sessions under `on` break the invariant: only `s1-0096`, the documented limit, should still fail | `robustness.sessionsFailed` | lower | 3 | 1 | 300: 1, 2, 0 | 0.50 | holds |
| K2 | Coverage under `on` is higher | `coverage.coverage` | higher | 99.5% | 99.9% | 300: 1, 1, 0 | 1.00 | holds |
| K3 | Under `on`, fewer requests hold another model's rule with no note | `robustness.requestsWithViolation.foreign-unretired` | lower | 22 | 2 |  |  | holds |
| K4 | Under `on`, subagent coverage is no lower | `coverage.subagents.coverage` | not-lower | 99.9% | 100.0% | 300: 0, 1, 0 | 1.00 | holds |
| C1 | `claudemd` is unchanged: noonsight delivers nothing under a native arm | `coverage.coverage` | same | 87.4% | 87.3% | 60: 42, 0, 0 | 1.00 | does not hold |
| C2 | `rules` is unchanged | `coverage.coverage` | same | 70.9% | 70.6% | 60: 47, 0, 0 | 1.00 | does not hold |
| C3 | `skills` is unchanged | `coverage.coverage` | same | 0.0% | 0.0% | 60: 58, 0, 0 | 1.00 | holds |
| S4 | The decision log gives the coverage the stub saw under `on` | `coverage.log against coverage.stub` | same | 100.0% | 99.9% |  |  | does not hold |
| R1 | Under `on`, the own share | `precision.ownShare` | reported only | 78.8% | 79.0% |  |  | reported |
| R2 | Under `on`, the right share | `precision.rightShare` | reported only | 51.4% | 51.6% |  |  | reported |
| R3 | Under `on`, the characters added per request | `cost.addedCharsPerAgentRequest` | reported only | 1154 | 1155 |  |  | reported |

| | Sessions only a shows (first five) | Sessions only b shows (first five) |
| --- | --- | --- |
| K1 | s1-0205, s1-0230 | none |
| K2 | s1-0230 | none |
| K4 | s1-0230 | none |
