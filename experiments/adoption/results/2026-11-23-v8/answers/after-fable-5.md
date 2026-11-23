**Verdict: adopt with conditions.** Run it as a time-boxed pilot with a few people and rules you write yourselves, not as a team-wide rollout.

I read the docs, the evidence map, the experiment summaries and the preset, and skimmed the source. I could not run the tests or benchmarks from here, so every number below is the repository's own.

**Reasons**

- **It fits your setup.** It delivers per-model rules to sessions and subagents through Claude Code's own hooks. In its delivery benchmark on Claude Code 2.1.330, all 3,090 requests with rules due held them, including all 763 subagent requests.
- **The native alternative fails where you would feel it.** A `CLAUDE.md` holding every model's rules reached 100% of main-conversation requests but only 46.9% of subagent requests (60 of 128), because Explore and Plan subagents never get it. Every model also reads the other models' rules.
- **No better task outcomes were shown.** On the paid pilot of public tasks, 133 of 144 runs passed without rules, 132 with noonsight and 133 with a `CLAUDE.md`. In the 600-run rule experiment, every run passed its hidden check with or without rules.
- **The measured effects are narrow.**
  - `verify-changes` got Sonnet and Haiku to run the tests after a small fix (30/30 and 27/30 against 0/30), at about 58% more cost per run.
  - Sonnet's `carry-through` raised full completion of a backlog with an open decision from 9 of 40 to 32 of 40.
  - Fable's report rule shortened sentences.
  - Haiku's `carry-through` showed nothing, and the one Opus rule that ships on was inconclusive.
- **The preset gives your Opus and Fable sessions almost nothing.** Attended Opus and Fable sessions receive no rules by default. Opus subagents receive none, and Fable subagents receive only the report-style rule unless a scope is set.
- **It is very young.** It is version 0.0.1, not on npm, installed from a clone, with every result dated within the last week or so. Its own benchmark found nine delivery bugs in that time, all fixed.
- **The engineering is careful and honest about its limits.** It has no runtime dependencies, and the docs say the hooks never block a call and never use the network. Every claim is traced to a raw file, and uninstall is clean. A quick search of the source found no network calls.

**Conditions and risks**

- **Write your own rules.** The value for you is your own per-model rules reaching subagents; keep rules common to all models in `CLAUDE.md`.
- **Check that hooks are allowed.** If your organization's managed settings turn user hooks off, it cannot work; `noonsight check` reports this.
- **Pin Claude Code versions.** It relies on undocumented behaviour (an undocumented environment variable, transcript contents, reading the parent process's arguments). Re-run its delivery corpus before each Claude Code upgrade.
- **Set scopes or accept dormant rules.** Most scoped rules never fire unless you set `NOONSIGHT_SCOPE`, declare matchers, or turn on the classifier, which sends task text to a small model.
- **Expect gaps.** Workflow agents get nothing, and agent teams, routing and the classifier are unmeasured. A new or fallback model gets no rules until declared.
- **Budget for cost.** The pilot showed about 7% more per run ($0.155 against $0.145), and each hook run adds 80 to 150 ms.
- **Per-person setup.** Each person installs it themselves and runs `noonsight trust` once per repository. Windows is not supported for the machine-wide install.
- **Measure before widening.** Compare your own tasks with and without your rules, and drop it if nothing changes.

**What it guarantees**

It guarantees only that each request carries the rules configured for the model it runs on, not that the model follows them. That rests on one benchmark run of 299 scripted sessions on Claude Code 2.1.330 against a stand-in API, scored against noonsight's own resolver.
