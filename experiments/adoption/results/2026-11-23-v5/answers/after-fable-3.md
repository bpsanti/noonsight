**Verdict: adopt with conditions.** Run it as a time-boxed pilot with a few people, not a team-wide rollout. I read the README, the hook contract, the evidence map and the experiment write-ups; I did not run the tests or the tool, and I did not audit the source.

**Reasons**

- **It fits your setup.** It gives each session and subagent the rules for the model it actually runs on, and re-delivers after `/model`, `/compact`, `/clear`, resumes and forks. Its own README says a `CLAUDE.md` is simpler if every session runs one model.
- **The subagent gap it closes is real.** In its benchmark a user `CLAUDE.md` reached 100% (526 of 526) of main-conversation requests but only 32.2% (39 of 121) of subagent requests, because it never reaches the built-in Explore and Plan subagents. noonsight reached 100% of subagent requests in the same sequences.
- **Delivery is well evidenced, but narrowly.** The latest run had 0 of 300 random sessions breaking the invariant, on Claude Code 2.1.330. Those sessions ran against a local stand-in for the API, and the reference is the tool's own resolver, so a wrong resolution would not show.
- **Better outcomes are not shown.** In its paid benchmark, tasks resolved in 133, 132 and 133 of 144 runs without rules, with noonsight and with a `CLAUDE.md`. noonsight cost about 7% more per run than no rules. The measured effects are behavioural and on small tasks: Sonnet ran tests after a fix in 30 of 30 runs against 0 of 30.
- **The default preset does little for half your models.** Attended Opus and Fable sessions receive nothing until you enable a rule. Attended Sonnet and Haiku sessions receive only `verify-changes`, after their first edit to a tracked code file.
- **It is very young.** It is version 0.0.1, not on npm (install from a clone), and its docs describe nine delivery failures found and fixed between 19 and 23 November.
- **Trying it is low-risk.** The hooks never block a call, always exit 0, use no network (the optional classifier excepted), have no runtime dependencies, and `noonsight uninstall` removes them.

**Conditions and risks**

- **Have rules that differ by model.** If you don't have per-model rules of your own to write, put shared rules in `CLAUDE.md` and skip this.
- **Pin Claude Code during the pilot.** The tool relies on undocumented behaviour (an undocumented environment variable, transcript and fork-job file formats, `ps` parsing on macOS). Its CI pins 2.1.325 while the newest facts were checked on 2.1.330.
- **Audit delivery yourselves.** A broken delivery means missing or wrong-model rules, not a crash, so review `noonsight report` weekly and after every Claude Code upgrade.
- **Check your subagent patterns against the known gaps:**
  - Workflow agents get nothing.
  - Parallel foreground subagents of one type that need different rules get nothing until their first Edit, Write or agent call.
  - Organisation-synced plugin subagents are predicted on the parent's model.
  - Agent teams in split panes are unchecked.
- **Leave routing and the classifier off.** Neither is measured, and routing in auto mode causes the other agent calls in the same response to be refused and retried.
- **Mind model identification.** On Bedrock, Vertex or Foundry, aliases need the pinning variables. `default` and `opusplan` sessions get a warning instead of rules.
- **Plan for per-person setup.** Each person installs it and runs `noonsight trust` per repository. It also writes a local decision log with session ids and edited file paths.
- **Accept the maintenance risk.** It appears to be a single-author project, so a Claude Code change may break it before a fix lands.

**What it guarantees**

It guarantees delivery only — that each request carries the rules you declared for the model it runs on and no other model's rules left unretired — not that the model follows them, and that rests on stubbed-API benchmarks on one Claude Code version at a time (2.1.328 and 2.1.330).
