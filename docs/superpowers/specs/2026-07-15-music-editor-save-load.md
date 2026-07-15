# Musikeditor: spara/ladda lokal fil

**Datum:** 2026-07-15
**Status:** Implementerad

## Bakgrund

Editorn hade bara ett sätt att få ut sitt arbete: "Exportera kod", som genererar
`export const LEAD = [...]`-literaler för att klistras in i `audio.js`. Det duger
för det sista steget, men det finns inget sätt att spara en påbörjad komposition
och fortsätta redigera den senare (utan att redan ha klistrat in den i spelet) —
och exportformatet är inte tänkt att läsas in igen (sekventiellt format med
implicita pauser, inte gjort för rundtur).

## Omfattning

Rent frontend-tillägg i `frontend/music-editor.html`. Inget nytt beroende — bara
`Blob`/`URL.createObjectURL` för nedladdning och `<input type="file">` +
`File.text()` för inläsning, båda standard webbläsar-API:er.

## Filformat

```json
{
  "version": 1,
  "tempo": 150,
  "tracks": {
    "lead":    [ { "start": 0, "len": 1, "freq": 392, "bend": null, "vib": false, "trem": false, "duty": null, "arp": null }, ... ],
    "harmony": [ ... ],
    "bass":    [ ... ],
    "rhythm":  [ { "start": 0, "type": "kick" }, ... ]
  }
}
```

Det är alltså `state.tracks` (editorns interna, kolumnbaserade arbetsformat, se
[2026-07-14-music-editor-design.md](2026-07-14-music-editor-design.md)) plus
`state.tempo`, serialiserat rakt av — inget omvandlingssteg, så en sparad fil
läses in exakt likadan som den sparades (till skillnad från export-rutans
sekventiella `{f,d,...}`-format som fyller i pauser och tappar kolumnpositioner).

## Spara

"💾 Spara fil" bygger `{ version, tempo, tracks: state.tracks }`,
`JSON.stringify`:ar den (2-stegs indrag för läsbarhet/diff-vänlighet), skapar en
`Blob`, och triggar en nedladdning via en tillfällig `<a download>`-länk —
samma mönster som webbläsare normalt använder för klientgenererade filer, ingen
File System Access-API eller serverdel behövs. Filnamnet är fast
(`froggy-hop.json`); webbläsarens nedladdningsdialog/inställningar avgör om och
hur den döps om.

## Ladda

"📂 Ladda fil" klickar en dold `<input type="file" accept=".json">`. Vid val:
`file.text()` → `JSON.parse` → en lätt formvalidering (`tracks.lead/harmony/
bass/rhythm` måste alla vara arrayer) innan `state.tracks`/`state.tempo` sätts
och `render()` körs. Ogiltig JSON eller fel format ger ett `alert()` med
förklaring och lämnar det pågående arbetet orört — inget hälften-inläst
tillstånd.

## Testning

Ingen automatiserad testsvit (samma begränsning som övriga delar av verktyget).
Verifierat via headless Chromium (Playwright, `acceptDownloads: true`):

1. Spara av det oredigerade grundtillståndet ger en fil vars `tracks`-innehåll
   matchar exakt (samma antal noter/slag per spår som syns i DOM:en).
2. En redigering (ny bas-not via Penna, tempo ändrat till 160) sparas till en ny
   fil, sedan nollställs arbetsytan med "Återställ till spelets låt" (som bara
   påverkar `state.tracks`, inte tempo-fältet — noterat, inte en bugg: Återställ
   har alltid bara läst om låten, aldrig tempot).
3. Att ladda den sparade filen återställer både noten och tempot exakt.
4. En felaktig/orelaterad JSON-fil ger `alert()` med tydligt felmeddelande och
   ändrar inget i arbetsytan.
5. Export-rundturen (`JSON.stringify`-verifiering mot `LEAD`/`HARMONY`/`BASS`/
   `RHYTHM`) och backend-testsviten (132 tester) påverkas inte.

## Explicit utanför scope

- Inget "senast öppnade filer"-minne eller `localStorage`-autosave — varje
  spara/ladda är en explicit fil-dialog.
- Ingen filnamnsdialog vid spara — fast filnamn, webbläsarens egna
  nedladdningshantering sköter dubbletter/omdöpning.
- Ingen migrering mellan filformatsversioner — `version: 1` finns med för
  framtida bruk men läses inte in eller valideras ännu.
