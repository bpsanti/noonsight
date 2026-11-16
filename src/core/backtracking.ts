// Matchers that risk catastrophic backtracking. The hook runs every scope matcher over a subagent's
// task text before the subagent starts, so a matcher whose time grows much faster than the text
// would hold the call. A length bound on the text does not help with such a matcher: the risk is in
// the pattern. This module recognizes three pattern shapes and nothing more:
//
//   leading-any  the pattern, or one of its top-level alternatives, starts with an unbounded repeat
//                of any character (".*", ".+", "[\s\S]*", ...) with no "^" before it. The engine
//                retries the repeat from every position of the text, so the time grows with the
//                square of the text length.
//   nested       an unbounded quantifier inside another unbounded quantifier, such as "(a+)+".
//   adjacent     two unbounded quantifiers in one sequence that can match the same characters, with
//                nothing required between them, such as ".*.*x" or "\w+\w+".
//
// "Unbounded" means "*", "+" or "{n,}". Characters are compared over a fixed probe alphabet, so two
// sets that share only characters outside it are not seen as overlapping.

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
    if (leading !== null) return { kind: 'leading-any', parts: [leading] };
  }
  return nestedOrAdjacent(tree);
}

/** An unbounded repeat of any character that opens a branch with no "^" before it. */
function leadingAny(branch: readonly Node[]): string | null {
  for (const node of branch) {
    if (node.kind === 'zero') {
      if (node.anchor) return null;
      continue;
    }
    if (node.kind === 'group') {
      // A group with one branch is read through; with several, each branch opens the pattern.
      for (const inner of node.branches) {
        const found = leadingAny(inner);
        if (found !== null) return found;
      }
      return null;
    }
    if (node.kind === 'repeat' && node.max === Infinity && anyChar(charsOf(node.node))) return node.source;
    return null;
  }
  return null;
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
    if (node.kind === 'repeat') {
      if (node.max === Infinity) {
        const inner = firstUnbounded(node.node);
        if (inner !== null) return { kind: 'nested', parts: [node.source, inner] };
      }
      const found = nestedOrAdjacent(bodyBranches(node.node));
      if (found !== null) return found;
    } else if (node.kind === 'group') {
      const found = nestedOrAdjacent(node.branches);
      if (found !== null) return found;
    }
  }
  // Two unbounded repeats with only parts that can match nothing between them.
  for (let i = 0; i < items.length; i++) {
    const a = items[i] as Node;
    if (a.kind !== 'repeat' || a.max !== Infinity) continue;
    for (let j = i + 1; j < items.length; j++) {
      const b = items[j] as Node;
      if (b.kind === 'repeat' && b.max === Infinity && overlap(charsOf(a.node), charsOf(b.node))) return { kind: 'adjacent', parts: [a.source, b.source] };
      if (!canBeEmpty(b)) break;
    }
  }
  return null;
}

/** A sequence with every one-branch, unquantified group opened in place. */
function flatten(items: readonly Node[]): Node[] {
  return items.flatMap((n) => (n.kind === 'group' && n.branches.length === 1 ? flatten(n.branches[0] as Node[]) : [n]));
}

function bodyBranches(node: Node): Node[][] {
  return node.kind === 'group' ? node.branches : [[node]];
}

function firstUnbounded(node: Node): string | null {
  if (node.kind === 'repeat') return node.max === Infinity ? node.source : firstUnbounded(node.node);
  if (node.kind === 'group')
    for (const branch of node.branches)
      for (const n of branch) {
        const found = firstUnbounded(n);
        if (found !== null) return found;
      }
  return null;
}

function canBeEmpty(node: Node): boolean {
  switch (node.kind) {
    case 'zero':
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
    if (this.s[this.i] === '?') {
      const m = /^\?(?::|=|!|<=|<!|<[A-Za-z_$][\w$]*>|[ims]*-?[ims]*:)/.exec(this.s.slice(this.i));
      if (!m) throw new Unreadable('group');
      lookaround = /^\?(?:=|!|<=|<!)$/.test(m[0]);
      this.i += m[0].length;
    }
    const branches = this.alternation();
    if (this.s[this.i] !== ')') throw new Unreadable('unclosed group');
    this.i++;
    // A lookaround consumes no text of its own.
    return lookaround ? { kind: 'zero', anchor: false } : { kind: 'group', source: this.s.slice(start, this.i), branches };
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
