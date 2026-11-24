Verdict: **Adopt with conditions.**

I read the README, `docs/evidence.md`, `docs/hooks.md` and `docs/usage.md`. I did not run the tool or the test suite, so everything below comes from the project's own documentation and recorded results.

**Reasons**
- **It fits your setup.** You mix Opus, Sonnet, Haiku and Fable, and many of your sessions start subagents. Delivering rules by model, including to subagents, is what noonsight is built for. A single `CLAUDE.md` gives every model the other models' rules, and it never reaches the built-in Explore and Plan subagents (S4).
- **Delivery is measured against the native options.** In the current run (2026-11-23, Claude Code 2.1.330), 0 of 299 sessions broke the invariant (D18). 3,090 of 3,090 requests with rules due held them (D19), and 763 of 763 subagent requests did (D20). On the first 60 sequences, a user `CLAUDE.md` managed 88.2% overall and 46.9% for subagents. `.claude/rules` managed 76.3% and 46.9%. Skills managed 0% (D25–D29).
- **It adds less text.** noonsight adds about 1,343 characters per request, against 4,472 for a `CLAUDE.md` and 3,889 for `.claude/rules` (D31). Requests with another model's rules and no retiring note numbered 0, against 619 and 622 (D32).
- **It is low-risk to try.** The hooks never block anything. It has no runtime dependencies, uses the network only for the optional classifier (off by default), and logs every decision. It can be turned off per session with `NOONSIGHT_DISABLE=1`, or removed with `noonsight uninstall`. The README discloses its own limits and nine failures found and fixed (F1 to F9).
- **The rule effects are real but narrow.** On Sonnet 5.5, `verify-changes` raised "ran the tests after the last edit" from 0 of 30 to 29 of 30 on a precise fix. `carry-through` raised full backlog completion from 9 of 40 to 32 of 40. On Haiku 5.5, `verify-changes` raised test runs from 0 of 30 to 27 of 30. On Fable 5.2, `low-context-report` shortened report sentences.

**Conditions and risks**
- **Delivery is not obedience.** A delivered rule is only context. Anything that must never be broken needs a hook or a permission rule.
- **No quality gain is shown.** Every run passed its hidden check with or without rules (R8, 600 of 600). The pilot on public tasks showed no measurable difference: 133, 132 and 133 of 144 for no rules, noonsight and `CLAUDE.md` (B1). The gain is behavioural, such as running tests, not better correctness.
- **Rules add cost.** On Sonnet, mean cost per run rose from $0.0240 to $0.0505 with `verify-changes`. On Haiku, `verify-changes` roughly doubled the cost, though from a tiny base. Decide whether that is worth it.
- **Opus and Fable get little out of the box.** Their attended-session rules ship off. You would need to write your own rules or turn them on with `enable`. No Opus rule has a measured effect. The Fable rule's effect was on report style only, and its tests were run on a Fable-specific rule set. The Sonnet and Haiku rules mostly need a scope or a code edit to fire.
- **Unattended sessions need setup.** Set `session.unattended_when_env` for any interactive sessions that nobody is watching.
- **Known delivery gaps.** Workflow agents get nothing. Foreground subagent calls of one type that need different rules get nothing until their first edit, write or agent call. Plugin subagents that noonsight cannot read are assumed to run on their parent's model. A compacted session resumed with no model named runs on Claude Code's default model, and noonsight cannot tell which that is. `/fork` is unavailable in sessions started with `noonsight run` that carry rules. Agent teams, routing and the classifier are not measured.
- **It depends on Claude Code internals.** Results are tied to specific versions (2.1.326 to 2.1.330) and hook behaviour changes between releases. Pin or test your Claude Code version, and re-run `noonsight check` and `noonsight report` after upgrades.
- **Immaturity.** The version is 0.1.0, it was renamed from "sextant", and it comes from a single author. The evidence is well documented, but the tests are the author's own and the tool has no production track record. Pilot it first.
- **Installation scope.** It writes hooks to every Claude Code login of an account. It cannot work where managed settings forbid user hooks.
- **Project rules need trust.** Each person must run `noonsight trust` in a repository before its committed rules apply.

**Suggested rollout:** Pilot on a few Sonnet and Haiku users for a couple of weeks. Check `noonsight report` for rules that are on but never delivered. Drop rules that change nothing you can see, and write your own Opus and Fable rules. If you only ever run one model with fixed rules and no Explore or Plan subagents, skip it and use `CLAUDE.md`.

**What it guarantees**
Through Claude Code's hooks, noonsight puts the rules declared for a model into the requests of each session and subagent running on that model, and again when the model changes or the conversation is compacted, cleared, resumed or forked. That guarantee rests on a benchmark of 300 real interactive Claude Code sessions run against a local stand-in for the API (so no model answered), on Claude Code 2.1.330, with the documented gaps excluded. It does not guarantee that the model follows the rules.
