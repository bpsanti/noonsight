<p align="center">
  <img src="https://raw.githubusercontent.com/bpsanti/noonsight/main/docs/images/noonsight-lockup.svg#gh-light-mode-only" alt="noonsight" width="360">
  <img src="https://raw.githubusercontent.com/bpsanti/noonsight/main/docs/images/noonsight-lockup-dark.svg#gh-dark-mode-only" alt="noonsight" width="360">
</p>

# noonsight

**Every model has its own north.**

Anthropic publishes a prompting guide for each Claude model, and their advice differs from one model to the next ([S1](docs/sources.md#s1), [S2](docs/sources.md#s2)).
noonsight delivers instructions by model: each Claude Code session, and each subagent it starts, receives the rules written for the model it actually runs on, and receives them again when that model changes.
The rules are yours to write, for one model or for every model, for the whole machine or for one repository ([Your own rules](#your-own-rules)).
It ships a preset as a starting set, for Claude Fable 5.2, Opus 5.5, Sonnet 5.5 and Haiku 5.5, each rule taken from that model's guide with its source.
It works through Claude Code's own hooks, reads only local files, and records every delivery so you can check it.

## What it guarantees, and what it does not

**The claim.** In the current run of the delivery benchmark (2026-11-23, Claude Code 2.1.330), 0 of 299 sessions that ran to the end broke the invariant ([D18](docs/evidence.md#d18)): every request with rules due held its model's rules, and no other model's rules left unretired.
Those sessions had rules due on 3,090 requests and held them on 100% (3,090 of 3,090), the subagents' 100% (763 of 763) among them ([D19](docs/evidence.md#d19), [D20](docs/evidence.md#d20), Claude Code 2.1.330).
The run generated 300 random sessions on the four models; the other one, `s1-0123`, stopped on a turn that got no answer and is not measured.
The sessions are real, interactive Claude Code; only the API is a local stand-in, so every request was read and no model answered ([experiments/delivery](experiments/delivery/README.md)).
They start through `claude` or `noonsight run`, with or without a repository's configuration, and go through `/model`, `/compact`, `/clear`, resumes, forks, `/resume` typed in a session, plan mode, subagents and code edits.
Forks, `/resume` in a session, plan mode and subagents that edit a file are part of those requests, and held their rules on 100% (453 of 453) of theirs ([D21](docs/evidence.md#d21), Claude Code 2.1.330).

Earlier runs of the benchmark, on Claude Code 2.1.328 and without those paths, are superseded by this one; [docs/evidence.md](docs/evidence.md#runs-and-versions) lists every run with its version and which are current.
The benchmark has found nine failures of noonsight, F1 to F9, all fixed before the current run; their shortest reproductions are in the corpus, which passes ([experiments/delivery](experiments/delivery/README.md#failures-found-and-a-limit)).

noonsight picks a rule by its model, scope, place and trigger, never by its text, so this claim covers any rule, yours or the preset's.
The benchmark's sessions carried the preset's rules from the machine's configuration, and some also had a repository's configuration; those, with the ones started through `noonsight run`, held their rules on 100% (1,308 of 1,308) of their requests ([D22](docs/evidence.md#d22), Claude Code 2.1.330).

The native ways to give a model rules, on the first 60 sequences of that same run, covered fewer requests; noonsight's row is all its sessions, which include those 60 (each number links to its entry, Claude Code 2.1.330):

| Every model's rules in | Requests with their rules | Subagent requests with their rules |
| --- | --- | --- |
| noonsight | [100% (3,090 of 3,090)](docs/evidence.md#d19) | [100% (763 of 763)](docs/evidence.md#d20) |
| A user `CLAUDE.md` | [88.2% (508 of 576)](docs/evidence.md#d25) | [46.9% (60 of 128)](docs/evidence.md#d28) |
| `.claude/rules`, one file per model | [76.3% (441 of 578)](docs/evidence.md#d26) | [46.9% (60 of 128)](docs/evidence.md#d28) |
| A skill per model | [0% (0 of 579)](docs/evidence.md#d27) | [0 of 128](docs/evidence.md#d29) |

A `CLAUDE.md` reached every request of the session's own conversation, through `/model`, `/compact`, `/clear` and resumes: 100% (448 of 448) ([D34](docs/evidence.md#d34), Claude Code 2.1.330).
What it missed were subagents: it never reaches the built-in Explore and Plan subagents, which Claude Code's documentation confirms ([S4](docs/sources.md#s4)), and it gives every model the other models' rules too: of the rule text in a request, 78.6%, 32.6% and 27.9% was written for the request's model under noonsight, a `CLAUDE.md` and `.claude/rules` ([D30](docs/evidence.md#d30), Claude Code 2.1.330).
A skill guarantees only its description until the model decides to open it ([S5](docs/sources.md#s5)).

**What it does not guarantee.**

- Delivery is not obedience: a delivered rule is context, and Claude Code says the same of `CLAUDE.md` ([S3](docs/sources.md#s3)).
  [What the rules change](#what-the-rules-change) is a separate question, with data for the preset's rules alone.
- Right after install, what a session receives from the preset depends on its model and its place, and `noonsight install` writes it out for each model.
  Most preset rules apply to attended sessions, the place where someone is watching: 11 of its 16 rules list `attended` ([The preset's rules](#the-presets-rules)).
  Opus 5.5's and Fable 5.2's rules for that place all ship off, so an attended session on either receives nothing from the preset until you turn one on with `enable`.
  A headless run, such as `claude -p` or the Agent SDK, is unattended by default and receives the preset's rules for that place: `unattended-run` on Opus 5.5, `low-context-report` on Fable 5.2, `carry-through` on Sonnet 5.5 and Haiku 5.5.
  An attended session on Sonnet 5.5 or Haiku 5.5 receives `verify-changes` once it edits a code file its git repository tracks, and their other rules only with a scope.
  Your own rules reach every place unless their `where` limits them, attended sessions included.
  noonsight counts an interactive session as attended unless a variable of `session.unattended_when_env` is set, so set it to a CI's or an orchestrator's variable for the interactive sessions nobody watches.
  [Your first delivered rule](#your-first-delivered-rule) shows how to give a session a scope.
- Not measured: agent teams, routing and the classifier ([limits](experiments/delivery/README.md#limits)).
- `/fork` is not available in a session `noonsight run` started with rules, since Claude Code refuses to fork a session with a system prompt of its own ([docs/launcher.md](docs/launcher.md#other-text-in-the-system-prompt)).
- A known limit: a conversation compacted with no response since and resumed with nothing that names a model runs on Claude Code's default model, which noonsight cannot tell ([docs/hooks.md](docs/hooks.md#sessionstart)).
  The corpus reproduces it; it broke none of the current run's sessions, and 1 of 300 sessions of the superseded run on Claude Code 2.1.328 ([D1](docs/evidence.md#d1)).
- Known limits for subagents: a workflow's agents get nothing, foreground calls of one type that need different rules give their subagents nothing until each one's first Edit, Write or agent call, and a plugin noonsight does not read, such as one an organization syncs, leaves its subagents predicted on their parent's model ([docs/hooks.md](docs/hooks.md#what-the-prediction-does-not-see)).
- It is measured on one Claude Code version at a time: the delivery claim is on Claude Code 2.1.330, the rule effects below on 2.1.329 (those of Fable 5.2 on 2.1.328) and the paid pilot on 2.1.326, and Claude Code changes how hooks behave.
  [docs/evidence.md](docs/evidence.md#runs-and-versions) lists the version of every run, and [docs/verification/claude-code.md](docs/verification/claude-code.md) each fact about Claude Code that noonsight relies on with the version that fact was checked on, which says nothing about where a result was measured.

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

Its output writes out, for each model, what an attended session, an unattended session and a subagent receive with no scope, `nothing` included with the preset rules that are off there, and how to change it.

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
It reads deliveries from noonsight's decision log, which records what the hooks returned to Claude Code; it does not measure whether a rule changed what the model did, which takes an experiment such as those in [What the rules change](#what-the-rules-change).
`noonsight uninstall` takes the hooks out again; [docs/install.md](docs/install.md) covers every install and how to undo it.

## Your own rules

The preset is a starting set, and any rule can replace it or join it.
A rule is a Markdown file and an entry that names it: an `id`, the `file`, and, when the rule is not for every case, the `scopes`, the places (`where`) and the `triggers` it is for.

| Key | Values | How a session or subagent gets one |
| --- | --- | --- |
| `scopes` | The preset's `investigate`, `build`, `review`, `routine` and `digest`, any scope you declare under `scopes` with a `description` and `match` patterns, or `"*"` for every scope (the default) | A session from `NOONSIGHT_SCOPE` or `noonsight run --scope`; a subagent from the first `match` pattern found in its task, or from the classifier when you turn it on, since the preset's scopes have no patterns ([docs/configuration.md](docs/configuration.md#scopes)) |
| `where` | `attended`, `unattended`, `subagent`, or `all` for every place (the default); `session` is still read as the earlier name of `attended` | `unattended` for a headless run by default, or for a session started with a variable of `session.unattended_when_env` set; `subagent` for every subagent; `attended` otherwise, a session someone is watching |
| `triggers` | `code-edit`, the only one today; none by default | Once the session edits a code file its git repository already tracks, whatever its scope ([docs/configuration.md](docs/configuration.md#triggers)) |

For the machine, edit `~/.config/noonsight/noonsight.json`, which `noonsight install` wrote; a rule's `file` is relative to it:

```json
{
  "version": 1,
  "preset_version": "1.3.1",
  "models": {
    "claude-opus-5-5": { "use": "preset", "add": [{ "id": "my/plan-first", "file": "rules/plan-first.md" }] },
    "claude-sonnet-5-5": { "use": "preset" },
    "claude-haiku-5-5": { "use": "custom", "add": [{ "id": "my/short-reports", "file": "rules/short-reports.md", "where": ["subagent"] }] },
    "claude-fable-5-2": { "use": "none" }
  },
  "all_models": { "add": [{ "id": "team/commit-style", "file": "rules/commit-style.md" }] }
}
```

- Opus 5.5 keeps the preset's rules and adds one of yours.
- Haiku 5.5 drops the preset's rules for one of yours, delivered only to its subagents.
- `all_models.add` gives one rule to every model declared with `preset` or `custom`; Fable 5.2, declared `none`, receives nothing.

For one repository, commit `.noonsight/noonsight.json` beside its rule files.
Each person who clones the repository runs `noonsight trust` once in it, and until then the file changes nothing:

```json
{
  "version": 1,
  "models": {
    "claude-sonnet-5-5": { "add": [{ "id": "repo/run-the-tests", "file": "rules/run-the-tests.md", "triggers": ["code-edit"], "scopes": ["build"] }] }
  },
  "all_models": { "add": [{ "id": "repo/migrations", "file": "rules/migrations.md" }] }
}
```

`noonsight check` validates both files, and `noonsight resolve <model> [scope] [place]` prints the exact text a model receives there.
[docs/usage.md](docs/usage.md#writing-a-rule) says how to write a rule, where it should live and how a [repository's rules](docs/usage.md#rules-for-one-repository) are shared, and [docs/configuration.md](docs/configuration.md#keys) gives every key.

## The preset's rules

Each rule of the preset, with the scopes and places it is for, the triggers that also deliver it, and whether it ships on.
`noonsight models` lists the same with each rule's source, effect and cost, and [presets/claude/SOURCES.md](presets/claude/SOURCES.md) says why each has its scopes and places.

| Rule | Scopes | Places | Triggers | Ships |
| --- | --- | --- | --- | --- |
| `fable-5-2/finish-work` | `investigate`, `build` | `subagent` | none | on |
| `fable-5-2/low-context-report` | every scope | `unattended`, `subagent` | none | on |
| `fable-5-2/code-ownership` | `build` | `attended`, `unattended` | none | off |
| `fable-5-2/progress-updates` | every scope | `attended` | none | off |
| `opus-5-5/unattended-run` | every scope | `unattended` | none | on |
| `opus-5-5/progress-updates` | every scope | `attended` | none | off |
| `opus-5-5/explore-before-acting` | every scope | `attended`, `unattended` | none | off |
| `sonnet-5-5/carry-through` | every scope | `unattended`, `subagent` | none | on |
| `sonnet-5-5/stay-in-scope` | `routine` | `attended`, `unattended`, `subagent` | none | on |
| `sonnet-5-5/verify-changes` | `investigate`, `build`, `routine` | `attended`, `unattended`, `subagent` | `code-edit` | on |
| `sonnet-5-5/no-self-review-rounds` | `build`, `routine` | `attended`, `unattended`, `subagent` | none | off |
| `sonnet-5-5/ideas-first` | every scope | `attended` | none | off |
| `sonnet-5-5/check-current-facts` | `investigate`, `digest` | `attended`, `unattended`, `subagent` | none | off |
| `haiku-5-5/carry-through` | every scope | `unattended`, `subagent` | none | on |
| `haiku-5-5/verify-changes` | `investigate`, `build`, `routine` | `attended`, `unattended`, `subagent` | `code-edit` | on |
| `haiku-5-5/search-recent-facts` | `investigate`, `digest` | `attended`, `unattended`, `subagent` | none | off |

Most of these rules list `attended`, the place where someone is watching.
Opus 5.5's and Fable 5.2's rules for that place ship off, by the preset's rule that a rule with a high cost, a described side effect or a narrow use ships off ([SOURCES.md](presets/claude/SOURCES.md#how-the-rules-were-chosen)): `fable-5-2/code-ownership` raised output tokens by about 70 to 80 percent and made changes nobody asked for, `fable-5-2/progress-updates` raised them by roughly 20 percent, `opus-5-5/progress-updates` adds updates whose cost the source does not report, and `opus-5-5/explore-before-acting` is written for agents that work across connected apps.
A rule that ships on can still cost something: `verify-changes` ships on for Sonnet 5.5 and Haiku 5.5, and about doubles the cost of a small fix ([What the rules change](#what-the-rules-change)).
To turn one on, name it in `enable` in `~/.config/noonsight/noonsight.json`:

```json
{
  "version": 1,
  "preset_version": "1.3.1",
  "models": {
    "claude-opus-5-5": { "use": "preset", "enable": ["opus-5-5/progress-updates"] }
  }
}
```

`noonsight install` and `noonsight check` name, for each place a model receives nothing in, the preset rules that are off there.

## What the rules change

Delivery is what noonsight guarantees; what a rule then changes depends on the rule, the model and the task.
These results are for the preset's rules named in them; a rule of your own has no measured effect until you measure it.
The rule effect experiment runs the same task with a model's preset rules, with one of them alone, and without, on Fable 5.2, Sonnet 5.5 and Haiku 5.5 ([experiments/rules](experiments/rules/README.md)).
Three kinds of rule have a measured effect there: `verify-changes` on Sonnet 5.5 and Haiku 5.5, `carry-through` on Sonnet 5.5, and `low-context-report` on Fable 5.2; `carry-through` on Haiku 5.5 showed none, and no other rule of the preset, Opus 5.5's included, has one in [docs/evidence.md](docs/evidence.md#rule-effects).


- One rule, `verify-changes` delivered alone, made Sonnet 5.5 and Haiku 5.5 run the tests after a precisely described one-file fix in 29 of 30 and 27 of 30 runs, where `carry-through` delivered alone did it in 0 of 30 and 0 of 30 ([R3](docs/evidence.md#r3)); without any rule, each model ran them in 0 of 30 runs ([R14](docs/evidence.md#r14), Claude Code 2.1.329).
- That extra work has a price: on Sonnet's fix, a run cost $0.0240 without rules and $0.0505 with `verify-changes` alone ([R6](docs/evidence.md#r6), Claude Code 2.1.329).
- Delivered as one sentence pointing to a file with its text, `verify-changes` was read in 120 of 120 runs and did as well as the rule inline ([R4](docs/evidence.md#r4), Claude Code 2.1.329).
- On Fable 5.2, `low-context-report` made the sentences of its final reports shorter, in mean words per sentence 12.3 against 16.4, 17.8 against 20.1, 12.2 against 16.2 with the rule and without, on a question, a bug and a feature ([R9](docs/evidence.md#r9), Claude Code 2.1.328).
- On a 13-ticket backlog with an open decision, `sonnet-5-5/carry-through` raised the runs that did every part from 9 of 40 to 32 of 40 ([R10](docs/evidence.md#r10)); Haiku's `carry-through` showed nothing there ([R11](docs/evidence.md#r11), Claude Code 2.1.329).
- Where the models already did the work, the rules changed nothing and still cost a little ([R6](docs/evidence.md#r6)); every run passed its hidden check, with or without rules ([R8](docs/evidence.md#r8), Claude Code 2.1.329).
- On public tasks, a paid pilot of the benchmark saw no measurable difference in the runs that passed, 133 of 144, 132 of 144 and 133 of 144 without rules, under noonsight and with a `CLAUDE.md` of every model's rules ([B1](docs/evidence.md#b1), Claude Code 2.1.326).

The rule effect tasks are small and the samples are 30 or 40 runs per arm, so read these as results on those tasks, not as general effects.
[docs/usage.md](docs/usage.md#what-a-rule-costs) gives the cost of each rule, and [docs/sources.md](docs/sources.md) where each result confirms, refines or contradicts what Anthropic published.

## Features

| Feature | How | More |
| --- | --- | --- |
| Rules per model, for sessions and subagents | The hooks, after `noonsight install` | [docs/hooks.md](docs/hooks.md) |
| A preset per current model, with sources | `"use": "preset"`, `enable`, `disable`, `replaces` | [presets/claude/SOURCES.md](presets/claude/SOURCES.md) |
| Your own rules, per model or for every model | `models.<id>.add`, `all_models.add` | [docs/configuration.md](docs/configuration.md#rules-for-every-model) |
| Rules for one repository | `.noonsight/noonsight.json`, `noonsight trust`, `projects.allow` | [docs/configuration.md](docs/configuration.md#project-configuration) |
| Rules for a kind of task | Scopes: `NOONSIGHT_SCOPE`, matchers, the optional classifier | [docs/configuration.md](docs/configuration.md#scopes) |
| Rules for a place | `where`: `attended`, `unattended`, `subagent`, `all` | [docs/configuration.md](docs/configuration.md#keys) |
| Rules on an action | Triggers: `code-edit` | [docs/configuration.md](docs/configuration.md#triggers) |
| Sessions the hooks do not reach | `noonsight run` | [docs/launcher.md](docs/launcher.md) |
| Model and effort by task (off by default) | `routing` | [docs/configuration.md](docs/configuration.md#routing) |
| Preset updates you review | `preset_version`, `on_preset_change`, `noonsight accept` | [docs/configuration.md](docs/configuration.md#preset-updates) |
| Checking what is delivered | `noonsight check`, `models`, `resolve`, `report` | [docs/hooks.md](docs/hooks.md#the-decision-log) |
| New Claude Code logins (off by default) | `noonsight watch enable` | [docs/install.md](docs/install.md#new-logins-as-they-appear-optional) |
| Turning it off for a session | `NOONSIGHT_DISABLE=1` | [docs/hooks.md](docs/hooks.md#turning-noonsight-off) |

The hooks never block anything and never use the network.
The one exception to the network is the classifier, off unless you turn it on, which sends the first 4,000 characters of a task to a small model through your own Claude Code login ([docs/configuration.md](docs/configuration.md#the-classifier)).

## Using it well

- Give noonsight what differs by model, by kind of task or by place, and leave in `CLAUDE.md` what every model should always have ([docs/usage.md](docs/usage.md#choosing-where-a-rule-lives)).
- Tell noonsight when nobody is watching, since the preset rules that ship on for Opus 5.5 and Fable 5.2 are for unattended runs and subagents only: headless runs are unattended by default, and `session.unattended_when_env`, set to your orchestrator's variable, covers the interactive sessions nobody watches; turn on their attended rules with `enable` if you want them; and give Sonnet 5.5 and Haiku 5.5 sessions a scope for their scoped rules ([docs/usage.md](docs/usage.md#setting-up-the-machine)).
- Write a rule as a check the model can pass, in plain words; Anthropic's best practices say the same, and the verify rules are where our data shows the largest effect ([docs/usage.md](docs/usage.md#writing-a-rule)).
- Keep long rule text in a file and deliver one sentence pointing to it ([docs/usage.md](docs/usage.md#a-pointer-to-a-file)).
- Check what each model receives with `noonsight models` and what was delivered with `noonsight report`, and drop a rule that never changes anything you can see.
- Skip noonsight when every session runs one model with fixed rules: a `CLAUDE.md` is simpler, unless Explore or Plan subagents need the rules, which it does not reach ([docs/usage.md](docs/usage.md#when-not-to-use-noonsight)).

## How this README is checked

- Every measured number links to [docs/evidence.md](docs/evidence.md), which names the raw result file, how the number is computed from it, its date, its Claude Code version and whether a later run superseded it; `npm test` computes each number again from the file, in [test/evidence.test.ts](test/evidence.test.ts).
- Every quotation of Anthropic is in [docs/sources.md](docs/sources.md) with its link, its retrieval date and the literal excerpt; `NOONSIGHT_LIVE_SOURCES=1 npm run test:live` checks each excerpt against the live page.
- `npm test` runs the commands of [Your first delivered rule](#your-first-delivered-rule) in a sandbox, and fails when a command, option, configuration key, environment variable or hook event is missing from the documentation.
- `npm test` runs `noonsight check` on each configuration example of this README and of [docs/usage.md](docs/usage.md), with its rule files, and fails on any problem.

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
