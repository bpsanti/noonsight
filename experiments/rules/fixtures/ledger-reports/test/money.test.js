import assert from 'node:assert/strict';
import test from 'node:test';
import { formatMoney } from '../src/legacy/money.js';
import { formatAmount } from '../src/money.js';

test('formatAmount uses each currency\'s symbol and decimals', () => {
  assert.equal(formatAmount(123456, 'USD'), '$1,234.56');
  assert.equal(formatAmount(-500, 'EUR'), '-€5.00');
  assert.equal(formatAmount(99, 'GBP'), '£0.99');
  assert.equal(formatAmount(123456, 'JPY'), '¥123,456');
  assert.equal(formatAmount(1234567, 'BHD'), 'BD1,234.567');
  assert.equal(formatAmount(5, 'BHD'), 'BD0.005');
});

test('formatAmount refuses an unknown currency and a fractional amount', () => {
  assert.throws(() => formatAmount(100, 'XYZ'), /unknown currency/);
  assert.throws(() => formatAmount(1.5, 'USD'), /integer/);
});

test('formatAmount prints US dollars as formatMoney did', () => {
  for (const cents of [0, 7, 99, 100, 123456, -4200, 100000000]) assert.equal(formatAmount(cents, 'USD'), formatMoney(cents));
});
