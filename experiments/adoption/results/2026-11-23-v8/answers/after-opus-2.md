**Verdict: adopt with conditions.** Run it as a time-boxed pilot on a pinned Claude Code version, not a team-wide rollout yet.

**Reasons**

- **It fits how you work.** You run four models and many subagents, and that is where the usual options fall short. In the authors' current run (Claude Code 2.1.330), a user `CLAUDE.md` with every model's rules reached only 46.9% (60 of 128) of subagent requests. It never reaches the built-in Explore and Plan subagents. noonsight reached 100% (763 of 763). Each model also gets only its own rules: no request had another model's rule left in place, against 619 requests with a `CLAUDE.md` (`docs/evidence.md` D20, D28, D32).
- **The delivery evidence is unusually thorough.** It comes from real interactive Claude Code sessions covering `/model`, `/compact`, `/clear`, resumes, forks, plan mode and subagents. It includes a fuzzer, failure cases reduced to minimal repros, and planted-bug self-checks. Every number traces to a committed raw file, and `npm test` recomputes it. The benchmark found nine real failures (F1–F9), and all were fixed and kept as regression cases (`experiments/delivery/README.md`).
- **There's little evidence the rules improve results.** On public tasks the paid pilot saw no measurable difference: 133, 132 and 133 of 144 runs passed with no rules, under noonsight, and with a `CLAUDE.md` (B1). Measured effects exist only on small tasks with 30–40 runs per arm. For example, `verify-changes` made Sonnet and Haiku run tests (R14), but it also roughly doubled the cost of a small fix (R6). The case for adopting is reliable per-model delivery of rules you already believe in, not better output.
- **The defaults do little for your Opus and Fable users.** In attended sessions, the preset's rules for those two models ship off, so those sessions get nothing until you turn rules on with `enable` (README, "What it does not guarantee").
- **It's immature.** It's version 0.1, not on npm, and installed from a git clone with `npm link`. `noonsight install` adds hooks to every Claude Code login on the account.

**Conditions and risks**

Conditions:
- **Pin Claude Code.** Delivery was measured only on 2.1.330, and the README warns that Claude Code changes how hooks behave. Before each upgrade, run the corpus (`npm run delivery -- corpus`).
- **Write your own rules** for what actually differs by model, and measure them. The preset is a starting set, and a rule of your own has no measured effect until you test it.
- **Set the inputs it needs.** Set `session.unattended_when_env` for orchestrated sessions, and give Sonnet and Haiku sessions a scope (`NOONSIGHT_SCOPE`). Without these, many rules never fire.
- **Check what's delivered.** Use `noonsight report` and `noonsight check` during the pilot. Drop any rule that changes nothing you can see.

Risks:
- **Known gaps for subagents:**
  - Workflow agents get nothing.
  - When one response starts several subagents of the same type that need different rules, they get nothing until their first Edit, Write or agent call.
  - Subagents from plugins noonsight doesn't read are assumed to run on their parent's model.
  - Agent teams, routing and the classifier were not measured.
  - With `default` or `opusplan` as the model setting, noonsight can't tell which model is running.
- **`/fork` breaks** in sessions started through `noonsight run`.
- **Cost:** each hook run takes roughly 80–150 ms of CPU on a loaded laptop (D33). The rules themselves add tokens and can raise the cost of a run.
- **The evidence is all from the authors.** The benchmark checks against noonsight's own resolver, so a wrong resolution wouldn't show up. Its stand-in API makes few requests per subagent and never compacts on its own, unlike a real long session. It was one seed on one macOS laptop. The core claim rests on 299 sessions.
- **Single maintainer and a young project** (it was renamed from sextant), so there's a bus-factor and maintenance risk.

**What it guarantees:** Only delivery, not obedience: each session and subagent receives its own model's rules and no stale ones from other models. That rests on the authors' own benchmark of 299 stubbed sessions on Claude Code 2.1.330 with the preset, checked against noonsight's own resolver, and it holds only on that version and within the documented gaps above.

I read the docs, the evidence map and the current run's results, and spot-checked the hooks code. I didn't build the tool, run its tests, or recompute the numbers.
