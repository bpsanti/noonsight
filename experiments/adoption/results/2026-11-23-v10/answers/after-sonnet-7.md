**Verdict: adopt with conditions.**

I read the README, `docs/evidence.md` and `docs/hooks.md`, plus `package.json`. I did not run the tool or its tests. Everything below comes from the project's own documentation and the results it commits.

**Reasons**

- **It fits your setup.** You run several models, and many of your sessions start subagents. The tool gives each session and each subagent the rules written for the model it actually runs on. It does this through Claude Code's own hooks, and it re-delivers when the model changes or the conversation is compacted, cleared, resumed or forked.
- **The delivery numbers are strong and specific.** In 299 interactive sessions against a stub API, it delivered 3,090 of 3,090 due requests, including 763 of 763 subagent requests (D19, D20). The alternatives, measured on the first 60 sequences, did worse on subagents:
  - A `CLAUDE.md` reached 46.9% of subagent requests. It reached every main-conversation request, but never the built-in Explore and Plan subagents.
  - `.claude/rules` reached the same 46.9% of subagent requests.
  - Skills reached 0%.
- **It sends less irrelevant text.** A `CLAUDE.md` or `.claude/rules` file puts other models' rules into every request. Under noonsight, 78.6% of the rule text in a request is for that request's model, against 32.6% and 27.9% for those two. It adds 1,343 characters per request, against 4,472 and 3,889.
- **The hooks are low-risk.** They always exit 0 and never block a call. They read only local files, and the optional classifier is the only network use. There are no runtime dependencies. A bad configuration is refused whole, with a warning. The tool is MIT licensed, and `noonsight uninstall` or `NOONSIGHT_DISABLE=1` turns it off.
- **The evidence is checkable.** `npm test` recomputes every README number from raw result files. The author lists nine failures the benchmark found and fixed (F1 to F9).
- **Some rules measurably change behavior.** On small tasks, `verify-changes` took Sonnet 5.5 from 0 of 30 runs that ran tests after the last edit to 29 of 30 (R3, R14). `carry-through` took Sonnet 5.5 from 9 of 40 to 32 of 40 on a 13-ticket backlog (R10).

**Conditions and risks**

- **Out of the box, the preset does nothing for Opus and Fable in attended sessions.**
  - Their attended rules ship off, and only unattended and subagent rules ship on.
  - Sonnet and Haiku scoped rules need `NOONSIGHT_SCOPE`.
  - You must decide which rules you want. Most of the value is in rules your team writes, and the tool does not write them for you.
- **Set `session.unattended_when_env` yourself.** Interactive sessions nobody watches count as attended unless you do.
- **Delivery is not obedience.** A delivered rule is context, as `CLAUDE.md` is. The only evidence that a rule changes behavior is the author's small-task experiments, and each result holds only for its rule, model and task.
  - Opus 5.5 has no measured rule effect at all.
  - No quality gain was shown. The public-task pilot saw no difference in pass rates: 133 of 144 with no rules, 132 of 144 under noonsight, and 133 of 144 with a `CLAUDE.md` (B1). That pilot delivered rules to the main conversation only.
  - Several rules raise cost, for example Sonnet `verify-changes` rose from $0.0240 to $0.0505 per run on the fix task.
  - Measure your own rules before keeping them.
- **Known delivery gaps, which matter because you use subagents heavily:**
  - A workflow's agents get nothing.
  - Foreground calls of one type that need different rules give their subagents nothing until the subagent's first Edit, Write or agent call.
  - Subagents from a plugin noonsight does not read, such as an organization-synced one, are predicted on their parent's model.
  - Agent-team teammates in split panes were not checked.
  - Agent teams, routing and the classifier are not measured.
- **It depends on undocumented Claude Code behavior.** Several mechanisms it relies on are undocumented. The results ran on Claude Code 2.1.325 to 2.1.330, so each holds only for the version it ran on. Pin and re-test on every Claude Code upgrade, and run `noonsight report` regularly.
- **The project is young.** It is at version 0.1.0 and has a single author, and it was renamed from "sextant". The evidence rests on a local stub API. No model answered, so the benchmark measures what each request contained, not how the model behaved.
- **The benchmark is the author's own.** It is committed and reproducible, but nobody independent has reproduced it. Run `npm run delivery` or a small pilot on your own machines before rolling it out.
- **It has some practical constraints:**
  - `noonsight run` sessions cannot use `/fork`.
  - macOS command-line parsing has stated limits.
  - Providers other than the Anthropic API (Bedrock, Vertex, Foundry) need pinned model variables.
  - Project-level rules need `noonsight trust` per clone.
- **Skip it if the rules don't differ by model.** The README says a `CLAUDE.md` is simpler when every session runs one model with fixed rules, unless Explore or Plan subagents need the rules.

**What it guarantees**

It guarantees delivery, not obedience. Through Claude Code's hooks, the rules declared for a model are put into the requests of each session and subagent that runs on it, and again after a model change, compaction, clear, resume or fork, within the limits listed above. This rests on a 299-session benchmark on Claude Code 2.1.330 where 0 sessions broke the invariant, and where every request was read against a stub API and no model answered.
