**Verdict:** Adopt with conditions.

**Reasons:**
1. It covers the case your team most needs. Each session and each subagent gets the rules for the model it actually runs on, and the rules are re-delivered when `/model` or `/compact` changes the model. In the 2026-11-20 delivery run (`experiments/delivery/results/claude-code-2.1.328/2026-11-20-4e18c43/README.md`), 300 random sessions covered 99.5% (3,199 of 3,216) of requests with rules due. Native alternatives covered far less: a `CLAUDE.md` reached 87.4% of requests and 32.2% of subagent requests, and a skill per model reached 0%.
2. The subagent gap is real. A `CLAUDE.md` never reaches the built-in Explore and Plan subagents, which matters because many of your sessions start them.
3. Its failures are documented and tested, not hidden. Three of 300 sessions broke the invariant. One is a documented limit: a compacted conversation resumed with nothing naming a model runs on Claude Code's default model, which noonsight cannot detect. The other two (F3, F4) are resume-after-switch sequences, and both have corpus entries that reproduce them.
4. It is mostly safe to run. The hooks never block anything and make no network calls. The one exception is the classifier, which is off by default.
5. Its rule effects are measured, not assumed. For Sonnet and Haiku, the `verify-changes` rule raised test-running after a one-file fix from 0 of 30 to 29 of 30 (`experiments/rules/results/2026-11-16/README.md`). Opus and Fable already ran tests without rules, so the preset's value for them is delivery of rules, not behavior change.

**Conditions and risks:**
- **The guarantee is measured only in a narrow setup.** The benchmark used a local stub API that never reached a model, one Claude Code version (2.1.328), and subagents that make a single request and never edit files. It did not measure `/resume` inside a session, forks, plan mode, agent teams, routing, project configs, or subagents that edit files. If your team relies on any of these, test them first.
- **Pin or re-verify the Claude Code version.** The docs say hook behavior changes between versions, and `docs/verification/claude-code.md` lists what was checked. Before upgrading, run the corpus (`npm test`) on the new version.
- **Two inconsistent statements about the fixes.** The top-level README says F3 and F4 were fixed after the run and the rate is "still the one above". The 2026-11-20 results file says "Neither is fixed here." I could not find a committed fixed-build run, so treat F3 and F4 as open until that is resolved.
- **Model-switch patterns carry the most risk.** Avoid `/model` followed by a resume, and multiple resumes with `--model` in a row. Those are the F3 and F4 patterns.
- **Installation is user-wide.** `noonsight install` adds hooks to every Claude Code login on the account. Each person must install it deliberately, and the package is not on npm yet, so it must be installed from a clone with `npm link`. Node 20 or newer is required.
- **Cost.** Rules add tokens to every request. On Sonnet's fix task, `verify-changes` raised the run cost from $0.024 to $0.0505. Budget for it.
- **Unmeasured rules for Opus and Fable.** Opus's effect was inconclusive, and Fable's only measured effect was report style. Don't expect behavior changes from those models' presets without testing your own tasks.
- **Scopes must be set.** A session with no task scope receives almost nothing from the preset. Set `NOONSIGHT_SCOPE` or `session.unattended_when_env`, or the preset will do little for you.

Suggested rollout: pilot with two or three people on the Claude Code version you actually use, run `noonsight report` to confirm delivery, keep universal rules in `CLAUDE.md`, and put model-specific and subagent rules in noonsight.

**What it guarantees:** Within a session or subagent, every request that has rules due receives the rules for the model it runs on, and no other model's rules are left unretired, 99.5% of the time in the 2026-11-20 stub benchmark on Claude Code 2.1.328. This rests on Claude Code's hooks behaving as documented on that version, and on the fuzzer and corpus tests with a stub API. It does not guarantee that a model follows a delivered rule, and it does not cover the unmeasured features listed above.
