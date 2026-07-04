const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;

const server = http.createServer((_req, res) => {
  res.writeHead(200);
  res.end('Frogger Multiplayer');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (_ws) => {
  // Lobby wires in Task 2
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
