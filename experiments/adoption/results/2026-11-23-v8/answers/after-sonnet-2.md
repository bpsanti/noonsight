**Verdict: adopt with conditions.** Pilot it on a few machines first. Don't roll it out to everyone yet.

I read the README, `docs/evidence.md`, `docs/hooks.md` and `docs/install.md`. I did not run `npm test` or the benchmarks, so every number below is the author's own, as recorded in the repo.

**Reasons**

- **It fixes a real gap for your setup.** It delivers instructions per model, to sessions and to subagents. The author's measurements show the native options missing some of them:

  | Mechanism | Requests with their rules | Subagent requests with their rules |
  | --- | --- | --- |
  | noonsight | 3,090 of 3,090 | 763 of 763 |
  | User `CLAUDE.md` | 88.2% | 46.9% |
  | `.claude/rules` | 76.3% | 46.9% |
  | A skill per model | 0% | 0 of 128 |

  A `CLAUDE.md` also puts other models' rules into every request. Only 32.6% of its rule text was written for the model running, against 78.6% under noonsight (D30, D32).
- **The tests behind that claim are careful.** They use real interactive Claude Code sessions with a local stand-in for the API. They cover `/model`, `/compact`, `/clear`, resume, fork, plan mode and subagents. The author found and fixed nine of their own failures, and the reproductions are kept in a corpus. `npm test` recomputes every README number from the raw result files.
- **It is low-risk to run.** It never blocks a call and never uses the network. The one exception is the optional classifier, which is off by default. Each hook takes about 80 to 150 ms of CPU. It has no runtime dependencies, `noonsight uninstall` removes it, and `NOONSIGHT_DISABLE=1` turns it off for one session. A decision log shows what was delivered.
- **The effect on model behaviour is narrow.** Only three preset rules have a measured effect:
  - `verify-changes` on Sonnet and Haiku: tests were run in 29 of 30 and 27 of 30 runs, against 0 of 30 without it. It about doubles the cost of a small fix, $0.0240 to $0.0505 on Sonnet.
  - `carry-through` on Sonnet.
  - `low-context-report` on Fable.
- **The paid benchmark pilot showed no gain on public tasks.** Tasks passed 133 of 144 without rules, 132 of 144 with noonsight and 133 of 144 with a `CLAUDE.md`. The value for you is delivering your own team rules reliably, not the preset's.
- **It does little by default for part of your mix.** All of Opus 5.5's and Fable 5.2's attended rules ship off. An attended Opus or Fable session gets nothing from the preset until you run `enable`.

**Conditions and risks**

- **Pin and test the Claude Code version.**
  - The delivery claim was measured on 2.1.330 only.
  - It relies on behaviours Claude Code doesn't document: fork detection, `/fork` background jobs, subagent metadata, and `CLAUDE_CODE_SESSION_ATTENDED`.
  - A Claude Code update can break delivery silently. Because the hooks always exit 0, the failure would show up only in `noonsight report`.
  - Before each upgrade, rerun the live tests (`npm run test:live`) or at least `noonsight check` and `report`.
- **Install from a clone and pin the commit.**
  - Version 0.1 isn't on npm, and the package name holds an empty placeholder.
  - It is a young, single-maintainer project (the author's changelog shows it renamed from sextant).
  - It adds a hook to every session on the machine, and the hook runs code from your clone. Review the code and keep your own fork or pin.
- **Write your own rules and measure them.**
  - Delivery is not obedience, and a rule you write has no measured effect until you measure it.
  - Rules that don't change anything you can see should be dropped.
  - Decide what goes in noonsight and what stays in `CLAUDE.md`. Per the README, `CLAUDE.md` is fine for rules every model should always have, except in Explore and Plan subagents, which it never reaches.
- **Set the place and scope correctly.** Interactive sessions that nobody watches, such as CI or orchestrators, count as attended unless you set `session.unattended_when_env`. Sonnet and Haiku scoped rules need `NOONSIGHT_SCOPE`.
- **Subagent gaps matter for you.**
  - A workflow's agents get no rules.
  - Plugin agents from plugins noonsight doesn't read are predicted on the parent's model.
  - Parallel calls of one type needing different rules get nothing until their first Edit, Write or agent call.
  - Agent teams in split panes, routing and the classifier are not measured.
  - Check `noonsight report` for `calls-differ` and `MISMATCH` entries.
- **Other limits.**
  - Compaction followed by a resume with no model named runs on Claude Code's default model, which noonsight can't identify.
  - `/fork` is unavailable in `noonsight run` sessions that carry rules.
  - Windows isn't supported.
  - Server-managed or organisation hook policies can disable it. `noonsight check` reports these cases.
- **Test coverage is partial.** The benchmark's sessions drew on "random sessions on the four models", with a stand-in API. No real model answered, so it shows requests carried the rules, not what the model did with them.

**What it guarantees**

It guarantees that every request from a session or subagent on a declared model, where rules are due, carries that model's rules and no other model's unretired rules: 3,090 of 3,090 requests on Claude Code 2.1.330. This rests on the tool's hooks, a decision log, and a benchmark of real Claude Code sessions against a stand-in API on that one version. It is not a guarantee of obedience, and it is not a guarantee on other Claude Code versions.
