# Configuration

The schema in `schema/sextant.schema.json` is the authority on the shape of the file.
This page explains what the keys mean and how sextant uses them.

## Where the file lives

One file serves the whole machine.
Every Claude Code account and every Claude Code configuration directory (`~/.claude`, or any `CLAUDE_CONFIG_DIR`) reads the same file, because rules follow the model and not the account.
sextant looks for it in this order:

1. The path in `SEXTANT_CONFIG`.
2. `$XDG_CONFIG_HOME/sextant/sextant.json`, when `XDG_CONFIG_HOME` is set to an absolute path.
3. `~/.config/sextant/sextant.json`.

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
    "routine": { "description": "A well-scoped change that can be described precisely." }
  }
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
| `scopes` | Scope name to `{ "description" }` | Empty | Task scopes, added to the preset's. |

A user rule has these keys:

| Key | Default | Meaning |
| --- | --- | --- |
| `id` | Required | A name for the rule, unique for that model, such as `team/commit-style`. |
| `file` | Required | The rule text. |
| `scopes` | `["*"]` | The scopes the rule applies to, or `["*"]` for every scope. |
| `where` | All three places | The places the rule applies to: `session` (someone is watching), `unattended` (nobody is watching), `subagent` (a subagent's task). |

## Model keys

A key is the full model identifier, as Claude Code reports it without suffixes: `claude-fable-5-2`, never `fable` or `claude-fable-5-2[1m]`.
When sextant looks a model up, it first reduces the reported identifier to that form: it lowercases it and drops a `[1m]`-style suffix, a `#effort` suffix, a provider path such as `anthropic/`, and an Amazon Bedrock prefix such as `global.anthropic.`.

A key with `*` or `?` is a wildcard, and a wildcard only accepts `{ "use": "none" }`.
Rules always need the exact identifier, so a new model version never inherits rules written for an earlier one: `claude-fable-5-3` stays undeclared until someone declares it.

An exact key always wins over a wildcard.
Between wildcards, the one with more literal text wins, and a tie goes to the key that sorts first.

## How a rule is chosen

1. The model picks the entry.
   No entry means the model is undeclared, which produces a warning unless `on_undeclared` is `ignore`.
   An entry with `use: "none"` means no rules, by decision.
2. The scope narrows the rules to those for every scope plus those for the current scope.
   A scope that is not declared only means "rules for every scope"; it never blocks and never warns.
3. The place narrows them again.

The rules that remain are joined in order (the preset's first, then the user's), wrapped in a short envelope that says where the text came from, and hashed.
The same configuration and the same request always give the same text and the same hash.

## Validation

A configuration with any problem is refused whole, and nothing from it is applied.
Every problem is reported at once, each with the location in the file.
Beyond the schema, sextant checks that:

- every model key is already in bare form;
- every rule file exists and is not empty;
- rule ids are unique for each model;
- every scope a rule names is declared;
- `enable` and `disable` name rules the preset has for that model, and never the same rule twice;
- the preset is installed and has rules for every model declared with `use: "preset"`;
- the delivered text fits the 10,000-character limit Claude Code puts on hook text, for every combination of scope and place.

The preset is checked the same way, and every preset rule must name its source: the page, the section and the date it was read.

## `sextant resolve`

```text
sextant resolve <model> [--scope <scope>] [--place session|unattended|subagent]
```

Prints the decision as JSON.
The place defaults to `session`.

| `status` | Meaning | Other fields |
| --- | --- | --- |
| `matched` | The model receives rules. | `key`, `rules`, `sha256`, `text` (the exact text that would be delivered) |
| `none` | The model receives nothing. | `key`, `reason`: `declared-none` or `no-rule-applies` |
| `undeclared` | The model has no entry. | `reason`: `no-entry` or `model-not-reported`; `warning` unless `on_undeclared` is `ignore` |

Every decision also has `model`, `scope` and `place`, plus `unknown_scope` when the requested scope is not declared.
The command exits with 0 for every decision, and with 2 for a usage error or a refused configuration.
It reads only local files and never uses the network.
