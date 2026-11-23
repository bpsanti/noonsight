# Files read by each v6 session

Read calls, in the order first read, from `runs.jsonl`; the Grep and Glob counts are its `tool_calls`.
Every session listed the repository with Glob, which shows the name `test/adoption.test.ts`; no session opened it.
Streams were searched for the evaluation's own text (`grounded_after`, `adopt_on_wrong_grounds`, `experiments/adoption/results`): no match.

| Session | Grounded | Read | Grep | Glob |
| --- | --- | --- | --- | --- |
| `after-fable-1` | no | `README.md`, `docs/evidence.md`, `docs/verification/claude-code.md`, `docs/hooks.md`, `experiments/delivery/README.md`, `package.json`, `.github/workflows/ci.yml`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.md`, `experiments/benchmark/results/2026-11-19/summary.md`, `experiments/benchmark/results/2026-11-19/README.md`, `docs/install.md`, `CHANGELOG.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/README.md` | 6 | 4 |
| `after-fable-2` | no | `README.md`, `docs/evidence.md`, `docs/hooks.md`, `package.json`, `experiments/benchmark/results/2026-11-19/summary.md`, `experiments/benchmark/results/2026-11-19/README.md`, `docs/install.md`, `docs/verification/claude-code.md`, `CHANGELOG.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.md`, `.github/workflows/ci.yml` | 4 | 6 |
| `after-fable-3` | no | `README.md`, `docs/evidence.md`, `docs/hooks.md`, `docs/install.md`, `experiments/delivery/README.md`, `package.json`, `docs/verification/claude-code.md`, `docs/usage.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/agree.json` | 4 | 6 |
| `after-fable-4` | yes | `docs/evidence.md`, `docs/hooks.md`, `presets/claude/SOURCES.md`, `README.md`, `package.json`, `experiments/benchmark/results/2026-11-19/README.md`, `experiments/delivery/README.md`, `CHANGELOG.md`, `.github/workflows/ci.yml` | 6 | 5 |
| `after-fable-5` | yes | `docs/evidence.md`, `docs/hooks.md`, `README.md`, `experiments/benchmark/results/2026-11-19/summary.md`, `experiments/benchmark/results/2026-11-19/README.md`, `presets/claude/SOURCES.md`, `presets/claude/preset.json`, `package.json`, `experiments/delivery/README.md` | 3 | 5 |
| `after-haiku-1` | no | `README.md`, `experiments/delivery/README.md` | 1 | 2 |
| `after-haiku-2` | no | `README.md`, `docs/verification/claude-code.md`, `experiments/benchmark/results/2026-11-19/summary.md`, `experiments/rules/results/2026-11-20/summary.md` | 0 | 3 |
| `after-haiku-3` | yes | `README.md`, `docs/evidence.md`, `docs/verification/claude-code.md` | 2 | 4 |
| `after-haiku-4` | no | `README.md` | 2 | 2 |
| `after-haiku-5` | no | `README.md`, `experiments/delivery/README.md` | 1 | 2 |
| `after-opus-1` | yes | `README.md`, `docs/evidence.md`, `docs/verification/claude-code.md`, `experiments/delivery/README.md`, `src/adapters/claude-code/compat.ts`, `CHANGELOG.md` | 1 | 3 |
| `after-opus-2` | no | `README.md`, `docs/evidence.md`, `docs/verification/claude-code.md`, `src/adapters/claude-code/compat.ts`, `CHANGELOG.md`, `experiments/delivery/README.md` | 1 | 3 |
| `after-opus-3` | no | `README.md`, `docs/evidence.md`, `docs/verification/claude-code.md`, `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/README.md`, `CHANGELOG.md` | 2 | 7 |
| `after-opus-4` | no | `README.md`, `docs/evidence.md`, `docs/verification/claude-code.md`, `package.json`, `CHANGELOG.md`, `experiments/delivery/README.md` | 1 | 4 |
| `after-opus-5` | yes | `docs/evidence.md`, `README.md`, `experiments/delivery/README.md`, `experiments/benchmark/results/2026-11-19/summary.md`, `docs/verification/claude-code.md`, `experiments/benchmark/results/2026-11-19/README.md` | 1 | 5 |
| `after-sonnet-1` | yes | `README.md`, `docs/evidence.md`, `docs/verification/claude-code.md` | 1 | 3 |
| `after-sonnet-2` | yes | `README.md`, `docs/evidence.md`, `docs/hooks.md` | 1 | 4 |
| `after-sonnet-3` | yes | `README.md`, `docs/evidence.md`, `docs/verification/claude-code.md` | 1 | 4 |
| `after-sonnet-4` | yes | `README.md`, `docs/evidence.md`, `docs/hooks.md`, `experiments/delivery/README.md`, `experiments/benchmark/results/2026-11-19/README.md`, `docs/usage.md` | 0 | 4 |
| `after-sonnet-5` | yes | `README.md`, `docs/evidence.md`, `docs/hooks.md`, `package.json` | 2 | 4 |
