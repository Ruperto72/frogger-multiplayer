const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateLanes, tickObstacles } = require('../gameloop');
const { COLS } = require('../constants');

// Frontend simulerar hindren lokalt från seed — dessa tester garanterar att
// frontendens sim.js förblir identisk med backendens gameloop.js.

test('frontend-sim genererar identiska banor som backend', async () => {
  const sim = await import('../../frontend/js/sim.js');
  for (const seed of [1, 42, 64, 123456789, 4294967295]) {
    assert.deepEqual(sim.generateLanes(seed), generateLanes(seed),
      `seed ${seed} gav olika banor`);
  }
});

test('frontend obstacleXAt matchar serverns iterativa tick', async () => {
  const sim = await import('../../frontend/js/sim.js');
  const base   = generateLanes(42);
  const server = generateLanes(42);
  for (let t = 1; t <= 2000; t++) {
    tickObstacles(server);
    base.forEach((obs, i) => {
      const clientX = sim.obstacleXAt(obs, t);
      const period  = COLS + obs.width;
      const d = Math.abs(clientX - server[i].x) % period;
      const circDiff = Math.min(d, period - d);
      assert.ok(circDiff < 1e-6,
        `tick ${t}, hinder ${i}: klient ${clientX} vs server ${server[i].x}`);
    });
  }
});

test('frontend-sim exporterar samma spelplanskonstanter', async () => {
  const sim = await import('../../frontend/js/sim.js');
  const constants = require('../constants');
  assert.equal(sim.COLS, constants.COLS);
  assert.equal(sim.ROWS, constants.ROWS);
  assert.equal(sim.TICK_MS, constants.TICK_MS);
});
