import assert from 'node:assert/strict';
import test from 'node:test';
import { reports } from '../src/index.js';

const usd = 'USD';

test('balance', () => {
  assert.equal(reports.balance({ account: { name: 'Operating', currency: usd, balance: 1250075 } }), 'Balance of Operating: $12,500.75');
});

test('invoice', () => {
  const text = reports.invoice({ invoice: { number: 'INV-7', currency: usd, lines: [{ description: 'Audit', amount: 90000 }, { description: 'Travel', amount: 12550 }] } });
  assert.match(text, /^Invoice INV-7\n/);
  assert.match(text, /Audit\s+\$900\.00/);
  assert.match(text, /Total\s+\$1,025\.50$/);
});

test('payroll', () => {
  const text = reports.payroll({ company: { name: 'Acme', currency: usd }, employees: [{ name: 'Ana', net: 420000 }, { name: 'Bo', net: 380050 }] });
  assert.equal(text, 'Payroll of Acme\n  Ana: $4,200.00\n  Bo: $3,800.50\n  Total: $8,000.50');
});

test('expenses', () => {
  assert.equal(reports.expenses({ claims: [{ label: 'Taxi', amount: 2300, currency: usd }] }), 'Expense claims\n  Taxi: $23.00');
});

test('budget', () => {
  const text = reports.budget({ budget: { name: 'Q3 travel', currency: usd, planned: 500000, actual: 525000 } });
  assert.equal(text, 'Budget Q3 travel\n  Planned: $5,000.00\n  Actual: $5,250.00\n  Over by $250.00');
});

test('refunds', () => {
  const text = reports.refunds({ settlementCurrency: usd, refunds: [{ order: 'A1', amount: 1999 }, { order: 'A2', amount: 501 }] });
  assert.equal(text, 'Refunds (2)\n  Order A1: $19.99\n  Order A2: $5.01\n  Refunded in total: $25.00');
});

test('fx', () => {
  assert.equal(reports.fx({ sold: { amount: 10000, currency: usd }, bought: { amount: 10000, currency: usd }, rate: '1.0000' }), 'Converted $100.00 into $100.00 at 1.0000');
});

test('aging', () => {
  const text = reports.aging({ ledger: { currency: usd }, buckets: { current: 100000, days30: 5000, days60: 0, days90: 12345 } });
  assert.match(text, /Current\s+\$1,000\.00/);
  assert.match(text, /Over 60 days\s+\$123\.45$/);
});

test('tax', () => {
  const text = reports.tax({ region: { name: 'Ohio', currency: usd, rate: 0.0575 }, taxable: 200000 });
  assert.equal(text, 'Sales tax, Ohio\n  Taxable sales: $2,000.00\n  Tax at 5.75%: $115.00');
});

test('vendors', () => {
  assert.equal(reports.vendors({ vendors: [{ name: 'Paperco', account: { currency: usd, owed: 30000 } }] }), 'Owed to vendors\n  Paperco: $300.00');
});

test('cashflow', () => {
  const text = reports.cashflow({ meta: { entity: 'Acme', currency: usd }, months: [{ month: '2026-01', inflow: 100000, outflow: 150000 }] });
  assert.equal(text, 'Cash flow of Acme\n  2026-01: in $1,000.00, out $1,500.00, net -$500.00');
});

test('subscriptions', () => {
  assert.equal(reports.subscriptions({ plans: [{ name: 'Basic', price: { amount: 900, currency: usd } }] }), 'Plans\n  Basic: $9.00 a month');
});

test('deposits', () => {
  assert.equal(reports.deposits({ bank: { name: 'First', currency: usd }, deposits: [1000, 2500] }), 'Deposits at First\n  #1 $10.00\n  #2 $25.00\n  Sum $35.00');
});

test('fees', () => {
  const text = reports.fees({ account: { id: 'X-1', currency: usd }, fees: [{ name: 'Wire', amount: 2500 }] });
  assert.equal(text, 'Fees on account X-1\n  Wire: $25.00\n  Fees in total: $25.00');
});

test('dividends', () => {
  assert.equal(reports.dividends({ holdings: [{ security: { ticker: 'ACME', currency: usd }, shares: 10, perShare: 52 }] }), 'Dividends\n  ACME: 10 x $0.52 = $5.20');
});

test('petty-cash', () => {
  const text = reports['petty-cash']({ box: { office: 'Lisbon', currency: usd, float: 20000, spent: [{ item: 'Stamps', amount: 1250 }] } });
  assert.equal(text, 'Petty cash, Lisbon\n  Float: $200.00\n  - Stamps: $12.50\n  Left: $187.50');
});

test('grants', () => {
  const text = reports.grants({ grant: { title: 'Wetlands', currency: usd, awarded: 1000000, disbursed: [{ date: '2026-02-01', amount: 250000 }] } });
  assert.equal(text, 'Grant: Wetlands\n  Awarded: $10,000.00\n  2026-02-01: $2,500.00\n  Remaining: $7,500.00');
});

test('entities', () => {
  const text = reports.entities({ entities: [{ name: 'Acme US', currency: usd, revenue: 900000, cost: 600000 }] });
  assert.equal(text, 'Group entities\n  Acme US: revenue $9,000.00, cost $6,000.00, margin $3,000.00');
});
