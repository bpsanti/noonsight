# The hooks

noonsight gives each Claude Code session, and each subagent it starts, the rules for the model it actually runs on.
Five hooks do it: `SessionStart`, when a session starts, and `PostModelSwitch`, when the session's model changes; `PreToolUse` on the agent tool, before a subagent starts, `SubagentStart`, as it starts, and `PostToolUse` on the agent tool, once Claude Code reports the model the subagent started on.
[install.md](install.md) covers putting them in place; this page is the contract they keep.

## Rules every hook follows

- **It never holds the session, or a subagent call, beyond a bound.**
  It always exits 0, reads only local files and never uses the network itself.
  It starts no other process, with two exceptions: on macOS, when nothing else names the session's model, or when `noonsight run` started the session, it runs `ps` once to read the Claude Code command line (see [SessionStart](#sessionstart)); and with `classifier.mode` on, the agent call hook may start the classifier, one `claude -p` call that reaches the model with the person's login ([The classifier](configuration.md#the-classifier)).
  Each entry has a 10-second `timeout`; the hook itself takes a fraction of a second, and a classification at most `classifier.timeout_ms` more, which is held to 8 seconds so the hook still answers in time.
  A subagent's start waits at most two seconds more when several calls could have started it ([SubagentStart](#subagentstart-the-rules)).
- **It never blocks anything.**
  An undeclared model, or a subagent whose model noonsight cannot tell, gets a warning, never a refusal; noonsight never denies a call.
- **A configuration with any problem is refused whole.**
  The hook delivers nothing, warns the person, and logs `config-invalid`; `noonsight check` lists the problems.
  The result of an agent call under a refused configuration is logged as `config-invalid` too, without a second warning, and its subagent's start does nothing.
- **It decides from what Claude Code itself uses.**
  The model comes from the hook input Claude Code sends, from noonsight's own record of the same session or of the same Claude Code process, or from the same launch settings Claude Code chose the model from, in Claude Code's own order.
  The decision log names the source every time.
- **It leaves foreign input alone.**
  Input that is not the expected Claude Code event, such as another tool reading the same settings, gets no output and no log line.

## What the hooks print

Nothing, or one JSON object with up to two fields:

| Field | Reader | Content |
| --- | --- | --- |
| `hookSpecificOutput.additionalContext` | Claude, as a system reminder | The session hooks: the rules, and on a model change, the note below. `SubagentStart`: the subagent's rules, at the start of its conversation |
| `hookSpecificOutput.updatedInput`, `permissionDecision` | Claude Code | `PreToolUse`, only for a call routing changed: the agent call with its new `model` and `effort`, and the permission decision the configuration asks for (see [Routing](#routing)) |
| `systemMessage` | The person, on screen | A warning: undeclared model, refused configuration, a subagent that started on another model than predicted, or a failed hook |

The rules arrive wrapped in a short envelope that says where they came from, written as facts, as Claude Code's documentation asks for hook context:

```text
<noonsight-rules model="claude-sonnet-5-5">
Working rules the user declared for claude-sonnet-5-5 (delivered by noonsight, rules team/commit-style):
...the rules...
</noonsight-rules>
```

## SessionStart

The hook decides by how the session started (the `source` field):

| Start | What noonsight does | Why |
| --- | --- | --- |
| `startup` | Delivers the rules | A new session |
| `clear`, `compact` | Delivers them again | The earlier context, and the rules in it, are gone |
| `resume`, `fork` | Delivers only when the model or the rules changed since this session's record | The restored conversation already holds them |
| Anything else | Delivers | Delivering twice costs little; a missed delivery is the defect noonsight exists to prevent |

The model comes from the first of these that knows it:

1. The `model` field of the input.
   Claude Code can leave it out ([SessionStart input](https://code.claude.com/docs/en/hooks#sessionstart-input)): after `/clear` the new session has a new id and no `model`, and in non-interactive mode (`claude -p`) no start carries one.
2. noonsight's record of the same session, or, for `/clear` and compaction only, its record of the same Claude Code process: the hook's parent process, which is the `claude` process running the session.
3. What the session was started with, read the way Claude Code reads it ([Setting your model](https://code.claude.com/docs/en/model-config#setting-your-model)), so that `claude -p` sessions get their rules:
   1. the `--model` argument of the Claude Code process;
   2. `ANTHROPIC_MODEL` in the hook's environment, which Claude Code passes to hooks with its settings' `env` applied ([Hook input and output](https://code.claude.com/docs/en/hooks#hook-input-and-output));
   3. the `model` setting of the highest-ranked settings file that sets one: the server-managed settings cached for the login, else the managed settings files; then `--settings`; then the project's `.claude/settings.local.json` and `.claude/settings.json`; then the user's `settings.json` in `CLAUDE_CONFIG_DIR` or `~/.claude`, with `--setting-sources` honored.

   The first of the three that names a model decides, as in Claude Code; a lower one is never consulted past it.

Only when none of them names a model does the session get no rules and a warning.

Reading the launch settings has limits, and the hook prefers saying so to guessing:

- **Aliases.**
  An alias such as `sonnet` follows `ANTHROPIC_DEFAULT_SONNET_MODEL` (and the matching variable for `opus`, `haiku` and `fable`) when it is set.
  Otherwise noonsight uses what the alias selects on the Anthropic API, as Claude Code's documentation lists it from version 2.1.321 on ([Model aliases](https://code.claude.com/docs/en/model-config#model-aliases)); `noonsight check` warns about an older `claude`.
  On another provider (`CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_VERTEX`, `CLAUDE_CODE_USE_FOUNDRY` and the like) an alias selects other models, so without the pinning variable the hook warns instead.
- **Models chosen while the session runs.**
  `default` and `opusplan` depend on the account, the organization or plan mode; the hook warns that it cannot tell which model they select.
- **The command line on macOS.**
  Linux keeps each argument of the Claude Code process apart (`/proc/<pid>/cmdline`); macOS gives them joined by spaces (`ps`).
  There, a prompt that holds the text `--model x` cannot be told from the option.
  A single `--model` value that names a model (an identifier containing `claude`, or an alias) counts; any other value, such as a custom model identifier behind a gateway or a word from the prompt, and two different values, are reported with a warning instead of letting `ANTHROPIC_MODEL` or a settings file decide.
  The same holds for `--settings` and `--setting-sources`: two different values warn, and so do an inline `--settings` JSON value that holds a space and a `--setting-sources` value that is not a comma-separated list of `user`, `project` and `local`, since neither can be read.
- **MDM profiles.**
  A `model` set only in an MDM profile is not read.

The session's task scope is the value of `NOONSIGHT_SCOPE` in the environment Claude Code runs in, which its hooks inherit, so whoever starts the session (a person, a script, an orchestrator) can name it; without it, the session receives only the rules for every scope.
Its place is `unattended` when a variable listed in `session.unattended_when_env` is set and not empty, and `session` otherwise ([Scopes](configuration.md#scopes)).
A resumed session gets the rules again when a change of scope or place changed which rules apply.

A session started by `noonsight run` already holds its rules in the system prompt.
At `startup`, `clear` and `compact`, when the Claude Code process was started with the launcher's file and the file holds exactly the rules decided here, the hook delivers nothing and logs `delivered: "launcher"`.
When the launcher's rules are for another model, the hook delivers this model's rules with a note that the others do not apply.
[launcher.md](launcher.md#with-the-hooks) has the details.

## PostModelSwitch

The hook delivers the new model's rules with the next request.
The rules delivered earlier stay in the conversation, so when the previous model had received rules, the delivery starts with a note:

```text
<noonsight-rules-change from="claude-sonnet-5-5" to="claude-opus-5-5">
The session's model changed from claude-sonnet-5-5 to claude-opus-5-5. The working rules noonsight delivered earlier in this conversation for claude-sonnet-5-5 no longer apply.
</noonsight-rules-change>
```

A switch keeps the session's scope and place.
A switch to a model with no rules delivers the note alone.
Resuming a session restores its model and reports it as a switch; when the session's record shows the same model and rules, nothing is delivered again.
The configuration keeps room for the note: the rules for any model, scope and place must fit in 9,500 characters, so rules and note together stay within the 10,000 characters Claude Code accepts from a hook.

## Subagents

A subagent does not see the session's conversation, so the rules delivered to the session never reach it ([What loads at startup](https://code.claude.com/docs/en/sub-agents)).
And it can run on another model than the session.
So before a subagent starts, noonsight predicts the model it will run on; as it starts, noonsight gives it that model's rules; after it starts, noonsight checks that it started on that model.

The rules reach the subagent through `SubagentStart`, never through a change to the agent call.
In auto mode, Claude Code's classifier reviews the calls of a response as Claude wrote them, and when a hook changes one of them it gives no verdict for the others, which are then refused until Claude makes them again in a response of their own ([PreToolUse `updatedInput` in auto mode](https://code.claude.com/docs/en/hooks)).
A call noonsight only gives rules to is left exactly as Claude wrote it.

`PreToolUse` and `PostToolUse` run only for the agent tool: the entries match `Agent|Task`, its current and earlier names, and the hook checks the tool name again, so a widened matcher reaches no other tool.
They also run for calls made inside a subagent, since Claude Code runs settings hooks there too; the input then carries the subagent's `agent_id`.
`SubagentStart` runs for every subagent type.

### PreToolUse: the prediction

1. noonsight predicts the model the subagent will run on, in Claude Code's own order ([Choose a model](https://code.claude.com/docs/en/sub-agents#choose-a-model)):

   | Order | Source | `model_source` |
   | --- | --- | --- |
   | 1 | A fork runs on its parent's model | `fork` |
   | 2 | With `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` set: `CLAUDE_CODE_SUBAGENT_MODEL`, else the parent's model (Explore keeps its own rule) | `forced` |
   | 3 | The `model` parameter of the call | `parameter` |
   | 4 | The `model` field of the subagent's definition | `definition` |
   | 5 | A built-in subagent's own model (below) | `built-in` |
   | 6 | `CLAUDE_CODE_SUBAGENT_MODEL` | `env` |
   | 7 | The parent's model | `parent` |

   `inherit` means the parent's model.
   A family alias (`opus`, `sonnet`, `haiku`, `fable`) means the parent's own model when the parent is of that family, as in Claude Code ([Which version a model alias selects](https://code.claude.com/docs/en/sub-agents)); otherwise an alias resolves as for the session (see [SessionStart](#sessionstart)).
   Definitions are read from every `.claude/agents/` from the project directory (`CLAUDE_PROJECT_DIR`, else the input's `cwd`) up to the repository root, the closest first, then from `agents/` in the Claude Code configuration directory; both are scanned recursively, and a subagent is known by the `name` in its frontmatter.
   A definition of the same name replaces a built-in subagent.
   The built-in subagents ([Built-in subagents](https://code.claude.com/docs/en/sub-agents#built-in-subagents)): Explore runs on its parent's model, except that under a Fable parent it runs on the model the `opus` alias selects, unless Claude Code runs on Amazon Bedrock, Google Cloud or Microsoft Foundry; Explore and Plan ignore `CLAUDE_CODE_SUBAGENT_MODEL`; `statusline-setup` runs on Sonnet and `claude-code-guide` on Haiku.
   `web-fetch`, which the documentation does not list, runs on the model the `haiku` alias selects, and on its parent's model on another provider than the Anthropic API, as its built-in definition in Claude Code 2.1.326 reads.
2. The parent's model, for a call the session makes, comes from noonsight's record of the session, which `SessionStart` and `PostModelSwitch` keep current (`parent_source: session-record`); else from the session's transcript (`session-transcript`); else from the settings the session started with, as for `SessionStart`.
   For a call made inside a subagent, it comes from noonsight's record of that subagent, written when the result of the call that started it named its model, which happens at once for a subagent started in the background (`agent-record`); else from the model of that subagent's own transcript (`agent-transcript`).
   When neither knows, noonsight does not guess the session's model: the subagent gets no rules, and the person is warned.
3. The subagent's task scope comes from its own call, never from the session: the scope whose matcher matches earliest in its `description` and `prompt` ([Scopes](configuration.md#scopes)).
   With `classifier.mode` on, the classifier may place a task instead, when the scope can change the subagent's rules or its route; a classification that fails, takes too long, or answers outside the declared scopes leaves the task with no scope, and the person is warned ([The classifier](configuration.md#the-classifier)).
4. With routing on for subagents, the scope may set the call's `model` and `effort` ([Routing](#routing)); the prediction is then made again with the routed model.
   The rules are resolved for the scope, the place `subagent` and the model the subagent will run on.
5. The hook records the rules for the subagent's start, and puts the call among its session's calls whose subagent has not started yet.
   A call whose task text already holds the exact rules gets none again (`delivered: "already-delivered"`).
   When the record cannot be written, the subagent gets no rules, the person is warned, and the line records `error`; a call routing changed is still returned changed.
6. It returns nothing for the call, unless routing changed its model or effort.
7. An undeclared model warns the person, unless `on_undeclared` is `ignore`.

The prediction is written to `~/.local/state/noonsight/agent-calls/`, under the call's `tool_use_id`, and the session's open calls to `agent-pools/`.

### SubagentStart: the rules

The input of `SubagentStart` names the subagent (`agent_id`) and its type (`agent_type`), but not the agent call that started it ([SubagentStart](https://code.claude.com/docs/en/hooks)).
So noonsight finds the call among its session's open calls of that type:

| `start_match` | When | What the subagent gets |
| --- | --- | --- |
| `single` | One call of the type is open | That call's rules |
| `result` | The result of a call already named this subagent, as it does at once for a subagent run in the background | That call's rules |
| `shared` | Several calls of the type are open, and no result names this subagent within two seconds | What every one of those calls would give: their rules when all are the same; when they are for one model and differ only by scope, that model's rules for every scope, which each of them holds (`shared_rules: "every-scope"`); otherwise none (`reason: "calls-differ"`) |
| `resumed` | The same subagent started before, and resumes | The rules it was given then; Claude Code adds them only when its context no longer holds them |

A shared start never gives a subagent rules chosen for another subagent.
Several calls of one response run at the same time, so the hooks of their calls, starts and results interleave in any order; the session's open calls are changed under a lock, one hook at a time.
A start that matches no open call, such as an agent team teammate's, gets nothing and leaves no log line.
A call whose subagent never starts, because something denied it after the hook ran, stays open for 2 minutes, since no hook says it was denied.
A subagent starts within seconds of its call's hook, so 2 minutes leaves a wide margin while keeping a denied call from making the later starts of its type wait for a result and share their rules with it.
A call that waits longer than that to start, such as one held on a permission prompt, is no longer open when its subagent starts, which then gets no rules.

The rules arrive as `additionalContext`, in the same envelope as the session's, at the start of the subagent's conversation, before its task.
The start is recorded in `~/.local/state/noonsight/agent-starts/`, under the subagent's id.

### PostToolUse: the check

The result of an agent call names the model the subagent started on (`tool_response.resolvedModel`, [Agent](https://code.claude.com/docs/en/hooks)).
noonsight compares it with the prediction for the same `tool_use_id` and logs the `result`:

| `result` | Meaning |
| --- | --- |
| `match` | The subagent started on the predicted model |
| `MISMATCH` | It started on another model, so it received another model's rules, or none. The person is warned, unless `subagents.on_mismatch` is `ignore` |
| `unpredicted` | noonsight could not tell the model before the start, and already warned then |
| `unknown` | The result names no model |

The rules already given stay in the subagent's context; the check can only report.
The line also repeats the `routing` and `routing_reason` recorded for the call.
`models_used`, when Claude Code reports it, lists the models a subagent switched between while it ran.
The result also records the subagent's model under its agent id, in `~/.local/state/noonsight/agents/`, for the calls that subagent makes in turn.
When the subagent's start has not been seen yet, it records which call started it, in `agent-links/`, so the start finds its own call.
The line's `delivered` says what the subagent's start gave it (`rules` or `nothing`), or `at-start` when the start comes after the result.

### Routing

With `routing.enabled` and the target `subagents` ([Routing](configuration.md#routing)), the agent call hook chooses the subagent's model and effort from its scope before the subagent starts, and the rules it adds are the routed model's.

1. noonsight first predicts the model as the call stands.
   When that model is fixed (a fork, or `CLAUDE_CODE_SUBAGENT_MODEL_FORCE`), or chosen by the caller under `routing.respect_explicit` (the call's `model`, the definition's `model`, a built-in subagent's own model, or a plugin's definition, which noonsight does not read), the call keeps its model.
2. Otherwise the scope's row, else `routing.default`, gives the options, and the first whose model is declared wins.
   The hook sets the call's `model` to the option's alias and, when the option gives one, its `effort`; an effort the call or its definition already sets is kept under `respect_explicit`.
3. The changed call is returned with the permission decision `subagents.permission` names, and its reason says what noonsight set:

   | Value | What Claude Code does |
   | --- | --- |
   | `allow` (default) | Runs the call without a permission prompt. Deny and ask rules still apply, and another hook's `deny` or `ask` still wins ([PreToolUse decision control](https://code.claude.com/docs/en/hooks#pretooluse-decision-control)) |
   | `ask` | Asks the person to confirm each call routing changed |
   | `passthrough` | No decision: the session's permission mode decides. In auto mode Claude Code can deny the changed call, because its classifier reviewed the call as Claude wrote it |

   The rules still reach the subagent at its start.
   With `subagents.delivery` set to `off`, a routed call still gets its model and effort, and no rules.

A routed call is the one call noonsight changes, and in auto mode a changed call costs the other calls of its response their review: they are refused, and Claude makes them again in a response of their own.
With routing on for subagents in auto mode, that happens whenever a call is routed, and only then; a call routing yields on, or leaves on its model, is not changed.

The check after the start compares the model the subagent started on with the routed model, so a route that Claude Code did not follow, such as one an installed mod replaced, shows as `MISMATCH`.
Claude Code applies the call's `effort` only from version 2.1.292 ([Choose an effort level](https://code.claude.com/docs/en/sub-agents)), and `CLAUDE_CODE_EFFORT_LEVEL` wins over it.

### What the prediction does not see

- The definitions of a plugin's subagents (`plugin:name`) are not read.
  Such a subagent is predicted on its parent's model, logged with `definition: "not-read"`, and the check reports a difference.
- An installed mod that sets the model in its `agent.spawn` hook replaces the call's parameter; the check reports a difference.
- Subagents that do not start through the agent tool, such as agent team teammates and workflow agents, get nothing from these hooks.
- The subagents given with `--agents` and managed subagent definitions are subagent types noonsight does not know: they get no rules, and the person is warned.

## The decision log

Every decision adds one JSON line to `~/.local/state/noonsight/decisions.jsonl`, in the home of the account that ran the session.
Past 20 MB the log moves to `decisions.1.jsonl`, replacing an older one, and a new log starts.

`noonsight report` reads both files and prints, for each rule, how often it was delivered and to which models, scopes, places and events, with the length of its text; then the rules on in the configuration that the log never shows delivered, and the decisions that delivered no rules, by why.
When the classifier acted, it also prints a classifier section: the tasks it was meant to place, by result, and for the classifications that ran, their median and longest time and the cost Claude Code reported.
A delivery is a line whose `delivered` is `rules`, `rules+note` or `system-prompt`; a session start that found the rules already in the launcher's system prompt (`launcher`) is counted once, under `launch`.
A subagent's rules are counted once, on its `subagent-start` line; its `agent-call` line hands them over (`at-start`) and is not counted.
`--log <file>` reads another log, such as one copied from another machine (a file it cannot read is a usage error), and `--json` prints the same as JSON.

```json
{"ts":"2026-11-14T20:31:50.901Z","version":"0.1.0","event":"session-start","session_id":"ea13c26f-…","source":"startup","install":"managed","config":"/home/me/.config/noonsight/noonsight.json","model":"claude-sonnet-5-5","status":"matched","key":"claude-sonnet-5-5","rules":["team/commit-style"],"sha256":"1334c8f061b15357","scope":null,"place":"session","scope_source":null,"model_source":"hook-input","delivered":"rules","warned":false}
```

| Field | Values |
| --- | --- |
| `event` | `session-start`, `model-switch`, `agent-call` (`PreToolUse`), `subagent-start` (`SubagentStart`), `agent-result` (`PostToolUse`), and `launch` for `noonsight run` ([launcher.md](launcher.md#the-decision-log)) |
| `source` | The start type, or for a switch where it came from (`command`, `picker`, `auto`, `resume`, ...) |
| `tool_name`, `tool_use_id`, `permission_mode` | For the subagent events: the agent tool's name, the call's id and the session's permission mode |
| `agent_id` | For a call made inside a subagent: that subagent's id. For `subagent-start`: the subagent that started |
| `agent_type`, `start_match`, `call_id`, `calls`, `shared_rules` | For `subagent-start`: the subagent's type; how its call was found (`single`, `result`, `shared`, `resumed`, see [SubagentStart](#subagentstart-the-rules)); the call's `tool_use_id`, or for a shared start the calls it could have been; and `every-scope` when a shared start gave the rules for every scope |
| `subagent_type`, `requested_model` | The call's subagent type (`general-purpose` when it names none) and `model` parameter |
| `parent_model`, `parent_source` | The model of whoever made the call, and where it came from (see [Subagents](#subagents)) |
| `model_value`, `definition`, `unresolved_why` | What the prediction's source named, the definition file that decided, and why a model could not be told |
| `requested_effort` | For an agent call: the call's own `effort` parameter, when it sets one |
| `permission` | For a call routing changed: the permission decision returned |
| `routing`, `routing_reason` | For `launch`, `agent-call` and `agent-result` lines: what routing did (`off`, `yielded`, `inherit`, `routed`) and why ([Routing](configuration.md#when-routing-yields)). A line for a refused configuration or a failed hook records `off` with `config-invalid` or `error` |
| `routing_env` | For a route that yielded to the environment: the variable |
| `route_model`, `route_value`, `route_effort`, `route_option` | For a routed task: the model the route selects, what noonsight passed (an alias for a subagent), the effort it set, and the position of the chosen option in its row |
| `route_effort_kept`, `route_effort_overridden_by` | `true` when the caller's own effort was kept; `CLAUDE_CODE_EFFORT_LEVEL` when that variable wins over the routed effort |
| `route_from`, `route_skipped` | For a route that consulted a row: whether it was the scope's row (`table`) or `default`, and the options passed over, with why |
| `subagent_id`, `predicted`, `models_used`, `result` | For `agent-result`: the subagent's agent id, the model predicted for it, the models it switched between, and the check's `result` |
| `install` | `managed` or `account`: which install ran the hook |
| `model`, `from_model` | The normalized model identifiers |
| `model_source` | For the session: `hook-input`, `session-record`, `process-record`, `claude-args` (the `--model` argument), `env` (`ANTHROPIC_MODEL`), `settings`, or null when no model was known. For a subagent: the prediction's source (see [Subagents](#subagents)) |
| `model_from` | For a model taken from the launch settings: `--model`, `ANTHROPIC_MODEL`, `--settings`, or the settings file that set it |
| `model_alias`, `alias_from` | When that source named an alias: the alias, and what resolved it (`built-in` or the `ANTHROPIC_DEFAULT_*_MODEL` variable) |
| `model_unresolved`, `unresolved_why` | When a launch setting names a model noonsight cannot tell: the value, and why |
| `status` | `matched`, `none`, `undeclared`, `config-invalid`, `error` |
| `reason`, `key`, `rules`, `sha256` | As in `noonsight resolve` ([configuration.md](configuration.md)) |
| `scope`, `place`, `unknown_scope` | The declared scope and the place the rules were resolved for, and a scope that was asked for but is not declared |
| `scope_source` | `env` (`NOONSIGHT_SCOPE`), `task-text`, `classifier`, or null when there was no scope |
| `scope_matcher` | For a scope taken from the task text: the matcher that decided, as the configuration writes it |
| `classifier` | With `classifier.mode` on, for a task the classifier was meant to place: `scoped` (it gave a declared scope), `none` (it found that no scope fits), `failed`, `timeout`, `invalid` (it answered outside the declared scopes), `not-needed` (the scope could change neither the rules nor the route, so it was not asked) or `no-task` (a launch with no task text). Absent when no classification was due ([The classifier](configuration.md#the-classifier)) |
| `classifier_ms`, `classifier_error`, `classifier_cost_usd` | For a task the classifier was asked about: how long it took, why it gave no scope, and the cost Claude Code reported for the call |
| `matcher_scope` | With `classifier.mode` set to `always`: the scope a matcher had chosen before the classifier decided |
| `unattended_env` | For a session in the place `unattended`: the variable that put it there |
| `task_text_cut` | `true` for a subagent whose description and task text are longer than the matchers read, so the scope may be missing because the matching text was cut ([Scopes](configuration.md#scopes)) |
| `delivered` | `rules`, `rules+note`, `note`, `already-delivered`, `nothing`; `launcher` for a session start that found the rules in the system prompt `noonsight run` gave; `system-prompt` for a launch that added them; `at-start` for an agent call whose rules its subagent's start gives; and for a subagent with `subagents.delivery` set to `off`, `off` |
| `launch_file`, `launch_model` | For a session start under `noonsight run` with rules in the system prompt: the launcher's file, and the model its rules are for |
| `warned` | Whether the person was shown a warning |
| `problems` | For `config-invalid`, how many problems the configuration has |

What each session last received is kept in `~/.local/state/noonsight/sessions/` and `processes/`, one small file per session id and per Claude Code process; files nobody wrote for 30 days are removed, and so are the system prompt files of `noonsight run` in `launch/`.
The subagent records in `agent-calls/`, `agent-pools/`, `agent-starts/`, `agent-links/` and `agents/` are removed after 7 days; a call whose result never came, because another hook denied it, leaves its record until then.

## Turning noonsight off

| Way | Reach |
| --- | --- |
| `NOONSIGHT_DISABLE=1` in the environment that starts Claude Code | That session and everything it starts; no output and no log line. The classifier's own session runs with it, so noonsight's hooks never act there |
| `NOONSIGHT_ROUTING=off` in the environment that starts Claude Code or `noonsight run` | Routing only, for that session and its subagents; the rules are still delivered |
| `"subagents": { "delivery": "off" }` in the configuration | Subagents only: they get no rules, calls are left alone unless routing changes them, and their results are not checked; each call still gets a log line |
| No configuration file for the account | Every session of that account, silently |
| `noonsight uninstall` | Every new session reached by that install |

`disableAllHooks` in a person's own settings turns off a per-account install, but not the machine-wide one: Claude Code does not let it reach managed hooks.
