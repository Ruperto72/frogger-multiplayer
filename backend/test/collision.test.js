const { test } = require('node:test');
const assert = require('node:assert/strict');
const { obstacleCoversCell, isHazardous, isSafeInRiver } = require('../collision');

test('obstacleCoversCell: hinder täcker rätt celler', () => {
  const obs = { x: 3.0, width: 2, type: 'car' };
  assert.ok(obstacleCoversCell(obs, 3));
  assert.ok(obstacleCoversCell(obs, 4));
  assert.ok(!obstacleCoversCell(obs, 2));
  assert.ok(!obstacleCoversCell(obs, 5));
});

test('obstacleCoversCell: hinder med float-x', () => {
  const obs = { x: 2.7, width: 2, type: 'car' };
  assert.ok(obstacleCoversCell(obs, 2)); // floor(2.7) = 2
  assert.ok(obstacleCoversCell(obs, 3));
});

test('obstacleCoversCell: lindning vid höger kant', () => {
  const obs = { x: 12.0, width: 2, type: 'car' };
  assert.ok(obstacleCoversCell(obs, 12));
  assert.ok(obstacleCoversCell(obs, 0)); // 13 % 13 = 0
});

test('isHazardous: bil på spelarens cell → farligt', () => {
  const obs = [{ lane: 8, x: 5.0, width: 1, type: 'car', speed: 0, dir: 1 }];
  assert.ok(isHazardous(obs, 5, 8));
});

test('isHazardous: ingen bil på spelarens cell → säkert', () => {
  const obs = [{ lane: 8, x: 5.0, width: 1, type: 'car', speed: 0, dir: 1 }];
  assert.ok(!isHazardous(obs, 6, 8));
});

test('isHazardous: i flod utan stock → farligt', () => {
  const obs = [{ lane: 2, x: 5.0, width: 3, type: 'log', speed: 0, dir: 1 }];
  assert.ok(isHazardous(obs, 9, 2)); // ingen stock på cell 9
});

test('isHazardous: i flod på stock → säkert', () => {
  const obs = [{ lane: 2, x: 5.0, width: 3, type: 'log', speed: 0, dir: 1 }];
  assert.ok(!isHazardous(obs, 6, 2)); // cell 6 täcks av stock (5,6,7)
});

test('isHazardous: i säker zon → aldrig farligt', () => {
  assert.ok(!isHazardous([], 6, 6));   // mittzon
  assert.ok(!isHazardous([], 5, 14));  // startzon
  assert.ok(!isHazardous([], 6, 0));   // målrad
});
