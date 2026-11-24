**Verdict: adopt with conditions.** Start with a pilot, not a team-wide rollout.

I read the README, `docs/evidence.md`, `docs/hooks.md` and the limits section of the delivery benchmark. I didn't run its test suite or install it, so the numbers below are the project's own, not ones I reproduced.

**Reasons**

- **It fits how you work.** Your sessions run on four models and start many subagents. Subagents never see the session's conversation, so per-model rules in `CLAUDE.md` miss many of them. In the project's benchmark, a user `CLAUDE.md` reached only 46.9% (60 of 128) of subagent requests that should have had rules. noonsight reached 100% (763 of 763) (README lines 41–42; D20, D28). `CLAUDE.md` also never reaches the built-in Explore and Plan subagents.
- **Each model gets only its own rules.** With `CLAUDE.md` or `.claude/rules`, every model also receives the other models' rules. Only about 28–33% of the rule text in a request was written for that model, against 78.6% under noonsight. Requests holding another model's rules that nothing retired: 0 under noonsight, about 620 for the alternatives (D30, D32). It also adds fewer characters per request: about 1,343 against 4,472 (D31).
- **The claims are checkable.** Every number points to a committed raw file, and `npm test` recomputes it. The project lists its nine past delivery bugs (F1–F9) with reproductions. It says plainly that it guarantees delivery, not that the model will follow the rules.
- **But the rules have not been shown to make the work better.** On small tasks, `verify-changes` and `carry-through` changed behaviour: Sonnet ran the tests after a fix in 29 of 30 runs against 0 of 30 without the rule. Yet every run passed its hidden checks with or without rules (R8). The paid pilot found no difference: 132 of 144 passed with noonsight, 133 of 144 without (B1). No Opus 5.5 rule has a measured effect.
- **The rules raise cost.** For Sonnet on the one-file fix, `verify-changes` about doubled cost per run ($0.0505 against $0.0240, R6).
- **Out of the box it does little for Opus and Fable.** Their rules for watched (attended) sessions ship turned off, so an interactive Opus or Fable session gets nothing until you turn rules on with `enable` (README lines 52, 184).

**Conditions and risks**

Conditions:
- You must have rules that really differ by model. If they don't, the project itself says a `CLAUDE.md` is simpler (README line 256).
- Install with `npm install -g`, not `npx`. Under `npx`, delivery stops silently once npm's cache is cleared.
- Set `session.unattended_when_env` to your orchestrator's variable, so interactive sessions nobody watches count as unattended. Give sessions a scope (`NOONSIGHT_SCOPE`) where you want scoped rules.
- Pin your Claude Code version, or re-check delivery after each upgrade. Every result holds only for the version it ran on (delivery was measured on 2.1.330).
- Watch `noonsight report` and the `MISMATCH` warnings. Measure each rule you write before keeping it.

Risks:
- **It relies on behaviour Claude Code doesn't document.** Fork handling, the headless flag `CLAUDE_CODE_SESSION_ATTENDED`, and subagent metadata were all recorded on one version. A Claude Code update could break delivery silently.
- **Known gaps:**
  - Workflow agents get nothing.
  - Subagents defined by a plugin noonsight doesn't read (for example one your organization syncs) are assumed to run on their parent's model, which may be wrong.
  - Agent teams in split panes weren't checked, and agent teams, routing and the classifier weren't measured at all.
  - The `default` and `opusplan` model settings can't be resolved.
  - On Bedrock, Vertex or Foundry, aliases such as `sonnet` need the pinning variables set.
  - A `model` set only in an MDM profile isn't read.
  - On macOS, a prompt that contains `--model x` can't be told apart from the real option.
- **Overhead:** about 80–150 ms of processor time per hook run, measured on a busy laptop. The hooks fire at session start, on agent calls, and on edits until the first edit of tracked code.
- **The project is very new.** All its evidence is from 16–23 November 2026, it was renamed from "sextant", and all the measurements come from the project itself. The delivery benchmark used a stand-in API and checked against noonsight's own rule resolver, so it would not catch a wrong resolution, only a wrong delivery.
- **Shared repository rules need opt-in.** Rules committed to a repository do nothing until each person runs `noonsight trust` in it.

**What it guarantees:** Delivery only, not obedience: each session and subagent gets the rules declared for the model it actually runs on, in its requests, and again after a model change, compaction, clear, resume or fork. That rests on Claude Code's hook behaviour as recorded on version 2.1.330 (some of it undocumented), on noonsight correctly predicting each subagent's model, and on a stand-in-API benchmark with no failures in 299 sessions, outside the documented exceptions.
