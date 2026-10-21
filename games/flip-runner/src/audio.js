// Small synthesized sound effects (GDD 10). The AudioContext starts on the first
// click or key press. (Structure copied from Magnet Twins.)
export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.noise = null;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.5 : 0;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      let seed = 11;
      for (let i = 0; i < len; i++) { seed = (seed * 16807) % 2147483647; d[i] = seed / 1073741823.5 - 1; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.master) this.master.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, 0.02);
  }

  tone(type, f0, f1, dur, vol = 0.3, delay = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  burst(dur, vol, freq, q = 1, delay = 0, type = 'bandpass') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = this.noise;
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  play(name, opt = {}) {
    if (!this.ctx || !this.enabled) return;
    switch (name) {
      case 'click': this.tone('square', 900, 700, 0.05, 0.08); break;
      case 'whoop': {
        // pitch steps up for quick consecutive flips
        const k = Math.pow(1.12, Math.min(opt.chain || 0, 5));
        const up = opt.g < 0;
        this.tone('sine', (up ? 300 : 600) * k, (up ? 700 : 260) * k, 0.12, 0.22);
        this.tone('triangle', (up ? 600 : 1200) * k, (up ? 1400 : 520) * k, 0.08, 0.06);
        break;
      }
      case 'land': this.tone('triangle', 150, 80, 0.07, 0.16); this.burst(0.05, 0.12, 500); break;
      case 'step': this.tone('square', 400, 600, 0.05, 0.05); break;
      case 'crunch':
        this.burst(0.22, 0.5, 1200, 0.7);
        this.burst(0.12, 0.3, 300, 1, 0.02);
        this.tone('square', 300, 70, 0.25, 0.12);
        break;
      case 'rebuild': for (let i = 0; i < 4; i++) this.tone('square', 350 + i * 120, 350 + i * 120, 0.035, 0.06, i * 0.04); break;
      case 'star': { const f = [988, 1319, 1568][Math.min(2, opt.i || 0)]; this.tone('sine', f, f, 0.2, 0.25); this.tone('sine', f * 2, f * 2, 0.1, 0.07, 0.04); break; }
      case 'bank': [1568, 2093].forEach((f, i) => this.tone('sine', f, f, 0.12, 0.12, i * 0.06)); break;
      case 'checkpoint': this.tone('sine', 660, 660, 0.12, 0.2); this.tone('sine', 990, 990, 0.2, 0.2, 0.1); break;
      case 'goal': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone('square', f, f, 0.14, 0.09, i * 0.11)); break;
      case 'stamp': this.tone('triangle', 180, 90, 0.15, 0.3); this.burst(0.08, 0.25, 250); break;
      case 'tap': this.tone('sine', 1200, 1200, 0.06, 0.08); break;
    }
  }
}
