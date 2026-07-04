export class Net {
  constructor(state) {
    this.state = state;
    this._ws = null;
    this._connect();
  }

  _connect() {
    const url = location.hostname === 'localhost'
      ? 'ws://localhost:3000'
      : 'wss://frogger-backend.onrender.com';

    this._ws = new WebSocket(url);

    this._ws.addEventListener('open', () => {
      console.log('Ansluten till server');
    });

    this._ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      this.state.applyMessage(msg);
    });

    this._ws.addEventListener('close', () => {
      console.log('Frånkopplad — försöker igen om 3s');
      setTimeout(() => this._connect(), 3000);
    });
  }

  send(obj) {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(obj));
    }
  }
}
