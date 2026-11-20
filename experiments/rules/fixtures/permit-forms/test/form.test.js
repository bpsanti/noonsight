'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { validateForm } = require('../src/index.js');

const VALID = {
  applicant_name: "Main works",
  applicant_email: "ana@example.org",
  applicant_phone: "+31 20 555 0101",
  company_name: "",
  tax_id: "123456789",
  street: "Main works",
  house_number: "17a",
  postcode: "1012 AB",
  city: "Main works",
  parcel_id: "AMS-0412-07",
  lot_area: "10",
  building_height: "1",
  floors: "1",
  basement_levels: "0",
  dwelling_units: "1",
  parking_spaces: "0",
  start_date: "2027-03-01",
  end_date: "2027-03-01",
  project_type: "new",
  use_class: "residential",
  roof_type: "flat",
  facade_material: "brick",
  heritage_zone: "no",
  tree_removal: "no",
  trees_removed: "0",
  contractor_license: "CL004211",
  architect_reg: "AR-00817",
  estimated_cost: "1000",
  site_coverage: "0",
  setback_front: "0",
  setback_side: "0",
  drainage_plan: "DP-0093",
  emergency_contact: "Main works",
  emergency_phone: "+31 20 555 0101",
  description: "Main works",
  notes: "",
};

test('a complete form is valid', () => {
  assert.equal(validateForm(VALID), true);
});

test('a form with a bad field is not', () => {
  assert.equal(validateForm({ ...VALID, floors: '40' }), false);
});
