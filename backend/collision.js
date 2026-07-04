const { COLS, RIVER_ROWS, TRAFFIC_ROWS } = require('./constants');

function obstacleCoversCell(obs, cellX) {
  const left = Math.floor(((obs.x % COLS) + COLS) % COLS);
  for (let i = 0; i < obs.width; i++) {
    if ((left + i) % COLS === cellX) return true;
  }
  return false;
}

function isSafeInRiver(obstacles, x, y) {
  return obstacles.some(
    o => o.lane === y && o.type === 'log' && obstacleCoversCell(o, x)
  );
}

function hitByCar(obstacles, x, y) {
  return obstacles.some(
    o => o.lane === y && o.type === 'car' && obstacleCoversCell(o, x)
  );
}

function isHazardous(obstacles, x, y) {
  if (TRAFFIC_ROWS.has(y)) return hitByCar(obstacles, x, y);
  if (RIVER_ROWS.has(y))   return !isSafeInRiver(obstacles, x, y);
  return false;
}

module.exports = { obstacleCoversCell, isSafeInRiver, hitByCar, isHazardous };
