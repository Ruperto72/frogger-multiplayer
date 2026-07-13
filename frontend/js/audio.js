// 8-bitars ljud via Web Audio API — inga ljudfiler, allt syntetiseras.
// Hopp-blippet triggas per drag (se input.js), bakgrundsmelodin loopar
// kontinuerligt via en lookahead-scheduler (undviker drift/klick jämfört
// med att bara kedja setTimeout på notlängden).

const TEMPO_BPM   = 150;
const EIGHTH_SEC  = 60 / TEMPO_BPM / 2;
const LOOKAHEAD_MS   = 25;   // hur ofta schemaläggaren vaknar
const SCHEDULE_AHEAD = 0.1;  // hur långt fram (sek) den lägger noter i kön

// Not-frekvenser (Hz), G-dur — F blir F# via förtecknet, som i originalskissen.
const G4 = 392.00, A4 = 440.00, B4 = 493.88;
const C5 = 523.25, D5 = 587.33, E5 = 659.25, Fs5 = 739.99, G5 = 783.99, A5 = 880.00, B5 = 987.77;
const D4 = 293.66, Fs4 = 369.99;
const REST = 0;

// "Froggy Hop" — 8 takter, upplevelsen finslipades i ABC-notation innan den
// skrevs om till frekvens/notvärde-par här. d = längd i åttondelar.
const MELODY = [
  // Takt 1
  { f: G4,  d: 1 }, { f: B4,  d: 1 }, { f: D5,  d: 1 }, { f: B4,  d: 1 },
  { f: G4,  d: 1 }, { f: B4,  d: 1 }, { f: D5,  d: 2 },
  // Takt 2
  { f: G4,  d: 1 }, { f: B4,  d: 1 }, { f: D5,  d: 1 }, { f: G5,  d: 1 },
  { f: E5,  d: 1 }, { f: D5,  d: 1 }, { f: B4,  d: 2 },
  // Takt 3
  { f: Fs5, d: 1 }, { f: E5,  d: 1 }, { f: D5,  d: 1 }, { f: B4,  d: 1 },
  { f: A4,  d: 1 }, { f: G4,  d: 1 }, { f: Fs4, d: 2 },
  // Takt 4 — halvkadens, groda som väntar
  { f: D4,   d: 2 }, { f: REST, d: 2 }, { f: B4,  d: 2 }, { f: REST, d: 2 },
  // Takt 5
  { f: D5,  d: 1 }, { f: Fs5, d: 1 }, { f: A5,  d: 1 }, { f: Fs5, d: 1 },
  { f: D5,  d: 1 }, { f: Fs5, d: 1 }, { f: A5,  d: 2 },
  // Takt 6
  { f: D5,  d: 1 }, { f: Fs5, d: 1 }, { f: A5,  d: 1 }, { f: B5,  d: 1 },
  { f: G5,  d: 1 }, { f: Fs5, d: 1 }, { f: D5,  d: 2 },
  // Takt 7
  { f: A5,  d: 1 }, { f: G5,  d: 1 }, { f: Fs5, d: 1 }, { f: D5,  d: 1 },
  { f: B4,  d: 1 }, { f: A4,  d: 1 }, { f: G4,  d: 2 },
  // Takt 8 — final, landar på grundtonen
  { f: G4,   d: 2 }, { f: REST, d: 2 }, { f: D4,  d: 2 }, { f: G4,  d: 2 }
];

export class AudioManager {
  constructor() {
    this._ctx       = null;
    this._master     = null;
    this._musicGain  = null;
    this._sfxGain    = null;
    this._muted      = false;
    this._musicOn    = false;
    this._noteIndex  = 0;
    this._nextNoteAt = 0;
    this._timerId    = null;
  }

  _ensureContext() {
    if (this._ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this._ctx = new Ctx();
    this._master = this._ctx.createGain();
    this._master.gain.value = this._muted ? 0 : 1;
    this._master.connect(this._ctx.destination);

    this._musicGain = this._ctx.createGain();
    this._musicGain.gain.value = 0.12;
    this._musicGain.connect(this._master);

    this._sfxGain = this._ctx.createGain();
    this._sfxGain.gain.value = 0.3;
    this._sfxGain.connect(this._master);
  }

  // Måste anropas från en användargest (klick/tangenttryck) — webbläsare
  // blockerar AudioContext tills dess.
  unlock() {
    this._ensureContext();
    if (this._ctx.state === 'suspended') this._ctx.resume();
  }

  setMuted(muted) {
    this._muted = muted;
    if (this._master) this._master.gain.value = muted ? 0 : 1;
  }

  isMuted() {
    return this._muted;
  }

  // Kort uppåtgående "hopp"-blip — spelas när grodan/paddan flyttar.
  playHop() {
    if (!this._ctx) return;
    const t = this._ctx.currentTime;
    const osc  = this._ctx.createOscillator();
    const gain = this._ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(560, t + 0.07);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(1, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    osc.connect(gain).connect(this._sfxGain);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  startMusic() {
    if (this._musicOn || !this._ctx) return;
    this._musicOn    = true;
    this._noteIndex  = 0;
    this._nextNoteAt = this._ctx.currentTime + 0.1;
    this._scheduler();
  }

  stopMusic() {
    this._musicOn = false;
    if (this._timerId !== null) {
      clearTimeout(this._timerId);
      this._timerId = null;
    }
  }

  _scheduler() {
    if (!this._musicOn) return;
    while (this._nextNoteAt < this._ctx.currentTime + SCHEDULE_AHEAD) {
      const note = MELODY[this._noteIndex];
      if (note.f !== REST) this._scheduleNote(note.f, this._nextNoteAt, note.d * EIGHTH_SEC);
      this._nextNoteAt += note.d * EIGHTH_SEC;
      this._noteIndex = (this._noteIndex + 1) % MELODY.length;
    }
    this._timerId = setTimeout(() => this._scheduler(), LOOKAHEAD_MS);
  }

  _scheduleNote(freq, startAt, durationSec) {
    const osc  = this._ctx.createOscillator();
    const gain = this._ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    const releaseAt = startAt + durationSec * 0.85;
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(1, startAt + 0.015);
    gain.gain.setValueAtTime(1, releaseAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationSec);
    osc.connect(gain).connect(this._musicGain);
    osc.start(startAt);
    osc.stop(startAt + durationSec);
  }
}
