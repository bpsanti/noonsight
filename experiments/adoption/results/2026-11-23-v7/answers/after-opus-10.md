**Verdict: adopt with conditions.** Run it as a time-boxed pilot on a pinned Claude Code version, not as a team-wide rollout yet.

I read the README, `docs/evidence.md`, `docs/hooks.md`, `docs/verification/claude-code.md`, the delivery benchmark's README and the CHANGELOG. I didn't run the tests or the benchmark, so every number below is the tool's own claim.

## Reasons

1. **It solves a problem you actually have.** You mix four models and use a lot of subagents. That combination is where the built-in options fall short:
   - Rules in a `CLAUDE.md` reached only 32.2% of subagent requests (39 of 121), and never reach the built-in Explore and Plan subagents.
   - Because one file holds every model's rules, each model mostly gets the other models' rules: only 31.5% of the rule text in a request was written for that request's model.
   - noonsight delivered to 100% of subagent requests (763 of 763 on Claude Code 2.1.330) and added a quarter of the text a `CLAUDE.md` did (1,155 vs 4,415 characters per request).
   - If one set of rules for every model is enough for you, `CLAUDE.md` already reached every request of the main conversation (526 of 526). The README itself says to skip the tool in that case.
2. **The evidence is unusually careful.** Every number points to a committed raw file, and `npm test` recomputes it. Nine bugs (F1–F9) are reported openly, each with a minimal reproduction that failed before its fix and passes after. The limits are listed in the README rather than hidden.
3. **The tool is very new.** The fixes for F5–F9 are "Unreleased" in the CHANGELOG and were measured today (2026-11-23), on Claude Code 2.1.330 only. Version 0.1 isn't on npm yet, so you'd install from a git clone. When the benchmark was extended to new paths (forks, plan mode, `/resume`), it found five new bugs straight away. Paths nobody has tested yet probably still have some.
4. **It depends on Claude Code internals that can change without warning.** These include:
   - an undocumented environment variable (`CLAUDE_CODE_SESSION_ATTENDED`) that decides whether a session counts as attended;
   - reading the `claude` command line with `ps`;
   - transcript and `.meta.json` file layouts;
   - the exact way hook events fire (`docs/verification/claude-code.md` lists about 70 such facts, each with the version it was checked on).

   Since you update Claude Code all the time, this is the main operational risk.
5. **Out of the box it does little for your Opus and Fable sessions.** All of their preset rules for attended sessions ship turned off, so an interactive Opus 5.5 or Fable 5.2 session gets nothing from the preset. Also, no measured effect exists for any Opus 5.5 rule: the experiments cover only Sonnet, Haiku and Fable, on small tasks with 30–40 runs each. Most of the value would come from rules you write yourselves, and those have no measured effect until you measure them.

## Conditions and risks

**What would have to hold:**
- **Pin Claude Code.** Before each upgrade, run the delivery corpus (`npm run delivery -- corpus`) against the new version. It uses a local stand-in for the API and spends no tokens.
- **Know which subagent setups it doesn't cover, and confirm you use few of them.** A workflow's agents get nothing. Agent teams are not measured, and split-pane teammates were never checked. Subagents from plugins your organization syncs get the rules of their parent's model. Several foreground subagents of the same type that need different rules get nothing until their first Edit, Write or agent call.
- **Set `session.unattended_when_env`** to your orchestrators' variable. Otherwise interactive sessions that nobody watches count as attended and get the wrong rules.
- **Turn on Opus and Fable rules on purpose** with `enable`, or write your own. Note the measured cost of some of them: `fable-5-2/code-ownership` raised output tokens by about 70–80% and made changes nobody asked for.
- **Leave routing and the classifier off.** Neither is measured, and the classifier sends task text to a model through your login.
- **Check delivery with `noonsight report` during the pilot.** It reads the tool's own decision log, so it shows what the hooks sent, not what the model did with it.

**What could go wrong:**
- A Claude Code update changes hook behavior, and rules quietly go missing or go to the wrong model. The decision log might not show it: before F1 was fixed, it recorded deliveries that never reached a model.
- `noonsight install` writes hooks into every Claude Code login on your account. Any error in the configuration makes the tool deliver nothing at all (it warns on screen and doesn't block the session). `noonsight uninstall` reverses the install.
- One documented limit remains: a conversation compacted with no response since, then resumed without naming a model, gets rules from the tool's own record of the session, which can name the wrong model.
- The tool's own live preset test sends a request to Fable 5.2 through `claude -p`. On plans where Fable draws on usage credits, it bills them without asking.
- Hooks cost about 50–90 ms of CPU each. That's minor.

## What it guarantees

It guarantees only that the text arrives: each session and subagent request carries the rules resolved for the model it actually runs on, not that the model follows them. That rests on a benchmark against a local stand-in for the API (0 of 299 completed sessions broke the rule on Claude Code 2.1.330, after nine bug fixes) and on a list of Claude Code hook behaviors, some undocumented, each checked only on specific versions.
