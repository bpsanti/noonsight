**Verdict: adopt with conditions.** Run it as a pilot on a few machines with pinned Claude Code versions, not as a team-wide install yet.

**Reasons**

- **It solves a problem you actually have.** You run four models, and many sessions start subagents. The usual way of giving instructions doesn't handle that well. In the tool's own benchmark, a user `CLAUDE.md` holding every model's rules reached only 32.2% of subagent requests (39 of 121), and it never reaches the built-in Explore and Plan subagents. It also hands each model the other models' rules: only 31.5% of the rule text in a request was meant for that request's model, against 79.0% under noonsight. This is a real gap, and noonsight addresses it directly (`README.md:30-40`).
- **The evidence is unusually careful.** Every number links to a raw result file, and `npm test` recomputes it (`docs/evidence.md`). The benchmark found nine of the tool's own bugs (F1–F9), each kept as a reproduction that must keep passing. A self-check plants bugs to show the fuzzer catches them. Limits are written down rather than hidden (`experiments/delivery/README.md:211-270`).
- **It is low-risk when it fails.** The hooks never block or deny anything and never use the network; the optional classifier is the one exception. Each hook takes about 50–90 ms of CPU. You can turn it off per session with `NOONSIGHT_DISABLE=1` or remove it with `noonsight uninstall`.
- **But it is very young and depends on how Claude Code behaves inside.** It's version 0.1, not on npm, and installed from a clone. Bugs F5–F9 were fixed on 2026-11-23, today, and those fixes are still unreleased (`CHANGELOG.md:3`). It depends on behavior Claude Code doesn't document: the `CLAUDE_CODE_SESSION_ATTENDED` variable, transcript and `.meta.json` layouts, reading `ps` output for `--model`, and how `SessionStart` context is deduplicated (`docs/verification/claude-code.md`). All of it was checked only on Claude Code 2.1.325–2.1.330.
- **The headline 0-of-300 result is weaker than it looks.** It uses seed 1, the same seed whose sessions exposed F7–F9 before they were fixed (`experiments/delivery/README.md:255`). Fixes were confirmed on the same sequences that found the bugs, and no fresh seed is reported. The earlier generator-1 run, with the sequences it was not tuned on, still had 1 failing session in 300.
- **The default preset does little for your team's most common session.** In an attended session, Opus 5.5 and Fable 5.2 get nothing, because all their rules for that place ship off. Sonnet and Haiku get only `verify-changes`, and only after a code edit, unless someone sets a scope (`README.md:47-53`). Most of the value has to come from rules you write yourselves.
- **The effect of the rules is measured only a little.** Opus 5.5 was never tested in the rule-effect experiment, which covered Fable, Sonnet and Haiku. The tasks were small, with 30–40 runs per arm. Rules also cost money: `verify-changes` roughly doubled Sonnet's cost on a small fix ($0.0240 to $0.0505).

**Conditions and risks**

What would have to hold:
- Pin Claude Code to a version the tool was verified on. Before each upgrade, rerun `npm run test:live` and the delivery corpus (`npm run delivery -- corpus`). A changed hook behaviour could stop delivery quietly.
- Install from a reviewed commit that includes the F5–F9 fixes.
- Decide what the rules are for. Write your own per-model rules, turn on the Opus and Fable attended rules you want with `enable`, and give sessions a scope where it matters. Keep rules that apply to every model in `CLAUDE.md`.
- Set `session.unattended_when_env` for any orchestrator or CI that starts interactive sessions nobody watches.
- Check delivery with `noonsight report`, and measure whether a rule changes anything before keeping it.
- If you run Claude Code through Bedrock, Vertex or Foundry, or use the `default` or `opusplan` model settings, check model detection first. The tool says it can't tell which model those settings pick.

What could go wrong:
- A Claude Code update changes hook inputs or transcripts, and rules go missing or the wrong model's rules arrive. The decision log only records what the hook returned, so it would not show this.
- Paths that were never measured: agent teams, routing, the classifier and workflows. A workflow's agents get nothing.
- Subagents from plugins your organization syncs get rules predicted from their parent's model.
- Several foreground subagent calls of one type that need different rules get nothing until their first edit or agent call.
- `/fork` doesn't work in sessions started with `noonsight run`.
- A compacted conversation that is resumed without naming a model may get the wrong rules.
- `noonsight install` edits the settings of every Claude Code login on the account.
- Rules raise token costs.
- It all depends on one maintainer's repository.

**What it guarantees:** Each session and subagent receives its own model's rules as context, and not other models' rules unless a note retires them, but not that the model follows them. That rests on a benchmark run against a local stand-in for the API on Claude Code 2.1.328 and 2.1.330, on the same seed used to find the bugs it fixed, and on undocumented Claude Code behaviour that any update could change.
