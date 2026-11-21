**Verdict: adopt with conditions.** Run it as a time-boxed pilot on a few machines, not as a team-wide rollout yet.

I read the README, docs, preset, changelog and committed results, and spot-checked a few claims against the raw result files and source. I could not run the test suite or the tool itself in this session.

## Reasons

- **It fits your setup.** It delivers per-model rules to sessions and subagents and re-delivers after `/model`, `/compact`, `/clear` and resumes. Its own docs say to skip it if every session runs one model.
- **Its real advantage over a `CLAUDE.md` is subagents.** On the same 60 test sequences, a `CLAUDE.md` reached 100% of main-conversation requests (527 of 527) but only 32.2% of subagent requests (39 of 121), and never the built-in Explore and Plan subagents. noonsight reached 100% of both.
- **It keeps other models' rules out.** Under noonsight 78.8% of the rule text in a request was written for that request's model, against 31.6% with a `CLAUDE.md`.
- **It is low-risk to try.** Hooks always exit 0, never block a call, and have a 10-second timeout; median hook CPU time is 60–120 ms. I found no network code in `src/`; the only processes it starts are `git`, `ps`, and `claude` (the last for the optional classifier, off by default). `noonsight uninstall` removes only its own entries.
- **The evidence is unusually honest.** Every README number maps to a committed raw file, and the limits and four fuzzer-found failures are documented.
- **It is very young.** It is version 0.0.1, not on npm (install from a clone), apparently a single author, and all measurements date from 16–20 November 2026.
- **The headline number is on an older build.** The 99.5% coverage (3,199 of 3,216 requests; 3 of 300 sessions failed) was measured before the last two fixes, and the fixed build has no committed fuzz run.
- **The benefit to your work is modest and uneven.**
  - **Out of the box:** watched Opus and Fable sessions get nothing from the preset. Sonnet and Haiku sessions get only `verify-changes`, after they edit a git-tracked code file.
  - **Strong effects:** `verify-changes` raised test runs after a small fix from 0 of 30 to 29 of 30 (Sonnet) and 27 of 30 (Haiku). Sonnet's `carry-through` raised full completion of a 13-ticket backlog from 9 of 40 to 32 of 40.
  - **Weak or none:** Haiku's `carry-through` showed no effect, and Opus's one default rule was inconclusive.
  - **Outcomes:** in the 588-run pilot, tasks resolved were the same with and without it (132 against 133 of 144), at about 7% more cost.

## Conditions and risks

Conditions:
1. **Pin both versions.** Fix a noonsight commit and a Claude Code version, and re-run its delivery corpus (`npm run delivery -- corpus`, no login or tokens needed) before each Claude Code upgrade. It was measured on 2.1.328 only.
2. **Configure it.** Otherwise most of your sessions receive nothing. Set `session.unattended_when_env` for CI and orchestrator runs, give sessions a `NOONSIGHT_SCOPE`, and add your own rules for Opus and Fable.
3. **Check your organisation's managed settings.** `allowManagedHooksOnly` or `disableAllHooks` stops the per-account install; `noonsight check` reports this.
4. **Leave routing and the classifier off.** Neither is measured. Routing in auto mode causes the other agent calls in the same response to be refused and retried, and the classifier sends task text to a model.
5. **Judge it on your own tasks.** Use `noonsight report` and drop rules that change nothing visible.

Risks:
- **Not covered:** plugin-defined subagents, agent teams, workflow agents and `--agents` definitions are not handled correctly.
- **Parallel subagents:** several of the same type that would get different rules can get none. A subagent held more than 2 minutes on a permission prompt also gets none.
- **Unknown models:** a model the preset does not declare gets a warning and no rules. In the pilot, Claude Code switched models itself (to Opus 4.8 and Sonnet 5) on one task, and those sessions got only a "rules no longer apply" note.
- **Known limit:** a conversation compacted and then resumed with nothing naming a model may get the wrong model's rules.
- **Cost:** `verify-changes` roughly doubled the cost of a tiny Sonnet fix ($0.024 to $0.0505).
- **Platform:** the hooks are a POSIX shell script; Windows is unsupported.
- **Log accuracy:** the decision log records what the hook returned, not what reached the model.

## What it guarantees

noonsight guarantees only that each session and subagent is handed the rule text for the model it actually runs on — not that the model obeys it — and that rests on a fuzz benchmark of 300 simulated sessions against a stub API on one Claude Code version, with noonsight's own resolver as the reference.
