**Verdict: adopt with conditions.** Run it as a time-boxed pilot on a few machines with Claude Code pinned, rather than rolling it out to the whole team.

**Reasons**

- **It fixes a gap you have.** You use many subagents across four models. In the tool's own benchmark, a user `CLAUDE.md` reached every main-conversation request but only 46.9% (60 of 128) of subagent requests, and it put every model's rules into every model's context (619 requests held another model's rules). Under noonsight, subagent coverage was 763 of 763 and no request held another model's rules (`docs/evidence.md` D20, D28, D32).
- **The evidence is honest and checkable.** Each number links to a committed raw file, and a test recomputes it. I spot-checked the current run's `README.md` and `agree.json`, and they match the claims. The README says plainly where it falls short: no quality gain was shown (132/144 vs 133/144 tasks passed, B1), and Opus 5.5 has no rule with a measured effect.
- **The rule effects that were measured are real but narrow.** `verify-changes` took "ran tests after the last edit" from 0/30 to 29/30 on Sonnet and 0/30 to 27/30 on Haiku. That roughly doubles the cost per run ($0.024 → $0.050). These were small tasks, and the final pass rates didn't change.
- **Out of the box, the preset does little for half your sessions.** An attended Opus 5.5 or Fable 5.2 session gets nothing from the preset, because those rules ship off. Sonnet and Haiku sessions get most of their rules only when a scope is set. The value depends on writing your own rules.
- **It's very new and depends on Claude Code internals.** All the history is from 2026-11-14 to 11-23. The benchmark found nine delivery bugs (F1–F9) in that week. Fork handling reads undocumented Claude Code internals (`forkedFrom`, the `/fork` job's `state.json`, `CLAUDE_CODE_SESSION_ATTENDED`, subagent metadata), which could change in any release.
- **It's low-risk to run.** Its hooks never block or deny anything and always exit 0. It has no runtime dependencies and reads only local files; the one exception is the classifier, which is off by default. You can turn it off per session with `NOONSIGHT_DISABLE=1` or remove it with `noonsight uninstall`.

**Conditions and risks**

- **Pin Claude Code.** Results only hold for the version they were measured on (delivery on 2.1.330). Re-check delivery before each Claude Code upgrade, or the tool may stop delivering rules without telling you.
- **Write per-model rules you'd actually want, and measure them.** If you don't have rules that differ by model, a `CLAUDE.md` is simpler, as the README itself says. Only Explore and Plan subagents strictly need noonsight.
- **Set `session.unattended_when_env`** for your orchestrators, and set `NOONSIGHT_SCOPE` where scoped rules matter.
- **Install from npm (`npm install -g`), not `npx`.** The `npx` copy stops delivering once npm's cache is cleared.
- **Known gaps that may hit you:**
  - Workflow agents get nothing.
  - Subagents from org-synced plugins are assumed to run on their parent's model, so they may get the wrong rules.
  - Agent-team teammates in split panes were never tested.
  - `/fork` is unavailable in sessions started with `noonsight run`.
  - After a compaction followed by a resume that doesn't name a model, it can't tell which model is running.
- **Overhead.** Each hook takes 80–150 ms of CPU per Edit/Write or agent call (measured on a loaded machine), and adds about 1,300 characters per request.
- **Don't treat `noonsight report` as proof the model got the rules.** It logs what the hook returned. In the current run, the log and the stub (the local stand-in for the API, which saw every request) disagreed on the rule text in 135 sessions. The usual explanation, "two quiet steps in a row", doesn't fit 25 of them, and the run's README doesn't explain those 25.
- **The 0-of-299 result is only as strong as the checker.** In the self-check, two of the three deliberately planted bugs were caught in only some of the sessions that exposed them (4 of 9 and 7 of 15). So "no failures found" is not the same as "no failures".
- **One maintainer.** It comes from a single repo (`bpsanti/noonsight`) and changes quickly, so budget for preset updates (`on_preset_change: hold`) and breakage.

**What it guarantees:** It guarantees that the rules you declared for a model are added to the context of each session and subagent running on that model, again after a model switch, compaction, clear, resume or fork, but not that the model follows them. That rests on Claude Code's hook behaviour on the versions it was tested with (2.1.330 for delivery), apart from the listed gaps, and is backed by one simulated-API benchmark of 299 sessions.

I read the docs and the current run's results but didn't run the test suite or install anything.
