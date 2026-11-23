Verdict: **adopt with conditions.** Run it as a limited pilot on pinned Claude Code versions, not a team-wide rollout yet.

**Reasons**

- **It addresses the exact gap you have.** You mix models and use subagents heavily, and that is where the native options fall short. In the tool's own benchmark, a user `CLAUDE.md` reached 100% of main-conversation requests but only 32.2% (39 of 121) of subagent requests. It never reaches the built-in Explore and Plan subagents, and it gives every model every other model's rules. Only 31.5% of the rule text in a request was meant for that request's model, against 79.0% under noonsight (`README.md:30-40`, `docs/evidence.md` D6–D12, D17).
- **The evidence is unusually careful and honest about itself.** Every number maps to a committed raw file, and a test recomputes it (`docs/evidence.md:3-5`). The fuzzer found nine real failures (F1–F9), and each now has a reproduction in the corpus (`experiments/delivery/README.md:211-259`). The latest run, on Claude Code 2.1.330, reports 0 of 299 sessions breaking the invariant and 763 of 763 subagent requests covered (D18–D20).
- **It is low-risk to run.** The hooks always exit 0, never block or deny a call, use no network unless you turn on the optional classifier, and have a 10-second timeout. Each hook run costs about 50–90 ms of CPU at the median (`docs/hooks.md:9-18`, D15). There is a per-session off switch (`NOONSIGHT_DISABLE=1`) and a `noonsight uninstall`.
- **It is very young.** `package.json` says version 0.0.1 and `private: true`. It is not on npm, so you install it from a clone with `npm link` (`README.md:64-70`). The whole changelog is "Unreleased", and F1–F9 were all found and fixed between 2026-11-19 and 2026-11-23. That is good for the method but means the code is still changing fast.
- **It depends on Claude Code internals, and its CI doesn't check the version it was last measured on.** It relies on things Claude Code doesn't document: `CLAUDE_CODE_SESSION_ATTENDED`, the transcript layout, subagent `.meta.json` files, and `ps` parsing of the `claude` command line (`docs/verification/claude-code.md:45-46, 57-58, 50`). The newest results are on 2.1.330, but CI's live job pins 2.1.325 (`.github/workflows/ci.yml:32-41`). CI also skips the login, delivery and subagent checks, which only run by hand with extra flags.
- **Out of the box it does little for attended work.** Attended Opus 5.5 and Fable 5.2 sessions get nothing from the preset. Attended Sonnet 5.5 and Haiku 5.5 sessions get only `verify-changes`, and only after editing a tracked code file (`README.md:47-53`). The value comes from rules you write or turn on, and from setting scopes and `unattended_when_env`.
- **What rules change is a separate, weaker result.** The rule-effect samples are 30–40 runs on small tasks, and the README says to read them as results on those tasks only (`README.md:207`). Some rules cost real money: `verify-changes` roughly doubled Sonnet's cost on a cheap fix ($0.0240 to $0.0505, R6).

**Conditions and risks**

Conditions for it to work for you:
- **Pin and recheck Claude Code versions.** Before each upgrade, rerun `npm run test:live` with `NOONSIGHT_LIVE_LOGIN=1` and `NOONSIGHT_LIVE_DELIVERY=1`. A behavior change can make delivery fail with only a log line or warning to show for it. Note the preset checks send one request to each model, and Fable's is billed to usage credits.
- **Declare all four models** in `~/.config/noonsight/noonsight.json`. Undeclared models get a warning and no rules.
- **Mark unattended runs.** Set `session.unattended_when_env` to your orchestrator's or CI's variable. Otherwise interactive sessions nobody watches count as attended and get the wrong rules.
- **Give tasks scopes.** Use `NOONSIGHT_SCOPE` and `match` patterns for subagents, or most scoped rules never fire.
- **Keep routing and the classifier off.** They are not measured in the benchmark. In auto mode, a routed call also makes Claude Code refuse the other agent calls in the same response until they are made again (`docs/hooks.md:371`).
- **Keep fixed, shared rules in `CLAUDE.md`.** Use noonsight only for what differs by model, task or place. Anything that must never happen belongs in a hook or permission rule: a delivered rule is context, not enforcement.
- **Check delivery with `noonsight report`,** and drop rules that don't visibly change anything on your own tasks.

Risks:
- **Subagent gaps:**
  - Workflow agents get no rules.
  - Agent-team teammates in split panes weren't tested.
  - Subagents from plugins noonsight can't read, such as org-synced ones, are predicted on the parent's model.
  - Several foreground calls of one type that need different rules give their subagents nothing until each one's first Edit, Write or agent call (`docs/hooks.md:377-387`).
- **Session-lifecycle gaps:**
  - `/fork` doesn't work in sessions started by `noonsight run` with rules.
  - A conversation compacted with no response since and then resumed with nothing naming a model can get the wrong model's rules.
- **Install footprint:** `noonsight install` adds hooks to every Claude Code login on the account. The machine-wide `--managed` install has never been tested live (`docs/verification/claude-code.md:117`).
- **Single upstream maintainer** (`bpsanti/noonsight`). You may end up maintaining a fork whenever Claude Code changes its hook behavior.

**What it guarantees**

It guarantees delivery, not obedience: each session and subagent gets the rules noonsight's own resolver picks for the model it actually runs on. That rests on hook behavior checked only on Claude Code 2.1.325–2.1.330, against a local stand-in for the API that never reached a real model, and the benchmark uses noonsight's own resolver as the reference, so a wrong choice of rules would not show up (`experiments/delivery/README.md:268`).

I only read the code, docs and committed results. I did not run the test suite or any of the benchmarks myself.
