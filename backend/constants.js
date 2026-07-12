const COLS = 13;
const ROWS = 15;
const GOAL_ROW = 0;
const GOAL_COLS = new Set([0, 3, 6, 9, 12]);
const RIVER_ROWS = new Set([1, 2, 3, 4, 5]);
const SAFE_ROWS = new Set([6, 13, 14]);
const TRAFFIC_ROWS = new Set([7, 8, 9, 10, 11, 12]);
const SPAWN = { p1: { x: 5, y: 14 }, p2: { x: 7, y: 14 } };
const LIVES = 3;
const GOALS_TO_WIN_ROUND = 3;
const ROUNDS_TO_WIN_MATCH = 3;
const TICK_MS = 100;
const SKINS = ['green', 'yellow', 'blue'];
const DEFAULT_SKIN = 'green';
const DEFAULT_NAMES = { p1: 'Frog', p2: 'Toad' };
const NAME_MAX_LEN = 20;
const COUNTDOWN_MS = 3000;

module.exports = {
  COLS, ROWS, GOAL_ROW, GOAL_COLS, RIVER_ROWS, SAFE_ROWS,
  TRAFFIC_ROWS, SPAWN, LIVES, GOALS_TO_WIN_ROUND,
  ROUNDS_TO_WIN_MATCH, TICK_MS, SKINS, DEFAULT_SKIN,
  DEFAULT_NAMES, NAME_MAX_LEN, COUNTDOWN_MS
};
