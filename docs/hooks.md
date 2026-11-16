# The hooks

sextant gives each Claude Code session, and each subagent it starts, the rules for the model it actually runs on.
Four hooks do it: `SessionStart`, when a session starts, and `PostModelSwitch`, when the session's model changes; `PreToolUse` on the agent tool, before a subagent starts, and `PostToolUse` on the agent tool, once Claude Code reports the model the subagent started on.
[install.md](install.md) covers putting them in place; this page is the contract they keep.

## Rules every hook follows

- **It never holds the session, or a subagent call.**
  It always exits 0, reads only local files and never uses the network.
  It starts no other process, with one exception: on macOS, when nothing else names the session's model, it runs `ps` once to read the Claude Code command line (see [SessionStart](#sessionstart)).
  Each entry has a 10-second `timeout`; the hook itself takes a fraction of a second.
- **It never blocks anything.**
  An undeclared model, or a subagent whose model sextant cannot tell, gets a warning, never a refusal; sextant never denies a call.
- **A configuration with any problem is refused whole.**
  The hook delivers nothing, warns the person, and logs `config-invalid`; `sextant check` lists the problems.
- **It decides from what Claude Code itself uses.**
  The model comes from the hook input Claude Code sends, from sextant's own record of the same session or of the same Claude Code process, or from the same launch settings Claude Code chose the model from, in Claude Code's own order.
  The decision log names the source every time.
- **It leaves foreign input alone.**
  Input that is not the expected Claude Code event, such as another tool reading the same settings, gets no output and no log line.

## What the hooks print

Nothing, or one JSON object with up to two fields:

| Field | Reader | Content |
| --- | --- | --- |
| `hookSpecificOutput.additionalContext` | Claude, as a system reminder | The session hooks: the rules, and on a model change, the note below |
| `hookSpecificOutput.updatedInput`, `permissionDecision` | Claude Code | `PreToolUse`: the agent call with the rules at the end of its task text, and the permission decision the configuration asks for (see [Subagents](#subagents)) |
| `systemMessage` | The person, on screen | A warning: undeclared model, refused configuration, a subagent that started on another model than predicted, or a failed hook |

The rules arrive wrapped in a short envelope that says where they came from, written as facts, as Claude Code's documentation asks for hook context:

```text
<sextant-rules model="claude-sonnet-5-5">
Working rules the user declared for claude-sonnet-5-5 (delivered by sextant, rules team/commit-style):
...the rules...
</sextant-rules>
```

## SessionStart

The hook decides by how the session started (the `source` field):

| Start | What sextant does | Why |
| --- | --- | --- |
| `startup` | Delivers the rules | A new session |
| `clear`, `compact` | Delivers them again | The earlier context, and the rules in it, are gone |
| `resume`, `fork` | Delivers only when the model or the rules changed since this session's record | The restored conversation already holds them |
| Anything else | Delivers | Delivering twice costs little; a missed delivery is the defect sextant exists to prevent |

The model comes from the first of these that knows it:

1. The `model` field of the input.
   Claude Code can leave it out ([SessionStart input](https://code.claude.com/docs/en/hooks#sessionstart-input)): after `/clear` the new session has a new id and no `model`, and in non-interactive mode (`claude -p`) no start carries one.
2. sextant's record of the same session, or, for `/clear` and compaction only, its record of the same Claude Code process: the hook's parent process, which is the `claude` process running the session.
3. What the session was started with, read the way Claude Code reads it ([Setting your model](https://code.claude.com/docs/en/model-config#setting-your-model)), so that `claude -p` sessions get their rules:
   1. the `--model` argument of the Claude Code process;
   2. `ANTHROPIC_MODEL` in the hook's environment, which Claude Code passes to hooks with its settings' `env` applied ([Hook input and output](https://code.claude.com/docs/en/hooks#hook-input-and-output));
   3. the `model` setting of the highest-ranked settings file that sets one: the server-managed settings cached for the login, else the managed settings files; then `--settings`; then the project's `.claude/settings.local.json` and `.claude/settings.json`; then the user's `settings.json` in `CLAUDE_CONFIG_DIR` or `~/.claude`, with `--setting-sources` honored.

   The first of the three that names a model decides, as in Claude Code; a lower one is never consulted past it.

Only when none of them names a model does the session get no rules and a warning.

Reading the launch settings has limits, and the hook prefers saying so to guessing:

- **Aliases.**
  An alias such as `sonnet` follows `ANTHROPIC_DEFAULT_SONNET_MODEL` (and the matching variable for `opus`, `haiku` and `fable`) when it is set.
  Otherwise sextant uses what the alias selects on the Anthropic API, as Claude Code's documentation lists it from version 2.1.321 on ([Model aliases](https://code.claude.com/docs/en/model-config#model-aliases)); `sextant check` warns about an older `claude`.
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

The session's task scope is the value of `SEXTANT_SCOPE` in the environment Claude Code runs in, which its hooks inherit, so whoever starts the session (a person, a script, an orchestrator) can name it; without it, the session receives only the rules for every scope.
Its place is `unattended` when a variable listed in `session.unattended_when_env` is set and not empty, and `session` otherwise ([Scopes](configuration.md#scopes)).
A resumed session gets the rules again when a change of scope or place changed which rules apply.

## PostModelSwitch

The hook delivers the new model's rules with the next request.
The rules delivered earlier stay in the conversation, so when the previous model had received rules, the delivery starts with a note:

```text
<sextant-rules-change from="claude-sonnet-5-5" to="claude-opus-5-5">
The session's model changed from claude-sonnet-5-5 to claude-opus-5-5. The working rules sextant delivered earlier in this conversation for claude-sonnet-5-5 no longer apply.
</sextant-rules-change>
```

A switch keeps the session's scope and place.
A switch to a model with no rules delivers the note alone.
Resuming a session restores its model and reports it as a switch; when the session's record shows the same model and rules, nothing is delivered again.
The configuration keeps room for the note: the rules for any model, scope and place must fit in 9,500 characters, so rules and note together stay within the 10,000 characters Claude Code accepts from a hook.

## Subagents

A subagent does not see the session's conversation, so the rules delivered to the session never reach it ([What loads at startup](https://code.claude.com/docs/en/sub-agents)).
And it can run on another model than the session.
So before a subagent starts, sextant adds the rules for the model it will run on to the end of its task text; after it starts, sextant checks that it started on that model.

Both hooks run only for the agent tool: the entries match `Agent|Task`, its current and earlier names, and the hook checks the tool name again, so a widened matcher reaches no other tool.
They also run for calls made inside a subagent, since Claude Code runs settings hooks there too; the input then carries the subagent's `agent_id`.

### PreToolUse: the rules go with the call

1. sextant predicts the model the subagent will run on, in Claude Code's own order ([Choose a model](https://code.claude.com/docs/en/sub-agents#choose-a-model)):

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
2. The parent's model, for a call the session makes, comes from sextant's record of the session, which `SessionStart` and `PostModelSwitch` keep current (`parent_source: session-record`); else from the session's transcript (`session-transcript`); else from the settings the session started with, as for `SessionStart`.
   For a call made inside a subagent, it comes from sextant's record of that subagent, written when the result of the call that started it named its model, which happens at once for a subagent started in the background (`agent-record`); else from the model of that subagent's own transcript (`agent-transcript`).
   When neither knows, sextant does not guess the session's model: the subagent gets no rules, and the person is warned.
3. The subagent's task scope comes from its own call, never from the session: the scope that lists its `subagent_type` under `agent_types`, else the scope whose matcher matches earliest in its `description` and `prompt` ([Scopes](configuration.md#scopes)).
   The rules are resolved for that scope and the place `subagent`.
4. With rules to deliver, the hook returns the call unchanged except for its `prompt`, which gains a blank line and the rules in the same envelope as the session's.
   sextant never changes the model, the effort or any other field.
   A task text that already holds the exact rules is left alone.
5. With the changed call, it returns the permission decision `subagents.permission` names:

   | Value | What Claude Code does |
   | --- | --- |
   | `allow` (default) | Runs the call without a permission prompt. Deny and ask rules still apply, and another hook's `deny` or `ask` still wins ([PreToolUse decision control](https://code.claude.com/docs/en/hooks#pretooluse-decision-control)) |
   | `ask` | Asks the person to confirm each call sextant changed |
   | `passthrough` | No decision: the session's permission mode decides. In auto mode Claude Code can deny a call a hook changed, because its classifier reviewed the call as Claude wrote it |

   A call sextant does not change gets no decision at all.
6. An undeclared model warns the person, unless `on_undeclared` is `ignore`; the call goes ahead unchanged.

The prediction is written to `~/.local/state/sextant/agent-calls/`, under the call's `tool_use_id`.

### PostToolUse: the check

The result of an agent call names the model the subagent started on (`tool_response.resolvedModel`, [Agent](https://code.claude.com/docs/en/hooks)).
sextant compares it with the prediction for the same `tool_use_id` and logs the `result`:

| `result` | Meaning |
| --- | --- |
| `match` | The subagent started on the predicted model |
| `MISMATCH` | It started on another model, so it received another model's rules, or none. The person is warned, unless `subagents.on_mismatch` is `ignore` |
| `unpredicted` | sextant could not tell the model before the start, and already warned then |
| `unknown` | The result names no model |

The rules already delivered stay in the subagent's task; the check can only report.
`models_used`, when Claude Code reports it, lists the models a subagent switched between while it ran.
The result also records the subagent's model under its agent id, in `~/.local/state/sextant/agents/`, for the calls that subagent makes in turn.

### What the prediction does not see

- The definitions of a plugin's subagents (`plugin:name`), the subagents given with `--agents`, and managed subagent definitions are not read.
  Such a subagent is predicted on its parent's model, logged with `definition: "not-read"`, and the check reports a difference.
- An installed mod that sets the model in its `agent.spawn` hook replaces the call's parameter; the check reports a difference.
- Subagents that do not start through the agent tool, such as agent team teammates and workflow agents, get nothing from these hooks.

## The decision log

Every decision adds one JSON line to `~/.local/state/sextant/decisions.jsonl`, in the home of the account that ran the session.
Past 20 MB the log moves to `decisions.1.jsonl`, replacing an older one, and a new log starts.

```json
{"ts":"2026-11-14T20:31:50.901Z","version":"0.1.0","event":"session-start","session_id":"ea13c26f-…","source":"startup","install":"managed","config":"/home/me/.config/sextant/sextant.json","model":"claude-sonnet-5-5","status":"matched","key":"claude-sonnet-5-5","rules":["team/commit-style"],"sha256":"1334c8f061b15357","scope":null,"place":"session","scope_source":null,"model_source":"hook-input","delivered":"rules","warned":false}
```

| Field | Values |
| --- | --- |
| `event` | `session-start`, `model-switch`, `agent-call` (`PreToolUse`), `agent-result` (`PostToolUse`) |
| `source` | The start type, or for a switch where it came from (`command`, `picker`, `auto`, `resume`, ...) |
| `tool_name`, `tool_use_id`, `permission_mode` | For the subagent events: the agent tool's name, the call's id and the session's permission mode |
| `agent_id` | For a call made inside a subagent: that subagent's id |
| `subagent_type`, `requested_model` | The call's subagent type (`general-purpose` when it names none) and `model` parameter |
| `parent_model`, `parent_source` | The model of whoever made the call, and where it came from (see [Subagents](#subagents)) |
| `model_value`, `definition`, `unresolved_why` | What the prediction's source named, the definition file that decided, and why a model could not be told |
| `permission` | For a call sextant changed: the permission decision returned |
| `subagent_id`, `predicted`, `models_used`, `result` | For `agent-result`: the subagent's agent id, the model predicted for it, the models it switched between, and the check's `result` |
| `install` | `managed` or `account`: which install ran the hook |
| `model`, `from_model` | The normalized model identifiers |
| `model_source` | For the session: `hook-input`, `session-record`, `process-record`, `claude-args` (the `--model` argument), `env` (`ANTHROPIC_MODEL`), `settings`, or null when no model was known. For a subagent: the prediction's source (see [Subagents](#subagents)) |
| `model_from` | For a model taken from the launch settings: `--model`, `ANTHROPIC_MODEL`, `--settings`, or the settings file that set it |
| `model_alias`, `alias_from` | When that source named an alias: the alias, and what resolved it (`built-in` or the `ANTHROPIC_DEFAULT_*_MODEL` variable) |
| `model_unresolved`, `unresolved_why` | When a launch setting names a model sextant cannot tell: the value, and why |
| `status` | `matched`, `none`, `undeclared`, `config-invalid`, `error` |
| `reason`, `key`, `rules`, `sha256` | As in `sextant resolve` ([configuration.md](configuration.md)) |
| `scope`, `place`, `unknown_scope` | The declared scope and the place the rules were resolved for, and a scope that was asked for but is not declared |
| `scope_source` | `env` (`SEXTANT_SCOPE`), `agent-type`, `task-text`, or null when there was no scope |
| `scope_matcher` | For a scope taken from the task text: the matcher that decided, as the configuration writes it |
| `unattended_env` | For a session in the place `unattended`: the variable that put it there |
| `delivered` | `rules`, `rules+note`, `note`, `already-delivered`, `nothing`, and for a subagent with `subagents.delivery` set to `off`, `off` |
| `warned` | Whether the person was shown a warning |
| `problems` | For `config-invalid`, how many problems the configuration has |

What each session last received is kept in `~/.local/state/sextant/sessions/` and `processes/`, one small file per session id and per Claude Code process; files nobody wrote for 30 days are removed.
The subagent records in `agent-calls/` and `agents/` are removed after 7 days; a call whose result never came, because another hook denied it, leaves its record until then.

## Turning sextant off

| Way | Reach |
| --- | --- |
| `SEXTANT_DISABLE=1` in the environment that starts Claude Code | That session and everything it starts; no output and no log line |
| `"subagents": { "delivery": "off" }` in the configuration | Subagents only: calls are left alone and their results are not checked; each call still gets a log line |
| No configuration file for the account | Every session of that account, silently |
| `sextant uninstall` | Every new session reached by that install |

`disableAllHooks` in a person's own settings turns off a per-account install, but not the machine-wide one: Claude Code does not let it reach managed hooks.
