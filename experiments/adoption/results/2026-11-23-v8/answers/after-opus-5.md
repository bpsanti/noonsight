**Verdict: adopt with conditions.** Run it as a time-boxed pilot on a pinned version. Don't roll it out to the whole team yet.

**Reasons**

- **It solves a problem you actually have.** Your team mixes models and uses subagents a lot. In the tool's own benchmark (Claude Code 2.1.330), a user `CLAUDE.md` holding every model's rules reached all 448 requests in the main conversation, but only 46.9% (60 of 128) of subagent requests. It never reaches the built-in Explore and Plan subagents, and Claude Code's docs confirm that. It also gives every model the other models' rules: 619 requests carried another model's rules with nothing marking them as not applying, against 0 under noonsight. noonsight delivered 100% of 3,090 requests, including 763 of 763 subagent requests.
- **The evidence is honest and checkable.** Every number links to a committed result file, and `npm test` recomputes each one. I spot-checked the headline numbers in `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.json` (3090/3090, 763/763, 0 sessions failed) and they match. The README states its own limits, and the benchmark includes self-checks with deliberately planted bugs.
- **There is little evidence that it improves results.** On public tasks, the paid pilot found no measurable difference: 133, 132 and 133 passes out of 144 for no rules, noonsight, and a `CLAUDE.md` (README:212). Only three preset rules had a measured effect, all on small tasks. The clearest is `verify-changes`, which got Sonnet and Haiku to run tests 29/30 and 27/30 times instead of 0/30, but it also about doubles the cost of a small fix ($0.024 → $0.0505).
- **Out of the box it does little for half your models.** In an attended session, Opus 5.5 and Fable 5.2 get nothing from the preset, because all their rules for that place ship off. Sonnet and Haiku mostly need a scope set (`NOONSIGHT_SCOPE`). Most of the value has to come from rules your team writes.
- **It's young and still finding bugs.** It's version 0.1, not on npm (you install from a clone), and the docs cite releases from 2026-11-14 onward. The benchmark found nine delivery bugs (F1–F9). F5–F9 only showed up once the test generator added new paths like forks and plan mode, which suggests paths it still doesn't test have bugs too.

**Conditions and risks**

Conditions:
- **You have rules that really differ by model.** If your rules are the same for every model, a `CLAUDE.md` is simpler. The README says this itself (README:245). The one exception is if you need rules to reach Explore and Plan subagents.
- **You pin the Claude Code version and the noonsight commit.** The results hold only for Claude Code 2.1.330. The tool depends on hook details, some of them undocumented:
  - `CLAUDE_CODE_SESSION_ATTENDED=0`
  - Claude Code dropping a repeated SessionStart context
  - plan mode running Sonnet in place of Haiku
  - the transcript format and subagent metadata files

  Before you upgrade either one, rerun its corpus (`npm run delivery -- corpus`; it needs no login).
- **You review the code before installing.** `noonsight install` adds hooks to every Claude Code login on the account, and they run on every session start, model switch, edit and agent call. That's a supply-chain trust decision about one outside repo. If you upgrade, review the diff each time.
- **The team does the setup work.** That means writing or enabling rules for Opus and Fable, and setting `session.unattended_when_env` for your orchestrator. If any repo uses a shared `.noonsight/noonsight.json`, each person must run `noonsight trust` in it once.
- **You judge success by results, not by `noonsight report`.** The report only shows what was delivered. Drop any rule that doesn't change anything you can see.

Risks:
- **Subagent gaps:**
  - Workflow agents get nothing.
  - Agent-team teammates in split panes weren't tested.
  - Subagents from plugins noonsight doesn't read, like ones an organization syncs, get rules for the wrong model.
  - When several agent calls of one type need different rules, a subagent that makes no Edit, Write or agent call gets nothing.
- **Untested setups:** the benchmark didn't cover agent teams, routing, the classifier or `opusplan`. On Bedrock, Vertex or Foundry, model aliases need pinning variables, or it can't tell the model.
- **macOS parsing:** reading `--model` from the command line uses `ps`, which can't tell a prompt containing `--model x` from the real option. It warns rather than guessing.
- **Costs:** rules add about 1.3k characters per request (still less than the `CLAUDE.md` arm's 4.5k), and hooks take 80–150 ms each. Rules like `verify-changes` cost real money on small tasks.
- **Known edge case:** a conversation compacted with no reply since, then resumed without naming a model, gets the wrong model's rules.
- **Single maintainer:** if the author stops keeping up with Claude Code releases, the guarantee quietly lapses.

**What it guarantees:** On Claude Code 2.1.330, each request held the rules noonsight's own resolver picks for its model, with no other model's rules left in force, in all 299 completed random sessions. That rests on tests against a local fake API (no model answered), on the resolver itself being correct (it's also the reference the test checks against), on the session paths the test generator covers, and on current, partly undocumented Claude Code hook behavior. It does not guarantee the model follows the rules.
