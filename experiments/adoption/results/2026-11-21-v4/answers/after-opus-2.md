**Verdict: adopt with conditions.** Run it as a time-boxed pilot on a few machines first, not a team-wide rollout.

**Reasons**

1. **It solves a real problem you have.** On your mix of models, the built-in options deliver rules badly. In the tool's benchmark, a user `CLAUDE.md` reached only 32.2% (39 of 121) of subagent requests. It never reaches the built-in Explore and Plan subagents. It also sends every model the other models' rules: only 31.5% of the rule text in a request was meant for that request's model. Under noonsight that figure was 79.0%, and subagent coverage was 100% (668 of 668) (`docs/evidence.md` D3, D10, D12).
2. **The delivery claim is unusually well backed.** It covers 300 randomized sessions through `/model`, `/compact`, `/clear`, resumes and subagents. It reached 99.9% of the requests that had rules due (3,219 of 3,221). The one failing session is a documented limit. The fuzzer found four bugs (F1 to F4), and all were fixed and re-measured (`experiments/delivery/results/claude-code-2.1.328/2026-11-21-d5fd71f/README.md`). Every number links to a raw file that `npm test` recomputes.
3. **The risk to your sessions is low.** The hooks never block or deny anything and don't use the network; the optional classifier is the one exception. The tool has no runtime dependencies. `NOONSIGHT_DISABLE=1` turns it off for a session and `noonsight uninstall` removes it. Each hook run takes 50 to 90 ms of CPU (D15).
4. **Why not adopt outright:**
   - It is version 0.1 and not on npm, so you install it from a git clone.
   - All of its history falls in one week (Nov 14 to 21).
   - The whole result rests on one Claude Code version, 2.1.328, and on an undocumented environment variable (`CLAUDE_CODE_SESSION_ATTENDED`).
5. **Out of the box, the preset does little for your interactive sessions.** A watched Opus 5.5 or Fable 5.2 session gets nothing. A watched Sonnet or Haiku session gets one rule (`verify-changes`) after a code edit; its other rules need a scope (README "What it does not guarantee"). Real value requires you to write rules or set up scopes.

**Conditions and risks**

- **Claude Code version:** Pin a Claude Code version and rerun `npm run delivery -- corpus` on it before upgrading. Hook behaviour changes between versions. By the time of the benchmark run, 2.1.330 was already out and hadn't been benchmarked.
- **Model settings:** Don't use the `default` or `opusplan` model settings, or third-party providers (Bedrock, Vertex, Foundry) without the pinning variables. In those cases noonsight can't tell the model and only warns (`docs/hooks.md:92-94`).
- **Unmeasured features:** Several things you may use were never measured: agent teams (teammates get nothing, `docs/hooks.md:262`), forks, plan mode, `/resume` inside a session, subagents that edit files, project-level configs and the classifier.
- **Parallel subagents:** Parallel subagents of the same type that need different rules get **no rules** (`docs/hooks.md:256`). A subagent held on a permission prompt also gets no rules (line 266). Your teams use subagents heavily, so expect to hit this.
- **Monitoring:** `noonsight report` can overstate delivery. It records what the hook returned, not what reached the model, and in the benchmark it showed 100% while the actual figure was 99.9% (S4). Treat it as an upper bound.
- **What to measure:** The rule-effect evidence is narrow. One clear win is `verify-changes` making Sonnet and Haiku run the tests. Haiku's `carry-through` showed no effect, and the rules add cost: about 2× per run on one Sonnet task (R6). Any rule you write yourself has no measured effect until you test it.
- **Install footprint:** Installing adds hooks to every Claude Code login of each person's account. Get the owners' agreement and keep the uninstall command at hand.

**What it guarantees:** It doesn't promise the model will follow the rules. It only promises that each session and subagent receives its own model's rules, and nothing else unretired, on about 99.9% of requests. That rests on a stub-based benchmark of preset rules on Claude Code 2.1.328, plus a list of hook behaviours checked on 2.1.325 to 2.1.330 that any Claude Code update could change.
