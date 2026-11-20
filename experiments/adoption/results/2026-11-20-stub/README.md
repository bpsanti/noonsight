# Adoption evaluation, 2026-11-20, against the stub

The whole pipeline run against the local stand-in for the Messages API, before any real session: no login, no tokens, and its numbers say nothing about any model.
The commits are the ones the pre-registration names, `f061f03` and `d956687`, and Claude Code is 2.1.330.

- `calibration.json`: the judge's stand-in on the six calibration answers, which must agree on all six, and does.
- `runs.jsonl` and `answers/`: three sessions per model and condition, 24 in all; each copied the repository at its commit without `experiments/adoption`, read `README.md`, and answered with one of the calibration answers in turn.
- `judgments.jsonl` and `summary.md`: each answer judged with that answer's expected judgment, and the summary and pass bar computed from them; the three answers each model played include one grounded, so a third of the answers are grounded and the pass bar is not met, as it must not be.
- `npm run adoption -- estimate` on this folder runs the allocation; the stand-in's costs are the size of a real session's context at list price with no cache, not a projection of real ones.
