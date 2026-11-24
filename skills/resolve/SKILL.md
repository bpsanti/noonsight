---
description: "Show the rules noonsight gives a model, in a scope and a place."
argument-hint: "<model> [scope] [place]"
disable-model-invocation: true
allowed-tools: "Bash(/bin/sh \"${CLAUDE_PLUGIN_ROOT}/scripts/noonsight\" resolve:*)"
---

Show the output below to the person as it is, with nothing added.

```!
/bin/sh "${CLAUDE_PLUGIN_ROOT}/scripts/noonsight" resolve $ARGUMENTS 2>&1 || true
```
