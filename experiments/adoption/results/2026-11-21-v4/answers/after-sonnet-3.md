**Verdict:** Adopt with conditions. Pilot it for a few weeks and decide on your own measurements. I read the README, the docs, the evidence map, the delivery and benchmark results, and the Claude Code compatibility table. I did not run the test suite or any experiment, so everything below is the project's own reported data.

**Reasons:**
- **It solves your problem.** You mix Opus, Sonnet, Haiku and Fable and spawn subagents. The tool picks rules by model, scope, place and trigger, and it re-delivers them on `/model`, `/compact`, `/clear` and resume.
- **Its delivery claim is measured, and the measurement is credible.**
  - Real interactive Claude Code 2.1.328 sessions ran against a local stub of the Messages API, and every request was inspected.
  - 99.9% of requests (3,219 of 3,221) held their rules, 100% of subagent requests (668 of 668) did, and 1 of 300 sessions broke the invariant (D1–D3).
  - The one failure is a documented limit.
  - The fuzzer found four real bugs in the tool, and all four are fixed with reproductions in a corpus (D16).
  - `npm test` recomputes every README number from the raw result files.
- **It beats the native options where you are weakest.** On the same 60 sequences:

  | Method | All requests | Subagent requests |
  | --- | --- | --- |
  | noonsight | 100% | 100% |
  | User `CLAUDE.md` | 87.3% | 32.2% |
  | `.claude/rules` | 70.6% | 32.2% |
  | Skill per model | 0% | 0% |

  `CLAUDE.md` reached 100% of the session's own conversation (D17). Its misses were subagents, and it also gives every model the other models' rules (79.0% vs 31.5% own-model text).
- **The footprint is small.** It uses hooks only, makes no network calls (except the optional classifier), and never blocks anything. Hook cost is 50–90 ms of CPU per run, it has no runtime dependencies, and `noonsight report` and `noonsight resolve` show exactly what was delivered.
- **The authors are candid about limits.** They say outright that delivery is not obedience and that it is not worth using for a single-model setup.

**Conditions and risks:**
- **Delivery is not benefit, and the effect evidence is thin.**
  - The preset's rules changed behavior on small tasks. `verify-changes` took test runs from 0 of 30 to 29 of 30 on Sonnet (R1, R3), and Sonnet's `carry-through` took complete backlog runs from 9 of 40 to 32 of 40 (R10).
  - In the broader paid benchmark, `on` did not beat `off`. The verifier resolved 132 of 144 runs with it against 133 of 144 without, and the judge scores were slightly lower (digest 0.68 vs 0.72).
  - Cost per run was about 7% higher ($0.151 vs $0.141 overall), and the Sonnet fix task roughly doubled in cost with `verify-changes`.
  - Treat the preset as a hypothesis to test on your own tasks.
- **Defaults give some sessions nothing.**
  - A watched Opus or Fable session receives no preset rules, because those rules are only for unattended runs and subagents.
  - Watched Sonnet and Haiku sessions get only `verify-changes` after a tracked code edit, unless you set `NOONSIGHT_SCOPE`.
  - You need to set `session.unattended_when_env` for your CI or orchestrator.
  - You also need to define scopes with `match` patterns, since the preset's scopes have none.
- **It depends on Claude Code internals, so pin and re-verify.**
  - It reads the undocumented `CLAUDE_CODE_SESSION_ATTENDED` variable.
  - It finds the model through `ps` or `/proc` on the parent process and through the transcript.
  - It relies on resume-model behavior that was found empirically (F2, F4).
  - Every fact was checked on specific versions, mostly 2.1.325–2.1.330. A Claude Code upgrade can break delivery silently, so rerun `npm run test:live` and the delivery corpus on each upgrade. Also check `noonsight report` for rules that are on but were never delivered.
- **Known gaps:**
  - A compacted conversation resumed with nothing that names a model runs on Claude Code's default model, and noonsight cannot tell which.
  - Several simultaneous agent calls of one type that would get different rules leave their subagents without rules.
  - The benchmark did not cover `/resume` inside a session, forks, plan mode, agent teams, `noonsight run`, routing, the classifier, project configs, or subagents that edit files.
- **Maturity and trust:**
  - It is version 0.1 and not on npm. You install from a clone with `npm link`, so pin a commit and review the hooks before they touch every team login.
  - Per-repo configs need `noonsight trust` on each clone. Treat that file like code, because it injects text into model context.
- **Not a guarantee.** If a rule must never be broken, use a hook or permission rule instead. For rules every model should follow, keep using `CLAUDE.md`.

**What it guarantees:** It guarantees that the rules written for a model reach that model's requests, subagents included, and that other models' rules don't linger unretired. That rests on a fuzzed benchmark of 300 sessions on one Claude Code version (2.1.328) against a local stub, using noonsight's own resolver as the reference. It does not guarantee that the model follows the rules or that the rules improve outcomes.
