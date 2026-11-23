**Verdict: adopt with conditions.** Run it as a pilot on a pinned Claude Code version. Don't treat it as a team-wide default yet.

**Reasons**

- **It solves a real problem for a mixed fleet.** Rules reach each session and each subagent according to the model that actually runs, and are re-sent after `/model`, `/compact`, `/clear`, resumes and forks (`docs/hooks.md`). A `CLAUDE.md` can't do that: it gives every model every other model's rules. It also never reaches the built-in Explore and Plan subagents.
- **The delivery evidence is unusually strong.** The benchmark drove real interactive Claude Code sessions against a local stand-in API, so no model was involved.
  - In the current run, 0 of 299 sessions broke the invariant. Rules were present on 3,090 of 3,090 requests, including 763 of 763 subagent requests (`docs/evidence.md` D18–D20).
  - On the same sequences, a user `CLAUDE.md` covered 88.2% of requests and 46.9% of subagent requests. `.claude/rules` covered 76.3% and 46.9%. Skills covered 0%.
  - The benchmark found nine of its own failures (F1–F9). Each has a reproduction in the corpus, and the corpus passes. Every number is recomputed from raw files by `test/evidence.test.ts`.
- **The preset rules have measured effects, but narrow ones.** On a precisely described one-file fix, `verify-changes` raised test-running from 0 of 30 to 30 of 30 on Sonnet, and from 0 of 30 to 27 of 30 on Haiku (R14). On a 13-ticket backlog, Sonnet's `carry-through` raised complete runs from 9 of 40 to 32 of 40 (R10). Fable's `low-context-report` shortened report sentences (R9).
- **It is low-risk to try.** The hooks always exit 0, never block a call, use no network by default, and log every decision. It is a single `noonsight uninstall`, or `NOONSIGHT_DISABLE=1`, away from off.

**Conditions and risks**

- **It's pre-release.** Version 0.1 is not on npm, and the name holds an empty placeholder. You'd install from a clone, and the project is largely one author's. Decide who will own updates before you adopt.
- **It depends on undocumented Claude Code behavior.** Fork detection, the `CLAUDE_CODE_SESSION_ATTENDED` variable, subagent metadata files and the `ps` parsing on macOS are all undocumented. The delivery claim is measured on Claude Code 2.1.330 only. Pin the version, and re-run `npm run delivery -- corpus` and `NOONSIGHT_LIVE_DELIVERY=1 npm run test:live` before each upgrade. Your team already runs several versions and models, so version drift is the main way this breaks. A silent miss is the failure it exists to prevent.
- **Opus and Fable get nothing by default in attended sessions.** Their attended rules all ship off. Without `enable`, `session.unattended_when_env` and scopes, much of your team would see no effect. Sonnet and Haiku attended sessions get `verify-changes` only after a tracked-code edit, and their other rules only with a scope. Someone has to write the configuration and own the rules.
- **Delivery is not obedience.** The effect data covers the preset's rules only, on small tasks with 30–40 runs per arm. `verify-changes` about doubled the cost of a small fix ($0.0240 → $0.0505 on Sonnet, R6). Haiku's `carry-through` showed no effect (R11). The paid pilot on public tasks found no difference in pass rate: 133, 132 and 133 of 144 without rules, under noonsight, and with a `CLAUDE.md` (B1). Your own rules have no measured effect until you measure them.
- **Known and unmeasured gaps.**
  - Workflow agents get nothing.
  - Foreground subagent calls of one type that need different rules get nothing until the subagent's first Edit, Write or agent call.
  - Plugins noonsight doesn't read are predicted on the parent's model.
  - Agent teams, routing and the classifier are unmeasured.
  - `/fork` doesn't work in `noonsight run` sessions.
  - A conversation compacted and resumed with nothing naming a model runs on Claude Code's default model, which noonsight can't tell.
- **The benchmark is self-referential.** The oracle uses noonsight's own resolver, so a wrong resolution wouldn't show. The stand-in API never decides anything, and the project's own authors did the measuring. Its own docs say that for single-model teams a `CLAUDE.md` is simpler.
- **Compare the benefit against your real mix.** If most sessions are on one model and few use Explore, Plan or subagents, the gain over a `CLAUDE.md` is small.

A sensible pilot: a few people use it for two to four weeks with `noonsight report` on, and you keep only the rules that show up in the log and change behavior you can see.

**What it guarantees:** For a given Claude Code version, noonsight guarantees that each request carries the rules your configuration assigns to its model, scope, place and revealed triggers (not other models' rules), and rests that on hooks it tested against real Claude Code 2.1.330 sessions; it does not guarantee the model follows those rules, or that this holds on other Claude Code versions.
