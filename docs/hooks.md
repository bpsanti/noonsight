# The session hooks

sextant gives each Claude Code session the rules for the model it actually runs on.
Two hooks do it: `SessionStart`, when a session starts, and `PostModelSwitch`, when the session's model changes.
[install.md](install.md) covers putting them in place; this page is the contract they keep.

## Rules every hook follows

- **It never holds the session.**
  It always exits 0, reads only local files, never uses the network and starts no other process.
  Each entry has a 10-second `timeout`; the hook itself takes a fraction of a second.
- **It never blocks anything.**
  An undeclared model gets a warning, never a refusal.
- **A configuration with any problem is refused whole.**
  The hook delivers nothing, warns the person, and logs `config-invalid`; `sextant check` lists the problems.
- **It decides from structural facts.**
  The model comes from the hook input Claude Code sends, or from sextant's own record of the same session or of the same Claude Code process, never from an environment variable a session could have inherited.
- **It leaves foreign input alone.**
  Input that is not the expected Claude Code event, such as another tool reading the same settings, gets no output and no log line.

## What the hooks print

Nothing, or one JSON object with up to two fields:

| Field | Reader | Content |
| --- | --- | --- |
| `hookSpecificOutput.additionalContext` | Claude, as a system reminder | The rules, and on a model change, the note below |
| `systemMessage` | The person, on screen | A warning: undeclared model, refused configuration, or a failed hook |

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

The model comes from the `model` field of the input.
Claude Code can leave it out; after `/clear`, for example, the new session has a new id and no `model`.
Then sextant uses its record of the same session, or, for `/clear` and compaction only, its record of the same Claude Code process: the hook's parent process, which is the `claude` process running the session.
A brand-new session without a model, as `claude -p` starts, gets no rules and a warning.

Only the place `session` is used for now, with no task scope, so a session receives the rules that apply to every scope in a watched session.

## PostModelSwitch

The hook delivers the new model's rules with the next request.
The rules delivered earlier stay in the conversation, so when the previous model had received rules, the delivery starts with a note:

```text
<sextant-rules-change from="claude-sonnet-5-5" to="claude-opus-5-5">
The session's model changed from claude-sonnet-5-5 to claude-opus-5-5. The working rules sextant delivered earlier in this conversation for claude-sonnet-5-5 no longer apply.
</sextant-rules-change>
```

A switch to a model with no rules delivers the note alone.
Resuming a session restores its model and reports it as a switch; when the session's record shows the same model and rules, nothing is delivered again.
The configuration keeps room for the note: the rules for any model, scope and place must fit in 9,500 characters, so rules and note together stay within the 10,000 characters Claude Code accepts from a hook.

## The decision log

Every decision adds one JSON line to `~/.local/state/sextant/decisions.jsonl`, in the home of the account that ran the session.
Past 20 MB the log moves to `decisions.1.jsonl`, replacing an older one, and a new log starts.

```json
{"ts":"2026-11-14T20:31:50.901Z","version":"0.1.0","event":"session-start","session_id":"ea13c26f-…","source":"startup","install":"managed","config":"/home/me/.config/sextant/sextant.json","model":"claude-sonnet-5-5","status":"matched","key":"claude-sonnet-5-5","rules":["team/commit-style"],"sha256":"1334c8f061b15357","model_source":"hook-input","delivered":"rules","warned":false}
```

| Field | Values |
| --- | --- |
| `event` | `session-start`, `model-switch` |
| `source` | The start type, or for a switch where it came from (`command`, `picker`, `auto`, `resume`, ...) |
| `install` | `managed` or `account`: which install ran the hook |
| `model`, `from_model` | The normalized model identifiers |
| `model_source` | `hook-input`, `session-record`, `process-record`, or null when no model was known |
| `status` | `matched`, `none`, `undeclared`, `config-invalid`, `error` |
| `reason`, `key`, `rules`, `sha256` | As in `sextant resolve` ([configuration.md](configuration.md)) |
| `delivered` | `rules`, `rules+note`, `note`, `already-delivered`, `nothing` |
| `warned` | Whether the person was shown a warning |
| `problems` | For `config-invalid`, how many problems the configuration has |

What each session last received is kept in `~/.local/state/sextant/sessions/` and `processes/`, one small file per session id and per Claude Code process; files nobody wrote for 30 days are removed.

## Turning sextant off

| Way | Reach |
| --- | --- |
| `SEXTANT_DISABLE=1` in the environment that starts Claude Code | That session and everything it starts; no output and no log line |
| No configuration file for the account | Every session of that account, silently |
| `sextant uninstall` | Every new session reached by that install |

`disableAllHooks` in a person's own settings turns off a per-account install, but not the machine-wide one: Claude Code does not let it reach managed hooks.
