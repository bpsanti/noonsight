**Verdict: adopt with conditions.** Run it as a pilot on a few machines, with rules you write yourselves, not as a team-wide default yet.

I read the README, docs, changelog, CI file and committed result summaries, and spot-checked the headline numbers against the raw `summary.json`. I could not build it or run its tests in this session, and this copy is not a git repository, so the commits it cites are unchecked.

**Reasons**

- **It fits your setup.** Its own "when not to use" list rules out single-model teams; you run four models and many subagents, which is the case it is built for.
- **It closes a real gap for subagents.** In its benchmark, a shared `CLAUDE.md` reached every main-conversation request (526 of 526) but only 32% of subagent requests (39 of 121), because the built-in Explore and Plan subagents never load it. noonsight reached 763 of 763.
- **It keeps other models' rules out.** Under a shared `CLAUDE.md`, only about 31% of the rule text a request carried was written for that request's model; under noonsight it was 79%.
- **The evidence is unusually honest.** Every number traces to a committed result file, the limits are listed, and its own fuzzer found nine delivery bugs (F1–F9) that are fixed with regression cases.
- **No measured effect on results.** Its own paid pilot resolved 133, 132 and 133 of 144 tasks without it, with it, and with a `CLAUDE.md`; runs with it cost about 7% more than runs with no rules.
- **Individual rules do change behaviour, at a price.** `verify-changes` made Sonnet run tests after a fix in 29 of 30 runs against 0 of 30, and roughly doubled that small run's cost ($0.024 to $0.051). These are small tasks with 30–40 runs per arm.
- **Out of the box it does little for your Opus and Fable users.** The preset's rules for attended Opus 5.5 and Fable 5.2 sessions all ship off, so those interactive sessions receive nothing until you enable rules or add your own.
- **It is pre-release.** `package.json` says 0.0.1 and private, it is not on npm, you install from a clone, and the whole changelog is "Unreleased". Five of the nine bugs were found in the latest run, dated today.
- **Low supply-chain risk.** It has no runtime dependencies, and I found no network code in `src`; the only outbound path is the optional classifier, which is off by default.

**Conditions and risks**

- **Pin Claude Code versions.** It relies on undocumented Claude Code internals and is verified on one version at a time (latest 2.1.330, while CI still pins 2.1.325). Rerun its delivery corpus before each Claude Code upgrade; a silent break means missing or wrong-model rules.
- **Write your own per-model rules.** The value for you is in rules you write and measure on your own tasks; the delivery claim covers any rule, but the measured effects cover only the preset's.
- **Check that hooks are allowed.** If your organisation's managed settings set `allowManagedHooksOnly` or `disableAllHooks`, the default install does nothing. Each person must run `noonsight install`, and `noonsight trust` once per repository with shared rules.
- **Do not use it for rules that must hold.** A delivered rule is context the model may ignore; use permission rules or blocking hooks for those.
- **Know the unmeasured paths.** Agent teams, routing and the classifier are not measured, and workflow agents get nothing. Sessions on `opusplan` or `default`, or on Bedrock, Vertex or Foundry without pinned aliases, get a warning instead of a resolved model.
- **The benchmark has limits.** It used a stub API with fixed replies, one seed and one machine, and the reference is noonsight's own resolver, so a wrong resolution would not show.
- **Operational cost.** Seven hook entries go into every login's `settings.json`. Each hook run is a Node process of about 50–90 ms CPU, and it keeps a local decision log with session ids and file paths.
- **Bus factor.** It appears to be a single-author project that was renamed recently (from sextant); plan for maintaining a fork or uninstalling.

**What it guarantees**

Not obedience and not better results, only delivery: each session and subagent receives the rule text configured for the model it actually runs on. That rests on a stub-API benchmark of 300 random sessions on Claude Code 2.1.330 (3,090 of 3,090 due requests covered), valid only for that version and the paths the benchmark drew.
