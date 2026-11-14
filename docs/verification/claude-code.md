# Claude Code facts sextant relies on

Each fact below names the Claude Code version and the date it was last checked, and how to check it again.
Recheck them all when raising the Claude Code version that CI pins (`.github/workflows/ci.yml`).

`npm run test:live` drives real interactive sessions through a terminal and sends no prompt and no request to Anthropic: a placeholder token gets Claude Code past sign-in, and `ANTHROPIC_BASE_URL` points at a closed local port.
`SEXTANT_LIVE_TOKENS=1` adds the checks that ask a model, which need a real token in `CLAUDE_CODE_OAUTH_TOKEN`.

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
| A model reads `additionalContext` from `SessionStart` and `PostModelSwitch` and can quote it | 2.1.325 | Not yet run | `SEXTANT_LIVE_TOKENS=1 CLAUDE_CODE_OAUTH_TOKEN=... npm run test:live` |

## From the documentation, not checked live

| Fact | Source | Read |
| --- | --- | --- |
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

The machine-wide install (`--managed`) is not checked live, because that would mean writing the real system directory of the machine running the tests.
Its tests install into a temporary directory that stands in for `/` (`SEXTANT_SYSTEM_ROOT`), and the per-account live tests use the same hook entries and the same pointer.
To check it by hand on a disposable machine: run `sudo ... sextant install --managed`, start `claude`, and confirm that `/status` lists the managed settings files and that `~/.local/state/sextant/decisions.jsonl` gains a line.
