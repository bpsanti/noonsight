**Verdict: adopt with conditions.** Run it as a time-limited trial on a few machines first, not a team-wide rollout.

**Reasons**

1. **It addresses a problem you actually have.** You mix Fable, Opus, Sonnet and Haiku, and you use subagents a lot. The usual ways of giving rules work badly in that setup. In the authors' benchmark, the same 60 test sessions reached subagent requests at these rates (`README.md:26-31`, `docs/evidence.md` D5–D11):

   | Where the rules live | Subagent requests that got their rules |
   | --- | --- |
   | A user `CLAUDE.md` | 32.2% (39 of 121) |
   | `.claude/rules` | 32.2% |
   | One skill per model | 0 of 121 |
   | noonsight | 100% |

   A `CLAUDE.md` never reaches the built-in Explore and Plan subagents. It also gives every model all the other models' rules: only 31.6% of the rule text a request carried was written for its own model, against 78.8% under noonsight (D12).

2. **The evidence is unusually easy to check.** Each number in the README links to a raw results file and to how it was computed, and `test/evidence.test.ts` recomputes each one. Comparisons were fixed before the runs (`experiments/delivery/plan.json`). The project also states its own failures (F1–F4) and limits openly.

3. **It is very new and has not been re-tested since its last fixes.** The version is `0.0.1`, `private: true` and not on npm, so you install it from a git clone. All results are from 16–20 Nov 2026, the last few days. The headline 99.5% (3 of 300 sessions failing) was measured on a build without the F3/F4 fixes. The fixed build passes only the short reproduction cases; the 300 random sessions have not been run again (`README.md:20-22`).

4. **Out of the box, sessions where someone is watching get almost nothing.** Most rules in the preset are limited to unattended runs, subagents or a named task scope (`presets/claude/preset.json`).
   - **Fable or Opus session, no scope set:** receives no rules.
   - **Sonnet or Haiku session, no scope set:** receives only `verify-changes`, and only after its first edit of a code file git already tracks.

   You only get value if you set `session.unattended_when_env`, use `NOONSIGHT_SCOPE`, or write your own rules.

5. **Better delivery has not been shown to give better results.** In the 588-run paid pilot, tasks resolved were 133, 132 and 133 of 144 with noonsight off, with noonsight on, and with a `CLAUDE.md` (`experiments/benchmark/results/2026-11-19/README.md:119`). Runs cost about 7% more with noonsight on. The rule experiments do show clear changes in behaviour, such as Sonnet and Haiku running the tests 30/30 vs 0/30. But the tasks were small, and on Sonnet that rule roughly doubled the cost per run ($0.024 → $0.0505).

**Conditions and risks**

Conditions for it to work for you:
- **Decide your rules first.** Write down which rules you want per model, and set scopes and `unattended_when_env`. Without that, it adds hooks and does very little.
- **Pin the Claude Code version and re-check it on every upgrade.** It depends on exactly how Claude Code's hooks behave, and it copies Claude Code's own rules for choosing a model. It was measured only on Claude Code 2.1.326–2.1.329. Run the delivery test cases (`npm run delivery -- corpus`) before each upgrade.
- **Install from a commit you have reviewed.** Use the per-account install, keep `noonsight uninstall` ready, and check that your organization's managed settings allow user hooks (`noonsight check`).
- **Keep routing and the classifier off at first.** In auto mode, routing makes Claude Code refuse the other tool calls in the same response, which then have to be made again. The classifier sends the first 4,000 characters of a task to a model.
- **Judge the trial on your own results.** Look at `noonsight report` and at your actual outcomes and costs, not at the delivery rate.

What could go wrong:
- **Paths that were never tested:** `/resume` inside a session, forks, plan mode, agent teams, routing, the classifier, per-repository configs, and subagents that edit files.
- **Subagents that get no rules:** plugin subagents, `--agents` definitions and agent-team teammates are not covered. Parallel subagents of the same type that would need different rules get none. A subagent held on a permission prompt for more than about 5 seconds also gets none.
- **A wrong model, silently:** a conversation compacted and then resumed with nothing naming a model runs on Claude Code's default model, which noonsight can't tell.
- **Overhead:** each hook run takes about 60–120 ms of CPU, and a subagent start can wait up to 2 seconds more when several calls are open. On macOS it reads the Claude Code command line with `ps`, so text like `--model x` inside a prompt can't be told apart from the real option.
- **The safety net only warns.** The check after a subagent starts can report a wrong prediction, but it cannot fix the rules that subagent already received.

**What it guarantees**

Strictly, it guarantees nothing. Its stated claim is that the right model's rules are delivered as context (not that they are obeyed) on 99.5% of requests. That figure was measured against a local stand-in for the API on Claude Code 2.1.328, using a build before the latest fixes. It rests on Claude Code keeping its current hook behaviour and model-selection order, and on noonsight's own rule lookup being correct, since the benchmark grades against that same lookup.

A couple of notes on how I got here. I only read the docs, the results and parts of the source; I did not run the tests or install anything. A search of the source found no network calls; the outside processes it starts match what the docs say. Also, the changelog describes `experiments/adoption`, a harness that asks Claude Code sessions this same adoption question and scores their answers. It doesn't change my verdict, but it does mean the README was partly written to persuade AI reviewers like me. Treat this assessment as input for the trial, not a substitute for it.
