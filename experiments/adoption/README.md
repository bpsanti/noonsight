# Adoption evaluation

Would an agent that reads this repository recommend adopting noonsight, and for the right reasons?
This folder asks fresh Claude Code sessions, each given only a clean copy of the repository, whether a team should adopt the tool, and scores each answer against what the code and the committed results support.
It compares two versions of the repository's documentation: the README before its rewrite, and after.

What it measures is how the repository is read: whether the verdict rests on true reasons, whether the answer states what noonsight guarantees correctly, names real limits, and invents no feature.
A verdict to adopt resting on a wrong reason is a failure; a verdict not to adopt resting on true reasons is not.
It does not measure whether noonsight is worth adopting.

This README is the pre-registration: the prompt, the sessions, the scoring, the judge, the pass bar and the spending rule are fixed here before any real session runs, and the commit that adds this file comes before the commit that adds the first results.

## The two conditions

| Condition | Commit | What differs |
| --- | --- | --- |
| `before` | `f061f03`, `main` before the rewrite | The README as it was, and no `docs/evidence.md`, `docs/sources.md` or `docs/usage.md` |
| `after` | `d956687`, the rewrite with the recording of its first-delivery session | The rewritten README and those three pages |

Each session gets `git archive` of its commit, without this folder, so no session can read the prompt, the reference or the scoring.
The code is the same in both but for one usage line.

## A session

- **Sandbox.** An empty home and Claude Code configuration directory, so no person's settings, hooks, `CLAUDE.md` or memory reach it; the working directory's name says nothing of the experiment, the condition or the model; `NOONSIGHT_DISABLE=1`.
- **Prompt.** [prompt.md](prompt.md), the same for every session: a team that uses several Claude models asks whether to adopt the tool in the current directory, and gives the format of the answer.
  It does not mention the README, an evaluation, or any outcome.
- **Models.** Claude Fable 5.2, Opus 5.5, Sonnet 5.5 and Haiku 5.5, at `medium` effort.
- **Tools.** Read, Grep and Glob only: the session reads the repository and runs nothing.
- **Command.** `claude -p` with `--setting-sources project,local`, `--strict-mcp-config`, `--disable-slash-commands`, `--no-session-persistence`, and a budget per session from [plan.json](plan.json) (Fable $4, Opus $2.50, Sonnet $1.20, Haiku $0.40); a session cut short by its budget or its 15-minute limit has no answer and is not scored.
- **Recorded.** Each run's verdict, cost, turns, tools and the files it read go to `runs.jsonl`, and its answer to `answers/`; the session's stream stays out of the repository.

## Scoring

A judge reads each answer with [judge.md](judge.md), [rubric.md](rubric.md) and `docs/evidence.md` of the `after` commit, and returns a JSON judgment.
The reference is the same for both conditions: it describes the code and the committed results, not either README.
From the judgment, [run.ts](run.ts) (`score`) computes:

| Measure | An answer has it when |
| --- | --- |
| Claim correct | The judge reads its statement of what noonsight guarantees as `correct`: delivery of each model's rules, not obedience, enforcement or perfection |
| No false reason | No reason is `false`, and no other statement is contradicted by the reference or the evidence map |
| No invented feature | It attributes to noonsight no feature the reference does not list |
| Names a limit | It names at least one of the real limits `L1` to `L11` of the reference |
| **Grounded** | All four |
| Adopt on wrong grounds | Its verdict is `adopt` or `adopt with conditions`, and it is not grounded |

The verdict itself is reported, not scored.

### The judge

Claude Opus 5.5 at `medium` effort, through `claude -p` with no tools, in the same kind of sandbox; an answer without a valid judgment is judged once more, then left unscored.
Before any real answer is judged, the judge scores the six answers of [calibration.json](calibration.json), written by hand with the scoring the reference gives them, and must reach the same `grounded` on all six.
If it does not, the run stops there; the reference or the judge's instructions may be revised once, before any real answer is judged, and the revision is recorded with the results.

## Pass bar

The rewritten README passes when, among the `after` answers that were scored:

1. at least 80% are grounded;
2. for each model, at least 60% are grounded;
3. the grounded share is at least the `before` share.

The results also give the verdicts, each measure by condition and model, the difference between the conditions with Fisher's exact test, and which files the sessions read.
The samples are small, so the comparison between the conditions is read as a direction; the pass bar is read on its own terms.

## How many sessions, and what they cost

Every cost here is what Claude Code reports, at list price, from the account whose OAuth token `--token-file` names.
Everything (calibration, sessions and judgments) stays within a cap of $20, and at most two sessions run at once.

1. **Calibration**: the judge on the six calibration answers.
2. **Pilot**: one session per model and condition, eight in all, judged.
3. **Allocation** (`estimate`, `allocate` in [run.ts](run.ts)): from the pilot's mean cost per session of each model and the mean cost of a judgment, the number of sessions per model and condition is the largest from 5 down to 3 for which the pilot, the remaining sessions, their judgments and the calibration fit in the cap.
   If none fits, Fable 5.2 is left out and the same is tried without it; if none fits then, the evaluation stops and reports the projection.
4. **The rest of the sessions**, judged, and the summary.

The runner refuses to start a session whose budget would take the money spent, plus the budgets of the sessions in flight, past the cap.

## Running it

```bash
npm run adoption -- calibrate --after <commit> --out <dir> --token-file <file>
npm run adoption -- run --pilot --before f061f03 --after <commit> --out <dir> --token-file <file>
npm run adoption -- judge <dir> --token-file <file>
npm run adoption -- estimate <dir>
npm run adoption -- run --reps <n> --models <list> --before f061f03 --after <commit> --out <dir> --token-file <file>
npm run adoption -- judge <dir> --token-file <file>
```

`--stub` in place of `--token-file` runs every step against a local stand-in for the Messages API, with no login and no tokens: each session reads the README and answers with one of the calibration answers, and the judge answers with that answer's expected judgment, so the sandbox, the copy of the repository, the parsing, the scoring and the summary are checked end to end.
`npm test` checks the scoring, the verdict parsing, the allocation and the summary without Claude Code (`test/adoption.test.ts`).

## Limits

- The judge is a model; the calibration checks it on six answers, not on every kind of mistake.
- One prompt, in English, from one kind of team; another question could be read differently.
- The sessions only read: none installs noonsight or runs its commands.
- The reference was written by the author of the rewrite; it is committed here, before the results, so anyone can check it against the code.
