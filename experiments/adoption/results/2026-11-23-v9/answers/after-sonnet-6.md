**Verdict: adopt with conditions.**

I read the README, `docs/evidence.md` and `docs/hooks.md`. I did not run `npm test` or any experiment, so the numbers below are the project's own, as committed and documented.

**Reasons**

- **It fits how you work.** It gives each session, and each subagent it starts, the rules written for the model that actually runs. You use four models and many subagents, which is the case it was built for. Subagents don't see the parent's conversation, and the README says a `CLAUDE.md` never reaches the built-in Explore and Plan subagents.
- **Delivery beat the native options on the benchmark.** The documented comparison (D19, D20, D25 to D29) used real interactive Claude Code sessions against a stubbed Messages API.

  | Method | All requests | Subagent requests |
  | --- | --- | --- |
  | noonsight | 3,090 of 3,090 | 763 of 763 |
  | User `CLAUDE.md` | 88.2% | 46.9% |
  | `.claude/rules` | 76.3% | 46.9% |
  | Skills | 0% | 0% |

- **It adds little context and no wrong-model rules.** It adds about 1,343 characters per request, against about 4,472 for a `CLAUDE.md` holding every model's rules. It left 0 requests holding another model's unretired rules, against 619 for the `CLAUDE.md`.
- **It is low-risk to run.** Hooks always exit 0 and never block. They use no network unless you turn on the optional classifier. They take 80 to 150 ms of CPU per run, measured on a loaded laptop. A bad configuration is refused whole with a warning. `NOONSIGHT_DISABLE=1` and `noonsight uninstall` turn it off.
- **The claims are honest and checkable.** The README lists its limits. Every number links to a raw result file, and a test recomputes each one. The project reports nine failures it found and fixed before the current run.
- **Some rule effects were measured.** For example, `verify-changes` made Sonnet 5.5 run tests after its last edit in 29 of 30 runs, against 0 of 30 without it, on one task. The README says these tasks are small.

**Conditions and risks**

- **Delivery depends on undocumented Claude Code behavior.** The README says so and ties each result to a version: delivery 2.1.330, rule effects 2.1.329, the paid pilot 2.1.326. Pin your team's Claude Code version, or re-run the live tests (`npm run test:live`) after upgrades. Claude Code changes hook behavior, and an upgrade could silently break delivery.
- **Don't expect better results on its own.**
  - Delivery is not obedience.
  - Only `verify-changes`, `carry-through` and `low-context-report` have measured effects. None of Opus 5.5's rules has one.
  - The paid pilot on public tasks showed no quality difference: 133 of 144 without rules, 132 under noonsight, 133 with a `CLAUDE.md`.
  - Rules raised cost per run in most measured cells, for example Sonnet on the fix at $0.0505 against $0.0240. Decide which rules are worth that.
- **The preset delivers little to Opus and Fable in interactive sessions.** Their attended-session rules ship off. You must `enable` them, and Fable's `code-ownership` raises output tokens by about 70 to 80 percent. Set `session.unattended_when_env` for interactive sessions nobody watches. Give Sonnet and Haiku sessions a scope, or most of their rules won't fire.
- **Known gaps for a subagent-heavy team:**
  - Workflow agents get nothing.
  - Foreground calls of one type that need different rules get nothing until the subagent's first Edit, Write or agent call.
  - Subagents from plugins noonsight doesn't read are predicted on their parent's model. That includes organization-synced plugins.
  - Agent teams in split panes are untested.
  - A compacted conversation resumed with no model named runs on Claude Code's default model, and noonsight can't tell which.
  - `/fork` is unavailable in sessions started with `noonsight run` and rules.
- **You will have to write your own rules.** The preset is a starting set. Per-repo rules need `noonsight trust` from each person.
- **The project looks small and single-maintainer.** It was renamed from "sextant". Check its maintenance and your team's tolerance for that.
- **Suggested rollout:** pilot on a few people, then run `noonsight report` and drop rules that never change anything you can see.

**What it guarantees**
Through Claude Code's hooks, noonsight puts the rules declared for a model into the requests of each session and subagent running on it, and again after a model change, compact, clear, resume or fork. That rests on a benchmark of 300 real interactive sessions on Claude Code 2.1.330 against a stubbed API, 0 of 299 broke the invariant, and it does not extend to whether a model follows a rule.
