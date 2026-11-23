**Verdict: adopt with conditions** — as a time-boxed pilot on a few machines, not a team-wide rollout yet.

I read the docs, changelog, preset sources and committed experiment results, and grepped the source. I could not run the test suite or the tool here, so the numbers below are the repository's own, not ones I reproduced.

## Reasons

- **It targets a gap your setup has.** A user `CLAUDE.md` reached 100% of main-conversation requests (526 of 526) but only 32.2% of subagent requests (39 of 121), because it never reaches the built-in Explore and Plan subagents. noonsight reached 668 of 668 subagent requests in the same benchmark.
- **It keeps other models' rules out.** Under noonsight 79% of the rule text in a request was written for that request's model, against 31.5% for a shared `CLAUDE.md`. That matters only if your rules differ by model.
- **Out of the box it does little for watched sessions.** With the shipped preset, a watched Opus or Fable session receives nothing. A watched Sonnet or Haiku session receives only `verify-changes`, after its first edit of a git-tracked code file. Most of the value would come from rules you write yourselves.
- **Better task outcomes are not shown.** In the 588-run pilot, resolved tasks were 133, 132 and 133 of 144 for off, noonsight and `CLAUDE.md`, and noonsight cost 7% more per run. `verify-changes` made Sonnet run tests in 29 of 30 runs against 0 of 30, but roughly doubled the cost of that small fix ($0.024 to $0.0505), and every run passed its hidden check either way.
- **It is very young.** It is version 0.0.1, not published on npm, and installed from a clone with `npm link`. Its fuzzer found four delivery bugs (F1 to F4) that were fixed between 19 and 21 November 2026.
- **It is low-risk to try.** The hooks always exit 0 and never block a call. There are no runtime dependencies, and I found no network code in `src`; the only processes started are `git`, `ps`, `claude` and the service managers. `noonsight uninstall` removes its hook entries and leaves other settings alone.
- **The engineering is unusually honest.** Limits are documented, failures are kept as reproductions, and `npm test` is said to recompute every published number from the raw files.

## Conditions and risks

Conditions for it to work for you:

- **You have model-specific rules.** If every model should get the same rules, the README itself says a `CLAUDE.md` is simpler.
- **You write and maintain your own rules.** Scoped preset rules stay dormant unless you set `NOONSIGHT_SCOPE`, declare matchers, or turn on the classifier, which sends the first 4,000 characters of a task to a small model.
- **You pin versions.** Delivery was measured on Claude Code 2.1.328 only; re-run the delivery corpus on each Claude Code upgrade. Pin a noonsight commit and set `on_preset_change` to `hold`.
- **Everyone installs per account** on macOS or Linux; Windows is not supported. Run `noonsight check` after install and after upgrades.
- **You measure for yourselves.** Review `noonsight report` after two weeks and drop rules that change nothing you can see.

What could go wrong:

- **Subagent gaps.** Subagents get no rules, or the wrong model's, in these cases:
  - parallel calls of one type that would get different rules;
  - calls held on a permission prompt past the open-call window;
  - plugin-defined and `--agents` subagents;
  - agent team teammates and workflow agents.
- **Undeclared models.** When Claude Code falls back to an older model by itself (seen in the pilot: to Opus 4.8 and Sonnet 5), that model gets a warning and no rules.
- **The log overstates.** The decision log records what the hook returned, not what reached the model, so `noonsight report` is not proof of delivery.
- **Fragile dependencies.** Headless detection reads an undocumented variable, `CLAUDE_CODE_SESSION_ATTENDED`, and resume handling mirrors Claude Code's observed behaviour. A Claude Code release can break either one silently.
- **Headless runs change behaviour.** `claude -p` and Agent SDK runs count as unattended by default and receive the "carry on without checking in" rules. Check this suits your CI.
- **Routing in auto mode.** Routing is off by default; if you turn it on in auto mode, a routed call causes the other calls in the same response to be refused and retried.
- **Overhead.** Each hook run costs 50 to 90 ms of processor time, and rules add about 1,155 characters per request.

## What it guarantees

noonsight guarantees delivery only — that each session and subagent started through the agent tool has its model's rules in context (99.9% of requests, 3,219 of 3,221, and 299 of 300 sessions in its benchmark) — not that the model follows them, and this rests on one fuzz run against a stand-in API on Claude Code 2.1.328 with the preset's rules, scored against noonsight's own resolver.
