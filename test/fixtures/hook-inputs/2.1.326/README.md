# Hook inputs, Claude Code 2.1.326

These files are replay inputs for the hook adapter tests, like those of [2.1.325](../2.1.325/README.md).

| File | Origin |
| --- | --- |
| `subagent-start.json` | Recorded: the start of a general-purpose subagent that a `claude -p` session on Haiku started with `model: "haiku"`, in auto mode. The input names the subagent (`agent_id`) and its type (`agent_type`), not the agent call that started it. |
| `post-tool-use-edit.json` | Recorded: the result of an `Edit` of a file git tracks, in a `claude -p` session on Sonnet. |
| `post-tool-use-write.json` | Recorded: the result of a `Write` that created a new file, `report.html`, in the same session. |

The inputs come from Claude Code 2.1.326 on macOS, on 2026-11-17, from a hook that wrote its stdin to a file.
The two `PostToolUse` inputs come from a session whose requests went to a local stand-in for the Messages API that answered with those tool calls, so no model wrote them.
Home directory, project path and temporary directory were replaced with neutral paths; nothing else was changed.

The same recordings showed four facts the adapter relies on:

- `additionalContext` returned from `SubagentStart` reaches the subagent's context, and changes no tool call, so the auto mode classifier's review of the other calls of the same response still holds.
- The subagent's transcript and its `.meta.json`, which names the call's `tool_use_id`, are not written while the hook runs, so the hook cannot read the call from them.
- `additionalContext` returned from `PostToolUse` on `Edit` reaches the model in the next request, as a system message right after the edit's tool result, and so does the one from `PreToolUse`, at the same place. An `Edit` whose text is not in the file runs neither hook.
- Several agent calls of one response run at the same time: their `PreToolUse` hooks, the `SubagentStart` hooks of their subagents and, for a subagent that runs in the background, the `PostToolUse` hook of its call interleave in any order, and a `PostToolUse` can come before the start of its own subagent.
