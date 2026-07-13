// frontend/js/tiles.js
// 0 transparent, övriga index slår upp färg i respektive palett.

function mirrorRows(grid) {
  return grid.map(row => [...row].reverse());
}

function drawGrid(ctx, grid, palette, originX, originY, px) {
  for (let row = 0; row < grid.length; row++) {
    for (let col = 0; col < grid[row].length; col++) {
      const v = grid[row][col];
      if (v === 0) continue;
      ctx.fillStyle = palette[v];
      ctx.fillRect(originX + col * px, originY + row * px, px, px);
    }
  }
}

// ---- Bilar ----
// Kompaktbil (bredd 1 cell, 12x12). 1=kaross 3=ruta 4=hjul 5=strålkastare.
const CAR_SMALL_RIGHT = [
  [0,1,1,1,1,1,1,1,1,1,1,0],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,3,3,1,1],
  [1,1,1,1,1,1,1,1,3,3,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,5],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [0,1,1,1,1,1,1,1,1,1,1,0],
  [0,0,4,4,0,0,0,0,4,4,0,0],
  [0,0,4,4,0,0,0,0,4,4,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0],
];
const CAR_SMALL_LEFT = mirrorRows(CAR_SMALL_RIGHT);

// Skåpbil/lastbil (bredd 2 celler, 24x12).
const CAR_LARGE_RIGHT = [
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,3,3,3,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,3,3,3,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,5],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,0,4,4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4,4,0,0,0],
  [0,0,4,4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4,4,0,0,0],
  [0,0,4,4,4,0,0,0,0,0,0,0,0,0,0,0,0,0,4,4,4,0,0,0],
];
const CAR_LARGE_LEFT = mirrorRows(CAR_LARGE_RIGHT);

const CAR_GRIDS = {
  1: { right: CAR_SMALL_RIGHT, left: CAR_SMALL_LEFT },
  2: { right: CAR_LARGE_RIGHT, left: CAR_LARGE_LEFT },
};

const CAR_COLOR_NAMES = ['red', 'yellow', 'blue', 'white'];
const CAR_BODY_COLORS = {
  red:    '#c93030',
  yellow: '#d9b830',
  blue:   '#2f5fa8',
  white:  '#d8d8d0',
};
const CAR_WINDOW    = '#274257';
const CAR_WHEEL     = '#1a1a1a';
const CAR_HEADLIGHT = '#f4e08a';

export function drawCar(ctx, { x, y, cellSize, width, dir, colorIndex }) {
  const grids = CAR_GRIDS[width] ?? CAR_GRIDS[1];
  const grid  = dir === 1 ? grids.right : grids.left;
  const name  = CAR_COLOR_NAMES[((colorIndex % CAR_COLOR_NAMES.length) + CAR_COLOR_NAMES.length) % CAR_COLOR_NAMES.length];
  const palette = { 1: CAR_BODY_COLORS[name], 3: CAR_WINDOW, 4: CAR_WHEEL, 5: CAR_HEADLIGHT };
  drawGrid(ctx, grid, palette, x, y, cellSize / 12);
}
