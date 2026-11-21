**Verdict: adopt with conditions.**

The delivery claim is well supported and fits your setup (mixed models, many subagents). Whether the rules improve your work is much less established. I read the README, `docs/hooks.md`, `docs/evidence.md`, `docs/usage.md` and the delivery benchmark README. I did not run the tool or the tests, so every number below is the project's own.

**Reasons**

- **It fits your setup.** It delivers per-model rules at session start, after `/model`, `/compact`, `/clear` and resume, and to subagents through `SubagentStart` (`docs/hooks.md`). A subagent can run on a different model from its parent, and noonsight predicts that model.
- **Native options are weak where you are exposed.**
  - On the same 60 session sequences, a user `CLAUDE.md` covered 87.3% of requests and only 32.2% of subagent requests (D6, D10).
  - `.claude/rules` covered 70.9% (D7), and a skill per model covered 0% (D8).
  - A `CLAUDE.md` was fine for the session's own conversation (100%, D17), so the gap is subagents plus other models' rules leaking in.
  - Noonsight covered 99.5% overall (3,199 of 3,216 requests, D2) and 99.9% of subagent requests (667 of 668, D3).
- **The evidence is checkable.**
  - Every number in the README links to an evidence entry naming its raw file, and `npm test` recomputes each one.
  - The benchmark runs real interactive Claude Code sessions against a local stand-in for the API, with seeded fuzzing and self-checks that plant failures.
  - The author reports four failures the fuzzer found (F1–F4) instead of hiding them.
- **It is low-risk to run.**
  - The hooks never block or deny a call, always exit 0, and use no network. The one exception is the optional classifier, which is off by default.
  - Hook cost is about 60–120 ms of CPU per run (D15).
  - Every decision is logged, and `noonsight report` and `noonsight uninstall` are provided.
  - There are no runtime dependencies.
- **The effect of the rules is real but narrow and costs money.**
  - On Sonnet 5.5, `verify-changes` raised test-running after a one-file fix from 0/30 to 29/30, and `carry-through` raised full backlog completion from 9/40 to 32/40.
  - Haiku's `carry-through` showed no effect (6/40 against 2/40, R11).
  - `verify-changes` roughly doubled the cost of a cheap task ($0.0240 to $0.0505 on Sonnet, R6).
  - The samples are 30–40 runs on small tasks, and the README says to read them that way.

**Conditions and risks**

- **Pin a Claude Code version and re-verify on upgrades.**
  - The tool relies on hook behaviour that Claude Code changes. The benchmark was run on 2.1.328 and the rule experiments on 2.1.328–2.1.329.
  - `docs/verification/claude-code.md` lists the facts it depends on. Run `npm run delivery -- corpus` on each new version.
  - Your team's version needs to be one of those verified versions or close to it.
- **It is not published.** The README says 0.1 is not on npm, and `package.json` is `0.0.1` and `private`. You would install from a git clone, so decide who owns the build and updates. This is a young, single-author project (MIT).
- **The headline rate is not for the current build.**
  - The 99.5% was measured before the F3 and F4 fixes, and the 300 random sessions have not been re-run since. Three of 300 sessions failed, and F3 and F4 are what the README says explains them.
  - Ask them to re-run the fuzz, or run it yourselves (`npm run delivery -- fuzz --n 300`), before relying on the number.
- **Delivery is not obedience.** A delivered rule is context only, and the README says so. For rules that must never be broken, use hooks or permission rules.
- **The preset does little without scopes.** A session with no task scope gets almost nothing from it. You must set `NOONSIGHT_SCOPE` or `session.unattended_when_env`, and write your own rules. Budget some time to do that and to prune rules that show no effect in `noonsight report`.
- **The benchmark does not cover several things you may use.**
  - It did not measure `/resume` inside a session, forks, plan mode, agent teams, `noonsight run`, routing, the classifier, project configs, or subagents that edit files.
  - Plugin subagents, `--agents`, and agent-team teammates are not seen by the subagent hooks.
  - If you use any of these, pilot them first. Leave routing and the classifier off.
- **Some model detection is unreliable.**
  - Cases with a known gap include a compacted conversation resumed with no model named, `default` and `opusplan` aliases, and Bedrock or Vertex without pinned model variables.
  - On macOS the command line is read through `ps`, so a prompt containing `--model x` can confuse it. Unknown models produce a warning and no rules.
- **Machine-wide state and settings.** It edits your Claude Code settings on install, keeps state under `~/.local/state/noonsight`, and cannot work where managed settings forbid user hooks. `noonsight check` reports this.
- **Suggested pilot:** one or two people for about two weeks, on a pinned Claude Code version. Compare `noonsight report` and `noonsight check` output with your own judgment of whether subagents got the right rules. If your team ends up on one model with fixed rules, a `CLAUDE.md` is simpler, and the docs say the same.

**What it guarantees**

Noonsight guarantees that the rules written for a model reach that model's requests (session and subagents) through Claude Code's own hooks, across `/model`, `/compact`, `/clear` and resumes. The support is a seeded fuzz benchmark of real Claude Code sessions against a local stand-in for the API (99.5% of requests with rules due, on 2.1.328, before the F3 and F4 fixes). It does not guarantee that the model follows the rules.
