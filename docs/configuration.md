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
They read the subagent's `description`, then its `prompt`, joined, up to the first 4,000 characters; any sextant rules a parent copied into the task are left out, so the rules' own words never pick the scope.
When several scopes match, the one whose matcher matches earliest in the text wins, and two that match at the same place go to the scope declared first: the preset's scopes in the preset's order, then the user's new ones in the file's order.
The check tries each matcher against six probe texts: `"a"`, `"Z"`, `"0"`, `" a "`, `"A B"` and `"x_1 y"`, which are plain task texts.
A matcher that matches all six is refused as a catch-all (such as `.`, `\b` or `\w`).
A matcher that misses any of them is accepted, however broad it is.
A scope that is not declared, such as a `SEXTANT_SCOPE` with a typing error, only means "rules for every scope"; it never blocks and never warns in a session, and the decision log records it as `unknown_scope`.

`sextant check` reports two scopes whose matchers match the same text, as a warning with an example text that both match and the scope a task with that text gets.
To find such texts, sextant builds short example texts from each matcher and runs the other scopes' matchers over them, so every overlap it reports comes with a text that really matches both.
Two scopes can still overlap on a text the examples do not reach, so "no two scopes overlap" means no overlap was found.
A matcher whose examples are incomplete, such as one with a back reference, or one with more texts than sextant keeps, is named on the scopes line, which then does not claim that no two scopes overlap.

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
- every matcher is a valid regular expression and does not match all six probe texts listed under [Scopes](#scopes);
- `enable` and `disable` name rules the preset has for that model, and never the same rule twice;
- the preset is installed and has rules for every model declared with `use: "preset"`;
- the delivered text fits in 9,500 characters for every combination of scope and place, so that with the note sent when the session's model changes it stays within the 10,000 characters Claude Code accepts from a hook ([hooks.md](hooks.md)).

The preset is checked the same way, and every preset rule must name its source: the page, the section and the date it was read.

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
