# What Anthropic says, and what our data shows

The README and [docs/usage.md](usage.md) rest their advice on Anthropic's own documents only.
Each source below gives its link, the date it was read, and the literal excerpt the advice rests on, followed by what this repository's measurements show about it: whether they confirm it, refine it, contradict it, or say nothing.
A claim with no excerpt here is not made.

`test/evidence.test.ts` checks that every source is one of Anthropic's pages, with a retrieval date and an excerpt, and that every citation in the README and in `docs/usage.md` names a source of this page.
`NOONSIGHT_LIVE_SOURCES=1 npm run test:live` fetches each page again and checks that every excerpt is still on it, word for word (`test/live/sources.test.ts`); a page that changed fails it, and its excerpt and reading are then updated with a new retrieval date.
In the excerpts, a link keeps its text and drops its target.

Every number below links to its entry in [docs/evidence.md](evidence.md).

### S1

- **Document:** Prompting Claude Sonnet 5.5

- **URL:** <https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5>
- **Retrieved:** 2026-11-20

> On agentic coding tasks, Claude Sonnet 5.5 generally checks its work before it reports a change as done. At `low` effort, though, it sometimes reports a change as done without running a check that exercises it.

**Our data: contradicts it for small precise changes, confirms it for larger ones.**
At `medium` effort, without rules, Sonnet 5.5 ran the tests after a precisely described one-file fix in none of its runs, and after a bug fix in half of them; with its three preset rules together, it ran them every time: 30 of 30 against 0 of 30 on the fix ([R1](evidence.md#r1)), 30 of 30 against 15 of 30 on the bug ([R2](evidence.md#r2)).
On a feature across several files it ran them in 30 of 30 runs without any rule ([R13](evidence.md#r13)).
So the guide's paragraph helps at `medium` effort too, on the tasks small enough that the model judges a check unnecessary.

### S2

- **Document:** Prompting Claude Haiku 5.5

- **URL:** <https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-haiku-5-5>
- **Retrieved:** 2026-11-20

> At `low` and `medium` effort, Claude Haiku 5.5 sometimes reports a code change as done without running a check.

> In Anthropic’s testing, the model checked its changes more often with this text, and its performance improved, at the cost of more tokens.

> With a short system prompt, Claude Haiku 5.5 rarely stops before the work is done. With a long coding-agent system prompt at `low` effort, it sometimes stops early and hands the task back to the user.

**Our data: confirms the first two on the fix, does not reproduce the third.**
With `haiku-5-5/verify-changes` alone, the preset's rule adapted from that paragraph, Haiku 5.5 ran the tests after the one-file fix in 27 of 30 runs ([R3](evidence.md#r3)), against 0 of 30 without rules ([R1](evidence.md#r1)), at a higher cost per run: $0.0033 against $0.0015 ([R7](evidence.md#r7)).
On two long tasks at `low` effort inside Claude Code, whose system prompt is long, Haiku did every part without the rule against early stopping ([R12](evidence.md#r12)), and on a harder backlog the rule made no difference we could show: 6 of 40 against 2 of 40 ([R11](evidence.md#r11)).
The guides of Sonnet 5.5 and Haiku 5.5 describe different habits at the same effort, which is why noonsight delivers rules per model.

### S3

- **Document:** How Claude remembers your project

- **URL:** <https://code.claude.com/docs/en/memory>
- **Retrieved:** 2026-11-20

> Claude treats them as context, not enforced configuration. To block an action regardless of what Claude decides, use a PreToolUse hook instead. The more specific and concise your instructions, the more consistently Claude follows them.

> CLAUDE.md content is delivered as a user message after the system prompt, not as part of the system prompt itself. Claude reads it and tries to follow it, but there's no guarantee of strict compliance, especially for vague or conflicting instructions.

> Project-root CLAUDE.md survives compaction: after `/compact`, Claude re-reads it from disk and re-injects it into the session.

> Rules load into context every session or when matching files are opened. For task-specific instructions that don't need to be in context all the time, use skills instead, which only load when you invoke them or when Claude determines they're relevant to your prompt.

**Our data: confirms delivery to the main conversation.**
With every model's rules in a user `CLAUDE.md`, every request of the session's own conversation held them, through `/compact`, `/clear`, `/model` and resumes: 100% (526 of 526) ([D17](evidence.md#d17)).
What a `CLAUDE.md` cannot do is choose by model: every model reads every other model's rules, and only 31.5% of the rule text in a request was its own, against 79.0% under noonsight ([D12](evidence.md#d12)).
noonsight's rules are context in the same way, so the second excerpt holds for them too.

### S4

- **Document:** Create custom subagents

- **URL:** <https://code.claude.com/docs/en/sub-agents>
- **Retrieved:** 2026-11-20

> A non-fork subagent's initial context contains:

> every level of the CLAUDE.md hierarchy the main conversation loads, including `~/.claude/CLAUDE.md`, project rules, `CLAUDE.local.md`, managed policy files, and any `AGENTS.md` files loaded as project instructions. The built-in Explore and Plan agents skip this.

**Our data: confirms it.**
With every model's rules in a `CLAUDE.md` or in `.claude/rules`, 32.2% (39 of 121) of subagent requests held their rules ([D10](evidence.md#d10)): the Explore and Plan subagents never did, and a general-purpose subagent got every model's rules.
noonsight's `SubagentStart` hook reached 100% (668 of 668) of subagent requests over 300 sessions ([D3](evidence.md#d3)), Explore and Plan included.

### S5

- **Document:** Extend Claude with skills

- **URL:** <https://code.claude.com/docs/en/skills>
- **Retrieved:** 2026-11-20

> In a regular session, skill descriptions are loaded into context so Claude knows what's available, but full skill content only loads when invoked.

**Our data: consistent with it, and it measures only the guarantee.**
The benchmark's stand-in for the model never opens a skill, so a skill per model delivered no rule text: 0% (0 of 654) ([D8](evidence.md#d8)).
A real model may open the skill; whether it does on the right model, every time, is not measured.

### S6

- **Document:** Hooks reference

- **URL:** <https://code.claude.com/docs/en/hooks>
- **Retrieved:** 2026-11-20

> Runs after the session's model changes. Use it to give Claude model-specific guidance without editing every CLAUDE.md, for example an organization-wide instruction that applies on certain models.

> Claude Code takes your hook's plain-text stdout on exit 0, or `additionalContext` from JSON output, and delivers it to Claude with the next request after the switch.

> If the model changes several times before the next request, Claude Code delivers only the output for the last switch's target model.

> Write the text as factual statements rather than imperative system instructions.

> Text framed as out-of-band system commands can trigger Claude's prompt-injection defenses, which causes Claude to surface the text to you instead of treating it as context.

> For instructions that never change, prefer CLAUDE.md. It loads without running a script and is the standard place for static project conventions.

**Our data: refines it.**
The first excerpt is the use noonsight makes of `PostModelSwitch`.
The second and third are the cause of F1: a switch's text that never reached a request was still taken as delivered, and a later note did not retire the rules the conversation still held.
Before noonsight treated such a delivery as unconfirmed, 26 of 296 sessions broke the invariant; after that fix and those of F2 to F4, 1 of 300 ([D4](evidence.md#d4), [D1](evidence.md#d1)).
The same holds at a resume (F3): what `SessionStart` returns there also reaches the conversation with the process's next request only, so a resume ended before any request loses it.
noonsight writes its envelope as facts, as the fourth and fifth excerpts ask, and [docs/usage.md](usage.md#choosing-where-a-rule-lives) follows the sixth for rules that are the same for every model.

### S7

- **Document:** Best practices for Claude Code

- **URL:** <https://code.claude.com/docs/en/best-practices>
- **Retrieved:** 2026-11-20

> Current models usually carry on through an agreed task without being told, and lines like that are more likely to cause over-work than fix a stall. Giving Claude a check to pass is different, and still worth doing.

> Older models sometimes needed the emphasis. Current ones follow a plainly worded line, and piling on emphasis mostly makes Claude over-apply the rule.

> Could it find this by reading the code?

> Would it actually go and look?

**Our data: confirms the first, refines it once, says nothing of the second.**
A check to pass is where the rules changed the most: `verify-changes` alone made Sonnet 5.5 and Haiku 5.5 run the tests after the fix in 29 of 30 and 27 of 30 runs, where `carry-through` alone did it in 0 of 30 and 0 of 30 ([R3](evidence.md#r3)).
Telling the model to keep going changed nothing where it already finished: on the long tasks without the rule, 19 of 20 pilot runs did every part as recorded ([R12](evidence.md#r12)).
The refinement: on a backlog where one ticket leaves a decision open, `sonnet-5-5/carry-through` made Sonnet 5.5 settle it instead of handing it back, and the runs that did every part went from 9 of 40 to 32 of 40 ([R10](evidence.md#r10)).
So a rule against handing work back can still pay when the work holds a choice the model would otherwise return to the user.
Emphasis was not measured.

### S8

- **Document:** Effective context engineering for AI agents

- **URL:** <https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents>
- **Retrieved:** 2026-11-20

> Given that LLMs are constrained by a finite attention budget, good context engineering means finding the smallest possible set of high-signal tokens that maximize the likelihood of some desired outcome.

> Rather than pre-processing all relevant data up front, agents built with the “just in time” approach maintain lightweight identifiers (file paths, stored queries, web links, etc.) and use these references to dynamically load data into context at runtime using tools.

**Our data: consistent with the first, confirms the second for one rule.**
Delivering only the model's own rules added 1,155 characters to each request under noonsight, against 4,415 and 3,987 with every model's rules in a `CLAUDE.md` or `.claude/rules` ([D13](evidence.md#d13)); whether that changes what the model does was not measured.
`verify-changes` delivered as one sentence naming the file that holds it was read in 120 of 120 runs ([R4](evidence.md#r4)) and gave the same tests as the rule inline: 30 of 30 against 29 of 30, and 27 of 30 against 27 of 30 ([R5](evidence.md#r5)).
Those sessions were short; a pointer read at the start and then compacted away was not measured.
