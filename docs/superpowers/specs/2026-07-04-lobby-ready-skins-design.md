# Lobby med namn/Redo, startnedräkning och skin-grund

Datum: 2026-07-04 · Status: godkänd av Robert

## Mål

1. Efter matchning ser båda spelarna en lobbyvy där de anger namn och klickar
   **Redo**. När båda är redo startar spelet efter 3 sekunders nedräkning.
2. Grundläggande skin-stöd: spelaren väljer en av tre färgskins i lobbyn;
   valet följer med i protokollet och styr hur grodan ritas. Riktiga
   sprite-skins läggs i TODO.

## Serverflöde (Room)

- Rummet startar i ny fas `lobby` (i stället för `playing`). Tick-loopen
  ligger redan stilla för faser ≠ `playing`.
- Nytt klientmeddelande: `{ type: 'ready', name, skin }`, giltigt bara i fas
  `lobby`. Servern:
  - trimmar namnet, max 20 tecken, fallback `Spelare 1`/`Spelare 2`
  - validerar skin mot `SKINS` i constants (`green`, `yellow`, `blue`);
    okänd → `green`
  - sätter `ready: true` och broadcastar state
  - dubbel-ready är idempotent
- `players` i state utökas med `name`, `skin`, `ready`.
- När båda är redo: fas → `countdown`, event
  `{ event: 'countdown', duration: 3000 }`, och efter 3 s (setTimeout)
  fas → `playing` + broadcast. Disconnect rensar timern.
- Namn/skin bevaras när spelare återställs vid ny runda.
- Rundpauser oförändrade (3 s "Nästa runda startar…", ingen nedräkning).

## Klient

- `index.html`: HTML-lobbypanel (canvas kan inte ha inputfält) med namnfält
  (maxlength 20), skinväljare (3 färgprickar), Redo-knapp och statusrader.
- Ny modul `frontend/js/lobby-ui.js`: äger panelen. Visas i faserna
  `waiting`/`lobby`, döljs annars. Skickar `ready` vid klick och låser
  formuläret. Motståndarstatus ("Kalle: redo ✓") via `textContent`.
  Återställs när en ny match börjar.
- `game.js`: `match_start` sätter inte längre fas (fasen kommer från state).
  Countdown-eventet sparas med lokal tidsstämpel; `countdownRemaining(now)`
  exponeras för renderern.
- `renderer.js`: `SKINS`-tabell (id → färg) för spelarritning; egen spelare
  markeras med vit ring i stället för egen färg. Countdown-overlay (3-2-1).
  HUD och rund-/matchoverlays visar spelarnamn.
- Båda får välja samma skin — "DU"-etiketten + ringen skiljer dem.

## Tester

- **Room:** startfas lobby; ready sätter namn/skin med trim/fallback;
  dubbel-ready idempotent; båda redo → countdown-event; fas `playing` efter
  3 s (Nodes mock timers); move ignoreras före start; namn/skin överlever
  rundbyte.
- **GameState:** fas styrs av state; countdownRemaining; predictMove null i
  lobby/countdown.
- **Röktest:** utökas med ready-handskakning före första draget.

## Kompatibilitet

Protokollet ändras (spel startar inte utan `ready`) — frontend och backend
deployas tillsammans, som vid seed/ack-ändringen.
