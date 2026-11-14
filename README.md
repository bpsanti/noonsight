# sextant-ai

Take a fix before you set the course: pick the right model for each agent task, and hand every agent the practices that fit the model it actually runs on.

**Status: design stage.** Nothing is usable yet.

## What it will do

1. **Route (optional).** Choose the model and effort for a task from rules you declare, based on where each model is strong. Skip this part if an orchestrator already picks models for you.
2. **Instruct.** Give each Claude Code session and subagent the rules for the model it runs on, through official Claude Code hooks: no network proxy, no credentials handled.
   It ships a starting preset per current model, built from cited benchmarks and vendor prompting guides, and every rule is configurable.

It works on its own and alongside agent orchestrators.

## License

MIT
