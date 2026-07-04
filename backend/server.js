const http = require('http');
const { WebSocketServer } = require('ws');
const Lobby = require('./lobby');

const PORT = process.env.PORT || 3000;

const server = http.createServer((_req, res) => {
  res.writeHead(200);
  res.end('Frogger Multiplayer');
});

const wss = new WebSocketServer({ server });
const lobby = new Lobby((ws1, ws2) => {
  const Room = require('./room');
  new Room(ws1, ws2);
});

wss.on('connection', (ws) => lobby.join(ws));

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
