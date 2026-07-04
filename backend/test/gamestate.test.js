const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateLanes } = require('../gameloop');

// Testar frontendens GameState (prediction + lokal hindersimulering)
// via dynamic import — ren JS utan DOM-beroenden.

function stateMsg(over = {}) {
  return {
    type: 'state',
    players: {
      p1: { x: 5, y: 14, lives: 3, score: 0 },
      p2: { x: 7, y: 14, lives: 3, score: 0 }
    },
    seed: 42,
    tick: 0,
    round: 1,
    roundScores: { p1: 0, p2: 0 },
    phase: 'playing',
    ack: { p1: 0, p2: 0 },
    ...over
  };
}

async function makeGs() {
  const { GameState } = await import('../../frontend/js/game.js');
  const gs = new GameState();
  gs.applyMessage({ type: 'match_start', you: 'p1' }, 0);
  return gs;
}

test('state med seed genererar hindren lokalt', async () => {
  const gs = await makeGs();
  gs.applyMessage(stateMsg(), 1000);
  const obs = gs.obstaclesAt(1000);
  const expected = generateLanes(42);
  assert.equal(obs.length, expected.length);
  obs.forEach((o, i) => {
    assert.ok(Math.abs(o.x - expected[i].x) < 1e-9,
      `hinder ${i}: x ${o.x} vs ${expected[i].x}`);
    assert.equal(o.lane, expected[i].lane);
    assert.equal(o.type, expected[i].type);
    assert.equal(o.width, expected[i].width);
  });
});

test('obstaclesAt extrapolerar mellan serverticks', async () => {
  const gs = await makeGs();
  gs.applyMessage(stateMsg(), 1000);
  const base = generateLanes(42)[0];
  const obs = gs.obstaclesAt(1000 + 100); // exakt en tick senare (TICK_MS=100)
  assert.ok(Math.abs(obs[0].x - (base.x + base.speed * base.dir)) < 1e-9);
});

test('obstaclesAt fryser när rundan är över', async () => {
  const gs = await makeGs();
  gs.applyMessage(stateMsg({ phase: 'round_over', tick: 10 }), 1000);
  const a = gs.obstaclesAt(1000);
  const b = gs.obstaclesAt(5000);
  assert.deepEqual(a.map(o => o.x), b.map(o => o.x));
});

test('predictMove flyttar egna spelaren direkt och returnerar seq', async () => {
  const gs = await makeGs();
  gs.applyMessage(stateMsg(), 1000);
  const seq = gs.predictMove('up');
  assert.equal(seq, 1);
  assert.equal(gs.players.p1.y, 13);
  assert.equal(gs.players.p2.y, 14); // motståndaren orörd
});

test('server-state med gammal ack skriver inte över predikterad position', async () => {
  const gs = await makeGs();
  gs.applyMessage(stateMsg(), 1000);
  gs.predictMove('up'); // seq 1, lokalt y=13
  // Tick-broadcast som skickades innan servern såg draget
  gs.applyMessage(stateMsg({ tick: 1, ack: { p1: 0, p2: 0 } }), 1100);
  assert.equal(gs.players.p1.y, 13); // behåller prediktionen
});

test('server-state med ack ≥ seq tar serverns position', async () => {
  const gs = await makeGs();
  gs.applyMessage(stateMsg(), 1000);
  gs.predictMove('up'); // seq 1
  // Servern har processat draget — men dödade grodan (respawn y=14)
  gs.applyMessage(stateMsg({ tick: 2, ack: { p1: 1, p2: 0 } }), 1200);
  assert.equal(gs.players.p1.y, 14); // serverns position gäller
});

test('match_start sätter inte fas — fasen styrs av state', async () => {
  const { GameState } = await import('../../frontend/js/game.js');
  const gs = new GameState();
  gs.applyMessage({ type: 'waiting' }, 0);
  gs.applyMessage({ type: 'match_start', you: 'p1' }, 100);
  assert.equal(gs.phase, 'waiting'); // ännu ingen state-broadcast
  gs.applyMessage(stateMsg({ phase: 'lobby' }), 200);
  assert.equal(gs.phase, 'lobby');
});

test('countdownRemaining räknar ner från eventets duration', async () => {
  const gs = await makeGs();
  gs.applyMessage({ type: 'event', event: 'countdown', duration: 3000 }, 1000);
  assert.equal(gs.countdownRemaining(1000), 3000);
  assert.equal(gs.countdownRemaining(2500), 1500);
  assert.equal(gs.countdownRemaining(9000), 0); // klampas vid 0
});

test('predictMove returnerar null i lobby- och countdown-fas', async () => {
  const gs = await makeGs();
  gs.applyMessage(stateMsg({ phase: 'lobby' }), 1000);
  assert.equal(gs.predictMove('up'), null);
  gs.applyMessage(stateMsg({ phase: 'countdown' }), 1100);
  assert.equal(gs.predictMove('up'), null);
});

test('match_start nollställer prediction-seq (reconnect till ny match)', async () => {
  const gs = await makeGs();
  gs.applyMessage(stateMsg(), 1000);
  gs.predictMove('up'); // seq 1, lokalt y=13
  // Ny match (t.ex. efter reconnect) — nya rummets seq börjar på 0
  gs.applyMessage({ type: 'match_start', you: 'p1' }, 2000);
  gs.applyMessage(stateMsg({ ack: { p1: 0, p2: 0 } }), 2100);
  assert.equal(gs.players.p1.y, 14); // serverns spawn gäller, ingen kvarhängande prediktion
});

test('predictMove returnerar null när matchen inte pågår', async () => {
  const gs = await makeGs();
  gs.applyMessage(stateMsg({ phase: 'round_over' }), 1000);
  assert.equal(gs.predictMove('up'), null);
});
