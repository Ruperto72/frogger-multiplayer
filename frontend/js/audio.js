// 8-bitars ljud via Web Audio API — inga ljudfiler, allt syntetiseras.
// Fyra samtidiga röster (likt NES: två fyrkantskanaler, en triangel-bas,
// en bruskanal), schemalagda av en gemensam lookahead-scheduler så de
// hålls i fas utan drift eller klick jämfört med att kedja setTimeout
// på notlängden. Hopp-blippet (playHop) triggas per drag, se input.js.

export const TEMPO_BPM = 150;
const EIGHTH_SEC  = 60 / TEMPO_BPM / 2;
const LOOKAHEAD_MS   = 25;   // hur ofta schemaläggaren vaknar
const SCHEDULE_AHEAD = 0.1;  // hur långt fram (sek) den lägger noter i kön

// Not-frekvenser (Hz), G-dur — F blir F# via förtecknet.
const B3 = 246.94;
const D4 = 293.66, E4 = 329.63, Fs4 = 369.99, G4 = 392.00, A4 = 440.00, B4 = 493.88;
const C5 = 523.25, D5 = 587.33, E5 = 659.25, Fs5 = 739.99, G5 = 783.99, A5 = 880.00, B5 = 987.77;
const G3 = 196.00, A3 = 220.00, D3 = 146.83;
const D6 = 1174.66;
const REST = 0;

// "Froggy Hop" — 8 takter, finslipade i ABC-notation och förhandslyssnade
// innan de skrevs om till frekvens/notvärde-par här. d = längd i åttondelar.
// Valfria effektflaggor per not (se _scheduleTone/_schedulePortamentoTone):
// `bend` glider tonhöjden mot målfrekvensen under notens sista hälft;
// `vib` = vibrato (tonhöjds-LFO); `trem` = tremolo (volym-LFO); `duty` =
// pulsbredd 0–1 för fyrkantsröster (0.5 = vanlig "square"); `arp` = lista med
// halvtonsoffset som notens grundton snabbt växlar med (chip-ackord);
// `porta` = portamento, en obruten legato-glidning in i nästa nots attack
// utan ny retrigger (skild från `bend`, som glider mot ett mål och sedan
// släpper som vanligt inom samma not — utesluter bend/arp på samma not);
// `crush` = bitcrush (kvantiserar amplituden via en WaveShaperNode för ett
// råare, nedsamplat ljud); `echo` = skickar noten till en delad eko-buss
// (feedback-DelayNode); `chorus` = en andra, lätt feldstämd oscillator läggs
// ovanpå för ett tjockare ljud (hoppas över vid arpeggio). Bara använt på
// enstaka, utvalda noter så det känns som kryddor, inte ett genomgående
// effektlager.
export const LEAD = [
  // Takt 1 — tremolo på den hållna avslutningstonen
  { f: G4,  d: 1 }, { f: B4,  d: 1 }, { f: D5,  d: 1 }, { f: B4,  d: 1 },
  { f: G4,  d: 1 }, { f: B4,  d: 1 }, { f: D5,  d: 2, trem: true },
  // Takt 2 — scoop upp i höjdpunkten (D5→G5), tunnare puls på toppnoten
  { f: G4,  d: 1 }, { f: B4,  d: 1 }, { f: D5,  d: 1, bend: G5 }, { f: G5,  d: 1, duty: 0.25 },
  { f: E5,  d: 1 }, { f: D5,  d: 1 }, { f: B4,  d: 2 },
  // Takt 3 — vibrato på den avslutande, hållna tonen
  { f: Fs5, d: 1 }, { f: E5,  d: 1 }, { f: D5,  d: 1 }, { f: B4,  d: 1 },
  { f: A4,  d: 1 }, { f: G4,  d: 1 }, { f: Fs4, d: 2, vib: true },
  // Takt 4 — halvkadens, groda som väntar — vibrato på båda väntetonerna
  { f: D4,   d: 2, vib: true }, { f: REST, d: 2 }, { f: B4,  d: 2, vib: true }, { f: REST, d: 2 },
  // Takt 5 — tremolo på den hållna avslutningstonen, speglar takt 1
  { f: D5,  d: 1 }, { f: Fs5, d: 1 }, { f: A5,  d: 1 }, { f: Fs5, d: 1 },
  { f: D5,  d: 1 }, { f: Fs5, d: 1 }, { f: A5,  d: 2, trem: true },
  // Takt 6 — scoop upp mot styckets högsta ton (A5→B5), tunnare puls på toppen
  { f: D5,  d: 1 }, { f: Fs5, d: 1 }, { f: A5,  d: 1, bend: B5 }, { f: B5,  d: 1, duty: 0.25 },
  { f: G5,  d: 1 }, { f: Fs5, d: 1 }, { f: D5,  d: 2 },
  // Takt 7 — vibrato in i den sista takten
  { f: A5,  d: 1 }, { f: G5,  d: 1 }, { f: Fs5, d: 1 }, { f: D5,  d: 1 },
  { f: B4,  d: 1 }, { f: A4,  d: 1 }, { f: G4,  d: 2, vib: true },
  // Takt 8 — final: kort chip-ackord (D-durtreklang) leder in i sista tonen,
  // som glider upp mot kvinten inför loopens omtag
  { f: G4,   d: 2 }, { f: REST, d: 2 }, { f: D4,  d: 2, arp: [4, 7] }, { f: G4,  d: 2, bend: D5 }
];

// Stämma — parallell diatonisk ters under LEAD (G→E, A→F#, B→G, D→B, E→C,
// F#→D), samma rytm som LEAD not för not.
export const HARMONY = [
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
export const BASS = [
  { f: G3, d: 2 }, { f: D4, d: 2 }, { f: G3, d: 2 }, { f: D4, d: 2 }, // takt 1 (G)
  { f: G3, d: 2 }, { f: D4, d: 2 }, { f: G3, d: 2 }, { f: D4, d: 2 }, // takt 2 (G)
  { f: D3, d: 2 }, { f: A3, d: 2 }, { f: D3, d: 2 }, { f: A3, d: 2 }, // takt 3 (D)
  { f: G3, d: 2 }, { f: REST, d: 2 }, { f: G3, d: 2 }, { f: REST, d: 2 }, // takt 4 (G, väntar)
  { f: G3, d: 2 }, { f: D4, d: 2 }, { f: G3, d: 2 }, { f: D4, d: 2 }, // takt 5 (G)
  { f: G3, d: 2 }, { f: D4, d: 2 }, { f: G3, d: 2 }, { f: D4, d: 2 }, // takt 6 (G)
  { f: D3, d: 2 }, { f: A3, d: 2 }, { f: D3, d: 2 }, { f: A3, d: 2 }, // takt 7 (D)
  { f: G3, d: 2 }, { f: REST, d: 2 }, { f: G3, d: 2 }, { f: G3, d: 2 }  // takt 8 (G, final)
];

// Rytm — kick på ettan, hi-hat på slag 2/4 som grundpuls i alla 8 takter.
// Snare (klassisk "backbeat" på slag 3) och puka sprinklade in på samma
// speglade ställen som LEAD:s egna kryddor — takt 1/5 (tremolo-tonen) får
// backbeat, takt 4/8 (väntetakten/loopens omtag) får en liten pukafyllning
// — istället för på varje takt, så det känns som kryddor snarare än ett
// genomgående mönster. `type` kan vara 'kick', 'snare', 'hihat' eller 'tom'
// (pukan), se _scheduler()/_scheduleSnare()/_schedulePuka() nedan.
export const RHYTHM = [
  { type: 'kick', d: 2 }, { type: 'hihat', d: 2 }, { type: 'snare', d: 2 }, { type: 'hihat', d: 2 }, // takt 1
  { type: 'kick', d: 2 }, { type: 'hihat', d: 2 }, { type: 'hihat', d: 2 }, { type: 'hihat', d: 2 }, // takt 2
  { type: 'kick', d: 2 }, { type: 'hihat', d: 2 }, { type: 'hihat', d: 2 }, { type: 'hihat', d: 2 }, // takt 3
  { type: 'kick', d: 2 }, { type: 'hihat', d: 2 }, { type: 'hihat', d: 2 }, { type: 'tom',   d: 2 }, // takt 4
  { type: 'kick', d: 2 }, { type: 'hihat', d: 2 }, { type: 'snare', d: 2 }, { type: 'hihat', d: 2 }, // takt 5
  { type: 'kick', d: 2 }, { type: 'hihat', d: 2 }, { type: 'hihat', d: 2 }, { type: 'hihat', d: 2 }, // takt 6
  { type: 'kick', d: 2 }, { type: 'hihat', d: 2 }, { type: 'hihat', d: 2 }, { type: 'hihat', d: 2 }, // takt 7
  { type: 'kick', d: 2 }, { type: 'hihat', d: 2 }, { type: 'snare', d: 2 }, { type: 'tom',   d: 2 }  // takt 8
];

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
    this._pulseWaves   = null;
    this._crushCurve   = null;
    this._delay        = null;
    this._delayFeedback = null;
    this._delayWet     = null;
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

    // Eko-buss (note.echo) — en delad feedback-DelayNode-slinga, inte en
    // permanent effekt på hela kanalen. Enstaka noter skickas hit i tillägg
    // till sin vanliga (torra) anslutning, se _scheduleTone. Fördröjningen
    // är en punkterad åttondel — en klassisk rytmisk slaptillbaka-eko.
    this._delay = this._ctx.createDelay(1.0);
    this._delay.delayTime.value = EIGHTH_SEC * 1.5;
    this._delayFeedback = this._ctx.createGain();
    this._delayFeedback.gain.value = 0.35;
    this._delay.connect(this._delayFeedback).connect(this._delay);
    this._delayWet = this._ctx.createGain();
    this._delayWet.gain.value = 0.5;
    this._delay.connect(this._delayWet).connect(this._musicGain);
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

  // Nedåtgående dubbel-"kvack" — spelas när en spelare dör (bilkrock eller
  // drunkning, dvs när servern drar ett liv). Två sjunkande fyrkantspulser
  // för att skilja sig tydligt från hoppets enkla, stigande blip.
  playCroak() {
    if (!this._ctx) return;
    const t = this._ctx.currentTime;
    this._scheduleQuack(t, 340, 220, 0.08);
    this._scheduleQuack(t + 0.1, 260, 150, 0.1);
  }

  _scheduleQuack(startAt, fromFreq, toFreq, dur) {
    const osc  = this._ctx.createOscillator();
    const gain = this._ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(fromFreq, startAt);
    osc.frequency.exponentialRampToValueAtTime(toFreq, startAt + dur);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(1, startAt + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
    osc.connect(gain).connect(this._sfxGain);
    osc.start(startAt);
    osc.stop(startAt + dur + 0.02);
  }

  // Stigande fanfar — spelas när en spelare når mål. Ett snabbt arpeggio
  // (grundackordets toner) avslutat med en treklangsstöt (G-dur en oktav
  // upp) för lite extra "ta-da". Återanvänder samma tonhjälpare som
  // bakgrundsmusiken (_scheduleTone) istället för att duplicera envelopet.
  playGoal() {
    if (!this._ctx) return;
    const t       = this._ctx.currentTime;
    const spacing = 0.06;
    [G4, B4, D5, G5].forEach((f, i) => {
      this._scheduleTone({ f }, t + i * spacing, 0.08, this._sfxGain, 'square');
    });
    const chordAt = t + 4 * spacing;
    for (const f of [G5, B5, D6]) {
      this._scheduleTone({ f }, chordAt, 0.35, this._sfxGain, 'square');
    }
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
          else if (note.type === 'snare') this._scheduleSnare(voice.nextAt);
          else if (note.type === 'tom') this._schedulePuka(voice.nextAt);
          else this._scheduleHihat(voice.nextAt);
          voice.nextAt += dur;
          voice.index = (voice.index + 1) % voice.notes.length;
        } else if (note.f === REST) {
          voice.nextAt += dur;
          voice.index = (voice.index + 1) % voice.notes.length;
        } else {
          const nextIndex = (voice.index + 1) % voice.notes.length;
          const nextNote  = voice.notes[nextIndex];
          if (note.porta && nextNote.f !== REST && nextIndex !== voice.index) {
            // Absorberar nästa not i samma oscillator/envelope istället för
            // att schemalägga den separat — se _schedulePortamentoTone.
            const nextDur = nextNote.d * EIGHTH_SEC;
            this._schedulePortamentoTone(note, nextNote, voice.nextAt, dur, nextDur, voice.gain, voice.osc);
            voice.nextAt += dur + nextDur;
            voice.index = (nextIndex + 1) % voice.notes.length;
          } else {
            this._scheduleTone(note, voice.nextAt, dur, voice.gain, voice.osc);
            voice.nextAt += dur;
            voice.index = nextIndex;
          }
        }
      }
    }
    this._timerId = setTimeout(() => this._scheduler(), LOOKAHEAD_MS);
  }

  _scheduleTone(note, startAt, durationSec, destGain, oscType) {
    const osc  = this._ctx.createOscillator();
    const gain = this._ctx.createGain();

    if (oscType === 'square' && note.duty) {
      osc.setPeriodicWave(this._pulseWave(note.duty));
    } else {
      osc.type = oscType;
    }

    let chorusOsc = null;
    if (note.arp && note.arp.length) {
      // Chip-ackord: växla snabbt mellan grundtonen och halvtonsoffsetten i
      // arp istället för en stilla ton — bend/vib/chorus hoppas över för
      // enkelhets skull när arpeggio är aktivt.
      this._scheduleArpeggio(osc, note, startAt, durationSec);
    } else {
      osc.frequency.setValueAtTime(note.f, startAt);
      if (note.bend) {
        const bendAt = startAt + durationSec * 0.5;
        osc.frequency.setValueAtTime(note.f, bendAt);
        osc.frequency.linearRampToValueAtTime(note.bend, startAt + durationSec);
      }
      if (note.vib) {
        const lfo     = this._ctx.createOscillator();
        const lfoGain = this._ctx.createGain();
        lfo.frequency.value = 5.5;              // klassisk chiptune-vibratohastighet
        lfoGain.gain.value  = note.f * 0.02;     // subtil djup, ~2% av tonhöjden
        lfo.connect(lfoGain).connect(osc.frequency);
        lfo.start(startAt);
        lfo.stop(startAt + durationSec);
      }
      if (note.chorus) {
        // Tjockare unison: en andra, lätt feldstämd oscillator (±8 cent,
        // via den inbyggda detune-parametern) delar notens envelope (samma
        // gain-nod) — klassisk "supersaw"-teknik, fast med fyrkant/triangel.
        chorusOsc = this._ctx.createOscillator();
        if (oscType === 'square' && note.duty) chorusOsc.setPeriodicWave(this._pulseWave(note.duty));
        else chorusOsc.type = oscType;
        osc.detune.value = 8;
        chorusOsc.detune.value = -8;
        chorusOsc.frequency.setValueAtTime(note.f, startAt);
        if (note.bend) {
          const bendAt = startAt + durationSec * 0.5;
          chorusOsc.frequency.setValueAtTime(note.f, bendAt);
          chorusOsc.frequency.linearRampToValueAtTime(note.bend, startAt + durationSec);
        }
      }
    }

    const releaseAt = startAt + durationSec * 0.85;
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(1, startAt + 0.015);
    gain.gain.setValueAtTime(1, releaseAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + durationSec);

    if (note.trem) {
      const lfo     = this._ctx.createOscillator();
      const lfoGain = this._ctx.createGain();
      lfo.frequency.value = 18;   // snabbare än vibrato — rytmisk volympulsering
      lfoGain.gain.value  = 0.35; // moduleringsdjup, adderas till envelopets gain
      lfo.connect(lfoGain).connect(gain.gain);
      lfo.start(startAt);
      lfo.stop(startAt + durationSec);
    }

    this._connectVoiceOutput(gain, note, destGain);

    osc.connect(gain);
    osc.start(startAt);
    osc.stop(startAt + durationSec);

    if (chorusOsc) {
      chorusOsc.connect(gain);
      chorusOsc.start(startAt);
      chorusOsc.stop(startAt + durationSec);
    }
  }

  // Portamento: en enda oscillator/envelope glider obrutet från note.f till
  // nextNote.f över gränsen mellan de två noterna, istället för att
  // retriggas (ny attack) vid nästa nots start. Nästa nots egna
  // effektflaggor (bend/vib/trem/duty/arp) hoppas över eftersom den
  // "absorberas" in i den här glidande tonen — se _scheduler().
  _schedulePortamentoTone(note, nextNote, startAt, dur, nextDur, destGain, oscType) {
    const osc  = this._ctx.createOscillator();
    const gain = this._ctx.createGain();
    const totalDur = dur + nextDur;

    if (oscType === 'square' && note.duty) {
      osc.setPeriodicWave(this._pulseWave(note.duty));
    } else {
      osc.type = oscType;
    }

    osc.frequency.setValueAtTime(note.f, startAt);
    const glideStart = startAt + dur * 0.6;
    const glideEnd    = startAt + dur + Math.min(nextDur * 0.3, 0.12);
    osc.frequency.setValueAtTime(note.f, glideStart);
    osc.frequency.linearRampToValueAtTime(nextNote.f, glideEnd);

    if (note.vib) {
      const lfo     = this._ctx.createOscillator();
      const lfoGain = this._ctx.createGain();
      lfo.frequency.value = 5.5;
      lfoGain.gain.value  = note.f * 0.02;
      lfo.connect(lfoGain).connect(osc.frequency);
      lfo.start(startAt);
      lfo.stop(startAt + totalDur);
    }

    const releaseAt = startAt + totalDur * 0.85;
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(1, startAt + 0.015);
    gain.gain.setValueAtTime(1, releaseAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + totalDur);

    if (note.trem) {
      const lfo     = this._ctx.createOscillator();
      const lfoGain = this._ctx.createGain();
      lfo.frequency.value = 18;
      lfoGain.gain.value  = 0.35;
      lfo.connect(lfoGain).connect(gain.gain);
      lfo.start(startAt);
      lfo.stop(startAt + totalDur);
    }

    this._connectVoiceOutput(gain, note, destGain);

    osc.connect(gain);
    osc.start(startAt);
    osc.stop(startAt + totalDur);
  }

  // Kopplar en tons envelope-gain vidare till kanalens destGain (torrt) och,
  // om flaggat, till bitcrush-formaren och/eller eko-bussen. Delad av
  // _scheduleTone och _schedulePortamentoTone.
  _connectVoiceOutput(gain, note, destGain) {
    let outputNode = gain;
    if (note.crush) {
      const shaper = this._ctx.createWaveShaper();
      shaper.curve = this._bitcrushCurve();
      gain.connect(shaper);
      outputNode = shaper;
    }
    outputNode.connect(destGain);
    if (note.echo) outputNode.connect(this._delay);
  }

  // Cachead WaveShaperNode-kurva som kvantiserar amplituden till 16 nivåer
  // (4-bitars) — ett riktigt bitcrush/nedsamplings-sound, inte bara mjuk
  // distortion, för att passa 8-bitstemat.
  _bitcrushCurve() {
    if (this._crushCurve) return this._crushCurve;
    const n = 1 << 16;
    const steps = 16;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = Math.round(x * steps) / steps;
    }
    this._crushCurve = curve;
    return curve;
  }

  _scheduleArpeggio(osc, note, startAt, durationSec) {
    const freqs = [note.f, ...note.arp.map(semi => note.f * Math.pow(2, semi / 12))];
    const stepSec = 0.03; // ~33 Hz — klassisk NES-hastighet för brutna ackord
    let t = startAt, i = 0;
    while (t < startAt + durationSec) {
      osc.frequency.setValueAtTime(freqs[i % freqs.length], t);
      t += stepSec;
      i++;
    }
  }

  // Bygger (och cachar) en periodisk fyrkantsvåg med given pulsbredd
  // (0–1, 0.5 = vanlig 50/50-square) via dess Fourier-koefficienter —
  // Web Audios inbyggda 'square'-typ har alltid fast 50% duty cycle.
  _pulseWave(duty) {
    this._pulseWaves ??= new Map();
    if (this._pulseWaves.has(duty)) return this._pulseWaves.get(duty);
    const harmonics = 32;
    const real = new Float32Array(harmonics + 1);
    const imag = new Float32Array(harmonics + 1);
    for (let n = 1; n <= harmonics; n++) {
      imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
    }
    const wave = this._ctx.createPeriodicWave(real, imag);
    this._pulseWaves.set(duty, wave);
    return wave;
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

  // Syntetisk "puka" (tom-tom) — som kicken men ljusare startfrekvens och
  // längre, mer "bombig" utklingning, så den hörs som ett eget slag.
  _schedulePuka(startAt) {
    const osc  = this._ctx.createOscillator();
    const gain = this._ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, startAt);
    osc.frequency.exponentialRampToValueAtTime(90, startAt + 0.18);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(1, startAt + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.28);
    osc.connect(gain).connect(this._rhythmGain);
    osc.start(startAt);
    osc.stop(startAt + 0.3);
  }

  // Snare — brus (bandpass runt 1.8 kHz, för det klassiska "crack") lagt
  // ovanpå en kort tonal "kropp" (triangel), likt hur en akustisk virveltrumma
  // har både skinn-ton och snarrsladdarnas brus.
  _scheduleSnare(startAt) {
    this._ensureNoiseBuffer();
    const src    = this._ctx.createBufferSource();
    const filter = this._ctx.createBiquadFilter();
    const noiseGain = this._ctx.createGain();
    src.buffer = this._noiseBuffer;
    filter.type = 'bandpass';
    filter.frequency.value = 1800;
    filter.Q.value = 0.7;
    noiseGain.gain.setValueAtTime(0.0001, startAt);
    noiseGain.gain.exponentialRampToValueAtTime(1, startAt + 0.004);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.09);
    src.connect(filter).connect(noiseGain).connect(this._rhythmGain);
    src.start(startAt);
    src.stop(startAt + 0.1);

    const osc     = this._ctx.createOscillator();
    const oscGain = this._ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(190, startAt);
    osc.frequency.exponentialRampToValueAtTime(120, startAt + 0.07);
    oscGain.gain.setValueAtTime(0.0001, startAt);
    oscGain.gain.exponentialRampToValueAtTime(0.5, startAt + 0.004);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.08);
    osc.connect(oscGain).connect(this._rhythmGain);
    osc.start(startAt);
    osc.stop(startAt + 0.09);
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
