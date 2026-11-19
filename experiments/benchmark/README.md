# Benchmark pilot

Does delivering the `claude` preset's rules through noonsight change what Claude Code does on public, real-world tasks, and at what cost?
And against the usual alternative, rules in a Markdown file: do the rules reach the session for certain, and does each model do better with only the rules written for it?
This folder holds the pilot of the study that answers it: the harness, the task lists, the delivery probe and the pre-registration ([preregistration.md](preregistration.md)) that the results are read against.
The pilot checks the harness, the verifiers, the cost and the run-to-run spread before a larger study; it makes no claim about the rules by itself.

It sends prompts to the models from the login of the person running it, so it spends usage, and it never runs in CI.
`fetch` and `gold` call no model.

## The design in short

| | |
| --- | --- |
| Task sets | Build and fix: SWE-bench Verified, only instances with a native arm64 image. Routine: Terminal-Bench 2.1. Open tasks: digest (new, on SWE-bench issue threads), review (ReviewBench), investigate (SWE Atlas Codebase QnA) |
| Models | Claude Fable 5.2, Opus 5.5, Sonnet 5.5 and Haiku 5.5, effort `medium` |
| Conditions | `off`, `on`, `claudemd` (every model's rules in one `CLAUDE.md`), `scattered` (a `CLAUDE.md` that only points to them) |
| Rounds | 2 per task, model and condition; 1 for `scattered` |
| Order | Build off and on first, then the other sets off and on, then `claudemd`, then `scattered`; within a round, a seeded order |
| Spending | `--max-budget-usd` per run, US$ 200 in total, a budget per night, and a 50 percent floor on the account's weekly quota |
| Place and scope | `unattended`, through `NOONSIGHT_EXPERIMENT`; the scope of each set through `NOONSIGHT_SCOPE` |

Every number lives in [plan.json](plan.json), and the pre-registration says why.

### How noonsight reaches the session

Each run is a fresh [Harbor](https://github.com/harbor-framework/harbor) trial: a new container from the task's image.
The agent is Harbor's own `claude-code` adapter, extended in [harbor/noonsight_agent.py](harbor/noonsight_agent.py) to install, in the container, Claude Code at the pinned version, a pinned Node.js checked against its sha256, and noonsight packed from this checkout.
It writes the condition's `noonsight.json` and a hook pointer, and Claude Code gets noonsight's hook entries through the settings file Harbor passes with `--settings`.
noonsight's home is under `/logs/agent`, so each run's decision log comes back with its logs and says what the session received.
A run whose log has no session start is not recorded, and is tried again.

The conditions ([conditions.ts](conditions.ts)):

| Condition | Configuration for the model | What the session receives |
| --- | --- | --- |
| `off` | `{"use": "none"}` | Nothing; the hook runs and logs `declared-none` |
| `on` | `{"use": "preset"}` | The preset's default-on rules for the model, scope and place |
| `claudemd` | `{"use": "none"}`, and the user `CLAUDE.md` | Every default-on rule of all four models, under a heading per model, each with its scopes and places as a line of text: one Markdown file every model reads |
| `scattered` | `{"use": "none"}`, and a user `CLAUDE.md` of one line | A pointer to `/opt/agent-notes/rules.md`, which holds the same rules; they reach the session only if the agent reads that file |

The `CLAUDE.md` goes where Claude Code reads the user's own, `$CLAUDE_CONFIG_DIR/CLAUDE.md`, so the task's repository, its diff and its verifier see nothing of it.
Runs under these two conditions also carry an `InstructionsLoaded` hook that only records each instruction load, under `/logs/agent/instructions/`.
The `placebo` condition, length-matched neutral texts in [placebo/](placebo), was pre-registered and replaced by these two before it ran; the texts and their hashes stay as pre-registration artifacts, and no condition runs them.

### The delivery probe

The benchmark's tasks start no subagent and switch no model, so whether the rules reach every path is measured apart, by `test/live/delivery.test.ts`:

```bash
NOONSIGHT_LIVE_DELIVERY=1 NOONSIGHT_DELIVERY_OUT=<dir> npm run test:live
```

It runs one interactive session per condition (`on`, `claudemd`, `scattered`) against a local stand-in for the API ([test/live/stub-api.ts](../../test/live/stub-api.ts)), which records every request and answers with fixed replies: a first turn, three turns that each start a subagent (general-purpose, Explore, Plan), `/model haiku` and a turn, `/compact` and a turn, `/clear` and a turn.
Nothing reaches Anthropic and no token is spent.
[delivery.ts](delivery.ts) reads, in each request, whether the rules written for the request's model are there, and whose other rules came along; the table goes to `<dir>/delivery.md`.

### The tasks

[select.ts](select.ts) orders each pool by `sha256(seed + ":" + id)` (SWE-bench) or `sha256(seed + ":tb:" + id)` (Terminal-Bench), with the seed `noonsight-eval-2026-11-16`, and takes the first tasks that meet each set's rule.
[tasks.ts](tasks.ts) writes the Harbor tasks:

- Build: the SWE-bench Verified task as Harbor ships it, with the instance's arm64 evaluation image in place of the x86_64 one.
  Only 281 of the 500 instances have one, so the build set leans on Django, SymPy and Sphinx and has no xarray.
- Routine: the Terminal-Bench 2.1 task; when its prebuilt image has no arm64 variant, Harbor builds the task's Dockerfile here instead.
- Digest: the instance's issue and discussion, to be summarized for a maintainer; graded against key points the author writes before any run ([rubrics/digest/](rubrics/digest)).
- Review and investigate: the upstream task, graded afterwards by the pilot's judge against the upstream rubric (ReviewBench's golden findings, SWE Atlas's rubric items).
  SWE Atlas publishes its images only for amd64, so investigate runs only where Docker can run amd64 images (here, under emulation).

### The gold check

Before any paid run, [gold.ts](gold.ts) runs each chosen task's reference solution here with Harbor's `oracle` agent, without a model.
Once the reference passes, it also installs the noonsight agent on the task's image (Harbor's install-only mode, no model), since an image can pass the oracle and still not run the agent: one without `xz`, or an amd64 image under emulation, where Claude Code's x64 binary finds no AVX.
A task that fails either check, or whose environment does not start on this machine, is dropped and replaced by the next one in the seeded order.
The record, [tasks/gold.json](tasks/gold.json), and the resulting list, [tasks/pilot.json](tasks/pilot.json), are committed; each task's sha256 there pins the exact task the paid runs use.

### Nights, the cap and the quota floor

One call of `run` is one night ([run.ts](run.ts), [schedule.ts](schedule.ts)).
A night continues the first unfinished round and then starts whole rounds while their projected cost fits the night's budget and the total cap.
A round is cut into units, one per task and model with every condition of its phase, and a night only ever stops between units, so every recorded run has its partners under the other conditions.
Before each unit the runner reads the account's quota with `quota-axi --provider claude` and stops below the floor; it also stops when the next unit, at full budgets, could pass the cap, or at the `--until` time.
At the `--stop-by` time, runs still going are stopped and left interrupted.
`--retry-infra` runs again the cells recorded as infrastructure failures, under the same keys, once their cause is fixed; the failure records stay.
`--quota-floor` replaces the plan's floor for one night, and `--quota-floor-fallback` gives a lower floor the night falls back to when its floor would stop it; the night's summary records the floor in force when it ended and the lowest quota it read.
Every run is recorded the moment it ends; a run that was in flight when the machine slept or rebooted is counted at its full budget and run again on the next night.
The night runs under `caffeinate -ims` and ends with a summary line: runs planned, completed and interrupted, spend, and quota before and after.

Cost is Claude Code's `total_cost_usd`, its estimate at list price, whatever the login pays.

## Running it

Needs Docker, Python 3.12 or later, Node.js 20 or later, `git`, `curl`, and [`quota-axi`](https://www.npmjs.com/package/quota-axi) for the quota floor.
On an Apple silicon Mac with Colima, give the VM at least 4 CPUs and 4 GB (one run at a time), with room for the images (about 2 GB per SWE-bench task).

```bash
WORK=~/noonsight-benchmark
npm run benchmark -- fetch --work $WORK --python python3.12   # Harbor in a venv, the datasets, the SWE-bench rows
npm run benchmark -- gold  --work $WORK                       # free: the reference solutions, and the final task list
```

Before the paid runs:

1. Write the key points of each digest task in `rubrics/digest/<instance>.json` (5 to 8, from the thread alone), and commit them.
2. Create a long-lived token for the account the runs use, and keep it in a file only you can read:
   `CLAUDE_CONFIG_DIR=<account dir> claude setup-token`, then save the token to `<token file>` and `chmod 600` it.
   The same account's configuration directory is given as `--account`, for the quota floor and the judge.
3. Commit everything: a night refuses to start from a checkout with uncommitted changes, so the commit in every result line is the code that ran.

Then, each night:

```bash
npm run benchmark -- run --work $WORK --account <account dir> --token-file <token file> --dry-run   # the night's plan, no runs
npm run benchmark -- run --work $WORK --account <account dir> --token-file <token file> --until 07:30 --stop-by 07:45
npm run benchmark -- status --work $WORK --account <account dir>
```

Keep the machine on power with the lid open (or on an external display), and turn off automatic macOS update installs for the pilot nights.
After the last night, `grade` grades any open answer not graded yet (a digest answer waits for its rubric), and `calibration --n 15` exports about 15 answers, blind, for the author to grade against the judge.

`smoke` runs one cell outside the schedule with its own budget, for checking the harness path:

```bash
npm run benchmark -- smoke --work $WORK --account <account dir> --token-file <token file> --set build --task <id> --model fable --condition off --budget 0.9
```

## Results

`<work>/results` holds `runs.jsonl` (one line per run: tokens, cost, turns, wall time, the verifier's verdict, what noonsight delivered, the signals, the pins), `grades.jsonl`, `answers/`, `decisions.jsonl` for `noonsight report --log`, `journal.jsonl` and `nights.jsonl`.
The result lines hold no path of the machine that ran them.
`rescore` computes the signals again from each run's saved event stream with the checkout's scorer, into `signals.jsonl`; the analysis reads those, so a fix to the scorer reaches runs already recorded.
A pilot's results go to `results/<date>/` with a reading of them, as in [experiments/rules](../rules/README.md).
`summarize` prints the tables a reading is written from, for a folder holding those result files: the delivery check of every run, the share of the received rule text written for the run's model (and, when the folder holds `delivery-probe/delivery.json`, for each probe path), how often the `scattered` rules file was opened, the model switches, cost and input tokens per run, the verifier's verdicts and the judge's scores.

```bash
npm run benchmark -- summarize --results experiments/benchmark/results/2026-11-19
```

The pilot's results and their reading are in [results/2026-11-19](results/2026-11-19/README.md).
