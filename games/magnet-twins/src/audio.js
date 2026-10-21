// Small synthesized sound effects (GDD 10). The AudioContext starts on the first
// click or key press.
export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.hums = {};
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
      let seed = 7;
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
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
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
      case 'jump': this.tone('square', 260, 520, 0.12, 0.08); break;
      case 'land': this.tone('triangle', 140, 70, 0.08, 0.18); this.burst(0.06, 0.15, 400); break;
      case 'clank': {
        const p = Math.min(1.6, 0.7 + (opt.speed || 300) / 900);
        this.tone('square', 210 * p, 160 * p, 0.09, 0.1);
        this.tone('triangle', 840 * p, 620 * p, 0.12, 0.08);
        this.burst(0.07, 0.25, 2500, 3);
        break;
      }
      case 'bolt': {
        const f = [880, 1175, 1568][Math.min(2, (opt.n || 1) - 1)];
        this.tone('sine', f, f, 0.18, 0.25);
        this.tone('sine', f * 2, f * 2, 0.1, 0.08, 0.03);
        break;
      }
      case 'doorOpen': this.burst(0.3, 0.12, 900, 0.8, 0, 'lowpass'); break;
      case 'doorShut': this.tone('triangle', 110, 55, 0.18, 0.3); this.burst(0.08, 0.2, 300); break;
      case 'zap': this.tone('sawtooth', 600, 80, 0.3, 0.12); this.burst(0.25, 0.25, 3000, 2); break;
      case 'splash': this.burst(0.4, 0.3, 700, 0.6, 0, 'lowpass'); break;
      case 'rebuild': for (let i = 0; i < 5; i++) this.tone('square', 300 + i * 90, 300 + i * 90, 0.04, 0.06, i * 0.05); break;
      case 'switch': this.tone('triangle', 500, 750, 0.08, 0.15); break;
      case 'checkpoint': this.tone('sine', 660, 660, 0.12, 0.2); this.tone('sine', 990, 990, 0.2, 0.2, 0.1); break;
      case 'exit': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone('square', f, f, 0.14, 0.09, i * 0.11)); break;
      case 'star': this.tone('triangle', 520 + (opt.i || 0) * 180, 1040 + (opt.i || 0) * 360, 0.25, 0.22); this.burst(0.08, 0.2, 200); break;
      case 'powerOn': this.tone('sine', opt.pol === 'plus' ? 220 : 330, opt.pol === 'plus' ? 330 : 495, 0.1, 0.1); break;
    }
  }

  // Continuous hum while a field is on: plus low and slow, minus brighter and faster.
  hum(pol, on) {
    if (!this.ctx) return;
    let h = this.hums[pol];
    if (on && !h) {
      const plus = pol === 'plus';
      const o = this.ctx.createOscillator(), lfo = this.ctx.createOscillator();
      const lg = this.ctx.createGain(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = plus ? 110 : 165;
      lfo.frequency.value = plus ? 5 : 9; lg.gain.value = plus ? 6 : 10;
      lfo.connect(lg).connect(o.frequency);
      f.type = 'lowpass'; f.frequency.value = plus ? 500 : 800;
      g.gain.value = 0.0001;
      g.gain.setTargetAtTime(0.05, this.ctx.currentTime, 0.03);
      o.connect(f).connect(g).connect(this.master);
      o.start(); lfo.start();
      this.hums[pol] = { o, lfo, g };
    } else if (!on && h) {
      h.g.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.03);
      h.o.stop(this.ctx.currentTime + 0.2); h.lfo.stop(this.ctx.currentTime + 0.2);
      delete this.hums[pol];
    }
  }

  stopHums() { this.hum('plus', false); this.hum('minus', false); }
}
