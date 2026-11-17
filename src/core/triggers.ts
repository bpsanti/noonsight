// What counts as revealing a trigger, in the part that needs no file and no process. The adapter adds
// the rest: that the file is one the project's git already tracks (code-edit.ts).

import path from 'node:path';
import type { Trigger } from './types.js';

/** What reveals each trigger, as the person reads it. */
export const TRIGGER_ACTIONS: Readonly<Record<Trigger, string>> = {
  'code-edit': "a session once it edits a code file its project's git already tracks",
};

/**
 * The extensions of the files the code-edit trigger counts as code: source files of programming
 * languages, shell scripts and SQL. Left out on purpose: documents and reports (.md, .html, .txt),
 * styles, data and configuration (.css, .json, .yaml, .toml, .xml, .csv), notebooks, and files with
 * no extension, so writing a report, a note or a setting never counts as building.
 */
export const CODE_EXTENSIONS: ReadonlySet<string> = new Set([
  // C family and the JVM
  'c', 'h', 'cc', 'cpp', 'cxx', 'hh', 'hpp', 'hxx', 'm', 'mm', 'cs', 'java', 'kt', 'kts', 'scala', 'groovy', 'gradle', 'clj', 'cljs', 'cljc',
  // JavaScript and TypeScript
  'js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx', 'mts', 'cts', 'vue', 'svelte',
  // Other languages
  'go', 'rs', 'swift', 'dart', 'py', 'pyi', 'rb', 'php', 'pl', 'pm', 'lua', 'r', 'jl', 'ex', 'exs', 'erl', 'hrl', 'hs', 'ml', 'mli',
  'fs', 'fsx', 'elm', 'nim', 'zig', 'sol',
  // Shell and SQL
  'sh', 'bash', 'zsh', 'fish', 'ps1', 'psm1', 'sql',
]);

/** Whether a file's name has a code extension, compared without case. */
export function hasCodeExtension(file: string): boolean {
  const ext = path.extname(file).slice(1).toLowerCase();
  return ext !== '' && CODE_EXTENSIONS.has(ext);
}
