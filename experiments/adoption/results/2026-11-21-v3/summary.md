# Adoption evaluation: summary

Runs: 24 (24 answered), judged: 24; API: anthropic; Claude Code 2.1.330; commits: after 5d6550b, after 6aa90d9, before f061f03.
Cost: sessions $17.35, judgments $4.21.

| Condition | Model | Answers | Adopt | With conditions | Do not adopt | Claim correct | No false reason | No invented feature | Names a limit | Grounded | Adopt on wrong grounds |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| before | fable | 3 | 0 | 3 | 0 | 3 of 3 (100%) | 0 of 3 (0%) | 3 of 3 (100%) | 3 of 3 (100%) | 0 of 3 (0%) | 3 of 3 (100%) |
| before | opus | 3 | 0 | 2 | 1 | 3 of 3 (100%) | 0 of 3 (0%) | 3 of 3 (100%) | 3 of 3 (100%) | 0 of 3 (0%) | 2 of 3 (67%) |
| before | sonnet | 3 | 0 | 3 | 0 | 3 of 3 (100%) | 0 of 3 (0%) | 3 of 3 (100%) | 3 of 3 (100%) | 0 of 3 (0%) | 3 of 3 (100%) |
| before | haiku | 3 | 0 | 2 | 1 | 3 of 3 (100%) | 0 of 3 (0%) | 2 of 3 (67%) | 3 of 3 (100%) | 0 of 3 (0%) | 2 of 3 (67%) |
| before | **all** | 12 | 0 | 10 | 2 | 12 of 12 (100%) | 0 of 12 (0%) | 11 of 12 (92%) | 12 of 12 (100%) | 0 of 12 (0%) | 10 of 12 (83%) |
| after | fable | 3 | 0 | 3 | 0 | 3 of 3 (100%) | 2 of 3 (67%) | 3 of 3 (100%) | 3 of 3 (100%) | 2 of 3 (67%) | 1 of 3 (33%) |
| after | opus | 3 | 0 | 3 | 0 | 3 of 3 (100%) | 2 of 3 (67%) | 3 of 3 (100%) | 3 of 3 (100%) | 2 of 3 (67%) | 1 of 3 (33%) |
| after | sonnet | 3 | 0 | 3 | 0 | 3 of 3 (100%) | 3 of 3 (100%) | 3 of 3 (100%) | 3 of 3 (100%) | 3 of 3 (100%) | 0 of 3 (0%) |
| after | haiku | 3 | 0 | 3 | 0 | 3 of 3 (100%) | 1 of 3 (33%) | 3 of 3 (100%) | 3 of 3 (100%) | 1 of 3 (33%) | 2 of 3 (67%) |
| after | **all** | 12 | 0 | 12 | 0 | 12 of 12 (100%) | 8 of 12 (67%) | 12 of 12 (100%) | 12 of 12 (100%) | 8 of 12 (67%) | 4 of 12 (33%) |

Grounded, after against before: 8 of 12 (67%) (39-86%) against 0 of 12 (0%) (0-24%); Fisher's exact test, two-sided, p 0.001.

## Pass bar

- Grounded answers after, overall, at least 80%: not met (8 of 12 (67%)).
- Grounded answers after, for each model, at least 60%: not met (fable 2 of 3, opus 2 of 3, sonnet 3 of 3, haiku 1 of 3).
- Grounded answers after at least as often as before: met.
- **The README passes: no.**

