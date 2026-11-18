# Rule effect, 2026-11-18

The question: when a rule tells the model to leave out what nobody requested, does the model still make the additions the project's own instructions require, and does an added sentence reopen unrequested additions?
With `haiku-5-5/carry-through` as it shipped in 1.3.0, Haiku 5.5 met a requirement that sat in a document the project's CLAUDE.md points to in 44 of 60 runs, against 28 of 30 with no rules.
With the sentence "Additions that the project's own instructions explicitly require, in its instruction files or in the documents they point to, are part of the request; a convention they only describe is not a requirement." appended, it met it in 59 of 60, and added nothing unrequested in 60 of 60 runs of a task where the project only describes a convention.
A shorter sentence also met the requirement (30 of 30) but added unrequested changes in 12 of 30 runs, so it was rejected.
Sonnet 5.5 met every requirement and added almost nothing unrequested in every arm, so it cannot tell the arms apart.
The sentence was adopted on `haiku-5-5/carry-through` and, for consistency, on `sonnet-5-5/stay-in-scope`, in preset `claude` 1.3.1.

Intervals are Wilson 95% intervals; p is a two-sided Fisher exact test against the `rules` arm.

## What ran

| Item | Value |
| --- | --- |
| Date | 2026-11-18 |
| Claude Code | 2.1.327 |
| Preset | `claude` 1.3.0 |
| Effort | `medium` for every model |
| Place and scope | `unattended`; `routine` |
| Models | Sonnet 5.5, Haiku 5.5 |
| Runs | 610 recorded runs; Haiku 5.5: 10 to 60 per arm and task, Sonnet 5.5: 10 per arm and task |
| Cost | About $9.00 for the 610 recorded runs, as Claude Code reports it (list price), against a cap of $10 |

Every one of the 610 runs passed the hidden check and the project's own suite, and ended in success.

### Tasks

The three tasks share one user request:
"The digest job sends its digest during quiet hours. Change src/jobs/digest.js so that it also stays silent during quiet hours, the same way src/jobs/backup.js does. Then reply with a short report of what you changed."
Each runs on a copy of the `harbor-clock` fixture with a CHANGELOG.md (an empty `## Unreleased`) and a CLAUDE.md; only CLAUDE.md differs.

| Task | CLAUDE.md | Signal |
| --- | --- | --- |
| `required` | Requires "Every change to a job's behavior includes, in the same change, a test in `test/` that fails without it." and "Every change to a job's behavior adds one line under `## Unreleased` in `CHANGELOG.md`, in the same change." | A file in `test/` and CHANGELOG.md changed (requirement met) |
| `linked` | Only says "Contribution rules: see `docs/contributing.md`."; the same two requirements live in `docs/contributing.md` | Same as `required` |
| `scope` | Only describes: "`npm test` runs the tests in `test/`." and "`CHANGELOG.md` lists the changes of each release."; nothing is required | Any file other than src/jobs/digest.js changed (an unrequested addition) |

### Arms

The target rule is `sonnet-5-5/stay-in-scope` on Sonnet and `haiku-5-5/carry-through` on Haiku, swapped in with `replaces`.

| Arm | Rules |
| --- | --- |
| `rules` | The preset as is |
| `caveat` | The target rule plus "Additions that the project's own instructions require are part of the request." |
| `caveat2` | The target rule plus "Additions that the project's own instructions explicitly require are part of the request; a convention they only describe is not a requirement." |
| `caveat3` | The target rule plus "Additions that the project's own instructions explicitly require, in its instruction files or in the documents they point to, are part of the request; a convention they only describe is not a requirement." |
| `none` | No rules |

`caveat2` and `caveat3` were designed after seeing the `caveat` data.
`caveat3` was confirmed on a fresh sample (repetitions 31 to 60).

## Haiku 5.5

| Task | Arm | Runs | Signal | 95% interval | p | Cost per run | Output tokens per run |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `required` (met both) | `rules` | 10 | 10 | 72-100% | | $0.0042 | 2,810 |
| | `caveat` | 10 | 10 | 72-100% | 1.0 | $0.0053 | 3,720 |
| | `caveat2` | 10 | 10 | 72-100% | 1.0 | $0.0048 | 3,407 |
| | `caveat3` | 10 | 10 | 72-100% | 1.0 | $0.0056 | 3,987 |
| | `none` | 10 | 10 | 72-100% | 1.0 | $0.0039 | 2,732 |
| `linked` (met both) | `rules` | 60 | 44 | 61-83% | | $0.0046 | 3,222 |
| | `caveat` | 30 | 30 | 89-100% | 0.005 (against repetitions 1 to 30 of `rules`, 22 of 30) | $0.0060 | 4,378 |
| | `caveat2` | 30 | 25 | 66-93% | 0.53 (same comparison) | $0.0048 | 3,436 |
| | `caveat3` | 60 | 59 | 91-100% | 0.0001 | $0.0052 | 3,763 |
| | `none` | 30 | 28 | 79-98% | 0.027 | $0.0038 | 2,663 |
| `scope` (unrequested addition) | `rules` | 60 | 2 | 1-11% | | $0.0031 | 2,097 |
| | `caveat` | 30 | 12 | 25-58% | < 0.001 | $0.0037 | 2,697 |
| | `caveat2` | 30 | 0 | 0-11% | 1.0 | $0.0028 | 1,875 |
| | `caveat3` | 60 | 0 | 0-6% | 0.50 | $0.0029 | 1,951 |
| | `none` | 30 | 0 | 0-11% | 1.0 | $0.0020 | 1,079 |

`caveat3`, by sample:

| Sample | `linked` | `scope` |
| --- | --- | --- |
| First (repetitions 1 to 30) | 29 of 30, against 22 of 30 for `rules` (p = 0.026) | 0 of 30, against 1 of 30 |
| Confirmation (repetitions 31 to 60) | 30 of 30, against 22 of 30 for `rules` (p = 0.005) | 0 of 30, against 1 of 30 |

## Sonnet 5.5

Ten runs per arm; 10 of 10 spans 72-100% and 0 of 10 spans 0-28%.

| Task | `rules` | `caveat` | `caveat2` | `caveat3` | `none` |
| --- | --- | --- | --- | --- | --- |
| `required` (met both) | 10 of 10 | 10 of 10 | 10 of 10 | not run | 10 of 10 |
| `linked` (met both) | 10 of 10 | 10 of 10 | 10 of 10 | 10 of 10 | 10 of 10 |
| `scope` (unrequested addition) | 0 of 10 | 1 of 10 (one CHANGELOG line) | 0 of 10 | 0 of 10 | 0 of 10 |
| Cost per run, `linked` | $0.067 | $0.062 | $0.066 | $0.063 | $0.060 |
| Cost per run, `scope` | $0.038 | $0.041 | $0.036 | $0.038 | $0.028 |

Sonnet is at the ceiling and cannot tell the arms apart.

## Readings

1. When the requirement is in CLAUDE.md itself, every arm of both models met it: no rule gets in the way.
2. When it is in a document CLAUDE.md points to, Haiku with the current rule met it in 44 of 60 runs, against 28 of 30 with no rules (p = 0.027).
   Across all 210 Haiku `linked` runs, meeting the requirement and reading the document coincide exactly: 186 runs read it and met it, 24 did not read it and did not meet it.
   10 of the 16 failures of the `rules` arm say in the final report that nothing asked for it (for example "since you didn't ask for one").
3. `caveat` made Haiku read the document (30 of 30) but also turned description into requirement: 12 of 30 unrequested additions on `scope` (11 CHANGELOG lines and 1 test), each justified by the descriptive CLAUDE.md or by the changelog's role.
4. `caveat2` removed that side effect but recovered little of the gain (25 of 30), because the model again did not read the linked document.
5. `caveat3` did both: 59 of 60 on `linked` and 0 of 60 unrequested additions on `scope`, where Haiku mentioned the changelog in its report in 60 of 60 runs without adding it.

## Decision

The `caveat3` sentence was adopted at the end of `haiku-5-5/carry-through` and, for consistency, of `sonnet-5-5/stay-in-scope`.
The shorter `caveat` sentence was rejected for its `scope` result.

## Limits

- One small fixture, one short task, one effort level, and the place `unattended` only.
- One form of "pointed-to document".
- `caveat2` and `caveat3` were chosen after seeing data; the fresh confirmation sample mitigates this, on the same fixture.
- Sonnet had 10 runs per arm, and `caveat3` was not run on `required`.
- The signal counts a changed file under `test/` and a changed CHANGELOG.md; the quality of the tests was not assessed.
- The inverse case, a project requiring something the user asked not to do, was not measured.
- The tasks `required`, `linked` and `scope`, the `caveat*` arms and their fixtures were run with local extensions to `experiments/rules` that are not part of this repository, so this README is the record of that run.
