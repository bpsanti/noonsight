// The Claude Code versions sextant's hooks need, one line per feature, with the date each was checked
// against Claude Code's documentation. `sextant check` compares the installed claude with these.

export interface Floor {
  readonly version: string;
  readonly feature: string;
  readonly checked: string;
}

export const CLAUDE_CODE_FLOORS: readonly Floor[] = [
  { version: '2.1.251', feature: 'the PostModelSwitch hook event', checked: '2026-11-14' },
];
