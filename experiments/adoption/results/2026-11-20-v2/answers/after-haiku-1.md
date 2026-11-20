Verdict: **Adopt with conditions.** Run it as a pilot on one Claude Code version before rolling it out to everyone.

**Reasons**

- **The headline numbers check out.** I recomputed them from `experiments/delivery/results/claude-code-2.1.328/2026-11-20-4e18c43/summary.md`. 300 random sessions covered 3,199 of 3,216 requests that had rules due (99.5%), and 3 sessions had an unexplained violation. Plain CLAUDE.md coverage was 87.4% overall and 32.2% for subagent requests. `.claude/rules` coverage was 70.9%, and one skill per model covered 0%.
- **It fits how your team works.** It covers the four models you use, including Fable 5.2. It re-delivers rules after `/model`, `/clear`, `/compact` and resumes, and to subagents. Those are the paths a CLAUDE.md can't reach, since CLAUDE.md never reaches the built-in Explore and Plan subagents.
- **The cost is small.** It adds about 1,150 characters per request, roughly 4.7% of request text, versus about 4,400 for a CLAUDE.md with every model's rules. Rules changed outcomes on some tasks: Sonnet ran tests after a one-file fix in 30 of 30 runs with its rules against 0 of 30 without, and the carry-through rule raised completed multi-ticket runs from 9 of 40 to 32 of 40. On other tasks, Haiku's carry-through rule showed nothing, and the rules cost a little with no visible gain.
- **It is auditable.** `noonsight report` and `noonsight models` show what each session was sent, which matters if you need to explain agent behavior later.
- **The repo's own test is sound.** Each published number is tied to a raw result file, and `npm test` recomputes the numbers from those files.

**Conditions and risks**

- **Pin the Claude Code version and re-measure on it.** Every benchmark number is for Claude Code 2.1.328. The hook behavior is checked version by version in `docs/verification/claude-code.md`, so confirm what version your team runs and re-run the delivery benchmark there before you trust the figures.
- **The 99.5% is not the fixed build's number.** Failures F3 and F4 were found after that run and fixed afterward. The repo says the 300 sessions were not re-run on the fixed build, so the committed rate is pre-fix. Before adopting, run the corpus (`experiments/delivery/corpus`) and ideally the 300-session fuzz again.
- **Subagent coverage is weaker for your use than the number suggests.** In the benchmark's stub, each subagent makes one request and no subagent edits a file. Your team's subagents will make many requests and edit code. That was not measured, and it is the most important gap for you.
- **Several things your team may use were not measured:** `/resume` inside a running session, forks, plan mode, agent teams, the `noonsight run` launcher, routing, the classifier, and project-level configurations.
- **Known limit:** a conversation that was compacted with no response since and resumed without a model name runs on Claude Code's default model, and noonsight cannot tell which model that is.
- **It is pre-release.** Version 0.1 is not on npm, so install from a clone. `noonsight install` writes hooks into every Claude Code login on the account, so it should go onto machines through a controlled step, not ad hoc.
- **Delivery is not obedience.** A delivered rule is context, and the model can still ignore it. The rule-effect experiments used small tasks with 30 to 40 runs per arm, so don't treat them as general results.
- **Keep the classifier off** unless you have reviewed it. When enabled, it sends the first 4,000 characters of each task to a small model through your own Claude Code login. That is a data-handling decision for the team.
- **Pilot plan:** install on one machine with one repository, scope a few sessions, and check `noonsight report` after a week. Run the corpus and an agreed subset of subagent-editing sessions on your own Claude Code version. Adopt more widely only if violations stay near zero on your real subagent workflows.

**What it guarantees:** On Claude Code 2.1.328, noonsight delivered each model's rules and withheld other models' rules on 99.5% of requests that had rules due, across 300 random sessions. That rests on a local stub API that recorded every request without any model call, so it covers delivery, not whether the model followed the rules. It says nothing about the post-fix build, subagents that edit files, or other Claude Code versions.

I did not run the test suite or the benchmark. I verified the numbers by reading the committed result files, and I checked the limits in the delivery README and the verification table.
