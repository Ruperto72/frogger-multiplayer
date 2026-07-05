const Room = require('./room');
const { SKINS, DEFAULT_SKIN, NAME_MAX_LEN } = require('./constants');
const { generateBracket, findNextMatch, reportWinner } = require('./bracket');

const WALKOVER_GRACE_MS = 30000;

class Tournament {
  // onRelease anropas när turneringen är klar/avbruten/övergiven så att
  // managern kan ta bort den och frigöra sockets för ny routing.
  constructor(code, { size, bestOf, graceMs }, onRelease) {
    this.code = code;
    this.size = Math.max(2, Math.min(16, size | 0));
    this.bestOf = [1, 3, 5].includes(bestOf) ? bestOf : 3;
    this.phase = 'gathering'; // gathering | between_matches | match | finished
    this.participants = [];   // { id, ws, name, skin, connected, isHost }
    this.bracket = null;
    this.currentMatch = null; // { round, index } | null
    this.room = null;
    this._roomPids = null;    // { p1: deltagar-id, p2: deltagar-id }
    this._nextId = 1;
    this._graceMs = graceMs ?? WALKOVER_GRACE_MS;
    this._graceTimer = null;
    this._onRelease = onRelease;
    this._released = false;
  }

  join(ws, name, skin, isHost = false) {
    if (this.phase !== 'gathering') return { error: 'already_started' };
    if (this.participants.length >= this.size) return { error: 'tournament_full' };
    name = String(name ?? '').trim().slice(0, NAME_MAX_LEN) || `Player ${this._nextId}`;
    if (this.participants.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      return { error: 'name_taken' };
    }
    const p = {
      id: this._nextId++,
      ws,
      name,
      skin: SKINS.includes(skin) ? skin : DEFAULT_SKIN,
      connected: true,
      isHost
    };
    this.participants.push(p);
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'start_tournament' && p.isHost) this.start();
      } catch {}
    });
    ws.on('close', () => this._onLeave(p));
    this._broadcastState();
    return { participant: p };
  }

  start() {
    if (this.phase !== 'gathering' || this.participants.length < 2) return;
    this.bracket = generateBracket(this.participants.map(p => p.id));
    this._activateNext();
  }

  _activateNext() {
    clearTimeout(this._graceTimer);
    this.room?.destroy();
    this.room = null;
    this._roomPids = null;
    this.currentMatch = findNextMatch(this.bracket);

    if (!this.currentMatch) {
      this.phase = 'finished';
      this._broadcastState();
      this._release();
      return;
    }

    const { round, index } = this.currentMatch;
    const match = this.bracket[round][index];
    const a = this._byId(match.p1);
    const b = this._byId(match.p2);

    if (!a.connected || !b.connected) {
      // Frånkopplad spelare på tur → motståndaren får walkover efter frist
      this.phase = 'between_matches';
      this._broadcastState();
      this._graceTimer = setTimeout(() => {
        const winner = a.connected ? a.id : b.id; // båda borta → b, godtyckligt
        reportWinner(this.bracket, round, index, winner, true);
        this._activateNext();
      }, this._graceMs);
      return;
    }

    this.phase = 'match';
    this._roomPids = { p1: a.id, p2: b.id };
    this.room = new Room(a.ws, b.ws, {
      winsNeeded: Math.ceil(this.bestOf / 2),
      onMatchEnd: (winnerPid, { walkover }) => {
        reportWinner(this.bracket, round, index, this._roomPids[winnerPid], walkover);
        this._activateNext();
      }
    });
    for (const p of this.participants) {
      if (p !== a && p !== b && p.connected) this.room.addSpectator(p.ws);
    }
    this._broadcastState();
  }

  _onLeave(p) {
    if (this._released) return;
    p.connected = false;
    if (this.phase === 'gathering') {
      this.participants = this.participants.filter(x => x !== p);
      if (p.isHost) {
        this._broadcastError('tournament_cancelled');
        this._release();
        return;
      }
      this._broadcastState();
      return;
    }
    if (this.participants.every(x => !x.connected)) {
      this._release();
      return;
    }
    // Disconnect under pågående match sköts av Room → onMatchEnd (walkover)
    this._broadcastState();
  }

  _byId(id) {
    return this.participants.find(p => p.id === id);
  }

  _release() {
    if (this._released) return;
    this._released = true;
    clearTimeout(this._graceTimer);
    this.room?.destroy();
    this.room = null;
    this._onRelease?.(this);
  }

  _broadcastState() {
    if (this._released) return;
    const payload = {
      type: 'tournament_state',
      code: this.code,
      phase: this.phase,
      bestOf: this.bestOf,
      size: this.size,
      participants: this.participants.map(({ id, name, skin, connected, isHost }) =>
        ({ id, name, skin, connected, isHost })),
      bracket: this.bracket,
      currentMatch: this.currentMatch
    };
    for (const p of this.participants) {
      if (p.ws.readyState === 1) p.ws.send(JSON.stringify({ ...payload, you: p.id }));
    }
  }

  _broadcastError(reason) {
    const msg = JSON.stringify({ type: 'error', reason });
    for (const p of this.participants) {
      if (p.ws.readyState === 1) p.ws.send(msg);
    }
  }
}

module.exports = Tournament;
