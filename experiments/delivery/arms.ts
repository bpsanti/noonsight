// The files each arm adds to a session, and the text that shows they reached it.
//
// - on: noonsight with every model's preset rules; nothing else.
// - claudemd: noonsight declares every model "use": "none"; a user CLAUDE.md holds every model's
//   rules, under a heading per model (experiments/benchmark/conditions.ts, unionRules).
// - rules: as claudemd, with the rules in the project's .claude/rules/ instead: one file per model,
//   since .claude/rules has no selector by model, and the rules noonsight delivers on a code edit in a
//   second file per model scoped with `paths:` to the code files, the native counterpart of the trigger.
// - skills: as claudemd, with one skill per model whose description says to load it on that model.
// - off: noonsight is not installed.
//
// Claude Code loads neither a user CLAUDE.md nor .claude/rules for a project inside one of its own
// scratchpad folders, so a native arm whose text never reaches a request is a harness failure, not a
// result: arms.ts names the text each native arm puts in the session's first request.

import fs from 'node:fs';
import path from 'node:path';
import { defaultOnRules, modelName, presetText, unionRules } from '../benchmark/conditions.js';
import { MODELS, type Arm } from './oracle.js';

function family(model: string): string {
  return model.replace(/^claude-/, '').replace(/-\d+-\d+$/, '');
}

const SKILL_HINT = 'Load this skill at the start of every task when you run on';

/** Write an arm's files into the session's Claude Code configuration directory and project. */
export function writeArm(arm: Arm, claudeDir: string, project: string): void {
  if (arm === 'claudemd') fs.writeFileSync(path.join(claudeDir, 'CLAUDE.md'), unionRules(MODELS));
  if (arm === 'rules') {
    const dir = path.join(project, '.claude', 'rules');
    fs.mkdirSync(dir, { recursive: true });
    for (const m of MODELS) {
      const rules = defaultOnRules(m);
      const triggered = (r: (typeof rules)[number]): boolean => ((r as { triggers?: readonly string[] }).triggers ?? []).length > 0;
      const plain = rules.filter((r) => !triggered(r));
      const onEdit = rules.filter(triggered);
      if (plain.length) fs.writeFileSync(path.join(dir, `${family(m)}.md`), `# Working rules for ${modelName(m)}\n\n${plain.map((r) => presetText(r).trim()).join('\n\n')}\n`);
      if (onEdit.length)
        fs.writeFileSync(
          path.join(dir, `${family(m)}-code.md`),
          `---\npaths:\n  - "src/**/*.ts"\n---\n\n# Working rules for ${modelName(m)} when editing code\n\n${onEdit.map((r) => presetText(r).trim()).join('\n\n')}\n`,
        );
    }
  }
  if (arm === 'skills')
    for (const m of MODELS) {
      const dir = path.join(claudeDir, 'skills', `rules-${family(m)}`);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'SKILL.md'),
        `---\nname: rules-${family(m)}\ndescription: Working rules for ${modelName(m)}. ${SKILL_HINT} ${modelName(m)}.\n---\n\n${defaultOnRules(m)
          .map((r) => presetText(r).trim())
          .join('\n\n')}\n`,
      );
    }
}

/** Text a native arm always puts in the session's first request, or null for `on` and `off`. */
export function armMarker(arm: Arm): string | null {
  if (arm === 'claudemd') return 'Each section is written for one model.';
  if (arm === 'rules') return '# Working rules for ';
  if (arm === 'skills') return SKILL_HINT;
  return null;
}
