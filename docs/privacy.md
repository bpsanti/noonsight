# Privacy and data

noonsight runs on your machine, under your account.
It has no server, no account and no telemetry, its code opens no network connection, and its author receives nothing from it.

## What leaves the machine

Nothing, with the defaults.
One optional feature uses the network through Claude Code: the [classifier](configuration.md#the-classifier), off unless `classifier.mode` turns it on, runs `claude -p` with the first 4,000 characters of a task and the names and descriptions of your scopes.
That call goes wherever your Claude Code login sends its requests, under the terms of that login.
`noonsight run` starts a Claude Code session, which makes its own requests as any session does.

## Credentials

noonsight asks for no credential and stores none.
A `claude` it starts uses the login Claude Code already has, and inherits the environment of the session or shell that started noonsight.

## What it reads

- The input Claude Code gives each hook, which for an agent call holds the task text, matched against your scopes.
- Your configuration and rules, and a repository's `.noonsight/noonsight.json` once you trust it.
- Claude Code's settings, its list of installed plugins and its subagent definitions.
- Session transcripts, from which it takes models, session and call ids, and whether a call was refused.
- The command line of the Claude Code process, through `ps`, and through `git`, whether an edited file is tracked and how git treats it.

## What it keeps, and where

What it keeps about sessions is in your home directory, and its state directory is readable by your account only.

| What | Where | For how long |
| --- | --- | --- |
| The configuration | `~/.config/noonsight/noonsight.json` | Until you delete it |
| The decision log: for each decision, the model, the rule names, session and call ids, the paths of the configuration and of the project, and an edited file's path in its repository; no prompt and no model response is recorded on purpose, though `classifier_error` holds the start of what a failed `claude` call printed | `~/.local/state/noonsight/decisions.jsonl` and `decisions.1.jsonl` | The log moves at 20 MB, replacing the older one |
| What each session received, its triggers, and the system prompts of `noonsight run` | `sessions/`, `processes/`, `triggers/` and `launch/`, in the same directory | 30 days without a write |
| Subagent records, among them the rules an agent call's subagent receives | `agent-*/` and `agents/`, in the same directory | 7 days |
| Claims, which keep two installs from delivering one event twice: hashes, no content | `claims/`, in the same directory | 1 day |
| The projects you trust, and the directories `noonsight install` reached | `projects.json` and `installs.json`, in the same directory | Until you delete them |
| The Node.js the plugin's launcher found | `~/.local/share/noonsight/node` | Until you delete it |

The fields of the log are in [hooks.md](hooks.md#the-decision-log), and the files an install writes are in [install.md](install.md).
Deleting `~/.local/state/noonsight/` deletes every record.

## Questions

Ask in an [issue](https://github.com/bpsanti/noonsight/issues).
