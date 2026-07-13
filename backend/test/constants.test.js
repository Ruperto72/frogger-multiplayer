const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../constants');

test('COLS and ROWS are correct', () => {
  assert.equal(C.COLS, 13);
  assert.equal(C.ROWS, 15);
});

test('RIVER_ROWS contains rows 1-5', () => {
  for (let r = 1; r <= 5; r++) assert.ok(C.RIVER_ROWS.has(r));
  assert.ok(!C.RIVER_ROWS.has(6));
});

test('TRAFFIC_ROWS contains rows 7-12', () => {
  for (let r = 7; r <= 12; r++) assert.ok(C.TRAFFIC_ROWS.has(r));
});

test('SPAWN positions are in start zone', () => {
  assert.equal(C.SPAWN.p1.y, 14);
  assert.equal(C.SPAWN.p2.y, 14);
});

test('DEFAULT_ANIMAL_NAMES är Frog/Toad', () => {
  assert.equal(C.DEFAULT_ANIMAL_NAMES.frog, 'Frog');
  assert.equal(C.DEFAULT_ANIMAL_NAMES.toad, 'Toad');
});
