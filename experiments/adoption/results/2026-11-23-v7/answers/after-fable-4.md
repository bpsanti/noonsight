**Verdict: adopt with conditions.** Run it as a pinned pilot with a few people, not a team-wide rollout. This rests on the repo's docs, changelog and committed results; I had no shell here, so I did not build it, run its tests, or audit the source.

**Reasons**

- **It fits your setup.** It delivers per-model rules to sessions and subagents, and re-delivers on `/model`, `/compact`, `/clear`, resumes and forks.
- **The gap it closes is mostly subagents.** In its benchmark a user `CLAUDE.md` reached 100% of the main conversation's requests (526 of 526) but only 32.2% of subagent requests (39 of 121), because the built-in Explore and Plan subagents never get it. noonsight reached 100% (763 of 763) in the latest run.
- **It keeps other models' rules out.** With all models' rules in one `CLAUDE.md`, only 31.5% of the rule text in a request was written for that request's model, against 79.0% under noonsight.
- **The evidence is unusually careful.** Every README number maps to a committed raw file that `npm test` recomputes, and the limits are stated plainly.
- **It is low-footprint and reversible.** It has no runtime dependencies, the hooks are offline and never block, they always exit 0, and `noonsight uninstall` removes them.
- **It is very young.** It is version 0.0.1, not on npm, installed from a clone, and recently renamed from sextant. Its own fuzzer found nine delivery failures (F1 to F9) between 19 and 23 November; all are fixed, but that rate suggests more remain.
- **There is no measured quality gain.** In the 588-run pilot, tasks resolved were 133, 132 and 133 of 144 for off, noonsight and `CLAUDE.md`, at about 7% more cost with noonsight. In the rule experiment, all 600 runs passed their hidden check with or without rules.
- **What the rules do change is behaviour, at a price.** `verify-changes` got Sonnet and Haiku to run tests after a one-file fix in 29 and 27 of 30 runs, against 0 without, and roughly doubled that run's cost ($0.0240 to $0.0505 on Sonnet). `carry-through` took Sonnet from 9 to 32 of 40 on a backlog task and showed nothing on Haiku.
- **Out of the box, your Opus and Fable sessions get little.** Their preset rules for attended sessions all ship off; only headless runs and subagents receive anything by default.

**Conditions and risks**

- **You need rules that differ by model, or that must reach subagents.** If your rules are the same for every model, the tool's own docs say a `CLAUDE.md` is simpler.
- **Pin both versions.** Pin a noonsight commit and the Claude Code version, and rerun its delivery corpus before each Claude Code upgrade. It relies on an undocumented environment variable, transcript formats and behaviours read from Claude Code's bundled code, and was measured only on 2.1.328 and 2.1.330.
- **Check that your organisation allows user hooks.** `allowManagedHooksOnly` or `disableAllHooks` stops it, and on logins with server-managed settings the machine-wide install is ignored. Each person must run `noonsight install`, plus `noonsight trust` per repository.
- **Windows is not supported yet.** The hook is a POSIX shell script that has not been verified there.
- **Keep routing and the classifier off.** Neither is measured, nor are agent teams. The classifier sends the first 4,000 characters of a task to a model through your login.
- **Known gaps remain.** Workflow agents get nothing, same-type foreground subagents needing different rules get theirs late, and a compact-then-resume with no model named can get the wrong model's rules.
- **A delivery can fail silently.** The decision log records what the hook returned, not what reached the model, so spot-check with `noonsight report` and by asking a session what it received.
- **Measure your own rules.** The effect data covers only the preset's rules, on small tasks with 30 to 40 runs per arm.
- **Treat the decision log as private.** It sits in `~/.local/state/noonsight/`, and the repo's own docs say never to commit one.

**What it guarantees**

It guarantees delivery, not obedience: each session and subagent request carries the rules configured for the model it actually runs on, which rests on a fuzz benchmark of about 300 scripted sessions against a local API stand-in on two Claude Code versions, scored against noonsight's own resolver, and not on anything Claude Code itself promises.
