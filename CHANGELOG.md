# Changelog

## Unreleased

- Session hooks: `SessionStart` and `PostModelSwitch` give each Claude Code session the rules for the model it runs on, and after `/model` say that the earlier rules no longer apply. They always exit 0, never use the network, and never block; an undeclared model only warns, and a refused configuration delivers nothing. See `docs/hooks.md`.
- Decision log: one JSON line per decision in `~/.local/state/sextant/decisions.jsonl`.
- `sextant install` and `sextant uninstall`: machine-wide by default, as sextant's own file in Claude Code's `managed-settings.d/` (administrator rights once), or for one Claude Code account with `--account <dir>`. Installing twice changes nothing, and other hooks and settings are kept. See `docs/install.md`.
- `sextant check`: the configuration, every install, managed settings that stop hooks, the Claude Code version and the last decision.
- The rules for any model, scope and place must now fit in 9,500 characters, leaving room for the model-change note.
- Live tests (`npm run test:live`) drive real interactive Claude Code sessions; the tier that sends no prompt runs in CI against a pinned Claude Code version. See `docs/verification/claude-code.md`.
- TypeScript project with a test run on Node 20 and 22 in CI.
- Configuration schema (`schema/sextant.schema.json`) and preset schema (`schema/preset.schema.json`).
- `sextant resolve`: shows which rules a model receives for a task scope and a place, with the exact text that would be delivered.
- A configuration with any problem is refused whole, with its problems listed: schema problems first, then preset problems, then the rest.
