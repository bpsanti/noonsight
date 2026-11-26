# Delivery benchmark: the comparisons of `on-n1000-after-f10-f12`

noonsight's arm again on the 1000 sequences of `native-n1000`, on the build with the fixes of F10 to F12, with the seed, generator, Claude Code version and concurrency of that run. The native arms do not run noonsight and are not run again: their sessions are that run's. At most four sessions can stop failing, too few for a paired test to reach the alpha, so the before and after comparisons are not primary.
a is the first side of each comparison, b the second; the run before is `claude-code-2.1.330/2026-11-24-9ee1e55`.
A primary comparison is supported when its measure moves the way it expects and its p, adjusted by Holm over the primary comparisons, is below 0.05.

| | Question | Measure | Expects b | a | b | Paired sessions: both, only a, only b | p (adjusted) | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P1 (primary) | On the same 1000 sequences, subagent coverage is higher under `on` than under `claudemd` of the run before | `coverage.subagents.coverage` | higher | 48.3% | 100.0% | 1000: 0, 543, 0 | < 0.001 (< 0.001) | supported |
| P2 (primary) | On the same 1000 sequences, subagent coverage is higher under `on` than under `skills` of the run before | `coverage.subagents.coverage` | higher | 0.0% | 100.0% | 1000: 0, 633, 0 | < 0.001 (< 0.001) | supported |
| P3 (primary) | On the same 1000 sequences, coverage is higher under `on` than under `claudemd` of the run before | `coverage.coverage` | higher | 88.2% | 100.0% | 1000: 0, 543, 0 | < 0.001 (< 0.001) | supported |
| P4 (primary) | On the same 1000 sequences, coverage is higher under `on` than under `skills` of the run before | `coverage.coverage` | higher | 0.0% | 100.0% | 1000: 0, 949, 0 | < 0.001 (< 0.001) | supported |
| K1 | Fewer sessions under `on` break the invariant: none should | `robustness.sessionsFailed` | lower | 4 | 0 | 997: 0, 4, 0 | 0.13 | holds |
| K2 | Coverage under `on` is higher | `coverage.coverage` | higher | 99.9% | 100.0% | 997: 0, 3, 0 | 0.25 | holds |
| K3 | Under `on`, fewer requests hold another model's rule with no note | `robustness.requestsWithViolation.foreign-unretired` | lower | 7 | 0 |  |  | holds |
| K4 | Under `on`, subagent coverage is no lower | `coverage.subagents.coverage` | not-lower | 100.0% | 100.0% | 997: 0, 0, 0 | 1.00 | holds |
| S4 | The decision log gives the coverage the stub saw under `on` | `coverage.log against coverage.stub` | same | 100.0% | 100.0% |  |  | holds |
| R1 | Under `on`, the own share | `precision.ownShare` | reported only | 78.3% | 78.4% |  |  | reported |
| R2 | Under `on`, the right share | `precision.rightShare` | reported only | 49.2% | 49.3% |  |  | reported |
| R3 | Under `on`, the characters added per request | `cost.addedCharsPerAgentRequest` | reported only | 1372 | 1370 |  |  | reported |

| | Sessions only a shows (first five) | Sessions only b shows (first five) |
| --- | --- | --- |
| P1 | g2-s1-0000, g2-s1-0001, g2-s1-0002, g2-s1-0005, g2-s1-0007 | none |
| P2 | g2-s1-0000, g2-s1-0001, g2-s1-0002, g2-s1-0005, g2-s1-0006 | none |
| P3 | g2-s1-0000, g2-s1-0001, g2-s1-0002, g2-s1-0005, g2-s1-0007 | none |
| P4 | g2-s1-0000, g2-s1-0001, g2-s1-0002, g2-s1-0005, g2-s1-0006 | none |
| K1 | g2-s1-0345, g2-s1-0564, g2-s1-0949, g2-s1-0969 | none |
| K2 | g2-s1-0345, g2-s1-0564, g2-s1-0949 | none |
