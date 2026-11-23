**Verdict: Adopt with conditions.** Pilot it on Sonnet and Haiku first, and don't roll it out to Opus or Fable until someone has checked what those sessions actually receive.

**Reasons**

- It matches your mix. Its core feature is giving each model, and each subagent, the rules written for that model. You run four models and many subagents, which is the case where per-model rules help most. A single `CLAUDE.md` can't do that.
- Its own measurements favor it over native options. On the same 60 sequences, it covered 100% of requests with their rules, against 87.3% for a user `CLAUDE.md` and 70.6% for `.claude/rules`. Subagent coverage was 100% against 32.2%. A `CLAUDE.md` never reaches the built-in Explore and Plan subagents, and noonsight does.
- The most recent run is on Claude Code 2.1.330, the newest version I saw evidence for. It reports 0 of 299 sessions that ran to the end breaking the rule invariant after fixes for five bugs, and 100% of 3,090 requests with rules due holding them (D18, D19, in `docs/evidence.md`).
- The rule-effect results are small but concrete. `verify-changes` made Sonnet and Haiku run the tests after a one-file fix in 29/30 and 27/30 runs, against 0/30 without it. It roughly doubled the cost of that run ($0.0240 to $0.0505).
- It fails quietly in the safe direction. Hooks never block, and the only network use is an opt-in classifier. Setting `NOONSIGHT_DISABLE=1` turns it off for a session.
- Caveat on what I checked: I read the README, the verification notes, and the evidence entries. I did not re-run `npm test`, the benchmark, or the live checks, so the numbers above are the repo's own reported figures.

**Conditions and risks**

- **Opus and Fable get little by default.** Their attended rules ship off, so an interactive Opus or Fable session receives nothing from the preset until someone enables a rule with `enable`. Decide which rules you want on, then verify with `noonsight resolve` and `noonsight report`. Don't assume coverage.
- **Set `session.unattended_when_env`.** Otherwise your orchestrator or CI sessions count as attended. Set it to a variable your CI or orchestrator already sets.
- **Install from a clone.** Version 0.1 is not on npm, so each machine needs `npm install && npm run build && npm link`. It writes hooks into every Claude Code login on the account, so treat it as a change to shared machine config. Keep a record of who installed it and when.
- **Pin and recheck the Claude Code version.** The repo says each fact is verified only for the version it names, and that Claude Code changes hook behavior. Before each upgrade, rerun `noonsight report` and the live checks, and have someone check that the version you use is one the repo lists.
- **Known gaps you may hit:**
  - Workflow agents get no rules.
  - A foreground subagent of one type that needs different rules gets none until its first Edit, Write, or agent call.
  - Plugins that your org syncs aren't read, so their subagents follow the parent's model.
  - A resume with nothing naming a model can run on the wrong model, and noonsight can't tell.
  - `/fork` is refused in sessions started by `noonsight run` with rules.
  - Agent teams, routing, and the classifier are not measured.
- **Repo-level rules need trust.** Each person must run `noonsight trust` in each repo, or the file does nothing. Make that part of onboarding.
- **Keep the classifier off** unless you approve it. When on, it sends the first 4,000 characters of each task to a model through your login.
- **Live tests can bill Fable.** `NOONSIGHT_LIVE_LOGIN=1` runs `claude -p` checks, and the repo says these bill Fable usage to usage credits without asking. Don't run them on shared accounts without a decision.
- **The evidence is the author's, and the sample is small.** The headline benchmark used a local stand-in for the API, so no request reached a real model. Rule-effect runs use 30–40 runs per arm on small tasks. Run your own check on your real work before you trust the numbers.
- **Delivery is not obedience.** The tool shows that a model received a rule. It does not show the model followed it. You'll need your own measurements to tell whether a rule changed behavior.

**What it guarantees:** Each Claude Code session and subagent gets the rules resolved for its model, scope, place, and trigger, and rules meant for other models are retired. This was measured on Claude Code 2.1.330 with 299 sessions and 3,090 requests, with a stand-in API. It rests on Claude Code's hook events, on an undocumented environment variable (`CLAUDE_CODE_SESSION_ATTENDED`) to tell attended from headless runs, and on the repo's own benchmark. It does not guarantee the model follows the rules.
