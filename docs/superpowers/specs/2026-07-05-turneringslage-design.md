# Turneringsläge — design

**Datum:** 2026-07-05
**Status:** Godkänd design, väntar på implementationsplan

## Sammanfattning

Ett turneringsläge för slutna sällskap (familj, vänner, kollegor): en värd skapar en
turnering med 2–16 deltagare, spelarna ansluter med en kod, och en rak utslagningscup
(kvartsfinal → semi → final) spelas en match i taget medan alla övriga ser matchen i
realtid som åskådare. Vid exakt 2 deltagare spelas bara en vanlig match utan träd.

Gruppspel (VM-stil) är medvetet **utanför scope** i v1, men datamodellen (turnering som
orkestrering ovanpå oförändrade `Room`) ska inte hindra att det byggs senare.

## Arkitekturval

Turneringen byggs som **ett orkestreringslager ovanpå `Room`** (alternativ A):

- Ny `backend/tournament.js` äger deltagarlista, lottning och utslagsträd, och skapar
  ett vanligt `Room` per match — samma mönster som `lobby.js` gör idag.
- `Room` förblir "två spelare, en match". Minimal utökning: konstruktorn tar
  `{ winsNeeded, onMatchEnd }`, plus `addSpectator(ws)`.
- Dagens snabbmatch-kö (`lobby.js`) lämnas orörd.

Alternativet (generalisera Room till N-klientsession) förkastades: det river i den mest
kritiska och vältestade koden (tick-loop, kollision, prediction-ack) utan motsvarande vinst.

## Livscykel

1. **Skapa:** Värden väljer antal deltagare (2–16), bäst av (1/3/5) samt namn/skin.
   Servern svarar med en kod (4 bokstäver, unik bland aktiva turneringar) som delas
   muntligt eller via länk (`?code=XXXX`). Värden är själv deltagare.
2. **Samling:** Övriga ansluter med kod + namn/skin. Alla ser deltagarlistan.
   Värden kan trycka **"Lotta & starta"** så fort minst 2 anslutit (behöver inte vänta
   på full turnering — en kollega med förhinder ska inte blockera kvällen).
3. **Lottning:** Deltagarna slumpas in i ett träd av storlek 2/4/8/16 (närmsta 2-potens
   uppåt). Överskottsplatser blir frilotter: spelaren möter `null` och går direkt vidare.
4. **Matchloop:** Matcherna spelas **en i taget** i fast ordning (hela omgång 1, sedan
   omgång 2, osv). Mellan matcherna ser alla trädet med nästa match markerad. Nästa
   matchpar trycker **Redo** (dagens mekanik) → countdown → match. Alla övriga är
   åskådare i realtid.
5. **Avslut:** Efter finalen visas segraren i trädet; alla återgår till startskärmen.

## Datamodell (backend, i minnet — ingen databas)

```js
Tournament {
  code,                 // 4 bokstäver
  bestOf,               // 1 | 3 | 5 → Room får winsNeeded = ceil(bestOf/2)
  size,                 // valt antal deltagare
  phase,                // 'gathering' | 'between_matches' | 'match' | 'finished'
  participants: [{ id, ws, name, skin, connected, isHost }],
  bracket: [            // rounds[roundIndex][matchIndex]
    [{ p1, p2, winner, walkover }]   // p1/p2 = participant-id eller null (frilott)
  ],
  currentMatch,         // { round, index } | null
  room                  // aktivt Room | null
}
```

Ett `TournamentManager` i `server.js` håller `Map<code, Tournament>` och städar bort
avslutade/övergivna turneringar. `Tournament` får matchresultat via
`onMatchEnd(winner)`-callback, skriver in vinnaren i trädet och aktiverar nästa match.

## Nätverksprotokoll

Samma WebSocket som idag. Första klientmeddelandet väljer väg: `quick_match`
(dagens kö), `create_tournament` eller `join_tournament`.

**Klient → server (nytt):**

```js
{ type: 'create_tournament', size, bestOf, name, skin }
{ type: 'join_tournament', code, name, skin }
{ type: 'start_tournament' }        // endast värd, i fas gathering
```

Namn/skin valideras som idag (trim, max 20, skin mot SKINS). `ready` och `move`
behåller dagens format och hanteras av det aktiva rummet; `ready` gäller bara de två
spelare vars match står på tur.

**Server → klient (nytt):**

```js
{ type: 'tournament_created', code }
{ type: 'tournament_state',          // broadcastas till ALLA vid varje förändring
  code, phase, bestOf, size,
  participants: [{ id, name, skin, connected, isHost }],
  bracket,                           // hela trädet inkl. resultat
  currentMatch,                      // { round, index } | null
  you }                              // mottagarens participant-id
{ type: 'error', reason }            // 'unknown_code' | 'tournament_full' | 'name_taken' | 'tournament_cancelled' | ...
```

`tournament_state` är **hela sanningen varje gång** (samma filosofi som dagens
`state`) — trädet är litet, ingen delta-logik. Det gör också framtida reconnect trivial.

**Under match** återanvänds dagens meddelanden, med ett tillägg:

```js
{ type: 'match_start', you: 'p1' | 'p2' | 'spectator' }
```

Åskådare får samma `state`/`event`-ström som spelarna; hindren simuleras lokalt från
`seed`, så en åskådare kostar bara broadcast-bandbredd. Efter `match_over` skickas ett
nytt `tournament_state`, vilket flyttar alla klienter till trädvyn.

## Frontend

**Startskärm** (utökad `lobby-ui.js` eller syskonmodul): tre val — **Snabbmatch**
(dagens flöde), **Skapa turnering** (antal + bäst av), **Gå med** (kodfält, förifyllt
från `?code=` i URL:en). Namn/skin-UI:t återanvänds för alla vägar.

**Ny `tournament-ui.js`** — HTML/CSS-panel med två lägen:

- *Samling:* koden stor och tydlig (+ kopiera länk), deltagarlista, "Lotta & starta" för värden.
- *Träd:* utslagsträdet renderat som ren funktion av senaste `tournament_state` → DOM.
  Namn, resultat, vinnare, nästa match highlightad. Är du en av de två i nästa match
  visas Redo-knappen här; annars "Du är åskådare i nästa match". Max 4 kolumner
  (16 spelare); flexbox, staplas/scrollas horisontellt på mobil.

**Åskådarläge:** vid `you: 'spectator'` sätter `main.js` en flagga så att
`input.js`/`touch.js` inte skickar `move` och ingen prediction körs — `game.js`
renderar serverns senaste `state` rakt av (hindren är redan mjuka via lokal simulering).
`renderer.js` ritar spelarnas namn ovanför grodorna (nytt, gäller även spelare) plus en
"Åskådare: X mot Y"-etikett.

Klientfaser: startskärm → samling → träd ⇄ match → träd → segrarskärm.
Snabbmatchvägen rör inte trädvyn.

## Kantfall

- **Disconnect under samlingen:** deltagaren tas bort, platsen öppnas. Lämnar **värden**
  under samlingen avbryts turneringen (`error: 'tournament_cancelled'` till alla).
- **Disconnect under match:** dagens `opponent_disconnected` i Room återanvänds;
  turneringen tolkar det som **walkover** — motståndaren skrivs in som vinnare
  (markerad `walkover`).
- **Disconnect i väntan:** deltagaren markeras `connected: false`. Står en frånkopplad
  spelare på tur får motståndaren walkover efter 30 s frist.
- **Värd-disconnect efter start:** vanlig deltagar-disconnect — Redo-mekaniken driver
  flödet, värden behövs bara för starten.
- **Frilotter:** vid t.ex. 6 deltagare byggs ett 8-träd där 2 slumpade spelare möter
  `null` i omgång 1; de matcherna avgörs omedelbart utan spel och visas som "frilott".
- **Ingen reconnect till pågående turnering i v1.** Servern har ingen sessionsidentitet;
  en återanslutning är en ny anslutning. Känd begränsning — kan byggas senare med
  rejoin-token i localStorage tack vare att `tournament_state` alltid är komplett.

## Tester

Samma stil som befintliga (`node --test test/*.test.js`):

- `bracket.test.js` — trädgenerering för 2–16 deltagare: storlek, antal frilotter,
  avancemang, finalvinnare.
- `tournament.test.js` — hela flödet med mock-sockets: skapa/gå med/full/fel kod/
  namnkollision, start, alla walkover-fall ovan.
- Room-testerna utökas: `winsNeeded`-parametern; åskådare får broadcasts men kan inte flytta.
- `sim-consistency.test.js` påverkas inte — simuleringen rörs inte.

## Deployment

Inga nya beroenden, ingen databas — allt i minnet som idag. Render-konfig och
GitHub Pages-deploy oförändrade. Render free tier: somnar servern dör turneringen,
men under en aktiv kväll pågår trafik kontinuerligt — samma kallstartsproblem som idag.
