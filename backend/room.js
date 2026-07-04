const { COLS, ROWS, GOAL_ROW, SPAWN, LIVES, GOALS_TO_WIN_ROUND, ROUNDS_TO_WIN_MATCH, TICK_MS } = require('./constants');
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
    this._attachHandlers();
    this._tick = setInterval(() => this._onTick(), TICK_MS);
    this._send('p1', { type: 'match_start', you: 'p1' });
    this._send('p2', { type: 'match_start', you: 'p2' });
    this._broadcast();
  }

  _initialState() {
    return {
      players: {
        p1: { ...SPAWN.p1, lives: LIVES, score: 0 },
        p2: { ...SPAWN.p2, lives: LIVES, score: 0 }
      },
      obstacles: generateLanes(Date.now()),
      round: 1,
      roundScores: { p1: 0, p2: 0 },
      phase: 'playing'
    };
  }

  _attachHandlers() {
    for (const [pid, ws] of Object.entries(this.sockets)) {
      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data);
          if (msg.type === 'move' && this.state.phase === 'playing') {
            this.handleMove(pid, msg.direction);
          }
        } catch {}
      });
      ws.on('close', () => this._onDisconnect());
    }
  }

  handleMove(pid, direction) {
    if (!DIRS[direction]) return;
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
    this.state.roundScores[winnerId]++;
    this.state.phase = 'round_over';
    this._broadcastEvent('round_over', { winner: winnerId });
    if (this.state.roundScores[winnerId] >= ROUNDS_TO_WIN_MATCH) {
      this._endMatch(winnerId);
    } else {
      setTimeout(() => this._startNewRound(), 3000);
    }
  }

  _endMatch(winnerId) {
    this.state.phase = 'match_over';
    this._broadcastEvent('match_over', {
      winner: winnerId,
      score: [this.state.roundScores.p1, this.state.roundScores.p2]
    });
    clearInterval(this._tick);
  }

  _startNewRound() {
    this.state.round++;
    this.state.obstacles = generateLanes(Date.now());
    this.state.players.p1 = { ...SPAWN.p1, lives: LIVES, score: 0 };
    this.state.players.p2 = { ...SPAWN.p2, lives: LIVES, score: 0 };
    this.state.phase = 'playing';
    this._broadcast();
  }

  _onTick() {
    if (this.state.phase !== 'playing') return;
    tickObstacles(this.state.obstacles);
    for (const pid of ['p1', 'p2']) this._checkHazard(pid);
    this._broadcast();
  }

  _onDisconnect() {
    if (this.state.phase === 'match_over') return;
    clearInterval(this._tick);
    this.state.phase = 'match_over';
    this._broadcastEvent('opponent_disconnected', {});
  }

  _broadcast() {
    const msg = JSON.stringify({ type: 'state', ...this.state });
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
