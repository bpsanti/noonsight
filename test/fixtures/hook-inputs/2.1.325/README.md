# Hook inputs, Claude Code 2.1.325

These files are replay inputs for the hook adapter tests.
They are not evidence that every scenario the tests compose was driven live.

| File | Origin |
| --- | --- |
| `session-start-startup.json` | Recorded: an interactive session started with `--model haiku`. |
| `session-start-clear.json` | Recorded: `/clear` in an interactive session. The session gets a new id and Claude Code leaves `model` out. |
| `model-switch-command.json` | Recorded: `/model haiku` in an interactive session running Sonnet 5.5, before any prompt. |
| `session-start-resume.json` | Written by hand from the `SessionStart` input documented at https://code.claude.com/docs/en/hooks (read 2026-11-14): a resumed session, with the four cost fields Claude Code adds on resume. |

The recorded inputs come from Claude Code 2.1.325 on macOS, on 2026-11-14, from a hook that wrote its stdin to a file and sent no prompt to the model.
Home directory, project path and temporary directory were replaced with neutral paths; nothing else was changed.

The same recordings showed that the hook's parent process, when the hook runs in exec form (`command` plus `args`), is the `claude` process itself, and that it stays the same process across `/model` and `/clear`.
The adapter relies on that to find the session's model after `/clear`.
