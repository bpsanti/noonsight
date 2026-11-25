# Delivery benchmark, Claude Code 2.1.328, 2026-11-19, after the fixes of F1 and F2

> **Superseded.** The current runs are [2026-11-24](../../claude-code-2.1.330/2026-11-24-9ee1e55/README.md) and, for what it did not run, [2026-11-23](../../claude-code-2.1.330/2026-11-23-c5b9130/README.md), both on Claude Code 2.1.330; quote its numbers, not the ones here, which are history.

The corpus and the self-check on noonsight with the fixes of F1 and F2 (#46), at commit `f02ccf0`, on Claude Code 2.1.328 and the `claude` preset 1.3.1.
The fuzz level and the native arms on this build are not run here; [the earlier folder](../2026-11-19-467d465/README.md) has them, measured before the fixes, and [the next folder](../2026-11-20-4e18c43/README.md) after them.
No request reached Anthropic and no token was spent.

## Corpus

All 16 entries had the outcome they record ([corpus.json](corpus.json)).
The six `f1-` and `f2-` entries, which reproduced F1 and F2 before the fixes, broke no part of the invariant.
`limit-default-model-after-compact` showed the violations it records: a conversation compacted with no response since and resumed with nothing that names a model runs on Claude Code's default model, which noonsight cannot tell (`docs/hooks.md`, "SessionStart").

## Self-check

`npm run delivery -- selfcheck --n 30`: the first 30 sessions of seed 1, on the real build and on each planted one ([selfcheck.json](selfcheck.json), shrunk sequences in [failures/](failures)).
On the real build, none of the 30 sessions broke the invariant.

| Plant | Sessions failing on the planted build only | Exposed sessions caught | Shrunk to | On the real build |
| --- | --- | --- | --- | --- |
| `no-switch-note` | 13 of 30 | 13 of 14 | `start(haiku) > /model opus > turn`, in 5 runs | passes |
| `compact-as-resume` | 4 of 30 | 4 of 5 | `start(opus) > turn > /compact > turn`, in 12 runs | passes |

The exposed sessions not caught, `s1-0022` and `s1-0020`, are the ones the earlier folder reads as not truly exposed; they were not read again on this build.
