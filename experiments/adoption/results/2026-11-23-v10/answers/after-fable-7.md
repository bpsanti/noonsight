**Verdict: adopt with conditions.** Pilot it on a few machines first; do not roll it out team-wide yet.

I read the README, the hook and install docs, the evidence map, the benchmark results and the preset. I did not run the test suite or the tool, so the numbers below are the repo's own committed results, not something I reproduced.

## Reasons

- **It fits your setup.** A mixed-model team with many subagents is the case it is built for. The README itself says to skip it when every session runs one model with fixed rules.
- **The subagent gap it closes is real.** In its delivery benchmark, a user `CLAUDE.md` reached 46.9% of subagent requests (60 of 128) and never reaches the built-in Explore and Plan subagents. noonsight reached 763 of 763.
- **Delivery is well evidenced for what was tested.** On 300 generated interactive sessions (Claude Code 2.1.330), 299 ran to the end and none broke the delivery invariant: 3,090 of 3,090 requests held their rules. The sessions cover `/model`, compaction, `/clear`, resume, forks and plan mode.
- **It is low-risk to try.** It has no runtime dependencies and the hooks always exit 0 and never block a call. Hooks read only local files with the optional classifier off, and `noonsight uninstall` removes them.
- **It shows no quality gain.** The paid pilot passed 133 of 144 tasks without rules, 132 under noonsight and 133 with a plain `CLAUDE.md`. Cost per run rose from $0.141 to $0.151.
- **Measured rule effects are narrow.** `verify-changes` got Sonnet to run tests after a one-file fix in 29 of 30 runs against 0 of 30, at about double the cost of that small task. `carry-through` on Sonnet and `low-context-report` on Fable also show effects; no Opus rule has any measured effect.
- **Out of the box it does little for your attended sessions.** With the preset, an attended Opus or Fable session receives nothing. Sonnet and Haiku get `verify-changes` only after editing a tracked code file.
- **It is a week old.** It is version 0.1.0 by a single author, and every result is dated 16–23 November 2026. Nine delivery failures were found and fixed in that week, most caused by Claude Code behaviours the docs describe as undocumented.

## Conditions and risks

Conditions for it to work for you:

- **Write your own rules.** The value for you is your team's per-model and subagent rules, not the preset. Keep what every model should always have in `CLAUDE.md`.
- **Pin and re-check Claude Code versions.** Each result holds only for the version it ran on. Run the delivery corpus on each new Claude Code version before trusting it, as the repo recommends.
- **Check your environment.** It needs Node.js 20+ and macOS or Linux; Windows is unsupported. Managed settings with `allowManagedHooksOnly` or `disableAllHooks` stop the per-account hooks.
- **Declare models explicitly.** With `default` or `opusplan`, or with aliases on Bedrock, Vertex or Foundry without the pinning variables, it warns instead of telling which model runs.
- **Review `noonsight report` after two weeks.** Drop rules that never deliver or change nothing you can see.

What could go wrong:

- **Some subagents get nothing.** Workflow agents get no rules. Parallel same-type subagent calls that need different rules get none until the subagent's first Edit, Write or agent call. Agents from organization-synced plugins are predicted on their parent's model.
- **Unmeasured features.** Agent teams, routing and the classifier are not in the benchmark; leave routing and the classifier off.
- **Repository rules are a trust channel.** After one `noonsight trust`, later changes to a repo's rule files apply without asking again. A pull can therefore change what the models are told, so review `.noonsight/` changes like code.
- **Fallback models lose their rules.** In the pilot, sessions that auto-switched to `claude-sonnet-5` or `claude-opus-4-8` received only the retirement note, because those models are undeclared.
- **The benchmark has blind spots.** Its reference is noonsight's own resolver, so a wrong resolution would not show. Its self-check caught only 4 of 9 and 7 of 15 exposed sessions for two of its three planted bugs.
- **Overhead.** Each hook costs about 80–150 ms of processor time, measured on a loaded machine, and runs on agent calls and on Edit/Write. Later edits skip the git check once a session has revealed the trigger.

## What it guarantees

noonsight guarantees delivery, not obedience: the rules declared for a model are put into the requests of each session and subagent running on it, and again after a model change, compaction, clear, resume or fork. That rests on Claude Code's hooks behaving as they did on the tested version (2.1.330), within the documented limits.
