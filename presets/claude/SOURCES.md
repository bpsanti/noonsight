# Sources of the `claude` preset

This preset gives each current Claude model a few working rules, taken from Anthropic's prompting guide for that exact model.
This page lists where each rule and each scope comes from, what the source reports the rule changes, and what it costs.
`preset.json` holds the same source, effect and cost for each rule, and `sextant models` prints them.

## How the rules were chosen

1. **Only what has a public source.**
   Every rule names the page, the section and the date it was read.
   `sextant check` refuses a preset rule without them, and without an effect and a cost.
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
The guides measured their own wording; the adapted wording has not been measured separately.

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
A session takes its scope from `SEXTANT_SCOPE`; a subagent from the matchers a scope declares.
The preset's scopes declare no matchers: a keyword guess would put rules into tasks they were not written for, so a user who wants subagents sorted into these scopes adds `match` to them in their own configuration.

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
`preset.json` holds the same rows with their basis and sources, and `sextant check` shows the table in use.

## Rules

A rule applies to the scopes it lists, or to every scope, and to the places it lists: `session` (a session someone is watching), `unattended` (a session nobody is watching) and `subagent` (the task of a subagent).

### Claude Fable 5.2 (`claude-fable-5-2`)

#### `fable-5-2/finish-work`

- On by default. Every scope. Places: `subagent`.
- Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-2, section "Finish the whole task", read 2026-11-16.
- Effect: In replays of recorded sessions from an agentic coding product at medium effort, a version of this text left about half as many sessions ending with work that could have been continued.
- Cost: Output tokens rose by about 30 percent.
- Places: Claude Code already sends a block with this advice to every Fable 5.2 session, so the preset only gives it to subagents, whose system prompt has none.

#### `fable-5-2/low-context-report`

- On by default. Every scope. Places: `unattended`, `subagent`.
- Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-2, section "Make reports easy to follow", read 2026-11-16.
- Effect: On agentic tasks, final reports were less dense and used fewer semicolons; on workflow automation tasks, sentences were shorter.
- Cost: Not reported by the source.
- Places: where the reader comes back to a finished report, rather than following the work as it happens.

#### `fable-5-2/code-ownership`

- Off by default. Scope `build`. Places: `session`, `unattended`.
- Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-2, section "Say who owns the code", read 2026-11-16.
- Effect: On small coding tasks, duplicated code was consolidated into one shared function in about 75 percent of runs, against under 10 percent without the sentence.
- Cost: Output tokens rose by about 70 to 80 percent, and the model made changes nobody asked for, many of them new tests and documentation, and in some runs changed how an existing feature behaves.
- Places: not for subagents, which work on a part of a task someone else owns.

#### `fable-5-2/progress-updates`

- Off by default. Every scope. Places: `session`.
- Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-2, section "Keep users informed during long turns: Signal intent", read 2026-11-16.
- Effect: On coding tasks, the model wrote a message before its first tool call in every run.
- Cost: Output tokens per task rose by roughly 20 percent.
- Places: the guide suggests it where a person is in the loop. Claude Code already sends the guide's other remedy, a reminder after a long silent stretch.

### Claude Opus 5.5 (`claude-opus-5-5`)

#### `opus-5-5/unattended-run`

- On by default. Every scope. Places: `unattended`.
- Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5, section "Unattended agentic runs", read 2026-11-16.
- Effect: Fewer turns that end early in unattended agent loops: the model carries on where it would otherwise stop to check in. The source says to leave it out where someone is there to answer.
- Cost: Somewhat more tool calls and output tokens per task; the source gives no figure.
- Places: only sessions nobody is watching, as the guide asks.

#### `opus-5-5/progress-updates`

- Off by default. Every scope. Places: `session`.
- Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5, section "User-facing progress updates (the third lever)", read 2026-11-16.
- Effect: More frequent and predictable updates, such as a line of intent before the first tool call and a recap at the end; helps most where a person is in the loop.
- Cost: Not reported by the source.
- Places: where a person follows the work as it happens.

#### `opus-5-5/explore-before-acting`

- Off by default. Every scope. Places: `session`, `unattended`.
- Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5, section "Explore context in multiapp workflows", read 2026-11-16.
- Effect: On automation tasks across several connected apps, noticeably more tasks were completed correctly, at medium and at max effort.
- Cost: Slightly more tool calls and tokens. Because the model acts on what it finds, keep untrusted content out of what it searches.
- Places: the guide writes it for agents that work across connected apps such as email, documents and spreadsheets, so it ships off; turning it on applies it to every scope.

### Claude Sonnet 5.5 (`claude-sonnet-5-5`)

#### `sonnet-5-5/carry-through`

- On by default. Every scope. Places: `unattended`, `subagent`.
- Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5, section "Steer initiative and scope: Carrying work through", read 2026-11-16.
- Effect: At low and medium effort, the model carries more of the work through instead of checking in before it is done.
- Cost: Sessions at low and medium effort run longer and cost more; the source gives no figure.
- Places: where nobody can answer a check-in. The guide's suggested prompt has a second paragraph, which is the rule `sonnet-5-5/stay-in-scope`.

#### `sonnet-5-5/stay-in-scope`

- On by default. Scope `routine`. Places: `session`, `unattended`, `subagent`.
- Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5, section "Steer initiative and scope: Unrequested additions when coding", read 2026-11-16.
- Effect: Fewer tests, documentation and supporting files that nobody asked for; at xhigh and max effort, smaller changes overall. The source notes that most teams welcome these additions, so the rule only applies to well-scoped changes.
- Cost: Not reported by the source.

#### `sonnet-5-5/verify-changes`

- On by default. Scopes `build`, `routine`. Places: `session`, `unattended`, `subagent`.
- Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5, section "Verification on coding tasks", read 2026-11-16.
- Effect: At low effort, skipped or superficial checks became rare, with no measurable change in task quality.
- Cost: Slightly higher cost per task.

#### `sonnet-5-5/no-self-review-rounds`

- Off by default. Every scope. Places: `session`, `unattended`, `subagent`.
- Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5, section "Steer initiative and scope: Thoroughness at xhigh and max effort", read 2026-11-16.
- Effect: On coding tasks at max effort, the model stopped launching reviewer subagents, with no change in quality; review rounds the main agent starts itself became less frequent. It only matters at xhigh and max effort.
- Cost: Session cost fell by about a third: a saving, not a cost.
- Off because a rule cannot tell the effort a session runs at, and the guide advises running routine work at high effort or below instead.

#### `sonnet-5-5/ideas-first`

- Off by default. Every scope. Places: `session`.
- Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5, section "Steer initiative and scope: Open-ended requests", read 2026-11-16.
- Effect: On open-ended requests, the model gives ideas or a plan and stops, instead of starting to build.
- Cost: Not reported by the source.

#### `sonnet-5-5/check-current-facts`

- Off by default. Scope `digest`. Places: `session`, `unattended`, `subagent`.
- Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5, section "Tool use in chat and knowledge work", read 2026-11-16.
- Effect: The model searches for details that may have changed since its training instead of answering from training knowledge; matters most for research and support work.
- Cost: Not reported by the source.

### Claude Haiku 5.5 (`claude-haiku-5-5`)

#### `haiku-5-5/carry-through`

- On by default. Every scope. Places: `unattended`, `subagent`.
- Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-haiku-5-5, section "Prevent early stopping in long agent prompts", read 2026-11-16.
- Effect: Fewer early stops that hand the task back to the user, which appear with a long coding-agent system prompt at low effort.
- Cost: Not reported for the text. For comparison, raising effort from low to medium roughly halved early stopping and more than doubled output tokens.

#### `haiku-5-5/verify-changes`

- On by default. Scopes `build`, `routine`. Places: `session`, `unattended`, `subagent`.
- Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-haiku-5-5, section "Tell coding agents to verify their changes", read 2026-11-16.
- Effect: The model checked its changes more often, and its performance improved.
- Cost: More tokens; the source gives no figure.

#### `haiku-5-5/search-recent-facts`

- Off by default. Scope `digest`. Places: `session`, `unattended`, `subagent`.
- Source: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-haiku-5-5, section "Accurate search results", read 2026-11-16.
- Effect: More searches on questions whose answers had changed; on prompts that need no search, it added searches in only 0 to 3 percent of tries. The source pairs it with today's date in the context.
- Cost: Only the extra searches; the source gives no other figure.

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
3. Run the live test `system-prompt` (`SEXTANT_LIVE_LOGIN=1 npm run test:live`) to see what Claude Code already sends the new model, and keep each rule out of the places where it does.
4. Raise the preset's `version` and `claude_code`, and list each new, changed or removed rule in the changelog.

A model that has no entry here stays undeclared for every user, who gets a warning instead of rules carried over from an earlier version.
