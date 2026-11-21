**Verdict: adopt with conditions.** Run it as a time-limited pilot on a few machines, not a team-wide rollout.

**Reasons**

1. **It fixes a real gap for a team like yours.** You use four models and lots of subagents. In the tool's delivery benchmark (Claude Code 2.1.328), a single user `CLAUDE.md` reached only 32.2% of subagent requests (39 of 121), and it never reaches the built-in Explore and Plan subagents. It also gives every model the other models' rules: only 31.5% of the rule text a request carried was written for that request's model. noonsight reached 100% of subagent requests (668 of 668) and 99.9% of all requests with rules due (3,219 of 3,221). It also re-delivers rules after `/model`, `/compact`, `/clear` and resumes (`experiments/delivery/results/claude-code-2.1.328/2026-11-21-d5fd71f/README.md`).
2. **It is honest about its limits and has safety rails.** The hooks always exit 0, never block and never use the network; the optional classifier is the only exception. A bad configuration is refused whole rather than half-applied. `noonsight report`, `resolve` and `check` let you see what was actually delivered. The README states that the numbers come from a local stand-in for the API, not real model runs.
3. **Out of the box, it does little for half your sessions.** With the shipped preset, a watched Opus 5.5 or Fable 5.2 session gets nothing, because all their default rules are for unattended runs or subagents. A watched Sonnet or Haiku session gets only `verify-changes`, and only after it edits a tracked code file, unless someone sets a scope. The value comes from your own rules, or from setting scopes and places deliberately.
4. **It is very young.** It is version 0.0.1, marked `private`, and not on npm, so you install from a clone. The whole changelog covers about one week (Nov 14–21, 2026), including a rename from "sextant". The fuzzer found four of its own delivery bugs (F1–F4) in that week. They are fixed, but that pace of churn is a reason to pilot it before relying on it.
5. **The evidence that rules change behavior is narrow.** One clear result: `verify-changes` made Sonnet and Haiku run tests after a one-file fix in 29 and 27 of 30 runs, against 0 of 30 without it, at about twice the cost per run on Sonnet. Haiku's `carry-through` rule showed no effect on the backlog task. Every run passed its hidden check with or without rules. Your own rules have no measured effect until you measure them.

**Conditions and risks**

- **Conditions for it to work:**
  - **Rules that actually differ by model, task or place.** If everyone ran one model with fixed rules, `CLAUDE.md` would be simpler; the project's own `docs/usage.md` says so.
  - **Hooks must be allowed on your machines.** Managed settings that forbid user hooks would defeat it. `noonsight check` reports this.
  - **Someone owns the configuration.** That means setting `session.unattended_when_env` for orchestrated sessions, deciding how sessions get a scope, and reviewing preset updates (`on_preset_change: hold`, then `noonsight accept`).
  - **Pin your Claude Code version and re-check after each upgrade.** It depends on hook behavior verified one version at a time (`docs/verification/claude-code.md`). One input, `CLAUDE_CODE_SESSION_ATTENDED`, isn't documented by Claude Code.
- **What could go wrong:**
  - **Delivered doesn't mean obeyed.** A delivered rule is just context. Anything that must never happen needs a hook or a permission rule instead.
  - **Claude Code updates can silently change delivery.** For example, if the undocumented variable is dropped, headless runs quietly stop counting as unattended.
  - **Several common paths were never measured:** `/resume` inside a session, forks, plan mode, agent teams, the `noonsight run` launcher, routing, the classifier, repository configurations, and subagents that edit files.
  - **Known gap:** a conversation compacted and then resumed without naming a model runs on Claude Code's default model, which noonsight can't detect.
  - **It installs widely by default.** Hooks go into every Claude Code config directory in your account. Each hook adds about 60 ms of processor time. Each repository's rules need a one-time `noonsight trust` per person.
  - **All the evidence was produced by the author.** Nobody has replicated it independently.
- **Exit criteria for the pilot:** use `noonsight report` to confirm delivery, and compare a few of your real tasks with and without your rules. Drop any rule that changes nothing you can see. Run `noonsight uninstall` if it doesn't pay off.

One thing to know when reading the repo: `experiments/adoption` scores fresh Claude sessions on exactly this question, and the README was revised based on those scores. The README has been tuned to convince an evaluator like me. That doesn't make its claims false, and I checked the main delivery numbers against the result files, but give it the scrutiny you'd give any marketing page.

**What it guarantees:** Only that each session and subagent *receives* the rules configured for the model it actually runs on, re-delivered when the model changes. That rests on a delivery benchmark the author ran on Claude Code 2.1.328 against a local stand-in for the API (99.9% of requests, 1 of 300 sessions failing at the documented limit). It does not guarantee anything about whether the model follows the rules or whether that improves results.
