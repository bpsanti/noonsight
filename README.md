<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/bpsanti/noonsight/main/docs/images/noonsight-lockup-dark.svg">
    <img src="https://raw.githubusercontent.com/bpsanti/noonsight/main/docs/images/noonsight-lockup.svg" alt="noonsight" width="360">
  </picture>
</p>

# noonsight

**Every model has its own north.**

Take a fix before you set the course: pick the right model for each agent task, and hand every agent the practices that fit the model it actually runs on.

**Status: early development.** Nothing is published yet.
Each Claude Code session already receives the rules declared for the model it runs on, at startup and again after `/model`, through official Claude Code hooks.
So does each subagent a session starts: before it starts, noonsight predicts the model it will run on, hands it that model's rules as it starts, without changing the call that started it, then checks the model it actually started on and warns on a difference.
Rules can also depend on the task scope, such as investigating or summarizing: a session takes its scope from `NOONSIGHT_SCOPE`, a subagent from matchers run over its task, and `noonsight check` reports scopes that overlap.
`noonsight run` starts Claude Code with the rules in the system prompt instead, for sessions the hooks do not reach; with the hooks installed too, the rules still arrive once.
Routing is optional and off by default: once turned on, a task's scope picks the model and effort for a session `noonsight run` starts and for each subagent, from a table of preferences, and it yields to a model the caller chose and to an orchestrator's environment ([docs/configuration.md](docs/configuration.md#routing)).
The classifier is optional and off by default too: once turned on, a small model places a task that no explicit scope and no matcher placed, and a task it cannot place in time gets no scope ([The classifier](#the-classifier)).
The package ships a starting preset, `claude`: 16 rules for Claude Fable 5.2, Opus 5.5, Sonnet 5.5 and Haiku 5.5, each adapted from Anthropic's prompting guide for that exact model and listed with its source, the effect the guide reports and its cost ([presets/claude/SOURCES.md](presets/claude/SOURCES.md)).
Eight of them are on by default; the rest have a high cost, a side effect or a narrow use, and the user turns them on.
None is delivered where Claude Code already sends the same advice.

## What it will do

1. **Route (optional).** Choose the model and effort for a task from rules you declare, based on where each model is strong. Skip this part if an orchestrator already picks models for you.
2. **Instruct.** Give each Claude Code session and subagent the rules for the model it runs on, through official Claude Code hooks: no network proxy, no credentials handled.
   It ships a starting preset per current model, built from the vendor's prompting guides with every source cited, and every rule is configurable.

It works on its own and alongside agent orchestrators.
One configuration file serves the whole machine, for every Claude Code account on it.

## Install

```bash
noonsight init       # the configuration file, declaring every model the preset covers
noonsight models     # each model's rules, with their source, effect and cost
noonsight install    # every Claude Code login of this account, no administrator rights
noonsight check      # configuration, installs, watcher, Claude Code version
```

`noonsight init` writes `~/.config/noonsight/noonsight.json`, or the file `NOONSIGHT_CONFIG` names, and never replaces one that exists.
Turn a preset rule on or off with `enable` and `disable`, add your own rule files, and declare the models you use; [docs/configuration.md](docs/configuration.md) explains each key.

`noonsight watch enable` optionally keeps a small watcher running that installs the hooks into each new Claude Code login as it appears; it is off unless you turn it on, and `noonsight watch disable` turns it off.

`noonsight install` adds noonsight's hooks to the user settings of every Claude Code configuration directory it finds (`~/.claude`, the one in `CLAUDE_CONFIG_DIR`, and every other one in the home directory), keeping every other setting and hook.
User settings reach every login, including one whose organization delivers server-managed settings, where Claude Code ignores machine-wide managed settings files.
`noonsight install --account <dir>` installs into one directory, and `sudo ... noonsight install --managed` once for every account through Claude Code's managed settings files.
[docs/install.md](docs/install.md) covers the three installs, what they write, why the default is the default, and how to remove them.
noonsight was called sextant before; [docs/install.md](docs/install.md#moving-from-sextant) says how to move an install made under that name.
[docs/hooks.md](docs/hooks.md) describes what the hooks deliver, the decision log, and how to turn noonsight off for a session (`NOONSIGHT_DISABLE=1`).

`noonsight report` reads the decision log and tells, for each rule, how often it was delivered and to which models, scopes and places, and which rules are on but were never delivered ([docs/hooks.md](docs/hooks.md#the-decision-log)).

`noonsight run [--scope <scope>] -- <claude arguments>` starts `claude` with the rules for its model added through `--append-system-prompt-file`, keeping any `--append-system-prompt` someone else passes, and with routing on, the model and effort the scope's row gives; [docs/launcher.md](docs/launcher.md) explains it.

The hooks read only local files: nothing leaves the machine, unless the classifier is on, which sends the first 4,000 characters of a task's text to the classifier's model through Claude Code.

## The classifier

With `"classifier": { "mode": "fallback" }`, a task that no explicit scope and no matcher placed is placed by a small model, Haiku at low effort by default, through one `claude -p` call that uses the login Claude Code already has.
It reads the descriptions of the declared scopes, and its answer is held to one of them or `none`.
It acts in the agent call hook, for each subagent, and in `noonsight run`, for the task text it is given, and only when the scope can change the task's rules or its route.
A classification that fails, or takes longer than `classifier.timeout_ms` (8 seconds by default and at most), leaves the task with no scope, warns the person, and is recorded in the decision log.
The classifier's own session runs with `NOONSIGHT_DISABLE=1` and `--safe-mode`, so noonsight's hooks never act inside it.
[docs/configuration.md](docs/configuration.md#the-classifier) covers the modes, what it is asked, and what it costs.

How often it agrees with a person: `test/fixtures/classifier/tasks.json` holds 45 task texts, each labeled by hand with one of the `claude` preset's five scopes or `none`, by the rule written in `test/fixtures/classifier/README.md`.
On 2026-11-16, with Claude Code 2.1.325 and the classifier's defaults (Haiku 5.5 at low effort), the live test `classifier-agreement` ran over all 45 twice, and the classifier agreed with the hand label on 44 of them in the first run (98%) and on 43 in the second (96%).
No classification failed or ran out of time in either run.

| Label | Tasks | Agreed, run 1 | Agreed, run 2 |
| --- | --- | --- | --- |
| `investigate` | 9 | 9 | 9 |
| `build` | 9 | 9 | 8 |
| `review` | 8 | 8 | 8 |
| `routine` | 9 | 9 | 8 |
| `digest` | 7 | 7 | 7 |
| `none` | 3 | 2 | 3 |

The disagreements: a request for a short poem, labeled `none`, placed in `digest` (run 1); a race condition to fix whose cause is not yet clear, labeled `build`, placed in `investigate` (run 2); and a `--json` flag whose output format is already specified, labeled `routine`, placed in `build` (run 2).
The answers vary from run to run, so the agreement is a measure of these tasks on that day, not a guarantee; `NOONSIGHT_LIVE_LOGIN=1 npm run test:live` measures it again.

## What the rules change

`experiments/rules/` runs the same small task on each target model with the model's preset rules delivered by noonsight and with no rules, and records the outcome each rule's source claims and the tokens and cost Claude Code reports ([experiments/rules/README.md](experiments/rules/README.md)).
On 2026-11-16, with Claude Code 2.1.326 at medium effort, 112 runs cost $7.57:

- With their rules, Sonnet 5.5 ran the tests after a one-file fix in 10 of 10 runs and Haiku 5.5 in 8 of 10, against 0 of 10 each without them; for Sonnet that cost about 46 percent more per run.
- With its report rule, Fable 5.2 wrote shorter sentences (11.7 words against 15.3) and almost no semicolons, at no added cost.
- The rules against stopping early could not be told apart from no rules: on these short tasks every run finished either way.

The samples are small (3 to 10 runs per arm), so these are directions, not significant results, and the preset was left unchanged; [the dated results](experiments/rules/results/2026-11-16/README.md) give every count and the review of each rule.

## Try the core

```bash
npm install
npm run build
NOONSIGHT_CONFIG=test/fixtures/lab/config/noonsight.json NOONSIGHT_PRESETS_DIR=test/fixtures/lab/presets \
  node dist/src/cli.js resolve claude-sonnet-5-5 investigate
```

See [docs/configuration.md](docs/configuration.md) for the configuration file and the `resolve` output.

## Development

```bash
npm test             # builds, then runs every test with node --test
npm run test:live    # real interactive Claude Code sessions; needs claude and expect, sends no prompt
```

`NOONSIGHT_LIVE_LOGIN=1 npm run test:live` also runs the subagent cases (three models in parallel, an inherited model with the built-in Explore subagent, nested subagents, a model mismatch, and an interactive session), the scope cases (two sessions on one model in two scopes through `NOONSIGHT_SCOPE`, and two subagents on one model whose tasks fall in two scopes) the preset cases (what Claude Code's own system prompt already sends each model, compared with the preset, and the real preset reaching a session and a subagent with the hash `noonsight resolve` gives) the launcher cases (`noonsight run` with an explicit model, with and without the hooks, next to another `--append-system-prompt` or `--append-system-prompt-file`, and routed without `--model`) the routing cases (`route-subagents`, `explicit-model` and `orchestrator-env`) and the classifier cases (`classifier-agreement` over the hand-labeled tasks, `classifier-subagent` and `classifier-timeout`) in real sessions, from the Claude Code login of whoever runs it; they spend a little usage, Fable 5.2 included.
`npm run experiment -- run` runs the rule effect experiment from the same login, within a spending cap it states ([experiments/rules/README.md](experiments/rules/README.md)).
`NOONSIGHT_LIVE_TOKENS=1 CLAUDE_CODE_OAUTH_TOKEN=... npm run test:live` asks the session models which rules they received; the token stays in the environment.
See [docs/verification/claude-code.md](docs/verification/claude-code.md).

Node 20 or newer.
There are no runtime dependencies; the only development dependencies are TypeScript and the Node type definitions.

## Acknowledgements

Several ideas here (refuse a bad configuration instead of guessing, keep hooks fast and offline, test through the public interface) come from [firstmate](https://github.com/kunchenguid/firstmate); no code was copied.

## License

MIT
