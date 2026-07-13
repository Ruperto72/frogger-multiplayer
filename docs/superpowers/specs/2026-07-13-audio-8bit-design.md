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

`AudioManager`-klassen äger en enda `AudioContext` samt tre gain-noder
(`_master` → destination, `_musicGain` och `_sfxGain` som separata volymreglage
under mastern).

- **`unlock()`** — måste anropas från en användargest (webbläsarkrav för
  ljuduppspelning). Skapar `AudioContext` lazy och återupptar den om den är
  `suspended`.
- **`playHop()`** — kort fyrkantsvågs-svep 180→560 Hz över 70 ms med en
  snabb attack/decay-envelope (exponentiella ramper för att undvika klick).
  Triggas per drag, se nedan.
- **`startMusic()` / `stopMusic()`** — startar/stoppar en loopande
  bakgrundsmelodi.
- **`setMuted(bool)` / `isMuted()`** — styr `_master`-gainen (0/1).

### Melodin: "Froggy Hop"

8 takter i G-dur, komponerade tillsammans med användaren (finslipade som
ABC-notation och förhandslyssnade via ett externt notuppspelningsverktyg innan
de skrevs om till frekvens/notvärde-par). Ligger hårdkodad som `MELODY`-arrayen
i `audio.js`: par av `{ f: <Hz>, d: <längd i åttondelar> }`, med `f: 0` som
paus. Strukturen är fråga/svar — takt 1–4 klättrar och vilar på en halvkadens
("groda som väntar"), takt 5–8 upprepar motivet en oktav upp och landar på
grundtonen.

### Lookahead-scheduler

Melodin spelas inte genom att bara kedja `setTimeout` på notlängden — det
driftar över tid pga JS-timerns onoggrannhet. Istället används samma mönster
som webbaserade trackers ("A Tale of Two Clocks"): en `setTimeout`-loop med
kort intervall (25 ms) som varje gång schemalägger alla noter vars starttid
ligger inom en 100 ms-lookahead, med exakt `AudioContext.currentTime`-baserad
timing per oscillator. Det gör loopen drift- och klickfri oavsett huvudtrådens
belastning.

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
4. Musiken kördes igenom en hel loop (~13 s vid 150 bpm) utan
   schemaläggningsfel vid wrap-around till takt 1.

## Explicit utanför scope

- Inga fler ljudeffekter (död/krock, mål, rundvinst/matchvinst) — bara
  hoppljud + bakgrundsmelodi, enligt uttrycklig avgränsning från användaren.
- Ingen separat volymreglage-UI utöver av/på — bara en mute-knapp.
- Ingen fade-in/fade-out mellan faser (lobby/spel/game over) — musiken
  loopar kontinuerligt från första interaktionen.
