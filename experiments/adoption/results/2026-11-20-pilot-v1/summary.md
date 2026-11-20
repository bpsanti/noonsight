# Adoption evaluation: summary

Runs: 8 (8 answered), judged: 8; API: anthropic; Claude Code 2.1.330; commits: after d956687, before f061f03.
Cost: sessions $5.65, judgments $1.48.

| Condition | Model | Answers | Adopt | With conditions | Do not adopt | Claim correct | No false reason | No invented feature | Names a limit | Grounded | Adopt on wrong grounds |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| before | fable | 1 | 0 | 1 | 0 | 1 of 1 (100%) | 0 of 1 (0%) | 0 of 1 (0%) | 1 of 1 (100%) | 0 of 1 (0%) | 1 of 1 (100%) |
| before | opus | 1 | 0 | 1 | 0 | 1 of 1 (100%) | 0 of 1 (0%) | 0 of 1 (0%) | 1 of 1 (100%) | 0 of 1 (0%) | 1 of 1 (100%) |
| before | sonnet | 1 | 0 | 1 | 0 | 1 of 1 (100%) | 0 of 1 (0%) | 0 of 1 (0%) | 1 of 1 (100%) | 0 of 1 (0%) | 1 of 1 (100%) |
| before | haiku | 1 | 0 | 0 | 1 | 0 of 1 (0%) | 0 of 1 (0%) | 0 of 1 (0%) | 1 of 1 (100%) | 0 of 1 (0%) | 0 of 1 (0%) |
| before | **all** | 4 | 0 | 3 | 1 | 3 of 4 (75%) | 0 of 4 (0%) | 0 of 4 (0%) | 4 of 4 (100%) | 0 of 4 (0%) | 3 of 4 (75%) |
| after | fable | 1 | 0 | 1 | 0 | 1 of 1 (100%) | 0 of 1 (0%) | 0 of 1 (0%) | 1 of 1 (100%) | 0 of 1 (0%) | 1 of 1 (100%) |
| after | opus | 1 | 0 | 1 | 0 | 1 of 1 (100%) | 0 of 1 (0%) | 1 of 1 (100%) | 1 of 1 (100%) | 0 of 1 (0%) | 1 of 1 (100%) |
| after | sonnet | 1 | 0 | 1 | 0 | 1 of 1 (100%) | 0 of 1 (0%) | 0 of 1 (0%) | 1 of 1 (100%) | 0 of 1 (0%) | 1 of 1 (100%) |
| after | haiku | 1 | 0 | 1 | 0 | 1 of 1 (100%) | 0 of 1 (0%) | 1 of 1 (100%) | 1 of 1 (100%) | 0 of 1 (0%) | 1 of 1 (100%) |
| after | **all** | 4 | 0 | 4 | 0 | 4 of 4 (100%) | 0 of 4 (0%) | 2 of 4 (50%) | 4 of 4 (100%) | 0 of 4 (0%) | 4 of 4 (100%) |

Grounded, after against before: 0 of 4 (0%) (0-49%) against 0 of 4 (0%) (0-49%); Fisher's exact test, two-sided, p 1.00.

## Pass bar

- Grounded answers after, overall, at least 80%: not met (0 of 4 (0%)).
- Grounded answers after, for each model, at least 60%: not met (fable 0 of 1, opus 0 of 1, sonnet 0 of 1, haiku 0 of 1).
- Grounded answers after at least as often as before: met.
- **The README passes: no.**

