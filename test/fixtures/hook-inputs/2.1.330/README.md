# Hook inputs, Claude Code 2.1.330

These files are replay inputs for the hook adapter tests, like those of [2.1.325](../2.1.325/README.md).

| File | Origin |
| --- | --- |
| `pre-tool-use-agent-held.json` | Recorded: an agent call of an interactive session on Sonnet whose settings ask before every agent call. |
| `permission-request-agent.json` | Recorded: the permission request for that call, about 40 milliseconds after its `PreToolUse`. It carries the call's `tool_input`, unchanged, but not its `tool_use_id`. |
| `pre-tool-use-agent-teammate.json` | Recorded: an agent call that gives a `name`, in an interactive session with `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`, so it starts an agent team teammate in the same process. |
| `subagent-start-teammate.json` | Recorded: that teammate's start. Its `agent_type` is the call's `name`, not its `subagent_type`. |
| `post-tool-use-agent-teammate.json` | Recorded: that call's result, at once, with `status: "teammate_spawned"`, the teammate's `agentId` and the model it runs on. |
| `subagent-start-workflow.json` | Recorded: the start of an agent a workflow script started with `agent()`, in a `claude -p` session. No agent call comes before it, and its `agent_type` is `workflow-subagent`. |

The inputs come from Claude Code 2.1.330 on macOS, on 2026-11-23, from a hook that wrote its stdin to a file, in sessions whose requests went to a local stand-in for the Messages API that answered with those tool calls, so no model wrote them.
Home directory, project path and temporary directory were replaced with neutral paths; nothing else was changed.

The same recordings showed the facts the adapter relies on:

- A permission request comes after the call's `PreToolUse` and before its subagent's start, which waits for the answer.
- A call the person rejects at the prompt runs no hook at all: no `PostToolUse`, no `PostToolUseFailure` and no `PermissionDenied`.
  Its tool result in the session's transcript is an error, written at once.
- A subagent's `.meta.json`, next to its transcript, names the call that started it (`toolUseId`); Claude Code writes it once the subagent's `SubagentStart` hooks have run.
- A workflow's agents and an in-process teammate each fire `SubagentStart`, and `SubagentStop`; a teammate fires `TeammateIdle` too.
