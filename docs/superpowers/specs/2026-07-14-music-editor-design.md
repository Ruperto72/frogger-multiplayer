# Musikeditor för 8-bitarslåten

**Datum:** 2026-07-14
**Status:** Implementerad

## Bakgrund

Bakgrundslåten ("Froggy Hop", se
[2026-07-13-audio-8bit-design.md](2026-07-13-audio-8bit-design.md)) ligger hårdkodad som
fyra dataarrayer (`LEAD`, `HARMONY`, `BASS`, `RHYTHM`) i `frontend/js/audio.js`. Att
finslipa melodin för hand innebar att räkna ut frekvenser/notlängder och redigera
JS-literaler direkt — omständligt för iterativ komposition. Målet är ett litet,
fristående verktyg som ger en piano-roll-liknande redigeringsyta, körbart lokalt utan
nya beroenden.

## Omfattning

Rent frontend-tillägg, ett nytt fristående dev-verktyg — påverkar inte spelet, backend
eller nätverksprotokollet. Enda ändringen i `audio.js` är att `LEAD`/`HARMONY`/`BASS`/
`RHYTHM`/`TEMPO_BPM` görs till namngivna exports (var tidigare modul-privata `const`),
så verktyget kan importera den faktiska, aktuella låten som utgångspunkt istället för
att hålla en egen separat kopia som kan bli inaktuell.

## Ny fil: `frontend/music-editor.html`

Fristående HTML+inline CSS/JS, samma mönster som `frontend/icon-generator.html`
(ej länkad från `index.html`, inte del av spelet). Kräver att sidan serveras över
`http://` (samma skäl som resten av frontend: ES-moduler tillåter inte `file://`) —
körs via den redan existerande `dev-server.js`.

### Datamodell

Editorn jobbar internt med kolumnbaserade noter (`{ start, len, freq, bend, vib }` för
Lead/Stämma/Bas, `{ start, type }` för Rytm-slag) på ett rutnät om 64 kolumner
(8 takter × 8 åttondelar — matchar loopens fasta längd). Två konverteringsfunktioner
speglar detta mot det sekventiella `{ f, d, bend, vib }`-formatet som
`AudioManager._scheduler()` faktiskt konsumerar:

- `toColumnNotes`/`toColumnHits` — vid inläsning, går igenom sekvensen och ackumulerar
  kolumnposition per `d`.
- `fromColumnNotes`/`fromColumnHits` — vid export, sorterar noter på starttid och fyller
  i mellanrum som pauser (`f: 0`). Rytmspårets export räknar ut `d` som avståndet till
  nästa slag (inklusive loop-wrap för sista slaget), eftersom `RHYTHM`s `d`-fält är ett
  tidsavstånd, inte en hörbar längd.

Verifierat: en export direkt efter inläsning (inga redigeringar) matchar exakt de
befintliga `LEAD`/`HARMONY`/`BASS`/`RHYTHM`-arrayerna (`JSON.stringify`-jämförelse),
så rundturen import → export tappar ingen data.

### Interaktion

- Fyra flikar (Lead/Stämma/Bas/Rytm), separat rutnät per spårtyp.
- Lead/Stämma/Bas: tonhöjd (rader, ~4 oktaver kromatiskt, MIDI 45–93) × tid (kolumner).
  Klick på tom cell lägger en not (längd 1 åttondel); klick på en not markerar den
  (radera/vibrato/bend redigeras i en panel under rutnätet); drag i notens högerkant
  ändrar längd. Nya/ändrade noter trimmar automatiskt bort överlappande grannar.
- Rytm: två rader (Kick/Hi-hat), klick togglar ett slag av/på — inga längder, matchar
  att kick/hi-hat-ljuden har fasta envelopes oavsett notvärde.
- Bend redigeras som halvtoner relativt notens egen tonhöjd (talinmatning, 0 = inget
  bend) snarare än en absolut målfrekvens, för enklare mental modell.

### Uppspelning

Egen, enklare syntes (~40 rader) istället för att återanvända `AudioManager`s privata
flerröst-scheduler, som är byggd för en fast, kontinuerligt loopande
4-röstsuppsättning — inte ett generellt "spela godtyckliga spår"-API. Samma
oscillatortyper/envelopes som spelet (fyrkant för lead/stämma, triangel för bas,
sjunkande sinus för kick, högpass-filtrerat brus för hi-hat) så förhandslyssningen
låter som i spelet. Play schemalägger en hel 8-taktersloop i taget (inte spelets
lookahead-loop — onödigt för en "lyssna en gång eller loopa" preview-knapp) och
schemalägger nästa loop via `setTimeout` om loop-kryssrutan är ikryssad.

### Export

Genererar `export const LEAD = [...]` osv. i exakt samma literalsyntax som `audio.js`
redan använder, med frekvenser avrundade till 2 decimaler. Facit klistras in för hand i
`audio.js` — inget automatiskt skriv-till-fil (verktyget körs i webbläsaren, har ingen
filsystemåtkomst).

## Testning

Ingen automatiserad testsvit (samma begränsning som övrig frontend-rendering).
Verifierat manuellt och via headless Chromium (Playwright):

1. Sidan laddar utan konsol-/sidfel.
2. Flikbyte mellan alla fyra spår fungerar utan fel.
3. Not tillagd/markerad/raderad, Play/Stop fungerar utan undantag.
4. Export direkt efter inläsning matchar exakt (`JSON.stringify`-jämförelse) den
   befintliga `LEAD`/`HARMONY`/`BASS`/`RHYTHM`-datan — bekräftar att rundturen är
   förlustfri.

## Explicit utanför scope

- Ingen "spara direkt till `audio.js`" — copy/paste av exportrutan är avsiktligt
  den enkla vägen, inga filskrivnings-API:er eller byggsteg.
- Ingen ångra/gör om-historik — enda "ångra" är Återställ-knappen (läser om
  spelets nuvarande låt) eller att manuellt bygga om via export/import.
- Ingen import av godtyckliga MIDI-filer — verktyget jobbar bara mot det interna
  formatet som redan används i `audio.js`.
