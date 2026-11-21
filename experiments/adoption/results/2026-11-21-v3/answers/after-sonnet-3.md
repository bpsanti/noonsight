**Verdict: adopt with conditions.** Run it as a time-boxed pilot on a few sessions first, not as a team-wide install.

**Reasons**
- **It fits how you work.** You mix Opus, Sonnet, Haiku and Fable and start many subagents. Claude Code's native places for rules can't select by model, and `CLAUDE.md` never reaches the built-in Explore and Plan subagents (`README.md`, `docs/usage.md`).
- **Its delivery claim is well measured.**
  - It ran 300 random real Claude Code sessions against a local stand-in for the API, with no tokens spent. The sessions covered `/model`, `/compact`, `/clear`, resume and subagents.
  - Coverage was 99.5% (3,199 of 3,216 requests with rules due) and 99.9% for subagent requests (D2, D3).
  - On the same first 60 sequences it reached 100%. A user `CLAUDE.md` reached 87.3%, `.claude/rules` 70.9%, and one skill per model 0% (D5 to D8).
  - Every figure links to a raw file, and `npm test` recomputes each one (`docs/evidence.md`).
- **The authors are candid about failures.** The fuzzer found four real bugs (F1 to F4), and the docs describe them and one known limit. I'd trust a project that reports this over one that reports a perfect score.
- **It adds little overhead.** It adds about 1,154 characters per request, against about 4,400 for a `CLAUDE.md` holding every model's rules. Each hook run takes 60 to 120 ms of processor time. The hooks never block anything and use no network. The classifier is the exception and is off by default.
- **It's reversible.** `noonsight uninstall` removes the hooks, and `NOONSIGHT_DISABLE=1` turns it off per session.
- **The effect on behavior is real but narrow.**
  - `verify-changes` took test-running after a precise fix from 0 of 30 runs to 29 of 30 on Sonnet, and to 27 of 30 on Haiku (R1, R3).
  - Sonnet's `carry-through` took complete backlog runs from 9 of 40 to 32 of 40 (R10).
  - Where models already did the work, the rules changed nothing and cost a little (R6, R13).

**Conditions and risks**
- **Delivery is not obedience, and the data on rule effects is thin.**
  - The effect tasks are small, with 30 to 40 runs per arm, and the authors say not to generalize.
  - Haiku's `carry-through` showed no effect (R11).
  - I found no Opus rule-effect result in the evidence map.
  - The Fable result measures only report sentence length (R9).
  - Before relying on it, test it on your own tasks with `noonsight report`, and drop rules that change nothing you can see.
- **Rules can raise cost.** `verify-changes` roughly doubled the cost of a cheap Sonnet task, from $0.0240 to $0.0505 per run (R6).
- **It is pinned to Claude Code behavior.**
  - Everything is verified on 2.1.328 to 2.1.329. It depends on undocumented details such as what a resume's hook returns, and F2 to F4 all came from such details.
  - Your team should pin the Claude Code version, or rerun `npm run delivery -- corpus` and the live tests on each upgrade.
  - It reads the parent `claude` process's command line through `ps`, which is fragile.
- **The headline number is not for the shipped build.**
  - The 99.5% rate predates the F3 and F4 fixes, and the 300 sessions were not rerun. The three failing sessions were F3, F4 and the documented limit.
  - Rerun the fuzz on the current build before trusting the number.
- **Several coverage gaps remain.**
  - Not measured: `/resume` inside a session, forks, plan mode, agent teams, `noonsight run`, routing, the classifier, project configurations, and subagents that edit files.
  - A compacted conversation resumed with nothing that names a model runs on a default model that noonsight cannot detect.
- **The default setup delivers little.** A watched session with no scope gets nothing from the preset. You must set `session.unattended_when_env`, give tasks scopes, and declare every model you use. An undeclared model gets a warning and no rules.
- **It is immature.** It's version 0.0.1 and `private: true`, and it isn't on npm. It's installed from a clone and shows no sign of a team behind it. You'd own pinning it, building it, and reviewing preset updates with `noonsight accept`.
- **Trust and security.** It installs hooks into every Claude Code login on the machine. Review the code and test that managed settings don't block it (`noonsight check`). Project-level rule files need a per-person `noonsight trust`.
- **Rule text could simply live in `CLAUDE.md` for some of this.** If most of your sessions use one model with fixed rules, the docs themselves say `CLAUDE.md` is simpler.

**What it guarantees:** On Claude Code 2.1.328, in simulated sessions of the kinds the benchmark covered, noonsight puts each request's model's rules, and no other model's, in the request in about 99.5% of cases (100% for subagents on the 60-sequence comparison). This rests on a fuzz test of real Claude Code sessions against a local stand-in for the API, checked by an oracle that uses noonsight's own resolver. It says nothing about whether a model follows the rules.
