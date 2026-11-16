// Example texts for a regular expression: short strings the expression matches, used to show that
// two scope matchers overlap. Every example is tested against the expression itself before it is
// returned, so an example is always a real match. Constructs the generator cannot reproduce (back
// references, lookaround that a sample happens to violate) only cost examples, never correctness.

/** At most this many examples per expression, and per part of one while they are combined. */
const MAX_SAMPLES = 24;
/** Repetition counts above this produce no examples. */
const MAX_REPEAT = 32;

type Node =
  | { kind: 'text'; value: string }
  | { kind: 'empty' }
  | { kind: 'none' }
  | { kind: 'alt'; branches: Node[][] }
  | { kind: 'repeat'; node: Node; min: number; max: number };

/** Characters tried, in order, for a character class or a class escape. */
const CANDIDATES = ['a', 'e', 's', 'x', '0', '1', ' ', '-', '_', '.', '/', ':', 'A', 'Z', 'é'];

/**
 * Up to MAX_SAMPLES distinct texts that the compiled expression matches. The pattern must already
 * compile with the given flags. Returns an empty list when no example can be built.
 */
export function regexSamples(source: string, flags: string): string[] {
  const regex = new RegExp(source, flags.replace(/[gy]/g, ''));
  let tree: Node;
  try {
    tree = new Parser(source, flags).parse();
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const raw of samplesOf(tree)) {
    // Padding satisfies a word boundary at either end.
    const found = [raw, ` ${raw} `].find((t) => regex.test(t));
    if (found !== undefined && !out.includes(found)) out.push(found);
    if (out.length >= MAX_SAMPLES) break;
  }
  return out;
}

class Unsupported extends Error {}

class Parser {
  private i = 0;
  constructor(
    private readonly s: string,
    private readonly flags: string,
  ) {}

  parse(): Node {
    const alt = this.alternation();
    if (this.i < this.s.length) throw new Unsupported(`unexpected ${this.s[this.i]}`);
    return alt;
  }

  private alternation(): Node {
    const branches: Node[][] = [this.sequence()];
    while (this.s[this.i] === '|') {
      this.i++;
      branches.push(this.sequence());
    }
    return { kind: 'alt', branches };
  }

  private sequence(): Node[] {
    const items: Node[] = [];
    while (this.i < this.s.length && this.s[this.i] !== '|' && this.s[this.i] !== ')') {
      const atom = this.atom();
      items.push(this.quantified(atom));
    }
    return items;
  }

  private quantified(atom: Node): Node {
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
    return { kind: 'repeat', node: atom, min, max };
  }

  private atom(): Node {
    const c = this.s[this.i++] as string;
    switch (c) {
      case '^':
      case '$':
        return { kind: 'empty' };
      case '.':
        return { kind: 'text', value: 'a' };
      case '[':
        return this.characterClass();
      case '(':
        return this.group();
      case '\\':
        return this.escape();
      default:
        return { kind: 'text', value: this.codePointFrom(c) };
    }
  }

  /** The rest of a character whose first UTF-16 unit was already read. */
  private codePointFrom(first: string): string {
    const code = first.charCodeAt(0);
    if (code >= 0xd800 && code <= 0xdbff && this.i < this.s.length) return first + this.s[this.i++];
    return first;
  }

  private group(): Node {
    let negative = false;
    if (this.s[this.i] === '?') {
      const rest = this.s.slice(this.i);
      const m = /^\?(?::|=|!|<=|<!|<[A-Za-z_$][\w$]*>|[ims]*-?[ims]*:)/.exec(rest);
      if (!m) throw new Unsupported('group');
      negative = m[0] === '?!' || m[0] === '?<!';
      this.i += m[0].length;
    }
    const inner = this.alternation();
    if (this.s[this.i] !== ')') throw new Unsupported('unclosed group');
    this.i++;
    // A positive lookaround contributes the text it looks for, which is where that text must be;
    // a negative one contributes nothing. The final test of each example decides whether it holds.
    return negative ? { kind: 'empty' } : inner;
  }

  private escape(): Node {
    const c = this.s[this.i++];
    if (c === undefined) throw new Unsupported('trailing backslash');
    switch (c) {
      case 'b':
      case 'B':
        return { kind: 'empty' };
      case 'd':
      case 'D':
      case 'w':
      case 'W':
      case 's':
      case 'S':
        return this.pick(`\\${c}`);
      case 'p':
      case 'P': {
        const m = /^\{[^}]*\}/.exec(this.s.slice(this.i));
        if (!m) throw new Unsupported('property escape');
        this.i += m[0].length;
        return this.pick(`\\${c}${m[0]}`);
      }
      case 'k':
        throw new Unsupported('back reference');
      case 'n':
        return { kind: 'text', value: '\n' };
      case 't':
        return { kind: 'text', value: '\t' };
      case 'r':
        return { kind: 'text', value: '\r' };
      case 'f':
        return { kind: 'text', value: '\f' };
      case 'v':
        return { kind: 'text', value: '\v' };
      case '0':
        return { kind: 'text', value: '\0' };
      case 'c': {
        const letter = this.s[this.i++] ?? '';
        return { kind: 'text', value: String.fromCharCode(letter.charCodeAt(0) % 32) };
      }
      case 'x':
      case 'u':
        return { kind: 'text', value: this.hexEscape(c) };
      default:
        if (/[1-9]/.test(c)) throw new Unsupported('back reference');
        return { kind: 'text', value: this.codePointFrom(c) };
    }
  }

  private hexEscape(kind: 'x' | 'u'): string {
    const rest = this.s.slice(this.i);
    const m = kind === 'x' ? /^[0-9a-fA-F]{2}/.exec(rest) : (/^\{([0-9a-fA-F]+)\}/.exec(rest) ?? /^[0-9a-fA-F]{4}/.exec(rest));
    if (!m) throw new Unsupported('hex escape');
    this.i += m[0].length;
    return String.fromCodePoint(parseInt(m[1] ?? m[0], 16));
  }

  /** A character class: its source is handed to the engine, which picks a character it accepts. */
  private characterClass(): Node {
    const start = this.i - 1;
    let depth = 1;
    while (this.i < this.s.length && depth > 0) {
      const c = this.s[this.i++];
      if (c === '\\') this.i++;
      else if (c === '[' && this.flags.includes('v')) depth++;
      else if (c === ']') depth--;
    }
    if (depth !== 0) throw new Unsupported('unclosed class');
    const source = this.s.slice(start, this.i);
    // Include the characters the class names directly, so a class like [qz] still yields an example.
    const named = [...source.slice(1, -1).replace(/\\./g, '')].filter((ch) => /\S/.test(ch) && !'^-[]'.includes(ch));
    return this.pick(source, named);
  }

  private pick(classSource: string, extra: readonly string[] = []): Node {
    const test = new RegExp(`^(?:${classSource})$`, this.flags.replace(/[gy]/g, ''));
    const ch = [...CANDIDATES, ...extra].find((candidate) => test.test(candidate));
    return ch === undefined ? { kind: 'none' } : { kind: 'text', value: ch };
  }
}

function expand(nodes: readonly Node[]): string[] {
  let acc: string[] = [''];
  for (const node of nodes) {
    const options = samplesOf(node);
    const next: string[] = [];
    for (const a of acc) for (const b of options) if (next.length < MAX_SAMPLES) next.push(a + b);
    acc = next;
    if (acc.length === 0) return [];
  }
  return acc;
}

function samplesOf(node: Node): string[] {
  switch (node.kind) {
    case 'text':
      return [node.value];
    case 'empty':
      return [''];
    case 'none':
      return [];
    case 'alt': {
      const out: string[] = [];
      for (const branch of node.branches) for (const s of expand(branch)) if (out.length < MAX_SAMPLES && !out.includes(s)) out.push(s);
      return out;
    }
    case 'repeat': {
      if (node.min > MAX_REPEAT) return [];
      const inner = samplesOf(node.node);
      const counts = node.max > node.min ? [node.min, node.min + 1] : [node.min];
      const out: string[] = [];
      for (const k of counts) for (const s of inner) if (out.length < MAX_SAMPLES && !out.includes(s.repeat(k))) out.push(s.repeat(k));
      if (node.min === 0 && !out.includes('')) out.unshift('');
      return out.slice(0, MAX_SAMPLES);
    }
  }
}
