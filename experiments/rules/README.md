# Rule effect experiment

Does a preset rule change what its source says it changes when noonsight delivers it, and what does it cost in tokens?
This harness answers that with real Claude Code sessions, a few at a time, and writes what it measured to a result file.
It sends prompts to the models from the login of the person running it, so it spends usage, and it never runs in CI.
With `--stub`, a scripted stand-in on the same machine answers instead, so the whole harness runs without sending anything to Anthropic (see [The stub](#the-stub)).

## The design

The same small task runs on each target model in two arms, or in five for the design `single-rule`:

| Arm | Configuration | What the session receives |
| --- | --- | --- |
| `rules` | The model declared with `"use": "preset"` | The preset rules for the model, the task's scope and the place `unattended`, delivered by noonsight's `SessionStart` hook |
| `none` | The model declared with `"use": "none"` | Nothing; the same hook runs and logs `declared-none` |
| `verify` | The preset with every other rule that ships on for the model in `disable` | The model's `verify-changes` rule alone |
| `pointer` | As `verify`, with a user rule that `replaces` the model's `verify-changes` | One sentence naming a file that holds the text of the model's `verify-changes` and saying to read it before changing code |
| `carry` | As `verify`, keeping the model's `carry-through` rule | The model's `carry-through` rule alone |

An arm in `plan.json` is the entry the model gets in noonsight's configuration, except for two keys the harness reads.
`only` names the one preset rule the arm keeps, without its model prefix; the harness turns it into the `disable` list from the installed preset, and refuses a model whose preset has no such rule that ships on.
`pointer` delivers that rule as a pointer: the rule's text goes to a file beside the lab's configuration, outside the project, and a user rule of one sentence (`experiment/verify-changes-pointer`) replaces the preset rule with "A working rule for code changes is in the file <absolute path>. Read that file before you change any code, and follow it."
Since noonsight's `replaces` keeps the replaced rule's scopes, places and triggers, the pointer is delivered exactly where the rule would be, and only the delivered text differs from `verify`.
The allow list lets a session read that file with `Read`, `Grep` or `cat`.
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

Four more tasks are long, with many parts each, for the rules against stopping early ([The long design](#the-long-design) and [The harder design](#the-harder-design)):

| Task | Fixture | Scope | Shape | Asks for | Parts |
| --- | --- | --- | --- | --- | --- |
| `migrate` | `ledger-reports`, 18 plain-text reports over a ledger that holds amounts in five currencies | `build` | The same change, with a different detail, in many modules | Move every report from the deprecated `formatMoney`, which prints every amount as dollars, to `formatAmount(minor, currency)`, as `MIGRATION.md` describes, then add a line under Unreleased in `CHANGELOG.md` | 19: each report formats every amount in its own currency and no longer uses `formatMoney`, and the changelog has the entry |
| `backlog` | `orchard-log`, crate and weight totals from an orchard's harvest log, with a command line | `build` | Eight tickets of different kinds, listed in `TICKETS.md` | Work through all of the tickets: a bug, an input check, two command-line options, a unit conversion, a new command, the README, and a sort order the ticket leaves to whoever does it | 8, one per ticket |
| `codes` | `permit-forms`, 36 validators for the fields of a building permit form | `build` | The same change, with a different detail at each of 79 places, and a requirement at the end of its document | Move every validator from `true` or `false` to an error with the code of the failing check, as `ERRORS.md` describes, then the version and the changelog it asks for once that is done | 39: each validator, `validateForm`, the version and the changelog |
| `triage` | `pantry-stock`, a food bank's stock, with a command line | `build` | Thirteen tickets, three of them decisions left open, one asking for a plan first, one parked and one a duplicate, and a rule for closing them | Work through all of the tickets | 12: each ticket that asks for a change, and closing the tickets as `TICKETS.md` says |

A hidden check is copied into the project only after the session ends, so the session never sees it.
`solutions/` holds a reference solution for each task; `npm test` checks that each hidden check fails on its fixture and passes on its solution, and that the fixture's own suite passes on both.
The hidden check of a long task holds one test per part, named `part <name>`, each loading what it checks on its own, so a part left undone or broken fails only itself; `npm test` also checks that no part passes on the fixture and that one part's change passes that part alone.

### The signals

Each signal stands for an effect a rule's source claims; `plan.json` maps each rule to its signals.

| Signal | How it is computed | Rules |
| --- | --- | --- |
| Finished | The deliverable exists (`report.md`, or a change to a file the task allows), the session ended in success, and the final message does not hand the work back (an offer to go on or a question to the person, found by wording) | `sonnet-5-5/carry-through`, `haiku-5-5/carry-through`, `opus-5-5/unattended-run`, `fable-5-2/finish-work` |
| Every part done | On a long task, every part of the hidden check passes; the run also records how many did and which did not | `sonnet-5-5/carry-through`, `haiku-5-5/carry-through`, `opus-5-5/unattended-run` |
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
It also asks whether a rule works as well when noonsight delivers only a pointer to it, a sentence that names a file holding the rule's text, as when it delivers the text: the arm `pointer` against the arm `verify`, with the same rule.
Its comparisons and the way they are read are fixed here and in `plan.json` before it runs.

| Model | Tasks | Arms |
| --- | --- | --- |
| Sonnet 5.5 | `fix`, `bug` | `rules`, `verify`, `pointer`, `carry`, `none` |
| Haiku 5.5 | `fix`, `bug` | `rules`, `verify`, `pointer`, `carry`, `none` |

That is 600 runs: 2 models, 2 tasks each, 5 arms, 30 repetitions.

- The tasks are the two where the `rules` arm changed what a model did on 2026-11-19 (`fix` for both models, `bug` for Sonnet), and where it cost the most (from +22% to +127% per run).
- `feature` is left out: on 2026-11-19 both arms ran the tests in nearly every run there and the rules added under 10% to the cost, so there is little to split.
- `rules` and `none` run again rather than being taken from 2026-11-19, so that all five arms share one day, one Claude Code version and one machine.
- On `fix`, whose scope is `routine`, Sonnet's `rules` arm also delivers `sonnet-5-5/stay-in-scope`, as it did on 2026-11-19; the arms with one rule leave it out, so on that task the difference between `rules` and the two single rules also holds `stay-in-scope`.
- The `rules` arm is the reference for the parts: the summary gives each single rule's difference from `none` as a part of the `rules` arm's difference, and the parts need not add up to the whole, since two rules can overlap or add to each other.

### Comparisons

Twenty-one comparisons, each task apart: fourteen with the arm of one rule against `none`, and seven with the rule as a pointer against the rule inline.

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
| `sonnet-5-5/verify-changes` | Sonnet 5.5 | `pointer` against `verify` | Tests after the last edit, among the runs that edited code | None | `fix`, `bug` |
| `haiku-5-5/verify-changes` | Haiku 5.5 | `pointer` against `verify` | Tests after the last edit, among the runs that edited code | None | `fix` |
| `sonnet-5-5/verify-changes` | Sonnet 5.5 | `pointer` against `verify` | Cost per run | None | `fix`, `bug` |
| `haiku-5-5/verify-changes` | Haiku 5.5 | `pointer` against `verify` | Cost per run | None | `fix`, `bug` |

The claimed directions are the rule's `effect` and `cost` in the preset, from its source; no source says how a rule delivered as a pointer compares with the rule inline, so those seven claim no direction.
Haiku's `bug` is left out of the test comparisons: both arms ran the tests after the last edit in all 30 runs on 2026-11-19, so a single rule has nothing to show there.

Each comparison has a two-sided p, Fisher's exact test for the share and the Mann-Whitney U test for the cost, and Holm's adjustment runs over all twenty-one.
Where the source claims a direction, a comparison supports it when its adjusted p is below 0.05 and the difference goes that way, as in the expanded design.
Where the source claims none, the reading is the direction found ("higher" or "lower") when the adjusted p is below 0.05, and "not shown" otherwise.
`summarize --design single-rule` writes that reading for each one, and a table of every arm against `none` with each single rule's part of the `rules` arm's difference, which is descriptive.

They answer the question this way:

- If `verify` against `none` supports the source and `carry` against `none` is not shown, the tests come from `verify-changes`; a `carry` reading of "higher" would mean `carry-through` adds tests of its own (Haiku's version asks for the work to be "done and checked" before it stops).
- The cost of each rule alone is the difference of its arm from `none`; set against the `rules` arm, it says how much of the combined cost each rule carries.
- If `pointer` against `verify` is not shown on the tests, the pointer did not measurably change what the rule does on these tasks; a "lower" reading would mean that sending the model to a file loses some of the rule's effect, and the summary's table of reads says whether the runs that lost it had read the file.
- The cost of the pointer is the difference of `pointer` from `verify`: the read of the file against the rule's text in every request.

For each `pointer` run, `runs.jsonl` records whether and when the session read the rule file (`signals.pointer`): whether a call that opened it ran (a `Read` of it, a `Grep` in it, or a Bash command naming it), how many calls tried, refused ones included, the position of the first read among the session's tool calls, and whether it came before the first edit of code.
The summary gives these for each model and task, which is descriptive.

### Cost projection and cap

`npm run experiment -- estimate --design single-rule` prints the projection from the expected cost per run in `plan.json`:

| Model | Runs | Expected |
| --- | --- | --- |
| Sonnet 5.5 | 300 | $13.35 |
| Haiku 5.5 | 300 | $1.20 |
| In total | 600 | $14.55 |

The cap is $25, and each run keeps its model's budget (`budget_usd` in `plan.json`).

Where the expected costs come from:

- Every arm is assumed at the mean cost per run of the `rules` arm on 2026-11-19, on the same task and model, with Claude Code 2.1.328 (`results/2026-11-19/runs.jsonl`): $0.038 on `fix` and $0.051 on `bug` for Sonnet, $0.0034 and $0.0046 for Haiku.
- That should be an upper estimate, since `verify`, `pointer` and `carry` deliver one of the rules `rules` delivers and `none` delivers none; `pointer` adds the read of one short file.
- If `verify` and `pointer` cost what `rules` did and `carry` what `none` did, the total is about $12.37.
- The cap leaves room for runs that cost up to 1.7 times the projection; past that, it stops the run before its last repetitions.

## The long design

Two rules on by default claim that a model stops less before the work is done: `sonnet-5-5/carry-through` and `haiku-5-5/carry-through`.
On 2026-11-16 and 2026-11-19 every run finished with and without them, because every model finishes a short task, so their effect could not show.
The design `long` in `plan.json` gives them tasks long enough to stop before the end, `migrate` and `backlog`, and measures whether each run did every part.
`opus-5-5/unattended-run`, which claims the same of Opus 5.5, is left out: at about $1 a run on these tasks, its cells would cost more than twice the rest of the design together.
Its comparisons and the way they are read are fixed here and in `plan.json` before it runs.

| Model | Effort | Tasks | The rule in the arm `carry` |
| --- | --- | --- | --- |
| Sonnet 5.5 | `low` | `migrate`, `backlog` | `sonnet-5-5/carry-through` |
| Haiku 5.5 | `low` | `migrate`, `backlog` | `haiku-5-5/carry-through` |

The choices that shape it:

- The arm with the rule is `carry`, which delivers the model's `carry-through` alone ([The design](#the-design)).
  The arm `rules` would also deliver the verify rules of Sonnet 5.5 and Haiku 5.5, which change what a run does after an edit and so could change whether a part passes.
- Both models run at `low` effort, where their sources place the early stops (Sonnet's at low and medium effort, Haiku's at low).
- Both tasks are in the scope `build` and the place `unattended`, where both rules apply.
- Each run gets a budget of at least five times its expected cost (Sonnet 5.5 $2.50, Haiku 5.5 $0.50) and 40 minutes, so a limit rarely cuts a run short.
  A run cut short by its budget or its time limit with a part undone counts as not done, in either arm; the summary reports how every run ended.

### The pilot

Whether these models stop short on these tasks without the rules is not known, and where they never do, the rules have nothing to change.
So a pilot runs first: 5 runs of the arm `none` in each of the four cells, in a results directory of its own, within a cap of $10.
A cell enters the design only when at least 2 of its 5 pilot runs left a part undone.
The pilot's runs are not part of the design's data, and the gate reads the arm without the rules only, so it cannot favor either arm.
If no cell enters, the design does not run, and the reading is that these models do every part of these tasks without the rules.

### Comparisons

One comparison per cell that enters, up to four, each task apart, with the rule against without it:

| Rule | Model | Arms | Signal | Direction the source claims | Tasks |
| --- | --- | --- | --- | --- | --- |
| `sonnet-5-5/carry-through` | Sonnet 5.5 | `carry` against `none` | Every part done | Higher | `migrate`, `backlog` |
| `haiku-5-5/carry-through` | Haiku 5.5 | `carry` against `none` | Every part done | Higher | `migrate`, `backlog` |

Each comparison has a two-sided p from Fisher's exact test, and Holm's adjustment runs over the comparisons of the cells that entered.
A comparison supports the rule's source when its adjusted p is below 0.05 and the share with the rule is the higher one.
A part counts as done when its test in the hidden check passes, so a part done wrong counts as undone in both arms; the summary tells the runs that stopped with parts left (those that ended on their own, and whether they handed the work back) from those cut short by a limit.
The number of parts done, the hand-backs, the turns, tokens and cost are reported as measured and read as secondary.

The design runs 40 runs per arm and task.
In a simulation of Fisher's exact test at Holm's strictest threshold over four comparisons, a share of runs with every part done that goes from 50% without the rule to 90% with it shows about 9 times in 10 at 40 runs per arm, against about 8 in 10 at 30; from 70% to 95% it shows about 6 times in 10, and a difference of a few points does not show.

### Cost projection and cap of the long design

`npm run experiment -- estimate --design long` prints the projection from the expected cost per run in `plan.json`:

| Model | Pilot runs | Pilot expected | Design runs | Design expected |
| --- | --- | --- | --- | --- |
| Sonnet 5.5 | 10 | $4.25 | 160 | $68.00 |
| Haiku 5.5 | 10 | $0.40 | 160 | $6.40 |
| In total | 20 | $4.65 | 320 | $74.40 |

So $79.05 is expected if every cell enters, and less for each cell the pilot keeps out.
The pilot's cap is $10 and the design's $110, $120 in all; each run keeps the design's budget for its model.
Costs are list prices as Claude Code reports them, whatever the login pays.

Where the expected costs come from:

- The list prices per million tokens that the recorded runs of 2026-11-16 and 2026-11-19 imply, fitted on every run of each model: Sonnet 5.5 $0.10 for a cached input token read, $4 for one written and $10 for an output token; Haiku 5.5 $0.01, $0.20 and $0.50.
- The token counts of a run, assumed from Sonnet 5.5's `feature` runs of 2026-11-19, about 120,000 input tokens, 14,000 of them written to the cache, and 7,000 output tokens in 20 turns: a `migrate` run at about 750,000 read, 40,000 written and 12,000 output, a `backlog` run at about 1,400,000 read, 50,000 written and 15,000 output, for its eight tickets and test runs.
- Haiku 5.5 is assumed at about half again Sonnet's tokens, as it took more turns on the same tasks on 2026-11-19.
- Per run, that gives Sonnet 5.5 $0.35 on `migrate` and $0.50 on `backlog`, and Haiku 5.5 $0.03 and $0.05.
- The same assumptions give Opus 5.5, at medium effort and about two thirds more output, $0.90 and $1.20 a run, $178.50 for its pilot and design cells: the reason it is left out.
- If every run cost twice what is assumed, the design would cost about $149 with every cell in, and the cap would stop it after about 29 repetitions.

The pilot measures the cost per run before the design starts, and `summarize --design long --pilot` prints the design's projection at the measured cost for the cells that enter.
If that projection is above the design's cap, the design does not start with fewer repetitions; the cap or the cells are decided again first, since the 40 runs per arm are what the comparisons need.

### Running the long design

```bash
npm run experiment -- run --design long --pilot --concurrency 2 --out <pilot dir>
npm run experiment -- summarize <pilot dir> --design long --pilot
npm run experiment -- run --design long --gate <pilot dir> --concurrency 2 --out <dir>
npm run experiment -- summarize <dir> --design long
```

`--pilot` runs the pilot's cells within the pilot's cap; `summarize --pilot` writes the gate's reading of each cell and the design's projection after it.
`--gate` runs only the cells the pilot let in.
Long sessions take more memory, so these runs go two at a time.

## The harder design

The pilot of the design `long` found no early stop: Sonnet 5.5 and Haiku 5.5 did every part of `migrate` and `backlog` without the rules, in 20 of 20 runs ([results/2026-11-20-long](results/2026-11-20-long/README.md)).
The design `harder` in `plan.json` asks the same question on two tasks built to give a model reasons to stop before the end.
Each task puts in more than one such reason, and the two tasks put in different ones, since which one makes these models stop is not known.
Everything else is the design `long`: the arms `carry` and `none`, `low` effort, the scope `build` and the place `unattended`, the budgets and time limit, the pilot and its gate, and 40 runs per arm.
Its comparisons and the way they are read are fixed here and in `plan.json` before it runs.

| Task | Fixture | Asks for | Parts | Reasons to stop before the end |
| --- | --- | --- | --- | --- |
| `codes` | `permit-forms`, 36 validators for the fields of a building permit form | Move every validator from returning `true` or `false` to returning an error, `{ code, message }`, with the code of the check that failed from a table of 79 in `ERRORS.md` | 39: each validator returns `null` for valid values and the code of each failing check, `validateForm` returns the form's errors, the version is `2.0.0`, and the changelog has a `2.0.0` section above `1.4.2` | A long tail of the same change with a different detail each time, 79 return sites in 36 files, each matched by hand to its row of the table; the project's own tests break as the work goes and must be moved too; a requirement at the end of `ERRORS.md`, past the table, which the prompt does not name |
| `triage` | `pantry-stock`, a food bank's stock on the command line | Work through the 13 tickets in `TICKETS.md` | 12: one for each of the 11 tickets that ask for a change, and one for the way the file says to close tickets | Three tickets that leave a decision open and name people who disagree (warning windows per category, rounding, a new option name); a ticket that asks for a written plan before any code; work found only along the way (more unit spellings, in a file a TODO in `src/units.js` names; every command that prints batches); a parked ticket and a duplicate that ask for no code; a rule for closing tickets at the very end of the file |

The prompt of `codes` is "Move every field validator in src/fields/ from returning true or false to returning an error, as ERRORS.md describes. Then reply with a short report of what you changed."; that of `triage` is the prompt of `backlog`.
The parts that leave a choice open accept every choice that does what the ticket asks: any warning window shorter than 7 days for produce and longer than 7 for canned goods, whole numbers or one decimal, and any new name for the option, found among the names the code and the documents use.
`npm test` checks that each of those choices passes and that what does not do what the ticket asks fails, besides the checks every long task has ([The tasks](#the-tasks)).

The choices that shape it:

- The rule claims fewer stops "before it is done" (Sonnet 5.5) and fewer that "hand the task back" (Haiku 5.5).
  The decisions left open, the plan asked for first and the long tail are the occasions its text names as no reason to stop: confirming a plan, a question the model could settle itself, one part of a multipart task done.
- A ticket left undone for a decision, or a plan written and the code left for later, counts as a part undone in either arm.
  The decisions are ones the tickets leave to whoever does them, and the work is safe to do; the rule itself still allows a pause before a risky step, and none of these steps is one.
- Only behavior is checked, so a part done another way than the reference solution still counts.
- The tasks are new, so whether they make these models stop is what the pilot finds out, as for the design `long`.

### The pilot of the harder design

The pilot is the design `long`'s: 5 runs of the arm `none` in each of the four cells, in a results directory of its own, within a cap of $10.
A cell enters the design only when at least 2 of its 5 pilot runs left a part undone.
If no cell enters, the design does not run, and the reading is that these models do every part of these tasks without the rules; no other task is tried in its place within the same run.

### Comparisons of the harder design

One comparison per cell that enters, up to four, each task apart, with the rule against without it:

| Rule | Model | Arms | Signal | Direction the source claims | Tasks |
| --- | --- | --- | --- | --- | --- |
| `sonnet-5-5/carry-through` | Sonnet 5.5 | `carry` against `none` | Every part done | Higher | `codes`, `triage` |
| `haiku-5-5/carry-through` | Haiku 5.5 | `carry` against `none` | Every part done | Higher | `codes`, `triage` |

They are read as in the design `long`: Fisher's exact test, two-sided, Holm's adjustment over the comparisons of the cells that entered, and support for the source when the adjusted p is below 0.05 and the share with the rule is the higher one.
The number of parts done, how the runs ended, the hand-backs, the turns, tokens and cost are reported as measured and read as secondary.

### Cost projection and cap of the harder design

`npm run experiment -- estimate --design harder` prints the projection from the expected cost per run in `plan.json`:

| Model | Pilot runs | Pilot expected | Design runs | Design expected |
| --- | --- | --- | --- | --- |
| Sonnet 5.5 | 10 | $4.75 | 160 | $76.00 |
| Haiku 5.5 | 10 | $0.30 | 160 | $4.80 |
| In total | 20 | $5.05 | 320 | $80.80 |

So $85.85 is expected if every cell enters.
The caps are the design `long`'s: $10 for the pilot and $110 for the design, $120 in all, and each run keeps the budget of the design `long` for its model (Sonnet 5.5 $2.50, Haiku 5.5 $0.50).

Where the expected costs come from:

- The pilot of the design `long` measured the mean cost per run of the same models at the same effort: Sonnet 5.5 $0.303 on `migrate` and $0.173 on `backlog`, Haiku 5.5 $0.016 and $0.011 ([results/2026-11-20-long](results/2026-11-20-long/README.md)).
  Almost all of it was output tokens and tokens written to the cache, which grow with what a run reads and writes.
- `codes` changes 79 return sites in 36 files, against 29 calls in 18 files for `migrate`, and its source and instructions are about 1.8 times as long; it is assumed at about twice `migrate`'s cost: Sonnet 5.5 $0.60 and Haiku 5.5 $0.035 a run.
- `triage` has 13 tickets against 8, one of them a plan to write, and a ticket file about 1.6 times as long; it is assumed at twice `backlog`'s cost: Sonnet 5.5 $0.35 and Haiku 5.5 $0.025 a run.
- If every run cost 1.36 times the projection, the design would reach its cap; past that, the cap stops it before its last repetitions.

As in the design `long`, `summarize --design harder --pilot` prints the design's projection at the cost the pilot measured for the cells that enter, and if that projection is above the design's cap, the design does not start with fewer repetitions: the cap or the cells are decided again first.

### Running the harder design

```bash
npm run experiment -- run --design harder --pilot --concurrency 2 --token-file <file> --out <pilot dir>
npm run experiment -- summarize <pilot dir> --design harder --pilot
npm run experiment -- run --design harder --gate <pilot dir> --concurrency 2 --token-file <file> --out <dir>
npm run experiment -- summarize <dir> --design harder
```

A stub run of both steps, with `--stub` in place of `--token-file` and `--reps 5` for the design, lets every cell in and shows every comparison supporting the source.

## Running it

```bash
npm run experiment -- run [--design expanded|single-rule|long|harder [--pilot | --gate <pilot dir>]] [--models fable,sonnet] [--tasks question,fix] [--arms rules,none] [--reps 3] [--cap-usd 10] [--concurrency 3] [--stub | --token-file <file>] [--out <dir>]
npm run experiment -- estimate [--design expanded|single-rule|long|harder] [--reps 30]
npm run experiment -- summarize <dir> [--design expanded|single-rule|long|harder [--pilot]] [--to <dir>]
```

`run` records one JSON line per run in `<dir>/runs.jsonl`, and keeps each run's event stream, report and diff under `<dir>/runs/`.
With `--design`, the design gives the models, tasks, arms, repetitions and cap, and the effort, budgets and time limit where it sets them, and `--models`, `--tasks`, `--arms`, `--reps` and `--cap-usd` narrow or change them; without it, every given model runs every given task, and the tasks are the four short ones unless `--tasks` names others.
`--token-file` names a file, readable by its owner only, that holds a long-lived OAuth token of the account the runs spend from (`claude setup-token`); each session gets it in its environment, and it is written nowhere.
Without it, the sessions use the login of Claude Code's configuration directory.
The decision log of every run goes to `<dir>/decisions.jsonl`, so `noonsight report --log <dir>/decisions.jsonl` shows what noonsight delivered.
The hooks run this checkout's `dist/`, so do not build while an experiment runs: a hook that loads a file being rewritten fails.
A run whose decision log holds no session start, because the hook did not run or failed, is not recorded.
A run that stops can be started again with the same `--out`: the runs already recorded are skipped, so a later call with more `--reps` or other `--models` adds to the same results.
`summarize` writes `<dir>/summary.md` and, with `--to`, copies it with `runs.jsonl` into a results directory; `runs.jsonl` holds no path of the machine that ran it.
With `--design`, the summary adds the design's comparisons and its cost against the projection, and on the long tasks how the runs ended.

### Cost control

Each run passes `--max-budget-usd` with its model's budget from `plan.json`, the design's where it sets one.
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
Given the pointer rule, it first reads the file the pointer names, then plays the verify rule.
So a stub run of the design `expanded` must show every comparison on `fix`, `bug` and `feature` supporting the source, and none on `question`, whose report is the same file in both arms.
A stub run of the design `single-rule` must show the three test comparisons of `verify` supporting the source and the three of `carry` not shown, and every arm with a rule costing more than `none`: `verify` by one more turn, `carry` by the rule's text in every request, so the cost comparisons of `carry` read "supports the source" for Sonnet and "higher" for Haiku.
In the same run, every `pointer` run reads the rule file at its first tool call, `pointer` against `verify` is not shown on the tests, and its cost reads "higher", by the turn that reads the file.
On a long task, the script writes only the first half of the solution's files and ends with an offer to go on, so it leaves parts undone and hands the work back, unless the session received a rule against early stopping (a `carry-through` rule, or `opus-5-5/unattended-run`); with one, it does every part.
A stub run of the design `long` or `harder` lets every cell in after its pilot and must show every comparison supporting the source.
Any other reading means the harness, not a model, changed.
The stub reports usage at about four characters a token with no caching, so the cost of a stub run is simulated: it exercises the cap, and says nothing about what a model would spend.
A results directory holds stub runs or real ones, never both, and the summary of stub runs says so at its top.

## What it does not measure

- `fable-5-2/finish-work` reaches subagents only, and these tasks start none; Fable sessions already get Claude Code's own "Finishing work" advice.
- The rules that ship off are not delivered by `"use": "preset"`, so they are not measured unless an arm enables them.
- Where an arm delivers several rules together, as Sonnet's does, a signal is credited to the rule whose source claims it, but the arm cannot tell the rules apart; the design `single-rule` separates `verify-changes` from `carry-through` for Sonnet and Haiku, on `fix` and `bug` only.
- The pointer arm tries one wording of the pointer, with the file outside the project and named by its absolute path, for one rule; another wording, a file inside the project, or a longer rule could read differently.
- The four short tasks are small, so the finished signal can hardly tell the arms apart on them: both usually finish. The long design is there for that.
- The hand-back check reads wording and can miss an offer or flag a sentence that only mentions one.
- The prose measures leave tables out, so a report written mostly as a table gets few sentences.
- The fixtures are small JavaScript projects with no dependencies, in one language, in the place `unattended` only, and at one effort per model: `medium` in every design but `long` and `harder`, which run Sonnet 5.5 and Haiku 5.5 at `low`.
- `opus-5-5/unattended-run`: the short tasks cannot tell its signal apart, and the designs `long` and `harder` leave Opus 5.5 out for its cost.
- The long tasks are long for a session on a small project, not of the size of real work; a model that does every part here may still stop on a task many times longer.
- The harder tasks put several reasons to stop into each task, so a difference between the arms on one of them does not say which reason the rule acted on; the summary's parts left undone show where the runs stopped.
- The hidden checks test behavior; the quality of the code or of the tests a session adds is not assessed.

## Results

`results/` holds the result of each run of the experiment that was written up, with its date: `runs.jsonl`, the generated `summary.md`, and a reading of the data.
[results/2026-11-19](results/2026-11-19/README.md) is the first run of the design `expanded`.
[results/2026-11-20](results/2026-11-20/README.md) is the first run of the design `single-rule`.
[results/2026-11-20-long](results/2026-11-20-long/README.md) is the first run of the design `long`: its pilot found no early stop without the rules, so the comparisons did not run.
