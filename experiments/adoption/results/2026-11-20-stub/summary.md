# Adoption evaluation: summary

Runs: 24 (24 answered), judged: 24; API: stub; Claude Code 2.1.330; commits: after d956687, before f061f03.
Cost: sessions $0.89, judgments $0.62.

| Condition | Model | Answers | Adopt | With conditions | Do not adopt | Claim correct | No false reason | No invented feature | Names a limit | Grounded | Adopt on wrong grounds |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| before | fable | 3 | 2 | 1 | 0 | 2 of 3 (67%) | 1 of 3 (33%) | 2 of 3 (67%) | 3 of 3 (100%) | 1 of 3 (33%) | 2 of 3 (67%) |
| before | opus | 3 | 2 | 1 | 0 | 2 of 3 (67%) | 1 of 3 (33%) | 2 of 3 (67%) | 3 of 3 (100%) | 1 of 3 (33%) | 2 of 3 (67%) |
| before | sonnet | 3 | 2 | 1 | 0 | 2 of 3 (67%) | 1 of 3 (33%) | 2 of 3 (67%) | 3 of 3 (100%) | 1 of 3 (33%) | 2 of 3 (67%) |
| before | haiku | 3 | 2 | 1 | 0 | 2 of 3 (67%) | 1 of 3 (33%) | 2 of 3 (67%) | 3 of 3 (100%) | 1 of 3 (33%) | 2 of 3 (67%) |
| before | **all** | 12 | 8 | 4 | 0 | 8 of 12 (67%) | 4 of 12 (33%) | 8 of 12 (67%) | 12 of 12 (100%) | 4 of 12 (33%) | 8 of 12 (67%) |
| after | fable | 3 | 2 | 1 | 0 | 2 of 3 (67%) | 1 of 3 (33%) | 2 of 3 (67%) | 3 of 3 (100%) | 1 of 3 (33%) | 2 of 3 (67%) |
| after | opus | 3 | 2 | 1 | 0 | 2 of 3 (67%) | 1 of 3 (33%) | 2 of 3 (67%) | 3 of 3 (100%) | 1 of 3 (33%) | 2 of 3 (67%) |
| after | sonnet | 3 | 2 | 1 | 0 | 2 of 3 (67%) | 1 of 3 (33%) | 2 of 3 (67%) | 3 of 3 (100%) | 1 of 3 (33%) | 2 of 3 (67%) |
| after | haiku | 3 | 2 | 1 | 0 | 2 of 3 (67%) | 1 of 3 (33%) | 2 of 3 (67%) | 3 of 3 (100%) | 1 of 3 (33%) | 2 of 3 (67%) |
| after | **all** | 12 | 8 | 4 | 0 | 8 of 12 (67%) | 4 of 12 (33%) | 8 of 12 (67%) | 12 of 12 (100%) | 4 of 12 (33%) | 8 of 12 (67%) |

Grounded, after against before: 4 of 12 (33%) (14-61%) against 4 of 12 (33%) (14-61%); Fisher's exact test, two-sided, p 1.00.

## Pass bar

- Grounded answers after, overall, at least 80%: not met (4 of 12 (33%)).
- Grounded answers after, for each model, at least 60%: not met (fable 1 of 3, opus 1 of 3, sonnet 1 of 3, haiku 1 of 3).
- Grounded answers after at least as often as before: met.
- **The README passes: no.**

