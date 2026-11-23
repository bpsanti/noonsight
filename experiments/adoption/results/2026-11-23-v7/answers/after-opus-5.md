**Verdict: adopt with conditions.** Run it as a time-boxed pilot. It shouldn't become a team-wide default yet.

**Reasons**

1. **It fixes a real gap you have, especially for subagents.** In the tool's own benchmark, putting every model's rules in a user `CLAUDE.md` reached only 32.2% (39 of 121) of subagent requests. It never reaches the built-in Explore and Plan subagents. It also sends every model the other models' rules, so only 31.5% of the rule text in a request was meant for that model. Under noonsight, subagent coverage was 100% (763 of 763) on Claude Code 2.1.330 (`docs/evidence.md`, D10, D12, D20). Your team uses four models and many subagents, which is the setup the tool is built for.
2. **The evidence is unusually checkable.** Every number links to a committed raw file, and `npm test` recomputes it (`docs/evidence.md`). The fuzzer found nine of the tool's own failures (F1–F9), around `/model`, resume, forks and plan mode. Each one has a reproduction that failed before its fix and passes now (D23, D24). Known limits are written down rather than hidden.
3. **It's low-risk to run.** The hooks never block anything and never use the network. The only exception is an optional classifier, which is off by default. There are no runtime dependencies, `noonsight uninstall` removes the hooks, and `NOONSIGHT_DISABLE=1` turns it off for a single session.
4. **It's very young.** It's version 0.1, not published on npm, and installed from a clone with `npm link`. All its verification dates fall between 2026-11-14 and 2026-11-23. Delivery was measured on only two Claude Code versions (2.1.328 and 2.1.330), against a local fake API rather than real sessions.
5. **Out of the box it does little for your Opus and Fable users.** Their preset rules for attended (watched) sessions all ship off. An interactive Opus or Fable session gets nothing until someone turns rules on with `enable`. Sonnet and Haiku get most of their rules only when a session has a scope (`NOONSIGHT_SCOPE`) or a code-edit trigger fires (README, "What it does not guarantee").
6. **The evidence that the rules help is thin.** The rule experiments covered Fable, Sonnet and Haiku, not Opus, on small tasks with 30–40 runs each. The clearest effect is that `verify-changes` made Sonnet and Haiku run tests in 29/30 and 27/30 runs, against 0/30 without it (R3). Haiku's `carry-through` showed no effect (R11). Where the models already did the work, the rules changed nothing and still added cost (R6). The tool itself only promises delivery.

**Conditions and risks**

Conditions:
- **You need real model-specific rules.** If everyone could share one set of rules, the tool's own advice is to use `CLAUDE.md` (README, "Using it well").
- **Your org must allow user hooks.** If you're on Team or Enterprise with server-managed settings, the machine-wide `install --managed` hooks are ignored. Per-account install still works unless the org sets `allowManagedHooksOnly` or `disableAllHooks`. `noonsight check` reports both cases (`docs/install.md`).
- **Pin your Claude Code version.** Only upgrade after re-running `npm run test:live` and the delivery corpus. The tool depends on hook behaviour that changes between versions. One input, `CLAUDE_CODE_SESSION_ATTENDED`, is undocumented: if it's dropped, every session counts as attended (`docs/verification/claude-code.md`).
- **Someone has to own the configuration.** That means choosing which rules to `enable` for Opus and Fable, setting `session.unattended_when_env` for interactive sessions nobody watches, and deciding how sessions get a scope.
- **Check that it works for you.** Use `noonsight report` to see what was actually delivered, and drop rules that change nothing visible.

Risks:
- **Some paths get no rules or were never measured.** A workflow's agents get nothing. Agent teams, routing, the classifier and `opusplan` were never measured. Plugin subagents that noonsight doesn't read, such as org-synced ones, are assumed to run on their parent's model. A conversation compacted and then resumed without naming a model can get the wrong model's rules.
- **`noonsight run` disables `/fork`.** Claude Code refuses to fork a session started with its own system prompt, which is what `noonsight run` passes.
- **Each hook call adds a little latency.** Median processor time was 50–90 ms per hook on a normal machine and 80–150 ms on a heavily loaded one (D15).
- **A Claude Code upgrade could quietly break delivery** until the checks are re-run.
- **It depends on one maintainer.** The project has a single author, and the install path changes once it reaches npm.
- **Live model-reading is incomplete.** The check that a model reads the context the hooks add at session start and on `/model` switches is marked "Not yet run". Subagents and scoped sessions were checked live and quoted their rules, so this is a small gap.

**What it guarantees:** In its tests, each session and subagent was sent the rules picked for the model it actually ran on, with no other model's rules left active, but it doesn't make the model follow them. That rests on Claude Code hook behaviour checked only on versions 2.1.325–2.1.330, and on a fake-API benchmark where 0 of 299 sessions broke this rule on 2.1.330.

I only read the repository. I didn't run `npm test` or the live tests, so I haven't confirmed any of the numbers myself.
