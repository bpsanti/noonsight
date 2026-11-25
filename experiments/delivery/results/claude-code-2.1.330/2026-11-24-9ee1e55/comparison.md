# Delivery benchmark: the comparisons of `native-n1000`

noonsight's arm, `claudemd` and `skills` on the same 1000 sequences, with the seed, generator, Claude Code version, noonsight build and concurrency of the run before, whose `on` level ran 300 sequences and whose native arms ran the first 60 of them.
a is the first side of each comparison, b the second; the run before is `claude-code-2.1.330/2026-11-23-c5b9130`.
A primary comparison is supported when its measure moves the way it expects and its p, adjusted by Holm over the primary comparisons, is below 0.05.

| | Question | Measure | Expects b | a | b | Paired sessions: both, only a, only b | p (adjusted) | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P1 (primary) | On the same 1000 sequences, subagent coverage is higher under `on` than under `claudemd` | `coverage.subagents.coverage` | higher | 48.3% | 100.0% | 997: 0, 542, 0 | < 0.001 (< 0.001) | supported |
| P2 (primary) | On the same 1000 sequences, subagent coverage is higher under `on` than under `skills` | `coverage.subagents.coverage` | higher | 0.0% | 100.0% | 997: 0, 631, 0 | < 0.001 (< 0.001) | supported |
| P3 (primary) | On the same 1000 sequences, coverage is higher under `on` than under `claudemd` | `coverage.coverage` | higher | 88.2% | 99.9% | 997: 0, 542, 3 | < 0.001 (< 0.001) | supported |
| P4 (primary) | On the same 1000 sequences, coverage is higher under `on` than under `skills` | `coverage.coverage` | higher | 0.0% | 99.9% | 997: 3, 943, 0 | < 0.001 (< 0.001) | supported |
| C1 | On its first 60 sequences, `claudemd` gives the subagent coverage of the run before | `coverage.subagents.coverage` | same | 46.9% | 46.9% |  |  | holds |
| C2 | On its first 60 sequences, `skills` gives the subagent coverage of the run before | `coverage.subagents.coverage` | same | 0.0% | 0.0% |  |  | holds |
| C3 | On its first 60 sequences, `claudemd` gives the coverage of the run before | `coverage.coverage` | same | 88.2% | 88.4% |  |  | does not hold |
| C4 | On its first 60 sequences, `skills` gives the coverage of the run before | `coverage.coverage` | same | 0.0% | 0.0% |  |  | holds |
| C5 | On its first 300 sequences, `on` breaks the invariant in no more sessions than in the run before | `robustness.sessionsFailed` | same | 0 | 0 |  |  | holds |
| C6 | On its first 300 sequences, `on` gives the subagent coverage of the run before | `coverage.subagents.coverage` | same | 100.0% | 100.0% |  |  | holds |

| | Sessions only a shows (first five) | Sessions only b shows (first five) |
| --- | --- | --- |
| P1 | g2-s1-0000, g2-s1-0001, g2-s1-0002, g2-s1-0005, g2-s1-0007 | none |
| P2 | g2-s1-0000, g2-s1-0001, g2-s1-0002, g2-s1-0005, g2-s1-0006 | none |
| P3 | g2-s1-0000, g2-s1-0001, g2-s1-0002, g2-s1-0005, g2-s1-0007 | g2-s1-0345, g2-s1-0564, g2-s1-0949 |
| P4 | g2-s1-0000, g2-s1-0001, g2-s1-0002, g2-s1-0005, g2-s1-0006 | none |
