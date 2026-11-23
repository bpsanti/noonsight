**Verdict: adopt with conditions.** Run it as a pilot on a pinned setup, not as a team-wide default yet.

**Reasons**

- **It solves a problem you have.** You run four models and use many subagents, which is exactly where the built-in options fail. In the author's benchmark on Claude Code 2.1.330, a user `CLAUDE.md` holding every model's rules reached only 46.9% of subagent requests (60 of 128). It never reaches the built-in Explore and Plan subagents. And only 32.6% of the rule text in a request was written for the model handling it. noonsight scored 100% on subagent requests (763 of 763), and no request held another model's rules without a note saying they no longer apply (0 such requests, against 619 for `CLAUDE.md`).
- **The evidence is unusually easy to check.** Every number links to a committed raw file, and the tests recompute it. I opened `summary.json` and its headline numbers match the README: 300 sessions, 299 completed, 3,090 of 3,090 requests covered. The benchmark found nine of its own bugs (F1–F9), and each is kept as a reproduction that has to keep passing.
- **The proven benefit is small.** On public coding tasks, a paid pilot found no measurable difference: 133 of 144 runs passed without rules, 132 under noonsight, and 133 with one `CLAUDE.md`. The one strong effect is `verify-changes`: Sonnet ran the tests after a fix in 29 of 30 runs instead of 0, but the cost of a run roughly doubled ($0.024 → $0.0505). `carry-through` helped Sonnet on a backlog task (32 of 40 runs finished every part, against 9 of 40); the same rule did nothing measurable for Haiku. Opus 5.5 has no measured rule effect at all. Fable's only measured effect is shorter sentences in its final reports.
- **Opus and Fable sessions get nothing from the preset at first.** Every preset rule for an Opus or Fable session with someone watching ships turned off, so those sessions receive nothing until you turn rules on or write your own. What you would really be adopting is the delivery mechanism, not the preset.
- **The project is very young.** It is version 0.1, not on npm, and installed from a clone with `npm link`. All the evidence was produced between Nov 16 and 23, 2026, and the current benchmark run is dated today. It was recently renamed from "sextant". It reads as one author's work, and the author is also the one doing all the testing.

**Conditions and risks**

Conditions:
- **Pin versions.** Pin both the noonsight commit and the Claude Code version, which should be 2.1.330 or one you have checked yourself. Before each Claude Code upgrade, rerun the failure reproductions. They use a local fake API, so they spend no tokens. The guarantee is measured "on one Claude Code version at a time", and the tool depends on several Claude Code behaviours that aren't officially documented and were observed on 2.1.330. Examples: how forks name the original conversation, the `CLAUDE_CODE_SESSION_ATTENDED` variable, and the `toolUseId` in subagent metadata. A Claude Code update could quietly break delivery.
- **Review the code before installing.** `noonsight install` adds hooks to every Claude Code login on each person's account, and those hooks run on every session and every agent call.
- **Write your own per-model rules.** Delivery only pays off if a rule actually differs by model and changes something you can see. Check `noonsight report` and drop rules that do nothing. The README itself says to stay with `CLAUDE.md` when every session uses one model with fixed rules.
- **Configure it for headless use.** Set `session.unattended_when_env` to your CI's or orchestrator's environment variable, so interactive sessions nobody watches get the unattended rules. Give sessions a scope with `NOONSIGHT_SCOPE`, or most scoped rules never fire.
- **Use the Anthropic API, or pin aliases.** On Bedrock, Vertex or Foundry, aliases like `sonnet` resolve to different models, so you need the `ANTHROPIC_DEFAULT_*_MODEL` variables or the tool only warns. `default` and `opusplan` can't be resolved at all.

Risks:
- **Known gaps.** A workflow's subagents get nothing. Agent teams in split panes were never checked. Subagents from plugins your organisation syncs are assumed to run on their parent's model. Edits made through the shell don't count as code edits. Routing and the classifier were never measured.
- **The test is weaker than it looks.**
  - No real model ever answered. The sessions were real Claude Code, but the API was a local stand-in.
  - The "right rules" come from noonsight's own resolver, so a resolver bug wouldn't show up.
  - The random sessions cover only the cases its generator draws.
- **Small costs.** Each hook takes about 80–150 ms of CPU, measured on a busy laptop. `verify-changes` raises spend. `/fork` doesn't work in sessions started with `noonsight run`.

**What it guarantees**

It guarantees delivery only: each request, from a session or a subagent, carries the rules for the model actually handling it, and any other model's rules come with a note saying they no longer apply. That rests on 299 randomized sessions of real Claude Code 2.1.330 against a fake API, judged by noonsight's own resolver, and on undocumented hook behaviour of that version. It is a measurement, not a proof, and it says nothing about whether the model follows the rules.
