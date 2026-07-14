# Frog vs Toad

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

### Musikeditor (dev-verktyg)

`frontend/music-editor.html` är en fristående piano-roll-editor för bakgrundslåten
i `frontend/js/audio.js` (lead/stämma/bas/rytm). Kräver en lokal http-server (ES-moduler
tillåter inte `file://`):

```bash
node dev-server.js
# öppna http://localhost:8080/music-editor.html
```

Läser in den nuvarande låten automatiskt. Klicka i rutnätet för att lägga/redigera/ta bort
noter, dra i högerkanten för att ändra längd, spela upp med aktuellt tempo och exportera
färdig kod att klistra in i `LEAD`/`HARMONY`/`BASS`/`RHYTHM`.

## Deployment

- **Frontend:** pushas till `master` → GitHub Actions ([deploy.yml](.github/workflows/deploy.yml)) publicerar `frontend/` till GitHub Pages.
- **Backend:** Render enligt [backend/render.yaml](backend/render.yaml) (`rootDir: backend`, `node server.js`).

## Sätta upp en egen instans

Så här konfigurerar du GitHub och Render för att köra spelet på egna konton.

### 1. GitHub — repo och Pages

1. Forka (eller klona och pusha) repot till ditt GitHub-konto. Standardbranchen ska heta `master` — deploy-workflowen triggar på pushar dit.
2. Aktivera Pages: **Settings → Pages → Build and deployment → Source: GitHub Actions**. Ingen branch/mapp ska väljas — workflowen [deploy.yml](.github/workflows/deploy.yml) finns redan i repot och publicerar `frontend/` vid varje push.
3. I forkar är Actions ibland avstängda: kontrollera under repots **Actions**-flik att workflows är aktiverade.

Frontenden hamnar på `https://<användarnamn>.github.io/<reponamn>/`.

### 2. Render — backend

1. Skapa ett konto på [render.com](https://render.com) och koppla det till ditt GitHub-konto.
2. **New → Web Service**, välj repot och ange:
   - **Root Directory:** `backend`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Instance Type:** Free
   - Region: valfri (närmast spelarna, t.ex. Frankfurt)
3. Tjänstens **namn** styr URL:en: `https://<namn>.onrender.com`. Ingen portkonfiguration behövs — servern lyssnar på Renders `PORT`-miljövariabel automatiskt.
4. Auto-deploy vid push till `master` är på som standard — lämna det så, då följer backenden med varje push precis som frontenden.

[backend/render.yaml](backend/render.yaml) dokumenterar samma inställningar och kan användas som Blueprint om den flyttas till repo-roten, men det enklaste är att skapa tjänsten manuellt enligt ovan.

### 3. Peka frontenden mot din backend

I [frontend/js/net.js](frontend/js/net.js) är produktions-URL:en hårdkodad
(`wss://frogger-multiplayer.onrender.com`). Byt den till din Render-URL med
`wss://`-prefix och pusha — klart.

### Bra att veta

- **Frontend och backend deployas av samma push** — det är viktigt, eftersom de måste tala samma protokollversion. Låt bådas auto-deploy vara på.
- **Free tier sover** efter 15 min inaktivitet; första anslutningen därefter kan ta upp till en minut medan tjänsten vaknar.
- Lokalt behövs ingen konfiguration alls — klienten ansluter automatiskt till `ws://localhost:3000` när sidan serveras från `localhost` (se [Utveckling](#utveckling)).
