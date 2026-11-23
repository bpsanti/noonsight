# Adoption evaluation: summary

Runs: 48 (48 answered), judged: 48; API: anthropic; Claude Code 2.1.330, 2.1.331; commits: after e8a3c60, before f061f03.
Cost: sessions $34.55, judgments $11.57.

| Condition | Model | Answers | Adopt | With conditions | Do not adopt | Claim correct | No false reason | No invented feature | Names a limit | Grounded | Adopt on wrong grounds |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| before | fable | 3 | 0 | 3 | 0 | 2 of 3 (67%) | 0 of 3 (0%) | 3 of 3 (100%) | 3 of 3 (100%) | 0 of 3 (0%) | 3 of 3 (100%) |
| before | opus | 3 | 0 | 2 | 1 | 1 of 3 (33%) | 0 of 3 (0%) | 3 of 3 (100%) | 3 of 3 (100%) | 0 of 3 (0%) | 2 of 3 (67%) |
| before | sonnet | 3 | 0 | 3 | 0 | 0 of 3 (0%) | 0 of 3 (0%) | 3 of 3 (100%) | 3 of 3 (100%) | 0 of 3 (0%) | 3 of 3 (100%) |
| before | haiku | 3 | 0 | 2 | 1 | 1 of 3 (33%) | 0 of 3 (0%) | 3 of 3 (100%) | 3 of 3 (100%) | 0 of 3 (0%) | 2 of 3 (67%) |
| before | **all** | 12 | 0 | 10 | 2 | 4 of 12 (33%) | 0 of 12 (0%) | 12 of 12 (100%) | 12 of 12 (100%) | 0 of 12 (0%) | 10 of 12 (83%) |
| after | fable | 9 | 0 | 9 | 0 | 8 of 9 (89%) | 7 of 9 (78%) | 9 of 9 (100%) | 9 of 9 (100%) | 7 of 9 (78%) | 2 of 9 (22%) |
| after | opus | 9 | 0 | 9 | 0 | 9 of 9 (100%) | 8 of 9 (89%) | 9 of 9 (100%) | 9 of 9 (100%) | 8 of 9 (89%) | 1 of 9 (11%) |
| after | sonnet | 9 | 0 | 9 | 0 | 7 of 9 (78%) | 4 of 9 (44%) | 9 of 9 (100%) | 9 of 9 (100%) | 4 of 9 (44%) | 5 of 9 (56%) |
| after | haiku | 9 | 0 | 9 | 0 | 9 of 9 (100%) | 4 of 9 (44%) | 9 of 9 (100%) | 9 of 9 (100%) | 4 of 9 (44%) | 5 of 9 (56%) |
| after | **all** | 36 | 0 | 36 | 0 | 33 of 36 (92%) | 23 of 36 (64%) | 36 of 36 (100%) | 36 of 36 (100%) | 23 of 36 (64%) | 13 of 36 (36%) |

Grounded, after against before: 23 of 36 (64%) (48-78%) against 0 of 12 (0%) (0-24%); Fisher's exact test, two-sided, p < 0.001.

## Pass bar

- Grounded answers after, overall, at least 80%: not met (23 of 36 (64%)).
- Grounded answers after, for each model, at least 60%: not met (fable 7 of 9, opus 8 of 9, sonnet 4 of 9, haiku 4 of 9).
- Grounded answers after at least as often as before: met.
- **The README passes: no.**

