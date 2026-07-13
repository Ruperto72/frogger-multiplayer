// 8-bitars ljud via Web Audio API — inga ljudfiler, allt syntetiseras.
// Fyra samtidiga röster (likt NES: två fyrkantskanaler, en triangel-bas,
// en bruskanal), schemalagda av en gemensam lookahead-scheduler så de
// hålls i fas utan drift eller klick jämfört med att kedja setTimeout
// på notlängden. Hopp-blippet (playHop) triggas per drag, se input.js.

const TEMPO_BPM   = 150;
const EIGHTH_SEC  = 60 / TEMPO_BPM / 2;
const LOOKAHEAD_MS   = 25;   // hur ofta schemaläggaren vaknar
const SCHEDULE_AHEAD = 0.1;  // hur långt fram (sek) den lägger noter i kön

// Not-frekvenser (Hz), G-dur — F blir F# via förtecknet.
const B3 = 246.94;
const D4 = 293.66, E4 = 329.63, Fs4 = 369.99, G4 = 392.00, A4 = 440.00, B4 = 493.88;
const C5 = 523.25, D5 = 587.33, E5 = 659.25, Fs5 = 739.99, G5 = 783.99, A5 = 880.00, B5 = 987.77;
const G3 = 196.00, A3 = 220.00, D3 = 146.83;
const REST = 0;

// "Froggy Hop" — 8 takter, finslipade i ABC-notation och förhandslyssnade
// innan de skrevs om till frekvens/notvärde-par här. d = längd i åttondelar.
const LEAD = [
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

// Stämma — parallell diatonisk ters under LEAD (G→E, A→F#, B→G, D→B, E→C,
// F#→D), samma rytm som LEAD not för not.
const HARMONY = [
  { f: E4,  d: 1 }, { f: G4,  d: 1 }, { f: B4,  d: 1 }, { f: G4,  d: 1 },
  { f: E4,  d: 1 }, { f: G4,  d: 1 }, { f: B4,  d: 2 },

  { f: E4,  d: 1 }, { f: G4,  d: 1 }, { f: B4,  d: 1 }, { f: E5,  d: 1 },
  { f: C5,  d: 1 }, { f: B4,  d: 1 }, { f: G4,  d: 2 },

  { f: D5,  d: 1 }, { f: C5,  d: 1 }, { f: B4,  d: 1 }, { f: G4,  d: 1 },
  { f: Fs4, d: 1 }, { f: E4,  d: 1 }, { f: D4,  d: 2 },

  { f: B3,   d: 2 }, { f: REST, d: 2 }, { f: G4,  d: 2 }, { f: REST, d: 2 },

  { f: B4,  d: 1 }, { f: D5,  d: 1 }, { f: Fs5, d: 1 }, { f: D5,  d: 1 },
  { f: B4,  d: 1 }, { f: D5,  d: 1 }, { f: Fs5, d: 2 },

  { f: B4,  d: 1 }, { f: D5,  d: 1 }, { f: Fs5, d: 1 }, { f: G5,  d: 1 },
  { f: E5,  d: 1 }, { f: D5,  d: 1 }, { f: B4,  d: 2 },

  { f: Fs5, d: 1 }, { f: E5,  d: 1 }, { f: D5,  d: 1 }, { f: B4,  d: 1 },
  { f: G4,  d: 1 }, { f: Fs4, d: 1 }, { f: E4,  d: 2 },

  { f: E4,   d: 2 }, { f: REST, d: 2 }, { f: B3,  d: 2 }, { f: E4,  d: 2 }
];

// Basgång — "oom-pah" (grundton/kvint) som följer ackorden G–G–D–G,
// två gånger. Ackordvalet matchar tonerna i LEAD/HARMONY (ingen C-ackord
// behövs — E/C som dyker upp i stämman blir naturliga genomgångstoner
// ovanpå G-basen istället, se designspecen).
const BASS = [
  { f: G3, d: 2 }, { f: D4, d: 2 }, { f: G3, d: 2 }, { f: D4, d: 2 }, // takt 1 (G)
  { f: G3, d: 2 }, { f: D4, d: 2 }, { f: G3, d: 2 }, { f: D4, d: 2 }, // takt 2 (G)
  { f: D3, d: 2 }, { f: A3, d: 2 }, { f: D3, d: 2 }, { f: A3, d: 2 }, // takt 3 (D)
  { f: G3, d: 2 }, { f: REST, d: 2 }, { f: G3, d: 2 }, { f: REST, d: 2 }, // takt 4 (G, väntar)
  { f: G3, d: 2 }, { f: D4, d: 2 }, { f: G3, d: 2 }, { f: D4, d: 2 }, // takt 5 (G)
  { f: G3, d: 2 }, { f: D4, d: 2 }, { f: G3, d: 2 }, { f: D4, d: 2 }, // takt 6 (G)
  { f: D3, d: 2 }, { f: A3, d: 2 }, { f: D3, d: 2 }, { f: A3, d: 2 }, // takt 7 (D)
  { f: G3, d: 2 }, { f: REST, d: 2 }, { f: G3, d: 2 }, { f: G3, d: 2 }  // takt 8 (G, final)
];

// Rytm — kick på ettan, hi-hat på slag 2–4, jämnt genom alla 8 takter.
const RHYTHM = [];
for (let bar = 0; bar < 8; bar++) {
  for (let beat = 0; beat < 4; beat++) {
    RHYTHM.push({ type: beat === 0 ? 'kick' : 'hihat', d: 2 });
  }
}

export class AudioManager {
  constructor() {
    this._ctx         = null;
    this._master       = null;
    this._musicGain    = null;
    this._leadGain     = null;
    this._harmonyGain  = null;
    this._bassGain     = null;
    this._rhythmGain   = null;
    this._sfxGain      = null;
    this._noiseBuffer  = null;
    this._muted        = false;
    this._musicOn      = false;
    this._voices       = [];
    this._timerId      = null;
  }

  _ensureContext() {
    if (this._ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this._ctx = new Ctx();
    this._master = this._ctx.createGain();
    this._master.gain.value = this._muted ? 0 : 1;
    this._master.connect(this._ctx.destination);

    this._musicGain = this._ctx.createGain();
    this._musicGain.gain.value = 0.1;
    this._musicGain.connect(this._master);

    this._leadGain = this._ctx.createGain();
    this._leadGain.gain.value = 0.9;
    this._leadGain.connect(this._musicGain);

    this._harmonyGain = this._ctx.createGain();
    this._harmonyGain.gain.value = 0.5;
    this._harmonyGain.connect(this._musicGain);

    this._bassGain = this._ctx.createGain();
    this._bassGain.gain.value = 0.7;
    this._bassGain.connect(this._musicGain);

    this._rhythmGain = this._ctx.createGain();
    this._rhythmGain.gain.value = 1.0;
    this._rhythmGain.connect(this._musicGain);

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
    this._musicOn = true;
    const startAt = this._ctx.currentTime + 0.1;
    this._voices = [
      { notes: LEAD,    index: 0, nextAt: startAt, gain: this._leadGain,    osc: 'square',   kind: 'tone' },
      { notes: HARMONY, index: 0, nextAt: startAt, gain: this._harmonyGain, osc: 'square',   kind: 'tone' },
      { notes: BASS,    index: 0, nextAt: startAt, gain: this._bassGain,    osc: 'triangle', kind: 'tone' },
      { notes: RHYTHM,  index: 0, nextAt: startAt, kind: 'rhythm' }
    ];
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
    const horizon = this._ctx.currentTime + SCHEDULE_AHEAD;
    for (const voice of this._voices) {
      while (voice.nextAt < horizon) {
        const note = voice.notes[voice.index];
        const dur  = note.d * EIGHTH_SEC;
        if (voice.kind === 'rhythm') {
          if (note.type === 'kick') this._scheduleKick(voice.nextAt);
          else this._scheduleHihat(voice.nextAt);
        } else if (note.f !== REST) {
          this._scheduleTone(note.f, voice.nextAt, dur, voice.gain, voice.osc);
        }
        voice.nextAt += dur;
        voice.index = (voice.index + 1) % voice.notes.length;
      }
    }
    this._timerId = setTimeout(() => this._scheduler(), LOOKAHEAD_MS);
  }

  _scheduleTone(freq, startAt, durationSec, destGain, oscType) {
    const osc  = this._ctx.createOscillator();
    const gain = this._ctx.createGain();
    osc.type = oscType;
    osc.frequency.value = freq;
    const releaseAt = startAt + durationSec * 0.85;
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(1, startAt + 0.015);
    gain.gain.setValueAtTime(1, releaseAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationSec);
    osc.connect(gain).connect(destGain);
    osc.start(startAt);
    osc.stop(startAt + durationSec);
  }

  // Syntetisk "kick" — sjunkande sinuston, ingen brusbuffert behövs.
  _scheduleKick(startAt) {
    const osc  = this._ctx.createOscillator();
    const gain = this._ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, startAt);
    osc.frequency.exponentialRampToValueAtTime(50, startAt + 0.09);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(1, startAt + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.12);
    osc.connect(gain).connect(this._rhythmGain);
    osc.start(startAt);
    osc.stop(startAt + 0.13);
  }

  // Brusbaserad "hi-hat" — återanvänder en enda buffert med vitt brus.
  _ensureNoiseBuffer() {
    if (this._noiseBuffer) return;
    const len    = Math.ceil(this._ctx.sampleRate * 0.1);
    const buffer = this._ctx.createBuffer(1, len, this._ctx.sampleRate);
    const data   = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this._noiseBuffer = buffer;
  }

  _scheduleHihat(startAt) {
    this._ensureNoiseBuffer();
    const src    = this._ctx.createBufferSource();
    const filter = this._ctx.createBiquadFilter();
    const gain   = this._ctx.createGain();
    src.buffer = this._noiseBuffer;
    filter.type = 'highpass';
    filter.frequency.value = 6000;
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(1, startAt + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.035);
    src.connect(filter).connect(gain).connect(this._rhythmGain);
    src.start(startAt);
    src.stop(startAt + 0.04);
  }
}
