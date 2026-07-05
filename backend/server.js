const http = require('http');
const { WebSocketServer } = require('ws');
const Lobby = require('./lobby');
const Room = require('./room');
const TournamentManager = require('./manager');

const PORT = process.env.PORT || 3000;
const HEARTBEAT_MS = 10000;

const server = http.createServer((_req, res) => {
  res.writeHead(200);
  res.end('Frog vs Toad');
});

const wss = new WebSocketServer({ server });
const lobby = new Lobby((ws1, ws2) => new Room(ws1, ws2));
const tournaments = new TournamentManager();

wss.on('connection', (ws) => {
  ws._socket.setNoDelay(true); // Nagle buffrar annars små paket upp till ~40 ms
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  // Första meddelandet väljer väg. freeRoute öppnar för omval,
  // t.ex. efter en avbruten turnering.
  let routed = false;
  ws.freeRoute = () => { routed = false; };
  ws.on('message', (data) => {
    if (routed) return;
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    if (msg.type === 'quick_match') {
      routed = true;
      lobby.join(ws);
    } else if (msg.type === 'create_tournament') {
      routed = true;
      tournaments.create(ws, msg);
    } else if (msg.type === 'join_tournament') {
      routed = !!tournaments.join(ws, msg);
    }
  });
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
