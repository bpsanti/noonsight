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

/**
 * A model alias and the model it selects on the Anthropic API, from
 * https://code.claude.com/docs/en/model-config ("Model aliases" and "Version history"). Claude Code
 * resolves an alias itself; the hook needs this only when a session names its model by an alias and
 * the SessionStart input leaves the model out, as it does in `claude -p`.
 */
export interface ModelAlias {
  readonly alias: string;
  /** The environment variable that pins what the alias selects, on every provider. */
  readonly envVar: string;
  /** What the alias selects on the Anthropic API when that variable is unset. */
  readonly model: string;
  /** The first Claude Code version where the alias selects that model. */
  readonly since: string;
}

export const MODEL_ALIASES_CHECKED = '2026-11-14';

export const MODEL_ALIASES: readonly ModelAlias[] = [
  { alias: 'opus', envVar: 'ANTHROPIC_DEFAULT_OPUS_MODEL', model: 'claude-opus-5-5', since: '2.1.280' },
  { alias: 'best', envVar: 'ANTHROPIC_DEFAULT_OPUS_MODEL', model: 'claude-opus-5-5', since: '2.1.321' },
  { alias: 'sonnet', envVar: 'ANTHROPIC_DEFAULT_SONNET_MODEL', model: 'claude-sonnet-5-5', since: '2.1.284' },
  { alias: 'haiku', envVar: 'ANTHROPIC_DEFAULT_HAIKU_MODEL', model: 'claude-haiku-5-5', since: '2.1.293' },
  { alias: 'fable', envVar: 'ANTHROPIC_DEFAULT_FABLE_MODEL', model: 'claude-fable-5-2', since: '2.1.321' },
];

/**
 * Model settings Claude Code resolves while the session runs, from the account, the organization or
 * the plan mode, so the hook cannot tell which model they select.
 */
export const RUNTIME_MODEL_VALUES: readonly string[] = ['default', 'opusplan'];

/**
 * The environment variables that move Claude Code off the Anthropic API, where the aliases select
 * other models (https://code.claude.com/docs/en/env-vars).
 */
export const PROVIDER_VARS: readonly string[] = [
  'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_USE_VERTEX',
  'CLAUDE_CODE_USE_FOUNDRY',
  'CLAUDE_CODE_USE_MANTLE',
  'CLAUDE_CODE_USE_ANTHROPIC_AWS',
  'CLAUDE_CODE_USE_ANTHROPIC_GOOGLE_CLOUD',
];
