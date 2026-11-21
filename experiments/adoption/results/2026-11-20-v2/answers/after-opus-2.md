**Verdict: adopt with conditions.** Run it as a limited pilot, not a rollout to the whole team. The tool does what it says it does, and your setup (four models, many subagents) is the case it was built for. But the main gain its own data shows is that models run the tests more often. Its end-to-end benchmark found no improvement in task outcomes, and out of the box it delivers almost nothing to interactive sessions.

**Reasons**

- **Rule delivery is well measured and beats the built-in options for your setup.** In 300 random real Claude Code sessions run against a local stand-in for the API, 99.5% (3,199 of 3,216) of requests got their model's rules, and 99.9% of subagent requests did (`docs/evidence.md` D2, D3). With every model's rules in a `CLAUDE.md`, only 32.2% of subagent requests got them, because the built-in Explore and Plan subagents never read `CLAUDE.md` (D10). Since your team uses subagents heavily, this is the strongest argument for the tool.
- **Each model gets less text meant for other models.** About 79% of the rule text in a request was written for that request's model, against about 32% with a shared `CLAUDE.md` (D12). It also adds about a quarter of the characters per request (1,154 against 4,414, D13).
- **The behaviour change is real but narrow and costs money.** The `verify-changes` rule made Sonnet and Haiku run the tests after a fix in 30 of 30 and 27 of 30 runs, against 0 of 30 without it (R1). It also roughly doubled the cost of a cheap task (R6: Sonnet went from $0.024 to $0.0505 per run). Sonnet's `carry-through` rule helped on a long backlog task (32 of 40 runs finished every part, against 9 of 40); Haiku's showed nothing (R10, R11). The samples are small, 30 to 40 runs per arm.
- **The end-to-end benchmark shows no gain.** The tool's own paid benchmark resolved 132 of 144 tasks with it and 133 of 144 without, and cost about 7% more per run (`experiments/benchmark/results/2026-11-19/summary.md`). The judged written answers scored the same or slightly lower (0.68 against 0.72).
- **Out of the box, interactive sessions get almost nothing.** For a session someone is watching, the preset only delivers rules when a task scope is set (`NOONSIGHT_SCOPE` or match patterns). Rules for unattended runs only apply when you tell it which environment variable marks a run as unattended (`docs/usage.md:106-111`). Opus has a single rule turned on, and it applies only to unattended runs (`presets/claude/preset.json:184`). An Opus user working interactively gets nothing unless you configure more.
- **It is early and fragile.** It is version 0.1, not published on npm, and installed from a clone. Its fuzz testing found four bugs in a week (F1–F4). F3 and F4 were fixed after the measured run, and the 300-session run has not been repeated on the fixed build (`README.md:20-22`).

**Conditions and risks**

- **Conditions:**
  - Pin your Claude Code version and re-run `noonsight check` and its corpus tests whenever you upgrade. It depends on undocumented hook behaviour checked only on 2.1.325–2.1.328 (`docs/verification/claude-code.md`), and one fact, that a model reads context returned by its startup hooks, is marked "Not yet run".
  - Set up scopes and `session.unattended_when_env` before you judge it; otherwise you are measuring an almost empty preset.
  - Keep rules that every model should follow in `CLAUDE.md`. Put only rules that differ by model, task type or place in noonsight.
  - Leave routing and the classifier off at first. Routing changes which model and effort a task runs on. The classifier is the only part that touches the network: it sends the first 4,000 characters of each task to a model through your login.
  - Run a pilot on your own tasks and use `noonsight report` to see what was delivered. Drop rules that cost money without a visible change.
- **Risks:**
  - **Rules not reaching the model, with nothing to warn you.** Some situations were never tested: `/resume` inside a session, forks, plan mode, agent teams, project configurations, and subagents that edit files (`experiments/delivery/README.md:197`).
  - **Parallel subagents can get no rules.** If one response starts several subagents of the same type that need different rules, none of them gets rules (documented limit).
  - **The log can be wrong.** It records what the hook returned, not what reached the model. Bug F1 showed it recording deliveries that never happened.
  - **Auto mode.** With routing on, one routed subagent call can cause the other calls in the same response to be refused (`docs/verification/claude-code.md:46`).
  - **Automatic fallback to other models.** In the benchmark, sessions switched on their own to models the preset doesn't cover (claude-opus-4-8, claude-sonnet-5). noonsight only sent a note withdrawing the previous model's rules; the fallback model got no rules of its own.
  - **Your login settings get edited.** The installer adds hooks to every Claude Code login on your account. It is reversible with `noonsight uninstall`.
  - **Teams/Enterprise policies.** If your organisation's managed settings forbid user hooks, it won't work at all.
  - **Billing.** The live tests send real requests to Fable, which can draw on usage credits without asking.

**What it guarantees:** It guarantees only that each session and subagent receives its current model's rules as context, not that the model follows them; that guarantee rests on Claude Code hook behaviour verified on versions 2.1.325–2.1.328 and a benchmark against a stand-in API that measured 99.5% delivery before the last two fixes.
