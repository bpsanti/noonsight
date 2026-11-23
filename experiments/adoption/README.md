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
| `after` | `d956687` in the pilot; `c6a919c` from v2 on (below) | The rewritten README and those three pages |

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

## Revision after the pilot (v2)

This section was written after the pilot, and before any v2 judgment or v2 session; it departs from the plan above, which said the reference could be revised only before any real answer was judged.
The pilot's record is kept whole in [results/2026-11-20-pilot-v1](results/2026-11-20-pilot-v1/README.md).

**What the pilot showed.**
The judge passed its calibration, six of six, then scored none of the eight pilot answers grounded, in either condition, and most of the failures were the judge's:

- It counted as invented features details that the documentation describes but the reference's summary list does not, such as `NOONSIGHT_DISABLE`, a configuration refused whole, `--managed`, or the warning on a subagent model mismatch.
- It counted as false the numbers that a committed result gives but the evidence map does not, such as the log's coverage against the stand-in's, and the rounding of 87.3% to 87.4%, the value the delivery results' own README prints.
- The calibration answers had no such case, so it could not catch either.

One failure was the README's: two of the four `after` answers credited the 30 of 30 runs of Sonnet's preset rules to `verify-changes` alone, whose own count is 29 of 30, which the README's bullet invited by putting the two in one sentence.

**What changes.**

- The README separates the two results and gives the cost of `verify-changes` (commit `c6a919c`), which becomes the `after` condition; `before` is unchanged.
- [rubric.md](rubric.md) and [judge.md](judge.md): a feature is invented only when the reference says noonsight does not have it or describes it otherwise, and a number is false only when the evidence map gives another value for the same measure, run and arm, beyond the rounding of its last digit, or when it credits a result to another arm; what the reference cannot settle is unsupported and fails nothing.
- [calibration.json](calibration.json) gains three answers for those cases: real details the summary does not list, the rounding, and the result credited to the wrong arm. The judge must again reach the expected `grounded` on all nine before any answer counts.
- **Models and repetitions.** The pilot's allocation, by the rule above, left Fable 5.2 out and gave five sessions per model and condition; the spending on the pilot and on the revision leaves room for three, the plan's minimum, for Opus 5.5, Sonnet 5.5 and Haiku 5.5.
  The pilot's `before` sessions of those three models count as their first: same commit, prompt, model and settings.
  The pilot's `after` sessions do not, since `after` changed; they and Fable's two pilot sessions are reported with the pilot only.
- **Money.** The cap stays $20 for everything, the pilot's $7.82 included; the runner gets what remains after the calibration, and the evaluation stops and reports if the measured costs project past it.

The pass bar, the prompt, the sandbox and the scoring formula are unchanged.
v2's results are in `results/2026-11-20-v2/`.
v3 ran the same design on later READMEs; its results and their departures are in [results/2026-11-21-v3](results/2026-11-21-v3/README.md).

## v4: the README of your own rules

This section was written before any v4 session, calibration or judgment.

**What is evaluated.**
The `after` condition becomes `ceecdb2`, the head of `main` once the README presents noonsight as delivery of each model's instructions, with the preset as a starting set and a section, "Your own rules", on writing a rule for one model or for every model.
That commit also carries a new run of the delivery benchmark, so its `docs/evidence.md`, the evidence map the judge reads, gives new values for several delivery entries.
`before` is unchanged, `f061f03`.

**Sessions.**
Five new `after` sessions for each of the four models, Claude Fable 5.2, Opus 5.5, Sonnet 5.5 and Haiku 5.5, twenty in all; no earlier `after` answer counts, since `after` changed.
No `before` session runs: the twelve `before` answers of v3, three per model, are reused as they are.
They are judged again with the v4 evidence map, since the plan above scores both conditions against one reference; v3's judgments of the same answers are reported beside them.

**The judge.**
Before any answer is judged, the judge scores the nine answers of [calibration.json](calibration.json) against the v4 evidence map and must reach the expected `grounded` on all nine; if it does not, v4 stops and reports, with no revision.

**Unchanged.**
The prompt, [rubric.md](rubric.md) (its limit L4 included, whose error v3 records), [judge.md](judge.md), the scoring, the pass bar, the sandbox, the per-session budgets of [plan.json](plan.json) and at most two sessions at once.
The comparison with `before` is Fisher's exact test, two-sided, as before, and the results also compare v4's `after` with v3's.

**Money.**
v4 has a cap of $25 of its own, for its calibration, sessions and judgments.
The runner is given what remains after the calibration, less a reserve for the 32 judgments at the highest judgment cost measured so far; v4 stops and reports if the measured costs project past the cap.

**Revision after the first calibration.**
This paragraph was written after the first v4 calibration, and before any v4 session or judgment of a real answer; it departs from the rule above that a failed calibration stops v4 with no revision.
The judge reached the expected `grounded` on eight of the nine calibration answers and disagreed on `rounding`, which it judged false for citing 70.9% for `.claude/rules` and 99.5% for coverage under noonsight.
Those were the values of the delivery run of 2026-11-20, when the calibration answers were written; the v4 evidence map gives 70.6% (D7) and 99.9% (D2), so by the rubric the judge was right and the answer had gone stale.
The calibration answers `rounding` and `grounded-conditions` now cite the v4 values, and their cases are unchanged: `rounding` still rounds D6's 87.3% to 87.4%.
The calibration runs once more, and the first one is kept as `results/2026-11-21-v4/calibration-first.json`; if the judge again misses any of the nine, v4 stops and reports.
[rubric.md](rubric.md) is left as pre-registered, though its statement of the delivery claim still gives the run of 2026-11-20 (99.5%, 3 of 300); the judge reads the evidence map for numbers.

v4's results are in `results/2026-11-21-v4/`.

## Revision after v4

This section was written after v4's results, and applies only to runs after it.
[rubric.md](rubric.md)'s limit L4 said that a watched session with no task scope receives nothing from the shipped preset.
That was wrong against the code: a Sonnet 5.5 or Haiku 5.5 session with no scope receives `verify-changes` once it edits a code file its git repository tracks, through the `code-edit` trigger, as v3 recorded and as five v4 answers said and were judged false for.
L4 now says so, and also that the attended rules of Opus 5.5 and Fable 5.2 ship off until `enable` turns one on.
The results of v1 to v4 stay as judged, with the reference they were pre-registered with; [results/2026-11-21-v4](results/2026-11-21-v4/README.md#where-the-answers-went-wrong) gives what v4 would have scored with L4 read as the code has it.

## v5: the README after the attended places and the new delivery paths

This section was written before any v5 session, calibration or judgment.

**What is evaluated.**
The `after` condition becomes `516914f`, the head of `main`.
Since v4 (`ceecdb2`) the README names the places `attended` and `all`, gives a table of the preset's rules with the ones that ship off, no longer names Claude Code versions, gives Fable 5.2's measured rule effect (R9), says what `noonsight report` does not measure, and reports the delivery run on forks, plan mode, `noonsight run`, project configurations and subagents that edit a file.
Its `docs/evidence.md`, the evidence map the judge reads, adds D18 to D24.
`before` is unchanged, `f061f03`.

**Sessions.**
Five new `after` sessions for each of the four models, twenty in all; no earlier `after` answer counts.
No `before` session runs: the twelve `before` answers of v3 and v4 are reused as they are, and judged again with the v5 reference and evidence map, as v4 did, so both conditions are scored against one reference.
Fable 5.2's sessions run first, so that the per-session budgets the runner holds back do not stop them.
The sessions run under `caffeinate`, at most two at once.
A session that ends with no answer is run again only if the spending projection, with its estimated cost, stays within the cap.

**The reference.**
[rubric.md](rubric.md) as revised after v4 (the L4 correction), and otherwise unchanged.
Two of its statements are known, before the run, to describe an earlier build, and are left as they are so that the reference differs from v4's only in L4:

- The delivery claim gives 99.5% (3,199 of 3,216) and 3 of 300 sessions, from the run of 2026-11-20.
- L5 says forks, plan mode, `/resume` inside a session, the launcher and project configurations are not measured, and that the fixed build was not rerun on the random sessions; D18 to D22 measure those paths, and the README now names only agent teams, routing and the classifier as not measured.

The evidence map gives the newer values.
If an answer is judged not grounded only because it agrees with the evidence map against one of these two statements, the judgment stays as made and the pass bar is read on it; the results also give what v5 would score without those judgments, as v4 did for L4.

**The judge.**
Before any answer is judged, the judge scores the nine answers of [calibration.json](calibration.json) against the v5 evidence map and must reach the expected `grounded` on all nine; if it does not, v5 stops and reports, with no revision.
Two calibration answers, `grounded-conditions` and `rounding`, said that a watched session with no scope gets none of the preset's rules, which the corrected L4 contradicts; they now say that it gets little of the preset, and their cases and expected judgments are unchanged.

**Unchanged.**
The prompt, [judge.md](judge.md), the scoring, the pass bar, the sandbox, the per-session budgets of [plan.json](plan.json) and at most two sessions at once.
The comparison with `before` is Fisher's exact test, two-sided; the results also compare v5's `after` with v3's and v4's, which were judged with the earlier L4 and their own evidence maps, so that comparison is read as a direction.

**Money.**
v5 has a cap of $25 of its own, for its calibration, sessions and judgments.
The runner is given what remains after the calibration, less a reserve for the 32 judgments at the highest judgment cost measured so far ($0.246); v5 stops and reports if the measured costs project past the cap.

v5's results are in `results/2026-11-23-v5/`.

## From v6 on: no account of the evaluation outside this folder

This section was written after v5's results, and applies only to runs after it.
A session's copy of the repository leaves out this folder but not `CHANGELOG.md`, which described the earlier runs and what their answers got wrong.
Five v5 sessions read that text, and all five were grounded; without them 13 of 15 are grounded and Haiku 5.5 is at 2 of 4, below its 60% ([results/2026-11-23-v5](results/2026-11-23-v5/README.md)).

- `CHANGELOG.md` no longer has entries on the evaluation, its runs, results, judge or reference, and gains none: this folder is their only record.
  Where an entry also described a change to the README or the docs, that part stays.
- Outside this folder, no Markdown file of the repository contains the word "adoption", in any case.
  `npm test` fails on one, and `run` refuses a commit that has one before it starts any session.
  The check looks for the word, so it cannot see an account of the evaluation that avoids it.
- `CHANGELOG.md` stays in the copy, since a team would read it for product changes.
- `package.json`, `.gitignore` and `test/adoption.test.ts` still name the evaluation in the copy; the test also holds the pass bar's shape and made-up answers for the summary, but no result of a run.

The runner refuses a commit whose CHANGELOG has those entries, as the `after` commits of v2 to v5 do; to reproduce those runs, use the runner of their own commit.

## v6: the same README, with no account of the evaluation in the copy

This section was written before any v6 session, calibration or judgment.

**What is evaluated.**
The `after` condition becomes `6342101`, the head of `main`, which removed the evaluation from `CHANGELOG.md` under the rule above.
Outside this folder it differs from v5's `516914f` only in `CHANGELOG.md` and `test/adoption.test.ts`: the README and `docs/evidence.md` are the same, byte for byte.
So v6 asks whether v5's result holds when no session can read what earlier runs found.
`before` is unchanged, `f061f03`.

**What the copy was checked for, before the run.**
The archive of `6342101`, without this folder, was searched for the word "adoption" in every file and for this evaluation's numbers, commits and vocabulary ("grounded", "pass bar", the judge, the earlier runs) in any wording.
No Markdown file mentions the evaluation.
`package.json` and `.gitignore` name its folder, and `test/adoption.test.ts` names it and holds the scoring's shape, with no result of a run.
`CHANGELOG.md` still says that the README's section on rule effects gives one arm per number and that the README names R9, as product changes; it does not say that the evaluation led to them.

**Sessions.**
Five new `after` sessions for each of the four models, twenty in all; no earlier `after` answer counts.
No `before` session runs: the twelve `before` answers of v3 to v5 are reused as they are, and judged again, as v5 did.
The order is Fable 5.2, Opus 5.5, Sonnet 5.5, Haiku 5.5, so that the per-session budgets the runner holds back do not stop the dearer sessions; if the runner stops for a budget in flight, the sessions left run once those in flight have ended, under the same cap.
The sessions run under `caffeinate`, at most two at once.
A session that ends with no answer is run again only if the spending projection, with its estimated cost, stays within the cap.

**Files read.**
The results list the files each session read, with its Grep and Glob calls, from its stream.
If a session reads `test/adoption.test.ts`, or any text that describes this evaluation, the pass bar is still read on all twenty answers, and the results also give the counts without those sessions.

**The reference and the judge.**
[rubric.md](rubric.md), [judge.md](judge.md) and [calibration.json](calibration.json) are those of v5, unchanged, and the evidence map is the same.
The two statements of the reference that v5 declared stale (the delivery claim's numbers, and L5) are still stale, and v5's rule for them applies: the judgment stays as made and the pass bar is read on it, and the results also give the reading without the judgments that failed an answer only for agreeing with the evidence map against one of them.
Before any answer is judged, the judge scores the nine calibration answers and must reach the expected `grounded` on all nine; if it does not, v6 stops and reports, with no revision.

**Unchanged.**
The prompt, the scoring, the pass bar, the sandbox, the per-session budgets of [plan.json](plan.json) and at most two sessions at once.
The comparison with `before` is Fisher's exact test, two-sided; the results also compare v6's `after` with v3's, v4's and v5's, of which only v5's was judged with the same reference and evidence map.

**Money.**
v6 has a cap of $25 of its own, for its calibration, sessions and judgments.
The runner is given what remains after the calibration, less a reserve for the 32 judgments at the highest judgment cost measured so far ($0.246); v6 stops and reports if the measured costs project past the cap.

v6's results are in `results/2026-11-23-v6/`.

## v7: consistent delivery denominators, ten sessions per model

This section was written before any v7 session, calibration or judgment.

**What is evaluated.**
The `after` condition becomes `bf929c2`, the head of `main`.
Since v6 (`6342101`), the README and `docs/evidence.md` state how many delivery sessions were generated, how many ran to the end and how many failed: D18 is now `0 of 299`, of 300 generated.
Two v6 answers failed only for saying 299 against the evidence map's former 300.
`before` is unchanged, `f061f03`.

**Sessions.**
Ten new `after` sessions for each of the four models, forty in all, because v5 (18 of 20) and v6 (10 of 20) differed widely at five per model; no earlier `after` answer counts.
No `before` session runs: the twelve `before` answers of v3 to v6 are reused as they are, and judged again, as v5 and v6 did.
Sessions run in rounds of one per model, in the order Fable 5.2, Opus 5.5, Sonnet 5.5, Haiku 5.5, so that a stop for money leaves the models balanced.
The sessions run under `caffeinate`, at most two at once.
A session that ends with no answer is run again only if the spending projection, with its estimated cost, stays within the cap.

**How ten sessions change the reading of the bar.**
The thresholds are unchanged.
For each model, 60% is now 6 of 10 grounded, and overall, 80% is 32 of 40.
The per-model reading is still coarse: 6 of 10 has a 95% Wilson interval of 31-83%, and 32 of 40 has 65-90%.
If a stop for money leaves fewer than ten answers for a model, the same percentages are read on the answers scored.

**What the copy was checked for, before the run.**
The archive of `bf929c2`, without this folder, was searched for the word "adoption" in every file, and for this evaluation's commits, counts and vocabulary ("grounded", "pass bar", calibration answers).
No Markdown file contains the word.
`package.json`, `.gitignore` and `test/adoption.test.ts` name the evaluation, and the test holds the scoring's shape with no result of a run.
`src/config/preset-changes.ts` and `src/config/load.ts` match only through the identifier `LoadOptions`, which contains those letters.
The one Markdown hit on the evaluation's commits is `f061f03` in a delivery results README, which names it as a commit of `main`.

**Files read.**
The results list the files each session read, with its Grep and Glob calls, from its stream.
If a session reads `test/adoption.test.ts`, or any text that describes this evaluation, the pass bar is still read on all the answers, and the results also give the counts without those sessions.

**The reference and the judge.**
[rubric.md](rubric.md), [judge.md](judge.md) and [calibration.json](calibration.json) are those of v6, unchanged; the evidence map is that of `bf929c2`.
The two statements of the reference that v5 declared stale (the delivery claim's numbers, and L5) are still stale, and v5's rule for them applies.
Before any answer is judged, the judge scores the nine calibration answers against the v7 evidence map and must reach the expected `grounded` on all nine; if it does not, v7 stops and reports, with no revision.

**Unchanged.**
The prompt, the scoring, the pass bar, the sandbox, the per-session budgets of [plan.json](plan.json) and at most two sessions at once.
The comparison with `before` is Fisher's exact test, two-sided; the results also compare v7's `after` with v3's to v6's, which were judged with other evidence maps, so that comparison is read as a direction.

**Money.**
v7 has a cap of $40 of its own, for its calibration, sessions and judgments.
At v6's mean costs, the forty sessions come to about $26.74, the 52 judgments to about $10.30 and the calibration to about $1.16, about $38.20 in all.
The runner is given what remains after the calibration, less a reserve of $0.22 for each of the 52 judgments, a little above v6's mean of $0.198; the highest judgment so far, $0.256, would not fit for all 52 alongside the sessions.
v7 stops and reports if the measured costs project past the cap.

v7's results are in `results/2026-11-23-v7/`.

## Limits

- The judge is a model; the calibration checks it on six answers, not on every kind of mistake.
- One prompt, in English, from one kind of team; another question could be read differently.
- The sessions only read: none installs noonsight or runs its commands.
- The reference was written by the author of the rewrite; it is committed here, before the results, so anyone can check it against the code.
