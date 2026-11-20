'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const floors = require('../src/fields/floors.js');
const postcode = require('../src/fields/postcode.js');
const startDate = require('../src/fields/start_date.js');

const code = (error) => error && error.code;

test('floors: a whole number from 1 to 12', () => {
  assert.equal(floors.validate('3'), null);
  assert.equal(code(floors.validate('')), 'PF-407');
  assert.equal(code(floors.validate('2.5')), 'PF-191');
  assert.equal(code(floors.validate('13')), 'PF-979');
});

test('postcode: four digits and two capitals', () => {
  assert.equal(postcode.validate('1012 AB'), null);
  assert.equal(postcode.validate('1012AB'), null);
  assert.equal(code(postcode.validate('12345')), 'PF-230');
});

test('start_date: a real day', () => {
  assert.equal(startDate.validate('2027-03-01'), null);
  assert.equal(code(startDate.validate('2027-02-30')), 'PF-807');
});
