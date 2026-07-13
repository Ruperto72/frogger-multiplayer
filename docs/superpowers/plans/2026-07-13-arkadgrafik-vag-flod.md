# Arkadgrafik för väg, flod och vägren Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ge väg, bilar, flod, stockar och mellanzonen (rad 6) samma pixel-grid-arkadkänsla som grodan/paddan har redan, utan att röra spellogik eller nätverksprotokoll.

**Architecture:** Ny modul `frontend/js/tiles.js` (pixel-grids + ritfunktioner, samma mönster som `sprites.js`). `renderer.js` bygger en offscreen `<canvas>`-cache av den statiska planen en gång och blittar den varje frame istället för att fylla rader med platta färger. `game.js` får ett litet tillägg (`_idx`) så att bilfärg/stockvariant kan väljas deterministiskt per hinder istället för slumpmässigt varje frame.

**Tech Stack:** Vanilla JS (ES6-moduler), Canvas 2D. Ingen byggprocess, inga nya beroenden.

## Global Constraints

- Ingen ändring av spellogik, nätverksprotokoll eller backend (`backend/**` orörd).
- `frontend/js/sim.js` och `backend/gameloop.js` får INTE ändras (låsta av `backend/test/sim-consistency.test.js`).
- Cellstorlek är fast `CELL = 48` (frontend/js/main.js:12), plan `COLS = 13`, `ROWS = 15` (backend/constants.js).
- Pixel-grids använder samma konvention som `sprites.js`: `0` = transparent, övriga heltal slår upp en färg i en palett-tabell.
- Frontend har ingen testrunner. Task 1 lägger till en minimal `frontend/js/package.json` (`{"type":"module"}`) enbart för att `node -e "import(...)"`-smoke-checkarna i Task 1–3 ska kunna läsa `.js`-filerna som ES-moduler — den påverkar inte webbläsaren (som redan styrs av `<script type="module">` i `index.html`) och läggs inte till som någon testramverk. Verifiering sker genom (a) dessa engångs-smoke-checkar, och (b) att köra appen i webbläsaren i Task 5–7.
- `cd backend && node --test test/*.test.js` ska fortsätta gå grönt genom hela planen (körs i sista tasken; kör den även efter Task 4 eftersom det är den enda backend-närliggande ändringen).

---

### Task 1: `tiles.js` — grundhjälpare + bilsprites

**Files:**
- Create: `frontend/js/package.json`
- Create: `frontend/js/tiles.js`

**Interfaces:**
- Produces: `drawGrid(ctx, grid, palette, originX, originY, px)` (internal helper, not exported)
- Produces: `mirrorRows(grid)` (internal helper, not exported)
- Produces: `export function drawCar(ctx, { x, y, cellSize, width, dir, colorIndex })` — ritar en bil med övre vänstra hörn vid `(x, y)`, `width` i celler (1 eller 2), `dir` (1 = höger, -1 = vänster), `colorIndex` (heltal, valfritt värde — väljer färg deterministiskt via modulo).

- [ ] **Step 1: Lägg till en ES-modul-markör för Node-verktyg**

`frontend/js`-filerna körs i webbläsaren via `<script type="module">` (extension spelar ingen roll där), men `node -e "import(...)"` i verifieringsstegen nedan behöver veta att `.js`-filer i den här mappen är ES-moduler. Skapa:

```json
// frontend/js/package.json
{
  "type": "module"
}
```

- [ ] **Step 2: Skapa `tiles.js` med grundhjälpare och bilsprites**

```js
// frontend/js/tiles.js
// 0 transparent, övriga index slår upp färg i respektive palett.

function mirrorRows(grid) {
  return grid.map(row => [...row].reverse());
}

function drawGrid(ctx, grid, palette, originX, originY, px) {
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      const v = grid[row][col];
      if (v === 0) continue;
      ctx.fillStyle = palette[v];
      ctx.fillRect(originX + col * px, originY + row * px, px, px);
    }
  }
}

// ---- Bilar ----
// Kompaktbil (bredd 1 cell, 12x12). 1=kaross 3=ruta 4=hjul 5=strålkastare.
const CAR_SMALL_RIGHT = [
  [0,1,1,1,1,1,1,1,1,1,1,0],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,3,3,1,1],
  [1,1,1,1,1,1,1,1,3,3,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,5],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [0,1,1,1,1,1,1,1,1,1,1,0],
  [0,0,4,4,0,0,0,0,4,4,0,0],
  [0,0,4,4,0,0,0,0,4,4,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0],
];
const CAR_SMALL_LEFT = mirrorRows(CAR_SMALL_RIGHT);

// Skåpbil/lastbil (bredd 2 celler, 24x12).
const CAR_LARGE_RIGHT = [
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,3,3,3,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,3,3,3,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,5],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,0,4,4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4,4,0,0,0],
  [0,0,4,4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4,4,0,0,0],
  [0,0,4,4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4,4,0,0,0],
];
const CAR_LARGE_LEFT = mirrorRows(CAR_LARGE_RIGHT);

const CAR_GRIDS = {
  1: { right: CAR_SMALL_RIGHT, left: CAR_SMALL_LEFT },
  2: { right: CAR_LARGE_RIGHT, left: CAR_LARGE_LEFT },
};

const CAR_COLOR_NAMES = ['red', 'yellow', 'blue', 'white'];
const CAR_BODY_COLORS = {
  red:    '#c93030',
  yellow: '#d9b830',
  blue:   '#2f5fa8',
  white:  '#d8d8d0',
};
const CAR_WINDOW    = '#274257';
const CAR_WHEEL     = '#1a1a1a';
const CAR_HEADLIGHT = '#f4e08a';

export function drawCar(ctx, { x, y, cellSize, width, dir, colorIndex }) {
  const grids = CAR_GRIDS[width] ?? CAR_GRIDS[1];
  const grid  = dir === 1 ? grids.right : grids.left;
  const name  = CAR_COLOR_NAMES[((colorIndex % CAR_COLOR_NAMES.length) + CAR_COLOR_NAMES.length) % CAR_COLOR_NAMES.length];
  const palette = { 1: CAR_BODY_COLORS[name], 3: CAR_WINDOW, 4: CAR_WHEEL, 5: CAR_HEADLIGHT };
  drawGrid(ctx, grid, palette, x, y, cellSize / 12);
}
```

- [ ] **Step 3: Verifiera att modulen laddar och att griddarna har rätt mått**

```bash
node -e "
import('./frontend/js/tiles.js').then(m => {
  console.log('exports:', Object.keys(m));
});
"
```

Förväntat: `exports: [ 'drawCar' ]` utan felmeddelande. Om Node kastar ett `SyntaxError` betyder det ett fel i array-syntaxen ovan — rätta innan du går vidare.

- [ ] **Step 4: Commit**

```bash
git add frontend/js/package.json frontend/js/tiles.js
git commit -m "feat: lägg till pixel-grid-bilar i tiles.js"
```

---

### Task 2: `tiles.js` — stocksprite

**Files:**
- Modify: `frontend/js/tiles.js` (lägg till i slutet av filen)

**Interfaces:**
- Consumes: `drawGrid(ctx, grid, palette, originX, originY, px)`, `mirrorRows(grid)` (från Task 1, samma fil)
- Produces: `export function drawLog(ctx, { x, y, cellSize, width })` — `width` är 2 eller 3 celler.

- [ ] **Step 1: Lägg till stock-griddar och `drawLog`**

```js
// ---- Stockar ----
// Mittsegment (12x12) med årsringar. 1=trä 2=årsring/kant 5=barkhögdager.
const LOG_MIDDLE = [
  [5,5,5,5,5,5,5,5,5,5,5,5],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,2,1,1,1,2,1,1,1,2,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,2,1,1,1,2,1,1,1,2,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,2,1,1,1,2,1,1,1,2,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,2,1,1,1,2,1,1,1,2,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [2,2,2,2,2,2,2,2,2,2,2,2],
];

// Avrundad ändcap, vänster (12x12).
const LOG_CAP_LEFT = [
  [0,0,5,5,5,5,5,5,5,5,5,5],
  [0,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [0,1,1,1,1,1,1,1,1,1,1,1],
  [0,0,2,2,2,2,2,2,2,2,2,2],
];
const LOG_CAP_RIGHT = mirrorRows(LOG_CAP_LEFT);

const LOG_PALETTE = { 1: '#8b5e3c', 2: '#5a3a22', 5: '#c99a63' };

export function drawLog(ctx, { x, y, cellSize, width }) {
  const segments = width >= 3 ? [LOG_CAP_LEFT, LOG_MIDDLE, LOG_CAP_RIGHT] : [LOG_CAP_LEFT, LOG_CAP_RIGHT];
  const px = cellSize / 12;
  let originX = x;
  for (const seg of segments) {
    drawGrid(ctx, seg, LOG_PALETTE, originX, y, px);
    originX += cellSize;
  }
}
```

- [ ] **Step 2: Verifiera**

```bash
node -e "
import('./frontend/js/tiles.js').then(m => {
  console.log('exports:', Object.keys(m));
});
"
```

Förväntat: `exports: [ 'drawCar', 'drawLog' ]` utan felmeddelande.

- [ ] **Step 3: Commit**

```bash
git add frontend/js/tiles.js
git commit -m "feat: lägg till pixel-grid-stockar i tiles.js"
```

---

### Task 3: `tiles.js` — väg-, vägren- och vattentiles

**Files:**
- Modify: `frontend/js/tiles.js` (lägg till i slutet av filen)

**Interfaces:**
- Consumes: `drawGrid` (från Task 1, samma fil)
- Produces: `export function drawRoadTile(ctx, x, y, cellSize)`, `export function drawVergeTile(ctx, x, y, cellSize)`, `export function drawWaterTile(ctx, x, y, cellSize)` — ritar en enskild 1×1-cellstile vid `(x, y)`. Avsedda att upprepas av anroparen för att täcka en hel rad.

- [ ] **Step 1: Lägg till tile-griddar och ritfunktioner**

```js
// ---- Väg (rad 7–12) ----
// Asfalt med fast (icke-slumpad) brustextur. 1=asfalt 2=mörkare fläck.
const ROAD_TILE = [
  [1,1,1,2,1,1,1,1,1,2,1,1],
  [1,1,1,1,1,1,2,1,1,1,1,1],
  [1,2,1,1,1,1,1,1,2,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,2,1,1,1,1,2,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [2,1,1,1,1,2,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,2,1],
  [1,1,1,2,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,2,1,1,1],
  [1,2,1,1,1,1,1,1,1,1,1,2],
  [1,1,1,1,1,2,1,1,1,1,1,1],
];
const ROAD_PALETTE = { 1: '#555555', 2: '#454545' };

// ---- Vägren (rad 6) ----
// Gräs med grusig kant mot vägen (nedre kanten). 1=gräs 2=mörkare gräsfläck 5=grus.
const VERGE_TILE = [
  [1,1,2,1,1,1,1,2,1,1,1,1],
  [1,1,1,1,2,1,1,1,1,1,2,1],
  [1,2,1,1,1,1,1,1,2,1,1,1],
  [1,1,1,1,1,2,1,1,1,1,1,1],
  [1,1,1,2,1,1,1,1,2,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,2,1,1,1,1,1,1,2,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [5,5,5,5,5,5,5,5,5,5,5,5],
  [5,1,5,1,5,1,5,1,5,1,5,1],
];
const VERGE_PALETTE = { 1: '#3a5a28', 2: '#2c4a1c', 5: '#a8a58c' };

// ---- Vatten (rad 1–5) ----
// Blå yta med fast vågmönster. 1=vatten 2=mörkare våg 5=ljus vågkam.
const WATER_TILE = [
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [5,5,1,1,5,5,1,1,5,5,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,2,2,1,1,1,2,2,1,1,1,2],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,5,5,1,1,5,5,1,1,5,5],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [2,1,1,1,2,2,1,1,1,2,2,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [5,5,1,1,5,5,1,1,5,5,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,2,2,1,1,1,2,2,1,1,1,2],
];
const WATER_PALETTE = { 1: '#1a3a6a', 2: '#12294d', 5: '#3f6fae' };

export function drawRoadTile(ctx, x, y, cellSize) {
  drawGrid(ctx, ROAD_TILE, ROAD_PALETTE, x, y, cellSize / 12);
}
export function drawVergeTile(ctx, x, y, cellSize) {
  drawGrid(ctx, VERGE_TILE, VERGE_PALETTE, x, y, cellSize / 12);
}
export function drawWaterTile(ctx, x, y, cellSize) {
  drawGrid(ctx, WATER_TILE, WATER_PALETTE, x, y, cellSize / 12);
}
```

- [ ] **Step 2: Verifiera**

```bash
node -e "
import('./frontend/js/tiles.js').then(m => {
  console.log('exports:', Object.keys(m));
});
"
```

Förväntat: `exports: [ 'drawCar', 'drawLog', 'drawRoadTile', 'drawVergeTile', 'drawWaterTile' ]` utan felmeddelande.

- [ ] **Step 3: Commit**

```bash
git add frontend/js/tiles.js
git commit -m "feat: lägg till väg-, vägren- och vattentiles i tiles.js"
```

---

### Task 4: `game.js` — stabilt hinder-index

**Files:**
- Modify: `frontend/js/game.js:119-124`

**Interfaces:**
- Produces: varje objekt som returneras av `obstaclesAt()` har nu även `_idx` (heltal, index i `_base`, stabilt genom hela matchen) utöver befintliga `lane`, `x`, `width`, `type`, `speed`, `dir`.

- [ ] **Step 1: Lägg till `_idx` i `obstaclesAt`**

Nuvarande kod (game.js:119-124):

```js
  obstaclesAt(now = performance.now()) {
    const t = this.phase === 'playing'
      ? this._serverTick + (now - this._tickAt) / TICK_MS
      : this._serverTick;
    return this._base.map(o => ({ ...o, x: obstacleXAt(o, t) }));
  }
```

Ändra sista raden till:

```js
  obstaclesAt(now = performance.now()) {
    const t = this.phase === 'playing'
      ? this._serverTick + (now - this._tickAt) / TICK_MS
      : this._serverTick;
    return this._base.map((o, i) => ({ ...o, x: obstacleXAt(o, t), _idx: i }));
  }
```

- [ ] **Step 2: Verifiera att backend-testsviten fortfarande går grön**

`game.js` importerar `obstacleXAt`/`generateLanes` från `sim.js`, som testas indirekt av `backend/test/sim-consistency.test.js`. Denna ändring rör inte `sim.js`, men kör sviten som regressionsskydd:

```bash
cd backend && node --test test/*.test.js
```

Förväntat: alla tester PASS (ingen ändring i utfall, `game.js` importeras inte av backend-testerna — detta är en snabb sanity-check att inget annat gått sönder samtidigt).

- [ ] **Step 3: Commit**

```bash
git add frontend/js/game.js
git commit -m "feat: exponera stabilt hinder-index från obstaclesAt"
```

---

### Task 5: `renderer.js` — offscreen board-cache

**Files:**
- Modify: `frontend/js/renderer.js:1-2` (imports)
- Modify: `frontend/js/renderer.js:66-77` (`_drawBoard`, ersätts av `_buildBoardCache` + `_drawBoard`). `ZONE_COLORS`/`zoneColor` (rad 4-18) lämnas orörda — återanvänds för rad 0/13/14.

**Interfaces:**
- Consumes: `drawRoadTile`, `drawVergeTile`, `drawWaterTile` (från Task 3, `tiles.js`)
- Produces: `this._boardCache` (offscreen `HTMLCanvasElement`, byggd lat vid första `draw()`-anropet) — används av `_drawBoard()`. Ingen extern konsument.

- [ ] **Step 1: Importera tile-funktionerna**

Nuvarande rad (renderer.js:1-2):

```js
import { t } from './i18n.js';
import { drawSprite } from './sprites.js';
```

Ändra till:

```js
import { t } from './i18n.js';
import { drawSprite } from './sprites.js';
import { drawCar, drawLog, drawRoadTile, drawVergeTile, drawWaterTile } from './tiles.js';
```

- [ ] **Step 2: Bygg en cachead bakgrund istället för att fylla rader varje frame**

Nuvarande `_drawBoard` (renderer.js:66-77):

```js
  _drawBoard() {
    const { ctx, cell, cols, rows } = this;
    for (let row = 0; row < rows; row++) {
      ctx.fillStyle = zoneColor(row);
      ctx.fillRect(0, row * cell, cols * cell, cell);
    }
    // Målplatser
    ctx.fillStyle = '#4a8a28';
    for (const gx of [0, 3, 6, 9, 12]) {
      ctx.fillRect(gx * cell + 4, 4, cell - 8, cell - 8);
    }
  }
```

Ersätt med:

```js
  _buildBoardCache() {
    const { cell, cols, rows } = this;
    const cache = document.createElement('canvas');
    cache.width  = cols * cell;
    cache.height = rows * cell;
    const cctx = cache.getContext('2d');

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * cell, y = row * cell;
        if (row === 0 || row === 13 || row === 14) {
          cctx.fillStyle = zoneColor(row);
          cctx.fillRect(x, y, cell, cell);
        } else if (row >= 1 && row <= 5) {
          drawWaterTile(cctx, x, y, cell);
        } else if (row === 6) {
          drawVergeTile(cctx, x, y, cell);
        } else {
          drawRoadTile(cctx, x, y, cell);
        }
      }
    }

    // Körfältslinjer mellan varje trafikrad (rad 7–12)
    cctx.strokeStyle = 'rgba(255,255,255,0.8)';
    cctx.lineWidth = 2;
    cctx.setLineDash([cell * 0.25, cell * 0.2]);
    for (let row = 8; row <= 12; row++) {
      const y = row * cell;
      cctx.beginPath();
      cctx.moveTo(0, y);
      cctx.lineTo(cols * cell, y);
      cctx.stroke();
    }

    // Målplatser
    cctx.fillStyle = '#4a8a28';
    for (const gx of [0, 3, 6, 9, 12]) {
      cctx.fillRect(gx * cell + 4, 4, cell - 8, cell - 8);
    }

    this._boardCache = cache;
  }

  _drawBoard() {
    if (!this._boardCache) this._buildBoardCache();
    this.ctx.drawImage(this._boardCache, 0, 0);
  }
```

- [ ] **Step 3: Verifiera i webbläsaren**

Öppna `frontend/index.html` lokalt (t.ex. `cd backend && node server.js` i ett fönster, öppna `frontend/index.html` i webbläsaren i ett annat — se README/CLAUDE.md för lokal körning). Starta en snabbmatch. Kontrollera:

- Vägen (rad 7–12) har asfaltstextur och streckade körfältslinjer.
- Vägrenen (rad 6) har gräs med grusig kant mot vägen.
- Vattnet (rad 1–5) har ett svagt vågmönster.
- Inga fel i webbläsarkonsolen.

(Bilar/stockar syns fortfarande som gamla rektanglar — det åtgärdas i Task 6.)

- [ ] **Step 4: Commit**

```bash
git add frontend/js/renderer.js
git commit -m "feat: cachea planens bakgrund som offscreen-canvas med tile-grafik"
```

---

### Task 6: `renderer.js` — bilar och stockar med tiles

**Files:**
- Modify: `frontend/js/renderer.js:79-92` (`_drawObstacles`)

**Interfaces:**
- Consumes: `drawCar`, `drawLog` (från Task 3/1, `tiles.js`), `obs._idx` (från Task 4, `game.js`)

- [ ] **Step 1: Ersätt de platta hinder-rektanglarna med tile-grafik**

Nuvarande `_drawObstacles` (renderer.js:79-92):

```js
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
      const overflow = x + w - this.cols * cell;
      if (overflow > 0) ctx.fillRect(0, y, overflow, h);
    }
  }
```

Ersätt med:

```js
  _drawObstacles(obstacles) {
    const { ctx, cell, cols } = this;
    for (const obs of obstacles) {
      const px = ((obs.x % cols) + cols) % cols;
      const x  = px * cell;
      const y  = obs.lane * cell;
      const draw = (drawX) => {
        if (obs.type === 'car') {
          drawCar(ctx, { x: drawX, y, cellSize: cell, width: obs.width, dir: obs.dir, colorIndex: obs._idx });
        } else {
          drawLog(ctx, { x: drawX, y, cellSize: cell, width: obs.width });
        }
      };
      draw(x);
      const overflow = x + obs.width * cell - cols * cell;
      if (overflow > 0) draw(x - cols * cell); // rita en kopia som lindar till vänsterkanten
    }
  }
```

Canvas ritar bara det som ligger innanför sina egna gränser, så kopian som ritas vid `x - cols * cell` syns automatiskt bara i den del som sticker in i planen — ingen manuell klippning behövs (samma effekt som den gamla `fillRect(0, y, overflow, h)`-raden, men med korrekt sprite-grafik istället för en enfärgad klippt rektangel).

- [ ] **Step 2: Verifiera i webbläsaren**

Öppna appen igen (samma uppstart som Task 5, Step 3). Kontrollera:

- Bilar (rad 7–12) visas som pixel-grid-bilar i minst två storlekar (1 och 2 rutor breda) och i flera av de fyra färgerna (röd/gul/blå/vit), med strålkastare/vindruta åt körriktningen.
- Samma bil behåller samma färg genom hela matchen (inget flimmer när den rör sig).
- Stockar (rad 1–5) visas med trätextur och avrundade ändar, i bredd 2 och 3.
- En bil/stock som lindar runt kanten (x nära `cols * cell`) ritas korrekt utan att klippas fult eller dubbelritas fel.
- Inga fel i webbläsarkonsolen.

- [ ] **Step 3: Commit**

```bash
git add frontend/js/renderer.js
git commit -m "feat: rendera bilar och stockar med pixel-grid-tiles istället för rektanglar"
```

---

### Task 7: Slutlig verifiering

**Files:** Inga ändringar — enbart verifiering.

- [ ] **Step 1: Kör hela backend-testsviten**

```bash
cd backend && node --test test/*.test.js
```

Förväntat: alla tester PASS (särskilt `sim-consistency.test.js`, som bekräftar att `sim.js`/`gameloop.js` fortfarande är identiska — de har inte rörts av denna plan, men detta är slutkontrollen).

- [ ] **Step 2: Fullständig visuell genomgång i webbläsaren**

Kör en hel match lokalt (två flikar/fönster för p1/p2, eller en spelare + åskådarläge) och bekräfta:

- Väg, vägren och vatten ser klart mer detaljerade ut än de gamla platta färgerna, men spelplanens läsbarhet (var man kan hoppa) är oförändrad.
- Bilar i båda storlekarna och alla fyra färgerna dyker upp över en match.
- Stockar i båda bredderna syns och grodan/paddan kan fortfarande åka med dem som förut.
- Ingen märkbar prestandaförsämring (spelet känns lika responsivt som innan).

- [ ] **Step 3: Städa bort ev. kvarvarande skräp**

```bash
git status
```

Förväntat: inga ospårade eller ändrade filer utöver det som redan committats i Task 1–6.
