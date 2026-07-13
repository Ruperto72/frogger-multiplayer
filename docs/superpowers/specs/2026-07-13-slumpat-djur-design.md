# Slumpat djur vid matchstart, borttagen färgväljare

## Syfte

Idag är vilket djur en spelare spelar som (groda eller padda) helt statiskt
knutet till anslutningsordning: `p1` är alltid groda, `p2` är alltid padda
([renderer.js:99](../../../frontend/js/renderer.js#L99)). Färgen (`skin`)
väljs separat av spelaren och används bara till nyansering av spriten.

Detta ändras till: när båda spelarna i en match är anslutna och båda klickat
"Redo", slumpar servern vem som blir groda och vem som blir padda.
Färgväljaren tas bort helt — den fyller ingen funktion längre eftersom
groda/padda redan har olika färgpaletter inbyggt.

## Omfattning

Berör redo-flödet och renderingslagret för både snabbmatch och
turneringsmatcher (båda använder samma `Room`-klass i backend). Ingen
ändring av spelmekanik (hinder, kollisioner, poäng, liv), turneringsträd
eller PWA/deploy.

## Backend (`room.js`, `constants.js`)

### Slumpning

I `_handleReady(pid, msg)`, i samma villkor som idag flippar fasen till
`countdown` (`this.state.players.p1.ready && this.state.players.p2.ready`),
läggs ett anrop till en ny privat metod `_assignAnimals()` till:

```js
_assignAnimals() {
  const animals = Math.random() < 0.5 ? ['frog', 'toad'] : ['toad', 'frog'];
  ['p1', 'p2'].forEach((pid, i) => {
    const p = this.state.players[pid];
    p.animal = animals[i];
    if (!p.name) p.name = DEFAULT_ANIMAL_NAMES[p.animal];
  });
}
```

`Math.random()` används (inte den seedade `mulberry32`-PRNG:n som hindren
genererar från) — slumpningen behöver bara vara oförutsägbar för
spelarna, inte deterministisk mellan klient och server. Servern äger
resultatet och broadcastar det i `state.players[pid].animal`; klienterna
räknar aldrig ut det själva.

### Standardnamn skjuts upp

`_handleReady` sätter idag namnet direkt när en enskild spelare blir redo,
med fallback till ett pid-baserat standardnamn. Det ändras till att bara
trimma/spara det inskickade namnet (kan vara tomt sträng) —
fallback-namnet sätts först i `_assignAnimals()`, baserat på det
tilldelade djuret:

```js
_handleReady(pid, msg) {
  const p = this.state.players[pid];
  p.name = String(msg.name ?? '').trim().slice(0, NAME_MAX_LEN);
  p.ready = true;
  if (this.state.players.p1.ready && this.state.players.p2.ready) {
    this._assignAnimals();
    this.state.phase = 'countdown';
    // ... oförändrat: broadcastEvent('countdown', ...), _startTimer
  }
  this._broadcast();
}
```

### Bevaras mellan rundor

`_startNewRound()` bevarar redan `name`/`skin`/`ready` när den
återskapar spelarobjekten mellan rundor i samma match. `skin` byts ut mot
`animal` i den bevarade uppsättningen:

```js
const { name, animal, ready } = this.state.players[pid];
this.state.players[pid] = { ...SPAWN[pid], lives: LIVES, score: 0, name, animal, ready };
```

Eftersom ingen ny redo-fas sker mellan rundor (fasmaskinen går
`playing → round_over → (timer) → playing`, aldrig tillbaka till
`lobby`), slumpas djuret en gång per match och behålls genom alla rundor
i en bäst-av-3/5-match. Nästa match (ny `Room`-instans) slumpar om.

### `constants.js`

- `SKINS` och `DEFAULT_SKIN` tas bort.
- `DEFAULT_NAMES = { p1: 'Frog', p2: 'Toad' }` ersätts med
  `DEFAULT_ANIMAL_NAMES = { frog: 'Frog', toad: 'Toad' }`.
- `newPlayer(pid)` i `_initialState()` sätter inte längre `skin`; `animal`
  lämnas odefinierat tills `_assignAnimals()` körs (spriten ritas aldrig
  före `countdown`-fasen, se nedan).

## Frontend

### Rendering (`renderer.js`, `sprites.js`)

`_drawPlayers()` slutar räkna ut djur från `pid` och läser istället
`p.animal` direkt (satt av servern senast vid `countdown`-fasen, alltid
satt när spelplanen någonsin ritas):

```js
const animal = p.animal;
drawSprite(ctx, { animal, direction: state.dirOf(pid), cx: ..., cy: ..., cellSize: cell });
```

`sprites.js`: `SKIN_PALETTES` (tre färger × två djur) krymps till en enda
tabell med bara de två djurvarianterna — samma nyanser som dagens
`green`-skin (den enda alla faktiskt ser idag som standard):

```js
const ANIMAL_PALETTES = {
  frog: { 1: '#25b34a', 2: '#0f5c22', 5: '#9fd987' },
  toad: { 1: '#5c7a3c', 2: '#31431f', 5: '#9db97e' },
};

export function getPalette(animal) {
  const base = ANIMAL_PALETTES[animal] ?? ANIMAL_PALETTES.frog;
  return { 1: base[1], 2: base[2], 3: EYE_WHITE, 4: PUPIL, 5: base[5] };
}
```

`drawSprite()` tappar `skin`-parametern; `getPalette(skin, animal)` blir
`getPalette(animal)`.

### Borttagen färgväljare

Tas bort helt:

- `index.html`: `#start-skins`- och `#lobby-skins`-blocken (tre
  `.skin`-knappar vardera) och deras `data-i18n-aria`-attribut
- `style.css`: `.skins`, `.skin`, `.skin.selected`,
  `.skin[data-skin="green"|"yellow"|"blue"]`
- `start-ui.js`: `this._skin`-fältet, skin-knapparnas klick-listeners,
  `skin`-fältet i `create_tournament`/`join_tournament`-meddelandena och i
  `_saveProfile()`
- `lobby-ui.js`: samma mönster — `this._skin`, skin-knapparnas
  click-listeners, `skin` i `ready`-meddelandet
- `tournament-ui.js`: `skin: this._state.profile.skin` i
  `join_tournament`-anropet
- `i18n.js`: `skin.green`/`skin.yellow`/`skin.blue`-nycklarna ur både
  `sv`- och `en`-ordböckerna

Ingen ersättande UI läggs till — namnfältet och Redo-knappen står kvar,
layouten justerar sig automatiskt (flex/gap i `.lobby`) när
`.skins`-blocket försvinner.

### Djur-avslöjande

Ingen ny UI-text. Spelaren ser sin tilldelade groda eller padda första
gången spelplanen visas (vid `countdown`-fasen), precis som man idag ser
sin valda färg — helt visuellt, inga nya i18n-strängar eller HUD-element.

## Nätverksprotokoll

- `{ type: 'ready', name, skin }` → `{ type: 'ready', name }`
- `{ type: 'create_tournament', size, bestOf, name, skin }` →
  `{ type: 'create_tournament', size, bestOf, name }`
- `{ type: 'join_tournament', code, name, skin }` →
  `{ type: 'join_tournament', code, name }`
- `state`-broadcastens `players[pid]` innehåller `animal` istället för
  `skin`

`CLAUDE.md`:s protokollavsnitt uppdateras i samma veva som
implementationen.

## Tester

`backend/test/room.test.js`:

- "ready sätter namn, skin och ready-flagga" →
  skrivs om till att verifiera namn + ready-flagga (utan skin)
- "ogiltig skin faller tillbaka på green" → tas bort (finns inget
  skin-fält kvar att validera)
- "namn och skin bevaras vid ny runda" → skrivs om till "namn och djur
  bevaras vid ny runda"
- Nya tester: slumpningen ger exakt en groda och en padda (aldrig två av
  samma), tomt namnfält faller tillbaka på det tilldelade djurets namn
  ("Frog"/"Toad")

`backend/test/sprites.test.js`: uppdateras för `getPalette(animal)`
utan `skin`-parameter.

`backend/test/constants.test.js`: uppdateras för borttagna
`SKINS`/`DEFAULT_SKIN`-exports och ny `DEFAULT_ANIMAL_NAMES`.

## Avgränsning

Ingen ändring av spelmekanik (hinder, kollisioner, poäng, liv,
turneringsträd/walkover-logik, PWA/deploy). Detta är en avgränsad
ändring i redo-flödet och renderingslagret.
