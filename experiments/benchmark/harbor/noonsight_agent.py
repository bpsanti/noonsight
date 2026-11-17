"""Harbor's claude-code agent with noonsight's hooks inside the task container.

The agent is Harbor's own ClaudeCode adapter; this subclass changes only what the pilot needs:

- install: Claude Code from Anthropic's native installer at the pinned version (as Harbor does), a
  pinned Node.js from a tarball checked against its sha256, and noonsight from a package packed from
  the pre-registered commit. The task images' own Node, when there is one, is often too old.
- configure: the condition's noonsight configuration, and the hook pointer that runs noonsight with
  its home under /logs/agent, so the decision log comes back with the run's logs.
- run: Claude Code as Harbor runs it, with the settings file that holds noonsight's hook entries
  (passed as the agent's ``config``); then the repository's diff against the commit the run started
  from, saved next to the logs.

The bundle directory that holds the tarballs and the condition comes from NOONSIGHT_BENCH_BUNDLE in
the environment of the ``harbor`` process; experiments/benchmark/run.ts writes it for every run.
"""

from __future__ import annotations

import json
import os
import shlex
from pathlib import Path

from harbor.agents.installed.claude_code import ClaudeCode
from harbor.environments.base import BaseEnvironment
from harbor.models.agent.context import AgentContext

ROOT = "/opt/noonsight"
POINTER = f"{ROOT}/bin/noonsight-hook"
CONFIG = f"{ROOT}/config/noonsight.json"
HOME = "/logs/agent/noonsight-home"
UPLOAD = "/installed-agent/noonsight"
RULES_DIR = "/opt/agent-notes"


class NoonsightClaudeCode(ClaudeCode):
    @staticmethod
    def name() -> str:
        return "noonsight-claude-code"

    def _bundle(self) -> Path:
        value = os.environ.get("NOONSIGHT_BENCH_BUNDLE", "")
        if not value or not Path(value, "bundle.json").is_file():
            raise RuntimeError("NOONSIGHT_BENCH_BUNDLE must name a bundle directory written by experiments/benchmark/run.ts")
        return Path(value)

    async def install(self, environment: BaseEnvironment) -> None:
        bundle = self._bundle()
        manifest = json.loads((bundle / "bundle.json").read_text())
        # Claude Code itself, as Harbor installs it, without the distribution's nodejs and npm: the
        # native build does not need them, and noonsight brings its own Node below.
        await self.ensure_system_dependencies(environment, ("curl", "bash", "procps"))
        version = f" {self._version}" if self._version else ""
        await self.exec_as_agent(
            environment,
            command=(
                "set -euo pipefail; "
                f"curl -fsSL https://downloads.claude.ai/claude-code-releases/bootstrap.sh | bash -s --{version} && "
                "echo 'export PATH=\"$HOME/.local/bin:$PATH\"' >> ~/.bashrc && "
                'export PATH="$HOME/.local/bin:$PATH" && claude --version'
            ),
        )
        arch = (await environment.exec(command="uname -m", user="root")).stdout.strip()
        node_arch = {"aarch64": "arm64", "arm64": "arm64", "x86_64": "x64"}.get(arch)
        if node_arch is None:
            raise RuntimeError(f"no pinned Node.js for the container architecture {arch!r}")
        node_file = manifest["node"][node_arch]["file"]
        await environment.exec(command=f"mkdir -p {UPLOAD} {ROOT}/node {ROOT}/prefix {ROOT}/bin {ROOT}/config", user="root")
        await environment.upload_file(bundle / node_file, f"{UPLOAD}/{node_file}")
        await environment.upload_file(bundle / manifest["package"], f"{UPLOAD}/{manifest['package']}")
        await self.exec_as_root(
            environment,
            command=(
                "set -euo pipefail; "
                f"echo '{manifest['node'][node_arch]['sha256']}  {UPLOAD}/{node_file}' | sha256sum -c - && "
                f"tar -xJf {UPLOAD}/{node_file} -C {ROOT}/node --strip-components=1 && "
                f"{ROOT}/node/bin/node {ROOT}/node/lib/node_modules/npm/bin/npm-cli.js install -g --offline --no-audit --no-fund "
                f"--prefix {ROOT}/prefix {UPLOAD}/{manifest['package']} && "
                f"{ROOT}/node/bin/node {ROOT}/prefix/lib/node_modules/noonsight/dist/src/cli.js --version"
            ),
        )

    async def configure(self, environment: BaseEnvironment) -> None:
        await super().configure(environment)
        bundle = self._bundle()
        for f in sorted((bundle / "condition" / "config").iterdir()):
            await environment.upload_file(f, f"{ROOT}/config/{f.name}")
        cli = f"{ROOT}/prefix/lib/node_modules/noonsight/dist/src/cli.js"
        pointer = (
            "#!/bin/sh\n"
            f"mkdir -p {HOME}\n"
            f"HOME={HOME} NOONSIGHT_CONFIG={CONFIG} exec {ROOT}/node/bin/node {cli} hook --install account \"$@\"\n"
        )
        await self.exec_as_root(
            environment,
            command=f"printf '%s' {shlex.quote(pointer)} > {POINTER} && chmod 755 {POINTER} && chmod -R a+rX {ROOT} && mkdir -p {HOME} && chmod 777 {HOME}",
        )
        # The Markdown of the conditions that stand for the usual alternative to noonsight: a user
        # CLAUDE.md where Claude Code reads it ($CLAUDE_CONFIG_DIR, which Harbor sets to the sessions
        # directory under the agent's logs), and the rules file the scattered condition points to.
        # Neither touches the task's repository, so the diff and the verifier see nothing of them.
        extra = bundle / "condition" / "claude"
        if (extra / "CLAUDE.md").is_file():
            config_dir = (self.environment_logs_dir / "sessions").as_posix()
            await environment.exec(command=f"mkdir -p {config_dir} && chmod 777 {config_dir}", user="root")
            await environment.upload_file(extra / "CLAUDE.md", f"{config_dir}/CLAUDE.md")
            await environment.exec(command=f"chmod 644 {config_dir}/CLAUDE.md", user="root")
        if (extra / "rules.md").is_file():
            await environment.exec(command=f"mkdir -p {RULES_DIR}", user="root")
            await environment.upload_file(extra / "rules.md", f"{RULES_DIR}/rules.md")
            await environment.exec(command=f"chmod -R a+rX {RULES_DIR}", user="root")
        # The commit the run starts from, for the diff after it.
        await environment.exec(command="git rev-parse HEAD > /logs/agent/base-commit.txt 2>/dev/null || true", user="root")

    async def run(self, instruction: str, environment: BaseEnvironment, context: AgentContext) -> None:
        try:
            await super().run(instruction, environment, context)
        finally:
            # What the run changed against the commit it started from, committed or not, new files
            # included, through a scratch index so the repository's own index stays as the run left it.
            await environment.exec(
                command=(
                    "if base=$(cat /logs/agent/base-commit.txt 2>/dev/null) && [ -n \"$base\" ]; then "
                    "export GIT_INDEX_FILE=/tmp/noonsight-diff-index; rm -f $GIT_INDEX_FILE; "
                    "git read-tree HEAD && git add -A . >/dev/null 2>&1; "
                    "git diff --cached --no-color --no-ext-diff \"$base\" > /logs/agent/changes.diff 2>/dev/null; "
                    "git diff --cached --name-only \"$base\" > /logs/agent/changed-files.txt 2>/dev/null; "
                    "rm -f $GIT_INDEX_FILE; fi; true"
                ),
                user="root",
            )
