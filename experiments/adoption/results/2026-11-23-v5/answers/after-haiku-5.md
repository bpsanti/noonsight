**Verdict: adopt with conditions.** Run it as a pilot on Sonnet and Haiku sessions and subagents first, and widen it only after you've checked it on your own Claude Code version.

**Reasons**

- It targets your exact problem. It delivers each model's rules to each session and subagent, and re-delivers them after `/model`, `/compact`, `/clear`, resumes, forks and plan mode. In the 2.1.330 delivery run, the native alternatives covered far fewer requests: `CLAUDE.md` covered 88.2% and `.claude/rules` 76.3%, against 100% for noonsight. Subagent coverage was 46.9% for both native options, against 100%. ([experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/README.md](experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/README.md), [docs/evidence.md](docs/evidence.md))
- The post-fix run is clean. After fixes for F5 to F9, 0 of 300 sessions broke the invariant, and 453 of 453 requests on the newly covered paths held their rules. The README's headline 99.9% comes from the earlier run and predates those fixes.
- It doesn't touch the network or block anything. The hooks are local and never block. The one exception is the classifier, which is off by default. Your team's sessions stay local unless you turn it on.
- The rule-effect evidence is real but narrow. On Sonnet, `verify-changes` alone made the model run tests after a one-file fix in 29 of 30 runs, against 0 of 30 without rules. The Sonnet `carry-through` rule raised full completion on a long triage task from 9 of 40 to 32 of 40. Haiku's `carry-through` showed no significant effect (6 of 40 against 2 of 40, p = 0.26).
- It is measured by its own author, and the README says so. The benchmark used a stand-in API, so no request reached a model. The results are for one Claude Code version at a time.

**Conditions and risks**

Conditions for it to work for you:

1. **Pin your Claude Code version and rerun the benchmark on it.** Measurements exist only for 2.1.328 (pre-fix) and 2.1.330, and the README says hooks can change between versions. Run `npm test` and the delivery benchmark on your version before rollout.
2. **Set `session.unattended_when_env`** to your CI or orchestrator variable. Otherwise headless runs get the unattended rules by default, and some interactive sessions may be treated as attended when nobody is watching.
3. **Know what the preset gives an attended Opus or Fable session: nothing, until you enable it.** Opus's and Fable's attended rules ship off. Most of the preset is written for attended sessions, so for interactive Opus and Fable work you have to enable rules deliberately with `enable`. Fable and Opus rules also never fired in the rule-effect experiment, so their effect is unmeasured.
4. **Review repository rule files as code.** A committed `.noonsight/noonsight.json` changes what a model is told, and nothing applies until each person runs `noonsight trust`. Treat rule-file changes as a review item.
5. **Install from a pinned clone.** Version 0.1 is not on npm yet, so install with `npm install && npm run build && npm link` from a fixed commit.
6. **Leave the classifier off** unless someone on the team approves sending the first 4,000 characters of each task to a model.

Risks:

- **Rules cost money.** `verify-changes` doubled one Sonnet run's cost, from $0.024 to $0.0505, and it did nothing on Haiku's `carry-through`. Measure cost per rule before enabling it everywhere.
- **Known gaps:** a workflow's agents receive nothing; plugin-synced subagents, such as ones an organization distributes, stay on their parent's model; `/fork` is refused under `noonsight run` when rules are set; agent teams and routing are not measured.
- **Delivery is not obedience.** `noonsight report` shows what was sent, not whether the model followed it.
- **The benchmark checks against noonsight's own resolver.** A wrong rule choice would not show up in these numbers.
- **Hook latency.** Hooks took 80 to 150 ms each on a loaded machine, which adds to every tool call.
- **Sample sizes are small.** The rule-effect runs used 30 to 40 runs per arm on small tasks, so read them as directions.

**What it guarantees:** Each Claude Code session and subagent receives the rules written for the model it runs on, and receives them again after a model change, compaction, resume or fork. On Claude Code 2.1.330 and in a stand-in-API benchmark, 0 of 300 sessions broke this after the fixes, and every request with rules due held its rules. This rests on the hook decision log and the stand-in replay, not on real model behavior, and not on any Claude Code version other than 2.1.330.

I read the README, the evidence and results summaries, and the delivery and rule-effect READMEs. I did not run the test suite or the tool, so the numbers above are the authors' reported results, not my reproduction.
