// Matchers that risk catastrophic backtracking. The hook runs every scope matcher over a subagent's
// task text before the subagent starts, so a matcher whose time grows much faster than the text
// would hold the call. A length bound on the text does not help with such a matcher: the risk is in
// the pattern. This module recognizes three pattern shapes and nothing more:
//
//   leading-any  the pattern, or one of its alternatives, starts with an unbounded repeat of any
//                character (".*", ".+", "[\s\S]*", ...) with no "^" before it, and only parts that
//                can match nothing (such as "a?" or "\b") ahead of it. A lookaround at that place
//                opens its own alternatives the same way. The engine retries the repeat from every
//                position of the text, so the time grows with the square of the text length.
//   nested       an unbounded quantifier inside another unbounded quantifier, such as "(a+)+".
//   adjacent     two unbounded quantifiers in one sequence that can match the same characters, with
//                nothing required between them, such as ".*.*x", "\w+\w+" or "\w+(?:-|\w+)".
//
// The nested and adjacent shapes are looked for inside lookarounds too. "Unbounded" means "*", "+"
// or "{n,}". Characters are compared over a fixed probe alphabet, so two sets that share only
// characters outside it are not seen as overlapping.

/** A shape found in a pattern, with the part of the pattern that shows it. */
export interface BacktrackingRisk {
  readonly kind: 'leading-any' | 'nested' | 'adjacent';
  /** The quantified parts involved, as the pattern writes them. */
  readonly parts: readonly string[];
}

/** Printable ASCII, the common whitespace and line breaks, and a few letters beyond ASCII. */
const PROBES = [
  ...Array.from({ length: 0x7f - 0x20 }, (_, i) => String.fromCharCode(0x20 + i)),
  '\t',
  '\n',
  '\r',
  'é',
  'ß',
  'Ж',
  '中',
];
const LINE_BREAKS = new Set(['\n', '\r']);

type Node =
  | { kind: 'atom'; source: string; chars: ReadonlySet<string> }
  | { kind: 'zero'; anchor: boolean }
  | { kind: 'group'; source: string; branches: Node[][] }
  | { kind: 'look'; negative: boolean; branches: Node[][] }
  | { kind: 'repeat'; source: string; node: Node; min: number; max: number };

/**
 * The first risky shape in a pattern that already compiles with the given flags, or null. A pattern
 * this module cannot read is never reported.
 */
export function backtrackingRisk(source: string, flags: string): BacktrackingRisk | null {
  let tree: Node[][];
  try {
    tree = new Parser(source, flags.replace(/[gy]/g, '')).parse();
  } catch {
    return null;
  }
  for (const branch of tree) {
    const leading = leadingAny(branch);
    if (leading.kind === 'found') return { kind: 'leading-any', parts: [leading.part] };
  }
  return nestedOrAdjacent(tree);
}

type Lead = { kind: 'found'; part: string } | { kind: 'anchored' } | { kind: 'open' };

/**
 * Whether a branch opens with an unbounded repeat of any character with no "^" before it, looking
 * past parts that can match nothing and into the groups, repeats and lookarounds it passes. A part
 * whose every alternative starts with "^" anchors what follows it, unless the part can be skipped
 * or is a negative lookaround.
 */
function leadingAny(branch: readonly Node[]): Lead {
  for (const node of branch) {
    if (node.kind === 'zero') {
      if (node.anchor) return { kind: 'anchored' };
      continue;
    }
    if (node.kind === 'repeat' && node.max === Infinity && anyChar(charsOf(node.node))) return { kind: 'found', part: node.source };
    const leads = innerBranches(node).map(leadingAny);
    const found = leads.find((l) => l.kind === 'found');
    if (found !== undefined) return found;
    const anchors = !(node.kind === 'repeat' && node.min === 0) && !(node.kind === 'look' && node.negative);
    if (anchors && leads.length > 0 && leads.every((l) => l.kind === 'anchored')) return { kind: 'anchored' };
    if (!canBeEmpty(node)) return { kind: 'open' };
  }
  return { kind: 'open' };
}

function nestedOrAdjacent(branches: readonly Node[][]): BacktrackingRisk | null {
  for (const branch of branches) {
    const found = inSequence(flatten(branch));
    if (found !== null) return found;
  }
  return null;
}

function inSequence(items: readonly Node[]): BacktrackingRisk | null {
  for (const node of items) {
    if (node.kind === 'repeat' && node.max === Infinity) {
      const inner = firstUnbounded(node.node);
      if (inner !== null) return { kind: 'nested', parts: [node.source, inner] };
    }
    const found = nestedOrAdjacent(innerBranches(node));
    if (found !== null) return found;
  }
  // Two unbounded repeats, each at the facing edge of its part, with only parts that can match
  // nothing between them.
  for (let i = 0; i < items.length; i++) {
    const lefts = edgeRepeats(items[i] as Node, 'end');
    if (lefts.length === 0) continue;
    for (let j = i + 1; j < items.length; j++) {
      const b = items[j] as Node;
      for (const r of edgeRepeats(b, 'start'))
        for (const l of lefts) if (overlap(charsOf(l.node), charsOf(r.node))) return { kind: 'adjacent', parts: [l.source, r.source] };
      if (!canBeEmpty(b)) break;
    }
  }
  return null;
}

type Repeat = Extract<Node, { kind: 'repeat' }>;

/** The unbounded repeats that can match the first or the last characters a part matches. */
function edgeRepeats(node: Node, side: 'start' | 'end'): Repeat[] {
  if (node.kind === 'repeat') return node.max === Infinity ? [node] : edgeRepeats(node.node, side);
  if (node.kind !== 'group') return [];
  return node.branches.flatMap((branch) => {
    const out: Repeat[] = [];
    for (const n of side === 'start' ? branch : [...branch].reverse()) {
      out.push(...edgeRepeats(n, side));
      if (!canBeEmpty(n)) break;
    }
    return out;
  });
}

/** A sequence with every one-branch, unquantified group opened in place. */
function flatten(items: readonly Node[]): Node[] {
  return items.flatMap((n) => (n.kind === 'group' && n.branches.length === 1 ? flatten(n.branches[0] as Node[]) : [n]));
}

/** The alternatives directly inside a part: a group's or lookaround's branches, or a repeat's body. */
function innerBranches(node: Node): Node[][] {
  if (node.kind === 'group' || node.kind === 'look') return node.branches;
  if (node.kind === 'repeat') return node.node.kind === 'group' ? node.node.branches : [[node.node]];
  return [];
}

function firstUnbounded(node: Node): string | null {
  if (node.kind === 'repeat') return node.max === Infinity ? node.source : firstUnbounded(node.node);
  for (const branch of innerBranches(node))
    for (const n of branch) {
      const found = firstUnbounded(n);
      if (found !== null) return found;
    }
  return null;
}

function canBeEmpty(node: Node): boolean {
  switch (node.kind) {
    case 'zero':
    case 'look':
      return true;
    case 'atom':
      return false;
    case 'repeat':
      return node.min === 0 || canBeEmpty(node.node);
    case 'group':
      return node.branches.some((b) => b.every(canBeEmpty));
  }
}

function charsOf(node: Node): ReadonlySet<string> {
  switch (node.kind) {
    case 'atom':
      return node.chars;
    case 'zero':
    case 'look':
      return new Set();
    case 'repeat':
      return charsOf(node.node);
    case 'group':
      return new Set(node.branches.flatMap((b) => b.flatMap((n) => [...charsOf(n)])));
  }
}

function anyChar(chars: ReadonlySet<string>): boolean {
  return PROBES.every((c) => LINE_BREAKS.has(c) || chars.has(c));
}

function overlap(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  for (const c of a) if (b.has(c)) return true;
  return false;
}

class Unreadable extends Error {}

class Parser {
  private i = 0;
  constructor(
    private readonly s: string,
    private readonly flags: string,
  ) {}

  parse(): Node[][] {
    const branches = this.alternation();
    if (this.i < this.s.length) throw new Unreadable(`unexpected ${this.s[this.i]}`);
    return branches;
  }

  private alternation(): Node[][] {
    const branches: Node[][] = [this.sequence()];
    while (this.s[this.i] === '|') {
      this.i++;
      branches.push(this.sequence());
    }
    return branches;
  }

  private sequence(): Node[] {
    const items: Node[] = [];
    while (this.i < this.s.length && this.s[this.i] !== '|' && this.s[this.i] !== ')') {
      const start = this.i;
      const atom = this.atom();
      items.push(this.quantified(atom, start));
    }
    return items;
  }

  private quantified(atom: Node, start: number): Node {
    const c = this.s[this.i];
    let min: number;
    let max: number;
    if (c === '*') [min, max] = [0, Infinity];
    else if (c === '+') [min, max] = [1, Infinity];
    else if (c === '?') [min, max] = [0, 1];
    else if (c === '{') {
      const m = /^\{(\d+)(,(\d*))?\}/.exec(this.s.slice(this.i));
      if (!m) return atom;
      min = Number(m[1]);
      max = m[2] === undefined ? min : m[3] === '' ? Infinity : Number(m[3]);
      this.i += m[0].length - 1;
    } else return atom;
    this.i++;
    if (this.s[this.i] === '?') this.i++;
    return { kind: 'repeat', source: this.s.slice(start, this.i), node: atom, min, max };
  }

  private atom(): Node {
    const start = this.i;
    const c = this.s[this.i++] as string;
    switch (c) {
      case '^':
        return { kind: 'zero', anchor: true };
      case '$':
        return { kind: 'zero', anchor: false };
      case '[':
        this.skipClass();
        return this.set(start);
      case '(':
        return this.group(start);
      case '\\':
        return this.escape(start);
      default:
        if (c.charCodeAt(0) >= 0xd800 && c.charCodeAt(0) <= 0xdbff) this.i++;
        return this.set(start);
    }
  }

  private group(start: number): Node {
    let lookaround = false;
    let negative = false;
    if (this.s[this.i] === '?') {
      const m = /^\?(?::|=|!|<=|<!|<[A-Za-z_$][\w$]*>|[ims]*-?[ims]*:)/.exec(this.s.slice(this.i));
      if (!m) throw new Unreadable('group');
      lookaround = /^\?(?:=|!|<=|<!)$/.test(m[0]);
      negative = m[0].endsWith('!');
      this.i += m[0].length;
    }
    const branches = this.alternation();
    if (this.s[this.i] !== ')') throw new Unreadable('unclosed group');
    this.i++;
    return lookaround ? { kind: 'look', negative, branches } : { kind: 'group', source: this.s.slice(start, this.i), branches };
  }

  private escape(start: number): Node {
    const c = this.s[this.i++];
    if (c === undefined) throw new Unreadable('trailing backslash');
    if (c === 'b' || c === 'B') return { kind: 'zero', anchor: false };
    if (c === 'p' || c === 'P' || c === 'k') {
      const m = c === 'k' ? /^<[^>]*>/.exec(this.s.slice(this.i)) : /^\{[^}]*\}/.exec(this.s.slice(this.i));
      if (!m) throw new Unreadable('escape');
      this.i += m[0].length;
    } else if (c === 'x') this.i += 2;
    else if (c === 'u') this.i += this.s[this.i] === '{' ? this.s.indexOf('}', this.i) - this.i + 1 : 4;
    else if (c === 'c') this.i++;
    // A back reference can repeat any text its group matched; it is read as any character.
    if (c === 'k' || /[1-9]/.test(c)) {
      while (/[0-9]/.test(this.s[this.i] ?? '') && c !== 'k') this.i++;
      return { kind: 'atom', source: this.s.slice(start, this.i), chars: new Set(PROBES) };
    }
    return this.set(start);
  }

  private skipClass(): void {
    let depth = 1;
    while (this.i < this.s.length && depth > 0) {
      const c = this.s[this.i++];
      if (c === '\\') this.i++;
      else if (c === '[' && this.flags.includes('v')) depth++;
      else if (c === ']') depth--;
    }
    if (depth !== 0) throw new Unreadable('unclosed class');
  }

  /** One character atom: the engine says which probe characters it matches. */
  private set(start: number): Node {
    const source = this.s.slice(start, this.i);
    const test = new RegExp(`^(?:${source})$`, this.flags);
    return { kind: 'atom', source, chars: new Set(PROBES.filter((c) => test.test(c))) };
  }
}
