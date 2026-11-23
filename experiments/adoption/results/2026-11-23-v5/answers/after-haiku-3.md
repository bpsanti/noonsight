**Verdict: adopt with conditions.** Run a pilot on a few machines first. Don't roll it out team-wide until the conditions below hold.

**Reasons**

- **It matches your setup.** Its core feature is delivering per-model rules to each session and to each subagent, and it re-delivers them when the model changes via `/model`, `/compact`, `/clear`, resumes, and forks. Your mix of Opus, Sonnet, Haiku, and Fable sessions, with many subagents, is the case it targets. Native alternatives covered much less in the author's comparison: a user `CLAUDE.md` reached 32.2% (39 of 121) of subagent requests, and a skill per model reached 0%. The author reports noonsight at 100% (D5, D9) on the same sequences.
- **The latest evidence is strong, though it comes from the author.** On Claude Code 2.1.330 (D18 to D22), 300 sessions had 0 invariant failures, with 100% of 3,090 due requests and 100% of 763 subagent requests holding their rules. The earlier 2.1.328 run had 1 failing session of 300 (D1). The fuzzer's failures F1 to F9 are listed as fixed.
- **It is low-risk to run.** Hooks never block anything. They make no network calls except an optional classifier, which is off by default and sends the first 4,000 characters of a task to a small model through your own login. Routing is off by default. The README reports 50 to 90 ms of hook CPU time per run. It has no runtime dependencies.
- **It is auditable.** `noonsight report` shows which rules were delivered to which model, scope, and place. `noonsight resolve` prints the exact text a model would receive.

**Conditions and risks**

- **Pin the Claude Code version.** Every measurement is tied to a specific version (2.1.328 and 2.1.330). The docs say Claude Code changes how hooks behave, and the README says to recheck facts on each version change. Hold upgrades until noonsight has been measured on the new one.
- **Get the install right.** Version 0.1 is not on npm. Install from a clone with `npm install && npm run build && npm link`. `noonsight install` writes hooks into every Claude Code login on the account. Do this deliberately on each machine. `--managed` writes to a system directory, so treat it as a separate decision.
- **Expect little from the preset on Opus and Fable interactive sessions.** Opus 5.5's and Fable 5.2's attended rules ship off. An interactive session on either gets nothing from the preset until someone runs `enable`. Sonnet and Haiku interactive sessions only get their scoped rules when `NOONSIGHT_SCOPE` is set. Write your own rules for the cases that matter to you.
- **Set the unattended variable for orchestrated sessions.** Interactive sessions count as attended unless `session.unattended_when_env` names a variable your CI or orchestrator sets. Without it, sessions nobody watches get the attended rules.
- **Know the subagent gaps.** Workflow agents get nothing. Foreground calls of one type that need different rules give their subagents nothing until that subagent's first Edit, Write, or agent call. Plugin subagents an organization syncs stay on their parent's model.
- **`/fork` is unavailable under `noonsight run`** when the session has rules, because Claude Code refuses to fork a session with its own system prompt.
- **Review committed repository rules.** A repository's `.noonsight/noonsight.json` changes nothing until each person runs `noonsight trust`. Once trusted, its rule files are delivered to the model, so review them like code.
- **Expect no measured effect from your own rules.** The rule-effect experiments use small tasks with 30 to 40 runs per arm, and they cover only the preset's rules. Measure your own rules on your own tasks before relying on them, using `report` and small A/B runs.
- **Delivery is not obedience.** A delivered rule is context, and the model may ignore it.

Before adopting, run these on one machine with a pinned Claude Code version: `noonsight check`, `noonsight install`, one scoped session and one subagent session, then `noonsight report`. Compare outcomes on a few representative tasks against sessions without it.

**What it guarantees:** On its own benchmark, sessions under noonsight received the rules their model, scope, place, and trigger called for on 100% of the requests that had rules due, in the latest run on Claude Code 2.1.330. This rests on a local stub API that never reached a model, a fuzzer, and committed results that the author's test suite recomputes. It does not guarantee that a model follows the rules, or that a rule improves anything.

**Limits of this review:** I read the README, the evidence and verification docs, and the file listing. I did not run `npm test`, so I have not recomputed the evidence numbers. I also did not open the raw result files under `experiments/`. The figures above are as the docs state them.
