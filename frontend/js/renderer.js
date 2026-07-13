import { t } from './i18n.js';
import { drawSprite } from './sprites.js';
import { drawCar, drawLog, drawRoadTile, drawVergeTile, drawWaterTile } from './tiles.js';

const ZONE_COLORS = {
  goal:    '#2a4a18',
  river:   '#1a3a6a',
  safe:    '#3a5a28',
  traffic: '#555555',
  start:   '#4a3728'
};

function zoneColor(row) {
  if (row === 0)                          return ZONE_COLORS.goal;
  if (row >= 1 && row <= 5)              return ZONE_COLORS.river;
  if (row === 6)                          return ZONE_COLORS.safe;
  if (row >= 7 && row <= 12)             return ZONE_COLORS.traffic;
  return ZONE_COLORS.start;
}

export class Renderer {
  constructor(canvas, cell, cols, rows) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.cell   = cell;
    this.cols   = cols;
    this.rows   = rows;
  }

  draw(state) {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this._drawBoard();
    if (!state.players.p1) return; // före första state-broadcast
    this._drawObstacles(state.obstaclesAt());
    this._drawPlayers(state);
    // I waiting/lobby ligger HTML-lobbypanelen ovanpå
    if (state.phase === 'waiting' || state.phase === 'lobby') return;
    this._drawHUD(state);
    if (state.phase === 'countdown') {
      const n = Math.max(1, Math.ceil(state.countdownRemaining() / 1000));
      this._drawOverlay(String(n), t('game.getReady'));
    }
    if (state.phase === 'round_over') {
      const w = state.lastEvent?.winner;
      this._drawOverlay(
        w === state.you ? t('game.wonRoundYou') : t('game.wonRoundOther', { name: this._name(state, w) }),
        t('game.nextRound')
      );
    }
    if (state.phase === 'match_over') {
      const w = state.lastEvent?.winner;
      this._drawOverlay(
        w === state.you ? t('game.wonMatchYou') : t('game.wonMatchOther', { name: this._name(state, w) }),
        t('game.result', { score: state.lastEvent?.score?.join(' – ') ?? '' })
      );
    }
    if (state.phase === 'disconnected') {
      this._drawOverlay(t('game.opponentLeft'), t('game.reload'));
    }
  }

  _name(state, pid) {
    return state.players[pid]?.name ?? t('game.opponentFallback');
  }

  _buildBoardCache() {
    const { cell, cols, rows } = this;
    const cache = document.createElement('canvas');
    cache.width  = cols * cell;
    cache.height = rows * cell;
    const cctx = cache.getContext('2d');

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * cell, y = row * cell;
        if (row === 0 || row === 13 || row === 14) {
          cctx.fillStyle = zoneColor(row);
          cctx.fillRect(x, y, cell, cell);
        } else if (row >= 1 && row <= 5) {
          drawWaterTile(cctx, x, y, cell);
        } else if (row === 6) {
          drawVergeTile(cctx, x, y, cell);
        } else {
          drawRoadTile(cctx, x, y, cell);
        }
      }
    }

    // Körfältslinjer mellan varje trafikrad (rad 7–12)
    cctx.strokeStyle = 'rgba(255,255,255,0.8)';
    cctx.lineWidth = 2;
    cctx.setLineDash([cell * 0.25, cell * 0.2]);
    for (let row = 8; row <= 12; row++) {
      const y = row * cell;
      cctx.beginPath();
      cctx.moveTo(0, y);
      cctx.lineTo(cols * cell, y);
      cctx.stroke();
    }

    // Målplatser
    cctx.fillStyle = '#4a8a28';
    for (const gx of [0, 3, 6, 9, 12]) {
      cctx.fillRect(gx * cell + 4, 4, cell - 8, cell - 8);
    }

    this._boardCache = cache;
  }

  _drawBoard() {
    if (!this._boardCache) this._buildBoardCache();
    this.ctx.drawImage(this._boardCache, 0, 0);
  }

  _drawObstacles(obstacles) {
    const { ctx, cell, cols } = this;
    for (const obs of obstacles) {
      const px = ((obs.x % cols) + cols) % cols;
      const x  = px * cell;
      const y  = obs.lane * cell;
      const draw = (drawX) => {
        if (obs.type === 'car') {
          drawCar(ctx, { x: drawX, y, cellSize: cell, width: obs.width, dir: obs.dir, colorIndex: obs._idx });
        } else {
          drawLog(ctx, { x: drawX, y, cellSize: cell, width: obs.width });
        }
      };
      draw(x);
      const overflow = x + obs.width * cell - cols * cell;
      if (overflow > 0) draw(x - cols * cell); // rita en kopia som lindar till vänsterkanten
    }
  }

  _drawPlayers(state) {
    const { ctx, cell } = this;
    for (const [pid, p] of Object.entries(state.players)) {
      if (!p) continue;
      const rx = state.renderX(pid); // flytande x när spelaren åker stock
      drawSprite(ctx, {
        animal: p.animal,
        direction: state.dirOf(pid),
        cx: rx * cell + cell / 2,
        cy: p.y * cell + cell / 2,
        cellSize: cell
      });
      if (pid === state.you) { // vit ring markerar egen spelare
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(rx * cell + cell / 2, p.y * cell + cell / 2, cell / 2 - 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Liten etikett
      ctx.fillStyle = '#000';
      ctx.font = `bold ${cell * 0.4}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pid === state.you ? t('game.you') : pid.toUpperCase(),
        rx * cell + cell / 2, p.y * cell + cell / 2);
      if (p.name) {
        ctx.fillStyle = '#fff';
        ctx.font = `${cell * 0.28}px monospace`;
        // Clampa så namnet inte hamnar utanför canvasen på målraden
        ctx.fillText(p.name, rx * cell + cell / 2, Math.max(10, p.y * cell - 8));
      }
    }
  }

  _drawHUD(state) {
    const { ctx, cols, cell } = this;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, cols * cell, 32);
    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    if (state.you === 'spectator') {
      const a = state.players.p1, b = state.players.p2;
      if (a && b) {
        ctx.fillText(
          `${t('game.spectatorLabel')}  |  ${t('game.round')} ${state.round}  |  ${a.name}: ♥${a.lives} ${t('game.goals')}:${a.score}  |  ${b.name}: ♥${b.lives} ${t('game.goals')}:${b.score}  |  ${t('game.match')}: ${state.roundScores.p1}–${state.roundScores.p2}`,
          8, 16
        );
      }
      return;
    }
    const you   = state.you;
    const other = you === 'p1' ? 'p2' : 'p1';
    const pYou   = state.players[you];
    const pOther = state.players[other];
    if (pYou && pOther) {
      ctx.fillText(
        `${t('game.round')} ${state.round}  |  ${pYou.name ?? t('game.youShort')}: ♥${pYou.lives} ${t('game.goals')}:${pYou.score}  |  ${pOther.name ?? t('game.oppShort')}: ♥${pOther.lives} ${t('game.goals')}:${pOther.score}  |  ${t('game.match')}: ${state.roundScores[you]}–${state.roundScores[other]}`,
        8, 16
      );
    }
  }

  _drawOverlay(title, subtitle) {
    const { ctx, canvas } = this;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 20);
    ctx.fillStyle = '#aaa';
    ctx.font = '18px monospace';
    ctx.fillText(subtitle, canvas.width / 2, canvas.height / 2 + 20);
  }
}
