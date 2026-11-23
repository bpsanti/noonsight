**Verdict: adopt with conditions.** Run it as a pilot on pinned versions. Don't roll it out to the whole team by default yet.

**Reasons**

1. **It fixes a real gap in your setup: subagents.** In the tool's own benchmark, a `CLAUDE.md` delivered the rules on 100% of main-session requests (526 of 526). But it reached only 32% of subagent requests (39 of 121), and it gives every model every other model's rules. noonsight reached 100% of subagent requests (763 of 763) on Claude Code 2.1.330. With mixed models and heavy subagent use, this is the one case where it does better than what you already have.
2. **It's very young.** `package.json` says version `0.0.1` and `"private": true`. It isn't on npm, so you install it from a git clone. All the results are dated 2026-11-16 to 2026-11-23. The benchmark found nine delivery failures (F1–F9), and the last five were fixed and measured today, 2026-11-23. The 0-of-300 result for that build hasn't been repeated.
3. **It depends on Claude Code internals that aren't documented.** These include `CLAUDE_CODE_SESSION_ATTENDED`, `forkedFrom` in transcripts, the `state.json` of background jobs, the `toolUseId` in subagent `.meta.json`, and the transcript format. Each was checked only on versions 2.1.325 to 2.1.330 (`docs/verification/claude-code.md`). If a Claude Code update changes one of them, rules can stop arriving or go to the wrong model. The decision log can't show this, because it records what the hook returned, not what reached the model.
4. **The default preset gives most of your sessions very little.** Attended sessions on Opus 5.5 or Fable 5.2 get nothing, because those rules ship off. Attended Sonnet and Haiku sessions get only `verify-changes`, and only after they edit a code file git tracks. Most other scoped rules never fire unless someone sets `NOONSIGHT_SCOPE`. The value is in your own model-specific rules, and in subagents and headless runs.
5. **The measured effects are narrow and cost money.** `verify-changes` works: tests were run 29 of 30 times with it versus 0 of 30 without. It also roughly doubled Sonnet's cost on a small fix, from $0.024 to $0.0505. Several rules showed no measurable effect, and the samples are 30–40 runs on small tasks.
6. **Known gaps hit subagent-heavy teams.** A workflow's agents get nothing. Several parallel calls of the same subagent type that need different rules get nothing until each subagent's first Edit, Write or agent call. Plugins your organisation syncs aren't read, so their subagents are predicted on the parent's model. Agent teams, routing and the classifier were never benchmarked.

**Conditions and risks**

- **You actually have rules that differ by model.** If everyone would get the same rules, the README itself says to use `CLAUDE.md` instead.
- **Pin both versions.** Pin the noonsight commit and the Claude Code version. Run the corpus (`npm run delivery -- corpus`) before allowing any Claude Code upgrade, and treat a failure as a reason to stay on the old version.
- **Leave routing and the classifier off.** Routing rewrites agent calls, and in auto mode the other agent calls in the same response are refused until Claude makes them again. The classifier sends up to 4,000 characters of each task to a model using your login.
- **Check your organisation's Claude Code settings first.** If your organisation pushes settings from the admin console, Claude Code ignores the machine-wide (`--managed`) install. If it sets `allowManagedHooksOnly`, the per-account install is blocked. Run `noonsight check` on a real team machine before going further.
- **Write rules that are safe to receive.** Delivery isn't obedience. Each rule's effect is unmeasured until you test it, and rules add cost.
- **Ways it could go wrong:**
  - A Claude Code update silently breaks delivery. The tool's warning on a model mismatch covers only part of this.
  - A fork started with `--continue` can pick up the wrong original conversation if another session in the same project writes its transcript at the same moment.
  - On macOS, prompt text containing `--model x` can't be told apart from the real flag. The tool warns rather than guessing.
  - The hooks add 50–90 ms of CPU per run.
  - The decision log in your home directory records file paths.
- **Pilot plan:** a few volunteers across all four models for 2–3 weeks. Compare `noonsight report` with what you expected each model to get, and watch for MISMATCH warnings.

**What it guarantees:** It promises delivery, not behaviour: each request should carry the rules that noonsight's own resolver picks for the model it really runs on, with notes retiring other models' rules. That promise rests on a benchmark against a fake local API (no real model) on one Claude Code version (2.1.330, 0 of 300 sessions failing), on undocumented Claude Code behaviour re-checked one version at a time, and on noonsight's resolver serving as its own reference.

I only read the docs, code layout and committed results. I didn't run the tests or the benchmark, so all the numbers above are the project's own claims.
