**Verdict: adopt with conditions.** Run it as a time-boxed pilot on a few machines. Don't roll it out to the whole team yet.

I read the README, the evidence map, the Claude Code facts the tool depends on, the delivery benchmark's results and limits, the changelog and the version-check code. I did not build it or run its tests, so every number below is the project's own published claim, checked only for internal consistency.

**Reasons**

1. **It solves a real problem your setup has.** In the author's benchmark, putting every model's rules in a user `CLAUDE.md` reached only 32.2% of subagent requests (39 of 121). It never reaches the built-in Explore and Plan subagents, and every model also gets every other model's rules: only 31.5% of the rule text a request held was written for that model. Your team mixes four models and uses many subagents, which is exactly where this gap shows.
2. **The delivery evidence is unusually careful.** Every number links to a raw result file, and the test suite recomputes it from that file. The fuzzer and corpus found real bugs (F1–F9), and the latest run on Claude Code 2.1.330 had 0 of 300 sessions break the invariant, with 3,090 of 3,090 requests holding their rules.
3. **It is pre-release.** Version 0.1 is not on npm; you install it from a git clone with `npm link`. Nine delivery bugs were found and fixed between Nov 19 and Nov 23, and five of them came from the latest run, which tested paths the earlier runs left out. Code changing that fast will probably have more bugs on paths nobody has tested yet.
4. **It depends on Claude Code details that can change between releases.** These include undocumented ones such as the `CLAUDE_CODE_SESSION_ATTENDED` variable, how hook timing works, and how Claude Code drops duplicate context. The published results cover only Claude Code 2.1.328 and 2.1.330. `noonsight check` compares the installed version against only one minimum (2.1.251), so it won't warn you when a newer release changes behavior.
5. **The bundled rules give you little at first.** Opus 5.5's and Fable 5.2's rules for attended (interactive) sessions all ship turned off, so those sessions get nothing from the preset. Interactive Sonnet and Haiku sessions get only `verify-changes`, and only after they edit a tracked file. The value depends on your team writing its own rules.
6. **The measured effect of rules on behaviour is small and narrow.** `verify-changes` reliably made Sonnet and Haiku run tests (0 of 30 runs without rules, 27–30 of 30 with them), but it roughly doubled the cost per run of a Sonnet fix. Several other rules changed nothing measurable. Each experiment used small tasks and 30–40 runs per variant.

**Conditions and risks**

Conditions:
- **You actually have rules that should differ by model or by task.** If you don't, the README itself says a `CLAUDE.md` is simpler.
- **Someone owns upgrades.** Pin the Claude Code version during the pilot. After each Claude Code upgrade, run `npm run test:live` (with `NOONSIGHT_LIVE_DELIVERY=1`) and `noonsight check` before machines move to the new version.
- **Interactive sessions that nobody watches are configured.** Set `session.unattended_when_env` to your orchestrator's or CI's variable. Otherwise those sessions count as attended and get the wrong rules.
- **You review the install.** `noonsight install` adds hooks to every Claude Code login's settings on the machine. It can be removed with `noonsight uninstall`.
- **You check `noonsight report`** to confirm rules are being delivered, and drop rules that don't change anything you can see.

Risks:
- **A Claude Code update could silently send wrong rules or none.** For example, if the attended-session variable disappears, every session falls back to being treated as attended.
- **Known gaps:**
  - A workflow's agents get nothing.
  - Some parallel foreground subagents get nothing until their first edit.
  - Subagents from plugins the tool doesn't read, such as ones your organization syncs, are assumed to run on the parent's model.
  - The `default` and `opusplan` model settings can't be resolved.
  - A conversation resumed right after `/compact` can get the wrong model's rules.
  - Agent teams, routing and the classifier are not measured at all.
- **Other risks:**
  - If you run Claude Code on Bedrock, Vertex or Foundry, model aliases map to different models, which adds another way to get the wrong rules.
  - Rules add cost.
  - Each hook run takes about 50–90 ms of CPU time (median).
  - The classifier is off by default; if you turn it on, it sends the first 4,000 characters of a task to a model.

**What it guarantees**

It guarantees delivery, not obedience: each session and subagent receives the rules written for the model it actually runs on. That rests on one author's benchmark, which used a stand-in for the API and checked against the tool's own rule-picking logic, so a mistake in that logic wouldn't show up. The benchmark covered only Claude Code 2.1.328/2.1.330 and only the paths it tested.
