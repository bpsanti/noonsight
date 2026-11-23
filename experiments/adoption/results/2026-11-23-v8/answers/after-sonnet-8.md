**Verdict:** Adopt with conditions. Pilot it first, and don't roll it out team-wide yet.

**Reasons:**
- **It fits your setup.** You run several models and start many subagents. Per-model delivery that follows `/model` switches and reaches subagents is what noonsight is built for. A `CLAUDE.md` reached only 46.9% of subagent requests (60 of 128) and never reaches the built-in Explore and Plan subagents (D28, S4). Per-model skills reached 0%.
- **The delivery evidence is strong.** In the current run, 3,090 of 3,090 requests with rules due held them, and 763 of 763 subagent requests did. Of the 299 sessions that finished, 0 broke the invariant (D18–D20). The sessions were real interactive Claude Code, with only the API stubbed.
- **The evidence is checked and honest.** Every number links to a raw result file, and `npm test` recomputes each one. The benchmark found nine failures, F1–F9. Five were re-run on the pre-fix build and still reproduce there (D24), and the repo's corpus now passes. The README lists its own limits.
- **It is low-risk to install.** The hooks never block anything, use no network, and have no runtime dependencies. They take about 80–150 ms of processor time per run (D33, measured on a loaded laptop). `NOONSIGHT_DISABLE=1` and `noonsight uninstall` back it out.
- **It also keeps other models' rules out of a request.** Rule text written for the request's own model was 78.6% of rule text under noonsight, against 32.6% for a `CLAUDE.md` (D30).

**Conditions and risks:**
- **Delivery is not obedience.** A delivered rule is context, and the model can ignore it. Only a few preset rules have a measured effect:
  - `verify-changes` on Sonnet and Haiku.
  - `carry-through` on Sonnet.
  - `low-context-report` on Fable.
  - Opus has no measured effect, and Haiku's `carry-through` showed none.
  - Your own rules have none until you measure them. Rules that must never be broken belong in hooks or permission rules.
- **The preset does little out of the box for attended sessions.** Opus and Fable attended rules ship off, so an attended Opus or Fable session gets nothing until you `enable` rules. Sonnet and Haiku scoped rules need a scope.
  - Set `session.unattended_when_env` for interactive sessions nobody watches.
  - Treat the preset as a starting point and plan to write your own rules.
- **Some rules cost money.** `verify-changes` roughly doubled the cost of a small Sonnet fix ($0.0240 to $0.0505, R6). Where models already did the work, rules changed nothing and still cost a little. There was no measurable difference in pass rates on public tasks (B1, 2.1.326).
- **It is tied to Claude Code versions.**
  - The delivery claim is measured on 2.1.330, the rule effects on 2.1.329 (Fable's on 2.1.328), and the paid pilot on 2.1.326.
  - It relies on an undocumented variable, `CLAUDE_CODE_SESSION_ATTENDED`.
  - Pin or re-verify the Claude Code version, and run `npm run test:live` after upgrades.
- **It has documented gaps.** These are workflow agents, agent teams, routing and the classifier, which are unmeasured or unsupported. They also include `/fork` under `noonsight run`, a compact-then-resume limit, some foreground subagents, and plugins noonsight doesn't read (such as org-synced ones).
- **It isn't published yet.** Version 0.1 isn't on npm; you install from a git clone. It looks like a small, single-author project, so budget for maintenance or a fork. Check that your organization's managed settings allow user hooks.
- **Pilot plan.** Pilot with 2–3 people for a few weeks, and check `noonsight report` for rules that are on but never delivered. Drop rules you can't see working.

**What it guarantees:** Every request with rules due holds the rules written for the model that request runs on, and no other model's rules are left unretired. This rests on a delivery benchmark of 299 completed real Claude Code 2.1.330 sessions against a local API stand-in. It does not rest on any measurement of the models' behavior.
