# Changelog

## Unreleased

- TypeScript project with a test run on Node 20 and 22 in CI.
- Configuration schema (`schema/sextant.schema.json`) and preset schema (`schema/preset.schema.json`).
- `sextant resolve`: shows which rules a model receives for a task scope and a place, with the exact text that would be delivered.
- A configuration with any problem is refused whole, with its problems listed: schema problems first, then preset problems, then the rest.
