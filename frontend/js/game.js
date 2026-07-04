export class GameState {
  constructor() {
    this.phase       = 'waiting';
    this.you         = null;
    this.players     = { p1: null, p2: null };
    this.obstacles   = [];
    this.round       = 1;
    this.roundScores = { p1: 0, p2: 0 };
    this.lastEvent   = null;
  }

  applyMessage(msg) {
    if (msg.type === 'waiting') {
      this.phase = 'waiting';
    } else if (msg.type === 'match_start') {
      this.you   = msg.you;
      this.phase = 'playing';
    } else if (msg.type === 'state') {
      this.players     = msg.players;
      this.obstacles   = msg.obstacles;
      this.round       = msg.round;
      this.roundScores = msg.roundScores ?? this.roundScores;
      this.phase       = msg.phase;
    } else if (msg.type === 'event') {
      this.lastEvent = msg;
      if (msg.event === 'round_over')  this.phase = 'round_over';
      if (msg.event === 'match_over')  this.phase = 'match_over';
      if (msg.event === 'opponent_disconnected') this.phase = 'disconnected';
    }
  }
}
