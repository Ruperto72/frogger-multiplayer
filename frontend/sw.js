// Minimal service worker — finns ENBART för att uppfylla Chromes
// installbarhetskrav på Android (WebAPK kräver historiskt en registrerad
// service worker med fetch-hanterare). Ingen offline-cache är medvetet:
// spelet är ett onlinespel (WebSocket) och en cache skulle bara riskera
// stale frontend-kod efter deploys. Fetch-hanteraren är en ren
// nätverks-passthrough, så uppdateringar flödar exakt som utan SW.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
