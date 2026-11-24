**Verdict: adopt with conditions.** Run it as a time-boxed pilot first, not a team-wide rollout.

I read the README, `docs/evidence.md`, `docs/hooks.md`, `docs/usage.md`, the CHANGELOG, the version-compatibility code (`src/adapters/claude-code/compat.ts`) and the delivery benchmark's limits. I did not run its tests or install it.

**Reasons**

1. **It fixes a real gap for how you work.** Your sessions use several models and many of them start subagents. In the tool's own benchmark, a user `CLAUDE.md` holding every model's rules reached only 46.9% (60 of 128) of subagent requests, and never reaches the built-in Explore and Plan subagents. It also gives each model mostly other models' rules: only 32.6% of the rule text was meant for the model receiving it. noonsight reached 100% (763 of 763) of subagent requests, with 78.6% of the text meant for the receiving model (`docs/evidence.md` D20, D28, D30).
2. **The delivery evidence is unusually rigorous.** The benchmark drove 300 real interactive Claude Code sessions against a local stand-in API. Of the 299 that finished, 0 broke the invariant, and all 3,090 requests that were due rules had them. That includes forks, `/resume`, plan mode and compaction. The fuzzer found nine bugs (F1–F9), and each has a reproduction that fails before its fix. `npm test` recomputes every published number from the committed raw files.
3. **There is little evidence that it makes outcomes better.** Only three preset rules have a measured effect on their own, and Opus 5.5's rules have none. The paid pilot found no difference in pass rate: 133, 132 and 133 of 144 runs passed with no rules, with noonsight, and with a `CLAUDE.md`. Runs cost about 7% more ($0.155 against $0.145). The clear win is `verify-changes`, which got Sonnet and Haiku to run tests after a fix (29 of 30 against 0 of 30), at roughly twice the cost on that small task. The value depends on your having rules that really differ by model.
4. **The preset does little on its own.** By default an attended Opus 5.5 or Fable 5.2 session gets nothing. An attended Sonnet or Haiku session gets only `verify-changes`, and only after it edits a tracked code file. You would mostly be delivering rules you write yourselves.
5. **It is young and tightly tied to Claude Code versions.** It is version 0.1.0 from what looks like a single author, it was renamed from "sextant" recently, and all its measurements fall between 2026-11-16 and 2026-11-23. Defaults changed during development; for example, headless runs became "unattended". Its behavior depends on Claude Code hook details that change between releases, some of them undocumented (such as `CLAUDE_CODE_SESSION_ATTENDED`). The delivery results only hold for Claude Code 2.1.330.

**Conditions and risks**

- **Conditions:**
  - You have, or will write, rules that differ by model or task type. If every model gets the same rules, the README itself says a `CLAUDE.md` is simpler.
  - You pin or track the Claude Code version, and run `noonsight check` and `noonsight report` after each upgrade to catch silent delivery gaps.
  - You use the Anthropic API directly. On Bedrock or Vertex you must set the `ANTHROPIC_DEFAULT_*_MODEL` variables, or model aliases can't be resolved.
  - You avoid the `default` and `opusplan` model settings, which it can't resolve. If any of these don't hold, delivery quietly degrades to warnings.
  - You set `session.unattended_when_env` for orchestrated interactive sessions, so they count as unattended.
- **Known gaps that may affect you:**
  - Workflow agents get nothing.
  - Agent-team teammates in split panes were never checked.
  - Subagents from organization-synced plugins are assumed to run on their parent's model.
  - Parallel foreground subagents of one type that need different rules get theirs late (at their first edit or agent call), or never if they make neither.
  - `/fork` doesn't work in sessions started with `noonsight run`.
  - On macOS, reading the command line with `ps` can misread `--model` text that appears inside a prompt.
- **What the benchmark doesn't check:**
  - The benchmark checks delivery against noonsight's own rule resolver, so a wrong choice of rules wouldn't show up.
  - Agent teams, routing and the classifier were never measured.
- **Operational footprint:**
  - `noonsight install` adds hooks to every Claude Code login on the account.
  - Each hook adds about 80–150 ms of CPU, measured on a loaded laptop.
  - It writes state and a decision log under `~/.local/state/noonsight/`.
  - The optional classifier, if you turn it on, sends up to 4,000 characters of each task to a model through your login.
  - Repository rules apply only after each person runs `noonsight trust` in that repository.
- **Suggested pilot:** a few people, one repository, your own per-model rules. Watch `noonsight report` for undelivered rules and any warnings that a subagent ran on a different model than predicted. Then decide whether the rules change anything you care about.

**What it guarantees:** Through Claude Code's hooks, it puts the rules you declared for a model into the context of every session and subagent running on that model, and again after a model switch, compaction, clear, resume or fork — but that only covers delivery, not whether the model follows the rules, and it rests on Claude Code's hook behavior as measured on version 2.1.330 plus the documented exceptions above.
