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

const TOAD_UP = [
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

const TOAD_DOWN = [...TOAD_UP].reverse();

const TOAD_LEFT = [
  [0,0,1,1,0,0,0,0,0,0,0,0],
  [0,1,4,3,1,1,0,0,0,0,0,0],
  [1,1,1,1,1,1,1,1,0,0,0,0],
  [1,1,1,1,1,1,1,1,1,0,0,0],
  [1,1,1,1,1,1,1,1,1,0,0,0],
  [0,1,1,1,1,1,1,1,1,1,0,0],
  [0,1,1,5,5,5,5,1,1,2,0,0],
  [0,1,5,5,2,2,5,5,1,1,0,0],
  [0,1,5,5,5,5,5,5,2,1,0,0],
  [0,0,1,5,5,5,5,1,1,1,0,0],
  [0,0,1,1,1,1,0,0,1,1,0,0],
  [0,0,1,1,1,1,0,0,1,1,0,0],
];

const TOAD_RIGHT = mirrorRows(TOAD_LEFT);

const GRIDS = {
  frog: { up: FROG_UP, down: FROG_DOWN, left: FROG_LEFT, right: FROG_RIGHT },
  toad: { up: TOAD_UP, down: TOAD_DOWN, left: TOAD_LEFT, right: TOAD_RIGHT },
};

const EYE_WHITE = '#f4f4e6';
const PUPIL = '#111';

const ANIMAL_PALETTES = {
  frog: { 1: '#25b34a', 2: '#0f5c22', 5: '#9fd987' },
  toad: { 1: '#5c7a3c', 2: '#31431f', 5: '#9db97e' },
};

export function getGrid(animal, direction) {
  const byAnimal = GRIDS[animal] ?? GRIDS.frog;
  return byAnimal[direction] ?? byAnimal.up;
}

export function getPalette(animal) {
  const base = ANIMAL_PALETTES[animal] ?? ANIMAL_PALETTES.frog;
  return { 1: base[1], 2: base[2], 3: EYE_WHITE, 4: PUPIL, 5: base[5] };
}

export function drawSprite(ctx, { animal, direction, cx, cy, cellSize }) {
  const grid = getGrid(animal, direction);
  const palette = getPalette(animal);
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
