**Verdict: adopt with conditions.** Run it as a time-boxed pilot on a few accounts, not as a team-wide or machine-wide install yet.

I read the README, the hooks contract, the evidence map, the preset sources, and the benchmark and delivery results. I could not run the test suite here (no shell), so the only number I checked against raw data is the latest delivery run, which matches its `summary.json`.

## Reasons

- **It targets your setup.** It gives each session and subagent the rules for the model it actually runs on, and re-delivers after `/model`, `/compact`, `/clear`, resumes and forks.
- **The native alternative falls short on subagents.** In its benchmark, one `CLAUDE.md` holding every model's rules reached 100% of main-conversation requests but only 32% of subagent requests (39 of 121), and never reached Explore or Plan subagents. Only about 30% of the rule text a request carried was written for its model.
- **Delivery is well measured.** The latest run shows 0 of 300 random sessions breaking the invariant, with 3,090 of 3,090 requests and 763 of 763 subagent requests holding their rules.
- **It is low-risk to try.** The hooks always exit 0 and never block a call, and I found no network code in `src/`. There are no runtime dependencies, `NOONSIGHT_DISABLE=1` turns it off per session, and `noonsight uninstall` removes it.
- **It is immature.** It is version 0.0.1, not on npm (you install from a clone) and still unreleased. Nine delivery bugs were found and fixed in the past week, five of them on 2026-11-23.
- **The outcome benefit is unproven.** In its 588-run pilot, task resolution was the same with and without the rules (133 vs 132 of 144), at 7% more cost. The rule effects it does show are on small tasks:

  | Rule | Effect | Cost |
  | --- | --- | --- |
  | `verify-changes` (Sonnet, Haiku) | Tests run after a one-file fix in 29 and 27 of 30 runs, against 0 of 30 without | About double on that fix for Sonnet ($0.024 to $0.051) |
  | `carry-through` (Sonnet) | Full completion of a 13-ticket backlog in 32 of 40 runs, against 9 of 40 | No measurable change |

- **The preset gives your Opus and Fable interactive sessions nothing by default.** Their attended rules ship off. Most scoped rules stay dormant, because nothing detects a task's scope unless you set `NOONSIGHT_SCOPE`, write matchers, or turn on the classifier.

## Conditions and risks

**Conditions**
- Pin a noonsight commit and a Claude Code version together (measured on 2.1.330), and re-run its delivery benchmark before upgrading either.
- Use the per-account install, not `--managed`; a person's `disableAllHooks` cannot switch off the machine-wide one.
- Leave routing and the classifier off. Neither is measured, routing in auto mode causes sibling calls to be refused and retried, and the classifier sends task text to a model.
- Write your own rules for what you actually want per model, and keep model-independent rules in `CLAUDE.md`.
- Review `noonsight report` after two weeks and drop rules that change nothing visible.
- Treat `noonsight trust` on a repository as code review: a trusted repo's rule files are injected into every session there.

**Risks**
- **Claude Code drift.** It relies on undocumented behaviours (fork metadata, `CLAUDE_CODE_SESSION_ATTENDED`, transcript fields), so a Claude Code update can silently misdeliver.
- **Subagent gaps.** Workflow agents get nothing, and split-pane agent teams are unchecked. Parallel same-type subagent calls that need different rules get none until their first edit or agent call.
- **Model identification gaps.** `default`, `opusplan`, Bedrock/Vertex aliases without pinning variables, and models Claude Code falls back to by itself get a warning and no rules.
- **Single maintainer.** It is one author's project, recently renamed from sextant.
- **Overhead.** Seven hook entries run in every session, at 50–90 ms CPU each.

## What it guarantees

It guarantees delivery, not behaviour: each request carries the rules configured for its model, scope and place, with other models' rules retired. That rests on a fuzz benchmark run against a stubbed API on one Claude Code version, with noonsight's own resolver as the reference.
