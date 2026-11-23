**Verdict: adopt with conditions.** Pilot it on a few people first, with the conditions below. I'm basing this on the README, `docs/evidence.md`, `docs/hooks.md` and the delivery experiment's limits. I haven't run it or the tests.

**Reasons**

- **It fits your setup.** Your team mixes Opus, Sonnet, Haiku and Fable and starts many subagents. noonsight's job is to give each session and each subagent the rules written for the model it actually runs on. That covers `/model` switches, `/compact`, `/clear`, resumes and forks.
- **The native options are weaker for this.**
  - A user `CLAUDE.md` reached only 32.2% of subagent requests, and `.claude/rules` the same (39 of 121), against 100% for noonsight ([D10](docs/evidence.md#d10)).
  - Only 31.5% of the rule text in a `CLAUDE.md` request was written for that request's model, against 79.0% under noonsight ([D12](docs/evidence.md#d12)).
  - A skill per model delivered 0 of 654 requests ([D8](docs/evidence.md#d8)).
- **The delivery claim is backed by evidence you can check.**
  - Every number links to an entry naming the raw file and how it is computed, and `npm test` recomputes them.
  - The first run had 1 failing session in 300. After fixes, the later run on Claude Code 2.1.330 had 0 of 300 failing and 100% coverage on 3,090 requests ([D18](docs/evidence.md#d18), [D19](docs/evidence.md#d19)).
  - The authors report their own bugs: nine failures, F1 to F9, are documented, with reproductions that fail on the unfixed build ([D24](docs/evidence.md#d24)).
  - One of the four fuzzer-found failures, F2, was the wrong model on resume. That is the kind of error that would hurt a mixed-model team.
- **The risk to a session is low.**
  - The hooks never block anything and always exit 0.
  - They use no network, except the optional classifier, which is off by default.
  - They have a 10-second timeout, and a median CPU cost of 50 to 90 ms per hook ([D15](docs/evidence.md#d15)).
  - A bad configuration is refused whole with a warning, rather than guessed at.
  - `NOONSIGHT_DISABLE=1` turns it off per session.
  - There are no runtime dependencies.
- **The claims are honest.**
  - It says delivery is not obedience.
  - It tells you it is not measured for agent teams, routing or the classifier.
  - It notes that your own rules have no measured effect until you measure them.

**Conditions and risks**

- **The default install does little on Opus and Fable.** Their attended-session rules ship off. An attended Opus or Fable session receives nothing from the preset until you run `enable`. Decide which rules you want, or write your own, and confirm with `noonsight models` and `noonsight resolve`.
- **Sonnet and Haiku rules mostly need a scope.** Most of their rules apply only with a scope (`NOONSIGHT_SCOPE` or `noonsight run --scope`). Attended sessions otherwise get only `verify-changes`, and only after an edit to a tracked code file. If you don't set scopes, you will get less than you expect.
- **Rules cost money.** `verify-changes` roughly doubled Sonnet's cost on a small fix, from $0.0240 to $0.0505 ([R6](docs/evidence.md#r6)). Where the models already did the work, the rules changed nothing and still cost a little. The effect data covers only the preset's rules, on small tasks with 30 to 40 runs per arm. Plan your own measurement for any rule you write.
- **Unattended sessions need setting up.** Set `session.unattended_when_env` for interactive sessions nobody watches. Headless runs are treated as unattended by default.
- **It tracks undocumented Claude Code behavior.**
  - It depends on hook behavior Claude Code doesn't document, such as the `CLAUDE_CODE_SESSION_ATTENDED` variable, fork internals and subagent metadata files.
  - Each fact was checked on a specific version, mostly 2.1.325 to 2.1.330. Re-run `noonsight check` and the tests whenever you upgrade Claude Code, and pin versions for the pilot.
  - If Claude Code changes, deliveries could fail silently or the hooks could warn. They won't block work.
- **Known gaps.**
  - Workflow agents get nothing.
  - Subagents from plugins noonsight doesn't read, such as organization-synced ones, are predicted on their parent's model.
  - Foreground calls of one type needing different rules get nothing until the subagent's first Edit, Write or agent call.
  - A compacted, resumed conversation with no response since runs on Claude Code's default model, which noonsight can't tell.
  - Agent teams in split panes (tmux) were not checked.
  - Routing and the classifier were not measured, so leave both off.
- **The test harness is a stand-in.** The benchmark used a local stand-in for the API. No request reached a model, and the reference is noonsight's own resolver. A wrong resolution would not show up there, only a wrong delivery.
- **Maturity.** It's version 0.1, not on npm, and installed from a clone. It was renamed from sextant, and the evidence is from 2026-11-19 to 2026-11-23. The maintenance record is short, and the project is a single-author repo (bpsanti). Expect to pin a commit and review upgrades. Preset updates already go through `preset_version` and `noonsight accept`.
- **Repo rules need a trust step.** Project-level rules need each person to run `noonsight trust` once, and nothing applies until then. Treat a committed `.noonsight/noonsight.json` as code that shapes your models' instructions, and review changes to it.
- **If most of your sessions run one model**, a `CLAUDE.md` is simpler, as the README itself says.

**What it guarantees**

It guarantees that each Claude Code session and subagent gets the rules declared for the model it runs on, and gets them again when that model changes, on 100% of the 3,090 requests with rules due in the latest local-stub fuzz run on Claude Code 2.1.330 (0 of 300 sessions broke the invariant), and it does not guarantee the model follows them. The guarantee rests on the hooks it installs and its own decision log, and it is verified against a stand-in API, a fixed Claude Code version and its own resolver.
