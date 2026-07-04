const { COLS } = require('./constants');

function seededRandom(seed) {
  let s = seed >>> 0;
  return function () {
    s += 0x6D2B79F5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateLanes(seed) {
  const rand = seededRandom(seed);
  const obstacles = [];

  const trafficRows = [7, 8, 9, 10, 11, 12];
  const riverRows   = [1, 2, 3, 4, 5];

  for (const lane of trafficRows) {
    const dir   = rand() > 0.5 ? 1 : -1;
    const speed = 0.04 + rand() * 0.06;
    const count = 2 + Math.floor(rand() * 2);
    for (let i = 0; i < count; i++) {
      obstacles.push({
        lane,
        x: (COLS / count) * i + rand() * 1.5,
        width: 1 + Math.floor(rand() * 2),
        type: 'car',
        speed,
        dir
      });
    }
  }

  for (const lane of riverRows) {
    const dir   = rand() > 0.5 ? 1 : -1;
    const speed = 0.03 + rand() * 0.04;
    const count = 2 + Math.floor(rand() * 2);
    for (let i = 0; i < count; i++) {
      obstacles.push({
        lane,
        x: (COLS / count) * i + rand() * 1.5,
        width: 2 + Math.floor(rand() * 2),
        type: 'log',
        speed,
        dir
      });
    }
  }

  return obstacles;
}

function tickObstacles(obstacles) {
  for (const obs of obstacles) {
    obs.x += obs.speed * obs.dir;
    if (obs.x >= COLS)         obs.x -= COLS;
    if (obs.x < 0)    obs.x += COLS;
  }
}

module.exports = { generateLanes, tickObstacles };
