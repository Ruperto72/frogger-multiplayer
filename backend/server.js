const http = require('http');
const { WebSocketServer } = require('ws');
const Lobby = require('./lobby');
const Room = require('./room');

const PORT = process.env.PORT || 3000;
const HEARTBEAT_MS = 10000;

const server = http.createServer((_req, res) => {
  res.writeHead(200);
  res.end('Frogger Multiplayer');
});

const wss = new WebSocketServer({ server });
const lobby = new Lobby((ws1, ws2) => new Room(ws1, ws2));

wss.on('connection', (ws) => {
  ws._socket.setNoDelay(true); // Nagle buffrar annars små paket upp till ~40 ms
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  lobby.join(ws);
});

// Halvöppna anslutningar (tappat nät utan TCP-FIN) fyrar inte 'close' på
// flera minuter — heartbeat terminerar dem så motståndaren får besked snabbt.
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.isAlive) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, HEARTBEAT_MS);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
