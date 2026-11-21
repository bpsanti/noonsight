**Verdict: adopt with conditions.** Run it as a pilot limited to subagent-heavy and unattended work, pinned to a Claude Code version. Do not roll it out as a team-wide default yet.

I read the docs, the evidence files and the experiment results, and grepped the source for network and process use. I could not run the test suite or the tool here, so the numbers below are the repository's own, not reproduced by me.

## Reasons

- **It fits your setup.** You mix four models and start many subagents, which is the case it is built for. In its delivery benchmark a single `CLAUDE.md` holding every model's rules reached 32.2% of subagent requests (39 of 121), because it never reaches the built-in Explore and Plan subagents. noonsight reached 100% on the same 60 sessions.
- **Delivery is well measured, with caveats.** Across 300 randomised sessions, 99.5% of requests that had rules due held them (3,199 of 3,216), and 3 sessions failed. That run used Claude Code 2.1.328 against a local API stand-in, with one seed, and the "right rules" are defined by noonsight's own resolver.
- **The measured benefit is behavioural, not better outcomes.** Its paid benchmark resolved 132 of 144 tasks with it and 133 of 144 without. The rule experiments show changed behaviour (Sonnet ran tests after a precise fix in 30 of 30 runs against 0 of 30), but every run passed its hidden check either way.
- **The benefit is uneven across your models.** Sonnet and Haiku have measured effects. Fable's measured effect is shorter sentences in reports. The Opus rule was not measured at all.
- **The default preset gives ordinary interactive sessions little.** A watched session with no task scope gets nothing at start. Sonnet and Haiku get a verify rule after their first edit to a tracked code file. Watched Opus and Fable sessions get nothing, and so do Opus subagents.
- **It costs something.** Runs cost about 7% more in the benchmark, and the verify rule roughly doubled the cost of a small fix (Sonnet $0.024 to $0.051). Hook overhead is small, at 60–120 ms per event.
- **It is very young.** `package.json` says 0.0.1 and private, it is not on npm, it installs from a clone, and all the evidence dates from 14–20 November 2026. The fix for one resume bug made another case worse (one session went from 3 to 15 requests without their rules). The last two fixes have not been re-run through the 300-session test.
- **Trying it is low-risk.** The hooks always exit 0, never block a call, and the source shows no network code; the only processes started are `ps`, `git` and the opt-in classifier. There are no runtime dependencies, and `noonsight uninstall` removes only its own entries.

## Conditions and risks

**Conditions**

- **Pin Claude Code.** Use the version the evidence was measured on, and re-run its delivery corpus before each upgrade. It relies on dozens of observed hook behaviours, and 2.1.329 was already out during testing.
- **Do the setup work.** Set `session.unattended_when_env` for CI and orchestrators, and give tasks a scope with `NOONSIGHT_SCOPE` or matchers. Without both, the preset delivers little.
- **Confirm hooks are allowed.** Each person runs `noonsight install` and `noonsight trust` per repository. An organisation that sets `allowManagedHooksOnly` or `disableAllHooks` blocks it, and the machine-wide install is ignored on logins with server-managed settings. Windows is not supported.
- **Keep the shared rules in `CLAUDE.md`.** Use noonsight only for rules that differ by model, task or place, as its own docs advise.
- **Measure on your own tasks.** Drop any rule that changes nothing you can see.

**Risks**

- **The log can overstate delivery.** `noonsight report` records what the hook returned, not what reached the model. In the benchmark the log showed 100% where the stand-in saw 99.4%.
- **Resume paths are the weak spot.** Coverage after a resume without `--model` was 90.5%. One limit remains open: a conversation compacted and then resumed with nothing naming a model.
- **Some subagents are not covered.** Agent team teammates and workflow agents get nothing. Plugin and `--agents` subagents are predicted on the parent's model and may get the wrong rules, with a warning after the fact.
- **Parallel subagents can lose their rules.** Several open calls of one type that would get different rules get only the shared ones or none, and a call held more than 2 minutes on a permission prompt gets none.
- **Much is unmeasured.** That covers plan mode, forks, `/resume` inside a session, routing, the classifier, project configurations and subagents that edit files.
- **Routing has a side effect in auto mode.** It is off by default; if turned on, each routed call causes the other calls in that response to be refused and remade.
- **Preset updates change what models receive.** Set `"on_preset_change": "hold"` and review them.

## What it guarantees

noonsight guarantees only that each session and subagent is handed the rule text written for the model it runs on — not that the model follows it or that results improve. That guarantee rests on Claude Code's hook behaviour as observed on one version (2.1.328), tested against a local API stand-in.
