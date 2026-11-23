**Verdict: adopt with conditions.** I read the README, `docs/hooks.md`, `docs/evidence.md` and `docs/usage.md`. I did not run the tool or the test suite, so what follows rests on the project's own documentation and recorded results.

**Reasons**

- **It fits your setup.** You mix Opus, Sonnet, Haiku and Fable and start many subagents. The tool delivers rules written for the model a session actually runs on, and again after `/model`, `/compact`, `/clear` and resumes. It does the same for each subagent, which does not see the parent conversation (`docs/hooks.md`, "Subagents").
- **Delivery is well measured.** In a harness that fakes the API, 299 of 299 random sessions on Claude Code 2.1.330 held the invariant. 100% of 3,090 requests with rules due had them, including 763 of 763 subagent requests (D18–D20). An earlier run on 2.1.328 had 1 failing session of 300, a documented limit (D1, D2). The fuzzer's nine found bugs (F1–F9) were fixed, and their reproductions are kept as regression tests.
- **It beats the native options on your use case.**

  | Rules kept in | Requests with their rules | Subagent requests with their rules |
  | --- | --- | --- |
  | noonsight | 100% | 100% |
  | User `CLAUDE.md` | 87.3% | 32.2% |
  | `.claude/rules` | 70.6% | 32.2% |
  | One skill per model | 0% | 0 of 121 |

  A `CLAUDE.md` also puts every model's rules in front of every model; only 31.5% of its rule text was written for the model reading it (D12).
- **It is low-risk to run.** It never blocks a call, never uses the network (the classifier is off by default) and has no runtime dependencies. A hook run costs 50 to 90 ms of CPU (D15). `NOONSIGHT_DISABLE=1` and `noonsight uninstall` switch it off, and a bad configuration is refused whole with a warning. `noonsight report` shows what was delivered.
- **The documentation is unusually honest.** Its limits are stated openly. Every number links to a raw result file, and the tests recompute the numbers.

**Conditions and risks**

- **Where it applies.** Adopt it only if sessions really switch models or use subagents with different needs. If everyone ran one model, the project's own advice is to use `CLAUDE.md` (`docs/usage.md`, "When not to use").
- **Nothing happens right after install on Opus and Fable.**
  - **Opus and Fable:** their attended-session rules ship off, so an interactive session gets nothing until you turn rules on with `enable` or write your own.
  - **Sonnet and Haiku:** they get `verify-changes` only after editing a tracked code file, and other rules only with a scope. Plan the rules you want before rollout.
  - **Unattended sessions:** set `session.unattended_when_env` for interactive sessions nobody is watching.
- **Delivery is not obedience.** A delivered rule is only context. If something must never happen, use a hook or a permission rule.
- **Measured rule effects are narrow.** The measured effects of the preset's rules come from small tasks with 30 to 40 runs per arm.
  - **Cost:** `verify-changes` roughly doubled Sonnet's cost on one fix, from $0.0240 to $0.0505 (R6).
  - **Haiku:** its `carry-through` showed no effect (R11).
  - **Your own rules:** they have no measured effect until you measure them.
- **Dependence on undocumented Claude Code behaviour.** It relies on undocumented behaviour, including the forking internals, `CLAUDE_CODE_SESSION_ATTENDED` and the transcript layout. All of it was verified on 2.1.325 to 2.1.330 only (`docs/verification/claude-code.md`).
  - **Updates:** a Claude Code update could silently break delivery, so pin or stage Claude Code versions and re-run `npm test`.
  - **Check regularly:** use `noonsight report` and `noonsight check` to catch drift.
- **The test API was fake.** No request reached a real model, so real-world behaviour such as API changes and auto mode is covered less. Agent teams, routing and the classifier are not measured.
- **Known gaps.**
  - **Workflow agents:** they get nothing.
  - **Concurrent subagent calls:** foreground calls of one type needing different rules get nothing until the subagent's first Edit, Write or agent call.
  - **Unread plugins:** subagents from a plugin it doesn't read, such as an organization-synced one, are predicted on their parent's model.
  - **Unknown model after compaction:** a compacted conversation resumed with no model named runs on the default model, which it can't identify.
  - **`/fork` limits:** `/fork` is unavailable in `noonsight run` sessions.
  - **Shell edits:** edits made through the shell don't reveal the `code-edit` trigger.
- **Maturity.**
  - **Install:** version 0.1 is not on npm, so you install from a clone with `npm link`.
  - **Project age:** it is a young project with a single maintainer and has been renamed once (it was called sextant).
  - **Third-party code:** you would be running it in every session's hooks, so review the code before rollout, and let the repository-level `noonsight trust` prompt guard committed project rules.
- **Do a pilot first.** Run it for a short time on a few people, check `noonsight report` for rules that are never delivered, and drop any rule whose effect you can't see.

**What it guarantees:** For each model on its rules list, each Claude Code session and subagent receives that model's rules (and none of another model's, unretired) at the points the hooks can see. That rests on Claude Code's hooks and was measured on 2.1.328 to 2.1.330 against a stand-in API, so it guarantees delivery only, not that the model follows the rules.
