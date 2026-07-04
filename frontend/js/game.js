import { generateLanes, obstacleXAt, COLS, ROWS, TICK_MS } from './sim.js';

const DIRS = {
  up:    { dx:  0, dy: -1 },
  down:  { dx:  0, dy:  1 },
  left:  { dx: -1, dy:  0 },
  right: { dx:  1, dy:  0 }
};

export class GameState {
  constructor() {
    this.phase       = 'waiting';
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
  }

  applyMessage(msg, now = performance.now()) {
    if (msg.type === 'waiting') {
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
      this.players = msg.players;
      if (mine && this.players[this.you]) {
        this.players[this.you].x = mine.x;
        this.players[this.you].y = mine.y;
      }

      this.round       = msg.round;
      this.roundScores = msg.roundScores ?? this.roundScores;
      this.phase       = msg.phase;
    } else if (msg.type === 'event') {
      this.lastEvent = msg;
      if (msg.event === 'round_over')  this.phase = 'round_over';
      if (msg.event === 'match_over')  this.phase = 'match_over';
      if (msg.event === 'opponent_disconnected') this.phase = 'disconnected';
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

  // Optimistisk lokal flytt; servern korrigerar via ack i state-broadcasts.
  predictMove(direction) {
    const d = DIRS[direction];
    const p = this.you && this.players[this.you];
    if (!d || !p || this.phase !== 'playing') return null;
    this._seq++;
    const nx = p.x + d.dx;
    const ny = p.y + d.dy;
    if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) {
      p.x = nx;
      p.y = ny;
    }
    return this._seq;
  }
}
