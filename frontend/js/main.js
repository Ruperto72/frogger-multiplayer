import { Net } from './net.js';
import { Input } from './input.js';
import { GameState } from './game.js';
import { Renderer } from './renderer.js';

const CELL = 48;
const COLS = 13;
const ROWS = 15;

const canvas = document.getElementById('game');
canvas.width  = COLS * CELL;
canvas.height = ROWS * CELL;

const state    = new GameState();
const renderer = new Renderer(canvas, CELL, COLS, ROWS);
const net      = new Net(state);
const input    = new Input(net);

function loop() {
  renderer.draw(state);
  requestAnimationFrame(loop);
}
loop();
