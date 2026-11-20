# Sources of the `claude` preset

This preset gives each current Claude model a few working rules, taken from Anthropic's prompting guide for that exact model.
This page lists where each rule and each scope comes from, what the source reports the rule changes, and what it costs.
`preset.json` holds the same source, effect and cost for each rule, and `noonsight models` prints them.

## How the rules were chosen

1. **Only what has a public source.**
   Every rule names the page, the section and the date it was read.
   `noonsight check` refuses a preset rule without them, and without an effect and a cost.
2. **Nothing Claude Code already sends.**
   A rule is not delivered in a place where Claude Code's own system prompt already gives the same advice (see [What Claude Code already sends](#what-claude-code-already-sends)).
3. **The cost comes with the rule.**
   When a guide reports a measured cost, the rule carries it.
   Rules with a high cost, a described side effect, or a narrow use ship off; the user turns them on with `enable`.
4. **Exact model identifiers.**
   Rules are declared per exact model version, because each guide asks to measure again before carrying a prompt over from an earlier model.
   A new model version gets no rules until the preset declares it.

Each rule text is a short adaptation of the guide's suggested prompt, in this project's own words, and not a copy.
It is written as statements of what the user wants, because Claude Code's hooks documentation asks for hook context written as facts rather than as system commands.
The guides measured their own wording; the adapted wording has not been measured separately, except the last sentence of `haiku-5-5/carry-through` and `sonnet-5-5/stay-in-scope`, which is not from a guide and was measured in [2026-11-18](../../experiments/rules/results/2026-11-18/README.md).

## Documents

All read on 2026-11-16.

| Document | Address | Used for |
| --- | --- | --- |
| Prompting Claude Fable 5.2 | https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-2 | The Fable 5.2 rules |
| Prompting Claude Opus 5.5 | https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5 | The Opus 5.5 rules, and the `review` scope |
| Prompting Claude Sonnet 5.5 | https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5 | The Sonnet 5.5 rules |
| Prompting Claude Haiku 5.5 | https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-haiku-5-5 | The Haiku 5.5 rules |
| Claude Code, Model configuration | https://code.claude.com/docs/en/model-config | The `investigate` scope, and the routing table |
| Choosing the right model | https://platform.claude.com/docs/en/about-claude/models/choosing-a-model | The `build` scope |
| Models overview | https://platform.claude.com/docs/en/models/overview | The `digest` scope |
| Introducing Claude Sonnet 5.5 (2026-09-28) | https://www.anthropic.com/claude-sonnet-5-5 | The `routine` scope, and the routing table |
| Introducing Claude Fable 5.2 and Mythos 5.2 (2026-11-09) | https://www.anthropic.com/claude-fable-and-mythos-5-2 | The routing table |
| Introducing Claude Haiku 5.5 (2026-10-07) | https://www.anthropic.com/claude-haiku-5-5 | The routing table |
| Claude Code, Hooks reference | https://code.claude.com/docs/en/hooks | How the rule texts are worded (section "Add context for Claude") |

## Scopes

A scope names a kind of task.
A session takes its scope from `NOONSIGHT_SCOPE`, which `noonsight run` sets from `--scope` or from its task text; a subagent from the matchers a scope declares; and with the classifier on, a task neither placed can take its scope from the classifier, which reads the descriptions below.
The preset's scopes declare no matchers; [Detecting a scope](#detecting-a-scope) says why, and what the user can do instead.

| Scope | Covers | Source |
| --- | --- | --- |
| `investigate` | Open-ended investigation: diagnosing a root cause, debugging an outage, deciding an architecture, or other long work of many steps. | https://code.claude.com/docs/en/model-config, "Work with Fable": root-cause investigations, outage debugging and architecture decisions as the problems to hand Fable |
| `build` | Implementation that needs reasoning: a fix whose cause or solution is not obvious, a change of contract, or a large refactor. | https://platform.claude.com/docs/en/about-claude/models/choosing-a-model, "Model selection matrix": large-scale refactoring and complex systems engineering |
| `review` | Review of code, or of a result that is already done. | https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5, "Capabilities relevant to prompting": code review as a strength of its own |
| `routine` | A well-scoped change that can be described precisely: a mechanical edit, a configuration change, or documentation. | https://www.anthropic.com/claude-sonnet-5-5, "Opening paragraphs, before the Performance heading": well-scoped everyday tasks |
| `digest` | Reading material that already exists and condensing it: a summary, an extraction, a classification, or a search. | https://platform.claude.com/docs/en/models/overview, "Latest models": classification, extraction and routing |

## Routing table

The table applies only when the user turns routing on (`docs/configuration.md`, section "Routing").
It sets a model and an effort where a source ties a kind of work to them; tasks without a scope keep their model and effort, as Claude Code's post on effort and model selection advises: "Most of the time, you shouldn't be thinking about either setting" (https://claude.com/blog/claude-model-and-effort-level-in-claude-code, "Start with the defaults, then reach for the dials").
Each guide asks to measure a change on one's own tasks, so the table is a sourced starting point, not a measured result.

| Scope | Launcher | Subagents | Basis | Sources |
| --- | --- | --- | --- | --- |
| `investigate` | Fable, `high`; else Opus, `high` | The same | Claude Code describes the `fable` alias as being "for your hardest and longest-running tasks", and the Fable 5.2 guide says "`high` suits hard coding, research, agentic work, and long unattended runs". Opus comes second for a configuration that does not declare Fable, whose usage can bill to usage credits | https://code.claude.com/docs/en/model-config, "Model aliases" and "Fable and usage credits"; https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-2, "Calibrate effort" |
| `build` | Opus, `high` | The same | The Fable 5.2 announcement: "For most coding and knowledge tasks, we recommend that users start with Claude Opus 5.5". Claude Code gives `high` for work where verification matters or edge cases are likely, such as fixing a bug in an existing codebase | https://www.anthropic.com/claude-fable-and-mythos-5-2, "When to use Claude Fable 5.2 and Mythos 5.2"; https://code.claude.com/docs/en/model-config, "Choose an effort level" |
| `review` | Opus, `high` | The same | The Opus 5.5 guide reports stronger code review, with more bugs caught and fewer false alarms; `high` as for `build` | https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5, "Capabilities relevant to prompting"; https://code.claude.com/docs/en/model-config, "Choose an effort level" |
| `routine` | Sonnet, `medium` | The same | "Sonnet 5.5 is strongest at well-scoped everyday tasks", and its guide says to "start at `medium` for well-specified tasks" in agentic coding | https://www.anthropic.com/claude-sonnet-5-5, opening paragraphs; https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5, "Calibrate effort" |
| `digest` | Sonnet, `medium` | Haiku, `medium` | Haiku 5.5 "pairs well with Opus 5.5 and Sonnet 5.5 as a subagent on coding work", while "Sonnet 5.5 and Opus 5.5 remain better choices for complex agentic coding tasks", so a session runs on Sonnet and a subagent on Haiku. The Haiku 5.5 guide makes `medium` the starting point and warns that at `low` the model "is more likely to skip a search, stop early, or skip a check" | https://www.anthropic.com/claude-haiku-5-5, opening paragraphs and "Further updates"; https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-haiku-5-5, "Use effort to control thinking"; the Sonnet 5.5 guide, "Calibrate effort" |

The first option whose model the user declares wins, so a configuration that does not declare `claude-fable-5-2` sends `investigate` to Opus and never to Fable.
`preset.json` holds the same rows with their basis and sources, and `noonsight check` shows the table in use.

## How the rules are scoped

A rule lists the scopes it applies to, or `*` for every scope.
A rule with `*` also reaches a task whose scope is not known; a rule with a list reaches only a task whose scope is in it.
Most tasks have no known scope today ([Detecting a scope](#detecting-a-scope)), so the `*` rules are what nearly every task receives, and a rule with a list stays dormant until the task's scope is known.

Each rule was scoped by these principles:

1. **`*` is for a rule whose effect is worth its cost in every scope**, or whose trigger is a situation the five scopes do not separate, such as a person following the work or a request for ideas.
   A task whose scope is not known receives only these rules, so they must be right for any kind of task.
2. **A list is for a rule whose effect is limited to some kinds of task, or is not worth its cost in some.**
   The list names the scopes where the effect is worth the cost.
   A rule is not widened to `*` only to reach tasks whose scope is not known, since `*` would also put it in the scopes it was kept out of.
3. **A rule is kept out of a scope where it works against the task**, whatever it costs there.
4. **The basis is stated, scope by scope.**
   A scope is `sourced` for a rule only where the text of the rule's own source section ties the advice to that kind of task; each rule quotes those words.
   Every other scope, and a task whose scope is not known, is `judgment`, and the rule says why in plain words.
   Quotes drop the guides' code formatting.
   No guide names one of these five scopes, so a scope counts as sourced when the guide names the kind of task the scope describes, such as "agentic coding tasks" for `build` and `routine`.
   A judgment stands until a measurement replaces it ([Measuring a change of scopes](#measuring-a-change-of-scopes)).

| Rule | On by default | Scopes | Sourced for |
| --- | --- | --- | --- |
| `fable-5-2/finish-work` | Yes | `investigate`, `build` | `investigate` |
| `fable-5-2/low-context-report` | Yes | Every scope | None |
| `fable-5-2/code-ownership` | No | `build` | None |
| `fable-5-2/progress-updates` | No | Every scope | None |
| `opus-5-5/unattended-run` | Yes | Every scope | None |
| `opus-5-5/progress-updates` | No | Every scope | None |
| `opus-5-5/explore-before-acting` | No | Every scope | None |
| `sonnet-5-5/carry-through` | Yes | Every scope | `build`, `routine` |
| `sonnet-5-5/stay-in-scope` | Yes | `routine` | None |
| `sonnet-5-5/verify-changes` | Yes | `investigate`, `build`, `routine` | `build`, `routine` |
| `sonnet-5-5/no-self-review-rounds` | No | `build`, `routine` | `build`, `routine` |
| `sonnet-5-5/ideas-first` | No | Every scope | None |
| `sonnet-5-5/check-current-facts` | No | `investigate`, `digest` | `digest` |
| `haiku-5-5/carry-through` | Yes | Every scope | None |
| `haiku-5-5/verify-changes` | Yes | `investigate`, `build`, `routine` | `build`, `routine` |
| `haiku-5-5/search-recent-facts` | No | `investigate`, `digest` | None |

### Detecting a scope

The preset's scopes declare no matchers, and the preset ships no other way to tell a task's scope.
A scope reaches a task only from what the user, or the program that starts Claude Code, gives:

- **A session**: `noonsight run --scope <scope>`, a `NOONSIGHT_SCOPE` set by whoever starts the session, or `noonsight run --task <text>` (or the prompt after `-p`) read by the matchers the user declares ([launcher.md](../../docs/launcher.md)).
- **A subagent**: the matchers the user declares on a scope in their own configuration (`scopes.<name>.match`, [configuration.md](../../docs/configuration.md#scopes)), which can be added to the preset's scopes; a subagent never takes the session's scope.

Default matchers were considered and left out, as a judgment, for two reasons:

1. A matcher reads words, and the words that name one kind of task often appear in a task of another kind: "summarize" in "Summarize why the nightly export fails, then fix it", or "review" in "Review the failing tests and fix them".
   A misfire gives the task the rules of the wrong scope.
2. The scope a matcher picks is also the scope routing uses ([configuration.md](../../docs/configuration.md#routing)).
   With routing on, a misfire also changes the task's model and effort: the first example above would send a subagent that has a bug to fix to Haiku, as a digest.
   A matcher shipped in the preset would make that choice for every user who turns routing on.

A user who knows the words of their own tasks can declare matchers, and `noonsight check` reports two scopes whose matchers overlap.

A session also shows its kind of task by what it does: the two verify rules list the trigger `code-edit`, so a session receives them when it first edits a code file the project's git already tracks, whatever its scope ([Rules delivered on an action](#rules-delivered-on-an-action)).

Until a scope is detected some other way, the other rules with a list are dormant in every task whose scope is not known.
Of the rules on by default, that is `fable-5-2/finish-work` and `sonnet-5-5/stay-in-scope`, and the two verify rules in a subagent or in a session that has not edited code; of those off by default, `fable-5-2/code-ownership`, `sonnet-5-5/no-self-review-rounds`, `sonnet-5-5/check-current-facts` and `haiku-5-5/search-recent-facts`.
Meanwhile, a user who wants one of them in every task can leave the preset's rule off (`disable` turns off one that ships on) and add the same text as their own rule with `"scopes": ["*"]` (`add`, [configuration.md](../../docs/configuration.md#keys)).

The classifier ([configuration.md](../../docs/configuration.md#the-classifier)) is the way the preset waits for.
It is off by default; with `classifier.mode` set to `fallback`, a small model gives a scope to tasks that no explicit scope and no matcher placed, reading the descriptions of the preset's scopes, and the task gets no scope when it fails or takes too long.
With it on, the dormant rules start to reach the tasks it places, subagents included, with no change to the preset, and a task it cannot place still receives the `*` rules.
That fallback is why the `*` rules are held to principle 1: they are what a task of unknown kind receives, with or without the classifier.

### Rules delivered on an action

A plain interactive session has no known scope, so the rules with a list never reach it.
A trigger is a second way in: a rule that lists one is also delivered to a session once the session does it, whatever its scope ([hooks.md](../../docs/hooks.md#posttooluse-on-edit-and-write-the-triggers)).
The one trigger is `code-edit`: the session edited, with Edit or Write, a file with a code extension that the project's git already tracks.
The edit shows the session is changing code, but not which kind of task it is on: a fix found by an investigation, an implementation and a routine change all make one, and so can a review that ends up fixing what it found.

So a trigger is given only to a rule that is cheap when that guess is wrong.
These principles decide which rules list it; all of them are judgment, since no source discusses delivering a rule on an action:

1. **The rule acts on the action itself.**
   A rule whose advice only applies once code has changed costs nothing but its text in a session that edited code for any reason, and nothing at all in one that never does, since a session that edits no tracked code file never receives it.
2. **The rule never works against a kind of task the edit cannot rule out.**
   An edit cannot tell `routine` from `build`, so a rule kept out of one of them on purpose does not list the trigger.
3. **A rule with a measured cost or a described side effect needs a named scope.**
   An edit is too weak a signal to buy it.

| Rule | Trigger | Why |
| --- | --- | --- |
| `sonnet-5-5/verify-changes` | `code-edit` | Its advice starts with "a code change that can be executed, built or type-checked", so it acts only after the edit that triggers it (principle 1). Its scopes are the three that make code changes, so a session that edits code gets nothing a named scope would have kept from it; in a review or a digest that edits code after all, a real check of that change is still what the rule's source asks for. The source reports a slightly higher cost per task and no side effect. |
| `haiku-5-5/verify-changes` | `code-edit` | As for `sonnet-5-5/verify-changes`; its source reports more tokens, without a figure, and no side effect. |
| `fable-5-2/finish-work` | None | About 30 percent more output, kept out of `routine` for that reason (principles 2 and 3); and it reaches subagents only, where a trigger does not act. |
| `sonnet-5-5/stay-in-scope` | None | It holds back additions that are often wanted in `build`, and an edit cannot tell `routine` from `build` (principle 2). |
| `fable-5-2/code-ownership`, `sonnet-5-5/no-self-review-rounds` | None | Off by default; one has a measured cost of 70 to 80 percent more output with changes nobody asked for, the other changes how much the model reviews (principle 3). |
| `sonnet-5-5/check-current-facts`, `haiku-5-5/search-recent-facts` | None | Off by default, and their scopes are `investigate` and `digest`, which an edit of code does not reveal. |

A trigger that fires on the wrong edit can be measured: every delivery a trigger made names it in the decision log, with the tool and the file, and `noonsight report` lists them under "Triggers revealed".
Disabling a verify rule keeps it out of every session, and a user rule without `triggers` reaches a session only from a named scope.

### Measuring a change of scopes

A change of a rule's scopes changes two things: which tasks the rule reaches, and what it does in them.

- **Reach** comes from the decision log ([hooks.md](../../docs/hooks.md#the-decision-log)).
  Every `session-start`, `launch` and `agent-call` line records the model, `scope`, `scope_source`, `place` and the `rules` delivered.
  Counting lines by rule and by scope, before and after a preset version, shows where a rule still arrives; the share of lines with no scope shows how much of the work the rules with a list miss for want of a scope.
- **Effect** is what the measurement planned in [#12](https://github.com/bpsanti/noonsight/issues/12) reports: a controlled test of the rules as noonsight delivers them, giving the effect and the token cost of each rule.
  For a scope decision, that comparison runs scope by scope: the same tasks of one scope, with and without the rule.
  A scope stays in a rule's list where the measured effect is worth the measured cost, and leaves it otherwise; the rule's scope basis then gives the measurement in place of the judgment.

The judgment calls with a cost the source measured come first: `fable-5-2/finish-work` left out of `routine`, `review` and `digest` (about 30 percent more output), and `fable-5-2/code-ownership` kept to `build` (70 to 80 percent more output).

## Rules

A rule applies to the scopes it lists, or to every scope, and to the places it lists: `session` (a session someone is watching), `unattended` (a session nobody is watching) and `subagent` (the task of a subagent).
Each rule below gives its scopes, why, and the basis of that choice, by the principles in [How the rules are scoped](#how-the-rules-are-scoped).
A rule on by default also says what the rule effect experiment ([experiments/rules](../../experiments/rules/README.md)) measured when noonsight delivered it.
The 2026-11-16 samples are small, so they give a direction, not a significant result; the 2026-11-19 run tested three rules again with 30 runs per arm and task, against comparisons fixed before it ran.

### Claude Fable 5.2 (`claude-fable-5-2`)

#### `fable-5-2/finish-work`

- On by default. Places: `subagent`.
- Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-2, section "Finish the whole task", read 2026-11-16.
- Effect: In replays of recorded sessions from an agentic coding product at medium effort, a version of this text left about half as many sessions ending with work that could have been continued.
- Cost: Output tokens rose by about 30 percent.
- Measured: Not measured on [2026-11-16](../../experiments/rules/results/2026-11-16/README.md): it reaches subagents only, and the experiment starts none.
- Places: Claude Code already sends a block with this advice to every Fable 5.2 session, so the preset only gives it to subagents, whose system prompt has none.
- Scopes: `investigate`, `build`. Not `review`, `routine` or `digest`, nor a task whose scope is not known.
- Why these scopes: the rule pays where a subagent owes many steps of work and can stop before the last one: an investigation, or an implementation that needs reasoning.
  A routine change is short and well-scoped, so it seldom stops early, and a review or a digest ends with a report on material that already exists; in those three, about 30 percent more output would buy little.
  Its push to take the next step rather than list it could also turn a review into fixing what the review found.
- Scope basis: sourced for `investigate`; judgment for `build`.
  Section "Finish the whole task" says: "On long, multistep tasks, Claude Fable 5.2 sometimes ends a turn before the work is done", and `investigate` is described as long work of many steps.
  Including `build` is judgment: an implementation that needs reasoning is usually multistep, and the source measured the text on "recorded sessions from an agentic coding product" without saying which kinds of coding task they were.
  Leaving out `routine`, `review` and `digest` is judgment too.

#### `fable-5-2/low-context-report`

- On by default. Places: `unattended`, `subagent`.
- Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-2, section "Make reports easy to follow", read 2026-11-16.
- Effect: On agentic tasks, final reports were less dense and used fewer semicolons; on workflow automation tasks, sentences were shorter.
- Cost: Not reported by the source.
- Measured: On [2026-11-16](../../experiments/rules/results/2026-11-16/README.md), delivered by noonsight to unattended sessions, reports had shorter sentences (11.7 words against 15.3 on the question, 5 runs each) and almost no semicolons (0.8 per 1,000 words against 19.9), with no added cost.
  On [2026-11-19](../../experiments/rules/results/2026-11-19/README.md), 30 runs per arm on three tasks, it did so on each: words per sentence 12.3 against 16.4 on the question, 17.8 against 20.1 on a bug fix and 12.2 against 16.2 on a feature, and semicolons per 1,000 words 2.5 against 13.0, 0.7 against 4.2 and 0 against 3.3, each significant after Holm's adjustment; cost per run changed by +3, +3 and -15 percent.
- Places: where the reader comes back to a finished report, rather than following the work as it happens.
- Scopes: every scope, including a task whose scope is not known.
- Why these scopes: every kind of task ends in a report that someone reads after the fact, a summary or a review most of all, and the source reports no cost.
- Scope basis: judgment.
  Section "Make reports easy to follow" ties the text to final reports and handoffs ("If you ask Claude Fable 5.2 to write final reports or handoffs"), which every scope produces, and names no kind of task.

#### `fable-5-2/code-ownership`

- Off by default. Places: `session`, `unattended`.
- Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-2, section "Say who owns the code", read 2026-11-16.
- Effect: On small coding tasks, duplicated code was consolidated into one shared function in about 75 percent of runs, against under 10 percent without the sentence.
- Cost: Output tokens rose by about 70 to 80 percent, and the model made changes nobody asked for, many of them new tests and documentation, and in some runs changed how an existing feature behaves.
- Places: not for subagents, which work on a part of a task someone else owns.
- Scopes: `build`. Not `investigate`, `review`, `routine` or `digest`, nor a task whose scope is not known.
- Why these scopes: folding duplicated code into one shared function is a design improvement wanted in an implementation that needs reasoning, such as a refactor or a change of contract.
  It costs 70 to 80 percent more output and brings changes nobody asked for, which a routine change, an investigation, a review or a digest does not want.
- Scope basis: judgment.
  Section "Say who owns the code" offers the sentence "If you want the model to improve the structure as it works", and says to leave it out "where the user owns the code and wants it changed as little as possible".
  Both are what the user wants rather than kinds of task; reading the first as `build` and the second as `routine` is judgment.

#### `fable-5-2/progress-updates`

- Off by default. Places: `session`.
- Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-2, section "Keep users informed during long turns: Signal intent", read 2026-11-16.
- Effect: On coding tasks, the model wrote a message before its first tool call in every run.
- Cost: Output tokens per task rose by roughly 20 percent.
- Places: the guide suggests it where a person is in the loop. Claude Code already sends the guide's other remedy, a reminder after a long silent stretch.
- Scopes: every scope, including a task whose scope is not known.
- Why these scopes: what decides whether it helps is a person following the work, which its place already says, and not the kind of task.
  A session someone watches usually starts without a task text, so its scope is rarely known, and a list would keep the rule dormant exactly where it belongs.
- Scope basis: judgment.
  Section "Keep users informed during long turns: Signal intent" says to "Use this text where a human is directly in the loop", which is a place, and names no kind of task.

### Claude Opus 5.5 (`claude-opus-5-5`)

#### `opus-5-5/unattended-run`

- On by default. Places: `unattended`.
- Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5, section "Unattended agentic runs", read 2026-11-16.
- Effect: Fewer turns that end early in unattended agent loops: the model carries on where it would otherwise stop to check in. The source says to leave it out where someone is there to answer.
- Cost: Somewhat more tool calls and output tokens per task; the source gives no figure.
- Measured: Inconclusive on [2026-11-16](../../experiments/rules/results/2026-11-16/README.md): on two short tasks every run finished with and without it (6 of 6 each); about 30 to 90 more output tokens per run.
- Places: only sessions nobody is watching, as the guide asks.
- Scopes: every scope, including a task whose scope is not known.
- Why these scopes: in a session nobody watches, a turn that ends before the work is done halts the work until someone comes back, whatever the kind of task.
  The source describes the stops on long tasks with several parts, and a digest or a review can be long too.
  Unlike `fable-5-2/finish-work`, which reaches subagents whose parent is still running and can carry on, here nobody picks the work up, and the source puts no figure on the cost.
- Scope basis: judgment.
  Section "Unattended agentic runs" writes the text "for agents that run fully unattended" and says to leave it out of "human-in-the-loop applications", which is a place.
  The stops it describes come "On long tasks with several parts", which is not one of the five scopes.

#### `opus-5-5/progress-updates`

- Off by default. Places: `session`.
- Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5, section "User-facing progress updates (the third lever)", read 2026-11-16.
- Effect: More frequent and predictable updates, such as a line of intent before the first tool call and a recap at the end; helps most where a person is in the loop.
- Cost: Not reported by the source.
- Places: where a person follows the work as it happens.
- Scopes: every scope, including a task whose scope is not known.
- Why these scopes: as for `fable-5-2/progress-updates`, what decides whether it helps is a person following the work, not the kind of task, and a session someone watches rarely has a known scope.
- Scope basis: judgment.
  Section "User-facing progress updates (the third lever)" says it "helps most in human-in-the-loop work", which is a place, and names no kind of task.

#### `opus-5-5/explore-before-acting`

- Off by default. Places: `session`, `unattended`.
- Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5, section "Explore context in multiapp workflows", read 2026-11-16.
- Effect: On automation tasks across several connected apps, noticeably more tasks were completed correctly, at medium and at max effort.
- Cost: Slightly more tool calls and tokens. Because the model acts on what it finds, keep untrusted content out of what it searches.
- Places: the guide writes it for agents that work across connected apps such as email, documents and spreadsheets, so it ships off; turning it on applies it to every scope.
- Scopes: every scope, including a task whose scope is not known.
- Why these scopes: what decides whether it helps is the setting, an agent that works across connected apps such as email, documents and spreadsheets, and not one of the five kinds of task.
  Whoever works in that setting turns it on, and it then applies to all of their work.
- Scope basis: judgment.
  Section "Explore context in multiapp workflows" ties it to "workflow automation across several connected apps", which is a setting and not one of the five scopes.

### Claude Sonnet 5.5 (`claude-sonnet-5-5`)

#### `sonnet-5-5/carry-through`

- On by default. Places: `unattended`, `subagent`.
- Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5, section "Steer initiative and scope: Carrying work through", read 2026-11-16.
- Effect: At low and medium effort, the model carries more of the work through instead of checking in before it is done.
- Cost: Sessions at low and medium effort run longer and cost more; the source gives no figure.
- Measured: Inconclusive on [2026-11-16](../../experiments/rules/results/2026-11-16/README.md): on two short tasks every run finished with and without it (20 of 20 each).
- Places: where nobody can answer a check-in. The guide's suggested prompt has a second paragraph, which is the rule `sonnet-5-5/stay-in-scope`.
- Scopes: every scope, including a task whose scope is not known.
- Why these scopes: where nobody can answer a check-in, a stop before the end leaves the work undone in any kind of task.
  The rule asks for no more than what was asked, so the longer sessions the source names are that work being done.
- Scope basis: sourced for `build`, `routine`; judgment for the other scopes, and for a task whose scope is not known.
  Section "Steer initiative and scope: Carrying work through" describes the check-ins "On agentic coding tasks at low and medium effort", which is what `build` and `routine` cover.
  Applying it to `investigate`, `review`, `digest` and a task whose scope is not known is judgment, for the reason above.

#### `sonnet-5-5/stay-in-scope`

- On by default. Places: `session`, `unattended`, `subagent`.
- Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5, section "Steer initiative and scope: Unrequested additions when coding", read 2026-11-16.
- Effect: Fewer tests, documentation and supporting files that nobody asked for; at xhigh and max effort, smaller changes overall. The source notes that most teams welcome these additions, so the rule only applies to well-scoped changes.
- Cost: Not reported by the source.
- Deviation from the source: the last sentence, on additions that the project's own instructions explicitly require, is not in the guide's text. Added for consistency with `haiku-5-5/carry-through`, which ends with the same sentence for the reason given there; in the [2026-11-18](../../experiments/rules/results/2026-11-18/README.md) run set, Sonnet 5.5 showed no measurable change with or without it.
- Measured: Inconclusive on [2026-11-16](../../experiments/rules/results/2026-11-16/README.md): on a one-file fix, no run changed another file, with or without it (0 of 10 each), and again on [2026-11-19](../../experiments/rules/results/2026-11-19/README.md) (0 of 30 each).
  On [2026-11-18](../../experiments/rules/results/2026-11-18/README.md), the last sentence made no measurable change in 10 runs per arm: Sonnet met a requirement in a document its CLAUDE.md points to in 10 of 10 runs with and without it, and added nothing unrequested where the project only describes a convention (0 of 10 each).
- Scopes: `routine`. Not `investigate`, `build`, `review` or `digest`, nor a task whose scope is not known.
- Why these scopes: a well-scoped change is where tests, documentation and files nobody asked for are least welcome.
  In an investigation or an implementation that needs reasoning, such additions are often wanted, and a review or a digest changes no files, so the rule has nothing to do there.
- Scope basis: judgment.
  Section "Steer initiative and scope: Unrequested additions when coding" says of these additions "Most teams will welcome this", and offers the text "If you prefer changes limited to what was explicitly requested".
  That is a preference rather than a kind of task; reading it as `routine` is judgment.

#### `sonnet-5-5/verify-changes`

- On by default. Places: `session`, `unattended`, `subagent`.
- Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5, section "Verification on coding tasks", read 2026-11-16.
- Effect: At low effort, skipped or superficial checks became rare, with no measurable change in task quality.
- Cost: Slightly higher cost per task.
- Measured: On [2026-11-16](../../experiments/rules/results/2026-11-16/README.md), delivered with `carry-through` and `stay-in-scope` at medium effort, a one-file fix was followed by a test run in 10 of 10 runs, against 0 of 10 without the rules, for about 520 more output tokens and 46 percent more cost per run.
  On [2026-11-19](../../experiments/rules/results/2026-11-19/README.md), 30 runs per arm, Sonnet ran the tests after its last edit in 30 of 30 runs against 0 of 30 on the one-file fix and 30 of 30 against 15 of 30 on a bug known by its symptom, at 59 and 58 percent more cost per run; on a feature across three files it ran them in every run of both arms, and the rules added 7 percent.
- Scopes: `investigate`, `build`, `routine`. Not `review` or `digest`, nor a task whose scope is not known.
- Why these scopes: the rule acts on a code change, and an investigation that ends in a fix, an implementation and a routine change all make one.
  A review and a digest change no code, so there the rule would only add text to read.
- Scope basis: sourced for `build`, `routine`; judgment for `investigate`.
  Section "Verification on coding tasks" describes the skipped checks "On agentic coding tasks", which is what `build` and `routine` cover.
  Including `investigate`, where a fix often ends the work, is judgment.
- Trigger: `code-edit`, as a judgment: the rule acts only on a code change, so it is cheap in a session that edits code whatever its task ([Rules delivered on an action](#rules-delivered-on-an-action)).

#### `sonnet-5-5/no-self-review-rounds`

- Off by default. Places: `session`, `unattended`, `subagent`.
- Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5, section "Steer initiative and scope: Thoroughness at xhigh and max effort", read 2026-11-16.
- Effect: On coding tasks at max effort, the model stopped launching reviewer subagents, with no change in quality; review rounds the main agent starts itself became less frequent. It only matters at xhigh and max effort.
- Cost: Session cost fell by about a third: a saving, not a cost.
- Off because a rule cannot tell the effort a session runs at, and the guide advises running routine work at high effort or below instead.
- Scopes: `build`, `routine`. Not `investigate`, `review` or `digest`, nor a task whose scope is not known.
- Why these scopes: it stops extra review rounds once an implementation is done and its checks pass, which is where the source measured the saving.
  In a review, the review is the task, so a rule against review rounds works against it.
  In an investigation, checking a finding again is part of the work rather than an extra round, and a digest starts no review rounds.
- Scope basis: sourced for `build`, `routine`.
  Section "Steer initiative and scope: Thoroughness at xhigh and max effort" measured the text "on coding tasks at max effort", which is what `build` and `routine` cover; the same section advises to "run routine work at high or below", where the rule has little to do.
  Leaving out `investigate`, `review` and `digest` is judgment.

#### `sonnet-5-5/ideas-first`

- Off by default. Places: `session`.
- Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5, section "Steer initiative and scope: Open-ended requests", read 2026-11-16.
- Effect: On open-ended requests, the model gives ideas or a plan and stops, instead of starting to build.
- Cost: Not reported by the source.
- Scopes: every scope, including a task whose scope is not known.
- Why these scopes: it acts only on a request for ideas, options or a plan, and such a request is not one of the five scopes: it comes up in any of them, such as an architecture decision in an investigation.
  A list would keep it dormant in exactly those requests.
- Scope basis: judgment.
  Section "Steer initiative and scope: Open-ended requests" ties it to open-ended requests, such as "show me what you can do with this", a kind of request the five scopes do not separate.

#### `sonnet-5-5/check-current-facts`

- Off by default. Places: `session`, `unattended`, `subagent`.
- Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5, section "Tool use in chat and knowledge work", read 2026-11-16.
- Effect: The model searches for details that may have changed since its training instead of answering from training knowledge; matters most for research and support work.
- Cost: Not reported by the source.
- Scopes: `investigate`, `digest`. Not `build`, `review` or `routine`, nor a task whose scope is not known.
- Why these scopes: research is where facts that change after training, such as versions, prices or what a service permits, decide the answer: a digest that searches or extracts, and an investigation such as an architecture decision.
  An implementation, a routine change and a review rest on the code at hand, where the extra searches would add cost without changing the result.
- Scope basis: sourced for `digest`; judgment for `investigate`.
  Section "Tool use in chat and knowledge work" describes the problem "On chat and knowledge-work tasks" and says the text "matters most for research and support products"; `digest`, reading existing material to summarize, extract or search, is knowledge work.
  Including `investigate` is judgment.

### Claude Haiku 5.5 (`claude-haiku-5-5`)

#### `haiku-5-5/carry-through`

- On by default. Places: `unattended`, `subagent`.
- Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-haiku-5-5, section "Prevent early stopping in long agent prompts", read 2026-11-16.
- Effect: Fewer early stops that hand the task back to the user, which appear with a long coding-agent system prompt at low effort.
- Cost: Not reported for the text. For comparison, raising effort from low to medium roughly halved early stopping and more than doubled output tokens.
- Deviation from the source: the last sentence, on additions that the project's own instructions explicitly require, is not in the guide's text. Added because, in the [2026-11-18](../../experiments/rules/results/2026-11-18/README.md) run set, on a project whose requirement sat in a document its CLAUDE.md points to, Haiku 5.5 with the rule as adapted from the guide skipped the requirement in about a quarter of runs, often saying nobody had asked for it.
- Measured: Inconclusive on [2026-11-16](../../experiments/rules/results/2026-11-16/README.md): on two short tasks every run finished with and without it (20 of 20 each).
  On [2026-11-18](../../experiments/rules/results/2026-11-18/README.md), with the last sentence, Haiku met a requirement in a document its project's CLAUDE.md points to in 59 of 60 runs, against 44 of 60 without it, and added something unrequested in 0 of 60 runs where the project only describes a convention.
- Scopes: every scope, including a task whose scope is not known.
- Why these scopes: a subagent or an unattended session that hands the task back before the end leaves half a search or half a change, whatever the kind of task, and with routing on the preset's table sends digest subagents to Haiku 5.5.
  Its sentences on work nobody requested keep that work out, as `sonnet-5-5/stay-in-scope` does in `routine` only; the Haiku 5.5 guide writes them into the same prompt, so they come with it in every scope, and so does the last sentence, which qualifies them.
- Scope basis: judgment.
  Section "Prevent early stopping in long agent prompts" ties the stops to "a long coding-agent system prompt at low effort", which is a property of the prompt and the effort, not a kind of task.

#### `haiku-5-5/verify-changes`

- On by default. Places: `session`, `unattended`, `subagent`.
- Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-haiku-5-5, section "Tell coding agents to verify their changes", read 2026-11-16.
- Effect: The model checked its changes more often, and its performance improved.
- Cost: More tokens; the source gives no figure.
- Measured: On [2026-11-16](../../experiments/rules/results/2026-11-16/README.md), delivered with `carry-through` at medium effort, a one-file fix was followed by a test run in 8 of 10 runs, against 0 of 10 without the rules, for about 1,400 more output tokens per run.
  On [2026-11-19](../../experiments/rules/results/2026-11-19/README.md), 30 runs per arm, Haiku ran the tests after its last edit in 27 of 30 runs against 0 of 30 on the one-file fix; on a bug and a feature it already did without the rules (30 of 30 and 29 of 30 in both arms), and the rules added under a tenth of a cent per run.
- Scopes: `investigate`, `build`, `routine`. Not `review` or `digest`, nor a task whose scope is not known.
- Why these scopes: as for `sonnet-5-5/verify-changes`, the rule acts on a code change, which an investigation that ends in a fix, an implementation and a routine change all make, and a review or a digest does not.
- Scope basis: sourced for `build`, `routine`; judgment for `investigate`.
  Section "Tell coding agents to verify their changes" addresses coding agents that report "a code change as done without running a check", which is what `build` and `routine` cover.
  Including `investigate` is judgment.
- Trigger: `code-edit`, as a judgment, as for `sonnet-5-5/verify-changes`.

#### `haiku-5-5/search-recent-facts`

- Off by default. Places: `session`, `unattended`, `subagent`.
- Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-haiku-5-5, section "Accurate search results", read 2026-11-16.
- Effect: More searches on questions whose answers had changed; on prompts that need no search, it added searches in only 0 to 3 percent of tries. The source pairs it with today's date in the context.
- Cost: Only the extra searches; the source gives no other figure.
- Scopes: `investigate`, `digest`. Not `build`, `review` or `routine`, nor a task whose scope is not known.
- Why these scopes: as for `sonnet-5-5/check-current-facts`, research is where facts that change after training decide the answer.
  The source found it adds a search to few prompts that need none, so it would cost little in an implementation, a routine change or a review, but it would also do little there.
- Scope basis: judgment.
  Section "Accurate search results" ties it to giving the model a search tool and to "questions whose answers had changed", not to a kind of task; counting `investigate` and `digest` as the scopes where those questions decide the result is judgment.

## What Claude Code already sends

Claude Code records, in each session's transcript, the system prompt it sends with each model request.
The live test `system-prompt` (`test/live/preset.test.ts`) starts one short session on each of the four models and one session that starts a general-purpose subagent on each, reads those system prompts, and checks every preset rule against them.

With Claude Code 2.1.325, on 2026-11-16:

| Where | Model | System prompt | Section headings | Preset advice already in it |
| --- | --- | --- | --- | --- |
| Session | Fable 5.2 | 12,619 characters | Harness, Session-specific guidance, Memory, Environment, Context management, Finishing work, Memory, notes and feedback | `fable-5-2/finish-work` |
| Session | Opus 5.5 | 8,095 characters | The first five of the above | None |
| Session | Sonnet 5.5 | 7,828 characters | The first five of the above | None |
| Session | Haiku 5.5 | 10,671 characters | The first five of the above | None |
| General-purpose subagent | Each of the four | 3,159 characters | None | None |

So the preset delivers `fable-5-2/finish-work` to subagents only, and no other rule overlaps.
The sizes include text that depends on the machine, such as installed plugins, so they vary a little from one machine to another.
`preset.json` records the Claude Code version and date of this comparison under `claude_code`.

## Left out

| Advice | Why |
| --- | --- |
| The "Finishing work" block in Fable 5.2 sessions | Claude Code 2.1.325 already sends it there |
| A reminder after a long silent stretch (Fable 5.2, Opus 5.5) | It is a change to the harness, which Claude Code already makes; a hook cannot count silent steps |
| Marking pasted text in user messages (Opus 5.5) | Claude Code's own system prompt already covers it |
| "Set expectations for subagents" (Fable 5.2) | It changes the subagent tool's description, which a hook cannot change |
| Time signals for multiagent harnesses (Opus 5.5) | It needs the harness to add the elapsed time to each message |
| Approvals, and keeping caution from piling up (Fable 5.2) | They advise whoever writes rules; they are not text to deliver |
| Frontend design defaults (Opus 5.5) | The guide asks for a list of the patterns to avoid in each case; there is no general text |
| JSON output, thinking settings, tolerant tool-call handling and mid-turn user messages (Sonnet 5.5, Haiku 5.5) | They change how an application calls the API, beyond what a Claude Code hook reaches |
| Keeping chatbots to their system prompt (Haiku 5.5) | It is written for customer-facing chatbots, not coding agents |
| User-facing progress updates (Sonnet 5.5) | The remedy the guide measured is the reminder Claude Code already sends; its other advice is for clients that render the model's updates. A line of intent and a recap can still be added as a user rule |

## Updating the preset

When Anthropic publishes a guide for a new model, or changes a section a rule cites:

1. Read the guide; its list of sections by symptom is a good starting point.
2. Write each new rule with its source, section, date, effect and cost, here and in `preset.json`.
   Give it the scopes where its effect is worth its cost, by the principles in [How the rules are scoped](#how-the-rules-are-scoped), and record why and the basis of that choice here.
   Give it a trigger only by the principles in [Rules delivered on an action](#rules-delivered-on-an-action), and record why here.
3. Run the live test `system-prompt` (`NOONSIGHT_LIVE_LOGIN=1 npm run test:live`) to see what Claude Code already sends the new model, and keep each rule out of the places where it does.
4. Before changing anything else, copy the released version, `preset.json` and its rule files, to `versions/<its version>/`, so that a configuration that accepted it can still compare against it and hold it ([Preset updates](../../docs/configuration.md#preset-updates)).
   A kept copy is never edited afterwards.
5. A rule whose id changes keeps every id it had before in `renamed_from`, so the `enable`, `disable` and `replaces` entries that name it still apply and the update reports a rename instead of a removal and a new rule.
6. Raise the preset's `version` and `claude_code`, and list each new, changed, renamed or removed rule in the changelog.

A model that has no entry here stays undeclared for every user, who gets a warning instead of rules carried over from an earlier version.
