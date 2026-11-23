// How a message names noonsight's commands. The messages name them as `noonsight check`; a person who has
// noonsight as a Claude Code plugin has no `noonsight` on PATH, so for them the same message names the
// plugin's skill, /noonsight:check, or, for a command that is not a skill, `npx noonsight install`.

/** The plugin's skills, one per command a person runs inside a session; `setup` is init and check. */
export const SKILL_COMMANDS = ['accept', 'check', 'models', 'report', 'resolve', 'trust', 'untrust'] as const;

const SKILLS = new Set<string>(SKILL_COMMANDS);

/** A message with every command in backticks named as a plugin's person runs it. */
export function forPlugin(text: string): string {
  return text.replace(/`noonsight ([a-z]+)([^`]*)`/g, (_, command: string, rest: string) =>
    SKILLS.has(command) ? `\`/noonsight:${command}${rest}\`` : command === 'init' ? `\`/noonsight:setup\`` : `\`npx noonsight ${command}${rest}\``,
  );
}
