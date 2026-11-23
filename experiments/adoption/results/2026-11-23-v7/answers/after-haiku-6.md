**Verdict:** Adopt with conditions. Pilot it on a few developers first, pin the Claude Code version, and don't rely on it for anything beyond delivering rules.

**Reasons:**
- Your mix of models and heavy subagent use is the case it targets. The README's comparison on the same 60 sequences found a `CLAUDE.md` reached 32.2% of subagent requests (39 of 121), `.claude/rules` the same, and a skill per model 0%. noonsight reached 100% of subagent requests (`README.md` lines 32–37, `docs/evidence.md` D9/D10/D11).
- Routing is per model and per place, so Opus, Sonnet, Haiku and Fable each get their own rules, and the `where` key separates attended, unattended and subagent sessions (`README.md` lines 107–116).
- The preset is already split by model with sources, and the rules that could add cost or side effects ship off (`README.md` lines 159–192). That is a sensible default for a team.
- It is local and offline. The hooks never block and never use the network, and the only dependency-free path is the classifier, which is off by default (`README.md` lines 228–229). I confirmed the only `spawnSync`/`spawn` calls in `src/` are for `claude`, `git` and the classifier, and that the one URL-based config reference is a schema link.
- It is tested, and the evidence is traceable. Each number in `docs/evidence.md` names a raw result file and a computation that `test/evidence.test.ts` recomputes. The 2.1.330 run is the latest: 0 of 299 sessions broke the invariant after fixes F5–F9, with 100% (453 of 453) of fork, resume, plan-mode and edit-subagent requests holding their rules (`docs/evidence.md` D18, D21).

**Conditions and risks:**
- **Version pinning.** Every measurement is per Claude Code version, and the newest measured is 2.1.330. Hook behavior has changed between versions before (F1–F9 were all found this way). Pin your team's version, and rerun `npm test` and the delivery benchmark on each upgrade, as `experiments/delivery/README.md` line 83 advises.
- **Stand-in API, not the real one.** The benchmark sends requests to a local stub, so no model answered. It shows delivery, not what the model did with the rules. Pilot on real sessions and read `noonsight report`.
- **The headline number is from an older run.** The 99.9% (3,219 of 3,221) figure is from 2.1.328 (D2). The 2.1.330 run is 100% on its own paths, and one session of 300 was not measured (`s1-0123`).
- **Set the unattended variable.** Interactive sessions nobody watches count as attended unless you set `session.unattended_when_env` to your CI or orchestrator variable. Without it, Opus and Fable's unattended rules won't reach those sessions (`README.md` lines 49–53).
- **Attended Opus and Fable get nothing by default.** Their attended rules ship off, so enable the ones you want with `enable` (`README.md` lines 180–190).
- **Cost.** In the measured fix task, `verify-changes` raised a Sonnet run from $0.0240 to $0.0505 (R6). Keep triggers and scopes narrow.
- **Install is per person and per login.** `noonsight install` edits hooks for every Claude Code login of the account, and repo rules only apply after each clone runs `noonsight trust` (`README.md` lines 74–76, 138–139). Make this a documented onboarding step.
- **Not on npm.** Version 0.1 is not published, so install from a clone and pin a commit.
- **Not measured.** Agent teams, routing, the classifier, and plugin-defined subagents (predicted on the parent's model) are outside the claim (`README.md` lines 55–58).
- **Delivery is not obedience.** A delivered rule is context. Whether it changes behavior depends on the rule, which the README measures only for the preset's rules and only on small tasks (`README.md` lines 196–207).
- **Rule text is injected into prompts.** A badly written rule reaches every matching session. Run `noonsight check` and `noonsight resolve` before rolling out a new rule.

**What it guarantees:** In the sessions it ran, every request that had rules due for its model, scope, place and triggers carried those rules, and no other model's rules were left unretired (D18, D21, D22 on Claude Code 2.1.330). This rests on the Claude Code hooks it reads and on a stub-API harness with a corpus of reproduced failures, not on the model's behavior with the rules and not on the real API.

Caveats: I read the README, the evidence and limits docs, and the source file list, and grepped `src/` for network and process calls. I did not run `npm test` or verify the Anthropic quotes in `docs/sources.md`.
