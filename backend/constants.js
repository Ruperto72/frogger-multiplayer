const COLS = 13;
const ROWS = 15;
const GOAL_ROW = 0;
const RIVER_ROWS = new Set([1, 2, 3, 4, 5]);
const SAFE_ROWS = new Set([6, 13, 14]);
const TRAFFIC_ROWS = new Set([7, 8, 9, 10, 11, 12]);
const SPAWN = { p1: { x: 5, y: 14 }, p2: { x: 7, y: 14 } };
const LIVES = 3;
const GOALS_TO_WIN_ROUND = 3;
const ROUNDS_TO_WIN_MATCH = 3;
const TICK_MS = 100;

module.exports = {
  COLS, ROWS, GOAL_ROW, RIVER_ROWS, SAFE_ROWS,
  TRAFFIC_ROWS, SPAWN, LIVES, GOALS_TO_WIN_ROUND,
  ROUNDS_TO_WIN_MATCH, TICK_MS
};
