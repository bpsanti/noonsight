**Verdict:** adopt with conditions. Run it as a pilot on a few machines, pinned to one commit and one Claude Code version, not as a team-wide rollout yet.

I read the README, the hook, install and evidence docs, the delivery benchmark write-up and some raw result files. I could not run the test suite in this session, so the numbers below are the repository's own, with one spot check against a raw file.

**Reasons:**
- **It fits your setup.** It delivers rules by the model each session and subagent actually runs on, which is the case a `CLAUDE.md` handles worst.
- **The gap it closes is in subagents.** In its benchmark a user `CLAUDE.md` reached 100% of main-conversation requests (526 of 526) but only 32.2% of subagent requests (39 of 121); noonsight reached 100% of both on the same sequences.
- **It keeps other models' rules out.** About 79% of the rule text in a request was written for that request's model, against 31.5% with a `CLAUDE.md` holding every model's rules.
- **Low blast radius.** The hooks always exit 0, never deny a call, use no network, and there are no runtime dependencies. `noonsight uninstall` removes only its own entries.
- **It is very young.** `package.json` says 0.0.1 and private, it is not on npm, and you install from a clone. Nine delivery bugs were found and fixed in the last five days, the latest dated today.
- **The preset does little for attended Opus and Fable sessions.** All their attended rules ship off, so those sessions receive nothing until you enable rules or write your own.
- **Evidence that rules change behaviour is thin.** It rests on small tasks with 30 to 40 runs per arm. `verify-changes` got tests run in 29 of 30 Sonnet runs against 0 of 30 without, but roughly doubled that run's cost ($0.0240 to $0.0505).

**Conditions and risks:**
- **Claude Code upgrades can break it silently.** It depends on several undocumented behaviours and is measured on one version at a time (latest 2.1.330). Rerun its corpus (`npm run delivery -- corpus`, no login needed) before each upgrade.
- **Subagent gaps remain.** These get nothing or the wrong model's rules:
  - workflow agents get nothing;
  - parallel same-type calls that need different rules get nothing until each subagent's first Edit, Write or agent call;
  - subagents from organisation-synced plugins are predicted on their parent's model.
- **Not measured at all:** agent teams, routing, the classifier and `opusplan`. Leave routing and the classifier off.
- **The benchmark has limits.** It uses a stand-in API, so no real model ran, and it scores against noonsight's own resolver, so a wrong resolution would not show. The "0 of 300" run actually drove 299 sessions; one timed out and was excluded.
- **The decision log is not proof of delivery.** It records what the hook returned, not what reached the model, so `noonsight report` can overstate.
- **Environment constraints.**
  - Windows is unsupported.
  - Managed settings that forbid user hooks stop it; `noonsight check` reports this.
  - On Bedrock, Vertex or Foundry, aliases need pinning variables.
- **It writes to every Claude Code `settings.json` of the account.** Each person also has to run `noonsight trust` once per repository before shared rules apply.
- **Division of labour.** Keep rules every model should have in `CLAUDE.md`, and enforce anything that must never be broken with a hook or permission rule.
- **Exit test for the pilot.** After two weeks, check `noonsight report` for `MISMATCH` and `calls-differ` counts and for rules that never changed anything you can see.

**What it guarantees:** noonsight guarantees that each session and subagent is handed the rules for its model, not that the model follows them. That rests on a stand-in-API benchmark on a single Claude Code version, scored against its own resolver, and on hook behaviour that Claude Code can change.
