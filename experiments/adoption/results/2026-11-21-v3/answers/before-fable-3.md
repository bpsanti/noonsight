**Verdict: adopt with conditions**, as a pilot for a few people on a pinned commit, not a team-wide rollout yet.

I read the README, docs, changelog, preset sources and experiment write-ups, and grepped `src/` for network and process use. I did not build it or run its tests.

**Reasons**

- **It solves a problem you have.** It gives each session and subagent the rules written for the model it actually runs on, and re-delivers after `/model`, `/clear`, compaction and resume. In its own delivery benchmark it covered 650 of 650 requests on 60 sequences, against 87.4% for a single `CLAUDE.md` and 70.9% for `.claude/rules`.
- **Subagents are where a `CLAUDE.md` falls short.** The probe showed `CLAUDE.md` never reaches Explore and Plan subagents, and where it does load, every model reads every model's rules.
- **The default preset does little for your interactive work.** A plain Opus or Fable session gets no rule at all. Sonnet and Haiku sessions get `verify-changes` only after their first edit of a tracked code file. Opus subagents get nothing, and Explore under a Fable parent runs on Opus.
- **Outcome benefit is not shown.** In the 588-run benchmark pilot, tasks resolved were 133, 132 and 133 of 144 for off, on and `CLAUDE.md`, while cost per run rose 7% with noonsight. Individual rules did change behaviour:
  - `verify-changes` got tests run in 30 of 30 runs against 0 of 30 on a one-file fix, at 46–59% more cost per run on small fixes.
  - Sonnet's `carry-through` took one backlog task from 9 of 40 to 32 of 40 runs complete.
  - Haiku's `carry-through` showed no effect.
- **Low downside if it fails.** Hooks always exit 0, never block or deny a call, and log every decision. There are no runtime dependencies, and I found no network code in `src/`. The only processes it starts are `ps`, `git`, `claude --version` and the optional classifier. Uninstall removes only its own entries.
- **It is very early.** It is version 0.0.1, marked `private`, unpublished (install is from a clone), single-author, and the whole changelog is "Unreleased". Its fuzzer found four delivery bugs on 19–20 November; the changelog says all are fixed, but I saw no re-run after the last two fixes.

**Conditions and risks**

- **Pin both versions.** Its behaviour rests on Claude Code facts checked on 2.1.325–2.1.328, some by hand and some only from documentation. Re-run `noonsight check` and its live tests before each Claude Code upgrade.
- **Write your own rules or set scopes.** Otherwise most of your sessions receive nothing. That means `NOONSIGHT_SCOPE`, `noonsight run --scope`, your own matchers, or the classifier, which costs a Haiku call per subagent and sends the first 4,000 characters of the task to the model.
- **Install per account.** If your organisation delivers server-managed settings, the machine-wide install is silently ignored. If it sets `allowManagedHooksOnly` or `disableAllHooks`, the per-account hooks will not run. Windows is not supported.
- **Known gaps in subagent coverage.**
  - Plugin subagents, `--agents` definitions and managed definitions are predicted on the parent's model, so they can get the wrong rules; a mismatch is only warned about afterwards.
  - Agent-team teammates and workflow agents get nothing.
  - A call held on a permission prompt for over 2 minutes gets nothing.
  - Parallel calls of one type that differ by model get nothing.
- **Known gaps in model detection.** `default` and `opusplan`, aliases on Bedrock, Vertex or Foundry without a pinning variable, and a model set only by MDM cannot be resolved. When Claude Code itself falls back to an older model, that model is undeclared and gets a warning, not rules.
- **Leave routing off at first.** In auto mode a routed call causes the other calls in the same response to be refused and retried, and routing `investigate` to Fable can bill to usage credits.
- **Treat project configuration as a trust decision.** A repository can commit rules that reach every contributor's sessions; after one `noonsight trust`, later changes apply without asking. Keep `projects.allow` at `add` or `none` and review those files like code.
- **Watch the cost.** Use `noonsight report` and decide whether `verify-changes` is worth its price on your tasks.

**What it guarantees**

It guarantees nothing about what a model does or how well tasks turn out, only that its hook hands Claude Code the rules you declared for the model it identified and never blocks a call. That rests on Claude Code's hook behaviour as observed on 2.1.325–2.1.328 staying the same, on its model prediction being right, and on Claude Code actually forwarding what the hook returns.
