Verdict: adopt with conditions.

Reasons:
- Your mix of models and heavy subagent use is the case this tool targets. In its delivery benchmark (Claude Code 2.1.330, 2026-11-23), subagents got the rules due for their model in 763 of 763 requests under noonsight, against 46.9% (60 of 128) with a user `CLAUDE.md` and 0% with per-model skills. `CLAUDE.md` also never reaches the built-in Explore and Plan subagents, according to the README. Your team's subagent-heavy workflow is where a `CLAUDE.md` falls short.
- Its main-session coverage was also higher: 100% (3,090 of 3,090) versus 88.2% for `CLAUDE.md`. The `CLAUDE.md` comparison also gave every model the other models' rules in most of the request text, and noonsight avoided that.
- Its evidence is more than a claim. The README says the benchmark ran real interactive Claude Code sessions, with only the Messages API stubbed, and that every request was read. The README and docs/evidence.md also map each number to a raw result file, and `npm test` recomputes them.
- Where it changed outcomes, the effect is narrow but real. `verify-changes` made Sonnet 5.5 and Haiku 5.5 run tests after their last edit in 27 to 30 of 30 runs, against 0 to 11 without it. Those tasks were small.
- The known limits are written down: subagents of a workflow get nothing, `/fork` is unavailable in `noonsight run` sessions, agent teams and routing are unmeasured, and a compacted session resumed with no model named runs on the default model.

Conditions and risks:
- Expect delivery, not better results. The paid pilot found no measurable quality difference (133 of 144 without rules, 132 of 144 with noonsight, 133 of 144 with `CLAUDE.md`), and no rule except `verify-changes` and two others has a measured effect. Before adopting, run your own small pilot on your real tasks, comparing with and without it on the outcomes you care about.
- Cost goes up. On Sonnet, average cost per run rose from $0.070 to $0.086 and input tokens from 121k to 155k. On Haiku, input tokens rose from 267k to 364k, though the dollar cost stays small. Check this against your actual usage.
- Set `session.unattended_when_env` to your CI or orchestrator variable. Otherwise, headless runs are treated as attended, and some rules ship only for unattended runs and subagents.
- Decide which Opus and Fable rules to enable. Those attended-place rules ship off, so those sessions get nothing from the preset until someone turns one on.
- Pin and re-test the Claude Code version. The results were measured on 2.1.330 and older runs on other versions, and hook behavior changes between versions. Re-run `noonsight check` and the benchmark after each upgrade.
- Consider the classifier's data flow before enabling it. It is off by default, but when on, it sends the first 4,000 characters of each task to a small model through the Claude Code login.
- Repository configuration in `.noonsight/` needs `noonsight trust` by each person who clones the repo. Until then it changes nothing, so onboarding has to include it.
- The benchmark that supports the guarantee was written by the project's authors. I did not run the test suite or independently rerun the benchmark, so treat its numbers as the vendor's claims until your own check confirms them.
- One inconsistency to look into: the summary's probe table shows Haiku at 55% delivery after a model switch under the `on` condition, while the README reports 100% coverage overall. I did not resolve this discrepancy.
- Auto-switching happened in the paid runs: Opus 5.5 and Fable 5.2 sessions switched to `claude-opus-4-8` on their own. Your team should expect this and check that the rules still follow the model that actually runs.

What it guarantees: noonsight, through Claude Code's hooks, adds the rules declared for the model each session or subagent runs on to its requests, and again after model changes, compaction, clearing, resumes and forks, which the benchmark measured as 100% of due requests on Claude Code 2.1.330 but which is delivery of context, not obedience to it.
