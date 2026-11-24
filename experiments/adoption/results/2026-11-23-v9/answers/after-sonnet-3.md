**Verdict: adopt with conditions.** The delivery mechanism is well tested. The evidence that the preset rules improve results is thin, so adopt it as a delivery tool and not as a quality upgrade. I read the README, `docs/evidence.md` and `hooks/hooks.json`. I did not run the test suite or any experiment, so every number below is the project's own, taken from its evidence map.

**Reasons:**
- **It fits your setup.** It delivers rules per model, to sessions and to subagents, and again when the model changes. That matches your mix of Opus, Sonnet, Haiku and Fable with many subagents.
- **The delivery numbers are strong.** In 300 generated sessions (299 ran to the end) on Claude Code 2.1.330, 0 broke the invariant. 3,090 of 3,090 requests held their model's rules, including 763 of 763 subagent requests.
  - The invariant is that every request holds its own model's rules and no other model's.
  - The sessions were real interactive Claude Code sessions. Only the Messages API was a local stand-in, so no model answered.
- **The native alternatives do worse, mainly for subagents.**

  | Method | Requests covered | Subagent requests covered |
  | --- | --- | --- |
  | noonsight | 100% | 100% |
  | `CLAUDE.md` | 88.2% | 46.9% |
  | `.claude/rules` | 76.3% | 46.9% |
  | Skills | 0% | 0% |

  They also put other models' rules into every request: 619 and 622 requests with another model's rule and no retiring note, against 0 for noonsight. That is the case for it over a shared `CLAUDE.md`.
- **The project reports its own flaws.** It lists nine failures it found and fixed (F1 to F9). It reproduces the failures on the pre-fix builds (8 of 8) and links each number to a raw file that its tests recompute. That is better practice than most tools show.
- **It is low-risk to install.** It has no runtime dependencies and is MIT licensed. The hooks never block anything. It reads local files only, apart from an optional classifier that is off by default. Hook cost is about 80 to 150 ms CPU, measured on a loaded laptop, so an upper reading. `NOONSIGHT_DISABLE=1` and `noonsight uninstall` back it out.
- **The benefit of the rules themselves is narrow.**
  - **Where it showed an effect:** Sonnet and Haiku ran tests after their last edit: 30 of 30 against 0 of 30 on a precise one-file fix, and 30 of 30 against 11 of 30 on a bug known only by its symptom. `carry-through` helped Sonnet finish a 13-ticket backlog: 32 of 40 against 9 of 40. `low-context-report` shortened Fable's report sentences.
  - **Where it did not:** No Opus rule has any measured effect. `carry-through` showed no effect for Haiku on the backlog. Every run passed its hidden check with or without rules (600 of 600). A 144-run public-task pilot found no difference in pass rate, with 133, 132 and 133 passing across the three conditions.
  - **Cost:** The rules raised cost per run on small tasks, for example Sonnet on the fix from $0.0240 to $0.0378.

**Conditions and risks:**
- **Your attended sessions will mostly get nothing from the preset.** Opus and Fable attended rules ship off. Sonnet and Haiku attended sessions get only `verify-changes`, and only after they edit a tracked code file. Their other rules need a scope. You would have to set scopes, run `noonsight models` and `noonsight report`, and decide which rules to enable.
- **Set `session.unattended_when_env`** for any interactive sessions nobody watches, or they will count as attended.
- **Pin and re-verify Claude Code versions.** It relies on hook behaviour that changes between releases. Delivery was measured on 2.1.330 only, and rule effects on 2.1.326 to 2.1.329. Re-run `npm test` and the live tests when your team upgrades.
- **Known delivery gaps:**
  - Workflow agents get nothing.
  - Foreground subagent calls of one type that need different rules get nothing until their first Edit, Write or agent call.
  - A plugin noonsight does not read, such as one an organization syncs, leaves its subagents predicted on the parent's model.
  - A conversation compacted and then resumed with no model named runs on Claude Code's default model, which noonsight cannot tell.
  - `/fork` is unavailable in sessions that `noonsight run` starts with rules.
  - Agent teams, routing and the classifier are not measured, so leave routing and the classifier off.
- **Delivery is not obedience.** A delivered rule is context, like `CLAUDE.md`. Measure your own rules on your own tasks before relying on them.
- **The tool is new and small.** It was renamed from sextant, the evidence runs from 2026-11-16 to 2026-11-23, and the benchmarks are the author's own and use small synthetic tasks. Expect churn and keep the config in version control.
- **Trust.** Repository-level `.noonsight/noonsight.json` does nothing until each person runs `noonsight trust`. That limits repository files from injecting prompt text, but your team should still review any rules a repository ships.
- **Suggested pilot:** Install it for a couple of weeks on a few people. Start with your own rules for what truly differs by model, plus Sonnet and Haiku `verify-changes`. Check `noonsight report` for rules that are on but never delivered. If every session uses one model with fixed rules, a `CLAUDE.md` is simpler.

**What it guarantees:** Through Claude Code's hooks, noonsight puts the rules declared for a model into the requests of each session and subagent running on it, and again after a model change, compact, clear, resume or fork. This rests on matching rules by model, scope, place and trigger, never by text. It was verified on real sessions against a stand-in API on Claude Code 2.1.330, within the documented gaps, and it does not guarantee that the model follows the rules.
