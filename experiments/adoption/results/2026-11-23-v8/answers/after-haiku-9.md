**Verdict: adopt with conditions.** Pilot it on one team's workflow before rolling it out to everyone.

**Reasons**

- It matches your mix of models. It writes a separate rule set per model (Opus 5.5, Sonnet 5.5, Haiku 5.5, Fable 5.2) and re-delivers the right set when a session switches models with `/model`, `/compact`, `/clear` or a resume. Plain `CLAUDE.md` can't do that.
- Subagents are where the native options fall short, and your team starts many of them. The README's coverage table for the 2.1.330 run shows subagent requests at 100% (763 of 763) under noonsight, against 46.9% (60 of 128) for `CLAUDE.md` or `.claude/rules` and 0% for a skill per model.
- The design is conservative. It uses only Claude Code hooks and local files, never blocks anything, and makes no network calls unless the optional classifier is turned on. It has a decision log (`noonsight report`) so you can check what was delivered.
- I spot-checked the raw data. `summary.json` for the `claudemd` arm gives 508 of 576 covered, 60 of 128 subagent requests covered, and 4,472 characters added per agent request, all matching the README and `docs/evidence.md`. I did not open the `on-g2-s1-n300` key that holds the headline 100% figures, so those are unverified by me.
- The measured effects on task quality are small: `verify-changes` raised test-running after edits on Sonnet and Haiku, and `carry-through` helped Sonnet on one backlog task. The authors also say the rules changed nothing where the models already did the work.

**Conditions and risks**

- **Version pinning.** Every result is for one Claude Code version (2.1.330 for the delivery claim, 2.1.329 for rule effects). Hooks can change between versions. Confirm your team's Claude Code version matches, or treat the claim as unverified until your own check passes.
- **Package maturity.** The package is `0.0.1`, and the README says `0.1` is not on npm yet. You have to clone the repo and run `npm link`, so someone owns that install and updates.
- **Opus and Fable attended sessions get nothing by default.** Most of their preset rules for attended sessions ship off. If most of your Opus work is interactive, you have to turn rules on with `enable`. Otherwise you will think you have coverage when you don't.
- **Known subagent gaps.** Per the README: a workflow's agents receive nothing; foreground calls of one type that need different rules give those subagents nothing until their first Edit, Write or agent call; and plugins that noonsight does not read (such as ones an organization syncs) leave their subagents on the parent's model. Test your actual subagent patterns, not just the benchmark's.
- **Headless and CI sessions.** Interactive sessions that nobody watches are treated as attended unless you set `session.unattended_when_env` to your CI or orchestrator variable.
- **Delivery is not behavior.** The guarantee is that the right text reached the request. It does not show the model followed it.
- **Self-measured.** The benchmark's harness and its pass criteria come from the same project. The sessions are real Claude Code, but the API is a local stand-in, so the claim is not independent verification.
- **Mixed-model sessions.** `/fork` is unavailable in a session started with `noonsight run` and rules, and a compacted, resumed session with no model name in it falls back to Claude Code's default model, which noonsight cannot detect.

**Conditions to adopt**

1. One team member pilots it for 2 to 4 weeks on the Claude Code version you actually use.
2. Check it with `noonsight resolve` and `noonsight report` on your own subagent patterns and your own rules.
3. Decide per model which preset rules to turn on, and set `unattended_when_env` for CI.
4. Pin the Claude Code version, and re-run the check when either side updates.

**What it guarantees:** in the current benchmark, every request that was due its model's rules received them (3,090 of 3,090), with no other model's rules left in place, on Claude Code 2.1.330 with a stand-in API. This rests on noonsight's own benchmark and on that one Claude Code version; it does not show that the model obeyed the rules.

I did not install or run the tool or its test suite. These conclusions come from reading the README, the evidence map and the raw summary data.
