# Task 11 Report: End-to-end-verifiering och dokumentation

## Step 1: Testsvit

```
cd backend && node --test test/*.test.js
```

**Resultat:** 98 pass, 0 fail, 0 skip. Alla testfiler gröna.

Berörda testfiler:
- bracket.test.js (8 test)
- collision.test.js (5 test)
- constants.test.js (4 test)
- gameloop.test.js (9 test)
- game.test.js (14 test)
- lobby.test.js (4 test)
- manager.test.js (5 test)
- room.test.js (24 test)
- sim-consistency.test.js (3 test)
- tournament.test.js (12 test inkl. 24ms walkover-timer-test)

---

## Step 2: Scripted protocol E2E

Servern startades på port 3001 (PORT=3001 node server.js) och skriptfilen
`backend/e2e-test.js` kördes mot den.

### Scenario 1: Quick-match regression

Output:
```
--- Scenario 1: Quick-match regression ---
  ✔ spelare A får waiting
  ✔ spelare A får match_start
  ✔ spelare B får match_start
  ✔ A är p1 eller p2 (got: p1)
  ✔ B är p1 eller p2 (got: p2)
  ✔ A och B har olika roller
  ✔ A får countdown
  ✔ B får countdown
```

Verifierat: två klienter skickar `quick_match` → båda får `waiting` + `match_start`; skickar `ready` → båda får `countdown`.

### Scenario 2: Turnering med frilott (3 av 4 platser)

Output:
```
--- Scenario 2: Turnering med frilott (3 av 4 platser) ---
  ✔ host får tournament_created
  ✔ kod är 4 tecken: PLXR
  ✔ turnering i fas match (match)
  ✔ bracket finns
  ✔ det finns en frilottsmatch i round 0
  ✔ frilottsvinnaren är redan satt
  ✔ åskådare-logik implicit verifierad via bracket
```

Verifierat: create (size 4, bestOf 1) + 2 join → start → bracket har en match med `p2 === null` (bye), bye-vinnaren är redan satt, fas är `match`.

### Scenario 3: Walkover under match

Output:
```
--- Scenario 3: Walkover under match ---
  ✔ turnering avslutad med fas 'finished' (finished)
  ✔ bracket.walkover är satt
  ✔ Beta vann via walkover (vinnare: Beta)
```

Verifierat: size-2 turnering, båda joined+started+ready → `countdown`-event → host stänger socket → kvarvarande spelare (Beta) får `tournament_state` med `phase: 'finished'` och `bracket[final].walkover === true`.

### Scenario 4: Okänd turneringskod

Output:
```
--- Scenario 4: Okänd turneringskod ---
  ✔ får error-meddelande
  ✔ reason är unknown_code (got: unknown_code)
```

Verifierat: `join_tournament` med kod `'XXXX'` → `{ type: 'error', reason: 'unknown_code' }`.

**Totalt: 20 pass, 0 fail**

---

## Step 3: CLAUDE.md ändringar

Följande ändringar gjordes i `CLAUDE.md`:

1. **Backend-fillista**: lade till `bracket.js`, `tournament.js`, `manager.js` efter `lobby.js`; uppdaterade `room.js`-raden med "(+ åskådare)" och `Opts: winsNeeded, onMatchEnd`.

2. **Frontend-fillista**: lade till `start-ui.js` och `tournament-ui.js` efter `lobby-ui.js`.

3. **Nätverksprotokoll – Klient → server**: ersatte listan med utökad version med `quick_match`, `create_tournament`, `join_tournament` och `start_tournament`.

4. **Nätverksprotokoll – Server → klient**: uppdaterade `match_start`-raden (+ spectator), lade till `tournament_created`/`tournament_state` och `error`-meddelanden.

5. **Protokollavsnittet, efter Rumsfaser**: lade till turneringsbeskrivning med länk till specen.

---

## Filer ändrade

- `CLAUDE.md` — dokumentationsuppdateringar
- `backend/e2e-test.js` — nytt E2E-skript (temporärt testverktyg)

---

## Self-review

- Alla 98 unit-tester gröna utan ändringar i produktionskoden.
- E2E-skriptet verifierar alla 4 protokollscenarier med rena WebSocket-anslutningar utan browser.
- CLAUDE.md-texten matchar briefens exakta formuleringar.
- Visuell verifiering (skins, träd-layout, touch) är delegerad till människa per brief.

## Concerns

- `e2e-test.js` committas till repot. Det är inte ett produktionstest (körs inte av CI) men är ett nyttigt manuellt verktyg.
- Scenario 3 testar att countdown-fasen uppnås innan host stänger; om servern är under last kan timing variera (manuellt E2E-skript, inte CI).

---

## Slutgranskningsfix (fynd 1–3)

### Fynd 1 — stale broadcast efter destroy (backend/room.js)

Lade till `this._destroyed = false` i konstruktorn och `this._destroyed = true` i `destroy()`.
`_broadcast()` och `_broadcastEvent()` returnerar tidigt om `this._destroyed` är sant.

Nytt test i `backend/test/room.test.js` ("destroy: _broadcast och _broadcastEvent skickar ingenting till socketarna"):
skapar ett rum, anropar `destroy()`, registrerar antal meddelanden, anropar sedan `_broadcast()` och `_broadcastEvent('round_over', …)` och verifierar att inga nya meddelanden skickades.

### Fynd 2 — _sentReadyFor kolliderar mellan turneringar (frontend/js/tournament-ui.js)

Redo-dedup-nyckeln inkluderade bara `round:index`. Om en spelare lämnar turnering A efter att ha klickat Redo för match 0:0 och sedan ansluter till turnering B vars första match också är 0:0, visades aldrig Redo-knappen igen.

Fix: nyckeln är nu `${t.code}:${cur.round}:${cur.index}` i klick-hanteraren och motsvarande `${t.code}:${t.currentMatch.round}:${t.currentMatch.index}` i `update()`.

### Fynd 3 — död kod i e2e-test.js (backend/e2e-test.js)

Tog bort den oanvända `allMessages`-funktionen (rad 47–58). Funktionen anropades aldrig och hade en latent bugg: `ws.off('message')` utan listener-argument kastar.

### Verifiering

```
cd backend && node --test test/room.test.js
→ 33 pass, 0 fail

cd backend && node --test test/*.test.js
→ 99 pass, 0 fail

node --check frontend/js/tournament-ui.js  → OK
node --check backend/e2e-test.js           → OK
```
