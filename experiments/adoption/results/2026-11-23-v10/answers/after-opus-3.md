**Verdict: adopt with conditions.** Run it as a time-boxed pilot. Only roll it out to the whole team if you actually have rules that should differ by model, and if you check it on the Claude Code version you run.

**Reasons**

1. **It solves a real problem you have.** You run several models and use many subagents. The native options handle that poorly. In the project's own benchmark, a user `CLAUDE.md` reached only 46.9% of subagent requests (60 of 128), and `.claude/rules` did no better. `CLAUDE.md` never reaches the built-in Explore and Plan subagents. Under noonsight, 763 of 763 subagent requests got their rules (`docs/evidence.md` D20, D28).
2. **It stops models getting each other's rules.** With every model's rules in one `CLAUDE.md`, 619 requests carried another model's rules with nothing marking them as not applying. Under noonsight there were 0 (D32). It also adds fewer characters per request: about 1,343 against 4,472 (D31).
3. **The evidence is unusually careful.** Every number is tied to a committed raw file and recomputed by `npm test` (`test/evidence.test.ts`). The fuzzer found nine of the tool's own bugs (F1–F9), which were fixed, kept as test cases and shown to fail on the build before each fix (D23, D24). The hooks always exit 0, never block or deny anything, have no runtime dependencies or install scripts, and make no network calls unless you turn on the classifier.
4. **But the payoff in results isn't shown, especially for Opus and Fable.** There's no measured quality gain. In the pass-rate pilot, 133/144 runs passed with no rules, 132/144 under noonsight and 133/144 with `CLAUDE.md` (B1), and every run passed its hidden check with or without rules (R8). The measured effects are behavioural, on small tasks: Sonnet and Haiku running tests, and shorter sentences in Fable's reports. They come with higher cost, for example Sonnet on the fix went from $0.024 to $0.038 per run (R6). No Opus 5.5 rule has a measured effect. Out of the box, an interactive Opus or Fable session gets nothing from the preset, because those rules ship off.
5. **It's young and depends on Claude Code internals.** It's at version 0.1.0. It relies on hook events, on transcript layout, and on `CLAUDE_CODE_SESSION_ATTENDED`, a variable Claude Code doesn't document. The measurements ran on Claude Code 2.1.326–2.1.330, while CI pins 2.1.325 for its live checks.

**Conditions and risks**

Conditions:
- **You write your own model-specific rules.** The tool picks rules but doesn't make them good. If your rules are the same for every model, the project itself says to use `CLAUDE.md` instead (`docs/usage.md:143`).
- **You pin and re-check your Claude Code version.** Run `noonsight check` and the delivery corpus (`npm run delivery -- corpus`, which uses no tokens) on each Claude Code upgrade before rolling it out.
- **You mark unattended sessions.** Set `session.unattended_when_env` for unattended sessions run by orchestrators. Turn on the Opus/Fable attended rules you want with `enable`. Give Sonnet/Haiku sessions a scope.
- **You treat rules as advice.** They are context, not enforcement. Anything that must never happen still needs a permission rule or a blocking hook.
- **You measure your own payoff.** Use `noonsight report` plus a few of your own before-and-after runs. Drop rules that change nothing, since each one costs tokens on every request.

Risks:
- **Known gaps that may apply to you:**
  - Workflow agents get no rules.
  - Agent-team teammates in split panes weren't checked.
  - Subagents from plugins your organization syncs are guessed to run on their parent's model.
  - The tool can't tell which model `opusplan` or `default` picks.
  - On Bedrock, Vertex or Foundry, model aliases point elsewhere, so it only warns.
  - `/fork` stops working in sessions started with `noonsight run`.
  (README limits, `docs/hooks.md:391`.)
- **Quiet failure.** A single config error makes it refuse the whole config and deliver nothing, with only an on-screen warning. A Claude Code change to hooks could break delivery while everything looks fine. The decision log records what the hook returned, not what reached the model.
- **Extra cost.** Each hook takes about 80–150 ms of CPU, measured on a busy laptop (D33). Rules also add to cost per run.
- **Install and policy.** Managed settings in your organization may forbid user hooks. An `npx` install stops working once npm's cache is cleared. Each login needs its own plugin install.

**What it guarantees:** It guarantees that the rules you declared for a model are put into every session and subagent request running on that model, and put in again after model switches, compaction, `/clear`, resume and fork. That is delivery, not obedience. It rests on Claude Code's hook behaviour as checked on versions 2.1.325–2.1.330, and on a benchmark of 299 real sessions that used a stand-in API instead of real models, judged against noonsight's own resolver. So it shows the rules arrive, not that they're the right rules or that any model follows them.
