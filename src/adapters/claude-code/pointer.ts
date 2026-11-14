// The hook pointer: a small shell script at a fixed path that Claude Code's settings call. It runs
// the installed copy of sextant by absolute paths, so the hook does not depend on the PATH of
// whatever started Claude Code. Reinstalling or updating sextant rewrites only this file; the
// settings entries that call it never change.

import fs from 'node:fs';
import type { InstallKind } from './locations.js';

export interface PointerTarget {
  /** The Node.js executable. */
  readonly node: string;
  /** sextant's command line entry point. */
  readonly cli: string;
  readonly kind: InstallKind;
  /** The sextant version that wrote the pointer. */
  readonly version: string;
}

export function pointerScript(t: PointerTarget): string {
  return [
    '#!/bin/sh',
    `# sextant-ai hook pointer, written by \`sextant install\`.`,
    '# Claude Code settings run this file; it runs the installed copy of sextant.',
    `# kind: ${t.kind}`,
    `# version: ${t.version}`,
    `node=${shellQuote(t.node)}`,
    `cli=${shellQuote(t.cli)}`,
    'if [ -x "$node" ] && [ -f "$cli" ]; then',
    `  exec "$node" "$cli" hook --install ${t.kind} "$@"`,
    'fi',
    '# The installed copy is gone. A hook never holds the session, so exit quietly;',
    '# `sextant check` reports the missing copy.',
    'exit 0',
    '',
  ].join('\n');
}

/** The target a pointer file runs, or null when the file is missing or was not written by sextant. */
export function readPointer(file: string): PointerTarget | null {
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
  const field = (re: RegExp): string | undefined => re.exec(text)?.[1];
  const node = field(/^node=('(?:[^']|'\\'')*')$/m);
  const cli = field(/^cli=('(?:[^']|'\\'')*')$/m);
  const kind = field(/^# kind: (managed|account)$/m);
  const version = field(/^# version: (\S+)$/m);
  if (!node || !cli || !kind || !version) return null;
  return { node: shellUnquote(node), cli: shellUnquote(cli), kind: kind as InstallKind, version };
}

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

function shellUnquote(s: string): string {
  return s.slice(1, -1).replace(/'\\''/g, "'");
}
