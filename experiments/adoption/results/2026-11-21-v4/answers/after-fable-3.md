**Verdict:** adopt with conditions — as a time-boxed pilot on a few machines, not a team-wide rollout yet.

I read the README, the docs, the preset, the changelog and the committed result files, and scanned the source for process and network use. I could not run the test suite or the tool in this session, so the numbers below are the repository's own.

**Reasons:**

- **It targets your exact setup.** It delivers per-model rules to sessions and subagents through Claude Code hooks, and its own README says to skip it if every session runs one model.
- **Its delivery evidence is strong where it was measured.** In 300 fuzzed sessions, 3,219 of 3,221 requests held the right model's rules and all 668 subagent requests did. One session failed, on a documented limit.
- **The gap it closes is subagents, not the main conversation.** A single `CLAUDE.md` reached 526 of 526 main-conversation requests but only 39 of 121 subagent requests, because built-in Explore and Plan subagents never load it. `CLAUDE.md` also gives every model the other models' rules.
- **Out of the box it does little for interactive work.** With the shipped preset, a watched Opus or Fable session receives nothing, and a watched Sonnet or Haiku session receives only `verify-changes` after editing a tracked code file. The value comes from rules you write yourselves or from headless runs and subagents.
- **There is no evidence it improves task outcomes.** In the 588-run benchmark pilot, tasks resolved were 133 of 144 without it and 132 of 144 with it, at about 7% more cost per run.
- **Individual rules do change behaviour on small tasks.** `verify-changes` took Sonnet from running tests in 0 of 30 runs to 29 of 30, at roughly double the cost of that task ($0.024 to $0.0505). Sonnet's `carry-through` took complete runs from 9 of 40 to 32 of 40; Haiku's showed nothing.
- **It is very young.** `package.json` says 0.0.1 and private, it is not on npm, and you install from a clone. Four delivery bugs were found and fixed between 19 and 21 November, and the unreleased changelog already changes what headless runs receive on upgrade.
- **The blast radius is small.** The hooks always exit 0, never block a call, have no runtime dependencies, and uninstall cleanly. The source imports no network modules; it only spawns `git`, `ps`, `claude` and the service manager.

**Conditions and risks:**

- **Claude Code version.** The benchmark ran on 2.1.328 and CI pins 2.1.325. It depends on observed hook behaviour and one undocumented variable (`CLAUDE_CODE_SESSION_ATTENDED`). Re-run its corpus (`npm run delivery -- corpus`, no login needed) before each Claude Code upgrade.
- **Organisation policy.** If your organisation's managed settings set `allowManagedHooksOnly` or `disableAllHooks`, the per-account hooks never run. The machine-wide install is ignored on logins with server-managed settings. Run `noonsight check` on one work login first.
- **Team sharing is unmeasured.** Repository configurations (`.noonsight/noonsight.json`) are the natural way for a team to share rules, and the benchmark did not cover them. Each person must also install and run `noonsight trust` per repository.
- **Subagent gaps.** Agent-team teammates and workflow agents get nothing. Plugin and `--agents` subagents are predicted on the parent's model and may get the wrong rules. Parallel calls of one type with different rules can get none, as can a call held on a permission prompt.
- **Fallback models.** In the pilot, Claude Code switched by itself to Opus 4.8 or Sonnet 5 in 20 of 21 runs of one task. Those models are not in the preset, so the session got only a note retiring the old rules.
- **The log can overstate.** `noonsight report` records what the hook returned, not what reached the model; the two differed in 60 of 300 benchmark sessions.
- **Platform.** The hook is a POSIX shell script; Windows is not supported.
- **You must measure your own rules.** Effects are shown only for preset rules on small tasks, with 30 to 40 runs per arm.

**What it guarantees:** It guarantees delivery, not obedience — that each session and subagent has in its context the rules configured for the model it actually runs on. That rests on one fuzz run of 300 sessions on Claude Code 2.1.328 against a stubbed API, using only preset rules from the machine configuration, checked against the tool's own resolver.
