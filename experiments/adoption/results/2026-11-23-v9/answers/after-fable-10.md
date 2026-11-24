**Verdict:** adopt with conditions. Run it as a pilot on a few machines first, not as a team-wide rollout.

I read the README, the hook, install, evidence and preset-source docs, and the delivery benchmark's failures and limits. I spot-checked the source for network and process use, but did not run the test suite or the tool.

**Reasons:**

- **It fits your setup.** The preset covers exactly Opus 5.5, Sonnet 5.5, Haiku 5.5 and Fable 5.2, and it gives each session and each subagent the rules for the model it actually runs on.
- **Subagents are where the native options fall short.** In its benchmark, a user `CLAUDE.md` reached every main-conversation request but only 60 of 128 subagent requests. It also sent every model the other models' rules.
- **Delivery is measured, with caveats.** In the current run (today, Claude Code 2.1.330), 0 of 299 completed sessions broke the delivery invariant, and all 763 subagent requests held their rules. The sessions were real, but the API was a local stand-in, so no model answered.
- **Some rules change behaviour; task success did not move.**
  - Sonnet ran tests after a small fix in 30 of 30 runs with its rules, against 0 of 30 without.
  - Sonnet finished a 13-ticket backlog in 32 of 40 runs with `carry-through`, against 9 of 40 without.
  - Haiku's `carry-through` and Opus's `unattended-run` were inconclusive.
  - In the paid pilot on public tasks, pass rates were the same with and without it (132 against 133 of 144).
- **It is low-risk to install and remove.** It has no runtime dependencies, and I found no network code in `src`; it only starts `git`, `ps`, `claude` and the service manager. Hooks always exit 0 and never deny a call, and `noonsight uninstall` removes only its own entries.
- **It is young.** This is version 0.1.0 from a single author. Its own benchmark found nine delivery failures in the past week, all fixed before the current run.

**Conditions and risks:**

- **Pin the Claude Code version.** Results hold only for the version they ran on, and several mechanisms rest on undocumented Claude Code behaviour (fork tracking, headless detection, subagent metadata). Run `noonsight check` and the delivery benchmark again after each upgrade.
- **Write rules for attended Opus and Fable sessions.** Out of the box those sessions receive nothing from the preset; their shipped-on rules are for unattended runs and subagents only.
- **Expect higher cost where rules add work.** The Sonnet verify rule added about 58 to 60 percent per run on small fixes, though those runs cost cents. Each hook run also takes 80 to 150 ms of processor time.
- **Keep routing and the classifier off.** Neither is measured. Routing in auto mode causes the other agent calls of the same response to be refused and retried, and the classifier uses the network and costs money.
- **Check what your sessions use against the known gaps:**
  - Workflow agents get nothing.
  - Agent teams are unmeasured.
  - Subagents from organization-synced plugins are predicted on their parent's model.
  - Windows is unsupported.
- **Check your organization's managed settings.** `allowManagedHooksOnly` or `disableAllHooks` stops the per-account install, and server-managed settings make Claude Code ignore the machine-wide one.
- **New model versions get no rules** until the preset declares them; the session gets a warning instead.
- **The benchmark checks delivery against the tool's own resolver.** A rule resolved wrongly would not show there, so spot-check with `noonsight resolve` and `noonsight report` during the pilot.

**What it guarantees:** it guarantees delivery, not obedience — the rules declared for a model are put into the requests of each session and subagent running on it, and again after a model switch, compaction, clear, resume or fork. That rests on Claude Code's hooks behaving as they did on version 2.1.330, within the limits listed above.
