# The launcher

`sextant run` starts Claude Code with the rules for its model in the system prompt.
It is the other way in, next to the [hooks](hooks.md): the hooks deliver the rules as context at the start of the conversation, and the launcher puts them in the system prompt itself.

```bash
sextant run --scope investigate -- --model sonnet -p "Find why the export is empty"
sextant run -- --model claude-opus-5-5          # an interactive session
```

Use it where the hooks do not reach, or reach without enough to decide:

- a session started with `--bare`, with `disableAllHooks`, or with `--setting-sources` that leaves out the settings sextant is installed in;
- a script or an orchestrator that wants the rules in the system prompt rather than in the conversation.

With the hooks installed too, the rules still reach the session once: `SessionStart` finds them in the system prompt and does not deliver them again (below).

## Usage

```text
sextant run [--scope <scope>] [--task <text>] [--] [claude arguments...]
```

| Option | Effect |
| --- | --- |
| `--scope <scope>` | The task scope. It is set as `SEXTANT_SCOPE` for the session, so its hooks decide with the same scope. Without it, a `SEXTANT_SCOPE` already in the environment applies |
| `--task <text>` | The task text the scopes' matchers read when no scope is given. Without it, the prompt right after `-p` or `--print` |
| `--help` | Shows the usage |

sextant's own options come first.
Everything from the first other argument, or everything after `--`, goes to `claude` unchanged, so `sextant run -- --help` shows Claude Code's help.
`sextant run` starts the `claude` on `PATH` and exits with its exit status.
Ctrl-C and Ctrl-\ reach Claude Code from the terminal, and the launcher does not end under it; a `SIGTERM` or `SIGHUP` sent to the launcher alone is passed on to Claude Code.

## What it adds

The launcher decides as the `SessionStart` hook does for a session that reports no model ([SessionStart](hooks.md#sessionstart)):

1. The scope is `--scope`, else `SEXTANT_SCOPE`, else the scope whose matcher matches earliest in the task text: `--task`, else the argument right after `-p` or `--print` when it is not an option ([Scopes](configuration.md#scopes)).
   A scope taken from the task text is set as `SEXTANT_SCOPE` for the session, so its hooks decide with the same scope.
   A prompt written elsewhere on the command line, or given on standard input, is not read, and an interactive session started without a task has only the scope it is given.
2. With routing on for the launcher, the scope may add `--model` and `--effort` to the claude arguments ([Routing](#routing)).
3. The model is the one Claude Code will start with: the `--model` argument among the claude arguments, else `ANTHROPIC_MODEL`, else the `model` setting of the highest-ranked settings file, with aliases resolved the same way.
   The launcher reads the arguments exactly as it passes them, routed ones included, so the limits of reading a command line on macOS do not apply to it.
4. The place is `unattended` when a variable of `session.unattended_when_env` is set, else `session`.

When that decision has rules, the launcher writes them, in the same envelope the hooks use, to a file in `~/.local/state/sextant/launch/`, and starts:

```text
claude --append-system-prompt-file ~/.local/state/sextant/launch/<hash>.md <the claude arguments>
```

It also sets `SEXTANT_LAUNCH_FILE` to that file, for the hooks.
The file is named after the hash of its content and written again on each launch; files no launch wrote for 30 days are removed.

When there are no rules to add, `claude` starts with its arguments unchanged:

| Case | What the launcher does |
| --- | --- |
| Nothing names a model, or the model cannot be told (`default`, `opusplan`, an alias on another provider without its pinning variable) | Nothing; the hooks decide from what Claude Code reports |
| The model is declared with no rules for this scope and place | Nothing |
| The model is not declared | Warns, unless `on_undeclared` is `ignore` |
| No configuration file, or a refused configuration | Warns; `sextant check` lists the problems |
| `SEXTANT_DISABLE=1` | Nothing, and no log line; no routing either |

## Routing

With `routing.enabled` and the target `launcher` ([Routing](configuration.md#routing)), the launcher chooses the session's model and effort from its scope:

```text
sextant run --scope digest -- -p "Summarize the changelog"
claude --append-system-prompt-file <file> --model sonnet --effort medium -p "Summarize the changelog"
```

- The scope's row, else `routing.default`, gives the options, and the first whose model is declared wins.
  The launcher puts `--model <model>` and, when the option gives one, `--effort <effort>` ahead of the claude arguments, writing the model as the table writes it, an alias or an identifier.
- A `--model` among the claude arguments wins under `routing.respect_explicit`, and the arguments are left as they are; an `--effort` among them is kept, and only the model is routed.
  With `respect_explicit` set to `false`, the launcher takes out the given `--model` and `--effort` and passes its own.
- A model from `ANTHROPIC_MODEL` or a `model` setting is a default rather than a choice for this task, so a route replaces it: Claude Code ranks `--model` above both.
- `SEXTANT_ROUTING=off`, or a variable of `routing.yield_when_env` set in the environment the launcher starts with, leaves the arguments as they are.
- The rules in the system prompt are the routed model's, so the hooks find them there as usual.

The decision log records what routing did on each `launch` line ([The decision log](hooks.md#the-decision-log)).
A session's model cannot be routed once it runs: routing the session needs `sextant run`, and a later `/model` works as always.

## Other text in the system prompt

Claude Code adds an `--append-system-prompt` to an `--append-system-prompt-file`, but keeps only the last `--append-system-prompt-file` it is given.
So:

- an `--append-system-prompt` someone else passes stays as it is, and both texts arrive;
- an `--append-system-prompt-file` someone else passes is read and merged into the launcher's file, its text first and the rules after it, and the launcher passes only its own file.
  If that file cannot be read, the launcher adds nothing, warns, and leaves the option for Claude Code.

`--system-prompt` and `--system-prompt-file` replace Claude Code's own system prompt and keep the appended text; the launcher leaves them alone.

## With the hooks

When `SessionStart` runs in a session the launcher started, it checks that the Claude Code process was started with `--append-system-prompt-file` naming the file in `SEXTANT_LAUNCH_FILE`, and that the file holds exactly the rules the hook decided on.
Then it delivers nothing and logs `delivered: "launcher"`.
The variable alone is not enough, because a `claude` started from inside a launched session inherits it without the option; that session's hook delivers as usual.

| Start | What the hook does |
| --- | --- |
| `startup`, `clear`, `compact` | Claude Code renders the system prompt from this launch for a new conversation, after `/clear` and after compaction, so the rules in the launcher's file count as delivered |
| `resume`, `fork` | Claude Code reuses the system prompt the conversation was first sent with (`--system-prompt-snapshot`), so the session's record decides, as without the launcher |
| The launcher's rules are for another model than the session's | The hook delivers the session's model's rules with a note that the launcher's rules do not apply, and warns the person. This happens when the settings' `env` pins an alias to another model, which Claude Code and its hooks see and the launcher does not |
| The same model, other rules | The hook delivers its own rules, as without the launcher. This happens when the settings' `env` sets `SEXTANT_SCOPE` or a variable of `session.unattended_when_env` |

A later `/model` works as without the launcher: `PostModelSwitch` delivers the new model's rules and says that the earlier ones no longer apply.

On macOS, the hook reads the Claude Code command line with `ps`, which joins the arguments with spaces; with a home directory whose path holds a space, the file cannot be told apart, and the hook delivers the rules again as context.

## The decision log

Each launch adds a line with `event: "launch"` to the [decision log](hooks.md#the-decision-log), with the same fields as `SessionStart` and:

| Field | Values |
| --- | --- |
| `delivered` | `system-prompt` when the launcher added the rules, else `nothing` |
| `routing`, `routing_reason` and the `route_*` fields | What routing did, as for an agent call ([The decision log](hooks.md#the-decision-log)) |
| `launch_file` | The file passed with `--append-system-prompt-file` |
| `merged_file` | An `--append-system-prompt-file` someone else passed, now merged into `launch_file` |
| `merge_failed` | One that could not be read, so the launcher added nothing |
