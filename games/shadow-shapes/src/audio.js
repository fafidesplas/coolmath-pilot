// Synthesized sound (GDD 10). The AudioContext starts on the first click or key.
// Structure copied from Ink Path (synth, noise layers, music sequencer); the
// sounds and the ambient music are Shadow Shapes' own.

// C major pentatonic, so the warm notes harmonize with the music (GDD 3.8, 10).
export const WARM = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99, 880];

export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.noise = null;
    this.musicOn = true;       // setting (on by default, GDD 10)
    this.musicGain = null;
    this.seq = null;
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
      this.musicGain.gain.value = 0.22;
      this.musicGain.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      let seed = 11;
      for (let i = 0; i < len; i++) { seed = (seed * 16807) % 2147483647; d[i] = seed / 1073741823.5 - 1; }
      // Whirr: soft filtered noise that follows the rotation speed.
      this.whirr = this.loop('bandpass', 700, 1.4);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.musicOn && !this.seq) this.startMusic();
  }

  loop(type, freq, q) {
    const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = this.noise; s.loop = true;
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.value = 0;
    s.connect(f).connect(g).connect(this.master);
    s.start();
    return { f, g, base: freq };
  }

  // k in 0..1 (rotation speed).
  setWhirr(k) {
    if (!this.ctx || !this.whirr) return;
    const t = this.ctx.currentTime, l = this.whirr, v = Math.min(1, k);
    l.g.gain.setTargetAtTime(v * 0.16, t, 0.04);
    l.f.frequency.setTargetAtTime(l.base * (0.7 + v * 1.2), t, 0.06);
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, 0.02);
  }

  tone(type, f0, f1, dur, vol = 0.3, delay = 0, at = 0, out = this.master, attack = 0.006) {
    if (!this.ctx) return;
    const t = at || this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  burst(dur, vol, freq, q = 1, delay = 0, type = 'bandpass', at = 0, out = this.master) {
    if (!this.ctx) return;
    const t = at || this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = this.noise;
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(out);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  pluck(f, vol, delay = 0) {
    this.tone('triangle', f, f, 0.5, vol, delay);
    this.tone('sine', f * 2, f * 2, 0.25, vol * 0.3, delay);
  }

  play(name, opt = {}) {
    if (!this.ctx || !this.enabled) return;
    switch (name) {
      case 'click': this.tone('sine', 1200, 900, 0.05, 0.08); break;
      case 'lock': this.tone('sine', 1800, 1500, 0.025, 0.05); break;                           // axis lock
      case 'tock': this.tone('triangle', 180, 120, 0.09, 0.25); this.burst(0.03, 0.08, 600); break; // locked wobble
      case 'step': this.tone('sine', 1400, 1100, 0.03, 0.06); break;                            // key step
      case 'note': this.pluck(WARM[Math.max(0, Math.min(9, opt.i || 0))], 0.16); break;
      case 'tick': this.tone('sine', 160, 130, 0.06, 0.08); break;                              // colder
      case 'snap':
        this.burst(0.06, 0.45, 1100, 2); this.tone('triangle', 330, 180, 0.08, 0.25);
        this.tone('sine', 400, 1600, 0.25, 0.08, 0.04);
        break;
      case 'reveal':
        [1046.5, 1318.5, 1568, 2093, 2637].forEach((f, i) => { this.tone('sine', f, f, 0.6, 0.13, i * 0.12); this.tone('sine', f * 3, f * 3, 0.15, 0.03, i * 0.12); });
        for (let i = 0; i < 8; i++) this.burst(0.08, 0.05, 6000 + i * 300, 3, 0.3 + i * 0.09, 'bandpass');
        break;
      case 'restart': [523, 392, 330].forEach((f, i) => this.tone('sine', f, f, 0.1, 0.1, i * 0.05)); break;
      case 'star': { const f = [784, 988, 1175][Math.min(2, opt.i || 0)]; this.tone('triangle', 140, 70, 0.1, 0.3); this.tone('sine', f, f * 1.5, 0.25, 0.2); break; }
      case 'page': this.burst(0.18, 0.18, 3500, 0.6, 0, 'highpass'); break;
      case 'count': this.tone('sine', 1500 + (opt.k || 0) * 600, 1500 + (opt.k || 0) * 600, 0.02, 0.03); break;
      case 'whoosh': this.burst(0.3, 0.15, 1500, 0.8); break;
    }
  }

  // ---- Music: calm ambient loop, 72 BPM, 8 bars, pads + a slow plucked arpeggio ---

  setMusic(on) {
    this.musicOn = on;
    if (!this.ctx) return;
    if (on) this.startMusic(); else this.stopMusic();
  }

  startMusic() {
    if (!this.ctx || this.seq || !this.musicOn) return;
    this.seq = { next: this.ctx.currentTime + 0.05, step: 0 };
    this.seqTimer = setInterval(() => this.schedule(), 25);
  }

  stopMusic() {
    clearInterval(this.seqTimer);
    this.seq = null;
  }

  schedule() {
    const s16 = 60 / 72 / 4;
    while (this.seq && this.seq.next < this.ctx.currentTime + 0.15) {
      this.musicStep(this.seq.step, this.seq.next);
      this.seq.next += s16;
      this.seq.step = (this.seq.step + 1) % 128;
    }
  }

  pad(f, t, dur, vol) {
    const out = this.musicGain;
    for (const det of [0.997, 1.003]) this.tone('triangle', f * det, f * det, dur, vol, 0, t, out, dur * 0.4);
  }

  musicStep(i, t) {
    const out = this.musicGain;
    const bar = Math.floor(i / 16), k = i % 16;
    // C  Am  F(6)  G  C  Em  F(6)  G(sus) — voiced from the pentatonic notes
    const chords = [
      [130.81, 196, 329.63], [110, 164.81, 261.63], [87.31, 220, 293.66], [98, 196, 293.66],
      [130.81, 196, 329.63], [82.41, 196, 246.94], [87.31, 220, 261.63], [98, 220, 293.66],
    ];
    const ch = chords[bar];
    if (k === 0) for (const f of ch) this.pad(f, t, 60 / 72 * 4 + 0.6, 0.06);
    // slow plucked arpeggio on 8th notes, pentatonic
    const arp = [0, -1, 2, -1, 4, -1, 3, -1, 5, -1, 3, -1, 2, -1, -1, -1];
    const scale = [261.63, 293.66, 329.63, 392, 440, 523.25];
    if (arp[k] >= 0 && (bar % 2 === 0 || k < 12)) {
      const f = scale[(arp[k] + bar) % scale.length];
      this.tone('sine', f, f, 0.9, 0.06, 0, t, out);
      this.tone('sine', f * 2, f * 2, 0.2, 0.015, 0, t, out);
    }
  }
}
