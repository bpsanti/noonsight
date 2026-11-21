**Verdict: adopt with conditions.** Run it as a time-boxed pilot with a few people on a pinned Claude Code version, not as a team-wide rollout yet.

I read the README, docs, preset, changelog and the committed delivery results, and spot-checked the headline numbers against the raw result file. I could not build it or run its tests in this session.

## Reasons

- **It targets your situation.** It gives each session and each subagent the rules written for the model it actually runs on, and re-delivers them after `/model`, `/compact`, `/clear` and resumes. Its own docs say to skip it if every session runs one model, which is not you.
- **The delivery claim is backed by committed data.** In 300 fuzzed sessions on Claude Code 2.1.328, 3,199 of 3,216 requests with rules due held the right rules (99.5%), and 3 sessions failed. Those counts match `summary.json`.
- **The gap it closes versus `CLAUDE.md` is subagents.** A `CLAUDE.md` holding every model's rules reached 100% of the main conversation's requests but only 39 of 121 subagent requests, because it never reaches the built-in Explore and Plan subagents. It also hands every model the other models' rules.
- **It fails open.** The hooks always exit 0 and never deny a call. I found no network code in `src/`; the only processes it starts are `git`, `ps`, and `claude` for the optional classifier and launcher. `noonsight uninstall` removes the hooks.
- **The benefit to work quality is unproven.** In the 588-run benchmark pilot, the verifier saw no measurable difference in task results between noonsight on and off, at about 7% more cost per run. The rule-effect experiments show behaviour changes on small tasks (Sonnet ran tests after a fix in 29 of 30 runs versus 0 of 30), but all 600 runs passed their hidden check with or without rules.
- **It is very young.** It is version 0.0.1, marked private, not on npm, installed from a clone, from one author, with all results dated within the past week.

## Conditions and risks

- **Out of the box, your Opus and Fable interactive sessions receive nothing.** Their default-on preset rules are for unattended runs or subagents only. Sonnet and Haiku sessions get `verify-changes` only after editing a tracked code file. You must set scopes (`NOONSIGHT_SCOPE`), set `session.unattended_when_env` for CI, or write your own rules to get value.
- **Pin the Claude Code version.** It depends on about 50 observed hook behaviours, checked on 2.1.325 to 2.1.328. Four delivery bugs were found in a week, and the fixes for the last two have no committed re-run. Rerun its delivery corpus on each Claude Code upgrade.
- **Do not treat `noonsight report` as proof.** The decision log records what the hook returned, not what reached the model; in the benchmark the log showed 100% where the stub saw 99.4%.
- **Known subagent gaps.** Plugin subagents, agent-team teammates, `--agents` definitions, and parallel same-type calls that would get different rules receive wrong or no rules. Model settings `default` and `opusplan`, and aliases on Bedrock or Vertex without pinning, only produce a warning.
- **Leave routing and the classifier off.** Both are unmeasured, routing causes refused calls in auto mode, and the classifier sends task text to a model.
- **Install footprint.** `noonsight install` writes hooks into every Claude Code configuration directory of the account and adds 60 to 120 ms per hook run. Repository-committed rules apply only after each person runs `noonsight trust`, and those files should be reviewed like code.
- **The README has been tuned against AI reviewers.** The changelog describes an experiment that asks fresh Claude sessions this same adoption question and revises the README until answers match the author's reference. That experiment's files are not in this copy, so weigh the raw results over the prose.
- **Exit criterion for the pilot.** Drop it if, after a few weeks, you cannot name a per-model rule that visibly changes behaviour you care about; a `CLAUDE.md` is simpler.

## What it guarantees

It does not guarantee obedience or better results, only that each model's rules arrive in the request. That is a measured rate rather than a hard guarantee: 99.5% of requests across 300 fuzzed sessions on Claude Code 2.1.328, run against a local stand-in for the API and judged against noonsight's own resolver.
