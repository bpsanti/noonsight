**Verdict:** Adopt with conditions. Pilot it on a few machines first, pinned to a Claude Code version that the verification table covers.

**Reasons:**
1. It fits your mix of models and subagents. It sends each session and each subagent the rules for the model it runs on, and re-sends them after `/model`, `/compact`, `/clear`, and resumes. Plain `CLAUDE.md` can't do per-model rules. In the benchmark, `CLAUDE.md` covered 32.2% of subagent requests, and noonsight covered 100% (D3, `docs/evidence.md`).
2. The delivery claim has a measured basis. The benchmark ran 300 sessions and 4,381 requests, and noonsight covered 99.9% (3,219 of 3,221) of the requests with rules due. One session out of 300 had an unexplained violation (`experiments/delivery/results/claude-code-2.1.328/2026-11-21-d5fd71f/summary.md`).
3. The design is conservative. Hooks never block and make no network calls, except the classifier, which is off by default. Repo-level rules do nothing until each person runs `noonsight trust`. There is a `NOONSIGHT_DISABLE=1` switch, and `noonsight report` shows what was delivered. MIT license.
4. The rule effect is real but narrow. For Sonnet and Haiku, the `verify-changes` rule raised test runs after a one-file fix from 0 of 30 to 27–29 of 30. It also roughly doubled the cost of that run ($0.0240 to $0.0505) (`docs/evidence.md`, R3 and R6).

**Conditions and risks:**
- **Claude Code version.** The delivery benchmark ran on 2.1.328 only. `docs/verification/claude-code.md` checks individual facts across versions 2.1.325 to 2.1.330, and its own text says to recheck when the CI-pinned version changes. Pin one version for the team and rerun `npm run test:live` after every upgrade. I did not run the test suite here.
- **Opus and Fable interactive sessions get nothing from the preset.** The README says a watched Opus or Fable session receives no preset rules in any scope. Those rules are for unattended runs and subagents. If you want rules in those sessions, you have to write them yourself, and they have no measured effect until you measure them.
- **Sonnet and Haiku need a scope.** Their scoped rules only reach a session started with `NOONSIGHT_SCOPE` or `noonsight run --scope`. Subagents get a scope from a match pattern in their task text, so you have to write those patterns.
- **Installation touches every login.** `noonsight install` adds hooks to every Claude Code login on the machine, keeping other settings. On a shared or service account, that reaches more than one person. It is also an unreviewed install from a git clone, because 0.1 is not on npm.
- **Not measured.** `/resume` inside a session, forks, plan mode, agent teams, routing, the classifier, repo configs, and subagents that edit files. Your team's use of these is outside the guarantee.
- **Token cost.** The preset adds about 1,155 characters per request, roughly 4.7% of the request text. Your own rules add to that.
- **Delivery is not obedience.** A delivered rule is context. Measured rule effects apply only to the small tasks the experiments used, with 30 to 40 runs per arm.
- **Version labels don't line up.** `package.json` says 0.0.1, and the README says 0.1 is unpublished. Treat it as pre-release.

**What it guarantees:** Each Claude Code session and subagent that the hooks reach gets the rules for the model it actually runs on, and gets them again after a model change, as measured on Claude Code 2.1.328 against a local stand-in for the API (99.9% coverage in the 300-session benchmark). That rests on the Claude Code hook events the tool relies on, which are checked against recorded hook inputs and live tests for each listed version, plus the benchmark and fuzzer runs. It does not guarantee that the model follows the rules.
