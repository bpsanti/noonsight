// The files that make the npm package a Claude Code plugin too, generated so they cannot drift from the
// code: the hook entries from HOOK_HANDLERS, the version from package.json, one skill per command a person
// runs inside a session. `npm run plugin-files` writes them, and a test holds the committed files to this.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PACKAGE_ROOT } from '../../config/paths.js';
import { SKILL_COMMANDS } from '../../wording.js';
import { CLAUDE_CODE_FLOORS } from './compat.js';
import { PLUGIN_NAME } from './plugins.js';
import { HOOK_HANDLERS, HOOK_TIMEOUT_SECONDS, matcherOf } from './settings.js';

/** The plugin's launcher, relative to its folder; run through /bin/sh, so its executable bit does not matter. */
export const LAUNCHER = 'scripts/noonsight';
const LAUNCHER_PATH = `\${CLAUDE_PLUGIN_ROOT}/${LAUNCHER}`;

const DESCRIPTION = 'Hands every Claude Code session and subagent the rules for the model it actually runs on.';

type SkillName = (typeof SKILL_COMMANDS)[number] | 'setup';

const SKILLS: Readonly<Record<SkillName, { readonly description: string; readonly hint?: string; readonly commands: readonly string[] }>> = {
  accept: { description: 'Accept the installed preset version of noonsight: list what it changes, then record it in the configuration.', commands: ['accept'] },
  check: { description: 'Check the noonsight configuration, what installs its hooks, and the last decision.', commands: ['check'] },
  models: { description: 'List the models noonsight declares and their rules, with source and cost.', commands: ['models'] },
  report: { description: 'Report from the noonsight decision log how often each rule was delivered, and to which models, scopes and places.', commands: ['report'] },
  resolve: { description: 'Show the rules noonsight gives a model, in a scope and a place.', hint: '<model> [scope] [place]', commands: ['resolve $ARGUMENTS'] },
  setup: { description: 'Write the noonsight configuration from the preset when there is none, then check everything.', commands: ['init', 'check'] },
  trust: { description: "Apply this project's noonsight configuration to the sessions that run in it.", hint: '[<dir>]', commands: ['trust $ARGUMENTS'] },
  untrust: { description: "Stop applying this project's noonsight configuration.", hint: '[<dir>]', commands: ['untrust $ARGUMENTS'] },
};

function skill(name: SkillName): string {
  const s = SKILLS[name];
  const line = (command: string): string => `/bin/sh "${LAUNCHER_PATH}" ${command}`;
  return [
    '---',
    `description: ${JSON.stringify(s.description)}`,
    ...(s.hint !== undefined ? [`argument-hint: ${JSON.stringify(s.hint)}`] : []),
    'disable-model-invocation: true',
    `allowed-tools: ${JSON.stringify(s.commands.map((c) => `Bash(${line(c.split(' ')[0] as string)}:*)`).join(', '))}`,
    '---',
    '',
    'Show the output below to the person as it is, with nothing added.',
    '',
    ...s.commands.flatMap((c) => ['```!', `${line(c)} 2>&1 || true`, '```', '']),
  ].join('\n');
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/** Every generated file, by its path in the package. */
export function pluginFiles(version: string): Record<string, string> {
  const hooks: Record<string, unknown[]> = {};
  for (const spec of HOOK_HANDLERS) {
    const matcher = matcherOf(spec);
    (hooks[spec.event] ??= []).push({
      ...(matcher !== undefined ? { matcher } : {}),
      hooks: [{ type: 'command', command: '/bin/sh', args: [LAUNCHER_PATH, 'hook', spec.arg], timeout: HOOK_TIMEOUT_SECONDS }],
    });
  }
  return {
    '.claude-plugin/plugin.json': json({
      name: PLUGIN_NAME,
      version,
      description: DESCRIPTION,
      author: { name: 'Bruno Santi' },
      homepage: 'https://github.com/bpsanti/noonsight#readme',
      repository: 'https://github.com/bpsanti/noonsight',
      license: 'MIT',
      // What Anthropic's plugin directory shows in a listing; Claude Code does not read these.
      icon: './.claude-plugin/icon.png',
      documentationUrl: 'https://github.com/bpsanti/noonsight/blob/main/docs/install.md#as-a-claude-code-plugin',
      supportUrl: 'https://github.com/bpsanti/noonsight/issues',
      privacyPolicyUrl: 'https://github.com/bpsanti/noonsight/blob/main/docs/privacy.md',
      engines: { 'claude-code': `>=${CLAUDE_CODE_FLOORS[0]?.version ?? '0.0.0'}` },
    }),
    // The plugin is the npm package itself, by its exact version.
    '.claude-plugin/marketplace.json': json({
      name: PLUGIN_NAME,
      owner: { name: 'Bruno Santi' },
      description: 'The rules for the model each session runs on.',
      plugins: [{ name: PLUGIN_NAME, source: { source: 'npm', package: 'noonsight', version }, description: DESCRIPTION, category: 'productivity' }],
    }),
    'hooks/hooks.json': json({ hooks }),
    ...Object.fromEntries((Object.keys(SKILLS) as SkillName[]).map((name) => [`skills/${name}/SKILL.md`, skill(name)])),
  };
}

/** Write the generated files; the skills folder holds nothing else. */
function write(): void {
  const { version } = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8')) as { version: string };
  fs.rmSync(path.join(PACKAGE_ROOT, 'skills'), { recursive: true, force: true });
  for (const [rel, content] of Object.entries(pluginFiles(version))) {
    const file = path.join(PACKAGE_ROOT, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) write();
