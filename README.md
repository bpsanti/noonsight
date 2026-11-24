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
It works through Claude Code's own hooks, reads only local files (the optional classifier, off by default, is the one thing that uses the network), and records every delivery so you can check it.

## What it guarantees, and what it does not

**The guarantee.** Through Claude Code's hooks, noonsight puts the rules declared for a model into the requests of each session and subagent that runs on it, and again when that model changes or the conversation is compacted, cleared, resumed or forked.
That is delivery, not obedience: a delivered rule is context, and Claude Code says the same of `CLAUDE.md` ([S3](docs/sources.md#s3)).
Its known limits are part of it:

- A workflow's agents get nothing, foreground calls of one type that need different rules give their subagents nothing until each one's first Edit, Write or agent call, and a plugin noonsight does not read, such as one an organization syncs, leaves its subagents predicted on their parent's model ([docs/hooks.md](docs/hooks.md#what-the-prediction-does-not-see)).
- A conversation compacted with no response since and resumed with nothing that names a model runs on Claude Code's default model, which noonsight cannot tell ([docs/hooks.md](docs/hooks.md#sessionstart)); the corpus reproduces it, and it broke no session of the current run.
- In a session `noonsight run` started with rules, and only there, `/fork` is not available: Claude Code refuses to fork a session with a system prompt of its own ([docs/launcher.md](docs/launcher.md#other-text-in-the-system-prompt)).
- Agent teams, routing and the classifier are not measured ([limits](experiments/delivery/README.md#limits)).
- Claude Code changes how hooks behave, and the results on this page did not all run on the same version of it: each holds for the version it ran on, which [docs/evidence.md](docs/evidence.md#runs-and-versions) gives for every run and every result.

**What was measured.** The delivery benchmark's sessions are real, interactive Claude Code sessions, not simulated ones; only the Messages API is a local stand-in, so every request was read and no model answered ([experiments/delivery](experiments/delivery/README.md)).
Its current run (2026-11-23) generated 300 random sessions on the four models; 299 ran to the end, and one stopped on an unanswered turn.
Under noonsight, on the four models together, 0 of 299 sessions broke the invariant ([D18](docs/evidence.md#d18)): every request with rules due held its model's rules, and no other model's rules left unretired.
Under noonsight, 100% (3,090 of 3,090) of the requests with rules due held them all ([D19](docs/evidence.md#d19)), and of those, the subagents' 100% (763 of 763) ([D20](docs/evidence.md#d20)).
Those requests include every one after a fork, after `/resume` typed in a session, in plan mode and after subagents that edit a file ([D21](docs/evidence.md#d21)), and every one of the sessions with a repository's configuration or started through `noonsight run` ([D22](docs/evidence.md#d22)).
noonsight picks a rule by its model, scope, place and trigger, never by its text, so this covers your own rules too, though the sessions carried the preset's.
The benchmark found nine failures of noonsight, F1 to F9, on builds before the current run's, all fixed before it ([experiments/delivery](experiments/delivery/README.md#failures-found-and-a-limit)).

The native ways to give a model rules, each measured without noonsight on the run's first 60 sequences, next to noonsight on all its sessions, those 60 included.
A cell is the requests with rules due that held them all, on the four models together:

| How every model's rules were given | All requests with rules due, the main conversation's and the subagents' | Of those, the subagents' |
| --- | --- | --- |
| noonsight | [100% (3,090 of 3,090)](docs/evidence.md#d19) | [100% (763 of 763)](docs/evidence.md#d20) |
| A user `CLAUDE.md`, without noonsight | [88.2% (508 of 576)](docs/evidence.md#d25) | [46.9% (60 of 128)](docs/evidence.md#d28) |
| `.claude/rules`, one file per model, without noonsight | [76.3% (441 of 578)](docs/evidence.md#d26) | [46.9% (60 of 128)](docs/evidence.md#d28) |
| A skill per model, without noonsight | [0% (0 of 579)](docs/evidence.md#d27) | [0 of 128](docs/evidence.md#d29) |

What a `CLAUDE.md` missed were subagents only: it reached every request of the main conversation ([D34](docs/evidence.md#d34)), and never reaches the built-in Explore and Plan subagents, as Claude Code documents ([S4](docs/sources.md#s4)).
It and `.claude/rules` also give every model the other models' rules, most of the rule text in their requests ([D30](docs/evidence.md#d30)).
A skill guarantees only its description until the model decides to open it ([S5](docs/sources.md#s5)).

**What the preset delivers right after install** depends on the model and the place, and `noonsight install` writes it out for each model.
Of the preset's rules, 11 of its 16 rules list `attended`, the place where someone is watching ([The preset's rules](#the-presets-rules)).
Opus 5.5's and Fable 5.2's rules for that place ship off, so an attended session on either receives nothing from the preset until you turn one on with `enable`.
An attended session on Sonnet 5.5 or Haiku 5.5 receives `verify-changes` once it edits a code file its git repository tracks, and their other rules only with a scope, which [Your first delivered rule](#your-first-delivered-rule) shows.
A headless run, such as `claude -p` or the Agent SDK, is unattended by default and receives at its start `unattended-run` on Opus 5.5, `low-context-report` on Fable 5.2, and `carry-through` on Sonnet 5.5 and Haiku 5.5.
noonsight counts an interactive session as attended unless a variable of `session.unattended_when_env` is set, so set it to a CI's or an orchestrator's variable for the interactive sessions nobody watches.
Your own rules reach every place unless their `where` limits them.

## Your first delivered rule

noonsight needs Node.js 20 or newer and Claude Code.
Install it from npm, which puts `noonsight` on PATH; this is the recommended install, since `noonsight install` then reaches every Claude Code login of your account:

```bash
npm install -g noonsight
```

`npx noonsight install` works with nothing installed first, but the hooks then run the copy in npm's cache, and deliver nothing once that cache is cleared ([docs/install.md](docs/install.md#the-one-command)).

If you prefer installing noonsight as a Claude Code plugin, that works too (Claude Code 2.1.275 or later, and `npm` for the download):

```text
/plugin install noonsight --marketplace bpsanti/noonsight
```

Then start a new session, whose start writes the configuration from the preset when there is none.
Each plugin install covers one Claude Code login, so a second login needs its own.
Having both the plugin and `noonsight install` is safe: each event is delivered once, by whichever copy runs first, and one of the two is enough ([docs/install.md](docs/install.md#as-a-claude-code-plugin)).

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
Opus 5.5's and Fable 5.2's rules for that place ship off, by the preset's rule that a rule with a high cost, a described side effect or a narrow use ships off ([SOURCES.md](presets/claude/SOURCES.md#how-the-rules-were-chosen)): by Anthropic's guide, not our data, `fable-5-2/code-ownership` raises output tokens by about 70 to 80 percent and makes changes nobody asked for, and `fable-5-2/progress-updates` raises them by roughly 20 percent; `opus-5-5/progress-updates` adds updates whose cost the guide does not report, and `opus-5-5/explore-before-acting` is written for agents that work across connected apps.
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

What a delivered rule changes depends on the rule, the model and the task.
The rule effect experiment ran the same task on the real models with a rule or the preset's rules delivered, and without any rule ([experiments/rules](experiments/rules/README.md)).
Each line below is one result, and its numbers belong to the rule or rules, the model and the task it names, and to no other: a result of rules together is not a result of one of them, and a result on one model is not a result on another.

The fix is precise and in one file, the bug is known only by its symptom, and the backlog has 13 tickets, one with a decision left open.

**One rule delivered alone**

- With `verify-changes` alone, Sonnet 5.5 on the fix ran the tests after its last edit in 29 of 30 runs ([R3](docs/evidence.md#r3)), against 0 of 30 without any rule ([R14](docs/evidence.md#r14)), at a mean cost per run of $0.0505 with `verify-changes` alone against $0.0240 without any rule ([R6](docs/evidence.md#r6)).
- With `verify-changes` alone, Haiku 5.5 on the fix ran the tests after its last edit in 27 of 30 runs ([R3](docs/evidence.md#r3)), against 0 of 30 without any rule ([R14](docs/evidence.md#r14)), at a mean cost per run of $0.0033 with `verify-changes` alone against $0.0015 without any rule ([R7](docs/evidence.md#r7)).
- With `verify-changes` alone, Sonnet 5.5 on the bug ran the tests after its last edit in 30 of 30 runs ([R16](docs/evidence.md#r16)), against 11 of 30 without any rule ([R15](docs/evidence.md#r15)), at a mean cost per run of $0.0494 with `verify-changes` alone against $0.0321 without any rule ([R17](docs/evidence.md#r17)).
- With `carry-through` alone, Sonnet 5.5 on the bug ran the tests after its last edit in 30 of 30 runs ([R16](docs/evidence.md#r16)), against 11 of 30 without any rule ([R15](docs/evidence.md#r15)), at a mean cost per run of $0.0461 with `carry-through` alone against $0.0321 without any rule ([R17](docs/evidence.md#r17)).
- With `carry-through` alone, Sonnet 5.5 on the backlog did every part in 32 of 40 runs, against 9 of 40 without any rule ([R10](docs/evidence.md#r10)), at a mean cost per run of $0.2848 with `carry-through` alone against $0.2920 without any rule ([R18](docs/evidence.md#r18)).
- With `low-context-report` alone, Fable 5.2 on the question wrote 12.3 words per sentence of its report, against 16.4 without any rule, over 30 runs each ([R9](docs/evidence.md#r9)), at a mean cost per run of $0.3088 with `low-context-report` alone against $0.3005 without any rule ([R19](docs/evidence.md#r19)).
- With `low-context-report` alone, Fable 5.2 on the bug wrote 17.8 words per sentence of its report, against 20.1 without any rule, over 30 runs each ([R9](docs/evidence.md#r9)), at a mean cost per run of $0.2061 with `low-context-report` alone against $0.2007 without any rule ([R19](docs/evidence.md#r19)).
- With `low-context-report` alone, Fable 5.2 on the feature wrote 12.2 words per sentence of its report, against 16.2 without any rule, over 30 runs each ([R9](docs/evidence.md#r9)), at a mean cost per run of $0.4642 with `low-context-report` alone against $0.5465 without any rule ([R19](docs/evidence.md#r19)).

**The preset's rules delivered together**

- With `carry-through`, `stay-in-scope` and `verify-changes` together, Sonnet 5.5 on the fix ran the tests after its last edit in 30 of 30 runs ([R14](docs/evidence.md#r14)), against 0 of 30 without any rule ([R14](docs/evidence.md#r14)), at a mean cost per run of $0.0378 with `carry-through`, `stay-in-scope` and `verify-changes` together against $0.0240 without any rule ([R6](docs/evidence.md#r6)).
- With `carry-through` and `verify-changes` together, Sonnet 5.5 on the bug ran the tests after its last edit in 30 of 30 runs ([R15](docs/evidence.md#r15)), against 11 of 30 without any rule ([R15](docs/evidence.md#r15)), at a mean cost per run of $0.0513 with `carry-through` and `verify-changes` together against $0.0321 without any rule ([R17](docs/evidence.md#r17)).
- With `carry-through` and `verify-changes` together, Haiku 5.5 on the fix ran the tests after its last edit in 27 of 30 runs ([R14](docs/evidence.md#r14)), against 0 of 30 without any rule ([R14](docs/evidence.md#r14)), at a mean cost per run of $0.0033 with `carry-through` and `verify-changes` together against $0.0015 without any rule ([R7](docs/evidence.md#r7)).

**Across the results**

- **Rules with a measured effect alone:** `verify-changes` (Sonnet 5.5, Haiku 5.5), `carry-through` (Sonnet 5.5) and `low-context-report` (Fable 5.2).
  In these runs `stay-in-scope` came only with other rules.
- **No effect shown:** `carry-through` alone on the fix, for Sonnet 5.5 and Haiku 5.5 ([R3](docs/evidence.md#r3)), and on the backlog for Haiku 5.5 ([R11](docs/evidence.md#r11)).
- No other rule of the preset, Opus 5.5's included, has a measured effect in [docs/evidence.md](docs/evidence.md#rule-effects), and a rule of your own has none until you measure it.
- **No quality gain shown:** in the run that measured the fix and the bug, on Sonnet 5.5 and Haiku 5.5, every run passed its hidden check, with or without rules ([R8](docs/evidence.md#r8)).
  A paid pilot on public tasks, on the four models together, with rules delivered to the main conversation only, saw no measurable difference in the runs that passed: 133 of 144 without rules, 132 of 144 under noonsight and 133 of 144 with a `CLAUDE.md` of every model's rules ([B1](docs/evidence.md#b1)).

The tasks are small: these are results on them, not general effects.
More on [what a rule costs](docs/usage.md#what-a-rule-costs), and on how each result compares with [what Anthropic published](docs/sources.md).

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

The hooks never block anything, and use the network in one case only: the classifier, off unless you turn it on, sends the first 4,000 characters of a task to a small model through your own Claude Code login ([docs/configuration.md](docs/configuration.md#the-classifier)).

## Using it well

- Give noonsight what differs by model, by kind of task or by place, and leave in `CLAUDE.md` what every model should always have ([docs/usage.md](docs/usage.md#choosing-where-a-rule-lives)).
- Tell noonsight when nobody is watching, since the preset rules that ship on for Opus 5.5 and Fable 5.2 are for unattended runs and subagents only: headless runs are unattended by default, and `session.unattended_when_env`, set to your orchestrator's variable, covers the interactive sessions nobody watches; turn on their attended rules with `enable` if you want them; and give Sonnet 5.5 and Haiku 5.5 sessions a scope for their scoped rules ([docs/usage.md](docs/usage.md#setting-up-the-machine)).
- Write a rule as a check the model can pass, in plain words; Anthropic's best practices say the same, and the verify rules are an example ([What the rules change](#what-the-rules-change), [docs/usage.md](docs/usage.md#writing-a-rule)).
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

Several ideas here (refuse a bad configuration instead of guessing, keep hooks fast, test through the public interface) come from [firstmate](https://github.com/kunchenguid/firstmate); no code was copied.

## License

MIT
