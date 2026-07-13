import { t as tr, getLang } from './i18n.js';

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

export class TournamentUI {
  constructor(net, state) {
    this._net = net;
    this._state = state;
    this._sentReadyFor = null; // 'round:index' som Redo redan skickats för
    this._renderedJson = null;

    this._root    = document.getElementById('tournament');
    this._codeEl  = document.getElementById('t-code');
    this._players = document.getElementById('t-players');
    this._bracket = document.getElementById('t-bracket');
    this._start   = document.getElementById('t-start');
    this._ready   = document.getElementById('t-ready');
    this._status  = document.getElementById('t-status');

    document.getElementById('t-copy').addEventListener('click', () => {
      const code = this._state.tournament?.code ?? '';
      navigator.clipboard?.writeText(`${location.origin}${location.pathname}?code=${code}`);
    });
    this._start.addEventListener('click', () => this._net.send({ type: 'start_tournament' }));
    this._ready.addEventListener('click', () => {
      const t = this._state.tournament;
      const cur = t?.currentMatch;
      if (cur) this._sentReadyFor = `${t.code}:${cur.round}:${cur.index}`;
      this._net.send({
        type: 'ready',
        name: this._state.profile.name
      });
    });
  }

  // Anropas från rAF-loopen
  update() {
    const s = this._state;
    const t = s.tournament;
    const visible = s.mode === 'tournament' && !!t &&
      (t.phase === 'gathering' || t.phase === 'between_matches' ||
       t.phase === 'finished' || s.phase === 'lobby');
    this._root.classList.toggle('hidden', !visible);
    if (!visible) return;

    // Bygg bara om DOM när innehållet ändrats
    const json = JSON.stringify([t, s.phase, this._sentReadyFor, getLang()]);
    if (json === this._renderedJson) return;
    this._renderedJson = json;

    this._codeEl.textContent = t.code;
    const me = t.participants.find(p => p.id === t.you);

    if (t.phase === 'gathering') {
      this._players.classList.remove('hidden');
      this._bracket.classList.add('hidden');
      this._ready.classList.add('hidden');
      this._players.replaceChildren(...t.participants.map(p =>
        el('p', null, `${p.name}${p.isHost ? tr('t.host') : ''}`)));
      this._status.textContent = tr('t.joined', { count: t.participants.length, size: t.size });
      this._start.classList.toggle('hidden', !me?.isHost || t.participants.length < 2);
      return;
    }

    this._players.classList.add('hidden');
    this._start.classList.add('hidden');
    this._bracket.classList.remove('hidden');
    this._renderBracket(t);

    if (t.phase === 'finished') {
      const champ = t.participants.find(p => p.id === t.bracket.at(-1)[0].winner);
      this._status.textContent = tr('t.champion', { name: champ?.name ?? '?' });
      this._ready.classList.add('hidden');
      return;
    }

    const cur = t.currentMatch && t.bracket[t.currentMatch.round][t.currentMatch.index];
    const inMatch = !!cur && (cur.p1 === t.you || cur.p2 === t.you);
    const key = t.currentMatch && `${t.code}:${t.currentMatch.round}:${t.currentMatch.index}`;
    const showReady = inMatch && s.phase === 'lobby' && this._sentReadyFor !== key;
    this._ready.classList.toggle('hidden', !showReady);
    this._status.textContent = inMatch
      ? (showReady ? tr('t.yourMatch') : tr('t.waitOpponent'))
      : tr('t.spectator');
  }

  _renderBracket(t) {
    const nameOf = (id) => id == null
      ? tr('t.bye')
      : (t.participants.find(p => p.id === id)?.name ?? '?');
    const cols = t.bracket.map((round, r) => {
      const col = el('div', 'b-round');
      round.forEach((m, i) => {
        const isCurrent = t.currentMatch && t.currentMatch.round === r && t.currentMatch.index === i;
        const box = el('div', 'b-match' + (isCurrent ? ' current' : ''));
        for (const pid of [m.p1, m.p2]) {
          box.appendChild(el('div',
            'b-player' + (m.winner != null && pid === m.winner ? ' winner' : ''),
            pid == null && r > 0 ? '…' : nameOf(pid)));
        }
        // Frilotter (p2 === null) har egen text — b-note bara för riktiga walkovers
        if (m.walkover && m.p2 != null) box.appendChild(el('div', 'b-note', tr('t.walkover')));
        col.appendChild(box);
      });
      return col;
    });
    this._bracket.replaceChildren(...cols);
  }
}
