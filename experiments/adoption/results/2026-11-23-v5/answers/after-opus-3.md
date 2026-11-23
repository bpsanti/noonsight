**Verdict: adopt with conditions.** Start with a short pilot on a few machines rather than a team-wide rollout, and only if you have instructions that really should differ by model.

**Reasons**

1. **It fixes a real gap in how you use Claude Code.** You run several models and lots of subagents. In the tool's own benchmark, a user `CLAUDE.md` reached only 32.2% (39 of 121) of subagent requests and never reached the built-in Explore and Plan subagents (README:35–40, D10). It also gives every model every other model's rules: only 31.5% of the rule text in a request was written for that request's model (D12). Under noonsight, subagent coverage was 100% (D3, D20).
2. **The claims can be checked, and they come with their limits.** Every number links to a raw result file that `npm test` recomputes (docs/evidence.md). The benchmark is a fuzzer plus a set of reproductions of past failures, and the README lists what it doesn't cover.
3. **The risk to a session is low.** The hooks never block anything, don't use the network unless you turn on the optional classifier, and take about 50–90 ms per run (README:228, D15). `NOONSIGHT_DISABLE=1` turns it off for a session and `noonsight uninstall` removes the hooks.
4. **It's very new and still finding bugs, so it's a pilot, not a default.** It's version 0.1, not on npm, installed from a clone of one person's repository. The fuzzer found failures F1–F4; when the benchmark added new session paths, it found five more (F5–F9). Those fixes and the clean result (0 of 300 sessions failing, D18) were measured today, 2026-11-23, and are still under "Unreleased" in the CHANGELOG. Each time the test coverage widened, new bugs appeared.
5. **Out of the box it does little for your Opus and Fable users.** Every preset rule for attended Opus 5.5 and Fable 5.2 sessions ships turned off (README:49). So an interactive session on either model gets nothing from the preset until you turn rules on with `enable` or write your own. Most of Sonnet's and Haiku's rules also need a scope set first.
6. **The preset's benefits are small, uneven and not free.** `verify-changes` got Sonnet and Haiku to run tests (29 of 30 runs vs 0 of 30), but it doubled Sonnet's cost on that task ($0.0240 → $0.0505, R6). Haiku's `carry-through` showed no effect (R11). Where the models already did the work, the rules changed nothing and still cost a little (R6, R13). No rule effect was measured on Opus 5.5 at all.

**Conditions and risks**

Conditions:
- **You have rules that really differ by model or by task type.** If what you want is the same for every model, the README itself says to keep using `CLAUDE.md` (README:238).
- **Pin your Claude Code version and re-test before upgrading.** noonsight depends on hook behavior Claude Code doesn't document: the `CLAUDE_CODE_SESSION_ATTENDED` variable, reading the parent's `--model` through `ps`, and reading transcript files. Each of these was checked on one version (docs/verification/claude-code.md). If Claude Code drops or renames that variable, every session is treated as attended (line 45). Upgrade only after running the tool's corpus and live tests on the new version.
- **Pin a reviewed commit, since you install from a clone.** These hooks run on every session and subagent of every login.
- **Set it up for how you work.** Set `session.unattended_when_env` for interactive sessions nobody watches, give sessions a scope, and turn on or write rules for Opus and Fable.
- **Check delivery against behavior.** `noonsight report` shows what was delivered, not whether it changed anything. Measure your own rules or drop them.

Risks:
- **Paths it doesn't cover:** agent teams, routing and the classifier were never measured. A workflow's agents get nothing. Several foreground subagents of the same type that need different rules get nothing until their first edit or agent call.
- **Org-synced plugins:** if your organization syncs plugins noonsight doesn't read, their subagents get rules for the parent's model, which may be the wrong model.
- **Other known limits:** `opusplan` can't be tracked. A conversation compacted and then resumed with nothing naming a model can get the wrong model's rules. `/fork` is unavailable in sessions started through `noonsight run` with rules.
- **Bedrock, Vertex or Foundry:** if you use any of them, model aliases and the Explore subagent's model work differently there, and nothing in the tool's evidence tests those providers.
- **Unmeasured behavior:** a model actually reading and quoting `SessionStart`/`PostModelSwitch` context is listed as "Not yet run" (verification doc, line 52). Other live tests do show models quoting delivered rules.

**What it guarantees:** Only that each request carries the rule text written for its model, scope and place, and no other model's rules left unretired. Nothing about whether the model follows them. That rests on one benchmark run per Claude Code version (most recently 2.1.330): 300 random sessions against a local stand-in for the API, scored against noonsight's own resolver, which means a wrong resolution would go unnoticed.
