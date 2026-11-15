# The session hooks

sextant gives each Claude Code session the rules for the model it actually runs on.
Two hooks do it: `SessionStart`, when a session starts, and `PostModelSwitch`, when the session's model changes.
[install.md](install.md) covers putting them in place; this page is the contract they keep.

## Rules every hook follows

- **It never holds the session.**
  It always exits 0, reads only local files and never uses the network.
  It starts no other process, with one exception: on macOS, when nothing else names the session's model, it runs `ps` once to read the Claude Code command line (see [SessionStart](#sessionstart)).
  Each entry has a 10-second `timeout`; the hook itself takes a fraction of a second.
- **It never blocks anything.**
  An undeclared model gets a warning, never a refusal.
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
| `model_source` | `hook-input`, `session-record`, `process-record`, `claude-args` (the `--model` argument), `env` (`ANTHROPIC_MODEL`), `settings`, or null when no model was known |
| `model_from` | For a model taken from the launch settings: `--model`, `ANTHROPIC_MODEL`, `--settings`, or the settings file that set it |
| `model_alias`, `alias_from` | When that source named an alias: the alias, and what resolved it (`built-in` or the `ANTHROPIC_DEFAULT_*_MODEL` variable) |
| `model_unresolved`, `unresolved_why` | When a launch setting names a model sextant cannot tell: the value, and why |
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
