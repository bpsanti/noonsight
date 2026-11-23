# Files read by each v7 session

Read calls, in the order first read, from `runs.jsonl`; the Grep and Glob counts are its `tool_calls`.
The twelve `before` sessions are v3's and are listed in the results of the runs that made them.
Streams were searched for the evaluation's own text (`grounded_after`, `adopt_on_wrong_grounds`, `experiments/adoption/results`): no match.
No session opened `test/adoption.test.ts`.

| Session | Grounded | Read | Grep | Glob |
| --- | --- | --- | --- | --- |
| `after-fable-1` | yes | `README.md`, `docs/evidence.md`, `docs/verification/claude-code.md`, `package.json`, `presets/claude/preset.json`, `docs/hooks.md`, `CHANGELOG.md`, `experiments/delivery/README.md`, `experiments/benchmark/results/2026-11-19/README.md` | 4 | 5 |
| `after-fable-2` | yes | `README.md`, `docs/evidence.md`, `experiments/benchmark/results/2026-11-19/summary.md`, `experiments/rules/results/2026-11-20/summary.md`, `docs/verification/claude-code.md`, `experiments/benchmark/results/2026-11-19/README.md`, `docs/install.md`, `package.json`, `experiments/delivery/README.md` | 4 | 7 |
| `after-fable-3` | yes | `README.md`, `docs/evidence.md`, `experiments/benchmark/results/2026-11-19/summary.md`, `package.json`, `experiments/benchmark/results/2026-11-19/README.md`, `docs/hooks.md`, `docs/install.md`, `experiments/delivery/README.md`, `CHANGELOG.md`, `.github/workflows/ci.yml` | 4 | 6 |
| `after-fable-4` | yes | `docs/evidence.md`, `docs/verification/claude-code.md`, `README.md`, `experiments/benchmark/results/2026-11-19/README.md`, `package.json`, `CHANGELOG.md`, `docs/install.md`, `experiments/delivery/README.md` | 2 | 6 |
| `after-fable-5` | yes | `README.md`, `docs/evidence.md`, `docs/hooks.md`, `package.json`, `docs/install.md`, `experiments/delivery/README.md`, `experiments/benchmark/results/2026-11-19/README.md`, `docs/verification/claude-code.md`, `CHANGELOG.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/README.md` | 5 | 7 |
| `after-fable-6` | yes | `README.md`, `package.json`, `docs/evidence.md`, `experiments/benchmark/results/2026-11-19/summary.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.md`, `experiments/benchmark/results/2026-11-19/README.md`, `docs/hooks.md`, `docs/verification/claude-code.md`, `docs/install.md`, `CHANGELOG.md`, `experiments/delivery/README.md` | 3 | 6 |
| `after-fable-7` | no | `README.md`, `experiments/benchmark/results/2026-11-19/summary.md`, `experiments/benchmark/results/2026-11-19/README.md`, `docs/hooks.md`, `docs/verification/claude-code.md`, `package.json`, `experiments/delivery/README.md`, `docs/install.md`, `presets/claude/preset.json`, `CHANGELOG.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/README.md` | 2 | 6 |
| `after-fable-8` | no | `experiments/benchmark/results/2026-11-19/summary.md`, `experiments/benchmark/results/2026-11-19/README.md`, `README.md`, `docs/evidence.md`, `package.json`, `docs/verification/claude-code.md`, `.github/workflows/ci.yml`, `CHANGELOG.md`, `experiments/delivery/README.md`, `docs/hooks.md` | 6 | 5 |
| `after-fable-9` | yes | `docs/evidence.md`, `CHANGELOG.md`, `experiments/benchmark/results/2026-11-19/summary.md`, `experiments/rules/README.md`, `docs/usage.md`, `docs/install.md`, `README.md`, `package.json`, `docs/hooks.md` | 4 | 5 |
| `after-fable-10` | yes | `README.md`, `experiments/benchmark/results/2026-11-19/summary.md`, `experiments/benchmark/results/2026-11-19/README.md`, `docs/hooks.md`, `docs/install.md`, `package.json`, `docs/verification/claude-code.md`, `CHANGELOG.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.md`, `.github/workflows/ci.yml` | 4 | 6 |
| `after-opus-1` | yes | `README.md`, `docs/evidence.md`, `docs/verification/claude-code.md`, `docs/hooks.md`, `experiments/delivery/README.md`, `CHANGELOG.md` | 3 | 3 |
| `after-opus-2` | no | `docs/evidence.md`, `README.md`, `experiments/delivery/README.md`, `docs/verification/claude-code.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/README.md`, `docs/hooks.md` | 3 | 4 |
| `after-opus-3` | yes | `README.md`, `docs/evidence.md`, `docs/verification/claude-code.md`, `experiments/delivery/README.md`, `CHANGELOG.md` | 3 | 3 |
| `after-opus-4` | no | `README.md`, `docs/evidence.md`, `docs/verification/claude-code.md`, `src/adapters/claude-code/compat.ts`, `experiments/delivery/README.md`, `CHANGELOG.md` | 3 | 4 |
| `after-opus-5` | no | `README.md`, `docs/evidence.md`, `docs/verification/claude-code.md`, `src/adapters/claude-code/compat.ts`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/README.md`, `experiments/delivery/README.md` | 3 | 4 |
| `after-opus-6` | yes | `README.md`, `docs/evidence.md`, `docs/verification/claude-code.md`, `docs/hooks.md`, `src/adapters/claude-code/compat.ts` | 4 | 4 |
| `after-opus-7` | yes | `docs/evidence.md`, `docs/hooks.md`, `README.md`, `experiments/delivery/README.md` | 2 | 4 |
| `after-opus-8` | yes | `docs/verification/claude-code.md`, `docs/evidence.md`, `docs/usage.md`, `README.md`, `package.json`, `.github/workflows/ci.yml`, `experiments/delivery/README.md`, `docs/hooks.md`, `CHANGELOG.md` | 2 | 6 |
| `after-opus-9` | no | `docs/evidence.md`, `docs/usage.md`, `README.md`, `experiments/delivery/README.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/README.md`, `docs/verification/claude-code.md`, `CHANGELOG.md` | 0 | 5 |
| `after-opus-10` | yes | `README.md`, `docs/evidence.md`, `experiments/delivery/README.md`, `docs/verification/claude-code.md`, `CHANGELOG.md`, `docs/hooks.md` | 1 | 4 |
| `after-sonnet-1` | yes | `docs/evidence.md`, `README.md`, `docs/verification/claude-code.md`, `package.json`, `experiments/delivery/README.md` | 1 | 4 |
| `after-sonnet-2` | no | `README.md`, `docs/evidence.md`, `docs/verification/claude-code.md`, `experiments/delivery/README.md`, `docs/usage.md`, `docs/hooks.md` | 1 | 4 |
| `after-sonnet-3` | yes | `README.md`, `docs/evidence.md`, `docs/hooks.md`, `docs/verification/claude-code.md` | 0 | 3 |
| `after-sonnet-4` | no | `docs/evidence.md`, `README.md`, `docs/verification/claude-code.md`, `experiments/delivery/README.md` | 2 | 4 |
| `after-sonnet-5` | yes | `README.md`, `docs/evidence.md`, `docs/verification/claude-code.md` | 2 | 3 |
| `after-sonnet-6` | no | `README.md`, `docs/evidence.md`, `docs/verification/claude-code.md`, `docs/usage.md`, `docs/hooks.md` | 1 | 4 |
| `after-sonnet-7` | yes | `docs/evidence.md`, `README.md`, `experiments/delivery/README.md`, `docs/verification/claude-code.md` | 1 | 4 |
| `after-sonnet-8` | yes | `README.md`, `docs/evidence.md`, `docs/verification/claude-code.md` | 2 | 3 |
| `after-sonnet-9` | yes | `README.md`, `docs/evidence.md`, `docs/hooks.md` | 1 | 4 |
| `after-sonnet-10` | yes | `README.md`, `docs/evidence.md`, `docs/hooks.md`, `docs/verification/claude-code.md` | 1 | 3 |
| `after-haiku-1` | yes | `README.md`, `docs/verification/claude-code.md`, `docs/evidence.md`, `CHANGELOG.md` | 0 | 3 |
| `after-haiku-2` | no | `README.md`, `docs/evidence.md` | 0 | 3 |
| `after-haiku-3` | yes | `README.md`, `docs/verification/claude-code.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.md` | 1 | 3 |
| `after-haiku-4` | no | `README.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.md`, `experiments/benchmark/results/2026-11-19/summary.md`, `experiments/delivery/README.md` | 1 | 5 |
| `after-haiku-5` | no | `README.md`, `docs/evidence.md`, `experiments/delivery/README.md`, `docs/install.md` | 1 | 2 |
| `after-haiku-6` | no | `README.md`, `docs/evidence.md`, `experiments/delivery/README.md` | 4 | 3 |
| `after-haiku-7` | yes | `README.md`, `docs/verification/claude-code.md`, `docs/evidence.md` | 4 | 3 |
| `after-haiku-8` | yes | `README.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.md`, `experiments/benchmark/results/2026-11-19/summary.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/README.md` | 1 | 3 |
| `after-haiku-9` | no | `README.md`, `package.json`, `docs/evidence.md` | 2 | 4 |
| `after-haiku-10` | yes | `README.md`, `docs/evidence.md`, `docs/verification/claude-code.md` | 0 | 3 |
