# Arcade-lobby (synthwave/80-tal) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ge de tre lobby-overlayerna (`#start`, `#lobby`, `#tournament`) en
neon/synthwave 80-tals arcade-känsla genom ren CSS/font-omgörning, utan att
röra spellogik, nätverksprotokoll eller JS.

**Architecture:** Allt tema-arbete sker i `frontend/style.css` och en liten
`<link>`-ändring i `frontend/index.html`. Bakgrundseffekten (sol + rutnät)
implementeras som `::before`/`::after`-pseudoelement på den redan existerande
`.lobby`-klassen — den klassen togglar redan `hidden` via befintlig JS, så
bakgrunden följer automatiskt med utan någon ny `<div>` eller JS-ändring.

**Tech Stack:** Ren CSS3 (custom properties, pseudoelement, `@keyframes`,
`prefers-reduced-motion`), en self-hostad WOFF2-webfont. Inget byggsteg —
filerna laddas direkt av webbläsaren precis som idag.

## Global Constraints

- Ingen ändring av JS-logik i `lobby-ui.js`, `start-ui.js`,
  `tournament-ui.js`, `game.js`, `renderer.js`, sprites eller backend.
- Skin-väljarens `data-skin`-färger (grön/gul/blå, style.css:85-87) får inte
  ändras — de är spelmekanik, inte tema.
- Pixelfonten appliceras bara på `h1`, knappar och kod-display — inte på
  löptext/statusmeddelanden/felmeddelanden (de är för långa/små för att vara
  läsbara i en blocky pixelfont).
- Animerade bakgrundseffekter måste respektera
  `@media (prefers-reduced-motion: reduce)`.
- Projektet har ingen registrerad service worker — ingen cache-bump behövs.
- Fonten self-hostas som `.woff2` i `frontend/fonts/` tillsammans med sin
  OFL-licensfil — ingen extern Google Fonts-länk (funkar offline, cachebart).
- Projektet har ingen CSS-testsvit. Varje uppgift verifieras med grep-kontroll
  av CSS-strukturen (snabb, deterministisk) + en samlad manuell
  webbläsargenomgång i sista uppgiften.

---

### Task 1: Self-hostad pixelfont

**Files:**
- Create: `frontend/fonts/press-start-2p.woff2`
- Create: `frontend/fonts/OFL.txt`
- Modify: `frontend/style.css:1` (lägg till `@font-face`, applicera på `h1`,
  knappar, kod-display)
- Modify: `frontend/index.html:11-12` (preload-länk för fonten)

**Interfaces:**
- Producerar: `font-family: 'Press Start 2P'` tillgänglig för resten av
  style.css (Task 2–4 bygger vidare på samma klasser).

- [ ] **Step 1: Hämta fontfilen (latin-subset, täcker å/ä/ö/Å/Ä/Ö och
  siffror/skiljetecken)**

```bash
mkdir -p frontend/fonts
curl -sL -o frontend/fonts/press-start-2p.woff2 "https://fonts.gstatic.com/s/pressstart2p/v16/e3t4euO8T-267oIAQAu6jDQyK3nVivM.woff2"
```

- [ ] **Step 2: Verifiera att filen faktiskt är en giltig WOFF2-fil**

Run: `od -A x -t x1z -v frontend/fonts/press-start-2p.woff2 | head -1`
Expected: raden börjar med byte-sekvensen som avkodas till `wOF2` i
ASCII-kolumnen till höger (t.ex. `77 4f 46 32 ... wOF2....`).

- [ ] **Step 3: Hämta OFL-licensfilen (krävs för self-hostad redistribution)**

```bash
curl -sL -o frontend/fonts/OFL.txt "https://raw.githubusercontent.com/google/fonts/main/ofl/pressstart2p/OFL.txt"
```

Run: `head -c 200 frontend/fonts/OFL.txt`
Expected: text som börjar med "Copyright" och nämner "SIL OPEN FONT LICENSE".

- [ ] **Step 4: Lägg till `@font-face` i style.css**

I `frontend/style.css`, ersätt:

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

body {
```

med:

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

@font-face {
  font-family: 'Press Start 2P';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('fonts/press-start-2p.woff2') format('woff2');
  unicode-range: U+0000-00FF, U+2000-206F, U+20AC, U+2122;
}

body {
```

- [ ] **Step 5: Applicera fonten på rubriker**

Ersätt:

```css
.lobby h1 { font-size: 1.8rem; }
```

med:

```css
.lobby h1 {
  font-family: 'Press Start 2P', monospace;
  font-size: 1.15rem;
  line-height: 1.7;
  letter-spacing: 0.04em;
}
```

- [ ] **Step 6: Applicera fonten på knappar (och krymp storleken — pixelfont
  är betydligt bredare per tecken än monospace)**

Ersätt:

```css
#lobby-ready, .primary {
  font: inherit;
  font-size: 1.3rem;
  font-weight: bold;
  padding: 0.6rem 2.5rem;
  background: #2a8a2a;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
```

med:

```css
#lobby-ready, .primary {
  font: inherit;
  font-family: 'Press Start 2P', monospace;
  font-size: 0.8rem;
  font-weight: normal;
  line-height: 1.6;
  padding: 0.9rem 1.5rem;
  background: #2a8a2a;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
```

- [ ] **Step 7: Applicera fonten på turneringskoden**

Ersätt:

```css
.code-row strong { font-size: 1.5rem; letter-spacing: 0.2em; color: #ffe100; }
```

med:

```css
.code-row strong {
  font-family: 'Press Start 2P', monospace;
  font-size: 1rem;
  letter-spacing: 0.15em;
  color: #ffe100;
}
```

- [ ] **Step 8: Preload-länk i index.html**

I `frontend/index.html`, ersätt:

```html
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <link rel="stylesheet" href="style.css">
```

med:

```html
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <link rel="preload" href="fonts/press-start-2p.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="style.css">
```

- [ ] **Step 9: Grep-kontroll**

Run: `grep -n "Press Start 2P" frontend/style.css`
Expected: 4 träffar (`@font-face`, `.lobby h1`, `#lobby-ready, .primary`,
`.code-row strong`).

- [ ] **Step 10: Manuell koll i webbläsare**

Öppna `frontend/index.html` direkt i en webbläsare (dubbelklicka filen).
Kontrollera att rubriken "Frog vs Toad" och knappen "Snabbmatch" renderas i
en blocky pixelfont, inte i monospace. Kontrollera att "Gå med"-knappen (har
å) inte visar en tofu-ruta.

- [ ] **Step 11: Commit**

```bash
git add frontend/fonts/press-start-2p.woff2 frontend/fonts/OFL.txt frontend/style.css frontend/index.html
git commit -m "feat: self-hostad pixelfont för lobby-rubriker och knappar"
```

---

### Task 2: Neon-färgpalett

**Files:**
- Modify: `frontend/style.css` (CSS custom properties + recolor av
  knappar, kod, felmeddelanden, vinnare, bracket-highlight, språkväljare,
  skin-markering)

**Interfaces:**
- Consumes: `.lobby h1`, `#lobby-ready, .primary`, `.code-row strong` från
  Task 1 (samma selektorer byggs vidare på).
- Producerar: CSS custom properties `--arcade-magenta`,
  `--arcade-magenta-glow`, `--arcade-cyan`, `--arcade-cyan-glow`,
  `--arcade-amber`, `--arcade-amber-glow`, `--arcade-green`, `--arcade-red`
  — används av Task 3 och Task 4.

- [ ] **Step 1: Lägg till `:root`-paletten**

Ersätt:

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

@font-face {
```

med:

```css
* { margin: 0; padding: 0; box-sizing: border-box; }

:root {
  --arcade-magenta: #ff2fb0;
  --arcade-magenta-glow: rgba(255, 47, 176, 0.55);
  --arcade-cyan: #2ff3ff;
  --arcade-cyan-glow: rgba(47, 243, 255, 0.45);
  --arcade-amber: #ffb347;
  --arcade-amber-glow: rgba(255, 179, 71, 0.5);
  --arcade-green: #39ff6a;
  --arcade-red: #ff3b5c;
}

@font-face {
```

- [ ] **Step 2: Rubrikfärg med glow**

Ersätt:

```css
.lobby h1 {
  font-family: 'Press Start 2P', monospace;
  font-size: 1.15rem;
  line-height: 1.7;
  letter-spacing: 0.04em;
}
```

med:

```css
.lobby h1 {
  font-family: 'Press Start 2P', monospace;
  font-size: 1.15rem;
  line-height: 1.7;
  letter-spacing: 0.04em;
  color: var(--arcade-cyan);
  text-shadow: 0 0 6px var(--arcade-cyan-glow), 0 0 16px var(--arcade-cyan-glow);
}
```

- [ ] **Step 3: Knappfärger, kant, glow, hover/active**

Ersätt:

```css
#lobby-ready, .primary {
  font: inherit;
  font-family: 'Press Start 2P', monospace;
  font-size: 0.8rem;
  font-weight: normal;
  line-height: 1.6;
  padding: 0.9rem 1.5rem;
  background: #2a8a2a;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
```

med:

```css
#lobby-ready, .primary {
  font: inherit;
  font-family: 'Press Start 2P', monospace;
  font-size: 0.8rem;
  font-weight: normal;
  line-height: 1.6;
  padding: 0.9rem 1.5rem;
  background: var(--arcade-magenta);
  color: #fff;
  border: 2px solid var(--arcade-cyan);
  border-radius: 2px;
  box-shadow: 0 0 6px var(--arcade-magenta-glow);
  cursor: pointer;
  transition: transform 0.08s ease, box-shadow 0.15s ease;
}

#lobby-ready:hover:not(:disabled), .primary:hover:not(:disabled) {
  box-shadow: 0 0 10px var(--arcade-magenta-glow), 0 0 20px var(--arcade-cyan-glow);
}

#lobby-ready:active:not(:disabled), .primary:active:not(:disabled) {
  transform: translateY(2px);
  box-shadow: 0 0 4px var(--arcade-magenta-glow);
}
```

- [ ] **Step 4: Disabled-state**

Ersätt:

```css
#lobby-ready:disabled, .primary:disabled {
  background: #444;
  color: #888;
  cursor: default;
}
```

med:

```css
#lobby-ready:disabled, .primary:disabled {
  background: #333;
  color: #777;
  border-color: #555;
  box-shadow: none;
  cursor: default;
}
```

- [ ] **Step 5: Felmeddelanden**

Ersätt:

```css
.error { color: #ff6666; min-height: 1.2em; }
```

med:

```css
.error {
  color: var(--arcade-red);
  text-shadow: 0 0 6px var(--arcade-red);
  min-height: 1.2em;
}
```

- [ ] **Step 6: Turneringskodens färg**

Ersätt:

```css
.code-row strong {
  font-family: 'Press Start 2P', monospace;
  font-size: 1rem;
  letter-spacing: 0.15em;
  color: #ffe100;
}
```

med:

```css
.code-row strong {
  font-family: 'Press Start 2P', monospace;
  font-size: 1rem;
  letter-spacing: 0.15em;
  color: var(--arcade-amber);
  text-shadow: 0 0 6px var(--arcade-amber-glow), 0 0 14px var(--arcade-amber-glow);
}
```

- [ ] **Step 7: Kopiera-länk-knappen**

Ersätt:

```css
#t-copy {
  font: inherit;
  margin-left: 0.5rem;
  padding: 0.25rem 0.75rem;
  background: #333;
  color: #fff;
  border: 1px solid #555;
  border-radius: 4px;
  cursor: pointer;
}
```

med:

```css
#t-copy {
  font: inherit;
  margin-left: 0.5rem;
  padding: 0.25rem 0.75rem;
  background: #222;
  color: var(--arcade-cyan);
  border: 1px solid var(--arcade-cyan);
  border-radius: 2px;
  cursor: pointer;
}
```

- [ ] **Step 8: Bracket — pågående match och vinnare**

Ersätt:

```css
.b-match.current { border-color: #ffe100; }
```

med:

```css
.b-match.current { border-color: var(--arcade-cyan); box-shadow: 0 0 6px var(--arcade-cyan-glow); }
```

Ersätt:

```css
.b-player.winner { color: #00e64d; font-weight: bold; }
```

med:

```css
.b-player.winner { color: var(--arcade-green); font-weight: bold; text-shadow: 0 0 6px var(--arcade-green); }
```

- [ ] **Step 9: Vald skin — glow på ringen (själva skin-färgerna orörda)**

Ersätt:

```css
.skin.selected { border-color: #fff; }
```

med:

```css
.skin.selected { border-color: #fff; box-shadow: 0 0 8px rgba(255, 255, 255, 0.85); }
```

- [ ] **Step 10: Aktivt språkval**

Ersätt:

```css
.lang-switch button.active {
  color: #fff;
  border-color: #fff;
}
```

med:

```css
.lang-switch button.active {
  color: var(--arcade-cyan);
  border-color: var(--arcade-cyan);
  text-shadow: 0 0 4px var(--arcade-cyan-glow);
}
```

- [ ] **Step 11: Grep-kontroll — skin-färgerna får inte ha rörts**

Run: `grep -n 'data-skin=' frontend/style.css`
Expected: exakt 3 träffar, oförändrade:
`.skin[data-skin="green"]  { background: #00e64d; }`,
`.skin[data-skin="yellow"] { background: #ffe100; }`,
`.skin[data-skin="blue"]   { background: #4da6ff; }`

- [ ] **Step 12: Manuell koll i webbläsare**

Öppna `frontend/index.html`. Kontrollera att knappar är magentafärgade med
cyan kant och glow, att felmeddelanden (t.ex. felaktig turneringskod) syns i
rött med glow, och att skin-cirklarna fortfarande är gröna/gula/blå.

- [ ] **Step 13: Commit**

```bash
git add frontend/style.css
git commit -m "feat: neon-palett för lobby-knappar, kod och statusfärger"
```

---

### Task 3: Kantiga paneler & fokus-styling

**Files:**
- Modify: `frontend/style.css` (`.lobby`, `.lobby input`, `.lobby select`,
  `.b-match`)

**Interfaces:**
- Consumes: `--arcade-magenta`, `--arcade-magenta-glow`, `--arcade-cyan`,
  `--arcade-cyan-glow` från Task 2.
- Producerar: `.lobby { overflow: hidden; }` — förutsättning för att Task 4:s
  `::before`/`::after`-bakgrund inte ska läcka utanför panelen.

- [ ] **Step 1: Panelens yttre kant och glow**

Ersätt:

```css
.lobby {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
  font-family: monospace;
  z-index: 10;
}
```

med:

```css
.lobby {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  overflow: hidden;
  background: rgba(10, 5, 16, 0.85);
  color: #fff;
  font-family: monospace;
  border: 2px solid var(--arcade-magenta);
  box-shadow: inset 0 0 40px var(--arcade-magenta-glow);
  z-index: 10;
}
```

- [ ] **Step 2: Input-fält — cyan kant, kantigare hörn, fokus-glow**

Ersätt:

```css
.lobby input {
  font: inherit;
  font-size: 1.2rem;
  padding: 0.5rem 0.75rem;
  background: #222;
  color: #fff;
  border: 1px solid #555;
  border-radius: 4px;
  text-align: center;
}
```

med:

```css
.lobby input {
  font: inherit;
  font-size: 1.2rem;
  padding: 0.5rem 0.75rem;
  background: #1a1420;
  color: #fff;
  border: 1px solid var(--arcade-cyan);
  border-radius: 2px;
  text-align: center;
}

.lobby input:focus {
  outline: none;
  box-shadow: 0 0 6px var(--arcade-cyan-glow);
}
```

- [ ] **Step 3: Select-fält — matchande kant**

Ersätt:

```css
.lobby select {
  font: inherit;
  font-size: 1rem;
  padding: 0.5rem;
  background: #222;
  color: #fff;
  border: 1px solid #555;
  border-radius: 4px;
}
```

med:

```css
.lobby select {
  font: inherit;
  font-size: 1rem;
  padding: 0.5rem;
  background: #1a1420;
  color: #fff;
  border: 1px solid var(--arcade-cyan);
  border-radius: 2px;
}
```

- [ ] **Step 4: Bracket-kort — kantigare hörn**

Ersätt:

```css
.b-match { border: 1px solid #555; border-radius: 4px; min-width: 9rem; }
```

med:

```css
.b-match { border: 1px solid #555; border-radius: 2px; min-width: 9rem; }
```

- [ ] **Step 5: Grep-kontroll**

Run: `grep -n "border-radius: 4px" frontend/style.css`
Expected: 0 träffar kvar utanför `.skin` (skin-cirklarna använder
`border-radius: 50%` och ska inte matcha den här sökningen — om sökningen
ger träffar, kontrollera att de inte är i `.lobby input`, `.lobby select`
eller `.b-match`).

- [ ] **Step 6: Manuell koll i webbläsare**

Öppna `frontend/index.html`. Kontrollera att hela skärmen har en tunn
magenta kant med inre glow, att input-fält har cyan kant och att skin-väljarens
cirklar fortfarande är runda (inte kantiga).

- [ ] **Step 7: Commit**

```bash
git add frontend/style.css
git commit -m "feat: kantiga paneler och neon-fokus för lobby-formulär"
```

---

### Task 4: Synthwave-bakgrund (sol, rutnät, scanlines)

**Files:**
- Modify: `frontend/style.css` (nytt block i slutet av filen)

**Interfaces:**
- Consumes: `--arcade-cyan-glow` från Task 2; `.lobby { overflow: hidden }`
  och `position: fixed` från Task 3 (bakgrunden positioneras relativt denna).

- [ ] **Step 1: Lägg till bakgrundslager längst ner i style.css**

Lägg till i slutet av `frontend/style.css` (efter sista raden,
`.lang-switch button.active { ... }`):

```css

.lobby::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background-image:
    repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.35) 0 1px, transparent 1px 3px),
    radial-gradient(circle at 50% 30%, rgba(255, 179, 71, 0.35) 0%, rgba(255, 47, 176, 0.28) 45%, transparent 65%);
}

.lobby::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 50%;
  z-index: -1;
  pointer-events: none;
  opacity: 0.5;
  background-image:
    repeating-linear-gradient(90deg, var(--arcade-cyan-glow) 0 2px, transparent 2px 48px),
    repeating-linear-gradient(0deg, var(--arcade-cyan-glow) 0 2px, transparent 2px 32px);
  transform: perspective(220px) rotateX(65deg);
  transform-origin: bottom;
  animation: arcade-grid-scroll 3s linear infinite;
}

@keyframes arcade-grid-scroll {
  from { background-position: 0 0, 0 0; }
  to   { background-position: 0 0, 0 32px; }
}

@media (prefers-reduced-motion: reduce) {
  .lobby::after {
    animation: none;
  }
}
```

`::before` ligger som förklaring: dess `background-image` innehåller två
lager — en horisontell scanline-textur (svarta 1px-linjer var 3:e pixel) och
en radial "sol"-gradient bakom den. `::after` är det animerade
perspektiv-rutnätet i botten av panelen. Båda har `z-index: -1`, vilket
gör att de målas ovanpå `.lobby`:s egen bakgrundsfärg men under den riktiga
panelinnehållet (`h1`, knappar, formulär) — ingen extra `z-index` behövs på
det riktiga innehållet.

- [ ] **Step 2: Grep-kontroll**

Run: `grep -n "arcade-grid-scroll\|prefers-reduced-motion" frontend/style.css`
Expected: 2 träffar (`@keyframes arcade-grid-scroll` + användningen i
`.lobby::after`, samt `@media (prefers-reduced-motion: reduce)`).

- [ ] **Step 3: Manuell koll i webbläsare — bakgrundseffekt**

Öppna `frontend/index.html`. Kontrollera att en cyan rutnäts-animation syns
längst ner i panelen och en diffus sol-gradient ovanför, samt att
panelinnehållet (rubrik, knappar, text) fortfarande syns tydligt ovanpå
effekterna, inte gömt bakom dem.

- [ ] **Step 4: Manuell koll — reducerad rörelse**

I webbläsarens devtools, aktivera "Emulate CSS prefers-reduced-motion:
reduce" (Chrome: Rendering-panelen). Ladda om sidan och kontrollera att
rutnätet står stilla (ingen scroll-animation) men fortfarande syns statiskt.

- [ ] **Step 5: Commit**

```bash
git add frontend/style.css
git commit -m "feat: synthwave-bakgrund med sol, rutnät och scanlines för lobbyn"
```

---

### Task 5: Slutgiltig verifiering (ingen kodändring)

**Files:** Inga — endast manuell/automatiserad kontroll av föregående
uppgifters resultat.

- [ ] **Step 1: Regressionskoll av backend-testsviten (sanity, inga
  backend-filer ska ha ändrats men bekräftar att inget gått sönder)**

Run: `cd backend && node --test test/*.test.js`
Expected: alla tester passerar, samma resultat som innan detta arbete
påbörjades.

- [ ] **Step 2: Manuell genomgång av alla tre lobby-skärmar i webbläsare**

Öppna `frontend/index.html`. Gå igenom i tur och ordning:

1. **Startskärm (`#start`):** kontrollera pixelfont på rubrik/knappar, neon-
   glow, synthwave-bakgrund, att alla tre knappar (Snabbmatch/Skapa
   turnering/Gå med) är läsbara och inte overflowar på smal skärm.
2. **Snabbmatch-lobby (`#lobby`):** klicka "Snabbmatch", kontrollera samma
   tema i väntrummet.
3. **Turneringspanel (`#tournament`):** skapa en turnering från startskärmen,
   kontrollera kod-displayen (amber glow), bracket-vyn efter lottning
   (cyan/grön highlights).

- [ ] **Step 3: Mobilbredd**

I devtools, växla till en smal viewport (t.ex. 360×740, iPhone SE-storlek).
Kontrollera att ingen knapptext klipps av eller overflowar utanför panelen.
Om text overflowar: minska `font-size`/`padding` på `#lobby-ready, .primary`
(style.css, Task 1 Step 6) tills texten får plats — det finns inget exakt
facit här, justera tills det ser bra ut på 360px bredd.

- [ ] **Step 4: Språkbyte**

Klicka EN/SV-växlaren på startskärmen. Kontrollera att svenska tecken (å/ä/ö
i t.ex. "Gå med", "Kopiera länk") renderas korrekt i pixelfonten utan
tofu-rutor.

- [ ] **Step 5: Slutlig commit-koll**

Run: `git status`
Expected: inga ospårade eller oförändrade filer kvar — allt från Task 1–4 är
redan committat. Om något saknas, committa det nu.
