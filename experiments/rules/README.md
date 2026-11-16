# Rule effect experiment

Does a preset rule change what its source says it changes when sextant delivers it, and what does it cost in tokens?
This harness answers that with real Claude Code sessions, a few at a time, and writes what it measured to a result file.
It sends prompts to the models from the login of the person running it, so it spends usage, and it never runs in CI.

## The design

The same small task runs on each target model in two arms:

| Arm | Configuration | What the session receives |
| --- | --- | --- |
| `rules` | The model declared with `"use": "preset"` | The preset rules for the model, the task's scope and the place `unattended`, delivered by sextant's `SessionStart` hook |
| `none` | The model declared with `"use": "none"` | Nothing; the same hook runs and logs `declared-none` |

Everything else is the same in both arms: the prompt, the model, the effort, the tools, the fixture project and the hooks.
So a difference between the arms comes from the rules or from chance, and with a few runs per arm chance stays large.

A session is in the place `unattended` because the plan's variable (`SEXTANT_EXPERIMENT`) is listed in `session.unattended_when_env` and set, as an orchestrator's workers would be.
The scope comes from `SEXTANT_SCOPE`, set to the task's scope.
The rules a run received are read from its decision log, not assumed from the arm.

### The tasks

Both tasks run in a copy of `fixture/`, a small scheduler whose five jobs should stay silent while paused and during quiet hours; three of them do not.

| Task | Scope | Asks for | Correct when |
| --- | --- | --- | --- |
| `question` | `investigate` | A read-only answer: which jobs honor the pause switch and the quiet hours, with file and line evidence, in `report.md`, ending with a line naming the jobs that ignore a control | The answer line names `digest`, `metrics` and `sync`, and no other job |
| `fix` | `routine` | A precise one-file change: make `src/jobs/digest.js` stay silent during quiet hours as `backup.js` does, then a short report | `check/digest.test.js`, copied into the project only after the session ends, passes |

### The signals

Each signal stands for an effect a rule's source claims; `plan.json` maps each rule to its signals.

| Signal | How it is computed | Rules |
| --- | --- | --- |
| Finished | The deliverable exists (`report.md`, or a change to the file asked), the session ended in success, and the final message does not hand the work back (an offer to go on or a question to the person, found by wording) | `sonnet-5-5/carry-through`, `haiku-5-5/carry-through`, `opus-5-5/unattended-run`, `fable-5-2/finish-work` |
| Tests after the last edit | A test or run command that was allowed to run, after the last edit of a file other than the report | `sonnet-5-5/verify-changes`, `haiku-5-5/verify-changes` |
| Extra files | Files changed beyond the ones the task asks to change | `sonnet-5-5/stay-in-scope`, `haiku-5-5/carry-through` |
| Words per sentence, semicolons and parentheses per 1,000 words | Measured on the report (`report.md`, or the final message), outside code blocks, tables and headings | `fable-5-2/low-context-report` |

The token cost of a run is what Claude Code's result event reports: output tokens, input tokens (cached ones included) and `total_cost_usd`, summed over every model the session used.
The cost of a rule is the difference between the arms' means; it holds both the rule text read on every turn and whatever the rule makes the model do, such as an extra test run.

### Isolation

Each run gets the lab the live tests use (`test/live/login.ts`): a temporary home for sextant, its own configuration, and sextant's hook entries in a `--settings` file.
`--setting-sources project,local` keeps the person's own settings and `CLAUDE.md` out, `--strict-mcp-config` their MCP servers, `--disable-slash-commands` their skills, and `--no-session-persistence` keeps the runs out of their session history.
The tools are limited to `Bash`, `Read`, `Grep`, `Glob`, `Edit` and `Write`, and `Bash` is allowed only for `npm test`, `node`, `ls` and `cat`, so a session cannot start subagents and has none of the usual shell network tools (a `node` script could still open a connection).

## Running it

```bash
npm run experiment -- run [--models fable,sonnet] [--tasks question,fix] [--arms rules,none] [--reps 3] [--cap-usd 10] [--concurrency 3] [--out <dir>]
npm run experiment -- summarize <dir> [--to <dir>]
```

`run` records one JSON line per run in `<dir>/runs.jsonl`, and keeps each run's event stream, report and diff under `<dir>/runs/`.
The decision log of every run goes to `<dir>/decisions.jsonl`, so `sextant report --log <dir>/decisions.jsonl` shows what sextant delivered.
The hooks run this checkout's `dist/`, so do not build while an experiment runs: a hook that loads a file being rewritten fails.
A run whose decision log holds no session start, because the hook did not run or failed, is not recorded.
A run that stops can be started again with the same `--out`: the runs already recorded are skipped, so a later call with more `--reps` or other `--models` adds to the same results.
`summarize` writes `<dir>/summary.md` and, with `--to`, copies it with `runs.jsonl` into a results directory; `runs.jsonl` holds no path of the machine that ran it.

### Cost control

Each run passes `--max-budget-usd` with its model's budget from `plan.json`.
A run starts only while the money already spent in `<dir>`, plus the budgets of the runs in flight, plus its own budget stays within `--cap-usd`.
Claude Code checks a run's budget between turns, so a run can pass its own budget by the cost of its last turn.
A run that ends with no cost reported, such as one stopped at its time limit, counts its whole budget toward the cap.
A run that is not recorded, such as one whose hook logged no session start, counts toward the cap for the rest of that `run`, but a resume does not count it again; the cap holds otherwise.
Cost is what Claude Code reports, which is the API list price whatever the login pays.

## What it does not measure

- `fable-5-2/finish-work` reaches subagents only, and these tasks start none; Fable sessions already get Claude Code's own "Finishing work" advice.
- The rules that ship off are not delivered by `"use": "preset"`, so they are not measured unless an arm enables them.
- Where an arm delivers several rules together, as Sonnet's does, a signal is credited to the rule whose source claims it, but the arm cannot tell the rules apart.
- The tasks are small, so the finished signal can hardly tell the arms apart: both usually finish.
- The hand-back check reads wording and can miss an offer or flag a sentence that only mentions one.
- The prose measures leave tables out, so a report written mostly as a table gets few sentences.

## Results

`results/` holds the result of each run of the experiment that was written up, with its date: `runs.jsonl`, the generated `summary.md`, and a reading of the data.
