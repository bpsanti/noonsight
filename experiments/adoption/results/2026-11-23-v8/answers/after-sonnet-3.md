Verdict: **Adopt with conditions.** Run a time-boxed pilot on a few machines first, and don't roll it out team-wide yet.

**Reasons**

- **It does what it claims for delivery, and the claim is well checked.** In the current run (Claude Code 2.1.330), 0 of 299 completed sessions broke the invariant. Requests with rules due held them 3,090 of 3,090 times, and subagent requests 763 of 763 (D18–D20, `docs/evidence.md`). Every number links to a raw file, and `test/evidence.test.ts` recomputes each one.
- **It beats the native options on your setup, which has many subagents on mixed models.** Subagent requests got their rules 46.9% of the time with a `CLAUDE.md` or `.claude/rules`, and 0 of 128 with skills (D28, D29). A user `CLAUDE.md` also put another model's rules into requests with no retiring note 619 times, against 0 under noonsight (D32). The `CLAUDE.md` comparison used only the first 60 sequences.
- **It is cheap and low-risk to run.** The hooks never block anything and use no network. The classifier is the exception and is off by default. Each hook costs about 80–150 ms of CPU (D33, measured on a loaded laptop). It adds about 1,343 characters per request, against 4,472 for a `CLAUDE.md` carrying every model's rules (D31). `noonsight uninstall` and `NOONSIGHT_DISABLE=1` undo it.
- **It states its own limits.** It lists nine failures it found and fixed, with reproductions. It also marks superseded results and says outright that delivery is not obedience.
- **Some rule effects are measured, but only on small tasks.** `verify-changes` made Sonnet and Haiku run tests in 29 of 30 and 27 of 30 runs, against 0 of 30 without it. `carry-through` on Sonnet raised full completion from 9 of 40 to 32 of 40. On public tasks, the paid pilot showed no difference in pass rate: 133, 132 and 133 of 144 for no rules, noonsight and a `CLAUDE.md` (B1).

**Conditions and risks**

- **The default preset does little for attended sessions on your top models.** Opus 5.5 and Fable 5.2 attended rules all ship off, so interactive Opus and Fable sessions get nothing until someone runs `enable`. Sonnet and Haiku get mostly scoped rules. Without writing your own rules, you'd mainly get unattended and subagent behavior.
- **It's unpublished.** Version 0.1 isn't on npm, so you install from a git clone, which needs Node 20 or newer. The npm name holds an empty placeholder. Pin a commit and review the code before it edits every login's hooks.
- **It is pinned to one Claude Code version at a time.** The delivery claim is on 2.1.330, the rule effects on 2.1.329 (Fable on 2.1.328) and the paid pilot on 2.1.326. Hook behavior changes between releases. You'd need to re-run `npm test` and `npm run test:live` on every Claude Code upgrade, and someone must own that.
- **Headless runs, subagents and orchestrators need setup.** Interactive sessions that nobody watches are counted as attended unless you set `session.unattended_when_env`.
- **Known gaps for subagents:**
  - A workflow's agents get nothing.
  - Foreground calls of one type that need different rules give their subagents nothing until their first Edit, Write or agent call.
  - A plugin noonsight doesn't read, such as one an organization syncs, leaves its subagents predicted on their parent's model.
  - Agent teams, routing and the classifier are not measured.
- **Smaller gaps:**
  - `/fork` doesn't work in sessions started by `noonsight run` with rules.
  - A compacted session resumed with nothing that names a model runs on Claude Code's default model, and noonsight can't tell.
- **Rules can cost money.** `verify-changes` roughly doubles the cost of a small fix: Sonnet $0.0240 to $0.0505, Haiku $0.0015 to $0.0033 (R6, R7). Where the model already did the work, rules changed nothing and still cost tokens. Run `noonsight report` and drop rules that change nothing you can see.
- **Your own rules have no measured effect.** Only the preset's rules were tested. The rule experiments used 30–40 runs per arm on small tasks.
- **Managed settings.** If your organization forbids user hooks, it won't run. `noonsight check` will tell you.
- **Single maintainer.** The repo is `bpsanti/noonsight` and was renamed from sextant. The acknowledgements credit one other project and I saw no sign of wider use. That's a bus-factor risk for something sitting in every session's hook path.
- **Not reviewed:** I didn't read the source. The test results I cite were read from the evidence file, and I didn't run them.

**Suggested pilot:** install on a few machines. Write 2–3 team rules that matter to you, such as commit style and a subagent report format. Set `unattended_when_env`. Run for two weeks and review `noonsight report`. Adopt more widely if the delivery log looks right and the rules produce visible changes. Skip it if you'd only use the preset's defaults.

**What it guarantees:** For the Claude Code version it was tested on, every request, including subagents', carries exactly the rules written for the model it runs on and no other model's. This rests on a benchmark of 299 real interactive Claude Code sessions against a local stand-in for the API, with the checks done against noonsight's own resolver. It does not guarantee that a model follows a delivered rule, or that the rule improves results.
