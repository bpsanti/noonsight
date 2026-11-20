'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const floors = require('../src/fields/floors.js');
const postcode = require('../src/fields/postcode.js');
const startDate = require('../src/fields/start_date.js');

test('floors: a whole number from 1 to 12', () => {
  assert.equal(floors.validate('3'), true);
  assert.equal(floors.validate(''), false);
  assert.equal(floors.validate('2.5'), false);
  assert.equal(floors.validate('13'), false);
});

test('postcode: four digits and two capitals', () => {
  assert.equal(postcode.validate('1012 AB'), true);
  assert.equal(postcode.validate('1012AB'), true);
  assert.equal(postcode.validate('12345'), false);
});

test('start_date: a real day', () => {
  assert.equal(startDate.validate('2027-03-01'), true);
  assert.equal(startDate.validate('2027-02-30'), false);
});
