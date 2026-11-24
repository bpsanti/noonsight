# Files read by each v10 session

Read calls, in the order first read, from `runs.jsonl`; the Grep and Glob counts are its `tool_calls`.
The twelve `before` sessions are v3's and are listed in the results of the runs that made them.
Streams were searched for the evaluation's own text (`grounded_after`, `adopt_on_wrong_grounds`, `experiments/adoption/results`, `pass bar`): no match.

| Session | Grounded | Read | Grep | Glob |
| --- | --- | --- | --- | --- |
| `after-fable-1` | yes | `README.md`, `experiments/benchmark/results/2026-11-19/summary.md`, `experiments/benchmark/results/2026-11-19/README.md`, `package.json`, `docs/hooks.md`, `experiments/delivery/README.md`, `CHANGELOG.md`, `hooks/hooks.json`, `src/adapters/claude-code/compat.ts`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/README.md`, `docs/install.md` | 3 | 6 |
| `after-fable-2` | yes | `docs/evidence.md`, `experiments/benchmark/results/2026-11-19/summary.md`, `experiments/rules/results/2026-11-20-harder/summary.md`, `docs/hooks.md`, `docs/install.md`, `experiments/delivery/README.md`, `presets/claude/SOURCES.md`, `CHANGELOG.md`, `README.md`, `package.json` | 1 | 6 |
| `after-fable-3` | no | `README.md`, `docs/evidence.md`, `package.json`, `docs/hooks.md`, `CHANGELOG.md`, `docs/install.md`, `hooks/hooks.json`, `scripts/noonsight` | 4 | 5 |
| `after-fable-4` | yes | `README.md`, `docs/evidence.md`, `docs/verification/claude-code.md`, `package.json`, `CHANGELOG.md`, `docs/hooks.md`, `experiments/delivery/README.md` | 4 | 7 |
| `after-fable-5` | yes | `docs/evidence.md`, `docs/hooks.md`, `hooks/hooks.json`, `README.md`, `package.json`, `scripts/noonsight`, `presets/claude/SOURCES.md`, `presets/claude/preset.json`, `experiments/delivery/README.md`, `.github/workflows/ci.yml`, `CHANGELOG.md` | 3 | 5 |
| `after-fable-6` | yes | `README.md`, `docs/evidence.md`, `docs/verification/claude-code.md`, `presets/claude/SOURCES.md`, `docs/hooks.md`, `package.json`, `CHANGELOG.md`, `experiments/delivery/README.md`, `docs/install.md` | 4 | 8 |
| `after-fable-7` | no | `README.md`, `docs/evidence.md`, `package.json`, `experiments/benchmark/results/2026-11-19/summary.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.md`, `hooks/hooks.json`, `docs/hooks.md`, `experiments/delivery/README.md`, `scripts/noonsight`, `presets/claude/preset.json`, `CHANGELOG.md`, `docs/install.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/README.md` | 4 | 5 |
| `after-fable-8` | no | `README.md`, `docs/evidence.md`, `docs/hooks.md`, `package.json`, `hooks/hooks.json`, `scripts/noonsight`, `experiments/delivery/README.md`, `CHANGELOG.md`, `docs/verification/claude-code.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/README.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/agree.json`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/run.json`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.json` | 4 | 6 |
| `after-fable-9` | yes | `docs/evidence.md`, `experiments/benchmark/results/2026-11-19/summary.md`, `docs/verification/claude-code.md`, `README.md`, `package.json`, `presets/claude/SOURCES.md`, `CHANGELOG.md`, `experiments/delivery/README.md`, `docs/hooks.md` | 2 | 6 |
| `after-fable-10` | yes | `README.md`, `docs/evidence.md`, `docs/hooks.md`, `presets/claude/SOURCES.md`, `presets/claude/preset.json`, `hooks/hooks.json`, `experiments/delivery/README.md`, `package.json`, `scripts/noonsight`, `CHANGELOG.md` | 3 | 6 |
| `after-opus-1` | no | `docs/evidence.md`, `README.md`, `experiments/delivery/README.md`, `CHANGELOG.md`, `docs/hooks.md` | 1 | 4 |
| `after-opus-2` | no | `README.md`, `docs/evidence.md`, `src/adapters/claude-code/compat.ts`, `hooks/hooks.json`, `docs/hooks.md`, `CHANGELOG.md` | 3 | 5 |
| `after-opus-3` | no | `docs/evidence.md`, `README.md`, `experiments/delivery/README.md`, `docs/verification/claude-code.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/README.md`, `docs/hooks.md` | 3 | 4 |
| `after-opus-4` | yes | `README.md`, `docs/evidence.md`, `docs/hooks.md`, `experiments/delivery/README.md` | 4 | 3 |
| `after-opus-5` | no | `README.md`, `package.json`, `docs/hooks.md`, `experiments/delivery/README.md` | 3 | 5 |
| `after-opus-6` | yes | `README.md`, `docs/evidence.md`, `docs/hooks.md`, `experiments/delivery/README.md` | 2 | 4 |
| `after-opus-7` | yes | `README.md`, `docs/evidence.md`, `docs/hooks.md`, `experiments/delivery/README.md` | 2 | 4 |
| `after-opus-8` | no | `README.md`, `docs/hooks.md`, `CHANGELOG.md` | 4 | 3 |
| `after-opus-9` | yes | `README.md`, `hooks/hooks.json`, `docs/hooks.md`, `scripts/noonsight`, `package.json`, `.claude-plugin/marketplace.json`, `experiments/delivery/README.md` | 2 | 3 |
| `after-opus-10` | yes | `docs/evidence.md`, `docs/hooks.md`, `README.md`, `package.json` | 2 | 4 |
| `after-sonnet-1` | yes | `docs/evidence.md`, `docs/hooks.md`, `README.md`, `experiments/delivery/README.md` | 0 | 4 |
| `after-sonnet-2` | yes | `README.md`, `docs/evidence.md`, `package.json`, `experiments/delivery/README.md` | 1 | 4 |
| `after-sonnet-3` | no | `README.md`, `docs/evidence.md` | 0 | 3 |
| `after-sonnet-4` | no | `README.md`, `docs/evidence.md`, `docs/hooks.md` | 0 | 3 |
| `after-sonnet-5` | yes | `README.md`, `docs/evidence.md`, `package.json` | 2 | 4 |
| `after-sonnet-6` | no | `README.md`, `docs/evidence.md`, `docs/verification/claude-code.md` | 0 | 5 |
| `after-sonnet-7` | no | `README.md`, `docs/evidence.md`, `docs/hooks.md`, `package.json` | 0 | 4 |
| `after-sonnet-8` | no | `README.md`, `docs/evidence.md` | 1 | 3 |
| `after-sonnet-9` | yes | `README.md`, `docs/evidence.md`, `docs/hooks.md`, `docs/usage.md` | 2 | 4 |
| `after-sonnet-10` | yes | `docs/evidence.md`, `docs/hooks.md`, `README.md`, `experiments/delivery/README.md` | 0 | 4 |
| `after-haiku-1` | yes | `README.md`, `docs/evidence.md`, `docs/hooks.md` | 0 | 3 |
| `after-haiku-2` | no | `experiments/benchmark/results/2026-11-19/summary.md`, `docs/verification/claude-code.md`, `experiments/rules/results/2026-11-20-harder/summary.md` | 0 | 3 |
| `after-haiku-3` | no | `README.md`, `experiments/delivery/README.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/README.md`, `docs/evidence.md` | 1 | 2 |
| `after-haiku-4` | no | `README.md`, `docs/evidence.md`, `docs/verification/claude-code.md` | 0 | 3 |
| `after-haiku-5` | no | `docs/usage.md`, `experiments/rules/results/2026-11-20-harder/summary.md`, `experiments/benchmark/results/2026-11-19/summary.md` | 1 | 3 |
| `after-haiku-6` | no | `README.md`, `experiments/benchmark/README.md`, `experiments/delivery/README.md`, `experiments/benchmark/results/2026-11-19/README.md`, `package.json`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/README.md` | 0 | 4 |
| `after-haiku-7` | no | `README.md`, `docs/hooks.md`, `docs/evidence.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.json` | 4 | 3 |
| `after-haiku-8` | no | `README.md`, `experiments/benchmark/results/2026-11-19/summary.md`, `experiments/rules/results/2026-11-20/summary.md`, `docs/hooks.md` | 1 | 4 |
| `after-haiku-9` | no | `README.md`, `docs/evidence.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.md`, `experiments/rules/results/2026-11-20/summary.md` | 0 | 3 |
| `after-haiku-10` | no | `README.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.md`, `experiments/benchmark/results/2026-11-19/summary.md` | 0 | 3 |
