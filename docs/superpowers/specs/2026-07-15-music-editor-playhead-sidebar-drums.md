# Musikeditor: speluro, sidopanel och fler trumljud

**Datum:** 2026-07-15
**Status:** Implementerad

## Bakgrund

Bygger vidare på grundverktyget och flerspårsvyn (se
[2026-07-14-music-editor-design.md](2026-07-14-music-editor-design.md) och
[2026-07-14-music-editor-multitrack-design.md](2026-07-14-music-editor-multitrack-design.md)).
Tre önskemål efter att ha använt verktyget ett tag:

1. Ingen visuell indikation av var i loopen uppspelningen befinner sig, och inget
   sätt att starta uppspelningen från mitten av låten för att snabbt kunna lyssna på
   ett visst avsnitt.
2. Inspektorpanelen låg under rutnäten och tryckte ner exportrutan när en not var
   markerad — okänsligt för skärmens breddled.
3. Rytmremsan hade bara Kick och Hi-hat — för lite variation för att komponera en
   fylligare trumsättning.

## Omfattning

Frontend-tillägg i `frontend/music-editor.html` samt två nya metoder i
`AudioManager` (`frontend/js/audio.js`): `_scheduleSnare`/`_schedulePuka`. Ingen
ändring av export-/importformatet, datamodellens grundfält eller spelets faktiska
`RHYTHM`-data — snare/puka är nya, tillgängliga slagtyper, inte påtvingade i loopen.

## Speluro (playhead)

- En linjalrad (`RULER_H` = 16px, grid-row 1) läggs till överst i både pianorullen
  och rytmremsan — en cell per kolumn, klick/drag på en cell flyttar speluron dit.
- Själva markören (`.playhead`, absolutpositionerad `div` med en liten pil-topp) kan
  också dras direkt. Den finns i båda rutnäten samtidigt (`pitchPlayheadEl` och
  `rhythmPlayheadEl`) och hålls synkade via en gemensam `updatePlayheadPositions()`
  som sätter `left = 44 + visualPlayhead * 16` px i båda — matchar rutnätets
  kolumnbredd (44px etikettkolumn + 16px/kolumn).
- `state.playhead` är startkolumnen nästa Play-tryck använder. `playOnce(startAt,
  eighthSec, fromCol)` filtrerar bort noter/slag som ligger före `fromCol` för det
  första loop-varvet; efterföljande varv (om Loopa är ikryssad) startar om från
  kolumn 0 som vanligt.
- Under uppspelning animeras markören med `requestAnimationFrame`, positionen
  beräknas ur `ctx.currentTime` relativt när det pågående varvet startade
  (`playStartCtxTime`/`playStartCol`) — ingen separat "rutor per sekund"-räkning.
- Drag/klick i markören eller linjalen medan musiken spelar ger en live-sökning
  (`seekTo`): schemaläggningen startas om från den nya kolumnen utan att stanna
  uppspelningen. Redan schemalagda toner från innan sökningen klingar ut naturligt
  istället för att klippas av — ett medvetet, litet överlapp som är acceptabelt i
  ett förhandslyssningsverktyg (`cancelScheduledValues`-städning bedömdes som
  onödig komplexitet för den här typen av dev-verktyg).
- Stopp-knappen fryser markören vid `state.playhead` (den senast valda
  startpositionen) snarare än vid var uppspelningen råkade stanna, så nästa Play
  alltid är förutsägbar.

## Sidopanel

`.editor-layout` (flex, rad) omsluter en `.rolls-column` (pianorullen +
rytmremsan, staplade som förut, `flex: 1`) och `.inspector` som nu är en
högerspalt med fast bredd (220px) istället för en full-bredd-rad under rutnäten.
Kontrollerna i inspektorn (checkboxar, fält, knappar) staplas vertikalt
(`flex-direction: column`) för att passa den smalare bredden.

## Fler trumljud: snare och puka

Rytmremsan har nu fyra rader (`RHYTHM_ROWS = ['kick', 'snare', 'hihat', 'tom']`,
etiketterna Kick/Snare/Hi-hat/Puka). Samma syntes duplicerad på tre ställen (samma
mönster som befintlig kick/hi-hat — se "Uppspelning" i grunddesignen för varför
editorn inte återanvänder `AudioManager`s privata scheduler): `AudioManager`,
editorns förhandslyssningssyntes, och (avsiktligt inte) den faktiska `RHYTHM`-arrayen.

- **Snare** — bandpassat brus (runt 1.8 kHz, `Q ≈ 0.7`, för det klassiska "crack")
  lagt ovanpå en kort triangel-ton (190→120 Hz) som ger en tonal "kropp", likt hur
  en akustisk virveltrumma har både skinn-ton och snarrsladdarnas brus.
- **Puka** (tom-tom) — samma uppbyggnad som kicken (sjunkande sinus) men ljusare
  startfrekvens (220 Hz) och längre utklingning (~0.3s mot kickens ~0.13s), så den
  hörs som ett eget, mer "bombigt" slag.

Snare/puka är bara tillgängliga att komponera med — den faktiska `RHYTHM`-loopen i
spelet använder fortfarande bara kick/hi-hat tills någon aktivt lägger till fler
slagtyper via editorn och exporterar.

## Testning

Ingen automatiserad testsvit (samma begränsning som övriga delar av verktyget).
Verifierat manuellt och via headless Chromium (Playwright):

1. Sidan laddar utan konsol-/sidfel, sidopanelen har flex-layout och 220px bredd.
2. Rytmremsan visar alla fyra rader; klick i Snare-/Puka-raden lägger rätt `type`.
3. Klick/drag i linjalraden eller i markören flyttar `state.playhead` och
   uppdaterar båda rutnätens markörer synkront.
4. Play startar från vald kolumn; markören animeras framåt under uppspelning;
   Stopp fryser den vid startpositionen igen.
5. Export direkt efter inläsning (inga redigeringar) matchar fortfarande exakt
   befintlig `LEAD`/`HARMONY`/`BASS`/`RHYTHM`-data (samma
   `JSON.stringify`-verifiering som tidigare specar).
6. Backend-testsviten (132 tester) och `frontend/js/audio.js`-syntaxen påverkas
   inte av ändringarna.

## Explicit utanför scope

- Ingen städning av redan schemalagda toner vid live-sökning (se ovan) — accepterat
  litet ljudöverlapp.
- Snare/puka läggs inte till i den faktiska `RHYTHM`-datan som skickas till spelet —
  bara tillgängliga i editorn tills någon väljer att komponera om trumsättningen.
- Ingen ytterligare uppdelning av linjalraden per takt/slag utöver taktstrecken som
  redan finns i `.cell.bar-start`/`.ruler-cell.bar-start`.
