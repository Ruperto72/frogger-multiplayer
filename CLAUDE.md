# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Kör backend-tester
cd backend && node --test test/*.test.js

# Starta backend lokalt
cd backend && node server.js        # lyssnar på port 3000

# Frontend: öppna frontend/index.html direkt i webbläsare (ingen byggsteg)
```

Använd alltid `node --test test/*.test.js` (glob-form) — katalogformen fungerar inte på Node v24.

## Arkitektur

Monorepo med strikt separation: `backend/` deployas till Render, `frontend/` deployas till GitHub Pages via `.github/workflows/deploy.yml`.

### Backend (CommonJS, Node.js + ws)

Auktoritär spelserver — klienterna skickar bara inputs, servern äger all state.

```
server.js      HTTP-server + WebSocketServer; varje anslutning skickas till lobby.join()
lobby.js       Kö, parar ihop var 2:a anslutning och skapar ett Room
room.js        Spelrum för ett par. Hanterar move-meddelanden, tick-loop, broadcast
gameloop.js    generateLanes(seed) med mulberry32 PRNG; tickObstacles() uppdaterar float-x
collision.js   obstacleCoversCell(), isHazardous() — används av room.js vid varje rörelse och tick
constants.js   Delade konstanter (COLS=13, ROWS=15, zoner som Set, SPAWN, LIVES etc.)
```

Tick-loop körs med `setInterval(100ms)` i Room. Spelarerörelse är händelstyrd och broadcastas omedelbart för låg latens.

Hinderpositioner är **float-x** (mjuk rörelse). Lindning: `if (obs.x >= COLS) obs.x -= COLS; if (obs.x < -obs.width) obs.x += COLS;` — hindret lindas först när det *helt* lämnat kanten.

Kollisionsdetektering använder `Math.floor(((obs.x % COLS) + COLS) % COLS)` som startcell och loopar över `obs.width` med modulo.

### Frontend (ES6 modules, vanilla JS + Canvas)

```
main.js        Bootstrap: skapar GameState, Renderer, Net, Input; kör rAF-loop
net.js         WebSocket-klient med auto-reconnect (3s). URL: localhost:3000 lokalt, annars wss://frogger-multiplayer.onrender.com
input.js       Tangentbordshantering (Arrow* + WASD) → net.send({type:'move', direction})
game.js        GameState.applyMessage() — hanterar 'waiting','match_start','state','event'
renderer.js    Canvas-ritning. Spelplan: 13×15 celler à 48px. Zones: goal/river/safe/traffic/start
```

Ingen byggprocess — ES6-moduler laddas direkt av webbläsaren.

### Nätverksprotokoll

Klient → server: `{ type: 'move', direction: 'up'|'down'|'left'|'right' }`

Server → klient:
- `{ type: 'waiting' }` — i lobby-kö
- `{ type: 'match_start', you: 'p1'|'p2' }` — match börjar
- `{ type: 'state', players, obstacles, round, roundScores, phase }` — vid varje tick och rörelse
- `{ type: 'event', event: 'round_over'|'match_over'|'opponent_disconnected', ... }` — händelser

### Spelplan

```
rad 0:     MÅLRAD
rad 1–5:   FLODSZON (stockar, float-x)
rad 6:     SÄKER MITTZON
rad 7–12:  TRAFIKZON (bilar, float-x)
rad 13–14: STARTZON (spawn p1: x=5,y=14 / p2: x=7,y=14)
```

Rundavinnare: 3 mål eller motståndaren förlorar alla 3 liv. Matchvinnare: 3 vunna rundor (bäst av 5).

Stöt-mekanik: om A hoppar på B:s ruta studsar B ett steg i motsatt riktning. Om studsrutan är farlig → B respawnar utan livförlust.

### Deployment

- **Frontend:** GitHub Actions (`deploy.yml`) → GitHub Pages. Triggas automatiskt vid push till master.
- **Backend:** Render (`backend/render.yaml`). rootDir=backend, startCommand=`node server.js`. Free tier sover efter 15 min inaktivitet.
