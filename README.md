# sextant-ai

Take a fix before you set the course: pick the right model for each agent task, and hand every agent the practices that fit the model it actually runs on.

**Status: early development.** Nothing is published yet.
The core works: given a model, a task scope and a place, it decides which rules apply and produces the exact text to deliver.
The Claude Code hooks, the installer and the preset come next.

## What it will do

1. **Route (optional).** Choose the model and effort for a task from rules you declare, based on where each model is strong. Skip this part if an orchestrator already picks models for you.
2. **Instruct.** Give each Claude Code session and subagent the rules for the model it runs on, through official Claude Code hooks: no network proxy, no credentials handled.
   It ships a starting preset per current model, built from cited benchmarks and vendor prompting guides, and every rule is configurable.

It works on its own and alongside agent orchestrators.
One configuration file serves the whole machine, for every Claude Code account on it.

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
npm test    # builds, then runs every test with node --test
```

Node 20 or newer.
There are no runtime dependencies; the only development dependencies are TypeScript and the Node type definitions.

## Acknowledgements

Several ideas here (refuse a bad configuration instead of guessing, keep hooks fast and offline, test through the public interface) come from [firstmate](https://github.com/kunchenguid/firstmate); no code was copied.

## License

MIT
