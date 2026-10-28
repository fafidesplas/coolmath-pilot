// Synthesized sound effects and echo-layered music (GDD 10). The AudioContext
// starts on the first click or key press. (Structure copied from Flip Runner.)
const NOTE = n => 220 * Math.pow(2, n / 12);       // semitones from A3
const CHORD = [0, 4, 7, 12];                        // echo 1 root, 2 third, 3 fifth, 4 octave

export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.noise = null;
    this.musicOn = true;       // setting (on by default, GDD 10)
    this.musicGain = null;
    this.seq = null;
    this.layers = 0;           // echoes in the room: each adds a music layer
    this.wantMusic = false;    // the game wants music now (in a room, not paused)
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.5 : 0;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.28;
      this.musicGain.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      let seed = 7;
      for (let i = 0; i < len; i++) { seed = (seed * 16807) % 2147483647; d[i] = seed / 1073741823.5 - 1; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.updateMusic();
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, 0.02);
  }

  tone(type, f0, f1, dur, vol = 0.3, delay = 0, at = 0, out = this.master) {
    if (!this.ctx) return;
    const t = at || this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  burst(dur, vol, freq, q = 1, delay = 0, type = 'bandpass', at = 0, out = this.master, f1 = 0) {
    if (!this.ctx) return;
    const t = at || this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = this.noise;
    f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(out);
    s.start(t, (t * 7.3) % 0.5);
    s.stop(t + dur + 0.02);
  }

  play(name, opt = {}) {
    if (!this.ctx || !this.enabled) return;
    switch (name) {
      case 'click': this.tone('square', 900, 700, 0.05, 0.06); break;
      case 'tick': { const late = opt.late; this.tone('triangle', late ? 1500 : 1100, late ? 1400 : 1000, 0.04, late ? 0.16 : 0.06); break; }
      case 'rewind':
        this.burst(0.45, 0.22, 3000, 0.8, 0, 'bandpass', 0, this.master, 400);
        this.tone('sawtooth', 500, 120, 0.42, 0.05);
        break;
      case 'echo': { const f = NOTE(CHORD[Math.min(3, opt.i || 0)] + 12); this.tone('sine', f, f, 0.6, 0.2); this.tone('sine', f * 2, f * 2, 0.4, 0.05, 0.05); break; }
      case 'jump': this.tone('sine', 420, 760, 0.09, 0.1); break;
      case 'land': this.tone('triangle', 140, 70, 0.07, 0.14); this.burst(0.04, 0.08, 500); break;
      case 'plateDown': this.tone('square', 220, 160, 0.06, 0.08); break;
      case 'plateUp': this.tone('square', 160, 220, 0.06, 0.06); break;
      case 'gateOpen': this.burst(0.18, 0.12, 900, 1, 0, 'bandpass', 0, this.master, 2400); break;
      case 'gateClose': this.tone('triangle', 160, 90, 0.1, 0.22); this.burst(0.06, 0.15, 400); break;
      case 'break': for (let i = 0; i < 5; i++) this.tone('square', 300 + (i % 2) * 400, 200, 0.03, 0.06, i * 0.035); break;
      case 'full': this.tone('square', 110, 100, 0.12, 0.12); this.tone('square', 110, 100, 0.12, 0.12, 0.16); break;
      case 'exit': CHORD.forEach((n, i) => this.tone('sine', NOTE(n + 12), NOTE(n + 12), 0.9, 0.12, i * 0.07)); break;
      case 'sparkle': { const f = NOTE(CHORD[(opt.i || 0) % 4] + 24); this.tone('sine', f, f, 0.25, 0.08); break; }
      case 'star': { const f = NOTE([12, 16, 19][Math.min(2, opt.i || 0)] + 12); this.tone('triangle', 180, 90, 0.12, 0.25); this.tone('sine', f, f, 0.3, 0.2, 0.03); break; }
    }
  }

  // ---- Music (GDD 10): a soft pad and pulse at 120 BPM that restart with every
  // loop; each echo adds a layer (1 bass, 2 arpeggio, 3 bells, 4 hats). ---------------

  setMusic(on) { this.musicOn = on; this.updateMusic(); }
  want(on) { this.wantMusic = on; this.updateMusic(); }

  updateMusic() {
    if (!this.ctx) return;
    if (this.musicOn && this.wantMusic) { if (!this.seq) this.restartMusic(); }
    else this.stopMusic();
  }

  restartMusic() {
    if (!this.ctx || !this.musicOn || !this.wantMusic) return;
    this.stopMusic();
    this.seq = { next: this.ctx.currentTime + 0.03, step: 0 };
    this.seqTimer = setInterval(() => this.schedule(), 25);
  }

  stopMusic() {
    clearInterval(this.seqTimer);
    this.seq = null;
  }

  schedule() {
    const s16 = 60 / 120 / 4;
    while (this.seq && this.seq.next < this.ctx.currentTime + 0.12) {
      this.musicStep(this.seq.step, this.seq.next);
      this.seq.next += s16;
      this.seq.step = (this.seq.step + 1) % 64;
    }
  }

  musicStep(i, t) {
    const out = this.musicGain, bar = Math.floor(i / 16), k = i % 16;
    const root = [0, -4, 3, -2][bar];                     // Am F C G
    const third = bar === 0 ? 3 : 4;
    if (k === 0) [0, third, 7].forEach(n => this.tone('triangle', NOTE(root + n), NOTE(root + n), 1.9, 0.035, 0, t, out));   // pad
    if (k % 4 === 0) this.tone('sine', NOTE(root + 12), NOTE(root + 12), 0.08, 0.04, 0, t, out);                         // pulse
    const L = this.layers;
    if (L >= 1 && (k === 0 || k === 6 || k === 8 || k === 14)) this.tone('sawtooth', NOTE(root - 12), NOTE(root - 12), 0.2, 0.05, 0, t, out);
    if (L >= 2 && k % 2 === 0) { const n = root + [0, third, 7, 12][(k / 2) % 4] + 12; this.tone('triangle', NOTE(n), NOTE(n), 0.1, 0.035, 0, t, out); }
    if (L >= 3 && (k === 3 || k === 11)) { const n = root + 24 + (k === 3 ? 7 : third); this.tone('sine', NOTE(n), NOTE(n), 0.5, 0.04, 0, t, out); }
    if (L >= 4 && k % 2 === 1) this.burst(0.03, 0.05, 8000, 0.7, 0, 'highpass', t, out);
  }
}
