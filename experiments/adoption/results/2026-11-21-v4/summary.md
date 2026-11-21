# Adoption evaluation: summary

Runs: 35 (30 answered), judged: 30; API: anthropic; Claude Code 2.1.330; commits: after ceecdb2, before f061f03.
Cost: sessions $18.31, judgments $5.64.

| Condition | Model | Answers | Adopt | With conditions | Do not adopt | Claim correct | No false reason | No invented feature | Names a limit | Grounded | Adopt on wrong grounds |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| before | fable | 3 | 0 | 3 | 0 | 3 of 3 (100%) | 0 of 3 (0%) | 3 of 3 (100%) | 3 of 3 (100%) | 0 of 3 (0%) | 3 of 3 (100%) |
| before | opus | 3 | 0 | 2 | 1 | 3 of 3 (100%) | 0 of 3 (0%) | 3 of 3 (100%) | 3 of 3 (100%) | 0 of 3 (0%) | 2 of 3 (67%) |
| before | sonnet | 3 | 0 | 3 | 0 | 3 of 3 (100%) | 0 of 3 (0%) | 3 of 3 (100%) | 3 of 3 (100%) | 0 of 3 (0%) | 3 of 3 (100%) |
| before | haiku | 3 | 0 | 2 | 1 | 2 of 3 (67%) | 0 of 3 (0%) | 3 of 3 (100%) | 3 of 3 (100%) | 0 of 3 (0%) | 2 of 3 (67%) |
| before | **all** | 12 | 0 | 10 | 2 | 11 of 12 (92%) | 0 of 12 (0%) | 12 of 12 (100%) | 12 of 12 (100%) | 0 of 12 (0%) | 10 of 12 (83%) |
| after | fable | 3 | 0 | 3 | 0 | 3 of 3 (100%) | 2 of 3 (67%) | 3 of 3 (100%) | 3 of 3 (100%) | 2 of 3 (67%) | 1 of 3 (33%) |
| after | opus | 5 | 0 | 5 | 0 | 5 of 5 (100%) | 1 of 5 (20%) | 5 of 5 (100%) | 5 of 5 (100%) | 1 of 5 (20%) | 4 of 5 (80%) |
| after | sonnet | 5 | 0 | 5 | 0 | 5 of 5 (100%) | 1 of 5 (20%) | 5 of 5 (100%) | 5 of 5 (100%) | 1 of 5 (20%) | 4 of 5 (80%) |
| after | haiku | 5 | 0 | 5 | 0 | 5 of 5 (100%) | 2 of 5 (40%) | 4 of 5 (80%) | 5 of 5 (100%) | 1 of 5 (20%) | 4 of 5 (80%) |
| after | **all** | 18 | 0 | 18 | 0 | 18 of 18 (100%) | 6 of 18 (33%) | 17 of 18 (94%) | 18 of 18 (100%) | 5 of 18 (28%) | 13 of 18 (72%) |

Grounded, after against before: 5 of 18 (28%) (12-51%) against 0 of 12 (0%) (0-24%); Fisher's exact test, two-sided, p 0.07.

## Pass bar

- Grounded answers after, overall, at least 80%: not met (5 of 18 (28%)).
- Grounded answers after, for each model, at least 60%: not met (fable 2 of 3, opus 1 of 5, sonnet 1 of 5, haiku 1 of 5).
- Grounded answers after at least as often as before: met.
- **The README passes: no.**

