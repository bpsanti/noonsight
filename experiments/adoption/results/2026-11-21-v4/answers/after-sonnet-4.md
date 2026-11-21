Verdict: **Adopt with conditions.** Pilot it on a few machines first. This is based on reading the README, the docs and the delivery benchmark's description. I did not run the tests or the benchmark.

**Reasons:**
- **It fits how you work.** You mix Opus, Sonnet, Haiku and Fable and start many subagents. A `CLAUDE.md` can't pick rules by model, and it never reaches the built-in Explore and Plan subagents (`docs/evidence.md` D6, D10, D12). In the benchmark it gave only 32.2% subagent coverage (39 of 121) and 31.5% of its rule text was written for the request's own model. noonsight scored 100% on subagents (668 of 668) and 79.0% own-model text.
- **The delivery claim is specific and tested.** Across 300 randomized sessions, 3,219 of 3,221 requests had their rules, which is 99.9%. The sessions covered `/model`, `/compact`, `/clear`, resumes, subagents and code edits. The fuzzer found four real bugs (F1–F4) and each has a shortest-case reproduction in a corpus that passes. Every README number links to `docs/evidence.md`, and `npm test` recomputes each one from the raw files.
- **It is low-risk to run.** Hooks always exit 0, never block a call, and make no network calls. The classifier is the one exception, and it is off by default. Each hook run costs 50–90 ms of CPU. Every decision is logged and `noonsight report` shows it. `NOONSIGHT_DISABLE=1` and `noonsight uninstall` turn it off.
- **Its limits are stated openly.** It says delivery is not obedience, lists what wasn't measured, and says "skip it if every session runs one model".
- **Out of the box it does little for watched sessions on some models.** Watched Opus 5.5 and Fable 5.2 sessions receive nothing from the preset. Sonnet and Haiku get most of their rules only with a scope (`NOONSIGHT_SCOPE`). Without configuration you would see no benefit from the preset.

**Conditions and risks:**
- **It is pre-release.**
  - `package.json` says 0.0.1, it is `private`, and the npm name is an empty placeholder. You would install from a clone of a single author's GitHub repo, so you would need to pin a commit and review the code, since it runs in every session.
  - The evidence is from one run on one date.
- **It is tied to a Claude Code version.**
  - The measurements are on 2.1.328, and the rule-effect runs used 2.1.329. It depends on hook behavior and some undocumented details, such as `CLAUDE_CODE_SESSION_ATTENDED=0` and the `/model` hook timing.
  - Run `npm run delivery -- corpus` and `noonsight check` on each Claude Code upgrade, and pin or stage upgrades.
- **The benchmark measures delivery only.** It ran against a stub API, so no real model saw any request, and it checks against noonsight's own resolver. A wrong resolution would not show up. It did not cover `/resume` inside a session, forks, plan mode, agent teams, routing, the classifier, repository configs, or subagents that edit files. The README says all of this.
- **The effect of the rules is thin.**
  - Samples are 30–40 runs on small tasks.
  - `verify-changes` made Sonnet and Haiku run tests (29 of 30 and 27 of 30, against 0 of 30 without it), but it roughly doubled cost on that task ($0.0240 to $0.0505 for Sonnet).
  - Haiku's `carry-through` showed no effect.
  - Your own rules have no measured effect until you measure them. Budget time to write and test the rules that matter to your team. Without that, you are installing a delivery mechanism with a generic preset.
- **Known gaps:**
  - A conversation compacted with no response since and then resumed can run on the default model, which noonsight can't identify.
  - Several same-type subagents started in one response with different rules get none.
  - Plugin subagent definitions, `--agents` and managed definitions are not read, so those subagents are predicted wrongly and flagged `MISMATCH`.
  - Subagents that don't start through the agent tool, such as agent-team teammates, get nothing.
  - Edits made through the shell don't trigger `code-edit`.
  - On macOS, model detection can fall back to parsing `ps` output.
- **Enforcement is not guaranteed.** Rules are context, not hard guarantees. Anything that must never be broken needs a real hook or a permission rule.
- **Rollout work:**
  - Set `session.unattended_when_env` for any orchestrator or CI.
  - Decide on scopes.
  - Use `noonsight trust` per clone for repo-level configs.
  - Check managed settings don't forbid user hooks.
- **Suggested pilot.**
  - Run on 3–5 machines for 2–4 weeks and review `noonsight report` for undelivered rules and `MISMATCH` lines.
  - Compare behavior on your own tasks before rolling out widely.

**What it guarantees:** In the author's benchmark, noonsight delivered each Claude Code session and subagent the rules written for the model it actually ran on in 99.9% of requests with rules due (3,219 of 3,221), through the lifecycle events tested. That rests on its Claude Code hooks and on a fuzz test of 300 sessions against a local stand-in for the API, scored by noonsight's own resolver. It guarantees delivery only, not that the model follows the rules.
