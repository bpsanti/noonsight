**Verdict: Adopt with conditions.** Pilot it on a few people's machines first, and keep the classifier off.

**Reasons**

1. **The delivery claim is measured, and it fits your setup.** In the current run (Claude Code 2.1.330, 2026-11-23), every request with rules due got its model's rules: 3,090 of 3,090 overall and 763 of 763 for subagents (D19, D20). A user `CLAUDE.md` reached 88.2% of requests and only 46.9% of subagent requests (D25, D28). Your team runs many subagents, and that is where `CLAUDE.md` fails. `.claude/rules` and skills did no better for subagents (D26, D29).
2. **The rules are per model, not one shared file.** Each model gets only its own rules, and they are redelivered after a model change, compaction, resume or fork. The docs report 0 of 299 sessions breaking that invariant (D18). Without the tool, `CLAUDE.md` put other models' rules into most requests (D32: 619 requests, against 0).
3. **The effect on behavior is small and narrow.** The only measured rule effects are `verify-changes` on Sonnet 5.5 and Haiku 5.5, which made runs test after their last edit, and `carry-through` on Sonnet 5.5 for the backlog task (R3, R10, R14–R16). Each was tested on one small task. In the paid pilot, the pass rate was 133/144 with no rules, 132/144 under noonsight and 133/144 with `CLAUDE.md` (B1). So you should not expect a quality gain.
4. **Cost goes up where the rule helps.** `verify-changes` roughly doubles the cost per run: $0.0240 to $0.0505 on Sonnet, $0.0015 to $0.0033 on Haiku (R6, R7). Fable's one attended-relevant rule is off by default, and its `low-context-report` rule showed no significant cost change (R19).
5. **Most of the preset is off for Opus and Fable attended sessions.** Those rules ship off, so your Opus and Fable sessions get nothing from it by default (README, "The preset's rules").

**Conditions and risks**

- **Pin the version.** The evidence is for Claude Code 2.1.330. Check that your team runs that version, and recheck the hook facts after any upgrade (`docs/verification/claude-code.md`). Many of those facts were checked by hand, not in CI.
- **Install per account, and know the blast radius.** `noonsight install` adds hooks to every Claude Code login on the machine. Use `noonsight uninstall` to back out, and `NOONSIGHT_DISABLE=1` for a single session. Install with `npm install -g noonsight`, not `npx`, because `npx` deliveries stop when npm's cache is cleared.
- **Set the place variables.** Set `session.unattended_when_env` to your CI or orchestrator variable. Otherwise unattended runs get treated as attended, and the wrong rules apply.
- **Known gaps.** Workflow agents receive nothing. Subagents from plugins noonsight does not read stay on the parent's model. `/fork` is unavailable in sessions started with `noonsight run`. Agent teams, routing and the classifier were not measured. A conversation compacted with no model named resumes on the default model, which noonsight cannot detect.
- **Classifier sends data off-machine.** It is off by default. If it is turned on, it sends the first 4,000 characters of each task to a small model through the user's login. Keep it off unless your data policy allows that.
- **Repository rules are a trust boundary.** A committed `.noonsight/noonsight.json` changes what the model is told. Each person must run `noonsight trust`, so review those files like code.
- **Overhead.** Each hook run takes roughly 80–150 ms of CPU on a loaded laptop (D33). That is small but not free for every tool call.
- **The evidence comes from the project itself.** The benchmark, results and tests are all in the same repository, from a single run on one day, and I did not run `npm test` or the experiments myself. Treat the numbers as the authors' claims until your own pilot reproduces the coverage figure.
- **Fable billing.** The docs say `claude -p` bills Fable usage to usage credits without asking, on plans that draw on them. Watch Fable spend during the pilot.

Pilot plan: install on two or three machines with pinned versions. Run `noonsight check`, `noonsight models` and `noonsight report` after a day of real work. Compare coverage on your subagent-heavy tasks and cost per task against a `CLAUDE.md` baseline. Adopt widely only if coverage holds and the cost per task is acceptable.

**What it guarantees:** Through Claude Code's hooks, noonsight puts the rules declared for a model into each session's and subagent's requests on that model, and again after a model change, compaction, clear, resume or fork. That rests on its own benchmark on Claude Code 2.1.330 (3,090 of 3,090 requests with rules due covered) and on the hook behavior documented and checked for that version. It does not guarantee the model follows the rules.
