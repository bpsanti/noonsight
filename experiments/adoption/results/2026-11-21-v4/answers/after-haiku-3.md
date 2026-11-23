**Verdict:** Adopt with conditions. Pilot it on one machine first, on the Claude Code version your team actually runs, before rolling it out.

**Reasons:**
- Delivery is measured, not just claimed. The committed benchmark (`docs/evidence.md`, D2, D3) reports 99.9% coverage of requests that had rules due (3,219 of 3,221) and 100% of subagent requests (668 of 668). Sessions include `/model`, `/compact`, `/clear`, resumes, and subagents.
- It beats the native options on the same sequences (README table, D5–D11). A user `CLAUDE.md` covered 87.3% of requests and 32.2% of subagent requests. `.claude/rules` covered 70.6%. A skill per model covered 0%. Your mix of models and heavy subagent use is the case where the native options fall short.
- Rules can be scoped per model, per place (session, unattended, subagent), and per repo. A repo's rules only activate after each clone runs `noonsight trust`, so a checked-in config cannot silently change behavior.
- It has no runtime dependencies and makes no network calls. The one exception is the classifier, which is off by default.
- The project has a test suite that recomputes every published number from the raw result files (`test/evidence.test.ts`), and it has a corpus of its own past failures (F1–F4), all fixed.

**Conditions and risks:**
- **Version pinning.** Every measurement is on Claude Code 2.1.328 (`run.json`). Hook behavior has changed across versions before. Before rollout, run `npm run delivery -- corpus` and `fuzz --n 60` with `--claude <your binary>` on the version your team uses.
- **Interactive Opus and Fable sessions get no preset rules.** The preset's rules for those two models are for unattended runs and subagents only (README, "Right after install"). Set `session.unattended_when_env` to your orchestrator's variable, or write your own rules for those models, or they get nothing.
- **Sonnet and Haiku need a scope.** Their scoped rules only arrive when the session has `NOONSIGHT_SCOPE` set. Otherwise you get only the unscoped rules.
- **Not measured, and relevant to you:** agent teams, subagents that edit files, `/resume` inside a session, forks, plan mode, `noonsight run`, routing, and project configurations. Your team likely uses several of these, so check them yourselves.
- **Parallel same-type subagents.** When several calls of one type are open and would get different rules, the subagents get none (`docs/hooks.md`, "shared"). Heavy parallel subagent use makes this more likely. It is documented, and the benchmark counts it separately.
- **Known failure.** The one failing session in 300 was the documented limit: a conversation compacted with no response since, then resumed with nothing naming a model, runs on Claude Code's default model, which noonsight cannot detect.
- **Machine-wide install.** `noonsight install` adds hooks to every Claude Code login it finds, and `watch enable` can add more. Decide whether that is acceptable for shared machines and CI.
- **Permissions.** Subagent calls that routing changes get `allow` by default, skipping the permission prompt (`subagents.permission`, `docs/hooks.md`). Routing is off by default, but review this before turning it on.
- **Maturity.** `package.json` says 0.0.1 and the README says 0.1, which is not on npm yet. It is installed from a git clone, and the project was previously named sextant. Pin a commit.
- **Cost and effect.** Rule effects are small-sample results on small tasks (30–40 runs per arm). One rule, `verify-changes`, roughly doubled Sonnet's per-run cost ($0.0240 to $0.0505). Delivery does not mean the model follows the rule.
- **Classifier.** If you turn it on, the first 4,000 characters of each task go to a small model through your own login. Check whether that is acceptable for your code.

**What it guarantees:** On a machine where its hooks are installed, each request in a Claude Code session carries the rules that resolve for its model, scope, place and triggers, and no other model's rules without a note retiring them. This is shown for Claude Code 2.1.328, and it rests on the hooks injecting those rules, which the stub-API benchmark and corpus test. It does not guarantee the model follows the rules, nor delivery on other Claude Code versions or on the unmeasured paths above.

I read the README, `docs/evidence.md`, `docs/hooks.md`, the delivery benchmark README, and the committed run metadata. I did not run the tool or its test suite.
