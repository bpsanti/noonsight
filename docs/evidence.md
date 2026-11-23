# Evidence map

Every measured number in [the README](../README.md), [docs/usage.md](usage.md) and [docs/sources.md](sources.md) links to an entry here.
Each entry names the raw file it comes from, how the number is computed from that file, the date of the measurement, the Claude Code version it ran on, and whether it is current.
[test/evidence.test.ts](../test/evidence.test.ts) computes every value and every number of an entry again from the raw file, checks each entry's date and version against its run, and fails when one differs or when a page states a measurement without its entry and version.

**Each fact has one current value.**
An entry's value never changes: when a later run measures the same thing, it gets a new entry, and the earlier one moves to [Superseded results](#superseded-results) with a link to it.
A superseded entry is history, such as the state before a fix; it is not what to quote for noonsight today, and every line that cites one says it is superseded.

The raw files are committed under `experiments/*/results/`.
A result's own `README.md` explains the run, its design and its limits; this page only points at the numbers.
Numbers that appear only in a pull request description or in a result's `README.md`, and not in a committed raw file, are not entries here.

## Runs and versions

Every committed run of the three experiments, and the Claude Code version it ran on.
No run of this table, and so no entry, covers a version that is not in it; `docs/verification/claude-code.md` lists facts about Claude Code, each with the version it was checked on, and CI pins a version for its live checks, which are not measurements.

| Run | Date | Claude Code | Status | Entries |
| --- | --- | --- | --- | --- |
| [delivery/results/claude-code-2.1.330/2026-11-23-c5b9130](../experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/README.md) | 2026-11-23 | 2.1.330 | current | D18 to D34 |
| [delivery/results/claude-code-2.1.328/2026-11-21-d5fd71f](../experiments/delivery/results/claude-code-2.1.328/2026-11-21-d5fd71f/README.md) | 2026-11-21 | 2.1.328 | superseded | D1 to D3, D6 to D8, D10 to D17 |
| [delivery/results/claude-code-2.1.328/2026-11-20-4e18c43](../experiments/delivery/results/claude-code-2.1.328/2026-11-20-4e18c43/README.md) | 2026-11-20 | 2.1.328 | superseded | D4, D5, D9 |
| [delivery/results/claude-code-2.1.328/2026-11-19-f02ccf0](../experiments/delivery/results/claude-code-2.1.328/2026-11-19-f02ccf0/README.md) | 2026-11-19 | 2.1.328 | superseded | none |
| [delivery/results/claude-code-2.1.328/2026-11-19-467d465](../experiments/delivery/results/claude-code-2.1.328/2026-11-19-467d465/README.md) | 2026-11-19 | 2.1.328 | superseded | D4 |
| [rules/results/2026-11-20-harder](../experiments/rules/results/2026-11-20-harder/README.md) | 2026-11-20 | 2.1.329 | current | R10, R11 |
| [rules/results/2026-11-20-long](../experiments/rules/results/2026-11-20-long/README.md) | 2026-11-20 | 2.1.329 | current | R12 |
| [rules/results/2026-11-20](../experiments/rules/results/2026-11-20/README.md) | 2026-11-20 | 2.1.329 | current | R3 to R8, R14, R15 |
| [rules/results/2026-11-19](../experiments/rules/results/2026-11-19/README.md) | 2026-11-19 | 2.1.328 | superseded in part | R1, R2, R9, R13 |
| [rules/results/2026-11-18](../experiments/rules/results/2026-11-18/README.md) | 2026-11-18 | 2.1.327 | current | none |
| [rules/results/2026-11-16](../experiments/rules/results/2026-11-16/README.md) | 2026-11-16 | 2.1.326 | superseded in part | none |
| [benchmark/results/2026-11-19](../experiments/benchmark/results/2026-11-19/README.md) | 2026-11-19 | 2.1.326 | current | B1, B2 |

A run is superseded when a later run measured everything it did, and superseded in part when a later run measured some of its cells (a task, model and arm) again.
Of the rules run of 2026-11-19, the run of 2026-11-20 measured `fix` and `bug` again for Sonnet 5.5 and Haiku 5.5, so R1 and R2 are superseded, while R9 and R13 are still the latest.
The rules run of 2026-11-18 committed no raw file, so nothing in it is an entry.

## Delivery

The delivery benchmark ([experiments/delivery](../experiments/delivery/README.md)) runs real interactive Claude Code sessions against a local stand-in for the Messages API: the sessions are real, and only the API is not, so no request reaches a model.
A request "has its rules" when it holds every rule noonsight's resolver gives its model, scope, place and revealed triggers, and no note retires them; a rule of another model may be present only after a note that retires it.

These entries come from the current run: Claude Code 2.1.330, noonsight at commit `c5b9130`, preset `claude` 1.3.1, measured on 2026-11-23, with the generator that also starts sessions through `noonsight run` and in a project with a trusted configuration, and draws forks, `/resume` in the session, plan mode and subagents that edit a file.
Its build includes the fixes of F1 to F9 ([experiments/delivery/README.md](../experiments/delivery/README.md#failures-found-and-a-limit)).
The native alternatives ran the first sequences of the same seed, which noonsight's sessions include; under them, a session drawn to start through `noonsight run` or in a project starts through `claude` without noonsight's configuration.

### D18

- **Claim:** sessions under noonsight that broke the invariant, with the paths generator 2 added, of those that ran to the end: 299 of the 300 generated. The other, `s1-0123`, stopped on a turn that got no answer (`step-timeout`).
- **Value:** `0 of 299`
- **Source:** `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.json`, key `on-g2-s1-n300`.
- **Measurement:** `robustness.sessionsFailed` of `harness.ok`, the sessions that ran to the end; `sessions` is the sessions generated.
- **Date:** 2026-11-23. **Claude Code:** 2.1.330.
- **Status:** current.

### D19

- **Claim:** coverage under noonsight, over every request of the sessions that ran to the end: requests with rules due that held all of them.
- **Value:** `100% (3,090 of 3,090)`
- **Source:** `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.json`, key `on-g2-s1-n300`.
- **Measurement:** `coverage.covered` of `coverage.due`.
- **Date:** 2026-11-23. **Claude Code:** 2.1.330.
- **Status:** current.

### D20

- **Claim:** coverage of subagent requests under noonsight with the paths generator 2 added.
- **Value:** `100% (763 of 763)`
- **Source:** `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.json`, key `on-g2-s1-n300`.
- **Measurement:** `coverage.subagents.covered` of `coverage.subagents.due`.
- **Date:** 2026-11-23. **Claude Code:** 2.1.330.
- **Status:** current.

### D21

- **Claim:** coverage under noonsight on the requests of the paths generator 2 added: a `/fork` session, after `/fork`, `/branch`, a forking resume or `/resume` in the session, in and after plan mode, and after starting subagents that edit a file. It is a part of the requests D19 counts, not all of them.
- **Value:** `100% (453 of 453)`
- **Source:** `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.json`, key `on-g2-s1-n300`.
- **Measurement:** the sum of `due` over those paths of `byPath`, each covered at its `coverage`.
- **Date:** 2026-11-23. **Claude Code:** 2.1.330.
- **Status:** current.

### D22

- **Claim:** coverage under noonsight in the sessions started through `noonsight run`, in a project with a trusted configuration, or both.
- **Value:** `100% (1,308 of 1,308)`
- **Source:** `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.json`, key `on-g2-s1-n300`.
- **Measurement:** `covered` of `due`, summed over `robustness.byStart` but `claude`.
- **Date:** 2026-11-23. **Claude Code:** 2.1.330.
- **Status:** current.

### D23

- **Claim:** the corpus entries that had the outcome they record: the reproductions of F1 to F9, which pass, an entry for each path generator 2 added, and the documented limit.
- **Value:** `33 of 33`
- **Source:** `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/corpus.json`.
- **Measurement:** entries whose `outcome` is `as-expected`, of all entries.
- **Date:** 2026-11-23. **Claude Code:** 2.1.330.
- **Status:** current.

### D24

- **Claim:** the reproductions of F5 to F9 that break the invariant on the build before their fixes; of the nine failures, only these five were run on a build before their fix in this run.
- **Value:** `8 of 8`
- **Source:** `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/before-fix/corpus.json`: those entries, run with the harness of commit `1247866` against `main` at `19adf38`.
- **Measurement:** entries whose `outcome` is `regressed`, of all entries.
- **Date:** 2026-11-23. **Claude Code:** 2.1.330.
- **Status:** current.

### D25

- **Claim:** coverage with every model's rules in a user `CLAUDE.md`, on the first 60 sequences.
- **Value:** `88.2% (508 of 576)`
- **Source:** `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.json`, key `claudemd-g2-s1-n60`.
- **Measurement:** `coverage.covered` of `coverage.due`.
- **Date:** 2026-11-23. **Claude Code:** 2.1.330.
- **Status:** current.

### D26

- **Claim:** coverage with one `.claude/rules` file per model, on the first 60 sequences.
- **Value:** `76.3% (441 of 578)`
- **Source:** `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.json`, key `rules-g2-s1-n60`.
- **Measurement:** `coverage.covered` of `coverage.due`.
- **Date:** 2026-11-23. **Claude Code:** 2.1.330.
- **Status:** current.

### D27

- **Claim:** coverage with one skill per model, on the first 60 sequences.
- **Value:** `0% (0 of 579)`
- **Source:** `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.json`, key `skills-g2-s1-n60`.
- **Measurement:** `coverage.covered` of `coverage.due`.
- **Date:** 2026-11-23. **Claude Code:** 2.1.330.
- **Status:** current.

### D28

- **Claim:** coverage of subagent requests with a `CLAUDE.md`, and with `.claude/rules` (the same in both), on the first 60 sequences.
- **Value:** `46.9% (60 of 128)`
- **Source:** `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.json`, keys `claudemd-g2-s1-n60` and `rules-g2-s1-n60`.
- **Measurement:** `coverage.subagents.covered` of `coverage.subagents.due`; the test checks that both keys give it.
- **Date:** 2026-11-23. **Claude Code:** 2.1.330.
- **Status:** current.

### D29

- **Claim:** subagent requests with one skill per model, on the first 60 sequences.
- **Value:** `0 of 128`
- **Source:** `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.json`, key `skills-g2-s1-n60`.
- **Measurement:** `coverage.subagents.covered` of `coverage.subagents.due`.
- **Date:** 2026-11-23. **Claude Code:** 2.1.330.
- **Status:** current.

### D30

- **Claim:** the share of the rule text in a request that was written for the request's model, under noonsight, a `CLAUDE.md` and `.claude/rules`.
- **Value:** `78.6%, 32.6% and 27.9%`
- **Source:** `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.json`, keys `on-g2-s1-n300`, `claudemd-g2-s1-n60` and `rules-g2-s1-n60`.
- **Measurement:** of `precision.parts`, the three `own` parts over all but `overhead`, in that order; `precision.ownShare` is the same share already rounded to four decimals.
- **Date:** 2026-11-23. **Claude Code:** 2.1.330.
- **Status:** current.

### D31

- **Claim:** characters added to each request (rules, envelopes and notes), under noonsight, a `CLAUDE.md` and `.claude/rules`.
- **Value:** `1,343, 4,472 and 3,889`
- **Source:** `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.json`, keys `on-g2-s1-n300`, `claudemd-g2-s1-n60` and `rules-g2-s1-n60`.
- **Measurement:** `cost.addedCharsPerAgentRequest` of each, in that order.
- **Date:** 2026-11-23. **Claude Code:** 2.1.330.
- **Status:** current.

### D32

- **Claim:** requests holding another model's rule with no note that retires it, under noonsight, a `CLAUDE.md` and `.claude/rules`.
- **Value:** `0, 619 and 622`
- **Source:** `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.json`, keys `on-g2-s1-n300`, `claudemd-g2-s1-n60` and `rules-g2-s1-n60`.
- **Measurement:** `robustness.requestsWithViolation.foreign-unretired` of each, in that order.
- **Date:** 2026-11-23. **Claude Code:** 2.1.330.
- **Status:** current.

### D33

- **Claim:** the processor time of one hook run, median, from the cheapest hook to the first edit of a tracked code file, on a laptop that ran other work at the same time, so an upper reading: the load averages when it ended were 9.8, 14.9 and 22.2 on 8 cores.
- **Value:** `80 to 150 ms`
- **Source:** `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/hooktime.json`.
- **Measurement:** the lowest and highest `cpu.median` among `hooks`, 40 runs of each hook with recorded inputs; a Node.js process that does nothing takes `baseline.cpu.median`, 20 ms, of it.
- **Date:** 2026-11-23. **Claude Code:** 2.1.330.
- **Status:** current.

### D34

- **Claim:** coverage with every model's rules in a user `CLAUDE.md`, on the requests of the session's own conversation, every subagent request left out, on the first 60 sequences.
- **Value:** `100% (448 of 448)`
- **Source:** `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.json`, key `claudemd-g2-s1-n60`.
- **Measurement:** `coverage.covered` minus `coverage.subagents.covered`, of `coverage.due` minus `coverage.subagents.due`; `byPath` gives full coverage on every path but `subagent`.
- **Date:** 2026-11-23. **Claude Code:** 2.1.330.
- **Status:** current.

## Rule effects

The rule effect experiment ([experiments/rules](../experiments/rules/README.md)) runs one small task on a model with its preset rules delivered by noonsight and without, and reads what the session did.
Each run is a line of the result's `runs.jsonl`; "tests after the last edit" is `signals.verified` among the runs whose `signals.edited` is true, and cost is `cost_usd`, as Claude Code reports it at list price.
These entries ran on Claude Code 2.1.329, but for R9 and R13, which ran on 2.1.328.

### R3

- **Claim:** on the same fix, `verify-changes` delivered alone, for Sonnet 5.5 and Haiku 5.5, and `carry-through` delivered alone, for each.
- **Value:** `29 of 30 and 27 of 30; 0 of 30 and 0 of 30`
- **Source:** `experiments/rules/results/2026-11-20/runs.jsonl`.
- **Measurement:** task `fix`; tests after the last edit for Sonnet `verify`, Haiku `verify`, Sonnet `carry`, Haiku `carry`, in that order.
- **Date:** 2026-11-20. **Claude Code:** 2.1.329.
- **Status:** current.

### R4

- **Claim:** `verify-changes` delivered as one sentence naming a file that holds its text: the runs that read the file.
- **Value:** `120 of 120`
- **Source:** `experiments/rules/results/2026-11-20/runs.jsonl`.
- **Measurement:** runs of arm `pointer` whose `signals.pointer.read` is true, of all runs of arm `pointer`.
- **Date:** 2026-11-20. **Claude Code:** 2.1.329.
- **Status:** current.

### R5

- **Claim:** tests after the last edit with the pointer and with the rule inline, on the fix for Sonnet 5.5 and Haiku 5.5.
- **Value:** `30 of 30 against 29 of 30, and 27 of 30 against 27 of 30`
- **Source:** `experiments/rules/results/2026-11-20/runs.jsonl`.
- **Measurement:** task `fix`; tests after the last edit for Sonnet `pointer`, Sonnet `verify`, Haiku `pointer`, Haiku `verify`, in that order.
- **Date:** 2026-11-20. **Claude Code:** 2.1.329.
- **Status:** current.

### R6

- **Claim:** mean cost per run of Sonnet 5.5 on the fix, without rules, with `carry-through` alone, with `verify-changes` alone, with its pointer, and with the three rules the preset delivers there.
- **Value:** `$0.0240, $0.0247, $0.0505, $0.0440 and $0.0378`
- **Source:** `experiments/rules/results/2026-11-20/runs.jsonl`.
- **Measurement:** task `fix`, model `sonnet`; mean `cost_usd` of arms `none`, `carry`, `verify`, `pointer` and `rules`, to four decimals.
- **Date:** 2026-11-20. **Claude Code:** 2.1.329.
- **Status:** current.

### R7

- **Claim:** mean cost per run of Haiku 5.5 on the fix, without rules, with `carry-through` alone, with `verify-changes` alone, with its pointer, and with the two rules the preset delivers there.
- **Value:** `$0.0015, $0.0018, $0.0033, $0.0038 and $0.0033`
- **Source:** `experiments/rules/results/2026-11-20/runs.jsonl`.
- **Measurement:** task `fix`, model `haiku`; mean `cost_usd` of arms `none`, `carry`, `verify`, `pointer` and `rules`, to four decimals.
- **Date:** 2026-11-20. **Claude Code:** 2.1.329.
- **Status:** current.

### R8

- **Claim:** runs that passed the task's hidden check and the project's own tests, with or without rules.
- **Value:** `600 of 600`
- **Source:** `experiments/rules/results/2026-11-20/runs.jsonl`.
- **Measurement:** runs whose `signals.check_passed` and `signals.suite_passed` are both true, of all runs.
- **Date:** 2026-11-20. **Claude Code:** 2.1.329.
- **Status:** current.

### R9

- **Claim:** Fable 5.2's mean words per sentence in its final report, with `fable-5-2/low-context-report` and without, on the question, the bug and the feature.
- **Value:** `12.3 against 16.4, 17.8 against 20.1, 12.2 against 16.2`
- **Source:** `experiments/rules/results/2026-11-19/runs.jsonl`.
- **Measurement:** model `fable`; mean `signals.report.words_per_sentence` of arm `rules`, then `none`, for tasks `question`, `bug` and `feature`, to one decimal. The result's README gives the test of each, significant after Holm's adjustment.
- **Date:** 2026-11-19. **Claude Code:** 2.1.328.
- **Status:** current.

### R10

- **Claim:** on a 13-ticket backlog where one ticket leaves a decision open, the runs that did every part, with `sonnet-5-5/carry-through` and without.
- **Value:** `32 of 40 against 9 of 40`
- **Source:** `experiments/rules/results/2026-11-20-harder/runs.jsonl`.
- **Measurement:** task `triage`, model `sonnet`; runs whose `signals.completed` is true, arm `carry`, then `none`.
- **Date:** 2026-11-20. **Claude Code:** 2.1.329.
- **Status:** current.

### R11

- **Claim:** the same for `haiku-5-5/carry-through`, which the run did not show to change anything.
- **Value:** `6 of 40 against 2 of 40`
- **Source:** `experiments/rules/results/2026-11-20-harder/runs.jsonl`.
- **Measurement:** task `triage`, model `haiku`; runs whose `signals.completed` is true, arm `carry`, then `none`.
- **Date:** 2026-11-20. **Claude Code:** 2.1.329.
- **Status:** current.

### R12

- **Claim:** pilot runs of two long tasks, without the rules, that did every part as the check recorded them; the result's README reads the other one as done after a fix of the check.
- **Value:** `19 of 20`
- **Source:** `experiments/rules/results/2026-11-20-long/pilot/runs.jsonl`.
- **Measurement:** runs whose `signals.completed` is true, of all runs (Sonnet 5.5 and Haiku 5.5, tasks `migrate` and `backlog`, 5 each).
- **Date:** 2026-11-20. **Claude Code:** 2.1.329.
- **Status:** current.

### R13

- **Claim:** on a feature across several files, without rules, Sonnet 5.5 and Haiku 5.5 ran the tests after their last edit.
- **Value:** `30 of 30 and 29 of 30`
- **Source:** `experiments/rules/results/2026-11-19/runs.jsonl`.
- **Measurement:** task `feature`, arm `none`; tests after the last edit for Sonnet, then Haiku.
- **Date:** 2026-11-19. **Claude Code:** 2.1.328.
- **Status:** current.

### R14

- **Claim:** Sonnet 5.5 and Haiku 5.5 ran the tests after a precisely described one-file fix, with their preset rules and without.
- **Value:** `30 of 30 against 0 of 30, and 27 of 30 against 0 of 30`
- **Source:** `experiments/rules/results/2026-11-20/runs.jsonl`.
- **Measurement:** task `fix`; tests after the last edit for Sonnet `rules`, Sonnet `none`, Haiku `rules`, Haiku `none`, in that order.
- **Date:** 2026-11-20. **Claude Code:** 2.1.329.
- **Status:** current.

### R15

- **Claim:** Sonnet 5.5 ran the tests after a bug fix known only by its symptom, with its preset rules and without.
- **Value:** `30 of 30 against 11 of 30`
- **Source:** `experiments/rules/results/2026-11-20/runs.jsonl`.
- **Measurement:** task `bug`, model `sonnet`; tests after the last edit for `rules`, then `none`.
- **Date:** 2026-11-20. **Claude Code:** 2.1.329.
- **Status:** current.

## Benchmark pilot

The pilot ([experiments/benchmark](../experiments/benchmark/README.md)) ran public tasks on the four models, and delivered rules to the sessions' own conversation only.

### B1

- **Claim:** build and routine runs of the paid pilot whose verifier passed, with no rules (`off`), under noonsight (`on`), and with every model's rules in one `CLAUDE.md` (`claudemd`): no measurable difference on its tasks.
- **Value:** `133 of 144, 132 of 144 and 133 of 144`
- **Source:** `experiments/benchmark/results/2026-11-19/runs.jsonl`.
- **Measurement:** without the lines with `infra_failure`, runs whose `resolved` is true, of those where it is true or false; conditions `off`, `on`, `claudemd`, in that order.
- **Date:** 2026-11-16 to 2026-11-19, in the results folder of 2026-11-19. **Claude Code:** 2.1.326.
- **Status:** current.

### B2

- **Claim:** mean cost per run of the paid pilot in the round every condition ran, under `off`, `on`, `claudemd` and `scattered` (a `CLAUDE.md` that only points to the rules).
- **Value:** `$0.145, $0.155, $0.173 and $0.181`
- **Source:** `experiments/benchmark/results/2026-11-19/runs.jsonl`.
- **Measurement:** without the lines with `infra_failure`, mean `cost_usd` of the runs with `rep: 1`, to three decimals.
- **Date:** 2026-11-16 to 2026-11-19, in the results folder of 2026-11-19. **Claude Code:** 2.1.326.
- **Status:** current.

## Superseded results

None of these is a current value: each names the entry that replaced it.
The delivery entries ran on Claude Code 2.1.328, without the paths the current run adds, on builds before the fixes of F5 to F9, so their sequences are not the current run's.
R1 and R2 ran on Claude Code 2.1.328 and were measured again on 2.1.329.

### D1

- **Claim:** sessions under noonsight that broke the invariant, of those that ran to the end: all of the 300 generated.
- **Value:** `1 of 300`
- **Source:** `experiments/delivery/results/claude-code-2.1.328/2026-11-21-d5fd71f/summary.json`, key `on-s1-n300`.
- **Measurement:** `robustness.sessionsFailed` of `harness.ok`, the sessions that ran to the end; `sessions` is the sessions generated.
- **Date:** 2026-11-21. **Claude Code:** 2.1.328.
- **Status:** superseded by [D18](#d18).

### D2

- **Claim:** coverage under noonsight: requests with rules due that held all of them.
- **Value:** `99.9% (3,219 of 3,221)`
- **Source:** `experiments/delivery/results/claude-code-2.1.328/2026-11-21-d5fd71f/summary.json`, key `on-s1-n300`.
- **Measurement:** `coverage.covered` of `coverage.due`.
- **Date:** 2026-11-21. **Claude Code:** 2.1.328.
- **Status:** superseded by [D19](#d19).

### D3

- **Claim:** coverage of subagent requests under noonsight.
- **Value:** `100% (668 of 668)`
- **Source:** `experiments/delivery/results/claude-code-2.1.328/2026-11-21-d5fd71f/summary.json`, key `on-s1-n300`.
- **Measurement:** `coverage.subagents.covered` of `coverage.subagents.due`.
- **Date:** 2026-11-21. **Claude Code:** 2.1.328.
- **Status:** superseded by [D20](#d20).

### D4

- **Claim:** sessions that broke the invariant on the build before the fixes of F1 and F2, among the sessions both runs completed: each generated 300, and 296 ran to the end in the earlier run (4 stopped on a step that got no answer, `step-timeout`) and 300 in the later one.
- **Value:** `26 of 296`
- **Source:** `experiments/delivery/results/claude-code-2.1.328/2026-11-20-4e18c43/comparison.json`, comparison `P1`, and `experiments/delivery/results/claude-code-2.1.328/2026-11-19-467d465/summary.json`, key `on-s1-n300`.
- **Measurement:** `a` of `pairs.sessions`.
- **Date:** 2026-11-19 (the earlier run, `2026-11-19-467d465`), compared on 2026-11-20. **Claude Code:** 2.1.328.
- **Status:** superseded by [D18](#d18).

### D5

- **Claim:** coverage under noonsight on the first 60 sequences, the ones the native alternatives ran.
- **Value:** `100%`
- **Source:** `experiments/delivery/results/claude-code-2.1.328/2026-11-20-4e18c43/comparison.json`, comparison `P3`.
- **Measurement:** `b`, the coverage of the first 60 `on` sessions.
- **Date:** 2026-11-20. **Claude Code:** 2.1.328.
- **Status:** superseded by [D19](#d19).

### D6

- **Claim:** coverage with every model's rules in a user `CLAUDE.md`.
- **Value:** `87.3% (565 of 647)`
- **Source:** `experiments/delivery/results/claude-code-2.1.328/2026-11-21-d5fd71f/summary.json`, key `claudemd-s1-n60`.
- **Measurement:** `coverage.covered` of `coverage.due`.
- **Date:** 2026-11-21. **Claude Code:** 2.1.328.
- **Status:** superseded by [D25](#d25).

### D7

- **Claim:** coverage with one `.claude/rules` file per model.
- **Value:** `70.6% (459 of 650)`
- **Source:** `experiments/delivery/results/claude-code-2.1.328/2026-11-21-d5fd71f/summary.json`, key `rules-s1-n60`.
- **Measurement:** `coverage.covered` of `coverage.due`.
- **Date:** 2026-11-21. **Claude Code:** 2.1.328.
- **Status:** superseded by [D26](#d26).

### D8

- **Claim:** coverage with one skill per model.
- **Value:** `0% (0 of 654)`
- **Source:** `experiments/delivery/results/claude-code-2.1.328/2026-11-21-d5fd71f/summary.json`, key `skills-s1-n60`.
- **Measurement:** `coverage.covered` of `coverage.due`.
- **Date:** 2026-11-21. **Claude Code:** 2.1.328.
- **Status:** superseded by [D27](#d27).

### D9

- **Claim:** coverage of subagent requests under noonsight on the first 60 sequences.
- **Value:** `100%`
- **Source:** `experiments/delivery/results/claude-code-2.1.328/2026-11-20-4e18c43/comparison.json`, comparison `P6`.
- **Measurement:** `b`, the subagent coverage of the first 60 `on` sessions.
- **Date:** 2026-11-20. **Claude Code:** 2.1.328.
- **Status:** superseded by [D20](#d20).

### D10

- **Claim:** coverage of subagent requests with a `CLAUDE.md`, and with `.claude/rules` (the same in both).
- **Value:** `32.2% (39 of 121)`
- **Source:** `experiments/delivery/results/claude-code-2.1.328/2026-11-21-d5fd71f/summary.json`, keys `claudemd-s1-n60` and `rules-s1-n60`.
- **Measurement:** `coverage.subagents.covered` of `coverage.subagents.due`; the test checks that both keys give it.
- **Date:** 2026-11-21. **Claude Code:** 2.1.328.
- **Status:** superseded by [D28](#d28).

### D11

- **Claim:** subagent requests with one skill per model.
- **Value:** `0 of 121`
- **Source:** `experiments/delivery/results/claude-code-2.1.328/2026-11-21-d5fd71f/summary.json`, key `skills-s1-n60`.
- **Measurement:** `coverage.subagents.covered` of `coverage.subagents.due`.
- **Date:** 2026-11-21. **Claude Code:** 2.1.328.
- **Status:** superseded by [D29](#d29).

### D12

- **Claim:** the share of the rule text in a request that was written for the request's model, under noonsight, a `CLAUDE.md` and `.claude/rules`.
- **Value:** `79.0%, 31.5% and 27.0%`
- **Source:** `experiments/delivery/results/claude-code-2.1.328/2026-11-21-d5fd71f/summary.json`, keys `on-s1-n300`, `claudemd-s1-n60` and `rules-s1-n60`.
- **Measurement:** `precision.ownShare` of each, in that order.
- **Date:** 2026-11-21. **Claude Code:** 2.1.328.
- **Status:** superseded by [D30](#d30).

### D13

- **Claim:** characters added to each request (rules, envelopes and notes), under noonsight, a `CLAUDE.md` and `.claude/rules`.
- **Value:** `1,155, 4,415 and 3,987`
- **Source:** `experiments/delivery/results/claude-code-2.1.328/2026-11-21-d5fd71f/summary.json`, keys `on-s1-n300`, `claudemd-s1-n60` and `rules-s1-n60`.
- **Measurement:** `cost.addedCharsPerAgentRequest` of each, in that order.
- **Date:** 2026-11-21. **Claude Code:** 2.1.328.
- **Status:** superseded by [D31](#d31).

### D14

- **Claim:** requests holding another model's rule with no note that retires it, under noonsight, a `CLAUDE.md` and `.claude/rules`.
- **Value:** `2, 707 and 709`
- **Source:** `experiments/delivery/results/claude-code-2.1.328/2026-11-21-d5fd71f/summary.json`, keys `on-s1-n300`, `claudemd-s1-n60` and `rules-s1-n60`.
- **Measurement:** `robustness.requestsWithViolation.foreign-unretired` of each, in that order.
- **Date:** 2026-11-21. **Claude Code:** 2.1.328.
- **Status:** superseded by [D32](#d32).

### D15

- **Claim:** the processor time of one hook run, median, from the cheapest hook to the first edit of a tracked code file.
- **Value:** `50 to 90 ms`
- **Source:** `experiments/delivery/results/claude-code-2.1.328/2026-11-21-d5fd71f/hooktime.json`.
- **Measurement:** the lowest and highest `cpu.median` among `hooks`, 40 runs of each hook with recorded inputs; a Node.js process that does nothing takes `baseline.cpu.median`, 20 ms, of it.
- **Date:** 2026-11-21. **Claude Code:** 2.1.328.
- **Status:** superseded by [D33](#d33).

### D16

- **Claim:** the corpus entries that had the outcome they record: the reproductions of F1 to F4, which pass, and the documented limit, which shows its violations.
- **Value:** `18 of 18`
- **Source:** `experiments/delivery/results/claude-code-2.1.328/2026-11-21-d5fd71f/corpus.json`.
- **Measurement:** entries whose `outcome` is `as-expected`, of all entries.
- **Date:** 2026-11-21. **Claude Code:** 2.1.328.
- **Status:** superseded by [D23](#d23).

### D17

- **Claim:** coverage with every model's rules in a user `CLAUDE.md`, on the requests of the session's own conversation, every subagent request left out.
- **Value:** `100% (526 of 526)`
- **Source:** `experiments/delivery/results/claude-code-2.1.328/2026-11-21-d5fd71f/summary.json`, key `claudemd-s1-n60`.
- **Measurement:** `coverage.covered` minus `coverage.subagents.covered`, of `coverage.due` minus `coverage.subagents.due`; `byPath` gives full coverage on every path but `subagent`, `after /compact` included.
- **Date:** 2026-11-21. **Claude Code:** 2.1.328.
- **Status:** superseded by [D34](#d34).

### R1

- **Claim:** Sonnet 5.5 and Haiku 5.5 ran the tests after a precisely described one-file fix, with their preset rules and without.
- **Value:** `30 of 30 against 0 of 30, and 27 of 30 against 0 of 30`
- **Source:** `experiments/rules/results/2026-11-19/runs.jsonl`.
- **Measurement:** task `fix`; tests after the last edit for Sonnet `rules`, Sonnet `none`, Haiku `rules`, Haiku `none`, in that order.
- **Date:** 2026-11-19. **Claude Code:** 2.1.328.
- **Status:** superseded by [R14](#r14).

### R2

- **Claim:** Sonnet 5.5 ran the tests after a bug fix known only by its symptom, with its preset rules and without.
- **Value:** `30 of 30 against 15 of 30`
- **Source:** `experiments/rules/results/2026-11-19/runs.jsonl`.
- **Measurement:** task `bug`, model `sonnet`; tests after the last edit for `rules`, then `none`.
- **Date:** 2026-11-19. **Claude Code:** 2.1.328.
- **Status:** superseded by [R15](#r15).
