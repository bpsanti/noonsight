import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { assertSupported, validateSchema } from '../src/config/json-schema.js';
import { SCHEMA_DIR } from '../src/config/paths.js';
import { FIXTURES, LAB_PRESETS } from './helpers.js';

const read = (file: string): any => JSON.parse(fs.readFileSync(file, 'utf8'));

test('the shipped schemas only use keywords the validator implements', () => {
  for (const name of fs.readdirSync(SCHEMA_DIR)) assertSupported(read(path.join(SCHEMA_DIR, name)));
});

test('a schema keyword outside the implemented subset is refused instead of skipped', () => {
  assert.throws(() => assertSupported({ type: 'object', properties: { a: { exclusiveMaximum: 3 } } }), /unsupported schema keyword "exclusiveMaximum" at \/properties\/a/);
  assert.throws(() => assertSupported({ oneOf: [] }), /unsupported schema keyword "oneOf"/);
});

test('the fixture configurations and preset satisfy the published schemas', () => {
  const config = read(path.join(SCHEMA_DIR, 'noonsight.schema.json'));
  for (const file of [
    path.join(FIXTURES, 'lab', 'config', 'noonsight.json'),
    path.join(FIXTURES, 'subagent-proto', 'noonsight.json'),
    path.join(FIXTURES, 'subagent-proto', 'config-b', 'noonsight.json'),
  ])
    assert.deepEqual(validateSchema(config, read(file)), [], file);
  assert.deepEqual(validateSchema(read(path.join(SCHEMA_DIR, 'preset.schema.json')), read(path.join(LAB_PRESETS, 'lab', 'preset.json'))), []);
});

test('validator: types, const, enum, patterns, arrays and references', () => {
  const schema = {
    $defs: { name: { type: 'string', pattern: '^[a-z]+$', 'x-hint': 'lowercase letters' } },
    type: 'object',
    required: ['n'],
    additionalProperties: false,
    properties: {
      n: { const: 1 },
      e: { enum: ['a', 'b'] },
      list: { type: 'array', minItems: 1, uniqueItems: true, items: { $ref: '#/$defs/name' } },
      s: { type: 'string', minLength: 1 },
    },
  };
  assert.deepEqual(validateSchema(schema, { n: 1, e: 'a', list: ['ab'], s: 'x' }), []);
  assert.deepEqual(validateSchema(schema, { n: 2, e: 'c', list: ['Ab', 'Ab'], s: '', z: 0 }), [
    '/n: must be 1',
    '/e: must be one of "a", "b"',
    '/list: lists "Ab" more than once',
    '/list/0: "Ab" does not have the expected form (lowercase letters)',
    '/list/1: "Ab" does not have the expected form (lowercase letters)',
    '/s: must not be empty',
    '/z: unknown key',
  ]);
  assert.deepEqual(validateSchema(schema, []), ['(top level): must be an object']);
  assert.deepEqual(validateSchema(schema, { list: [] }), ['(top level): missing required key "n"', '/list: must not be empty']);
});

test('validator: key names, pattern keys, if/then and false', () => {
  const schema = {
    type: 'object',
    propertyNames: { pattern: '^[a-z*]+$', 'x-hint': 'letters or *' },
    patternProperties: { '\\*': { const: 'star' } },
    additionalProperties: {
      type: 'object',
      allOf: [{ if: { properties: { kind: { const: 'none' } }, required: ['kind'] }, then: { properties: { kind: true }, additionalProperties: false } }],
    },
  };
  assert.deepEqual(validateSchema(schema, { a: { kind: 'none' }, 'b*': 'star', c: { kind: 'x', more: 1 } }), []);
  assert.deepEqual(validateSchema(schema, { A: {}, 'b*': 'moon', c: { kind: 'none', more: 1 } }), [
    '/A: key "A" does not have the expected form (letters or *)',
    '/b*: must be "star"',
    '/c/more: unknown key',
  ]);
  assert.deepEqual(validateSchema(false, 1), ['(top level): not allowed here']);
  assert.deepEqual(validateSchema({ properties: { a: false } }, { a: 1 }), ['/a: not allowed here']);
});

test('validator: integer bounds', () => {
  const schema = { type: 'object', properties: { n: { type: 'integer', minimum: 2, maximum: 5 } } };
  assert.deepEqual(validateSchema(schema, { n: 2 }), []);
  assert.deepEqual(validateSchema(schema, { n: 5 }), []);
  assert.deepEqual(validateSchema(schema, { n: 1 }), ['/n: must be at least 2']);
  assert.deepEqual(validateSchema(schema, { n: 6 }), ['/n: must be at most 5']);
  assert.deepEqual(validateSchema(schema, { n: 2.5 }), ['/n: must be an integer']);
});
