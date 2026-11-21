**Verdict:** Adopt with conditions. Run it as a pilot on a few machines first, with the conditions below.

**Reasons:**
- **Subagents are the main gap it closes.** Your team starts many subagents. In the repo's delivery benchmark, a `CLAUDE.md` reached 32.2% of subagent requests (39 of 121), and `.claude/rules` reached the same. noonsight reached 99.9% (667 of 668) under the same benchmark (`docs/evidence.md` D3, D10). Subagents don't see the parent conversation, so a `CLAUDE.md` alone doesn't cover them.
- **It covers all four models you use.** It ships a preset for Fable 5.2, Opus 5.5, Sonnet 5.5 and Haiku 5.5, and it re-delivers rules when `/model` changes the model. Mixed-model use is the case it was built for.
- **The design is conservative.** Hooks never block or deny a call, always exit 0, and make no network calls. A bad configuration is refused whole with a warning, not guessed at. `NOONSIGHT_DISABLE=1` turns it off per session.
- **It is auditable.** `noonsight report` and `noonsight models` show what each model received and what was delivered, so you can check it instead of trusting it.
- **There is some evidence the rules change behavior.** On a small one-file fix, Sonnet ran the tests after the edit in 30 of 30 runs with the `verify-changes` rule and 0 of 30 without it. Haiku did 27 of 30 vs 0 of 30 (R1, R3). These are small tasks with 30–40 runs per arm, so read them as narrow results.

**Conditions and risks:**
- **Pin and test your Claude Code version.** The benchmark ran on Claude Code 2.1.328, and the hook behavior it relies on is checked per version (`docs/verification/claude-code.md`). Before wide rollout, confirm the version your team uses matches a tested one, or run `npm run test:live` against it.
- **Known open failures.** F3 (two resumes with `--model` and no request between them) and F4 (resume after `/model` switch from Sonnet to Haiku) were fixed after the 300-session run. The committed 99.5% is for the pre-fix build, so the fixed build's rate is unmeasured. Both are rare-looking but real.
- **Unmeasured paths.** The repo says it did not measure `/resume` inside a running session, forks, plan mode, agent teams, `noonsight run`, routing, the classifier, project configs, or subagents that edit files. If your team uses any of these, treat them as unverified.
- **Opus has no rule-effect data.** Its rule was left out of the effect experiment because its signal could not be told apart on short tasks, and running it was too expensive. Opus delivery is measured, but whether its rules change what it does is not.
- **Delivery is not obedience.** A delivered rule is context, and the model may still not follow it. Measured effects are task-specific.
- **Cost.** It adds about 1,150 characters per request. On Sonnet, `verify-changes` roughly doubled per-run cost ($0.024 to $0.05) on the one task measured (R6). Check your own spend after rollout.
- **Shell edits are invisible to its triggers.** Edits made through `sed -i` or Bash redirection, and edits in notebooks, don't reveal the code-edit trigger. Subagent edits don't either.
- **Install is manual.** Version 0.1 is not on npm, so each person installs from a clone with `npm install && npm run build && npm link`. It is per-account config in `~/.config/noonsight/`, and the classifier is off by default. If you turn on the classifier, the first 4,000 characters of a task go to a model through the person's own Claude Code login.
- **Team-wide consistency.** Rules live per account and per repo (`.noonsight/noonsight.json`, trusted per person). Make sure everyone has the same preset version and the same project config, or results will differ across people.

**Suggested pilot:** Install on 3 to 5 machines, use Sonnet, Haiku and Opus sessions that start subagents, and run `noonsight report` after a week. Check that subagent coverage looks like the benchmark and that the `MISMATCH` results from the subagent check are rare. Expand only if they are.

**What it guarantees:** noonsight guarantees that each Claude Code session and each subagent it starts receives the rules for the model it runs on, and that rules for other models are retired after a switch, as measured in 300 simulated sessions (99.5% of requests with rules due had them, 3 of 300 sessions failed) on Claude Code 2.1.328. That rests on the hook events and input fields Claude Code documents, which the repo checks against recorded fixtures for versions 2.1.325 to 2.1.328, and on the decision log it writes. It does not guarantee that a model follows the rules, and the benchmark ran against a local stand-in API, not a real model.

*Note:* I read the repo's README and the docs for evidence, hooks and delivery limits. I did not run its test suite, so the numbers above are what the repo reports, not what I reproduced.
