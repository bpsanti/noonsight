# Delivery benchmark: the comparisons of `after-f1-f2`

The fuzz level and the native arms again, on noonsight with the fixes of F1 and F2, with the seed, sizes and Claude Code version of the run before the fixes.
a is the first side of each comparison, b the second; the run before is `claude-code-2.1.328/2026-11-19-467d465`.
A primary comparison is supported when its measure moves the way it expects and its p, adjusted by Holm over the primary comparisons, is below 0.05.

| | Question | Measure | Expects b | a | b | Paired sessions: both, only a, only b | p (adjusted) | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P1 (primary) | Fewer sessions under `on` break the invariant in a way nothing documented explains | `robustness.sessionsFailed` | lower | 26 | 3 | 296: 3, 23, 0 | < 0.001 (< 0.001) | supported |
| P2 (primary) | Coverage under `on` is higher | `coverage.coverage` | higher | 99.4% | 99.5% | 296: 2, 6, 0 | 0.03 (0.03) | supported |
| P3 (primary) | On the same 60 sequences, coverage is higher under `on` than under `claudemd` | `coverage.coverage` | higher | 87.4% | 100.0% | 60: 0, 42, 0 | < 0.001 (< 0.001) | supported |
| P4 (primary) | On the same 60 sequences, coverage is higher under `on` than under `rules` | `coverage.coverage` | higher | 70.9% | 100.0% | 60: 0, 47, 0 | < 0.001 (< 0.001) | supported |
| P5 (primary) | On the same 60 sequences, coverage is higher under `on` than under `skills` | `coverage.coverage` | higher | 0.0% | 100.0% | 60: 0, 58, 0 | < 0.001 (< 0.001) | supported |
| P6 (primary) | On the same 60 sequences, subagent coverage is higher under `on` than under `claudemd` | `coverage.subagents.coverage` | higher | 32.2% | 100.0% | 60: 0, 42, 0 | < 0.001 (< 0.001) | supported |
| P7 (primary) | On the same 60 sequences, subagent coverage is higher under `on` than under `rules` | `coverage.subagents.coverage` | higher | 32.2% | 100.0% | 60: 0, 42, 0 | < 0.001 (< 0.001) | supported |
| P8 (primary) | On the same 60 sequences, subagent coverage is higher under `on` than under `skills` | `coverage.subagents.coverage` | higher | 0.0% | 100.0% | 60: 0, 49, 0 | < 0.001 (< 0.001) | supported |
| C1 | `claudemd` is unchanged: noonsight delivers nothing under a native arm, so its fixes cannot move it | `coverage.coverage` | same | 87.2% | 87.4% | 60: 42, 0, 0 | 1.00 | does not hold |
| C2 | `rules` is unchanged | `coverage.coverage` | same | 70.5% | 70.9% | 60: 46, 0, 1 | 1.00 | does not hold |
| C3 | `skills` is unchanged | `coverage.coverage` | same | 0.0% | 0.0% | 60: 58, 0, 0 | 1.00 | holds |
| S1 | Under `on`, coverage in the sessions with two quiet steps in a row is higher | `robustness.byQuietPair.two quiet steps in a row.coverage` | higher | 99.0% | 99.1% |  |  | holds |
| S2 | Under `on`, fewer requests hold another model's rule with no note | `robustness.requestsWithViolation.foreign-unretired` | lower | 80 | 22 |  |  | holds |
| S3 | Under `on`, subagent coverage is no lower | `coverage.subagents.coverage` | not-lower | 99.7% | 99.9% | 296: 0, 1, 1 | 1.00 | holds |
| S4 | The decision log gives the coverage the stub saw under `on` | `coverage.log against coverage.stub` | same | 100.0% | 99.4% |  |  | does not hold |
| R1 | Under `on`, the own share | `precision.ownShare` | reported only | 78.4% | 78.8% |  |  | reported |
| R2 | Under `on`, the right share | `precision.rightShare` | reported only | 52.5% | 51.4% |  |  | reported |
| R3 | Under `on`, the characters added per request | `cost.addedCharsPerAgentRequest` | reported only | 1132 | 1154 |  |  | reported |

| | Sessions only a shows (first five) | Sessions only b shows (first five) |
| --- | --- | --- |
| P1 | s1-0030, s1-0045, s1-0058, s1-0059, s1-0083 | none |
| P2 | s1-0045, s1-0099, s1-0119, s1-0144, s1-0145 | none |
| P3 | s1-0000, s1-0001, s1-0002, s1-0004, s1-0005 | none |
| P4 | s1-0000, s1-0001, s1-0002, s1-0004, s1-0005 | none |
| P5 | s1-0000, s1-0001, s1-0002, s1-0004, s1-0005 | none |
| P6 | s1-0000, s1-0001, s1-0002, s1-0004, s1-0005 | none |
| P7 | s1-0000, s1-0001, s1-0002, s1-0004, s1-0005 | none |
| P8 | s1-0000, s1-0001, s1-0002, s1-0004, s1-0005 | none |
| C2 | none | s1-0000 |
| S3 | s1-0174 | s1-0230 |
