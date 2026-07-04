# Frogger Multiplayer

Realtids-Frogger för två spelare, byggd med vanilla JavaScript och WebSockets. Två spelare matchas mot varandra och tävlar om att först nå målraden — samtidigt som de kan knuffa varandra ut i trafiken.

**Spela:** https://ruperto72.github.io/frogger-multiplayer/

> Backend körs på Renders free tier och sover efter 15 min inaktivitet — första anslutningen kan ta upp till en minut.

## Spelregler

- Spelplanen är 13×15 celler: målrad överst, flodzon med stockar, säker mittzon, trafikzon med bilar och startzon nederst.
- Bilar dödar vid kollision, floden dödar om du inte står på en stock. Varje spelare har 3 liv per runda.
- **Rundvinst:** nå målet 3 gånger, eller att motståndaren förlorar alla liv. **Matchvinst:** 3 vunna rundor (bäst av 5).
- **Stöt-mekanik:** hoppar du på motståndarens ruta studsar hen ett steg bakåt — hamnar hen på en farlig ruta respawnar hen (utan livförlust).
- **Styrning:** piltangenter eller WASD. På touch-enheter visas skärmknappar (vänster tumme ◀ ▶, höger tumme ▲ ▼) som döljs automatiskt om ett fysiskt tangentbord används.

## Arkitektur

Monorepo med två oberoende delar:

```
backend/    Auktoritär spelserver (Node.js + ws) — deployas till Render
frontend/   Klient (ES6-moduler + Canvas, ingen byggprocess) — deployas till GitHub Pages
```

Servern äger all spelstate; klienterna skickar bara inputs. För låg latens skickar servern **inte** hinderpositioner — klienten genererar identiska banor från ett delat `seed` (deterministisk mulberry32-PRNG) och interpolerar positionerna analytiskt för mjuk 60 fps-rendering. Egna drag prediktas lokalt (seq/ack) tills servern bekräftar dem.

`frontend/js/sim.js` är en port av `backend/gameloop.js` och måste hållas identisk — detta verifieras av `backend/test/sim-consistency.test.js`.

## Utveckling

Kräver Node.js (testerna kräver glob-formen nedan på Node v24).

```bash
# Starta backend lokalt (port 3000)
cd backend && npm install && node server.js

# Kör tester
cd backend && node --test test/*.test.js
```

Frontend: öppna `frontend/index.html` direkt i webbläsaren — den ansluter automatiskt till `localhost:3000` lokalt, annars till produktionsbackenden.

## Deployment

- **Frontend:** pushas till `master` → GitHub Actions ([deploy.yml](.github/workflows/deploy.yml)) publicerar `frontend/` till GitHub Pages.
- **Backend:** Render enligt [backend/render.yaml](backend/render.yaml) (`rootDir: backend`, `node server.js`).
