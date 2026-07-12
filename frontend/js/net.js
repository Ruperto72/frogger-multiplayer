export class Net {
  constructor(state) {
    this.state = state;
    this._ws = null;
    this._reconnectTimer = null;
    this._wasOpen = false;
    this._connect();
  }

  _connect() {
    clearTimeout(this._reconnectTimer);
    if (this._ws) {
      this._ws.close();
    }
    const url = location.hostname === 'localhost'
      ? 'ws://localhost:3000'
      : 'wss://frogger-multiplayer.onrender.com';

    this._ws = new WebSocket(url);

    this._ws.addEventListener('open', () => {
      this._wasOpen = true;
      console.log('Ansluten till server');
    });

    this._ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      this.state.applyMessage(msg);
    });

    this._ws.addEventListener('close', () => {
      if (this._wasOpen) {
        this._wasOpen = false;
        this.state.resetSession();
        this.state.lastError = 'connection_lost';
      }
      console.log('Frånkopplad — försöker igen om 3s');
      this._reconnectTimer = setTimeout(() => this._connect(), 3000);
    });
  }

  send(obj) {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(obj));
    }
  }
}
