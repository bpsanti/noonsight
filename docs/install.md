# Installing the hooks

sextant reaches Claude Code through two official settings hooks, `SessionStart` and `PostModelSwitch`.
`sextant install` puts them in place, `sextant uninstall` takes them out, and `sextant check` says whether they will run.
[hooks.md](hooks.md) describes what the hooks do once they run.

## Machine-wide (the default)

```bash
sudo "$(command -v node)" "$(command -v sextant)" install
```

`sextant install` with no option installs once for the whole machine, so every Claude Code account on it gets the hooks.
It writes Claude Code's managed settings, which live in a system directory, so it needs administrator rights once.
Without them it says so, changes nothing, and prints two ways forward: the exact `sudo` command for this machine, with absolute paths, and the per-account install below.
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
Running `sextant install` again changes nothing.

### What managed settings change

- **The built-in guard for mods.**
  On a machine with managed settings, Claude Code loads its built-in guard ahead of every mod a user installs.
  The guard keeps users' mods from changing what managed hooks and managed instructions receive, and from approving tool calls that permission rules or `PreToolUse` hooks refuse.
  See [Manage mods for your organization](https://code.claude.com/docs/en/plugins/mods/admin#know-what-happens-by-default).
- **Turning hooks off.**
  `disableAllHooks` in a person's own settings does not reach managed hooks.
  To silence sextant for one session, start Claude Code with `SEXTANT_DISABLE=1` in the environment.
- **Which managed source wins.**
  By default Claude Code applies only the highest-ranked managed source that delivers a policy: server-managed settings (from the claude.ai admin console or a Claude apps gateway), then an MDM profile, then the managed settings files.
  When a higher source delivers a policy, the files are ignored, sextant's included, unless that source sets `managedSourcesBehavior` to `"merge"`.
  On such a machine, use the per-account install.
  `sextant check` warns about an MDM profile on macOS; it cannot see server-managed settings, but `/status` inside Claude Code names the source in use.
- **Every account runs the hooks.**
  The hooks run as the account that owns each session, and read that account's configuration (`~/.config/sextant/sextant.json`).
  An account with no configuration gets nothing and sees no warning.
  The hook pointer runs the Node.js and the copy of sextant that ran `install`; an account that cannot read them gets nothing either, so install sextant where every account that should get rules can read it.

## Per account

```bash
sextant install --account ~/.claude
```

`--account` installs into one Claude Code configuration directory, with no administrator rights: `~/.claude`, or the directory a `CLAUDE_CONFIG_DIR` points at.
Run it once for each directory that should get the hooks.

It adds one entry per event to `<dir>/settings.json` and keeps everything else in the file, other hooks included.
Running it again changes nothing, and it repairs an entry of its own that was moved, duplicated or points at an old place.
A settings file that is not valid JSON, or whose `hooks` do not have the documented shape, is refused and left as it was.
The hook pointer goes to `~/.local/share/sextant/sextant-hook`, and the directory is recorded in `~/.local/state/sextant/installs.json` so `sextant check` can find it.

With both a machine-wide and a per-account install in place, that account's sessions receive the rules twice; `install` and `check` warn about it.

## The hook pointer

The settings entries do not call Node.js or sextant directly.
They call `sextant-hook`, a small shell script that runs the Node.js and the copy of sextant that wrote it, by absolute path:

```json
{ "type": "command", "command": "/Library/Application Support/sextant/sextant-hook", "args": ["session-start"], "timeout": 10 }
```

So the hook does not depend on the `PATH` of whatever started Claude Code, and installing a new copy of sextant rewrites only the pointer, never a settings file.
If the copy it points at is removed, the pointer exits quietly and `sextant check` reports it.

## Uninstall

```bash
sudo "$(command -v node)" "$(command -v sextant)" uninstall   # machine-wide
sextant uninstall --account ~/.claude                         # one account
```

`uninstall` removes sextant's own entries and its hook pointer, and nothing else.
The machine-wide install's file is removed whole.
A per-account pointer stays while another per-account install still uses it.
Rules a running session already received stay in that session.

## Check

`sextant check` prints one line per finding, each starting with `ok`, `warning` or `problem`:

- whether the configuration is valid;
- each install it can see: the machine-wide one, and the per-account ones this account made, with their hook pointers and the version of sextant they run;
- managed settings that stop hooks from running (`disableAllHooks`), that make per-account hooks ignored (`allowManagedHooksOnly`), or that Claude Code cannot read;
- whether the installed `claude` is recent enough;
- the last decision in the log.

It exits 0 when there is no problem, 1 when there is one, and 2 when the configuration is missing or refused.
It reads local files and runs `claude --version`; it never uses the network and changes nothing.
