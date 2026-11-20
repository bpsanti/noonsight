**Verdict:** Adopt with conditions. Run it as a time-boxed pilot with a few people, not as a team-wide install.

**Reasons:**
- **It fits how you work.** You mix Opus, Sonnet, Haiku and Fable, and many sessions start subagents. That is the case noonsight is built for: it uses hooks to give each session and each subagent the rules for the model it actually runs on, and it re-delivers them after `/model`, `/compact`, `/clear` and resume (`docs/hooks.md`).
- **Native options cover less.** On the same 60 sequences, with every model's rules loaded, a user `CLAUDE.md` reached 87.3% of requests and 32.2% of subagent requests. `.claude/rules` reached 70.9% and 32.2%. A skill per model reached 0%. noonsight reached 100% on both (README, evidence D5–D11). A `CLAUDE.md` also loads every model's rules into every request. Only 31.6% of its rule text was for the request's model, against 78.8% under noonsight (D12).
- **The delivery claim is checked in a strong way.** It was tested with 300 random real Claude Code sessions, plus a corpus of reproductions and a self-check that plants bugs. It was tested against a local stand-in for the API (a stub), so no request reached a model. Coverage was 99.5% (3,199 of 3,216 requests), and 3 of 300 sessions broke the invariant. The fuzzer found four real defects. Two were fixed before that run and two (F3, F4) after it.
- **The design is low-risk.** Hooks always exit 0, never block a call, use no network by default, and refuse a bad configuration whole instead of guessing. Every delivery is logged, and `noonsight report` and `check` let you audit it. There are no runtime dependencies. `NOONSIGHT_DISABLE=1` and `noonsight uninstall` are easy exits.
- **The rule effects are real but modest.** Sonnet and Haiku ran the tests after a one-file fix in 30 of 30 and 27 of 30 runs with the preset rules, against 0 of 30 in both cases without them. `carry-through` took complete backlog runs from 9 of 40 to 32 of 40 on Sonnet. The authors report their own negative results: Haiku's `carry-through` showed nothing, and rules changed nothing where the models already did the work. Those runs cost more: $0.0505 with `verify-changes` against $0.0240 without, on one Sonnet task.

**Conditions and risks:**
- **It is pre-release.** `package.json` is version 0.0.1 and private, and the README says 0.1 isn't on npm. You would install from a clone, so pin a commit and review the code, since it runs as a hook in every session.
- **It is tied to the Claude Code version.** The delivery run used 2.1.328 and the rule-effect runs used 2.1.328 and 2.1.329. noonsight depends on hook behaviour that Claude Code can change. Adopt only if you pin or stage Claude Code upgrades. After each upgrade, run `npm run delivery -- corpus` and `noonsight check`, and read `docs/verification/claude-code.md`.
- **The headline number is not for the current build.** The 99.5% figure comes from a build before the F3 and F4 fixes. The 300 sessions have not been re-run on the fixed build. The three failing sessions are exactly F3 and F4, which now only have passing reproductions.
- **It measures delivery, not obedience.** The test is whether the text reaches the request, checked against noonsight's own resolver, never against a real model. A wrong resolution would not show up. The rule-effect samples are 30 to 40 runs per arm on small tasks, so they are not general effects.
- **The preset delivers little by default.**
  - A session with no task scope gets little from it, because several rules are only for unattended runs, subagents or a named scope.
  - You must set `session.unattended_when_env`, for example to your CI variable, and decide on scopes.
  - The rules are written from Anthropic's per-model guides. They are only worth having if you check, with `report`, that each one changes something you can see.
- **Known gaps:**
  - A conversation compacted with no response since, then resumed with nothing naming a model, runs on Claude Code's default model, and noonsight cannot tell which. It gets a possibly wrong or no rule set.
  - When several open agent calls of one type would get different rules, their subagents get none.
  - Plugin, `--agents`, managed and agent-team subagents are not read.
  - Shell edits are not seen by the code-edit trigger.
  - Not measured: `/resume` inside a session, forks, plan mode, agent teams, `noonsight run`, routing, the classifier, project configurations, and subagents that edit files.
  - Delivery after `/model` or resume is treated as unconfirmed. The cost is occasional repeated rules and notes, not lost rules.
- **Policy and privacy:**
  - If managed settings forbid user hooks, it won't run. `noonsight check` tells you.
  - Leave the classifier off. It sends the first 4,000 characters of a task to a model.
  - Leave routing off. In auto mode, a routed call makes Claude Code refuse the other calls in that response.
- **Pilot exit test:** after a couple of weeks, `noonsight report` should show every rule you rely on actually delivered, with no `MISMATCH` or `config-invalid` lines. Drop any rule whose effect you can't see. Compare that against a plain `CLAUDE.md`, which is simpler if people mostly stick to one model.

**What it guarantees:** For the Claude Code version it was tested on (2.1.328), noonsight delivers each session and subagent the rules written for the model it runs on, and retires other models' rules after a switch. It did so on 99.5% of requests in 300 fuzzed sessions. That result rests on Claude Code's own hooks and a local resolver, and was measured against a stub API, not a real model. It does not guarantee that the model follows the rules.
