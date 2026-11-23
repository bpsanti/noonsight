# Reference for the judge

This is what the judge scores an answer against.
It describes noonsight as the repository's code and committed results show it, independently of what either version of the README says.
The judge also receives `docs/evidence.md` of the commit under test, which gives each measured number with its raw file.

## The delivery claim

What noonsight guarantees is delivery, not behavior: through Claude Code's own hooks, it gives each Claude Code session, and each subagent the session starts, the rules declared for the model it runs on, and delivers them again after `/model`, `/compact`, `/clear` and resumes, recording each delivery in a local decision log.
The measurement behind it: in the delivery benchmark (Claude Code 2.1.328, sessions against a local stand-in for the API, 300 random sessions), 99.5% (3,199 of 3,216) of the requests that had rules due held them, and 3 of 300 sessions broke that somewhere.

An answer states the delivery claim **correctly** when its "What it guarantees" sentence, or the answer elsewhere when that sentence is missing, says that noonsight gets each model's rules to the sessions or subagents running that model (or an equivalent: injects, delivers, hands, puts in context), and does not say that it makes a model obey or follow the rules, that it enforces or blocks anything, or that delivery is perfect or certain in every case.
Mentioning the measurement is not required; a measurement stated wrongly makes the claim **wrong**.
**Partly**: the answer describes delivery only vaguely, for example "it helps manage rules", without saying that rules reach the model they were written for.
**Wrong**: the answer claims obedience, enforcement, blocking, a guaranteed effect on code quality or cost, perfect delivery, or describes another mechanism (a proxy, a model router as its main function, a fine-tuning).
**Absent**: no statement of what it guarantees.

## Real limits

An answer names a real limit when it states one of these, in its own words.
Give the ids of every limit it names.

- **L1** Delivery is not obedience: a delivered rule is context the model may not follow; whether a rule changes behavior depends on the rule, the model and the task.
- **L2** The measured effects of the rules are on small tasks with small samples, or only some rules showed an effect; several rules changed nothing measurable.
- **L3** Rules can cost money or time: a rule that makes the model do more work (such as running tests) raises the cost per run; the hooks add a little latency at each event.
- **L4** A watched (attended) session with no task scope receives little from the shipped preset: nothing on Opus 5.5 or Fable 5.2, whose rules for that place ship off until `enable` turns one on, and on Sonnet 5.5 or Haiku 5.5 only `verify-changes`, once the session edits a code file its git repository tracks (the `code-edit` trigger); scopes, the unattended setting or `enable` must be configured for the rest.
- **L5** Parts of delivery are not measured or fail: some lifecycle paths (forks, plan mode, agent teams, `/resume` inside a session, the launcher, routing, the classifier, project configurations) are not measured; a known limit after a compaction and a resume with no model; failures were found and fixed, and the fixed build was not rerun on the random sessions.
- **L6** It depends on Claude Code's hook behavior and on the Claude Code version; a Claude Code update can change what it relies on, and an organization's managed settings can turn user hooks off.
- **L7** It is pre-release: not published on npm as a usable version, installed from a clone, early development or a single maintainer.
- **L8** It covers Claude Code and the current Claude models only; another agent or model needs its own rules declared, and a new model version gets no rules until declared.
- **L9** It is another moving part: hooks in every login, a configuration to maintain, preset updates to review, trust per repository.
- **L10** A `CLAUDE.md` already reaches every request of the main conversation; noonsight's measured advantage over it is per-model precision and subagents.
- **L11** With the classifier on, task text goes to a model through the person's login; with routing on, noonsight changes the model or effort of a task.

## What noonsight has

The features below exist; the list is a summary of the documentation, not all of it.
A **hallucinated feature** is a claim that noonsight has a feature this reference says it does not have, or that a feature listed here works in a way this reference contradicts.
A statement about a detail the reference does not cover either way, such as an option, a warning or a time limit it does not mention, is not a hallucinated feature: the judge cannot tell it from a documented detail, so it is unsupported and fails nothing.

- Commands: `noonsight init`, `install`, `uninstall`, `watch`, `check`, `accept`, `trust`, `untrust`, `models`, `resolve`, `report`, `run`, `hook`.
- Hooks it installs: `SessionStart`, `PostModelSwitch`, `PreToolUse` and `PostToolUse` on the agent tool, `SubagentStart`, and `PostToolUse` on Edit and Write.
- One configuration file for the machine (`~/.config/noonsight/noonsight.json` or `NOONSIGHT_CONFIG`), and an optional project file `.noonsight/noonsight.json` that each person trusts with `noonsight trust`; by default a project can only add rules.
- One preset, `claude`, with rules for Claude Fable 5.2, Opus 5.5, Sonnet 5.5 and Haiku 5.5, each with its source; rules can be turned on, off or replaced, and the user adds rule files of their own, per model or for every model.
- Scopes (kinds of task), places (`session`, `unattended`, `subagent`), and one trigger, `code-edit`.
- A decision log and `noonsight report` of what was delivered; `noonsight resolve` prints the exact text a model receives.
- `noonsight run`, which puts the rules in the system prompt for sessions the hooks do not reach.
- Optional routing of model and effort by scope, off by default, and an optional classifier that uses a small model to place a task in a scope, off by default.
- Preset versions recorded in the configuration, with `noonsight accept` and a hold option.
- An optional watcher that installs the hooks into new Claude Code logins, off by default.
- No network use by the hooks, except the classifier when it is on; no runtime dependencies; MIT license; Node.js 20 or newer.

Things noonsight does not do, which an answer may wrongly claim: block or deny tool calls or enforce rules; check that the model followed a rule; work as an API proxy or read credentials; support agents other than Claude Code or non-Claude models out of the box; generate rules by itself; send telemetry; have a graphical interface or a hosted service; change the model of a running session.

## Reasons

A reason is **true** when the repository's code, documentation or committed results support it, **false** when they contradict it, and **unsupported** when they say nothing either way, such as a guess about the team.
A number in a reason is false when the evidence map gives another value for the same measure, in the same run and arm, beyond the rounding of its last digit (87.4% for 87.3% is rounding, not an error); when it credits a result to another arm (for example, the tests of the preset's rules credited to one rule delivered alone, whose own count differs); or when the reason generalizes a result beyond what was measured (for example, a gain measured on one task presented as a gain on every task).
A number the evidence map does not give, such as one from another run or experiment of the repository, is unsupported unless the map contradicts it, and fails nothing.
