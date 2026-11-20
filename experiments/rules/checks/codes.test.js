// The hidden check of the task `codes` (permit-forms): one part per field validator, one for
// validateForm, and one each for the version and the changelog that ERRORS.md asks for once the
// migration is done. Each part loads what it checks on its own, so a part left undone or broken
// fails only itself.

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..');
const FIELDS_DIR = path.join(ROOT, 'src', 'fields');

/** For each field, values that must be valid, and [value, code] pairs that must fail with that code. */
const CASES = {
  applicant_name: {
    valid: ['Main works', 'x'.repeat(80)],
    invalid: [['', "PF-555"], ['x'.repeat(81), "PF-699"]],
  },
  applicant_email: {
    valid: ["ana@example.org"],
    invalid: [['', "PF-632"], ["nobody@", "PF-496"]],
  },
  applicant_phone: {
    valid: ["+31 20 555 0101"],
    invalid: [['', "PF-401"], ["12-34", "PF-837"]],
  },
  company_name: {
    valid: ['', 'Some text', 'x'.repeat(100)],
    invalid: [['x'.repeat(101), "PF-319"]],
  },
  tax_id: {
    valid: ["123456789"],
    invalid: [['', "PF-829"], ["12345678", "PF-243"]],
  },
  street: {
    valid: ['Main works', 'x'.repeat(120)],
    invalid: [['', "PF-528"], ['x'.repeat(121), "PF-209"]],
  },
  house_number: {
    valid: ["17a"],
    invalid: [['', "PF-535"], ["12-B", "PF-238"]],
  },
  postcode: {
    valid: ["1012 AB"],
    invalid: [['', "PF-981"], ["12345", "PF-230"]],
  },
  city: {
    valid: ['Main works', 'x'.repeat(60)],
    invalid: [['', "PF-417"], ['x'.repeat(61), "PF-323"]],
  },
  parcel_id: {
    valid: ["AMS-0412-07"],
    invalid: [['', "PF-579"], ["AB-1234-56", "PF-477"]],
  },
  lot_area: {
    valid: ['10', '100000', '10.5'],
    invalid: [['', "PF-973"], ['12,5', "PF-439"], ['100001', "PF-261"]],
  },
  building_height: {
    valid: ['1', '60', '1.5'],
    invalid: [['', "PF-697"], ['12,5', "PF-774"], ['61', "PF-661"]],
  },
  floors: {
    valid: ['1', '12'],
    invalid: [['', "PF-407"], ['2.5', "PF-191"], ['13', "PF-979"]],
  },
  basement_levels: {
    valid: ['0', '3'],
    invalid: [['', "PF-155"], ['2.5', "PF-220"], ['4', "PF-833"]],
  },
  dwelling_units: {
    valid: ['1', '200'],
    invalid: [['', "PF-455"], ['2.5', "PF-691"], ['201', "PF-902"]],
  },
  parking_spaces: {
    valid: ['0', '500'],
    invalid: [['', "PF-512"], ['2.5', "PF-478"], ['501', "PF-423"]],
  },
  start_date: {
    valid: ['2027-03-01', '2028-02-29'],
    invalid: [['', "PF-488"], ['2027-02-30', "PF-807"]],
  },
  end_date: {
    valid: ['2027-03-01', '2028-02-29'],
    invalid: [['', "PF-476"], ['2027-02-30', "PF-963"]],
  },
  project_type: {
    valid: ["new", "extension", "renovation", "demolition"],
    invalid: [['', "PF-116"], ['other', "PF-895"]],
  },
  use_class: {
    valid: ["residential", "commercial", "industrial", "mixed"],
    invalid: [['', "PF-974"], ['other', "PF-704"]],
  },
  roof_type: {
    valid: ["flat", "pitched", "green"],
    invalid: [['', "PF-347"], ['other', "PF-462"]],
  },
  facade_material: {
    valid: ["brick", "wood", "render", "glass", "stone"],
    invalid: [['', "PF-336"], ['other', "PF-544"]],
  },
  heritage_zone: {
    valid: ['yes', 'no'],
    invalid: [['', "PF-608"], ['maybe', "PF-156"]],
  },
  tree_removal: {
    valid: ['yes', 'no'],
    invalid: [['', "PF-847"], ['maybe', "PF-532"]],
  },
  trees_removed: {
    valid: ['0', '50'],
    invalid: [['', "PF-980"], ['2.5', "PF-146"], ['51', "PF-728"]],
  },
  contractor_license: {
    valid: ["CL004211"],
    invalid: [['', "PF-633"], ["CL12345", "PF-637"]],
  },
  architect_reg: {
    valid: ['', "AR-00817"],
    invalid: [["AR12345", "PF-424"]],
  },
  estimated_cost: {
    valid: ['1000', '50000000', '1000.5'],
    invalid: [['', "PF-592"], ['12,5', "PF-571"], ['50000001', "PF-591"]],
  },
  site_coverage: {
    valid: ['0', '100', '0.5'],
    invalid: [['', "PF-493"], ['12,5', "PF-380"], ['101', "PF-513"]],
  },
  setback_front: {
    valid: ['0', '50', '0.5'],
    invalid: [['', "PF-755"], ['12,5', "PF-480"], ['51', "PF-104"]],
  },
  setback_side: {
    valid: ['0', '20', '0.5'],
    invalid: [['', "PF-856"], ['12,5', "PF-690"], ['21', "PF-848"]],
  },
  drainage_plan: {
    valid: ['', "DP-0093"],
    invalid: [["DP-12", "PF-938"]],
  },
  emergency_contact: {
    valid: ['Main works', 'x'.repeat(80)],
    invalid: [['', "PF-140"], ['x'.repeat(81), "PF-629"]],
  },
  emergency_phone: {
    valid: ["+31 20 555 0101"],
    invalid: [['', "PF-415"], ["12-34", "PF-780"]],
  },
  description: {
    valid: ['Main works', 'x'.repeat(2000)],
    invalid: [['', "PF-988"], ['x'.repeat(2001), "PF-309"]],
  },
  notes: {
    valid: ['', 'Some text', 'x'.repeat(500)],
    invalid: [['x'.repeat(501), "PF-694"]],
  },
};

function load(file) {
  const resolved = require.resolve(file);
  delete require.cache[resolved];
  return require(resolved);
}

for (const [field, c] of Object.entries(CASES)) {
  test(`part ${field}`, () => {
    const { validate } = load(path.join(FIELDS_DIR, `${field}.js`));
    for (const value of c.valid) assert.equal(validate(value), null, `${field}: ${JSON.stringify(value)} is valid`);
    for (const [value, code] of c.invalid) {
      const error = validate(value);
      assert.ok(error && typeof error === 'object', `${field}: ${JSON.stringify(value)} returns an error object`);
      assert.equal(error.code, code, `${field}: ${JSON.stringify(value)}`);
      assert.equal(typeof error.message, 'string', `${field}: the message of ${code}`);
      assert.ok(error.message.trim().length > 0, `${field}: the message of ${code} is empty`);
    }
  });
}

test('part form', () => {
  // Every field module is replaced by one that fails on 'BAD' only, so the part reads validateForm alone.
  const names = fs.readdirSync(FIELDS_DIR).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3));
  const saved = new Map();
  for (const name of names) {
    const file = require.resolve(path.join(FIELDS_DIR, `${name}.js`));
    saved.set(file, require.cache[file]);
    const stub = new module.constructor(file);
    stub.filename = file;
    stub.loaded = true;
    stub.exports = { validate: (v) => (v === 'BAD' ? { code: `X-${name}`, message: `Fix ${name}.` } : null) };
    require.cache[file] = stub;
  }
  try {
    const { validateForm } = load(path.join(ROOT, 'src', 'index.js'));
    const form = Object.fromEntries(names.map((n) => [n, 'ok']));
    assert.deepEqual(validateForm(form), []);
    const errors = validateForm({ ...form, floors: 'BAD', city: 'BAD' });
    assert.ok(Array.isArray(errors));
    const got = errors.map((e) => [e.field, e.code, e.message]).sort((a, b) => a[0].localeCompare(b[0]));
    assert.deepEqual(got, [
      ['city', 'X-city', 'Fix city.'],
      ['floors', 'X-floors', 'Fix floors.'],
    ]);
  } finally {
    for (const [file, entry] of saved) {
      if (entry) require.cache[file] = entry;
      else delete require.cache[file];
    }
    delete require.cache[require.resolve(path.join(ROOT, 'src', 'index.js'))];
  }
});

test('part version', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.version, '2.0.0');
});

test('part changelog', () => {
  const lines = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8').split('\n');
  const at = lines.findIndex((l) => /^#{1,3}\s.*\b2\.0\.0\b/.test(l));
  assert.ok(at >= 0, 'a heading for 2.0.0');
  const next = lines.findIndex((l, i) => i > at && /^#{1,3}\s/.test(l));
  const body = lines.slice(at + 1, next === -1 ? undefined : next).filter((l) => l.trim() !== '');
  assert.ok(body.length > 0, 'the 2.0.0 section says what changed');
  const old = lines.findIndex((l) => /^#{1,3}\s.*\b1\.4\.2\b/.test(l));
  assert.ok(old === -1 || at < old, 'the 2.0.0 section is above 1.4.2');
});
