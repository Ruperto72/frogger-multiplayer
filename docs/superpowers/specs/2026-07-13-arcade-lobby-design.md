# Arcade-lobby: 80-talskänsla för overlay-skärmarna

## Syfte

Ge lobby-flödet (startskärm, snabbmatch-väntrum, turneringspanel) en visuell
80-tals synthwave/arcade-känsla. Ren CSS/HTML-omgörning av den delade
`.lobby`-chromen — ingen ändring av spelmekanik, nätverksprotokoll eller
JS-logik i `lobby-ui.js`, `start-ui.js`, `tournament-ui.js`.

## Omfattning

Alla tre overlay-skärmar i [index.html](../../../frontend/index.html) som
delar `.lobby`-klassen:

- `#start` — startskärm (namn, skin, snabbmatch/turnering)
- `#lobby` — snabbmatch-väntrum
- `#tournament` — turneringssamling + bracket

Spelcanvasen (`renderer.js`, sprites) och touch-kontrollerna rörs inte —
temat gäller bara UI-overlays som visas innan/mellan matcher.

## Typografi

- Self-hostad pixelfont (t.ex. "Press Start 2P", OFL-licens) som `.woff2` i
  `frontend/fonts/`, laddad via `@font-face` — fungerar offline och cachas av
  service workern som övriga statiska filer.
- Används på `h1`, knappar (`.primary`, `#lobby-ready`, `#t-start`, `#t-ready`)
  och statuslabels. Kroppstext (felmeddelanden, `.b-note`, spelarlistor)
  behåller monospace — pixelfonten blir svårläst under ~12px.
- Om fontnedladdning inte går att genomföra i implementationsmiljön: falla
  tillbaka på CSS-simulerad pixelkänsla (uppercase, ökat `letter-spacing`,
  staplad `text-shadow`) och flagga avvikelsen.

## Färgpalett

- Botten: nästan svart (`#0a0510`-ton, nära dagens `#111`)
- Primär accent: neonmagenta (`#ff2fb0`-ton) — ersätter dagens gröna
  `.primary`-knappar
- Sekundär accent: cyan (`#2ff3ff`-ton) — paneler, kantlinjer, sekundära
  element
- Highlight/kod: varm gul/orange (`#ffb347`-ton) — samma *roll* som dagens
  `#ffe100` (turneringskod, `t-copy`), bara varmare ton
- Semantiska färger (vinnare grön, fel röd) behålls i ungefär samma nyans men
  får matchande glow
- Skin-väljarens grön/gul/blå-cirklar (`data-skin`) rörs **inte** — det är
  spelmekanik, inte tema

## Bakgrund

Ett fixed lager bakom alla `.lobby`-overlays:

- CSS-gradient "sol" (magenta→orange radial, delvis avskuren av horisonten)
- Perspektiv-rutnät under solen, byggt med `repeating-linear-gradient` +
  `transform: perspective(...) rotateX(...)`, ren CSS/SVG — inget canvas,
  ingen extra JS
- Långsam scroll-loop-animation på rutnätet (`translateY`-keyframes) för
  rörelsekänsla
- `.lobby`-panelerna behåller sin halvtransparenta svarta yta
  (`rgba(0,0,0,0.8)` eller liknande) ovanpå bakgrunden så texten förblir
  läsbar

## Paneler & knappar

- Paneler: tunn neon-kantlinje + dubbel `box-shadow`-glow (tight + spridd) i
  magenta/cyan; skarpare/kantigare hörn istället för dagens rundade
- Knappar: 2–3px solid border i accentfärg, glow på hover/focus,
  "tryck ner"-effekt (`translateY` + minskad skugga) på `:active`.
  Disabled-state behåller dagens grå, dova look.
- `.code-row strong` (turneringskod) och `.b-player.winner` får matchande
  glow i sina accentfärger istället för platt text.

## Effekter & tillgänglighet

- Scanline-lager: tunn `repeating-linear-gradient` över hela overlayn, låg
  opacitet, stör inte läsbarhet
- `@media (prefers-reduced-motion: reduce)`: rutnäts-scroll och ev.
  blink-effekter stängs av, statisk bakgrund istället
- Kontrast dubbelkollas visuellt på mobilbredd (projektets prioriterade
  målgrupp) — glow/text-shadow får inte göra text svårläst i liten storlek

## Teknisk avgränsning

- Berörda filer: `frontend/style.css`, `frontend/index.html` (font-preload,
  ev. bakgrunds-`div`), ny fontfil under `frontend/fonts/`
- Ingen ändring i `lobby-ui.js`, `start-ui.js`, `tournament-ui.js`,
  `game.js`, `renderer.js`, sprites eller backend
- `CACHE_NAME` i service workern bumpas innan push (statiska filer ändras)

## Verifiering

Ingen automatiserad testsvit täcker ren CSS. Verifiering sker genom att öppna
`frontend/index.html` lokalt i webbläsare och visuellt granska start-,
lobby- och turneringsvyerna, inklusive mobilbredd.
