# sextant-ai

Take a fix before you set the course: pick the right model for each agent task, and hand every agent the practices that fit the model it actually runs on.

**Status: early development.** Nothing is published yet.
Each Claude Code session already receives the rules declared for the model it runs on, at startup and again after `/model`, through official Claude Code hooks.
Subagents, task scopes and the starting preset come next.

## What it will do

1. **Route (optional).** Choose the model and effort for a task from rules you declare, based on where each model is strong. Skip this part if an orchestrator already picks models for you.
2. **Instruct.** Give each Claude Code session and subagent the rules for the model it runs on, through official Claude Code hooks: no network proxy, no credentials handled.
   It ships a starting preset per current model, built from cited benchmarks and vendor prompting guides, and every rule is configurable.

It works on its own and alongside agent orchestrators.
One configuration file serves the whole machine, for every Claude Code account on it.

## Install

```bash
sudo "$(command -v node)" "$(command -v sextant)" install   # once per machine, for every Claude Code account
sextant install --account ~/.claude                         # or for one account, without administrator rights
sextant check                                               # configuration, installs, Claude Code version
```

The machine-wide install adds sextant's own file to Claude Code's managed settings and never edits the files already there.
On a machine with managed settings, Claude Code loads its [built-in guard for the mods users install](https://code.claude.com/docs/en/plugins/mods/admin#know-what-happens-by-default).
[docs/install.md](docs/install.md) covers both installs, what they write, and how to remove them.
[docs/hooks.md](docs/hooks.md) describes what the hooks deliver, the decision log, and how to turn sextant off for a session (`SEXTANT_DISABLE=1`).

The hooks read only local files: nothing leaves the machine.

## Try the core

```bash
npm install
npm run build
SEXTANT_CONFIG=test/fixtures/lab/config/sextant.json SEXTANT_PRESETS_DIR=test/fixtures/lab/presets \
  node dist/src/cli.js resolve claude-sonnet-5-5 investigate
```

See [docs/configuration.md](docs/configuration.md) for the configuration file and the `resolve` output.

## Development

```bash
npm test             # builds, then runs every test with node --test
npm run test:live    # real interactive Claude Code sessions; needs claude and expect, sends no prompt
```

`SEXTANT_LIVE_TOKENS=1 CLAUDE_CODE_OAUTH_TOKEN=... npm run test:live` also asks the models which rules they received, which spends a little usage; the token stays in the environment.
See [docs/verification/claude-code.md](docs/verification/claude-code.md).

Node 20 or newer.
There are no runtime dependencies; the only development dependencies are TypeScript and the Node type definitions.

## Acknowledgements

Several ideas here (refuse a bad configuration instead of guessing, keep hooks fast and offline, test through the public interface) come from [firstmate](https://github.com/kunchenguid/firstmate); no code was copied.

## License

MIT
