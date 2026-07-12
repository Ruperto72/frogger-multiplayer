# Retro 80-talsgrafik för groda &amp; padda

Datum: 2026-07-12 · Status: godkänd av Robert

## Mål

Ersätt dagens enfärgade cirklar (`renderer.js` `_drawPlayers`) med pixel-art-sprites
i 80-tals-arkadstil (kantig, klassisk 8-bit-look). p1 ritas alltid som groda, p2
alltid som padda (rollen styr djuret, som beskrivet i TODO.md). Ingår även: samma
princip färgtonad per de tre befintliga skins, uppdaterade standardnamn och
PWA-appikoner baserade på grafiken.

## Pixel-format

12×12-grid per pose, värden 0–5:

- `0` transparent
- `1` kroppsfärg
- `2` kontur/detaljer (mörk)
- `3` ögonvitt
- `4` pupill
- `5` mage/ljus buk

Cellstorleken i spelet är `CELL = 48px` (`frontend/js/main.js`), så varje pixel i
gridet ritas som en `4×4px`-`fillRect` — exakt skalning, ingen oskärpa,
`image-rendering` behövs inte eftersom det är `fillRect`-anrop, inte en uppskalad
bitmap.

### Godkända grids (från brainstorming-mockup)

Groda, upp (default) och padda (statisk, symmetrisk mellan riktningar — paddan
byter inte pose):

```js
const frogUp = [
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

const frogDown = [
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

const frogLeft = [
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
// frogRight = spegling (reverse) av varje rad i frogLeft

const toad = [
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
```

Paddan har samma fyra riktnings-slots i datastrukturen (för framtida särskiljning)
men använder samma grid i alla fyra just nu — paddan är visuellt symmetrisk nog
att det inte märks, och det håller nere antalet handritade grids i denna omgång.

### Färgpaletter per djur och skin

```js
const SKIN_PALETTES = {
  green:  { frog: { 1: '#25b34a', 2: '#0f5c22', 5: '#9fd987' },
            toad: { 1: '#5c7a3c', 2: '#31431f', 5: '#9db97e' } },
  yellow: { frog: { 1: '#e0c22a', 2: '#8a6f10', 5: '#f2e39a' },
            toad: { 1: '#a8791f', 2: '#5c4110', 5: '#d1ac5c' } }, // senapsgul, ej klargul
  blue:   { frog: { 1: '#2a8de0', 2: '#0f4f8a', 5: '#9ad0f2' },
            toad: { 1: '#4c6f8a', 2: '#22384a', 5: '#9db8c9' } },
};
// 3 = '#f4f4e6' (ögonvitt), 4 = '#111' (pupill) — fasta, oberoende av skin/djur
```

`backend/constants.js` `SKINS = ['green', 'yellow', 'blue']` ändras inte — samma
tre id:n används i lobbyn och protokollet oavsett vilket djur spelaren blir.
Substitutionen (paddans "gul" → senapsgul) sker enbart i denna frontend-tabell.
Okänt/saknat skin-id faller tillbaka till `green`, som idag.

## Ny modul: `frontend/js/sprites.js`

Exporterar:
- `drawSprite(ctx, { animal, direction, skin, cx, cy, cellSize })` — ritar
  rätt grid × palett centrerat på `(cx, cy)` med `fillRect` per pixel
- Intern uppslagning grid+palett; `animal` är `'frog' | 'toad'`, `direction` är
  `'up' | 'down' | 'left' | 'right'` (default `'up'` om okänt)

`renderer.js` `_drawPlayers`:
- `animal = pid === 'p1' ? 'frog' : 'toad'`
- Byt `ctx.arc(...)`-ritningen mot `drawSprite(ctx, { animal, direction: state.dirOf(pid), skin: p.skin, cx: rx*cell+cell/2, cy: p.y*cell+cell/2, cellSize: cell })`
- Vit ring för egen spelare (`ctx.strokeStyle/arc`) ritas kvar ovanpå spriten,
  precis som idag — enklast sättet att markera "du" oavsett djur/färg
- Etikett (`DU`/`P1`/namn) ritas kvar oförändrad

## Riktningsspårning (GameState)

Protokollet ändras inte — riktning härleds klientsidan, inte från servern.

- `GameState` får `_lastDir = { p1: 'up', p2: 'up' }` och en getter `dirOf(pid)`
- `predictMove(direction)`: sätter `_lastDir[this.you] = direction` direkt
  (optimistiskt, samma mönster som befintlig positions-prediction)
- `applyMessage()` vid `state`-meddelanden: **innan** `this.players` skrivs över
  med `msg.players`, jämförs varje spelares gamla vs nya `x`/`y`. Vid faktisk
  förflyttning sätts `_lastDir[pid]` utifrån tecknet på `dx`/`dy`; annars behålls
  senaste kända riktning (t.ex. står still vid kant, blockerad rörelse, eller
  studs-mekaniken — studs ändrar inte ansiktsriktning)
- `resetSession()` återställer `_lastDir` till `{ p1: 'up', p2: 'up' }`

## Standardnamn

`backend/constants.js`: `DEFAULT_NAMES = { p1: 'Player 1', p2: 'Player 2' }` →
`{ p1: 'Frog', p2: 'Toad' }`. Påverkar backend-tester som asserterar på de gamla
namnen — uppdateras i samma commit.

## PWA-ikoner

Projektet har ingen build-process och inga npm-beroenden i frontend — ett
canvas/PNG-npm-paket vore ett omotiverat tillskott för två statiska bilder.

- Ny fil `frontend/icon-generator.html` (dev-verktyg, länkas inte från appen):
  ritar grodan (grön, "upp"-posen) uppskalad på en `<canvas>` mot mörk bakgrund
  (`#111111`, matchar `theme_color`), med två nedladdningsknappar (192×192,
  512×512) som triggar `canvas.toDataURL('image/png')` + auto-download-länk
- Öppnas manuellt en gång i webbläsaren; de nedladdade filerna sparas som
  `frontend/icons/icon-192.png` och `frontend/icons/icon-512.png` och committas
- `manifest.json` `icons`-array fylls i med båda, `"purpose": "any"`
- `index.html` får `<link rel="apple-touch-icon" href="icons/icon-192.png">`

## Tester

- **Ny testfil** (frontend har inget testramverk idag för renderer/sprites —
  `sprites.js` är ren funktion utan DOM-beroenden förutom `CanvasRenderingContext2D`,
  så den lämnas otestad i denna omgång; motsvarande mönster som `renderer.js`
  redan har, vilket också saknar tester)
- `backend/test/*.test.js`: uppdatera assertions som refererar `Player 1`/`Player 2`
  till `Frog`/`Toad` där de testar default-namn
- Manuell verifiering: starta spelet lokalt (`run.cmd` / `node server.js` +
  öppna `index.html`), spela en runda, kontrollera att grodan/paddan syns med
  rätt form/färg/riktning i alla fyra rörelseriktningar och alla tre skins

## Ej i scope (kvar i TODO.md)

- Hoppanimation (squash-and-stretch vid landning) — statisk pose per riktning
  räcker för denna omgång
- Riktningsspecifika padd-grids (paddan är symmetrisk och delar grid mellan
  riktningar just nu)
- Bandata-refaktorering (Steg 1/2 i TODO.md "Banbyte") — separat, orelaterat arbete

## Kompatibilitet

Protokollet ändras inte (ingen ny nätverksdata) — frontend och backend kan
deployas oberoende av varandra vad gäller grafiken. `DEFAULT_NAMES`-ändringen är
kosmetisk och bakåtkompatibel (servern skickar bara ett annat default-namn för
spelare som inte angett eget namn).
