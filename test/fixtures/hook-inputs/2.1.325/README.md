# Hook inputs, Claude Code 2.1.325

These files are replay inputs for the hook adapter tests.
They are not evidence that every scenario the tests compose was driven live.

| File | Origin |
| --- | --- |
| `session-start-startup.json` | Recorded: an interactive session started with `--model haiku`. |
| `session-start-clear.json` | Recorded: `/clear` in an interactive session. The session gets a new id and Claude Code leaves `model` out. |
| `model-switch-command.json` | Recorded: `/model haiku` in an interactive session running Sonnet 5.5, before any prompt. |
| `session-start-print.json` | Recorded: `claude -p hi --model haiku`. In non-interactive mode Claude Code leaves `model` out even when `--model` is given. |
| `pre-tool-use-agent.json` | Recorded: an agent call the session made in `claude -p`, with `model: "haiku"`. |
| `pre-tool-use-agent-nested.json` | Recorded: an agent call made inside that subagent, with no `model`; the input carries the subagent's `agent_id` and `agent_type`. |
| `post-tool-use-agent.json` | Recorded: the result of a foreground agent call made inside a subagent, with `status: "completed"` and `resolvedModel`. |
| `post-tool-use-agent-async.json` | Recorded: the result of an Explore call started in the background, with `status: "async_launched"`, which fires at once. |
| `session-start-resume.json` | Written by hand from the `SessionStart` input documented at https://code.claude.com/docs/en/hooks (read 2026-11-14): a resumed session, with the four cost fields Claude Code adds on resume. |

The session inputs come from Claude Code 2.1.325 on macOS, on 2026-11-14, from a hook that wrote its stdin to a file and sent no prompt to the model.
The agent tool inputs come from the same version on 2026-11-15, from sessions on Haiku that started subagents, with the same kind of hook; the task texts and replies in them are the ones those sessions wrote.
Home directory, project path and temporary directory were replaced with neutral paths; nothing else was changed.

The same recordings showed that the hook's parent process, when the hook runs in exec form (`command` plus `args`), is the `claude` process itself, and that it stays the same process across `/model` and `/clear`.
The adapter relies on that to find the session's model after `/clear`.
