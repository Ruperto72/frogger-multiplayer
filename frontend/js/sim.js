// Deterministisk hindersimulering — MÅSTE vara identisk med backend/gameloop.js.
// Konsistensen verifieras av backend/test/sim-consistency.test.js.

export const COLS = 13;
export const ROWS = 15;
export const TICK_MS = 100;

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

export function generateLanes(seed) {
  const rand = seededRandom(seed);
  const obstacles = [];

  const trafficRows = [7, 8, 9, 10, 11, 12];
  const riverRows   = [1, 2, 3, 4, 5];

  for (const lane of trafficRows) {
    const dir   = rand() > 0.5 ? 1 : -1;
    const speed = 0.04 + rand() * 0.06;
    const count = 2 + Math.floor(rand() * 2);
    const slot  = COLS / count;
    for (let i = 0; i < count; i++) {
      const width = 1 + Math.floor(rand() * 2);
      obstacles.push({
        lane,
        x: slot * i + rand() * (slot - width - 0.5),
        width,
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
    const slot  = COLS / count;
    for (let i = 0; i < count; i++) {
      const width = 2 + Math.floor(rand() * 2);
      obstacles.push({
        lane,
        x: slot * i + rand() * (slot - width - 0.5),
        width,
        type: 'log',
        speed,
        dir
      });
    }
  }

  return obstacles;
}

// Position vid (eventuellt fraktionell) tick t, ekvivalent med serverns
// iterativa tickObstacles. Servern lindar med modulus COLS; fönstret beror
// på riktning: höger → [0, COLS), vänster → [-width, COLS - width).
export function obstacleXAt(obs, t) {
  const lo = obs.dir === 1 ? 0 : -obs.width;
  const x = obs.x + obs.speed * obs.dir * t;
  return (((x - lo) % COLS) + COLS) % COLS + lo;
}
