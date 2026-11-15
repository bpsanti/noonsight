# Installing the hooks

sextant reaches Claude Code through two official settings hooks, `SessionStart` and `PostModelSwitch`.
`sextant install` puts them in place, `sextant uninstall` takes them out, and `sextant check` says whether they will run.
[hooks.md](hooks.md) describes what the hooks do once they run.

There are three ways to install:

| Command | Reaches | Rights |
| --- | --- | --- |
| `sextant install` (the default) | Every Claude Code login of your account on this machine | None |
| `sextant install --account <dir>` | One Claude Code configuration directory | None |
| `sudo ... sextant install --managed` | Every account on the machine, except logins whose organization delivers server-managed settings | Administrator |

## Every login of your account (the default)

```bash
sextant install
```

Claude Code keeps each login's settings in its own configuration directory: `~/.claude` by default, or the directory `CLAUDE_CONFIG_DIR` points at, as in `alias claude-work='CLAUDE_CONFIG_DIR=~/.claude-work claude'`.
`sextant install` with no option adds sextant's hooks to the user settings (`<dir>/settings.json`) of every one of them it finds:

- `~/.claude`, created if Claude Code has not run yet;
- the directory in `CLAUDE_CONFIG_DIR`, when the shell running `install` sets it;
- every directory directly in your home directory that holds a Claude Code configuration, recognized by the `.claude.json` file Claude Code keeps in a directory it was started with through `CLAUDE_CONFIG_DIR`;
- every directory sextant installed into before.

It needs no administrator rights.
It adds one entry per event to each settings file and keeps everything else in the file, other hooks included.
Running it again changes nothing, and it repairs an entry of its own that was moved, duplicated or points at an old place.
Every settings file is checked before any is written: one that is not valid JSON, or whose `hooks` do not have the documented shape, refuses the whole install, and every directory is left as it was.
The hook pointer goes to `~/.local/share/sextant/sextant-hook`, and each directory is recorded in `~/.local/state/sextant/installs.json`.

A configuration directory made later is not reached until `sextant install` runs again; `sextant check` lists it as a problem until then.
A directory kept somewhere other than directly in the home directory is found only while `CLAUDE_CONFIG_DIR` names it, or with `--account`.

The default install covers the account that runs it.
Run with `sudo` for another account's home directory, it refuses and writes nothing, because an administrator writing that account's settings would leave it files it cannot change.
On a machine shared by several people, each runs `sextant install` once, or an administrator uses `--managed` below.

### Why it is the default

Claude Code ranks its managed sources: server-managed settings, delivered from the claude.ai admin console to Team and Enterprise organizations, come first, then an MDM profile, then the managed settings files ([How Claude Code combines managed sources](https://code.claude.com/docs/en/managed-settings#how-claude-code-combines-managed-sources)).
By default it applies only the highest-ranked source that delivers at least one policy key and ignores the rest, without a warning.
So on a login whose organization delivers server-managed settings, Claude Code ignores every managed settings file, sextant's included, and the machine-wide hooks never run.
Another login on the same machine, such as a personal Pro or Max one, still runs them.
Only the organization can change that, by setting `managedSourcesBehavior` to `"merge"` in its highest-ranked source; a lower source cannot opt itself in ([Compose every managed source](https://code.claude.com/docs/en/managed-settings#compose-every-managed-source)).

User settings sit outside that ranking.
Claude Code reads `~/.claude/settings.json` (or the one in `CLAUDE_CONFIG_DIR`) on every login and runs its hooks for all of that login's projects ([Hook locations](https://code.claude.com/docs/en/hooks#hook-locations), [Settings precedence](https://code.claude.com/docs/en/settings#settings-precedence)).
Installing into every configuration directory therefore reaches every login, with no administrator rights and no per-login step.
The only thing that stops it is an organization that turns user hooks off for its logins, with `allowManagedHooksOnly` or `disableAllHooks` in its managed settings ([allowManagedHooksOnly](https://code.claude.com/docs/en/settings-reference#allowmanagedhooksonly)); `sextant check` reports that case.

### How check sees server-managed settings

Claude Code caches the server-managed settings of a login in that login's configuration directory, as `remote-settings.json`, and deletes the cache on logout ([Server-managed settings](https://code.claude.com/docs/en/server-managed-settings#invalid-entries-in-delivered-settings)).
`sextant check` and `sextant install --managed` read that cache: when it holds a policy key and does not set `managedSourcesBehavior` to `"merge"`, Claude Code ignores the managed settings files for that login.
Before the first launch of a login, there is no cache yet and nothing to read; `/status` inside Claude Code names the managed source in use.
Claude Code fetches server-managed settings only when the session talks to Anthropic's API directly, so behind another provider or API address the cache does not apply.

## One configuration directory

```bash
sextant install --account ~/.claude-work
```

`--account` installs into one Claude Code configuration directory only, with no administrator rights, exactly as the default install does for each directory it finds.
It is the way to reach a directory kept outside the home directory without setting `CLAUDE_CONFIG_DIR`.

## Machine-wide, for every account (--managed)

```bash
sudo "$(command -v node)" "$(command -v sextant)" install --managed
```

`--managed` installs once for the whole machine, in Claude Code's managed settings files, so every account on it gets the hooks, except on logins whose server-managed settings make Claude Code ignore those files (see [Why it is the default](#why-it-is-the-default)).
`install --managed` warns about each such login it can see in the home directory of the account running it.
The managed settings files live in a system directory, so `--managed` needs administrator rights once.
Without them it says so, changes nothing, and prints two ways forward: the exact `sudo` command for this machine, with absolute paths, and the default install.
The absolute paths matter because `sudo` usually runs with a short `PATH` that does not include a Node.js installed by a version manager.

It writes two files:

| System | Settings file | Hook pointer |
| --- | --- | --- |
| macOS | `/Library/Application Support/ClaudeCode/managed-settings.d/sextant-ai.json` | `/Library/Application Support/sextant/sextant-hook` |
| Linux | `/etc/claude-code/managed-settings.d/sextant-ai.json` | `/usr/local/lib/sextant/sextant-hook` |

Windows is not supported yet.
Claude Code reads machine-wide settings from `C:\Program Files\ClaudeCode\` there, but the hook pointer is a POSIX shell script that has not been verified on Windows.

### Why a file of its own

Claude Code reads `managed-settings.json` and then every `*.json` file in `managed-settings.d/`, in alphabetical order, and merges them; hook lists from different files are combined ([Deploy managed settings](https://code.claude.com/docs/en/managed-settings)).
sextant writes only its own file in that directory.
It never edits `managed-settings.json` or another file there, so a policy an IT team deployed stays byte for byte as it was, and uninstalling removes one file.
Running `sextant install --managed` again changes nothing.

### What managed settings change

- **The built-in guard for mods.**
  On a machine with managed settings, Claude Code loads its built-in guard ahead of every mod a user installs.
  The guard keeps users' mods from changing what managed hooks and managed instructions receive, and from approving tool calls that permission rules or `PreToolUse` hooks refuse.
  See [Manage mods for your organization](https://code.claude.com/docs/en/plugins/mods/admin#know-what-happens-by-default).
- **Turning hooks off.**
  `disableAllHooks` in a person's own settings does not reach managed hooks.
  To silence sextant for one session, start Claude Code with `SEXTANT_DISABLE=1` in the environment.
- **Which managed source wins.**
  Server-managed settings outrank the files, as above, and so does an MDM profile: when it delivers a policy, Claude Code ignores the files unless it sets `managedSourcesBehavior` to `"merge"`.
  `sextant check` warns about an MDM profile on macOS.
  On such a login, use the default install.
- **Every account runs the hooks.**
  The hooks run as the account that owns each session, and read that account's configuration (`~/.config/sextant/sextant.json`).
  An account with no configuration gets nothing and sees no warning.
  The hook pointer runs the Node.js and the copy of sextant that ran `install`; an account that cannot read them gets nothing either, so install sextant where every account that should get rules can read it.

With both a machine-wide install and an install in a configuration directory, sessions of that login receive the rules twice whenever Claude Code applies the managed settings files; `install` and `check` name the logins where that happens.

## The hook pointer

The settings entries do not call Node.js or sextant directly.
They call `sextant-hook`, a small shell script that runs the Node.js and the copy of sextant that wrote it, by absolute path:

```json
{ "type": "command", "command": "/Users/me/.local/share/sextant/sextant-hook", "args": ["session-start"], "timeout": 10 }
```

So the hook does not depend on the `PATH` of whatever started Claude Code, and installing a new copy of sextant rewrites only the pointer, never a settings file.
If the copy it points at is removed, the pointer exits quietly and `sextant check` reports it.

## Uninstall

```bash
sextant uninstall                                                       # every configuration directory
sextant uninstall --account ~/.claude-work                              # one directory
sudo "$(command -v node)" "$(command -v sextant)" uninstall --managed   # machine-wide
```

`uninstall` removes sextant's own entries and its hook pointer, and nothing else.
With no option it visits every configuration directory the default install would find, and every directory sextant recorded installing into, even one `CLAUDE_CONFIG_DIR` no longer names.
The machine-wide install's file is removed whole.
The per-account pointer stays while another directory still uses it.
A recorded directory that no longer exists is forgotten and no longer keeps the pointer; one that cannot be reached now, such as on an unmounted volume, is kept.
Rules a running session already received stay in that session.

## Check

`sextant check` prints one line per finding, each starting with `ok`, `warning` or `problem`:

- whether the configuration is valid;
- the machine-wide install and every configuration directory of this account, with their hook pointers, whether the Node.js and the copy of sextant they run still exist and this account can run them, and the version of sextant they run;
- each configuration directory no install reaches, including a login whose server-managed settings make Claude Code ignore the machine-wide install;
- server-managed settings that turn hooks off for a login (`disableAllHooks`, `allowManagedHooksOnly`);
- managed settings files that stop hooks from running (`disableAllHooks`), that make per-account hooks ignored (`allowManagedHooksOnly`), or that Claude Code cannot read;
- logins that would receive the rules twice;
- whether the installed `claude` is recent enough;
- the last decision in the log.

It exits 0 when there is no problem, 1 when there is one, and 2 when the configuration is missing or refused.
It reads local files and runs `claude --version`; it never uses the network and changes nothing.
