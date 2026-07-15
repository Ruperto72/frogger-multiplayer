# Musikeditor: verktygsfält (penna/sudd/grepp) och aktivt spår

**Datum:** 2026-07-15
**Status:** Implementerad

## Bakgrund

Sedan flerspårsvyn (se
[2026-07-14-music-editor-multitrack-design.md](2026-07-14-music-editor-multitrack-design.md))
visar pianorullen alla tre tonhöjdsspår samtidigt, staplade som tunna (10px) delrader
per tonhöjd. Två problem märktes vid användning:

1. Varje klick i en tom ruta lade omedelbart till en not — det gick inte att bara
   markera/inspektera utan att rita, och det gick inte att flytta eller radera en
   not utan att öppna inspektorn och trycka en knapp.
2. Vilket spår som fick den nya noten avgjordes av exakt vilken av de tunna
   delraderna man träffade — lätt att klicka fel när tre delrader delar en och
   samma tonhöjdsrad.

## Omfattning

Rent frontend-tillägg i `frontend/music-editor.html`. Ingen ändring av
datamodellens grundformat, export/import eller `audio.js`.

## Datamodell

```js
state.activeTrack = 'lead';  // 'lead' | 'harmony' | 'bass' | 'rhythm'
state.tool = 'pen';          // 'pen' | 'eraser' | 'grab'
```

`activeTrack` avgör vilket spår som är redigerbart just nu — alla andra synliga
spår renderas nedtonade (`.inactive`, `opacity`) och görs oklickbara
(`pointer-events: none` i CSS, plus en explicit guard i varje klick-/
mousedown-handler som extra skydd). Det gäller symmetriskt för både
tonhöjdsspårens delrader och hela rytmremsan (som är ett eget rutnät, se
[2026-07-14-music-editor-multitrack-design.md](2026-07-14-music-editor-multitrack-design.md)).

`tool` avgör vad ett klick/drag på det aktiva spårets rutnät gör:

| Verktyg | Tom ruta | Befintlig not/slag (klick) | Befintlig not/slag (dra) |
|---|---|---|---|
| **Penna** | Lägger en ny not/slag (`onCellClick`/`onRhythmCellClick`, oförändrad logik) | Markerar den (öppnar inspektorn) | — |
| **Sudd** | Ingenting | Tar bort den direkt (`deleteNote`/`removeHit`) | — |
| **Grepp** | Ingenting | Markerar den (om inget drag skedde) | Flyttar den (`startMoveNote`/`startMoveHit`) |

Verktygsknapparna (`.tool-group`) och spårknapparna (`.active-track-group`) är
båda enkla radioknapp-grupper (en `.active`-klass åt gången), analogt med hur
tabbarna fungerade innan flerspårsvyn.

## Flytta en not (Grepp)

`startMoveNote(e, track, idx, subLaneCount)` följer samma mousedown/mousemove/
mouseup-mönster som `startResize`. Ett `moved`-flagga (satt när musen rört sig
mer än 3px i någon riktning) skiljer "klick utan rörelse" (→ markera, som Penna)
från en faktisk flytt:

- Horisontellt: `deltaCols = round(dx / 16)` — samma kolumnbredd som resten av
  rutnätet.
- Vertikalt: `pitchRowDelta = round(dy / (SUBLANE_PX * subLaneCount))` — en hel
  tonhöjdsrad motsvarar `subLaneCount` delrader (antal just nu synliga
  tonhöjdsspår), inte bara en delrad, annars skulle noten hoppa fel antal
  halvtoner beroende på hur många spår som råkar vara ikryssade.
- Vid `mouseup`: samma `clearOverlaps`-regel som när en ny not läggs (tar bort
  ev. annan not i samma spår som nu överlappar) — notens index i arrayen kan ha
  ändrats av det, så det nya indexet slås upp med `notes.indexOf(note)` innan
  `state.selected` sätts.
- Under själva draget uppdateras `note.start`/`note.freq` direkt och `render()`
  körs varje `mousemove` — eventuell tillfällig överlappning med andra noter är
  bara kosmetisk (två notrutor ritas på samma cell) tills draget släpps.

`startMoveHit(e, hit)` är motsvarande för rytmslag, fast enklare (ingen längd):
horisontell drag ändrar `hit.start`, vertikal drag ändrar `hit.type` (byter rad,
alltså vilket ljud det är). Samma "ett slag per kolumn"-regel som
`onRhythmCellClick` tillämpas när man släpper.

## CSS

- `.note.inactive`, `.hit.inactive` — `opacity: 0.35; pointer-events: none;`
- `.cell.inactive` — `opacity: 0.5; pointer-events: none;`
- `body[data-tool="…"]` styr muspekarens form (`crosshair` för Penna,
  `not-allowed` för Sudd, `grab` för Grepp) på aktiva element, så man ser vilket
  verktyg som är valt utan att behöva titta på verktygsfältet.
- Resize-handtaget (`.handle`, höger notkant) renderas bara när `tool === 'grab'`
  — annars skulle det ligga i vägen för Penna/Sudd-klick nära notens högerkant.

## Testning

Ingen automatiserad testsvit (samma begränsning som övriga delar av verktyget).
Verifierat via headless Chromium (Playwright):

1. Klick i en inaktiv (nedtonad) ruta gör ingenting, varken riktigt musklick
   eller ett direkt `dispatchEvent('click')` (bekräftar att JS-guarden, inte
   bara CSS `pointer-events`, blockerar).
2. Byte av aktivt spår (t.ex. till Bas) gör dess rutor klickbara och tonar ner
   de andra — bekräftat både via DOM-klasser och skärmdump.
3. Penna lägger en not i aktivt spår; Sudd tar bort en markerad not direkt;
   Grepp med ett 2-kolumners drag flyttar noten `start` två steg och uppdaterar
   `gridColumn` i DOM:en i enlighet med det.
4. Export direkt efter inläsning matchar fortfarande exakt befintlig
   `LEAD`/`HARMONY`/`BASS`/`RHYTHM`-data (samma `JSON.stringify`-verifiering
   som tidigare specar) — verktygen ändrar bara interaktionsmodellen, inte
   datamodellen.
5. Backend-testsviten (132 tester) påverkas inte.

## Explicit utanför scope

- Ingen "lasso"/flerval — Grepp flyttar en not i taget.
- Ingen ångra/gör om för flytt/radering — samma begränsning som resten av
  verktyget (Återställ-knappen eller manuell export/import är enda "ångra").
- Ingen tangentbordsnavigering (piltangenter för att flytta en markerad not) —
  bara musinteraktion.
