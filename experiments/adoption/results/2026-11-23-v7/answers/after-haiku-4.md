**Verdict: Adopt with conditions.** Run it as a pilot on a few people's machines first, with the conditions below, before rolling it out to the team.

**Reasons**

- **Your mix of models and heavy subagent use is what it targets.** The README's comparison on the same 60 sequences found that a user `CLAUDE.md` reached 32.2% of subagent requests (39 of 121). `.claude/rules` reached the same 32.2%, and a skill per model reached 0%. noonsight reached 100%, including the built-in Explore and Plan subagents, which `CLAUDE.md` never reaches (`README.md`, `docs/evidence.md` D9–D11).
- **Delivery was tested on the paths your team uses.** The latest run (Claude Code 2.1.330, 2026-11-23) covered `/model`, `/compact`, `/clear`, resumes, forks, plan mode, `noonsight run`, project configs and subagents that edit files. After five fixes, 0 of 299 sessions that ran to the end had an unexplained violation, and 453 of 453 requests with rules due held them (`experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.md`).
- **Per-model delivery is the core design.** Rules are chosen by model, scope, place and trigger, so each model gets its own rules when `/model` switches or a subagent starts. A `CLAUDE.md` carries every model's rules to every model.
- **It fails open.** Hooks never block anything, and the only network use is an optional classifier that is off by default. `NOONSIGHT_DISABLE=1` turns it off for a session.
- **Its records are checkable.** `noonsight report`, `resolve` and `models` show what each model received, so you can audit it instead of trusting it.

**Conditions and risks**

- **Pin the Claude Code version, or re-measure on yours.** The evidence covers 2.1.328 and 2.1.330. The docs say Claude Code changes how hooks behave, and `docs/verification/claude-code.md` lists the version each fact was checked on. Run `npm run delivery -- corpus` (or the corpus test) on your version before rollout.
- **Subagent gaps remain, and your team uses many subagents.** Per the README's known limits, a workflow's agents get no rules. Foreground calls of one type that need different rules give their subagents none until their first Edit, Write or agent call. A plugin noonsight does not read, such as one an org syncs, leaves its subagents on the parent's model. Check these against your actual workflows.
- **Agent teams, routing and the classifier are not measured.** If anyone uses them, that part is unverified.
- **Most preset rules are off for attended sessions.** Opus 5.5's and Fable 5.2's attended rules ship off. Sonnet 5.5 and Haiku 5.5 attended sessions get `verify-changes` only when they edit a tracked code file, and their other rules need a scope. You will need your own rules, and you will need to set the scopes.
- **Cost rises.** In the 2026-11-19 paid runs, per-run cost went from $0.070 to $0.086 on Sonnet (+23%), and Haiku's input tokens went from 253k to 323k per run (+28%). Fable's cost went from $0.298 to $0.325 (+9%). Those are small tasks, so measure on yours.
- **Delivery is not obedience.** The rules reach the model as context and are not enforced. The one rule with a measured effect, `verify-changes`, moved Sonnet and Haiku from 0 of 30 to roughly 27–29 of 30 test runs on one small fix. That is one task, with 30 runs per arm.
- **Install is machine-wide and manual.** Hooks go into every Claude Code login on the account. Version 0.1 is not on npm yet, so each person installs from a git clone. A repo's `.noonsight/` config does nothing until each clone runs `noonsight trust`.
- **Model identity can drift.** In the paid runs, sessions on Fable and Opus silently fell back to other models after the configured model. noonsight tracks these, but check `noonsight report` after changes.
- **The evidence is produced by the tool's authors.** It uses a local stub, not the live API, and checks delivery against noonsight's own resolver. So it shows that rules reach the right model, not that the rule choices are correct.
- **Maturity.** It is pre-1.0 and not yet on npm. Check who maintains it and how it is released before depending on it.

**What it guarantees**

On the tested Claude Code versions, the hooks deliver to each session and subagent the rules noonsight's resolver assigns to its model, scope, place and triggers, and no other model's rules without a retiring note; this rests on the Claude Code hooks it uses and on a stub-API benchmark (2.1.330, 0 of 299 unexplained violations, 453 of 453 requests), not on the live API or on any obedience by the model.

I read the README, the evidence and results files, and the delivery experiment docs. I did not run `npm test` or the benchmarks, so the numbers above are as the repo reports them.
