# 8-bitars ljud: hoppblip och loopande arkadmelodi

**Datum:** 2026-07-13
**Status:** Implementerad

## Bakgrund

Spelet hade inget ljud (uttryckligen avgränsat bort i MVP-specen,
[2026-07-04-frogger-multiplayer-design.md](2026-07-04-frogger-multiplayer-design.md)).
Målet är retro 8-bitars ljud i klassisk arkadstil: ett kort "blipp"/"kvack"-ljud
vid varje drag, och en loopande bakgrundsmelodi likt de gamla arkadmaskinerna.

## Omfattning

Rent frontend-arbete, inga ändringar av nätverksprotokoll eller backend. Inga
externa ljudfiler eller beroenden — allt ljud syntetiseras i realtid via
Web Audio API, i linje med projektets övriga stil (vanilla JS, ingen
byggprocess, inga assets att hosta).

## Komponenter

### Ny modul: `frontend/js/audio.js`

`AudioManager`-klassen äger en enda `AudioContext` samt en gain-trädstruktur:
`_master` (destination) ← `_musicGain` ← fyra röstspecifika gain-noder
(`_leadGain`, `_harmonyGain`, `_bassGain`, `_rhythmGain`), plus `_sfxGain`
för hoppljudet direkt under mastern.

- **`unlock()`** — måste anropas från en användargest (webbläsarkrav för
  ljuduppspelning). Skapar `AudioContext` lazy och återupptar den om den är
  `suspended`.
- **`playHop()`** — kort fyrkantsvågs-svep 180→560 Hz över 70 ms med en
  snabb attack/decay-envelope (exponentiella ramper för att undvika klick).
  Triggas per drag, se nedan.
- **`startMusic()` / `stopMusic()`** — startar/stoppar bakgrundsmusiken
  (fyra samtidiga röster, se nedan).
- **`setMuted(bool)` / `isMuted()`** — styr `_master`-gainen (0/1).

### Fyra samtidiga röster ("Froggy Hop")

Efter en uppföljande önskan om fylligare arrangemang (basgång, stämma, rytm)
byggdes musiken om från en enda melodilinje till fyra röster som spelas
samtidigt — samma indelning som NES ljudchip (två fyrkantskanaler, en
triangel-bas, en bruskanal):

- **`LEAD`** — melodin, 8 takter i G-dur, komponerad tillsammans med
  användaren (finslipad som ABC-notation och förhandslyssnad via ett externt
  notuppspelningsverktyg innan den skrevs om till frekvens/notvärde-par).
  Fyrkantsvåg. Struktur: fråga/svar — takt 1–4 klättrar och vilar på en
  halvkadens ("groda som väntar"), takt 5–8 upprepar motivet en oktav upp och
  landar på grundtonen.
- **`HARMONY`** — parallell diatonisk ters under `LEAD` (skalsteg -2:
  G→E, A→F#, B→G, D→B, E→C, F#→D), not för not i samma rytm. Fyrkantsvåg,
  lägre gain (0.5 mot lead-röstens 0.9) så den läggs sig under melodin.
- **`BASS`** — "oom-pah" (grundton/kvint) i triangelvåg som följer
  ackordföljden G–G–D–G, upprepad två gånger (takt 3/7 är D, resten G).
  Ackordvalet härleddes ur vilka toner som faktiskt förekommer i
  `LEAD`/`HARMONY` (bara G-dur- och D-dur-toner — inget C förekommer i
  melodin, så ingen C-ackord används som basnot; det E/C som skymtar i
  stämman i takt 2/6 blir istället en genomgångston ovanpå G-basen, vilket
  låter som ett tillfälligt infärgat ackord snarare än en dissonans).
- **`RHYTHM`** — genererad programmatiskt (`for`-loop, inte hårdkodad array):
  kick på slag 1, hi-hat på slag 2–4, jämnt genom alla 8 takter.

Alla fyra arrayer summerar till exakt 64 åttondelar (8 takter × 8 åttondelar)
— verifierat med ett litet Node-skript vid implementation — så rösterna
loopar perfekt synkroniserat utan att glida isär.

### Lookahead-scheduler

Musiken spelas inte genom att bara kedja `setTimeout` på notlängden — det
driftar över tid pga JS-timerns onoggrannhet. Istället används samma mönster
som webbaserade trackers ("A Tale of Two Clocks"): en `setTimeout`-loop med
kort intervall (25 ms) som varje gång schemalägger alla noter vars starttid
ligger inom en 100 ms-lookahead, med exakt `AudioContext.currentTime`-baserad
timing per oscillator. `_scheduler()` itererar över en lista av fyra
"röst"-objekt (`{ notes, index, nextAt, gain, osc, kind }`), var och en med
egen position i sin notarray men samma klocka — det gör loopen drift- och
klickfri oavsett huvudtrådens belastning, och håller alla röster i fas.

### Percussion-syntes

Ingen ljudfil även för rytmen:

- **Kick** (`_scheduleKick`) — sinusvåg som glider 150→50 Hz över 90 ms med
  snabb attack/decay, samma teknik som `playHop()`.
- **Hi-hat** (`_scheduleHihat`) — en enda återanvänd brusbuffert
  (`_ensureNoiseBuffer()`, 100 ms vitt brus skapad lazy vid första anropet)
  spelas genom ett highpass-filter (6 kHz) med kort envelope (~35 ms) för
  varje slag, istället för att skapa ny brusdata varje gång.

### Uppkoppling mot spelet

- **`frontend/js/input.js`** — `Input`-konstruktorn tar emot en `audio`-instans;
  `move()` anropar `this._audio?.playHop()` efter ett godkänt drag. Detta är
  den enda platsen drag går igenom (tangentbord *och* touch-knappar via
  `touch.js` → `input.move()`), så SFX täcker båda inmatningsvägarna utan
  duplicerad kod.
- **`frontend/js/main.js`** — skapar `AudioManager`, låser upp ljudet och
  startar musiken vid första `keydown`/`pointerdown` (engångslyssnare, tas
  bort efter förstaträffen). Läser/skriver mute-läge till `localStorage`
  (`muted`-nyckeln), samma mönster som `i18n.js` använder för språkval.

### Mute-knapp

Ny `#sound-toggle`-knapp (🔊/🔇), `position: fixed` uppe till vänster
(`style.css`), synlig oavsett vilken skärm (start/lobby/spel) som visas —
samma tekniska mönster som `.tc-group` (touch-kontrollerna). Aria-label via
`data-i18n-aria` och en ny `sound.toggle`-nyckel i `i18n.js` (sv/en).

## Testning

Ingen automatiserad testsvit täcker frontend-rendering/ljud idag (samma
begränsning som gäller `tiles.js`/`renderer.js`, se
[2026-07-13-arkadgrafik-vag-flod-design.md](2026-07-13-arkadgrafik-vag-flod-design.md)).
Verifierat manuellt och via headless Chromium (Playwright):

1. Sidan laddar utan konsol-/sidfel.
2. Mute-knappen togglar `#sound-toggle`s ikon och `AudioManager`s mute-state
   korrekt vid upprepade klick.
3. En simulerad tangenttryckning (`ArrowUp`) triggar både `unlock()` och
   `playHop()` utan undantag.
4. Musiken kördes igenom två hela loopar (~26 s vid 150 bpm, alla fyra röster
   samtidigt) utan schemaläggningsfel vid wrap-around till takt 1.

## Explicit utanför scope

- Inga fler ljudeffekter (död/krock, mål, rundvinst/matchvinst) — bara
  hoppljud + bakgrundsmelodi, enligt uttrycklig avgränsning från användaren.
- Ingen separat volymreglage-UI per röst — bara en gemensam mute-knapp.
  Balansen mellan lead/stämma/bas/rytm är fasta gain-värden i koden.
- Ingen fade-in/fade-out mellan faser (lobby/spel/game over) — musiken
  loopar kontinuerligt från första interaktionen.
- Ingen ackordföljd bortom G–D (I–V) — höll arrangemanget enkelt och
  garanterat dissonansfritt mot den befintliga melodin/stämman.
