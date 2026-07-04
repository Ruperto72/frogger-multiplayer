class Lobby {
  constructor(createRoom) {
    this.queue = [];
    this.createRoom = createRoom;
  }

  join(ws) {
    ws.send(JSON.stringify({ type: 'waiting' }));
    this.queue.push(ws);
    ws.on('close', () => this._leave(ws));
    if (this.queue.length >= 2) {
      const [ws1, ws2] = this.queue.splice(0, 2);
      this.createRoom(ws1, ws2);
    }
  }

  _leave(ws) {
    const idx = this.queue.indexOf(ws);
    if (idx !== -1) this.queue.splice(idx, 1);
  }
}

module.exports = Lobby;
