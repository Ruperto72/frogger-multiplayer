// frontend/js/sprites.js
// 0 transparent, 1 kropp, 2 kontur/detaljer, 3 ögonvitt, 4 pupill, 5 mage/ljus buk

const FROG_UP = [
  [0,1,1,0,0,0,0,0,0,1,1,0],
  [1,1,3,4,1,1,1,1,4,3,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [0,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,1,1,1,1,1,1,1,1,1,0],
  [0,0,1,1,1,1,1,1,1,1,0,0],
  [0,0,1,1,5,5,5,5,1,1,0,0],
  [0,0,1,5,5,2,2,5,5,1,0,0],
  [0,0,1,5,5,5,5,5,5,1,0,0],
  [0,1,1,1,5,5,5,5,1,1,1,0],
  [1,1,0,0,1,1,1,1,0,0,1,1],
  [1,1,0,0,1,1,1,1,0,0,1,1],
];

const FROG_DOWN = [
  [1,1,0,0,1,1,1,1,0,0,1,1],
  [1,1,0,0,1,1,1,1,0,0,1,1],
  [0,1,1,1,5,5,5,5,1,1,1,0],
  [0,0,1,5,5,5,5,5,5,1,0,0],
  [0,0,1,5,5,2,2,5,5,1,0,0],
  [0,0,1,1,5,5,5,5,1,1,0,0],
  [0,0,1,1,1,1,1,1,1,1,0,0],
  [0,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,1,1,1,1,1,1,1,1,1,0],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,3,4,1,1,1,1,4,3,1,1],
  [0,1,1,0,0,0,0,0,0,1,1,0],
];

const FROG_LEFT = [
  [0,0,1,1,0,0,0,0,0,0,0,0],
  [0,1,4,3,1,1,0,0,0,0,0,0],
  [1,1,1,1,1,1,1,1,0,0,0,0],
  [1,1,1,1,1,1,1,1,1,0,0,0],
  [1,1,1,1,1,1,1,1,1,0,0,0],
  [0,1,1,1,1,1,1,1,1,1,0,0],
  [0,1,1,5,5,5,5,1,1,1,0,0],
  [0,1,5,5,2,2,5,5,1,1,0,0],
  [0,1,5,5,5,5,5,5,1,1,0,0],
  [0,0,1,5,5,5,5,1,1,1,0,0],
  [0,0,1,1,1,1,0,0,1,1,0,0],
  [0,0,1,1,1,1,0,0,1,1,0,0],
];

function mirrorRows(grid) {
  return grid.map(row => [...row].reverse());
}

const FROG_RIGHT = mirrorRows(FROG_LEFT);

const TOAD = [
  [0,1,1,0,0,0,0,0,0,1,1,0],
  [1,1,3,4,1,1,1,1,4,3,1,1],
  [1,1,1,2,1,1,1,1,2,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,2,1,1,1,1,2,1,1,1],
  [0,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,1,1,5,5,5,5,1,1,1,0],
  [1,1,5,5,2,2,2,2,5,5,1,1],
  [1,1,5,5,5,5,5,5,5,5,1,1],
  [1,1,1,5,5,5,5,5,5,1,1,1],
  [1,1,0,1,1,1,1,1,1,0,1,1],
  [1,1,0,1,1,1,1,1,1,0,1,1],
];

const GRIDS = {
  frog: { up: FROG_UP, down: FROG_DOWN, left: FROG_LEFT, right: FROG_RIGHT },
  toad: { up: TOAD, down: TOAD, left: TOAD, right: TOAD },
};

const EYE_WHITE = '#f4f4e6';
const PUPIL = '#111';

const SKIN_PALETTES = {
  green: {
    frog: { 1: '#25b34a', 2: '#0f5c22', 5: '#9fd987' },
    toad: { 1: '#5c7a3c', 2: '#31431f', 5: '#9db97e' },
  },
  yellow: {
    frog: { 1: '#e0c22a', 2: '#8a6f10', 5: '#f2e39a' },
    toad: { 1: '#a8791f', 2: '#5c4110', 5: '#d1ac5c' }, // senapsgul, ej klargul
  },
  blue: {
    frog: { 1: '#2a8de0', 2: '#0f4f8a', 5: '#9ad0f2' },
    toad: { 1: '#4c6f8a', 2: '#22384a', 5: '#9db8c9' },
  },
};

export function getGrid(animal, direction) {
  const byAnimal = GRIDS[animal] ?? GRIDS.frog;
  return byAnimal[direction] ?? byAnimal.up;
}

export function getPalette(skin, animal) {
  const bySkin = SKIN_PALETTES[skin] ?? SKIN_PALETTES.green;
  const base = bySkin[animal] ?? bySkin.frog;
  return { 1: base[1], 2: base[2], 3: EYE_WHITE, 4: PUPIL, 5: base[5] };
}

export function drawSprite(ctx, { animal, direction, skin, cx, cy, cellSize }) {
  const grid = getGrid(animal, direction);
  const palette = getPalette(skin, animal);
  const px = cellSize / grid.length;
  const originX = cx - cellSize / 2;
  const originY = cy - cellSize / 2;
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      const v = grid[row][col];
      if (v === 0) continue;
      ctx.fillStyle = palette[v];
      ctx.fillRect(originX + col * px, originY + row * px, px, px);
    }
  }
}
