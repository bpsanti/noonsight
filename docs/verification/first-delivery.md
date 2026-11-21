# The first delivered rule, from the README alone

A fresh Claude Code session, with no other context, was given only the README of commit `beee7da` and an empty git repository, and asked to install noonsight, get it to deliver its first rule to a Claude Code session, and confirm the delivery.
This is its whole transcript: every command it ran, what each printed, and its final report.
It reached its first delivered rule and confirmed it twice: the session it started named both rules, and `noonsight report` counted their delivery.

## How it ran

- **Date:** 2026-11-20.
- **Session:** `claude -p` on `claude-sonnet-5-5` at `medium` effort, Claude Code 2.1.330, with the Bash, Read, Write, Edit, Glob and Grep tools allowed.
- **Sandbox:** an empty home directory, Claude Code configuration directory and npm prefix, and an empty git repository as the working directory, so nothing of the machine's own Claude Code, noonsight or npm setup was in reach; the paths below read `<sandbox>` for it, and `<home>` for the home directory of the machine, whose Node.js and `claude` the sandbox used.
- **Login:** an OAuth token in the environment, and in the sandbox's user settings, since Claude Code keeps that variable out of the commands its Bash tool runs and the README's session is one of them; the sandbox was deleted after the session.
- **Cost:** $0.10 for the whole session, the nested one included, as Claude Code reports it; 7 turns.
- **The clone:** the README tells the reader to clone `main`, so the session built `main` as it was that day; its code differs from this branch only in the usage text of `noonsight hook`.
- **Its prompt:** "You are in an empty git repository. A teammate sent us the README below for a tool called noonsight. Using only this README, install noonsight and get it to deliver its first rule to a Claude Code session, then confirm the delivery. Run the commands yourself. When you are done, report each step you took, what you saw, and whether the delivery is confirmed.", followed by the README in `<readme>` tags.

A first attempt the same day stopped at the nested session, which answered "Not logged in": the token was then only in the environment.
Its install, `resolve` and `report` went as in the run below.

## Transcript

**Claude:** I'll start by checking prerequisites and cloning into a fresh directory.

**Bash:**

```bash
node --version; npm --version; which claude; pwd; mkdir -p <sandbox>/noonsight-src && cd <sandbox>/noonsight-src && git clone https://github.com/bpsanti/noonsight.git . 2>&1 | tail -5; ls
```

Output:

```text
v26.13.0
11.20.0
<home>/.local/bin/claude
<sandbox>/work
Cloning into '.'...
CHANGELOG.md
docs
experiments
LICENSE
package-lock.json
package.json
presets
README.md
schema
src
test
tsconfig.json
Shell cwd was reset to <sandbox>/work
```

**Claude:** Node 26 and Claude Code are present. Before running the build, I'll check the package's install scripts.

**Bash:**

```bash
cd <sandbox>/noonsight-src && cat package.json
```

Output:

```text
{
  "name": "noonsight",
  "version": "0.0.1",
  "private": true,
  "description": "Every model has its own north. Hand every Claude Code session and subagent the rules for the model it actually runs on.",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/bpsanti/noonsight.git"
  },
  "homepage": "https://github.com/bpsanti/noonsight#readme",
  "bugs": {
    "url": "https://github.com/bpsanti/noonsight/issues"
  },
  "type": "module",
  "bin": {
    "noonsight": "dist/src/cli.js"
  },
  "files": [
    "dist/src",
    "schema",
    "presets"
  ],
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "npm run build && node --test dist/test/*.test.js",
    "test:live": "npm run build && node --test dist/test/live/*.test.js",
    "experiment": "npm run build && node dist/experiments/rules/run.js",
    "benchmark": "npm run build && node dist/experiments/benchmark/bench.js",
    "delivery": "npm run build && node dist/experiments/delivery/run.js"
  },
  "devDependencies": {
    "@types/node": "^20.19.43",
    "typescript": "^7.0.2"
  }
}
Shell cwd was reset to <sandbox>/work
```

**Claude:** No install-time hooks, only a build script. Running the README's install steps.

**Bash:**

```bash
cd <sandbox>/noonsight-src && npm install 2>&1 | tail -5 && npm run build 2>&1 | tail -5 && npm link 2>&1 | tail -3; which noonsight
```

Output:

```text
npm notice
npm notice New major version of npm available! 11.20.0 -> 12.2.3
npm notice Changelog: https://github.com/npm/cli/releases/tag/v12.2.3
npm notice To update run: npm install -g npm@12.2.3
npm notice

> noonsight@0.0.1 build
> tsc -p tsconfig.json

added 1 package, and audited 3 packages in 198ms

found 0 vulnerabilities
<sandbox>/npm-global/bin/noonsight
Shell cwd was reset to <sandbox>/work
```

**Claude:** Build and link worked. Next is `noonsight install`, which edits Claude Code settings under the home directory, as the README describes.

**Bash:**

```bash
noonsight install 2>&1; echo "exit=$?"; echo ---; noonsight resolve claude-sonnet-5-5 routine 2>&1; echo "exit=$?"
```

Output:

```text
wrote <sandbox>/home/.config/noonsight/noonsight.json: preset claude 1.3.1, 4 models declared with "use": "preset"
  claude-fable-5-2: 2 of 4 rules on
  claude-opus-5-5: 1 of 3 rules on
  claude-sonnet-5-5: 3 of 6 rules on
  claude-haiku-5-5: 2 of 3 rules on
hook pointer <sandbox>/home/.local/share/noonsight/noonsight-hook: written (runs <home>/.nvm/versions/node/v26.13.0/bin/node <sandbox>/noonsight-src/dist/src/cli.js)
hooks <sandbox>/home/.claude/settings.json: added (SessionStart, PostModelSwitch, PreToolUse, SubagentStart, PostToolUse)
Each declared model receives:
  claude-fable-5-2: 2 of 4 rules (fable-5-2/finish-work: subagent; fable-5-2/low-context-report: unattended, subagent)
  claude-opus-5-5: 1 of 3 rules (opus-5-5/unattended-run: unattended)
  claude-sonnet-5-5: 3 of 6 rules (sonnet-5-5/carry-through: unattended, subagent; sonnet-5-5/stay-in-scope: session, unattended, subagent; sonnet-5-5/verify-changes: session, unattended, subagent)
  claude-haiku-5-5: 2 of 3 rules (haiku-5-5/carry-through: unattended, subagent; haiku-5-5/verify-changes: session, unattended, subagent)
  (after each rule: the places it is delivered in; `noonsight models` shows scopes, source, effect and cost)
ok: config <sandbox>/home/.config/noonsight/noonsight.json: valid (4 model entries; subagents: rules when each subagent starts, permission allow for a routed call, on mismatch warn)
ok: preset claude 1.3.1: the version the configuration accepted
ok: scopes: 5 scopes declared, 0 matchers
ok: triggers: code-edit, which delivers sonnet-5-5/verify-changes for claude-sonnet-5-5, haiku-5-5/verify-changes for claude-haiku-5-5 to a session once it edits a code file its project's git already tracks
ok: routing: off, so noonsight never changes a model or an effort
ok: classifier: off, so a task without an explicit scope takes its scope from the matchers alone
ok: machine-wide install: not installed (/Library/Application Support/ClaudeCode/managed-settings.d/noonsight.json)
ok: account install <sandbox>/home/.claude: hooks in <sandbox>/home/.claude/settings.json (SessionStart, PostModelSwitch, PreToolUse on Agent|Task, SubagentStart, PostToolUse on Agent|Task, PostToolUse on Edit|Write)
ok: account install <sandbox>/home/.claude: hook pointer <sandbox>/home/.local/share/noonsight/noonsight-hook runs noonsight 0.0.1
ok: watcher: off; `noonsight watch enable` installs into each new Claude Code configuration directory as it appears
ok: claude: 2.1.330
ok: no decisions logged yet in <sandbox>/home/.local/state/noonsight
Changed: the configuration file was written; hooks were added to 1 Claude Code configuration directory.
Done: from the next Claude Code session on, a session with no scope receives only the rules its model has for every scope in that place, which may be none. A rule limited to scopes reaches a session only in one of them, set with `NOONSIGHT_SCOPE` or `noonsight run --scope`, and a subagent in the scope its task matches, or the classifier gives it when the classifier is on. `noonsight report` shows what was delivered. To undo: `noonsight uninstall`.
exit=0
---
{
  "status": "matched",
  "model": "claude-sonnet-5-5",
  "key": "claude-sonnet-5-5",
  "scope": "routine",
  "place": "session",
  "rules": [
    "sonnet-5-5/stay-in-scope",
    "sonnet-5-5/verify-changes"
  ],
  "sha256": "1f7d6d4c52af3e54",
  "text": "<noonsight-rules model=\"claude-sonnet-5-5\" scope=\"routine\">\nWorking rules the user declared for claude-sonnet-5-5, task scope \"routine\" (delivered by noonsight, rules sonnet-5-5/stay-in-scope, sonnet-5-5/verify-changes):\nOnce the requested work is done and checked, the user wants a report and a stop. Features, tests, files, documentation or refactors nobody requested stay out of the change; if one seems useful, suggest it in the report rather than adding it. Additions that the project's own instructions explicitly require, in its instruction files or in the documents they point to, are part of the request; a convention they only describe is not a requirement.\n\nA code change that can be executed, built or type-checked gets a real check that exercises it before it is called done: the project's test suite, its type checker or its build, or a run of the changed command. Checking only the syntax does not count, and neither does a check command that never started. If all that is lacking is the dependencies the project declares, install those with the project's own package manager and lockfile (npm install, or pip install -r requirements.txt, for example), not with sudo or the system's package manager, unless the user said not to. Only when no real check is possible here does the report say which check was skipped and why, in place of calling the change done.\n</noonsight-rules>"
}
exit=0
```

**Bash:**

```bash
NOONSIGHT_SCOPE=routine timeout 180 claude -p --model sonnet "Which working rules did you receive from noonsight, and for which model?" 2>&1; echo "exit=$?"
```

Output:

```text
I received two working rules from noonsight, declared for model `claude-sonnet-5-5` with task scope "routine". Their IDs are `sonnet-5-5/stay-in-scope` and `sonnet-5-5/verify-changes`.

**1. Stay in scope**
- Once the requested work is done and checked, I report and stop.
- I don't add features, tests, files, documentation or refactors nobody asked for. If one seems useful, I suggest it in the report instead.
- Additions that the project's instruction files, or the documents they point to, explicitly require count as part of the request. A convention they only describe is not a requirement.

**2. Verify changes**
- A code change that can be run, built or type-checked gets a real check before I call it done. That means the test suite, the type checker, the build, or a run of the changed command. A syntax-only check doesn't count, and neither does a check command that never started.
- If the only thing missing is the project's declared dependencies, I install them with the project's own package manager and lockfile (for example `npm install` or `pip install -r requirements.txt`). I don't use sudo or the system package manager unless you've said not to.
- If no real check is possible, the report says which check I skipped and why, instead of calling the change done.
exit=0
```

**Claude:** The session named both rules. Now to confirm the delivery from noonsight's own log:

**Bash:**

```bash
noonsight report 2>&1; echo "exit=$?"
```

Output:

```text
log <sandbox>/home/.local/state/noonsight/decisions.1.jsonl, <sandbox>/home/.local/state/noonsight/decisions.jsonl
1 decision, from 2026-11-20T22:40:24.784Z to 2026-11-20T22:40:24.784Z
  delivered rules: 1 (session-start 1)
  delivered no rules: 0

Rules delivered, most often first:
  sonnet-5-5/stay-in-scope: 1 delivery in 1 session, last 2026-11-20T22:40:24.784Z
     models: claude-sonnet-5-5 1
     scopes: routine 1
     places: session 1
     events: session-start 1
     text: 446 characters for claude-sonnet-5-5
  sonnet-5-5/verify-changes: 1 delivery in 1 session, last 2026-11-20T22:40:24.784Z
     models: claude-sonnet-5-5 1
     scopes: routine 1
     places: session 1
     events: session-start 1
     text: 705 characters for claude-sonnet-5-5

On in the configuration (<sandbox>/home/.config/noonsight/noonsight.json), never delivered in this log:
  fable-5-2/finish-work for claude-fable-5-2 (scopes: investigate, build; places: subagent)
  fable-5-2/low-context-report for claude-fable-5-2 (scopes: every scope; places: unattended, subagent)
  opus-5-5/unattended-run for claude-opus-5-5 (scopes: every scope; places: unattended)
  sonnet-5-5/carry-through for claude-sonnet-5-5 (scopes: every scope; places: unattended, subagent)
  haiku-5-5/carry-through for claude-haiku-5-5 (scopes: every scope; places: unattended, subagent)
  haiku-5-5/verify-changes for claude-haiku-5-5 (scopes: investigate, build, routine; places: session, unattended, subagent)
exit=0
```

## Its final report

noonsight is installed and its first rule reached a Claude Code session. The delivery is confirmed from two independent sources.

**Steps**
1. **Prerequisites.** Node was v26.13.0 (the README needs 20 or newer) and `claude` was already on PATH.
2. **Clone.** I cloned `https://github.com/bpsanti/noonsight.git` into its own empty directory, separate from the work repo. `package.json` has no install-time scripts, only a `build` script, so I ran the build.
3. **Build and link.** `npm install` added 1 package with 0 vulnerabilities. `npm run build` (`tsc`) ran clean. `npm link` put `noonsight` on PATH.
4. **`noonsight install`.** It exited 0.
   - It wrote `noonsight.json` with preset claude 1.3.1 and 4 models.
   - It added hooks to `~/.claude/settings.json` for SessionStart, PostModelSwitch, PreToolUse, SubagentStart and PostToolUse.
   - Its own checks all printed `ok`, including Claude Code 2.1.330. The only change it reported was that file write and the hooks.
5. **`noonsight resolve claude-sonnet-5-5 routine`.** It returned `status: matched` with rules `sonnet-5-5/stay-in-scope` and `sonnet-5-5/verify-changes`, plus the exact text a model would receive.
6. **Live session.** I ran `NOONSIGHT_SCOPE=routine claude -p --model sonnet "Which working rules did you receive from noonsight, and for which model?"`. Claude named both rules, for `claude-sonnet-5-5` with scope "routine", and summarized their content correctly.
7. **`noonsight report`.** The log recorded 1 decision, a `session-start` that delivered rules. Both `sonnet-5-5/stay-in-scope` and `sonnet-5-5/verify-changes` show 1 delivery each, to `claude-sonnet-5-5`, scope `routine`, place `session`. The other 6 enabled rules were listed as never delivered, which is expected for this scope and place.

**Deviations from the README**
- I used `claude -p` (non-interactive) instead of an interactive session, and I didn't leave a session by hand. The SessionStart hook fired the same way.
- The `~/.claude` and `~/.config` paths in the output sit under a temporary home directory, so the hooks are installed there. They are not in your usual home. `noonsight uninstall` removes them.
- The `-p` session was a real model call and used some usage. The `-p` run was a single prompt, so the report shows only that session.
