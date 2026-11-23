# Adoption evaluation: summary

Runs: 32 (32 answered), judged: 32; API: anthropic; Claude Code 2.1.330; commits: after 6342101, before f061f03.
Cost: sessions $22.17, judgments $6.32.

| Condition | Model | Answers | Adopt | With conditions | Do not adopt | Claim correct | No false reason | No invented feature | Names a limit | Grounded | Adopt on wrong grounds |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| before | fable | 3 | 0 | 3 | 0 | 3 of 3 (100%) | 0 of 3 (0%) | 3 of 3 (100%) | 3 of 3 (100%) | 0 of 3 (0%) | 3 of 3 (100%) |
| before | opus | 3 | 0 | 2 | 1 | 3 of 3 (100%) | 0 of 3 (0%) | 3 of 3 (100%) | 3 of 3 (100%) | 0 of 3 (0%) | 2 of 3 (67%) |
| before | sonnet | 3 | 0 | 3 | 0 | 3 of 3 (100%) | 0 of 3 (0%) | 3 of 3 (100%) | 3 of 3 (100%) | 0 of 3 (0%) | 3 of 3 (100%) |
| before | haiku | 3 | 0 | 2 | 1 | 2 of 3 (67%) | 0 of 3 (0%) | 3 of 3 (100%) | 3 of 3 (100%) | 0 of 3 (0%) | 2 of 3 (67%) |
| before | **all** | 12 | 0 | 10 | 2 | 11 of 12 (92%) | 0 of 12 (0%) | 12 of 12 (100%) | 12 of 12 (100%) | 0 of 12 (0%) | 10 of 12 (83%) |
| after | fable | 5 | 0 | 5 | 0 | 5 of 5 (100%) | 2 of 5 (40%) | 5 of 5 (100%) | 5 of 5 (100%) | 2 of 5 (40%) | 3 of 5 (60%) |
| after | opus | 5 | 0 | 5 | 0 | 4 of 5 (80%) | 2 of 5 (40%) | 5 of 5 (100%) | 5 of 5 (100%) | 2 of 5 (40%) | 3 of 5 (60%) |
| after | sonnet | 5 | 0 | 5 | 0 | 5 of 5 (100%) | 5 of 5 (100%) | 5 of 5 (100%) | 5 of 5 (100%) | 5 of 5 (100%) | 0 of 5 (0%) |
| after | haiku | 5 | 0 | 5 | 0 | 4 of 5 (80%) | 2 of 5 (40%) | 3 of 5 (60%) | 5 of 5 (100%) | 1 of 5 (20%) | 4 of 5 (80%) |
| after | **all** | 20 | 0 | 20 | 0 | 18 of 20 (90%) | 11 of 20 (55%) | 18 of 20 (90%) | 20 of 20 (100%) | 10 of 20 (50%) | 10 of 20 (50%) |

Grounded, after against before: 10 of 20 (50%) (30-70%) against 0 of 12 (0%) (0-24%); Fisher's exact test, two-sided, p 0.004.

## Pass bar

- Grounded answers after, overall, at least 80%: not met (10 of 20 (50%)).
- Grounded answers after, for each model, at least 60%: not met (fable 2 of 5, opus 2 of 5, sonnet 5 of 5, haiku 1 of 5).
- Grounded answers after at least as often as before: met.
- **The README passes: no.**

