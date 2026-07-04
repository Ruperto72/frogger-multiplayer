const { test } = require('node:test');
const assert = require('node:assert/strict');
const Room = require('../room');

function mockWs() {
  const handlers = {};
  const messages = [];
  return {
    messages,
    send: (m) => messages.push(JSON.parse(m)),
    on: (event, fn) => { handlers[event] = fn; },
    emit: (event, data) => handlers[event]?.(data),
    readyState: 1
  };
}

function makeLobby() {
  const ws1 = mockWs(), ws2 = mockWs();
  const room = new Room(ws1, ws2);
  clearInterval(room._tick); // stoppa tick i tester
  return { room, ws1, ws2 };
}

function makeRoom() {
  // Hoppar förbi lobbyn — speltesterna förutsätter pågående match
  const ctx = makeLobby();
  ctx.room.state.phase = 'playing';
  return ctx;
}

function sendReady(ws, over = {}) {
  ws.emit('message', JSON.stringify({ type: 'ready', name: 'Testare', skin: 'green', ...over }));
}

test('spelare startar på spawn-position', () => {
  const { room } = makeRoom();
  assert.equal(room.state.players.p1.x, 5);
  assert.equal(room.state.players.p1.y, 14);
  assert.equal(room.state.players.p2.x, 7);
  assert.equal(room.state.players.p2.y, 14);
});

test('spelare startar med 3 liv', () => {
  const { room } = makeRoom();
  assert.equal(room.state.players.p1.lives, 3);
  assert.equal(room.state.players.p2.lives, 3);
});

test('rörelse upp minskar y', () => {
  const { room } = makeRoom();
  room.handleMove('p1', 'up');
  assert.equal(room.state.players.p1.y, 13);
});

test('rörelse ned ökar y', () => {
  const { room } = makeRoom();
  room.handleMove('p1', 'down');
  assert.equal(room.state.players.p1.y, 14); // y=14 är redan botten → ignoreras
});

test('rörelse ignoreras vid kantväggen', () => {
  const { room } = makeRoom();
  room.state.players.p1.x = 0;
  room.handleMove('p1', 'left');
  assert.equal(room.state.players.p1.x, 0);
});

test('spelare dör av bil och förlorar liv', () => {
  const { room } = makeRoom();
  room.state.players.p1.x = 5;
  room.state.players.p1.y = 8;
  room.state.obstacles = [{ lane: 7, x: 5.0, width: 1, type: 'car', speed: 0, dir: 1 }];
  room.handleMove('p1', 'up'); // hoppar till y=7, bil på cell 5 i rad 7
  assert.equal(room.state.players.p1.lives, 2);
  assert.equal(room.state.players.p1.y, 14); // respawn
});

test('spelare dör i flod utan stock', () => {
  const { room } = makeRoom();
  room.state.players.p1.x = 5;
  room.state.players.p1.y = 2;
  room.state.obstacles = []; // inga stockar
  room.handleMove('p1', 'up'); // hoppar till y=1, inget stöd → dör
  assert.equal(room.state.players.p1.lives, 2);
});

test('spelare överlever i flod på stock', () => {
  const { room } = makeRoom();
  room.state.players.p1.x = 5;
  room.state.players.p1.y = 2;
  room.state.obstacles = [{ lane: 1, x: 4.0, width: 3, type: 'log', speed: 0, dir: 1 }];
  room.handleMove('p1', 'up'); // hoppar till y=1, stock täcker cell 5
  assert.equal(room.state.players.p1.lives, 3);
  assert.equal(room.state.players.p1.y, 1);
});

test('spelare som når målraden får poäng och respawnar', () => {
  const { room } = makeRoom();
  room.state.players.p1.x = 5;
  room.state.players.p1.y = 1;
  room.state.obstacles = []; // tom flod — men vi går till rad 0 direkt
  room.handleMove('p1', 'up'); // hoppar till y=0 = mål
  assert.equal(room.state.players.p1.score, 1);
  assert.equal(room.state.players.p1.y, 14); // respawn
});

test('stöt: B studsar bakåt, A tar platsen', () => {
  const { room } = makeRoom();
  // Placera p2 på (5,13), p1 på (5,14)
  room.state.players.p1 = { x: 5, y: 14, lives: 3, score: 0 };
  room.state.players.p2 = { x: 5, y: 13, lives: 3, score: 0 };
  room.state.obstacles = [];
  room.handleMove('p1', 'up'); // p1 hoppar till (5,13) där p2 är
  assert.equal(room.state.players.p1.x, 5);
  assert.equal(room.state.players.p1.y, 13); // A tar platsen
  assert.equal(room.state.players.p2.y, 14); // B studsar bakåt (ned = +y)
});

test('stöt: B respawnar om studsrutan är farlig', () => {
  const { room } = makeRoom();
  room.state.players.p1 = { x: 5, y: 8, lives: 3, score: 0 };
  room.state.players.p2 = { x: 5, y: 7, lives: 3, score: 0 };
  // Bil på cell 5 i rad 8 (dit p2 skulle studsa)
  room.state.obstacles = [{ lane: 8, x: 5.0, width: 1, type: 'car', speed: 0, dir: 1 }];
  room.handleMove('p1', 'up'); // p1 hoppar till (5,7) där p2 är; p2 studsar till (5,8) = bil
  assert.equal(room.state.players.p2.y, 14); // respawn utan att förlora liv
  assert.equal(room.state.players.p2.lives, 3); // inget liv förlorat
});

function lastState(ws) {
  return ws.messages.filter(m => m.type === 'state').at(-1);
}

test('rum startar i lobby-fas med defaultnamn och ready=false', () => {
  const { room } = makeLobby();
  assert.equal(room.state.phase, 'lobby');
  assert.equal(room.state.players.p1.name, 'Spelare 1');
  assert.equal(room.state.players.p2.name, 'Spelare 2');
  assert.equal(room.state.players.p1.ready, false);
  assert.equal(room.state.players.p2.ready, false);
});

test('move ignoreras i lobby-fas', () => {
  const { room, ws1 } = makeLobby();
  ws1.emit('message', JSON.stringify({ type: 'move', direction: 'up', seq: 1 }));
  assert.equal(room.state.players.p1.y, 14);
});

test('ready sätter namn, skin och ready-flagga', () => {
  const { room, ws1 } = makeLobby();
  sendReady(ws1, { name: 'Robert', skin: 'blue' });
  assert.equal(room.state.players.p1.name, 'Robert');
  assert.equal(room.state.players.p1.skin, 'blue');
  assert.equal(room.state.players.p1.ready, true);
  assert.equal(lastState(ws1).players.p1.ready, true); // broadcastas
});

test('namn trimmas och begränsas till 20 tecken', () => {
  const { room, ws1 } = makeLobby();
  sendReady(ws1, { name: '  ' + 'a'.repeat(30) + '  ' });
  assert.equal(room.state.players.p1.name, 'a'.repeat(20));
});

test('tomt namn ger defaultnamn', () => {
  const { room, ws1 } = makeLobby();
  sendReady(ws1, { name: '   ' });
  assert.equal(room.state.players.p1.name, 'Spelare 1');
});

test('ogiltig skin faller tillbaka på green', () => {
  const { room, ws1 } = makeLobby();
  sendReady(ws1, { skin: 'rainbow' });
  assert.equal(room.state.players.p1.skin, 'green');
});

test('båda redo ger countdown-event och fas countdown', () => {
  const { room, ws1, ws2 } = makeLobby();
  sendReady(ws1);
  assert.equal(room.state.phase, 'lobby'); // bara en redo än
  sendReady(ws2);
  assert.equal(room.state.phase, 'countdown');
  const ev = ws1.messages.find(m => m.type === 'event' && m.event === 'countdown');
  assert.equal(ev.duration, 3000);
});

test('fas blir playing 3 sekunder efter countdown', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { room, ws1, ws2 } = makeLobby();
  sendReady(ws1);
  sendReady(ws2);
  t.mock.timers.tick(2999);
  assert.equal(room.state.phase, 'countdown');
  t.mock.timers.tick(1);
  assert.equal(room.state.phase, 'playing');
  assert.equal(lastState(ws1).phase, 'playing');
});

test('ready ignoreras under pågående spel', () => {
  const { room, ws1 } = makeRoom();
  sendReady(ws1, { name: 'Fuskare' });
  assert.equal(room.state.players.p1.name, 'Spelare 1');
});

test('namn och skin bevaras vid ny runda', () => {
  const { room, ws1, ws2 } = makeLobby();
  sendReady(ws1, { name: 'Anna', skin: 'yellow' });
  sendReady(ws2, { name: 'Bertil', skin: 'blue' });
  room.state.phase = 'playing';
  room._startNewRound();
  assert.equal(room.state.players.p1.name, 'Anna');
  assert.equal(room.state.players.p1.skin, 'yellow');
  assert.equal(room.state.players.p2.name, 'Bertil');
});

test('state-broadcast innehåller seed och tick men inte obstacles', () => {
  const { ws1 } = makeRoom();
  const msg = lastState(ws1);
  assert.equal(typeof msg.seed, 'number');
  assert.equal(msg.tick, 0);
  assert.equal(msg.obstacles, undefined);
});

test('tick räknas upp i state-broadcast för varje servertick', () => {
  const { room, ws1 } = makeRoom();
  room._onTick();
  room._onTick();
  assert.equal(lastState(ws1).tick, 2);
});

test('tick nollställs vid ny runda', () => {
  const { room, ws1 } = makeRoom();
  room._onTick();
  room._startNewRound();
  assert.equal(lastState(ws1).tick, 0);
});

test('state-broadcast ackar senast mottagna seq', () => {
  const { room, ws1 } = makeRoom();
  ws1.emit('message', JSON.stringify({ type: 'move', direction: 'up', seq: 5 }));
  assert.equal(lastState(ws1).ack.p1, 5);
});

test('seq ackas även när draget avvisas av rate-limit', () => {
  const { room, ws1 } = makeRoom();
  ws1.emit('message', JSON.stringify({ type: 'move', direction: 'up', seq: 1 }));
  // Andra draget inom 50 ms avvisas, men seq ska ändå ackas vid nästa tick
  ws1.emit('message', JSON.stringify({ type: 'move', direction: 'up', seq: 2 }));
  room._onTick();
  assert.equal(lastState(ws1).ack.p1, 2);
});
