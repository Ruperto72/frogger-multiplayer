# Musikeditor: alla spår samtidigt i pianorullen

**Datum:** 2026-07-14
**Status:** Implementerad

## Bakgrund

[2026-07-14-music-editor-design.md](2026-07-14-music-editor-design.md) beskriver
grundverktyget `frontend/music-editor.html`: fyra flikar (Lead/Stämma/Bas/Rytm) där
bara ett spår visas och redigeras i taget. Det gör det svårt att bedöma hur spåren
samspelar (t.ex. om Stämma krockar med Lead, eller om Bas följer rytmen) och omöjligt
att lyssna på en enskild röst isolerat utan att först klistra in en tom array.

Målet är att visa alla fyra spår samtidigt i pianorullen, med kryssrutor som styr
både synlighet och vilka spår som hörs vid uppspelning — så man t.ex. kan kryssa ur
Stämma och Bas för att lyssna på bara Lead.

## Omfattning

Rent frontend-tillägg i `frontend/music-editor.html` (inga ändringar i `audio.js`,
backend eller spelet). Ersätter flik-baserad vy med en kombinerad vy; export/import,
uppspelningssyntes och datamodellens grundformat (`{start, len, freq, bend, vib, trem,
duty, arp}` / `{start, type}`) förblir oförändrade.

## Datamodell

- `state.tracks` oförändrad.
- `state.track` (aktiv flik) tas bort.
- `state.selected` ändras från ett löpnummer till `{ track, index } | null`, så
  inspektorn vet vilket av de tre tonhöjdsspåren en markerad not tillhör.
- Ny `state.visible = { lead: true, harmony: true, bass: true, rhythm: true }`.
  Styr både rendering och vilka spår `playOnce` schemalägger. Startar helt ikryssad.

## Verktygsfält

Flikraden (`.tabs`) tas bort. Ersätts av fyra rader, en per spår, i verktygsfältet:
kryssruta (bunden till `state.visible[track]`) + färgad etikett (samma färger som
dagens legend) + en liten "Rensa"-knapp som nollställer just det spårets array
(`state.tracks[track] = []`) och kör om `render()`.

Tempo/Play/Stop/Loop/Återställ-knapparna är oförändrade. "Återställ till spelets
låt" anropar redan `loadFromGame()` för alla fyra spår och behöver ingen ändring.

## Pianorulle (Lead/Stämma/Bas)

En gemensam rutnätsyta med tonhöjdsrader (MIDI 45–93, oförändrat omfång). Varje
tonhöjdsrad delas vid rendering i lika många delrader som antalet ikryssade av
Lead/Stämma/Bas (1–3 st, i den ordningen), var och en cirka 9–10px hög — radhöjden
totalt höjs från dagens 15px till omkring 28–30px när alla tre är synliga. Ett
avkryssat spår tar bort hela sin delrad (raden blir kortare), inte bara tom yta.

Eftersom `render()` redan bygger om hela rutnätet från grunden vid varje
tillståndsändring räcker det att loopa över `['lead','harmony','bass'].filter(t =>
state.visible[t])` när delraderna för en tonhöjdsrad skapas — ingen separat
kollaps-logik för CSS Grid behövs.

Svart/vit pianotangent-bakgrund appliceras på hela tonhöjdsraden (gäller alla dess
synliga delrader). Tonhöjdsetiketten (`midiToName`) spänner over raden.

### Redigering

- Klick i en tom cell i ett spårs delrad lägger en not direkt i det spårets array
  (`state.tracks[track]`) — samma "trimma bort överlappande grannar"-logik som idag,
  fast riktad mot det klickade spåret istället för `state.track`.
- Klick på en befintlig not sätter `state.selected = { track, index }`.
- Drag i notens högerkant ändrar längd, oförändrad logik (bara omdirigerad till
  `state.tracks[note.track]`).
- Ett dolt spår renderar inga celler eller noter — det går alltså inte att lägga
  till noter i ett avkryssat spår förrän det kryssas i igen. Detta är avsiktligt
  (se "Utanför scope").

## Rytmremsa

Egen liten 2-radsyta (Kick/Hi-hat) under pianorullen, oförändrad klick-togglar-ett-
slag-interaktion. Renderas bara om `state.visible.rhythm` är true; hela remsan
försvinner annars (ingen delrads-uppdelning behövs här — Kick/Hi-hat är redan två
fysiskt skilda rader).

## Inspektor

Visar radera/vibrato/tremolo/bend/pulsbredd/arpeggio-kontroller för
`state.tracks[state.selected.track][state.selected.index]`, oavsett vilket av de tre
tonhöjdsspåren noten tillhör. Pulsbredd-fältet döljs för bas precis som idag
(`state.selected.track !== 'bass'`).

## Uppspelning

`playOnce` loopar bara över spår vars `state.visible[track]` är true innan den
schemalägger toner/slag. Ingen annan ändring i syntesen (`scheduleTone`/
`scheduleKick`/`scheduleHihat` oförändrade).

## Testning

Ingen automatiserad testsvit (samma begränsning som grundverktyget). Verifieras
manuellt/headless enligt samma mönster som
[2026-07-14-music-editor-design.md](2026-07-14-music-editor-design.md#testning):

1. Sidan laddar med alla fyra kryssrutor ikryssade och alla spår synliga.
2. Avkryssning av ett spår döljer dess noter/delrad (eller rytmremsan) direkt.
3. Klick i en delrad lägger en not i rätt spårs array (verifieras via export).
4. Play med t.ex. bara Lead ikryssad spelar enbart lead-tonerna.
5. Export direkt efter inläsning (inga redigeringar, alla kryssrutor ikryssade)
   matchar fortfarande exakt befintlig `LEAD`/`HARMONY`/`BASS`/`RHYTHM`-data.

## Explicit utanför scope

- Ingen ångra/gör om för synlighets-togglingen — bara `state.visible` i minnet,
  påverkar inte spårdata.
- Ingen redigering av ett dolt spår — måste kryssas i igen först.
- Ingen ändring av rytmremsans radindelning (Kick/Hi-hat delas inte upp ytterligare).
- Ingen ändring av export-/importformatet eller synteslogiken.
