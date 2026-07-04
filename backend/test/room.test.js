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

function makeRoom() {
  const ws1 = mockWs(), ws2 = mockWs();
  const room = new Room(ws1, ws2);
  clearInterval(room._tick); // stoppa tick i tester
  return { room, ws1, ws2 };
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
