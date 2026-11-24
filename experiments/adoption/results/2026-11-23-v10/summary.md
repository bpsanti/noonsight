# Adoption evaluation: summary

Runs: 52 (52 answered), judged: 52; API: anthropic; Claude Code 2.1.331, 2.1.330; commits: after 5e20724, before f061f03.
Cost: sessions $36.59, judgments $13.09.

| Condition | Model | Answers | Adopt | With conditions | Do not adopt | Claim correct | No false reason | No invented feature | Names a limit | Grounded | Adopt on wrong grounds |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| before | fable | 3 | 0 | 3 | 0 | 2 of 3 (67%) | 0 of 3 (0%) | 0 of 3 (0%) | 3 of 3 (100%) | 0 of 3 (0%) | 3 of 3 (100%) |
| before | opus | 3 | 0 | 2 | 1 | 2 of 3 (67%) | 0 of 3 (0%) | 2 of 3 (67%) | 3 of 3 (100%) | 0 of 3 (0%) | 2 of 3 (67%) |
| before | sonnet | 3 | 0 | 3 | 0 | 0 of 3 (0%) | 0 of 3 (0%) | 0 of 3 (0%) | 3 of 3 (100%) | 0 of 3 (0%) | 3 of 3 (100%) |
| before | haiku | 3 | 0 | 2 | 1 | 1 of 3 (33%) | 0 of 3 (0%) | 1 of 3 (33%) | 3 of 3 (100%) | 0 of 3 (0%) | 2 of 3 (67%) |
| before | **all** | 12 | 0 | 10 | 2 | 5 of 12 (42%) | 0 of 12 (0%) | 3 of 12 (25%) | 12 of 12 (100%) | 0 of 12 (0%) | 10 of 12 (83%) |
| after | fable | 10 | 0 | 10 | 0 | 10 of 10 (100%) | 7 of 10 (70%) | 10 of 10 (100%) | 10 of 10 (100%) | 7 of 10 (70%) | 3 of 10 (30%) |
| after | opus | 10 | 0 | 10 | 0 | 10 of 10 (100%) | 5 of 10 (50%) | 10 of 10 (100%) | 10 of 10 (100%) | 5 of 10 (50%) | 5 of 10 (50%) |
| after | sonnet | 10 | 0 | 10 | 0 | 10 of 10 (100%) | 5 of 10 (50%) | 10 of 10 (100%) | 10 of 10 (100%) | 5 of 10 (50%) | 5 of 10 (50%) |
| after | haiku | 10 | 0 | 9 | 1 | 9 of 10 (90%) | 1 of 10 (10%) | 9 of 10 (90%) | 10 of 10 (100%) | 1 of 10 (10%) | 8 of 10 (80%) |
| after | **all** | 40 | 0 | 39 | 1 | 39 of 40 (98%) | 18 of 40 (45%) | 39 of 40 (98%) | 40 of 40 (100%) | 18 of 40 (45%) | 21 of 40 (53%) |

Grounded, after against before: 18 of 40 (45%) (31-60%) against 0 of 12 (0%) (0-24%); Fisher's exact test, two-sided, p 0.004.

## Pass bar

- Grounded answers after, overall, at least 80%: not met (18 of 40 (45%)).
- Grounded answers after, for each model, at least 60%: not met (fable 7 of 10, opus 5 of 10, sonnet 5 of 10, haiku 1 of 10).
- Grounded answers after at least as often as before: met.
- **The README passes: no.**

