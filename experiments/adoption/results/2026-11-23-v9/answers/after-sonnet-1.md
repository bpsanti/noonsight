**Verdict:** Adopt with conditions. Pilot it first, and only the delivery part: noonsight delivers per-model rules reliably. Whether the rules help your tasks is a separate question that you should test yourselves.

**Reasons:**
- **It fits your setup.** It sends each session and each subagent the rules written for the model it is actually running on, and it re-sends them when the model changes. A single `CLAUDE.md` can't do this across Opus, Sonnet, Haiku and Fable with many subagents.
- **Delivery held up in the benchmark.** It ran on real interactive Claude Code sessions with a local stand-in for the API (D18–D22 in `docs/evidence.md`):
  - On Claude Code 2.1.330, 0 of 299 sessions broke the invariant.
  - 3,090 of 3,090 requests with rules due held them, and 763 of 763 subagent requests did.
  - The sessions included forks, `/resume`, plan mode and subagents that edit files.
- **It beats the native options.** On the same 60 sequences, a user `CLAUDE.md` covered 88.2% of requests and only 46.9% of subagent requests (it never reaches the built-in Explore and Plan subagents). `.claude/rules` covered 76.3%. Skills covered 0%. Those two also put other models' rules into most requests (D30, D32).
- **The evidence is checkable.** Every number links to a raw file, and the tests recompute the numbers from those files. The benchmark found nine of its own failures (F1–F9) and fixed them, and the repo shows how each one was reproduced.
- **It is low-risk to run.** The hooks never block anything, it has no runtime dependencies, and it reads only local files. The one network feature is an optional classifier that is off by default. Each hook run costs 80–150 ms of CPU, and it adds about 1,343 characters per request. `noonsight uninstall` and `NOONSIGHT_DISABLE=1` remove or disable it.
- **Whether the rules help is not established.** The README says so itself:
  - Measured effects exist only for `verify-changes` (Sonnet and Haiku), `carry-through` (Sonnet only) and Fable's `low-context-report`.
  - No other preset rule has a measured effect, Opus's included. The preset also ships Opus and Fable's attended-session rules switched off.
  - On the small tasks tested, every run passed its hidden check with or without rules (R8: 600 of 600). The paid pilot on public tasks showed no measurable difference (133 of 144 without rules, 132 under noonsight).
  - `verify-changes` roughly doubled the cost of a cheap task: Sonnet on the fix went from $0.024 to $0.0505 per run.

**Conditions and risks:**
- **Pilot with a measurable question.** Install it for a few people for a couple of weeks. Check `noonsight report` and `noonsight models`, and drop rules that change nothing you can see. Write your own rules, since the preset is only a starting point.
- **Hooks must be allowed.** If your organization uses `allowManagedHooksOnly` or `disableAllHooks`, the hooks won't run. Logins with server-managed settings (Team and Enterprise) ignore the machine-wide `--managed` install, so each person has to run `noonsight install`. `noonsight check` reports both cases.
- **Tell it when nobody is watching.**
  - Headless runs (`claude -p`, the Agent SDK) count as unattended. Interactive sessions that nobody watches, such as CI or orchestrators, do not unless you set `session.unattended_when_env`.
  - Opus's and Fable's useful preset rules are unattended-only or subagent-only, so an attended Opus or Fable session gets nothing until you run `enable` for a rule.
  - Sonnet and Haiku scoped rules need `NOONSIGHT_SCOPE`.
- **Known gaps, in its own docs.**
  - A workflow's agents get no rules.
  - Foreground subagent calls of one type that need different rules get nothing until their first edit.
  - A plugin that noonsight doesn't read, such as one an organization syncs, leaves its subagents predicted on their parent's model.
  - A conversation that was compacted and then resumed with nothing naming a model runs on Claude Code's default model, which noonsight can't detect.
  - `/fork` is unavailable in sessions started by `noonsight run` that have rules.
  - Agent teams, routing and the classifier are not measured.
- **It depends on Claude Code internals.** It relies on undocumented behavior, such as `CLAUDE_CODE_SESSION_ATTENDED` and how `SessionStart` repeats are filtered. Measurements cover 2.1.330 for delivery, 2.1.329 for rule effects and 2.1.326 for the paid pilot. CI pins 2.1.325 for its live checks.
  - **Mitigation:** pin your Claude Code version, and run `npm run delivery -- corpus` before each upgrade.
  - **If hooks change:** if a Claude Code update changes hook behavior, deliveries can go missing silently. The decision log records what the hook returned, not what reached the model.
- **The benchmark has blind spots.** It uses a stub API that gives fixed answers. It checks that rules arrive, not that models follow them. Its reference is noonsight's own resolver, so a wrong resolution would not show up. Delivered rules are context only. Use a permission rule or a hook for anything that must never be broken.
- **Provenance and platform.** It is a small project, renamed from "sextant", with a single maintainer's GitHub org visible in the README. Review the hook code and pin the npm version. Install globally rather than via `npx`, because the `npx` hooks stop delivering once npm's cache is cleared. Windows is not supported.
- **Cost.** Extra rules add tokens and can add work. Expect higher spend on Sonnet and Haiku coding tasks. Fable's three-task cost comparison was untested.

**What it guarantees:** Through Claude Code's hooks, it puts the rules declared for a model into every request of each session and subagent running on that model, and re-delivers them when the model changes or the conversation is compacted, cleared, resumed or forked. That rests on 0 failures in 299 randomized real-session runs on Claude Code 2.1.330 (3,090 of 3,090 requests covered), plus a corpus of reproduced failures. It is delivery only, not obedience, and it holds for the Claude Code versions tested.
