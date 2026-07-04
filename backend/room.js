const {
  COLS, ROWS, GOAL_ROW, GOAL_COLS, SPAWN, LIVES, GOALS_TO_WIN_ROUND,
  ROUNDS_TO_WIN_MATCH, TICK_MS, SKINS, DEFAULT_SKIN, DEFAULT_NAMES,
  NAME_MAX_LEN, COUNTDOWN_MS
} = require('./constants');
const { generateLanes, tickObstacles } = require('./gameloop');
const { isHazardous } = require('./collision');

const DIRS = {
  up:    { dx:  0, dy: -1 },
  down:  { dx:  0, dy:  1 },
  left:  { dx: -1, dy:  0 },
  right: { dx:  1, dy:  0 }
};

class Room {
  constructor(ws1, ws2) {
    this.sockets = { p1: ws1, p2: ws2 };
    this.state = this._initialState();
    this._roundTimer = null;
    this._lastMove = { p1: 0, p2: 0 };
    this._seq = { p1: 0, p2: 0 };
    this._attachHandlers();
    this._tick = setInterval(() => this._onTick(), TICK_MS);
    this._send('p1', { type: 'match_start', you: 'p1' });
    this._send('p2', { type: 'match_start', you: 'p2' });
    this._broadcast();
  }

  _initialState() {
    const seed = Date.now() >>> 0;
    const newPlayer = (pid) => ({
      ...SPAWN[pid], lives: LIVES, score: 0,
      name: DEFAULT_NAMES[pid], skin: DEFAULT_SKIN, ready: false
    });
    return {
      players: { p1: newPlayer('p1'), p2: newPlayer('p2') },
      seed,
      tick: 0,
      obstacles: generateLanes(seed),
      round: 1,
      roundScores: { p1: 0, p2: 0 },
      phase: 'lobby'
    };
  }

  _attachHandlers() {
    for (const [pid, ws] of Object.entries(this.sockets)) {
      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data);
          if (msg.type === 'move') {
            // Acka seq även för drag som avvisas, så klientens prediction släpper
            if (Number.isFinite(msg.seq)) this._seq[pid] = msg.seq;
            if (this.state.phase === 'playing') this.handleMove(pid, msg.direction);
          } else if (msg.type === 'ready' && this.state.phase === 'lobby') {
            this._handleReady(pid, msg);
          }
        } catch {}
      });
      ws.on('close', () => this._onDisconnect());
    }
  }

  _handleReady(pid, msg) {
    const p = this.state.players[pid];
    p.name = String(msg.name ?? '').trim().slice(0, NAME_MAX_LEN) || DEFAULT_NAMES[pid];
    p.skin = SKINS.includes(msg.skin) ? msg.skin : DEFAULT_SKIN;
    p.ready = true;
    if (this.state.players.p1.ready && this.state.players.p2.ready) {
      this.state.phase = 'countdown';
      this._broadcastEvent('countdown', { duration: COUNTDOWN_MS });
      this._startTimer = setTimeout(() => {
        this.state.phase = 'playing';
        this._broadcast();
      }, COUNTDOWN_MS);
    }
    this._broadcast();
  }

  handleMove(pid, direction) {
    if (!DIRS[direction]) return;
    const now = Date.now();
    if (now - this._lastMove[pid] < 50) return;
    this._lastMove[pid] = now;
    const p = this.state.players[pid];
    const { dx, dy } = DIRS[direction];
    const nx = p.x + dx;
    const ny = p.y + dy;
    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) return;

    const otherId = pid === 'p1' ? 'p2' : 'p1';
    const other = this.state.players[otherId];
    if (other.x === nx && other.y === ny) {
      this._applyBump(otherId, dx, dy);
    }

    p.x = nx;
    p.y = ny;
    this._checkHazard(pid);
    this._checkGoal(pid);
    this._broadcast();
  }

  _applyBump(pid, dx, dy) {
    const p = this.state.players[pid];
    const bx = p.x - dx;
    const by = p.y - dy;
    if (bx < 0 || bx >= COLS || by < 0 || by >= ROWS || isHazardous(this.state.obstacles, bx, by)) {
      this._respawn(pid, false);
    } else {
      p.x = bx;
      p.y = by;
    }
  }

  _checkHazard(pid) {
    const p = this.state.players[pid];
    if (isHazardous(this.state.obstacles, p.x, p.y)) {
      this._kill(pid);
    }
  }

  _checkGoal(pid) {
    if (this.state.phase !== 'playing') return;
    const p = this.state.players[pid];
    if (p.y !== GOAL_ROW) return;
    if (!GOAL_COLS.has(p.x)) { this._kill(pid); return; }
    p.score++;
    this._respawn(pid, false);
    if (p.score >= GOALS_TO_WIN_ROUND) this._endRound(pid);
  }

  _kill(pid) {
    this._respawn(pid, true);
    if (this.state.players[pid].lives <= 0) {
      this._endRound(pid === 'p1' ? 'p2' : 'p1');
    }
  }

  _respawn(pid, loseLife) {
    const p = this.state.players[pid];
    if (loseLife) p.lives--;
    p.x = SPAWN[pid].x;
    p.y = SPAWN[pid].y;
  }

  _endRound(winnerId) {
    if (this.state.phase !== 'playing') return;
    if (winnerId) this.state.roundScores[winnerId]++;
    this.state.phase = 'round_over';
    this._broadcastEvent('round_over', { winner: winnerId });
    if (winnerId && this.state.roundScores[winnerId] >= ROUNDS_TO_WIN_MATCH) {
      this._endMatch(winnerId);
    } else {
      this._roundTimer = setTimeout(() => this._startNewRound(), 3000);
    }
  }

  _endMatch(winnerId) {
    clearTimeout(this._roundTimer);
    this.state.phase = 'match_over';
    this._broadcastEvent('match_over', {
      winner: winnerId,
      score: [this.state.roundScores.p1, this.state.roundScores.p2]
    });
    clearInterval(this._tick);
  }

  _startNewRound() {
    this.state.round++;
    this.state.seed = Date.now() >>> 0;
    this.state.tick = 0;
    this.state.obstacles = generateLanes(this.state.seed);
    for (const pid of ['p1', 'p2']) {
      const { name, skin, ready } = this.state.players[pid];
      this.state.players[pid] = { ...SPAWN[pid], lives: LIVES, score: 0, name, skin, ready };
    }
    this.state.phase = 'playing';
    this._broadcast();
  }

  _onTick() {
    if (this.state.phase !== 'playing') return;
    this.state.tick++;
    tickObstacles(this.state.obstacles);

    const hazardous = ['p1', 'p2'].filter(pid => {
      const p = this.state.players[pid];
      return isHazardous(this.state.obstacles, p.x, p.y);
    });

    if (hazardous.length < 2) {
      for (const pid of hazardous) this._kill(pid);
    } else {
      for (const pid of hazardous) this._respawn(pid, true);
      const depleted = hazardous.filter(pid => this.state.players[pid].lives <= 0);
      if (depleted.length === 1) {
        this._endRound(depleted[0] === 'p1' ? 'p2' : 'p1');
      } else if (depleted.length === 2) {
        this._endRound(null);
      }
    }

    this._broadcast();
  }

  _onDisconnect() {
    if (this.state.phase === 'match_over') return;
    clearTimeout(this._roundTimer);
    clearTimeout(this._startTimer);
    clearInterval(this._tick);
    this.state.phase = 'match_over';
    this._broadcastEvent('opponent_disconnected', {});
  }

  _broadcast() {
    // Hindren skickas inte — klienten simulerar dem deterministiskt från seed+tick
    const { players, seed, tick, round, roundScores, phase } = this.state;
    const msg = JSON.stringify({
      type: 'state', players, seed, tick, round, roundScores, phase,
      ack: this._seq
    });
    for (const ws of Object.values(this.sockets)) {
      if (ws.readyState === 1) ws.send(msg);
    }
  }

  _broadcastEvent(event, data) {
    const msg = JSON.stringify({ type: 'event', event, ...data });
    for (const ws of Object.values(this.sockets)) {
      if (ws.readyState === 1) ws.send(msg);
    }
  }

  _send(pid, data) {
    const ws = this.sockets[pid];
    if (ws.readyState === 1) ws.send(JSON.stringify(data));
  }
}

module.exports = Room;
