# Hook inputs, Claude Code 2.1.327

These files are replay inputs for the hook adapter tests, like those of [2.1.325](../2.1.325/README.md).

| File | Origin |
| --- | --- |
| `session-start-resume-continue.json` | Recorded: `claude --continue --model sonnet` resuming the conversation that `/clear` started in a session that had switched to Haiku with `/model haiku`. Claude Code leaves `model` out, and since that conversation had no response yet, the cost fields too. |
| `session-start-resume-command.json` | Recorded: `/resume <id>` typed in an interactive session started with `--model sonnet` that had switched to Haiku with `/model haiku`, resuming a conversation that ran on Opus. The input carries `model`: the model the Claude Code process runs, not the one its command line names nor the one the conversation ran on. |

The inputs come from Claude Code 2.1.327 on macOS, on 2026-11-18, from a hook that wrote its stdin to a file.
The sessions ran with a placeholder token, and their requests went to a local stand-in for the Messages API that recorded each request's model and answered with a fixed reply, so no request reached Anthropic.
Home directory, project path and temporary directory were replaced with neutral paths; nothing else was changed.

The same recordings showed which model a resumed conversation runs on, by the model of the requests that followed:

- A conversation resumed in a new Claude Code process (`claude --continue` or `claude --resume`) runs on the model its `--model` names, else `ANTHROPIC_MODEL`, else the `model` setting, as any start does, whatever model the conversation ran on before.
- With none of the three naming a model, it runs on the model the conversation ran on before.
- No `PostModelSwitch` fires for either.
