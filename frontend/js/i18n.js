// Strängtabell + språkval. Kärnan (t, detectLang) är DOM-fri och testas från
// backend-sviten — därav typeof-vakterna: modulen måste gå att importera i Node.

export const LANGS = {
  sv: {
    'start.namePlaceholder': 'Ditt namn',
    'start.connecting': 'Ansluter till servern … (kan ta upp till en minut om den sover)',
    'start.online': 'Servern är uppe — redo att spela!',
    'start.quick': 'Snabbmatch',
    'start.create': 'Skapa turnering',
    'start.join': 'Gå med',
    'start.codePlaceholder': 'KOD',
    'start.players': '{n} spelare',
    'start.bestof1': 'Bäst av 1',
    'start.bestof3': 'Bäst av 3',
    'start.bestof5': 'Bäst av 5',
    'error.unknown_code': 'Ingen turnering med den koden.',
    'error.tournament_full': 'Turneringen är full.',
    'error.name_taken': 'Namnet är upptaget — välj ett annat.',
    'error.already_started': 'Turneringen har redan startat.',
    'error.tournament_cancelled': 'Värden lämnade — turneringen avbröts.',
    'error.connection_lost': 'Anslutningen bröts. Välj läge för att börja om.',
    'lobby.waiting': 'Väntar på motspelare…',
    'lobby.waitReady': 'Väntar på att motståndaren blir redo…',
    'lobby.found': 'Motspelare hittad — gör dig redo!',
    'lobby.ready': 'redo ✓',
    'lobby.notReady': 'inte redo',
    'lobby.readyBtn': 'Redo',
    't.title': 'Turnering',
    't.codeLabel': 'Kod:',
    't.copy': 'Kopiera länk',
    't.start': 'Lotta & starta',
    't.host': ' (värd)',
    't.joined': '{count} av {size} anslutna',
    't.champion': '🏆 {name} vann turneringen! Ladda om sidan för att spela igen.',
    't.yourMatch': 'Din match står på tur — gör dig redo!',
    't.waitOpponent': 'Väntar på motståndaren…',
    't.spectator': 'Du är åskådare i nästa match.',
    't.bye': '(frilott)',
    't.walkover': 'walkover',
    'game.you': 'DU',
    'game.youShort': 'Du',
    'game.oppShort': 'Motst',
    'game.getReady': 'Gör dig redo!',
    'game.round': 'Runda',
    'game.goals': 'Mål',
    'game.match': 'Match',
    'game.spectatorLabel': 'Åskådare',
    'game.wonRoundYou': 'Du vann rundan! 🐸',
    'game.wonRoundOther': '{name} vann rundan',
    'game.nextRound': 'Nästa runda startar…',
    'game.wonMatchYou': 'Du vann matchen! 🏆',
    'game.wonMatchOther': '{name} vann matchen',
    'game.result': 'Resultat: {score}',
    'game.opponentLeft': 'Motspelaren kopplade från',
    'game.reload': 'Ladda om sidan för ny match',
    'game.opponentFallback': 'Motspelaren',
    'touch.left': 'Vänster',
    'touch.right': 'Höger',
    'touch.up': 'Fram',
    'touch.down': 'Bak',
    'sound.toggle': 'Ljud av/på'
  },
  en: {
    'start.namePlaceholder': 'Your name',
    'start.connecting': 'Connecting to the server … (may take up to a minute if it\'s asleep)',
    'start.online': 'Server is up — ready to play!',
    'start.quick': 'Quick match',
    'start.create': 'Create tournament',
    'start.join': 'Join',
    'start.codePlaceholder': 'CODE',
    'start.players': '{n} players',
    'start.bestof1': 'Best of 1',
    'start.bestof3': 'Best of 3',
    'start.bestof5': 'Best of 5',
    'error.unknown_code': 'No tournament with that code.',
    'error.tournament_full': 'The tournament is full.',
    'error.name_taken': 'That name is taken — pick another.',
    'error.already_started': 'The tournament has already started.',
    'error.tournament_cancelled': 'The host left — the tournament was cancelled.',
    'error.connection_lost': 'Connection lost. Pick a mode to start over.',
    'lobby.waiting': 'Waiting for an opponent…',
    'lobby.waitReady': 'Waiting for your opponent to ready up…',
    'lobby.found': 'Opponent found — get ready!',
    'lobby.ready': 'ready ✓',
    'lobby.notReady': 'not ready',
    'lobby.readyBtn': 'Ready',
    't.title': 'Tournament',
    't.codeLabel': 'Code:',
    't.copy': 'Copy link',
    't.start': 'Draw & start',
    't.host': ' (host)',
    't.joined': '{count} of {size} joined',
    't.champion': '🏆 {name} won the tournament! Reload the page to play again.',
    't.yourMatch': 'Your match is up — get ready!',
    't.waitOpponent': 'Waiting for your opponent…',
    't.spectator': 'You are spectating the next match.',
    't.bye': '(bye)',
    't.walkover': 'walkover',
    'game.you': 'YOU',
    'game.youShort': 'You',
    'game.oppShort': 'Opp',
    'game.getReady': 'Get ready!',
    'game.round': 'Round',
    'game.goals': 'Goals',
    'game.match': 'Match',
    'game.spectatorLabel': 'Spectator',
    'game.wonRoundYou': 'You won the round! 🐸',
    'game.wonRoundOther': '{name} won the round',
    'game.nextRound': 'Next round starting…',
    'game.wonMatchYou': 'You won the match! 🏆',
    'game.wonMatchOther': '{name} won the match',
    'game.result': 'Result: {score}',
    'game.opponentLeft': 'Your opponent disconnected',
    'game.reload': 'Reload the page for a new match',
    'game.opponentFallback': 'Your opponent',
    'touch.left': 'Left',
    'touch.right': 'Right',
    'touch.up': 'Up',
    'touch.down': 'Down',
    'sound.toggle': 'Toggle sound'
  }
};

export function detectLang(saved, navLang) {
  if (saved === 'sv' || saved === 'en') return saved;
  return String(navLang ?? '').toLowerCase().startsWith('sv') ? 'sv' : 'en';
}

let lang = detectLang(
  typeof localStorage !== 'undefined' ? localStorage.getItem('lang') : null,
  typeof navigator !== 'undefined' ? navigator.language : ''
);

export function getLang() {
  return lang;
}

export function t(key, vars) {
  let s = LANGS[lang][key] ?? LANGS.sv[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, () => String(v));
  }
  return s;
}

export function setLang(l) {
  if (l !== 'sv' && l !== 'en') return;
  lang = l;
  if (typeof localStorage !== 'undefined') localStorage.setItem('lang', l);
  applyStatic();
}

export function applyStatic() {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll('[data-i18n]')) {
    el.textContent = t(el.dataset.i18n);
  }
  for (const el of document.querySelectorAll('[data-i18n-placeholder]')) {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  }
  for (const el of document.querySelectorAll('[data-i18n-aria]')) {
    el.setAttribute('aria-label', t(el.dataset.i18nAria));
  }
}
