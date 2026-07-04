const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateLanes, tickObstacles } = require('../gameloop');
const { COLS } = require('../constants');

test('generateLanes skapar bilar i alla trafikrader', () => {
  const lanes = generateLanes(42);
  for (const row of [7, 8, 9, 10, 11, 12]) {
    assert.ok(lanes.some(o => o.lane === row && o.type === 'car'),
      `Saknar bil i rad ${row}`);
  }
});

test('generateLanes skapar stockar i alla flodrader', () => {
  const lanes = generateLanes(42);
  for (const row of [1, 2, 3, 4, 5]) {
    assert.ok(lanes.some(o => o.lane === row && o.type === 'log'),
      `Saknar stock i rad ${row}`);
  }
});

test('generateLanes ger reproducerbara resultat för samma seed', () => {
  const a = generateLanes(123);
  const b = generateLanes(123);
  assert.deepEqual(a, b);
});

test('generateLanes ger olika resultat för olika seeds', () => {
  const a = generateLanes(1);
  const b = generateLanes(2);
  assert.ok(a[0].x !== b[0].x || a[0].speed !== b[0].speed);
});

test('tickObstacles rör hinder åt höger', () => {
  const obs = [{ lane: 7, x: 0.0, width: 1, type: 'car', speed: 0.1, dir: 1 }];
  tickObstacles(obs);
  assert.ok(Math.abs(obs[0].x - 0.1) < 0.0001);
});

test('tickObstacles lindar bil vid höger kant', () => {
  const obs = [{ lane: 7, x: 12.95, width: 1, type: 'car', speed: 0.1, dir: 1 }];
  tickObstacles(obs);
  assert.ok(obs[0].x < 1.0, `x borde vara < 1, var ${obs[0].x}`);
});

test('tickObstacles lindar INTE stock vid vänster kant förrän helt utanför', () => {
  // width=3, x=0.02 → efter tick x=-0.08 → -0.08 > -3 → ingen lindning
  const obs = [{ lane: 2, x: 0.02, width: 3, type: 'log', speed: 0.1, dir: -1 }];
  tickObstacles(obs);
  assert.ok(obs[0].x < 0, `x borde vara negativt, var ${obs[0].x}`);
  assert.ok(obs[0].x > -3, `x borde inte ha lindats, var ${obs[0].x}`);
});

test('tickObstacles lindar stock när den helt lämnat vänster kant', () => {
  // width=3, x=-2.95 → efter tick x=-3.05 → -3.05 < -3 → lindning
  const obs = [{ lane: 2, x: -2.95, width: 3, type: 'log', speed: 0.1, dir: -1 }];
  tickObstacles(obs);
  assert.ok(obs[0].x > 9.0, `x borde vara > 9 efter lindning, var ${obs[0].x}`);
});
