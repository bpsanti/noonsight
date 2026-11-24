## Verdict: adopt with conditions

Run it as a time-limited pilot on a few machines with Claude Code pinned to a known version. Roll it out to the team only if your pilot shows a benefit that the repo's own evidence doesn't show.

I read the README, `docs/evidence.md`, `docs/hooks.md`, the delivery experiment's README, the hook manifest and the version-compatibility code. I did not run its tests or install it, so every number below is the project's own claim. The evidence map ties each one to a committed raw file.

## Reasons

1. **It fits your setup better than `CLAUDE.md`.** You mix four models and use subagents a lot, which is the case it's built for.
   - In its benchmark, a `CLAUDE.md` holding every model's rules reached only 46.9% of subagent requests (60 of 128, D28). Claude Code's docs also say `CLAUDE.md` never reaches the built-in Explore and Plan subagents.
   - With `CLAUDE.md`, every model also gets the other models' rules: only 32.6% of the rule text in a request was for that request's model (D30). In 619 requests another model's rules were still in force (D32).
   - Under noonsight, its benchmark reports 3,090 of 3,090 requests with their rules, 763 of 763 subagent requests, 0 of 299 sessions broken, and 0 requests still holding another model's rules (D18–D20, D32).
2. **Those delivery numbers have narrow limits.**
   - They come from real Claude Code sessions talking to a fake API with fixed replies. No model answered, and no session compacted on its own.
   - "Correct" is judged against noonsight's own rule picker, so a wrong choice of rules would not show up, only a failed delivery.
   - Agent teams, routing, the classifier and `opusplan` were never measured.
   - All of it was measured on one Claude Code version, 2.1.330.
3. **It has not been shown to improve results.** In a paid pilot on public tasks, 133 of 144 runs passed with no rules, 132 under noonsight and 133 with a `CLAUDE.md` (B1). In the rule experiments, every run passed its hidden check, with or without rules (R8).
4. **The rule effects that were shown are narrow and cost money.**
   - `verify-changes` made Sonnet and Haiku run tests after editing: 29 of 30 runs against 0 of 30 without it.
   - But Sonnet's cost per run roughly doubled on that task: $0.0240 to $0.0505 (R6).
   - No Opus 5.5 rule has any measured effect. The tasks were small, and the README says so itself.
5. **Installed as-is, it does little in interactive sessions.**
   - Opus and Fable rules for watched sessions ship off, so those sessions get nothing from the preset.
   - Sonnet and Haiku sessions mostly need `NOONSIGHT_SCOPE` set, apart from `verify-changes`, which arrives once the session edits a code file git tracks.
   - The value only shows up once your team writes its own rules or turns preset rules on.
6. **It is very new.**
   - It's version 0.1.0, and all the evidence is from one week (2026-11-16 to 11-23).
   - In that week its own benchmark found nine delivery bugs (F1–F9), all fixed.
   - It depends on details of Claude Code hook behavior that change between versions. Results are recorded per Claude Code version, and versions your team runs other than the ones it was tested on are unmeasured.
7. **It is low-risk to try.**
   - Its hooks never block a call and always exit 0.
   - Apart from the optional classifier, which is off by default, it uses no network and reads only local files.
   - It has no runtime dependencies, logs every delivery, and `noonsight uninstall` removes the hooks.
   - It adds about 80–150 ms of CPU per hook run (D33), measured on a busy laptop.

## Conditions and risks

**What would have to hold:**
- **Pin and recheck Claude Code versions.** Keep the team on one Claude Code version, ideally 2.1.330, the one measured. After every Claude Code upgrade, run `noonsight check` and look at `noonsight report` before trusting it again.
- **Install it the recommended way.** Use `npm install -g` (or the plugin). With `npx`, the hooks silently stop delivering once npm's cache is cleared. Pin the noonsight version too.
- **Decide your rules before rolling out.** The point is to deliver your own per-model rules, so check each one with `noonsight resolve`. Set `session.unattended_when_env` for sessions nobody watches, and a scope for Sonnet and Haiku sessions.
- **Measure on your own work.** Compare a few weeks with and without it, on test runs, task completion and cost. Drop any rule that changes nothing you can see.
- **Keep the classifier and routing off** unless you choose otherwise. The classifier sends the first 4,000 characters of a task to a model. Routing in auto mode causes the other agent calls in the same response to be refused and remade.

**What could go wrong:**
- **It fails silently.** Since it never blocks, a failure just means rules don't arrive. You only learn about it from `noonsight report`, a MISMATCH warning, or by noticing.
- **Known gaps where subagents get nothing:**
  - agents started by a workflow;
  - subagents from plugins your organization syncs, which are predicted on the wrong model;
  - several agent calls of one type that need different rules, until each subagent's first Edit, Write or agent call.

  Agent-team teammates in split panes were never checked.
- **Some model choices can't be seen.** For sessions on `default` or `opusplan`, noonsight can't tell the model.
- **`/fork` stops working** in sessions started through `noonsight run` with rules.
- **It can raise costs.** Rules that make models run tests, report more or keep going raise spend per run, by about 2× in one measured case.
- **Its upkeep is unknown.** It is a 0.1.0 project with its own release cadence. It will need to keep up with Claude Code's hook changes, and nothing in the repo shows how well it does that.

## What it guarantees

It guarantees that the rules you declare for a model are delivered as context, not that the model follows them, to that model's sessions and to most of their subagents, including after model switches, compactions, resumes and forks. That guarantee rests on Claude Code's hooks behaving as they did on version 2.1.330, where it was measured against a fake API and checked against noonsight's own rule picker.
