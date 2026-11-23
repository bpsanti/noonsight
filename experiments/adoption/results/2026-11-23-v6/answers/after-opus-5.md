**Verdict: adopt with conditions.** Run it as a time-boxed pilot on a few machines, not a team-wide rollout yet.

**Reasons**

- **It addresses a real gap for a team like yours.** You mix four models and use many subagents. In the repo's delivery benchmark, putting every model's rules in a user `CLAUDE.md` reached only 32.2% (39 of 121) of subagent requests. It never reaches the built-in Explore and Plan subagents. Where it does reach, only 18–31% of the rule text was written for the model that received it. noonsight reached 100% of subagent requests and sent each model its own rules (`README.md:30-40`, `docs/evidence.md` D10, D12).
- **The delivery testing is thorough and honest.** The authors ran 300 randomized real Claude Code sessions per run, covering `/model`, `/compact`, `/clear`, resumes, forks, plan mode and subagents. A deliberately planted bug check confirms the test catches failures. All 9 bugs the test found (F1–F9) are written up and fixed, and the latest run had 0 of 300 sessions fail (`experiments/delivery/README.md`). Every number in the README is recomputed from committed raw files by `npm test`.
- **There is no evidence yet that it improves results on real tasks.** In their own paid benchmark, 133, 132 and 133 of 144 tasks were solved with no rules, with noonsight, and with a `CLAUDE.md`. That is no measurable difference, and the authors say "This is not a claim about quality" (`experiments/benchmark/results/2026-11-19/README.md:11,119`). The positive effects they report come from small tasks with 30–40 runs each. They cover Sonnet, Haiku and Fable, not Opus (`README.md:194-207`).
- **Out of the box it does little for attended Opus and Fable sessions.** All of their rules for attended sessions ship turned off. An interactive Opus or Fable session therefore receives nothing from the preset until you enable rules (`README.md:49`). Most of the value has to come from rules your team writes.
- **The cost is modest.** In the paid benchmark, a run cost about 7% more with noonsight, against 19% more with every model's rules in a `CLAUDE.md`. Each hook takes 50–90 ms of CPU. The hooks never block anything and never use the network unless you turn on the optional classifier.

**Conditions and risks**

Conditions:
- **You need rules that really differ by model.** If your guidance is the same for every model, a `CLAUDE.md` is simpler, and the README says so itself (`README.md:238`).
- **Pin your Claude Code version and recheck on each upgrade.** The results were measured on Claude Code 2.1.328 and 2.1.330 only. The tool depends on hook details that Claude Code can change, and some are undocumented, such as the `CLAUDE_CODE_SESSION_ATTENDED` variable (`docs/verification/claude-code.md:45`). Run their test suite (`npm run delivery -- corpus`) on each Claude Code version you move to.
- **Measure the effect on your own work.** Use `noonsight report` to confirm rules are delivered. Then compare a few real tasks with and without your rules, and drop rules that change nothing.
- **Configure it for how you work.** Set `session.unattended_when_env` for your orchestrators and CI. Give Sonnet and Haiku sessions a scope. Enable the attended rules you actually want for Opus and Fable.

Risks:
- **The project is immature.** It is version 0.1, not on npm, installed by cloning a single person's GitHub repo, and was renamed recently (from "sextant"). Review the code before installing it, since `noonsight install` adds hooks to every Claude Code login on the machine.
- **There are known gaps.** A workflow's agents get no rules. Several open subagent calls of the same type can start with no rules. Plugins that noonsight does not read, such as ones your organization syncs, can give subagents the wrong model's rules. Agent teams, routing and the classifier were not tested. `/fork` does not work in sessions started with `noonsight run`.
- **The test cannot catch some errors.** It checks results against noonsight's own rule picker, so a wrong choice of rules would pass. It also used a stand-in for the API, so it shows the text arrived, not that it changed what the model did.

**What it guarantees:** It guarantees that each session and subagent gets the rules written for the model it actually runs on, and gets them again when the model changes, but not that the model follows them. That rests on randomized tests against a stand-in API on Claude Code 2.1.328 and 2.1.330, checked against noonsight's own rule picker, and on Claude Code hook behavior that is partly undocumented and can change in any release.
