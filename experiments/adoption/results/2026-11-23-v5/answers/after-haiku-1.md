**Verdict:** Adopt with conditions. Start with a pilot on a few people and one Claude Code version, and don't roll it out to the whole team yet.

**Reasons:**
- It solves the problem you describe. Each session and each subagent gets the rules for the model it actually runs on, and gets them again after `/model`, `/clear`, `/compact` and resumes. Your mix of Opus, Sonnet, Haiku, Fable and subagents is the case it was built for.
- Its delivery claim is measured and the measurement is published. In a benchmark of 300 random sessions, 3,219 of 3,221 requests with rules due held their model's rules (D2), and after fixes for F5 to F9, 0 of 300 sessions broke the invariant (D18). The raw results are in `experiments/delivery/results/`.
- It records deliveries. `noonsight report` lists what was sent to which model, so you can check it rather than trust it.
- Native alternatives cover less. On the same sequences, a user `CLAUDE.md` reached 87.3% of requests and 32.2% of subagent requests, `.claude/rules` 70.6%, and a skill per model 0%.
- It has no runtime dependencies and reads only local files. The hooks never block and never use the network, except the optional classifier.
- It has an explicit list of what it does not guarantee, which is a sign the claims were scoped with care.

**Conditions and risks:**
- **Pin the Claude Code version.** Every measurement is tied to a version. The latest checked is 2.1.330, and the changelog shows nine failures found and fixed in about a month. Confirm your team's Claude Code version is one the docs cover, and re-run `noonsight check` and `npm test` after each upgrade.
- **Install from a clone.** The npm package is only a placeholder, so each person runs `git clone`, `npm install && npm run build && npm link`. Track who has what version.
- **Install is account-wide.** `noonsight install` adds hooks to every Claude Code login of the account. On shared machines or accounts, this affects other people's sessions.
- **Attended Opus and Fable sessions get nothing by default.** The preset ships those rules off. Decide with the team whether to turn them on with `enable`, or accept that watched Opus and Fable sessions get no preset rules.
- **Sonnet and Haiku need scopes for most rules.** An attended Sonnet or Haiku session gets only `verify-changes`, and only after it edits a tracked code file, unless it runs with a scope. Set `NOONSIGHT_SCOPE` or use `noonsight run --scope`.
- **Set `session.unattended_when_env`** to your CI or orchestrator's variable. Otherwise, interactive sessions nobody watches are counted as attended. Headless runs now default to the unattended place, which changes what `claude -p` runs receive after an upgrade.
- **Known gaps:**
  - Agent teams, routing and the classifier are not measured.
  - A workflow's agents get nothing.
  - Foreground subagents of one type that need different rules get nothing until their first Edit, Write or agent call.
  - A plugin noonsight does not read leaves its subagents predicted on the parent's model.
  - A conversation compacted, then resumed with no model named, runs on Claude Code's default model, which noonsight cannot detect.
  - `CLAUDE_CODE_SESSION_ATTENDED` is undocumented by Anthropic, and if it changes, every session falls into the attended place.
- **Delivery is not obedience.** The rule-effect results are from small tasks with 30 to 40 runs per arm. `verify-changes` raised Sonnet's cost on a fix from about $0.024 to $0.05 per run. Measure the rules you care about before relying on them.
- **Project rules need trust.** Each person must run `noonsight trust` in a repository before its `.noonsight/noonsight.json` has any effect.
- **Classifier privacy.** If you turn on the classifier, the first 4,000 characters of each task go to a small model through the user's own Claude Code login. Decide whether that is acceptable for your code.
- **Evidence is self-reported.** The benchmark and the tests run against a local stand-in for the API, and the authors wrote them. I read the docs, changelog and results but did not run the test suite, so the pilot should check the claims on your own workloads.

**Pilot plan I'd suggest:** two or three people, one Claude Code version, a repository where you already know the right rules, and a week of `noonsight report` output. Check the report against what each session actually received. Expand only if the rules reach the sessions you expect.

**What it guarantees:** Each Claude Code session and subagent receives the rules written for the model it runs on, and gets them again when that model changes, as long as the hooks behave as recorded for the tested Claude Code version. That rests on the published delivery benchmark (300 sessions, local stand-in API, 0 breaches after fixes) and the fuzzer corpus, and it does not cover the unmeasured paths, the limits above, or whether the model follows the rules.
