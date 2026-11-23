# Adoption evaluation: summary

Runs: 52 (52 answered), judged: 52; API: anthropic; Claude Code 2.1.330; commits: after bf929c2, before f061f03.
Cost: sessions $35.27, judgments $9.95.

| Condition | Model | Answers | Adopt | With conditions | Do not adopt | Claim correct | No false reason | No invented feature | Names a limit | Grounded | Adopt on wrong grounds |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| before | fable | 3 | 0 | 3 | 0 | 2 of 3 (67%) | 0 of 3 (0%) | 3 of 3 (100%) | 3 of 3 (100%) | 0 of 3 (0%) | 3 of 3 (100%) |
| before | opus | 3 | 0 | 2 | 1 | 3 of 3 (100%) | 0 of 3 (0%) | 3 of 3 (100%) | 3 of 3 (100%) | 0 of 3 (0%) | 2 of 3 (67%) |
| before | sonnet | 3 | 0 | 3 | 0 | 2 of 3 (67%) | 1 of 3 (33%) | 3 of 3 (100%) | 3 of 3 (100%) | 1 of 3 (33%) | 2 of 3 (67%) |
| before | haiku | 3 | 0 | 2 | 1 | 2 of 3 (67%) | 0 of 3 (0%) | 3 of 3 (100%) | 3 of 3 (100%) | 0 of 3 (0%) | 2 of 3 (67%) |
| before | **all** | 12 | 0 | 10 | 2 | 9 of 12 (75%) | 1 of 12 (8%) | 12 of 12 (100%) | 12 of 12 (100%) | 1 of 12 (8%) | 9 of 12 (75%) |
| after | fable | 10 | 0 | 10 | 0 | 10 of 10 (100%) | 8 of 10 (80%) | 10 of 10 (100%) | 10 of 10 (100%) | 8 of 10 (80%) | 2 of 10 (20%) |
| after | opus | 10 | 0 | 10 | 0 | 10 of 10 (100%) | 6 of 10 (60%) | 10 of 10 (100%) | 10 of 10 (100%) | 6 of 10 (60%) | 4 of 10 (40%) |
| after | sonnet | 10 | 0 | 10 | 0 | 10 of 10 (100%) | 7 of 10 (70%) | 10 of 10 (100%) | 10 of 10 (100%) | 7 of 10 (70%) | 3 of 10 (30%) |
| after | haiku | 10 | 0 | 10 | 0 | 9 of 10 (90%) | 5 of 10 (50%) | 10 of 10 (100%) | 10 of 10 (100%) | 5 of 10 (50%) | 5 of 10 (50%) |
| after | **all** | 40 | 0 | 40 | 0 | 39 of 40 (98%) | 26 of 40 (65%) | 40 of 40 (100%) | 40 of 40 (100%) | 26 of 40 (65%) | 14 of 40 (35%) |

Grounded, after against before: 26 of 40 (65%) (50-78%) against 1 of 12 (8%) (1-35%); Fisher's exact test, two-sided, p < 0.001.

## Pass bar

- Grounded answers after, overall, at least 80%: not met (26 of 40 (65%)).
- Grounded answers after, for each model, at least 60%: not met (fable 8 of 10, opus 6 of 10, sonnet 7 of 10, haiku 5 of 10).
- Grounded answers after at least as often as before: met.
- **The README passes: no.**

