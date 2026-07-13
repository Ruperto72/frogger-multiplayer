# Slumpat djur vid matchstart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** När båda spelarna i en match är redo slumpar servern vem som blir
groda och vem som blir padda (istället för att det alltid är p1=groda,
p2=padda); färgväljaren (grön/gul/blå) tas bort helt eftersom den inte
längre fyller någon funktion.

**Architecture:** Ett nytt fält `animal` (`'frog'|'toad'|null`) läggs på
varje spelarobjekt i `Room.state.players` (backend), slumpat i samma
ögonblick fasen flippar till `countdown`. Frontend slutar räkna ut djur från
`pid` och läser istället det serverbestämda `p.animal`. Färgväljar-UI:t och
`skin`-fältet tas bort ur hela stacken (HTML, CSS, JS, nätverksprotokoll,
tester).

**Tech Stack:** Oförändrat — Node.js/ws backend, vanilla ES6-moduler i
frontend, `node --test` för backend-testsviten.

## Global Constraints

- Slumpningen sker i `_handleReady()` i `backend/room.js`, exakt när båda
  spelare blivit redo — inte tidigare, inte per runda.
- Djuret bevaras genom alla rundor i en match (via `_startNewRound()`),
  slumpas om för nästa match (ny `Room`-instans).
- Standardnamnet (tomt namnfält) matchar det tilldelade djuret ("Frog" om
  groda, "Toad" om padda) — sätts först när djuret slumpas, inte när
  spelaren individuellt klickar redo.
- `Math.random()` används för slumpningen (inte den seedade
  `mulberry32`-PRNG:n som hindren använder) — resultatet är serverns, aldrig
  klientberäknat.
- Ingen ny UI-text läggs till för djur-avslöjande — spelaren ser bara sin
  sprite på spelplanen, som idag.
- Färgväljaren tas bort helt: HTML-markup, CSS, JS-logik i
  start-ui.js/lobby-ui.js/tournament-ui.js, `skin`-fältet i
  `ready`/`create_tournament`/`join_tournament`-meddelandena, och
  `skin.green`/`skin.yellow`/`skin.blue` ur `i18n.js` (båda språken).
- Ingen ändring av spelmekanik (hinder, kollisioner, poäng, liv,
  turneringsträd/walkover-logik, PWA/deploy).

---

### Task 1: Backend — slumpa djur vid matchstart

**Files:**
- Modify: `backend/constants.js`
- Modify: `backend/room.js`
- Modify: `backend/tournament.js` (upptäckt under implementation: importerar
  `SKINS`/`DEFAULT_SKIN` och tar `skin` som positionsargument i `join()` —
  måste tas bort i samma svep, annars kraschar hela turneringsflödet när
  konstanterna försvinner)
- Modify: `backend/manager.js` (anropar `tournament.join(ws, name, skin,
  isHost)` — måste följa tournament.js:s nya signatur `join(ws, name,
  isHost)`, annars hamnar `isHost` på fel argumentposition och
  värdflaggan går sönder tyst)
- Modify: `backend/test/manager.test.js` (städning: tar bort overksamt
  `skin`-fält ur options-objekten, inte blockerande men stale annars)
- Modify: `backend/e2e-test.js` (städning: fristående manuellt skript,
  körs inte av `node --test`, men skickar `skin` i meddelanden som
  numera ignoreras tyst — tas bort för konsekvens)
- Test: `backend/test/room.test.js`
- Test: `backend/test/constants.test.js`
- Test: `backend/test/tournament.test.js` (tre `.join()`-anrop skickar
  `'green'` som tredje positionsargument — måste tas bort, annars blir
  det av misstag `isHost` efter signaturändringen)

**Interfaces:**
- Produces: `Room.state.players[pid].animal` (`'frog'|'toad'|null`),
  `constants.DEFAULT_ANIMAL_NAMES` (`{ frog: 'Frog', toad: 'Toad' }`) — Task
  2 (frontend rendering) läser `players[pid].animal` från state-broadcasten.

- [ ] **Step 1: Skriv failande test för nya konstanten**

I `backend/test/constants.test.js`, ersätt:

```js
test('DEFAULT_NAMES är Frog/Toad', () => {
  assert.equal(C.DEFAULT_NAMES.p1, 'Frog');
  assert.equal(C.DEFAULT_NAMES.p2, 'Toad');
});
```

med:

```js
test('DEFAULT_ANIMAL_NAMES är Frog/Toad', () => {
  assert.equal(C.DEFAULT_ANIMAL_NAMES.frog, 'Frog');
  assert.equal(C.DEFAULT_ANIMAL_NAMES.toad, 'Toad');
});
```

- [ ] **Step 2: Kör testet, verifiera att det failar**

Run: `cd backend && node --test test/constants.test.js`
Expected: FAIL — `C.DEFAULT_ANIMAL_NAMES` är `undefined`
(`TypeError: Cannot read properties of undefined`).

- [ ] **Step 3: Uppdatera constants.js**

I `backend/constants.js`, ersätt:

```js
const SKINS = ['green', 'yellow', 'blue'];
const DEFAULT_SKIN = 'green';
const DEFAULT_NAMES = { p1: 'Frog', p2: 'Toad' };
const NAME_MAX_LEN = 20;
const COUNTDOWN_MS = 3000;

module.exports = {
  COLS, ROWS, GOAL_ROW, GOAL_COLS, RIVER_ROWS, SAFE_ROWS,
  TRAFFIC_ROWS, SPAWN, LIVES, GOALS_TO_WIN_ROUND,
  ROUNDS_TO_WIN_MATCH, TICK_MS, SKINS, DEFAULT_SKIN,
  DEFAULT_NAMES, NAME_MAX_LEN, COUNTDOWN_MS
};
```

med:

```js
const DEFAULT_ANIMAL_NAMES = { frog: 'Frog', toad: 'Toad' };
const NAME_MAX_LEN = 20;
const COUNTDOWN_MS = 3000;

module.exports = {
  COLS, ROWS, GOAL_ROW, GOAL_COLS, RIVER_ROWS, SAFE_ROWS,
  TRAFFIC_ROWS, SPAWN, LIVES, GOALS_TO_WIN_ROUND,
  ROUNDS_TO_WIN_MATCH, TICK_MS, DEFAULT_ANIMAL_NAMES,
  NAME_MAX_LEN, COUNTDOWN_MS
};
```

- [ ] **Step 4: Kör testet igen, verifiera att det passerar**

Run: `cd backend && node --test test/constants.test.js`
Expected: PASS — alla tester i filen gröna.

- [ ] **Step 5: Skriv failande tester för slumpningen i room.js**

I `backend/test/room.test.js`, ersätt `sendReady`-hjälpfunktionen:

```js
function sendReady(ws, over = {}) {
  ws.emit('message', JSON.stringify({ type: 'ready', name: 'Testare', skin: 'green', ...over }));
}
```

med:

```js
function sendReady(ws, over = {}) {
  ws.emit('message', JSON.stringify({ type: 'ready', name: 'Testare', ...over }));
}
```

Ersätt testet `'rum startar i lobby-fas med defaultnamn och ready=false'`:

```js
test('rum startar i lobby-fas med defaultnamn och ready=false', () => {
  const { room } = makeLobby();
  assert.equal(room.state.phase, 'lobby');
  assert.equal(room.state.players.p1.name, 'Frog');
  assert.equal(room.state.players.p2.name, 'Toad');
  assert.equal(room.state.players.p1.ready, false);
  assert.equal(room.state.players.p2.ready, false);
});
```

med:

```js
test('rum startar i lobby-fas med tomt namn, inget djur och ready=false', () => {
  const { room } = makeLobby();
  assert.equal(room.state.phase, 'lobby');
  assert.equal(room.state.players.p1.name, '');
  assert.equal(room.state.players.p2.name, '');
  assert.equal(room.state.players.p1.animal, null);
  assert.equal(room.state.players.p2.animal, null);
  assert.equal(room.state.players.p1.ready, false);
  assert.equal(room.state.players.p2.ready, false);
});
```

Ersätt testet `'ready sätter namn, skin och ready-flagga'`:

```js
test('ready sätter namn, skin och ready-flagga', () => {
  const { room, ws1 } = makeLobby();
  sendReady(ws1, { name: 'Robert', skin: 'blue' });
  assert.equal(room.state.players.p1.name, 'Robert');
  assert.equal(room.state.players.p1.skin, 'blue');
  assert.equal(room.state.players.p1.ready, true);
  assert.equal(lastState(ws1).players.p1.ready, true); // broadcastas
});
```

med:

```js
test('ready sätter namn och ready-flagga (djur tilldelas inte förrän båda är redo)', () => {
  const { room, ws1 } = makeLobby();
  sendReady(ws1, { name: 'Robert' });
  assert.equal(room.state.players.p1.name, 'Robert');
  assert.equal(room.state.players.p1.animal, null);
  assert.equal(room.state.players.p1.ready, true);
  assert.equal(lastState(ws1).players.p1.ready, true); // broadcastas
});
```

Ersätt testet `'tomt namn ger defaultnamn'`:

```js
test('tomt namn ger defaultnamn', () => {
  const { room, ws1 } = makeLobby();
  sendReady(ws1, { name: '   ' });
  assert.equal(room.state.players.p1.name, 'Frog');
});
```

med:

```js
test('tomt namn faller tillbaka på tilldelat djurs namn när båda är redo', (t) => {
  t.mock.method(Math, 'random', () => 0.1); // ger p1=frog, p2=toad (se nästa test)
  const { room, ws1, ws2 } = makeLobby();
  sendReady(ws1, { name: '   ' });
  sendReady(ws2, { name: '' });
  assert.equal(room.state.players.p1.name, 'Frog');
  assert.equal(room.state.players.p2.name, 'Toad');
});
```

Ta bort testet `'ogiltig skin faller tillbaka på green'` helt (rader 215-219
i nuvarande fil) — det finns inget `skin`-fält kvar att validera.

Lägg till tre nya tester direkt efter testet `'båda redo ger countdown-event
och fas countdown'`:

```js
test('slumpning: Math.random < 0.5 ger p1=frog, p2=toad', (t) => {
  t.mock.method(Math, 'random', () => 0.1);
  const { room, ws1, ws2 } = makeLobby();
  sendReady(ws1);
  sendReady(ws2);
  assert.equal(room.state.players.p1.animal, 'frog');
  assert.equal(room.state.players.p2.animal, 'toad');
});

test('slumpning: Math.random >= 0.5 ger p1=toad, p2=frog', (t) => {
  t.mock.method(Math, 'random', () => 0.9);
  const { room, ws1, ws2 } = makeLobby();
  sendReady(ws1);
  sendReady(ws2);
  assert.equal(room.state.players.p1.animal, 'toad');
  assert.equal(room.state.players.p2.animal, 'frog');
});

test('djuren är alltid olika — aldrig två grodor eller två paddor', (t) => {
  for (const r of [0, 0.25, 0.49, 0.5, 0.75, 0.99]) {
    t.mock.method(Math, 'random', () => r);
    const { room, ws1, ws2 } = makeLobby();
    sendReady(ws1);
    sendReady(ws2);
    assert.notEqual(room.state.players.p1.animal, room.state.players.p2.animal);
  }
});
```

Ersätt testet `'ready ignoreras under pågående spel'`:

```js
test('ready ignoreras under pågående spel', () => {
  const { room, ws1 } = makeRoom();
  sendReady(ws1, { name: 'Fuskare' });
  assert.equal(room.state.players.p1.name, 'Frog');
});
```

med:

```js
test('ready ignoreras under pågående spel', () => {
  const { room, ws1 } = makeRoom();
  sendReady(ws1, { name: 'Fuskare' });
  assert.equal(room.state.players.p1.name, '');
});
```

Ersätt testet `'namn och skin bevaras vid ny runda'`:

```js
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
```

med:

```js
test('namn och djur bevaras vid ny runda', (t) => {
  t.mock.method(Math, 'random', () => 0.1); // p1=frog, p2=toad
  const { room, ws1, ws2 } = makeLobby();
  sendReady(ws1, { name: 'Anna' });
  sendReady(ws2, { name: 'Bertil' });
  room.state.phase = 'playing';
  room._startNewRound();
  assert.equal(room.state.players.p1.name, 'Anna');
  assert.equal(room.state.players.p1.animal, 'frog');
  assert.equal(room.state.players.p2.name, 'Bertil');
  assert.equal(room.state.players.p2.animal, 'toad');
});
```

- [ ] **Step 6: Kör testerna, verifiera att de failar**

Run: `cd backend && node --test test/room.test.js`
Expected: FAIL — flera tester failar eftersom `room.js` fortfarande sätter
`skin` och pid-baserade defaultnamn (t.ex. `p1.animal` är `undefined` istället
för `null`/`'frog'`/`'toad'`, `p1.name` är `'Frog'` istället för `''`).

- [ ] **Step 7: Implementera i room.js**

Ersätt importraderna (rad 1-5):

```js
const {
  COLS, ROWS, GOAL_ROW, GOAL_COLS, SPAWN, LIVES, GOALS_TO_WIN_ROUND,
  ROUNDS_TO_WIN_MATCH, TICK_MS, SKINS, DEFAULT_SKIN, DEFAULT_NAMES,
  NAME_MAX_LEN, COUNTDOWN_MS, RIVER_ROWS
} = require('./constants');
```

med:

```js
const {
  COLS, ROWS, GOAL_ROW, GOAL_COLS, SPAWN, LIVES, GOALS_TO_WIN_ROUND,
  ROUNDS_TO_WIN_MATCH, TICK_MS, DEFAULT_ANIMAL_NAMES,
  NAME_MAX_LEN, COUNTDOWN_MS, RIVER_ROWS
} = require('./constants');
```

Ersätt `_initialState()`:

```js
  _initialState() {
    const seed = Date.now() >>> 0;
    const newPlayer = (pid) => ({
      ...SPAWN[pid], lives: LIVES, score: 0,
      name: DEFAULT_NAMES[pid], skin: DEFAULT_SKIN, ready: false
    });
    return {
      players: { p1: newPlayer('p1'), p2: newPlayer('p2') },
      seed,
      tick: 0,
      obstacles: generateLanes(seed),
      round: 1,
      roundScores: { p1: 0, p2: 0 },
      phase: 'lobby'
    };
  }
```

med:

```js
  _initialState() {
    const seed = Date.now() >>> 0;
    const newPlayer = (pid) => ({
      ...SPAWN[pid], lives: LIVES, score: 0,
      name: '', animal: null, ready: false
    });
    return {
      players: { p1: newPlayer('p1'), p2: newPlayer('p2') },
      seed,
      tick: 0,
      obstacles: generateLanes(seed),
      round: 1,
      roundScores: { p1: 0, p2: 0 },
      phase: 'lobby'
    };
  }
```

Ersätt `_handleReady()`:

```js
  _handleReady(pid, msg) {
    const p = this.state.players[pid];
    p.name = String(msg.name ?? '').trim().slice(0, NAME_MAX_LEN) || DEFAULT_NAMES[pid];
    p.skin = SKINS.includes(msg.skin) ? msg.skin : DEFAULT_SKIN;
    p.ready = true;
    if (this.state.players.p1.ready && this.state.players.p2.ready) {
      this.state.phase = 'countdown';
      this._broadcastEvent('countdown', { duration: COUNTDOWN_MS });
      this._startTimer = setTimeout(() => {
        this.state.phase = 'playing';
        this._broadcast();
      }, COUNTDOWN_MS);
    }
    this._broadcast();
  }
```

med:

```js
  _handleReady(pid, msg) {
    const p = this.state.players[pid];
    p.name = String(msg.name ?? '').trim().slice(0, NAME_MAX_LEN);
    p.ready = true;
    if (this.state.players.p1.ready && this.state.players.p2.ready) {
      this._assignAnimals();
      this.state.phase = 'countdown';
      this._broadcastEvent('countdown', { duration: COUNTDOWN_MS });
      this._startTimer = setTimeout(() => {
        this.state.phase = 'playing';
        this._broadcast();
      }, COUNTDOWN_MS);
    }
    this._broadcast();
  }

  _assignAnimals() {
    const animals = Math.random() < 0.5 ? ['frog', 'toad'] : ['toad', 'frog'];
    ['p1', 'p2'].forEach((pid, i) => {
      const p = this.state.players[pid];
      p.animal = animals[i];
      if (!p.name) p.name = DEFAULT_ANIMAL_NAMES[p.animal];
    });
  }
```

Ersätt loopen i `_startNewRound()`:

```js
    for (const pid of ['p1', 'p2']) {
      const { name, skin, ready } = this.state.players[pid];
      this.state.players[pid] = { ...SPAWN[pid], lives: LIVES, score: 0, name, skin, ready };
    }
```

med:

```js
    for (const pid of ['p1', 'p2']) {
      const { name, animal, ready } = this.state.players[pid];
      this.state.players[pid] = { ...SPAWN[pid], lives: LIVES, score: 0, name, animal, ready };
    }
```

- [ ] **Step 8: Kör testerna igen, verifiera att de passerar**

Run: `cd backend && node --test test/room.test.js`
Expected: PASS — alla tester i filen gröna, inklusive de tre nya
slumpningstesterna.

- [ ] **Step 9: Ta bort skin ur tournament.js**

I `backend/tournament.js`, ersätt:

```js
const Room = require('./room');
const { SKINS, DEFAULT_SKIN, NAME_MAX_LEN } = require('./constants');
```

med:

```js
const Room = require('./room');
const { NAME_MAX_LEN } = require('./constants');
```

Ersätt kommentaren:

```js
    this.participants = [];   // { id, ws, name, skin, connected, isHost }
```

med:

```js
    this.participants = [];   // { id, ws, name, connected, isHost }
```

Ersätt:

```js
  join(ws, name, skin, isHost = false) {
    if (this.phase !== 'gathering') return { error: 'already_started' };
    if (this.participants.length >= this.size) return { error: 'tournament_full' };
    name = String(name ?? '').trim().slice(0, NAME_MAX_LEN) || `Player ${this._nextId}`;
    if (this.participants.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      return { error: 'name_taken' };
    }
    const p = {
      id: this._nextId++,
      ws,
      name,
      skin: SKINS.includes(skin) ? skin : DEFAULT_SKIN,
      connected: true,
      isHost
    };
```

med:

```js
  join(ws, name, isHost = false) {
    if (this.phase !== 'gathering') return { error: 'already_started' };
    if (this.participants.length >= this.size) return { error: 'tournament_full' };
    name = String(name ?? '').trim().slice(0, NAME_MAX_LEN) || `Player ${this._nextId}`;
    if (this.participants.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      return { error: 'name_taken' };
    }
    const p = {
      id: this._nextId++,
      ws,
      name,
      connected: true,
      isHost
    };
```

Ersätt:

```js
      participants: this.participants.map(({ id, name, skin, connected, isHost }) =>
        ({ id, name, skin, connected, isHost })),
```

med:

```js
      participants: this.participants.map(({ id, name, connected, isHost }) =>
        ({ id, name, connected, isHost })),
```

- [ ] **Step 10: Uppdatera manager.js till tournament.js:s nya signatur**

I `backend/manager.js`, ersätt:

```js
    t.join(ws, msg.name, msg.skin, true); // kan inte misslyckas i tom turnering
```

med:

```js
    t.join(ws, msg.name, true); // kan inte misslyckas i tom turnering
```

Ersätt:

```js
    const res = t.join(ws, msg.name, msg.skin);
```

med:

```js
    const res = t.join(ws, msg.name);
```

- [ ] **Step 11: Uppdatera tournament.test.js:s tre join-anrop**

I `backend/test/tournament.test.js`, de tre anropen som skickar `'green'`
som tredje positionsargument (skulle annars bli feltolkat som `isHost`
efter signaturändringen):

Ersätt:

```js
    const res = t.join(ws, `Spelare${i + 1}`, 'green', i === 0);
```

med:

```js
    const res = t.join(ws, `Spelare${i + 1}`, i === 0);
```

Ersätt:

```js
  const res = t.join(mockWs(), 'Sen', 'green');
```

med:

```js
  const res = t.join(mockWs(), 'Sen');
```

Ersätt:

```js
  const res = t.join(mockWs(), 'sPeLaRe1', 'green');
```

med:

```js
  const res = t.join(mockWs(), 'sPeLaRe1');
```

- [ ] **Step 12: Städa manager.test.js och e2e-test.js (icke-blockerande men
  stale annars)**

I `backend/test/manager.test.js`, ta bort `skin: 'green'`/`skin: 'blue'`
ur samtliga options-objekt som skickas till `mgr.create()`/`mgr.join()`
(t.ex. `{ size: 4, bestOf: 3, name: 'Värd', skin: 'green' }` →
`{ size: 4, bestOf: 3, name: 'Värd' }`).

I `backend/e2e-test.js`, ta bort `skin: '...'`-fältet ur samtliga
`send(...)`-anrop för `type: 'ready'`, `type: 'create_tournament'` och
`type: 'join_tournament'`.

- [ ] **Step 13: Kör hela backend-sviten**

Run: `cd backend && node --test test/*.test.js`
Expected: PASS — inga regressioner i någon testfil.

- [ ] **Step 14: Commit**

```bash
git add backend/constants.js backend/room.js backend/tournament.js backend/manager.js backend/e2e-test.js backend/test/room.test.js backend/test/constants.test.js backend/test/tournament.test.js backend/test/manager.test.js
git commit -m "feat: slumpa groda/padda vid matchstart, ta bort skin-fältet i backend"
```

---

### Task 2: Frontend — rendera från serverns djurtilldelning

**Files:**
- Modify: `frontend/js/sprites.js`
- Modify: `frontend/js/renderer.js`
- Test: `backend/test/sprites.test.js` (kör via Node, importerar
  frontend-modulen — se befintligt mönster i filen)

**Interfaces:**
- Consumes: `Room.state.players[pid].animal` från Task 1 (broadcastas
  redan i sin helhet av `_broadcast()` i `room.js` — inget nytt fält
  behöver läggas till i broadcast-payloaden, `players`-objektet skickas
  redan komplett).
- Produces: `getPalette(animal)` (ersätter `getPalette(skin, animal)`),
  `drawSprite(ctx, { animal, direction, cx, cy, cellSize })` (tappar
  `skin`-parametern).

- [ ] **Step 1: Skriv failande tester för den nya paletten**

I `backend/test/sprites.test.js`, ersätt:

```js
test('getPalette grön groda har klargrön kropp', async () => {
  const { getPalette } = await loadSprites();
  const p = getPalette('green', 'frog');
  assert.equal(p[1], '#25b34a');
  assert.equal(p[5], '#9fd987');
});

test('getPalette gul padda är senapsgul/oliv, inte klargul som grodan', async () => {
  const { getPalette } = await loadSprites();
  const toadYellow = getPalette('yellow', 'toad');
  const frogYellow = getPalette('yellow', 'frog');
  assert.equal(toadYellow[1], '#a8791f');
  assert.equal(frogYellow[1], '#e0c22a');
  assert.notEqual(toadYellow[1], frogYellow[1]);
});

test('getPalette okänt skin faller tillbaka på green', async () => {
  const { getPalette } = await loadSprites();
  assert.deepEqual(getPalette('rainbow', 'frog'), getPalette('green', 'frog'));
  assert.deepEqual(getPalette('rainbow', 'toad'), getPalette('green', 'toad'));
});

test('getPalette har fast ögonvitt/pupill oavsett skin och djur', async () => {
  const { getPalette } = await loadSprites();
  for (const skin of ['green', 'yellow', 'blue']) {
    for (const animal of ['frog', 'toad']) {
      const p = getPalette(skin, animal);
      assert.equal(p[3], '#f4f4e6');
      assert.equal(p[4], '#111');
    }
  }
});
```

med:

```js
test('getPalette groda har klargrön kropp', async () => {
  const { getPalette } = await loadSprites();
  const p = getPalette('frog');
  assert.equal(p[1], '#25b34a');
  assert.equal(p[5], '#9fd987');
});

test('getPalette padda och groda har olika kroppsfärg', async () => {
  const { getPalette } = await loadSprites();
  const frog = getPalette('frog');
  const toad = getPalette('toad');
  assert.equal(frog[1], '#25b34a');
  assert.equal(toad[1], '#5c7a3c');
  assert.notEqual(frog[1], toad[1]);
});

test('getPalette okänt djur faller tillbaka på frog', async () => {
  const { getPalette } = await loadSprites();
  assert.deepEqual(getPalette('rainbow'), getPalette('frog'));
});

test('getPalette har fast ögonvitt/pupill oavsett djur', async () => {
  const { getPalette } = await loadSprites();
  for (const animal of ['frog', 'toad']) {
    const p = getPalette(animal);
    assert.equal(p[3], '#f4f4e6');
    assert.equal(p[4], '#111');
  }
});
```

Ersätt även i testet `'drawSprite ritar en fillRect per icke-transparent
pixel'`:

```js
  drawSprite(ctx, { animal: 'frog', direction: 'up', skin: 'green', cx: 24, cy: 24, cellSize: 48 });
```

med:

```js
  drawSprite(ctx, { animal: 'frog', direction: 'up', cx: 24, cy: 24, cellSize: 48 });
```

- [ ] **Step 2: Kör testerna, verifiera att de failar**

Run: `cd backend && node --test test/sprites.test.js`
Expected: FAIL — `getPalette('frog')` returnerar `undefined`-värden eftersom
`getPalette` fortfarande förväntar sig `(skin, animal)`.

- [ ] **Step 3: Implementera i sprites.js**

Ersätt:

```js
const SKIN_PALETTES = {
  green: {
    frog: { 1: '#25b34a', 2: '#0f5c22', 5: '#9fd987' },
    toad: { 1: '#5c7a3c', 2: '#31431f', 5: '#9db97e' },
  },
  yellow: {
    frog: { 1: '#e0c22a', 2: '#8a6f10', 5: '#f2e39a' },
    toad: { 1: '#a8791f', 2: '#5c4110', 5: '#d1ac5c' }, // senapsgul, ej klargul
  },
  blue: {
    frog: { 1: '#2a8de0', 2: '#0f4f8a', 5: '#9ad0f2' },
    toad: { 1: '#4c6f8a', 2: '#22384a', 5: '#9db8c9' },
  },
};

export function getGrid(animal, direction) {
  const byAnimal = GRIDS[animal] ?? GRIDS.frog;
  return byAnimal[direction] ?? byAnimal.up;
}

export function getPalette(skin, animal) {
  const bySkin = SKIN_PALETTES[skin] ?? SKIN_PALETTES.green;
  const base = bySkin[animal] ?? bySkin.frog;
  return { 1: base[1], 2: base[2], 3: EYE_WHITE, 4: PUPIL, 5: base[5] };
}

export function drawSprite(ctx, { animal, direction, skin, cx, cy, cellSize }) {
  const grid = getGrid(animal, direction);
  const palette = getPalette(skin, animal);
```

med:

```js
const ANIMAL_PALETTES = {
  frog: { 1: '#25b34a', 2: '#0f5c22', 5: '#9fd987' },
  toad: { 1: '#5c7a3c', 2: '#31431f', 5: '#9db97e' },
};

export function getGrid(animal, direction) {
  const byAnimal = GRIDS[animal] ?? GRIDS.frog;
  return byAnimal[direction] ?? byAnimal.up;
}

export function getPalette(animal) {
  const base = ANIMAL_PALETTES[animal] ?? ANIMAL_PALETTES.frog;
  return { 1: base[1], 2: base[2], 3: EYE_WHITE, 4: PUPIL, 5: base[5] };
}

export function drawSprite(ctx, { animal, direction, cx, cy, cellSize }) {
  const grid = getGrid(animal, direction);
  const palette = getPalette(animal);
```

- [ ] **Step 4: Kör testerna igen, verifiera att de passerar**

Run: `cd backend && node --test test/sprites.test.js`
Expected: PASS — alla tester i filen gröna.

- [ ] **Step 5: Uppdatera renderer.js (ingen automatiserad test — canvas-rendering)**

I `frontend/js/renderer.js`, ersätt i `_drawPlayers()`:

```js
      const rx = state.renderX(pid); // flytande x när spelaren åker stock
      const animal = pid === 'p1' ? 'frog' : 'toad';
      drawSprite(ctx, {
        animal,
        direction: state.dirOf(pid),
        skin: p.skin,
        cx: rx * cell + cell / 2,
        cy: p.y * cell + cell / 2,
        cellSize: cell
      });
```

med:

```js
      const rx = state.renderX(pid); // flytande x när spelaren åker stock
      drawSprite(ctx, {
        animal: p.animal,
        direction: state.dirOf(pid),
        cx: rx * cell + cell / 2,
        cy: p.y * cell + cell / 2,
        cellSize: cell
      });
```

- [ ] **Step 6: Kör hela backend-sviten (sim-consistency och andra
  filer får inte påverkas)**

Run: `cd backend && node --test test/*.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/js/sprites.js frontend/js/renderer.js backend/test/sprites.test.js
git commit -m "feat: rendera groda/padda från serverns djurtilldelning istället för pid"
```

---

### Task 3: Frontend — ta bort färgväljaren

**Files:**
- Modify: `frontend/index.html`
- Modify: `frontend/style.css`
- Modify: `frontend/js/start-ui.js`
- Modify: `frontend/js/lobby-ui.js`
- Modify: `frontend/js/tournament-ui.js`
- Modify: `frontend/js/game.js`
- Modify: `frontend/js/i18n.js`

**Interfaces:**
- Consumes: inget nytt från Task 1/2.
- Produces: `{ type: 'ready', name }`, `{ type: 'create_tournament', size,
  bestOf, name }`, `{ type: 'join_tournament', code, name }` (utan
  `skin`-fält) — matchar redan vad `room.js` (Task 1) förväntar sig, som
  aldrig läser ett `skin`-fält.

Inga automatiserade tester täcker denna DOM-kod (ingen test-fil
refererar `start-ui.js`/`lobby-ui.js`/`tournament-ui.js`/`index.html`/
`style.css`). `i18n.test.js`s paritetstest (`sv`/`en` har samma nycklar)
är den enda automatiserade kontrollen som berörs — den körs i Step 8.

- [ ] **Step 1: Ta bort färgväljarens HTML**

I `frontend/index.html`, ta bort blocket:

```html
    <div class="skins" id="start-skins">
      <button class="skin" data-skin="green" aria-label="Grön" data-i18n-aria="skin.green"></button>
      <button class="skin" data-skin="yellow" aria-label="Gul" data-i18n-aria="skin.yellow"></button>
      <button class="skin" data-skin="blue" aria-label="Blå" data-i18n-aria="skin.blue"></button>
    </div>
```

(mellan `<input id="start-name" ...>` och `<button id="start-quick" ...>`),
och blocket:

```html
    <div class="skins" id="lobby-skins">
      <button class="skin" data-skin="green" aria-label="Grön" data-i18n-aria="skin.green"></button>
      <button class="skin" data-skin="yellow" aria-label="Gul" data-i18n-aria="skin.yellow"></button>
      <button class="skin" data-skin="blue" aria-label="Blå" data-i18n-aria="skin.blue"></button>
    </div>
```

(mellan `<input id="lobby-name" ...>` och `<button id="lobby-ready" ...>`).

- [ ] **Step 2: Ta bort färgväljarens CSS**

I `frontend/style.css`, ta bort:

```css
.skins { display: flex; gap: 0.75rem; }

.skin {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  border: 3px solid transparent;
  cursor: pointer;
}

.skin.selected { border-color: #fff; box-shadow: 0 0 8px rgba(255, 255, 255, 0.85); }

.skin[data-skin="green"]  { background: #00e64d; }
.skin[data-skin="yellow"] { background: #ffe100; }
.skin[data-skin="blue"]   { background: #4da6ff; }

```

(hela blocket, inklusive den tomma raden direkt efter, mellan
`.lobby input:focus { ... }` och `#lobby-ready, .primary { ... }`).

- [ ] **Step 3: Ta bort skin-logik i start-ui.js**

I `frontend/js/start-ui.js`, ersätt hela filen:

```js
import { t, setLang, getLang } from './i18n.js';

export class StartUI {
  constructor(net, state) {
    this._net   = net;
    this._state = state;
    this._skin  = 'green';

    this._root   = document.getElementById('start');
    this._name   = document.getElementById('start-name');
    this._code   = document.getElementById('start-code');
    this._size   = document.getElementById('start-size');
    this._bestof = document.getElementById('start-bestof');
    this._error  = document.getElementById('start-error');
    this._skinBtns = [...document.querySelectorAll('#start-skins .skin')];

    this._fillSizeOptions();

    for (const btn of this._skinBtns) {
      btn.addEventListener('click', () => {
        this._skin = btn.dataset.skin;
        for (const b of this._skinBtns) b.classList.toggle('selected', b === btn);
      });
    }
    this._skinBtns[0].classList.add('selected');

    this._code.value = new URLSearchParams(location.search).get('code') ?? '';

    document.getElementById('start-quick').addEventListener('click', () => {
      this._saveProfile();
      // Förifyll snabbmatchens lobbypanel med samma namn/skin
      document.getElementById('lobby-name').value = this._state.profile.name;
      document.querySelector(`#lobby-skins .skin[data-skin="${this._skin}"]`)?.click();
      this._net.send({ type: 'quick_match' });
    });

    document.getElementById('start-create').addEventListener('click', () => {
      this._saveProfile();
      this._net.send({
        type: 'create_tournament',
        size: Number(this._size.value),
        bestOf: Number(this._bestof.value),
        name: this._state.profile.name,
        skin: this._skin
      });
    });

    document.getElementById('start-join').addEventListener('click', () => {
      this._saveProfile();
      this._net.send({
        type: 'join_tournament',
        code: this._code.value.trim().toUpperCase(),
        name: this._state.profile.name,
        skin: this._skin
      });
    });

    this._langBtns = {
      sv: document.getElementById('lang-sv'),
      en: document.getElementById('lang-en')
    };
    for (const [l, btn] of Object.entries(this._langBtns)) {
      btn.addEventListener('click', () => {
        setLang(l);
        this._onLangChange();
      });
    }
    this._onLangChange();
  }

  _onLangChange() {
    for (const [l, btn] of Object.entries(this._langBtns)) {
      btn.classList.toggle('active', l === getLang());
    }
    this._fillSizeOptions();
  }

  _fillSizeOptions() {
    const current = this._size.value || '8';
    this._size.replaceChildren();
    for (let n = 2; n <= 16; n++) {
      const opt = document.createElement('option');
      opt.value = n;
      opt.textContent = t('start.players', { n });
      if (String(n) === current) opt.selected = true;
      this._size.appendChild(opt);
    }
  }

  _saveProfile() {
    this._state.profile = { name: this._name.value.trim(), skin: this._skin };
    this._state.lastError = null;
  }

  // Anropas från rAF-loopen
  update() {
    const visible = this._state.mode === null;
    this._root.classList.toggle('hidden', !visible);
    if (!visible) return;
    const text = this._state.lastError ? t(`error.${this._state.lastError}`) : '';
    if (this._error.textContent !== text) this._error.textContent = text;
  }
}
```

med:

```js
import { t, setLang, getLang } from './i18n.js';

export class StartUI {
  constructor(net, state) {
    this._net   = net;
    this._state = state;

    this._root   = document.getElementById('start');
    this._name   = document.getElementById('start-name');
    this._code   = document.getElementById('start-code');
    this._size   = document.getElementById('start-size');
    this._bestof = document.getElementById('start-bestof');
    this._error  = document.getElementById('start-error');

    this._fillSizeOptions();

    this._code.value = new URLSearchParams(location.search).get('code') ?? '';

    document.getElementById('start-quick').addEventListener('click', () => {
      this._saveProfile();
      // Förifyll snabbmatchens lobbypanel med samma namn
      document.getElementById('lobby-name').value = this._state.profile.name;
      this._net.send({ type: 'quick_match' });
    });

    document.getElementById('start-create').addEventListener('click', () => {
      this._saveProfile();
      this._net.send({
        type: 'create_tournament',
        size: Number(this._size.value),
        bestOf: Number(this._bestof.value),
        name: this._state.profile.name
      });
    });

    document.getElementById('start-join').addEventListener('click', () => {
      this._saveProfile();
      this._net.send({
        type: 'join_tournament',
        code: this._code.value.trim().toUpperCase(),
        name: this._state.profile.name
      });
    });

    this._langBtns = {
      sv: document.getElementById('lang-sv'),
      en: document.getElementById('lang-en')
    };
    for (const [l, btn] of Object.entries(this._langBtns)) {
      btn.addEventListener('click', () => {
        setLang(l);
        this._onLangChange();
      });
    }
    this._onLangChange();
  }

  _onLangChange() {
    for (const [l, btn] of Object.entries(this._langBtns)) {
      btn.classList.toggle('active', l === getLang());
    }
    this._fillSizeOptions();
  }

  _fillSizeOptions() {
    const current = this._size.value || '8';
    this._size.replaceChildren();
    for (let n = 2; n <= 16; n++) {
      const opt = document.createElement('option');
      opt.value = n;
      opt.textContent = t('start.players', { n });
      if (String(n) === current) opt.selected = true;
      this._size.appendChild(opt);
    }
  }

  _saveProfile() {
    this._state.profile = { name: this._name.value.trim() };
    this._state.lastError = null;
  }

  // Anropas från rAF-loopen
  update() {
    const visible = this._state.mode === null;
    this._root.classList.toggle('hidden', !visible);
    if (!visible) return;
    const text = this._state.lastError ? t(`error.${this._state.lastError}`) : '';
    if (this._error.textContent !== text) this._error.textContent = text;
  }
}
```

- [ ] **Step 4: Ta bort skin-logik i lobby-ui.js**

I `frontend/js/lobby-ui.js`, ersätt hela filen:

```js
import { t } from './i18n.js';

function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}

export class LobbyUI {
  constructor(net, state) {
    this._net   = net;
    this._state = state;
    this._sent  = false;
    this._skin  = 'green';

    this._root     = document.getElementById('lobby');
    this._status   = document.getElementById('lobby-status');
    this._opponent = document.getElementById('lobby-opponent');
    this._name     = document.getElementById('lobby-name');
    this._ready    = document.getElementById('lobby-ready');
    this._skinBtns = [...this._root.querySelectorAll('.skin')];

    for (const btn of this._skinBtns) {
      btn.addEventListener('click', () => {
        if (this._sent) return;
        this._skin = btn.dataset.skin;
        for (const b of this._skinBtns) b.classList.toggle('selected', b === btn);
      });
    }
    this._skinBtns[0].classList.add('selected');

    this._ready.addEventListener('click', () => {
      this._sent = true;
      this._net.send({ type: 'ready', name: this._name.value, skin: this._skin });
    });
  }

  // Anropas från rAF-loopen
  update() {
    const s = this._state;
    const visible = s.mode === 'quick' && (s.phase === 'waiting' || s.phase === 'lobby');
    this._root.classList.toggle('hidden', !visible);
    if (!visible) return;

    if (s.phase === 'waiting') {
      this._sent = false; // ny match — lås upp formuläret
      setText(this._status, t('lobby.waiting'));
      setText(this._opponent, '');
    } else {
      const other = s.you === 'p1' ? 'p2' : 'p1';
      const op = s.players[other];
      setText(this._status, this._sent ? t('lobby.waitReady') : t('lobby.found'));
      setText(this._opponent, op ? `${op.name}: ${op.ready ? t('lobby.ready') : t('lobby.notReady')}` : '');
    }

    this._name.disabled  = this._sent;
    this._ready.disabled = this._sent || s.phase !== 'lobby';
  }
}
```

med:

```js
import { t } from './i18n.js';

function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}

export class LobbyUI {
  constructor(net, state) {
    this._net   = net;
    this._state = state;
    this._sent  = false;

    this._root     = document.getElementById('lobby');
    this._status   = document.getElementById('lobby-status');
    this._opponent = document.getElementById('lobby-opponent');
    this._name     = document.getElementById('lobby-name');
    this._ready    = document.getElementById('lobby-ready');

    this._ready.addEventListener('click', () => {
      this._sent = true;
      this._net.send({ type: 'ready', name: this._name.value });
    });
  }

  // Anropas från rAF-loopen
  update() {
    const s = this._state;
    const visible = s.mode === 'quick' && (s.phase === 'waiting' || s.phase === 'lobby');
    this._root.classList.toggle('hidden', !visible);
    if (!visible) return;

    if (s.phase === 'waiting') {
      this._sent = false; // ny match — lås upp formuläret
      setText(this._status, t('lobby.waiting'));
      setText(this._opponent, '');
    } else {
      const other = s.you === 'p1' ? 'p2' : 'p1';
      const op = s.players[other];
      setText(this._status, this._sent ? t('lobby.waitReady') : t('lobby.found'));
      setText(this._opponent, op ? `${op.name}: ${op.ready ? t('lobby.ready') : t('lobby.notReady')}` : '');
    }

    this._name.disabled  = this._sent;
    this._ready.disabled = this._sent || s.phase !== 'lobby';
  }
}
```

- [ ] **Step 5: Ta bort skin-fältet i tournament-ui.js**

I `frontend/js/tournament-ui.js`, ersätt:

```js
      this._net.send({
        type: 'ready',
        name: this._state.profile.name,
        skin: this._state.profile.skin
      });
```

med:

```js
      this._net.send({
        type: 'ready',
        name: this._state.profile.name
      });
```

- [ ] **Step 6: Ta bort skin ur profilen i game.js**

I `frontend/js/game.js`, ersätt:

```js
    this.profile     = { name: '', skin: 'green' };
```

med:

```js
    this.profile     = { name: '' };
```

- [ ] **Step 7: Ta bort skin-nycklarna ur i18n.js**

I `frontend/js/i18n.js`, ta bort raderna (i `sv`-ordboken):

```js
    'skin.green': 'Grön',
    'skin.yellow': 'Gul',
    'skin.blue': 'Blå',
```

och (i `en`-ordboken):

```js
    'skin.green': 'Green',
    'skin.yellow': 'Yellow',
    'skin.blue': 'Blue',
```

- [ ] **Step 8: Kör hela backend-sviten (i18n-paritetstestet körs härifrån)**

Run: `cd backend && node --test test/*.test.js`
Expected: PASS — `'paritet: sv och en har exakt samma nycklar'` i
`i18n.test.js` ska fortfarande vara grön eftersom nycklarna togs bort
symmetriskt ur båda språken.

- [ ] **Step 9: Grep-kontroll — inga skin-referenser kvar i frontend**

Run: `grep -rn "skin" frontend/ --include=*.js --include=*.html --include=*.css`
Expected: 0 träffar (utom ev. i `frontend/fonts/` eller binärfiler, vilket
inte är relevant — om kommandot ger träffar i `.js`/`.html`/`.css`, kontrollera
att de faktiskt hör hit).

- [ ] **Step 10: Commit**

```bash
git add frontend/index.html frontend/style.css frontend/js/start-ui.js frontend/js/lobby-ui.js frontend/js/tournament-ui.js frontend/js/game.js frontend/js/i18n.js
git commit -m "feat: ta bort färgväljaren helt ur frontend"
```

---

### Task 4: Dokumentation — uppdatera CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Interfaces:** Ingen kod — beskriver resultatet av Task 1-3.

- [ ] **Step 1: Uppdatera komponentbeskrivningarna**

Ersätt:

```
lobby-ui.js    HTML-lobbypanel: namn, skinval, Redo-knapp; visas i faserna waiting/lobby
start-ui.js    Startskärm: namn/skin + Snabbmatch / Skapa turnering / Gå med (kod, ?code= i URL)
tournament-ui.js  Turneringspanel: samlingsvy och utslagsträd; Redo-knapp för nästa matchpar
renderer.js    Canvas-ritning. Spelplan: 13×15 celler à 48px. Zones: goal/river/safe/traffic/start. SKINS-tabell (id → färg)
```

med:

```
lobby-ui.js    HTML-lobbypanel: namn, Redo-knapp; visas i faserna waiting/lobby
start-ui.js    Startskärm: namn + Snabbmatch / Skapa turnering / Gå med (kod, ?code= i URL)
tournament-ui.js  Turneringspanel: samlingsvy och utslagsträd; Redo-knapp för nästa matchpar
renderer.js    Canvas-ritning. Spelplan: 13×15 celler à 48px. Zones: goal/river/safe/traffic/start. Djur-paletter i sprites.js
```

- [ ] **Step 2: Uppdatera standardnamn-stycket**

Ersätt:

```
texter: `t()`-anrop i rAF-renderade updates. Nya UI-strängar läggs i BÅDA ordböckerna i
`i18n.js` (paritetstest låser nyckeluppsättningen). Serverns standardnamn är engelska
(`Player 1/2`, `Player N`) — delad data översätts inte per klient.
```

med:

```
texter: `t()`-anrop i rAF-renderade updates. Nya UI-strängar läggs i BÅDA ordböckerna i
`i18n.js` (paritetstest låser nyckeluppsättningen). Serverns standardnamn matchar
tilldelat djur (`Frog`/`Toad`) — sätts först när båda spelare är redo och djuren
slumpats; delad data översätts inte per klient.
```

- [ ] **Step 3: Uppdatera nätverksprotokollet**

Ersätt:

```
- Första meddelandet väljer väg: `{ type: 'quick_match' }` (dagens kö), `{ type: 'create_tournament', size, bestOf, name, skin }` eller `{ type: 'join_tournament', code, name, skin }`
- `{ type: 'start_tournament' }` — endast värd, i fas gathering
- `{ type: 'ready', name, skin }` — i rummets lobby-fas; namn trimmas (max 20), skin valideras mot SKINS
```

med:

```
- Första meddelandet väljer väg: `{ type: 'quick_match' }` (dagens kö), `{ type: 'create_tournament', size, bestOf, name }` eller `{ type: 'join_tournament', code, name }`
- `{ type: 'start_tournament' }` — endast värd, i fas gathering
- `{ type: 'ready', name }` — i rummets lobby-fas; namn trimmas (max 20)
```

Ersätt:

```
- `{ type: 'state', players, seed, tick, round, roundScores, phase, ack }` — vid varje tick och rörelse; players har name/skin/ready; hindren simuleras lokalt från seed+tick
```

med:

```
- `{ type: 'state', players, seed, tick, round, roundScores, phase, ack }` — vid varje tick och rörelse; players har name/animal/ready (animal slumpas av servern när båda blir redo, `null` innan dess); hindren simuleras lokalt från seed+tick
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: uppdatera CLAUDE.md för slumpat djur och borttagen skin"
```

---

### Task 5: Slutgiltig verifiering (ingen kodändring)

**Files:** Inga — endast manuell/automatiserad kontroll av föregående
uppgifters resultat.

- [ ] **Step 1: Hela backend-sviten**

Run: `cd backend && node --test test/*.test.js`
Expected: alla tester passerar, ingen regression.

- [ ] **Step 2: Manuell tvåspelar-genomgång i webbläsare**

Starta backend lokalt (`cd backend && node server.js`) och öppna
`frontend/index.html` i två separata webbläsarflikar/-fönster (eller privat
läge i det ena, för att undvika delad `localStorage`).

1. I flik 1: ange ett namn, klicka "Snabbmatch".
2. I flik 2: ange ett annat namn, klicka "Snabbmatch" — de paras ihop.
3. Klicka "Redo" i båda flikarna.
4. Kontrollera att nedräkningen visar en groda och en padda på spelplanen
   (inte alltid samma spelare som groda) — kör om flödet (ladda om båda
   flikarna, para ihop på nytt) några gånger för att se att tilldelningen
   varierar.
5. Kontrollera att båda flikarna visar SAMMA tilldelning (den som är groda
   i flik 1 ska synas som groda i flik 2 också).
6. Kontrollera att ingen färgväljare (cirklar) syns på vare sig start- eller
   väntrumsskärmen.

- [ ] **Step 3: Tomt namnfält**

Upprepa flödet ovan men lämna namnfältet tomt i en av flikarna innan
"Redo". Kontrollera att den spelaren visas som "Frog" eller "Toad" i HUD:en
beroende på vilket djur den fick — inte alltid samma ord oavsett djur.

- [ ] **Step 4: Turnering**

Skapa en turnering från startskärmen med 2 spelare, gå med i den andra
fliken via koden, lotta och starta. Kontrollera att djurtilldelningen
fungerar likadant i turneringsmatchen som i snabbmatchen, och att den
består genom flera rundor i samma match (bäst av 3/5) — samma spelare
förblir samma djur tills matchen är slut.

- [ ] **Step 5: Slutlig commit-koll**

Run: `git status`
Expected: inga ospårade eller oförändrade filer kvar — allt från Task 1-4
är redan committat.
