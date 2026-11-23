**Verdict:** Adopt with conditions. Run it as a time-boxed pilot first, not a team-wide rollout. I read the README, `docs/evidence.md`, `docs/hooks.md`, the delivery experiment's limits and `package.json`. I did not run the tests or install it.

**Reasons:**
- **It fits how you work.** It delivers rules per model, to sessions and to the subagents they start, through Claude Code's own hooks (`docs/hooks.md`). Your mix of Opus, Sonnet, Haiku and Fable with many subagents is the case it targets. A user `CLAUDE.md` reached only 32.2% of subagent requests in its benchmark (D10), and it never reaches the built-in Explore and Plan subagents.
- **The safety design is sound.**
  - The hooks never block a call and never use the network.
  - They exit 0, have a 10-second timeout, and a median CPU time of 50–90 ms per hook run (D15).
  - A bad configuration is refused whole with a warning.
  - `NOONSIGHT_DISABLE=1` and `noonsight uninstall` turn it off.
  - Every decision is logged and readable with `noonsight report`.
- **The delivery evidence is unusually good.** In the latest run (D18–D22), 0 of 300 random sessions broke the invariant, and 3,090 of 3,090 requests held their rules. That run covered `/model`, `/compact`, `/clear`, resumes, forks and subagents. Nine failures the fuzzer found are documented, fixed, and kept as regression reproductions. Every number in the README is tied to a raw result file and recomputed by `npm test`.
- **The README states its limits plainly.** It says delivery is not obedience, and that its effect results are small samples (30–40 runs per arm) on small tasks.
- **The preset gives you nothing for Opus and Fable in attended sessions.** All of Opus 5.5's and Fable 5.2's attended rules ship off, so those sessions receive nothing until you `enable` a rule or write your own.
- **The measured effect is narrow.** The main result is `verify-changes` on Sonnet and Haiku: the tests were run in 29 of 30 and 27 of 30 runs, against 0 of 30 without it. It also roughly doubled the cost of Sonnet's fix, $0.0505 against $0.0240 (R6). `sonnet-5-5/carry-through` helped on one backlog task (32 of 40 against 9 of 40), and Haiku's showed nothing (R10, R11).
- **It is early-stage software.**
  - `package.json` says version 0.0.1 and `private: true`, and the README says 0.1 is not on npm yet.
  - You install from a clone.
  - It has one visible author, `bpsanti`.

**Conditions and risks:**
- **Pin Claude Code.** Each result is measured on one version (2.1.328 or 2.1.330). `docs/verification/claude-code.md` lists the behaviors it relies on, and several are undocumented, such as fork detection, `CLAUDE_CODE_SESSION_ATTENDED`, and subagent metadata files. Pin the version your team runs, check it against that list, and re-run `npm run test:live` after each Claude Code upgrade. If a Claude Code change breaks one of these assumptions, the failure can be silent, because the hooks never block anything.
- **Decide first which rules you want.** The preset is a starting point, not a payoff. You need rules that matter for your work, and every custom rule has no measured effect until you measure it. Without any, the main gain is `verify-changes` on Sonnet and Haiku, and it costs money.
- **Set the unattended signal.** Set `session.unattended_when_env` for interactive sessions nobody watches. Headless `claude -p` runs count as unattended by default. Give Sonnet and Haiku sessions a scope (`NOONSIGHT_SCOPE`), or their scoped rules never arrive.
- **Pilot first.** Use a few people for a few weeks, with `noonsight report` and your own before/after measure. Drop any rule that changes nothing you can see.
- **Known gaps:**
  - A workflow's agents get nothing.
  - Subagents from plugins noonsight doesn't read are predicted on the parent's model.
  - Several foreground calls of one type that need different rules give their subagents nothing until the subagent's first Edit, Write or agent call.
  - A conversation compacted with no response since and resumed with nothing that names a model runs on Claude Code's default model, which noonsight can't tell.
  - Agent teams in split panes, routing and the classifier were not measured.
- **Keep routing and the classifier off.** Both are unmeasured. The classifier sends the first 4,000 characters of a task to a model, and routing in auto mode can make Claude Code refuse the other calls in the same response.
- **Review it before installing.** It writes into every Claude Code login's settings and runs on every session, so read the source first. Run it from a clone, not from the unpublished npm name, which is an empty placeholder.
- **Skip it if the problem is small.** If most of your sessions use one model with fixed rules, the README itself says a `CLAUDE.md` is simpler.

**What it guarantees:** It guarantees that each session and subagent receives the rules written for the model it runs on, and not other models' rules unretired, at the 100% level in its latest fuzzed run (0 of 300 sessions broke it), and that rests on a fuzzer driving real Claude Code sessions against a local stand-in for the API on Claude Code 2.1.330, so it says nothing about whether a model follows the rules or about Claude Code versions it wasn't re-checked on.
