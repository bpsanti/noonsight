**Verdict:** Adopt with conditions. Run it as a pilot on a few machines first, not as a team-wide default.

**Reasons:**
- It targets the gap you have. Your team mixes Opus, Sonnet, Haiku and Fable, and a single `CLAUDE.md` cannot give each model its own rules. The README's measurements show `CLAUDE.md` covering 88.2% of main-session requests and 46.9% of subagent requests, and a per-model `.claude/rules` setup covering 76.3% and 46.9%. The benchmark reports noonsight at 100% on both (3,090 of 3,090 and 763 of 763) under Claude Code 2.1.330 (`README.md` lines 33–38; `experiments/delivery/results/claude-code-2.1.330/2026-11-23-c5b9130/summary.md`).
- Your subagent use is the main reason to consider it. Subagent coverage is where native options fall short, and the benchmark included subagents that edit files.
- The hooks are deliberately low-risk. They always exit 0, never block, and read only local files (`docs/hooks.md` line 10). `noonsight report` and `noonsight resolve` let you check what each model receives before any session runs.
- Its rule-effect results are narrow but useful. `verify-changes` on Sonnet and Haiku ran tests after a one-file fix in 29/30 and 27/30 runs, against 0/30 without rules. It roughly doubled that small fix's cost, from $0.0240 to $0.0505 (`README.md` lines 206–207).
- The docs are candid about limits. The README lists what it does not guarantee, and a benchmark run in 2026 cannot make a claim it has not measured.

**Conditions and risks:**
- **Install from a pinned commit, not npm.** The README says version 0.1 is not on npm yet and the package name holds only a placeholder. Install from a reviewed clone, and pin the commit.
- **Pin your Claude Code version, or re-test when it changes.** The delivery claim is measured on 2.1.330. The README says hook behaviour changes between versions and each result is tied to a version. Check your team's version before adopting.
- **It writes to every login's user settings.** `noonsight install` adds hooks to `settings.json` for every login it finds (`docs/install.md` line 73). That is a machine-wide change, so pilot on machines you can recover. Uninstall is `noonsight uninstall`.
- **Set `session.unattended_when_env` for CI and orchestrators.** Interactive sessions count as attended by default. Without that setting, unattended runs may get the wrong rules. Headless `claude -p` runs are unattended by default.
- **Fable is thin out of the box.** Most preset rules for Fable and Opus are off for attended sessions. A team that uses Fable interactively should decide which rules to enable, or write its own.
- **Known gaps:** workflow-spawned agents get no rules, a session that is compacted and then resumed with nothing naming a model can run on Claude Code's default model, and plugin-supplied subagents are predicted from their parent's model. Agent teams, routing and the classifier are not measured.
- **Delivery is not obedience.** A delivered rule is context the model may or may not follow. The README says so itself.
- **Leakage.** Other models' rule text still appears in requests: only 78.6% of the rule text in a request is for that model's own rules (`summary.md`, on-g2 table). That adds context cost and may matter for your token budget.
- **The evidence is the author's own.** The benchmark ran real Claude Code sessions against a local stand-in API, and no model answered. I did not run the tool or its test suite, and I did not check the benchmark against an independent source. Treat the numbers as a credible starting point, and check them in your own pilot with `noonsight report`.

**Suggested pilot:** Two or three machines, one repo, a month of use. Measure with `noonsight report` and `noonsight check`, and compare token use and any missed rule against your current setup.

**What it guarantees:** In the 2026-11-23 benchmark on Claude Code 2.1.330, every request with rules due received its own model's rules, and no other model's rules were left unretired, across 299 sessions (3,090 of 3,090 requests). That rests on the author's hook-based benchmark, which used a local API stand-in, so it shows delivery only, not that the model followed the rules.
