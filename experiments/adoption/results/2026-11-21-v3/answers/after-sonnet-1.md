Verdict: adopt with conditions, as a pilot, not a team-wide rollout.

**Reasons**
- **It fits how you work.** Your team mixes Opus, Sonnet, Haiku and Fable and starts many subagents. That is the case where `CLAUDE.md` falls short. In the delivery benchmark, a user `CLAUDE.md` reached only 32.2% (39 of 121) of subagent requests, and 0% of Explore and Plan requests. `.claude/rules` did the same. A skill per model reached none of the requests, because it contributes only its description until the model opens it (D6–D11).
- **The delivery claim is measured, not asserted.**
  - 300 random sessions covered `/model`, `/compact`, `/clear`, resumes, subagents and edits. 99.5% (3,199 of 3,216) of requests with rules due had them, and subagent coverage was 99.9% (D2, D3).
  - The raw result files are committed. `npm test` recomputes every README number from them.
  - The author reports four defects the fuzzer found (F1–F4) and a documented limit, rather than hiding them.
- **Each model gets mostly its own rules.** Own-model rule text is 78.8% of rule text under noonsight, against 31.6% for `CLAUDE.md` and 27.1% for `.claude/rules` (D12). It adds fewer characters per request: 1,154 against about 4,000–4,400 (D13).
- **Low-risk design.** The hooks never block anything and use no network. The classifier is off by default. Install and uninstall are documented, and `NOONSIGHT_DISABLE=1` turns it off per session. There are no runtime dependencies, and `noonsight report` and `resolve` let you audit what was delivered.
- **The rule effects are real on some tasks and absent on others.**
  - `verify-changes` made Sonnet and Haiku run tests after a fix in 29 of 30 and 27 of 30 runs, against 0 of 30 without it (R1, R3).
  - Sonnet's `carry-through` raised complete backlog runs from 9 of 40 to 32 of 40 (R10).
  - Where models already did the work, rules changed nothing and cost a little more. `verify-changes` roughly doubled the cost of a cheap task, from $0.0240 to $0.0505 on Sonnet (R6).

**Conditions and risks**
- **The measurement is not of your setup.**
  - It ran against a local stand-in for the API, so no real model saw anything. The stub never edits files in subagents and never compacts by itself.
  - Not measured: `/resume` inside a session, forks, plan mode, agent teams, `noonsight run`, routing, the classifier, and project configurations. Check any of these you rely on in a pilot with `noonsight report`.
- **The headline rate predates two fixes.**
  - The 3 failing sessions came from F3 and F4. Those fixes landed after the run and the 300 sessions have not been rerun, so the committed 99.5% describes the earlier build.
  - The README's "no other model's rules left unretired" is stronger than D14. It shows 22 requests under noonsight that held another model's rule with no retiring note.
  - Re-run `npm run delivery -- fuzz --n 300` on the build you adopt.
- **It is tied to the Claude Code version.**
  - Delivery was measured on 2.1.328. The live checks span 2.1.325–2.1.329.
  - It relies on hook behavior that Claude Code can change, such as what a resume's `SessionStart` returns and how `/model` is applied.
  - Pin the version, re-run the corpus (`npm run delivery -- corpus`) and `npm run test:live` on each upgrade, and run `noonsight check` regularly.
- **Known gap.** A conversation that was compacted, has had no response since, and is resumed without a model flag runs on Claude Code's default model. noonsight can't tell which model that is, so it may deliver the wrong rules.
- **Default setup delivers little.**
  - A watched session with no scope gets nothing from the preset. You must set `session.unattended_when_env` and give tasks a scope (`NOONSIGHT_SCOPE`).
  - A model with no entry gets a warning and no rules, so declare all four models. Fable and Haiku coverage of the rules' effects is thin: Fable has one word-count result (R9), and Haiku's `carry-through` showed nothing (R11).
- **Delivery is not obedience, and the effect evidence is thin.** A delivered rule is only context. The effect tests are small tasks with 30–40 runs per arm. Measure on your own tasks and drop rules that change nothing you can see.
- **Maturity.**
  - Version 0.1 is not on npm and installs from a git clone with `npm link`. It is a single-author project and was renamed from "sextant".
  - `noonsight install` edits every Claude Code login's `settings.json`. Pilot on a few accounts first, and review the code you are installing as hooks.
  - If your organization manages Claude Code settings, check that user hooks are allowed.
- **Per-run cost.** Each hook run takes 60–120 ms of CPU (D15), and rules that change behavior add model usage.
- **When not to adopt.** If every session ran one model with fixed rules, a `CLAUDE.md` would do the job, as the tool's own docs say.

**What it guarantees**
It guarantees that, on the tested Claude Code version, the rules written for a request's model reach that request, including subagents, with only a small chance of leftover rules from other models. That rests on a committed fuzz run of 300 real interactive sessions against a stand-in API (99.5% coverage), plus hook-behavior checks pinned per Claude Code version. It does not guarantee that a model follows the rules, and it has not been measured against real model traffic.
