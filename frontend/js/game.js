import { generateLanes, obstacleXAt, COLS, ROWS, TICK_MS } from './sim.js';

const DIRS = {
  up:    { dx:  0, dy: -1 },
  down:  { dx:  0, dy:  1 },
  left:  { dx: -1, dy:  0 },
  right: { dx:  1, dy:  0 }
};

export class GameState {
  constructor() {
    this.mode        = null;   // null | 'quick' | 'tournament'
    this.profile     = { name: '', skin: 'green' };
    this.tournament  = null;   // senaste tournament_state
    this.lastError   = null;
    this.phase       = 'idle';
    this.you         = null;
    this.players     = { p1: null, p2: null };
    this.round       = 1;
    this.roundScores = { p1: 0, p2: 0 };
    this.lastEvent   = null;
    this.seed        = null;
    this._base       = [];   // hindren vid tick 0, från generateLanes(seed)
    this._serverTick = 0;
    this._tickAt     = 0;    // lokal tidsstämpel för senaste servertick
    this._seq        = 0;    // senast skickade drag-seq
    this._lastDir    = { p1: 'up', p2: 'up' };
  }

  // Tillbaka till startskärmen (avbruten turnering / tappad anslutning).
  // profile och lastError behålls medvetet.
  resetSession() {
    this.mode        = null;
    this.tournament  = null;
    this.phase       = 'idle';
    this.you         = null;
    this.players     = { p1: null, p2: null };
    this.round       = 1;
    this.roundScores = { p1: 0, p2: 0 };
    this.lastEvent   = null;
    this.seed        = null;
    this._base       = [];
    this._serverTick = 0;
    this._tickAt     = 0;
    this._seq        = 0;
    this._lastDir    = { p1: 'up', p2: 'up' };
  }

  applyMessage(msg, now = performance.now()) {
    if (msg.type === 'waiting') {
      this.mode  = 'quick';
      this.phase = 'waiting';
    } else if (msg.type === 'match_start') {
      this.you  = msg.you;
      this._seq = 0; // nytt rum börjar acka från 0; fasen kommer via state
    } else if (msg.type === 'state') {
      if (msg.seed !== this.seed) {
        this.seed  = msg.seed;
        this._base = generateLanes(msg.seed);
      }
      this._serverTick = msg.tick;
      this._tickAt     = now;

      // Behåll predikterad position tills servern ackat vårt senaste drag
      const acked = (msg.ack?.[this.you] ?? 0) >= this._seq;
      const mine  = !acked && this.you ? this.players[this.you] : null;

      for (const pid of ['p1', 'p2']) {
        const before = this.players[pid];
        const after  = msg.players[pid];
        if (!before || !after) continue;
        const dx = after.x - before.x;
        const dy = after.y - before.y;
        if (dx > 0) this._lastDir[pid] = 'right';
        else if (dx < 0) this._lastDir[pid] = 'left';
        else if (dy > 0) this._lastDir[pid] = 'down';
        else if (dy < 0) this._lastDir[pid] = 'up';
      }

      this.players = msg.players;
      if (mine && this.players[this.you]) {
        this.players[this.you].x = mine.x;
        this.players[this.you].y = mine.y;
      }

      this.round       = msg.round;
      this.roundScores = msg.roundScores ?? this.roundScores;
      this.phase       = msg.phase;
    } else if (msg.type === 'tournament_created') {
      this.mode = 'tournament';
    } else if (msg.type === 'tournament_state') {
      this.mode       = 'tournament';
      this.tournament = msg;
    } else if (msg.type === 'error') {
      this.lastError = msg.reason;
      if (msg.reason === 'tournament_cancelled') this.resetSession();
    } else if (msg.type === 'event') {
      this.lastEvent = msg;
      if (msg.event === 'round_over')  this.phase = 'round_over';
      if (msg.event === 'match_over')  this.phase = 'match_over';
      if (msg.event === 'opponent_disconnected' && this.mode !== 'tournament') {
        this.phase = 'disconnected';
      }
      if (msg.event === 'countdown') {
        this._countdownAt = now;
        this._countdownMs = msg.duration ?? 3000;
      }
    }
  }

  countdownRemaining(now = performance.now()) {
    if (this._countdownAt == null) return 0;
    return Math.max(0, this._countdownAt + this._countdownMs - now);
  }

  // Hinderpositioner vid lokal tid `now` — extrapolerar mellan serverticks
  // så rörelsen blir mjuk i 60 fps. Fryser när rundan inte pågår.
  obstaclesAt(now = performance.now()) {
    const t = this.phase === 'playing'
      ? this._serverTick + (now - this._tickAt) / TICK_MS
      : this._serverTick;
    return this._base.map(o => ({ ...o, x: obstacleXAt(o, t) }));
  }

  // Render-x för en spelare: på en stock glider spelaren med stockens
  // analytiska position (serverns cellkvantiserade åkning i room.js är
  // vänstercell + k — samma k här ger kontinuerlig rörelse utan hopp).
  renderX(pid, now = performance.now()) {
    const p = this.players[pid];
    if (!p) return null;
    if (this.phase !== 'playing' || p.y < 1 || p.y > 5) return p.x;
    const wrap = (x) => ((x % COLS) + COLS) % COLS;
    for (const o of this._base) {
      if (o.lane !== p.y || o.type !== 'log') continue;
      // Vänstercellen vid serverticken där p.x sattes
      const left = Math.floor(wrap(obstacleXAt(o, this._serverTick)));
      for (let k = 0; k < o.width; k++) {
        if ((left + k) % COLS !== p.x) continue;
        const t = this._serverTick + (now - this._tickAt) / TICK_MS;
        return (wrap(obstacleXAt(o, t)) + k) % COLS;
      }
    }
    return p.x;
  }

  // Optimistisk lokal flytt; servern korrigerar via ack i state-broadcasts.
  predictMove(direction) {
    const d = DIRS[direction];
    const p = this.you && this.players[this.you];
    if (!d || !p || this.phase !== 'playing') return null;
    this._seq++;
    this._lastDir[this.you] = direction;
    const nx = p.x + d.dx;
    const ny = p.y + d.dy;
    if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) {
      p.x = nx;
      p.y = ny;
    }
    return this._seq;
  }

  dirOf(pid) {
    return this._lastDir[pid] ?? 'up';
  }
}
