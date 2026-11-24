**Verdict:** Adopt with conditions. Treat it as a pilot, scoped to the Sonnet and Haiku sessions, until you have measured it on your own work.

I read the README, `docs/evidence.md` and `docs/hooks.md`. I did not run the tests or the experiments, so every number below is the project's own claim, not something I checked.

**Reasons:**
- **It matches your setup.** You run several models and start subagents. Delivering rules by model, including to subagents, is the one thing it does that `CLAUDE.md` does not.
- **Delivery is well measured, and the evidence is traceable.** In 299 completed random sessions on Claude Code 2.1.330, every request that was due rules held them. That is 3,090 of 3,090 requests, and 763 of 763 for subagents. The sessions are real, but the Messages API was a local stand-in, so no model answered. It also lists nine bugs it found in itself and fixed (F1–F9).
- **It beats the native options on delivery.** On the same first 60 sequences, a user `CLAUDE.md` reached 88.2% of due requests and `.claude/rules` reached 76.3%. Both reached only 46.9% of subagent requests, and a skill per model reached 0%. They also put other models' rules into 619 and 622 requests. noonsight did so in none.
- **It is cheap and low-risk to run.** The hooks never block anything, use no network by default, and take about 80–150 ms of CPU each, measured on a loaded laptop. They can be switched off per session with `NOONSIGHT_DISABLE=1`, and `noonsight uninstall` removes them. It has no runtime dependencies, and `noonsight report` and `noonsight resolve` let you audit what was delivered.
- **Where rules were tested, some had real effects, on small tasks.**
  - Tests run after the last edit: `verify-changes` took Sonnet from 0/30 to 29/30 on a precise fix and from 11/30 to 30/30 on a symptom-only bug. Haiku went from 0/30 to 27/30.
  - Finishing every part of a 13-ticket backlog: `carry-through` took Sonnet from 9/40 to 32/40.
  - Report style: `low-context-report` shortened Fable's sentences from about 16 to about 12 words.

**Conditions and risks:**
- **The guarantee covers delivery, not behaviour.** A delivered rule is only context. The one broad quality check found no difference: a paid pilot passed 133/144 without rules, 132/144 with noonsight and 133/144 with a `CLAUDE.md`. In the rule-effect runs, every one of 600 runs passed the hidden check with or without rules.
- **Most of what it does for Opus and Fable is unproven.** The preset ships its attended-session rules for both models switched off, so an attended Opus or Fable session gets nothing until you run `enable`. No Opus rule has a measured effect. The only measured Fable rule is `low-context-report`, and it applies only to headless runs and subagents. If those two models are most of your usage, the gain is mainly your own rules, which you would have to write and measure yourselves.
- **The sessions that gain most are the ones where you give it more setup.** Sonnet and Haiku scoped rules need `NOONSIGHT_SCOPE` or task-text matchers, and interactive sessions nobody watches need `session.unattended_when_env` set. Otherwise those sessions get less than you would expect.
- **It costs tokens.** The effective rules raised cost per run noticeably: Sonnet's fix went from $0.024 to $0.038–0.051, and Haiku's from $0.0015 to $0.0033. That is a relative increase on a very small base. The delivery cost was about 1,343 characters per request, against 4,472 for a `CLAUDE.md`.
- **It leans on undocumented Claude Code behaviour.** Forks, resumes, plan mode and subagent matching depend on internals that it says are undocumented. Every result is pinned to a Claude Code version: 2.1.330 for delivery, 2.1.329 for rule effects, and 2.1.326 for the paid pilot. Your team would have to pin Claude Code, or re-run `npm run test:live` after each upgrade.
- **There are known gaps.**
  - Workflow agents get nothing.
  - Some foreground subagents get nothing until their first edit.
  - Subagents from plugins it doesn't read, such as organization-synced ones, are predicted on the parent's model.
  - A compacted-then-resumed conversation can run on a default model it cannot identify.
  - `/fork` is unavailable in sessions started with `noonsight run`.
  - Agent teams, routing and the classifier are not measured.
  - On macOS it reads the Claude Code command line through `ps`, which is ambiguous in some cases.
- **There are smaller risks:**
  - The project is young, and it was renamed from sextant.
  - It writes state under `~/.local/state/noonsight`.
  - Repo-level config needs `noonsight trust` before it applies.
  - The classifier, if you turn it on, sends the first 4,000 characters of a task to a model.
- **For the pilot:**
  - Pin the Claude Code version.
  - Run `noonsight check` and `noonsight report` weekly.
  - Add rules of your own for Opus and Fable, and measure them.
  - Drop any rule whose effect you can't see.
  - If you decide you need only a few static rules for one model, a `CLAUDE.md` is simpler, as the README itself says.

**What it guarantees:** It guarantees that, through Claude Code's hooks, each session and subagent receives the rules declared for the model it actually runs on, and receives them again after a model change or a compact, clear, resume or fork. That rests on a benchmark of 299 real sessions against a local stand-in API on Claude Code 2.1.330, in which the requests were read and no model answered, so it covers delivery only, with the limits listed above.
