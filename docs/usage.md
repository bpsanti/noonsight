# Using noonsight well

This page is the long guidance the README points to: where a rule should live, how to write one, what a rule costs, how to set noonsight up for the machine and for one repository, and when not to use it.
Every number links to its entry in [docs/evidence.md](evidence.md), and every quotation of Anthropic to [docs/sources.md](sources.md).
[docs/configuration.md](configuration.md) is the reference for each key used here.

## Choosing where a rule lives

Claude Code already has three places for instructions, and noonsight is a fourth.
The delivery benchmark put every model's rules in each of them and read every request of the same 60 sessions ([experiments/delivery](../experiments/delivery/README.md)):

| Where the rules live | Requests with their rules | Subagent requests with their rules | Rule text that is the model's own | Characters added per request |
| --- | --- | --- | --- | --- |
| noonsight | [100%](evidence.md#d5) | [100%](evidence.md#d9) | [78.8%](evidence.md#d12) | [1,154](evidence.md#d13) |
| A user `CLAUDE.md` | [87.3% (566 of 648)](evidence.md#d6), and [100% (527 of 527)](evidence.md#d17) of the main conversation's | [32.2% (39 of 121)](evidence.md#d10) | [31.6%](evidence.md#d12) | [4,414](evidence.md#d13) |
| `.claude/rules`, one file per model | [70.9% (460 of 649)](evidence.md#d7) | [32.2% (39 of 121)](evidence.md#d10) | [27.1%](evidence.md#d12) | [3,995](evidence.md#d13) |
| A skill per model | [0% (0 of 650)](evidence.md#d8) | [0 of 121](evidence.md#d11) | No rule text | None |

What the table says:

- A `CLAUDE.md` reaches every request of the main conversation, through `/compact`, `/clear`, `/model` and resumes, as Claude Code documents ([S3](sources.md#s3)).
  It does not reach the built-in Explore and Plan subagents ([S4](sources.md#s4)), and it cannot choose by model, so every model reads every other model's rules.
- `.claude/rules` without `paths` loads like a `CLAUDE.md`, and with `paths` only once the session touches a matching file ([S3](sources.md#s3)).
- A skill puts only its description in the context until the model opens it ([S5](sources.md#s5)); the benchmark's stand-in never opens one, so the table shows what a skill guarantees, not what a real model does with it.
- noonsight gives each request only its model's rules, including subagents, at the cost of its hooks: a fraction of a second at each event, 60 to 120 ms of processor time per hook run at the median ([D15](evidence.md#d15)).

So:

| The rule is | Put it in |
| --- | --- |
| The same for every model, always | `CLAUDE.md`. Claude Code's hooks reference says the same of instructions that never change ([S6](sources.md#s6)). |
| The same for every model, and needed by subagents too | noonsight's `all_models.add`, or a `CLAUDE.md` if your subagents are not Explore or Plan |
| For one model, or different per model | noonsight, `models.<id>.add`, or a preset rule |
| For one kind of task, or only unattended runs, or only subagents | noonsight, with `scopes` or `where` |
| Needed only once code changes | noonsight, with `"triggers": ["code-edit"]`, or `.claude/rules` with `paths` |
| A procedure the model runs on request | A skill |
| Something that must never happen | A hook or a permission rule; a rule is context, not enforcement ([S3](sources.md#s3)) |

## Writing a rule

**Give the model a check to pass.**
Anthropic's best practices say a check to pass is still worth giving, while telling a current model to keep going mostly is not ([S7](sources.md#s7)).
Our data agrees: `verify-changes`, which asks for a real check before reporting a change as done, made Sonnet 5.5 and Haiku 5.5 run the tests after a precise fix in 29 of 30 and 27 of 30 runs, where `carry-through` alone did it in 0 of 30 and 0 of 30 ([R3](evidence.md#r3)).

**Aim the rule at a habit the model has, on the tasks you run.**
Where the model already did the work, the rule changed nothing: without any rule, Sonnet 5.5 and Haiku 5.5 ran the tests after a feature across several files in 30 of 30 and 29 of 30 runs ([R13](evidence.md#r13)), and did every part of two long tasks in 19 of 20 pilot runs as recorded ([R12](evidence.md#r12)).
The per-model guides describe such habits ([S1](sources.md#s1), [S2](sources.md#s2)), and the preset's rules come from them ([presets/claude/SOURCES.md](../presets/claude/SOURCES.md)).

**Say what to do when the work holds a choice.**
On a backlog with a decision left open, `sonnet-5-5/carry-through` made Sonnet 5.5 settle it instead of handing it back, and the runs that did every part went from 9 of 40 to 32 of 40 ([R10](evidence.md#r10)).
The same rule for Haiku 5.5 showed nothing there: 6 of 40 against 2 of 40 ([R11](evidence.md#r11)).

**Keep it short, plain and specific.**
Claude Code's documentation says the more specific and concise an instruction, the more consistently Claude follows it ([S3](sources.md#s3)), and that current models follow a plainly worded line without emphasis ([S7](sources.md#s7)).
Leave out what the model finds by reading the code ([S7](sources.md#s7)).
Emphasis and length were not measured here.

**Write it as information about the work.**
noonsight wraps the rules in a short envelope that says, as a fact, who declared them and for which model, as Claude Code asks of hook context ([S6](sources.md#s6)).
A rule that reads as an out-of-band command to obey can trip the model's prompt-injection defenses, according to the same page.

### A pointer to a file

A rule can be one sentence that names a file holding its text and says to read it, through a user rule that `replaces` the preset rule.
Delivered that way, `verify-changes` was read in 120 of 120 runs, at the first tool call, and gave the same tests as the rule inline ([R4](evidence.md#r4), [R5](evidence.md#r5)); on Sonnet's fix it cost $0.0440 per run against $0.0505 inline ([R6](evidence.md#r6)).
This is the "just in time" approach of Anthropic's context engineering article ([S8](sources.md#s8)).
Those sessions were short: a pointer read at the start and then compacted away was not measured, so for long sessions keep rules that must hold to the end inline, or give them a trigger.

## What a rule costs

A rule costs its characters in every request it reaches, and whatever extra work it makes the model do.
The second part dominates where the rule changes behavior.
On the precise fix, mean cost per run as Claude Code reports it at list price ([experiments/rules/results/2026-11-20](../experiments/rules/results/2026-11-20/README.md)):

| Model | Without rules | `carry-through` alone | `verify-changes` alone | `verify-changes` as a pointer | The preset's rules there |
| --- | --- | --- | --- | --- | --- |
| Sonnet 5.5 | [$0.0240](evidence.md#r6) | [$0.0247](evidence.md#r6) | [$0.0505](evidence.md#r6) | [$0.0440](evidence.md#r6) | [$0.0378](evidence.md#r6) |
| Haiku 5.5 | [$0.0015](evidence.md#r7) | [$0.0018](evidence.md#r7) | [$0.0033](evidence.md#r7) | [$0.0038](evidence.md#r7) | [$0.0033](evidence.md#r7) |

- `carry-through` changed nothing on that task and cost almost nothing.
- `verify-changes` made the model run the tests, which roughly doubled the cost of a cheap task; on Sonnet the three preset rules together cost less than `verify-changes` alone, which the result's README reads as `stay-in-scope` keeping the runs short, a direction it did not test.
- The added characters themselves are small: noonsight added 1,154, 4,414 and 3,995 characters per request in the delivery benchmark under noonsight, a `CLAUDE.md` and `.claude/rules` ([D13](evidence.md#d13)).

`noonsight models` lists each preset rule with the cost its source reports, and `noonsight report` gives the length of each rule's text, so a rule that is long and never changes anything you can see is the first to drop.

## Setting up the machine

`noonsight install` declares every model the preset covers with `"use": "preset"`, which turns on the rules that ship on.
From there, edit `~/.config/noonsight/noonsight.json` ([docs/configuration.md](configuration.md#keys)):

```json
{
  "version": 1,
  "preset_version": "1.3.1",
  "models": {
    "claude-sonnet-5-5": { "use": "preset", "disable": ["sonnet-5-5/stay-in-scope"] },
    "claude-haiku-5-5": { "use": "preset" },
    "claude-opus-5-5": { "use": "preset", "enable": ["opus-5-5/explore-before-acting"] },
    "claude-fable-5-2": { "use": "none" }
  },
  "all_models": { "add": [{ "id": "team/commit-style", "file": "rules/commit-style.md" }] },
  "session": { "unattended_when_env": ["CI"] }
}
```

- **Declare every model you run.** A model with no entry gets a warning at each session start and no rules; `"use": "none"` says you decided it needs none.
- **Say when nobody is watching.** Several preset rules are for the place `unattended` only, such as Opus's `unattended-run` and the carry-through rules.
  A session is unattended when a variable of `session.unattended_when_env` is set; put your CI's or your orchestrator's variable there.
- **Give tasks a scope.** A watched session with no scope receives only the rules written for every scope, which with the preset is none.
  Start sessions with `NOONSIGHT_SCOPE=<scope>`, or with `noonsight run --scope <scope>`, and give scopes `match` patterns for subagents ([docs/configuration.md](configuration.md#scopes)).
  The classifier can place the tasks no pattern places, at the cost of one small model call each ([docs/configuration.md](configuration.md#the-classifier)).
- **Review preset updates.** An update of noonsight can change the preset; `noonsight check` lists what changed, and `noonsight accept` takes the new version.
  `"on_preset_change": "hold"` keeps the rules you accepted until then ([docs/configuration.md](configuration.md#preset-updates)).
- **Check the result** with `noonsight check`, `noonsight models` and `noonsight resolve <model> [scope] [place]`, which prints the exact text a model receives.

## Rules for one repository

A repository can commit its own rules in `.noonsight/noonsight.json`, beside its rule files; paths are relative to that file and must stay inside the repository.

```json
{
  "version": 1,
  "models": {
    "claude-sonnet-5-5": { "add": [{ "id": "repo/run-the-tests", "file": "rules/run-the-tests.md", "triggers": ["code-edit"], "scopes": ["build"] }] }
  },
  "all_models": { "add": [{ "id": "repo/migrations", "file": "rules/migrations.md" }] }
}
```

Each person who clones the repository runs `noonsight trust` once in it; until then the project changes nothing, and each new session in it starts with a warning that names the command.
By default a trusted project can only add rules, for the models the person's own configuration declares; `projects.allow` in the machine's file lets it change more ([docs/configuration.md](configuration.md#how-far-a-project-may-go)).
`noonsight check` and `noonsight models` run in the repository show what the project applies, and a project with a problem is refused alone, leaving the machine's rules in place.

A rule every model should always follow in that repository belongs in its `CLAUDE.md`; the project file is for rules that depend on the model, the task or the place.

## With an orchestrator

noonsight delivers rules to whatever model a session or subagent runs on, whoever started it.
Routing, which picks the model and effort by scope, is off by default; when you turn it on, it yields to a model the caller already chose, and to any variable you list in `routing.yield_when_env` ([docs/configuration.md](configuration.md#with-an-orchestrator)).
For sessions started with `claude -p` where the hooks cannot read the model, `noonsight run` puts the rules in the system prompt instead ([docs/launcher.md](launcher.md)).

## When not to use noonsight

- **Every session runs one model with fixed rules.** A `CLAUDE.md` delivers them to every request of the conversation ([D17](evidence.md#d17)), with nothing to install.
- **The rule must never be broken.** A delivered rule is context; use a hook or a permission rule ([S3](sources.md#s3)).
- **The model already does what the rule asks on your tasks.** The rule then changes nothing and still costs its characters; measure first, with `noonsight report` and your own runs.
- **You cannot install hooks**, for example where an organization's managed settings forbid user hooks; `noonsight check` says when the hooks will not run ([docs/install.md](install.md#check)).
