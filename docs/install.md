# Installing the hooks

noonsight reaches Claude Code through seven official settings hook entries: `SessionStart`, `PostModelSwitch` and `PostToolUse` on Edit and Write for the session itself, and `PreToolUse`, `PermissionRequest` and `PostToolUse` on the agent tool and `SubagentStart` for the subagents it starts.
`noonsight install` puts them in place, `noonsight uninstall` takes them out, and `noonsight check` says whether they will run.
[hooks.md](hooks.md) describes what the hooks do once they run.
This is the recommended install; [As a Claude Code plugin](#as-a-claude-code-plugin) describes the alternative.

## The one command

```bash
npm install -g noonsight   # puts `noonsight` on PATH
noonsight install
```

`npx noonsight install` does the same with nothing installed first, but the hooks then run the copy in npm's cache: once that cache is cleared they deliver nothing, and `noonsight check` reports the missing copy.
From a clone of this repository, `npm install && npm run build && npm link` puts `noonsight` on PATH instead.

On a clean machine `noonsight install` is all of the setup.
It takes these steps in order, and a step with a command named in brackets does what that command does, with no logic of its own:

1. **The configuration** [`noonsight init`].
   When `~/.config/noonsight/noonsight.json` (or the file `NOONSIGHT_CONFIG` names) does not exist, it is written from the preset, declaring every model the preset has rules for with `"use": "preset"` and recording the preset's version as `preset_version`.
   A file that exists is never opened for writing, and the output says it was left as it is.
   When this account cannot write it, the command stops here, before any hook is written, and says which path it could not write.
2. **The hooks.**
   They go into every Claude Code configuration directory of your account, as [described below](#every-login-of-your-account-the-default).
3. **What each model receives.**
   One line per declared model, with what it receives with no scope in each place: an attended session, an unattended session and a subagent, with `nothing` written out where it receives nothing, and the rules a trigger adds once the session does what the trigger names.
   Where a place receives nothing, the line names the preset rules that are off there, and ends by saying that your own rules without `where` are delivered there too and that `enable` turns on a rule that is off.
   With the preset, an attended Opus 5.5 or Fable 5.2 session receives nothing in any scope: their rules for that place, such as `opus-5-5/progress-updates`, ship off, and every rule of theirs that ships on is for unattended sessions or subagents.
   An attended Sonnet 5.5 or Haiku 5.5 session receives `verify-changes` once it edits a code file its git repository tracks, and their other attended rules only with a scope.
   Two lines follow with the two ways to change that.
   The place: a session is unattended when it runs headless, as `claude -p` and the Agent SDK do, or when a variable of `session.unattended_when_env` is set, which a CI or an orchestrator whose interactive sessions nobody watches can name ([configuration.md](configuration.md#keys)).
   The scope: a rule limited to scopes reaches a session only when it has one of them, set with `NOONSIGHT_SCOPE` or `noonsight run --scope`; a subagent gets the scope its task matches, or the one the classifier gives it when the classifier is on.
   `noonsight models` lists every rule with its scopes and places.
4. **The check** [`noonsight check`].
   Its lines are printed as they are, except the lines on what each model receives, which step 3 already printed.
5. **The summary.** One line says what changed (the configuration file written, hooks added to N directories), or that nothing changed.
   A last line says it is done, so that each session receives what the lines of step 3 give its model in its place and scope, or, when the check reports a problem, that it is not done yet.

The exit status covers what the command set up: 0 once the hooks and a valid configuration are in place, 1 when it could not write the hooks or the configuration file, and 2 when the configuration is refused, which also says that sessions get no rules until it is fixed.
A problem the check reports elsewhere on the machine, such as another login without the hooks or a Claude Code too old for the hooks, is printed and leaves the status at 0; `noonsight check` exits 1 for it.

Running it again changes nothing: the existing configuration is kept, the hooks are already in place, and the summary says so.
After it, the first Claude Code session already receives what the configuration gives its model in that scope and place, and `noonsight report` lists each rule delivered with its model, scope and place.
With the preset, an attended Sonnet session with no scope gets no rule at its start, the same session with `NOONSIGHT_SCOPE=build` gets `verify-changes`, and a `claude -p` run on Sonnet, which is unattended, gets `carry-through`.

`--account <dir>` runs the same steps for one directory.
`--managed` only installs the hooks, because it runs as an administrator and the configuration belongs to each account.

To undo it, `noonsight uninstall` removes the hooks and the hook pointer, as [Uninstall](#uninstall) says.
The configuration file is yours, so uninstall leaves it: delete `~/.config/noonsight/noonsight.json` by hand to remove it too.
The decision log stays in `~/.local/state/noonsight/`.

## The three installs of the hooks

There are three ways to install the hooks:

| Command | Reaches | Rights |
| --- | --- | --- |
| `noonsight install` (the default) | Every Claude Code login of your account on this machine | None |
| `noonsight install --account <dir>` | One Claude Code configuration directory | None |
| `sudo ... noonsight install --managed` | Every account on the machine, except logins whose organization delivers server-managed settings | Administrator |

An optional watcher, off unless you turn it on, adds the per-account hooks to each new login as it appears; see [New logins as they appear](#new-logins-as-they-appear-optional).

If you prefer installing noonsight as a Claude Code plugin, Claude Code itself can install the same hooks; see [As a Claude Code plugin](#as-a-claude-code-plugin).

## Every login of your account (the default)

```bash
noonsight install
```

Claude Code keeps each login's settings in its own configuration directory: `~/.claude` by default, or the directory `CLAUDE_CONFIG_DIR` points at, as in `alias claude-work='CLAUDE_CONFIG_DIR=~/.claude-work claude'`.
`noonsight install` with no option adds noonsight's hooks to the user settings (`<dir>/settings.json`) of every one of them it finds:

- `~/.claude`, created if Claude Code has not run yet;
- the directory in `CLAUDE_CONFIG_DIR`, when the shell running `install` sets it;
- every directory directly in your home directory that holds a Claude Code configuration, recognized by the `.claude.json` file Claude Code keeps in a directory it was started with through `CLAUDE_CONFIG_DIR`;
- every directory noonsight installed into before.

It needs no administrator rights.
It adds one entry per event to each settings file, in a matcher group of its own, and keeps everything else in the file, other hooks included.
The two tool events match only the agent tool, under both of its names (`"matcher": "Agent|Task"`), so noonsight runs for no other tool call.
Running it again changes nothing, and it repairs an entry of its own that was moved, duplicated, points at an old place or has another matcher.
On an install from before the subagent hooks, running it again adds them.
Every settings file is checked before any is written: one that is not valid JSON, or whose `hooks` do not have the documented shape, refuses the whole install, and every directory is left as it was.
The hook pointer goes to `~/.local/share/noonsight/noonsight-hook`, and each directory is recorded in `~/.local/state/noonsight/installs.json`.

A configuration directory made later is not reached until `noonsight install` runs again, or until the [watcher](#new-logins-as-they-appear-optional) installs into it; `noonsight check` lists it as a problem until then.
A directory kept somewhere other than directly in the home directory is found only while `CLAUDE_CONFIG_DIR` names it, or with `--account`.

The default install covers the account that runs it.
Run with `sudo` for another account's home directory, it refuses and writes nothing, because an administrator writing that account's settings would leave it files it cannot change.
On a machine shared by several people, each runs `noonsight install` once, or an administrator uses `--managed` below.

### Why it is the default

Claude Code ranks its managed sources: server-managed settings, delivered from the claude.ai admin console to Team and Enterprise organizations, come first, then an MDM profile, then the managed settings files ([How Claude Code combines managed sources](https://code.claude.com/docs/en/managed-settings#how-claude-code-combines-managed-sources)).
By default it applies only the highest-ranked source that delivers at least one policy key and ignores the rest, without a warning.
So on a login whose organization delivers server-managed settings, Claude Code ignores every managed settings file, noonsight's included, and the machine-wide hooks never run.
Another login on the same machine, such as a personal Pro or Max one, still runs them.
Only the organization can change that, by setting `managedSourcesBehavior` to `"merge"` in its highest-ranked source; a lower source cannot opt itself in ([Compose every managed source](https://code.claude.com/docs/en/managed-settings#compose-every-managed-source)).

User settings sit outside that ranking.
Claude Code reads `~/.claude/settings.json` (or the one in `CLAUDE_CONFIG_DIR`) on every login and runs its hooks for all of that login's projects ([Hook locations](https://code.claude.com/docs/en/hooks#hook-locations), [Settings precedence](https://code.claude.com/docs/en/settings#settings-precedence)).
Installing into every configuration directory therefore reaches every login, with no administrator rights and no per-login step.
The only thing that stops it is an organization that turns user hooks off for its logins, with `allowManagedHooksOnly` or `disableAllHooks` in its managed settings ([allowManagedHooksOnly](https://code.claude.com/docs/en/settings-reference#allowmanagedhooksonly)); `noonsight check` reports that case.

### How check sees server-managed settings

Claude Code caches the server-managed settings of a login in that login's configuration directory, as `remote-settings.json`, and deletes the cache on logout ([Server-managed settings](https://code.claude.com/docs/en/server-managed-settings#invalid-entries-in-delivered-settings)).
`noonsight check` and `noonsight install --managed` read that cache: when it holds a policy key and does not set `managedSourcesBehavior` to `"merge"`, Claude Code ignores the managed settings files for that login.
Before the first launch of a login, there is no cache yet and nothing to read; `/status` inside Claude Code names the managed source in use.
Claude Code fetches server-managed settings only when the session talks to Anthropic's API directly, so behind another provider or API address the cache does not apply.

## One configuration directory

```bash
noonsight install --account ~/.claude-work
```

`--account` installs into one Claude Code configuration directory only, with no administrator rights, exactly as the default install does for each directory it finds.
It is the way to reach a directory kept outside the home directory without setting `CLAUDE_CONFIG_DIR`.

## New logins as they appear (optional)

```bash
noonsight watch enable    # turn the watcher on
noonsight watch disable   # turn it off
```

The watcher is off by default.
Neither `noonsight install` nor anything else turns it on; only `noonsight watch enable` does.
When it is on, a Claude Code configuration directory made in your home directory gets noonsight's hooks without anyone running `noonsight install` again.
The watcher sees a new directory as soon as it appears, then checks for its marker every 100 ms for ten seconds, and every five seconds after that for as long as the directory stays there without one.

### What it does

`noonsight watch enable` writes one per-user service file and starts it:

| System | Service file | Kept running by |
| --- | --- | --- |
| macOS | `~/Library/LaunchAgents/io.github.bpsanti.noonsight.watch.plist` | launchd, with `RunAtLoad` and `KeepAlive` |
| Linux | `~/.config/systemd/user/noonsight-watch.service` (under `$XDG_CONFIG_HOME` when it is set) | the systemd user manager, enabled for `default.target`, with `Restart=always` |

The service starts at every login and runs `noonsight watch run`: one resident Node.js process for the account, which is idle while nothing changes in the home directory, apart from one check every five seconds for each new directory that has no marker yet.
Like the hook pointer, it runs the Node.js and the copy of noonsight that ran `enable`, by absolute paths.
After moving or upgrading either one, run `noonsight watch enable` again; `noonsight check` warns until then.
The service file records the noonsight version, so an upgrade at the same path counts too: `enable` restarts the watcher on the new code.
Running `enable` again with nothing changed writes nothing.

The process watches only the entries directly in the home directory, without recursion.
Writes below them, in a project, in `~/Library` or inside a Claude Code configuration directory, never wake it.
Claude Code rewrites `~/.claude.json` often; each rewrite wakes the watcher for one check of that entry, and nothing is written.

When a new directory appears directly in the home directory, the watcher waits for the `.claude.json` file that marks a Claude Code configuration directory, the same marker the default install looks for, because Claude Code writes it just after it creates the directory.
It checks every 100 ms for the first ten seconds, then every five seconds, until the marker appears or the directory goes away.
It then installs the hooks into that directory alone, as `noonsight install --account <dir>` does, so a broken settings file in another login does not hold it back.
It only installs the hooks: it neither writes the configuration file nor runs the check.
`~/.claude` is installed into without a marker, because Claude Code keeps that directory's marker in the home directory.
A directory that never gets the marker is checked every five seconds for as long as it stays, which costs almost nothing; a marker written later still gets it installed.

An install writes the new directory's `settings.json`, and the hook pointer and the list of installs under `~/.local`, which it creates when it is missing.
`enable` creates `~/.local/state/noonsight` if it is missing, for the log.

What happens is appended to `~/.local/state/noonsight/watch.log`, and `noonsight check` shows its last line.

The watcher reacts only to directories made after it started.
One that was already there, made while the watcher was off, or kept outside the home directory or deeper in it, is left to `noonsight install`, and `noonsight check` lists it until then.

### What it cannot cover

The watcher writes the hooks into a new configuration directory a fraction of a second after Claude Code creates it, before Claude Code shows its first screen.
Whether the first session of the new login starts with them depends on when Claude Code reads its settings, which differs between the two ways of starting it.
The behavior below was measured with Claude Code 2.1.327 on macOS ([verification](verification/claude-code.md#checked-live)).

- **The first interactive session receives the rules.**
  An interactive session starts with the hooks that are in `settings.json` when the theme is confirmed on Claude Code's first screen.
  The watcher has written them before that screen appears, so the first session received the rules in every run, even with the theme confirmed the moment it showed.
  Only a watcher held up past that moment, such as on a heavily loaded machine, would leave the first session without them; the session then receives them after `/clear` or `/model`.
- **The first `claude -p` receives the rules only when Claude Code waits for server-managed settings.**
  `claude -p` reads `settings.json` as it starts, while the new directory has no hooks yet, and runs `SessionStart` with what it read then; it notices the hooks the watcher wrote only after that.
  On a login whose organization delivers [server-managed settings](#why-it-is-the-default), Claude Code first waits for those settings and reads its settings files again, by which time the watcher has written the hooks, so the first `claude -p` receives the rules.
  When Claude Code does not wait for server-managed settings, the first `claude -p` starts without the rules, and the next one receives them.
  That case was measured with the fetch failing (the API address pointed at a closed port), not on a login that has no server-managed settings, such as a personal Pro or Max one.

Every later session of that login receives the rules from its start.
To close the gap entirely, for instance when logins are made by a script, create the configuration directory and run `noonsight install --account <dir>` before the first `claude` that uses it.

### Turning it off

```bash
noonsight watch disable
```

It stops the service and removes the one service file `enable` wrote, and nothing else; on Linux it also disables the unit, which removes its link in `default.target.wants`.
If that file was removed by hand while the watcher ran, on Linux `disable` only stops the unit by name, and the link may remain in `default.target.wants`; the command output names it.
A service file at that path that noonsight did not write is left alone, and both commands refuse to touch it.
The hooks the watcher installed stay, like any other install; `noonsight uninstall` removes them.
The log stays in `~/.local/state/noonsight/watch.log`.

## Machine-wide, for every account (--managed)

```bash
sudo "$(command -v node)" "$(command -v noonsight)" install --managed
```

`--managed` installs once for the whole machine, in Claude Code's managed settings files, so every account on it gets the hooks, except on logins whose server-managed settings make Claude Code ignore those files (see [Why it is the default](#why-it-is-the-default)).
`install --managed` warns about each such login it can see in the home directory of the account running it.
The managed settings files live in a system directory, so `--managed` needs administrator rights once.
Without them it says so, changes nothing, and prints two ways forward: the exact `sudo` command for this machine, with absolute paths, and the default install.
The absolute paths matter because `sudo` usually runs with a short `PATH` that does not include a Node.js installed by a version manager.

It writes two files:

| System | Settings file | Hook pointer |
| --- | --- | --- |
| macOS | `/Library/Application Support/ClaudeCode/managed-settings.d/noonsight.json` | `/Library/Application Support/noonsight/noonsight-hook` |
| Linux | `/etc/claude-code/managed-settings.d/noonsight.json` | `/usr/local/lib/noonsight/noonsight-hook` |

Windows is not supported yet.
Claude Code reads machine-wide settings from `C:\Program Files\ClaudeCode\` there, but the hook pointer is a POSIX shell script that has not been verified on Windows.

### Why a file of its own

Claude Code reads `managed-settings.json` and then every `*.json` file in `managed-settings.d/`, in alphabetical order, and merges them; hook lists from different files are combined ([Deploy managed settings](https://code.claude.com/docs/en/managed-settings)).
noonsight writes only its own file in that directory.
It never edits `managed-settings.json` or another file there, so a policy an IT team deployed stays byte for byte as it was, and uninstalling removes one file.
Running `noonsight install --managed` again changes nothing.

### What managed settings change

- **The built-in guard for mods.**
  On a machine with managed settings, Claude Code loads its built-in guard ahead of every mod a user installs.
  The guard keeps users' mods from changing what managed hooks and managed instructions receive, and from approving tool calls that permission rules or `PreToolUse` hooks refuse.
  See [Manage mods for your organization](https://code.claude.com/docs/en/plugins/mods/admin#know-what-happens-by-default).
- **Turning hooks off.**
  `disableAllHooks` in a person's own settings does not reach managed hooks.
  To silence noonsight for one session, start Claude Code with `NOONSIGHT_DISABLE=1` in the environment.
- **Which managed source wins.**
  Server-managed settings outrank the files, as above, and so does an MDM profile: when it delivers a policy, Claude Code ignores the files unless it sets `managedSourcesBehavior` to `"merge"`.
  `noonsight check` warns about an MDM profile on macOS.
  On such a login, use the default install.
- **Every account runs the hooks.**
  The hooks run as the account that owns each session, and read that account's configuration (`~/.config/noonsight/noonsight.json`).
  An account with no configuration gets nothing and sees no warning.
  The hook pointer runs the Node.js and the copy of noonsight that ran `install`; an account that cannot read them gets nothing either, so install noonsight where every account that should get rules can read it.

With both a machine-wide install and an install in a configuration directory, Claude Code runs both in that login whenever it applies the managed settings files; each event is still delivered once ([hooks.md](hooks.md#one-delivery-per-event)), and `install` and `check` name the logins where one of the two is enough.

## As a Claude Code plugin

`noonsight install`, from npm, is the recommended install.
If you prefer installing a Claude Code plugin, the npm package is one too, and the repository is its marketplace.
Claude Code downloads the plugin from npm.

```text
/plugin install noonsight --marketplace bpsanti/noonsight
```

The one-line form needs Claude Code 2.1.275 or later, and the download needs `npm`; from a shell, `claude plugin marketplace add bpsanti/noonsight` and `claude plugin install noonsight@noonsight` do the same.
Then start a new session: `/reload-plugins` registers the hooks in a running one, but the rules come with its next start, such as `/clear`.

| | `noonsight install` (npm, recommended) | Plugin |
| --- | --- | --- |
| Reach | Every Claude Code login of your account, and new ones with `noonsight watch` | The one login it was installed in; a login added later needs its own install |
| Machine-wide | `--managed` | Not covered here |
| `noonsight` in a shell, `noonsight run` | Yes | No: the commands are skills, such as `/noonsight:check` |
| Node.js | The one that ran `install`, by absolute path | Found when a hook runs, as described below |
| Updates | Update the package, then run `noonsight install` again | `claude plugin update noonsight@noonsight`, or auto-update for the marketplace under `/plugin`; a marketplace that is not Anthropic's does not update by itself |
| `strictPluginOnlyCustomization` with `hooks` (managed) | Claude Code stops the account hooks | Runs, as Claude Code's documentation says; not tested |
| `allowManagedHooksOnly` (managed) | Only `--managed` runs | Runs only when managed settings enable this plugin |
| Remove | `noonsight uninstall` | `claude plugin uninstall noonsight@noonsight` |

Both use the same configuration, `~/.config/noonsight/noonsight.json`, the same decision log and the same trust in projects, so moving from one to the other changes none of them.
The plugin is for a login, not for a repository: install it in user scope, and share a repository's rules with [`.noonsight/noonsight.json`](configuration.md#project-configuration).

### The first session

With no configuration file, the first session that starts under the plugin writes it from the preset, as `noonsight install` does, and says so once.
It never replaces a file, and it never creates the file `NOONSIGHT_CONFIG` names: a missing one is reported, as under any install.

### Both at once

Use one of them.
Having both is safe: Claude Code runs both copies of each hook, and the first to claim an event delivers it while the other does nothing ([hooks.md](hooks.md#one-delivery-per-event)).
When the two copies are different versions, the one that runs first decides which preset a session gets, so `noonsight check` warns about both installs in one login and names the versions when they differ.

- To move to the plugin: install it, then run `noonsight uninstall --account <dir>` for that login, and `noonsight watch disable` if the watcher is on.
- To move back: `claude plugin uninstall noonsight@noonsight`, then `noonsight install`.

The order does not matter.
`noonsight install` and `noonsight watch enable` refuse to run from the copy a plugin holds, since Claude Code deletes that folder some time after an update and the hook pointer would then run nothing.

### Node.js

The plugin's hooks need Node.js 20 or newer on the machine, and macOS or Linux, since the launcher is a POSIX shell script that has not been verified on Windows.
A Claude Code started from a desktop app may have no `node` on its `PATH`, so the plugin's launcher looks in this order: the path in `NOONSIGHT_NODE`, which can be set under `env` in the Claude Code settings; the Node.js an earlier hook ran on, kept in `~/.local/share/noonsight/node`; `PATH`; and the folders Homebrew, Volta, nvm, asdf, mise, fnm and nodenv use.
With none, a session goes on without rules and its start says so.

### Commands

`/noonsight:setup` writes the configuration when there is none and checks everything; `/noonsight:check`, `/noonsight:report`, `/noonsight:resolve`, `/noonsight:models`, `/noonsight:accept`, `/noonsight:trust` and `/noonsight:untrust` run the command of the same name.
Only the person runs them, the model is not offered them, and each costs a turn, since the model repeats the output.
They need skills to be allowed to run commands: `disableSkillShellExecution` in the settings replaces the output with a placeholder.

## The hook pointer

The settings entries do not call Node.js or noonsight directly.
They call `noonsight-hook`, a small shell script that runs the Node.js and the copy of noonsight that wrote it, by absolute path:

```json
{
  "SessionStart": [
    { "hooks": [{ "type": "command", "command": "/Users/me/.local/share/noonsight/noonsight-hook", "args": ["session-start"], "timeout": 10 }] }
  ],
  "PreToolUse": [
    { "matcher": "Agent|Task", "hooks": [{ "type": "command", "command": "/Users/me/.local/share/noonsight/noonsight-hook", "args": ["agent-call"], "timeout": 10 }] }
  ]
}
```

`PostModelSwitch` runs it with `model-switch`, `SubagentStart`, with no matcher, with `subagent-start`, and `PostToolUse` twice, in two matcher groups: with the same matcher as `PreToolUse`, with `agent-result`, and with the matcher `Edit|Write`, with `file-edit`.
An install made before noonsight used `SubagentStart` lacks that entry, so its subagents get no rules, and one made before triggers lacks the `Edit|Write` entry, so its sessions never reveal `code-edit` ([hooks.md](hooks.md#posttooluse-on-edit-and-write-the-triggers)); `noonsight check` reports either, and running `noonsight install` again adds them.

The pointer runs `noonsight hook --install <account|managed> <event>` with that argument (`--install` names the install that ran it, which the decision log records as `install`; the [plugin](#as-a-claude-code-plugin)'s launcher passes `plugin`), the hook adapter, which reads the hook input on stdin, prints at most one JSON object and always exits 0; it is not meant to be run by hand, and unlike every other command it prints no usage, since Claude Code would show it as a hook error.
So the hook does not depend on the `PATH` of whatever started Claude Code, and installing a new copy of noonsight rewrites only the pointer, never a settings file.
If the copy it points at is removed, the pointer exits quietly and `noonsight check` reports it.

## Moving from sextant

noonsight was called sextant before (the package `sextant-ai`, the command `sextant`).
noonsight does not read sextant's names, and `noonsight install` leaves a sextant install as it is, so move one by hand, as the account that made it:

1. With the old command still installed, remove sextant's hooks and watcher: `sextant watch disable`, then `sextant uninstall` (and `sudo "$(command -v node)" "$(command -v sextant)" uninstall --managed` for a machine-wide install).
   Without it, delete the hook entries that run `sextant-hook` from each `settings.json`, `~/.local/share/sextant/`, `managed-settings.d/sextant-ai.json`, the machine-wide pointer's directory (`/Library/Application Support/sextant/` on macOS, `/usr/local/lib/sextant/` on Linux), and the watcher's service file (`~/Library/LaunchAgents/io.github.bpsanti.sextant-ai.watch.plist` on macOS, after `launchctl bootout`; `~/.config/systemd/user/sextant-watch.service` on Linux, after `systemctl --user disable --now sextant-watch.service`).
2. If you want to keep them, move `~/.config/sextant/` to `~/.config/noonsight/` (renaming `sextant.json` to `noonsight.json` and pointing its `$schema` at `schema/noonsight.schema.json`) and `~/.local/state/sextant/` to `~/.local/state/noonsight/`.
3. Rename every `SEXTANT_*` variable you set to `NOONSIGHT_*`.
4. Run `noonsight install`, and `noonsight watch enable` if the watcher was on.

## Uninstall

```bash
noonsight uninstall                                                       # every configuration directory
noonsight uninstall --account ~/.claude-work                              # one directory
sudo "$(command -v node)" "$(command -v noonsight)" uninstall --managed   # machine-wide
```

`uninstall` removes noonsight's own entries and its hook pointer, and nothing else.
With no option it visits every configuration directory the default install would find, and every directory noonsight recorded installing into, even one `CLAUDE_CONFIG_DIR` no longer names.
The machine-wide install's file is removed whole.
The per-account pointer stays while another directory still uses it.
A recorded directory that no longer exists is forgotten and no longer keeps the pointer; one that cannot be reached now, such as on an unmounted volume, is kept.
Rules a running session already received stay in that session.
`uninstall` does not stop the [watcher](#new-logins-as-they-appear-optional); while it is on, a new configuration directory still gets the hooks, so `noonsight watch disable` is the step that keeps them out.

## Check

`noonsight check` prints one line per finding, each starting with `ok`, `warning` or `problem`:

- whether the configuration is valid;
- the declared scopes, with a warning for each pair that overlaps (matchers that match the same text), and the scope and place a session started from the same environment gets ([Scopes](configuration.md#scopes));
- the machine-wide install and every configuration directory of this account: whether all four entries are there with their matchers (an install from before the subagent hooks is reported, with what is missing), their hook pointers, whether the Node.js and the copy of noonsight they run still exist and this account can run them, and the version of noonsight they run;
- each configuration directory no install reaches, including a login whose server-managed settings make Claude Code ignore the machine-wide install;
- server-managed settings that turn hooks off for a login (`disableAllHooks`, `allowManagedHooksOnly`);
- managed settings files that stop hooks from running (`disableAllHooks`), that make per-account hooks ignored (`allowManagedHooksOnly`), or that Claude Code cannot read;
- logins that both a machine-wide install and an install of their own reach;
- noonsight's plugin in each login: its version and folder, whether it is on, and whether an install reaches the same login;
- whether the watcher is off or on, whether its service runs, whether it runs this copy of noonsight, and the last line of its log;
- whether the installed `claude` is recent enough;
- the last decision in the log.

It exits 0 when there is no problem, 1 when there is one, and 2 when the configuration is missing or refused.
It reads local files, runs `claude --version`, and, when the watcher is on, asks launchd or systemd whether its service runs; it never uses the network and changes nothing.
