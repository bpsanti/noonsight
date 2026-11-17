# Pre-registration: the noonsight benchmark pilot

Status: written 2026-11-17, before any paid run of the pilot.
The commit that adds this file, the task lists in `tasks/` and the placebo texts in `placebo/` is the pre-registration commit; every result line records the commit it ran from.
The digest rubrics in `rubrics/digest/` are committed later, but before the first digest run (phase 2), by the author, from the threads alone.
Any change after the first paid run is listed under [Deviations](#deviations), with its date and reason.

## 1. Question and what the pilot is for

The study asks whether delivering the `claude` preset's rules through noonsight changes what Claude Code does on public, real-world tasks, in the direction each rule's source claims, at a cost worth paying.
This pilot runs before that study, on one Apple M1 machine with 16 GB of memory, and is for:

- proving that each condition is delivered inside the task containers, and recorded in each run's decision log;
- the cost, tokens, turns and wall time of a run, per model and task set, to size the study;
- the spread of outcomes between the two rounds of the same task, model and condition;
- checking the judge of the open tasks against the author's own grades.

The pilot tests no hypothesis.
Its outcomes are reported as descriptive numbers with their sample sizes, and they are not pooled with the study's runs.

## 2. Task sets

Every list is fixed by a seeded ordering, so anyone can recompute it with `npm run benchmark -- gold`.
The seed is the string `noonsight-eval-2026-11-16`.
A task's rank is `sha256(seed + ":" + id)` for SWE-bench Verified and `sha256(seed + ":tb:" + id)` for Terminal-Bench, sorted ascending; `select.ts` holds the code.
The SWE Atlas and ReviewBench lists are the ranked lists of the study's design draft, copied into `plan.json`.

Before any paid run, the reference solution of each chosen task runs on this machine through Harbor's `oracle` agent, with no model (`gold.ts`).
A task whose reference solution fails, or whose environment does not start here, is dropped and replaced by the next task in the same order, until the set is complete or its pool runs out.
The record is `tasks/gold.json`; the final list, with the sha256 of each task as written, is `tasks/pilot.json`.

### 2.1 Build and fix: SWE-bench Verified on arm64 (scope `build`)

Source: Harbor's `swebench-verified@1.0` (500 tasks named by instance id), with metadata from `princeton-nlp/SWE-bench_Verified` on Hugging Face.
Pool: the 281 instances whose evaluation image `swebench/sweb.eval.arm64.<instance>` has a `latest` tag built for arm64 on Docker Hub (checked 2026-11-17, `tasks/swebench-arm64.json`).
Each task runs on that arm64 image instead of the x86_64 one; the tests and the verifier are unchanged.

Selection: 12 instances, 3 from `<15 min fix`, 6 from `15 min - 1 hour` and 3 from `1-4 hours`, taken in rank order within each stratum.
`django/django` takes at most 40 percent of a stratum (1, 2 and 1), and any other repository at most 2 over the list.
The digest instances (2.3) are drawn first and are not used here.

The final list, in rank order within each stratum (gold check on 2026-11-17; `sphinx-doc__sphinx-9711` was dropped, its reference patch failing its tests on the arm64 image):

- `<15 min fix` (3): sphinx-doc__sphinx-9281, django__django-16145, sphinx-doc__sphinx-7889.
- `15 min - 1 hour` (6): django__django-13670, sympy__sympy-23824, django__django-15563, pytest-dev__pytest-5631, astropy__astropy-13236, sympy__sympy-24066.
- `1-4 hours` (3): django__django-16560, pytest-dev__pytest-6197, pylint-dev__pylint-8898.

Verifier: the instance's own `FAIL_TO_PASS` and `PASS_TO_PASS` tests, run by Harbor's verifier on the container's final state.
Resolved means reward 1.

### 2.2 Routine: Terminal-Bench 2.1 (scope `routine`)

Source: `terminal-bench/terminal-bench-2-1` on Harbor Hub (89 tasks, Apache-2.0).
Eligible: tasks whose `expert_time_estimate_min` is at most 30, whose agent timeout is at most 1,800 seconds and whose memory is at most 4,096 MB (31 tasks).
Selection: the first 6 by rank.
When a task's prebuilt image has no arm64 variant, Harbor builds the task's own Dockerfile here.

The final list: pytorch-model-recovery, vulnerable-secret, prove-plus-comm, sanitize-git-repo, nginx-request-logging, kv-store-grpc.
`qemu-alpine-ssh` was dropped: its environment does not build here.

Verifier: the task's own `tests/test.sh`; a task passes only with reward 1.

### 2.3 Digest: SWE-bench Verified discussions (scope `digest`)

The agent gets the repository at the instance's base commit, the issue text and its discussion (`problem_statement` and `hints_text`), and is asked for a summary a maintainer who has not read the thread can act on: the problem, the proposals, what was agreed and what is still open.
It writes the summary to `/logs/agent/digest.md`.
Selection: from the arm64 pool, instances of `15 min - 1 hour` and `1-4 hours` whose `hints_text` has at least 3,000 characters, at most 2 per repository, the first 2 by rank.

The final list: django__django-15957, django__django-14351.
The gold check for a digest task proves only that its environment starts and that the answer file can be written.

### 2.4 Review: ReviewBench (scope `review`)

Source: `review-bench/reviewbench-public@v1` on Harbor Hub (MIT), whose task image builds from a multi-architecture Node.js image.
Selection: the first of the design's ranked list of the 25-PR test set that passes the gold check: `NCATSTranslator_translator-ingests_336`.
`sdsykes_fastimage_165` was dropped: its image is pinned to an amd64 base, and its package install fails under emulation here.
The agent writes its findings to `/work/out/findings.json`, as the task asks.

### 2.5 Investigate: SWE Atlas Codebase QnA (scope `investigate`)

Source: `scaleapi/SWE-Atlas` at `b3cdddf44414c0ccca50c6e89fe978bb4d844d26`, lane `data/qa/` (Apache-2.0).
Selection: the first of the design's ranked list, `qa-6905333b74f22949d97baa05` (kovidgoyal/kitty).
SWE Atlas publishes its images only for amd64; Docker here runs them under emulation, and the task passed the gold check that way.
The agent writes its answer to `/logs/agent/answer.txt`, as the task asks.

## 3. Models, effort and place

Models: Claude Fable 5.2, Opus 5.5, Sonnet 5.5 and Haiku 5.5, all on every set.
Effort: `medium` for every run.
Place: `unattended`, through `NOONSIGHT_EXPERIMENT`, which the configuration lists in `session.unattended_when_env` and every run sets.
Scope: set per set through `NOONSIGHT_SCOPE`; the classifier is off.
Tools: Claude Code's default tool set in `bypassPermissions` mode, as Harbor runs it, with web search and web fetch disabled; subagents are allowed.
Claude Code `2.1.326`, Harbor `0.26.0`, Node.js `20.20.2` for noonsight's hooks inside the containers.

## 4. Conditions

Every condition runs the same agent, the same Claude Code, the same hooks and the same noonsight build; only noonsight's configuration file differs.

| Condition | Configuration for the model | What the session and its subagents receive |
| --- | --- | --- |
| `off` | `{"use": "none"}` | Nothing; the hook runs and logs `declared-none` |
| `on` | `{"use": "preset"}` | The default-on rules for the model, scope and place |
| `placebo` | `{"use": "custom", "add": [...]}` | One neutral text per default-on rule of the model, with that rule's scopes and places and its length within 2 percent |

What `on` delivers in the place `unattended` (and to subagents), from the preset at the pre-registration commit:

| Model | Rules (scopes) |
| --- | --- |
| Fable 5.2 | `low-context-report` (all); to subagents also `finish-work` (investigate, build) |
| Opus 5.5 | `unattended-run` (all) |
| Sonnet 5.5 | `carry-through` (all), `verify-changes` (investigate, build, routine), `stay-in-scope` (routine) |
| Haiku 5.5 | `carry-through` (all), `verify-changes` (investigate, build, routine) |

The placebo texts are `placebo/workspace-notes-1.md` to `-8.md`, with neutral ids (`local/workspace-notes-<n>`), written in the preset's register ("The user ..."), stating facts about the workspace (editor, file format, time zone, screen), with no instruction.
Their sha256 hashes are in `placebo/SHA256SUMS`, and `test/benchmark.test.ts` checks their lengths and that they name none of the things the rules are about.
Before the first paid run, a second reader confirms that none of them asks for anything.

The isolated-rule conditions of the study's design are not part of the pilot.

## 5. Rounds, order and nights

- 2 rounds per task, model and condition: 22 tasks (12 build, 6 routine, 2 digest, 1 review, 1 investigate) x 4 models x 3 conditions x 2 rounds = 528 runs, before the cap.
- Each run is a fresh Harbor trial: a new container from the task's image, a fresh Claude Code configuration directory, a fresh noonsight home.
- Order of priority: (1) build, `off` and `on`; (2) routine, investigate, review and digest, `off` and `on`; (3) every set, `placebo`.
  Within each phase, round 1 runs before round 2.
- Within a round, runs are grouped in units, one per task and model, holding that pair's runs under each condition of the phase.
  The order of the units and of the conditions inside each unit comes from `sha256(seed + ":order:" + label)`.
  A stop for any reason falls between units, so every recorded run has its partners under the other conditions of its phase.
- Nights: one call of the runner is one night, run at night, with at most two runs at a time: the two conditions of a unit run side by side.
  A night continues the first unfinished round, then starts a whole round only while tonight's projected cost stays within the night's budget (US$ 45) and the total within the cap; so a night normally ends at a round boundary, and the next night resumes from there.

## 6. Spending limits and the quota floor

- Per run: Claude Code's `--max-budget-usd`: Haiku 0.15, Sonnet 1.00, Opus 1.50, Fable 3.50.
  A run that hits it counts as unresolved, and is reported.
- Total: US$ 200, over 4 to 5 nights of about US$ 45.
  A unit starts only while the money spent plus the full budgets of its runs stays within the cap.
  An interrupted run counts at its full budget and runs again.
  Judge calls count toward the cap.
- Quota floor: before each unit, `quota-axi --provider claude` reads the account's weekly quota; below 50 percent left (all models, or the model's own weekly window), the night stops.
  An unreadable quota also stops the night.
- Cost is Claude Code's `total_cost_usd`, its estimate at list price.

## 7. Measures

Recorded for every run: resolved (build, routine), the answer and its rubric score (open sets), cost, input and output tokens (cached included), turns, wall time of each phase of the trial, tool calls, denied calls, subagent calls, the files changed and the diff, the final message, and the decision log.

Mechanism signals, as in the study's design:

| Signal | Definition | Rules |
| --- | --- | --- |
| `verified` | Among runs that edited a file outside `/logs`: a test, build, type-check or run command started after the last edit, and allowed | verify-changes (Sonnet, Haiku) |
| `handed_back` | The final message offers to go on, asks for a go-ahead or lists next steps, by the wording rule of `experiments/rules/score.ts` | carry-through (Sonnet, Haiku), unattended-run (Opus), finish-work (Fable) |
| `changed_files` | Files the run changed, against the commit it started from | stay-in-scope (Sonnet, routine) |
| Words per sentence, semicolons per 1,000 words | On the answer of open tasks, or the final message otherwise, outside code, tables and headings | low-context-report (Fable) |

## 8. Grading of open tasks

- Judge: Claude Opus 5.5 at high effort, 3 votes, majority per rubric item, through `claude -p` with its system prompt replaced by the judge's, no tools, and none of the account's settings or hooks.
  The judge is of the same family as the models under test; this is a declared limitation, checked by the calibration below.
- Investigate: the task's SWE Atlas rubric and its judge system prompt, every item rated in one call per vote; score: share of the "must have" items met.
- Review: one item per ReviewBench golden finding, met when the review reports the same problem in the same place; score: share met (grounded recall).
  ReviewBench's own precision score needs its judge pipeline and is not computed in the pilot.
- Digest: 5 to 8 key points per task, written by the author from the thread alone and committed in `rubrics/digest/` before the first digest run, without reading any model's summary; score: share covered.
- Blinding: the judge sees the task, the answer and the rubric; noonsight's strings, rule ids and placebo ids are removed from the answer first.
- Calibration: about 15 graded answers, taking the conditions in turn, are exported with random ids (`calibration`); the author grades them blind to the condition and to the judge, after the sha256 of the sealed id map is recorded.
  The pilot reports the agreement between the author and the judge per item (share of items where they agree, and Cohen's kappa) and the mean difference in score between `on` and `off` answers, judge minus author.

## 9. What is reported

- Per model and set: runs, resolved rate or mean rubric score per condition, cost, tokens, turns and wall time (mean and spread), and the share of runs that hit their budget.
- The two-round spread: for each task, model and condition, whether the two rounds agree (binary outcomes) or their difference (scores, log cost).
- Delivery: per condition, the share of runs whose decision log shows what the condition should deliver (`declared-none` for `off`, the expected rules for `on`, the placebo ids for `placebo`).
- The mechanism signals per condition, as counts, without tests.
- The calibration agreement.
- Every dropped task and run, with the reason.

## 10. Exclusions

- A task whose reference solution fails here, or whose environment does not start, is dropped before any paid run (section 2).
- A run that never reaches the model or the hook (no result event, or no session start in its decision log) is retried up to two times; after three such attempts it is recorded as an infrastructure failure, and its task is left out of the comparisons of that model.
- Budget and time limits are outcomes, not failures.

## 11. Limitations declared before the run

- Build tasks come only from the 281 SWE-bench Verified instances with a native arm64 image, which over-represent Django, SymPy and Sphinx and include no xarray; results on build speak for that pool.
- Routine tasks run on images built here for arm64 when their prebuilt image is amd64 only; the gold check proves the reference solution passes on those builds, not that they match the upstream images byte for byte.
- The investigate task and the review task run on amd64 images under emulation, which is slower; their wall times are not comparable with the other sets'.
- One task each for investigate and review is enough to check the harness and the judge, not to say anything about those kinds of task.
- The judge is a Claude model grading Claude models.
- The pilot's machine is a laptop: Docker (Colima) has 6 CPUs and 10 GB for the pilot; the nights run with `caffeinate`, on power, with automatic updates off, and end before the machine is needed in the morning, so a night can stop between units of a round.

## Deviations

- 2026-11-17, after night 1: the `verified` signal also counts edits made through the shell (`sed -i`, Python scripts that write a file, patches, redirects into source files); its definition in section 7 is unchanged, but the scorer saw only Edit and Write calls and missed most edits.
  Night 1's signals were computed again from each run's saved event stream (`rescore`); with the fix, the edits found match the saved diff in 192 of 192 runs.
- 2026-11-17, after night 1: runs are batched by whole units, up to two runs at a time, instead of the two conditions of one unit side by side, because a placebo unit holds a single run and would leave the second slot idle.
  The order of the units and every stop rule are unchanged, and a stop still falls between units.
- 2026-11-17, before any placebo run: the `placebo` condition is replaced by a `claudemd` condition, and a `scattered` condition is added for one round.
  Reason: the author restated what noonsight is for: (1) delivering the rules for certain, where rules in Markdown files may or may not be read, and (2) giving each rule only to the model it was written for, where one Markdown file is read by every model.
  The placebo measured the effect of adding neutral text, which neither point needs; the new conditions compare noonsight with the usual alternative.
  `claudemd`: noonsight declares every model `"use": "none"`, as under `off`, and the user's `CLAUDE.md` (`$CLAUDE_CONFIG_DIR/CLAUDE.md`) holds every default-on rule of the four models, under one heading per model, each with its scopes and places as one line of text, generated from the preset at the pre-registration commit; its sha256 is recorded in every result line.
  It runs on every set and model, 2 rounds, as phase 3 in place of the placebo, and is compared with `off` and `on` paired by task and round.
  `scattered`: the same rules in a file the user's `CLAUDE.md` only points to, without importing it; 1 round on every set and model, as phase 4.
  New measures: for `claudemd` and `scattered`, every instruction load the `InstructionsLoaded` hook reports; for `scattered`, whether the run read the rules file, and whether before its first edit; for every condition, the share of the delivered rule text that was written for the model receiving it.
  Claude Code places `CLAUDE.md` in the first user message, after a preamble of its own, so `claudemd` differs from `on` in both content and framing; the comparison speaks for noonsight against a `CLAUDE.md`, not for the other models' rules alone.
  Since the benchmark's tasks start no subagent and switch no model (none of night 1's 192 runs did), delivery on those paths is measured by a separate deterministic probe that records Claude Code's requests on a local server, not by the benchmark.
  The placebo texts and their hashes stay in `placebo/`, unused.
  What section 9 reports for each condition is reported for `claudemd` and `scattered` as it would have been for `placebo`, with the delivery measures above added.
