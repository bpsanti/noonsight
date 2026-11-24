**Verdict:** Adopt with conditions. Pilot it on a few people first, and treat it as a delivery mechanism, not a quality improvement.

**Reasons:**
- **It fits how you work.** You mix Opus, Sonnet, Haiku and Fable and start many subagents. That is the case the README says it is for. It also says to skip the tool when every session runs one model, because a `CLAUDE.md` is simpler then (README, "Using it well").
- **Delivery is measured, and it beats the native options.**
  - **Setup of the test:** Real interactive Claude Code 2.1.330 sessions ran against a local stand-in for the API.
  - **noonsight's result:** Every request that was due rules held them: 3,090 of 3,090, including 763 of 763 subagent requests. 299 sessions completed, and none broke the invariant (D18–D20).
  - **Native alternatives:** On the first 60 sequences, a user `CLAUDE.md` reached 88.2% of requests, and only 46.9% of subagent requests. `.claude/rules` reached 76.3% overall and the same 46.9% for subagents. A skill per model reached 0%.
  - **Wrong-model rules:** `CLAUDE.md` and `.claude/rules` also put other models' rules into 619 and 622 requests with no note retiring them, against 0 for noonsight (D32).
  - **Caveats:** The `CLAUDE.md` numbers come from 60 sequences, not the full 300. No model answered in these runs, so they test delivery only (D25–D32).
- **It does not block anything and is easy to remove.**
  - **Safety:** The hooks always exit 0 and never deny a call. They read only local files, and the optional classifier is the only network use. A config with any problem is refused whole.
  - **Cost and removal:** Each hook costs about 80–150 ms of CPU (D33). `NOONSIGHT_DISABLE=1` or `noonsight uninstall` turns it off.
- **It is unusually honest about its limits.** The README lists known gaps, and every number links to a raw file that `npm test` recomputes. Nine of its own failures are documented and were fixed before the current run.
- **The measured effects on behaviour are real, but narrow and cost tokens.**
  - **`verify-changes` (Sonnet and Haiku):** On a one-file fix, runs that ran the tests after the last edit went from 0 of 30 to 29 of 30 on Sonnet and from 0 of 30 to 27 of 30 on Haiku. On a bug known only by its symptom, Sonnet went from 11 of 30 to 30 of 30. Sonnet's cost per run roughly doubled on the fix, from $0.0240 to $0.0505.
  - **`carry-through` (Sonnet):** Runs that did every part of a 13-ticket backlog went from 9 of 40 to 32 of 40.
  - **`low-context-report` (Fable):** Reports got shorter, at 12.3 against 16.4 words per sentence on the question task.
  - **Not measured:** No other preset rule, including any Opus rule, has a measured effect.
- **No quality gain is shown.** In a paid pilot on public tasks, 133 of 144 runs passed with no rules, 132 of 144 under noonsight and 133 of 144 with a `CLAUDE.md` (B1). That pilot ran on 2.1.326 and delivered rules to the main conversation only, not to subagents. Mean cost per run was $0.145 without rules and $0.155 under noonsight (B2).

**Conditions and risks:**
- **Decide whether you have model-specific rules to deliver.** The preset is a thin starting set. For Opus and Fable, the attended-session rules ship off, so an attended Opus or Fable session receives nothing until you `enable` a rule. Sonnet and Haiku attended sessions get most of their rules only with a scope. If you have no per-model rules of your own, you gain little.
- **Set `session.unattended_when_env`** for orchestrators and CI. Otherwise sessions nobody watches are treated as attended and miss the unattended rules.
- **Pin and re-verify the Claude Code version.**
  - **Dependence on undocumented behaviour:** It relies on hook behaviour that the docs say Claude Code does not document (forks, `ps` parsing, subagent metadata). Results hold for 2.1.330 only, and nothing says what a newer version does.
  - **What to do:** Pin the version for the team and run `noonsight report` and `npm run test:live` after each Claude Code upgrade.
- **Known delivery gaps that matter to you:**
  - **Workflow agents:** They get nothing.
  - **Concurrent subagents:** Concurrent calls of one type that need different rules get none until the subagent's first Edit, Write or agent call.
  - **Unread plugin subagents:** Subagents from plugins it does not read, such as organization-synced ones, are predicted on the parent's model.
  - **Unmeasured features:** Agent teams, routing and the classifier are not measured.
  - **Default model:** A compacted-then-resumed session on Claude Code's default model can't be identified.
  - **`/fork` in launcher sessions:** `/fork` doesn't work in sessions started by `noonsight run` with rules.
- **Expect extra token cost.** Fable's `code-ownership` rule raises output tokens by about 70–80%, by Anthropic's guide. Drop any rule whose effect you can't see.
- **Delivery is not obedience.** Check behaviour per model before you rely on a rule, because your own rules have no measured effect until you measure them.
- **Repository configs need trust.** Each person must run `noonsight trust` once in a repository before its `.noonsight/noonsight.json` applies. Review that file in pull requests like code, since it injects instructions into sessions.
- **Plan for provenance and cache.** It is a young, single-maintainer npm package, formerly called sextant, with no runtime dependencies. Install it globally rather than via `npx`, because a cleared npx cache silently stops delivery.
- **Pilot first.** Try two or three people for about two weeks and read `noonsight report` for rules that are on but never delivered.

**What it guarantees:** Through Claude Code's hooks, noonsight puts the rules you declared for a model into the requests of each session and subagent running on that model, and re-delivers them when the model changes or the conversation is compacted, cleared, resumed or forked. This rests on a 300-session benchmark of real Claude Code 2.1.330 sessions against a stand-in API, where all 3,090 requests that were due rules held them. It guarantees delivery, not obedience or better results, and only for the Claude Code version it was tested on.
