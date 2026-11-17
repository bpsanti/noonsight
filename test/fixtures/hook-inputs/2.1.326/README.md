# Hook inputs, Claude Code 2.1.326

These files are replay inputs for the hook adapter tests, like those of [2.1.325](../2.1.325/README.md).

| File | Origin |
| --- | --- |
| `subagent-start.json` | Recorded: the start of a general-purpose subagent that a `claude -p` session on Haiku started with `model: "haiku"`, in auto mode. The input names the subagent (`agent_id`) and its type (`agent_type`), not the agent call that started it. |

The input comes from Claude Code 2.1.326 on macOS, on 2026-11-17, from a hook that wrote its stdin to a file.
Home directory and project path were replaced with neutral paths; nothing else was changed.

The same recordings showed three facts the adapter relies on:

- `additionalContext` returned from `SubagentStart` reaches the subagent's context, and changes no tool call, so the auto mode classifier's review of the other calls of the same response still holds.
- The subagent's transcript and its `.meta.json`, which names the call's `tool_use_id`, are not written while the hook runs, so the hook cannot read the call from them.
- Several agent calls of one response run at the same time: their `PreToolUse` hooks, the `SubagentStart` hooks of their subagents and, for a subagent that runs in the background, the `PostToolUse` hook of its call interleave in any order, and a `PostToolUse` can come before the start of its own subagent.
