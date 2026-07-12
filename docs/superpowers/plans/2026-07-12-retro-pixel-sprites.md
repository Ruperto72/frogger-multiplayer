# Retro pixel-sprites (groda/padda) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ersätt de enfärgade cirklarna i `renderer.js` med kantiga 8-bit pixel-art-sprites för groda (p1) och padda (p2), färgtonade per skin, riktningsberoende för grodan, plus uppdaterade standardnamn och PWA-appikoner.

**Architecture:** Ny ren modul `frontend/js/sprites.js` äger pixel-grids och färgpaletter samt en `drawSprite`-funktion som ritar dem med `fillRect`. `GameState` (frontend/js/game.js) får en liten riktningsspårare härledd lokalt ur positionsändringar — protokollet ändras inte. `renderer.js` byter ut cirkelritningen mot `drawSprite`. Separat, orelaterad kod: `DEFAULT_NAMES` i backend + PWA-ikoner.

**Tech Stack:** Vanilla ES6-moduler (frontend), CommonJS + `node --test` (backend), Canvas 2D API. Inga nya beroenden.

## Global Constraints

- Inga nya npm-beroenden (spec: PWA-ikoner ska INTE dra in ett canvas/PNG-bibliotek).
- Nätverksprotokollet mellan klient och server ändras inte i något av dessa tasks.
- `backend/constants.js` `SKINS = ['green', 'yellow', 'blue']` ändras inte — färgsubstitutionen för paddan sker enbart i frontend.
- Testkommando: `cd backend && node --test test/*.test.js` (glob-formen — katalogformen fungerar inte på Node v24).
- Cellstorlek i spelet är `CELL = 48px` (`frontend/js/main.js:12`); pixel-grids är 12×12 → 4px per pixel.

---

### Task 1: `frontend/js/sprites.js` — pixel-grids, paletter, ritning

**Files:**
- Create: `frontend/js/sprites.js`
- Test: `backend/test/sprites.test.js` (dynamic import av frontend-modulen, samma mönster som `backend/test/gamestate.test.js` använder för `frontend/js/game.js` — ren JS utan DOM-beroenden testas via `node --test` i backend)

**Interfaces:**
- Produces: `getGrid(animal, direction)` → `number[][]` (12×12, värden 0–5). `animal` är `'frog' | 'toad'`, `direction` är `'up' | 'down' | 'left' | 'right'`; okänd/saknad `direction` → grid för `'up'`.
- Produces: `getPalette(skin, animal)` → `{ 1: string, 2: string, 3: '#f4f4e6', 4: '#111', 5: string }` (hex-färger). Okänt/saknat `skin` → paletten för `'green'`.
- Produces: `drawSprite(ctx, { animal, direction, skin, cx, cy, cellSize })` → ritar gridet centrerat på `(cx, cy)` inom en ruta av storlek `cellSize` via `ctx.fillRect`.
- Consumes: inget (bottenmodul).

- [ ] **Step 1: Skriv testfilen med failing tests**

```js
// backend/test/sprites.test.js
const { test } = require('node:test');
const assert = require('node:assert/strict');

async function loadSprites() {
  return import('../../frontend/js/sprites.js');
}

test('getGrid returnerar frog-up som standard vid okänd riktning', async () => {
  const { getGrid } = await loadSprites();
  const up = getGrid('frog', 'up');
  const fallback = getGrid('frog', 'sideways');
  assert.deepEqual(fallback, up);
});

test('getGrid frog-right är horisontell spegling av frog-left', async () => {
  const { getGrid } = await loadSprites();
  const left = getGrid('frog', 'left');
  const right = getGrid('frog', 'right');
  const mirrored = left.map(row => [...row].reverse());
  assert.deepEqual(right, mirrored);
});

test('getGrid padda är samma grid oavsett riktning', async () => {
  const { getGrid } = await loadSprites();
  const up = getGrid('toad', 'up');
  assert.deepEqual(getGrid('toad', 'down'), up);
  assert.deepEqual(getGrid('toad', 'left'), up);
  assert.deepEqual(getGrid('toad', 'right'), up);
});

test('getGrid grodans upp-grid har rätt dimensioner och ögon', async () => {
  const { getGrid } = await loadSprites();
  const up = getGrid('frog', 'up');
  assert.equal(up.length, 12);
  assert.ok(up.every(row => row.length === 12));
  assert.equal(up[1][2], 3); // vänster ögonvitt
  assert.equal(up[1][3], 4); // vänster pupill
});

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

test('drawSprite ritar en fillRect per icke-transparent pixel', async () => {
  const { drawSprite } = await loadSprites();
  const calls = [];
  const ctx = {
    set fillStyle(v) { calls.push({ style: v, rects: [] }); },
    fillRect(x, y, w, h) { calls.at(-1).rects.push([x, y, w, h]); }
  };
  drawSprite(ctx, { animal: 'frog', direction: 'up', skin: 'green', cx: 24, cy: 24, cellSize: 48 });
  const totalRects = calls.reduce((n, c) => n + c.rects.length, 0);
  assert.ok(totalRects > 0);
  // Alla rektanglar är 4×4 (48/12) och inom cellens 0..48-ruta relativt cx-24/cy-24
  for (const c of calls) {
    for (const [x, y, w, h] of c.rects) {
      assert.equal(w, 4);
      assert.equal(h, 4);
      assert.ok(x >= 0 && x <= 44);
      assert.ok(y >= 0 && y <= 44);
    }
  }
});
```

- [ ] **Step 2: Kör testerna och verifiera att de faller**

Run: `cd backend && node --test test/sprites.test.js`
Expected: FAIL — `Cannot find module '../../frontend/js/sprites.js'`

- [ ] **Step 3: Skapa `frontend/js/sprites.js`**

```js
// frontend/js/sprites.js
// 0 transparent, 1 kropp, 2 kontur/detaljer, 3 ögonvitt, 4 pupill, 5 mage/ljus buk

const FROG_UP = [
  [0,1,1,0,0,0,0,0,0,1,1,0],
  [1,1,3,4,1,1,1,1,4,3,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [0,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,1,1,1,1,1,1,1,1,1,0],
  [0,0,1,1,1,1,1,1,1,1,0,0],
  [0,0,1,1,5,5,5,5,1,1,0,0],
  [0,0,1,5,5,2,2,5,5,1,0,0],
  [0,0,1,5,5,5,5,5,5,1,0,0],
  [0,1,1,1,5,5,5,5,1,1,1,0],
  [1,1,0,0,1,1,1,1,0,0,1,1],
  [1,1,0,0,1,1,1,1,0,0,1,1],
];

const FROG_DOWN = [
  [1,1,0,0,1,1,1,1,0,0,1,1],
  [1,1,0,0,1,1,1,1,0,0,1,1],
  [0,1,1,1,5,5,5,5,1,1,1,0],
  [0,0,1,5,5,5,5,5,5,1,0,0],
  [0,0,1,5,5,2,2,5,5,1,0,0],
  [0,0,1,1,5,5,5,5,1,1,0,0],
  [0,0,1,1,1,1,1,1,1,1,0,0],
  [0,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,1,1,1,1,1,1,1,1,1,0],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,3,4,1,1,1,1,4,3,1,1],
  [0,1,1,0,0,0,0,0,0,1,1,0],
];

const FROG_LEFT = [
  [0,0,1,1,0,0,0,0,0,0,0,0],
  [0,1,4,3,1,1,0,0,0,0,0,0],
  [1,1,1,1,1,1,1,1,0,0,0,0],
  [1,1,1,1,1,1,1,1,1,0,0,0],
  [1,1,1,1,1,1,1,1,1,0,0,0],
  [0,1,1,1,1,1,1,1,1,1,0,0],
  [0,1,1,5,5,5,5,1,1,1,0,0],
  [0,1,5,5,2,2,5,5,1,1,0,0],
  [0,1,5,5,5,5,5,5,1,1,0,0],
  [0,0,1,5,5,5,5,1,1,1,0,0],
  [0,0,1,1,1,1,0,0,1,1,0,0],
  [0,0,1,1,1,1,0,0,1,1,0,0],
];

function mirrorRows(grid) {
  return grid.map(row => [...row].reverse());
}

const FROG_RIGHT = mirrorRows(FROG_LEFT);

const TOAD = [
  [0,1,1,0,0,0,0,0,0,1,1,0],
  [1,1,3,4,1,1,1,1,4,3,1,1],
  [1,1,1,2,1,1,1,1,2,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,2,1,1,1,1,2,1,1,1],
  [0,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,1,1,5,5,5,5,1,1,1,0],
  [1,1,5,5,2,2,2,2,5,5,1,1],
  [1,1,5,5,5,5,5,5,5,5,1,1],
  [1,1,1,5,5,5,5,5,5,1,1,1],
  [1,1,0,1,1,1,1,1,1,0,1,1],
  [1,1,0,1,1,1,1,1,1,0,1,1],
];

const GRIDS = {
  frog: { up: FROG_UP, down: FROG_DOWN, left: FROG_LEFT, right: FROG_RIGHT },
  toad: { up: TOAD, down: TOAD, left: TOAD, right: TOAD },
};

const EYE_WHITE = '#f4f4e6';
const PUPIL = '#111';

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
  const px = cellSize / grid.length;
  const originX = cx - cellSize / 2;
  const originY = cy - cellSize / 2;
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      const v = grid[row][col];
      if (v === 0) continue;
      ctx.fillStyle = palette[v];
      ctx.fillRect(originX + col * px, originY + row * px, px, px);
    }
  }
}
```

- [ ] **Step 4: Kör testerna igen och verifiera att de passerar**

Run: `cd backend && node --test test/sprites.test.js`
Expected: PASS (9 tester)

- [ ] **Step 5: Commit**

```bash
git add frontend/js/sprites.js backend/test/sprites.test.js
git commit -m "feat: pixel-art sprites för groda och padda"
```

---

### Task 2: Riktningsspårning i `GameState`

**Files:**
- Modify: `frontend/js/game.js`
- Test: `backend/test/gamestate.test.js`

**Interfaces:**
- Consumes: inget nytt från Task 1.
- Produces: `GameState.dirOf(pid)` → `'up' | 'down' | 'left' | 'right'`. Läses av `renderer.js` i Task 3.

- [ ] **Step 1: Lägg till failing tests i `backend/test/gamestate.test.js`**

Lägg till längst ner i filen (efter befintligt sista test, före ev. avslutande rad):

```js
test('dirOf returnerar "up" innan någon rörelse skett', async () => {
  const gs = await makeGs();
  gs.applyMessage(stateMsg(), 1000);
  assert.equal(gs.dirOf('p1'), 'up');
  assert.equal(gs.dirOf('p2'), 'up');
});

test('predictMove sätter riktning direkt för egen spelare', async () => {
  const gs = await makeGs();
  gs.applyMessage(stateMsg(), 1000);
  gs.predictMove('left');
  assert.equal(gs.dirOf('p1'), 'left');
  assert.equal(gs.dirOf('p2'), 'up'); // motståndaren opåverkad
});

test('applyMessage härleder motståndarens riktning ur positionsändring', async () => {
  const gs = await makeGs();
  gs.applyMessage(stateMsg(), 1000);
  gs.applyMessage(stateMsg({
    tick: 1,
    players: { p1: { x: 5, y: 14 }, p2: { x: 6, y: 14 } } // p2 flyttade x+1
  }), 1100);
  assert.equal(gs.dirOf('p2'), 'right');
});

test('applyMessage behåller senaste riktning när spelaren står still', async () => {
  const gs = await makeGs();
  gs.applyMessage(stateMsg(), 1000);
  gs.applyMessage(stateMsg({
    tick: 1,
    players: { p1: { x: 5, y: 14 }, p2: { x: 6, y: 14 } }
  }), 1100);
  assert.equal(gs.dirOf('p2'), 'right');
  gs.applyMessage(stateMsg({
    tick: 2,
    players: { p1: { x: 5, y: 14 }, p2: { x: 6, y: 14 } } // ingen rörelse
  }), 1200);
  assert.equal(gs.dirOf('p2'), 'right'); // oförändrad
});

test('resetSession återställer riktningar till "up"', async () => {
  const gs = await makeGs();
  gs.applyMessage(stateMsg(), 1000);
  gs.predictMove('down');
  assert.equal(gs.dirOf('p1'), 'down');
  gs.resetSession();
  assert.equal(gs.dirOf('p1'), 'up');
});
```

- [ ] **Step 2: Kör testerna och verifiera att de faller**

Run: `cd backend && node --test test/gamestate.test.js`
Expected: FAIL — `gs.dirOf is not a function`

- [ ] **Step 3: Implementera riktningsspårning i `frontend/js/game.js`**

I konstruktorn, lägg till fältet efter `this._seq = 0;` (rad 26):

```js
    this._seq        = 0;    // senast skickade drag-seq
    this._lastDir     = { p1: 'up', p2: 'up' };
```

I `resetSession()`, lägg till motsvarande rad efter `this._seq = 0;` (rad 44):

```js
    this._seq        = 0;
    this._lastDir     = { p1: 'up', p2: 'up' };
```

I `applyMessage()`, i grenen för `msg.type === 'state'` (rad 54–73), lägg till riktningsberäkning **innan** `this.players = msg.players;` skriver över det gamla objektet (efter rad 64, före rad 65):

```js
      // Behåll predikterad position tills servern ackat vårt senaste drag
      const acked = (msg.ack?.[this.you] ?? 0) >= this._seq;
      const mine  = !acked && this.you ? this.players[this.you] : null;

      for (const pid of ['p1', 'p2']) {
        const before = this.players[pid];
        const after  = msg.players[pid];
        if (!before || !after) continue;
        const dx = after.x - before.x;
        const dy = after.y - before.y;
        if (dx > 0) this._lastDir[pid] = 'right';
        else if (dx < 0) this._lastDir[pid] = 'left';
        else if (dy > 0) this._lastDir[pid] = 'down';
        else if (dy < 0) this._lastDir[pid] = 'up';
      }

      this.players = msg.players;
```

Lägg till en `predictMove`-uppdatering i `predictMove()` (rad 131–144), direkt efter `this._seq++;` (rad 136):

```js
    this._seq++;
    this._lastDir[this.you] = direction;
```

Lägg till gettern längst ner i klassen, före den avslutande `}`:

```js
  dirOf(pid) {
    return this._lastDir[pid] ?? 'up';
  }
```

- [ ] **Step 4: Kör testerna igen och verifiera att de passerar**

Run: `cd backend && node --test test/gamestate.test.js`
Expected: PASS (samtliga tester i filen, inklusive de 5 nya)

- [ ] **Step 5: Kör hela backend-testsviten för att säkerställa ingen regression**

Run: `cd backend && node --test test/*.test.js`
Expected: PASS (alla tester)

- [ ] **Step 6: Commit**

```bash
git add frontend/js/game.js backend/test/gamestate.test.js
git commit -m "feat: härled spelarriktning i GameState för sprite-rendering"
```

---

### Task 3: Koppla in sprites i `renderer.js`

**Files:**
- Modify: `frontend/js/renderer.js`

**Interfaces:**
- Consumes: `drawSprite` från Task 1 (`frontend/js/sprites.js`), `state.dirOf(pid)` från Task 2.
- Produces: inget nytt (bladnod i renderingskedjan).

Inget automatiskt testramverk finns för `renderer.js` (canvas-rendering, samma mönster som redan gäller för filen). Verifiering sker manuellt i Step 3.

- [ ] **Step 1: Ta bort den gamla `SKINS`-färgtabellen och lägg till import**

I `frontend/js/renderer.js`, ersätt rad 1–9:

```js
import { t } from './i18n.js';

// Skin-id → utseende. Nya skins = nya rader här (+ i backend/constants.js SKINS
// och lobbypanelens knappar). Sprite-skins: se TODO.md.
const SKINS = {
  green:  '#00e64d',
  yellow: '#ffe100',
  blue:   '#4da6ff'
};
```

med:

```js
import { t } from './i18n.js';
import { drawSprite } from './sprites.js';
```

- [ ] **Step 2: Byt ut cirkelritningen mot `drawSprite` i `_drawPlayers`**

Ersätt hela `_drawPlayers`-metoden (rad 101–133) med:

```js
  _drawPlayers(state) {
    const { ctx, cell } = this;
    for (const [pid, p] of Object.entries(state.players)) {
      if (!p) continue;
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
      if (pid === state.you) { // vit ring markerar egen spelare
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(rx * cell + cell / 2, p.y * cell + cell / 2, cell / 2 - 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Liten etikett
      ctx.fillStyle = '#000';
      ctx.font = `bold ${cell * 0.4}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pid === state.you ? t('game.you') : pid.toUpperCase(),
        rx * cell + cell / 2, p.y * cell + cell / 2);
      if (p.name) {
        ctx.fillStyle = '#fff';
        ctx.font = `${cell * 0.28}px monospace`;
        // Clampa så namnet inte hamnar utanför canvasen på målraden
        ctx.fillText(p.name, rx * cell + cell / 2, Math.max(10, p.y * cell - 8));
      }
    }
  }
```

- [ ] **Step 3: Manuell verifiering i webbläsaren**

Run: `cd backend && node server.js` (i ett terminalfönster)
Öppna sedan `frontend/index.html` direkt i webbläsaren (eller använd `run.cmd` om det startar båda).

Kontrollera:
- Groda (p1, grön som standard) och padda (p2) syns med kantig pixel-form, inte cirklar
- Rör grodan i alla fyra riktningar (piltangenter/WASD) — spriten byter pose och vänder rätt håll
- Vit ring syns runt din egen spelare
- Testa alla tre skins i lobbyn (grön/gul/blå) på båda spelarna — paddans "gul" ska vara senapsgul/oliv, inte klargul
- Namnetikett och `DU`/`P1`/`P2`-etikett ritas fortfarande korrekt ovanför/på spriten

- [ ] **Step 4: Commit**

```bash
git add frontend/js/renderer.js
git commit -m "feat: rendera groda/padda som pixel-sprites istället för cirklar"
```

---

### Task 4: Standardnamn Frog/Toad i backend

**Files:**
- Modify: `backend/constants.js:15`
- Modify: `backend/test/room.test.js:182-183,212,246`
- Modify: `backend/test/constants.test.js`

**Interfaces:**
- Consumes: inget.
- Produces: `DEFAULT_NAMES = { p1: 'Frog', p2: 'Toad' }`, konsumeras redan av `backend/room.js:56,93` (ingen ändring behövs där — samma nycklar).

- [ ] **Step 1: Uppdatera assertions i `backend/test/room.test.js` till de nya default-namnen**

Rad 182–183:

```js
  assert.equal(room.state.players.p1.name, 'Frog');
  assert.equal(room.state.players.p2.name, 'Toad');
```

Rad 212:

```js
  assert.equal(room.state.players.p1.name, 'Frog');
```

Rad 246:

```js
  assert.equal(room.state.players.p1.name, 'Frog');
```

- [ ] **Step 2: Lägg till ett test i `backend/test/constants.test.js`**

Lägg till sist i filen:

```js

test('DEFAULT_NAMES är Frog/Toad', () => {
  assert.equal(C.DEFAULT_NAMES.p1, 'Frog');
  assert.equal(C.DEFAULT_NAMES.p2, 'Toad');
});
```

- [ ] **Step 3: Kör testerna och verifiera att de faller**

Run: `cd backend && node --test test/room.test.js test/constants.test.js`
Expected: FAIL — assertions mot `'Frog'`/`'Toad'` missmatchar nuvarande `'Player 1'`/`'Player 2'`

- [ ] **Step 4: Uppdatera `backend/constants.js:15`**

```js
const DEFAULT_NAMES = { p1: 'Frog', p2: 'Toad' };
```

- [ ] **Step 5: Kör testerna igen och verifiera att de passerar**

Run: `cd backend && node --test test/*.test.js`
Expected: PASS (alla tester, inklusive de tre uppdaterade och det nya)

- [ ] **Step 6: Commit**

```bash
git add backend/constants.js backend/test/room.test.js backend/test/constants.test.js
git commit -m "feat: standardnamn Frog/Toad istället för Player 1/2"
```

---

### Task 5: PWA-appikoner

**Files:**
- Create: `frontend/icon-generator.html`
- Create: `frontend/icons/icon-192.png` (via manuellt steg, se Step 2)
- Create: `frontend/icons/icon-512.png` (via manuellt steg, se Step 2)
- Modify: `frontend/manifest.json`
- Modify: `frontend/index.html`

**Interfaces:**
- Consumes: `getGrid`/`getPalette` från Task 1 (`frontend/js/sprites.js`) för att rita grodan i genereringsverktyget.
- Produces: inget (bladnod).

- [ ] **Step 1: Skapa `frontend/icon-generator.html`**

```html
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <title>Ikongenerator (dev-verktyg, ej del av appen)</title>
  <style>
    body { background: #222; color: #eee; font-family: monospace; text-align: center; padding: 24px; }
    canvas { image-rendering: pixelated; background: #111111; border-radius: 12px; margin: 16px; }
    button { font-size: 16px; padding: 8px 16px; margin: 8px; cursor: pointer; }
  </style>
</head>
<body>
  <h1>Frog vs Toad — ikongenerator</h1>
  <p>Dev-verktyg för att generera PWA-appikoner. Ladda ner båda och lägg i <code>frontend/icons/</code>.</p>
  <div>
    <canvas id="icon512" width="512" height="512"></canvas>
  </div>
  <button id="dl512">Ladda ner 512×512</button>
  <button id="dl192">Ladda ner 192×192</button>

  <script type="module">
    import { getGrid, getPalette } from './js/sprites.js';

    function renderIcon(size) {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#111111';
      ctx.fillRect(0, 0, size, size);

      const grid = getGrid('frog', 'up');
      const palette = getPalette('green', 'frog');
      const margin = size * 0.1;
      const cellSize = size - margin * 2;
      const px = cellSize / grid.length;
      for (let row = 0; row < grid.length; row++) {
        for (let col = 0; col < grid[row].length; col++) {
          const v = grid[row][col];
          if (v === 0) continue;
          ctx.fillStyle = palette[v];
          ctx.fillRect(margin + col * px, margin + row * px, px, px);
        }
      }
      return canvas;
    }

    function download(canvas, filename) {
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = filename;
      a.click();
    }

    const preview = document.getElementById('icon512');
    const previewCtx = preview.getContext('2d');
    previewCtx.drawImage(renderIcon(512), 0, 0);

    document.getElementById('dl512').addEventListener('click', () => {
      download(renderIcon(512), 'icon-512.png');
    });
    document.getElementById('dl192').addEventListener('click', () => {
      download(renderIcon(192), 'icon-192.png');
    });
  </script>
</body>
</html>
```

- [ ] **Step 2: Manuellt steg — generera PNG-filerna**

Detta steg kräver en människa vid tangentbordet (canvas-nedladdning kan inte automatiseras utan browser-interaktion):

1. Öppna `frontend/icon-generator.html` direkt i en webbläsare
2. Klicka "Ladda ner 512×512" — spara som `frontend/icons/icon-512.png`
3. Klicka "Ladda ner 192×192" — spara som `frontend/icons/icon-192.png`
4. Verifiera att båda filerna finns: kontrollera med `ls frontend/icons/` (eller `Get-ChildItem frontend/icons/` i PowerShell) att båda `icon-192.png` och `icon-512.png` finns

- [ ] **Step 3: Uppdatera `frontend/manifest.json`**

Ersätt `"icons": []` (rad 11) med:

```json
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" }
  ]
```

- [ ] **Step 4: Lägg till apple-touch-icon i `frontend/index.html`**

Efter raden `<link rel="manifest" href="manifest.json">` (rad 7), lägg till:

```html
  <link rel="apple-touch-icon" href="icons/icon-192.png">
```

- [ ] **Step 5: Verifiera manuellt**

Öppna `frontend/index.html` i Chrome DevTools → Application → Manifest. Kontrollera att båda ikonerna listas utan fel och att installprompten (eller "Add to Home Screen" på mobil) nu är tillgänglig.

- [ ] **Step 6: Commit**

```bash
git add frontend/icon-generator.html frontend/icons/icon-192.png frontend/icons/icon-512.png frontend/manifest.json frontend/index.html
git commit -m "feat: PWA-appikoner genererade från grod-spriten"
```

---

## Efter denna plan

TODO.md:s "Frog vs Toad — grafik" och "Skins → Riktiga sprite-skins"-punkter kan strykas. Kvar i TODO.md (ej del av denna plan): hoppanimation, banbyte-refaktorering, mobilpolish.
