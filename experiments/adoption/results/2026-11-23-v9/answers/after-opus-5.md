**Verdict: adopt with conditions.** Run it as a limited pilot, not a team-wide rollout.

**Reasons**

1. **It fixes a real gap in how we work.** We mix models and use subagents a lot, and that is where the built-in options fall short. Putting every model's rules in a user `CLAUDE.md` reached the main conversation every time, but only 46.9% (60 of 128) of subagent requests. It never reaches the built-in Explore and Plan subagents. It also gives every model the other models' rules: 619 requests held another model's rules that nothing marked as not applying. A skill per model reached 0%. Under noonsight, 100% of requests that were due rules got them (3,090 of 3,090), including all 763 subagent requests.
2. **The numbers can be checked, and the ones I checked hold up.** Each figure links to a raw result file with its date and Claude Code version, and the tests recompute it. I opened the raw summary for the headline run myself, and it matches (299 of 300 sessions finished; due 3,090, covered 3,090; subagents 763 of 763). The README also lists what it doesn't do.
3. **Getting rules delivered is not the same as getting better results, and the tool says so.** In a paid pilot, tasks passed 133 of 144 times with no rules, 132 under noonsight and 133 with a `CLAUDE.md`. Only three of its 16 starter rules showed an effect on their own, all on small tasks: `verify-changes` (Sonnet, Haiku), `carry-through` (Sonnet) and `low-context-report` (Fable). No Opus rule has a measured effect.
4. **The rules that work cost money.** On a one-file fix, `verify-changes` roughly doubled Sonnet's cost per run ($0.0240 → $0.0505) and Haiku's ($0.0015 → $0.0033).
5. **Out of the box it does nothing for half our interactive sessions.** The starter rules for Opus and Fable in sessions someone is watching ship turned off. Those sessions get nothing until we turn rules on. Sonnet and Haiku need a task label (`NOONSIGHT_SCOPE`) to get most of theirs.
6. **It's very new and depends on details Claude Code doesn't document.** It's version 0.1.0, and all its evidence is from 14–23 November 2026. The delivery results were measured on Claude Code 2.1.330 only. Fork handling, detecting unwatched sessions and matching subagents to their calls all rely on undocumented internals. The benchmark found nine delivery bugs (F1–F9) in about a week; all are fixed, but that shows how much Claude Code updates can break.

**Conditions and risks**

Conditions:
- **Write our own rules.** Only adopt if we have instructions that really should differ by model or task type. Rules every model should follow stay in `CLAUDE.md`, as the README itself advises.
- **Install it properly.** Use `npm install -g` plus `noonsight install`, not `npx`; the `npx` copy stops working when npm's cache is cleared.
- **Pin and re-check Claude Code.** Pin the version, and after each upgrade run `noonsight check` and look at `noonsight report` before rolling it out.
- **Keep routing and the classifier off** (both are off by default). Routing rewrites subagent calls and by default approves them without a permission prompt. The classifier sends the first 4,000 characters of a task to a model.
- **Mark unwatched sessions.** Set `session.unattended_when_env` to the variable our CI or orchestrator sets, so those sessions get the unattended rules.
- **Measure our own rules.** A custom rule has no measured effect until we test it. Drop any rule that changes nothing we can see.

Risks, or where delivery silently fails:
- Workflow agents get nothing.
- Agent-team teammates in split panes were never checked.
- Subagents from plugins it doesn't read, such as ones an organization syncs, are assumed to run on their parent's model.
- Several subagents of the same type that need different rules can get none until their first Edit, Write or agent call.
- The model can't be determined under `default` or `opusplan`, or on Bedrock/Vertex/Foundry without the model-pinning variables. Those sessions get a warning instead of rules.
- The trigger misses edits made through the shell (e.g. `sed -i`).
- `/fork` doesn't work in sessions started with `noonsight run` and rules.
- Each hook takes about 80–150 ms of CPU (a reading from a busy laptop, so likely high). That cost lands on every session start, model switch, agent call and early edit.
- The delivery benchmark used a stand-in for the API, so no model answered. It checked delivery against noonsight's own rule picker, so a wrong choice of rules wouldn't have shown.

**What it guarantees**

It guarantees delivery, not obedience: the rules declared for a model reach the context of each session and subagent running on that model, and are sent again when the model changes or the conversation is compacted, cleared, resumed or forked. That rests on how Claude Code's hooks behaved on version 2.1.330 (partly undocumented) and on 299 real interactive sessions against a stand-in API, with the exceptions listed above.
