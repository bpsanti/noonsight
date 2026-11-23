**Verdict:** Do not adopt yet. Revisit after a small, measured pilot on your own tasks.

**Reasons:**
1. **It is unreleased.** The README says "Status: early development. Nothing is published yet." Install means cloning the repo, `npm install && npm run build && npm link`, then `noonsight install` on each machine. It also writes hooks into every Claude Code config directory it finds. The planned 0.1 release is not out.
2. **Delivery works in the tests you would care about.** In the 2026-11-19 benchmark, every condition delivered what it claimed: 168 of 168 runs for `on`, and 84 of 84 for `scattered`. Subagents got their model's rules in every probe path, and a model mismatch is reported as `MISMATCH`. This matches your setup of mixed models and many subagents.
3. **No quality gain is measured yet.** The pilot's "resolved by the verifier" counts for `on` versus `off` are Fable 36/36 vs 36/36, Opus 35/36 vs 36/36, Sonnet 31/36 vs 31/36, and Haiku 30/36 vs 30/36. Open-answer judge scores were slightly lower with rules on (digest 0.68 vs 0.72, review 0.19 vs 0.21), though the judge is uncalibrated. The larger pre-registered study has no results yet.
4. **Cost rises for Sonnet and Haiku.** Per run, both rounds: Sonnet $0.071 → $0.084 (+18%), Haiku $0.009 → $0.010 with input tokens 253k → 323k (+28%), Fable $0.298 → $0.325 (+9%). Opus is flat. The Sonnet verify rule alone was measured at about 46% more per run in an earlier round.
5. **The one clear behavior change is narrow.** The verify rule made Sonnet and Haiku run tests after a precisely described one-file fix (0 of 30 without rules, 30 of 30 and 27 of 30 with). That is useful, but it is one task shape.
6. **Model switches have a known gap.** In the probe, after `/model` to Haiku, only 55% of the rule text delivered was written for the requested model. The switch note is also unconfirmed by design, because a second `/model` before the next request can drop it. The paid runs also showed Fable and Opus sessions silently switching to `claude-opus-4-8`, which is undeclared by default and so gets no rules.

**Conditions and risks:**
- **Pin a version.** Until it is published, pin a specific commit on every machine, and rerun `noonsight check` after any upgrade.
- **Declare every model you actually run, including auto-switch targets** such as `claude-opus-4-8` and `claude-sonnet-5`. Keep `on_undeclared: warn` and run `noonsight check` in CI.
- **Keep routing and the classifier off** at first. Routing changes subagent models, and with `subagents.permission: allow` it skips prompts for routed calls. In auto mode, a routed call causes the other calls in its response to be refused. The classifier sends the first 4,000 characters of each task to Haiku, which needs a data-handling sign-off, and it adds up to 8 seconds per subagent call.
- **Project config needs trust.** A committed `.noonsight/` only applies after each developer runs `noonsight trust`. Project rules are add-only by default.
- **Claude Code drift.** The verification fixtures cover Claude Code 2.1.325 to 2.1.329. Rerun `npm run test:live` with a login after each Claude Code upgrade, and check `noonsight report` for deliveries that stop.
- **Enable only what you measured.** Each rule costs tokens. Turn on `verify-changes` only for Sonnet and Haiku, where it was measured, and use `noonsight report` to confirm it fires.
- **Someone must own the preset.** Preset updates can change what sessions receive. Use `"on_preset_change": "hold"` until a change is reviewed.
- **Pilot first.** Run two to four weeks on a few developers' real tasks, tracking cost per task and failure rate, with rules on and off. Only then decide on a team rollout.

**What it guarantees:** Each Claude Code session and subagent receives the rules declared for the model it actually runs on, at start, after `/model`, `/clear` and compaction, through Claude Code's hooks. This rests on those hooks and on the delivery tests against Claude Code 2.1.325 to 2.1.329. It does not guarantee the model follows the rules, that a switch's note reaches the model, or that the predicted subagent model is the one it ran on.

I did not run the test suite. This verdict rests on reading the README, the docs, and the 2026-11-19 benchmark results.
