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

## v8: one current value per fact

This section was written before any v8 session, calibration or judgment.

**What is evaluated.**
The `after` condition becomes `e8a3c60`, the head of `main`.
Since v7 (`bf929c2`) each measured fact has one current value with its Claude Code version, superseded entries are marked as history, the evidence map lists every run and its version, and D25 to D34, R14 and R15 are added.
`before` is unchanged, `f061f03`.

**Sessions.**
Ten new `after` sessions for each of the four models, forty in all, under the same settings as v7, in rounds of one per model in the order Fable 5.2, Opus 5.5, Sonnet 5.5, Haiku 5.5, under `caffeinate` and at most two at once; no earlier `after` answer counts.
No `before` session runs: the twelve `before` answers of v3 to v7 are reused as they are.
A session that ends with no answer is run again only if the spending projection, with its estimated cost, stays within the cap.

**The reference.**
[rubric.md](rubric.md) is changed in the two statements that v5 to v7 declared stale, so that it agrees with the evidence map of `e8a3c60`, and in nothing else:

- The delivery claim's measurement was 99.5% (3,199 of 3,216) and 3 of 300 sessions, on Claude Code 2.1.328; it is now D19, 100% (3,090 of 3,090), and D18, 0 of 299 sessions that ran to the end of 300 generated, on 2.1.330.
- L5 no longer says that forks, plan mode, `/resume` inside a session, the launcher and project configurations are not measured, or that the fixed build was not rerun; it now names agent teams, routing and the classifier as not measured, the known limits for subagents, and the nine failures fixed before the current run.

The rule for numbers is unchanged: a number is false when the map gives another value for the same measure, run and arm, so a superseded value cited with its own run is true, and how the judge reads one cited as current is reported, not fixed in advance.
The list of hooks and places in the reference is left as it was, though the code now also has a `PermissionRequest` hook and calls the watched place `attended`; a failure that rests only on those is reported as the reference's error.
[judge.md](judge.md) is unchanged.
Two calibration answers, `grounded-conditions` and `rounding`, quoted superseded values (99.9%, 87.4% and 70.6%); they now quote the current ones (100%, 88.3% as the rounding case of D25's 88.2%, and D26's 76.3%), and their cases and expected judgments are unchanged.
Before any answer is judged, the judge scores the nine calibration answers against the v8 evidence map and must reach the expected `grounded` on all nine; if it does not, v8 stops and reports, with no revision.

**What the copy was checked for, before the run.**
The archive of `e8a3c60`, without this folder, was searched for the word "adoption" in every file, and for this evaluation's commits, counts and vocabulary.
No Markdown file contains the word.
`package.json`, `.gitignore` and `test/adoption.test.ts` name the evaluation, `test/evidence.test.ts` excludes its folder from a check, and `src/config/preset-changes.ts` and `src/config/load.ts` match only through `LoadOptions`.
The one Markdown hit on the evaluation's commits is `f061f03` in a delivery results README, which names it as a commit of `main`; the counts and vocabulary that match belong to other experiments.

**Files read.**
As in v7: the results list the files each session read, and if a session reads `test/adoption.test.ts` or any text that describes this evaluation, the pass bar is still read on all the answers and the counts are also given without those sessions.

**Money.**
v8 has a cap of $40 of its own, for its calibration, sessions and judgments, on the account of the earlier runs from v4 to v6.
The evidence map is about 13 KB longer than in v7, so each session and judgment costs more and the cap may not hold all of v7's plan.
The runner is given what remains of $40 after the calibration and the judgments of the `after` answers still owed, at the highest judgment cost measured in the calibration, plus 10%.
The sessions left after that run one at a time, each only if the measured spending, its whole budget and the `after` judgments still owed stay within $40.
The `before` answers are judged again with the v8 reference last, and only if their twelve judgments, at that same reserve, also stay within $40; if they do not, v7's judgments of the same answers stand in for them, and the results say that the `before` side was judged with v7's reference.
If a round does not fit whole, it is dropped for scoring, so that every model keeps the same number of answers, and the percentages are read on the answers scored.
v8 stops and reports if the measured costs project past the cap.

**Unchanged.**
The prompt, the scoring, the pass bar, the sandbox, the per-session budgets of [plan.json](plan.json) and at most two sessions at once.
The results also compare v8's `after` with v5's to v7's, read as a direction, since the judge's reference and evidence map differ.

**Revision after the first calibration.**
This paragraph was written after the first v8 calibration, and before any v8 session or judgment of a real answer; it departs from the rule above that a failed calibration stops v8 with no revision.
The judge reached the expected `grounded` on eight of the nine calibration answers and disagreed on `unlisted-real-details`, which it judged false for crediting the comparison of the decision log with the stand-in API to the benchmark pilot.
That comparison is the delivery benchmark's, and the evidence map of `e8a3c60` is the first to describe the pilot (B1, B2, added by https://github.com/bpsanti/noonsight/pull/68), so the judge was right and the answer had always named the wrong experiment.
The sentence now says "delivery benchmark"; nothing else of the answer, its case or its expected judgment changes, nor do the other eight answers, the reference and the judge's instructions.
The calibration runs once more on all nine, and the first one is kept as `results/2026-11-23-v8/calibration-first.json`; if the judge again misses any of the nine, v8 stops and reports.
Both calibrations count toward the cap.

**Revision of the money rule.**
This paragraph was written after the second calibration, nine of nine, and before any v8 session or judgment of a real answer; where it differs from "Money" above, it replaces it.
The cap is $45, since the two calibrations cost $3.19 and a judgment now costs more than in v7.
The plan is whole: ten `after` sessions per model, and the twelve `before` answers judged again.
The reserve for each judgment is $0.27, above the $0.21 the rule above gives, because real answers cost more to judge than calibration answers.
The runner is given $27.77 for sessions, which is $45 less the calibrations and 52 judgments at that reserve.
If its guard stops it with sessions left, the answers held and the twelve `before` answers are judged, and then the sessions left run one at a time, each only if calibrations, sessions, judgments so far, its whole budget and $0.27 for each judgment owed stay within $45; that decision reads money and no score.
A round that does not fit whole is dropped for scoring.
v8 stops and reports if the running projection passes $45.

v8's results are in `results/2026-11-23-v8/`.

## v9: the README that gives each result its arm, run and version, installed from npm

This section was written before any v9 session, calibration or judgment.

**What is evaluated.**
The `after` condition becomes `c02c926`, the head of `main`.
Since v8 (`e8a3c60`) the README gives each result in one table with its arm, runs, cost and Claude Code version, and follows the guarantee with its known limits (https://github.com/bpsanti/noonsight/pull/71); noonsight is installed from npm, or as a Claude Code plugin (https://github.com/bpsanti/noonsight/pull/72, https://github.com/bpsanti/noonsight/pull/69); and `docs/evidence.md` adds R16 to R19, with no existing value changed.
`before` is unchanged, `f061f03`.

**Sessions.**
As in v8: ten new `after` sessions for each of the four models, forty in all, in rounds of one per model in the order Fable 5.2, Opus 5.5, Sonnet 5.5, Haiku 5.5, under `caffeinate` and at most two at once; no earlier `after` answer counts, and no `before` session runs.
A session that ends with no answer is run again only if the spending projection, with its estimated cost, stays within the cap.
The sessions and the judge run on the `claude` of one version, 2.1.331, through a `PATH` entry that points at that version's binary, so an update of the host's `claude` during the run cannot change it, as one did in v8.

**The reference.**
The evidence map's current values are the ones the reference already gave, D18 and D19 with their Claude Code version, so none of its numbers changes.
Four statements that the repository at `c02c926` contradicts, or that v8 recorded as the reference's errors, are changed, and nothing else:

- L7 said that noonsight is not published on npm and is installed from a clone; it now says that 0.1.0 is its first usable version on npm, by a single maintainer.
- L5 gains the limit that `/fork` is not available in a session `noonsight run` started with rules, which the README and `docs/launcher.md` state; a v8 answer was judged false for a version of it because the reference did not.
- The list of what noonsight has names the two ways to install it, npm and the plugin, and the `PermissionRequest` hook.
- The places are given as `attended` (earlier `session`), `unattended`, `subagent` and `all`, as the code has them.

[judge.md](judge.md) is unchanged.
Four calibration answers (`grounded-conditions`, `grounded-decline`, `rounding` and `obedience-claim`) said that noonsight is pre-release, three of them that it is installed from a clone; they now say that it is an early release, 0.1.0.
Their cases and expected judgments are unchanged.
Before any answer is judged, the judge scores the nine calibration answers against the v9 evidence map and must reach the expected `grounded` on all nine.
If it misses any, and the cause is a sentence of a calibration answer that the repository contradicts, that sentence is corrected once, declared here before any session, and the calibration runs once more; otherwise, or if the second misses any, v9 stops and reports.

**What the copy was checked for, before the run.**
The archive of `c02c926`, without this folder, was searched for the word "adoption" in every file, and for this evaluation's commits, counts and vocabulary ("grounded", "pass bar", calibration answers, "wrong grounds").
No Markdown file contains the word.
`package.json`, `.gitignore` and `test/adoption.test.ts` name the evaluation, `test/evidence.test.ts` excludes its folder from a check, and `src/config/preset-changes.ts` and `src/config/load.ts` match only through `LoadOptions`.
The one Markdown hit on the evaluation's commits is `f061f03` in a delivery results README, which names it as a commit of `main`; the judge, calibration and count matches in `CHANGELOG.md` and `experiments/benchmark` belong to the benchmark pilot.
`CHANGELOG.md` describes the README's table of results as a product change, and does not say that the evaluation led to it.

**Files read.**
As in v7 and v8.

**Money.**
v9 has a cap of $45 of its own, for its calibrations, sessions and judgments, on the account of v8.
At v8's means, forty sessions are about $28.61 and the calibration about $1.60, and the judgments of the forty `after` answers and of the twelve `before` answers about $9.64 and $2.89, about $42.74 in all.
The reserve for each judgment is $0.27, as in v8.
The runner is given what remains of $45 after the calibration and forty `after` judgments at that reserve.
If its guard stops it with sessions left, the answers held are judged, and the rest run one at a time, each only if the calibration, sessions and judgments so far, its whole budget and $0.27 for each `after` judgment owed stay within $45; that decision reads money and no score.
A round that does not fit whole is dropped for scoring, and the percentages are read on the answers scored.
The `before` answers are judged again with the v9 reference last, only if their twelve judgments at that reserve also stay within $45; if they do not, v8's judgments of the same answers stand in, and the results say so.
v9 stops and reports if the running projection passes $45.

**Unchanged.**
The prompt, the scoring, the pass bar, the sandbox, the per-session budgets of [plan.json](plan.json) and at most two sessions at once.
The results also compare v9's `after` with v5's to v8's, read as a direction, since the judge's reference and evidence map differ.

v9's results are in `results/2026-11-23-v9/`.

## v10: the README that leaves versions to the evidence map and names each number's rule and model

This section was written before any v10 session, calibration or judgment.

**What is evaluated.**
The `after` condition becomes `5e20724`, the head of `main`.
Since v9 (`c02c926`) the README names no Claude Code version for a result and points once to the evidence map for all of them, and each rule effect is one sentence with its rule or rules, whether alone or together, its model, its task and its cost (https://github.com/bpsanti/noonsight/pull/75); `docs/evidence.md` says so in two lines and no entry's value changes; `docs/install.md` and the code of `noonsight watch` describe its scan of the home directory (https://github.com/bpsanti/noonsight/pull/74).
`before` is unchanged, `f061f03`.

**What it aims at.**
v9 had 17 answers not grounded, seven of them on which Claude Code version results ran on and five crediting a number to the wrong arm, rule or model ([results/2026-11-23-v9](results/2026-11-23-v9/README.md#where-the-answers-went-wrong)); the README was changed for these two classes.
v10's results count, over its answers not grounded, how many have a failing statement in each class, whatever else they also get wrong, and an answer may be in both.
v9's seventeen are counted again by the same rule from v9's judgments, beside the one class per answer its README gives.
The classes are read from the judgments and the answers after the run, and change no score.

**Sessions.**
As in v9: ten new `after` sessions for each of the four models, forty in all, in rounds of one per model in the order Fable 5.2, Opus 5.5, Sonnet 5.5, Haiku 5.5, under `caffeinate` and at most two at once; no earlier `after` answer counts, and no `before` session runs.
A session that ends with no answer is run again only if the spending projection, with its estimated cost, stays within the cap.
The sessions and the judge run on Claude Code 2.1.331, the version of v9, through the same kind of `PATH` entry.

**The reference.**
[rubric.md](rubric.md), [judge.md](judge.md) and [calibration.json](calibration.json) are those of v9, unchanged: D18 and D19, the only numbers the reference gives, are the map's current ones, and the calibration answers' numbers and versions agree with it.
The evidence map the judge reads is that of `5e20724`.
It differs from v9's only in the two lines named above, which tell the judge that the README gives no versions of its own.
Before any answer is judged, the judge scores the nine calibration answers against the v10 evidence map and must reach the expected `grounded` on all nine.
If it misses any, v9's rule applies: a calibration sentence the repository contradicts is corrected once, declared here before any session, and the calibration runs once more; otherwise, or if the second misses any, v10 stops and reports.

**What the copy was checked for, before the run.**
The archive of `5e20724`, without this folder, was searched for the word "adoption" in every file, and for this evaluation's commits, counts and vocabulary ("grounded", "pass bar", calibration answers, "wrong grounds", the rubric).
No Markdown file contains the word.
`package.json`, `.gitignore` and `test/adoption.test.ts` name the evaluation, `test/evidence.test.ts` excludes its folder from a check, and `src/config/preset-changes.ts` and `src/config/load.ts` match only through `LoadOptions`.
The one Markdown hit on the evaluation's commits is `f061f03` in a delivery results README, which names it as a commit of `main`; the rubric, judge and count matches belong to the benchmark and the rule experiment.
`CHANGELOG.md` describes the README's changes as product changes, and does not say that the evaluation led to them.

**Files read.**
As in v7 to v9.

**Money.**
v10 has a cap of $45 of its own, for its calibrations, sessions and judgments, on the account of v9.
v9's design cost $41.88: $27.19 for forty sessions, $1.68 for the calibration, $9.87 for the `after` judgments and $3.15 for the `before` ones.
The reserve for each judgment is $0.27, as in v9, and the runner is given what remains of $45 after the calibration and forty `after` judgments at that reserve.
If its guard stops it with sessions left, the answers held are judged, and the rest run one at a time, each only if the calibration, sessions and judgments so far, its whole budget and $0.27 for each `after` judgment owed stay within $45; that decision reads money and no score.
A round that does not fit whole is dropped for scoring, and the percentages are read on the answers scored.
The `before` answers, which v3 and later runs paid for, are judged again with the v10 evidence map last, only if their twelve judgments at that reserve also stay within $45; if they do not, v9's judgments of the same answers stand in, and the results say so.
v10 stops and reports if the running projection passes $45.

**Unchanged.**
The prompt, the scoring, the pass bar, the sandbox, the per-session budgets of [plan.json](plan.json) and at most two sessions at once.
The results also compare v10's `after` with v5's to v9's, read as a direction where the judge's reference or evidence map differ; v9's and v10's reference is the same and their evidence maps differ in two lines.

v10's results are in `results/2026-11-23-v10/`.

## Limits

- The judge is a model; the calibration checks it on six answers, not on every kind of mistake.
- One prompt, in English, from one kind of team; another question could be read differently.
- The sessions only read: none installs noonsight or runs its commands.
- The reference was written by the author of the rewrite; it is committed here, before the results, so anyone can check it against the code.
