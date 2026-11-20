# Rule effect experiment

Does a preset rule change what its source says it changes when noonsight delivers it, and what does it cost in tokens?
This harness answers that with real Claude Code sessions, a few at a time, and writes what it measured to a result file.
It sends prompts to the models from the login of the person running it, so it spends usage, and it never runs in CI.
With `--stub`, a scripted stand-in on the same machine answers instead, so the whole harness runs without sending anything to Anthropic (see [The stub](#the-stub)).

## The design

The same small task runs on each target model in two arms, or in four for the design `single-rule`:

| Arm | Configuration | What the session receives |
| --- | --- | --- |
| `rules` | The model declared with `"use": "preset"` | The preset rules for the model, the task's scope and the place `unattended`, delivered by noonsight's `SessionStart` hook |
| `none` | The model declared with `"use": "none"` | Nothing; the same hook runs and logs `declared-none` |
| `verify` | The preset with every other rule that ships on for the model in `disable` | The model's `verify-changes` rule alone |
| `carry` | The same, keeping the model's `carry-through` rule | The model's `carry-through` rule alone |

An arm in `plan.json` is the entry the model gets in noonsight's configuration, except for `only`, which names the one preset rule the arm keeps, without its model prefix; the harness turns it into the `disable` list from the installed preset, and refuses a model whose preset has no such rule that ships on.
Without a design, a run covers the arms in `default_arms`, `rules` and `none`.

Everything else is the same in every arm: the prompt, the model, the effort, the tools, the fixture project and the hooks.
So a difference between the arms comes from the rules or from chance, and with a few runs per arm chance stays large.

A session is in the place `unattended` because the plan's variable (`NOONSIGHT_EXPERIMENT`) is listed in `session.unattended_when_env` and set, as an orchestrator's workers would be.
The scope comes from `NOONSIGHT_SCOPE`, set to the task's scope.
The rules a run received are read from its decision log, not assumed from the arm.

### The tasks

Each task runs in a fresh copy of its fixture, a small Node.js project in `fixtures/` with its own `npm test`.
The four tasks have different shapes: a read-only question, a precise one-file fix, a bug known only by its symptom, and a feature that spans several files.

| Task | Fixture | Scope | Shape | Asks for | Correct when |
| --- | --- | --- | --- | --- | --- |
| `question` | `harbor-clock`, a scheduler whose five jobs should stay silent while paused and during quiet hours; three of them do not | `investigate` | Read-only answer | Which jobs honor the pause switch and the quiet hours, with file and line evidence, in `report.md`, ending with a line naming the jobs that ignore a control | The answer line names `digest`, `metrics` and `sync`, and no other job |
| `fix` | `harbor-clock` | `routine` | One named file, the change described | Make `src/jobs/digest.js` stay silent during quiet hours as `backup.js` does, then a short report | `checks/fix.test.js` passes |
| `bug` | `rain-gauge`, weekly and season rainfall totals per station | `build` | A symptom, the cause in another module | The weekly totals sometimes add up to more than the season total: find the cause, fix it, report the cause and the change | `checks/bug.test.js` passes: a reading on the hour two weeks meet counts once, in the later week, as `src/periods.js` documents, and the weeks add up to the season |
| `feature` | `parcel-rates`, parcel prices by weight and zone, with a command line | `build` | A feature across several files | An express option at twice the price in zones 1 to 3 and refused in zone 4, in `quote()` and as `--express`, documented in `README.md` | `checks/feature.test.js` passes: prices, the zone 4 error naming the zone, the flag in any position, and the README |

A hidden check is copied into the project only after the session ends, so the session never sees it.
`solutions/` holds a reference solution for each task; `npm test` checks that each hidden check fails on its fixture and passes on its solution, and that the fixture's own suite passes on both.

### The signals

Each signal stands for an effect a rule's source claims; `plan.json` maps each rule to its signals.

| Signal | How it is computed | Rules |
| --- | --- | --- |
| Finished | The deliverable exists (`report.md`, or a change to a file the task allows), the session ended in success, and the final message does not hand the work back (an offer to go on or a question to the person, found by wording) | `sonnet-5-5/carry-through`, `haiku-5-5/carry-through`, `opus-5-5/unattended-run`, `fable-5-2/finish-work` |
| Tests after the last edit | A test or run command that was allowed to run, after the last edit of a file other than the report | `sonnet-5-5/verify-changes`, `haiku-5-5/verify-changes` |
| Extra files | Files changed beyond the ones the task allows (`allowed_changes` in `plan.json`, where `*` stands for any characters) | `sonnet-5-5/stay-in-scope`, `haiku-5-5/carry-through` |
| Words per sentence, semicolons and parentheses per 1,000 words | Measured on the report (`report.md`, or the final message), outside code blocks, tables and headings | `fable-5-2/low-context-report` |

The token cost of a run is what Claude Code's result event reports: output tokens, input tokens (cached ones included) and `total_cost_usd`, summed over every model the session used.
The cost of a rule is the difference between the arms' means; it holds both the rule text read on every turn and whatever the rule makes the model do, such as an extra test run.

The summary gives each share with its Wilson 95% interval, and each comparison of the arms with a two-sided p: Fisher's exact test for a share, the Mann-Whitney U test for a measure ([stats.ts](stats.ts)).

### Isolation

Each run gets the lab the live tests use (`test/live/login.ts`): a temporary home for noonsight, its own configuration, and noonsight's hook entries in a `--settings` file.
`--setting-sources project,local` keeps the person's own settings and `CLAUDE.md` out, `--strict-mcp-config` their MCP servers, `--disable-slash-commands` their skills, and `--no-session-persistence` keeps the runs out of their session history.
The tools are limited to `Bash`, `Read`, `Grep`, `Glob`, `Edit` and `Write`, and `Bash` is allowed only for `npm test`, `node`, `ls` and `cat`, so a session cannot start subagents and has none of the usual shell network tools (a `node` script could still open a connection).

## The expanded design

The 2026-11-16 run showed three rules moving the signal their source claims, on one fixture and 3 to 10 runs per arm.
The design `expanded` in `plan.json` tests those three rules again, each on three tasks of different shapes, with 30 runs per arm and task.
Its comparisons and the way they are read are fixed here and in `plan.json` before it runs.

| Model | Tasks | Rules in the `rules` arm |
| --- | --- | --- |
| Sonnet 5.5 | `fix`, `bug`, `feature` | `sonnet-5-5/verify-changes` and `sonnet-5-5/carry-through`, and `sonnet-5-5/stay-in-scope` on `fix` (scope `routine`) |
| Haiku 5.5 | `fix`, `bug`, `feature` | `haiku-5-5/verify-changes` and `haiku-5-5/carry-through` |
| Fable 5.2 | `question`, `bug`, `feature` | `fable-5-2/low-context-report` |

That is 540 runs: 3 models, 3 tasks each, 2 arms, 30 repetitions.
Opus 5.5 is left out: its rule's signal could not tell the arms apart on these short tasks, and more runs of the same tasks would not change that.

### Comparisons

Twelve comparisons, each task apart, with the rule against without it:

| Rule | Model | Signal | Direction the source claims | Tasks |
| --- | --- | --- | --- | --- |
| `sonnet-5-5/verify-changes` | Sonnet 5.5 | Tests after the last edit, among the runs that edited code | Higher | `fix`, `bug`, `feature` |
| `haiku-5-5/verify-changes` | Haiku 5.5 | Tests after the last edit, among the runs that edited code | Higher | `fix`, `bug`, `feature` |
| `fable-5-2/low-context-report` | Fable 5.2 | Words per sentence in the report | Lower | `question`, `bug`, `feature` |
| `fable-5-2/low-context-report` | Fable 5.2 | Semicolons per 1,000 words in the report | Lower | `question`, `bug`, `feature` |

Each comparison has a two-sided p, Fisher's exact test for the share and the Mann-Whitney U test for the measures, and Holm's adjustment runs over all twelve.
A comparison supports the rule's source when its adjusted p is below 0.05 and the difference goes the way the source claims; `summarize --design expanded` writes that reading for each one.
For a measure, the direction is the one the test measures, from its statistic U, not from the medians, which can tie (at no semicolon, say) while the runs still differ.
Everything else in the summary (the other signals, correctness, tokens and cost) is reported as measured and read as secondary.
With 30 runs per arm, a share that goes from 10% to 50% gives p of about 0.002, still below 0.05 after Holm's adjustment over twelve, so the differences of 2026-11-16 would show clearly if they hold; a difference of a few points would not.

### Cost projection and cap

`npm run experiment -- estimate --design expanded` prints the projection from the expected cost per run in `plan.json`:

| Model | Runs | Expected |
| --- | --- | --- |
| Fable 5.2 | 180 | $67.20 |
| Sonnet 5.5 | 180 | $10.20 |
| Haiku 5.5 | 180 | $0.78 |
| In total | 540 | $78.18 |

The cap is $120, and each run keeps its model's budget (`budget_usd` in `plan.json`).
Costs are list prices as Claude Code reports them, whatever the login pays.

Where the expected costs come from:

- `question` and `fix`: the mean cost per run measured on 2026-11-16, both arms together, with Claude Code 2.1.326 (`results/2026-11-16/runs.jsonl`).
- `bug`: assumed at 1.2 times the model's `question` cost, since it reads a few files, edits one and reports.
- `feature`: assumed at 1.5 times the model's `question` cost, since it reads and edits three files.
- If `bug` and `feature` cost twice what is assumed, the total is about $136, and the cap stops the run before its last repetitions.

To check the assumptions before most of the money is spent, run the first 10 repetitions (about $26 expected), compare the measured cost with the projection (`summarize --design expanded` prints both), and then run again with `--reps 30` and the same `--out`, which adds the rest.

## The single-rule design

On 2026-11-19 the `rules` arm delivered `verify-changes` and `carry-through` together to Sonnet 5.5 and Haiku 5.5, so the tests it added and the cost it added could not be credited to either rule.
The design `single-rule` in `plan.json` separates them: each rule alone, both together and neither, on the same tasks, in the same run.
Its comparisons and the way they are read are fixed here and in `plan.json` before it runs.

| Model | Tasks | Arms |
| --- | --- | --- |
| Sonnet 5.5 | `fix`, `bug` | `rules`, `verify`, `carry`, `none` |
| Haiku 5.5 | `fix`, `bug` | `rules`, `verify`, `carry`, `none` |

That is 480 runs: 2 models, 2 tasks each, 4 arms, 30 repetitions.

- The tasks are the two where the `rules` arm changed what a model did on 2026-11-19 (`fix` for both models, `bug` for Sonnet), and where it cost the most (from +22% to +127% per run).
- `feature` is left out: on 2026-11-19 both arms ran the tests in nearly every run there and the rules added under 10% to the cost, so there is little to split.
- `rules` and `none` run again rather than being taken from 2026-11-19, so that all four arms share one day, one Claude Code version and one machine.
- On `fix`, whose scope is `routine`, Sonnet's `rules` arm also delivers `sonnet-5-5/stay-in-scope`, as it did on 2026-11-19; the arms with one rule leave it out, so on that task the difference between `rules` and the two single rules also holds `stay-in-scope`.
- The `rules` arm is the reference for the parts: the summary gives each single rule's difference from `none` as a part of the `rules` arm's difference, and the parts need not add up to the whole, since two rules can overlap or add to each other.

### Comparisons

Fourteen comparisons, each task apart, with the arm of one rule against `none`:

| Rule | Model | Arms | Signal | Direction the source claims | Tasks |
| --- | --- | --- | --- | --- | --- |
| `sonnet-5-5/verify-changes` | Sonnet 5.5 | `verify` against `none` | Tests after the last edit, among the runs that edited code | Higher | `fix`, `bug` |
| `haiku-5-5/verify-changes` | Haiku 5.5 | `verify` against `none` | Tests after the last edit, among the runs that edited code | Higher | `fix` |
| `sonnet-5-5/carry-through` | Sonnet 5.5 | `carry` against `none` | Tests after the last edit, among the runs that edited code | None | `fix`, `bug` |
| `haiku-5-5/carry-through` | Haiku 5.5 | `carry` against `none` | Tests after the last edit, among the runs that edited code | None | `fix` |
| `sonnet-5-5/verify-changes` | Sonnet 5.5 | `verify` against `none` | Cost per run | Higher ("slightly higher cost per task") | `fix`, `bug` |
| `haiku-5-5/verify-changes` | Haiku 5.5 | `verify` against `none` | Cost per run | Higher ("more tokens") | `fix`, `bug` |
| `sonnet-5-5/carry-through` | Sonnet 5.5 | `carry` against `none` | Cost per run | Higher ("sessions run longer and cost more") | `fix`, `bug` |
| `haiku-5-5/carry-through` | Haiku 5.5 | `carry` against `none` | Cost per run | None ("not reported for the text") | `fix`, `bug` |

The claimed directions are the rule's `effect` and `cost` in the preset, from its source.
Haiku's `bug` is left out of the test comparisons: both arms ran the tests after the last edit in all 30 runs on 2026-11-19, so a single rule has nothing to show there.

Each comparison has a two-sided p, Fisher's exact test for the share and the Mann-Whitney U test for the cost, and Holm's adjustment runs over all fourteen.
Where the source claims a direction, a comparison supports it when its adjusted p is below 0.05 and the difference goes that way, as in the expanded design.
Where the source claims none, the reading is the direction found ("higher" or "lower") when the adjusted p is below 0.05, and "not shown" otherwise.
`summarize --design single-rule` writes that reading for each one, and a table of every arm against `none` with each single rule's part of the `rules` arm's difference, which is descriptive.

They answer the question this way:

- If `verify` against `none` supports the source and `carry` against `none` is not shown, the tests come from `verify-changes`; a `carry` reading of "higher" would mean `carry-through` adds tests of its own (Haiku's version asks for the work to be "done and checked" before it stops).
- The cost of each rule alone is the difference of its arm from `none`; set against the `rules` arm, it says how much of the combined cost each rule carries.

### Cost projection and cap

`npm run experiment -- estimate --design single-rule` prints the projection from the expected cost per run in `plan.json`:

| Model | Runs | Expected |
| --- | --- | --- |
| Sonnet 5.5 | 240 | $10.68 |
| Haiku 5.5 | 240 | $0.96 |
| In total | 480 | $11.64 |

The cap is $20, and each run keeps its model's budget (`budget_usd` in `plan.json`).

Where the expected costs come from:

- Every arm is assumed at the mean cost per run of the `rules` arm on 2026-11-19, on the same task and model, with Claude Code 2.1.328 (`results/2026-11-19/runs.jsonl`): $0.038 on `fix` and $0.051 on `bug` for Sonnet, $0.0034 and $0.0046 for Haiku.
- That should be an upper estimate, since `verify` and `carry` deliver one of the rules `rules` delivers and `none` delivers none.
- If `verify` costs what `rules` did and `carry` what `none` did, the total is about $9.47.
- The cap leaves room for runs that cost up to 1.7 times the projection; past that, it stops the run before its last repetitions.

## Running it

```bash
npm run experiment -- run [--design expanded|single-rule] [--models fable,sonnet] [--tasks question,fix] [--arms rules,none] [--reps 3] [--cap-usd 10] [--concurrency 3] [--stub] [--out <dir>]
npm run experiment -- estimate [--design expanded|single-rule] [--reps 30]
npm run experiment -- summarize <dir> [--design expanded|single-rule] [--to <dir>]
```

`run` records one JSON line per run in `<dir>/runs.jsonl`, and keeps each run's event stream, report and diff under `<dir>/runs/`.
With `--design`, the design gives the models, tasks, arms, repetitions and cap, and `--models`, `--tasks`, `--arms`, `--reps` and `--cap-usd` narrow or change them; without it, every given model runs every given task.
The decision log of every run goes to `<dir>/decisions.jsonl`, so `noonsight report --log <dir>/decisions.jsonl` shows what noonsight delivered.
The hooks run this checkout's `dist/`, so do not build while an experiment runs: a hook that loads a file being rewritten fails.
A run whose decision log holds no session start, because the hook did not run or failed, is not recorded.
A run that stops can be started again with the same `--out`: the runs already recorded are skipped, so a later call with more `--reps` or other `--models` adds to the same results.
`summarize` writes `<dir>/summary.md` and, with `--to`, copies it with `runs.jsonl` into a results directory; `runs.jsonl` holds no path of the machine that ran it.
With `--design`, the summary adds the design's comparisons and its cost against the projection.

### Cost control

Each run passes `--max-budget-usd` with its model's budget from `plan.json`.
A run starts only while the money already spent in `<dir>`, plus the budgets of the runs in flight, plus its own budget stays within the cap.
The first run that cannot fit ends the queue, even when a cheaper one would fit, so the cells keep the same number of repetitions up to the one under way.
Claude Code checks a run's budget between turns, so a run can pass its own budget by the cost of its last turn.
A run that ends with no cost reported, such as one stopped at its time limit, counts its whole budget toward the cap.
A run that is not recorded, such as one whose hook logged no session start, counts toward the cap for the rest of that `run`, but a resume does not count it again; the cap holds otherwise.
Cost is what Claude Code reports, which is the API list price whatever the login pays.

### The stub

`run --stub` sends every request of every session to a local stand-in for the Messages API ([stub.ts](stub.ts), on the delivery benchmark's server, [../delivery/stub.ts](../delivery/stub.ts)).
Each session gets its own home and Claude Code configuration directory and a placeholder login token, so nothing of the person's login is used and nothing reaches Anthropic.
Claude Code, the lab, noonsight's hooks, the hidden checks, the scoring and the summary are the real ones; only the answers are scripted.
The script plays the task's reference solution: it reads the files the solution changes, writes the solution, runs `npm test` only when the session received a `verify-changes` rule and the task changes code, and ends with a short report, plain with any rule and dense without one.
It reads which rules the session received from noonsight's own envelope in the request, so it plays an arm of one rule as that rule alone.
So a stub run of the design `expanded` must show every comparison on `fix`, `bug` and `feature` supporting the source, and none on `question`, whose report is the same file in both arms.
A stub run of the design `single-rule` must show the three test comparisons of `verify` supporting the source and the three of `carry` not shown, and every arm with a rule costing more than `none`: `verify` by one more turn, `carry` by the rule's text in every request, so the cost comparisons of `carry` read "supports the source" for Sonnet and "higher" for Haiku.
Any other reading means the harness, not a model, changed.
The stub reports usage at about four characters a token with no caching, so the cost of a stub run is simulated: it exercises the cap, and says nothing about what a model would spend.
A results directory holds stub runs or real ones, never both, and the summary of stub runs says so at its top.

## What it does not measure

- `fable-5-2/finish-work` reaches subagents only, and these tasks start none; Fable sessions already get Claude Code's own "Finishing work" advice.
- The rules that ship off are not delivered by `"use": "preset"`, so they are not measured unless an arm enables them.
- Where an arm delivers several rules together, as Sonnet's does, a signal is credited to the rule whose source claims it, but the arm cannot tell the rules apart; the design `single-rule` separates `verify-changes` from `carry-through` for Sonnet and Haiku, on `fix` and `bug` only.
- The tasks are small, so the finished signal can hardly tell the arms apart: both usually finish.
- The hand-back check reads wording and can miss an offer or flag a sentence that only mentions one.
- The prose measures leave tables out, so a report written mostly as a table gets few sentences.
- The fixtures are small JavaScript projects with no dependencies, in one language, at one effort level (`medium`) and in the place `unattended` only.
- The hidden checks test behavior; the quality of the code or of the tests a session adds is not assessed.

## Results

`results/` holds the result of each run of the experiment that was written up, with its date: `runs.jsonl`, the generated `summary.md`, and a reading of the data.
[results/2026-11-19](results/2026-11-19/README.md) is the first run of the design `expanded`.
