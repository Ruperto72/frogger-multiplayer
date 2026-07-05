# TODO

## Banbyte — nya banor utöver klassiska Frogger

Banlayouten är i dag hårdkodad på flera ställen: `backend/constants.js`
(zon-Sets), `generateLanes` i `backend/gameloop.js` + `frontend/js/sim.js`
(rad-listor) och `frontend/js/renderer.js` (`zoneColor` + målkolumnerna).

### Steg 1: gör banan till data

```js
// backend/levels.js (och identisk kopia/port för frontend, som sim.js)
module.exports = {
  classic: {
    cols: 13, rows: 15,
    goalRow: 0, goalCols: [1, 3, 5, 7, 9],
    spawn: { p1: { x: 5, y: 14 }, p2: { x: 7, y: 14 } },
    lanes: [
      { row: 1, zone: 'river',   type: 'log', speed: [0.03, 0.07], width: [2, 3], count: [2, 3] },
      // ...
      { row: 6, zone: 'safe' },
      { row: 7, zone: 'traffic', type: 'car', speed: [0.04, 0.10], width: [1, 2], count: [2, 3] },
    ]
  }
};
```

- `generateLanes(level, seed)` läser lane-listan i stället för hårdkodade rader
- `isHazardous(level, obstacles, x, y)` slår upp zon i level-objektet
  i stället för `TRAFFIC_ROWS`/`RIVER_ROWS`
- Servern skickar `levelId` (eller hela level-objektet) i `match_start`
  tillsammans med seed — då försvinner resterande duplicerad geometri
  i frontenden och `zoneColor` blir en uppslagning `zone → färg`
- Konsistenstestet i `backend/test/sim-consistency.test.js` utökas till
  att jämföra per bana

### Steg 2: banidéer

- **Dubbelflod** — två flodsektioner med smal säker remsa emellan;
  brutalt i kombination med stötmekaniken
- **Dykande sköldpaddor** — stockar som periodiskt sjunker
  (`submergePhase` i lane-configen, deterministiskt utifrån tick
  så klienten kan förutse det)
- **Expressfil** — trafikrad med mycket snabba, smala bilar (speed 0.15+)
- **Israd** — landrad där man glider vidare i rörelseriktningen tills
  man träffar kant eller hinder
- **Rundrotation** — matcher är bäst av 5; låt varje runda köra nästa
  bana i en lista. Ingen UI behövs, båda spelarna får identiska villkor

## Frog vs Toad — grafik

Texterna är bytta (titel, h1, README, HTTP-svar). Kvar:

- Infrastrukturnamn (GitHub-repot `frogger-multiplayer`, Render-tjänsten
  `frogger-multiplayer.onrender.com`, URL:en i `frontend/js/net.js`) kan
  behållas eller bytas separat — byts Render-namnet måste net.js uppdateras
  i samma deploy
- Grafik (hör ihop med Skins-sektionen nedan): p1 ritas som groda och p2 som
  padda när sprite-skins görs — två olika basdjur i stället för bara olika
  färger. Standardnamnen `Player 1/2` i `backend/constants.js` kan då bli
  "Frog"/"Toad"

## Skins

Grunden finns: `skin` väljs i lobbyn, skickas i ready-meddelandet,
broadcastas i state och renderas via `SKINS`-tabellen i
`frontend/js/renderer.js` (id → färg). Kvar att göra:

- Riktiga sprite-skins — spritesheet + `drawImage` i stället för färgade
  cirklar; `SKINS`-tabellen byter värdetyp från färg till sprite-referens
- Fler skins = ny post i `renderer.js` `SKINS` + `backend/constants.js`
  `SKINS` + knapp i lobbypanelen (`index.html`)
- Ev. riktningsberoende sprites (grodan roterar med senaste draget)

## Mobil

Grunden finns: touchknappar i `frontend/js/touch.js` (visas vid coarse
pointer, döljs permanent vid fysiskt tangentbordstryck) och CSS-skalad
canvas. Kvar att göra:

- Hold-to-repeat på knapparna (nu ger en tap ett drag)
- Testa på riktiga enheter (iOS/Android) — knappstorlek och placering
  kan behöva justeras
- Fullskärm/PWA-manifest för hemskärmsinstallation utan webbläsar-chrome

## Övrigt

- Render free tier sover efter 15 min — överväg extern uptime-pinger
  eller betald tier om kallstarterna stör
- `region: frankfurt` i render.yaml gäller bara vid nyskapande av
  tjänsten; befintlig service måste återskapas i Render-dashboarden
  för att flytta region
