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
    goalRow: 0, goalCols: [0, 3, 6, 9, 12],
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

Texterna är bytta (titel, h1, README, HTTP-svar). Grafiken är klar: vilken
spelare som blir groda/padda slumpas av servern när båda blivit redo (se
`Room._assignAnimals()` i `backend/room.js`) och behålls genom matchens
rundor, retro pixel-art i fyra riktningar för grodan. Standardnamnen i
`backend/constants.js` (`DEFAULT_ANIMAL_NAMES`) matchar det tilldelade
djuret ("Frog"/"Toad"). Kvar:

- Infrastrukturnamn (GitHub-repot `frogger-multiplayer`, Render-tjänsten
  `frogger-multiplayer.onrender.com`, URL:en i `frontend/js/net.js`) kan
  behållas eller bytas separat — byts Render-namnet måste net.js uppdateras
  i samma deploy
- Hoppanimation (squash-and-stretch vid landning) — se
  docs/superpowers/specs/2026-07-12-retro-pixel-sprites-design.md, avgränsat bort
- Riktningsspecifika padd-grids (paddan delar just nu samma grid oavsett riktning)

## Mobil

Grunden finns: touchknappar i `frontend/js/touch.js` (visas vid coarse
pointer, döljs permanent vid fysiskt tangentbordstryck) och CSS-skalad
canvas. Kvar att göra:

- Hold-to-repeat på knapparna (nu ger en tap ett drag)
- Testa på riktiga enheter (iOS/Android) — knappstorlek och placering
  kan behöva justeras
- PWA-manifest finns (`frontend/manifest.json`, display: fullscreen, ingen
  service worker — medvetet, onlinespel behöver ingen offline-cache).
  Ikon-wiring klar (`manifest.json`, `apple-touch-icon` i `index.html`,
  `frontend/icon-generator.html`). Kvar: öppna `icon-generator.html` i en
  webbläsare, ladda ner 192×192 + 512×512 PNG till `frontend/icons/` och
  committa — utan filerna triggas inte Chromes installprompt

## Övrigt

- Render free tier sover efter 15 min — överväg extern uptime-pinger
  eller betald tier om kallstarterna stör
- `region: frankfurt` i render.yaml gäller bara vid nyskapande av
  tjänsten; befintlig service måste återskapas i Render-dashboarden
  för att flytta region

## Ljud — fler effekter

`frontend/js/audio.js` har bend, vibrato, tremolo, pulsbredd (duty cycle),
arpeggio (chip-ackord), portamento, bitcrush, eko och chorus — alla
redigerbara i `frontend/music-editor.html` (se
[2026-07-15-audio-portamento-crush-echo-chorus.md](docs/superpowers/specs/2026-07-15-audio-portamento-crush-echo-chorus.md)
för de fyra sistnämnda). Eko och chorus är insprinklade i den faktiska
"Froggy Hop"-melodin (takt 2/4/6/8); portamento och bitcrush är än så länge
bara tillgängliga att komponera med i editorn.
