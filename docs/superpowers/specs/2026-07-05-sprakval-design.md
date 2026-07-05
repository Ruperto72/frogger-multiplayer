# Språkval (sv/en) — design

**Datum:** 2026-07-05
**Status:** Godkänd design, väntar på implementationsplan

## Sammanfattning

Spelets UI blir tvåspråkigt (svenska/engelska) med en växlare på startskärmen.
Standardspråk för nya besökare avgörs av `navigator.language` (sv → svenska,
allt annat → engelska); ett aktivt val sparas i `localStorage` och vinner vid
nästa besök. Ingen i18n-infrastruktur utifrån — en egen minimal strängtabell
(inga beroenden, ingen byggprocess).

## Arkitektur

Ny modul `frontend/js/i18n.js`:

- `LANGS = { sv: {...}, en: {...} }` — alla UI-strängar som nycklar med
  `{x}`-interpolation, t.ex. `'t.joined': '{count} av {size} anslutna'` /
  `'{count} of {size} joined'`.
- `t(key, vars?)` — uppslag i aktivt språk; fallback till svenska om nyckeln
  saknas i engelska ordboken; returnerar nyckeln själv om den saknas helt.
- `getLang()` / `setLang(l)` — `setLang` validerar mot `['sv','en']`, sparar i
  `localStorage('lang')`, sätter `document.documentElement.lang` och kör
  `applyStatic()`.
- Initialt språk: `localStorage('lang')` om giltigt, annars
  `navigator.language`-detektion (prefix `sv` → svenska, annars engelska).
  Detektionslogiken bryts ut som ren funktion (`detectLang(saved, navLang)`)
  så den kan enhetstestas utan DOM.
- `applyStatic()` — uppdaterar alla element med `data-i18n` (textContent),
  `data-i18n-placeholder` (placeholder) och `data-i18n-aria` (aria-label).
  Körs vid boot och vid växling.

**Dynamiska texter** (statusrader, felmeddelanden, canvas-HUD, overlays)
byggs redan om varje frame i rAF-loopen respektive vid varje render — de byter
till `t()`-anrop och följer med automatiskt vid växling. `tournament-ui`:s
render-cache (`_renderedJson`) får språket i cachenyckeln så trädet ritas om.

**Växlare:** två små knappar "SV / EN" i hörnet av startskärmen (aktivt språk
markerat). Ingen växlare under pågående spel.

## Berörda filer

- `frontend/js/i18n.js` (ny) — strängtabell + `t`/`setLang`/`applyStatic`/`detectLang`
- `frontend/index.html` — `data-i18n`-attribut på statiska texter; växlarknappar
- `frontend/js/start-ui.js` — ERROR_TEXTS ersätts av `t('error.<reason>')`;
  "N spelare"/"Bäst av N"-alternativen byggs om vid språkväxling
- `frontend/js/lobby-ui.js` — vänte-/redostatusar via `t()`
- `frontend/js/tournament-ui.js` — statusrader, "(värd)", "(frilott)",
  "walkover", "X av Y anslutna", 🏆-raden via `t()`; språk i render-cachenyckeln
- `frontend/js/renderer.js` — canvas-texter via `t()`: "DU", HUD-etiketter
  (Runda/Mål/Match/Åskådare), overlays (vann rundan/matchen, "Gör dig redo!",
  "Nästa runda startar…", "Motspelaren kopplade från", "Ladda om sidan…")
- `backend/constants.js` — `DEFAULT_NAMES` → `Player 1`/`Player 2`
- `backend/tournament.js` — namnfallback → `Player ${id}`

## Serverns standardnamn

Namn är delad data — alla klienter ser samma sträng oavsett eget språk, så de
kan inte översättas per klient utan protokolländringar. Serverns fallbacks byts
till engelska (`Player 1/2`, `Player N`) som neutral standard; de syns bara när
någon inte anger ett namn. Felkoder från servern är redan språkneutrala
(`unknown_code` osv) och översätts i klienten — inga protokolländringar behövs.

## Testning

- `i18n.js`:s DOM-fria kärna (`t`-uppslag, interpolation, fallback-kedja,
  `detectLang`) testas via dynamic import i backend-sviten (samma mönster som
  `gamestate.test.js`), inkl. paritetstest: sv- och en-ordböckerna har exakt
  samma nyckeluppsättning.
- Backend-tester som asserterar `Spelare N` uppdateras till `Player N`.
- `applyStatic()`/växlaren är DOM-beroende och verifieras manuellt i webbläsare.

## Utanför scope

- Fler språk än sv/en (tabellstrukturen hindrar det inte).
- Översättning av spelarnamn eller annan delad speldata.
- Språkväxlare under pågående match.
