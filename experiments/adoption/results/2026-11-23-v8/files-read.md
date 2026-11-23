# Files read by each v8 session

Read calls, in the order first read, from `runs.jsonl`; the Grep and Glob counts are its `tool_calls`.
The twelve `before` sessions are v3's and are listed in the results of the runs that made them.
Streams were searched for the evaluation's own text (`grounded_after`, `adopt_on_wrong_grounds`, `experiments/adoption/results`, `pass bar`): no match.
No session opened `test/adoption.test.ts`; `after-fable-10` is dropped for scoring.

| Session | Grounded | Read | Grep | Glob |
| --- | --- | --- | --- | --- |
| `after-fable-1` | yes | `README.md`, `experiments/benchmark/results/2026-11-19/summary.md`, `experiments/benchmark/results/2026-11-19/README.md`, `docs/evidence.md`, `docs/hooks.md`, `package.json`, `presets/claude/preset.json`, `experiments/delivery/README.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/README.md`, `.github/workflows/ci.yml`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.json` | 4 | 8 |
| `after-fable-2` | yes | `README.md`, `docs/evidence.md`, `docs/hooks.md`, `experiments/delivery/README.md`, `docs/install.md`, `package.json`, `presets/claude/preset.json`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/README.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/run.json` | 5 | 5 |
| `after-fable-3` | yes | `README.md`, `package.json`, `docs/evidence.md`, `experiments/delivery/README.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/README.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/run.json`, `docs/hooks.md`, `docs/install.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.json`, `.github/workflows/ci.yml`, `CHANGELOG.md`, `experiments/benchmark/results/2026-11-19/README.md` | 4 | 9 |
| `after-fable-4` | yes | `experiments/benchmark/results/2026-11-19/summary.md`, `experiments/benchmark/results/2026-11-19/README.md`, `README.md`, `docs/evidence.md`, `package.json`, `docs/verification/claude-code.md`, `CHANGELOG.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/README.md`, `docs/hooks.md` | 4 | 5 |
| `after-fable-5` | no | `docs/evidence.md`, `experiments/benchmark/results/2026-11-19/summary.md`, `experiments/rules/results/2026-11-20/summary.md`, `docs/verification/claude-code.md`, `docs/install.md`, `docs/usage.md`, `experiments/delivery/README.md`, `presets/claude/SOURCES.md`, `README.md`, `package.json` | 2 | 6 |
| `after-fable-6` | no | `docs/evidence.md`, `docs/hooks.md`, `docs/verification/claude-code.md`, `README.md`, `package.json`, `experiments/delivery/README.md` | 5 | 6 |
| `after-fable-7` | yes | `experiments/benchmark/results/2026-11-19/summary.md`, `experiments/benchmark/results/2026-11-19/README.md`, `experiments/benchmark/results/2026-11-19/delivery-probe/delivery.md`, `README.md`, `docs/evidence.md`, `docs/verification/claude-code.md`, `package.json`, `CHANGELOG.md`, `experiments/delivery/README.md`, `docs/install.md`, `docs/hooks.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/README.md`, `.github/workflows/ci.yml` | 7 | 6 |
| `after-fable-8` | yes | `README.md`, `docs/evidence.md`, `experiments/benchmark/results/2026-11-19/summary.md`, `experiments/rules/results/2026-11-20/summary.md`, `experiments/delivery/README.md`, `package.json`, `docs/hooks.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/README.md`, `docs/install.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/agree.json`, `.github/workflows/ci.yml` | 3 | 9 |
| `after-fable-9` | yes | `README.md`, `package.json`, `docs/evidence.md`, `experiments/benchmark/results/2026-11-19/summary.md`, `experiments/benchmark/results/2026-11-19/README.md`, `CHANGELOG.md`, `docs/hooks.md`, `experiments/delivery/README.md`, `docs/install.md`, `.github/workflows/ci.yml`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/agree.json`, `docs/usage.md`, `docs/configuration.md` | 4 | 6 |
| `after-fable-10` | yes (dropped) | `docs/evidence.md`, `experiments/benchmark/results/2026-11-19/summary.md`, `experiments/rules/results/2026-11-20/summary.md`, `docs/verification/claude-code.md`, `README.md`, `docs/usage.md`, `experiments/delivery/README.md`, `package.json`, `CHANGELOG.md`, `docs/hooks.md` | 1 | 6 |
| `after-opus-1` | yes | `README.md`, `docs/evidence.md`, `docs/hooks.md`, `experiments/delivery/README.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/README.md`, `CHANGELOG.md` | 1 | 3 |
| `after-opus-2` | no | `docs/evidence.md`, `README.md`, `experiments/delivery/README.md`, `src/adapters/claude-code/compat.ts`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/README.md`, `docs/hooks.md` | 1 | 5 |
| `after-opus-3` | yes | `README.md`, `docs/evidence.md`, `CHANGELOG.md`, `package.json`, `experiments/delivery/README.md`, `docs/verification/claude-code.md` | 4 | 6 |
| `after-opus-4` | yes | `README.md`, `docs/evidence.md`, `docs/verification/claude-code.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/README.md`, `experiments/delivery/README.md` | 1 | 4 |
| `after-opus-5` | yes | `README.md`, `docs/evidence.md`, `experiments/delivery/README.md`, `docs/hooks.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/README.md` | 3 | 3 |
| `after-opus-6` | yes | `README.md`, `docs/evidence.md`, `experiments/delivery/README.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/README.md` | 4 | 4 |
| `after-opus-7` | yes | `docs/evidence.md`, `docs/hooks.md`, `README.md`, `experiments/delivery/README.md`, `CHANGELOG.md` | 2 | 4 |
| `after-opus-8` | yes | `README.md`, `docs/evidence.md`, `experiments/delivery/README.md`, `src/adapters/claude-code/compat.ts`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/README.md` | 1 | 3 |
| `after-opus-9` | yes | `README.md`, `docs/evidence.md`, `experiments/delivery/README.md`, `docs/hooks.md` | 5 | 3 |
| `after-sonnet-1` | yes | `README.md`, `docs/evidence.md`, `docs/hooks.md`, `experiments/delivery/README.md` | 1 | 3 |
| `after-sonnet-2` | yes | `README.md`, `docs/evidence.md`, `docs/hooks.md`, `docs/install.md` | 0 | 3 |
| `after-sonnet-3` | no | `README.md`, `docs/evidence.md`, `experiments/delivery/README.md` | 2 | 3 |
| `after-sonnet-4` | yes | `README.md`, `docs/evidence.md` | 1 | 3 |
| `after-sonnet-5` | no | `docs/evidence.md`, `docs/hooks.md`, `README.md`, `experiments/delivery/README.md` | 0 | 4 |
| `after-sonnet-6` | yes | `README.md`, `docs/evidence.md`, `docs/hooks.md` | 1 | 3 |
| `after-sonnet-7` | no | `README.md`, `docs/evidence.md`, `docs/verification/claude-code.md` | 0 | 4 |
| `after-sonnet-8` | no | `README.md`, `docs/evidence.md`, `docs/verification/claude-code.md`, `experiments/delivery/README.md`, `docs/usage.md` | 1 | 4 |
| `after-sonnet-9` | no | `README.md`, `docs/evidence.md`, `docs/verification/claude-code.md`, `experiments/delivery/README.md` | 2 | 3 |
| `after-haiku-1` | yes | `README.md` | 3 | 2 |
| `after-haiku-2` | yes | `README.md`, `docs/evidence.md`, `docs/hooks.md`, `docs/verification/claude-code.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.json` | 3 | 4 |
| `after-haiku-3` | no | `docs/evidence.md`, `experiments/benchmark/results/2026-11-19/summary.md`, `docs/install.md` | 0 | 5 |
| `after-haiku-4` | yes | `README.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.md`, `experiments/rules/results/2026-11-20-harder/summary.md` | 2 | 3 |
| `after-haiku-5` | no | `README.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.md` | 1 | 3 |
| `after-haiku-6` | no | `docs/evidence.md`, `README.md`, `docs/hooks.md`, `package.json` | 0 | 4 |
| `after-haiku-7` | no | `README.md`, `package.json`, `docs/evidence.md` | 5 | 4 |
| `after-haiku-8` | no | `README.md`, `docs/evidence.md`, `experiments/benchmark/results/2026-11-19/summary.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.md` | 2 | 3 |
| `after-haiku-9` | yes | `README.md`, `docs/evidence.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.json` | 1 | 4 |
