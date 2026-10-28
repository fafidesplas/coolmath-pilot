// Synthesized sound (GDD 10). The AudioContext starts on the first click or key.
// Structure copied from Flip Runner; the sounds and the music are Ink Path's own.
export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.noise = null;
    this.musicOn = true;       // setting (on by default, GDD 10)
    this.musicGain = null;
    this.seq = null;
    this.rolling = 0;          // 0..1, the shaker layer joins while a ball rolls
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
      let seed = 11;
      for (let i = 0; i < len; i++) { seed = (seed * 16807) % 2147483647; d[i] = seed / 1073741823.5 - 1; }
      // Two continuous layers driven every frame: pen scratch and roll rumble.
      this.scratch = this.loop('bandpass', 2600, 1.2);
      this.rumble = this.loop('lowpass', 220, 0.8);
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

  // k in 0..1 (pen speed / ball speed while touching).
  setLayer(layer, k) {
    if (!this.ctx || !layer) return;
    const t = this.ctx.currentTime;
    layer.g.gain.setTargetAtTime(Math.min(1, k) * (layer === this.scratch ? 0.22 : 0.35), t, 0.03);
    layer.f.frequency.setTargetAtTime(layer.base * (0.7 + Math.min(1, k) * 0.8), t, 0.05);
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
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
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

  play(name, opt = {}) {
    if (!this.ctx || !this.enabled) return;
    const k = opt.k ?? 0.5;
    switch (name) {
      case 'click': this.tone('square', 900, 700, 0.05, 0.07); break;
      case 'pip': this.tone('sine', 1760, 1760, 0.07, 0.18); this.tone('sine', 1318, 1318, 0.1, 0.16, 0.07); break;
      case 'dry': for (let i = 0; i < 4; i++) this.burst(0.03, 0.18, 1800 + i * 300, 2, i * 0.045); break;
      case 'tk': this.tone('square', 1200, 600, 0.03, 0.08); this.burst(0.02, 0.1, 3000, 2); break;
      case 'set': this.tone('sine', 220, 90, 0.12, 0.3); this.tone('sine', 2093, 2637, 0.12, 0.04, 0.03); break;
      case 'clack': this.burst(0.05, 0.4, 900, 1.5); this.tone('triangle', 260, 140, 0.06, 0.2); break;
      case 'pat': this.burst(0.06, 0.12 + k * 0.25, 500 + k * 400, 1); break;
      case 'thud': this.tone('triangle', 120 + k * 60, 60, 0.1, 0.2 + k * 0.2); this.burst(0.06, 0.2, 400); break;
      case 'lip': this.tone('sine', 700, 900, 0.04, 0.08); break;
      case 'plop': this.tone('sine', 300, 900, 0.09, 0.3); this.tone('sine', 900, 500, 0.08, 0.15, 0.08); break;
      case 'swish': this.burst(0.25, 0.25, 5000, 0.6, 0, 'highpass'); break;
      case 'cheer':
        [523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, 0.22, 0.14, 0.1 + i * 0.09));
        for (let i = 0; i < 10; i++) this.burst(0.04, 0.22, 1500 + (i % 3) * 400, 1.5, 0.15 + i * 0.07 + (i % 2) * 0.02);
        break;
      case 'bwomp': this.tone('sawtooth', 220, 110, 0.18, 0.1); this.tone('sawtooth', 165, 70, 0.3, 0.1, 0.16); break;
      case 'warble': for (let i = 0; i < 6; i++) this.tone('sine', 500 + (i % 2) * 120, 500 + (i % 2) * 120, 0.06, 0.12, i * 0.06); break;
      case 'glug': [330, 392, 494].forEach((f, i) => this.tone('sine', f * 0.8, f, 0.07, 0.16, i * 0.06)); break;
      case 'star': { const f = [988, 1319, 1568][Math.min(2, opt.i || 0)]; this.tone('sine', f, f, 0.22, 0.25); this.tone('triangle', 140, 70, 0.1, 0.3); break; }
      case 'count': this.tone('square', 1500 + k * 600, 1500 + k * 600, 0.02, 0.03); break;
    }
  }

  // ---- Music: a short marimba loop, 96 BPM, 8 bars (GDD 10) --------------------

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
    const s16 = 60 / 96 / 4;
    while (this.seq && this.seq.next < this.ctx.currentTime + 0.12) {
      this.musicStep(this.seq.step, this.seq.next);
      this.seq.next += s16;
      this.seq.step = (this.seq.step + 1) % 128;
    }
  }

  marimba(f, t, vol) {
    const out = this.musicGain;
    this.tone('sine', f, f, 0.35, vol, 0, t, out);
    this.tone('sine', f * 4, f * 4, 0.05, vol * 0.25, 0, t, out);
  }

  musicStep(i, t) {
    const out = this.musicGain;
    const bar = Math.floor(i / 16), k = i % 16;
    // C  Am  F  G  C  Em  F  G
    const roots = [261.63, 220, 174.61, 196, 261.63, 164.81, 174.61, 196];
    const minor = [0, 1, 0, 0, 0, 1, 0, 0];
    const r = roots[bar], third = minor[bar] ? 1.189 : 1.26;
    const chord = [1, third, 1.498, 2];
    const pat = [0, -1, 2, -1, 1, -1, 3, 2, -1, 1, -1, 2, 0, -1, 3, -1];
    if (pat[k] >= 0) this.marimba(r * chord[pat[k]] * (bar % 2 && k > 11 ? 2 : 1), t, 0.11);
    if (k === 0 || k === 10) this.tone('triangle', r / 2, r / 2, 0.4, 0.13, 0, t, out);   // soft bass
    if (k === 4 || k === 12) this.burst(0.05, 0.05, 2500, 1, 0, 'bandpass', t, out);      // light tick
    if (this.rolling > 0.1 && k % 2 === 1) this.burst(0.03, 0.06 * Math.min(1, this.rolling), 7000, 0.8, 0, 'highpass', t, out); // shaker
  }
}
