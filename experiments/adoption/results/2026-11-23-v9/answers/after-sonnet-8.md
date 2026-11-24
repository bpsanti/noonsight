**Verdict: adopt with conditions.** Pilot it first, and don't roll it out to everyone yet.

I read the README, `docs/evidence.md` and `docs/hooks.md`. I did not run the test suite or any experiment, so every number below is the project's own claim. The project does tie each number to a raw result file and recomputes it in `npm test`.

**Reasons**

- **It matches your setup.** Your team uses several models and subagents, which is the case the tool is built for. It puts per-model rules into sessions and subagents through Claude Code's hooks. It re-delivers them on `/model`, compaction, `/clear`, resume and fork. It ships a preset for Opus 5.5, Sonnet 5.5, Haiku 5.5 and Fable 5.2.
- **Subagent delivery is the strongest evidence.** In the 2026-11-23 benchmark (Claude Code 2.1.330), 3,090 of 3,090 requests with rules due held them. 763 of 763 of those were subagent requests, and 0 of 299 sessions broke the invariant. The sessions were real, but the Messages API was a local stand-in, so no model answered. For comparison, a user `CLAUDE.md` reached 88.2% overall and 46.9% of subagent requests (D25, D28). `.claude/rules` reached 76.3% and 46.9%, and skills reached 0%.
- **It avoids cross-model rule leakage.** Requests carrying another model's rules with no retirement note: 0 under noonsight, against 619 with `CLAUDE.md` and 622 with `.claude/rules` (D32). The tool also adds fewer characters per request: 1,343, against 4,472 for `CLAUDE.md`.
- **Its guarantee is stated honestly.** It promises delivery, not obedience. It lists its limits and says which Claude Code version each result holds for. Superseded results are kept and labelled.
- **The hooks are low-risk.** They never block anything and always exit 0. The configuration is refused whole when it is invalid. There are no runtime dependencies, it reads only local files, and the classifier is the one network use and is off by default. `NOONSIGHT_DISABLE=1` and `noonsight uninstall` turn it off. It has a decision log and a `noonsight report` command for audit.
- **Measured behaviour changes exist, but only for some rules.** `verify-changes` raised "ran tests after the last edit" from 0 of 30 to 29 of 30 on Sonnet, and from 0 of 30 to 27 of 30 on Haiku, on a small fix task. `carry-through` raised full completion on a 13-ticket backlog on Sonnet from 9 of 40 to 32 of 40. `low-context-report` shortened Fable's report sentences.
- **Gaps in the evidence:**
  - No quality gain has been shown. Every run passed the hidden check with or without rules (R8, 600 of 600). The paid pilot on public tasks found no difference: 133, 132 and 133 of 144 passed with no rules, noonsight and `CLAUDE.md`.
  - The rules cost more per run, for example Sonnet on the fix: $0.0505 against $0.0240.
  - No Opus rule has a measured effect.
  - Agent teams, routing and the classifier are unmeasured.

**Conditions and risks**

- **The preset does little for Opus and Fable attended sessions.** Their attended rules ship off, so those sessions receive nothing until you `enable` a rule. The evidence says nothing about whether those rules help.
  - Decide which rules you want and write your own. Rules you write have no measured effect until you test them.
- **Sonnet and Haiku attended sessions also get little by default.** They get `verify-changes` only after a tracked code file is edited. Their other rules need a scope, set through `NOONSIGHT_SCOPE` or `noonsight run`.
  - Set `session.unattended_when_env` for interactive sessions nobody is watching, such as CI or orchestrators.
- **It depends on undocumented Claude Code behaviour.** Fork detection, `CLAUDE_CODE_SESSION_ATTENDED`, hook inputs and the subagent metadata file are all undocumented. Results are tied to Claude Code 2.1.330, and the rule-effect runs used 2.1.329.
  - Pin or stage Claude Code upgrades, and run `npm run test:live` after each one.
  - Use `noonsight report` to catch silent breakage.
- **Known coverage holes:**
  - Workflow agents get no rules.
  - Foreground subagent calls of one type that need different rules get nothing until the subagent's first Edit, Write or agent call.
  - Plugin subagents that noonsight doesn't read are predicted on the parent's model.
  - A compacted conversation resumed with no model named runs on Claude Code's default model, which noonsight can't identify.
  - In a session started by `noonsight run` with rules, `/fork` is unavailable.
  - Split-pane agent-team teammates were not checked.
- **A wrong prediction can leave wrong rules in place.** If a subagent starts on a different model than predicted, it keeps the wrong rules. The tool only warns afterwards. Don't ignore `MISMATCH` warnings.
- **Setup effort and repository rules:**
  - Each person runs `noonsight trust` in a repository before its `.noonsight/noonsight.json` takes effect.
  - Every Claude Code login needs coverage, by `noonsight install` or the plugin.
  - The macOS command-line reading can be ambiguous and sometimes produces warnings instead of rules.
- **Routing in auto mode can have side effects.** A routed call costs the other calls in the same response their review. Leave routing off.
- **Provenance:** the project is MIT-licensed and appears to be a small single-maintainer repository. It was renamed from "sextant". Review the code, or at least `src/`, and pin a version before installing it on every machine.
- **Alternative:** if you want one fixed set of rules for all models, a `CLAUDE.md` is simpler. Even the project's docs say to skip noonsight when every session runs one model, unless Explore or Plan subagents need the rules, which `CLAUDE.md` doesn't reach.
- **Suggested pilot:** run it for a few weeks on a handful of people, with 3–4 rules written for your models. Check `noonsight report` for rules that were never delivered or that changed nothing. Then decide on rollout.

**What it guarantees**

Through Claude Code's hooks, it puts the rules you declared for a model into the requests of each session and subagent running on that model, and again when that model changes or the conversation is compacted, cleared, resumed or forked. This rests on a 300-session benchmark that read every request against a local stand-in for the Messages API, on Claude Code 2.1.330 only, with the limits above. It guarantees delivery, not that the model follows the rules.
