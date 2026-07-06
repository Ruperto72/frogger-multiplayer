import { t } from './i18n.js';

// Skin-id → utseende. Nya skins = nya rader här (+ i backend/constants.js SKINS
// och lobbypanelens knappar). Sprite-skins: se TODO.md.
const SKINS = {
  green:  '#00e64d',
  yellow: '#ffe100',
  blue:   '#4da6ff'
};

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

  _drawBoard() {
    const { ctx, cell, cols, rows } = this;
    for (let row = 0; row < rows; row++) {
      ctx.fillStyle = zoneColor(row);
      ctx.fillRect(0, row * cell, cols * cell, cell);
    }
    // Målplatser
    ctx.fillStyle = '#4a8a28';
    for (const gx of [0, 3, 6, 9, 12]) {
      ctx.fillRect(gx * cell + 4, 4, cell - 8, cell - 8);
    }
  }

  _drawObstacles(obstacles) {
    const { ctx, cell } = this;
    for (const obs of obstacles) {
      ctx.fillStyle = obs.type === 'car' ? '#cc3333' : '#8b5e3c';
      const px = ((obs.x % this.cols) + this.cols) % this.cols;
      const x  = px * cell;
      const y  = obs.lane * cell + 4;
      const w  = obs.width * cell - 4;
      const h  = cell - 8;
      ctx.fillRect(x, y, w, h);
      const overflow = x + w - this.cols * cell;
      if (overflow > 0) ctx.fillRect(0, y, overflow, h);
    }
  }

  _drawPlayers(state) {
    const { ctx, cell } = this;
    for (const [pid, p] of Object.entries(state.players)) {
      if (!p) continue;
      const rx = state.renderX(pid); // flytande x när spelaren åker stock
      ctx.fillStyle = SKINS[p.skin] ?? SKINS.green;
      ctx.beginPath();
      ctx.arc(
        rx * cell + cell / 2,
        p.y * cell + cell / 2,
        cell / 2 - 4, 0, Math.PI * 2
      );
      ctx.fill();
      if (pid === state.you) { // vit ring markerar egen spelare
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
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
