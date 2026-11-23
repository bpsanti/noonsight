**Verdict: adopt with conditions.** Pilot it on a few machines first, and expand only if the conditions below hold for your setup.

**Reasons**

1. **It covers the model mix you described.** It has preset rules for Fable 5.2, Opus 5.5, Sonnet 5.5 and Haiku 5.5, and it delivers rules per model, including when a session switches models with `/model`, `/compact`, `/clear`, resumes or forks.
2. **The delivery numbers are better than the native alternatives on the repo's own benchmark.** Over the first 60 sequences, delivery covered 100% of requests, against 87.3% for a user `CLAUDE.md` and 70.6% for `.claude/rules`. For subagent requests it covered 100%, against 32.2% for `CLAUDE.md` and `.claude/rules`, and 0% for a skill per model (README; [docs/evidence.md](docs/evidence.md) D5–D11).
3. **Your heavy subagent use is the main reason for the conditions.** Subagents are where the native options fall off, but the tool has its own documented gaps there: a workflow's agents get nothing, several foreground calls of one type that need different rules leave their subagents without rules until their first edit or agent call, and plugin-synced subagents are predicted on their parent's model (README "Known limits for subagents").
4. **The latest run is recent and was fixed in response.** The 300-session run on Claude Code 2.1.330 (D18, D21, D22) dated 2026-11-23 found F5–F9 and reports 0 of 300 sessions breaking the invariant after the fixes. Earlier runs found F1–F4, which were also fixed.
5. **The rule effects are measured but small.** `verify-changes` made Sonnet and Haiku run tests in 27–29 of 30 runs on a one-file fix, where without rules they ran them 0 of 30. The cost was about double on Sonnet's fix. Where the models already did the work, the rules changed nothing and still cost a little (R3, R6, R8).

**Conditions and risks**

- **Match the Claude Code version.** Every measurement is tied to one Claude Code version (2.1.330 for the latest run, 2.1.328 for earlier ones). Run `claude --version` on each machine. If your team is on another version, run `npm run delivery -- all` with `--claude <binary>` before relying on it, or run `noonsight report` and `noonsight check` in a pilot. Hooks change between versions, and the repo says so.
- **Measure your own subagent coverage.** Have a pilot run several subagent workflows and check `noonsight report` for the subagent entries. If your team uses workflows or plugin-synced agents, expect them to get no rules or the parent's rules.
- **Set up attended vs unattended.** Opus 5.5's and Fable 5.2's attended rules ship off, so an attended session on either gets nothing from the preset until you `enable` them. Set `session.unattended_when_env` to your CI or orchestrator variable, or CI-run interactive sessions will be treated as attended.
- **Installation changes every login on the machine.** `noonsight install` adds hooks to every Claude Code login of the account. On a shared machine that affects everyone. `noonsight uninstall` removes them. Version 0.1 is not on npm, so install from a clone with `npm link`. Check what it does to the machines' config before rollout.
- **Repository rules need trust.** Each person who clones a repo must run `noonsight trust` once, or the repo's `.noonsight/noonsight.json` does nothing.
- **Keep the classifier off unless you need it.** When enabled, it sends the first 4,000 characters of each task to a small model through your login. It is off by default.
- **Known limits.** A conversation compacted with no response since and resumed with nothing that names a model runs on Claude Code's default model, which noonsight cannot detect. Agent teams, routing, and the classifier were not measured. `/fork` is unavailable in a session started with `noonsight run` that has rules.
- **Delivery is not obedience.** A delivered rule is context, not a guarantee of behavior. Rules that matter should be checkable, and you should measure their effect on your own tasks, since the repo's experiments used small tasks with 30–40 runs per arm.
- **Self-reported evidence.** The benchmarks are run by the project's own harness against a local stub API, and I did not rerun them. Treat the numbers as the project's claims until your pilot confirms them on your workflows.

**What it guarantees:** Every request of a session, and of each subagent the harness can see, receives the rules written for its model and no other model's rules that were not retired by a model-change note, on the Claude Code versions measured (the repo's benchmark reports 0 of 300 sessions breaking this after the fixes). That rests on the project's hooks and its own delivery benchmark, which checks what the stub API received, not what any model did with it.

I did not run the tool or its test suite. This verdict rests on reading the README, `experiments/delivery/README.md`, and the evidence index.
