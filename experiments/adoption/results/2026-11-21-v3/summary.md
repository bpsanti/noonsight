# Adoption evaluation: summary

Runs: 18 (18 answered), judged: 18; API: anthropic; Claude Code 2.1.330; commits: after 6aa90d9, before f061f03.
Cost: sessions $5.53, judgments $3.13.

| Condition | Model | Answers | Adopt | With conditions | Do not adopt | Claim correct | No false reason | No invented feature | Names a limit | Grounded | Adopt on wrong grounds |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| before | opus | 3 | 0 | 2 | 1 | 3 of 3 (100%) | 0 of 3 (0%) | 3 of 3 (100%) | 3 of 3 (100%) | 0 of 3 (0%) | 2 of 3 (67%) |
| before | sonnet | 3 | 0 | 3 | 0 | 3 of 3 (100%) | 0 of 3 (0%) | 3 of 3 (100%) | 3 of 3 (100%) | 0 of 3 (0%) | 3 of 3 (100%) |
| before | haiku | 3 | 0 | 2 | 1 | 3 of 3 (100%) | 0 of 3 (0%) | 2 of 3 (67%) | 3 of 3 (100%) | 0 of 3 (0%) | 2 of 3 (67%) |
| before | **all** | 9 | 0 | 7 | 2 | 9 of 9 (100%) | 0 of 9 (0%) | 8 of 9 (89%) | 9 of 9 (100%) | 0 of 9 (0%) | 7 of 9 (78%) |
| after | opus | 3 | 0 | 3 | 0 | 3 of 3 (100%) | 2 of 3 (67%) | 3 of 3 (100%) | 3 of 3 (100%) | 2 of 3 (67%) | 1 of 3 (33%) |
| after | sonnet | 3 | 0 | 3 | 0 | 3 of 3 (100%) | 3 of 3 (100%) | 3 of 3 (100%) | 3 of 3 (100%) | 3 of 3 (100%) | 0 of 3 (0%) |
| after | haiku | 3 | 0 | 3 | 0 | 3 of 3 (100%) | 1 of 3 (33%) | 3 of 3 (100%) | 3 of 3 (100%) | 1 of 3 (33%) | 2 of 3 (67%) |
| after | **all** | 9 | 0 | 9 | 0 | 9 of 9 (100%) | 6 of 9 (67%) | 9 of 9 (100%) | 9 of 9 (100%) | 6 of 9 (67%) | 3 of 9 (33%) |

Grounded, after against before: 6 of 9 (67%) (35-88%) against 0 of 9 (0%) (0-30%); Fisher's exact test, two-sided, p 0.009.

## Pass bar

- Grounded answers after, overall, at least 80%: not met (6 of 9 (67%)).
- Grounded answers after, for each model, at least 60%: not met (opus 2 of 3, sonnet 3 of 3, haiku 1 of 3).
- Grounded answers after at least as often as before: met.
- **The README passes: no.**

