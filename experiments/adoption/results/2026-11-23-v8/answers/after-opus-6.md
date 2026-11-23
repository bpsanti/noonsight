**Verdict: adopt with conditions.**

**Reasons**

1. **Your setup is the case it was built for.** You use four models and many subagents. A shared `CLAUDE.md` cannot target one model. In the tool's own benchmark on Claude Code 2.1.330, every model's rules in one `CLAUDE.md` reached only 46.9% of subagent requests (60 of 128). It never reaches the built-in Explore and Plan subagents, and Anthropic's docs confirm that. It also gave every model the other models' rules: 619 requests held another model's rule with nothing telling the model to ignore it. noonsight's numbers for the same measures were 100% (763 of 763) of subagent requests and 0 such requests (`docs/evidence.md`, D20, D28 and D32). The README says to skip the tool if every session runs one model, which isn't your situation.
2. **The delivery evidence is unusually solid and easy to check.** Every number points to a committed raw file, and `npm test` recomputes each one. The benchmark drives real interactive Claude Code sessions against a local stand-in for the API, through `/model`, `/compact`, `/clear`, resumes, forks, plan mode and subagents. Its fuzzer found nine of the tool's own bugs (F1 to F9), and their reproductions now sit in a regression corpus. A self-check plants known bugs to confirm the fuzzer catches them. Superseded results are kept and labelled, not hidden.
3. **Its own results show little or no effect on outcomes.** In the paid pilot on public tasks, the share of runs that passed was the same with no rules, with noonsight and with a `CLAUDE.md`: 133, 132 and 133 of 144 (B1, Claude Code 2.1.326). Only three preset rules showed a measured effect, and only on small tasks. For example, `verify-changes` made Sonnet and Haiku run the tests after a one-file fix in 29 and 27 of 30 runs, against 0 of 30 without it. No Opus 5.5 rule has a measured effect. So the value lies in reliably delivering rules you have reason to want, not in the preset making models better.
4. **Out of the box it does nothing for attended Opus and Fable sessions.** Their preset rules for watched sessions all ship turned off. Sonnet and Haiku get most of their rules only when a session has a scope set (`NOONSIGHT_SCOPE`); with no scope, an attended session gets only `verify-changes`, after its first edit of a tracked code file. Without setup work, most of what your team does day to day gets little or nothing from it.
5. **It is low risk to run.** It works through Claude Code's own hooks. The hooks never block anything and never use the network, except an optional classifier that is off by default. It has no runtime dependencies, and `uninstall` and `NOONSIGHT_DISABLE=1` turn it off. Each hook run costs about 80–150 ms of processor time, measured on a heavily loaded laptop.

**Conditions and risks**

- **Pin and re-check Claude Code versions.** The guarantee was measured on Claude Code 2.1.330 only. The tool depends on hook behaviour that changes between versions, and on an environment variable Claude Code does not document (`CLAUDE_CODE_SESSION_ATTENDED`). If that variable is dropped, every session is treated as attended, so rules meant for headless runs and other unwatched sessions stop arriving. CI pins an even older version (2.1.325) for its live checks. Before each Claude Code upgrade, run the corpus, or at least run `noonsight report` and check it. Otherwise assume the guarantee may no longer hold.
- **Write and own your rules.** The preset is a thin starting set. Decide what should differ by model, turn rules on with `enable`, set scopes, and keep rules every model should get in `CLAUDE.md`. Test any rule you write yourself, because it has no measured effect until you measure it.
- **Tell it which sessions nobody watches.** Set `session.unattended_when_env` to your CI or orchestrator variable. Otherwise interactive sessions nobody watches get the attended rules, or none.
- **Watch the cost.** `verify-changes` ships on for Sonnet and Haiku and roughly doubles the cost of a small fix ($0.024 to $0.0505 on Sonnet).
- **Gaps that could bite you:**
  - Workflow agents get nothing.
  - Agent teams, routing and the classifier were never measured.
  - Subagents from org-synced plugins are assumed to run on their parent's model.
  - `opusplan` can't be told apart.
  - A resume after a compaction with no response since can get the wrong model's rules.
  - `/fork` is refused in sessions started through `noonsight run`.
- **Maturity.** It is version 0.1 and not on npm, so you install it from a git clone. It comes from a single repository and was renamed recently. It changes the hooks of every Claude Code login on the machine. Review the code and pin a commit before you roll it out.

**What it guarantees:** On Claude Code 2.1.330, each request, subagents included, carries the rules due to the model it actually runs on and no unretired rules of another model, but not that the model follows them. That rests on one benchmark run: 299 sessions, 0 failures, 3,090 of 3,090 requests covered, all judged by noonsight's own resolver, which means a wrong decision about which rules apply would not show up as a failure.
