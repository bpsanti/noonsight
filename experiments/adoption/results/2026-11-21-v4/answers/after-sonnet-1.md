**Verdict: adopt with conditions.** Pilot it first, and make the pilot's job to check that the rules change something you can see.

**Reasons:**
- **It fits your setup.** Your team mixes Opus, Sonnet, Haiku and Fable, and many sessions start subagents. That is the case where a single `CLAUDE.md` does worst.
  - A user `CLAUDE.md` reached 100% of the session's own requests (526 of 526, D17). It reached only 32.2% of subagent requests (39 of 121, D10), and it never reaches the built-in Explore and Plan subagents.
  - noonsight reached 100% of subagent requests (668 of 668, D3).
  - `.claude/rules` reached 32.2% of subagent requests, the same as `CLAUDE.md`. A skill per model reached 0% (0 of 121).
- **It stops sending each model the other models' rules.** Of the rule text in a request, 79.0% was written for that request's model under noonsight. The figures were 31.5% for `CLAUDE.md` and 27.0% for `.claude/rules` (D12). It also adds fewer characters per request: 1,155, against 4,415 and 3,987 (D13).
- **Its design is safe to try.** The hooks never block anything, never use the network, and exit 0.
  - Everything is logged. `noonsight report` shows what was delivered, and `check` and `resolve` show what each model would receive.
  - `NOONSIGHT_DISABLE=1` and `noonsight uninstall` turn it off.
  - A bad configuration is refused whole, with a warning, instead of being guessed at.
  - It has no runtime dependencies and an MIT licence.
- **The claims are checkable.**
  - Every number links to an evidence entry with its raw file, and `npm test` recomputes them.
  - The author reports the failures their own fuzzer found (F1 to F4, since fixed) and one documented limit.
  - The README states plainly what it does not guarantee.
- **Where rules were measured, some changed behaviour.** These results cover the preset's rules only, on small tasks, with 30 to 40 runs per arm.
  - `verify-changes` took Sonnet's test runs after a fix from 0 of 30 to 29 of 30 (R3).
  - Sonnet's `carry-through` raised complete backlog runs from 9 of 40 to 32 of 40 (R10).
  - Haiku's `carry-through` showed nothing (R11).
  - Some rules did nothing and still cost tokens. Sonnet's fix cost $0.0240 without rules and $0.0505 with `verify-changes` alone (R6).

**Conditions and risks:**
- **You need a real reason to deliver different rules per model.** If you only have team-wide rules, keep them in `CLAUDE.md`. The README's own "when not to use" section says the same for single-model setups.
- **Out of the box, many of your sessions get nothing.**
  - A watched Opus or Fable session receives no preset rules. Their preset rules are for unattended runs and subagents only.
  - Sonnet and Haiku sessions get most rules only with a scope (`NOONSIGHT_SCOPE`). `verify-changes` arrives once a tracked code file is edited.
  - You would need to set `session.unattended_when_env` for your orchestrators, decide on scopes, and probably write your own rules. Plan for that work.
- **Delivery is not obedience.** A delivered rule is context. Anything that must never be broken needs a hook or a permission rule. A rule of your own has no measured effect until you measure it, and `noonsight report` can show you which rules never fire.
- **It is tied to Claude Code internals.**
  - It was verified on Claude Code 2.1.328, with rule-effect runs on 2.1.329. It relies on hook behaviour and an undocumented variable, `CLAUDE_CODE_SESSION_ATTENDED`. Your team's Claude Code versions may differ.
  - Pin or check the version, and rerun `noonsight check` and `npm run test:live` after upgrades.
- **Known gaps:**
  - A conversation compacted with no response since and then resumed can run on the default model, which noonsight cannot tell, so it may get the wrong rules.
  - Plugin and `--agents` subagent definitions are not read, so their model is mispredicted and the post-start check reports a mismatch.
  - Agent-team teammates get nothing, and edits made through the shell don't count as triggers.
  - Not measured: `/resume` inside a session, forks, plan mode, agent teams, routing, the classifier, project configurations, and subagents that edit files.
- **Routing and the classifier are off by default, so leave them off.**
  - In auto mode, routing changes a subagent call and costs the other calls in that response their review.
  - The classifier sends the first 4,000 characters of a task to a model through your own Claude Code login.
- **Project rules need trust.** Each person must run `noonsight trust` once per repository before a committed `.noonsight/noonsight.json` does anything.
- **It is early and small.**
  - Version 0.1 is not on npm. You install it from a clone with `npm link`.
  - It was renamed from sextant, and it has one visible author.
  - It reads local state under `~/.local/state/noonsight` and writes your Claude Code settings. That is a hook that runs on every session and every subagent. Review the code before putting it on every machine.
- **The headline benchmark is self-referential.**
  - It uses a local stand-in for the API, so no request reaches a model.
  - Its reference is noonsight's own resolver, so a wrong resolution would not show up, only a wrong delivery.
  - It also used only the preset's rules.
  - Treat the 99.9% as strong evidence the plumbing works, not evidence that your rules will help.
- **Suggested pilot:** a few people for two weeks, with a handful of your own rules for two or three models. Check `noonsight report` for rules that never fire, and measure on your own tasks whether any rule changes behaviour enough to justify its cost.

**What it guarantees:** noonsight guarantees that each Claude Code session and subagent is given the rules written for the model it runs on, and gets them again when that model changes. This rests on Claude Code's own hooks, checked by a fuzzer against a stand-in API on Claude Code 2.1.328: 99.9% of requests with rules due held them (3,219 of 3,221), and 1 of 300 sessions broke the invariant. That is delivery only, not that the model follows the rules.
