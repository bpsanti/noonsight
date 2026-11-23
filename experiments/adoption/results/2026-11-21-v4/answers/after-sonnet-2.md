**Verdict:** Adopt with conditions. Pilot it on a few machines first, and write your own rules rather than relying on the preset.

**Reasons:**
- **It fits your setup.** Your sessions run on four models and start subagents. That is the case where native options fall short in the author's benchmark. On the first 60 sequences (D6–D10, D17), a user `CLAUDE.md` covered 87.3% of requests and 32.2% of subagent requests. `.claude/rules` covered 70.6% overall and the same 32.2% for subagents. A skill per model covered 0%. noonsight covered 100% of both. A `CLAUDE.md` did reach every request in the session's own conversation (100%, D17), so the gap is subagents and the other models' rules it also sends.
- **Delivery is measured carefully.**
  - The run used real interactive Claude Code sessions against a local stand-in for the API.
  - It covered `/model`, `/compact`, `/clear`, resumes and subagents.
  - The result was 99.9% coverage (3,219 of 3,221 requests, D2). One of 300 sessions failed, and that failure is a documented limit (D1).
  - The fuzzer found four real bugs (F1–F4), each fixed with a regression case. The numbers are checked by `npm test` against committed raw files.
- **It is honest about its limits.** The README says delivery is not obedience, lists what was not measured, and has a "when not to use" section. The hooks never block anything and never use the network, apart from an optional classifier that is off by default.
- **Rule effects are real but narrow.**
  - `verify-changes` took test runs from 0/30 to 29/30 on Sonnet and from 0/30 to 27/30 on Haiku (R1, R3).
  - Sonnet's `carry-through` raised complete backlog runs from 9/40 to 32/40 (R10).
  - These are small tasks with 30–40 runs per arm. Haiku's `carry-through` showed nothing (R11).
  - The extra work costs money: Sonnet's fix went from $0.0240 to $0.0505 per run with `verify-changes` alone (R6).

**Conditions and risks:**
- **The preset does little for watched Opus or Fable sessions.** Their shipped rules apply only to unattended runs and subagents. You would need to set `session.unattended_when_env` and give Sonnet and Haiku sessions a `NOONSIGHT_SCOPE`. Without that, most interactive sessions get little or nothing, and the main value is delivering your own rules per model.
- **It depends on Claude Code internals.**
  - It scrapes the parent process's `--model` via `ps`.
  - It reads the undocumented `CLAUDE_CODE_SESSION_ATTENDED` variable.
  - It infers the resumed model from transcripts.
  - Each fact is pinned to a version (2.1.325–2.1.330). A Claude Code update can break delivery silently. You would have to rerun `npm run test:live` and the delivery corpus on every upgrade. Pin the version or watch `noonsight report`.
- **The benchmark is not held out.** The failures were found and fixed on seed 1, and the final run reused seed 1. The benchmark also checks delivery against noonsight's own resolver, which the delivery README acknowledges: "a wrong resolution would not show here". It never confirms that a model read the text. The README lists the things never measured. They include project configs, `/resume` inside a session, plan mode, agent teams, and subagents that edit files.
- **Maturity is low.** Version 0.1 is not on npm, so you install from a clone with `npm link`. It writes hooks into every Claude Code login on the account, so test `noonsight install` and `uninstall` on a pilot machine. It has one author, and the project was renamed from sextant.
- **Per-repo rules need trust.** Each person must run `noonsight trust` in each repo. Preset updates need review with `noonsight accept`, so assign someone to own that.
- **Rules can cost more than they help.** Measure each rule on your own tasks and drop any that changes nothing. If every session ran one model, a `CLAUDE.md` would be simpler.
- **Hard requirements need hooks or permissions.** Delivered rules are context only and can be ignored.

**What it guarantees:** It guarantees that, on one Claude Code version (2.1.328) in a fuzz of 300 sessions against a stand-in API, 99.9% of requests that had rules due carried their own model's rules, including in subagents. That rests on hooks, noonsight's own resolver as the reference, and a seed-1 test run that was also used to find its bugs. It does not guarantee the model follows the rules or that the same coverage holds on other Claude Code versions.
