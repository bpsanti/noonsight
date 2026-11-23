**Verdict: adopt with conditions.** Pilot it on one or two machines first, and widen only after the checks below pass.

**Reasons**

- It fills a gap that `CLAUDE.md` leaves open for your setup. In the 2.1.330 benchmark, native mechanisms covered 46.9% of subagent requests with their rules (`CLAUDE.md` and `.claude/rules`), and 0% for skills. noonsight covered 763 of 763 subagent requests. Since your team runs many subagents across several models, this is the main reason to adopt.
- The delivery claim is specific and has a traceable source. Across 299 sessions and 3,090 requests, none broke the invariant (every request got its model's rules). The claim is backed by the benchmark logs in `experiments/delivery/results/claude-code-2.1.330/`, with the numbers linked to `docs/evidence.md`.
- The effects on model behavior are narrow and mixed:
  - `verify-changes` on Sonnet 5.5 and Haiku 5.5 got the tests run after a one-file fix in 29/30 and 27/30 runs, against 0/30 without it. It roughly doubled that task's cost ($0.024 to $0.0505).
  - `carry-through` raised Sonnet 5.5's full completions on a long triage task from 9/40 to 32/40. On Haiku 5.5 the same rule showed no measurable effect (2/40 vs 6/40, p = 0.26).
  - `low-context-report` on Fable 5.2 shortened sentences. That is a style effect, not a measured quality gain.
  - No measured effect for any Opus 5.5 rule, and most of its rules ship off.
- Triage on Sonnet 5.5 cost about $0.29 per run, close to the projection. The rule-effect experiment spent $24.61 in total, so the cost is known and modest.

**Conditions and risks**

- **Pilot before rollout.** Run `noonsight install`, `noonsight models`, and a few sessions with `noonsight report`. Confirm the rules your team needs are delivered on your actual Claude Code version. The guarantee is measured on 2.1.330 only, and hook behavior changes between Claude Code versions.
- **Check each model's attended behavior.** Opus 5.5 and Fable 5.2 get nothing in attended sessions by default. Decide which rules to `enable`, or accept that those sessions get none.
- **Set `session.unattended_when_env`** to your CI or orchestrator variable. Otherwise, interactive sessions nobody is watching count as attended.
- **Know the stated gaps.** Agent teams, routing, and the classifier were not measured. Workflow agents get no rules. Foreground subagents of one type that need different rules get none until their first edit or agent call. Plugin-synced subagents stay on their parent's model. `/fork` is unavailable in `noonsight run` sessions that have rules.
- **Install footprint.** `noonsight install` adds hooks to every Claude Code login on the machine, not just the one you test. Plan for that when you roll it out, and know that `noonsight uninstall` reverses it.
- **Supply chain.** The package is not on npm; the name holds an empty placeholder. Installing means cloning the repo and running `npm link`. Pin the commit and review what the hooks run before installing on shared machines.
- **Repository rules need trust per person.** A repo's `.noonsight/noonsight.json` does nothing for a developer until they run `noonsight trust` in that repo.
- **Evidence limits.** The author ran the benchmark, and the model API is a local stub, so the delivery results show what was sent, not what models did with it. Rule-effect samples are 30–40 runs per arm on small tasks. Treat the results as directional. Some claims ("0 of 299") depend on the project's own test corpus; I did not independently rerun the tests.
- **Delivery is not obedience.** Delivered rules are context. Whether a model follows them is a separate question.

**What it guarantees:** Within the measured sessions on Claude Code 2.1.330, each request carried its model's rules and no other model's rules were left active (0 of 299 sessions broke this, 3,090 of 3,090 requests held their rules). This rests on the project's hooks reading the model from Claude Code's hook events and on a benchmark that drives real Claude Code sessions against a stub API, so it does not extend to other Claude Code versions, to agent teams, or to whether models follow the rules.

I read the README, the delivery and rule-effect results, and the install docs. I did not install the tool or run its test suite.
