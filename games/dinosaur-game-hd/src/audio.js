// Synthesized sound effects (GDD 10). The AudioContext is created on the
// first key press or click (STANDARDS).
let ac = null, on = true, noiseBuf = null, scrape = null;

export function unlock() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
  }
  if (ac.state === 'suspended') ac.resume();
}

export function setEnabled(v) { on = v; if (!on) slide(false); }

function tone(type, f0, f1, dur, vol, at = 0) {
  if (!on || !ac) return;
  const t = ac.currentTime + at;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(ac.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noiseBuffer() {
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate / 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function noise(dur, vol, freq, at = 0) {
  if (!on || !ac) return;
  noiseBuffer();
  const t = ac.currentTime + at;
  const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = noiseBuf;
  f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(ac.destination);
  src.start(t);
  src.stop(t + dur + 0.02);
}

export const jump = () => tone('square', 380, 760, 0.09, 0.05);
export const duck = () => noise(0.09, 0.15, 1800);
// One whole tone higher per step of an egg streak (0–8).
export const egg = step => tone('square', 1046 * 2 ** (step / 6), 1046 * 2 ** (step / 6) * 1.5, 0.06, 0.04);
export const milestone = () => { tone('square', 784, 784, 0.07, 0.04); tone('square', 1046, 1046, 0.1, 0.04, 0.08); };
export const crash = () => { tone('sine', 160, 45, 0.25, 0.3); noise(0.12, 0.2, 400); tone('triangle', 320, 180, 0.3, 0.07, 0.05); };
export const night = () => { tone('sine', 330, 330, 0.6, 0.06); tone('sine', 494, 494, 0.7, 0.04, 0.15); };
export const click = () => tone('square', 1200, 900, 0.03, 0.04);

// A quiet sandy scrape that loops while the runner slides.
export function slide(sliding) {
  if (sliding && !scrape && on && ac) {
    const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = noiseBuffer(); src.loop = true;
    f.type = 'lowpass'; f.frequency.value = 700;
    g.gain.setValueAtTime(0.001, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.05, ac.currentTime + 0.05);
    src.connect(f).connect(g).connect(ac.destination);
    src.start();
    scrape = { src, g };
  } else if (!sliding && scrape) {
    scrape.g.gain.setTargetAtTime(0.0001, ac.currentTime, 0.03);
    scrape.src.stop(ac.currentTime + 0.15);
    scrape = null;
  }
}
// Hatching: a dry click per crack, then a 4-note jingle as the runner pops out.
export const crack = () => { noise(0.05, 0.25, 2600); tone('square', 900, 600, 0.04, 0.03); };
export const hatch = () => [523, 659, 784, 1046].forEach((f, i) => tone('square', f, f, i === 3 ? 0.22 : 0.09, 0.045, i * 0.09));
