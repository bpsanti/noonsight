# Files read by each v9 session

Read calls, in the order first read, from `runs.jsonl`; the Grep and Glob counts are its `tool_calls`.
The twelve `before` sessions are v3's and are listed in the results of the runs that made them.
Streams were searched for the evaluation's own text (`grounded_after`, `adopt_on_wrong_grounds`, `experiments/adoption/results`, `pass bar`): no match.

| Session | Grounded | Read | Grep | Glob |
| --- | --- | --- | --- | --- |
| `after-fable-1` | yes | `experiments/benchmark/results/2026-11-19/summary.md`, `experiments/benchmark/results/2026-11-19/README.md`, `README.md`, `docs/evidence.md`, `docs/verification/claude-code.md`, `package.json`, `docs/hooks.md`, `experiments/delivery/README.md`, `hooks/hooks.json` | 2 | 8 |
| `after-fable-2` | yes | `experiments/benchmark/results/2026-11-19/summary.md`, `experiments/benchmark/results/2026-11-19/README.md`, `experiments/benchmark/results/2026-11-19/delivery-probe/delivery.md`, `README.md`, `docs/evidence.md`, `docs/hooks.md`, `package.json`, `hooks/hooks.json`, `docs/verification/claude-code.md`, `experiments/delivery/README.md`, `scripts/noonsight`, `CHANGELOG.md` | 5 | 6 |
| `after-fable-3` | no | `README.md`, `docs/evidence.md`, `docs/hooks.md`, `package.json`, `hooks/hooks.json`, `scripts/noonsight`, `experiments/delivery/README.md`, `CHANGELOG.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/README.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/agree.json`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/run.json` | 3 | 6 |
| `after-fable-4` | no | `docs/evidence.md`, `experiments/benchmark/results/2026-11-19/summary.md`, `hooks/hooks.json`, `README.md`, `package.json`, `scripts/noonsight`, `experiments/delivery/README.md`, `docs/hooks.md`, `docs/usage.md`, `presets/claude/preset.json`, `docs/install.md`, `docs/verification/claude-code.md`, `CHANGELOG.md`, `.github/workflows/ci.yml` | 3 | 6 |
| `after-fable-5` | yes | `README.md`, `docs/evidence.md`, `experiments/benchmark/results/2026-11-19/summary.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.md`, `docs/hooks.md`, `experiments/delivery/README.md`, `docs/install.md`, `package.json`, `hooks/hooks.json`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/README.md`, `CHANGELOG.md` | 3 | 6 |
| `after-fable-6` | yes | `README.md`, `docs/evidence.md`, `experiments/benchmark/results/2026-11-19/summary.md`, `experiments/benchmark/results/2026-11-19/README.md`, `docs/verification/claude-code.md`, `package.json`, `docs/hooks.md`, `hooks/hooks.json`, `experiments/delivery/README.md`, `scripts/noonsight`, `CHANGELOG.md` | 3 | 8 |
| `after-fable-7` | yes | `docs/evidence.md`, `README.md`, `hooks/hooks.json`, `package.json`, `experiments/delivery/README.md`, `docs/hooks.md`, `scripts/noonsight`, `CHANGELOG.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/README.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/agree.json`, `.github/workflows/ci.yml` | 6 | 7 |
| `after-fable-8` | yes | `README.md`, `docs/evidence.md`, `docs/verification/claude-code.md`, `package.json`, `hooks/hooks.json`, `docs/hooks.md`, `CHANGELOG.md`, `experiments/delivery/README.md` | 6 | 5 |
| `after-fable-9` | yes | `docs/evidence.md`, `docs/hooks.md`, `docs/install.md`, `README.md`, `package.json`, `presets/claude/SOURCES.md`, `presets/claude/preset.json`, `CHANGELOG.md` | 0 | 4 |
| `after-fable-10` | no | `docs/evidence.md`, `docs/hooks.md`, `presets/claude/SOURCES.md`, `docs/install.md`, `hooks/hooks.json`, `scripts/noonsight`, `README.md`, `package.json`, `experiments/delivery/README.md` | 2 | 5 |
| `after-opus-1` | no | `README.md`, `hooks/hooks.json`, `scripts/noonsight`, `docs/hooks.md`, `CHANGELOG.md`, `experiments/delivery/README.md` | 2 | 3 |
| `after-opus-2` | no | `README.md`, `docs/evidence.md`, `docs/hooks.md`, `CHANGELOG.md` | 4 | 3 |
| `after-opus-3` | yes | `README.md`, `docs/evidence.md`, `src/adapters/claude-code/compat.ts`, `docs/hooks.md`, `CHANGELOG.md` | 4 | 3 |
| `after-opus-4` | yes | `README.md`, `docs/evidence.md`, `docs/hooks.md`, `src/adapters/claude-code/compat.ts`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/agree.json`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/README.md` | 2 | 4 |
| `after-opus-5` | yes | `README.md`, `docs/evidence.md`, `docs/hooks.md`, `src/adapters/claude-code/compat.ts`, `experiments/delivery/README.md` | 5 | 5 |
| `after-opus-6` | no | `README.md`, `docs/evidence.md`, `docs/hooks.md` | 4 | 3 |
| `after-opus-7` | no | `README.md`, `docs/evidence.md`, `src/adapters/claude-code/compat.ts`, `docs/hooks.md` | 3 | 3 |
| `after-opus-8` | yes | `README.md`, `docs/hooks.md`, `experiments/delivery/README.md` | 3 | 5 |
| `after-opus-9` | yes | `README.md`, `docs/evidence.md`, `docs/hooks.md`, `experiments/delivery/README.md` | 2 | 4 |
| `after-opus-10` | yes | `README.md`, `docs/evidence.md`, `docs/hooks.md` | 1 | 3 |
| `after-sonnet-1` | yes | `docs/evidence.md`, `docs/verification/claude-code.md`, `README.md`, `experiments/delivery/README.md` | 2 | 4 |
| `after-sonnet-2` | no | `README.md`, `docs/evidence.md`, `package.json` | 1 | 5 |
| `after-sonnet-3` | no | `docs/evidence.md`, `README.md`, `hooks/hooks.json` | 0 | 4 |
| `after-sonnet-4` | no | `README.md`, `docs/evidence.md`, `docs/hooks.md` | 0 | 4 |
| `after-sonnet-5` | no | `README.md`, `docs/evidence.md`, `docs/hooks.md` | 0 | 4 |
| `after-sonnet-6` | yes | `README.md`, `docs/evidence.md`, `docs/hooks.md` | 0 | 4 |
| `after-sonnet-7` | yes | `README.md`, `docs/evidence.md`, `docs/hooks.md` | 2 | 3 |
| `after-sonnet-8` | no | `README.md`, `docs/evidence.md`, `docs/hooks.md` | 0 | 4 |
| `after-sonnet-9` | no | `README.md`, `docs/evidence.md`, `package.json` | 1 | 4 |
| `after-sonnet-10` | yes | `README.md`, `docs/evidence.md`, `docs/hooks.md` | 0 | 4 |
| `after-haiku-1` | yes | `README.md`, `docs/evidence.md`, `experiments/benchmark/results/2026-11-19/summary.md` | 0 | 3 |
| `after-haiku-2` | yes | `README.md`, `experiments/rules/results/2026-11-20-harder/summary.md` | 1 | 2 |
| `after-haiku-3` | no | `README.md`, `experiments/delivery/README.md`, `docs/evidence.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.json` | 7 | 2 |
| `after-haiku-4` | yes | `README.md`, `docs/evidence.md`, `docs/verification/claude-code.md` | 1 | 3 |
| `after-haiku-5` | no | `README.md`, `docs/evidence.md`, `docs/usage.md`, `docs/install.md`, `CHANGELOG.md` | 2 | 4 |
| `after-haiku-6` | no | `README.md`, `experiments/benchmark/results/2026-11-19/summary.md`, `experiments/rules/results/2026-11-20/summary.md` | 1 | 3 |
| `after-haiku-7` | yes | `README.md`, `docs/evidence.md`, `docs/verification/claude-code.md`, `docs/configuration.md` | 1 | 4 |
| `after-haiku-8` | yes | `experiments/benchmark/results/2026-11-19/summary.md`, `README.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.md` | 0 | 4 |
| `after-haiku-9` | yes | `README.md`, `CHANGELOG.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.md` | 2 | 2 |
| `after-haiku-10` | no | `package.json`, `README.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.md`, `experiments/benchmark/results/2026-11-19/summary.md`, `experiments/rules/results/2026-11-20/summary.md`, `experiments/delivery/README.md` | 1 | 2 |
