const { test } = require('node:test');
const assert = require('node:assert/strict');
const Lobby = require('../lobby');

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

test('sends waiting to first player', () => {
  const lobby = new Lobby(() => {});
  const ws = mockWs();
  lobby.join(ws);
  assert.equal(ws.messages[0].type, 'waiting');
});

test('queues first player', () => {
  const lobby = new Lobby(() => {});
  lobby.join(mockWs());
  assert.equal(lobby.queue.length, 1);
});

test('calls createRoom when two players join', () => {
  let called = false;
  const lobby = new Lobby(() => { called = true; });
  lobby.join(mockWs());
  lobby.join(mockWs());
  assert.ok(called);
  assert.equal(lobby.queue.length, 0);
});

test('removes player from queue on disconnect', () => {
  const lobby = new Lobby(() => {});
  const ws = mockWs();
  lobby.join(ws);
  ws.emit('close');
  assert.equal(lobby.queue.length, 0);
});
