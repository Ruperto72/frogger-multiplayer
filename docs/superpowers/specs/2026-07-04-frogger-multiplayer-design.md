# Design: Frogger Multiplayer

**Datum:** 2026-07-04  
**Status:** Godkänd

## Sammanfattning

Ett realtids PvP-webbspel inspirerat av det klassiska arkadspelet Frogger. Två spelare möts i en öppen lobby och tävlar mot varandra på samma spelplan. Den som vinner flest rundor tar matchen.

## Spelupplägg

- **Format:** Kapplöpning — båda spelarna navigerar samma spelplan
- **Matchmodell:** Bäst av 5 rundor
- **Rundavinnare:** Den spelare som först når ett bestämt antal mål (3 st) under en runda vinner rundan. En runda avslutas också om en spelare förlorar alla liv.
- **Matchmaking:** Öppen lobby — spelare ställer sig i kö och matchas automatiskt mot nästa person som ansluter

## Spelmekanik

### Banan

Rutnätsbaserad spelplan, 13 kolumner × 15 rader:

```
rad 0:      MÅLRAD (5 platser att landa på)
rad 1–5:    FLODSZON — stockar och sköldpaddor rör sig horisontellt
rad 6:      SÄKER MITTZON
rad 7–12:   TRAFIKZON — bilar rör sig horisontellt
rad 13–14:  STARTZON — spelarna börjar här
```

### Rörelse

- Spelaren hoppar ett steg (upp/ner/vänster/höger) per knapptryckning
- Ingen rörelse utan input — klassisk Frogger-känsla, inte flytande
- Spelarpositioner är alltid heltal (rutnätsceller)

### Liv och händelser

- Varje spelare har 3 liv per runda — liv återställs inför varje ny runda
- Dör man (bil, vatten) → respawn i startzon, liv −1
- Når man målraden → poäng +1 för rundan, respawn i startzon
- Förlorar man alla 3 liv → rundan går förlorad omedelbart

### Spelarmöten (grodor på samma ruta)

När spelare A hoppar in på spelare B:s ruta gäller:

1. B studsar ett steg i **motsatt riktning** mot A:s rörelse (tillbaka mot varifrån A kom)
2. A landar på B:s tidigare ruta normalt
3. Om B:s studsruta är farlig (bil, vatten utan stock, utanför spelplanen) → B respawnar i startzon utan att förlora liv
4. B förlorar aldrig liv enbart på grund av en stöt

### Hinder

Servern genererar hinder (antal körfält, hastigheter, riktningar) slumpmässigt men med ny variation per runda för omväxling. Hindren har float-x-koordinater för mjuk klient-interpolering.

## Arkitektur

```
┌─────────────────────────────────────┐     ┌──────────────────────────────┐
│  GitHub Pages (frontend)            │     │  Render/Railway (backend)    │
│                                     │     │                              │
│  index.html                         │ WS  │  server.js (Node.js)         │
│  game.js  ──── Canvas rendering     │◄───►│  ├─ Lobby / matchmaking      │
│  input.js ──── Tangentbordshantering│     │  ├─ Spelrums-hantering        │
│  net.js   ──── WebSocket-klient     │     │  ├─ Auktoritär spellogik      │
└─────────────────────────────────────┘     │  └─ Game loop (tick ~10/s)   │
                                            └──────────────────────────────┘
```

**Principen: servern är auktoritär.** Klienten skickar bara inputs; servern validerar, uppdaterar state och sänder ut till båda klienterna.

**Spelloop:** Servern kör `setInterval` på ~100 ms (10 tick/s) för hindrörelse. Spelarnas rörelser är händelsestyrda — ny state sänds omedelbart vid input för minimal latens.

## Filstruktur

```
frogger-multiplayer/
├── frontend/               ← deployas till GitHub Pages
│   ├── index.html
│   ├── style.css
│   └── js/
│       ├── main.js         ← bootstrap, initierar allt
│       ├── net.js          ← WebSocket-klient, meddelandehantering
│       ├── game.js         ← spelloop, state, logik
│       ├── renderer.js     ← Canvas-ritning
│       └── input.js        ← tangentbordshantering
└── backend/                ← deployas till Render/Railway
    ├── server.js           ← HTTP + WebSocket-server
    ├── lobby.js            ← matchmaking-kö
    ├── room.js             ← spelrummet, auktoritär state
    ├── gameloop.js         ← tick-loop, hindergenerering
    └── package.json
```

## Nätverksprotokoll

All kommunikation är JSON över WebSocket.

### Klient → Server

```json
{ "type": "move", "direction": "up" }
```

### Server → Klient: spelstate

Skickas vid varje tick (~10/s) samt omedelbart vid varje spelarinput:

```json
{
  "type": "state",
  "players": {
    "p1": { "x": 6, "y": 10, "lives": 3, "score": 1 },
    "p2": { "x": 4, "y": 8,  "lives": 2, "score": 2 }
  },
  "obstacles": [
    { "lane": 8, "x": 3.4, "type": "car", "dir": 1 },
    { "lane": 2, "x": 7.1, "type": "log", "dir": -1 }
  ],
  "round": 2,
  "phase": "playing"
}
```

### Server → Klient: händelser

```json
{ "type": "event", "event": "player_died",  "player": "p2" }
{ "type": "event", "event": "round_over",   "winner": "p1" }
{ "type": "event", "event": "match_over",   "winner": "p2", "score": [3, 2] }
```

### Matchmaking

```json
{ "type": "waiting" }
{ "type": "match_start", "you": "p1" }
```

## Teknikval & Beroenden

| Del | Teknik | Motivering |
|-----|--------|------------|
| Frontend rendering | HTML5 Canvas, vanilla JS | Minimal overhead, full kontroll |
| Nätverksklient | Native WebSocket API | Inbyggt i alla moderna webbläsare |
| Backend | Node.js + `ws` | Enda npm-paket, låg latens |
| Frontend-hosting | GitHub Pages | Gratis, alltid på |
| Backend-hosting | Render / Railway (gratis tier) | Gratis, sover vid inaktivitet (~30 s uppvaknings­tid acceptabelt) |

## Felhantering

- **Disconnect under match:** Den kvarvarande spelaren returneras till lobby-kön. Matchen avbryts.
- **Server sover (cold start):** Frontend visar "Ansluter…"-indikator under WebSocket-uppkopplingen.
- **Ogiltig input från klient:** Servern ignorerar utan att krascha; state ändras inte.

## Avgränsningar (utanför scope)

- Inga användarkonton eller persistent statistik
- Ingen spelhistorik eller replay
- Ingen mobilanpassning (tangentbord krävs)
- Inget ljud i MVP
