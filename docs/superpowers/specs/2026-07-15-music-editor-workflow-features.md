# Musikeditor: autospara, tangentbord, zoom, loop-intervall, flerval/klistra in

**Datum:** 2026-07-15
**Status:** Implementerad

## Bakgrund

Efter en jämförelse med liknande verktyg (piano-roll-editorer/trackers som
FamiTracker/BeepBox/LMMS) identifierades ett antal luckor jämfört med editorns
dåvarande funktionalitet. Allt utom ångra/gör om byggdes i denna omgång:
autospara, tangentbordsgenvägar, horisontell zoom, ett anpassningsbart
loop-intervall, samt flerval (marquee) med kopiera/klistra in.

## Omfattning

Rent frontend-tillägg i `frontend/music-editor.html`. Ingen ändring av
datamodellens grundformat eller `audio.js`.

## Autospara

`AUTOSAVE_KEY = 'frogger-music-editor-autosave'` i `localStorage`. `render()`
anropar `autosave()` som debouncar (400 ms) innan den skriver
`{tempo, tracks}` — annars skulle en drag (som kör om `render()` varje
`mousemove`) hamra på `localStorage`. Vid sidladdning körs
`loadAutosaveIfPresent()`; om ett utkast hittas frågar ett `confirm()`-fönster
om det ska återställas (annars kastas det och spelets nuvarande låt laddas
som vanligt). Separat från den explicita Spara/Ladda-fil-funktionen — ett
skyddsnät mot en oavsiktlig omladdning, inte ett substitut.

## Tangentbordsgenvägar

En `keydown`-lyssnare på `window`, avstängd medan fokus ligger i ett
`INPUT`/`SELECT`/`TEXTAREA` (så tempo-/bend-/arpeggio-fälten inte kapas):

- **Mellanslag** — play/stop
- **1/2/3** — Penna/Sudd/Grepp
- **Delete/Backspace** — radera markering (se "Flerval" nedan)
- **Piltangenter** — flytta markeringen ett steg (kolumn/halvton)
- **Ctrl/Cmd+C/V** — kopiera/klistra in
- **Escape** — avmarkera (eller stäng hjälp-dialogen om den är öppen)

## Zoom

`ZOOM_LEVELS = [8, 12, 16, 24, 32]` (px per kolumn), styrt av 🔍−/🔍+-knappar.
CSS-variabeln `--col-px` (satt via `roll.style.setProperty`) driver
`grid-template-columns: 44px repeat(64, var(--col-px, 16px))`, så
rutnätsbredden ändras utan att bygga om CSS:en. All pixel-till-kolumn-matematik
i JS (scrubbning, resize, notflytt, marquee, loop-drag, speluro-position) läser
samma `colPx`-variabel istället för det tidigare hårdkodade `16` — verifierat
att alla dessa interaktioner fortfarande räknar rätt vid 200 % zoom.

## Loop-intervall

`state.loopStart`/`state.loopEnd` (standard `0`/`COLS`, dvs hela låten).
Ett grönt fält i linjalraden (`.loop-region`, samma `buildLoopRegion()`-mönster
som speluron) med två dragbara handtag. Uppspelningens `loop()`-funktion
(i `startPlaybackFrom`) beräknar `toCol = looping ? state.loopEnd : COLS` och
skickar det vidare till `playOnce`/`scheduleTrackNotes`, som nu filtrerar
`n.start < toCol` (tidigare bara nedre gränsen `fromCol`). Vid loopens slut
startas nästa varv om från `state.loopStart` istället för alltid `0`. En
"Full loop range"-knapp återställer till hela låten. Verifierat genom att
hooka `OscillatorNode`/`AudioBufferSourceNode`: ett 8-kolumners loop-intervall
gav upprepade slag var ~0,4 s (matchar exakt) istället för att glida vidare
till senare takter.

## Flerval (marquee) och kopiera/klistra in

`state.multiSelected` — en `Set` av not-/slagobjekt-referenser (inte index,
som skulle bli ogiltiga när arrayen muteras) i det aktiva spåret.

- **Markera**: att dra på tom rutnätsyta i Grepp-läge (`startMarquee`, kopplat
  via en ny `mousedown`-lyssnare på cellerna) väljer alla noter/slag i det
  aktiva spåret vars startkolumn ligger inom det dragna tidsintervallet
  (`selectRange`). Ett klick utan rörelse avmarkerar istället. En halvgenomskinlig
  gul `.marquee`-ruta visas under draget (rendered i `renderMarquee()`,
  omritad varje `mousemove` liksom notflytt redan gjorde).
- **Flytta tillsammans**: `startMoveNote`/`startMoveHit` upptäcker om den
  dragna noten/slaget ingår i en flervalsgrupp (`multiSelected.size > 1`) och
  flyttar då hela gruppen med samma delta. Kollisioner rensas bara mot
  noter/slag UTANFÖR gruppen (gruppens inbördes positioner var redan
  icke-överlappande innan flytten, så de kan inte kollidera med varandra).
- **Radera tillsammans**: `deleteSelection()` (Sudd-klick på en
  flervalsmedlem, eller Delete-tangenten) tar bort hela gruppen på en gång.
- **Kopiera/klistra in**: `copySelection()` sparar de markerade
  posternas relativa positioner (mot den tidigaste startkolumnen) i en
  modul-lokal `clipboard`-variabel. `pasteClipboard()` klistrar in dem i det
  aktiva spåret, förankrat så att den tidigaste posten hamnar vid speluron
  (`state.playhead`) — kräver att urklippet kommer från SAMMA spårtyp
  (ett rytm-urklipp kan inte klistras in i ett tonhöjdsspår). De inklistrade
  posterna blir automatiskt den nya flervalsgruppen.
- `state.multiSelected` nollställs när aktivt spår byts, ett spår rensas,
  låten återställs, eller en fil laddas in — annars skulle gamla referenser
  peka på objekt som inte längre finns i `state.tracks`.

## Testning

Ingen automatiserad testsvit (samma begränsning som resten av verktyget).
Verifierat via headless Chromium (Playwright):

1. Autospara: en redigering sparas (debounced) till `localStorage`; en
   omladdning visar återställningsdialogen och återställer exakt samma data.
2. Tangentbord: 1/2/3 byter verktyg, Delete raderar en markerad not,
   piltangenter flyttar kolumn/tonhöjd korrekt (verifierat mot
   `gridColumn`/`gridRow`), Escape avmarkerar, Ctrl+C/V kopierar/klistrar in
   (verifierat på en genuint tom kolumn), inmatning i tempofältet kapas inte.
3. Zoom: kolumnbredden i DOM:en ändras (16→24→32 px), och
   speluro-positionering/notflytt fungerar korrekt med den nya bredden.
4. Loop-intervall: att dra sluthandtaget till kolumn 16 ger en 128px bred
   region (16×16px); uppspelning med det intervallet upprepar bara takt 1:s
   slag (verifierat via oscillator/buffer-start-tider som inte glider bortom
   ~0,4 s); "Full loop range" återställer korrekt.
5. Flerval: en marquee över takt 1 väljer exakt 7 lead-noter (matchar takten);
   att dra en av dem flyttar hela gruppen med bevarade inbördes avstånd;
   kopiera+klistra in på en ny position skapar exakt lika många nya noter,
   markerade som den nya gruppen; Sudd-klick eller Delete-tangenten på en
   grupp raderar alla på en gång. Samma verifierat för rytm-slag. Att byta
   aktivt spår nollställer flervalet.
6. Zoom + loop-drag samtidigt: loop-regionens bredd stämmer med den zoomade
   kolumnbredden (200 % zoom, drag till kolumn 20 ger 640px = 20×32px),
   bekräftar att `colPx` används konsekvent i all beroende matematik.
7. Export-rundturen (`JSON.stringify`-jämförelse mot befintlig
   `LEAD`/`HARMONY`/`BASS`/`RHYTHM`) och backend-testsviten (132 tester)
   opåverkade.

## Explicit utanför scope

- Ångra/gör om — uttryckligen undantaget i den här omgången.
- Flerval är begränsat till en enda sammanhängande tidsrymd (marquee), inget
  Ctrl/Cmd-klick för att lägga till/ta bort enskilda poster i en befintlig
  markering.
- Kopiera/klistra in stödjer bara ett urklipp i taget (ingen historik).
- Vertikal zoom (tonhöjdsradernas höjd) — bara horisontell (kolumnbredd)
  implementerad.
