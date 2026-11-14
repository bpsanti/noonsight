// A small JSON Schema (draft 2020-12) validator for the subset the sextant schemas use.
// The published schemas own the shape of the configuration and of a preset; this validator applies
// them at run time so the shape is written once. A keyword outside the subset is a programming
// error and throws, so a schema can never rely on a rule this validator silently skips.

export type Schema = boolean | { readonly [keyword: string]: unknown };

const ANNOTATIONS = new Set(['$schema', '$id', '$defs', '$comment', 'title', 'description', 'default', 'examples']);
const ASSERTIONS = new Set([
  '$ref',
  'type',
  'const',
  'enum',
  'pattern',
  'minLength',
  'properties',
  'patternProperties',
  'additionalProperties',
  'propertyNames',
  'required',
  'items',
  'minItems',
  'uniqueItems',
  'allOf',
  'if',
  'then',
  // Not a standard keyword: a sentence appended to every error raised directly by this schema node.
  'x-hint',
]);

/** Validate a value; returns one readable message per problem, or an empty list. */
export function validateSchema(root: Schema, value: unknown): string[] {
  const errors: string[] = [];
  check(root, root, value, '', errors);
  return errors;
}

/** Throws when a schema uses a keyword this validator does not implement. */
export function assertSupported(root: Schema): void {
  const visit = (s: unknown, at: string): void => {
    if (typeof s === 'boolean') return;
    if (!isObject(s)) throw new Error(`schema node at ${at || '/'} is not an object or boolean`);
    for (const [k, v] of Object.entries(s)) {
      if (!ANNOTATIONS.has(k) && !ASSERTIONS.has(k)) throw new Error(`unsupported schema keyword "${k}" at ${at || '/'}`);
      if (k === '$defs' || k === 'properties' || k === 'patternProperties')
        for (const [name, sub] of Object.entries(v as object)) visit(sub, `${at}/${k}/${name}`);
      else if (k === 'allOf') (v as unknown[]).forEach((sub, i) => visit(sub, `${at}/allOf/${i}`));
      else if (['additionalProperties', 'propertyNames', 'items', 'if', 'then'].includes(k)) visit(v, `${at}/${k}`);
    }
  };
  visit(root, '');
}

function check(root: Schema, schema: Schema, value: unknown, at: string, errors: string[]): void {
  if (schema === true) return;
  if (schema === false) {
    errors.push(`${where(at)}: not allowed here`);
    return;
  }
  const hint = typeof schema['x-hint'] === 'string' ? ` (${schema['x-hint']})` : '';
  const fail = (message: string): void => {
    errors.push(`${where(at)}: ${message}${hint}`);
  };

  if (typeof schema.$ref === 'string') check(root, deref(root, schema.$ref), value, at, errors);

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? (schema.type as string[]) : [schema.type as string];
    if (!types.some((t) => hasType(value, t))) {
      fail(`must be ${types.map(article).join(' or ')}`);
      return; // Further keywords would only repeat the same problem.
    }
  }
  if ('const' in schema && !deepEqual(schema.const, value)) fail(`must be ${JSON.stringify(schema.const)}`);
  if (Array.isArray(schema.enum) && !schema.enum.some((e) => deepEqual(e, value)))
    fail(`must be one of ${schema.enum.map((e) => JSON.stringify(e)).join(', ')}`);

  if (typeof value === 'string') {
    if (typeof schema.minLength === 'number' && [...value].length < schema.minLength)
      fail(schema.minLength === 1 ? 'must not be empty' : `must have at least ${schema.minLength} characters`);
    if (typeof schema.pattern === 'string' && !new RegExp(schema.pattern, 'u').test(value))
      fail(`${JSON.stringify(value)} does not have the expected form`);
  }

  if (Array.isArray(value)) {
    if (typeof schema.minItems === 'number' && value.length < schema.minItems)
      fail(schema.minItems === 1 ? 'must not be empty' : `must have at least ${schema.minItems} items`);
    if (schema.uniqueItems === true) {
      const seen = new Set<string>();
      for (const item of value) {
        const k = JSON.stringify(item);
        if (seen.has(k)) fail(`lists ${k} more than once`);
        seen.add(k);
      }
    }
    if (schema.items !== undefined) value.forEach((item, i) => check(root, schema.items as Schema, item, `${at}/${i}`, errors));
  }

  if (isObject(value)) {
    if (Array.isArray(schema.required))
      for (const k of schema.required as string[]) if (!(k in value)) fail(`missing required key "${k}"`);
    const props = (schema.properties ?? {}) as Record<string, Schema>;
    const patterns = Object.entries((schema.patternProperties ?? {}) as Record<string, Schema>).map(
      ([p, s]) => [new RegExp(p, 'u'), s] as const,
    );
    for (const [k, v] of Object.entries(value)) {
      const keyAt = `${at}/${escapePointer(k)}`;
      if (schema.propertyNames !== undefined) {
        const keyErrors: string[] = [];
        check(root, schema.propertyNames as Schema, k, keyAt, keyErrors);
        if (keyErrors.length) {
          const prefix = `${where(keyAt)}: `;
          errors.push(...keyErrors.map((e) => (e.startsWith(prefix) ? `${prefix}key ${e.slice(prefix.length)}` : e)));
          continue; // An invalid key says enough; its value is not checked.
        }
      }
      let known = false;
      if (Object.hasOwn(props, k)) {
        known = true;
        check(root, props[k] as Schema, v, keyAt, errors);
      }
      for (const [re, s] of patterns)
        if (re.test(k)) {
          known = true;
          check(root, s, v, keyAt, errors);
        }
      if (!known && schema.additionalProperties !== undefined) {
        if (schema.additionalProperties === false) errors.push(`${where(keyAt)}: unknown key${hint}`);
        else check(root, schema.additionalProperties as Schema, v, keyAt, errors);
      }
    }
  }

  if (Array.isArray(schema.allOf)) for (const s of schema.allOf as Schema[]) check(root, s, value, at, errors);
  if (schema.if !== undefined && schema.then !== undefined) {
    const probe: string[] = [];
    check(root, schema.if as Schema, value, at, probe);
    if (probe.length === 0) check(root, schema.then as Schema, value, at, errors);
  }
}

function deref(root: Schema, ref: string): Schema {
  if (!ref.startsWith('#/')) throw new Error(`only local schema references are supported: ${ref}`);
  let node: unknown = root;
  for (const part of ref.slice(2).split('/')) {
    node = isObject(node) ? node[part.replace(/~1/g, '/').replace(/~0/g, '~')] : undefined;
  }
  if (node === undefined) throw new Error(`unresolved schema reference ${ref}`);
  return node as Schema;
}

function hasType(value: unknown, type: string): boolean {
  switch (type) {
    case 'object':
      return isObject(value);
    case 'array':
      return Array.isArray(value);
    case 'string':
      return typeof value === 'string';
    case 'boolean':
      return typeof value === 'boolean';
    case 'integer':
      return Number.isInteger(value);
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'null':
      return value === null;
    default:
      throw new Error(`unsupported schema type "${type}"`);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  if (isObject(a) && isObject(b)) {
    const ka = Object.keys(a);
    return ka.length === Object.keys(b).length && ka.every((k) => Object.hasOwn(b, k) && deepEqual(a[k], b[k]));
  }
  return false;
}

function article(type: string): string {
  return /^[aeiou]/.test(type) ? `an ${type}` : `a ${type}`;
}

function escapePointer(key: string): string {
  return key.replace(/~/g, '~0').replace(/\//g, '~1');
}

function where(at: string): string {
  return at === '' ? '(top level)' : at;
}
