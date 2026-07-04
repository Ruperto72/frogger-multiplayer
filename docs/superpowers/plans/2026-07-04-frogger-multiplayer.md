# Frogger Multiplayer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bygg ett realtids PvP-webbspel inspirerat av Frogger där två spelare kapplöper mot varandra på samma spelplan.

**Architecture:** Auktoritär Node.js/ws-server håller spelstaten och sänder ut den till klienter via WebSocket. Klienterna är ren HTML5 Canvas + vanilla JS och skickar bara knapptryckningar. Frontend hostas på GitHub Pages, backend på Render (gratis tier).

**Tech Stack:** Node.js 18+, `ws` npm-paket, HTML5 Canvas, vanilla JS (inga frontend-ramverk), `node:test` för backend-tester.

## Global Constraints

- Node.js 18+ (krävs för `node:test` och `node --test`)
- Enda npm-beroende i backend: `ws@^8`
- Noll npm-beroenden i frontend
- Alla spelpositioner är heltal (rutnätsceller); hinder har float-x för mjuk rendering
- Servern är alltid auktoritär — klienten skickar bara `{ type: "move", direction }` 
- WebSocket-protokoll: JSON-strängar, se spec för exakta meddelandeformat
- Spelplan: 13 kolumner (x: 0–12) × 15 rader (y: 0–14), y=0 är målet, y=14 är start

---

### Task 1: Backend scaffold

**Files:**
- Create: `backend/package.json`
- Create: `backend/constants.js`
- Create: `backend/server.js`
- Create: `backend/test/constants.test.js`

**Interfaces:**
- Produces: `require('./constants')` → `{ COLS, ROWS, GOAL_ROW, RIVER_ROWS, SAFE_ROWS, TRAFFIC_ROWS, SPAWN, LIVES, GOALS_TO_WIN_ROUND, ROUNDS_TO_WIN_MATCH, TICK_MS }`

- [ ] **Step 1: Skapa backend/package.json**

```json
{
  "name": "frogger-multiplayer-backend",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "test": "node --test test/"
  },
  "dependencies": {
    "ws": "^8.18.0"
  }
}
```

- [ ] **Step 2: Installera beroenden**

```bash
cd backend && npm install
```

Förväntat output: `added 1 package`

- [ ] **Step 3: Skapa backend/constants.js**

```javascript
const COLS = 13;
const ROWS = 15;
const GOAL_ROW = 0;
const RIVER_ROWS = new Set([1, 2, 3, 4, 5]);
const SAFE_ROWS = new Set([6, 13, 14]);
const TRAFFIC_ROWS = new Set([7, 8, 9, 10, 11, 12]);
const SPAWN = { p1: { x: 5, y: 14 }, p2: { x: 7, y: 14 } };
const LIVES = 3;
const GOALS_TO_WIN_ROUND = 3;
const ROUNDS_TO_WIN_MATCH = 3;
const TICK_MS = 100;

module.exports = {
  COLS, ROWS, GOAL_ROW, RIVER_ROWS, SAFE_ROWS,
  TRAFFIC_ROWS, SPAWN, LIVES, GOALS_TO_WIN_ROUND,
  ROUNDS_TO_WIN_MATCH, TICK_MS
};
```

- [ ] **Step 4: Skapa backend/server.js (minimal stub)**

```javascript
const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;

const server = http.createServer((_req, res) => {
  res.writeHead(200);
  res.end('Frogger Multiplayer');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (_ws) => {
  // Lobby wires in Task 2
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

- [ ] **Step 5: Skapa backend/test/constants.test.js**

```javascript
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
```

- [ ] **Step 6: Kör testerna**

```bash
cd backend && npm test
```

Förväntat: 4 passing

- [ ] **Step 7: Commit**

```bash
git add backend/
git commit -m "feat: backend scaffold with constants and HTTP/WS server"
```

---

### Task 2: Lobby & matchmaking

**Files:**
- Create: `backend/lobby.js`
- Modify: `backend/server.js`
- Create: `backend/test/lobby.test.js`

**Interfaces:**
- Consumes: inget från tidigare tasks
- Produces: `new Lobby(createRoom)` — `createRoom(ws1, ws2)` anropas när två spelare matchats; `lobby.join(ws)` för att köa en spelare

- [ ] **Step 1: Skriv failande tester**

Skapa `backend/test/lobby.test.js`:

```javascript
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
```

- [ ] **Step 2: Kör för att verifiera att de failar**

```bash
cd backend && npm test
```

Förväntat: `Cannot find module '../lobby'`

- [ ] **Step 3: Implementera backend/lobby.js**

```javascript
class Lobby {
  constructor(createRoom) {
    this.queue = [];
    this.createRoom = createRoom;
  }

  join(ws) {
    ws.send(JSON.stringify({ type: 'waiting' }));
    this.queue.push(ws);
    ws.on('close', () => this._leave(ws));
    if (this.queue.length >= 2) {
      const [ws1, ws2] = this.queue.splice(0, 2);
      this.createRoom(ws1, ws2);
    }
  }

  _leave(ws) {
    const idx = this.queue.indexOf(ws);
    if (idx !== -1) this.queue.splice(idx, 1);
  }
}

module.exports = Lobby;
```

- [ ] **Step 4: Koppla lobby till server.js**

Ersätt server.js med:

```javascript
const http = require('http');
const { WebSocketServer } = require('ws');
const Lobby = require('./lobby');

const PORT = process.env.PORT || 3000;

const server = http.createServer((_req, res) => {
  res.writeHead(200);
  res.end('Frogger Multiplayer');
});

const wss = new WebSocketServer({ server });
const lobby = new Lobby((ws1, ws2) => {
  const Room = require('./room');
  new Room(ws1, ws2);
});

wss.on('connection', (ws) => lobby.join(ws));

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

- [ ] **Step 5: Kör testerna**

```bash
cd backend && npm test
```

Förväntat: alla 7 tester passar (4 från task 1 + 4 från task 2, men ett test för room kan failar ännu)

- [ ] **Step 6: Commit**

```bash
git add backend/lobby.js backend/server.js backend/test/lobby.test.js
git commit -m "feat: lobby matchmaking queue"
```

---

### Task 3: Hindergenerering

**Files:**
- Create: `backend/gameloop.js`
- Create: `backend/test/gameloop.test.js`

**Interfaces:**
- Produces:
  - `generateLanes(seed: number) → Obstacle[]` — genererar hinder för alla körfält
  - `tickObstacles(obstacles: Obstacle[]) → void` — uppdaterar obstacle.x in-place
  - `Obstacle`: `{ lane: number, x: number, width: number, type: 'car'|'log', speed: number, dir: 1|-1 }`

- [ ] **Step 1: Skriv failande tester**

Skapa `backend/test/gameloop.test.js`:

```javascript
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

test('tickObstacles lindar stock vid vänster kant', () => {
  const obs = [{ lane: 2, x: 0.02, width: 3, type: 'log', speed: 0.1, dir: -1 }];
  tickObstacles(obs);
  assert.ok(obs[0].x > 10.0, `x borde vara > 10, var ${obs[0].x}`);
});
```

- [ ] **Step 2: Kör för att verifiera att de failar**

```bash
cd backend && npm test
```

Förväntat: `Cannot find module '../gameloop'`

- [ ] **Step 3: Implementera backend/gameloop.js**

```javascript
const { COLS } = require('./constants');

function seededRandom(seed) {
  let s = seed >>> 0;
  return function () {
    s += 0x6D2B79F5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateLanes(seed) {
  const rand = seededRandom(seed);
  const obstacles = [];

  const trafficRows = [7, 8, 9, 10, 11, 12];
  const riverRows   = [1, 2, 3, 4, 5];

  for (const lane of trafficRows) {
    const dir   = rand() > 0.5 ? 1 : -1;
    const speed = 0.04 + rand() * 0.06;
    const count = 2 + Math.floor(rand() * 2);
    for (let i = 0; i < count; i++) {
      obstacles.push({
        lane,
        x: (COLS / count) * i + rand() * 1.5,
        width: 1 + Math.floor(rand() * 2),
        type: 'car',
        speed,
        dir
      });
    }
  }

  for (const lane of riverRows) {
    const dir   = rand() > 0.5 ? 1 : -1;
    const speed = 0.03 + rand() * 0.04;
    const count = 2 + Math.floor(rand() * 2);
    for (let i = 0; i < count; i++) {
      obstacles.push({
        lane,
        x: (COLS / count) * i + rand() * 1.5,
        width: 2 + Math.floor(rand() * 2),
        type: 'log',
        speed,
        dir
      });
    }
  }

  return obstacles;
}

function tickObstacles(obstacles) {
  for (const obs of obstacles) {
    obs.x += obs.speed * obs.dir;
    if (obs.x >= COLS)         obs.x -= COLS;
    if (obs.x < -obs.width)    obs.x += COLS;
  }
}

module.exports = { generateLanes, tickObstacles };
```

- [ ] **Step 4: Kör testerna**

```bash
cd backend && npm test
```

Förväntat: alla 7 gameloop-tester passar

- [ ] **Step 5: Commit**

```bash
git add backend/gameloop.js backend/test/gameloop.test.js
git commit -m "feat: obstacle generation and tick"
```

---

### Task 4: Kollisionshjälpare

**Files:**
- Create: `backend/collision.js`
- Create: `backend/test/collision.test.js`

**Interfaces:**
- Produces:
  - `obstacleCoversCell(obs, cellX) → boolean`
  - `isHazardous(obstacles, x, y) → boolean` — true om spelare på (x,y) är i fara
  - `isSafeInRiver(obstacles, x, y) → boolean` — true om spelare står på en stock

- [ ] **Step 1: Skriv failande tester**

Skapa `backend/test/collision.test.js`:

```javascript
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
```

- [ ] **Step 2: Kör för att verifiera att de failar**

```bash
cd backend && npm test
```

Förväntat: `Cannot find module '../collision'`

- [ ] **Step 3: Implementera backend/collision.js**

```javascript
const { COLS, RIVER_ROWS, TRAFFIC_ROWS } = require('./constants');

function obstacleCoversCell(obs, cellX) {
  const left = Math.floor(((obs.x % COLS) + COLS) % COLS);
  for (let i = 0; i < obs.width; i++) {
    if ((left + i) % COLS === cellX) return true;
  }
  return false;
}

function isSafeInRiver(obstacles, x, y) {
  return obstacles.some(
    o => o.lane === y && o.type === 'log' && obstacleCoversCell(o, x)
  );
}

function hitByCar(obstacles, x, y) {
  return obstacles.some(
    o => o.lane === y && o.type === 'car' && obstacleCoversCell(o, x)
  );
}

function isHazardous(obstacles, x, y) {
  if (TRAFFIC_ROWS.has(y)) return hitByCar(obstacles, x, y);
  if (RIVER_ROWS.has(y))   return !isSafeInRiver(obstacles, x, y);
  return false;
}

module.exports = { obstacleCoversCell, isSafeInRiver, hitByCar, isHazardous };
```

- [ ] **Step 4: Kör testerna**

```bash
cd backend && npm test
```

Förväntat: alla 8 collision-tester passar

- [ ] **Step 5: Commit**

```bash
git add backend/collision.js backend/test/collision.test.js
git commit -m "feat: pure collision detection helpers"
```

---

### Task 5: Room — spellogik (rörelse, kollision, mål, stöt)

**Files:**
- Create: `backend/room.js`
- Create: `backend/test/room.test.js`

**Interfaces:**
- Consumes: `constants`, `gameloop.generateLanes`, `gameloop.tickObstacles`, `collision.isHazardous`
- Produces: `new Room(ws1, ws2)` — startar match, hanterar meddelanden, broadcastar state

- [ ] **Step 1: Skriv failande tester**

Skapa `backend/test/room.test.js`:

```javascript
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
```

- [ ] **Step 2: Kör för att verifiera att de failar**

```bash
cd backend && npm test
```

Förväntat: `Cannot find module '../room'`

- [ ] **Step 3: Implementera backend/room.js**

```javascript
const { COLS, ROWS, GOAL_ROW, SPAWN, LIVES, GOALS_TO_WIN_ROUND, ROUNDS_TO_WIN_MATCH, TICK_MS } = require('./constants');
const { generateLanes, tickObstacles } = require('./gameloop');
const { isHazardous } = require('./collision');

const DIRS = {
  up:    { dx:  0, dy: -1 },
  down:  { dx:  0, dy:  1 },
  left:  { dx: -1, dy:  0 },
  right: { dx:  1, dy:  0 }
};

class Room {
  constructor(ws1, ws2) {
    this.sockets = { p1: ws1, p2: ws2 };
    this.state = this._initialState();
    this._attachHandlers();
    this._tick = setInterval(() => this._onTick(), TICK_MS);
    this._send('p1', { type: 'match_start', you: 'p1' });
    this._send('p2', { type: 'match_start', you: 'p2' });
    this._broadcast();
  }

  _initialState() {
    return {
      players: {
        p1: { ...SPAWN.p1, lives: LIVES, score: 0 },
        p2: { ...SPAWN.p2, lives: LIVES, score: 0 }
      },
      obstacles: generateLanes(Date.now()),
      round: 1,
      roundScores: { p1: 0, p2: 0 },
      phase: 'playing'
    };
  }

  _attachHandlers() {
    for (const [pid, ws] of Object.entries(this.sockets)) {
      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data);
          if (msg.type === 'move' && this.state.phase === 'playing') {
            this.handleMove(pid, msg.direction);
          }
        } catch {}
      });
      ws.on('close', () => this._onDisconnect());
    }
  }

  handleMove(pid, direction) {
    if (!DIRS[direction]) return;
    const p = this.state.players[pid];
    const { dx, dy } = DIRS[direction];
    const nx = p.x + dx;
    const ny = p.y + dy;
    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) return;

    const otherId = pid === 'p1' ? 'p2' : 'p1';
    const other = this.state.players[otherId];
    if (other.x === nx && other.y === ny) {
      this._applyBump(otherId, dx, dy);
    }

    p.x = nx;
    p.y = ny;
    this._checkHazard(pid);
    this._checkGoal(pid);
    this._broadcast();
  }

  _applyBump(pid, dx, dy) {
    const p = this.state.players[pid];
    const bx = p.x - dx;
    const by = p.y - dy;
    if (bx < 0 || bx >= COLS || by < 0 || by >= ROWS || isHazardous(this.state.obstacles, bx, by)) {
      this._respawn(pid, false);
    } else {
      p.x = bx;
      p.y = by;
    }
  }

  _checkHazard(pid) {
    const p = this.state.players[pid];
    if (isHazardous(this.state.obstacles, p.x, p.y)) {
      this._kill(pid);
    }
  }

  _checkGoal(pid) {
    const p = this.state.players[pid];
    if (p.y !== GOAL_ROW) return;
    p.score++;
    this._respawn(pid, false);
    if (p.score >= GOALS_TO_WIN_ROUND) this._endRound(pid);
  }

  _kill(pid) {
    this._respawn(pid, true);
    if (this.state.players[pid].lives <= 0) {
      this._endRound(pid === 'p1' ? 'p2' : 'p1');
    }
  }

  _respawn(pid, loseLife) {
    const p = this.state.players[pid];
    if (loseLife) p.lives--;
    p.x = SPAWN[pid].x;
    p.y = SPAWN[pid].y;
  }

  _endRound(winnerId) {
    this.state.roundScores[winnerId]++;
    this.state.phase = 'round_over';
    this._broadcastEvent('round_over', { winner: winnerId });
    if (this.state.roundScores[winnerId] >= ROUNDS_TO_WIN_MATCH) {
      this._endMatch(winnerId);
    } else {
      setTimeout(() => this._startNewRound(), 3000);
    }
  }

  _endMatch(winnerId) {
    this.state.phase = 'match_over';
    this._broadcastEvent('match_over', {
      winner: winnerId,
      score: [this.state.roundScores.p1, this.state.roundScores.p2]
    });
    clearInterval(this._tick);
  }

  _startNewRound() {
    this.state.round++;
    this.state.obstacles = generateLanes(Date.now());
    this.state.players.p1 = { ...SPAWN.p1, lives: LIVES, score: 0 };
    this.state.players.p2 = { ...SPAWN.p2, lives: LIVES, score: 0 };
    this.state.phase = 'playing';
    this._broadcast();
  }

  _onTick() {
    if (this.state.phase !== 'playing') return;
    tickObstacles(this.state.obstacles);
    for (const pid of ['p1', 'p2']) this._checkHazard(pid);
    this._broadcast();
  }

  _onDisconnect() {
    clearInterval(this._tick);
    this.state.phase = 'match_over';
    this._broadcastEvent('opponent_disconnected', {});
  }

  _broadcast() {
    const msg = JSON.stringify({ type: 'state', ...this.state });
    for (const ws of Object.values(this.sockets)) {
      if (ws.readyState === 1) ws.send(msg);
    }
  }

  _broadcastEvent(event, data) {
    const msg = JSON.stringify({ type: 'event', event, ...data });
    for (const ws of Object.values(this.sockets)) {
      if (ws.readyState === 1) ws.send(msg);
    }
  }

  _send(pid, data) {
    const ws = this.sockets[pid];
    if (ws.readyState === 1) ws.send(JSON.stringify(data));
  }
}

module.exports = Room;
```

- [ ] **Step 4: Kör testerna**

```bash
cd backend && npm test
```

Förväntat: alla room-tester passar

- [ ] **Step 5: Manuellt integrations-rök-test**

```bash
cd backend && node server.js
```

Öppna två browser-flikar mot `ws://localhost:3000` med DevTools WebSocket-verktyg eller ett enkelt test-skript. Verifiera att båda får `match_start`.

- [ ] **Step 6: Commit**

```bash
git add backend/room.js backend/test/room.test.js
git commit -m "feat: room with movement, collision, goal, and bump mechanics"
```

---

### Task 6: Frontend scaffold

**Files:**
- Create: `frontend/index.html`
- Create: `frontend/style.css`
- Create: `frontend/js/main.js`

**Interfaces:**
- Produces: en webbsida med ett `<canvas id="game">` som fyller skärmen och en grundläggande layout

- [ ] **Step 1: Skapa frontend/index.html**

```html
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Frogger Multiplayer</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div id="overlay" class="overlay hidden"></div>
  <canvas id="game"></canvas>
  <script src="js/main.js" type="module"></script>
</body>
</html>
```

- [ ] **Step 2: Skapa frontend/style.css**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  background: #111;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  overflow: hidden;
}

canvas {
  display: block;
  image-rendering: pixelated;
}

.overlay {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  font-family: monospace;
  font-size: 2rem;
  gap: 1rem;
  z-index: 10;
}

.overlay.hidden { display: none; }

.overlay p { font-size: 1rem; color: #aaa; }
```

- [ ] **Step 3: Skapa frontend/js/main.js**

```javascript
import { Net } from './net.js';
import { Input } from './input.js';
import { GameState } from './game.js';
import { Renderer } from './renderer.js';

const CELL = 48;
const COLS = 13;
const ROWS = 15;

const canvas = document.getElementById('game');
canvas.width  = COLS * CELL;
canvas.height = ROWS * CELL;

const state    = new GameState();
const renderer = new Renderer(canvas, CELL, COLS, ROWS);
const net      = new Net(state);
const input    = new Input(net);

function loop() {
  renderer.draw(state);
  requestAnimationFrame(loop);
}
loop();
```

- [ ] **Step 4: Öppna i webbläsare och verifiera**

Starta en lokal filserver (t.ex. `npx serve frontend` eller Python `python -m http.server 8080 -d frontend`) och öppna i webbläsaren. Förväntat: svart canvas utan JavaScript-fel (modulerna saknas ännu — det är ok, de läggs till i kommande tasks).

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "feat: frontend scaffold with canvas and layout"
```

---

### Task 7: WebSocket-klient (net.js)

**Files:**
- Create: `frontend/js/net.js`

**Interfaces:**
- Consumes: `GameState` (från game.js, Task 8) via `state.applyMessage(msg)`
- Produces: `new Net(state)` — ansluter till backend; `net.send(obj)` — skickar meddelande

- [ ] **Step 1: Skapa frontend/js/net.js**

```javascript
export class Net {
  constructor(state) {
    this.state = state;
    this._ws = null;
    this._connect();
  }

  _connect() {
    const url = location.hostname === 'localhost'
      ? 'ws://localhost:3000'
      : 'wss://frogger-backend.onrender.com'; // ersätt med din Render-URL

    this._ws = new WebSocket(url);

    this._ws.addEventListener('open', () => {
      console.log('Ansluten till server');
    });

    this._ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      this.state.applyMessage(msg);
    });

    this._ws.addEventListener('close', () => {
      console.log('Frånkopplad — försöker igen om 3s');
      setTimeout(() => this._connect(), 3000);
    });
  }

  send(obj) {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(obj));
    }
  }
}
```

- [ ] **Step 2: Verifiera manuellt**

Starta backend (`node backend/server.js`) och öppna frontend i webbläsaren. I DevTools Console ska du se "Ansluten till server". I Network-fliken → WS ska du se ett öppet WebSocket-flöde. Öppna en till flik och se att båda får `match_start`.

- [ ] **Step 3: Commit**

```bash
git add frontend/js/net.js
git commit -m "feat: WebSocket client with auto-reconnect"
```

---

### Task 8: Tangentbordsinput (input.js)

**Files:**
- Create: `frontend/js/input.js`

**Interfaces:**
- Consumes: `net.send(obj)`
- Produces: `new Input(net)` — lyssnar på tangentbord och skickar move-meddelanden

- [ ] **Step 1: Skapa frontend/js/input.js**

```javascript
const KEY_MAP = {
  ArrowUp:    'up',
  ArrowDown:  'down',
  ArrowLeft:  'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right'
};

export class Input {
  constructor(net) {
    this._net = net;
    window.addEventListener('keydown', (e) => {
      const dir = KEY_MAP[e.code];
      if (dir) {
        e.preventDefault();
        this._net.send({ type: 'move', direction: dir });
      }
    });
  }
}
```

- [ ] **Step 2: Verifiera manuellt**

Med backend igång och frontend öppen i webbläsaren: tryck piltangenterna och verifiera i Network → WS att `{ "type": "move", "direction": "up" }` skickas. Verifiera i backend-konsolen (lägg till `console.log` temporärt i room.js handleMove) att servern tar emot.

- [ ] **Step 3: Commit**

```bash
git add frontend/js/input.js
git commit -m "feat: keyboard input handler (arrows + WASD)"
```

---

### Task 9: Klient-spelstate (game.js)

**Files:**
- Create: `frontend/js/game.js`

**Interfaces:**
- Produces: `new GameState()` med:
  - `state.applyMessage(msg)` — tolkar inkommande server-meddelanden
  - `state.phase` — 'waiting' | 'playing' | 'round_over' | 'match_over'
  - `state.players` — `{ p1: {x,y,lives,score}, p2: {x,y,lives,score} }`
  - `state.obstacles` — array av obstacle-objekt med interpolerad float-x
  - `state.you` — 'p1' | 'p2' | null
  - `state.round`, `state.roundScores`, `state.lastEvent`

- [ ] **Step 1: Skapa frontend/js/game.js**

```javascript
export class GameState {
  constructor() {
    this.phase       = 'waiting';
    this.you         = null;
    this.players     = { p1: null, p2: null };
    this.obstacles   = [];
    this.round       = 1;
    this.roundScores = { p1: 0, p2: 0 };
    this.lastEvent   = null;
  }

  applyMessage(msg) {
    if (msg.type === 'waiting') {
      this.phase = 'waiting';
    } else if (msg.type === 'match_start') {
      this.you   = msg.you;
      this.phase = 'playing';
    } else if (msg.type === 'state') {
      this.players     = msg.players;
      this.obstacles   = msg.obstacles;
      this.round       = msg.round;
      this.roundScores = msg.roundScores ?? this.roundScores;
      this.phase       = msg.phase;
    } else if (msg.type === 'event') {
      this.lastEvent = msg;
      if (msg.event === 'round_over')  this.phase = 'round_over';
      if (msg.event === 'match_over')  this.phase = 'match_over';
      if (msg.event === 'opponent_disconnected') this.phase = 'disconnected';
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/js/game.js
git commit -m "feat: client-side game state from server messages"
```

---

### Task 10: Canvas-renderer (renderer.js)

**Files:**
- Create: `frontend/js/renderer.js`

**Interfaces:**
- Consumes: `GameState` (read-only)
- Produces: `new Renderer(canvas, cellSize, cols, rows)` med `renderer.draw(state)`

**Färgschema:**
- Bakgrund startzon: `#4a3728`
- Trafikzon: `#555`
- Mittzon (säker): `#3a5a28`
- Flodzon: `#1a3a6a`
- Målrad: `#2a4a18`
- Bil: `#e44`
- Stock: `#8b5e3c`
- Spelare p1 (du): `#0f0`
- Spelare p2 (motspelaren): `#ff0`

- [ ] **Step 1: Skapa frontend/js/renderer.js**

```javascript
const ZONE_COLORS = {
  goal:    '#2a4a18',
  river:   '#1a3a6a',
  safe:    '#3a5a28',
  traffic: '#555555',
  start:   '#4a3728'
};

function zoneColor(row) {
  if (row === 0)                          return ZONE_COLORS.goal;
  if (row >= 1 && row <= 5)              return ZONE_COLORS.river;
  if (row === 6)                          return ZONE_COLORS.safe;
  if (row >= 7 && row <= 12)             return ZONE_COLORS.traffic;
  return ZONE_COLORS.start;
}

export class Renderer {
  constructor(canvas, cell, cols, rows) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.cell   = cell;
    this.cols   = cols;
    this.rows   = rows;
  }

  draw(state) {
    const { ctx, cell, cols, rows } = this;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this._drawBoard();
    if (state.phase === 'waiting' || !state.players.p1) {
      this._drawOverlay('Väntar på motspelare…', '');
      return;
    }
    this._drawObstacles(state.obstacles);
    this._drawPlayers(state);
    this._drawHUD(state);
    if (state.phase === 'round_over') {
      const w = state.lastEvent?.winner;
      const you = state.you;
      this._drawOverlay(
        w === you ? 'Du vann rundan! 🐸' : 'Motspelaren vann rundan',
        'Nästa runda startar…'
      );
    }
    if (state.phase === 'match_over') {
      const w = state.lastEvent?.winner;
      const you = state.you;
      this._drawOverlay(
        w === you ? 'Du vann matchen! 🏆' : 'Motspelaren vann matchen',
        `Resultat: ${state.lastEvent?.score?.join(' – ') ?? ''}`
      );
    }
    if (state.phase === 'disconnected') {
      this._drawOverlay('Motspelaren kopplade från', 'Ladda om sidan för ny match');
    }
  }

  _drawBoard() {
    const { ctx, cell, cols, rows } = this;
    for (let row = 0; row < rows; row++) {
      ctx.fillStyle = zoneColor(row);
      ctx.fillRect(0, row * cell, cols * cell, cell);
    }
    // Målplatser
    ctx.fillStyle = '#4a8a28';
    for (const gx of [1, 3, 5, 7, 9]) {
      ctx.fillRect(gx * cell + 4, 4, cell - 8, cell - 8);
    }
  }

  _drawObstacles(obstacles) {
    const { ctx, cell } = this;
    for (const obs of obstacles) {
      ctx.fillStyle = obs.type === 'car' ? '#cc3333' : '#8b5e3c';
      const px = ((obs.x % this.cols) + this.cols) % this.cols;
      const x  = px * cell;
      const y  = obs.lane * cell + 4;
      const w  = obs.width * cell - 4;
      const h  = cell - 8;
      ctx.fillRect(x, y, w, h);
      // Lindning: om hindret går utanför höger kant
      if (x + w > this.cols * cell) {
        ctx.fillRect(x - this.cols * cell, y, w, h);
      }
    }
  }

  _drawPlayers(state) {
    const { ctx, cell } = this;
    const colors = { p1: '#00ff00', p2: '#ffff00' };
    for (const [pid, p] of Object.entries(state.players)) {
      if (!p) continue;
      ctx.fillStyle = pid === state.you ? '#00ff88' : colors[pid];
      ctx.beginPath();
      ctx.arc(
        p.x * cell + cell / 2,
        p.y * cell + cell / 2,
        cell / 2 - 4, 0, Math.PI * 2
      );
      ctx.fill();
      // Liten etikett
      ctx.fillStyle = '#000';
      ctx.font = `bold ${cell * 0.4}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pid === state.you ? 'DU' : pid.toUpperCase(),
        p.x * cell + cell / 2, p.y * cell + cell / 2);
    }
  }

  _drawHUD(state) {
    const { ctx, cols, cell } = this;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, cols * cell, 32);
    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const you   = state.you;
    const other = you === 'p1' ? 'p2' : 'p1';
    const pYou   = state.players[you];
    const pOther = state.players[other];
    if (pYou && pOther) {
      ctx.fillText(
        `Runda ${state.round}  |  Du: ♥${pYou.lives}  Mål:${pYou.score}  |  Motst: ♥${pOther.lives}  Mål:${pOther.score}  |  Match: ${state.roundScores[you]}–${state.roundScores[other]}`,
        8, 16
      );
    }
  }

  _drawOverlay(title, subtitle) {
    const { ctx, canvas } = this;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 20);
    ctx.fillStyle = '#aaa';
    ctx.font = '18px monospace';
    ctx.fillText(subtitle, canvas.width / 2, canvas.height / 2 + 20);
  }
}
```

- [ ] **Step 2: Verifiera manuellt**

Starta backend + frontend. Öppna i två flikar. Verifiera:
- Spelplanen ritas med rätt zonfärger (grön mittzon, blå flod, grå trafik)
- Två grodor syns, en grön (du) och en gul (motspelaren)
- Bilar och stockar rör sig
- HUD visar liv, poäng och matchresultat

- [ ] **Step 3: Commit**

```bash
git add frontend/js/renderer.js
git commit -m "feat: canvas renderer with board, obstacles, players and HUD"
```

---

### Task 11: Deployment

**Files:**
- Create: `.github/workflows/deploy.yml`
- Create: `backend/render.yaml`

**Interfaces:**
- Produces: frontend automatiskt deployas till GitHub Pages vid push till `master`; backend deployas till Render

- [ ] **Step 1: Uppdatera WS-URL i net.js**

Öppna `frontend/js/net.js` och ersätt `'wss://frogger-backend.onrender.com'` med din faktiska Render-URL (du hittar den i Render-dashboarden efter att backend är deplorad).

- [ ] **Step 2: Skapa .github/workflows/deploy.yml**

```yaml
name: Deploy Frontend to GitHub Pages

on:
  push:
    branches: [master]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: frontend/
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Skapa backend/render.yaml**

```yaml
services:
  - type: web
    name: frogger-backend
    runtime: node
    rootDir: backend
    buildCommand: npm install
    startCommand: node server.js
    envVars:
      - key: NODE_ENV
        value: production
```

- [ ] **Step 4: Skapa GitHub-repo och pusha**

```bash
git remote add origin https://github.com/<ditt-användarnamn>/frogger-multiplayer.git
git push -u origin master
```

- [ ] **Step 5: Aktivera GitHub Pages**

Gå till repo Settings → Pages → Source: välj "GitHub Actions". Nästa push triggar deployment.

- [ ] **Step 6: Deploya backend till Render**

- Gå till render.com → New → Web Service
- Koppla ditt GitHub-repo
- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `node server.js`
- Klicka Deploy

- [ ] **Step 7: Verifiera end-to-end**

Öppna GitHub Pages-URL i två webbläsarflikar. Spela ett par rundor och verifiera att matchmaking, spellogik och round/match-avslut fungerar korrekt.

- [ ] **Step 8: Commit deploymentfiler**

```bash
git add .github/ backend/render.yaml
git commit -m "feat: GitHub Actions deploy + Render config"
git push
```

---

## Spec coverage check

| Specsektion | Täckt av |
|---|---|
| Kapplöpningsformat, samma spelplan | Task 5 (Room), Task 10 (Renderer) |
| Bäst av 5 rundor | Task 5 (\_endRound, ROUNDS\_TO\_WIN\_MATCH=3) |
| 3 mål vinner runda | Task 5 (GOALS\_TO\_WIN\_ROUND) |
| 3 liv per runda, återställs | Task 5 (\_startNewRound) |
| Öppen lobby/matchmaking | Task 2 (Lobby) |
| Klassisk Frogger-bana 13×15 | Task 1 (constants) |
| Trafikzon, flodzon, mittzon, startzon | Task 3 (gameloop), Task 4 (collision) |
| Hinder med float-x och lindning | Task 3, Task 10 |
| Stöt-mekanik med studs bakåt | Task 5 (\_applyBump) |
| Respawn vid farlig studsruta, inget liv förlorat | Task 5 (\_applyBump) |
| Disconnect hanteras | Task 5 (\_onDisconnect) |
| GitHub Pages frontend | Task 11 |
| Render backend (gratis) | Task 11 |
| Nätverksprotokoll (JSON/WS) | Task 7 (net.js), Task 5 (\_broadcast) |
