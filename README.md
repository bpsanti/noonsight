<p align="center">
  <img src="https://raw.githubusercontent.com/bpsanti/noonsight/main/docs/images/noonsight-lockup.svg#gh-light-mode-only" alt="noonsight" width="360">
  <img src="https://raw.githubusercontent.com/bpsanti/noonsight/main/docs/images/noonsight-lockup-dark.svg#gh-dark-mode-only" alt="noonsight" width="360">
</p>

# noonsight

**Every model has its own north.**

Anthropic publishes a prompting guide for each Claude model, and their advice differs from one model to the next ([S1](docs/sources.md#s1), [S2](docs/sources.md#s2)).
noonsight hands each Claude Code session, and each subagent it starts, the rules written for the model it actually runs on, and hands them again when that model changes.
It works through Claude Code's own hooks, reads only local files, and records every delivery so you can check it.
It ships a preset of rules for Claude Fable 5.2, Opus 5.5, Sonnet 5.5 and Haiku 5.5, each taken from that model's guide with its source, and you can add your own, for the machine or for one repository.

## What it guarantees, and what it does not

**The claim.** In the delivery benchmark, 300 random Claude Code sessions starting on any of the four models and going through `/model`, `/compact`, `/clear`, resumes, subagents and code edits held their model's rules, and no other model's rules left unretired, on 99.5% (3,199 of 3,216) of the requests that had rules due ([D2](docs/evidence.md#d2)); 3 of 300 sessions broke that somewhere ([D1](docs/evidence.md#d1)).
That run is Claude Code 2.1.328 against a local stand-in for the API, so every request was read and none reached a model ([experiments/delivery](experiments/delivery/README.md)).

The fuzzer has found four failures of noonsight, F1 to F4: F1 and F2 were fixed before that run, and F3 and F4, found by it, were fixed after it.
The three failing sessions are the documented limit below, F3 and F4.
Their shortest reproductions are in the corpus and must pass, but the 300 random sessions have not been run again on the fixed build, so the committed rate is still the one above.

On the same first 60 sequences, the native ways to give a model rules covered fewer requests (each number links to its entry):

| Every model's rules in | Requests with their rules | Subagent requests with their rules |
| --- | --- | --- |
| noonsight | [100%](docs/evidence.md#d5) | [100%](docs/evidence.md#d9) |
| A user `CLAUDE.md` | [87.3% (566 of 648)](docs/evidence.md#d6) | [32.2% (39 of 121)](docs/evidence.md#d10) |
| `.claude/rules`, one file per model | [70.9% (460 of 649)](docs/evidence.md#d7) | [32.2% (39 of 121)](docs/evidence.md#d10) |
| A skill per model | [0% (0 of 650)](docs/evidence.md#d8) | [0 of 121](docs/evidence.md#d11) |

A `CLAUDE.md` never reaches the built-in Explore and Plan subagents, which Claude Code's documentation confirms ([S4](docs/sources.md#s4)), and it gives every model the other models' rules too: of the rule text in a request, 78.8%, 31.6% and 27.1% was written for the request's model under noonsight, a `CLAUDE.md` and `.claude/rules` ([D12](docs/evidence.md#d12)).
A skill guarantees only its description until the model decides to open it ([S5](docs/sources.md#s5)).

**What it does not guarantee.**

- Delivery is not obedience: a delivered rule is context, and Claude Code says the same of `CLAUDE.md` ([S3](docs/sources.md#s3)).
  [What the rules change](#what-the-rules-change) is a separate question with its own data.
- A watched session with no task scope receives nothing from the preset: its rules are written for unattended runs, subagents or a named scope.
  [Your first delivered rule](#your-first-delivered-rule) shows how to give a session a scope.
- Not measured: `/resume` inside a session, forks, plan mode, agent teams, `noonsight run`, routing, the classifier, project configurations, and subagents that edit files ([limits](experiments/delivery/README.md#limits)).
- A known limit: a conversation compacted with no response since and resumed with nothing that names a model runs on Claude Code's default model, which noonsight cannot tell ([docs/hooks.md](docs/hooks.md#sessionstart)).
- It is measured on one Claude Code version at a time, and Claude Code changes how hooks behave; [docs/verification/claude-code.md](docs/verification/claude-code.md) lists each fact noonsight relies on and the version it was checked on.

## Your first delivered rule

noonsight needs Node.js 20 or newer and Claude Code.
Version 0.1 is not on npm yet (the name holds an empty placeholder), so install it from a clone:

```bash
git clone https://github.com/bpsanti/noonsight.git
cd noonsight
npm install && npm run build && npm link   # puts `noonsight` on PATH
```

Once 0.1 is published, `npx noonsight install` replaces all of this.

Then set it up.
This writes `~/.config/noonsight/noonsight.json` when there is none, adds the hooks to every Claude Code login of your account, keeping every other setting, and checks the result:

```bash
noonsight install
```

See the exact text a model receives in a scope, before any session runs:

```bash
noonsight resolve claude-sonnet-5-5 routine
```

Start a session in any project with that scope, and ask what it received:

```text
NOONSIGHT_SCOPE=routine claude --model sonnet
> Which working rules did you receive from noonsight, and for which model?
```

The model names `sonnet-5-5/stay-in-scope` and `sonnet-5-5/verify-changes`.
Leave the session, and confirm the delivery from noonsight's own log:

```bash
noonsight report
```

The report lists each rule with how often it was delivered, to which models, scopes and places, and the rules that are on but were never delivered ([docs/hooks.md](docs/hooks.md#the-decision-log)).
`noonsight uninstall` takes the hooks out again; [docs/install.md](docs/install.md) covers every install and how to undo it.

## What the rules change

Delivery is what noonsight guarantees; what a rule then changes depends on the rule, the model and the task.
The rule effect experiment runs the same task with and without a model's preset rules ([experiments/rules](experiments/rules/README.md)):

- With their preset rules, Sonnet 5.5 and Haiku 5.5 ran the tests after a precisely described one-file fix in 30 of 30 against 0 of 30, and 27 of 30 against 0 of 30, runs with the rules and without ([R1](docs/evidence.md#r1)).
- The tests came from one of those rules: delivered alone, `verify-changes` gave 29 of 30 and 27 of 30, and `carry-through` gave 0 of 30 and 0 of 30 ([R3](docs/evidence.md#r3)).
- That extra work has a price: on Sonnet's fix, a run cost $0.0240 without rules and $0.0505 with `verify-changes` alone ([R6](docs/evidence.md#r6)).
- Delivered as one sentence pointing to a file with its text, `verify-changes` was read in 120 of 120 runs and did as well as the rule inline ([R4](docs/evidence.md#r4)).
- On a 13-ticket backlog with an open decision, `sonnet-5-5/carry-through` raised the runs that did every part from 9 of 40 to 32 of 40 ([R10](docs/evidence.md#r10)); Haiku's `carry-through` showed nothing there ([R11](docs/evidence.md#r11)).
- Where the models already did the work, the rules changed nothing and still cost a little ([R6](docs/evidence.md#r6)); every run passed its hidden check, with or without rules ([R8](docs/evidence.md#r8)).

The tasks are small and the samples are 30 or 40 runs per arm, so read these as results on those tasks, not as general effects.
[docs/usage.md](docs/usage.md#what-a-rule-costs) gives the cost of each rule, and [docs/sources.md](docs/sources.md) where each result confirms, refines or contradicts what Anthropic published.

## Features

| Feature | How | More |
| --- | --- | --- |
| Rules per model, for sessions and subagents | The hooks, after `noonsight install` | [docs/hooks.md](docs/hooks.md) |
| A preset per current model, with sources | `"use": "preset"`, `enable`, `disable`, `replaces` | [presets/claude/SOURCES.md](presets/claude/SOURCES.md) |
| Your own rules, per model or for every model | `models.<id>.add`, `all_models.add` | [docs/configuration.md](docs/configuration.md#rules-for-every-model) |
| Rules for one repository | `.noonsight/noonsight.json`, `noonsight trust`, `projects.allow` | [docs/configuration.md](docs/configuration.md#project-configuration) |
| Rules for a kind of task | Scopes: `NOONSIGHT_SCOPE`, matchers, the optional classifier | [docs/configuration.md](docs/configuration.md#scopes) |
| Rules for a place | `where`: `session`, `unattended`, `subagent` | [docs/configuration.md](docs/configuration.md#keys) |
| Rules on an action | Triggers: `code-edit` | [docs/configuration.md](docs/configuration.md#triggers) |
| Sessions the hooks do not reach | `noonsight run` | [docs/launcher.md](docs/launcher.md) |
| Model and effort by task (off by default) | `routing` | [docs/configuration.md](docs/configuration.md#routing) |
| Preset updates you review | `preset_version`, `on_preset_change`, `noonsight accept` | [docs/configuration.md](docs/configuration.md#preset-updates) |
| Checking what is delivered | `noonsight check`, `models`, `resolve`, `report` | [docs/hooks.md](docs/hooks.md#the-decision-log) |
| New Claude Code logins (off by default) | `noonsight watch enable` | [docs/install.md](docs/install.md#new-logins-as-they-appear-optional) |
| Turning it off for a session | `NOONSIGHT_DISABLE=1` | [docs/hooks.md](docs/hooks.md#turning-noonsight-off) |

The hooks never block anything and never use the network.
The one exception is the classifier, off unless you turn it on, which sends the first 4,000 characters of a task to a small model through your own Claude Code login ([docs/configuration.md](docs/configuration.md#the-classifier)).

## Using it well

- Give noonsight what differs by model, by kind of task or by place, and leave in `CLAUDE.md` what every model should always have ([docs/usage.md](docs/usage.md#choosing-where-a-rule-lives)).
- Tell noonsight when nobody is watching, with `session.unattended_when_env`, and give tasks a scope; without either, the preset delivers little ([docs/usage.md](docs/usage.md#setting-up-the-machine)).
- Write a rule as a check the model can pass, in plain words; Anthropic's best practices say the same, and the verify rules are where our data shows the largest effect ([docs/usage.md](docs/usage.md#writing-a-rule)).
- Keep long rule text in a file and deliver one sentence pointing to it ([docs/usage.md](docs/usage.md#a-pointer-to-a-file)).
- Commit a repository's rules in `.noonsight/noonsight.json`, where each person trusts them once ([docs/usage.md](docs/usage.md#rules-for-one-repository)).
- Check what each model receives with `noonsight models` and what was delivered with `noonsight report`, and drop a rule that never changes anything you can see.
- Skip noonsight when every session runs one model with fixed rules: a `CLAUDE.md` is simpler ([docs/usage.md](docs/usage.md#when-not-to-use-noonsight)).

## How this README is checked

- Every measured number links to [docs/evidence.md](docs/evidence.md), which names the raw result file, how the number is computed from it, its date and its Claude Code version; `npm test` computes each number again from the file.
- Every quotation of Anthropic is in [docs/sources.md](docs/sources.md) with its link, its retrieval date and the literal excerpt; `NOONSIGHT_LIVE_SOURCES=1 npm run test:live` checks each excerpt against the live page.
- `npm test` runs the commands of [Your first delivered rule](#your-first-delivered-rule) in a sandbox, and fails when a command, option, configuration key, environment variable or hook event is missing from the documentation.

## Development

```bash
npm test             # builds, then runs every test with node --test
npm run test:live    # real interactive Claude Code sessions; needs claude and expect, sends no prompt
```

The live tests, the experiments and the benchmarks that need a login or spend usage say so in [docs/verification/claude-code.md](docs/verification/claude-code.md) and in each experiment's README.
There are no runtime dependencies; the only development dependencies are TypeScript and the Node.js type definitions.
noonsight was called sextant before; [docs/install.md](docs/install.md#moving-from-sextant) says how to move an install made under that name.

## Acknowledgements

Several ideas here (refuse a bad configuration instead of guessing, keep hooks fast and offline, test through the public interface) come from [firstmate](https://github.com/kunchenguid/firstmate); no code was copied.

## License

MIT
