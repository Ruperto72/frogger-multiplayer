const { test } = require('node:test');
const assert = require('node:assert/strict');
const TournamentManager = require('../manager');

function mockWs() {
  const handlers = {};
  const messages = [];
  return {
    messages,
    freed: 0,
    freeRoute() { this.freed++; },
    send(m) { messages.push(JSON.parse(m)); },
    on: (event, fn) => { (handlers[event] ??= []).push(fn); },
    off: (event, fn) => { handlers[event] = (handlers[event] ?? []).filter(f => f !== fn); },
    emit: (event, data) => { for (const fn of [...(handlers[event] ?? [])]) fn(data); },
    readyState: 1
  };
}

test('create skickar tournament_created med 4-bokstavskod', () => {
  const mgr = new TournamentManager();
  const ws = mockWs();
  const t = mgr.create(ws, { size: 4, bestOf: 3, name: 'Värd' });
  const created = ws.messages.find(m => m.type === 'tournament_created');
  assert.match(created.code, /^[A-HJ-NP-Z]{4}$/);
  assert.equal(mgr.tournaments.get(created.code), t);
  assert.equal(t.participants[0].isHost, true);
});

test('join med okänd kod ger error unknown_code', () => {
  const mgr = new TournamentManager();
  const ws = mockWs();
  const res = mgr.join(ws, { code: 'XXXX', name: 'Test' });
  assert.equal(res, null);
  assert.deepEqual(ws.messages.at(-1), { type: 'error', reason: 'unknown_code' });
});

test('join hittar turneringen oavsett skiftläge i koden', () => {
  const mgr = new TournamentManager();
  const wsHost = mockWs();
  const t = mgr.create(wsHost, { size: 4, bestOf: 3, name: 'Värd' });
  const ws = mockWs();
  const res = mgr.join(ws, { code: t.code.toLowerCase(), name: 'Gäst' });
  assert.equal(res, t);
});

test('avbruten turnering tas bort och deltagarnas routing frigörs', () => {
  const mgr = new TournamentManager();
  const wsHost = mockWs();
  const t = mgr.create(wsHost, { size: 4, bestOf: 3, name: 'Värd' });
  const ws2 = mockWs();
  mgr.join(ws2, { code: t.code, name: 'Gäst' });
  wsHost.emit('close'); // värd lämnar under samling → cancel → release
  assert.equal(mgr.tournaments.has(t.code), false);
  assert.equal(ws2.freed, 1);
});
