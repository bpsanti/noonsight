**Verdict: adopt with conditions.** Run it as a time-limited pilot, not a team-wide rollout. It's a well-built delivery tool, but the case for the outcome it's meant to improve is weak, and it depends on Claude Code internals that change every week.

I read the README, `docs/hooks.md`, `docs/evidence.md`, `package.json` and the delivery experiment's failures and limits. I did not run the test suite or the benchmarks, so every number below is the repo's own claim.

## Reasons

- **It fixes a real gap that matches how you work.** The repo's benchmark says rules in a `CLAUDE.md` or `.claude/rules` reached only 46.9% (60 of 128) of subagent requests. noonsight reached 100% (763 of 763) (D20, D28). A `CLAUDE.md` also gives every model the other models' rules: 619 requests carried a rule meant for another model, against 0 under noonsight (D32). With four models and heavy subagent use, this is the problem it targets.
- **It proves delivery, not better results.** The README says so itself ("delivery, not obedience"). On public tasks across the four models, the share of runs that passed was the same with and without it: 133 of 144 with no rules, 132 under noonsight, 133 with a `CLAUDE.md` (B1). On the small fix and bug tasks, every run passed with or without rules (R8).
- **The rule effects that were measured are narrow and cost money.** `verify-changes` made Sonnet and Haiku run tests after the fix (from 0 to 27–30 of 30 runs). It also roughly doubled Sonnet's cost on that task ($0.0240 to $0.0505, R6), and the preset's rules together added about 60% on the bug ($0.0321 to $0.0513, R17). No Opus rule has a measured effect. Opus's and Fable's rules for interactive sessions ship turned off, so an interactive Opus or Fable session gets nothing from the preset by default.
- **It relies on undocumented Claude Code behaviour.** Fork detection (`forkedFrom`, `state.json`, `toolUseId` in the subagent's metadata), the `CLAUDE_CODE_SESSION_ATTENDED` variable and others are described as "not documented, recorded on 2.1.330". Nine delivery bugs (F1 to F9) were found and fixed between Claude Code 2.1.328 and 2.1.330, in under a week. The 100% result applies only to 2.1.330.
- **The project is young.** It's version 0.1.0 with one author, and was renamed from "sextant". In its favour: it has no runtime dependencies, it never blocks or denies a call, and it refuses a broken configuration as a whole instead of guessing.

## Conditions and risks

**What would have to hold:**
- **Pin the Claude Code version.** Run `npm run test:live` again before each upgrade. Delivery bugs come from Claude Code changing its hook behaviour.
- **Write rules you actually need to differ by model.** The preset alone does very little for interactive Opus and Fable sessions. If your rules are the same for every model, a `CLAUDE.md` is simpler, as the README says. The exception is Explore and Plan subagents, which a `CLAUDE.md` doesn't reach.
- **Measure the outcome on your own work.** Compare a few weeks with and without it, looking at both quality and cost per session. Use `noonsight report` to drop rules that change nothing.
- **Leave routing and the classifier off.** Neither was measured. Routing changes agent calls, which in auto mode makes Claude Code refuse the other calls in that response until they are made again. The classifier sends up to 4,000 characters of each task to a model.
- **Review the hook code before installing it on everyone's machine.** It runs on every session start, model switch, edit and agent call. It reads transcripts and settings, and on macOS it runs `ps`.
- **Install it per account (`noonsight install` or the plugin), not machine-wide.** A person's `disableAllHooks` setting can't turn off the machine-wide install.

**What could go wrong:**
- A Claude Code update quietly breaks delivery. The decision log records what the hooks returned, not what reached the model, so a broken delivery can look normal in the log.
- Some cases get no rules or the wrong ones:
  - Workflow agents and agent teammates in split panes, which were not checked.
  - Subagents from plugins it doesn't read, such as ones your organization syncs.
  - The `opusplan` and `default` model settings.
  - Gateway or custom model IDs.
  - Several sessions forking with `--continue` in the same project at once, where it can mistake another session's transcript for the original.
- macOS is weaker than Linux, because `ps` joins the command-line arguments and makes some of them ambiguous.
- It adds cost (about 1,300 characters per request, more turns from the verify rules) and 80–150 ms of CPU time per hook run.
- Developers may treat "delivered" as "followed".

## What it guarantees

Through Claude Code's hooks, it puts each model's declared rules into the requests of every session and subagent running on that model, and again after a model switch, compaction, `/clear`, resume or fork. That rests on: its own fuzz benchmark against a stand-in API (0 of 299 sessions failed, Claude Code 2.1.330 only), its prediction of which model a subagent will run on, and undocumented Claude Code behaviour that may change. It does not guarantee the model obeys the rules or that results improve.
