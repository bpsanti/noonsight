# Evidence map

Every measured number in [the README](../README.md), [docs/usage.md](usage.md) and [docs/sources.md](sources.md) links to an entry here.
Each entry names the raw file it comes from, how the number is computed from that file, the date of the measurement and the Claude Code version it ran on.
`test/evidence.test.ts` computes every value below again from the raw file and fails when one differs, when an entry has no computation, or when one of those three pages states a measurement on a line that cites no entry.

The raw files are committed under `experiments/*/results/`.
A result's own `README.md` explains the run, its design and its limits; this page only points at the numbers.
Numbers that appear only in a pull request description, and not in a committed result, are not entries here.

## Delivery

The delivery benchmark ([experiments/delivery](../experiments/delivery/README.md)) runs real interactive Claude Code sessions against a local stand-in for the Messages API, so no request reaches a model.
A request "has its rules" when it holds every rule noonsight's resolver gives its model, scope, place and revealed triggers, and no note retires them; a rule of another model may be present only after a note that retires it.
Unless an entry says otherwise, the run is `experiments/delivery/results/claude-code-2.1.328/2026-11-21-d5fd71f/`: Claude Code 2.1.328, noonsight at commit `d5fd71f`, preset `claude` 1.3.1, measured on 2026-11-21, seed 1, 300 random sessions generated under noonsight (`on`), all of which ran to the end, and the first 60 of the same sequences under each native alternative.
That build includes the fixes of F1 to F4 ([experiments/delivery/README.md](../experiments/delivery/README.md#failures-found-and-a-limit)).
D4, D5 and D9 come from the run before it, `experiments/delivery/results/claude-code-2.1.328/2026-11-20-4e18c43/` (noonsight at `4e18c43`, with the fixes of F1 and F2 only), whose `comparison.json` holds them; the run of 2026-11-21 compares itself with that run and not with the native alternatives.
D18 to D24 come from `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/`: Claude Code 2.1.330, noonsight at commit `c5b9130`, preset `claude` 1.3.1, measured on 2026-11-23, seed 1, generator 2, which also starts sessions through `noonsight run` and in a project with a trusted configuration, and draws forks, `/resume` in the session, plan mode and subagents that edit a file; that build includes the fixes of F5 to F9.
That run generated 300 sessions under `on`, and 299 ran to the end; D18 to D22 are measured on those 299.

### D1

- **Claim:** sessions under noonsight that broke the invariant, of those that ran to the end: all of the 300 generated.
- **Value:** `1 of 300`
- **Source:** `summary.json`, key `on-s1-n300`.
- **Measurement:** `robustness.sessionsFailed` of `harness.ok`, the sessions that ran to the end; `sessions` is the sessions generated.
- **Date:** 2026-11-21. **Claude Code:** 2.1.328.

### D2

- **Claim:** coverage under noonsight: requests with rules due that held all of them.
- **Value:** `99.9% (3,219 of 3,221)`
- **Source:** `summary.json`, key `on-s1-n300`.
- **Measurement:** `coverage.covered` of `coverage.due`.
- **Date:** 2026-11-21. **Claude Code:** 2.1.328.

### D3

- **Claim:** coverage of subagent requests under noonsight.
- **Value:** `100% (668 of 668)`
- **Source:** `summary.json`, key `on-s1-n300`.
- **Measurement:** `coverage.subagents.covered` of `coverage.subagents.due`.
- **Date:** 2026-11-21. **Claude Code:** 2.1.328.

### D4

- **Claim:** sessions that broke the invariant on the build before the fixes of F1 and F2, among the sessions both runs completed: each generated 300, and 296 ran to the end in the earlier run (4 stopped on a step that got no answer, `step-timeout`) and 300 in the later one.
- **Value:** `26 of 296`
- **Source:** `comparison.json` of the run of 2026-11-20, comparison `P1`.
- **Measurement:** `a` of `pairs.sessions`.
- **Date:** 2026-11-19 (the earlier run, `2026-11-19-467d465`), compared on 2026-11-20. **Claude Code:** 2.1.328.

### D5

- **Claim:** coverage under noonsight on the first 60 sequences, the ones the native alternatives ran.
- **Value:** `100%`
- **Source:** `comparison.json` of the run of 2026-11-20, comparison `P3`.
- **Measurement:** `b`, the coverage of the first 60 `on` sessions.
- **Date:** 2026-11-20. **Claude Code:** 2.1.328.

### D6

- **Claim:** coverage with every model's rules in a user `CLAUDE.md`.
- **Value:** `87.3% (565 of 647)`
- **Source:** `summary.json`, key `claudemd-s1-n60`.
- **Measurement:** `coverage.covered` of `coverage.due`.
- **Date:** 2026-11-21. **Claude Code:** 2.1.328.

### D7

- **Claim:** coverage with one `.claude/rules` file per model.
- **Value:** `70.6% (459 of 650)`
- **Source:** `summary.json`, key `rules-s1-n60`.
- **Measurement:** `coverage.covered` of `coverage.due`.
- **Date:** 2026-11-21. **Claude Code:** 2.1.328.

### D8

- **Claim:** coverage with one skill per model.
- **Value:** `0% (0 of 654)`
- **Source:** `summary.json`, key `skills-s1-n60`.
- **Measurement:** `coverage.covered` of `coverage.due`.
- **Date:** 2026-11-21. **Claude Code:** 2.1.328.

### D9

- **Claim:** coverage of subagent requests under noonsight on the first 60 sequences.
- **Value:** `100%`
- **Source:** `comparison.json` of the run of 2026-11-20, comparison `P6`.
- **Measurement:** `b`, the subagent coverage of the first 60 `on` sessions.
- **Date:** 2026-11-20. **Claude Code:** 2.1.328.

### D10

- **Claim:** coverage of subagent requests with a `CLAUDE.md`, and with `.claude/rules` (the same in both).
- **Value:** `32.2% (39 of 121)`
- **Source:** `summary.json`, keys `claudemd-s1-n60` and `rules-s1-n60`.
- **Measurement:** `coverage.subagents.covered` of `coverage.subagents.due`; the test checks that both keys give it.
- **Date:** 2026-11-21. **Claude Code:** 2.1.328.

### D11

- **Claim:** subagent requests with one skill per model.
- **Value:** `0 of 121`
- **Source:** `summary.json`, key `skills-s1-n60`.
- **Measurement:** `coverage.subagents.covered` of `coverage.subagents.due`.
- **Date:** 2026-11-21. **Claude Code:** 2.1.328.

### D12

- **Claim:** the share of the rule text in a request that was written for the request's model, under noonsight, a `CLAUDE.md` and `.claude/rules`.
- **Value:** `79.0%, 31.5% and 27.0%`
- **Source:** `summary.json`, keys `on-s1-n300`, `claudemd-s1-n60` and `rules-s1-n60`.
- **Measurement:** `precision.ownShare` of each, in that order.
- **Date:** 2026-11-21. **Claude Code:** 2.1.328.

### D13

- **Claim:** characters added to each request (rules, envelopes and notes), under noonsight, a `CLAUDE.md` and `.claude/rules`.
- **Value:** `1,155, 4,415 and 3,987`
- **Source:** `summary.json`, keys `on-s1-n300`, `claudemd-s1-n60` and `rules-s1-n60`.
- **Measurement:** `cost.addedCharsPerAgentRequest` of each, in that order.
- **Date:** 2026-11-21. **Claude Code:** 2.1.328.

### D14

- **Claim:** requests holding another model's rule with no note that retires it, under noonsight, a `CLAUDE.md` and `.claude/rules`.
- **Value:** `2, 707 and 709`
- **Source:** `summary.json`, keys `on-s1-n300`, `claudemd-s1-n60` and `rules-s1-n60`.
- **Measurement:** `robustness.requestsWithViolation.foreign-unretired` of each, in that order.
- **Date:** 2026-11-21. **Claude Code:** 2.1.328.

### D15

- **Claim:** the processor time of one hook run, median, from the cheapest hook to the first edit of a tracked code file.
- **Value:** `50 to 90 ms`
- **Source:** `hooktime.json`.
- **Measurement:** the lowest and highest `cpu.median` among `hooks`, 40 runs of each hook with recorded inputs; a Node.js process that does nothing takes `baseline.cpu.median`, 20 ms, of it.
- **Date:** 2026-11-21. **Claude Code:** 2.1.328.

### D16

- **Claim:** the corpus entries that had the outcome they record: the reproductions of F1 to F4, which pass, and the documented limit, which shows its violations.
- **Value:** `18 of 18`
- **Source:** `corpus.json`.
- **Measurement:** entries whose `outcome` is `as-expected`, of all entries.
- **Date:** 2026-11-21. **Claude Code:** 2.1.328.

### D17

- **Claim:** coverage with every model's rules in a user `CLAUDE.md`, on the requests of the session's own conversation, every subagent request left out.
- **Value:** `100% (526 of 526)`
- **Source:** `summary.json`, key `claudemd-s1-n60`.
- **Measurement:** `coverage.covered` minus `coverage.subagents.covered`, of `coverage.due` minus `coverage.subagents.due`; `byPath` gives a coverage of 1 on every path but `subagent`, `after /compact` included.
- **Date:** 2026-11-21. **Claude Code:** 2.1.328.

### D18

- **Claim:** sessions under noonsight that broke the invariant, with the paths generator 2 added, of those that ran to the end: 299 of the 300 generated. The other, `s1-0123`, stopped on a turn that got no answer (`step-timeout`).
- **Value:** `0 of 299`
- **Source:** `summary.json` of the run of 2026-11-23, key `on-g2-s1-n300`.
- **Measurement:** `robustness.sessionsFailed` of `harness.ok`, the sessions that ran to the end; `sessions` is the sessions generated.
- **Date:** 2026-11-23. **Claude Code:** 2.1.330.

### D19

- **Claim:** coverage under noonsight with the paths generator 2 added: requests with rules due that held all of them.
- **Value:** `100% (3,090 of 3,090)`
- **Source:** `summary.json` of the run of 2026-11-23, key `on-g2-s1-n300`.
- **Measurement:** `coverage.covered` of `coverage.due`.
- **Date:** 2026-11-23. **Claude Code:** 2.1.330.

### D20

- **Claim:** coverage of subagent requests under noonsight with the paths generator 2 added.
- **Value:** `100% (763 of 763)`
- **Source:** `summary.json` of the run of 2026-11-23, key `on-g2-s1-n300`.
- **Measurement:** `coverage.subagents.covered` of `coverage.subagents.due`.
- **Date:** 2026-11-23. **Claude Code:** 2.1.330.

### D21

- **Claim:** coverage under noonsight on the requests of the paths generator 2 added: a `/fork` session, after `/fork`, `/branch`, a forking resume or `/resume` in the session, in and after plan mode, and after starting subagents that edit a file.
- **Value:** `100% (453 of 453)`
- **Source:** `summary.json` of the run of 2026-11-23, key `on-g2-s1-n300`.
- **Measurement:** the sum of `due` over those paths of `byPath`, each covered at its `coverage`.
- **Date:** 2026-11-23. **Claude Code:** 2.1.330.

### D22

- **Claim:** coverage under noonsight in the sessions started through `noonsight run`, in a project with a trusted configuration, or both.
- **Value:** `100% (1,308 of 1,308)`
- **Source:** `summary.json` of the run of 2026-11-23, key `on-g2-s1-n300`.
- **Measurement:** `covered` of `due`, summed over `robustness.byStart` but `claude`.
- **Date:** 2026-11-23. **Claude Code:** 2.1.330.

### D23

- **Claim:** the corpus entries that had the outcome they record: the reproductions of F1 to F9, which pass, an entry for each path generator 2 added, and the documented limit.
- **Value:** `33 of 33`
- **Source:** `corpus.json` of the run of 2026-11-23.
- **Measurement:** entries whose `outcome` is `as-expected`, of all entries.
- **Date:** 2026-11-23. **Claude Code:** 2.1.330.

### D24

- **Claim:** the reproductions of F5 to F9 that break the invariant on the build before their fixes.
- **Value:** `8 of 8`
- **Source:** `before-fix/corpus.json` of the run of 2026-11-23: those entries, run with that run's harness against `main` at `19adf38`.
- **Measurement:** entries whose `outcome` is `regressed`, of all entries.
- **Date:** 2026-11-23. **Claude Code:** 2.1.330.

## Rule effects

The rule effect experiment ([experiments/rules](../experiments/rules/README.md)) runs one small task on a model with its preset rules delivered by noonsight and without, and reads what the session did.
Each run is a line of the result's `runs.jsonl`; "tests after the last edit" is `signals.verified` among the runs whose `signals.edited` is true, and cost is `cost_usd`, as Claude Code reports it at list price.

### R1

- **Claim:** Sonnet 5.5 and Haiku 5.5 ran the tests after a precisely described one-file fix, with their preset rules and without.
- **Value:** `30 of 30 against 0 of 30, and 27 of 30 against 0 of 30`
- **Source:** `experiments/rules/results/2026-11-19/runs.jsonl`.
- **Measurement:** task `fix`; tests after the last edit for Sonnet `rules`, Sonnet `none`, Haiku `rules`, Haiku `none`, in that order.
- **Date:** 2026-11-19. **Claude Code:** 2.1.328.

### R2

- **Claim:** Sonnet 5.5 ran the tests after a bug fix known only by its symptom, with its preset rules and without.
- **Value:** `30 of 30 against 15 of 30`
- **Source:** `experiments/rules/results/2026-11-19/runs.jsonl`.
- **Measurement:** task `bug`, model `sonnet`; tests after the last edit for `rules`, then `none`.
- **Date:** 2026-11-19. **Claude Code:** 2.1.328.

### R3

- **Claim:** on the same fix, `verify-changes` delivered alone, for Sonnet 5.5 and Haiku 5.5, and `carry-through` delivered alone, for each.
- **Value:** `29 of 30 and 27 of 30; 0 of 30 and 0 of 30`
- **Source:** `experiments/rules/results/2026-11-20/runs.jsonl`.
- **Measurement:** task `fix`; tests after the last edit for Sonnet `verify`, Haiku `verify`, Sonnet `carry`, Haiku `carry`, in that order.
- **Date:** 2026-11-20. **Claude Code:** 2.1.329.

### R4

- **Claim:** `verify-changes` delivered as one sentence naming a file that holds its text: the runs that read the file.
- **Value:** `120 of 120`
- **Source:** `experiments/rules/results/2026-11-20/runs.jsonl`.
- **Measurement:** runs of arm `pointer` whose `signals.pointer.read` is true, of all runs of arm `pointer`.
- **Date:** 2026-11-20. **Claude Code:** 2.1.329.

### R5

- **Claim:** tests after the last edit with the pointer and with the rule inline, on the fix for Sonnet 5.5 and Haiku 5.5.
- **Value:** `30 of 30 against 29 of 30, and 27 of 30 against 27 of 30`
- **Source:** `experiments/rules/results/2026-11-20/runs.jsonl`.
- **Measurement:** task `fix`; tests after the last edit for Sonnet `pointer`, Sonnet `verify`, Haiku `pointer`, Haiku `verify`, in that order.
- **Date:** 2026-11-20. **Claude Code:** 2.1.329.

### R6

- **Claim:** mean cost per run of Sonnet 5.5 on the fix, without rules, with `carry-through` alone, with `verify-changes` alone, with its pointer, and with the three rules the preset delivers there.
- **Value:** `$0.0240, $0.0247, $0.0505, $0.0440 and $0.0378`
- **Source:** `experiments/rules/results/2026-11-20/runs.jsonl`.
- **Measurement:** task `fix`, model `sonnet`; mean `cost_usd` of arms `none`, `carry`, `verify`, `pointer` and `rules`, to four decimals.
- **Date:** 2026-11-20. **Claude Code:** 2.1.329.

### R7

- **Claim:** mean cost per run of Haiku 5.5 on the fix, without rules, with `carry-through` alone, with `verify-changes` alone, with its pointer, and with the two rules the preset delivers there.
- **Value:** `$0.0015, $0.0018, $0.0033, $0.0038 and $0.0033`
- **Source:** `experiments/rules/results/2026-11-20/runs.jsonl`.
- **Measurement:** task `fix`, model `haiku`; mean `cost_usd` of arms `none`, `carry`, `verify`, `pointer` and `rules`, to four decimals.
- **Date:** 2026-11-20. **Claude Code:** 2.1.329.

### R8

- **Claim:** runs that passed the task's hidden check and the project's own tests, with or without rules.
- **Value:** `600 of 600`
- **Source:** `experiments/rules/results/2026-11-20/runs.jsonl`.
- **Measurement:** runs whose `signals.check_passed` and `signals.suite_passed` are both true, of all runs.
- **Date:** 2026-11-20. **Claude Code:** 2.1.329.

### R9

- **Claim:** Fable 5.2's mean words per sentence in its final report, with `fable-5-2/low-context-report` and without, on the question, the bug and the feature.
- **Value:** `12.3 against 16.4, 17.8 against 20.1, 12.2 against 16.2`
- **Source:** `experiments/rules/results/2026-11-19/runs.jsonl`.
- **Measurement:** model `fable`; mean `signals.report.words_per_sentence` of arm `rules`, then `none`, for tasks `question`, `bug` and `feature`, to one decimal. The result's README gives the test of each, significant after Holm's adjustment.
- **Date:** 2026-11-19. **Claude Code:** 2.1.328.

### R10

- **Claim:** on a 13-ticket backlog where one ticket leaves a decision open, the runs that did every part, with `sonnet-5-5/carry-through` and without.
- **Value:** `32 of 40 against 9 of 40`
- **Source:** `experiments/rules/results/2026-11-20-harder/runs.jsonl`.
- **Measurement:** task `triage`, model `sonnet`; runs whose `signals.completed` is true, arm `carry`, then `none`.
- **Date:** 2026-11-20. **Claude Code:** 2.1.329.

### R11

- **Claim:** the same for `haiku-5-5/carry-through`, which the run did not show to change anything.
- **Value:** `6 of 40 against 2 of 40`
- **Source:** `experiments/rules/results/2026-11-20-harder/runs.jsonl`.
- **Measurement:** task `triage`, model `haiku`; runs whose `signals.completed` is true, arm `carry`, then `none`.
- **Date:** 2026-11-20. **Claude Code:** 2.1.329.

### R12

- **Claim:** pilot runs of two long tasks, without the rules, that did every part as the check recorded them; the result's README reads the other one as done after a fix of the check.
- **Value:** `19 of 20`
- **Source:** `experiments/rules/results/2026-11-20-long/pilot/runs.jsonl`.
- **Measurement:** runs whose `signals.completed` is true, of all runs (Sonnet 5.5 and Haiku 5.5, tasks `migrate` and `backlog`, 5 each).
- **Date:** 2026-11-20. **Claude Code:** 2.1.329.

### R13

- **Claim:** on a feature across several files, without rules, Sonnet 5.5 and Haiku 5.5 ran the tests after their last edit.
- **Value:** `30 of 30 and 29 of 30`
- **Source:** `experiments/rules/results/2026-11-19/runs.jsonl`.
- **Measurement:** task `feature`, arm `none`; tests after the last edit for Sonnet, then Haiku.
- **Date:** 2026-11-19. **Claude Code:** 2.1.328.
