# Configuration

The schema in `schema/noonsight.schema.json` is the authority on the shape of the file.
This page explains what the keys mean and how noonsight uses them.

## Where the file lives

One file serves the whole machine.
Every Claude Code account and every Claude Code configuration directory (`~/.claude`, or any `CLAUDE_CONFIG_DIR`) reads the same file, because rules follow the model and not the account.
noonsight looks for it in this order:

1. The path in `NOONSIGHT_CONFIG`.
2. `~/.config/noonsight/noonsight.json`.

Paths inside the file (the `file` of a rule) are relative to the file itself.

A repository can also commit a configuration of its own, `.noonsight/noonsight.json`, which is laid over this file for the sessions that run in that project, once the account trusts the project and as far as this file's `projects.allow` permits ([Project configuration](#project-configuration)).

Presets are read from the installed package, so a preset follows the package version, and the configuration records the version it was checked against ([Preset updates](#preset-updates)).
`NOONSIGHT_PRESETS_DIR` replaces that directory, for tests and for preset development.

`noonsight init` writes a first file there, and so does `noonsight install` when there is none ([install.md](install.md#the-one-command)): it declares every model the preset has rules for with `"use": "preset"`, records the preset's version as `preset_version`, and never replaces a file that exists.

## The preset

The package ships one preset, `claude`, in `presets/claude/`.
It has rules for `claude-fable-5-2`, `claude-opus-5-5`, `claude-sonnet-5-5` and `claude-haiku-5-5`, each adapted from Anthropic's prompting guide for that exact model, and five scopes: `investigate`, `build`, `review`, `routine` and `digest`.
Every rule names its source (the page, the section and the date it was read), the effect the source reports, and the cost it reports.
Rules with a high cost, a described side effect or a narrow use ship off; `enable` turns one on for a model, and `disable` turns off one that ships on.
A rule of the user's own can also replace a preset rule ([Replacing a preset rule](#replacing-a-preset-rule)).
No rule is delivered in a place where Claude Code already sends the same advice; the preset records, under `claude_code`, the Claude Code version it was compared with.
[presets/claude/SOURCES.md](../presets/claude/SOURCES.md) lists every rule and scope with its source, and `noonsight models` prints the rules of each declared model with their source, effect and cost.

The preset's scopes declare no matchers, so a session takes one of them only from `NOONSIGHT_SCOPE` (which `noonsight run --scope` sets), and a subagent only once the user's file gives that scope a `match`.
A task whose scope is not known receives only the preset rules for every scope; the rules that list scopes stay dormant until the scope is known, except that `sonnet-5-5/verify-changes` and `haiku-5-5/verify-changes` reach a session once it edits a code file of the project ([Triggers](#triggers)).
[presets/claude/SOURCES.md](../presets/claude/SOURCES.md#how-the-rules-are-scoped) gives each rule's scopes, why, and whether that choice comes from a source or is a judgment.
The places matter as much: every rule that ships on for Opus 5.5 and Fable 5.2, and the carry-through rules of Sonnet 5.5 and Haiku 5.5, are for unattended sessions or subagents, so a watched session on Opus or Fable receives nothing from the preset in any scope.
A headless run (`claude -p`, the Agent SDK) is unattended by default (`session.headless_is_unattended`), and `session.unattended_when_env` marks the other sessions nobody watches; `noonsight install` and `noonsight check` write out, per model, what each place receives.

The preset also suggests a routing table, which applies only when the user turns routing on ([Routing](#routing)).

## Example

```json
{
  "$schema": "https://unpkg.com/noonsight@0/schema/noonsight.schema.json",
  "version": 1,
  "preset_version": "1.3.1",
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
| `preset` | Preset name | `claude` | The preset shipped with the package that `"use": "preset"` draws from. |
| `preset_version` | A preset version, such as `1.3.1` | Absent | The preset version the configuration was last checked against. `noonsight init` and `noonsight accept` write it. See [Preset updates](#preset-updates). |
| `on_preset_change` | `warn`, `hold` | `warn` | What an installed preset that is not `preset_version` does. `warn`: sessions receive its rules, and `noonsight check` and each session's start report what changed. `hold`: sessions keep receiving the rules of `preset_version` until `noonsight accept`. |
| `models` | Model key to entry | Empty | The models declared active. A model missing from this map is undeclared. |
| `models.<id>.use` | `preset`, `custom`, `none` | Required | `preset`: the preset's rules for this exact model. `custom`: only the rules in `add`. `none`: decided that this model needs no rules. |
| `models.<id>.enable` | Rule ids | Empty | Preset rules that ship off and should be on. Only with `preset`. |
| `models.<id>.disable` | Rule ids | Empty | Preset rules that ship on and should be off. Only with `preset`. |
| `models.<id>.add` | User rules | Empty | The user's own rule files, delivered after the preset's rules and the rules of `all_models`; a rule that replaces a preset rule is delivered in that rule's place instead. Required, with at least one rule, for `custom`. |
| `all_models.add` | User rules | Absent | Rules for every model, in one place: team conventions, commit style, anything that is not specific to a model. See [Rules for every model](#rules-for-every-model). |
| `on_undeclared` | `warn`, `ignore` | `warn` | What to do when a model is undeclared. There is deliberately no option to block. |
| `scopes` | Scope name to a scope | Empty | Task scopes, added to the preset's. A scope with a preset scope's name keeps that scope's place in the order and replaces only the keys it gives. See [Scopes](#scopes). |
| `scopes.<name>.description` | Text | None | What kind of task the scope covers. |
| `scopes.<name>.match` | Regular expressions | Empty | Matchers run over a subagent's description and task text. A matcher that matches all six probe texts is refused; see [Scopes](#scopes). |
| `session.unattended_when_env` | Environment variable names | Empty | A session is in the place `unattended` when any of these is set and not empty in the environment Claude Code runs in; otherwise it is in the place `session`, unless it runs headless and `session.headless_is_unattended` is `true`. Set it for the interactive sessions nobody watches, such as an orchestrator's workers, which Claude Code does not mark. |
| `session.headless_is_unattended` | `true`, `false` | `true` | With `true`, a headless run, such as `claude -p` or the Agent SDK, is in the place `unattended`: nobody can answer it mid-turn. Claude Code marks such a run with `CLAUDE_CODE_SESSION_ATTENDED=0` in the environment of its hooks, a variable it does not document ([verification](verification/claude-code.md)); without that mark, a session is not headless. With `false`, a headless run is in the place `session` unless a variable of `session.unattended_when_env` is set. |
| `subagents.delivery` | `prompt`, `off` | `prompt` | `prompt`: each subagent receives the rules for the model it will run on as it starts, without any change to the call that starts it ([hooks.md](hooks.md#subagents)). `off`: subagents are left alone. |
| `subagents.permission` | `allow`, `ask`, `passthrough` | `allow` | The permission decision returned with a call whose model or effort routing changed; a call routing leaves alone is never changed. `allow` runs it without a prompt, though deny and ask rules still apply; `ask` has the person confirm it; `passthrough` returns none, and in auto mode Claude Code can then deny the changed call. In auto mode a changed call also costs the other calls of the same response their review ([hooks.md](hooks.md#routing)). |
| `subagents.on_mismatch` | `warn`, `ignore` | `warn` | What to do when a subagent starts on another model than the one its rules were chosen for. The decision log records it either way. |
| `routing.enabled` | `true`, `false` | `false` | Turns routing on. With `false`, noonsight only delivers rules and never changes a model or an effort. See [Routing](#routing). |
| `routing.targets` | `launcher`, `subagents` | Both | Where routing acts: `noonsight run`, the agent call hook, or both. |
| `routing.respect_explicit` | `true`, `false` | `true` | With `true`, a model the caller already chose wins over the table, and an effort the caller set is kept. |
| `routing.yield_when_env` | Environment variable names | Empty | When any of these is set and not empty, routing yields; the rules are still delivered. |
| `routing.table` | Scope name to a row | The preset's | Options in order of preference for each scope. A row replaces the preset's row for the same scope. |
| `routing.default` | `inherit`, or a row | `inherit` | The row for a task with no scope, or whose scope has no row for the target. `inherit` changes nothing. |
| `classifier.mode` | `off`, `fallback`, `always` | `off` | Whether a small model places a task that no explicit scope placed: never, only when no matcher did either, or over the matchers. See [The classifier](#the-classifier). |
| `classifier.model` | A model alias or identifier | `haiku` | The model the classifier runs on, as `claude --model` takes it. |
| `classifier.effort` | `low`, `medium`, `high`, `xhigh`, `max` | `low` | The effort the classifier runs at. |
| `classifier.timeout_ms` | 1000 to 8000 | 8000 | How long one classification may take before the task gets no scope. |
| `projects.allow` | `none`, `add`, `rules`, `all` | `add` | How far a project's configuration may change this one for the sessions that run in that project. See [Project configuration](#project-configuration). |

A user rule has these keys:

| Key | Default | Meaning |
| --- | --- | --- |
| `id` | Required | A name for the rule, unique for each model that receives it, such as `team/commit-style`. |
| `file` | Required | The rule text. |
| `scopes` | `["*"]`, or the replaced rule's | The scopes the rule applies to, or `["*"]` for every scope. |
| `where` | All three places, or the replaced rule's | The places the rule applies to: `session` (someone is watching), `unattended` (nobody is watching), `subagent` (a subagent's task, delivered by the subagent hooks). |
| `triggers` | None, or the replaced rule's | Actions that also deliver the rule to a session whose scope is not one of the rule's scopes, once the session does one: `code-edit`. See [Triggers](#triggers). |
| `replaces` | None | The id of a preset rule of the model that this rule replaces. Only in `models.<id>.add` of a model declared with `"use": "preset"`. See [Replacing a preset rule](#replacing-a-preset-rule). |

## Model keys

A key is the full model identifier, as Claude Code reports it without suffixes: `claude-fable-5-2`, never `fable` or `claude-fable-5-2[1m]`.
When noonsight looks a model up, it first reduces the reported identifier to that form: it lowercases it and drops a `[1m]`-style suffix, a `#effort` suffix, a provider path such as `anthropic/`, an Amazon Bedrock prefix such as `global.anthropic.` and version suffix such as `-v1:0` or `-v1`, and a Google Vertex AI version suffix such as `@20261001`.

A key with `*` or `?` is a wildcard, and a wildcard only accepts `{ "use": "none" }`.
Rules always need the exact identifier, so a new model version never inherits rules written for an earlier one: `claude-fable-5-3` stays undeclared until someone declares it.

An exact key always wins over a wildcard.
Between wildcards, the one with more literal text wins, and a tie goes to the key that sorts first.

## Rules for every model

A rule that is not specific to a model, such as a team convention or the commit style, goes under `all_models.add` once, instead of under `add` of every model.
`all_models.add` takes the same rules as `models.<id>.add`, with the same keys (`id`, `file`, `scopes`, `where`, `triggers`), and a rule keeps its own scopes, places and triggers.

```json
{
  "version": 1,
  "all_models": {
    "add": [{ "id": "team/commit-style", "file": "rules/commit-style.md" }]
  },
  "models": {
    "claude-sonnet-5-5": { "use": "preset" },
    "claude-haiku-5-5": { "use": "custom", "add": [{ "id": "haiku/brief", "file": "rules/haiku-brief.md" }] },
    "claude-opus-5-5": { "use": "none" }
  }
}
```

The rules go to every model declared with `"use": "preset"` or `"use": "custom"`, in this order: the preset's rules, then the rules of `all_models.add`, then the model's own `add`.
A model declared with `"use": "none"`, by an exact key or a wildcard, receives none of them, and a model that is not declared stays undeclared: the block declares no model.

A rule id is unique for each model that receives it: an id in `all_models.add` cannot repeat in the block, be the id of one of that model's preset rules (on or off), or be the id of one of its own `add` rules.
A model declared `none` never receives the block, so an id in `all_models.add` may be the id of one of that model's preset rules.

The block counts for every model that receives it.
The limit on the delivered text (9,500 characters, see [Validation](#validation)) is checked for each model with the block's rules among its rules, so a block that fits beside one model's rules can still be refused because of another model's, and the problem names that model.
`noonsight models` lists the block and, under each model, its rules in delivery order with the block's marked `from all_models`; `noonsight check` says which models receive the block, and refuses a configuration whose block overflows a model.

### When `all_models` is worth it, and when a `CLAUDE.md` is enough

Claude Code loads a `CLAUDE.md` in every session for any model, so a rule written there reaches the context reliably, and so does one delivered by noonsight.
What noonsight adds is timing and proof.

- **Timing.** A rule can be limited by scope, by place (`session`, `unattended`, `subagent`) and by trigger, so a niche rule arrives when its situation happens instead of sitting in the context all the time beside everything else in a `CLAUDE.md`.
- **Subagents.** A subagent receives the rules of the model it will run on, chosen for its own task.
- **Proof.** The decision log and `noonsight report` show how often each rule was delivered, to which models, and which rules were never delivered ([hooks.md](hooks.md#the-decision-log)), which a `CLAUDE.md` cannot show.
- **A checked budget.** The limit on the delivered text is checked for each model with the block's rules among its rules ([Validation](#validation)).

Where it adds nothing: a fixed rule that every model should always have, with no scope, place or trigger, is the same as a line in a `CLAUDE.md`, and a `CLAUDE.md` is then the simpler home for it.
Triggers are also narrow today, since the only one is `code-edit`.

Whether delivering a rule at the right moment makes a model follow it more often is not measured, and nothing here claims it does.

## Replacing a preset rule

A user rule in `models.<id>.add` can replace one of that model's preset rules by naming it in `replaces`.
The preset rule is then off, and the user rule is delivered in its place: at its position among the preset's rules, and with its scopes, places and triggers, each unless the user rule gives its own.
Only the text changes, unless the rule says otherwise.

```json
{
  "version": 1,
  "models": {
    "claude-fable-5-2": {
      "use": "preset",
      "add": [{ "id": "team/finish-work", "file": "rules/finish-work.md", "replaces": "fable-5-2/finish-work" }]
    }
  }
}
```

`replaces` says what `disable` plus `add` could only imply: the two rules are one choice, so `noonsight models` lists them as a pair (the preset rule off, `replaced by` the user rule, which follows it), and a preset update keeps the pair together ([Preset updates](#preset-updates)).

- `replaces` names a preset rule the model has, by its id or by an id it had before a rename, so a rename never separates the pair; `noonsight check` then names the id to write.
- A preset rule is replaced by one rule at most, and a rule that is replaced is neither in `enable` nor in `disable`.
- The user rule keeps an id of its own, which is not the id of a preset rule, so the decision log and `noonsight report` tell the two apart.
- A rule that ships off can be replaced too: the user rule is delivered all the same.
- Triggers the user rule takes from the replaced rule are checked as its own; `"triggers": []` drops them.
- `replaces` is only for a model declared with `"use": "preset"`, since only those have preset rules, and not in `all_models.add`, since a preset rule belongs to one model.

## Project configuration

A repository can commit rules next to its code, so that the sessions of everyone who works in it receive them.
The file is `.noonsight/noonsight.json`, with its rule files, and it is laid over the machine's configuration for the sessions that run in that project.

```json
{
  "$schema": "https://unpkg.com/noonsight@0/schema/noonsight-project.schema.json",
  "version": 1,
  "all_models": { "add": [{ "id": "team/commit-style", "file": "rules/commit-style.md" }] },
  "models": {
    "claude-sonnet-5-5": { "add": [{ "id": "team/run-the-tests", "file": "rules/run-the-tests.md", "scopes": ["build"] }] }
  }
}
```

The schema in `schema/noonsight-project.schema.json` is the authority on its shape.
It takes the keys of the machine's configuration, except `preset`, `preset_version` and `on_preset_change`, which follow the noonsight installed on each machine, and `projects`, which only the machine decides; and a model entry may leave `use` out.
Paths inside it are relative to the file itself, as in the machine's file, so the rules of the example are in `.noonsight/rules/`.
Unlike the machine's file, a project's rule file must be a relative path that stays inside the project directory, the one that holds `.noonsight/`, once symlinks are followed; a project that names another file is refused.
A trusted project must not read other files of the account into the model's context, and a path outside the repository exists only on one person's machine, so it would break for everyone else.

### Which project a session is in

The project directory is `CLAUDE_PROJECT_DIR`, which Claude Code sets for its hooks, else the `cwd` of the hook input, as for the other project files noonsight reads.
`noonsight run`, `check`, `models`, `resolve` and `report` take `CLAUDE_PROJECT_DIR` too, else the directory they run in, so they show what a session started there receives.
noonsight looks for `.noonsight/noonsight.json` in that directory and in each directory above it up to the repository root, the directory that holds `.git`, and the closest file wins, so a package of a repository can have its own.
Outside a git repository, only the directory itself counts, and a file above the repository root is never read.
The machine's configuration file is never also read as a project's.

### Trust

A cloned repository changes nothing a session receives until this account trusts it.

```text
noonsight trust [<dir>]
noonsight untrust [<dir>]
```

`noonsight trust` records the project found from `<dir>`, the current directory by default, as trusted, then prints what the project applies, or why it does not.
Trust is kept for the project directory, by its real path, and for the account, in `~/.local/state/noonsight/projects.json`, like the folder trust Claude Code asks for: once a project is trusted, later changes to its files, such as those a pull brings, apply without asking again.
A second clone or a worktree at another path is a project of its own.

An untrusted project is left out, and each new session in it starts with a warning that names `noonsight trust`.
`noonsight untrust` declines the project: it stays out, with no warning, until `noonsight trust`.
Both exit 0, 1 when no project configuration is found from `<dir>` or the decision cannot be written, and 2 for a usage error.

### How far a project may go

The machine's configuration decides how far a project may change it, with `projects.allow`:

| `projects.allow` | A project may |
| --- | --- |
| `none` | Nothing: project files are ignored, with no warning |
| `add` (default) | Add rules, under `all_models.add` and `models.<id>.add`, for the models the machine declares with `"use": "preset"` or `"use": "custom"`; nothing the machine declares changes |
| `rules` | Also change which rules a model receives: `use`, `enable`, `disable`, `replaces`, wildcard keys, and a rule with the id of one of the machine's rules, which replaces it; and set `scopes`, `session` and `on_undeclared` |
| `all` | Also set `routing`, `classifier` and `subagents` |

The default lets a trusted project add its rules and nothing else: it never removes or replaces one of the person's rules, never declares a model the person did not, never changes the model a task runs on, never turns the classifier on or changes its settings, and never answers a permission prompt.
A project rule written for a list of scopes can still make the person's classifier run, when it is on, for a task it would otherwise skip ([The classifier](#the-classifier)): the scope then changes what the model receives.
`rules` still keeps `routing`, `classifier` and `subagents` out, since they act beyond the text a model receives.
Its scopes and model declarations can still change what those settings do when the person's routing is on: a scope's matchers decide which routing row a task takes, and whether the classifier is asked, and a model the project declares can make a routing option apply that did not.
A project that writes a key its level does not allow is refused, and the problem names the level the key needs.

### How the two files merge

Every value a project writes replaces the machine's, key by key, with these exceptions:

- **Rule lists add up.**
  A model receives the preset's rules, then `all_models.add`, the machine's then the project's, then its own `add`, the machine's then the project's.
  Under `add`, a project rule id must be new for each model that receives it, as any rule id; above `add`, a project rule with the id of one of the machine's rules in the same list replaces it in its place.
- **A replaced preset rule stays replaced.**
  A project rule with `replaces` needs `rules`, since it turns a preset rule off; under `add`, it is refused.
  A project rule that takes the place of a machine rule with `replaces` takes its `replaces` too, unless it names its own, so the preset rule the person turned off stays off.
  A project rule that replaces the preset rule a machine rule of the same model replaces takes that machine rule's place, the project's choice winning, as for `enable` and `disable`.
  The project's choice also wins where its `replaces`, `enable` or `disable` meets the machine's, an id a preset rule had before a rename naming the same rule as its current id:
  a project `enable` of a preset rule the machine replaced brings that rule back, and the machine's rule that replaced it is delivered as one of the model's own;
  a project `disable` of a preset rule the machine replaced changes nothing, since the rule is already off;
  and a project rule that replaces a preset rule drops the machine's `enable` or `disable` of it.
- **A model entry merges when it keeps the machine's `use`.**
  An entry without `use`, or with the machine's, is merged into the machine's entry: `enable` and `disable` by rule id, the project's choice winning, and `add` as above.
  An entry with another `use` replaces the machine's entry, so the machine's `enable`, `disable` and `add` for that model no longer apply in the project.
  An entry without `use` for a model the machine does not declare with its exact key, or declares with `"use": "none"`, does not apply: the person decides which models get rules, and `noonsight check` notes the entry.
- **A scope keeps its place** and takes only the keys the project gives, as a user scope over a preset scope; a new scope comes after the machine's.
- **Settings merge key by key.**
  `session`, `subagents`, `classifier` and `routing` take each key the project gives, and a routing row replaces the machine's row for the same scope.

### A project with a problem

The merged configuration is checked as any configuration is, the limit on the delivered text included.
A project with any problem, alone or once merged, is refused alone: sessions in it receive the machine's configuration as if there were no project, and each new session starts with a warning that says so.
A problem in the machine's configuration still refuses everything, whatever the project.

`noonsight check` and `noonsight models` show the project found from the directory they run for and what became of it, and mark the project's rules (`project` in `--json`, `from the project` in the listing).
The rules they list for an applied project are those the merged configuration gives at least one model, so a project rule for a model the machine leaves out is not listed, only noted.
`noonsight report` shows the same line for the project, and its rule lengths and the rules never delivered are those of the configuration with that project laid over it, while its counts come from the decision log, which holds the sessions of every project ([hooks.md](hooks.md#the-decision-log)).
The decision log records the project directory as `project` and what became of it as `project_status`: `applied`, `untrusted`, `declined`, `ignored` or `refused` ([hooks.md](hooks.md#the-decision-log)).


## Preset updates

The preset follows the installed package, so an update of noonsight can change the rules sessions receive: a new rule that ships on, a rule that ships on or off now, a changed text, a renamed or removed rule.
`preset_version` records the version the configuration was last checked against, and noonsight compares the installed version with it, model by model, for every model declared with `"use": "preset"`:

| Change | What it means |
| --- | --- |
| Now on | A new rule that ships on, or a rule that ships on now, and that no `disable` turns off |
| Now off | A rule the model received that the update removed, or that ships off now |
| Renamed | A rule whose id changed; an `enable` or `disable` entry with the old id still applies to it |
| Changed | A rule on before and after whose text, scopes, places or triggers changed |
| Changed in a replaced rule | A replaced rule whose scopes, places or triggers changed, which the user rule that replaces it takes because it does not give its own |
| New and off | A new rule that ships off, which `enable` turns on |
| Entries | An `enable`, `disable` or `replaces` entry that names a rule by its old id, or a rule the preset no longer has, so that choice no longer applies |

The package keeps a copy of every earlier released version of its preset, from 1.3.0 on, in `presets/<preset>/versions/`, checked as the installed one is, so the comparison is exact.
A preset rule lists the ids it had before in `renamed_from`, so a rename is reported as a rename, and not as a removed rule and a new one.

What an installed version that is not `preset_version` does depends on `on_preset_change`:

- `warn` (the default): sessions receive the installed version's rules.
  An `enable` or `disable` entry that names a rule the accepted version had and the installed one dropped is left out and reported, not refused, so the configuration keeps working.
  A user rule whose `replaces` names such a rule is still delivered, after the rules of `all_models`, with the scopes, places and triggers it took from the rule as the accepted version had it, and the report asks to remove `replaces`.
  `noonsight check` lists the changes, and a new session whose model's rules changed starts with a warning that names them ([hooks.md](hooks.md#sessionstart)).
- `hold`: sessions keep receiving the rules, scopes and routing table of `preset_version`, from the copy the package keeps, so the update changes nothing they receive.
  `noonsight check`, `noonsight models` and the session-start warning say that the preset is held and what accepting the installed version would change.
  `hold` needs a `preset_version`, and a version the package keeps: a configuration that holds a version the package does not keep is refused, and `noonsight accept` takes the installed one.

`noonsight accept` records the installed version in `preset_version` once the changes are reviewed ([`noonsight accept`](#noonsight-accept)).
A configuration without `preset_version` delivers the installed version's rules, as under `warn`, with nothing to compare them against, so `noonsight check` warns until it records one.

## Scopes

A scope names a kind of task, such as `investigate` or `summarize`.
A rule names the scopes it applies to (`"scopes": ["investigate"]`), or every scope (`["*"]`, the default).
A decision has at most one scope, and where it comes from depends on who reads the rules:

| Reader | Scope | Place |
| --- | --- | --- |
| A session | `NOONSIGHT_SCOPE` in the environment Claude Code starts with, when whoever starts the session sets it, as `noonsight run` does with the scope it finds ([launcher.md](launcher.md#what-it-adds)); else none. Rules that list a trigger the session revealed apply too ([Triggers](#triggers)) | `unattended` when a variable of `session.unattended_when_env` is set and not empty, or when the session runs headless (`claude -p`, the Agent SDK) and `session.headless_is_unattended` is `true`, as it is by default; else `session` |
| A subagent | The scope whose matcher matches earliest in its description and task text; else, with the classifier on, the scope the classifier gives ([The classifier](#the-classifier)); else none | Always `subagent` |

A subagent's scope comes from its own task and is never taken from the session.
A session that investigates can start a subagent that summarizes, and each gets the rules of its own scope.

Matchers are JavaScript regular expressions, compiled case-insensitive and Unicode-aware (flags `iu`).
They read the subagent's `description`, then its `prompt`, joined, up to the first 100,000 characters.
The bound keeps the text a matcher reads inside the hook, which runs before every agent call, limited, so a longer task is cut there, and the decision log records `task_text_cut` for it.
A length bound alone does not keep matching fast: a matcher whose time grows much faster than the text can still hold an agent call on a long task, so such matchers are refused (see [Matchers that backtrack](#matchers-that-backtrack)).
Any noonsight rules a parent copied into the task are left out, so the rules' own words never pick the scope.
When several scopes match, the one whose matcher matches earliest in the text wins, and two that match at the same place go to the scope declared first: the preset's scopes in the preset's order, then the user's new ones in the file's order.
The check tries each matcher against six probe texts: `"a"`, `"Z"`, `"0"`, `" a "`, `"A B"` and `"x_1 y"`, which are plain task texts.
A matcher that matches all six is refused as a catch-all (such as `.`, `\b` or `\w`).
A matcher that misses any of them is accepted, however broad it is.
A scope that is not declared, such as a `NOONSIGHT_SCOPE` with a typing error, only means "rules for every scope"; it never blocks and never warns in a session, and the decision log records it as `unknown_scope`.

`noonsight check` reports two scopes whose matchers match the same text, as a warning with an example text that both match and the scope a task with that text gets.
To find such texts, noonsight builds short example texts from each matcher and runs the other scopes' matchers over them, so every overlap it reports comes with a text that really matches both.
Two scopes can still overlap on a text the examples do not reach, so "no two scopes overlap" means no overlap was found.
A matcher whose examples are incomplete, such as one with a back reference, or one with more texts than noonsight keeps, is named on the scopes line, which then does not claim that no two scopes overlap.

### Matchers that backtrack

When a regular expression can match the same stretch of text in many ways, the engine tries them all before it gives up, and the time it takes can grow with the square of the text length, or faster.
noonsight refuses a matcher with one of these three shapes, naming the scope, the pattern and the shape:

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

## Triggers

A session nobody gave a scope still shows its kind of task by what it does.
A trigger names such an action; a rule that lists it is delivered to a session once the session does it, whatever the session's scope, besides the scopes the rule lists.
Nothing is delivered on an action unless a rule declares the trigger.

```json
{
  "models": {
    "claude-sonnet-5-5": {
      "use": "custom",
      "add": [{ "id": "team/run-the-tests", "file": "rules/run-the-tests.md", "scopes": ["build", "routine"], "triggers": ["code-edit"] }]
    }
  }
}
```

| Trigger | What reveals it |
| --- | --- |
| `code-edit` | The session edits, with Edit or Write, a file with a code extension that the git repository of the session's project, or of one of its worktrees, already tracks ([hooks.md](hooks.md#posttooluse-on-edit-and-write-the-triggers) lists the extensions and what each condition keeps out) |

A trigger guesses the kind of task from one action, and the guess can be wrong: a code edit shows that the session changes code, not whether it is building, fixing what an investigation found, or doing a routine change.
So give a trigger only to a rule that is cheap when the guess is wrong, such as a rule whose advice applies only once code has changed: a session that edits no code never receives it, and one that does needs it whatever its task.
A rule with a measured cost or a side effect needs a named scope.
[presets/claude/SOURCES.md](../presets/claude/SOURCES.md#rules-delivered-on-an-action) applies this to the preset, whose two verify rules, `sonnet-5-5/verify-changes` and `haiku-5-5/verify-changes`, list `code-edit`.

- A session's triggers only grow: once revealed, a trigger holds for the rest of the session, after compaction, a resume and a `/model` switch, and the rules it brought stay in the conversation.
  Only the rules a trigger adds are delivered, once.
- Triggers act only in a session (the places `session` and `unattended`); a subagent's scope comes from its own task, and the edits a subagent makes reveal nothing.
- The decision log names the trigger behind every rule it brought (`triggered_rules`), and the edit that revealed it, and `noonsight report` counts them, so a trigger that fires on the wrong edits shows there ([hooks.md](hooks.md#the-decision-log)).

A rule takes part in a trigger only by listing it in its own `triggers`: a user rule without `triggers` reaches a session only by its scopes, and `disable` keeps a preset rule that lists one out of every session.
`noonsight check` names, for each trigger, the rules it delivers to which model.

## The classifier

The classifier is a small model that places a task in one of the declared scopes when nothing explicit did.
It is off unless `classifier.mode` turns it on, and with it off, noonsight decides every scope as it would without the key.

```json
{
  "classifier": { "mode": "fallback", "model": "haiku", "effort": "low", "timeout_ms": 8000 }
}
```

| Mode | The tasks it places |
| --- | --- |
| `off` (default) | None: a scope comes only from `NOONSIGHT_SCOPE`, `noonsight run --scope` and the matchers |
| `fallback` | A task that no explicit scope and no matcher placed, so the matchers a user declares still decide first |
| `always` | Every task without an explicit scope, over the matchers; the decision log keeps the matcher's scope as `matcher_scope`, so the two can be compared |

An explicit scope, from `NOONSIGHT_SCOPE` or `noonsight run --scope`, is never replaced.

### Where it acts

- **The agent call hook**, for a subagent: it reads the call's `description` and `prompt`, the same text the matchers read ([hooks.md](hooks.md#pretooluse-the-prediction)).
- **`noonsight run`**, for a session: it reads `--task`, or the prompt right after `-p`, and passes the scope to the session as `NOONSIGHT_SCOPE` ([launcher.md](launcher.md#what-it-adds)).

A session started without `noonsight run` has no task text when it starts, so its scope still comes from `NOONSIGHT_SCOPE` alone.

The classifier is asked only when the scope can change something for the task: the model the task runs on receives, in that place, a rule written for a list of scopes, or routing would read the scope (it is on for the target, does not yield, and no model the caller chose holds the call).
For `noonsight run` with no model it can read before the session starts, the classifier is asked, since the session learns its model only once it starts.
Otherwise the task does not wait for it, and the decision log records `classifier: "not-needed"`.

### What it is asked

Each classification is one `claude -p` call on `classifier.model` at `classifier.effort`, through the login Claude Code already has: noonsight reads no credential and stores none.
The instructions list every declared scope with its `description` (its name, for a scope without one) and the answer `none`, for a request that fits no scope.
The answer must be a JSON object whose `scope` is one of those words, and Claude Code holds the model to that shape (`--json-schema`).
The task text is the first 4,000 characters of what the matchers read, without any noonsight rules a parent copied into it.
So a scope's description is what the classifier goes by: a scope of your own needs a description that tells it apart from the others.

### When it gives no scope

| `classifier` in the log | What happened | The task |
| --- | --- | --- |
| `scoped` | It answered a declared scope | Gets that scope |
| `none` | It answered that no scope fits | No scope, no warning |
| `timeout` | No answer within `classifier.timeout_ms`; the call is stopped | No scope, and the person is warned |
| `failed` | The call failed, for example with `claude` missing from `PATH`, a lost login or an API error | No scope, and the person is warned |
| `invalid` | It answered something other than a declared scope | No scope, and the person is warned |

A task with no scope gets the rules for every scope and, with routing on, `routing.default`, as it would with the classifier off.
`classifier_error` records why, and `classifier_ms` how long the call took.

`classifier.timeout_ms` is at most 8,000: Claude Code stops a hook after 10 seconds, and the agent call hook must still answer, with the rules, after a classification it had to give up on.

### Its own session

The classifier's session is kept apart from the session that asked:

- It runs with `NOONSIGHT_DISABLE=1`, so noonsight's hooks, installed for the account or machine-wide, do nothing in it and never start a classifier of their own.
- `--safe-mode` leaves out the person's hooks, plugins, MCP servers and `CLAUDE.md`; `--tools ""` leaves it no tool, so it cannot start a subagent; `--no-session-persistence` keeps it out of the session history.
- `CLAUDE_CODE_EFFORT_LEVEL` is left out of its environment, since that variable would win over `classifier.effort`.

It runs the `claude` found on `PATH`, as Claude Code's hooks see it.

### What it costs

Each classification takes a few seconds and a small charge on the person's usage, which the decision log records as `classifier_ms` and `classifier_cost_usd`.
In the agent call hook, the subagent waits for it before it starts, so turning the classifier on adds that wait to every agent call it places.

### How well it agrees

`test/fixtures/classifier/tasks.json` holds 45 task texts, each labeled by hand with one of the `claude` preset's five scopes or `none`, by the rule written in `test/fixtures/classifier/README.md`.
On 2026-11-16, with Claude Code 2.1.325 and the classifier's defaults (Haiku 5.5 at low effort), the live test `classifier-agreement` ran over all 45 twice, and the classifier agreed with the hand label on 44 of them in the first run and on 43 in the second.
No classification failed or ran out of time in either run.

| Label | Tasks | Agreed, run 1 | Agreed, run 2 |
| --- | --- | --- | --- |
| `investigate` | 9 | 9 | 9 |
| `build` | 9 | 9 | 8 |
| `review` | 8 | 8 | 8 |
| `routine` | 9 | 9 | 8 |
| `digest` | 7 | 7 | 7 |
| `none` | 3 | 2 | 3 |

The disagreements: a request for a short poem, labeled `none`, placed in `digest` (run 1); a race condition to fix whose cause is not yet clear, labeled `build`, placed in `investigate` (run 2); and a `--json` flag whose output format is already specified, labeled `routine`, placed in `build` (run 2).
The answers vary from run to run, so the agreement is a measure of these tasks on that day, not a guarantee; `NOONSIGHT_LIVE_LOGIN=1 npm run test:live` measures it again.
The two runs' answers were not committed, so these counts are not in the [evidence map](evidence.md), and the README does not cite them.

### With the `claude` preset

The preset's scopes declare no matchers ([SOURCES.md](../presets/claude/SOURCES.md#detecting-a-scope)), so with the classifier off, a preset rule written for a list of scopes reaches only a task whose scope comes from `NOONSIGHT_SCOPE` or `noonsight run --scope`.
With `fallback`, those rules start to reach the tasks the classifier places, subagents included, with no change to the preset: a Fable 5.2 subagent whose task it places in `investigate` or `build` receives `fable-5-2/finish-work`, for example.
A task it cannot place still receives the rules for every scope.

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
| `launcher` | `noonsight run` adds `--model` and `--effort` to the claude command line, ahead of the other arguments ([launcher.md](launcher.md#routing)) |
| `subagents` | The agent call hook sets the call's `model` and `effort` parameters before the subagent starts ([hooks.md](hooks.md#routing)) |

No hook changes the model of a session that is already running.
A session started without `noonsight run` keeps the model it was started with, and `/model` works as always.

### From the scope to the model

1. The task's scope is decided as without routing: `NOONSIGHT_SCOPE` for a session, which `noonsight run` can also take from the task text ([launcher.md](launcher.md#routing)); the matchers over its own task for a subagent.
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
| `NOONSIGHT_ROUTING=off` in the environment Claude Code or `noonsight run` starts with (also `0`, `false`, `no`) | `yielded` | `routing-env` |
| A variable of `routing.yield_when_env` is set and not empty | `yielded` | `yield-env`, with the variable in `routing_env` |
| The call names its model, under `respect_explicit`: `--model` on the claude command line, or the `model` parameter of an agent call | `yielded` | `explicit-model` |
| The subagent's definition sets `model`, under `respect_explicit` | `yielded` | `definition-model` |
| A built-in subagent with its own model rule (Explore, Plan, `statusline-setup`, `claude-code-guide`, `web-fetch`), under `respect_explicit` | `yielded` | `built-in-model` |
| A plugin's subagent, whose definition noonsight does not read, under `respect_explicit` | `yielded` | `plugin-definition` |
| A fork, which always runs on its parent's model | `yielded` | `fork` |
| `CLAUDE_CODE_SUBAGENT_MODEL_FORCE`, under which Claude Code ignores the call's model | `yielded` | `model-forced` |
| No scope, or no row and `default` is `inherit` | `inherit` | `no-scope`, `no-row` |
| The row lists no option for the target | `inherit` | `empty-row` |
| No option's model is declared | `inherit` | `no-declared-option` |

An effort the caller set (`--effort`, the call's `effort`, or a definition's `effort`) is kept under `respect_explicit`; only the model is routed, and the log records `route_effort_kept`.
With `respect_explicit` set to `false`, the table replaces the caller's model and effort, but never a fork's model or a forced one.
When `CLAUDE_CODE_EFFORT_LEVEL` is set, Claude Code uses it over any effort noonsight sets, and the log records `route_effort_overridden_by`.

### With an orchestrator

An orchestrator that starts `claude --model <model> --effort <effort>` itself never goes through `noonsight run`, and its subagents' calls name their model, so routing does not contradict it.
For an orchestrator whose sessions still start subagents without a model, put one of its own environment variables in `yield_when_env`, or have it set `NOONSIGHT_ROUTING=off`: its sessions and their subagents are then never routed, and they still receive the rules.

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

The rules that remain are joined in order (the preset's first, each replaced one by the user rule that replaces it, then those of `all_models`, then the model's own, with a project's rules after the machine's in each list) and hashed.
The joined text is then wrapped in a short envelope that says where it came from; the hash covers the rules only, not the envelope.
The same configuration and the same request always give the same text and the same hash.

## Validation

A configuration with any problem is refused whole, and nothing from it is applied.
A project's configuration is checked merged with the machine's, and a problem it brings refuses only the project ([A project with a problem](#a-project-with-a-problem)).
Problems are reported with their location in the file, in three passes.
Schema problems (unknown keys, wrong types or values) are reported together first.
Once the file matches the schema, problems with the preset (missing, or failing its own checks) are reported together.
Once the preset loads, every remaining problem is reported together.
Beyond the schema, noonsight checks that:

- every model key is already in bare form;
- every rule file exists and is not empty;
- rule ids are unique for each model, counting the preset's rules, the rules of `all_models` and the model's own;
- every scope a rule names is declared;
- a rule that lists a trigger is not for every scope (`["*"]`, where a trigger adds nothing), and is for the place `session` or `unattended`, where triggers act;
- every matcher is a valid regular expression, does not match all six probe texts listed under [Scopes](#scopes), and has none of the shapes listed under [Matchers that backtrack](#matchers-that-backtrack);
- `enable`, `disable` and every `replaces` name rules the preset has for that model, by their id or by an id they had before a rename, and never the same rule twice; under `"on_preset_change": "warn"`, an entry that names a rule the version in `preset_version` had and the installed version dropped is left out and reported instead ([Preset updates](#preset-updates));
- `replaces` appears only in `add` of a model declared with `"use": "preset"` ([Replacing a preset rule](#replacing-a-preset-rule));
- the preset is installed and has rules for every model declared with `use: "preset"`;
- `"on_preset_change": "hold"` comes with a `preset_version` that is the installed version or one the package keeps;
- every scope in `routing.table` is declared, and every model a routing option names is an alias or a model declared with its exact key;
- a routing row written as an object lists at least one target;
- the delivered text fits in 9,500 characters for every model and every combination of scope and place, with the rules of `all_models` among the model's rules and with and without the triggers revealed, so that with the note sent when the session's model changes it stays within the 10,000 characters Claude Code accepts from a hook ([hooks.md](hooks.md)).

The preset is checked the same way, and more strictly:

- every preset rule names its source (the page, the section and the date it was read), the effect the source reports and its cost, and every preset scope names its source;
- every row of the preset's routing table names a scope of the preset, models by alias only, and what it rests on with its sources;
- every preset rule fits the limit on its own, and a model's preset rules fit it together with every rule on, for every combination of scope and place, since the user decides which of them are on;
- an id in a rule's `renamed_from` is not the id of a rule of that model in the same version, and no two rules list the same one;
- every kept copy of an earlier version is checked in the same way when it is read, and must be the version its directory names.

The installed preset is read whenever it is there, even when no model uses it, because its scopes are always declared; a preset that fails these checks refuses every configuration until it is fixed.

## `noonsight models`

```text
noonsight models [--json]
```

Lists, for each declared model, how it is declared and the rules it receives.
For `"use": "preset"` that is every preset rule of the model, on or off, with its scopes, places, source, effect and cost; a replaced rule is marked `replaced by` the user rule that replaces it, which follows it, marked `replaces` (`replaced_by` and `replaces` in `--json`); the rules of `all_models` and the user's other rules follow, with their files; a section at the top lists the rules of `all_models` once.
It also lists the preset's models that are not declared, and the models the decision log ([hooks.md](hooks.md#the-decision-log)) has seen that are not declared, which get a warning and no rules.
A wildcard key lists the models from the log that it covers.
A project configuration found from the current directory applies as it would to a session started there, and the listing starts with what became of it and marks the project's rules ([Project configuration](#project-configuration)).
`--json` prints the same as one JSON object.
The command reads only local files.

## `noonsight accept`

```text
noonsight accept
```

Accepts the installed preset version: lists what it changes since `preset_version`, model by model, as `noonsight check` does, then writes the installed version to `preset_version`.
Only that value of the file changes; a file without the key gets it after `preset` (or `version`), with the indentation of that line, and a symbolic link to the file stays a link.
The configuration must load with the installed version, so an `enable`, `disable` or `replaces` entry that names a rule the installed preset no longer has must be removed first; until then nothing is written.
An entry that names a rule by its old id still loads, and `noonsight check` names the id to write.
It exits 0 when the version was written or already was the installed one, 1 when the file cannot be written, and 2 when the configuration is refused or the preset is not installed.

## `noonsight resolve`

```text
noonsight resolve <model> [scope] [session|unattended|subagent]
```

Prints the decision as JSON, with the project configuration found from the current directory laid over the machine's, as for a session started there.
The place defaults to `session`.
An empty scope (`""`) means no scope, so a place can be given without one, as in `noonsight resolve claude-sonnet-5-5 "" subagent`.

| `status` | Meaning | Other fields |
| --- | --- | --- |
| `matched` | The model receives rules. | `key`, `rules`, `sha256`, `text` (the exact text that would be delivered) |
| `none` | The model receives nothing. | `key`, `reason`: `declared-none` or `no-rule-applies` |
| `undeclared` | The model has no entry. | `reason`: `no-entry` or `model-not-reported`; `warning` unless `on_undeclared` is `ignore` |

Every decision also has `model`, `scope` and `place`, plus `unknown_scope` when the requested scope is not declared.
The command exits with 0 for every decision, and with 2 for a usage error or a refused configuration.
It reads only local files and never uses the network.
