import { applyStatic } from './i18n.js';
import { Net } from './net.js';
import { Input } from './input.js';
import { TouchControls } from './touch.js';
import { GameState } from './game.js';
import { Renderer } from './renderer.js';
import { LobbyUI } from './lobby-ui.js';
import { StartUI } from './start-ui.js';
import { TournamentUI } from './tournament-ui.js';
import { AudioManager } from './audio.js';
import { COLS, ROWS } from './sim.js';

const CELL = 48;

const canvas = document.getElementById('game');
canvas.width  = COLS * CELL;
canvas.height = ROWS * CELL;

const audio    = new AudioManager();
const state    = new GameState(audio);
const renderer = new Renderer(canvas, CELL, COLS, ROWS);
const net      = new Net(state);
const input    = new Input(net, state, audio);
new TouchControls(input);
const lobbyUi  = new LobbyUI(net, state);
const startUi = new StartUI(net, state);
const tournamentUi = new TournamentUI(net, state);

const soundToggle = document.getElementById('sound-toggle');
const MUTE_KEY = 'muted';
audio.setMuted(localStorage.getItem(MUTE_KEY) === '1');
soundToggle.textContent = audio.isMuted() ? '🔇' : '🔊';

function unlockAudio() {
  audio.unlock();
  audio.startMusic();
  window.removeEventListener('keydown', unlockAudio);
  window.removeEventListener('pointerdown', unlockAudio);
}
window.addEventListener('keydown', unlockAudio);
window.addEventListener('pointerdown', unlockAudio);

soundToggle.addEventListener('click', () => {
  audio.setMuted(!audio.isMuted());
  localStorage.setItem(MUTE_KEY, audio.isMuted() ? '1' : '0');
  soundToggle.textContent = audio.isMuted() ? '🔇' : '🔊';
});

applyStatic();

function loop() {
  startUi.update();
  lobbyUi.update();
  tournamentUi.update();
  renderer.draw(state);
  requestAnimationFrame(loop);
}
loop();
