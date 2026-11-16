# Claude Code facts noonsight relies on

Each fact below names the Claude Code version and the date it was last checked, and how to check it again.
Recheck them all when raising the Claude Code version that CI pins (`.github/workflows/ci.yml`).

`npm run test:live` drives real interactive sessions through a terminal and sends no prompt and no request to Anthropic: a placeholder token gets Claude Code past sign-in, and `ANTHROPIC_BASE_URL` points at a closed local port.
`NOONSIGHT_LIVE_TOKENS=1` adds the checks that ask a model, which need a real token in `CLAUDE_CODE_OAUTH_TOKEN`.
`NOONSIGHT_LIVE_LOGIN=1` adds the subagent, scope, preset, launcher and routing checks (`test/live/subagents.test.ts`, `test/live/scopes.test.ts`, `test/live/preset.test.ts`, `test/live/launcher.test.ts`, `test/live/routing.test.ts`), which send prompts from the Claude Code login of whoever runs them: they read no token, give noonsight's hook entries through `--settings`, and leave the person's own settings out with `--setting-sources project,local`, so nothing is installed into that account.
The preset checks send one short request to each of the four current models, Fable 5.2 included; in `claude -p`, Claude Code bills Fable usage to usage credits without asking, on plans where Fable draws on them.
Run them again whenever the preset changes or Claude Code is upgraded: the `system-prompt` check fails when what Claude Code sends each model changes.

## Checked live

| Fact | Version | Date | Check |
| --- | --- | --- | --- |
| On an interactive startup, the `SessionStart` input carries `model` | 2.1.325 | 2026-11-14 | `npm run test:live`; recorded input in `test/fixtures/hook-inputs/2.1.325/` |
| `/model <alias>` fires `PostModelSwitch` at once, before any prompt, with `from_model` and `to_model` as full identifiers | 2.1.325 | 2026-11-14 | `npm run test:live`; recorded input |
| `/clear` fires `SessionStart` with `source: "clear"`, a new `session_id` and no `model` | 2.1.325 | 2026-11-14 | `npm run test:live`; recorded input |
| A hook in exec form (`command` plus `args`) is a child of the `claude` process, and it is the same process across `/model` and `/clear` | 2.1.325 | 2026-11-14 | `npm run test:live` (the model after `/clear` comes from the process record) |
| A `systemMessage` from `SessionStart` shows on screen in an interactive session | 2.1.325 | 2026-11-14 | `npm run test:live` |
| `/model` saves the model into the account's `settings.json` and keeps the hook entries in it | 2.1.325 | 2026-11-14 | `npm run test:live` (the `/clear` hook still runs after `/model` rewrote the file) |
| The live checks above hold on Linux as on macOS | 2.1.325 | 2026-11-14 | `npm run test:live`, run on macOS and in a Linux container; CI runs it on Linux |
| In non-interactive mode (`claude -p`), the `SessionStart` input carries no `model`, even with `--model` | 2.1.325 | 2026-11-14 | `npm run test:live`; recorded input in `test/fixtures/hook-inputs/2.1.325/session-start-print.json` |
| The hook reads the `--model` argument of its parent `claude` process (by `ps` on macOS, `/proc` on Linux), `ANTHROPIC_MODEL` from its environment, and the `model` setting, in that order | 2.1.325 | 2026-11-14 | `npm run test:live` (the `claude -p` test) |
| A hook's environment holds the variables of the settings' `env` block | 2.1.325 | 2026-11-14 | Checked by hand: a hook recorded `ANTHROPIC_MODEL` set only in `settings.json` `env` |
| A model reads `additionalContext` from `SessionStart` and `PostModelSwitch` and can quote it | 2.1.325 | Not yet run | `NOONSIGHT_LIVE_TOKENS=1 CLAUDE_CODE_OAUTH_TOKEN=... npm run test:live` |
| The `PreToolUse` input of an agent call has `tool_name: "Agent"`, `tool_use_id`, `permission_mode`, and `tool_input` with `description`, `prompt`, `subagent_type`, `run_in_background`, and `model` only when the call sets one | 2.1.325 | 2026-11-15 | Recorded inputs in `test/fixtures/hook-inputs/2.1.325/` |
| A call made inside a subagent fires the same settings hooks, with the subagent's `agent_id` and `agent_type`; `transcript_path` stays the session's | 2.1.325 | 2026-11-15 | Recorded input; `NOONSIGHT_LIVE_LOGIN=1 npm run test:live` (nested) |
| `updatedInput` with `permissionDecision: "allow"` replaces the call, and the subagent reads and quotes rules added to the end of its `prompt`, in `claude -p` and in interactive sessions | 2.1.325 | 2026-11-15 | `NOONSIGHT_LIVE_LOGIN=1 npm run test:live` |
| A changed call whose hook output is longer than 10,000 characters still applies: the limit is on context strings, not on `updatedInput` | 2.1.325 | 2026-11-15 | Checked by hand: rules of 9,339 characters plus the task text reached a Haiku subagent |
| The `PostToolUse` input of an agent call has `tool_response.agentId` and `resolvedModel`; for a call that runs in the background (`status: "async_launched"`) it fires at once, for a foreground call when the subagent finishes | 2.1.325 | 2026-11-15 | Recorded inputs |
| Claude Code can run an agent call in the background even when the call does not ask for it, in `claude -p` and in interactive sessions | 2.1.325 | 2026-11-15 | `NOONSIGHT_LIVE_LOGIN=1 npm run test:live`; the subagent's metadata recorded the request shape as background |
| When a subagent makes its first agent call, its transcript is at `<session transcript dir>/<session id>/subagents/agent-<agent id>.jsonl` and names its model; with `--no-session-persistence` there is no transcript | 2.1.325 | 2026-11-15 | Checked by hand with a hook that read the file |
| The built-in Explore subagent under a Sonnet parent runs on Sonnet | 2.1.325 | 2026-11-15 | `NOONSIGHT_LIVE_LOGIN=1 npm run test:live` (inherit-explore) |
| A plugin's subagent with `model: haiku` runs on Haiku whatever the session's model | 2.1.325 | 2026-11-15 | `NOONSIGHT_LIVE_LOGIN=1 npm run test:live` (mismatch) |
| A hook inherits the environment Claude Code was started with, so `NOONSIGHT_SCOPE` set for `claude` reaches `SessionStart` | 2.1.325 | 2026-11-16 | `NOONSIGHT_LIVE_LOGIN=1 npm run test:live` (scopes) |
| A model reads two different scoped rule sets for the same model, from `SessionStart` context and from the end of a subagent's `prompt`, and quotes only the one it was given | 2.1.325 | 2026-11-16 | `NOONSIGHT_LIVE_LOGIN=1 npm run test:live` (scopes) |
| A `systemMessage` from `PreToolUse` or `PostToolUse` reaches `claude -p --output-format stream-json` as a `system` event of subtype `informational` | 2.1.325 | 2026-11-15 | `NOONSIGHT_LIVE_LOGIN=1 npm run test:live` |
| In auto mode, the classifier reviews an agent call that no hook allowed, and can deny it | 2.1.325 | 2026-11-15 | Seen in an interactive session started in auto mode; the live tests pin `--permission-mode default` |
| A session's transcript records each model request (`api-request`, with the model and a shape hash) and the system prompt sent with it (`api-request-shape`), for the session and for each subagent | 2.1.325 | 2026-11-16 | `NOONSIGHT_LIVE_LOGIN=1 npm run test:live` (system-prompt) |
| The system prompt of a Fable 5.2 session holds a "Finishing work" section with the advice of the preset rule `fable-5-2/finish-work`; Opus 5.5, Sonnet 5.5 and Haiku 5.5 sessions, and general-purpose subagents on each of the four models, hold the advice of no preset rule | 2.1.325 | 2026-11-16 | `NOONSIGHT_LIVE_LOGIN=1 npm run test:live` (system-prompt); the figures are in `presets/claude/SOURCES.md` |
| `--append-system-prompt` and `--append-system-prompt-file` given together both reach the system prompt, and so do `--system-prompt` and `--append-system-prompt-file`; of two `--append-system-prompt-file` options only the last one does | 2.1.325 | 2026-11-16 | `NOONSIGHT_LIVE_LOGIN=1 npm run test:live` (launcher), and checked by hand with two files |
| A session started by `noonsight run` with an explicit `--model`, in `claude -p`, quotes the rules from the system prompt file, with or without noonsight's hooks, and its `SessionStart` hook reads the file from the Claude Code command line and does not deliver the rules again | 2.1.325 | 2026-11-16 | `NOONSIGHT_LIVE_LOGIN=1 npm run test:live` (launcher) |
| An agent call returned by `PreToolUse` with `model` set to an alias and `effort` set starts the subagent on that model (`resolvedModel`) and at that effort, and a hook on a tool call inside the subagent reports the effort as `effort.level` | 2.1.325 | 2026-11-16 | `NOONSIGHT_LIVE_LOGIN=1 npm run test:live` (route-subagents) |
| A subagent on the session's own model, started without an effort, runs at the session's effort | 2.1.325 | 2026-11-16 | `NOONSIGHT_LIVE_LOGIN=1 npm run test:live` (route-subagents, explicit-model) |
| A hook inherits a variable set in the environment `claude -p` starts with, so `routing.yield_when_env` sees an orchestrator's variable in the agent call hook | 2.1.325 | 2026-11-16 | `NOONSIGHT_LIVE_LOGIN=1 npm run test:live` (orchestrator-env) |
| A session `noonsight run` starts with `--model <alias> --effort <level>` ahead of the other arguments runs on that model, and its `SessionStart` hook finds the routed model's rules in the system prompt | 2.1.325 | 2026-11-16 | `NOONSIGHT_LIVE_LOGIN=1 npm run test:live` (launcher routing) |
| With the shipped preset, a session and a subagent read the rules delivered to them and name their ids, and the decision log records the hash `noonsight resolve` gives for the same model, scope and place | 2.1.325 | 2026-11-16 | `NOONSIGHT_LIVE_LOGIN=1 npm run test:live` (preset-hash) |

## From the documentation, not checked live

| Fact | Source | Read |
| --- | --- | --- |
| The system prompt is recorded on a conversation's first request and sent as recorded on every later request and on resume, until compaction, even when a later launch passes other text (`--system-prompt-snapshot`, on by default) | `claude --help`, option `--system-prompt-snapshot` | 2026-11-16 |
| The agent tool's `model` parameter takes a model alias, not a full model identifier or `inherit`; its `effort` parameter needs Claude Code 2.1.292 or later, overrides a definition's `effort`, and `CLAUDE_CODE_EFFORT_LEVEL` wins over both | https://code.claude.com/docs/en/sub-agents, sections "Choose a model" and "Choose an effort level" | 2026-11-16 |
| The effort levels are `low`, `medium`, `high`, `xhigh` and `max`, and a level the model does not support falls back to the highest supported level at or below it | https://code.claude.com/docs/en/model-config, section "Adjust effort level" | 2026-11-16 |
| `PostModelSwitch` needs Claude Code 2.1.251 or later | https://code.claude.com/docs/en/hooks, section "PostModelSwitch" | 2026-11-14 |
| Claude Code merges `managed-settings.json` and every `*.json` in `managed-settings.d/`, and combines hook lists | https://code.claude.com/docs/en/managed-settings, section "Split a file-based policy across teams" | 2026-11-14 |
| The managed settings directory is `/Library/Application Support/ClaudeCode/` on macOS, `/etc/claude-code/` on Linux and WSL, and `C:\Program Files\ClaudeCode\` on Windows | Same page, section "Where each mechanism stores the policy" | 2026-11-14 |
| A managed file that is not valid JSON stops Claude Code from starting | Same page, section on documents that cannot be parsed | 2026-11-14 |
| `disableAllHooks` outside managed settings does not reach managed hooks | https://code.claude.com/docs/en/hooks, section "Hook locations" | 2026-11-14 |
| Managed settings make Claude Code load its built-in guard for mods | https://code.claude.com/docs/en/plugins/mods/admin, section "Know what happens by default" | 2026-11-14 |
| By default Claude Code applies only the highest-ranked managed source that delivers a policy key (server-managed, then MDM, then the managed settings files) and ignores the rest; only `managedSourcesBehavior: "merge"` in the highest-ranked source changes that | https://code.claude.com/docs/en/managed-settings, section "How Claude Code combines managed sources" | 2026-11-14 |
| Server-managed settings are for Claude for Teams and Claude for Enterprise, and are cached per login in `remote-settings.json` in the configuration directory | https://code.claude.com/docs/en/server-managed-settings, sections "Requirements" and "Invalid entries in delivered settings" | 2026-11-14 |
| Hooks in `~/.claude/settings.json` apply to all of a login's projects; `CLAUDE_CONFIG_DIR` moves that directory | https://code.claude.com/docs/en/hooks, section "Hook locations"; https://code.claude.com/docs/en/env-vars, `CLAUDE_CONFIG_DIR` | 2026-11-14 |
| `SessionStart` can leave `model` out; a hook inherits Claude Code's environment and can read `ANTHROPIC_MODEL` | https://code.claude.com/docs/en/hooks, sections "SessionStart input" and "Hook input and output" | 2026-11-14 |
| The starting model comes from `--model`, then `ANTHROPIC_MODEL`, then the `model` setting; what each alias selects per provider and version | https://code.claude.com/docs/en/model-config, sections "Setting your model", "Model aliases" and "Version history" | 2026-11-14 |
| Hook context over 10,000 characters is replaced by a file path and a preview | https://code.claude.com/docs/en/hooks, section "JSON output" | 2026-11-14 |
| A subagent's model comes from the call's `model` parameter (an alias), then the definition's `model` field (including `inherit`), then `CLAUDE_CODE_SUBAGENT_MODEL`, then the parent's model; a family alias keeps the parent's version when the parent is of that family; `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` overrides the first two, except for forks | https://code.claude.com/docs/en/sub-agents, sections "Choose a model", "Which version a model alias selects" and "Run every subagent on one model" | 2026-11-15 |
| Explore runs on its parent's model, but under a Fable parent on the model the `opus` alias selects, except on Amazon Bedrock, Google Cloud and Microsoft Foundry; Explore and Plan ignore `CLAUDE_CODE_SUBAGENT_MODEL` alone; `statusline-setup` runs on Sonnet and `claude-code-guide` on Haiku | Same page, section "Built-in subagents" | 2026-11-15 |
| Project subagent definitions are found in every `.claude/agents/` from the working directory up to the repository root, the closest winning, then in the user's `agents/`; both are scanned recursively, and the frontmatter `name` identifies the subagent | Same page, section "Choose the subagent scope" | 2026-11-15 |
| `updatedInput` replaces the whole tool input; with no `permissionDecision`, auto mode can deny the changed call; among hooks, `deny` beats `defer`, `ask` and `allow`, and deny and ask rules apply whatever a hook returns | https://code.claude.com/docs/en/hooks, section "PreToolUse decision control" | 2026-11-15 |
| A matcher of letters, digits and `\|` is a list of exact tool names | Same page, section "Matcher patterns" | 2026-11-15 |
| Settings hooks run inside subagents, and their input carries `agent_id` and `agent_type` | Same page, section "Hook locations" | 2026-11-15 |

The machine-wide install (`--managed`) is not checked live, because that would mean writing the real system directory of the machine running the tests.
Its tests install into a temporary directory that stands in for `/` (`NOONSIGHT_SYSTEM_ROOT`), and the per-account live tests use the same hook entries and the same pointer.
To check it by hand on a disposable machine: run `sudo ... noonsight install --managed`, start `claude`, and confirm that `/status` lists the managed settings files and that `~/.local/state/noonsight/decisions.jsonl` gains a line.
