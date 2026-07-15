# Musikeditor: ångra/gör om + kodgranskningsfixar

**Datum:** 2026-07-15
**Status:** Implementerad

## Ångra/gör om

Den sista luckan från verktygsjämförelsen (se
[2026-07-15-music-editor-workflow-features.md](2026-07-15-music-editor-workflow-features.md)).

### Design: debounce:ad checkpointing på render()

Varje mutation i editorn slutar redan i `render()`. Istället för att sprida
`pushHistory()`-anrop över varje mutationsställe (och behöva särbehandla
drag-gester som muterar per mousemove) hakar historiken på `render()`:

- `checkpointHistory()` (anropas sist i `render()`) debouncar 400 ms och kör
  sedan `commitHistory()`: serialisera `{tempo, tracks}`; skiljer den sig från
  `lastCommitted` läggs det gamla värdet på `undoStack` (tak 100 steg),
  `redoStack` töms (en ny redigering ogiltigförklarar redo-grenen) och
  `lastCommitted` uppdateras.
- En drag-gest som renderar 30 gånger blir därmed **ett** ångra-steg —
  granulariteten följer gester, inte mousemoves. Samma debounce-idé som
  autospara använder redan.
- `undo()`/`redo()` börjar med `commitHistory()` så en ännu inte
  debounce-committad ändring viks in som ett eget steg först (Ctrl+Z direkt
  efter en redigering, inom 400 ms-fönstret, fungerar alltså korrekt).
- Återställning (`restoreSnapshot`) byter ut `state.tracks`/`state.tempo`
  och nollställer markeringar (gamla objektreferenser finns inte i den
  återställda datan). Vy-tillstånd (zoom, loop-intervall, aktivt spår,
  synlighet) ingår medvetet INTE i historiken — det är vy, inte låtdata.
- Eftersom snapshot:en är hela låten återställs även "kollaterala" ändringar
  korrekt (t.ex. en granne som trimmades bort av `clearOverlaps` när en not
  drogs över den — ett ångra tar tillbaka båda).

### UI

↶/↷-knappar i verktygsfältet (disabled-tillstånd speglar stackarna),
Ctrl/Cmd+Z ångra, Ctrl/Cmd+Skift+Z eller Ctrl/Cmd+Y gör om. Hjälpdialogen
uppdaterad.

## Kodgranskningsfixar

En genomgång av `music-editor.html`, `audio.js`, `game.js`, `input.js` och
`main.js` hittade följande, alla åtgärdade:

1. **Hoppljud + nätverkstrafik vid drag in i väggen** (`game.js`):
   `predictMove` ökade `seq`, skickade ett move-meddelande och triggade
   hoppljudet även för drag rakt ut ur brädet, där grodan står still.
   Nu returneras `null` för kantdrag utan att `seq` ökas (inget skickas,
   inget ljud) — säkert eftersom servern bara ackar seq den tar emot, och
   ett aldrig utdelat seq aldrig behöver ackas. Spriten vänds fortfarande
   mot kanten. Nytt test i `gamestate.test.js` låser beteendet (133 tester).

2. **Gruppflytt/knuff komprimerade gruppen vid brädkanten** (editorn, den
   allvarligaste): `startMoveNote`/`startMoveHit`/`nudgeSelection` klampade
   varje gruppmedlem individuellt mot brädets gränser — drogs gruppen mot
   kanten trycktes inbördes avstånd ihop permanent och medlemmar kunde
   hamna ovanpå varandra. Nu klampas det **gemensamma deltat** en gång
   utifrån gruppens ytterlighet (min/max start, längder, tonhöjder), så
   gruppens geometri alltid bevaras; vid kanten stannar hela gruppen som
   en enhet.

3. **Korsvis inklistring mellan tonhöjdsspår blockerades** (editorn):
   urklippskontrollen krävde exakt samma spår som kopian kom ifrån, trots
   att lead/harmony/bass delar notformat (och dokumentationen bara lovade
   rytm-mot-tonhöjd-inkompatibilitet). Nu jämförs kategorin
   (rytm kontra tonhöjd), så en lead-fras kan klistras in i stämman/basen.

4. **Hållet mellanslag togglade play/stop i repeat-takt** (editorn):
   `keydown` auto-repeterar; nu ignoreras `e.repeat` för mellanslag
   (piltangenternas repeat är däremot önskvärd och behålls).

5. **Ekots delay-tid följde inte tempobyten** (editorn): `ensureDelay`
   satte `delayTime` bara när noden skapades; efter ett tempobyte inom
   samma AudioContext behöll ekot gamla tempots rytm. Nu uppdateras värdet
   vid varje anrop.

6. **Porta kunde spela förbi loop-gränsen** (editorn): en `porta`-not
   strax före loop-slutet kunde absorbera en not bortom `toCol` och ljuda
   efter gränsen. Nu krävs `next.start < toCol` för sammanslagning.

7. **Rytm-inklistring vid kanten kunde ge dubbla slag i samma kolumn**
   (editorn): klampningen `min(COLS-1, ...)` kunde trycka ihop två
   urklippsposter till samma kolumn. Nu dedupliceras per kolumn (första
   vinner), i linje med "ett slag per kolumn"-regeln.

8. **Porta-självglidning i AudioManager** (`audio.js`, kantfall): en röst
   med en enda not flaggad `porta` skulle glida in i sig själv
   (`nextIndex === voice.index`). Nu vaktas fallet och noten spelas som
   vanligt. Inträffar inte med nuvarande låtdata — ren robusthet.

### Noterat men medvetet inte ändrat

- `startResize` respekterar inte flerval (bara den dragna noten ändrar
  längd) — rimlig semantik, gruppresize är sällan vad man vill.
- Visuella markörer för `trem`+`crush` respektive `echo`+`chorus` krockar
  (båda paren sätter `background-image` resp. `box-shadow`) — endast
  kosmetiskt, ljudet är korrekt; redan noterat i effekt-specen.
- Marquee-bandet ritas i båda rutnäten oavsett var draget sker — konsekvent
  med hur speluron redan speglas i båda.

## Testning

Verifierat via headless Chromium (Playwright) + backend-sviten:

1. Ångra/gör om: knappar disabled vid start; lägg not → ångra → gör om;
   ångra inom debounce-fönstret viker in den väntande ändringen; en drag
   över många mousemoves = exakt ett steg (återställer även den granne som
   trimmades bort); ny redigering tömmer redo; tempobyte är ångringsbart.
2. Granskningsfixarna: korsvis inklistring lead→harmony fungerar;
   gruppdrag 20 kolumner ut över kanten landar klampat med exakt bevarade
   inbördes avstånd; piltangent vid kanten är no-op istället för
   komprimering; hållet mellanslag (repeat-events) togglar inte.
3. Export-rundturen förlustfri som tidigare; spara/ladda-flödet intakt;
   spelets `index.html` laddar utan fel; backend-sviten 133/133 (inkl. det
   nya kantdrags-testet).
