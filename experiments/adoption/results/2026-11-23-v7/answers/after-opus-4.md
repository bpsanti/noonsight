**Verdict: adopt with conditions.** Start with a pilot on a few machines, not a team-wide rollout.

**Reasons**

1. **It covers subagents, which is where the alternatives fall short.** In the project's benchmark, a user `CLAUDE.md` got the rules into every request of the main conversation (526 of 526). But it reached only 39 of 121 subagent requests, and it never reaches the built-in Explore and Plan subagents (`docs/evidence.md` D10, D17). noonsight reached all subagent requests in both runs: 668 of 668, then 763 of 763 (D3, D20). Your team runs many subagents, so this is the main reason to adopt it.
2. **Each model gets less of the other models' rules.** With rules for all four models in a `CLAUDE.md`, every model gets everyone's rules: only 31.5% of the rule text in a request was meant for that request's model. With noonsight it was 79.0% (D12), and about a quarter of the characters added per request (D13).
3. **The evidence is unusually careful.** Every number links to a committed raw file and a computation, and `npm test` recomputes it (`docs/evidence.md`). The fuzzer's nine failures (F1–F9) are written up, fixed, and kept as tests that must pass (`experiments/delivery/README.md:211`).
4. **Its effect on how models behave is small and partly unmeasured.** The real gain is narrow: `verify-changes` made Sonnet and Haiku run the tests after a fix in 29/30 and 27/30 runs, against 0/30 without it (R3), at about twice the cost per run (R6). Opus 5.5 was left out of the rule-effect experiments because it was too expensive to test (`experiments/rules/README.md:218`). With the defaults, an attended Opus or Fable session gets nothing from the preset (`README.md:49`). For your Opus and Fable users, the preset adds little until you write or enable rules.
5. **It's very young.** Version 0.1, not on npm, installed from a git clone. All the evidence dates from 2026-11-14 to 2026-11-23, and the last five failures were fixed today.

**Conditions and risks**

- **Pin your Claude Code version and re-check on upgrade.** The tool depends on undocumented behavior: the `CLAUDE_CODE_SESSION_ATTENDED` variable, transcript layout, `ps`/`/proc` reads of the parent's `--model`, and `.meta.json` timing (`docs/verification/claude-code.md`). Everything was measured on 2.1.328 and 2.1.330. Run `noonsight check` and the live tests whenever you upgrade.
- **Gaps that may affect you:**
  - A workflow's agents get no rules.
  - Agent teams, routing and the classifier were not measured.
  - `opusplan` and the `default` model setting can't be resolved to a model (`compat.ts:44`).
  - Plugin subagents your organization syncs are predicted on their parent's model.
  - A compacted conversation, resumed with nothing naming a model, can get the wrong model's rules.
  - `/fork` doesn't work in sessions started with `noonsight run`.
  - On Bedrock, Vertex or Foundry, model aliases select other models (`PROVIDER_VARS`). Check this if you use them.
- **Configuration you must set:**
  - Set `session.unattended_when_env` for orchestrated interactive sessions.
  - Give Sonnet and Haiku sessions a scope, or most of their rules never apply.
  - Decide whether to `enable` the Opus and Fable rules for attended sessions.
- **What install touches:** it writes hooks into every Claude Code login of the account. That's reversible with `noonsight uninstall`, but each developer should know. Since this is a clone-and-link install from one GitHub repo, review the source at a pinned commit before installing.
- **Cost:** each hook run takes 50–90 ms of processor time (D15). Rules that work also cost tokens (R6).
- **Judge it by behavior, not delivery.** `noonsight report` counts deliveries, not effects. Measure whether your own rules change anything; the README says the same.
- **The benchmark checks noonsight against its own resolver** (`experiments/delivery/README.md:268`). A mistake in which rules it picks would not show up there, only a mistake in getting them delivered.

**What it guarantees:** It guarantees delivery, not obedience: each session and subagent gets as context the rules configured for the model it runs on (100% of due requests in the 299 benchmark sessions that finished on Claude Code 2.1.330), and that rests on Claude Code's hook behavior, checked on that version against a stand-in API that sent no requests to a real model, outside the documented gaps above.
