**Verdict: adopt with conditions.** Treat it as a low-risk pilot, not a mandate. I read the README, `docs/evidence.md`, `docs/usage.md`, `docs/hooks.md` and `package.json`. I did not run the tool or its tests.

**Reasons**
- **It fits your setup.** You run four models and many subagents, which is the case it was built for. In its delivery benchmark, subagents got their model's rules in 763 of 763 requests. A user `CLAUDE.md` managed 60 of 128 (46.9%), and it never reaches the built-in Explore and Plan subagents.
- **Nothing leaks across models.** No request held another model's rules unretired (D32: 0). A `CLAUDE.md` did so in 619 requests and `.claude/rules` in 622. Under noonsight, 78.6% of the rule text in a request was written for that request's model, against 32.6% and 27.9%.
- **The claims are checkable.** Each number links to a raw result file, and `npm test` recomputes them. The README states its own limits, and the repo lists nine failures it found in itself and fixed (F1 to F9). It has no runtime dependencies and the license is MIT.
- **It is low-risk to run.** The hooks never block anything and use no network by default. A hook run costs 80 to 150 ms of CPU, measured on a busy laptop. `NOONSIGHT_DISABLE=1` and `noonsight uninstall` back it out.
- **A few rules have measured effects, on small tasks.** For example, `verify-changes` made Sonnet 5.5 run the tests after its last edit in 29 of 30 runs, against 0 of 30. `carry-through` took Sonnet 5.5 from 9 of 40 to 32 of 40 on a 13-ticket backlog. The preset's effects are mostly for Sonnet and Haiku.

**Conditions and risks**
- **Rules that change behavior add cost.**
  - `verify-changes` roughly doubled the cost of a cheap task: $0.0505 against $0.0240 on Sonnet, and $0.0033 against $0.0015 on Haiku.
  - Decide whether you want that before you enable it.
  - Rules that cost more or have no measured effect ship off. That includes all of Opus 5.5's and Fable 5.2's attended rules.
- **Delivery is not obedience.** A delivered rule is context. Anything that must never be broken needs a hook or a permission rule instead.
- **Quality gains are not shown.** Every run passed its hidden check with or without rules (600 of 600). The paid pilot on public tasks showed no difference: 133, 132 and 133 of 144 passed across the three conditions. Expect more consistent process, not better code.
- **The benchmark never called a real model.** It runs real Claude Code sessions against a local stand-in for the API, so it proves what was delivered and nothing about how the models responded. Effects come from separate small experiments.
- **Everything is version-pinned.** Delivery was measured on Claude Code 2.1.330, rule effects on 2.1.329 (Fable 5.2's on 2.1.328), and the pilot on 2.1.326. Hook behavior changes between versions, so pin your Claude Code version and rerun `noonsight check`. Treat any Claude Code upgrade as a retest.
- **Known gaps:**
  - Workflow agents get nothing.
  - Subagents from plugins it doesn't read, such as org-synced ones, are assumed to run on the parent's model.
  - Some foreground subagent calls get rules late.
  - A session resumed after compaction with no model named runs on the default model, and noonsight can't tell which.
  - Agent teams, routing and the classifier are unmeasured. Leave the classifier and routing off.
  - Sessions started with `noonsight run` can't use `/fork`.
- **The default install gives your Opus and Fable sessions little.** Those attended rules ship off. Sonnet and Haiku scoped rules need a `NOONSIGHT_SCOPE`. Set `session.unattended_when_env` for interactive sessions nobody is watching.
- **Hooks must be allowed.** If managed settings forbid user hooks, it does nothing, so check with `noonsight check`.
- **Maturity.** It is version 0.1.0 from a single author, renamed from "sextant". It has no track record on teams.
- **Pilot first.** Install it with `npm install -g noonsight`, not `npx`, because the hooks break if npm's cache is cleared. Run it on a few machines, review `noonsight report`, and write your own rules only after measuring them. Drop any rule that changes nothing you can see.
- **Skip it if** your sessions use a single model with fixed rules and don't depend on Explore or Plan subagents. A `CLAUDE.md` is simpler, and the docs say the same.

**What it guarantees**
Through Claude Code's hooks, noonsight puts the rules declared for a model into the requests of each session and subagent running on that model, and again when the model changes or the conversation is compacted, cleared, resumed or forked. This rests on one benchmark of 300 generated sessions, 299 of which ran to the end, with 0 failures. It was run on Claude Code 2.1.330 against a local stand-in for the API, and the guarantee covers delivery only, not whether the model follows the rules.
