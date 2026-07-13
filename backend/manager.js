const Tournament = require('./tournament');

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // utan I och O — förväxlas lätt

class TournamentManager {
  constructor() {
    this.tournaments = new Map();
  }

  create(ws, msg) {
    const code = this._newCode();
    const t = new Tournament(code, { size: msg.size, bestOf: msg.bestOf },
      (tt) => this._release(tt));
    this.tournaments.set(code, t);
    if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'tournament_created', code }));
    t.join(ws, msg.name, true); // kan inte misslyckas i tom turnering
    return t;
  }

  join(ws, msg) {
    const code = String(msg.code ?? '').trim().toUpperCase();
    const t = this.tournaments.get(code);
    if (!t) {
      if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'error', reason: 'unknown_code' }));
      return null;
    }
    const res = t.join(ws, msg.name);
    if (res.error) {
      if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'error', reason: res.error }));
      return null;
    }
    return t;
  }

  _newCode() {
    let code;
    do {
      code = Array.from({ length: 4 },
        () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
    } while (this.tournaments.has(code));
    return code;
  }

  _release(t) {
    this.tournaments.delete(t.code);
    for (const p of t.participants) p.ws.freeRoute?.();
  }
}

module.exports = TournamentManager;
