# Adoption evaluation: summary

Runs: 18 (18 answered), judged: 18; API: anthropic; Claude Code 2.1.330; commits: after c6a919c, before f061f03.
Cost: sessions $5.41, judgments $3.19.

| Condition | Model | Answers | Adopt | With conditions | Do not adopt | Claim correct | No false reason | No invented feature | Names a limit | Grounded | Adopt on wrong grounds |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| before | opus | 3 | 0 | 2 | 1 | 3 of 3 (100%) | 0 of 3 (0%) | 3 of 3 (100%) | 3 of 3 (100%) | 0 of 3 (0%) | 2 of 3 (67%) |
| before | sonnet | 3 | 0 | 3 | 0 | 3 of 3 (100%) | 0 of 3 (0%) | 3 of 3 (100%) | 3 of 3 (100%) | 0 of 3 (0%) | 3 of 3 (100%) |
| before | haiku | 3 | 0 | 2 | 1 | 3 of 3 (100%) | 0 of 3 (0%) | 2 of 3 (67%) | 3 of 3 (100%) | 0 of 3 (0%) | 2 of 3 (67%) |
| before | **all** | 9 | 0 | 7 | 2 | 9 of 9 (100%) | 0 of 9 (0%) | 8 of 9 (89%) | 9 of 9 (100%) | 0 of 9 (0%) | 7 of 9 (78%) |
| after | opus | 3 | 0 | 3 | 0 | 3 of 3 (100%) | 0 of 3 (0%) | 3 of 3 (100%) | 3 of 3 (100%) | 0 of 3 (0%) | 3 of 3 (100%) |
| after | sonnet | 3 | 0 | 3 | 0 | 3 of 3 (100%) | 2 of 3 (67%) | 3 of 3 (100%) | 3 of 3 (100%) | 2 of 3 (67%) | 1 of 3 (33%) |
| after | haiku | 3 | 0 | 3 | 0 | 3 of 3 (100%) | 0 of 3 (0%) | 3 of 3 (100%) | 3 of 3 (100%) | 0 of 3 (0%) | 3 of 3 (100%) |
| after | **all** | 9 | 0 | 9 | 0 | 9 of 9 (100%) | 2 of 9 (22%) | 9 of 9 (100%) | 9 of 9 (100%) | 2 of 9 (22%) | 7 of 9 (78%) |

Grounded, after against before: 2 of 9 (22%) (6-55%) against 0 of 9 (0%) (0-30%); Fisher's exact test, two-sided, p 0.47.

## Pass bar

- Grounded answers after, overall, at least 80%: not met (2 of 9 (22%)).
- Grounded answers after, for each model, at least 60%: not met (opus 0 of 3, sonnet 2 of 3, haiku 0 of 3).
- Grounded answers after at least as often as before: met.
- **The README passes: no.**

