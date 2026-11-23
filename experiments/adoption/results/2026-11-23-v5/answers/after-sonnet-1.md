**Verdict:** Adopt with conditions. Pilot it before rolling it out to everyone.

**Reasons:**
- **It fits how you work.** You mix Opus, Sonnet, Haiku and Fable, and many sessions start subagents. That is the case noonsight is built for. It delivers rules by the model that is actually running, and again after `/model`, `/compact`, `/clear`, resumes and forks (README, "What it guarantees").
- **The delivery evidence is unusually strong, and it is checkable.**
  - Of 300 random sessions on Claude Code 2.1.330, 0 broke the invariant (D18).
  - 100% of 3,090 requests held their rules (D19), including 763 of 763 subagent requests (D20).
  - Nine failures the fuzzer found (F1–F9) were fixed, and each has a shortest-reproduction test in the corpus. `npm test` recomputes every README number from the raw result files (`docs/evidence.md`).
- **The alternatives you already have are weaker for your setup.** On the same sequences, subagent requests got their model's rules 32.2% of the time with a `CLAUDE.md` or `.claude/rules`, 0 of 121 with skills, and 100% under noonsight (README table, D9–D11). A `CLAUDE.md` is fine for your own session's requests (100%, D17). It also sends every model the other models' rules: 31.5% of the rule text was for the request's model, against 79.0% under noonsight (D12).
- **The footprint is small and reversible.**
  - It has no runtime dependencies, never blocks a tool call and uses no network. The classifier is the one exception, and it is off by default.
  - Hooks cost about 50–90 ms of CPU each (D15).
  - `noonsight uninstall` and `NOONSIGHT_DISABLE=1` undo it.
  - Installing is safe for your existing hooks: it validates every settings file before writing and keeps your other entries (`docs/install.md`).
- **Its claims are honest.** The README says delivery is not obedience, lists what was not measured, and ships most Opus and Fable rules switched off because of their cost.

**Conditions and risks:**
- **Maturity.**
  - Version 0.1 is not on npm. You would install from a clone (the `npx` route comes after publishing).
  - It looks like a single maintainer's project (the repo is under `bpsanti`, and it was renamed from sextant).
  - Someone on your team would need to own it: pin a commit, review updates, and be ready to fork.
- **Claude Code version coupling.**
  - Measurements are per Claude Code version (2.1.328 and 2.1.330). It relies on hook behaviour that Claude Code changes, such as `PostModelSwitch`, `SubagentStart` and the transcript format.
  - Pin or stage Claude Code upgrades. Run `noonsight check` after each one, and run `npm run test:live` if you can.
  - A silent break would mean rules stop arriving without any visible error.
- **The preset does little for attended Opus and Fable sessions.**
  - Their attended rules ship off, so those sessions receive nothing until you run `enable` or write your own rules.
  - Attended Sonnet and Haiku sessions get `verify-changes` only after a tracked code edit. Their other rules need a scope via `NOONSIGHT_SCOPE`.
  - Unattended runs get the preset by default. Set `session.unattended_when_env` for interactive sessions nobody watches.
  - So the real value for you depends on rules you write, and those have no measured effect until you measure them.
- **The effect evidence is thin.**
  - Samples are 30–40 runs per arm on small tasks.
  - `verify-changes` made Sonnet and Haiku run the tests (29 of 30 and 27 of 30, against 0 of 30 without it, R1/R3), but it roughly doubled Sonnet's cost per run ($0.0240 to $0.0505, R6).
  - Haiku's `carry-through` showed no effect (R11).
  - Where models already did the work, the rules changed nothing (R6).
  - Run your own before/after on a few real tasks.
- **Delivery was measured against a stub API.**
  - The benchmark used a local stand-in, so no request reached a model.
  - The reference is noonsight's own resolver. A wrong resolution would not show up in the benchmark (delivery README, "Limits").
  - Spot-check with `noonsight report` and by asking a session which rules it received.
- **Known gaps that match your usage:**
  - Workflow agents get nothing.
  - Foreground subagents of one type that need different rules get nothing until their first Edit, Write or agent call.
  - Subagents from plugins noonsight doesn't read, such as org-synced ones, are predicted on their parent's model.
  - Agent teams, routing and the classifier were not measured.
  - A conversation compacted and then resumed with nothing naming a model can get the wrong model.
  - `/fork` doesn't work in `noonsight run` sessions that have rules.
- **Organisation settings.**
  - If your logins use server-managed settings, `--managed` installs are ignored. Use the per-account install instead.
  - `allowManagedHooksOnly` or `disableAllHooks` would disable it entirely. `noonsight check` reports both.
- **Rollout.**
  - Everyone must run `noonsight trust` once per repository for shared `.noonsight/noonsight.json` files.
  - Windows is unsupported.
  - Installing both machine-wide and per-account delivers the rules twice.
- **Suggested pilot:** 2–3 people for 2–4 weeks, with `noonsight check` and `noonsight report` as exit criteria. Write a few team rules in `all_models`, and measure at least one.

**What it guarantees:** It guarantees that, on the Claude Code version it was tested on, each session and subagent receives the rules written for the model it runs on, and receives them again when that model changes, and that delivery is logged. This rests on Claude Code's official hooks and on a fuzz benchmark against a stub API (0 of 300 sessions failed on 2.1.330), not on any guarantee that the model follows the rules or that they improve results.
