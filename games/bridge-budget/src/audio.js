// Synthesized sound (GDD 10). The AudioContext starts on the first click or key.
// Structure and sequencer copied from Ink Path; the sounds and the music are Bridge Budget's own.
export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.noise = null;
    this.musicOn = true;       // setting (on by default, GDD 10)
    this.musicGain = null;
    this.seq = null;
    this.tension = 0;          // 0..1 highest stress ratio during a test: the snare roll follows it
    this.testing = false;
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
      let seed = 7;
      for (let i = 0; i < len; i++) { seed = (seed * 16807) % 2147483647; d[i] = seed / 1073741823.5 - 1; }
      this.engine = this.hum();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.musicOn && !this.seq) this.startMusic();
  }

  // Engine hum: a low sawtooth through a lowpass, pitch follows speed.
  hum() {
    const o = this.ctx.createOscillator(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = 50;
    f.type = 'lowpass'; f.frequency.value = 300;
    g.gain.value = 0;
    o.connect(f).connect(g).connect(this.master);
    o.start();
    return { o, g };
  }

  // k: 0 = off, else speed 0..1
  setEngine(on, k = 0) {
    if (!this.ctx || !this.engine) return;
    const t = this.ctx.currentTime;
    this.engine.g.gain.setTargetAtTime(on ? 0.06 + k * 0.05 : 0, t, 0.05);
    this.engine.o.frequency.setTargetAtTime(45 + k * 60, t, 0.08);
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
      case 'place:wood': this.tone('triangle', 520 - k * 200, 300 - k * 100, 0.08, 0.3); this.burst(0.03, 0.2, 1800, 2); break;
      case 'place:steel': this.tone('square', 1400, 1350, 0.06, 0.08); this.tone('sine', 2600, 2500, 0.12, 0.08); this.burst(0.03, 0.2, 3500, 3); break;
      case 'place:cable': this.tone('sawtooth', 300, 900, 0.12, 0.08); break;
      case 'place:road': this.tone('sine', 160, 80, 0.12, 0.35); this.burst(0.05, 0.15, 600, 1); break;
      case 'erase': this.tone('sine', 700, 1200, 0.06, 0.15); break;
      case 'clear': this.burst(0.3, 0.25, 2500, 0.6, 0, 'highpass'); break;
      case 'undo': this.burst(0.12, 0.15, 1500, 0.8); this.tone('sine', 900, 500, 0.1, 0.08); break;
      case 'invalid': this.tone('sine', 220, 160, 0.12, 0.2); break;
      case 'honk': this.tone('square', 392, 392, 0.12, 0.1); this.tone('square', 494, 494, 0.12, 0.08); break;
      case 'honk2': this.play('honk'); this.tone('square', 392, 392, 0.12, 0.1, 0.18); this.tone('square', 494, 494, 0.12, 0.08, 0.18); break;
      case 'creak': this.burst(0.09 + k * 0.08, 0.04 + k * 0.1, opt.steel ? 300 : 700 + k * 300, 8); break;
      case 'snap:wood': this.burst(0.12, 0.6, 2000, 1); this.tone('triangle', 300, 90, 0.12, 0.3); break;
      case 'snap:steel': this.tone('square', 900, 400, 0.15, 0.15); this.tone('sine', 2800, 2800, 0.4, 0.1, 0.02); break;
      case 'snap:cable': this.tone('sawtooth', 1200, 100, 0.2, 0.12); break;
      case 'snap:road': this.burst(0.2, 0.6, 400, 0.8); this.tone('sine', 120, 50, 0.2, 0.4); break;
      case 'splash': this.burst(0.7, 0.6, 900, 0.5, 0, 'lowpass'); this.burst(0.4, 0.3, 3000, 0.7, 0.1); break;
      case 'crash': this.tone('sine', 90, 40, 0.3, 0.5); this.burst(0.4, 0.4, 500, 0.6); break;
      case 'pass':
        this.tone('square', 392, 392, 0.18, 0.1); this.tone('square', 523, 523, 0.3, 0.1, 0.2);
        for (let i = 0; i < 14; i++) this.burst(0.05, 0.18, 1400 + (i % 3) * 500, 1.5, 0.3 + i * 0.06);
        break;
      case 'phew': this.tone('sine', 1400, 700, 0.5, 0.12); break;
      case 'star': { const f = [988, 1319, 1568][Math.min(2, opt.i || 0)]; this.tone('sine', f, f, 0.22, 0.25); this.tone('triangle', 140, 70, 0.1, 0.3); break; }
      case 'hat': this.tone('triangle', 200, 120, 0.08, 0.4); this.tone('sine', 1760, 1760, 0.4, 0.15, 0.1); break;
      case 'count': this.tone('square', 1500 + k * 600, 1500 + k * 600, 0.02, 0.03); break;
      case 'fanfare': [523, 659, 784, 1047].forEach((f, i) => { this.tone('sawtooth', f, f, 0.18, 0.06, i * 0.12, 0, this.musicGain || this.master); }); break;
      case 'wahwah': this.tone('sawtooth', 300, 260, 0.35, 0.08); this.tone('sawtooth', 250, 180, 0.6, 0.08, 0.35); break;
      case 'stamp': this.tone('sine', 110, 50, 0.15, 0.5); this.burst(0.05, 0.3, 800); break;
    }
  }

  // ---- Music: a toy-workshop loop, 100 BPM, 8 bars (GDD 10) ----------------------

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
    const s16 = 60 / 100 / 4;
    while (this.seq && this.seq.next < this.ctx.currentTime + 0.12) {
      this.musicStep(this.seq.step, this.seq.next);
      this.seq.next += s16;
      this.seq.step = (this.seq.step + 1) % 128;
    }
  }

  pluck(f, t, vol) {
    const out = this.musicGain;
    this.tone('triangle', f, f, 0.25, vol, 0, t, out);
    this.tone('sine', f * 3, f * 3, 0.04, vol * 0.3, 0, t, out);
  }

  musicStep(i, t) {
    const out = this.musicGain;
    const bar = Math.floor(i / 16), k = i % 16;
    // F  Dm  Bb  C  F  Am  Bb  C
    const roots = [174.61, 146.83, 233.08, 261.63, 174.61, 220, 233.08, 261.63];
    const minor = [0, 1, 0, 0, 0, 1, 0, 0];
    const r = roots[bar] * (bar === 2 || bar === 3 || bar >= 6 ? 0.5 : 1) * 2, third = minor[bar] ? 1.189 : 1.26;
    const chord = [1, third, 1.498, 2];
    const pat = [0, -1, 2, 1, -1, 2, 3, -1, 0, -1, 2, -1, 1, 3, -1, 2];
    if (pat[k] >= 0) this.pluck(r * chord[pat[k]], t, 0.09);
    if (k === 0 || k === 8) this.tone('sine', 120, 45, 0.12, 0.3, 0, t, out);                 // soft kick
    if (k % 4 === 2) this.burst(0.03, 0.04, 7000, 0.8, 0, 'highpass', t, out);                 // shaker
    if (k === 0 || k === 7 || k === 10) this.tone('triangle', r / 4, r / 4, 0.3, 0.12, 0, t, out);   // bass
    // test mode: a snare roll whose volume follows the highest stress
    if (this.testing && this.tension > 0.3) this.burst(0.04, 0.03 + 0.12 * Math.min(1, (this.tension - 0.3) / 0.7), 1800, 0.7, 0, 'bandpass', t, out);
  }
}
