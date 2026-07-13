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

// ---- Stockar ----
// Mittsegment (12x12) med årsringar. 1=trä 2=årsring/kant 5=barkhögdager.
const LOG_MIDDLE = [
  [5,5,5,5,5,5,5,5,5,5,5,5],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,2,1,1,1,2,1,1,1,2,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,2,1,1,1,2,1,1,1,2,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,2,1,1,1,2,1,1,1,2,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,2,1,1,1,2,1,1,1,2,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [2,2,2,2,2,2,2,2,2,2,2,2],
];

// Avrundad ändcap, vänster (12x12).
const LOG_CAP_LEFT = [
  [0,0,5,5,5,5,5,5,5,5,5,5],
  [0,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [0,1,1,1,1,1,1,1,1,1,1,1],
  [0,0,2,2,2,2,2,2,2,2,2,2],
];
const LOG_CAP_RIGHT = mirrorRows(LOG_CAP_LEFT);

const LOG_PALETTE = { 1: '#8b5e3c', 2: '#5a3a22', 5: '#c99a63' };

export function drawLog(ctx, { x, y, cellSize, width }) {
  const segments = width >= 3 ? [LOG_CAP_LEFT, LOG_MIDDLE, LOG_CAP_RIGHT] : [LOG_CAP_LEFT, LOG_CAP_RIGHT];
  const px = cellSize / 12;
  let originX = x;
  for (const seg of segments) {
    drawGrid(ctx, seg, LOG_PALETTE, originX, y, px);
    originX += cellSize;
  }
}

// ---- Väg (rad 7–12) ----
// Asfalt med fast (icke-slumpad) brustextur. 1=asfalt 2=mörkare fläck.
const ROAD_TILE = [
  [1,1,1,2,1,1,1,1,1,2,1,1],
  [1,1,1,1,1,1,2,1,1,1,1,1],
  [1,2,1,1,1,1,1,1,2,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,2,1,1,1,1,2,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [2,1,1,1,1,2,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,2,1],
  [1,1,1,2,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,2,1,1,1],
  [1,2,1,1,1,1,1,1,1,1,1,2],
  [1,1,1,1,1,2,1,1,1,1,1,1],
];
const ROAD_PALETTE = { 1: '#555555', 2: '#454545' };

// ---- Vägren (rad 6) ----
// Gräs med grusig kant mot vägen (nedre kanten). 1=gräs 2=mörkare gräsfläck 5=grus.
const VERGE_TILE = [
  [1,1,2,1,1,1,1,2,1,1,1,1],
  [1,1,1,1,2,1,1,1,1,1,2,1],
  [1,2,1,1,1,1,1,1,2,1,1,1],
  [1,1,1,1,1,2,1,1,1,1,1,1],
  [1,1,1,2,1,1,1,1,2,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,2,1,1,1,1,1,1,2,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [5,5,5,5,5,5,5,5,5,5,5,5],
  [5,1,5,1,5,1,5,1,5,1,5,1],
];
const VERGE_PALETTE = { 1: '#3a5a28', 2: '#2c4a1c', 5: '#a8a58c' };

// ---- Vatten (rad 1–5) ----
// Blå yta med fast vågmönster. 1=vatten 2=mörkare våg 5=ljus vågkam.
const WATER_TILE = [
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [5,5,1,1,5,5,1,1,5,5,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,2,2,1,1,1,2,2,1,1,1,2],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,5,5,1,1,5,5,1,1,5,5],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [2,1,1,1,2,2,1,1,1,2,2,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [5,5,1,1,5,5,1,1,5,5,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,2,2,1,1,1,2,2,1,1,1,2],
];
const WATER_PALETTE = { 1: '#1a3a6a', 2: '#12294d', 5: '#3f6fae' };

export function drawRoadTile(ctx, x, y, cellSize) {
  drawGrid(ctx, ROAD_TILE, ROAD_PALETTE, x, y, cellSize / 12);
}
export function drawVergeTile(ctx, x, y, cellSize) {
  drawGrid(ctx, VERGE_TILE, VERGE_PALETTE, x, y, cellSize / 12);
}
export function drawWaterTile(ctx, x, y, cellSize) {
  drawGrid(ctx, WATER_TILE, WATER_PALETTE, x, y, cellSize / 12);
}
