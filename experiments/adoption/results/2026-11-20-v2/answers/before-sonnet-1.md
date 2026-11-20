**Verdict:** Adopt with conditions. Run it as a time-boxed pilot, not a team-wide rollout.

**Reasons:**
- **It addresses a real gap.** Your sessions run on mixed models, and a subagent can silently run on a different model than its parent. A single shared `CLAUDE.md` puts every model's rules in front of every model. In the delivery benchmark, only 18–29% of the rule text a model received was written for it. `CLAUDE.md` also never reached the Explore and Plan subagents. noonsight delivered the right model's rules to 7 of 7 paths, and `docs/hooks.md` covers `/model`, `/clear`, compaction, resume and subagents.
- **Delivery is measured and the failures are disclosed.**
  - **Fuzzing results:** in a fuzzer run (`experiments/delivery/results/.../2026-11-20-4e18c43`), 3 of 300 sessions broke the delivery invariant, down from 26 of 296. Coverage was 99.5% against 87.4% for `CLAUDE.md` and 70.9% for `.claude/rules`.
  - **Known open gaps:** the docs list a gap where a session started with no model setting resumes on the default model. The two newest bugs, F3 and F4, are fixed in the unreleased changelog but were not re-fuzzed in the run I read.
- **It is built to stay out of your way.** The hooks never block or deny a call, always exit 0, and take about 80 ms. They make no network calls, and the classifier and routing are off by default. A bad configuration is refused whole with a warning, and `NOONSIGHT_DISABLE=1` turns it off per session.
- **The rule effects are real but narrow.** The rules written for Sonnet and Haiku made them run the tests after a fix (30/30 and 27/30 against 0/30 without rules). `sonnet-5-5/carry-through` raised full completion on one hard backlog task from 9/40 to 32/40, though `haiku-5-5/carry-through` was not shown to help. Fable's report rule shortened its sentences. The rules cost about 7% more per run in the benchmark. In the small test, Sonnet's cost rose about 46% per run.
- **It has not shown better outcomes on real work.** On 21 public tasks, resolve rates were 133, 132 and 133 of 144 for off, on and `CLAUDE.md`. The authors themselves say this is not a quality claim. The paid runs never started a subagent, so the subagent paths were tested only against a stub API.
- **It is unreleased and tied to specific Claude Code versions.** It is `0.0.1`, `private: true` and "early development", and install is from a clone. The checked behaviours are pinned to Claude Code 2.1.325–2.1.329. Several depend on undocumented ordering, such as subagent start order and hook interleaving.

**Conditions and risks:**
- **Pilot first.**
  - **Setup:** use a small group on per-account install (`noonsight install --account`), not `--managed`. Confirm with `noonsight report` that delivery matches what you expect before widening.
  - **What to measure:** compare your own outcomes with it on and off, because the evidence that it improves quality is thin.
- **Pin and re-verify on upgrades.** Pin Claude Code and run `npm run test:live` plus `npm run delivery -- all` on each upgrade. A hook change that breaks delivery would otherwise fail silently, since the hooks never block.
- **Accept supply-chain risk.** You would run an unpublished, single-maintainer package that rewrites every Claude Code login's `settings.json` on the machine. Review `install.md`, read the code, vendor or pin a commit, and know how to run `noonsight uninstall`.
- **Check the Opus and Fable rules.** The measured effects are mostly Sonnet, Haiku and Fable's report rule, and the preset's Opus rules were not clearly shown to help. Keep only the rules you can justify.
- **Check your subagent setup.** Plugin-defined subagents, `--agents` and managed definitions, and agent-team teammates are not predicted or covered. A mismatch warning appears when the prediction is wrong.
- **Leave routing and the classifier off at first.** In auto mode, routing makes Claude Code refuse the other calls in that response until Claude retries them. The classifier sends the first 4,000 characters of each task to a model.
- **Expect some noise.** There are possible repeated rule copies after `/model` switches, extra warnings, and a 2-minute window of open subagent calls.

**What it guarantees:** It guarantees, on a best-effort basis, that each session and subagent receives the rules declared for the model it actually runs on, never blocking a call, which rests on Claude Code's hook events and their documented and recorded behaviour on pinned versions (99.5% coverage in fuzzing, not 100%). It does not guarantee that the rules improve results.
