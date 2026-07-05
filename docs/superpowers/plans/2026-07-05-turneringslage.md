# Turneringsläge — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turneringsläge (rak utslagning, 2–16 spelare) där en värd skapar en turnering med kod, matcherna spelas en i taget och alla övriga ser matchen i realtid som åskådare.

**Architecture:** Turneringen är ett orkestreringslager ovanpå `Room` (spec: `docs/superpowers/specs/2026-07-05-turneringslage-design.md`). Ny ren bracket-logik (`bracket.js`), en `Tournament`-klass som skapar ett `Room` per match, en `TournamentManager` med koder, samt routing i `server.js` där klientens första meddelande väljer väg. Frontend får startskärm, turneringspanel (samling + träd) och åskådarläge.

**Tech Stack:** Node.js + ws (CommonJS, inga nya beroenden), vanilla JS ES6-moduler + Canvas (ingen byggprocess), `node --test`.

## Global Constraints

- All UI-text på svenska.
- Testkommando: `cd backend && node --test test/*.test.js` (glob-form — katalogform fungerar inte på Node v24).
- Backend är CommonJS (`require`/`module.exports`), frontend är ES6-moduler (`import`/`export`).
- Inga nya npm-beroenden. Ingen databas — allt i minnet.
- `frontend/js/sim.js`, `backend/gameloop.js`, `backend/collision.js` får INTE ändras (sim-consistency).
- Kommentarer bara där något är icke-uppenbart. Ändra inte mer än uppgiften kräver.
- Varje commit: committa direkt på `master` (ingen feature-branch). Avsluta commit-meddelanden med `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Bracket-logik (`backend/bracket.js`)

Ren utslagsträdslogik utan nätverks- eller rumskännedom. Bracket-formatet är
`rounds[roundIndex][matchIndex]` där varje match är
`{ p1, p2, winner, walkover }` (deltagar-id eller `null`). I omgång 0 betyder
`p2 === null` frilott (avgörs direkt vid generering); i senare omgångar betyder
`null` "inte avgjord ännu" — sådana matcher har alltid `winner === null` och
hoppas över av `findNextMatch`.

**Files:**
- Create: `backend/bracket.js`
- Test: `backend/test/bracket.test.js`

**Interfaces:**
- Produces: `generateBracket(ids, rand?) → rounds`, `findNextMatch(rounds) → { round, index } | null`, `reportWinner(rounds, round, index, winnerId, walkover?)`, `champion(rounds) → id | null`. Används av Task 4.

- [ ] **Step 1: Skriv failande tester**

Skapa `backend/test/bracket.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { generateBracket, findNextMatch, reportWinner, champion } = require('../bracket');

function allIdsInRound0(rounds) {
  return rounds[0].flatMap(m => [m.p1, m.p2]).filter(id => id !== null);
}

test('2 deltagare ger en enda match utan frilotter', () => {
  const rounds = generateBracket([1, 2]);
  assert.equal(rounds.length, 1);
  assert.equal(rounds[0].length, 1);
  assert.deepEqual(allIdsInRound0(rounds).sort(), [1, 2]);
});

test('16 deltagare ger 4 omgångar och 15 matcher', () => {
  const ids = Array.from({ length: 16 }, (_, i) => i + 1);
  const rounds = generateBracket(ids);
  assert.deepEqual(rounds.map(r => r.length), [8, 4, 2, 1]);
  assert.equal(allIdsInRound0(rounds).length, 16);
});

test('6 deltagare ger 8-träd med 2 frilotter som avgörs direkt', () => {
  const rounds = generateBracket([1, 2, 3, 4, 5, 6]);
  assert.deepEqual(rounds.map(r => r.length), [4, 2, 1]);
  const byes = rounds[0].filter(m => m.p2 === null);
  assert.equal(byes.length, 2);
  for (const m of byes) {
    assert.equal(m.winner, m.p1);         // frilott avgjord vid generering
    assert.notEqual(m.p1, null);          // aldrig två null i samma match
  }
  assert.equal(allIdsInRound0(rounds).length, 6);
});

test('alla deltagare förekommer exakt en gång i omgång 0', () => {
  const ids = [10, 20, 30, 40, 50];
  const rounds = generateBracket(ids);
  assert.deepEqual(allIdsInRound0(rounds).sort((a, b) => a - b), ids);
});

test('findNextMatch tar omgång 0 före omgång 1 och hoppar över frilotter', () => {
  const rounds = generateBracket([1, 2, 3]); // 4-träd, 1 frilott
  const next = findNextMatch(rounds);
  assert.equal(next.round, 0);
  assert.equal(rounds[0][next.index].p2 !== null, true);
});

test('reportWinner propagerar vinnaren till rätt slot i nästa omgång', () => {
  const rounds = generateBracket([1, 2, 3, 4]);
  reportWinner(rounds, 0, 0, rounds[0][0].p1);
  assert.equal(rounds[1][0].p1, rounds[0][0].p1);
  reportWinner(rounds, 0, 1, rounds[0][1].p2, true);
  assert.equal(rounds[1][0].p2, rounds[0][1].p2);
  assert.equal(rounds[0][1].walkover, true);
});

test('champion är null tills finalen är avgjord', () => {
  const rounds = generateBracket([1, 2]);
  assert.equal(champion(rounds), null);
  reportWinner(rounds, 0, 0, rounds[0][0].p1);
  assert.equal(champion(rounds), rounds[0][0].p1);
  assert.equal(findNextMatch(rounds), null);
});

test('hela turneringen kan spelas klart via findNextMatch/reportWinner', () => {
  const rounds = generateBracket([1, 2, 3, 4, 5, 6, 7]); // 8-träd, 1 frilott
  let guard = 0;
  let m;
  while ((m = findNextMatch(rounds)) !== null) {
    assert.ok(++guard < 20, 'oändlig loop');
    reportWinner(rounds, m.round, m.index, rounds[m.round][m.index].p1);
  }
  assert.notEqual(champion(rounds), null);
});
```

- [ ] **Step 2: Kör testet och verifiera att det failar**

Kör: `cd backend && node --test test/bracket.test.js`
Förväntat: FAIL med `Cannot find module '../bracket'`

- [ ] **Step 3: Implementera `backend/bracket.js`**

```js
// Ren utslagsträdslogik. bracket = rounds[roundIndex][matchIndex],
// match = { p1, p2, winner, walkover } med deltagar-id eller null.

function bracketSize(n) {
  let s = 2;
  while (s < n) s *= 2;
  return s;
}

// Blandar ids med rand() (0..1) och bygger trädet. Antalet frilotter är
// alltid < size/2, så varje frilott får en egen match (p2 = null) och
// avgörs direkt vid genereringen.
function generateBracket(ids, rand = Math.random) {
  const shuffled = [...ids];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const size = bracketSize(shuffled.length);
  const byes = size - shuffled.length;
  const firstRound = [];
  let k = 0;
  for (let m = 0; m < size / 2; m++) {
    const p1 = shuffled[k++];
    const p2 = m < byes ? null : shuffled[k++];
    firstRound.push({ p1, p2, winner: null, walkover: false });
  }
  const rounds = [firstRound];
  for (let len = size / 4; len >= 1; len /= 2) {
    rounds.push(Array.from({ length: len },
      () => ({ p1: null, p2: null, winner: null, walkover: false })));
  }
  for (let i = 0; i < firstRound.length; i++) {
    if (firstRound[i].p2 === null) reportWinner(rounds, 0, i, firstRound[i].p1, true);
  }
  return rounds;
}

function reportWinner(rounds, round, index, winnerId, walkover = false) {
  const match = rounds[round][index];
  match.winner = winnerId;
  match.walkover = walkover;
  if (round + 1 < rounds.length) {
    const next = rounds[round + 1][Math.floor(index / 2)];
    if (index % 2 === 0) next.p1 = winnerId;
    else next.p2 = winnerId;
  }
}

function findNextMatch(rounds) {
  for (let r = 0; r < rounds.length; r++) {
    for (let i = 0; i < rounds[r].length; i++) {
      const m = rounds[r][i];
      if (m.winner === null && m.p1 !== null && m.p2 !== null) return { round: r, index: i };
    }
  }
  return null;
}

function champion(rounds) {
  return rounds[rounds.length - 1][0].winner;
}

module.exports = { generateBracket, reportWinner, findNextMatch, champion };
```

- [ ] **Step 4: Kör testet och verifiera att det passerar**

Kör: `cd backend && node --test test/bracket.test.js`
Förväntat: PASS, 8 tester.

- [ ] **Step 5: Kör hela testsviten**

Kör: `cd backend && node --test test/*.test.js`
Förväntat: PASS, inga regressioner.

- [ ] **Step 6: Commit**

```bash
git add backend/bracket.js backend/test/bracket.test.js
git commit -m "feat: bracket-logik för utslagsträd

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Room — `winsNeeded`, `onMatchEnd` och disconnect-vinnare

`Room` får ett options-objekt: parametriserad vinstgräns (bäst av 1/3/5) och en
callback som rapporterar matchvinnaren — även vid disconnect (walkover).
Snabbmatch-beteendet (utan options) ska vara exakt oförändrat.

**Files:**
- Modify: `backend/room.js`
- Test: `backend/test/room.test.js`

**Interfaces:**
- Produces: `new Room(ws1, ws2, opts?)` där `opts = { winsNeeded?: number, onMatchEnd?: (winnerPid: 'p1'|'p2', info: { walkover: boolean }) => void }`. Används av Task 4.

- [ ] **Step 1: Skriv failande tester**

Lägg till sist i `backend/test/room.test.js`:

```js
test('winsNeeded=1: en rundvinst avslutar matchen', () => {
  const ends = [];
  const ws1 = mockWs(), ws2 = mockWs();
  const room = new Room(ws1, ws2, { winsNeeded: 1, onMatchEnd: (w, info) => ends.push([w, info]) });
  clearInterval(room._tick);
  room.state.phase = 'playing';
  room._endRound('p1');
  assert.equal(room.state.phase, 'match_over');
  assert.deepEqual(ends, [['p1', { walkover: false }]]);
});

test('standard är oförändrat: 3 rundvinster krävs', () => {
  const { room } = makeRoom();
  room._endRound('p1');
  assert.equal(room.state.phase, 'round_over');
  room.state.phase = 'playing';
  room._endRound('p1');
  assert.equal(room.state.phase, 'round_over');
  room.state.phase = 'playing';
  room._endRound('p1');
  assert.equal(room.state.phase, 'match_over');
  clearTimeout(room._roundTimer);
});

test('disconnect ger motståndaren matchvinst som walkover', () => {
  const ends = [];
  const ws1 = mockWs(), ws2 = mockWs();
  const room = new Room(ws1, ws2, { onMatchEnd: (w, info) => ends.push([w, info]) });
  clearInterval(room._tick);
  room.state.phase = 'playing';
  ws1.emit('close');
  assert.equal(room.state.phase, 'match_over');
  assert.deepEqual(ends, [['p2', { walkover: true }]]);
});
```

- [ ] **Step 2: Kör testet och verifiera att det failar**

Kör: `cd backend && node --test test/room.test.js`
Förväntat: FAIL — `winsNeeded=1`-testet får `round_over` i stället för `match_over`, walkover-testet får tom `ends`.

- [ ] **Step 3: Implementera i `backend/room.js`**

Konstruktorns signatur och nya fält (rad 17–19):

```js
  constructor(ws1, ws2, opts = {}) {
    this.sockets = { p1: ws1, p2: ws2 };
    this._winsNeeded = opts.winsNeeded ?? ROUNDS_TO_WIN_MATCH;
    this._onMatchEnd = opts.onMatchEnd ?? null;
    this.state = this._initialState();
```

I `_attachHandlers`, skicka med `pid` till close-hanteraren (rad 61):

```js
      ws.on('close', () => this._onDisconnect(pid));
```

I `_endRound`, byt `ROUNDS_TO_WIN_MATCH` mot `this._winsNeeded` (rad 153):

```js
    if (winnerId && this.state.roundScores[winnerId] >= this._winsNeeded) {
```

Sist i `_endMatch` (efter `clearInterval(this._tick);`):

```js
    this._onMatchEnd?.(winnerId, { walkover: false });
```

`_onDisconnect` får pid-parameter och rapporterar motståndaren som vinnare:

```js
  _onDisconnect(pid) {
    if (this.state.phase === 'match_over') return;
    clearTimeout(this._roundTimer);
    clearTimeout(this._startTimer);
    clearInterval(this._tick);
    this.state.phase = 'match_over';
    this._broadcastEvent('opponent_disconnected', {});
    this._onMatchEnd?.(pid === 'p1' ? 'p2' : 'p1', { walkover: true });
  }
```

- [ ] **Step 4: Kör hela testsviten och verifiera pass**

Kör: `cd backend && node --test test/*.test.js`
Förväntat: PASS, inga regressioner.

- [ ] **Step 5: Commit**

```bash
git add backend/room.js backend/test/room.test.js
git commit -m "feat: Room tar winsNeeded och rapporterar matchvinnare via onMatchEnd

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Room — åskådare och `destroy()`

Åskådar-sockets får samma broadcasts som spelarna men har inga
meddelandehanterare (kan inte flytta). `destroy()` behövs eftersom samma
sockets deltar i flera rum under en turnering — utan avregistrering läcker
lyssnare mellan matcher.

**Files:**
- Modify: `backend/room.js`
- Test: `backend/test/room.test.js`

**Interfaces:**
- Consumes: `Room`-options från Task 2.
- Produces: `room.addSpectator(ws)` (skickar `{ type: 'match_start', you: 'spectator' }` + aktuell state) och `room.destroy()` (stoppar timers, avregistrerar alla ws-lyssnare, tömmer åskådarlistan). Används av Task 4.

- [ ] **Step 1: Uppdatera mockWs så den stödjer flera lyssnare och `off`**

Ersätt `mockWs` överst i `backend/test/room.test.js`:

```js
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
```

- [ ] **Step 2: Skriv failande tester**

Lägg till sist i `backend/test/room.test.js`:

```js
test('addSpectator skickar match_start you=spectator och state', () => {
  const { room } = makeRoom();
  const spec = mockWs();
  room.addSpectator(spec);
  assert.deepEqual(spec.messages[0], { type: 'match_start', you: 'spectator' });
  assert.equal(spec.messages[1].type, 'state');
});

test('åskådare får event-broadcasts', () => {
  const { room } = makeRoom();
  const spec = mockWs();
  room.addSpectator(spec);
  room._broadcastEvent('countdown', { duration: 3000 });
  assert.ok(spec.messages.some(m => m.type === 'event' && m.event === 'countdown'));
});

test('destroy avregistrerar lyssnare: close efter destroy gör inget', () => {
  const ends = [];
  const ws1 = mockWs(), ws2 = mockWs();
  const room = new Room(ws1, ws2, { onMatchEnd: (w) => ends.push(w) });
  clearInterval(room._tick);
  room.state.phase = 'playing';
  room.destroy();
  ws1.emit('close');
  assert.equal(room.state.phase, 'playing'); // orört — hanteraren är borta
  assert.deepEqual(ends, []);
});
```

- [ ] **Step 3: Kör testet och verifiera att det failar**

Kör: `cd backend && node --test test/room.test.js`
Förväntat: FAIL med `room.addSpectator is not a function`

- [ ] **Step 4: Implementera i `backend/room.js`**

Lägg till `this.spectators = [];` i konstruktorn (direkt efter `this.sockets = ...`).

Ersätt `_attachHandlers` så hanterarreferenser sparas (funktionskropparna är
oförändrade — de flyttas bara till namngivna konstanter):

```js
  _attachHandlers() {
    this._handlers = [];
    for (const [pid, ws] of Object.entries(this.sockets)) {
      const onMessage = (data) => {
        try {
          const msg = JSON.parse(data);
          if (msg.type === 'move') {
            // Acka seq även för drag som avvisas, så klientens prediction släpper
            if (Number.isFinite(msg.seq)) this._seq[pid] = msg.seq;
            if (this.state.phase === 'playing') this.handleMove(pid, msg.direction);
          } else if (msg.type === 'ready' && this.state.phase === 'lobby') {
            this._handleReady(pid, msg);
          }
        } catch {}
      };
      const onClose = () => this._onDisconnect(pid);
      ws.on('message', onMessage);
      ws.on('close', onClose);
      this._handlers.push({ ws, onMessage, onClose });
    }
  }
```

Nya metoder (lägg dem efter konstruktorn):

```js
  addSpectator(ws) {
    this.spectators.push(ws);
    if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'match_start', you: 'spectator' }));
    this._broadcast();
  }

  destroy() {
    clearTimeout(this._roundTimer);
    clearTimeout(this._startTimer);
    clearInterval(this._tick);
    for (const { ws, onMessage, onClose } of this._handlers) {
      ws.off('message', onMessage);
      ws.off('close', onClose);
    }
    this.spectators.length = 0;
  }
```

I `_broadcast` och `_broadcastEvent`, byt loop-uttrycket till att inkludera åskådare:

```js
    for (const ws of [...Object.values(this.sockets), ...this.spectators]) {
      if (ws.readyState === 1) ws.send(msg);
    }
```

- [ ] **Step 5: Kör hela testsviten och verifiera pass**

Kör: `cd backend && node --test test/*.test.js`
Förväntat: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/room.js backend/test/room.test.js
git commit -m "feat: åskådare i Room samt destroy() för lyssnarstädning

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: `backend/tournament.js`

`Tournament` äger deltagarlista, lottning, matchloop och walkover-logik.
Skapar ett `Room` per match; alla övriga anslutna deltagare blir åskådare.

**Files:**
- Create: `backend/tournament.js`
- Test: `backend/test/tournament.test.js`

**Interfaces:**
- Consumes: `Room` (Task 2+3), `generateBracket/findNextMatch/reportWinner` (Task 1), `SKINS/DEFAULT_SKIN/NAME_MAX_LEN` från `constants.js`.
- Produces: `new Tournament(code, { size, bestOf, graceMs? }, onRelease)` med `join(ws, name, skin, isHost?) → { participant } | { error }`, `start()`, publika fält `code/phase/participants/bracket/currentMatch/room`. `onRelease(tournament)` anropas när turneringen är klar/avbruten/övergiven. Används av Task 5.

- [ ] **Step 1: Skriv failande tester**

Skapa `backend/test/tournament.test.js`:

```js
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
```

- [ ] **Step 2: Kör testet och verifiera att det failar**

Kör: `cd backend && node --test test/tournament.test.js`
Förväntat: FAIL med `Cannot find module '../tournament'`

- [ ] **Step 3: Implementera `backend/tournament.js`**

```js
const Room = require('./room');
const { SKINS, DEFAULT_SKIN, NAME_MAX_LEN } = require('./constants');
const { generateBracket, findNextMatch, reportWinner } = require('./bracket');

const WALKOVER_GRACE_MS = 30000;

class Tournament {
  // onRelease anropas när turneringen är klar/avbruten/övergiven så att
  // managern kan ta bort den och frigöra sockets för ny routing.
  constructor(code, { size, bestOf, graceMs }, onRelease) {
    this.code = code;
    this.size = Math.max(2, Math.min(16, size | 0));
    this.bestOf = [1, 3, 5].includes(bestOf) ? bestOf : 3;
    this.phase = 'gathering'; // gathering | between_matches | match | finished
    this.participants = [];   // { id, ws, name, skin, connected, isHost }
    this.bracket = null;
    this.currentMatch = null; // { round, index } | null
    this.room = null;
    this._roomPids = null;    // { p1: deltagar-id, p2: deltagar-id }
    this._nextId = 1;
    this._graceMs = graceMs ?? WALKOVER_GRACE_MS;
    this._graceTimer = null;
    this._onRelease = onRelease;
    this._released = false;
  }

  join(ws, name, skin, isHost = false) {
    if (this.phase !== 'gathering') return { error: 'already_started' };
    if (this.participants.length >= this.size) return { error: 'tournament_full' };
    name = String(name ?? '').trim().slice(0, NAME_MAX_LEN) || `Spelare ${this._nextId}`;
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
    this.participants.push(p);
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'start_tournament' && p.isHost) this.start();
      } catch {}
    });
    ws.on('close', () => this._onLeave(p));
    this._broadcastState();
    return { participant: p };
  }

  start() {
    if (this.phase !== 'gathering' || this.participants.length < 2) return;
    this.bracket = generateBracket(this.participants.map(p => p.id));
    this._activateNext();
  }

  _activateNext() {
    clearTimeout(this._graceTimer);
    this.room?.destroy();
    this.room = null;
    this._roomPids = null;
    this.currentMatch = findNextMatch(this.bracket);

    if (!this.currentMatch) {
      this.phase = 'finished';
      this._broadcastState();
      this._release();
      return;
    }

    const { round, index } = this.currentMatch;
    const match = this.bracket[round][index];
    const a = this._byId(match.p1);
    const b = this._byId(match.p2);

    if (!a.connected || !b.connected) {
      // Frånkopplad spelare på tur → motståndaren får walkover efter frist
      this.phase = 'between_matches';
      this._broadcastState();
      this._graceTimer = setTimeout(() => {
        const winner = a.connected ? a.id : b.id; // båda borta → b, godtyckligt
        reportWinner(this.bracket, round, index, winner, true);
        this._activateNext();
      }, this._graceMs);
      return;
    }

    this.phase = 'match';
    this._roomPids = { p1: a.id, p2: b.id };
    this.room = new Room(a.ws, b.ws, {
      winsNeeded: Math.ceil(this.bestOf / 2),
      onMatchEnd: (winnerPid, { walkover }) => {
        reportWinner(this.bracket, round, index, this._roomPids[winnerPid], walkover);
        this._activateNext();
      }
    });
    for (const p of this.participants) {
      if (p !== a && p !== b && p.connected) this.room.addSpectator(p.ws);
    }
    this._broadcastState();
  }

  _onLeave(p) {
    if (this._released) return;
    p.connected = false;
    if (this.phase === 'gathering') {
      this.participants = this.participants.filter(x => x !== p);
      if (p.isHost) {
        this._broadcastError('tournament_cancelled');
        this._release();
        return;
      }
      this._broadcastState();
      return;
    }
    if (this.participants.every(x => !x.connected)) {
      this._release();
      return;
    }
    // Disconnect under pågående match sköts av Room → onMatchEnd (walkover)
    this._broadcastState();
  }

  _byId(id) {
    return this.participants.find(p => p.id === id);
  }

  _release() {
    if (this._released) return;
    this._released = true;
    clearTimeout(this._graceTimer);
    this.room?.destroy();
    this.room = null;
    this._onRelease?.(this);
  }

  _broadcastState() {
    if (this._released) return;
    const payload = {
      type: 'tournament_state',
      code: this.code,
      phase: this.phase,
      bestOf: this.bestOf,
      size: this.size,
      participants: this.participants.map(({ id, name, skin, connected, isHost }) =>
        ({ id, name, skin, connected, isHost })),
      bracket: this.bracket,
      currentMatch: this.currentMatch
    };
    for (const p of this.participants) {
      if (p.ws.readyState === 1) p.ws.send(JSON.stringify({ ...payload, you: p.id }));
    }
  }

  _broadcastError(reason) {
    const msg = JSON.stringify({ type: 'error', reason });
    for (const p of this.participants) {
      if (p.ws.readyState === 1) p.ws.send(msg);
    }
  }
}

module.exports = Tournament;
```

OBS: Ordningen i `_onMatchEnd`-flödet: rummet anropar callbacken synkront inifrån
`_endMatch`/`_onDisconnect`; `_activateNext` börjar med `this.room?.destroy()`
vilket är säkert eftersom `_endMatch` redan stoppat tick-intervallet.

- [ ] **Step 4: Kör testet och verifiera att det passerar**

Kör: `cd backend && node --test test/tournament.test.js`
Förväntat: PASS, 11 tester.

- [ ] **Step 5: Kör hela testsviten**

Kör: `cd backend && node --test test/*.test.js`
Förväntat: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/tournament.js backend/test/tournament.test.js
git commit -m "feat: Tournament — samling, lottning, matchloop, walkover

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: `backend/manager.js` — koder och uppslagning

`TournamentManager` genererar unika koder, slår upp turneringar vid join och
städar bort släppta turneringar.

**Files:**
- Create: `backend/manager.js`
- Test: `backend/test/manager.test.js`

**Interfaces:**
- Consumes: `Tournament` (Task 4).
- Produces: `manager.create(ws, msg) → Tournament` (skickar `tournament_created` till ws), `manager.join(ws, msg) → Tournament | null` (skickar `error` vid fel). Vid release anropas `ws.freeRoute?.()` på alla deltagares sockets (sätts av Task 6). Används av Task 6.

- [ ] **Step 1: Skriv failande tester**

Skapa `backend/test/manager.test.js`:

```js
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
  const t = mgr.create(ws, { size: 4, bestOf: 3, name: 'Värd', skin: 'green' });
  const created = ws.messages.find(m => m.type === 'tournament_created');
  assert.match(created.code, /^[A-HJ-NP-Z]{4}$/);
  assert.equal(mgr.tournaments.get(created.code), t);
  assert.equal(t.participants[0].isHost, true);
});

test('join med okänd kod ger error unknown_code', () => {
  const mgr = new TournamentManager();
  const ws = mockWs();
  const res = mgr.join(ws, { code: 'XXXX', name: 'Test', skin: 'green' });
  assert.equal(res, null);
  assert.deepEqual(ws.messages.at(-1), { type: 'error', reason: 'unknown_code' });
});

test('join hittar turneringen oavsett skiftläge i koden', () => {
  const mgr = new TournamentManager();
  const wsHost = mockWs();
  const t = mgr.create(wsHost, { size: 4, bestOf: 3, name: 'Värd', skin: 'green' });
  const ws = mockWs();
  const res = mgr.join(ws, { code: t.code.toLowerCase(), name: 'Gäst', skin: 'blue' });
  assert.equal(res, t);
});

test('avbruten turnering tas bort och deltagarnas routing frigörs', () => {
  const mgr = new TournamentManager();
  const wsHost = mockWs();
  const t = mgr.create(wsHost, { size: 4, bestOf: 3, name: 'Värd', skin: 'green' });
  const ws2 = mockWs();
  mgr.join(ws2, { code: t.code, name: 'Gäst', skin: 'blue' });
  wsHost.emit('close'); // värd lämnar under samling → cancel → release
  assert.equal(mgr.tournaments.has(t.code), false);
  assert.equal(ws2.freed, 1);
});
```

- [ ] **Step 2: Kör testet och verifiera att det failar**

Kör: `cd backend && node --test test/manager.test.js`
Förväntat: FAIL med `Cannot find module '../manager'`

- [ ] **Step 3: Implementera `backend/manager.js`**

```js
const Tournament = require('./tournament');

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // utan I och O — förväxlas lätt

class TournamentManager {
  constructor() {
    this.tournaments = new Map();
  }

  create(ws, msg) {
    const code = this._newCode();
    const t = new Tournament(code, { size: msg.size, bestOf: msg.bestOf },
      (tt) => this._release(tt));
    this.tournaments.set(code, t);
    if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'tournament_created', code }));
    t.join(ws, msg.name, msg.skin, true); // kan inte misslyckas i tom turnering
    return t;
  }

  join(ws, msg) {
    const code = String(msg.code ?? '').trim().toUpperCase();
    const t = this.tournaments.get(code);
    if (!t) {
      if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'error', reason: 'unknown_code' }));
      return null;
    }
    const res = t.join(ws, msg.name, msg.skin);
    if (res.error) {
      if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'error', reason: res.error }));
      return null;
    }
    return t;
  }

  _newCode() {
    let code;
    do {
      code = Array.from({ length: 4 },
        () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
    } while (this.tournaments.has(code));
    return code;
  }

  _release(t) {
    this.tournaments.delete(t.code);
    for (const p of t.participants) p.ws.freeRoute?.();
  }
}

module.exports = TournamentManager;
```

- [ ] **Step 4: Kör hela testsviten och verifiera pass**

Kör: `cd backend && node --test test/*.test.js`
Förväntat: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/manager.js backend/test/manager.test.js
git commit -m "feat: TournamentManager med koder och städning

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Routing i `server.js` — första meddelandet väljer väg

Tidigare hamnade varje anslutning direkt i snabbmatch-kön. Nu väntar servern
på klientens första meddelande: `quick_match`, `create_tournament` eller
`join_tournament`. OBS: gamla cachade frontend-klienter skickar inget första
meddelande och blir stående — frontend och backend måste deployas ihop
(sker automatiskt vid push till master).

**Files:**
- Modify: `backend/server.js`

**Interfaces:**
- Consumes: `TournamentManager` (Task 5), `Lobby`, `Room`.
- Produces: klientprotokoll `{ type: 'quick_match' }` som ingång till dagens kö. Används av Task 8.

- [ ] **Step 1: Uppdatera `backend/server.js`**

Ersätt import-blocket och connection-hanteraren (heartbeat och HTTP-servern
är oförändrade):

```js
const http = require('http');
const { WebSocketServer } = require('ws');
const Lobby = require('./lobby');
const Room = require('./room');
const TournamentManager = require('./manager');

const PORT = process.env.PORT || 3000;
const HEARTBEAT_MS = 10000;

const server = http.createServer((_req, res) => {
  res.writeHead(200);
  res.end('Frogger Multiplayer');
});

const wss = new WebSocketServer({ server });
const lobby = new Lobby((ws1, ws2) => new Room(ws1, ws2));
const tournaments = new TournamentManager();

wss.on('connection', (ws) => {
  ws._socket.setNoDelay(true); // Nagle buffrar annars små paket upp till ~40 ms
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  // Första meddelandet väljer väg. freeRoute öppnar för omval,
  // t.ex. efter en avbruten turnering.
  let routed = false;
  ws.freeRoute = () => { routed = false; };
  ws.on('message', (data) => {
    if (routed) return;
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    if (msg.type === 'quick_match') {
      routed = true;
      lobby.join(ws);
    } else if (msg.type === 'create_tournament') {
      routed = true;
      tournaments.create(ws, msg);
    } else if (msg.type === 'join_tournament') {
      routed = !!tournaments.join(ws, msg);
    }
  });
});
```

- [ ] **Step 2: Verifiera manuellt mot körande server**

Starta servern i bakgrunden: `cd backend && node server.js`

Kör i ett annat skal:

```bash
cd backend && node -e "
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:3000');
ws.on('open', () => ws.send(JSON.stringify({ type: 'create_tournament', size: 4, bestOf: 3, name: 'Test', skin: 'green' })));
ws.on('message', (d) => console.log(d.toString()));
setTimeout(() => process.exit(0), 1000);
"
```

Förväntat: en `tournament_created`-rad med kod + en `tournament_state`-rad med
`"phase":"gathering"`. Stoppa servern efteråt.

- [ ] **Step 3: Kör hela testsviten**

Kör: `cd backend && node --test test/*.test.js`
Förväntat: PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/server.js
git commit -m "feat: routing — quick_match/create_tournament/join_tournament

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Frontend `GameState` — turneringsmeddelanden, mode och session-reset

`GameState` får `mode` (`null | 'quick' | 'tournament'`, härlett från
servermeddelanden), `tournament` (senaste `tournament_state`), `profile`
(namn/skin från startskärmen), `lastError` samt `resetSession()`.
Åskådare (`you === 'spectator'`) blockeras redan i `predictMove` av den
befintliga `this.players[this.you]`-guarden.

**Files:**
- Modify: `frontend/js/game.js`
- Test: `backend/test/gamestate.test.js`

**Interfaces:**
- Produces: `state.mode`, `state.tournament`, `state.profile = { name, skin }`, `state.lastError`, `state.resetSession()`. Används av Task 8, 9, 10.

- [ ] **Step 1: Skriv failande tester**

Lägg till sist i `backend/test/gamestate.test.js`:

```js
test('waiting sätter mode quick, tournament_state sätter mode tournament', async () => {
  const { GameState } = await import('../../frontend/js/game.js');
  const gs = new GameState();
  assert.equal(gs.mode, null);
  gs.applyMessage({ type: 'waiting' }, 0);
  assert.equal(gs.mode, 'quick');
  const gs2 = new GameState();
  gs2.applyMessage({ type: 'tournament_state', code: 'ABCD', phase: 'gathering' }, 0);
  assert.equal(gs2.mode, 'tournament');
  assert.equal(gs2.tournament.code, 'ABCD');
});

test('error sparas i lastError; tournament_cancelled nollställer sessionen', async () => {
  const { GameState } = await import('../../frontend/js/game.js');
  const gs = new GameState();
  gs.applyMessage({ type: 'tournament_state', code: 'ABCD', phase: 'gathering' }, 0);
  gs.applyMessage({ type: 'error', reason: 'tournament_cancelled' }, 0);
  assert.equal(gs.lastError, 'tournament_cancelled');
  assert.equal(gs.mode, null);
  assert.equal(gs.tournament, null);
});

test('opponent_disconnected sätter inte disconnected-fas i turneringsläge', async () => {
  const { GameState } = await import('../../frontend/js/game.js');
  const gs = new GameState();
  gs.applyMessage({ type: 'tournament_state', code: 'ABCD', phase: 'match' }, 0);
  gs.applyMessage({ type: 'match_start', you: 'spectator' }, 0);
  gs.applyMessage({ type: 'event', event: 'opponent_disconnected' }, 0);
  assert.notEqual(gs.phase, 'disconnected');
});

test('spectator kan inte prediktera drag', async () => {
  const { GameState } = await import('../../frontend/js/game.js');
  const gs = new GameState();
  gs.applyMessage({ type: 'match_start', you: 'spectator' }, 0);
  gs.applyMessage({
    type: 'state',
    players: { p1: { x: 5, y: 14 }, p2: { x: 7, y: 14 } },
    seed: 42, tick: 0, round: 1, roundScores: { p1: 0, p2: 0 },
    phase: 'playing', ack: {}
  }, 0);
  assert.equal(gs.predictMove('up'), null);
});
```

- [ ] **Step 2: Kör testet och verifiera att det failar**

Kör: `cd backend && node --test test/gamestate.test.js`
Förväntat: FAIL — `gs.mode` är `undefined`, `resetSession` saknas.

- [ ] **Step 3: Implementera i `frontend/js/game.js`**

Ersätt konstruktorn med (nytt: `mode`, `profile`, `tournament`, `lastError`;
`phase` börjar som `'idle'` — startskärmen visas tills servern svarat):

```js
  constructor() {
    this.mode        = null;   // null | 'quick' | 'tournament'
    this.profile     = { name: '', skin: 'green' };
    this.tournament  = null;   // senaste tournament_state
    this.lastError   = null;
    this.phase       = 'idle';
    this.you         = null;
    this.players     = { p1: null, p2: null };
    this.round       = 1;
    this.roundScores = { p1: 0, p2: 0 };
    this.lastEvent   = null;
    this.seed        = null;
    this._base       = [];   // hindren vid tick 0, från generateLanes(seed)
    this._serverTick = 0;
    this._tickAt     = 0;    // lokal tidsstämpel för senaste servertick
    this._seq        = 0;    // senast skickade drag-seq
  }

  // Tillbaka till startskärmen (avbruten turnering / tappad anslutning).
  // profile och lastError behålls medvetet.
  resetSession() {
    this.mode        = null;
    this.tournament  = null;
    this.phase       = 'idle';
    this.you         = null;
    this.players     = { p1: null, p2: null };
    this.round       = 1;
    this.roundScores = { p1: 0, p2: 0 };
    this.lastEvent   = null;
    this.seed        = null;
    this._base       = [];
    this._serverTick = 0;
    this._seq        = 0;
  }
```

I `applyMessage`: sätt mode i `waiting`-grenen:

```js
    if (msg.type === 'waiting') {
      this.mode  = 'quick';
      this.phase = 'waiting';
    } else if (msg.type === 'match_start') {
```

Lägg till nya grenar före `} else if (msg.type === 'event') {`:

```js
    } else if (msg.type === 'tournament_created') {
      this.mode = 'tournament';
    } else if (msg.type === 'tournament_state') {
      this.mode       = 'tournament';
      this.tournament = msg;
    } else if (msg.type === 'error') {
      this.lastError = msg.reason;
      if (msg.reason === 'tournament_cancelled') this.resetSession();
```

I `event`-grenen, gör disconnected-fasen villkorad:

```js
      if (msg.event === 'opponent_disconnected' && this.mode !== 'tournament') {
        this.phase = 'disconnected';
      }
```

- [ ] **Step 4: Kör hela testsviten och verifiera pass**

Kör: `cd backend && node --test test/*.test.js`
Förväntat: PASS (inklusive sim-consistency — `sim.js` är orörd).

- [ ] **Step 5: Commit**

```bash
git add frontend/js/game.js backend/test/gamestate.test.js
git commit -m "feat: GameState — mode, tournament_state, lastError, resetSession

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Startskärm — mode-val, namn/skin, kod

Ny `#start`-panel med namn/skin + tre vägar: Snabbmatch, Skapa turnering
(antal + bäst av), Gå med (kod, förifylld från `?code=`). Befintliga
`#lobby`-panelen visas bara i quick-läget. `net.js` nollställer sessionen vid
tappad anslutning.

**Files:**
- Modify: `frontend/index.html`
- Modify: `frontend/style.css`
- Create: `frontend/js/start-ui.js`
- Modify: `frontend/js/net.js`
- Modify: `frontend/js/lobby-ui.js`
- Modify: `frontend/js/main.js`

**Interfaces:**
- Consumes: `state.mode/profile/lastError` (Task 7), `{ type: 'quick_match' }` (Task 6).
- Produces: `StartUI` med `update()` för rAF-loopen; sätter `state.profile` innan create/join skickas. DOM-id:n `start-name`, `start-skins` används inte av andra moduler.

- [ ] **Step 1: Lägg till startpanelen i `frontend/index.html`**

Före `<div id="lobby" ...>`:

```html
  <div id="start" class="lobby">
    <h1>Frogger Multiplayer</h1>
    <input id="start-name" maxlength="20" placeholder="Ditt namn" autocomplete="nickname">
    <div class="skins" id="start-skins">
      <button class="skin" data-skin="green" aria-label="Grön"></button>
      <button class="skin" data-skin="yellow" aria-label="Gul"></button>
      <button class="skin" data-skin="blue" aria-label="Blå"></button>
    </div>
    <button id="start-quick" class="primary">Snabbmatch</button>
    <div class="start-row">
      <select id="start-size"></select>
      <select id="start-bestof">
        <option value="1">Bäst av 1</option>
        <option value="3" selected>Bäst av 3</option>
        <option value="5">Bäst av 5</option>
      </select>
      <button id="start-create" class="primary">Skapa turnering</button>
    </div>
    <div class="start-row">
      <input id="start-code" maxlength="4" placeholder="KOD">
      <button id="start-join" class="primary">Gå med</button>
    </div>
    <p id="start-error" class="error"></p>
  </div>
```

- [ ] **Step 2: Utöka `frontend/style.css`**

Generalisera Redo-knappens stil: byt selektorerna `#lobby-ready` →
`#lobby-ready, .primary` och `#lobby-ready:disabled` →
`#lobby-ready:disabled, .primary:disabled`. Lägg sedan till sist i filen:

```css
.start-row { display: flex; gap: 0.5rem; align-items: center; }

.lobby select {
  font: inherit;
  font-size: 1rem;
  padding: 0.5rem;
  background: #222;
  color: #fff;
  border: 1px solid #555;
  border-radius: 4px;
}

#start-code { width: 6.5rem; text-transform: uppercase; }

.error { color: #ff6666; min-height: 1.2em; }
```

- [ ] **Step 3: Skapa `frontend/js/start-ui.js`**

```js
const ERROR_TEXTS = {
  unknown_code: 'Ingen turnering med den koden.',
  tournament_full: 'Turneringen är full.',
  name_taken: 'Namnet är upptaget — välj ett annat.',
  already_started: 'Turneringen har redan startat.',
  tournament_cancelled: 'Värden lämnade — turneringen avbröts.',
  connection_lost: 'Anslutningen bröts. Välj läge för att börja om.'
};

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

    for (let n = 2; n <= 16; n++) {
      const opt = document.createElement('option');
      opt.value = n;
      opt.textContent = `${n} spelare`;
      if (n === 8) opt.selected = true;
      this._size.appendChild(opt);
    }

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
    const text = ERROR_TEXTS[this._state.lastError] ?? '';
    if (this._error.textContent !== text) this._error.textContent = text;
  }
}
```

- [ ] **Step 4: Gata lobbypanelen på mode i `frontend/js/lobby-ui.js`**

I `update()`, byt visibility-raden:

```js
    const visible = s.mode === 'quick' && (s.phase === 'waiting' || s.phase === 'lobby');
```

- [ ] **Step 5: Session-reset vid tappad anslutning i `frontend/js/net.js`**

I `open`-lyssnaren, sätt flaggan:

```js
    this._ws.addEventListener('open', () => {
      this._wasOpen = true;
      console.log('Ansluten till server');
    });
```

I `close`-lyssnaren, före reconnect-timern:

```js
    this._ws.addEventListener('close', () => {
      if (this._wasOpen) {
        this._wasOpen = false;
        this.state.resetSession();
        this.state.lastError = 'connection_lost';
      }
      console.log('Frånkopplad — försöker igen om 3s');
      this._reconnectTimer = setTimeout(() => this._connect(), 3000);
    });
```

- [ ] **Step 6: Koppla in i `frontend/js/main.js`**

```js
import { StartUI } from './start-ui.js';
```

Efter `const lobbyUi = ...`:

```js
const startUi = new StartUI(net, state);
```

I `loop()`, före `lobbyUi.update();`:

```js
  startUi.update();
```

- [ ] **Step 7: Verifiera manuellt i webbläsare**

Starta backend: `cd backend && node server.js` (bakgrund).
Servera frontend: `npx --yes http-server frontend -p 8080 -c-1` (bakgrund).
Öppna två flikar på `http://localhost:8080`:

1. Startskärmen visas i båda (namn, skins, Snabbmatch, Skapa turnering, Gå med).
2. Skriv namn i båda, klicka **Snabbmatch** i båda → lobbypanelen ("Motspelare hittad") visas med namnet förifyllt → Redo i båda → nedräkning → spel fungerar med piltangenter.
3. Ladda om båda flikarna; klicka **Gå med** med kod `XXXX` → felet "Ingen turnering med den koden." visas.

Stoppa båda bakgrundsprocesserna efteråt.

- [ ] **Step 8: Kör backendsviten och committa**

Kör: `cd backend && node --test test/*.test.js` — förväntat PASS.

```bash
git add frontend/index.html frontend/style.css frontend/js/start-ui.js frontend/js/net.js frontend/js/lobby-ui.js frontend/js/main.js
git commit -m "feat: startskärm med snabbmatch/skapa turnering/gå med

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Turneringspanel — samling, träd och Redo

`TournamentUI` renderar samlingsvyn och utslagsträdet som ren funktion av
senaste `tournament_state`. Trädet visas mellan matcher (rummets fas `lobby`),
i walkover-väntan (`between_matches`) och efter finalen (`finished`).
Redo-knappen visas för de två spelarna i nästa match.

**Files:**
- Modify: `frontend/index.html`
- Modify: `frontend/style.css`
- Create: `frontend/js/tournament-ui.js`
- Modify: `frontend/js/main.js`

**Interfaces:**
- Consumes: `state.tournament/profile/mode/phase` (Task 7), `{ type: 'start_tournament' }` och `{ type: 'ready', name, skin }` (backendprotokoll).
- Produces: `TournamentUI` med `update()` för rAF-loopen.

- [ ] **Step 1: Lägg till panelen i `frontend/index.html`**

Efter `</div>` för `#lobby`:

```html
  <div id="tournament" class="lobby hidden">
    <h1>Turnering</h1>
    <p class="code-row">Kod: <strong id="t-code"></strong> <button id="t-copy">Kopiera länk</button></p>
    <div id="t-players"></div>
    <button id="t-start" class="primary hidden">Lotta &amp; starta</button>
    <div id="t-bracket" class="hidden"></div>
    <button id="t-ready" class="primary hidden">Redo</button>
    <p id="t-status"></p>
  </div>
```

- [ ] **Step 2: Lägg till träd-stilar sist i `frontend/style.css`**

```css
.code-row strong { font-size: 1.5rem; letter-spacing: 0.2em; color: #ffe100; }

#t-copy {
  font: inherit;
  margin-left: 0.5rem;
  padding: 0.25rem 0.75rem;
  background: #333;
  color: #fff;
  border: 1px solid #555;
  border-radius: 4px;
  cursor: pointer;
}

#t-players p { color: #fff; }

#t-bracket {
  display: flex;
  gap: 1rem;
  max-width: 95vw;
  overflow-x: auto;
  padding: 0 1rem;
}

.b-round {
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  gap: 0.75rem;
}

.b-match { border: 1px solid #555; border-radius: 4px; min-width: 9rem; }

.b-match.current { border-color: #ffe100; }

.b-player { padding: 0.3rem 0.6rem; border-bottom: 1px solid #333; color: #ccc; }

.b-player:last-child { border-bottom: none; }

.b-player.winner { color: #00e64d; font-weight: bold; }

.b-note { padding: 0 0.6rem 0.3rem; font-size: 0.75rem; color: #888; }
```

- [ ] **Step 3: Skapa `frontend/js/tournament-ui.js`**

```js
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

export class TournamentUI {
  constructor(net, state) {
    this._net = net;
    this._state = state;
    this._sentReadyFor = null; // 'round:index' som Redo redan skickats för
    this._renderedJson = null;

    this._root    = document.getElementById('tournament');
    this._codeEl  = document.getElementById('t-code');
    this._players = document.getElementById('t-players');
    this._bracket = document.getElementById('t-bracket');
    this._start   = document.getElementById('t-start');
    this._ready   = document.getElementById('t-ready');
    this._status  = document.getElementById('t-status');

    document.getElementById('t-copy').addEventListener('click', () => {
      const code = this._state.tournament?.code ?? '';
      navigator.clipboard?.writeText(`${location.origin}${location.pathname}?code=${code}`);
    });
    this._start.addEventListener('click', () => this._net.send({ type: 'start_tournament' }));
    this._ready.addEventListener('click', () => {
      const cur = this._state.tournament?.currentMatch;
      if (cur) this._sentReadyFor = `${cur.round}:${cur.index}`;
      this._net.send({
        type: 'ready',
        name: this._state.profile.name,
        skin: this._state.profile.skin
      });
    });
  }

  // Anropas från rAF-loopen
  update() {
    const s = this._state;
    const t = s.tournament;
    const visible = s.mode === 'tournament' && !!t &&
      (t.phase === 'gathering' || t.phase === 'between_matches' ||
       t.phase === 'finished' || s.phase === 'lobby');
    this._root.classList.toggle('hidden', !visible);
    if (!visible) return;

    // Bygg bara om DOM när innehållet ändrats
    const json = JSON.stringify([t, s.phase, this._sentReadyFor]);
    if (json === this._renderedJson) return;
    this._renderedJson = json;

    this._codeEl.textContent = t.code;
    const me = t.participants.find(p => p.id === t.you);

    if (t.phase === 'gathering') {
      this._players.classList.remove('hidden');
      this._bracket.classList.add('hidden');
      this._ready.classList.add('hidden');
      this._players.replaceChildren(...t.participants.map(p =>
        el('p', null, `${p.name}${p.isHost ? ' (värd)' : ''}`)));
      this._status.textContent = `${t.participants.length} av ${t.size} anslutna`;
      this._start.classList.toggle('hidden', !me?.isHost || t.participants.length < 2);
      return;
    }

    this._players.classList.add('hidden');
    this._start.classList.add('hidden');
    this._bracket.classList.remove('hidden');
    this._renderBracket(t);

    if (t.phase === 'finished') {
      const champ = t.participants.find(p => p.id === t.bracket.at(-1)[0].winner);
      this._status.textContent = `🏆 ${champ?.name ?? '?'} vann turneringen! Ladda om sidan för att spela igen.`;
      this._ready.classList.add('hidden');
      return;
    }

    const cur = t.currentMatch && t.bracket[t.currentMatch.round][t.currentMatch.index];
    const inMatch = !!cur && (cur.p1 === t.you || cur.p2 === t.you);
    const key = t.currentMatch && `${t.currentMatch.round}:${t.currentMatch.index}`;
    const showReady = inMatch && s.phase === 'lobby' && this._sentReadyFor !== key;
    this._ready.classList.toggle('hidden', !showReady);
    this._status.textContent = inMatch
      ? (showReady ? 'Din match står på tur — gör dig redo!' : 'Väntar på motståndaren…')
      : 'Du är åskådare i nästa match.';
  }

  _renderBracket(t) {
    const nameOf = (id) => id == null
      ? '(frilott)'
      : (t.participants.find(p => p.id === id)?.name ?? '?');
    const cols = t.bracket.map((round, r) => {
      const col = el('div', 'b-round');
      round.forEach((m, i) => {
        const isCurrent = t.currentMatch && t.currentMatch.round === r && t.currentMatch.index === i;
        const box = el('div', 'b-match' + (isCurrent ? ' current' : ''));
        for (const pid of [m.p1, m.p2]) {
          box.appendChild(el('div',
            'b-player' + (m.winner != null && pid === m.winner ? ' winner' : ''),
            pid == null && r > 0 ? '…' : nameOf(pid)));
        }
        // Frilotter (p2 === null) har egen text — b-note bara för riktiga walkovers
        if (m.walkover && m.p2 != null) box.appendChild(el('div', 'b-note', 'walkover'));
        col.appendChild(box);
      });
      return col;
    });
    this._bracket.replaceChildren(...cols);
  }
}
```

- [ ] **Step 4: Koppla in i `frontend/js/main.js`**

```js
import { TournamentUI } from './tournament-ui.js';
```

Efter `const startUi = ...`:

```js
const tournamentUi = new TournamentUI(net, state);
```

I `loop()`, efter `lobbyUi.update();`:

```js
  tournamentUi.update();
```

- [ ] **Step 5: Verifiera manuellt i webbläsare**

Starta backend och frontend-server som i Task 8 Step 7. Öppna fyra flikar:

1. Flik 1: namn "Anna", **Skapa turnering**, 4 spelare, bäst av 1 → samlingsvyn med kod visas.
2. Flik 2–4: namn "Bertil"/"Cesar"/"Doris", **Gå med** med koden → deltagarlistan fylls på i alla flikar.
3. Flik 1: **Lotta & starta** → trädet visas i alla flikar; de två i första matchen ser Redo-knappen, övriga ser "Du är åskådare i nästa match."
4. Redo i de två flikarna → nedräkning → matchen syns i realtid i ALLA fyra flikar (åskådarnas hinder rör sig mjukt).
5. Låt ena spelaren vinna rundan (bäst av 1) → trädet visas igen med vinnaren markerad och nästa match highlightad.
6. Spela klart turneringen → 🏆-status med vinnarens namn.
7. Nytt försök: skapa turnering i flik 1, gå med i flik 2, stäng flik 1 (värden) → flik 2 återgår till startskärmen med "Värden lämnade — turneringen avbröts."

Stoppa bakgrundsprocesserna efteråt.

- [ ] **Step 6: Kör backendsviten och committa**

Kör: `cd backend && node --test test/*.test.js` — förväntat PASS.

```bash
git add frontend/index.html frontend/style.css frontend/js/tournament-ui.js frontend/js/main.js
git commit -m "feat: turneringspanel med samling, utslagsträd och redo-flöde

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Renderer — spelarnamn och åskådar-HUD

Namn ritas ovanför grodorna (värdefullt även för spelare). Åskådare får en
egen HUD-rad — dagens HUD antar `you` är `p1`/`p2` och skulle annars ritas tom.

**Files:**
- Modify: `frontend/js/renderer.js`

**Interfaces:**
- Consumes: `state.you === 'spectator'` (sätts av `match_start`, Task 7 hanterar meddelandet).

- [ ] **Step 1: Rita namn i `_drawPlayers`**

Sist i loopen i `_drawPlayers` (efter `ctx.fillText(pid === state.you ? 'DU' : ...)`):

```js
      if (p.name) {
        ctx.fillStyle = '#fff';
        ctx.font = `${cell * 0.28}px monospace`;
        // Clampa så namnet inte hamnar utanför canvasen på målraden
        ctx.fillText(p.name, p.x * cell + cell / 2, Math.max(10, p.y * cell - 8));
      }
```

- [ ] **Step 2: Åskådar-HUD i `_drawHUD`**

Direkt efter `ctx.textBaseline = 'middle';` i `_drawHUD`, före `const you = state.you;`:

```js
    if (state.you === 'spectator') {
      const a = state.players.p1, b = state.players.p2;
      if (a && b) {
        ctx.fillText(
          `Åskådare  |  Runda ${state.round}  |  ${a.name}: ♥${a.lives} Mål:${a.score}  |  ${b.name}: ♥${b.lives} Mål:${b.score}  |  Match: ${state.roundScores.p1}–${state.roundScores.p2}`,
          8, 16
        );
      }
      return;
    }
```

(Rundvinst-/matchvinstoverlays fungerar redan för åskådare: `w === state.you`
är alltid falskt så vinnarens namn visas via `_name()`.)

- [ ] **Step 3: Verifiera manuellt**

Kör turneringsscenariot från Task 9 Step 5 (punkt 1–4) och kontrollera:
- Namn visas ovanför båda grodorna för spelare och åskådare.
- Åskådarfliken visar HUD-raden som börjar med "Åskådare".
- Åskådarfliken visar overlay "X vann rundan"/"X vann matchen" med rätt namn.

- [ ] **Step 4: Commit**

```bash
git add frontend/js/renderer.js
git commit -m "feat: spelarnamn ovanför grodor och åskådar-HUD

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: End-to-end-verifiering, dokumentation och push

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Kör hela testsviten**

Kör: `cd backend && node --test test/*.test.js`
Förväntat: PASS, alla filer.

- [ ] **Step 2: Fullt manuellt E2E-pass**

Starta backend + frontend-server (som Task 8 Step 7). Verifiera:

1. **Snabbmatch-regression:** två flikar → Snabbmatch → Redo → spela en runda. Fungerar som före ändringarna.
2. **Turnering med frilott:** skapa turnering med 4 platser men starta med 3 deltagare → trädet visar "(frilott)" och den frilottade går direkt till final.
3. **Walkover under match:** starta match, stäng ena spelarens flik → motståndaren skrivs in som vinnare med "walkover"-notis i trädet, flödet fortsätter.
4. **Walkover i väntan:** i en 4-spelarturnering, stäng en flik vars match inte pågår → när matchen står på tur väntar trädet i 30 s och ger sedan walkover.
5. **Länk-join:** kopiera länken, öppna i ny flik → koden är förifylld.

Stoppa bakgrundsprocesserna efteråt.

- [ ] **Step 3: Uppdatera `CLAUDE.md`**

I backend-fillistan, lägg till efter raden om `lobby.js`:

```
bracket.js     Ren utslagsträdslogik: generateBracket/findNextMatch/reportWinner/champion
tournament.js  Turnering: samling, lottning, en match i taget via Room, walkover-hantering
manager.js     TournamentManager: Map<kod, Tournament>, kodgenerering, städning
```

Uppdatera `room.js`-raden till:

```
room.js        Spelrum för ett par (+ åskådare). Hanterar move-meddelanden, tick-loop, broadcast. Opts: winsNeeded, onMatchEnd
```

I frontend-fillistan, lägg till efter raden om `lobby-ui.js`:

```
start-ui.js    Startskärm: namn/skin + Snabbmatch / Skapa turnering / Gå med (kod, ?code= i URL)
tournament-ui.js  Turneringspanel: samlingsvy och utslagsträd; Redo-knapp för nästa matchpar
```

I avsnittet **Nätverksprotokoll**, ersätt "Klient → server:"-listan med:

```
Klient → server:
- Första meddelandet väljer väg: `{ type: 'quick_match' }` (dagens kö), `{ type: 'create_tournament', size, bestOf, name, skin }` eller `{ type: 'join_tournament', code, name, skin }`
- `{ type: 'start_tournament' }` — endast värd, i fas gathering
- `{ type: 'ready', name, skin }` — i rummets lobby-fas; namn trimmas (max 20), skin valideras mot SKINS
- `{ type: 'move', direction: 'up'|'down'|'left'|'right', seq }` (`seq` = löpnummer för prediction; servern ackar även avvisade drag)
```

Och i "Server → klient:"-listan, uppdatera `match_start`-raden och lägg till turneringsmeddelanden:

```
- `{ type: 'match_start', you: 'p1'|'p2'|'spectator' }` — matchad; rummet börjar i fas `lobby`; åskådare får samma state/event-ström men kan inte flytta
- `{ type: 'tournament_created', code }` / `{ type: 'tournament_state', code, phase, bestOf, size, participants, bracket, currentMatch, you }` — phase: `gathering|between_matches|match|finished`
- `{ type: 'error', reason }` — t.ex. `unknown_code`, `tournament_full`, `name_taken`, `tournament_cancelled`
```

Lägg till sist i protokollavsnittet:

```
Turneringar (`tournament.js`): rak utslagning 2–16 spelare, bäst av 1/3/5 per match
(`winsNeeded = ceil(bestOf/2)`), en match i taget — övriga är åskådare. Frilotter vid
icke-2-potens. Walkover vid disconnect (30 s frist för väntande). Ingen reconnect till
pågående turnering. Spec: docs/superpowers/specs/2026-07-05-turneringslage-design.md
```

- [ ] **Step 4: Commit och push**

```bash
git add CLAUDE.md
git commit -m "docs: turneringsläge i CLAUDE.md

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push
```

(Push till master triggar GitHub Pages-deployen av frontend; Render deployar
backend från samma push. Frontend har ingen service worker — ingen cache-bump behövs.)
