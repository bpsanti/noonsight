**Verdict: adopt with conditions.**

I read the README and `docs/evidence.md`, and part of `docs/hooks.md`. I did not run the tool, the tests or the benchmarks. Every number below is the project's own, taken from its evidence map.

**Reasons:**
- **It fits your setup.** It delivers each session's and each subagent's rules for the model that actually runs, and delivers them again after `/model`. Your mix of Opus, Sonnet, Haiku and Fable with many subagents is the case it was built for.
- **Delivery is well measured.**
  - In 299 real interactive Claude Code sessions, with only the API stubbed locally, 0 broke the invariant (D18). Requests held their rules 3,090 of 3,090 times, and subagent requests 763 of 763 (D19, D20).
  - The evidence map says `npm test` recomputes each published number from the raw result files.
- **The native alternatives do worse on your pattern.**
  - A user `CLAUDE.md` reached 88.2% of requests and only 46.9% of subagent requests (D25, D28). It never reaches the built-in Explore and Plan subagents.
  - `.claude/rules` reached 76.3%, and a skill per model reached 0% (D26, D27).
  - A `CLAUDE.md` also hands every model the other models' rules. Only 32.6% of its rule text was written for the request's model, against 78.6% under noonsight (D30).
- **It is low-risk to operate.**
  - Its hooks always exit 0 and never block anything.
  - They use no network, apart from an optional classifier that is off by default.
  - There are no runtime dependencies, and the code is MIT-licensed.
  - Each hook run costs 80–150 ms of CPU, measured on a loaded laptop (D33).
  - `NOONSIGHT_DISABLE=1` turns it off for a session, and `noonsight uninstall` removes it.
  - `noonsight report` shows what was actually delivered.
- **The project is candid about its limits.** It lists nine failures the benchmark found and fixed, and it states what it does not measure.

**Conditions and risks:**
- **Out of the box, attended sessions on Opus and Fable get nothing.** All of the preset's attended rules for those two models ship off. You must turn on what you want with `enable`.
  - Sonnet and Haiku attended sessions only get `verify-changes`, and only after editing a tracked code file. Their other rules need a scope.
  - Headless runs are the exception. They are unattended by default and do get preset rules.
  - Set `session.unattended_when_env` for interactive sessions nobody watches.
- **Delivery is not obedience.** A delivered rule is only context.
  - Measured effects exist for just three preset rules:
    - `verify-changes` on Sonnet and Haiku.
    - `carry-through` on Sonnet.
    - `low-context-report` on Fable.
  - Haiku's `carry-through` showed nothing, and no Opus rule has a measured effect.
  - Those results come from small tasks with 30–40 runs per arm.
  - A paid pilot on public tasks found no difference in pass rate: 133, 132 and 133 of 144 for no rules, noonsight and `CLAUDE.md` (B1).
  - So expect little change in outcomes unless your own rules are good. Any rule you write has no measured effect until you measure it.
- **Some rules add cost.** `verify-changes` roughly doubled the cost of a small Sonnet fix, from $0.0240 to $0.0505 (R6).
- **It is measured on one Claude Code version at a time.** The delivery claim holds for 2.1.330, and the rule-effect runs are on 2.1.329 and 2.1.328. It depends on hook behaviour that Claude Code can change, so pin or re-verify after upgrades. Run `noonsight report` and the project's live tests whenever you upgrade.
- **Subagent gaps.**
  - A workflow's agents get nothing.
  - Foreground calls of the same type that need different rules get no rules until each subagent's first Edit, Write or agent call.
  - Plugins that noonsight does not read, such as organization-synced ones, leave their subagents predicted on the parent's model.
  - If you use agent teams, routing or the classifier, note that these are not covered by the delivery benchmark.
- **Further limits.**
  - A compacted-then-resumed session with no model named can get the wrong model's rules.
  - `/fork` is unavailable in sessions started with `noonsight run`.
  - Edits made through the shell, such as `sed -i`, don't trigger the `code-edit` rules.
- **It is early-stage software.**
  - Version 0.1 is not on npm. You install from a git clone, and the npm name holds an empty placeholder.
  - It has a single maintainer, and it was renamed from "sextant".
  - A hook that runs on every session and subagent is a supply-chain surface, so review the code and pin a commit.
- **Repository configs need trust.** Each person must run `noonsight trust` once per repository, and until then the repo's file changes nothing.
- **Pilot first.** Try it for a couple of weeks on a few machines. Write the rules you care about, enable the Opus and Fable attended rules if you want them, and check `noonsight report` for rules that are on but never delivered.

**What it guarantees:** For Claude Code 2.1.330, every request with rules due carried its model's rules and no other model's unretired rules, measured on 299 completed random sessions with 0 violations and 3,090 of 3,090 requests covered. That rests on Claude Code's own hooks and on a benchmark that drives real interactive sessions against a stubbed API, and it says nothing about whether the models then follow the rules.
