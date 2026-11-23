**Verdict: adopt with conditions.** Pilot it on a few machines first, pin the Claude Code version, and read the code before installing.

**Reasons**

- **Your mix of subagents is where native options fall short.** On the same 60 sequences, a user `CLAUDE.md` reached 32.2% of subagent requests (39 of 121), and `.claude/rules` reached the same share. noonsight reached 100% (README; `docs/evidence.md` D9). Since many of your sessions start subagents, this is the strongest case for it.
- **Per-model rules without rewriting them.** A model gets only the rules written for it, and it gets them again after `/model`, `/compact`, `/clear` and resumes. With a `CLAUDE.md`, each model also receives the other models' rules. Under noonsight, 79.0% of the rule text a request received was written for that request's model, against 31.5% with `CLAUDE.md` and 27.0% with `.claude/rules` (D12).
- **The best-measured rule is one your Sonnet and Haiku sessions need.** `verify-changes` made Sonnet run the tests after its last edit in 29 of 30 fix runs, against 0 of 30 without a rule. Haiku went from 0 of 30 to 27 of 30 (R1, R3, and the pre-registered comparisons in `experiments/rules/results/2026-11-20/summary.md`).
- **It fails open.** Hooks never block a tool call and make no network calls, apart from the classifier, which is off by default (README, "Features").
- **Delivery is logged.** `noonsight report` shows what each session received, so you can verify it rather than trust it.

**Conditions and risks**

- **Pin the Claude Code version.** Every "checked live" fact is tied to a version, mostly 2.1.325 to 2.1.330 (`docs/verification/claude-code.md`). Claude Code changes how hooks behave, and the team's sessions can run different versions. Pick one, run `npm run test:live` on it, and recheck on every upgrade.
- **Read the code before installing.** It installs from a GitHub clone, not npm (version 0.1 is not on npm yet). `noonsight install` writes hooks into every Claude Code login on the account (`~/.claude/settings.json` and any `CLAUDE_CONFIG_DIR`). I have not audited the code; that needs doing before it goes on shared machines.
- **Set the attended/unattended policy yourselves.** Opus 5.5's and Fable 5.2's attended rules ship off, so an interactive Opus or Fable session gets nothing from the preset. Sonnet and Haiku attended sessions get only `verify-changes`, and only after a code edit in a git-tracked repo, unless you give them a scope. Set `session.unattended_when_env` to your CI or orchestrator variable so unwatched sessions are classified correctly.
- **Measured gaps to plan around:**
  - Agent teams, routing and the classifier are not measured.
  - `/fork` is refused in sessions started by `noonsight run` that have rules.
  - Workflow agents get nothing.
  - Foreground subagents of one type that need different rules get nothing until their first Edit, Write or agent call.
  - Plugin subagents that noonsight does not read stay on their parent's model.
  - A compacted session resumed with no model named can run on the default model, which noonsight cannot detect.
- **Cost.** On the Sonnet fix task, a run cost $0.024 without rules and $0.051 with `verify-changes`. Check this against your budget, and use `noonsight report` to drop rules that never change anything you can see.
- **Fable rules are unmeasured.** `finish-work` and `low-context-report` were never delivered in the rule experiment, so their effect is unknown.
- **Your own rules have no measured effect** until you test them. The README's claim covers delivery, not whether a model obeys.
- **Know what the headline numbers mean.** The 99.9% delivery figure comes from a local stand-in for the API; no request reached a model. Many of the failure fixes were verified by hand, not by a test run. The experiments are the project's own, and the samples are 30 to 40 runs per arm on small tasks.

**What it guarantees:** Each Claude Code session and subagent receives the rules written for the model it runs on, and receives them again when that model changes, as long as the hooks run and the Claude Code version matches one the project tested. This rests on Claude Code's hook events and on the project's test results (its delivery benchmark, live checks and decision log), not on any guarantee from Anthropic. Obedience is not guaranteed.

I did not install the tool or run its tests. This verdict rests on reading the README, the verification notes and the two experiment summaries.
