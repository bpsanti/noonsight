# Adoption evaluation: summary

Runs: 52 (52 answered), judged: 52; API: anthropic; Claude Code 2.1.331, 2.1.330; commits: after c02c926, before f061f03.
Cost: sessions $35.99, judgments $13.01.

| Condition | Model | Answers | Adopt | With conditions | Do not adopt | Claim correct | No false reason | No invented feature | Names a limit | Grounded | Adopt on wrong grounds |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| before | fable | 3 | 0 | 3 | 0 | 2 of 3 (67%) | 0 of 3 (0%) | 1 of 3 (33%) | 3 of 3 (100%) | 0 of 3 (0%) | 3 of 3 (100%) |
| before | opus | 3 | 0 | 2 | 1 | 2 of 3 (67%) | 0 of 3 (0%) | 2 of 3 (67%) | 3 of 3 (100%) | 0 of 3 (0%) | 2 of 3 (67%) |
| before | sonnet | 3 | 0 | 3 | 0 | 0 of 3 (0%) | 0 of 3 (0%) | 0 of 3 (0%) | 3 of 3 (100%) | 0 of 3 (0%) | 3 of 3 (100%) |
| before | haiku | 3 | 0 | 2 | 1 | 1 of 3 (33%) | 0 of 3 (0%) | 1 of 3 (33%) | 3 of 3 (100%) | 0 of 3 (0%) | 2 of 3 (67%) |
| before | **all** | 12 | 0 | 10 | 2 | 5 of 12 (42%) | 0 of 12 (0%) | 4 of 12 (33%) | 12 of 12 (100%) | 0 of 12 (0%) | 10 of 12 (83%) |
| after | fable | 10 | 0 | 10 | 0 | 10 of 10 (100%) | 7 of 10 (70%) | 10 of 10 (100%) | 10 of 10 (100%) | 7 of 10 (70%) | 3 of 10 (30%) |
| after | opus | 10 | 0 | 10 | 0 | 10 of 10 (100%) | 6 of 10 (60%) | 10 of 10 (100%) | 10 of 10 (100%) | 6 of 10 (60%) | 4 of 10 (40%) |
| after | sonnet | 10 | 0 | 10 | 0 | 10 of 10 (100%) | 4 of 10 (40%) | 10 of 10 (100%) | 10 of 10 (100%) | 4 of 10 (40%) | 6 of 10 (60%) |
| after | haiku | 10 | 0 | 10 | 0 | 10 of 10 (100%) | 6 of 10 (60%) | 10 of 10 (100%) | 10 of 10 (100%) | 6 of 10 (60%) | 4 of 10 (40%) |
| after | **all** | 40 | 0 | 40 | 0 | 40 of 40 (100%) | 23 of 40 (58%) | 40 of 40 (100%) | 40 of 40 (100%) | 23 of 40 (58%) | 17 of 40 (43%) |

Grounded, after against before: 23 of 40 (58%) (42-71%) against 0 of 12 (0%) (0-24%); Fisher's exact test, two-sided, p < 0.001.

## Pass bar

- Grounded answers after, overall, at least 80%: not met (23 of 40 (58%)).
- Grounded answers after, for each model, at least 60%: not met (fable 7 of 10, opus 6 of 10, sonnet 4 of 10, haiku 6 of 10).
- Grounded answers after at least as often as before: met.
- **The README passes: no.**

