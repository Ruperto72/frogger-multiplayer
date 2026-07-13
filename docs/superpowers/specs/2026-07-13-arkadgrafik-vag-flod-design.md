# Arkadgrafik för väg, flod och vägren

**Datum:** 2026-07-13
**Status:** Godkänd, redo för implementationsplan

## Bakgrund

Grodan/paddan renderas som pixel-grid-sprites (`frontend/js/sprites.js`) i 80-tals
arkadstil. Resten av spelplanen (`renderer.js`) är fortfarande platta färgfyllningar:
enfärgad asfalt, enfärgade bilar (röda rektanglar), enfärgat vatten, enfärgade stockar
(bruna rektanglar) och en enfärgad grön "safe"-rad mellan flod och väg. Målet är att ge
väg, bilar, flod, stockar och mellanzonen samma pixel-grid-känsla som djuren.

## Omfattning

Rent visuellt/rendering-arbete i frontend. Ingen ändring av spellogik, nätverksprotokoll
eller backend, förutom en liten tillägg i `game.js` (se nedan). `sim.js`/`gameloop.js`
(låsta av `backend/test/sim-consistency.test.js`) rörs inte.

## Komponenter

### Ny modul: `frontend/js/tiles.js`

Byggs enligt samma mönster som `sprites.js` (pixel-grids, `mirrorRows`-hjälpare,
palettuppslag). Exporterar ritfunktioner/griddar för:

- **Bilar** — två storlekar:
  - Kompaktbil, bredd 1 (12×12-grid)
  - Skåpbil/lastbil, bredd 2 (24×12-grid)
  - Båda med tak, vindruta, hjul, strålkastare i körriktningen. Speglas med
    `mirrorRows` beroende på hindrets `dir` (vänster/höger).
  - 4 klassiska arkadfärger: röd, gul, blå, vit — via en palettabell likt
    `ANIMAL_PALETTES` i `sprites.js`.
- **Stockar** — en trätextur-sprite (årsringar, avrundade ändcaps) som tilas för att
  täcka bredd 2 eller 3: ändcap-segment i vardera änden, mittsegment upprepas.
- **Vägtile** — asfalt med fast (icke-slumpad per frame) pixel-brus-textur samt vita
  streckade linjer mellan varje körfältsrad (rad 7–12).
- **Vägren-tile** (rad 6) — gräs med ljusare grus-/kanttextur mot vägsidan.
- **Vattentile** (rad 1–5) — blå yta med fast pixel-vågmönster, samma teknik som
  asfalten.

### Renderer-ändringar (`frontend/js/renderer.js`)

- **Offscreen-cache:** `_drawBoard()` bygger idag om hela planen varje frame med platta
  `fillRect`. Ny `_boardCache` (offscreen `<canvas>`) ritas lat vid första `draw()`-
  anropet eller när `cell`/`cols`/`rows` ändras (konstruktorn tar redan emot dessa som
  fasta värden, så i praktiken byggs cachen en gång per `Renderer`-instans). Varje frame
  blittas cachen med `drawImage` istället för att räkna om texturen. Mål-rutorna
  (`GOAL_COLS`) ritas ovanpå cachen som idag (statiska, kan också bakas in i cachen).
- **`_drawObstacles`:** byter platta `fillRect` mot `tiles.js`-funktionerna för bil/stock,
  med variant vald deterministiskt (se nedan) istället för `Math.random()` vid ritning.

### Stabilt hinder-index (`frontend/js/game.js`)

`obstaclesAt()` mappar idag `this._base.map(o => ({ ...o, x: obstacleXAt(o, t) }))`.
`_base`-arrayens ordning och innehåll (lane, width, type, speed, dir) är fast under
hela matchen (satt en gång från `generateLanes(seed)`), så array-index är en stabil
identitet per hinder. Ändras till:

```js
this._base.map((o, i) => ({ ...o, x: obstacleXAt(o, t), _idx: i }))
```

`renderer.js` använder `(obs.lane, obs._idx)` som hash-input för att välja bilfärg/
stockvariant deterministiskt, så samma hinder ser likadant ut varje frame utan att
positionen (eller `sim.js`/`gameloop.js`) påverkas.

## Testning

Ingen meningsfull enhetstestning för pixel-ritning. Verifiering sker genom att:

1. Starta appen lokalt (`frontend/index.html`) och visuellt granska väg, bilar
   (båda storlekarna, alla 4 färger), stockar (båda bredderna), vägren och vatten.
2. Köra `cd backend && node --test test/*.test.js` för att bekräfta att
   `_idx`-tillägget i `game.js` inte påverkat sim-konsistensen (frontend har inga
   automatiska tester, men backend-svit körs som regressionsskydd för delade
   koncept som `obstacleXAt`).

## Explicit utanför scope

- Rad 0 (mål) och rad 13–14 (start) — oförändrade.
- Animerade/rörliga körfältslinjer eller vågor — statisk textur räcker.
- Fler än 4 bilfärger eller fler än 1 stockvariant (ljust/mörkt) — användaren valde
  minimal variation för stockar.
