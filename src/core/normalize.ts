/**
 * Reduce a model identifier, as a tool reports it, to the bare identifier used as a configuration key.
 *
 *   claude-fable-5-2[1m]                 -> claude-fable-5-2
 *   anthropic/claude-fable-5-2#high      -> claude-fable-5-2
 *   global.anthropic.claude-fable-5-2    -> claude-fable-5-2   (Amazon Bedrock inference profile)
 *   CLAUDE-FABLE-5-2                     -> claude-fable-5-2
 *
 * Returns the empty string when nothing is left, which callers treat as "model not reported".
 */
export function normalizeModel(reported: string | null | undefined): string {
  let m = String(reported ?? '').trim().toLowerCase();
  m = m.replace(/\[[^\]]*\]$/, '');
  m = m.split('#')[0] ?? '';
  m = m.split('/').pop() ?? '';
  m = m.replace(/^(?:[a-z]+\.)?anthropic\./, '');
  return m.trim();
}
