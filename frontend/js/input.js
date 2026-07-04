export const KEY_MAP = {
  ArrowUp:    'up',
  ArrowDown:  'down',
  ArrowLeft:  'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right'
};

export class Input {
  constructor(net, state) {
    this._net = net;
    this._state = state;
    this._last = 0;
    window.addEventListener('keydown', (e) => {
      const dir = KEY_MAP[e.code];
      if (!dir) return;
      e.preventDefault();
      this.move(dir);
    });
  }

  move(dir) {
    const now = performance.now();
    if (now - this._last < 50) return; // matcha serverns rate-limit
    this._last = now;
    const seq = this._state.predictMove(dir);
    if (seq !== null) this._net.send({ type: 'move', direction: dir, seq });
  }
}
