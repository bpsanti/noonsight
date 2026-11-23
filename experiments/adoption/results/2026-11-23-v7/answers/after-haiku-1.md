**Verdict: Adopt with conditions.** Pilot it on a few machines first, pin the Claude Code version, and keep it off any setup that depends on workflow subagents or agent teams.

**Reasons**

1. It targets the gap your setup has. Your mix of Opus, Sonnet, Haiku and Fable sessions, plus subagents, is where native mechanisms fall short. In the repo's comparison on the same sequences, a user `CLAUDE.md` delivered each model's rules to 87.3% of requests and to 32.2% of subagent requests. `.claude/rules` gave 70.6% and 32.2%. Under noonsight, subagent coverage was 100% (763 of 763) on Claude Code 2.1.330 (docs/evidence.md D3, D10, D20).
2. The post-fix results are clean. On Claude Code 2.1.330, 0 of 299 completed sessions broke the rule invariant, and coverage was 100% (3,090 of 3,090) across `/model`, `/compact`, `/clear`, resumes, forks, plan mode and subagents that edit files (D18, D19, D21). The earlier 2.1.328 run had one failing session, and the fixes for those failures are in the repo with reproductions in the corpus (D16, D23, D24).
3. You can audit it. `noonsight report` and the decision log show which rule reached which model, scope and place. The team can check delivery rather than trust it.
4. The runtime cost is low. The hooks never block and never use the network (the classifier is off by default). Measured hook CPU is 50 to 90 ms per run (D15).
5. Rules are selected by metadata, not by their text, so custom rules inherit the same delivery claim. The repo tests `noonsight check` against every configuration example in its docs.

**Conditions and risks**

- **Version pinning.** The guarantees hold only on the Claude Code versions the repo measured, currently 2.1.330. Many facts are checked by hand, not in CI. Before anyone upgrades Claude Code, run `NOONSIGHT_LIVE_LOGIN=1 npm run test:live` (and `NOONSIGHT_LIVE_DELIVERY=1` for subagent and fork paths), and keep the team on one version.
- **Known gaps that touch your setup:**
  - Subagents started by a workflow get no rules.
  - Foreground calls of the same type that need different rules get their rules late, at their first Edit, Write or agent call.
  - Agent teams, routing and the classifier are not measured.
  - Plugin subagents that noonsight doesn't read stay on their parent's model.
- **Preset defaults.** Out of the box, attended Opus 5.5 and Fable 5.2 sessions get no preset rules, because those rules ship off. Attended Sonnet and Haiku sessions get `verify-changes` once they edit a tracked code file, and that rule costs money. On a small Sonnet fix, mean cost rose from $0.0240 to $0.0505 with `verify-changes` alone (R6). Decide whether you want that default, and budget for it.
- **Headless and CI runs.** Headless runs get the unattended rules by default. Set `session.unattended_when_env` to your orchestrator's variable so its interactive workers are treated as unattended.
- **Install footprint.** It is not on npm yet, so each machine needs a git clone plus `npm install && npm run build && npm link`. `noonsight install` writes hooks into every Claude Code login on the machine, so on shared accounts, check that first. `--managed` requires sudo and writes to a system path.
- **Trust boundary.** Repo-level rules are text injected into model context. They only take effect after each person runs `noonsight trust` in that clone. Treat a repo's `.noonsight/` files as code review material.
- **Delivery is not obedience.** The repo states that a delivered rule is context and that the model may not follow it. Rule effects were measured on small tasks with 30 to 40 runs per arm, so expect the same limits for your work.
- **Test setup.** The delivery benchmark used a local stand-in for the API, so no real model requests were involved. The repo's own live checks that send prompts use the Claude Code login, and Fable usage in `claude -p` bills to usage credits.

**Pilot plan.** Run it for two to three weeks on a few machines that cover the four models and subagents. Use `noonsight report` and compare token costs with and without it. Adopt across the team only if delivery stays at or near 100% and the cost is acceptable.

**What it guarantees:** Every session and subagent started with the hooks installed receives, at each request measured, the rules its model, scope, place and trigger select, and no other model's rules left unretired; this was measured on 299 completed sessions on Claude Code 2.1.330 against a local stand-in for the API, and it rests on that benchmark and the hook decision log, not on any test of model behavior.

I did not run the repo's tests or install it. I read the README, CHANGELOG, the verification and evidence docs, and the file listing, but not the source code.
