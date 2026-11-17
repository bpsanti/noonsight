# Installing the hooks

noonsight reaches Claude Code through six official settings hook entries: `SessionStart`, `PostModelSwitch` and `PostToolUse` on Edit and Write for the session itself, and `PreToolUse` and `PostToolUse` on the agent tool and `SubagentStart` for the subagents it starts.
`noonsight install` puts them in place, `noonsight uninstall` takes them out, and `noonsight check` says whether they will run.
[hooks.md](hooks.md) describes what the hooks do once they run.

## The one command

From a clone of this repository, until the package is published:

```bash
npm install && npm run build && npm link   # puts `noonsight` on PATH
noonsight install
```

Once version 0.1 is published, `npx noonsight install` becomes the whole route.
On a clean machine `noonsight install` is all of the setup.
It takes these steps in order, and a step with a command named in brackets does what that command does, with no logic of its own:

1. **The configuration** [`noonsight init`].
   When `~/.config/noonsight/noonsight.json` (or the file `NOONSIGHT_CONFIG` names) does not exist, it is written from the preset, declaring every model the preset has rules for with `"use": "preset"`.
   A file that exists is never opened for writing, and the output says it was left as it is.
   When this account cannot write it, the command stops here, before any hook is written, and says which path it could not write.
2. **The hooks.**
   They go into every Claude Code configuration directory of your account, as [described below](#every-login-of-your-account-the-default).
3. **What each model receives** [`noonsight models`].
   One line per declared model: how many of its rules are on, and for each the places it is delivered in.
   A rule is delivered only where its scope and place apply.
   A session with no scope receives only the rules its model has for every scope in that place; the preset has none for the `session` place, so with it such a session gets no rule.
   A rule limited to scopes reaches a session only when it has one of them, set with `NOONSIGHT_SCOPE` or `noonsight run --scope`.
   A subagent gets the scope its task matches, or the one the classifier gives it when the classifier is on.
4. **The check** [`noonsight check`].
   Its lines are printed as they are.
5. **The summary.** One line says what changed (the configuration file written, hooks added to N directories), or that nothing changed.
   A last line says it is done and repeats which sessions get rules, or, when the check reports a problem, that it is not done yet.

The exit status covers what the command set up: 0 once the hooks and a valid configuration are in place, 1 when it could not write the hooks or the configuration file, and 2 when the configuration is refused, which also says that sessions get no rules until it is fixed.
A problem the check reports elsewhere on the machine, such as another login without the hooks or a Claude Code too old for the hooks, is printed and leaves the status at 0; `noonsight check` exits 1 for it.

Running it again changes nothing: the existing configuration is kept, the hooks are already in place, and the summary says so.
After it, the first Claude Code session already receives what the configuration gives its model in that scope and place, and `noonsight report` lists each rule delivered with its model, scope and place.
With the preset, a Sonnet session with no scope gets no rule, and the same session with `NOONSIGHT_SCOPE=build` gets `verify-changes`.

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

Claude Code decides early which hooks the first session of a new login starts with, and in two cases that is before the watcher can write them.

- **The first `claude -p` with a new configuration directory.**
  Claude Code runs `SessionStart` right after it creates the directory, which can be before the watcher has written the hooks.
  That first session starts without the rules.
- **The first interactive session, when the theme is confirmed first.**
  The session starts with the hooks that were in `settings.json` when the theme is confirmed on Claude Code's first screen.
  If that happens before the watcher has written them, the session starts without the rules, and receives them after `/clear` or `/model`.

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

With both a machine-wide install and an install in a configuration directory, sessions of that login receive the rules twice whenever Claude Code applies the managed settings files; `install` and `check` name the logins where that happens.

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
- logins that would receive the rules twice;
- whether the watcher is off or on, whether its service runs, whether it runs this copy of noonsight, and the last line of its log;
- whether the installed `claude` is recent enough;
- the last decision in the log.

It exits 0 when there is no problem, 1 when there is one, and 2 when the configuration is missing or refused.
It reads local files, runs `claude --version`, and, when the watcher is on, asks launchd or systemd whether its service runs; it never uses the network and changes nothing.
