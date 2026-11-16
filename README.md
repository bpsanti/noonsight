# sextant-ai

Take a fix before you set the course: pick the right model for each agent task, and hand every agent the practices that fit the model it actually runs on.

**Status: early development.** Nothing is published yet.
Each Claude Code session already receives the rules declared for the model it runs on, at startup and again after `/model`, through official Claude Code hooks.
So does each subagent a session starts: before it starts, sextant predicts the model it will run on and adds that model's rules to the end of its task, then checks the model it actually started on and warns on a difference.
Rules can also depend on the task scope, such as investigating or summarizing: a session takes its scope from `SEXTANT_SCOPE`, a subagent from matchers run over its task, and `sextant check` reports scopes that overlap.
`sextant run` starts Claude Code with the rules in the system prompt instead, for sessions the hooks do not reach; with the hooks installed too, the rules still arrive once.
Routing is optional and off by default: once turned on, a task's scope picks the model and effort for a session `sextant run` starts and for each subagent, from a table of preferences, and it yields to a model the caller chose and to an orchestrator's environment ([docs/configuration.md](docs/configuration.md#routing)).
The package ships a starting preset, `claude`: 16 rules for Claude Fable 5.2, Opus 5.5, Sonnet 5.5 and Haiku 5.5, each adapted from Anthropic's prompting guide for that exact model and listed with its source, the effect the guide reports and its cost ([presets/claude/SOURCES.md](presets/claude/SOURCES.md)).
Eight of them are on by default; the rest have a high cost, a side effect or a narrow use, and the user turns them on.
None is delivered where Claude Code already sends the same advice.

## What it will do

1. **Route (optional).** Choose the model and effort for a task from rules you declare, based on where each model is strong. Skip this part if an orchestrator already picks models for you.
2. **Instruct.** Give each Claude Code session and subagent the rules for the model it runs on, through official Claude Code hooks: no network proxy, no credentials handled.
   It ships a starting preset per current model, built from the vendor's prompting guides with every source cited, and every rule is configurable.

It works on its own and alongside agent orchestrators.
One configuration file serves the whole machine, for every Claude Code account on it.

## Install

```bash
sextant init       # the configuration file, declaring every model the preset covers
sextant models     # each model's rules, with their source, effect and cost
sextant install    # every Claude Code login of this account, no administrator rights
sextant check      # configuration, installs, watcher, Claude Code version
```

`sextant init` writes `~/.config/sextant/sextant.json`, or the file `SEXTANT_CONFIG` names, and never replaces one that exists.
Turn a preset rule on or off with `enable` and `disable`, add your own rule files, and declare the models you use; [docs/configuration.md](docs/configuration.md) explains each key.

`sextant watch enable` optionally keeps a small watcher running that installs the hooks into each new Claude Code login as it appears; it is off unless you turn it on, and `sextant watch disable` turns it off.

`sextant install` adds sextant's hooks to the user settings of every Claude Code configuration directory it finds (`~/.claude`, the one in `CLAUDE_CONFIG_DIR`, and every other one in the home directory), keeping every other setting and hook.
User settings reach every login, including one whose organization delivers server-managed settings, where Claude Code ignores machine-wide managed settings files.
`sextant install --account <dir>` installs into one directory, and `sudo ... sextant install --managed` once for every account through Claude Code's managed settings files.
[docs/install.md](docs/install.md) covers the three installs, what they write, why the default is the default, and how to remove them.
[docs/hooks.md](docs/hooks.md) describes what the hooks deliver, the decision log, and how to turn sextant off for a session (`SEXTANT_DISABLE=1`).

`sextant run [--scope <scope>] -- <claude arguments>` starts `claude` with the rules for its model added through `--append-system-prompt-file`, keeping any `--append-system-prompt` someone else passes, and with routing on, the model and effort the scope's row gives; [docs/launcher.md](docs/launcher.md) explains it.

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

`SEXTANT_LIVE_LOGIN=1 npm run test:live` also runs the subagent cases (three models in parallel, an inherited model with the built-in Explore subagent, nested subagents, a model mismatch, and an interactive session), the scope cases (two sessions on one model in two scopes through `SEXTANT_SCOPE`, and two subagents on one model whose tasks fall in two scopes) the preset cases (what Claude Code's own system prompt already sends each model, compared with the preset, and the real preset reaching a session and a subagent with the hash `sextant resolve` gives) and the launcher cases (`sextant run` with an explicit model, with and without the hooks, and next to another `--append-system-prompt` or `--append-system-prompt-file`) in real sessions, from the Claude Code login of whoever runs it; they spend a little usage, Fable 5.2 included.
`SEXTANT_LIVE_TOKENS=1 CLAUDE_CODE_OAUTH_TOKEN=... npm run test:live` asks the session models which rules they received; the token stays in the environment.
See [docs/verification/claude-code.md](docs/verification/claude-code.md).

Node 20 or newer.
There are no runtime dependencies; the only development dependencies are TypeScript and the Node type definitions.

## Acknowledgements

Several ideas here (refuse a bad configuration instead of guessing, keep hooks fast and offline, test through the public interface) come from [firstmate](https://github.com/kunchenguid/firstmate); no code was copied.

## License

MIT
