import { Net } from './net.js';
import { Input } from './input.js';
import { TouchControls } from './touch.js';
import { GameState } from './game.js';
import { Renderer } from './renderer.js';
import { LobbyUI } from './lobby-ui.js';
import { COLS, ROWS } from './sim.js';

const CELL = 48;

const canvas = document.getElementById('game');
canvas.width  = COLS * CELL;
canvas.height = ROWS * CELL;

const state    = new GameState();
const renderer = new Renderer(canvas, CELL, COLS, ROWS);
const net      = new Net(state);
const input    = new Input(net, state);
new TouchControls(input);
const lobbyUi  = new LobbyUI(net, state);

function loop() {
  lobbyUi.update();
  renderer.draw(state);
  requestAnimationFrame(loop);
}
loop();
