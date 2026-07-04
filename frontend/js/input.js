const KEY_MAP = {
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
  constructor(net) {
    this._net = net;
    window.addEventListener('keydown', (e) => {
      const dir = KEY_MAP[e.code];
      if (dir) {
        e.preventDefault();
        this._net.send({ type: 'move', direction: dir });
      }
    });
  }
}
