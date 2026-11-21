// Readers for the documentation's own structure, shared by the tests that check it: the entries of
// the evidence map (docs/evidence.md), the sources of docs/sources.md, and the prose of a Markdown page.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PACKAGE_ROOT } from '../src/config/paths.js';

const MAP = path.join(PACKAGE_ROOT, 'docs', 'evidence.md');

export interface Entry {
  readonly id: string;
  readonly value: string;
  readonly fields: Readonly<Record<string, string>>;
}

/** The entries of the map: a `### <id>` heading, then `- **Field:** text` lines; the value is in backticks. */
export function readMap(text: string = fs.readFileSync(MAP, 'utf8')): Entry[] {
  const entries: Entry[] = [];
  for (const section of text.split(/^### /m).slice(1)) {
    const [heading = '', ...lines] = section.split('\n');
    const fields: Record<string, string> = {};
    for (const line of lines) {
      const m = /^- \*\*([A-Za-z ]+):\*\* (.*)$/.exec(line);
      if (m) fields[(m[1] ?? '').toLowerCase()] = m[2] ?? '';
    }
    const value = /^`([^`]+)`$/.exec(fields.value ?? '')?.[1];
    assert.ok(value, `evidence ${heading}: no value in backticks`);
    entries.push({ id: heading.trim(), value, fields });
  }
  return entries;
}

/** The prose lines of a Markdown page: fenced code, inline code, HTML comments and link targets removed. */
export function proseLines(text: string): { line: number; text: string; raw: string }[] {
  const out: { line: number; text: string; raw: string }[] = [];
  let fenced = false;
  text
    .replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, ''))
    .split('\n')
    .forEach((raw, i) => {
      if (/^\s*(```|~~~)/.test(raw)) {
        fenced = !fenced;
        return;
      }
      if (fenced) return;
      out.push({ line: i + 1, raw, text: raw.replace(/`[^`]*`/g, '').replace(/\]\([^)]*\)/g, ']') });
    });
  return out;
}

const SOURCES = path.join(PACKAGE_ROOT, 'docs', 'sources.md');
/** Where a source may come from: Anthropic's own documentation and engineering pages only. */
export const PRIMARY = /^https:\/\/(?:code\.claude\.com\/docs\/|platform\.claude\.com\/docs\/|docs\.anthropic\.com\/|www\.anthropic\.com\/(?:engineering|news)\/)/;

export interface Source {
  readonly id: string;
  readonly url: string;
  readonly retrieved: string;
  /** The literal excerpts, each one blockquote, with its lines joined by a space. */
  readonly excerpts: readonly string[];
}

/** The sources of docs/sources.md: a `### S<n>` heading, `- **URL:**`, `- **Retrieved:**`, then blockquotes. */
export function readSources(text: string = fs.readFileSync(SOURCES, 'utf8')): Source[] {
  return text
    .split(/^### /m)
    .slice(1)
    .map((section) => {
      const [heading = '', ...lines] = section.split('\n');
      const field = (name: string): string => lines.find((l) => l.startsWith(`- **${name}:** `))?.slice(`- **${name}:** `.length).trim() ?? '';
      const excerpts: string[] = [];
      let current: string[] | null = null;
      for (const l of lines) {
        if (l.startsWith('> ')) (current ??= []).push(l.slice(2));
        else if (current) {
          excerpts.push(current.join(' '));
          current = null;
        }
      }
      if (current) excerpts.push(current.join(' '));
      return { id: (heading.split(' ')[0] ?? '').trim(), url: field('URL').replace(/^<|>$/g, ''), retrieved: field('Retrieved'), excerpts };
    });
}

