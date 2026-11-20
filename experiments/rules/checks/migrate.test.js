// The hidden check of the migrate task: copied into the project only after the run ends. Each test
// is one part of the task, named "part <name>", and imports its report on its own, so a report the
// session broke fails only its own part.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);

/** The report's render function, after checking that the report no longer imports the legacy helper. */
async function migrated(name) {
  const file = new URL(`src/reports/${name}.js`, root);
  assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /legacy\/money|formatMoney/, `${name}.js still uses formatMoney`);
  return (await import(file.href)).render;
}

const parts = {
  balance: (r) => assert.equal(r({ account: { name: 'Tokyo', currency: 'JPY', balance: 1250075 } }), 'Balance of Tokyo: ¥1,250,075'),
  invoice: (r) => {
    const text = r({ invoice: { number: 'INV-9', currency: 'EUR', lines: [{ description: 'Audit', amount: 90000 }, { description: 'Travel', amount: 12550 }] } });
    assert.match(text, /Audit\s+€900\.00/);
    assert.match(text, /Total\s+€1,025\.50$/);
  },
  payroll: (r) => assert.equal(r({ company: { name: 'Manama', currency: 'BHD' }, employees: [{ name: 'Ali', net: 1250500 }] }), 'Payroll of Manama\n  Ali: BD1,250.500\n  Total: BD1,250.500'),
  expenses: (r) => assert.equal(r({ claims: [{ label: 'Taxi', amount: 2300, currency: 'JPY' }, { label: 'Hotel', amount: 15000, currency: 'GBP' }] }), 'Expense claims\n  Taxi: ¥2,300\n  Hotel: £150.00'),
  budget: (r) =>
    assert.equal(r({ budget: { name: 'Travel', currency: 'JPY', planned: 500000, actual: 480000 } }), 'Budget Travel\n  Planned: ¥500,000\n  Actual: ¥480,000\n  Under by ¥20,000'),
  refunds: (r) => assert.equal(r({ settlementCurrency: 'EUR', refunds: [{ order: 'B7', amount: 1999 }] }), 'Refunds (1)\n  Order B7: €19.99\n  Refunded in total: €19.99'),
  fx: (r) => assert.equal(r({ sold: { amount: 100000, currency: 'USD' }, bought: { amount: 148500, currency: 'JPY' }, rate: '148.50' }), 'Converted $1,000.00 into ¥148,500 at 148.50'),
  aging: (r) => {
    const text = r({ ledger: { currency: 'BHD' }, buckets: { current: 100000, days30: 5000, days60: 0, days90: 12345 } });
    assert.match(text, /Current\s+BD100\.000/);
    assert.match(text, /Over 60 days\s+BD12\.345$/);
  },
  tax: (r) => assert.equal(r({ region: { name: 'Osaka', currency: 'JPY', rate: 0.1 }, taxable: 200000 }), 'Sales tax, Osaka\n  Taxable sales: ¥200,000\n  Tax at 10.00%: ¥20,000'),
  vendors: (r) =>
    assert.equal(
      r({ vendors: [{ name: 'Paperco', account: { currency: 'EUR', owed: 30000 } }, { name: 'Inkworks', account: { currency: 'JPY', owed: 30000 } }] }),
      'Owed to vendors\n  Paperco: €300.00\n  Inkworks: ¥30,000',
    ),
  cashflow: (r) =>
    assert.equal(r({ meta: { entity: 'Acme GB', currency: 'GBP' }, months: [{ month: '2026-01', inflow: 100000, outflow: 150000 }] }), 'Cash flow of Acme GB\n  2026-01: in £1,000.00, out £1,500.00, net -£500.00'),
  subscriptions: (r) =>
    assert.equal(r({ plans: [{ name: 'Basic', price: { amount: 900, currency: 'EUR' } }, { name: 'Pro', price: { amount: 2900, currency: 'JPY' } }] }), 'Plans\n  Basic: €9.00 a month\n  Pro: ¥2,900 a month'),
  deposits: (r) => assert.equal(r({ bank: { name: 'Gulf', currency: 'BHD' }, deposits: [1000, 2500] }), 'Deposits at Gulf\n  #1 BD1.000\n  #2 BD2.500\n  Sum BD3.500'),
  fees: (r) => assert.equal(r({ account: { id: 'J-2', currency: 'JPY' }, fees: [{ name: 'Wire', amount: 2500 }] }), 'Fees on account J-2\n  Wire: ¥2,500\n  Fees in total: ¥2,500'),
  dividends: (r) =>
    assert.equal(
      r({ holdings: [{ security: { ticker: 'SONY', currency: 'JPY' }, shares: 10, perShare: 52 }, { security: { ticker: 'SAP', currency: 'EUR' }, shares: 3, perShare: 220 }] }),
      'Dividends\n  SONY: 10 x ¥52 = ¥520\n  SAP: 3 x €2.20 = €6.60',
    ),
  'petty-cash': (r) =>
    assert.equal(r({ box: { office: 'Berlin', currency: 'EUR', float: 20000, spent: [{ item: 'Stamps', amount: 1250 }] } }), 'Petty cash, Berlin\n  Float: €200.00\n  - Stamps: €12.50\n  Left: €187.50'),
  grants: (r) =>
    assert.equal(
      r({ grant: { title: 'Reefs', currency: 'BHD', awarded: 1000000, disbursed: [{ date: '2026-02-01', amount: 250000 }] } }),
      'Grant: Reefs\n  Awarded: BD1,000.000\n  2026-02-01: BD250.000\n  Remaining: BD750.000',
    ),
  entities: (r) =>
    assert.equal(
      r({ entities: [{ name: 'Acme JP', currency: 'JPY', revenue: 900000, cost: 600000 }, { name: 'Acme UK', currency: 'GBP', revenue: 900000, cost: 600000 }] }),
      'Group entities\n  Acme JP: revenue ¥900,000, cost ¥600,000, margin ¥300,000\n  Acme UK: revenue £9,000.00, cost £6,000.00, margin £3,000.00',
    ),
};

for (const [name, check] of Object.entries(parts)) test(`part ${name}: formats each amount in its own currency`, async () => check(await migrated(name)));

test('part changelog: the change is listed under Unreleased', () => {
  const text = fs.readFileSync(new URL('CHANGELOG.md', root), 'utf8');
  const unreleased = /^## Unreleased\s*$([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(text);
  assert.ok(unreleased, 'CHANGELOG.md has no Unreleased section');
  assert.match(unreleased[1] ?? '', /\S/, 'the Unreleased section is empty');
});
