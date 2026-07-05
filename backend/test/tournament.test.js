const { test } = require('node:test');
const assert = require('node:assert/strict');
const { setTimeout: delay } = require('node:timers/promises');
const Tournament = require('../tournament');

function mockWs() {
  const handlers = {};
  const messages = [];
  return {
    messages,
    send: (m) => messages.push(JSON.parse(m)),
    on: (event, fn) => { (handlers[event] ??= []).push(fn); },
    off: (event, fn) => { handlers[event] = (handlers[event] ?? []).filter(f => f !== fn); },
    emit: (event, data) => { for (const fn of [...(handlers[event] ?? [])]) fn(data); },
    readyState: 1
  };
}

function makeTournament(over = {}) {
  const released = [];
  const t = new Tournament('ABCD', { size: 4, bestOf: 3, graceMs: 5, ...over },
    (tt) => released.push(tt));
  return { t, released };
}

function joinAll(t, n) {
  const sockets = [];
  for (let i = 0; i < n; i++) {
    const ws = mockWs();
    const res = t.join(ws, `Spelare${i + 1}`, 'green', i === 0);
    assert.ok(res.participant, `join ${i} skulle lyckas`);
    sockets.push(ws);
  }
  return sockets;
}

test('join broadcastar tournament_state med rätt you per socket', () => {
  const { t } = makeTournament();
  const [ws1, ws2] = joinAll(t, 2);
  const last1 = ws1.messages.at(-1);
  const last2 = ws2.messages.at(-1);
  assert.equal(last1.type, 'tournament_state');
  assert.equal(last1.phase, 'gathering');
  assert.equal(last1.participants.length, 2);
  assert.notEqual(last1.you, last2.you);
});

test('full turnering avvisar fler deltagare', () => {
  const { t } = makeTournament({ size: 2 });
  joinAll(t, 2);
  const res = t.join(mockWs(), 'Sen', 'green');
  assert.equal(res.error, 'tournament_full');
});

test('upptaget namn avvisas skiftlägesokänsligt', () => {
  const { t } = makeTournament();
  joinAll(t, 1);
  const res = t.join(mockWs(), 'sPeLaRe1', 'green');
  assert.equal(res.error, 'name_taken');
});

test('start med 2 skapar rum och skickar match_start till båda', () => {
  const { t } = makeTournament({ size: 2 });
  const [ws1, ws2] = joinAll(t, 2);
  t.start();
  assert.equal(t.phase, 'match');
  assert.notEqual(t.room, null);
  assert.equal(t.room._winsNeeded, 2); // bäst av 3
  assert.ok(ws1.messages.some(m => m.type === 'match_start' && m.you !== 'spectator'));
  assert.ok(ws2.messages.some(m => m.type === 'match_start' && m.you !== 'spectator'));
  t._release();
});

test('start_tournament via socket fungerar bara för värden', () => {
  const { t } = makeTournament({ size: 2 });
  const [, ws2] = joinAll(t, 2);
  ws2.emit('message', JSON.stringify({ type: 'start_tournament' }));
  assert.equal(t.phase, 'gathering');
  t._release();
});

test('deltagare utanför matchen blir åskådare', () => {
  const { t } = makeTournament({ size: 3 });
  const sockets = joinAll(t, 3);
  t.start(); // 4-träd med 1 frilott — en spelbar match, en åskådare
  const spectators = sockets.filter(ws =>
    ws.messages.some(m => m.type === 'match_start' && m.you === 'spectator'));
  assert.equal(spectators.length, 1);
  t._release();
});

test('matchslut skriver in vinnaren och aktiverar nästa match', () => {
  const { t, released } = makeTournament({ size: 2 });
  joinAll(t, 2);
  t.start();
  const { round, index } = t.currentMatch;
  t.room._endMatch('p1');
  assert.notEqual(t.bracket[round][index].winner, null);
  assert.equal(t.phase, 'finished');
  assert.equal(released.length, 1); // klar turnering släpps
});

test('värd som lämnar under samlingen avbryter turneringen', () => {
  const { t, released } = makeTournament();
  const [wsHost, ws2] = joinAll(t, 2);
  wsHost.emit('close');
  assert.ok(ws2.messages.some(m => m.type === 'error' && m.reason === 'tournament_cancelled'));
  assert.equal(released.length, 1);
});

test('icke-värd som lämnar under samlingen tas bara bort', () => {
  const { t, released } = makeTournament();
  const [, ws2] = joinAll(t, 3);
  ws2.emit('close');
  assert.equal(t.participants.length, 2);
  assert.equal(released.length, 0);
});

test('frånkopplad spelare på tur ger walkover efter fristen', async () => {
  const { t } = makeTournament({ size: 4 });
  const sockets = joinAll(t, 4);
  t.start();
  // Låt match 0 pågå; koppla från en spelare i match 1
  const m1 = t.bracket[0][1];
  const idx = t.participants.findIndex(p => p.id === m1.p1);
  sockets[idx].emit('close');
  // Avsluta match 0 → match 1 aktiveras med frånkopplad spelare
  t.room._endMatch('p1');
  assert.equal(t.phase, 'between_matches');
  await delay(20); // graceMs = 5
  assert.equal(t.bracket[0][1].winner, m1.p2);
  assert.equal(t.bracket[0][1].walkover, true);
  t._release();
});

test('turneringen släpps när alla deltagare lämnat', () => {
  const { t, released } = makeTournament({ size: 2 });
  const sockets = joinAll(t, 2);
  t.start();
  sockets[0].emit('close'); // walkover → finished → release
  sockets[1].emit('close');
  assert.equal(released.length, 1);
});
