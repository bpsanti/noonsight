**Verdict:** Adopt with conditions. Pilot it on a few machines first, pinned to one Claude Code version.

**Reasons:**

1. **It does what you need on the models you use.** The delivery benchmark covered 300 random sessions across all four models (Fable 5.2, Opus 5.5, Sonnet 5.5, Haiku 5.5), with `/model`, `/compact`, `/clear`, resumes, subagents and edits. Each request got its own model's rules on 99.5% of the requests that had rules due (3,199 of 3,216), and 3 of 300 sessions broke somewhere (README.md:17, docs/evidence.md:15).
2. **It beats the native options on subagents.** Under noonsight, 100% of subagent requests got their rules. A user `CLAUDE.md` reached 32.2% of them, and it never reaches the built-in Explore and Plan subagents. Your team's heavy subagent use is where this matters most (README.md:24-31).
3. **Rule effects are real on Sonnet and Haiku, for specific rules.** `verify-changes` raised test runs after an edit from 0 of 30 to 29 of 30 on Sonnet's fix task and from 0 of 30 to 27 of 30 on Haiku's. `carry-through` raised completed backlog work from 9 of 40 to 32 of 40 on Sonnet, and showed nothing on Haiku (experiments/rules/results/2026-11-20/summary.md; README.md:95-98).
4. **The cost is modest but not zero.** Sonnet's cost per run went from $0.071 to $0.084 on the benchmark tasks (+19%). Haiku's input tokens went from 253k to 323k per run. Opus was flat. `verify-changes` on Sonnet's fix task doubled cost, from $0.024 to $0.0505 per run (experiments/benchmark/results/2026-11-19/summary.md:79-87; experiments/rules/results/2026-11-20/summary.md:208).
5. **It is local and low-risk to run.** The hooks never block anything, use no network (the classifier is off by default), have no runtime dependencies, and the source is MIT-licensed (README.md:122-123, 149, 158).

**Conditions and risks:**

- **Version pinning.** The guarantee was measured on Claude Code 2.1.328, and the rule experiment on 2.1.329. Hooks change between versions. Before rollout, run `npm run delivery -- all` and the corpus on the version your team uses, and repeat them on every upgrade.
- **The fixed build has not been fuzzed.** Two failures (F3, F4) were fixed after the 99.5% run. Their reproductions pass in the corpus, but the 300 random sessions have not been rerun on the fixed build (README.md:20-22). Run the fuzz level on the build you install.
- **Pick the installed build deliberately.** The package is not on npm yet, so you install from a clone with `npm link`. `noonsight install` writes hooks into every Claude Code login on the account (README.md:49-61). Install per user, not via a shared image.
- **Unmeasured paths your team probably uses.** Not measured: `/resume` inside a session, forks, plan mode, agent teams, routing, project configurations, and subagents that edit files (README.md:43). Treat these as unverified. Use `noonsight report` to check what happens on them.
- **Unscoped sessions get almost nothing.** A watched session with no task scope receives nothing from the preset. Set `NOONSIGHT_SCOPE` or `session.unattended_when_env`, or the tool delivers little (README.md:41, 128).
- **Fable and Opus rules are unproven in our data.** Fable and Opus rules were never delivered in the rule experiment, and only Sonnet and Haiku rule effects were measured. Check Fable and Opus rules on your own tasks before relying on them.
- **Auto-switched models outside the four get no rules.** The benchmark saw sessions move to `claude-opus-4-8` and `claude-sonnet-5` after a switch. noonsight delivers nothing for those models, so a session can run unguided without anyone noticing.
- **Delivery is not obedience.** A delivered rule is context, not a guarantee the model follows it (README.md:39).
- **Logs show what the hook returned, not what the model received.** The decision log cannot see a delivery that Claude Code dropped (experiments/delivery/README.md:145). Hooks fail silently, so do not treat a clean `report` as proof of delivery.
- **Small samples.** Rule-effect results come from 30 to 40 runs per arm on small tasks. Treat them as directions to recheck, not general effects (README.md:101).
- **Project rules need trust.** Repository rules in `.noonsight/noonsight.json` need `noonsight trust` from each person (README.md:131).

**What it guarantees:** On the Claude Code version it was measured on, every request of a session and each of its subagents receives the rules written for its own model, and no other model's rules remain unretired, on 99.5% of requests with rules due, as checked by a fuzz run of 300 sessions against a local stand-in for the API, where the expected rules come from noonsight's own resolver. This rests on that fuzz run and its reference resolver. It does not cover paths that were not measured, and it does not cover the fixed build's random sessions.

I did not install or run anything. This review is from the README, docs and committed result files. Running `npm test` and the delivery suite on your Claude Code version is the next step.
