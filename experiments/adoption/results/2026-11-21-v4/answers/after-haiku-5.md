**Verdict:** Adopt with conditions. Run a pilot on your own setup before a team-wide rollout.

**Reasons:**
1. The delivery claim is the most rigorous part. In the 2026-11-19 benchmark (300 sessions on Claude Code 2.1.328, using a local stand-in for the API), requests that had rules due received the right model's rules 99.9% of the time (3,219 of 3,221). That covered `/model`, `/compact`, `/clear`, resumes, subagents and code edits. Plain `CLAUDE.md` reached only 32.2% of subagent requests, and per-model `.claude/rules` reached 32.2% too. Your subagent-heavy workflow is where the native options fall short.
2. Subagent coverage matches your use. The Explore and Plan subagents got 100% delivery in the benchmark, which `CLAUDE.md` cannot do.
3. The failures are documented and tested. The fuzzer found four bugs (F1–F4), all fixed before the final run. The one remaining failing session in 300 is a named limit: a compacted conversation resumed with no model named.
4. Rule effects are measured for some rules. In the 600-run experiment, `verify-changes` made Sonnet and Haiku run tests after their last edit in 27–30 of 30 runs, versus 0 of 30 with no rule on the fix task. The cost was real: Sonnet's run cost about $0.024 without the rule and about $0.05 with it.
5. It is local and quiet. Hooks never block, never use the network (except the classifier, which is off by default), and every delivery is logged for `noonsight report`.

**Conditions and risks:**
- **Opus and Fable watched sessions get no preset rules.** Every preset rule for them is for unattended runs or subagents. If most of your interactive Opus or Fable work is watched, you get nothing from the preset there. Set `session.unattended_when_env` for orchestrated sessions, or write your own rules. Opus's and Fable's rule effects were never measured, because none were delivered in the experiment.
- **Sonnet and Haiku need a scope.** Their scoped rules only reach watched sessions that set `NOONSIGHT_SCOPE`, or subagents whose task matches a pattern. Decide who sets scopes, or the preset does little for them.
- **Unmeasured paths that your team likely uses:** `/resume` inside a session, forks, plan mode, agent teams, `noonsight run`, project configs, routing, and subagents that edit files. Test these before trusting them.
- **Version pinning.** Everything was measured on Claude Code 2.1.328 (the experiments also used 2.1.329). The project says hook behavior changes between versions. Pin your Claude Code version, or rerun `npm run delivery` after each upgrade.
- **Transition gap.** In the delivery probe, the first request after a `/model` switch had only 55% of its rule text written for the new model (Haiku, `on` condition). The headline 99.9% counts "unretired" rules differently, so read the two numbers together before relying on the switch behavior.
- **Machine-wide install.** `noonsight install` writes to `~/.config` and adds hooks to every Claude Code login on the account. Each person needs to run it, and it is not on npm yet, so it installs from a git clone with `npm link`. Node 20 or newer is required.
- **Repo rules are a prompt-injection surface.** Committed rule files become instructions the model receives. Each person must run `noonsight trust`, and rule-file changes should get code review.
- **Cost.** Extra rules add input tokens. Measured per-run cost rose about 23% on Sonnet (benchmark, $0.070 to $0.086). Expect the same kind of increase.
- **Evidence provenance.** The results are from the project's own experiments. The project has no independent replication that I found. I did not run its test suite or read the hook source, so my verdict rests on the docs and results files.

**What it guarantees:** Within Claude Code 2.1.328 and the preset's configuration, noonsight delivers each session's and subagent's rules for its current model, with the old model's rules retired, on 99.9% of requests that had rules due in a 300-session stand-in-API benchmark; that rests on the logged hook decisions and the benchmark's fixed-bug corpus, not on the model following the rules.
