// Every feature the code exposes is documented: each command and its options, each key of the
// configuration and project schemas, each environment variable the code reads, each hook event it
// installs, each trigger and place, and each preset rule. The inventory comes from the code itself,
// so a feature added without documentation fails here. Also: every relative link of the README and
// of docs/ reaches a file, and a heading of it when it names one.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { HOOK_HANDLERS } from '../src/adapters/claude-code/settings.js';
import { HOOK_USAGE } from '../src/commands/hook.js';
import { PACKAGE_ROOT } from '../src/config/paths.js';
import { TRIGGER_ACTIONS } from '../src/core/triggers.js';
import { PLACES } from '../src/core/types.js';
import { runCli } from './helpers.js';

const read = (rel: string): string => fs.readFileSync(path.join(PACKAGE_ROOT, rel), 'utf8');
const DOC_FILES = ['README.md', ...fs.readdirSync(path.join(PACKAGE_ROOT, 'docs')).filter((f) => f.endsWith('.md')).map((f) => `docs/${f}`)];
const ALL_DOCS = DOC_FILES.map(read).join('\n');
const CONFIGURATION = read('docs/configuration.md');

/** The commands `noonsight --help` lists, by their first word. */
function commands(): string[] {
  const help = runCli(['--help']).stdout;
  const section = help.split('Commands:')[1]?.split('Options:')[0] ?? '';
  return [...section.matchAll(/^ {2}([a-z]+)\b/gm)].map((m) => m[1] as string);
}

test('every command is documented, and has its own --help', () => {
  const all = commands();
  assert.ok(all.length >= 10, `few commands found: ${all.join(', ')}`);
  for (const c of all) {
    assert.ok(ALL_DOCS.includes(`noonsight ${c}`), `\`noonsight ${c}\` is in noonsight --help but in no documentation page`);
    // The hook adapter never prints usage: Claude Code would show it as a hook error (src/cli.ts).
    if (c === 'hook') continue;
    const help = runCli([c, '--help']);
    assert.equal(help.status, 0, `noonsight ${c} --help exits ${help.status}`);
    assert.match(help.stdout, new RegExp(`usage: noonsight [^\\n]*\\n?(?:[^\\n]*noonsight )?${c}\\b`), `noonsight ${c} --help shows another command's usage`);
  }
});

test('every option of every command is documented', () => {
  const missing: string[] = [];
  for (const c of commands()) {
    const help = c === 'hook' ? HOOK_USAGE : runCli([c, '--help']).stdout;
    for (const option of new Set([...help.matchAll(/(?<![\w-])(--[a-z][a-z-]*)/g)].map((m) => m[1] as string))) {
      // Claude Code's own options, which `noonsight run --help` names as what it reads, are not noonsight's.
      if (c === 'run' && ['--model', '--effort', '--append-system-prompt-file'].includes(option)) continue;
      if (!new RegExp(`noonsight ${c}\\b[^\\n]*${option}\\b|${option}\\b[^\\n]*noonsight ${c}\\b|\`${option}[ \`]`).test(ALL_DOCS)) missing.push(`noonsight ${c} ${option}`);
    }
  }
  assert.deepEqual(missing, []);
});

/** Every key path a JSON schema allows, `<>` standing for a name the user chooses, `[]` for an item of a list. */
export function schemaKeys(schema: any): string[] {
  const defs = (schema.$defs ?? schema.definitions ?? {}) as Record<string, any>;
  const out = new Set<string>();
  const walk = (node: any, prefix: string, depth: number): void => {
    if (depth > 10 || node === null || typeof node !== 'object') return;
    if (typeof node.$ref === 'string') return walk(defs[node.$ref.split('/').at(-1)], prefix, depth + 1);
    for (const k of ['oneOf', 'anyOf', 'allOf']) for (const x of node[k] ?? []) walk(x, prefix, depth + 1);
    for (const [k, v] of Object.entries(node.properties ?? {})) {
      const p = prefix ? `${prefix}.${k}` : k;
      out.add(p);
      walk(v, p, depth + 1);
    }
    if (node.additionalProperties && typeof node.additionalProperties === 'object') walk(node.additionalProperties, `${prefix}.<>`, depth + 1);
    for (const v of Object.values(node.patternProperties ?? {})) walk(v, `${prefix}.<>`, depth + 1);
    if (node.items) walk(node.items, `${prefix}[]`, depth + 1);
  };
  walk(schema, '', 0);
  return [...out].filter((k) => k !== '$schema').sort();
}

/**
 * Whether docs/configuration.md documents a key: its whole path in backticks, with any `<word>`
 * where the user chooses a name; or, for a key of a list item (a rule or a routing option), the
 * key's own name in backticks in a table row or in the option's description.
 */
/** Keys documented by a sentence rather than by their path, with the phrase of docs/configuration.md that does it. */
const DOCUMENTED_AS: Record<string, string> = {
  'routing.table.<>.launcher': 'an object with a list for `launcher`, for `subagents`, or for both',
  'routing.table.<>.subagents': 'an object with a list for `launcher`, for `subagents`, or for both',
  'routing.default.launcher': '`inherit`, or a row',
  'routing.default.subagents': '`inherit`, or a row',
};

function documented(key: string): boolean {
  const phrase = DOCUMENTED_AS[key];
  if (phrase !== undefined) return CONFIGURATION.includes(phrase);
  const pattern = key
    .replace(/\[\]/g, '')
    .split('.')
    .map((s) => (s === '<>' ? '<[a-z]+>' : s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('\\.');
  if (new RegExp(`\`${pattern}\``).test(CONFIGURATION)) return true;
  if (!key.includes('[]')) return false;
  const leaf = key.split('.').at(-1) as string;
  return new RegExp(`^\\| \`${leaf}\` \\|`, 'm').test(CONFIGURATION) || new RegExp(`\\{ "${leaf}"|"${leaf}": <`).test(CONFIGURATION);
}

for (const file of ['noonsight.schema.json', 'noonsight-project.schema.json']) {
  test(`every key of schema/${file} is documented in docs/configuration.md`, () => {
    const keys = schemaKeys(JSON.parse(read(`schema/${file}`)));
    assert.ok(keys.length > 30, `few keys found in ${file}`);
    assert.deepEqual(keys.filter((k) => !documented(k)), []);
  });
}

/**
 * Variables the code reads that a person never sets, each with why, so they need no documentation.
 * Every other NOONSIGHT_ variable must be documented.
 */
const INTERNAL_ENV: Record<string, string> = {
  NOONSIGHT_SYSTEM_ROOT: 'stands in for / in tests of the machine-wide install',
  NOONSIGHT_LAUNCH_FILE: 'set by noonsight run for the hooks of the session it starts',
};

test('every NOONSIGHT_ variable the code reads is documented, or named as internal with why', () => {
  const vars = new Set<string>();
  const walk = (dir: string): void => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.ts')) for (const m of fs.readFileSync(full, 'utf8').matchAll(/\bNOONSIGHT_[A-Z_]+[A-Z]\b/g)) vars.add(m[0]);
    }
  };
  walk(path.join(PACKAGE_ROOT, 'src'));
  assert.ok(vars.has('NOONSIGHT_CONFIG'));
  const missing = [...vars].filter((v) => !(v in INTERNAL_ENV) && !ALL_DOCS.includes(`\`${v}`)).sort();
  assert.deepEqual(missing, []);
  assert.deepEqual(Object.keys(INTERNAL_ENV).filter((v) => !vars.has(v)), [], 'INTERNAL_ENV names a variable the code no longer reads');
});

test('every hook noonsight installs is documented, and the hook adapter\'s usage lists its argument', () => {
  const hooks = read('docs/hooks.md');
  const help = HOOK_USAGE;
  for (const h of HOOK_HANDLERS) {
    assert.ok(hooks.includes(`\`${h.event}\``), `docs/hooks.md does not name ${h.event}`);
    assert.ok(help.includes(h.arg), `HOOK_USAGE (src/commands/hook.ts) does not list ${h.arg}`);
  }
});

test('every trigger and every place is documented', () => {
  for (const t of Object.keys(TRIGGER_ACTIONS)) assert.match(CONFIGURATION, new RegExp(`^\\| \`${t}\` \\|`, 'm'), `trigger ${t} has no row in docs/configuration.md`);
  for (const p of PLACES) assert.ok(CONFIGURATION.includes(`\`${p}\``), `place ${p}`);
});

test('every preset is documented, and its SOURCES.md has a section for each of its rules', () => {
  for (const name of fs.readdirSync(path.join(PACKAGE_ROOT, 'presets'))) {
    const preset = JSON.parse(read(`presets/${name}/preset.json`));
    const sources = read(`presets/${name}/SOURCES.md`);
    assert.ok(CONFIGURATION.includes(`\`${name}\``), `preset ${name} is not in docs/configuration.md`);
    for (const entry of Object.values(preset.models) as { rules: { id: string }[] }[])
      for (const r of entry.rules) assert.match(sources, new RegExp(`^#### \`${r.id}\``, 'm'), `presets/${name}/SOURCES.md has no section for ${r.id}`);
  }
});

/** GitHub's anchor for a heading: lowercase, punctuation but hyphens and underscores dropped, spaces as hyphens. */
export function slug(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

function anchors(file: string): Set<string> {
  const seen = new Map<string, number>();
  const out = new Set<string>();
  let fenced = false;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (/^\s*```/.test(line)) fenced = !fenced;
    const m = !fenced && /^#{1,6} (.+)$/.exec(line);
    if (!m) continue;
    const base = slug(m[1] as string);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    out.add(n === 0 ? base : `${base}-${n}`);
  }
  return out;
}

test('every relative link of the README and of docs/ reaches its file and its heading', () => {
  const broken: string[] = [];
  for (const page of DOC_FILES) {
    const text = read(page).replace(/```[\s\S]*?```/g, '');
    for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = m[1] as string;
      if (/^[a-z]+:/.test(target)) continue;
      const [file = '', anchor] = target.split('#');
      const resolved = file === '' ? path.join(PACKAGE_ROOT, page) : path.resolve(path.dirname(path.join(PACKAGE_ROOT, page)), file);
      if (!fs.existsSync(resolved)) {
        broken.push(`${page}: ${target} (no such file)`);
        continue;
      }
      if (anchor && resolved.endsWith('.md') && !anchors(resolved).has(anchor)) broken.push(`${page}: ${target} (no such heading)`);
    }
  }
  assert.deepEqual(broken, []);
});
