# noonsight Strategy

## Vision

<!-- vision: author-approved 2026-11-25 -->

`noonsight` exists so that each Claude Code session, and each subagent it starts, works under the rules written for the model it actually runs on.
It serves people who run several Claude models, attended or not, and it turns the rules they declare per model, scope, place and trigger into context delivered at the moment it applies.
It owns exactly one thing: putting the declared rules into the requests of the model they are for, and keeping them right when that model changes or the conversation is compacted, cleared, resumed or forked.

### Delivery, not obedience

A delivered rule is context, and noonsight claims delivery, never compliance.
Rules are picked by model, scope, place and trigger, never by their text, so a guarantee about delivery covers every rule a user writes.
The hooks never block a tool call and never fail a session, even when the configuration is refused.
noonsight has no enforcement mode, opt-in or not: something that must never happen belongs in a Claude Code hook or permission rule of its own.
A lost delivery is a defect; delivering the same rules twice is an accepted cost.

### Refuse rather than guess

An invalid configuration is refused whole, with a message that names the problem, rather than applied in part.
When the model, the scope or the project cannot be known, noonsight delivers less and warns, instead of guessing.
Behavior is deterministic by default: no classifier, no routing and no watcher run until the user turns them on, even where that leaves scoped rules dormant.
Routing, when on, is the only feature that changes a call beyond its context, and it yields to any model the caller chose.
A trigger may deliver only a rule that costs nothing when the trigger misfires.
A repository's configuration changes nothing until each person trusts it, and a preset update can be held until the user accepts it.

### Every claim has its evidence

Every number the documentation states links to an entry that names its raw result file, how it is computed, its date and its Claude Code version, and a test computes it again.
Every quotation of Anthropic carries its link, its retrieval date and the literal excerpt, and a live test checks it against the page.
A result belongs to the rule, the model, the task and the Claude Code version it ran on, and is never stated as general.
Limits, failures found and results that show no effect are published next to the guarantee.
A delivery failure the benchmark finds is fixed at its root, with a regression test and a corpus sequence that reproduces it.
Claude Code changes how hooks behave, so delivery is checked again on each new Claude Code version, and a fix for a version ships with evidence from that version that delivery holds there.
That check is the project's work before a release, not a warning shown in the user's sessions.
The README's commands and configuration examples run in a sandbox in `npm test`, and anything the code exposes that the docs omit fails the build.

### Each model gets rules written for it

The rules are the user's; the preset is only where they start.
A preset rule comes from a public Anthropic source for that model, named by page, section and date, together with its effect and its cost.
A rule with no guide behind it enters the preset only when its effect on that model holds on benchmarks beyond the experiment that found it.
Rules are declared per exact model identifier, and a rule written for one version is never carried to another, since advice that gets the most out of one model can fail the next.
A new model version gets no rules until the preset declares it.
A rule with a high cost, a described side effect or a narrow use ships off.
Nothing Claude Code already sends is delivered again.

### The user's rules, the user's call

noonsight may help the user write and keep rules that work: it may point to what a model's guide advises against, and it may measure what a rule changes on the user's own tasks, with the cost shown before anything is spent.
When built, measuring runs only when the user starts it with a command, and it keeps a log of every run: what ran, what it cost and how each run was scored, a model's judgement included.
When built, advice on a rule's wording is a warning given once; noonsight never refuses, rewrites or drops a rule the user chose to keep.
noonsight may also offer an option, off by default and for Explore and Plan too, to deliver a `CLAUDE.md` to the subagents Claude Code leaves without it, while `CLAUDE.md` stays the place for rules every model shares.

### Local and private

noonsight reads only local files, opens no connection of its own and has no telemetry.
Only what the user turns on or starts sends anything: the classifier, off by default, and measuring, run on the user's command, both through the user's own Claude Code login.
The decision log records what was delivered and why, never prompts or responses.

### Scope

noonsight is not an enforcement layer, not a model router by default, not an orchestrator and not a telemetry service.
Claude Code is the host it is built and tested on.
Other agent hosts and rules distributed to a whole organization from one place wait for users to ask for them; they are not built ahead of demand.

A change aligns when it makes the right model's rules reach a request they did not reach, or reach it more surely, with a test or a benchmark sequence that shows it; when it makes a claim more exact, better sourced or checked; or when it helps the user write, measure or place their own rules without changing what reaches a session by default.
A change should be resisted when it blocks or steers what a session does beyond adding context and opt-in routing, guesses a model or scope where it could refuse and warn, carries a rule from one model version to another, overrides a rule the user chose to keep, sends data off the machine by default, ships a preset rule without its evidence and cost, builds for a host or audience no user has asked for, or states a number the evidence map does not hold.
