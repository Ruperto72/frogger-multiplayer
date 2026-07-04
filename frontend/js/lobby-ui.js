function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}

export class LobbyUI {
  constructor(net, state) {
    this._net   = net;
    this._state = state;
    this._sent  = false;
    this._skin  = 'green';

    this._root     = document.getElementById('lobby');
    this._status   = document.getElementById('lobby-status');
    this._opponent = document.getElementById('lobby-opponent');
    this._name     = document.getElementById('lobby-name');
    this._ready    = document.getElementById('lobby-ready');
    this._skinBtns = [...this._root.querySelectorAll('.skin')];

    for (const btn of this._skinBtns) {
      btn.addEventListener('click', () => {
        if (this._sent) return;
        this._skin = btn.dataset.skin;
        for (const b of this._skinBtns) b.classList.toggle('selected', b === btn);
      });
    }
    this._skinBtns[0].classList.add('selected');

    this._ready.addEventListener('click', () => {
      this._sent = true;
      this._net.send({ type: 'ready', name: this._name.value, skin: this._skin });
    });
  }

  // Anropas från rAF-loopen
  update() {
    const s = this._state;
    const visible = s.phase === 'waiting' || s.phase === 'lobby';
    this._root.classList.toggle('hidden', !visible);
    if (!visible) return;

    if (s.phase === 'waiting') {
      this._sent = false; // ny match — lås upp formuläret
      setText(this._status, 'Väntar på motspelare…');
      setText(this._opponent, '');
    } else {
      const other = s.you === 'p1' ? 'p2' : 'p1';
      const op = s.players[other];
      setText(this._status, this._sent
        ? 'Väntar på att motståndaren blir redo…'
        : 'Motspelare hittad — gör dig redo!');
      setText(this._opponent, op ? `${op.name}: ${op.ready ? 'redo ✓' : 'inte redo'}` : '');
    }

    this._name.disabled  = this._sent;
    this._ready.disabled = this._sent || s.phase !== 'lobby';
  }
}
