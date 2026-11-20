import assert from 'node:assert/strict';
import test from 'node:test';
import { quote } from '../src/quote.js';

test('a parcel costs the base price and a price per started kilogram', () => {
  assert.equal(quote({ weightKg: 3, zone: 2 }).price, '10.00');
  assert.equal(quote({ weightKg: 2.5, zone: 1 }).price, '7.60');
});

test('an unknown zone or a weight of 0 is refused', () => {
  assert.throws(() => quote({ weightKg: 1, zone: 5 }), /unknown zone/);
  assert.throws(() => quote({ weightKg: 0, zone: 1 }), /more than 0/);
});
