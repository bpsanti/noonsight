**Verdict: adopt with conditions.** Treat it as a pilot, not a standard rollout.

**Reasons**
- **It delivers the right rules reliably.** This is the strongest evidence in the repo. In the delivery fuzz on Claude Code 2.1.328, 300 sessions gave 99.5% coverage (3,199 of 3,216 requests), and 100% for subagents on the first 60 sequences. The native options did worse on the same sequences: `CLAUDE.md` reached 87.4% (32% for subagents), `.claude/rules` 70.9% and skills 0%. A `CLAUDE.md` doesn't reach the Explore and Plan subagents at all. That matters for your many subagent sessions.
- **It sends each model only its own rules.** Under `CLAUDE.md`, only 18–29% of the rule text a model received was written for it. Under noonsight it was 100%. After a `/model` switch, or when Claude Code swaps models mid-session, it adds a note that the earlier model's rules no longer apply. Mixed-model rule files can't do that. In the paid benchmark, Claude Code switched models by itself in 20 of 21 runs on one task, and only noonsight flagged it.
- **It is cheap and low-risk to run.**
  - Hooks take about 70–120 ms of CPU.
  - It adds about 1,150 characters per request.
  - It makes no network calls, and the classifier is off by default.
  - It never denies a tool call.
  - It has no runtime dependencies.
  - `NOONSIGHT_DISABLE=1` turns it off.
  - The install can be undone.
- **Some rules measurably change behaviour.**
  - Sonnet's `verify-changes` made it run tests after a one-file fix in 29–30 of 30 runs, against 0 of 30 without it. Haiku did so in 27 of 30.
  - Sonnet's `carry-through` raised full completion of a 13-ticket backlog from 9 of 40 to 32 of 40.
  - Fable's report rule gave shorter sentences on all three tasks tested (p<0.05 after correction).
  - The authors report null results honestly, for example Haiku's `carry-through` ("not shown") and the long tasks where nothing stopped early.
- **The evidence is unusually rigorous.** Comparisons are pre-registered, the cost caps are stated, and the fuzzer found four real defects (F1–F4) in noonsight itself. It also has a self-check that plants bugs to confirm the fuzzer catches them.

**Conditions and risks**
- **It is not published.** The README says "early development. Nothing is published yet." You would install from a clone with `npm link`, with no release or support story. Pin a commit and have one owner for upgrades.
- **It depends on Claude Code internals.** It relies on hook behaviour that is checked only on specific versions (2.1.325–2.1.328). The delivery run used 2.1.328 even though 2.1.329 was already out. Some behaviour is undocumented, such as which model a resumed session runs on. Run `npm run delivery -- all` and the live tests on every Claude Code upgrade, and consider pinning the version.
- **Known failure modes remain.**
  - Three of 300 fuzz sessions still broke the invariant: one is a documented limit, and F3 and F4 were found but not fixed in that run.
  - F4 sends the wrong model's rules for the rest of a session after a Sonnet→Haiku `/model` switch followed by a resume. Check whether the changelog says these are now fixed.
  - Concurrent agent calls of one type that would get different rules leave those subagents with no rules.
  - Subagent model prediction can fail. In that case the subagent gets no rules and the person gets a warning.
- **The wins are narrow, and quality gains are unproven.**
  - The measured behavioural effects are mostly on Sonnet and Haiku, on small JavaScript fixtures at one effort level.
  - On the 588-run SWE-bench and Terminal-Bench pilot, resolve rates were the same with and without rules. Fable and Opus were already at the ceiling.
  - Opus's rule is unmeasured, and Fable's `finish-work` rule is already covered by Claude Code's own system prompt.
  - Expect the main value to be consistent delivery, not better answers.
- **Rules cost money.** Per run, noonsight cost 7% more than no rules in the benchmark. Sonnet's verify rules added about 46% on a small task, mostly from the extra test run. Check that this tradeoff suits you.
- **Scopes matter.** A session with no scope gets only the rules marked for every scope, and with the preset that is none. Rules mostly arrive via `NOONSIGHT_SCOPE`, matchers or triggers. Decide how your team sets scopes.
- **Don't turn on everything.** Leave routing and the classifier off at first. The classifier sends the first 4,000 characters of a task to a model, and it agreed with hand labels on 43–44 of 45 tasks. Project-committed configs need `noonsight trust` per person. Keep that a deliberate step.
- **Pilot plan.** Run it for 2–4 weeks on a few people, using `noonsight report` to check rules arrive. Check whether your Fable sessions use the preset's off-by-default rules, and whether `CLAUDE.md` already covers what you need.

**What it guarantees**
It guarantees nothing absolute. What it offers is that each Claude Code session and subagent receives the rules declared for the model it actually runs on, measured at 99.5% of requests in a fuzz of 300 simulated sessions against a local API stand-in. That rests on official Claude Code hooks and noonsight's own resolver, checked on specific Claude Code versions. It does not guarantee that the model follows the rules or does better work.
