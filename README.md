# sextant-ai

Take a fix before you set the course: pick the right model for each agent task, and hand every agent the practices that fit the model it actually runs on.

**Status: early development.** Nothing is published yet.
Each Claude Code session already receives the rules declared for the model it runs on, at startup and again after `/model`, through official Claude Code hooks.
So does each subagent a session starts: before it starts, sextant predicts the model it will run on and adds that model's rules to the end of its task, then checks the model it actually started on and warns on a difference.
Rules can also depend on the task scope, such as investigating or summarizing: a session takes its scope from `SEXTANT_SCOPE`, a subagent from matchers run over its task, and `sextant check` reports scopes that overlap.
The starting preset comes next.

## What it will do

1. **Route (optional).** Choose the model and effort for a task from rules you declare, based on where each model is strong. Skip this part if an orchestrator already picks models for you.
2. **Instruct.** Give each Claude Code session and subagent the rules for the model it runs on, through official Claude Code hooks: no network proxy, no credentials handled.
   It ships a starting preset per current model, built from cited benchmarks and vendor prompting guides, and every rule is configurable.

It works on its own and alongside agent orchestrators.
One configuration file serves the whole machine, for every Claude Code account on it.

## Install

```bash
sextant install    # every Claude Code login of this account, no administrator rights
sextant check      # configuration, installs, watcher, Claude Code version
```

`sextant watch enable` optionally keeps a small watcher running that installs the hooks into each new Claude Code login as it appears; it is off unless you turn it on, and `sextant watch disable` turns it off.

`sextant install` adds sextant's hooks to the user settings of every Claude Code configuration directory it finds (`~/.claude`, the one in `CLAUDE_CONFIG_DIR`, and every other one in the home directory), keeping every other setting and hook.
User settings reach every login, including one whose organization delivers server-managed settings, where Claude Code ignores machine-wide managed settings files.
`sextant install --account <dir>` installs into one directory, and `sudo ... sextant install --managed` once for every account through Claude Code's managed settings files.
[docs/install.md](docs/install.md) covers the three installs, what they write, why the default is the default, and how to remove them.
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

`SEXTANT_LIVE_LOGIN=1 npm run test:live` also runs the subagent cases (three models in parallel, an inherited model with the built-in Explore subagent, nested subagents, a model mismatch, and an interactive session) and the scope cases (two sessions on one model in two scopes through `SEXTANT_SCOPE`, and two subagents on one model whose tasks fall in two scopes) in real sessions, from the Claude Code login of whoever runs it; they spend a little usage.
`SEXTANT_LIVE_TOKENS=1 CLAUDE_CODE_OAUTH_TOKEN=... npm run test:live` asks the session models which rules they received; the token stays in the environment.
See [docs/verification/claude-code.md](docs/verification/claude-code.md).

Node 20 or newer.
There are no runtime dependencies; the only development dependencies are TypeScript and the Node type definitions.

## Acknowledgements

Several ideas here (refuse a bad configuration instead of guessing, keep hooks fast and offline, test through the public interface) come from [firstmate](https://github.com/kunchenguid/firstmate); no code was copied.

## License

MIT
