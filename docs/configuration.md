# Configuration

The schema in `schema/sextant.schema.json` is the authority on the shape of the file.
This page explains what the keys mean and how sextant uses them.

## Where the file lives

One file serves the whole machine.
Every Claude Code account and every Claude Code configuration directory (`~/.claude`, or any `CLAUDE_CONFIG_DIR`) reads the same file, because rules follow the model and not the account.
sextant looks for it in this order:

1. The path in `SEXTANT_CONFIG`.
2. `~/.config/sextant/sextant.json`.

Paths inside the file (the `file` of a rule) are relative to the file itself.

Presets are read from the installed package, so a preset always follows the package version.
`SEXTANT_PRESETS_DIR` replaces that directory, for tests and for preset development.

`sextant init` writes a first file there: it declares every model the preset has rules for with `"use": "preset"`, and it never replaces a file that exists.

## The preset

The package ships one preset, `claude`, in `presets/claude/`.
It has rules for `claude-fable-5-2`, `claude-opus-5-5`, `claude-sonnet-5-5` and `claude-haiku-5-5`, each adapted from Anthropic's prompting guide for that exact model, and five scopes: `investigate`, `build`, `review`, `routine` and `digest`.
Every rule names its source (the page, the section and the date it was read), the effect the source reports, and the cost it reports.
Rules with a high cost, a described side effect or a narrow use ship off; `enable` turns one on for a model, and `disable` turns off one that ships on.
No rule is delivered in a place where Claude Code already sends the same advice; the preset records, under `claude_code`, the Claude Code version it was compared with.
[presets/claude/SOURCES.md](../presets/claude/SOURCES.md) lists every rule and scope with its source, and `sextant models` prints the rules of each declared model with their source, effect and cost.

The preset's scopes declare no matchers, so a session takes one of them only from `SEXTANT_SCOPE` (which `sextant run --scope` sets), and a subagent only once the user's file gives that scope a `match`.
A task whose scope is not known receives only the preset rules for every scope; the rules that list scopes stay dormant until the scope is known.
[presets/claude/SOURCES.md](../presets/claude/SOURCES.md#how-the-rules-are-scoped) gives each rule's scopes, why, and whether that choice comes from a source or is a judgment.

The preset also suggests a routing table, which applies only when the user turns routing on ([Routing](#routing)).

## Example

```json
{
  "$schema": "https://unpkg.com/sextant-ai@0/schema/sextant.schema.json",
  "version": 1,
  "models": {
    "claude-sonnet-5-5": {
      "use": "custom",
      "add": [
        { "id": "team/commit-style", "file": "rules/commit-style.md", "scopes": ["routine"] },
        { "id": "team/finish-work", "file": "rules/finish-work.md", "where": ["unattended", "subagent"] }
      ]
    },
    "claude-haiku-5-5": { "use": "none" },
    "claude-opus-4-*": { "use": "none" }
  },
  "scopes": {
    "routine": { "description": "A well-scoped change that can be described precisely." },
    "investigate": { "match": ["\\binvestigat", "\\broot cause\\b", "\\bdiagnos"] }
  },
  "session": { "unattended_when_env": ["CI"] },
  "subagents": { "permission": "allow", "on_mismatch": "warn" }
}
```

## Keys

| Key | Values | Default | Meaning |
| --- | --- | --- | --- |
| `version` | `1` | Required | Format version of the file. |
| `preset` | Preset name | `claude` | The preset shipped with the package that `"use": "preset"` draws from. The preset follows the installed package version. |
| `models` | Model key to entry | Empty | The models declared active. A model missing from this map is undeclared. |
| `models.<id>.use` | `preset`, `custom`, `none` | Required | `preset`: the preset's rules for this exact model. `custom`: only the rules in `add`. `none`: decided that this model needs no rules. |
| `models.<id>.enable` | Rule ids | Empty | Preset rules that ship off and should be on. Only with `preset`. |
| `models.<id>.disable` | Rule ids | Empty | Preset rules that ship on and should be off. Only with `preset`. |
| `models.<id>.add` | User rules | Empty | The user's own rule files, delivered after the preset's rules. Required, with at least one rule, for `custom`. |
| `on_undeclared` | `warn`, `ignore` | `warn` | What to do when a model is undeclared. There is deliberately no option to block. |
| `scopes` | Scope name to a scope | Empty | Task scopes, added to the preset's. A scope with a preset scope's name keeps that scope's place in the order and replaces only the keys it gives. See [Scopes](#scopes). |
| `scopes.<name>.description` | Text | None | What kind of task the scope covers. |
| `scopes.<name>.match` | Regular expressions | Empty | Matchers run over a subagent's description and task text. A matcher that matches all six probe texts is refused; see [Scopes](#scopes). |
| `session.unattended_when_env` | Environment variable names | Empty | A session is in the place `unattended` when any of these is set and not empty in the environment Claude Code runs in; otherwise it is in the place `session`. |
| `subagents.delivery` | `prompt`, `off` | `prompt` | `prompt`: before a subagent starts, the rules for the model it will run on go at the end of its task text. `off`: subagents are left alone. |
| `subagents.permission` | `allow`, `ask`, `passthrough` | `allow` | The permission decision returned with a call whose task text sextant changed. `allow` runs it without a prompt, though deny and ask rules still apply; `ask` has the person confirm it; `passthrough` returns none, and in auto mode Claude Code can then deny the changed call. |
| `subagents.on_mismatch` | `warn`, `ignore` | `warn` | What to do when a subagent starts on another model than the one its rules were chosen for. The decision log records it either way. |
| `routing.enabled` | `true`, `false` | `false` | Turns routing on. With `false`, sextant only delivers rules and never changes a model or an effort. See [Routing](#routing). |
| `routing.targets` | `launcher`, `subagents` | Both | Where routing acts: `sextant run`, the agent call hook, or both. |
| `routing.respect_explicit` | `true`, `false` | `true` | With `true`, a model the caller already chose wins over the table, and an effort the caller set is kept. |
| `routing.yield_when_env` | Environment variable names | Empty | When any of these is set and not empty, routing yields; the rules are still delivered. |
| `routing.table` | Scope name to a row | The preset's | Options in order of preference for each scope. A row replaces the preset's row for the same scope. |
| `routing.default` | `inherit`, or a row | `inherit` | The row for a task with no scope, or whose scope has no row for the target. `inherit` changes nothing. |

A user rule has these keys:

| Key | Default | Meaning |
| --- | --- | --- |
| `id` | Required | A name for the rule, unique for that model, such as `team/commit-style`. |
| `file` | Required | The rule text. |
| `scopes` | `["*"]` | The scopes the rule applies to, or `["*"]` for every scope. |
| `where` | All three places | The places the rule applies to: `session` (someone is watching), `unattended` (nobody is watching), `subagent` (a subagent's task, delivered by the subagent hooks). |

## Model keys

A key is the full model identifier, as Claude Code reports it without suffixes: `claude-fable-5-2`, never `fable` or `claude-fable-5-2[1m]`.
When sextant looks a model up, it first reduces the reported identifier to that form: it lowercases it and drops a `[1m]`-style suffix, a `#effort` suffix, a provider path such as `anthropic/`, an Amazon Bedrock prefix such as `global.anthropic.` and version suffix such as `-v1:0` or `-v1`, and a Google Vertex AI version suffix such as `@20261001`.

A key with `*` or `?` is a wildcard, and a wildcard only accepts `{ "use": "none" }`.
Rules always need the exact identifier, so a new model version never inherits rules written for an earlier one: `claude-fable-5-3` stays undeclared until someone declares it.

An exact key always wins over a wildcard.
Between wildcards, the one with more literal text wins, and a tie goes to the key that sorts first.

## Scopes

A scope names a kind of task, such as `investigate` or `summarize`.
A rule names the scopes it applies to (`"scopes": ["investigate"]`), or every scope (`["*"]`, the default).
A decision has at most one scope, and where it comes from depends on who reads the rules:

| Reader | Scope | Place |
| --- | --- | --- |
| A session | `SEXTANT_SCOPE` in the environment Claude Code starts with, when whoever starts the session sets it; else none | `unattended` when a variable of `session.unattended_when_env` is set and not empty; else `session` |
| A subagent | The scope whose matcher matches earliest in its description and task text; else none | Always `subagent` |

A subagent's scope comes from its own task and is never taken from the session.
A session that investigates can start a subagent that summarizes, and each gets the rules of its own scope.

Matchers are JavaScript regular expressions, compiled case-insensitive and Unicode-aware (flags `iu`).
They read the subagent's `description`, then its `prompt`, joined, up to the first 100,000 characters.
The bound keeps the text a matcher reads inside the hook, which runs before every agent call, limited, so a longer task is cut there, and the decision log records `task_text_cut` for it.
A length bound alone does not keep matching fast: a matcher whose time grows much faster than the text can still hold an agent call on a long task, so such matchers are refused (see [Matchers that backtrack](#matchers-that-backtrack)).
Any sextant rules a parent copied into the task are left out, so the rules' own words never pick the scope.
When several scopes match, the one whose matcher matches earliest in the text wins, and two that match at the same place go to the scope declared first: the preset's scopes in the preset's order, then the user's new ones in the file's order.
The check tries each matcher against six probe texts: `"a"`, `"Z"`, `"0"`, `" a "`, `"A B"` and `"x_1 y"`, which are plain task texts.
A matcher that matches all six is refused as a catch-all (such as `.`, `\b` or `\w`).
A matcher that misses any of them is accepted, however broad it is.
A scope that is not declared, such as a `SEXTANT_SCOPE` with a typing error, only means "rules for every scope"; it never blocks and never warns in a session, and the decision log records it as `unknown_scope`.

`sextant check` reports two scopes whose matchers match the same text, as a warning with an example text that both match and the scope a task with that text gets.
To find such texts, sextant builds short example texts from each matcher and runs the other scopes' matchers over them, so every overlap it reports comes with a text that really matches both.
Two scopes can still overlap on a text the examples do not reach, so "no two scopes overlap" means no overlap was found.
A matcher whose examples are incomplete, such as one with a back reference, or one with more texts than sextant keeps, is named on the scopes line, which then does not claim that no two scopes overlap.

### Matchers that backtrack

When a regular expression can match the same stretch of text in many ways, the engine tries them all before it gives up, and the time it takes can grow with the square of the text length, or faster.
sextant refuses a matcher with one of these three shapes, naming the scope, the pattern and the shape:

- **It starts with an unbounded repeat of any character** (`.*`, `.+`, `[\s\S]*` and the like), in the whole pattern or in one of its alternatives, with no `^` before it.
  Parts that can match nothing, such as `a?`, `(?:foo)?` or `\b`, do not count as a start, so `a?.*x` is refused too.
  A group or positive lookaround whose every alternative starts with `^` counts as a `^`, so `(?:^).*x` and `(?=^).*x` are accepted, while `(?:^|\s).*x`, `(^\s*)?.*x` and `(?!^).*x` are refused.
  A lookaround at the start opens its own alternatives the same way, so `(?=.*deploy)(?=.*prod)` is refused, and `^(?=.*deploy)(?=.*prod)` is accepted.
  The engine retries the repeat from every position of the task text.
  `^.*hotfix` is accepted; `.*investigat` is refused, and `\binvestigat` matches the same tasks.
- **It nests an unbounded quantifier inside another**, such as `(a+)+` or `(?:\w+\s?)*`.
- **It has two unbounded quantifiers in a row that can match the same characters, with nothing required between them**, such as `\w+\w+` or `\w+\s*\w+`.
  A repeat at the edge of a group's alternative counts, as in `\w+(?:-|\w+)`.
  `\w+\s+\w+` is accepted, because the required space separates the two repeats.

The last two shapes are also looked for inside lookarounds, so `^(?=.*.*x)` is refused.

"Unbounded" means `*`, `+` or `{n,}`.
Characters are compared over a fixed set of sample characters (printable ASCII, whitespace and a few letters beyond it).
The check recognizes these shapes only: a matcher that passes it is not proven fast, and other slow shapes, such as alternatives that match the same text inside a repeat (`(a|a)*`), are not detected.
Matchers that start with a word and a word boundary, such as `\bdeploy\b`, `review|revis` or `^fix\b`, pass it.

## Routing

Routing chooses the model and the effort for a task from its scope.
It is off unless `routing.enabled` is `true`, and the scope and the rules never depend on it: they are decided the same way whether a route applies or not, and the rules always follow the model the task runs on.

```json
{
  "routing": {
    "enabled": true,
    "targets": ["launcher", "subagents"],
    "respect_explicit": true,
    "yield_when_env": ["MY_ORCHESTRATOR_TASK"],
    "table": {
      "investigate": [
        { "model": "fable", "effort": "high" },
        { "model": "opus", "effort": "high" }
      ],
      "digest": {
        "launcher": [{ "model": "sonnet", "effort": "medium" }],
        "subagents": [{ "model": "haiku", "effort": "medium" }]
      }
    },
    "default": "inherit"
  }
}
```

### Where it acts

| Target | What it changes |
| --- | --- |
| `launcher` | `sextant run` adds `--model` and `--effort` to the claude command line, ahead of the other arguments ([launcher.md](launcher.md#routing)) |
| `subagents` | The agent call hook sets the call's `model` and `effort` parameters before the subagent starts ([hooks.md](hooks.md#routing)) |

No hook changes the model of a session that is already running.
A session started without `sextant run` keeps the model it was started with, and `/model` works as always.

### From the scope to the model

1. The task's scope is decided as without routing: `SEXTANT_SCOPE` for a session, which `sextant run` can also take from the task text ([launcher.md](launcher.md#routing)); the matchers over its own task for a subagent.
2. The scope's row for the target lists options in order of preference.
   Without a scope, without a row for the scope, or with a row that leaves the target out, `routing.default` applies; `inherit`, the default, changes nothing.
   A row with an empty list for the target means that target is not routed for that scope.
3. The first option whose model is declared under `models` wins: an exact key, or a wildcard key.
   So a configuration that does not declare `claude-fable-5-2` is never sent to Fable by a row that lists it first; the next option applies.
   When no option's model is declared, nothing changes.
4. The option's `effort`, when it gives one, is set with the model; left out, the effort is not changed.

A row is a list of options, the same for both targets, or an object with a list for `launcher`, for `subagents`, or for both.
An option is `{ "model": <model>, "effort": <effort> }`, where the model is an alias (`fable`, `opus`, `sonnet`, `haiku`) or a model identifier declared with its exact key under `models`, and the effort is `low`, `medium`, `high`, `xhigh` or `max`.
The agent tool's `model` parameter takes an alias only ([Choose a model](https://code.claude.com/docs/en/sub-agents#choose-a-model)), so for a subagent an identifier is written as the alias that selects it, and an option whose identifier no alias selects is passed over.
An alias selects for a subagent what it selects in Claude Code: the parent's own model when the parent is of that family, else the model it names.
If the effort is one the model does not support, Claude Code falls back to the highest level it supports below it ([Adjust effort level](https://code.claude.com/docs/en/model-config)).

### When routing yields

Routing leaves a task as it is, and says why in the decision log, in each of these cases:

| Case | `routing` | `routing_reason` |
| --- | --- | --- |
| `routing.enabled` is `false` | `off` | `disabled` |
| The target is not in `routing.targets` | `yielded` | `target-off` |
| `SEXTANT_ROUTING=off` in the environment Claude Code or `sextant run` starts with (also `0`, `false`, `no`) | `yielded` | `routing-env` |
| A variable of `routing.yield_when_env` is set and not empty | `yielded` | `yield-env`, with the variable in `routing_env` |
| The call names its model, under `respect_explicit`: `--model` on the claude command line, or the `model` parameter of an agent call | `yielded` | `explicit-model` |
| The subagent's definition sets `model`, under `respect_explicit` | `yielded` | `definition-model` |
| A built-in subagent with its own model rule (Explore, Plan, `statusline-setup`, `claude-code-guide`), under `respect_explicit` | `yielded` | `built-in-model` |
| A plugin's subagent, whose definition sextant does not read, under `respect_explicit` | `yielded` | `plugin-definition` |
| A fork, which always runs on its parent's model | `yielded` | `fork` |
| `CLAUDE_CODE_SUBAGENT_MODEL_FORCE`, under which Claude Code ignores the call's model | `yielded` | `model-forced` |
| No scope, or no row and `default` is `inherit` | `inherit` | `no-scope`, `no-row` |
| The row lists no option for the target | `inherit` | `empty-row` |
| No option's model is declared | `inherit` | `no-declared-option` |

An effort the caller set (`--effort`, the call's `effort`, or a definition's `effort`) is kept under `respect_explicit`; only the model is routed, and the log records `route_effort_kept`.
With `respect_explicit` set to `false`, the table replaces the caller's model and effort, but never a fork's model or a forced one.
When `CLAUDE_CODE_EFFORT_LEVEL` is set, Claude Code uses it over any effort sextant sets, and the log records `route_effort_overridden_by`.

### With an orchestrator

An orchestrator that starts `claude --model <model> --effort <effort>` itself never goes through `sextant run`, and its subagents' calls name their model, so routing does not contradict it.
For an orchestrator whose sessions still start subagents without a model, put one of its own environment variables in `yield_when_env`, or have it set `SEXTANT_ROUTING=off`: its sessions and their subagents are then never routed, and they still receive the rules.

### The preset's table

The `claude` preset suggests this table; [presets/claude/SOURCES.md](../presets/claude/SOURCES.md#routing-table) gives the sources of each row.

| Scope | Launcher | Subagents |
| --- | --- | --- |
| `investigate` | Fable, `high`; else Opus, `high` | Fable, `high`; else Opus, `high` |
| `build` | Opus, `high` | Opus, `high` |
| `review` | Opus, `high` | Opus, `high` |
| `routine` | Sonnet, `medium` | Sonnet, `medium` |
| `digest` | Sonnet, `medium` | Haiku, `medium` |

A user row replaces the preset's row for the same scope; to stop routing a scope, give it an empty list.

## How a rule is chosen

1. The model picks the entry.
   No entry means the model is undeclared, which produces a warning unless `on_undeclared` is `ignore`.
   An entry with `use: "none"` means no rules, by decision.
2. The scope narrows the rules to those for every scope plus those for the current scope.
   A scope that is not declared only means "rules for every scope"; it never blocks and never warns.
3. The place narrows them again.

The rules that remain are joined in order (the preset's first, then the user's) and hashed.
The joined text is then wrapped in a short envelope that says where it came from; the hash covers the rules only, not the envelope.
The same configuration and the same request always give the same text and the same hash.

## Validation

A configuration with any problem is refused whole, and nothing from it is applied.
Problems are reported with their location in the file, in three passes.
Schema problems (unknown keys, wrong types or values) are reported together first.
Once the file matches the schema, problems with the preset (missing, or failing its own checks) are reported together.
Once the preset loads, every remaining problem is reported together.
Beyond the schema, sextant checks that:

- every model key is already in bare form;
- every rule file exists and is not empty;
- rule ids are unique for each model;
- every scope a rule names is declared;
- every matcher is a valid regular expression, does not match all six probe texts listed under [Scopes](#scopes), and has none of the shapes listed under [Matchers that backtrack](#matchers-that-backtrack);
- `enable` and `disable` name rules the preset has for that model, and never the same rule twice;
- the preset is installed and has rules for every model declared with `use: "preset"`;
- every scope in `routing.table` is declared, and every model a routing option names is an alias or a model declared with its exact key;
- a routing row written as an object lists at least one target;
- the delivered text fits in 9,500 characters for every combination of scope and place, so that with the note sent when the session's model changes it stays within the 10,000 characters Claude Code accepts from a hook ([hooks.md](hooks.md)).

The preset is checked the same way, and more strictly:

- every preset rule names its source (the page, the section and the date it was read), the effect the source reports and its cost, and every preset scope names its source;
- every row of the preset's routing table names a scope of the preset, models by alias only, and what it rests on with its sources;
- every preset rule fits the limit on its own, and a model's preset rules fit it together with every rule on, for every combination of scope and place, since the user decides which of them are on.

The installed preset is read whenever it is there, even when no model uses it, because its scopes are always declared; a preset that fails these checks refuses every configuration until it is fixed.

## `sextant models`

```text
sextant models [--json]
```

Lists, for each declared model, how it is declared and the rules it receives.
For `"use": "preset"` that is every preset rule of the model, on or off, with its scopes, places, source, effect and cost; the user's own rules follow, with their files.
It also lists the preset's models that are not declared, and the models the decision log ([hooks.md](hooks.md#the-decision-log)) has seen that are not declared, which get a warning and no rules.
A wildcard key lists the models from the log that it covers.
`--json` prints the same as one JSON object.
The command reads only local files.

## `sextant resolve`

```text
sextant resolve <model> [scope] [session|unattended|subagent]
```

Prints the decision as JSON.
The place defaults to `session`.
An empty scope (`""`) means no scope, so a place can be given without one, as in `sextant resolve claude-sonnet-5-5 "" subagent`.

| `status` | Meaning | Other fields |
| --- | --- | --- |
| `matched` | The model receives rules. | `key`, `rules`, `sha256`, `text` (the exact text that would be delivered) |
| `none` | The model receives nothing. | `key`, `reason`: `declared-none` or `no-rule-applies` |
| `undeclared` | The model has no entry. | `reason`: `no-entry` or `model-not-reported`; `warning` unless `on_undeclared` is `ignore` |

Every decision also has `model`, `scope` and `place`, plus `unknown_scope` when the requested scope is not declared.
The command exits with 0 for every decision, and with 2 for a usage error or a refused configuration.
It reads only local files and never uses the network.
