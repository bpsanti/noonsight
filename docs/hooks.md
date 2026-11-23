# The hooks

noonsight gives each Claude Code session, and each subagent it starts, the rules for the model it actually runs on.
Seven hook entries do it: `SessionStart`, when a session starts, `PostModelSwitch`, when the session's model changes, and `PostToolUse` on Edit and Write, when the session's edits reveal a trigger; `PreToolUse` on the agent tool, before a subagent starts, `PermissionRequest` on the agent tool, when a permission prompt holds the call, `SubagentStart`, as the subagent starts, and `PostToolUse` on the agent tool, once Claude Code reports the model the subagent started on.
[install.md](install.md) covers putting them in place; this page is the contract they keep.

## Rules every hook follows

- **It never holds the session, or a subagent call, beyond a bound.**
  It always exits 0, reads only local files and never uses the network itself.
  It starts no other process, with three exceptions: on macOS, it runs `ps` once to read the Claude Code command line when the input does not name the session's model and, except at a resume, neither does noonsight's record, when `noonsight run` started the session, or at a fork whose own transcript and background job do not name the conversation it copied (see [SessionStart](#sessionstart)), and in the agent call hook when the subagent's model depends on its definition, which `--agents`, `--plugin-dir`, `--add-dir` and `--setting-sources` can change ([PreToolUse](#pretooluse-the-prediction)); until a session reveals `code-edit`, the file edit hook runs `git ls-files` in the directory of an edited file with a code extension and, when git tracks the file, `git rev-parse --git-common-dir` there and in the project, each stopped after 3 seconds ([PostToolUse on Edit and Write](#posttooluse-on-edit-and-write-the-triggers)); and with `classifier.mode` on, the agent call hook may start the classifier, one `claude -p` call that reaches the model with the person's login ([The classifier](configuration.md#the-classifier)).
  Each entry has a 10-second `timeout`; the hook itself takes a fraction of a second, and a classification at most `classifier.timeout_ms` more, which is held to 8 seconds so the hook still answers in time.
  A subagent's start waits at most two seconds more when several calls could have started it ([SubagentStart](#subagentstart-the-rules)).
- **It never blocks anything.**
  An undeclared model, or a subagent whose model noonsight cannot tell, gets a warning, never a refusal; noonsight never denies a call.
- **A configuration with any problem is refused whole.**
  The hook delivers nothing, warns the person, and logs `config-invalid`; `noonsight check` lists the problems.
  The result of an agent call under a refused configuration is logged as `config-invalid` too, without a second warning, and its subagent's start does nothing.
  A project's configuration with a problem is refused alone: the hooks apply the machine's configuration as if there were no project ([Project configuration](configuration.md#a-project-with-a-problem)).
- **It decides from what Claude Code itself uses.**
  The model comes from the hook input Claude Code sends, from noonsight's own record of the same session or of the same Claude Code process, from the conversation's transcript, or from the same launch settings Claude Code chose the model from, in Claude Code's own order; a fork's, from what the hook finds of the conversation it copied ([Forks](#forks)).
  The decision log names the source every time.
- **It leaves foreign input alone.**
  Input that is not the expected Claude Code event, such as another tool reading the same settings, gets no output and no log line.

## What the hooks print

Nothing, or one JSON object with up to two fields:

| Field | Reader | Content |
| --- | --- | --- |
| `hookSpecificOutput.additionalContext` | Claude, as a system reminder | The session hooks: the rules, and on a model change, the note below. `PostToolUse` on Edit and Write: the rules a trigger added, right after the edit's result. `SubagentStart`: the subagent's rules, at the start of its conversation |
| `hookSpecificOutput.updatedInput`, `permissionDecision` | Claude Code | `PreToolUse`, only for a call routing changed: the agent call with its new `model` and `effort`, and the permission decision the configuration asks for (see [Routing](#routing)) |
| `systemMessage` | The person, on screen | A warning: undeclared model, refused configuration, a preset update that changes the session's rules, a subagent that started on another model than predicted, or a failed hook |

The rules arrive wrapped in a short envelope that says where they came from, written as facts, as Claude Code's documentation asks for hook context:

```text
<noonsight-rules model="claude-sonnet-5-5">
Working rules the user declared for claude-sonnet-5-5 (delivered by noonsight, rules team/commit-style):
...the rules...
</noonsight-rules>
```

## SessionStart

The hook decides by how the session started (the `source` field):

| Start | What noonsight does | Why |
| --- | --- | --- |
| `startup` | Delivers the rules | A new session |
| `clear`, `compact` | Delivers them again | The earlier context, and the rules in it, are gone |
| `resume`, `fork` | Delivers only when the model or the rules changed since this session's record, or when the session's last delivery may never have reached the conversation: a `/model` switch's, or a resume's the conversation has not answered since; with a note that the rules of any other model the conversation may hold no longer apply. A fork, whose new session id has no record yet, goes by the record of the conversation it copied ([Forks](#forks)) | The restored conversation already holds them, except a switch's or a resume's that may never have reached it (below, and [PostModelSwitch](#postmodelswitch)) |
| Anything else | Delivers | Delivering twice costs little; a missed delivery is the defect noonsight exists to prevent |

The model comes from the first of these that knows it:

1. The `model` field of the input.
   Claude Code can leave it out ([SessionStart input](https://code.claude.com/docs/en/hooks#sessionstart-input)): after `/clear` the new session has a new id and no `model`, and in non-interactive mode (`claude -p`) no start carries one.
2. noonsight's record of the same session, or, for `/clear` and compaction only, its record of the same Claude Code process: the hook's parent process, which is the `claude` process running the session.
3. What the session was started with, read the way Claude Code reads it ([Setting your model](https://code.claude.com/docs/en/model-config#setting-your-model)), so that `claude -p` sessions get their rules:
   1. the `--model` argument of the Claude Code process;
   2. `ANTHROPIC_MODEL` in the hook's environment, which Claude Code passes to hooks with its settings' `env` applied ([Hook input and output](https://code.claude.com/docs/en/hooks#hook-input-and-output));
   3. the `model` setting of the highest-ranked settings file that sets one: the server-managed settings cached for the login, else the managed settings files; then `--settings`; then the project's `.claude/settings.local.json` and `.claude/settings.json`; then the user's `settings.json` in `CLAUDE_CONFIG_DIR` or `~/.claude`, with `--setting-sources` honored.

   The first of the three that names a model decides, as in Claude Code; a lower one is never consulted past it.

At `resume` and `fork` without a `model` in the input, the order is another, the one Claude Code follows for a resumed conversation:

1. the `--model` argument of the Claude Code process;
2. `ANTHROPIC_MODEL`;
3. the model of the conversation's last response since its last compaction, read from the transcript the input names (`transcript_path`), the session's own messages only (`model_source: "session-transcript"`), except under the `model` setting `haiku` when that response came from Haiku or Sonnet;
4. the `model` setting;
5. noonsight's record of the session.

`claude --continue` and `claude --resume` start a new Claude Code process, which reports no model and fires no `PostModelSwitch`.
It runs the conversation on the model its `--model` or `ANTHROPIC_MODEL` names, else on the model the conversation last answered on, else on its `model` setting, which `/model` in any session changes; a compaction with no response since leaves the conversation no model of its own ([recorded on Claude Code 2.1.327](../test/fixtures/hook-inputs/2.1.327/README.md) and [2.1.328](verification/claude-code.md)).
One setting outranks the conversation: under `"model": "haiku"`, written exactly so, a conversation that last answered on Haiku or Sonnet runs on Haiku, while one that last answered on Opus or Fable keeps its model; `opusplan`, `Haiku` and every other setting leave the conversation its model ([recorded on 2.1.328](verification/claude-code.md)).
A `--model` or `ANTHROPIC_MODEL` value noonsight cannot pin down outranks the setting, as in Claude Code, so the conversation, then the record, decides, and the log line records the value.
With none of the four, Claude Code runs its default model, which noonsight cannot tell, and the record decides.
After `/clear` and compaction the order stays as listed: the process keeps running the model a `/model` since its start chose, which its command line no longer names.
One exception comes first: Claude Code can run another model in place of the one the person chose, and in plan mode it runs Sonnet for Haiku.
It says so with a `PostModelSwitch`: `source: "auto"` as plan mode starts and ends, and `to_model` Sonnet with `requested_model: "haiku"` for a `/model haiku` typed in plan mode; but the start of a compaction in plan mode still reports Haiku, while the requests go on to Sonnet ([recorded on Claude Code 2.1.330](verification/claude-code.md)).
So the record keeps the model the person chose while another runs in its place, and a compaction or `/clear` whose start reports that chosen model, or none, takes the model the process runs from the record; the log line names the chosen model in `chosen_model` and the reported one in `reported_model`.
`/resume` typed inside a running session reports the model in the input.
When the resumed conversation's record holds the rules of another model, those rules are still in the conversation, so, as for [`PostModelSwitch`](#postmodelswitch), the new model's rules come with a note that they no longer apply, and the log line names the record's model in `from_model`.

Only when none of them names a model does the session get no rules and a warning.

Reading the launch settings has limits, and the hook prefers saying so to guessing:

- **Aliases.**
  An alias such as `sonnet` follows `ANTHROPIC_DEFAULT_SONNET_MODEL` (and the matching variable for `opus`, `haiku` and `fable`) when it is set.
  Otherwise noonsight uses what the alias selects on the Anthropic API, as Claude Code's documentation lists it from version 2.1.321 on ([Model aliases](https://code.claude.com/docs/en/model-config#model-aliases)); `noonsight check` warns about an older `claude`.
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

The session's task scope is the value of `NOONSIGHT_SCOPE` in the environment Claude Code runs in, which its hooks inherit, so whoever starts the session (a person, a script, an orchestrator) can name it; without it, the session receives only the rules for every scope.
Its place is `unattended` when a variable listed in `session.unattended_when_env` is set and not empty, or when Claude Code runs it headless, as `claude -p` and the Agent SDK do, and `session.headless_is_unattended` is on, as it is by default; it is `attended` otherwise ([Scopes](configuration.md#scopes)).
Claude Code tells a hook that its session runs headless with `CLAUDE_CODE_SESSION_ATTENDED=0` in the hook's environment; the variable is not documented, so the hook reads only `0` as headless, and a session whose environment lacks it is in the place it would have without this check ([verification](verification/claude-code.md)).
A resumed session gets the rules again when a change of scope or place changed which rules apply.
The rules are resolved with the triggers the session has revealed ([PostToolUse on Edit and Write](#posttooluse-on-edit-and-write-the-triggers)), which belong to its session id: after compaction the session gets the rules its triggers added again, with the others, and a resumed session that already holds them gets nothing again; after `/clear`, the new session has revealed none; a fork starts with the triggers of the conversation it copied ([Forks](#forks)).

What a resume or a fork returns reaches the conversation as a switch's does: with the process's next request only, so ending the session before one loses it ([recorded on Claude Code 2.1.328](verification/claude-code.md)).
So the record of a resume that delivered keeps every model whose rules the conversation may hold, as after a switch, and the next resume delivers again, with a note that retires all of them.
Unlike a switch, a resume runs before its process sends any request, so a response of the conversation after it shows that its delivery arrived: when the transcript holds one, from the session's own messages since the last compaction and later than the delivery, the next resume takes the delivery as received, and with it its note, and delivers again only what changed.
A transcript that cannot be read, or a response with no time, confirms nothing.
The deliveries of a startup, `/clear` and compaction are part of the conversation from its start, and a later resume finds them ([recorded on 2.1.328](verification/claude-code.md)).

A session started by `noonsight run` already holds its rules in the system prompt.
At `startup`, `clear` and `compact`, when the Claude Code process was started with the launcher's file and the file holds exactly the rules decided here, the hook delivers nothing and logs `delivered: "launcher"`.
After compaction of a session that revealed a trigger, the rules the trigger added are not in the launcher's file, so the hook delivers those, and the line names only them.
When the launcher's rules are for another model, the hook delivers this model's rules with a note that the others do not apply.
[launcher.md](launcher.md#with-the-hooks) has the details.

At `startup`, when the installed preset is not the version the configuration accepted (`preset_version`) and the package keeps a copy of that version, the person is warned when the update changes the session's model's rules: rules turned on or off, rules whose text, scopes, places or triggers changed (including those a user rule that replaces them takes), and `enable`, `disable` or `replaces` entries that name a rule the preset no longer has.
Under `"on_preset_change": "warn"` the warning says what the session now receives; under `"hold"` the session keeps the accepted version's rules, and the warning says what accepting the installed version would change ([Preset updates](configuration.md#preset-updates)).
A model the update leaves as it was gets no warning, nor does a start other than `startup`, and a failure in this comparison never costs the session its rules: `noonsight check` reports it.

The session's project is `CLAUDE_PROJECT_DIR`, else the input's `cwd`, and every hook of the session lays the project's configuration over the machine's, when there is one and this account trusts it ([Project configuration](configuration.md#project-configuration)).
At `startup`, a session in a project this account has not trusted is warned that only the machine's configuration applies and how to trust the project, and a session in a project whose configuration is refused is warned that it was refused; a project the account declined with `noonsight untrust`, or that `projects.allow` ignores, gives no warning.

### Forks

A fork goes on in a copy of a conversation under a new session id, which has no record of its own.
Claude Code forks a conversation three ways, and each fires `SessionStart` with `source: "fork"` ([recorded on Claude Code 2.1.330](verification/claude-code.md)):

| Fork | Process | Input `model` | The fork's transcript when the hook runs |
| --- | --- | --- | --- |
| `claude --continue --fork-session`, `claude --resume <id> --fork-session` | A new one | Left out | Not written yet |
| `/branch` | The same | The model the process runs | The copied conversation |
| `/fork <prompt>` | A background session | Left out | No message yet |

The copy holds what the original held: the rules delivered to it, a delivery that may not have arrived yet, and the rules its triggers added.
So the hook finds the conversation the fork copied, and takes its record, its last response and its triggers as the fork's own:

1. after `/branch`, the copied entries of the fork's transcript name the original in `forkedFrom`;
2. a `/fork` session's background job names the original in its `state.json`, in the directory `CLAUDE_JOB_DIR` names (`forkParentSessionId`), and the model the job was started with among its `respawnFlags`, which counts as the session's `--model`;
3. a process started with `--fork-session` names the original with `--resume <session id>`; with `--continue`, the original is the conversation Claude Code continues, the most recently written transcript in the fork's transcript folder other than the fork's own.

None of these is documented by Claude Code, and each was recorded on 2.1.330.
The hook reads the transcript folder after Claude Code chose what to continue, so a transcript another session of the same project writes in between would be taken for the original.
A fork in a new process then takes its model in the order of a resume, with the original's last response where its own transcript has none; Claude Code runs it so.
Its delivery reaches the conversation as a resume's does, with its first request, so its record keeps every model the copy may hold until a response confirms it.
A fork whose original none of these names, such as one of `claude --resume <name> --fork-session`, may hold the rules of any model: it gets its model's rules with a note that those of every model but its own no longer apply (`from="*"`), and a `/model` before it answers says the same.
The log line records how the original was found in `fork_origin` (`fork-transcript`, `background-job`, `resume-argument`, `continue`, or `unknown`) and the original's session id in `forked_from`.
A `/fork` session runs headless (`CLAUDE_CODE_SESSION_ATTENDED=0`), so its place is `unattended` while `session.headless_is_unattended` is on.

## PostModelSwitch

The hook delivers the new model's rules with the next request.
The rules delivered earlier stay in the conversation, so when it may hold another model's rules, the delivery starts with a note:

```text
<noonsight-rules-change from="claude-sonnet-5-5" to="claude-opus-5-5">
The session's model changed from claude-sonnet-5-5 to claude-opus-5-5. The working rules noonsight delivered earlier in this conversation for claude-sonnet-5-5 no longer apply.
</noonsight-rules-change>
```

Claude Code adds what the hook returns to the next request only.
When another `/model` or the end of the session comes before that request, the return never reaches the model, and no hook can tell whether it did ([recorded on Claude Code 2.1.328](verification/claude-code.md)).
So noonsight treats a switch's delivery as unconfirmed: the session's record keeps every model whose rules the conversation may hold without a note after them, and each later delivery says again that all of them no longer apply.
The note then names each of them in its `from` attribute and in its text; when their names would not fit in the room kept for the note, it says that the rules of every model other than the new one no longer apply (`from="*"`).
A resume after a switch delivers the rules again ([SessionStart](#sessionstart)), and so does a resume that Claude Code reports as a switch.
A startup's, `/clear`'s or compaction's delivery is part of the conversation from its start, and a resume's once the conversation has answered since, so after one, the record keeps only the session's model.
Delivering twice costs a longer note or a repeated copy of the rules; a delivery lost without a word is the defect noonsight exists to prevent.

A switch keeps the session's scope, place and triggers, so the new model also gets the rules the session's triggers add for it.
A switch to a model with no rules delivers the note alone.
Resuming a session restores its model and reports it as a switch; when the session's record shows the same model and rules, and its last delivery was not a switch's, nothing is delivered again.
The configuration keeps room for the note: the rules for any model, scope and place must fit in 9,500 characters, so rules and note together stay within the 10,000 characters Claude Code accepts from a hook.

## PostToolUse on Edit and Write: the triggers

A session started without a scope receives only the rules for every scope.
It still shows what kind of task it is on by what it does, and the hooks see every edit it makes.
A rule that lists a trigger ([Triggers](configuration.md#triggers)) is delivered to the session once the session reveals it, whatever the session's scope.
The one trigger is `code-edit`:

| Condition | Keeps out |
| --- | --- |
| The tool is `Edit` or `Write`, called by the session itself | Edits a subagent makes: its input carries the subagent's `agent_id`, and a subagent's scope comes from its own task |
| The file has a code extension (below) | Reports, notes and documents (`.md`, `.html`, `.txt`), styles, data and settings (`.css`, `.json`, `.yaml`, `.toml`), notebooks, and files with no extension |
| The git repository holding the file already tracks it (`git ls-files --error-unmatch`, run in the file's directory), and that repository is the project's or one of its worktrees: both have the same common git directory (`git rev-parse --git-common-dir`) | Every new file, such as a script or a report the session writes for itself; files git ignores, such as build outputs and temporary files; files of another repository, or of none, such as a temporary directory's; and every file of a project that is not a git repository |

The project is `CLAUDE_PROJECT_DIR`, which Claude Code sets for its hooks, else the input's `cwd`; paths are compared with every symbolic link resolved.
An edit in a worktree of the project counts, including a worktree inside the project's directory, such as one under `.claude/worktrees/`: a session that moves into a worktree keeps the original checkout as `CLAUDE_PROJECT_DIR`, and that checkout's index does not track the worktree's files.
The code extensions are those of programming languages, shell scripts and SQL: `c`, `h`, `cc`, `cpp`, `cxx`, `hh`, `hpp`, `hxx`, `m`, `mm`, `cs`, `java`, `kt`, `kts`, `scala`, `groovy`, `gradle`, `clj`, `cljs`, `cljc`, `js`, `jsx`, `mjs`, `cjs`, `ts`, `tsx`, `mts`, `cts`, `vue`, `svelte`, `go`, `rs`, `swift`, `dart`, `py`, `pyi`, `rb`, `php`, `pl`, `pm`, `lua`, `r`, `jl`, `ex`, `exs`, `erl`, `hrl`, `hs`, `ml`, `mli`, `fs`, `fsx`, `elm`, `nim`, `zig`, `sol`, `sh`, `bash`, `zsh`, `fish`, `ps1`, `psm1` and `sql`, in any case.

The first edit that meets all three delivers, as `additionalContext`, the rules the trigger adds for the session's model, scope and place, and only those: the session's conversation already holds the rest.
The rules arrive in the usual envelope, which names the trigger:

```text
<noonsight-rules model="claude-sonnet-5-5" trigger="code-edit">
Working rules the user declared for claude-sonnet-5-5, for a session that has edited the project's code (delivered by noonsight, rules sonnet-5-5/verify-changes):
...the rules...
</noonsight-rules>
```

`PostToolUse` is where Claude Code adds hook context "alongside the tool result" ([PostToolUse decision control](https://code.claude.com/docs/en/hooks#posttooluse-decision-control)), and it runs only after a tool call succeeds, so an edit that was refused or failed reveals nothing.
Recorded on Claude Code 2.1.326: in a `claude -p` session against a local stand-in for the Messages API, the context a `PostToolUse` hook on `Edit` returned reached the model in the very next request, as a system message right after the edit's tool result, and an `Edit` whose text was not in the file ran no hook at all.
`PreToolUse` can add context too, and it arrives at the same place; it runs before the edit is allowed, so it is not used.

A session's triggers only grow.
Each is recorded once per session, in `~/.local/state/noonsight/triggers/<session id>.<trigger>.json`, with the tool and the file, and the record is created exclusively, so of several edits of one response whose hooks run at once exactly one delivers.
Every later edit of the session costs the hook one file lookup and starts no process.
The session's own record is updated with the rules it now holds, so a resume does not deliver them again.
A session reveals a trigger even when its model gets no rule from it, and a later `/model` switch then delivers the new model's rules for it.

The hook warns nobody: the session's start already warned about an undeclared model or a refused configuration, and a hook that fails logs `error` without a warning, since a warning after every edit would only repeat.
An edit that reveals nothing, and every edit after the trigger, leaves no log line; the edit that reveals it leaves one `file-edit` line, with `trigger`, `file` (relative to its repository's root) and the rules delivered, and `triggered_rules` names the rules the trigger brought.

What the trigger does not see:

- Edits made through the shell, such as `sed -i` or a redirection in `Bash`, and edits of notebooks.
- Edits a subagent makes; the subagent's rules come from its own task.
- A new file the session writes as part of its work counts only once git tracks it; editing a tracked file in the same session reveals the trigger as usual.

## Subagents

A subagent does not see the session's conversation, so the rules delivered to the session never reach it ([What loads at startup](https://code.claude.com/docs/en/sub-agents)).
And it can run on another model than the session.
So before a subagent starts, noonsight predicts the model it will run on; as it starts, noonsight gives it that model's rules; after it starts, noonsight checks that it started on that model.

The rules reach the subagent through `SubagentStart`, never through a change to the agent call.
In auto mode, Claude Code's classifier reviews the calls of a response as Claude wrote them, and when a hook changes one of them it gives no verdict for the others, which are then refused until Claude makes them again in a response of their own ([PreToolUse `updatedInput` in auto mode](https://code.claude.com/docs/en/hooks)).
A call noonsight only gives rules to is left exactly as Claude wrote it.

`PreToolUse`, `PermissionRequest` and `PostToolUse` run only for the agent tool: the entries match `Agent|Task`, its current and earlier names, and the hook checks the tool name again, so a widened matcher reaches no other tool.
They also run for calls made inside a subagent, since Claude Code runs settings hooks there too; the input then carries the subagent's `agent_id`.
`SubagentStart` runs for every subagent type, for an agent team teammate that runs in the session's own process, and for a workflow's agents (seen on Claude Code 2.1.330).

### PreToolUse: the prediction

1. noonsight predicts the model the subagent will run on, in Claude Code's own order ([Choose a model](https://code.claude.com/docs/en/sub-agents#choose-a-model)):

   | Order | Source | `model_source` |
   | --- | --- | --- |
   | 1 | A fork runs on its parent's model | `fork` |
   | 2 | With `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` set: `CLAUDE_CODE_SUBAGENT_MODEL`, else the parent's model (Explore keeps its own rule) | `forced` |
   | 3 | The `model` parameter of the call | `parameter` |
   | 4 | The `model` field of the subagent's definition | `definition` |
   | 5 | A built-in subagent's own model (below) | `built-in` |
   | 6 | `CLAUDE_CODE_SUBAGENT_MODEL` | `env` |
   | 7 | The parent's model | `parent` |

   `inherit` means the parent's model.
   A family alias (`opus`, `sonnet`, `haiku`, `fable`) means the parent's own model when the parent is of that family, as in Claude Code ([Which version a model alias selects](https://code.claude.com/docs/en/sub-agents)); otherwise an alias resolves as for the session (see [SessionStart](#sessionstart)).
   Definitions are read where Claude Code reads them, and when several places define a name, the first of these wins, as in Claude Code ([Choose the subagent scope](https://code.claude.com/docs/en/sub-agents#choose-the-subagent-scope)):

   | Rank | Place | `definition_source` |
   | --- | --- | --- |
   | 1 | `.claude/agents/` in the managed settings directory | `managed` |
   | 2 | The `--agents` option of the `claude` command: inline JSON, or in `claude -p` the path of a JSON file | `flag` |
   | 3 | Every `.claude/agents/` from the project directory (`CLAUDE_PROJECT_DIR`, else the input's `cwd`) up to the repository root, the closest first, then `.claude/agents/` in each directory given with `--add-dir` | `project` |
   | 4 | `agents/` in the Claude Code configuration directory | `user` |
   | 5 | A plugin's agents, named `plugin:agent` | `plugin` |

   The managed, project and user folders are scanned recursively, and a subagent there is known by the `name` in its frontmatter; `--setting-sources` leaves out the project and user folders it does not list.
   A plugin's agents are the files its manifest lists under `agents`, else every Markdown file under its `agents/` folder, where each subfolder adds a part to the name; the last part is the frontmatter's `name`, else the file's name, so `agents/review/scan.md` of plugin `kit` is `kit:review:scan`.
   The plugins read are those given with `--plugin-dir` or `--plugin-dir-no-mcp`, those in `CLAUDE_CODE_PLUGIN_DIRS`, and those installed from a marketplace that the settings' `enabledPlugins` turn on for the project, from `plugins/installed_plugins.json` in the configuration directory.
   The order, the names and the plugin sources were checked against Claude Code 2.1.330 with a stub session ([verification](verification/claude-code.md)).
   A definition of the same name replaces a built-in subagent.
   The built-in subagents ([Built-in subagents](https://code.claude.com/docs/en/sub-agents#built-in-subagents)): Explore runs on its parent's model, except that under a Fable parent it runs on the model the `opus` alias selects, unless Claude Code runs on Amazon Bedrock, Google Cloud or Microsoft Foundry; Explore and Plan ignore `CLAUDE_CODE_SUBAGENT_MODEL`; `statusline-setup` runs on Sonnet and `claude-code-guide` on Haiku.
   `web-fetch`, which the documentation does not list, runs on the model the `haiku` alias selects, and on its parent's model on another provider than the Anthropic API, as its built-in definition in Claude Code 2.1.326 reads.
2. The parent's model, for a call the session makes, comes from noonsight's record of the session, which `SessionStart` and `PostModelSwitch` keep current (`parent_source: session-record`); else from the session's transcript (`session-transcript`); else from the settings the session started with, as for `SessionStart`.
   For a call made inside a subagent, it comes from noonsight's record of that subagent, written when the result of the call that started it named its model, which happens at once for a subagent started in the background (`agent-record`); else from the model of that subagent's own transcript (`agent-transcript`).
   When neither knows, noonsight does not guess the session's model: the subagent gets no rules, and the person is warned.
3. The subagent's task scope comes from its own call, never from the session: the scope whose matcher matches earliest in its `description` and `prompt` ([Scopes](configuration.md#scopes)).
   With `classifier.mode` on, the classifier may place a task instead, when the scope can change the subagent's rules or its route; a classification that fails, takes too long, or answers outside the declared scopes leaves the task with no scope, and the person is warned ([The classifier](configuration.md#the-classifier)).
4. With routing on for subagents, the scope may set the call's `model` and `effort` ([Routing](#routing)); the prediction is then made again with the routed model.
   The rules are resolved for the scope, the place `subagent` and the model the subagent will run on.
5. The hook records the rules for the subagent's start, and puts the call among its session's calls whose subagent has not started yet, with the call's `name` when it gives one, since an agent team teammate starts under that name, and a hash of its input, which a permission request names too.
   A call whose task text already holds the exact rules gets none again (`delivered: "already-delivered"`).
   When the record cannot be written, the subagent gets no rules, the person is warned, and the line records `error`; a call routing changed is still returned changed.
6. It returns nothing for the call, unless routing changed its model or effort.
7. An undeclared model warns the person, unless `on_undeclared` is `ignore`.

The prediction is written to `~/.local/state/noonsight/agent-calls/`, under the call's `tool_use_id`, and the session's open calls to `agent-pools/`.

### SubagentStart: the rules

The input of `SubagentStart` names the subagent (`agent_id`) and its type (`agent_type`), but not the agent call that started it ([SubagentStart](https://code.claude.com/docs/en/hooks)).
So noonsight finds the call among its session's open calls of that type:

| `start_match` | When | What the subagent gets |
| --- | --- | --- |
| `single` | One call of the type is open | That call's rules |
| `result` | The result of a call already named this subagent, as it does at once for a subagent run in the background | That call's rules |
| `shared` | Several calls of the type are open, and no result names this subagent within two seconds | What every one of those calls would give: their rules when all are the same; when they are for one model and differ only by scope, that model's rules for every scope, which each of them holds (`shared_rules: "every-scope"`); otherwise none (`reason: "calls-differ"`) |
| `resumed` | The same subagent started before, and resumes, or a teammate takes its next message | The rules it was given then; Claude Code adds them only when its context no longer holds them |

A call is of the start's type when its `subagent_type` is, or when it gave a `name` the start carries: a teammate that runs in the session's process starts with the call's `name` as its `agent_type` (seen on Claude Code 2.1.330).
A shared start never gives a subagent rules chosen for another subagent.
The subagents of one response's calls of a type start in no fixed order, even though their calls reach the hook in order (seen on Claude Code 2.1.326), so the order of the calls cannot tell them apart.
Several calls of one response run at the same time, so the hooks of their calls, starts and results interleave in any order; the session's open calls are changed under a lock, one hook at a time.
A start that matches no open call, such as a workflow agent's, gets nothing and leaves no log line.
A call whose subagent never starts, because something denied it after the hook ran, stays open for 2 minutes, since no hook says it was denied.
A subagent starts within seconds of its call's hook, so 2 minutes leaves a wide margin.
Sooner than that, an open call made more than 5 seconds before the newest open call of its type is left out: the calls of one response reach the hook within moments of each other, so it came from an earlier response and was denied, and a later call's subagent still gets its own rules.
A call a permission prompt holds is kept open for 24 hours instead ([PermissionRequest](#permissionrequest-a-held-call)), and when a start has to choose between several calls, or one of them is held, the calls the session's transcript shows refused are left out first: Claude Code writes an error as the tool result of a call the person rejected, or a rule or a hook denied.

When a shared start gives nothing because the calls need different rules (`calls-differ`), the subagent can still get its own: once its start's hooks have run, Claude Code writes the subagent's metadata next to its transcript, and that file names its call (`toolUseId`, seen on Claude Code 2.1.330).
So the next `PostToolUse` hook noonsight runs inside that subagent, the result of an agent call it makes or an Edit or Write it makes, reads the call from the metadata and returns that call's rules as `additionalContext`, which reaches the subagent's next request.
It logs a `subagent-rules` line with `start_match: "metadata"`, and a resume of the subagent gets the same rules again.
A subagent that makes none of those calls, and a session that writes no transcript (`--no-session-persistence`), get nothing.

The rules arrive as `additionalContext`, in the same envelope as the session's, at the start of the subagent's conversation, before its task.
The start is recorded in `~/.local/state/noonsight/agent-starts/`, under the subagent's id, and a start that waits for its call to be named in `agent-pending/`.

### PermissionRequest: a held call

A permission prompt can hold an agent call for as long as the person takes to answer, and its subagent starts only after the answer.
The permission request carries the call's input, unchanged, but not its `tool_use_id` (seen on Claude Code 2.1.330), so the hook marks held the newest open call of the session with the same input from the same caller.
A held call stays open for 24 hours, past the windows above, so its subagent still gets its rules when the person allows it minutes later.
The hook prints nothing: it never answers the request, and a call it cannot find is left as it was.
A rejected call runs no hook at all; the transcript shows it refused, and the next start that has to choose leaves it out.
It logs an `agent-held` line with the call's id.

### PostToolUse: the check

The result of an agent call names the model the subagent started on (`tool_response.resolvedModel`, [Agent](https://code.claude.com/docs/en/hooks)).
noonsight compares it with the prediction for the same `tool_use_id` and logs the `result`:

| `result` | Meaning |
| --- | --- |
| `match` | The subagent started on the predicted model |
| `MISMATCH` | It started on another model, so it received another model's rules, or none. The person is warned, unless `subagents.on_mismatch` is `ignore` |
| `unpredicted` | noonsight could not tell the model before the start, and already warned then |
| `unknown` | The result names no model |

The rules already given stay in the subagent's context; the check can only report.
The line also repeats the `routing` and `routing_reason` recorded for the call.
`models_used`, when Claude Code reports it, lists the models a subagent switched between while it ran.
The result also records the subagent's model under its agent id, in `~/.local/state/noonsight/agents/`, for the calls that subagent makes in turn.
When the subagent's start has not been seen yet, it records which call started it, in `agent-links/`, so the start finds its own call.
The line's `delivered` says what the subagent's start gave it (`rules` or `nothing`), or `at-start` when the start comes after the result; a call no longer open when its subagent started, which gave it nothing, records `nothing`.

### Routing

With `routing.enabled` and the target `subagents` ([Routing](configuration.md#routing)), the agent call hook chooses the subagent's model and effort from its scope before the subagent starts, and the rules it adds are the routed model's.

1. noonsight first predicts the model as the call stands.
   When that model is fixed (a fork, or `CLAUDE_CODE_SUBAGENT_MODEL_FORCE`), or chosen by the caller under `routing.respect_explicit` (the call's `model`, the definition's `model`, a built-in subagent's own model, or a definition noonsight cannot read), the call keeps its model.
2. Otherwise the scope's row, else `routing.default`, gives the options, and the first whose model is declared wins.
   The hook sets the call's `model` to the option's alias and, when the option gives one, its `effort`; an effort the call or its definition already sets is kept under `respect_explicit`.
3. The changed call is returned with the permission decision `subagents.permission` names, and its reason says what noonsight set:

   | Value | What Claude Code does |
   | --- | --- |
   | `allow` (default) | Runs the call without a permission prompt. Deny and ask rules still apply, and another hook's `deny` or `ask` still wins ([PreToolUse decision control](https://code.claude.com/docs/en/hooks#pretooluse-decision-control)) |
   | `ask` | Asks the person to confirm each call routing changed |
   | `passthrough` | No decision: the session's permission mode decides. In auto mode Claude Code can deny the changed call, because its classifier reviewed the call as Claude wrote it |

   The rules still reach the subagent at its start.
   With `subagents.delivery` set to `off`, a routed call still gets its model and effort, and no rules.

A routed call is the one call noonsight changes, and in auto mode a changed call costs the other calls of its response their review: they are refused, and Claude makes them again in a response of their own.
With routing on for subagents in auto mode, that happens whenever a call is routed, and only then; a call routing yields on, or leaves on its model, is not changed.

The check after the start compares the model the subagent started on with the routed model, so a route that Claude Code did not follow, such as one an installed mod replaced, shows as `MISMATCH`.
Claude Code applies the call's `effort` only from version 2.1.292 ([Choose an effort level](https://code.claude.com/docs/en/sub-agents)), and `CLAUDE_CODE_EFFORT_LEVEL` wins over it.

### What the prediction does not see

- A plugin's subagent from a plugin noonsight does not read, such as one an organization syncs to its members, or one that two plugins of the same name define differently.
  Such a subagent is predicted on `CLAUDE_CODE_SUBAGENT_MODEL`, else its parent's model, logged with `definition: "not-read"` and the reason in `definition_why`, and the check reports a difference when its definition sets another model.
  The same holds for every name when the `--agents` value cannot be read, such as two values on a macOS command line, where `ps` gives the arguments without their boundaries.
- An installed mod that sets the model in its `agent.spawn` hook replaces the call's parameter; the check reports a difference.
- A workflow's agents do not start through the agent tool.
  Their `SubagentStart` fires, with `agent_type: "workflow-subagent"`, but no agent call comes before it and its input names no model, so they get nothing from these hooks.
- An agent team teammate in split panes runs in a Claude Code process of its own ([Choose a display mode](https://code.claude.com/docs/en/agent-teams)).
  How noonsight's hooks treat it was not checked: the checks ran without tmux, where teammates run in the lead's process.
- Claude Code skips the managed `.claude/agents/` folder when the account itself could have written it under organization-managed settings; noonsight reads that folder whenever it exists.

## The decision log

Every decision adds one JSON line to `~/.local/state/noonsight/decisions.jsonl`, in the home of the account that ran the session.
Past 20 MB the log moves to `decisions.1.jsonl`, replacing an older one, and a new log starts.

`noonsight report` reads both files and prints, for each rule, how often it was delivered and to which models, scopes, places and events, with the length of its text, and, when a trigger brought some of the deliveries, how many it brought (`brought by`); then the triggers sessions revealed, each with the number of sessions, how many of them got rules, and the tools, extensions and files of the edits that revealed it, so an edit that should not have counted can be found; then the rules on in the configuration that the log never shows delivered, and the decisions that delivered no rules, by why.
When the classifier acted, it also prints a classifier section: the tasks it was meant to place, by result, and for the classifications that ran, their median and longest time and the cost Claude Code reported.
A delivery is a line whose `delivered` is `rules`, `rules+note` or `system-prompt`; a session start that found the rules already in the launcher's system prompt (`launcher`) is counted once, under `launch`.
On a `model-switch` line, `delivered` says what the hook returned to Claude Code, not what reached the model ([PostModelSwitch](#postmodelswitch)): a switch whose session's next line in the log is another switch is not counted as a delivery but as `switched-again`, since the second switch may have come before any request.
A subagent's rules are counted once, on its `subagent-start` line; its `agent-call` line hands them over (`at-start`) and is not counted.
A subagent whose start could not tell its call is counted under `calls-differ` among the decisions that delivered nothing, and its later `subagent-rules` line, when there is one, as a delivery.
The rule lengths and the rules never delivered come from the configuration as a session started in the directory the report runs for reads it: with the project configuration found from `CLAUDE_PROJECT_DIR`, else that directory, laid over the machine's ([Project configuration](configuration.md#project-configuration)).
The report names that project and what became of it on its second line, and the heading of the rules never delivered names the project file when it applied; the log itself holds the sessions of every project, so run the report inside a project to see that project's rules never delivered.
`--log <file>` reads another log, such as one copied from another machine (a file it cannot read is a usage error), and `--json` prints the same as JSON, with the project as `project`.

```json
{"ts":"2026-11-14T20:31:50.901Z","version":"0.1.0","event":"session-start","session_id":"ea13c26f-…","source":"startup","install":"managed","config":"/home/me/.config/noonsight/noonsight.json","model":"claude-sonnet-5-5","status":"matched","key":"claude-sonnet-5-5","rules":["team/commit-style"],"sha256":"1334c8f061b15357","scope":null,"place":"attended","scope_source":null,"model_source":"hook-input","delivered":"rules","warned":false}
```

| Field | Values |
| --- | --- |
| `event` | `session-start`, `model-switch`, `file-edit` (`PostToolUse` on Edit and Write), `agent-call` (`PreToolUse`), `agent-held` (`PermissionRequest`), `subagent-start` (`SubagentStart`), `agent-result` (`PostToolUse` on the agent tool), `subagent-rules` (a later hook inside a subagent that gave it its call's rules), and `launch` for `noonsight run` ([launcher.md](launcher.md#the-decision-log)) |
| `source` | The start type, or for a switch where it came from (`command`, `picker`, `auto`, `resume`, ...) |
| `tool_name`, `tool_use_id`, `permission_mode` | For the tool events: the tool's name, the call's id and the session's permission mode |
| `trigger`, `file` | For `file-edit`: the trigger the edit revealed, and the edited file, relative to its repository's root |
| `triggers` | For the session events: the triggers the session has revealed, when it has revealed one |
| `triggered_rules` | The rules among `rules` that only a trigger brought, when there are some |
| `agent_id` | For a call made inside a subagent: that subagent's id. For `subagent-start`: the subagent that started |
| `agent_type`, `start_match`, `call_id`, `calls`, `shared_rules`, `refused` | For `subagent-start`: the subagent's type; how its call was found (`single`, `result`, `shared`, `resumed`, see [SubagentStart](#subagentstart-the-rules)); the call's `tool_use_id`, or for a shared start the calls it could have been; `every-scope` when a shared start gave the rules for every scope; and the calls left out because the transcript shows them refused. For `subagent-rules`: `start_match` is `metadata` and `call_id` the call the subagent's metadata names. For `agent-held`: `call_id` is the held call |
| `subagent_type`, `requested_model` | The call's subagent type (`general-purpose` when it names none) and `model` parameter |
| `parent_model`, `parent_source` | The model of whoever made the call, and where it came from (see [Subagents](#subagents)) |
| `model_value`, `definition`, `definition_source`, `definition_why`, `unresolved_why` | What the prediction's source named; the definition file that decided (`--agents` for an inline one, `not-read` when a place that may define the subagent cannot be read); where it was found (`managed`, `flag`, `project`, `user`, `plugin`); why a definition could not be read; and why a model could not be told |
| `requested_effort` | For an agent call: the call's own `effort` parameter, when it sets one |
| `permission` | For a call routing changed: the permission decision returned |
| `routing`, `routing_reason` | For `launch`, `agent-call` and `agent-result` lines: what routing did (`off`, `yielded`, `inherit`, `routed`) and why ([Routing](configuration.md#when-routing-yields)). A line for a refused configuration or a failed hook records `off` with `config-invalid` or `error` |
| `routing_env` | For a route that yielded to the environment: the variable |
| `route_model`, `route_value`, `route_effort`, `route_option` | For a routed task: the model the route selects, what noonsight passed (an alias for a subagent), the effort it set, and the position of the chosen option in its row |
| `route_effort_kept`, `route_effort_overridden_by` | `true` when the caller's own effort was kept; `CLAUDE_CODE_EFFORT_LEVEL` when that variable wins over the routed effort |
| `route_from`, `route_skipped` | For a route that consulted a row: whether it was the scope's row (`table`) or `default`, and the options passed over, with why |
| `subagent_id`, `predicted`, `models_used`, `result` | For `agent-result`: the subagent's agent id, the model predicted for it, the models it switched between, and the check's `result` |
| `install` | `managed` or `account`: which install ran the hook |
| `project`, `project_status` | When the session's directory has a project configuration: the project directory, and what became of the project: `applied`, `untrusted`, `declined`, `ignored` (`"projects.allow": "none"`) or `refused` ([Project configuration](configuration.md#project-configuration)) |
| `model`, `from_model` | The normalized model identifiers; on a session start, `from_model` is the model of the resumed conversation's record when the session runs on another one |
| `model_source` | For the session: `hook-input`, `session-record`, `process-record`, `session-transcript` (a resumed conversation's last response), `claude-args` (the `--model` argument), `env` (`ANTHROPIC_MODEL`), `settings`, or null when no model was known. For a subagent: the prediction's source (see [Subagents](#subagents)) |
| `model_from` | For a model taken from the launch settings: `--model`, `ANTHROPIC_MODEL`, `--settings`, the settings file that set it, or `--model of the background job` for a `/fork` session |
| `chosen_model`, `reported_model` | When Claude Code runs another model in place of the one the person chose, as in plan mode on Haiku: on a switch and a session start, the chosen model; on a session start, the model its input reported ([SessionStart](#sessionstart)) |
| `fork_origin`, `forked_from` | For a fork's start: how the conversation it copied was found (`fork-transcript`, `background-job`, `resume-argument`, `continue`, or `unknown`), and that conversation's session id ([Forks](#forks)) |
| `model_alias`, `alias_from` | When that source named an alias: the alias, and what resolved it (`built-in` or the `ANTHROPIC_DEFAULT_*_MODEL` variable) |
| `model_unresolved`, `unresolved_why` | When a launch setting names a model noonsight cannot tell: the value, and why |
| `status` | `matched`, `none`, `undeclared`, `config-invalid`, `error` |
| `reason`, `key`, `rules`, `sha256` | As in `noonsight resolve` ([configuration.md](configuration.md)) |
| `scope`, `place`, `unknown_scope` | The declared scope and the place the rules were resolved for (`attended`, `unattended` or `subagent`), and a scope that was asked for but is not declared. Lines written before the place was named `attended` say `session` for it; `noonsight report` and the experiments' readers count both as `attended` |
| `scope_source` | `env` (`NOONSIGHT_SCOPE`), `task-text`, `classifier`, or null when there was no scope |
| `scope_matcher` | For a scope taken from the task text: the matcher that decided, as the configuration writes it |
| `classifier` | With `classifier.mode` on, for a task the classifier was meant to place: `scoped` (it gave a declared scope), `none` (it found that no scope fits), `failed`, `timeout`, `invalid` (it answered outside the declared scopes), `not-needed` (the scope could change neither the rules nor the route, so it was not asked) or `no-task` (a launch with no task text). Absent when no classification was due ([The classifier](configuration.md#the-classifier)) |
| `classifier_ms`, `classifier_error`, `classifier_cost_usd` | For a task the classifier was asked about: how long it took, why it gave no scope, and the cost Claude Code reported for the call |
| `matcher_scope` | With `classifier.mode` set to `always`: the scope a matcher had chosen before the classifier decided |
| `unattended_because` | For a session in the place `unattended`: `env` when a variable of `session.unattended_when_env` put it there, `headless` when it runs headless |
| `unattended_env` | For a session a variable of `session.unattended_when_env` put in the place `unattended`: that variable |
| `task_text_cut` | `true` for a subagent whose description and task text are longer than the matchers read, so the scope may be missing because the matching text was cut ([Scopes](configuration.md#scopes)) |
| `delivered` | `rules`, `rules+note`, `note`, `already-delivered`, `nothing`, as the hook returned them to Claude Code; `launcher` for a session start that found the rules in the system prompt `noonsight run` gave; `system-prompt` for a launch that added them; `at-start` for an agent call whose rules its subagent's start gives; and for a subagent with `subagents.delivery` set to `off`, `off` |
| `launch_file`, `launch_model` | For a session start under `noonsight run` with rules in the system prompt: the launcher's file, and the model its rules are for |
| `preset_update` | For a session start warned about a preset update: the version the configuration accepted (`accepted`), the installed one (`installed`), and whether the session kept the accepted version's rules (`held`) |
| `warned` | Whether the person was shown a warning |
| `problems` | For `config-invalid`, how many problems the configuration has |

What each session last received is kept in `~/.local/state/noonsight/sessions/` and `processes/`, one small file per session id and per Claude Code process, and the triggers each session revealed in `triggers/`; files nobody wrote for 30 days are removed, and so are the system prompt files of `noonsight run` in `launch/`.
This account's trust in each project is kept in `~/.local/state/noonsight/projects.json`, which `noonsight trust` and `noonsight untrust` write and nothing removes.
The subagent records in `agent-calls/`, `agent-pools/`, `agent-starts/`, `agent-links/`, `agent-pending/` and `agents/` are removed after 7 days; a call whose result never came, because another hook denied it, leaves its record until then.

## Turning noonsight off

| Way | Reach |
| --- | --- |
| `NOONSIGHT_DISABLE=1` in the environment that starts Claude Code | That session and everything it starts; no output and no log line. The classifier's own session runs with it, so noonsight's hooks never act there |
| `NOONSIGHT_ROUTING=off` in the environment that starts Claude Code or `noonsight run` | Routing only, for that session and its subagents; the rules are still delivered |
| `"subagents": { "delivery": "off" }` in the configuration | Subagents only: they get no rules, calls are left alone unless routing changes them, and their results are not checked; each call still gets a log line |
| No configuration file for the account | Every session of that account, silently |
| `noonsight uninstall` | Every new session reached by that install |

`disableAllHooks` in a person's own settings turns off a per-account install, but not the machine-wide one: Claude Code does not let it reach managed hooks.
