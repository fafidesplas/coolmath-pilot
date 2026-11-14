// Small synthesized sound effects (GDD 10). The AudioContext is created on the first
// click or key press.
let ac = null, master = null;
export const audio = { enabled: true };

export function unlockAudio() {
  try {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain();
      master.gain.value = 0.45;
      master.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
  } catch { ac = null; }
}

function tone(freq, dur, { type = 'sine', vol = 0.2, at = 0, slide = 0, attack = 0.005 } = {}) {
  if (!ac || !audio.enabled) return;
  const t0 = ac.currentTime + at;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

function noise(dur, { vol = 0.2, at = 0, freq = 800 } = {}) {
  if (!ac || !audio.enabled) return;
  const t0 = ac.currentTime + at;
  const n = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = buf; f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t0);
}

export const sfx = {
  click(curved) { tone(curved ? 880 : 620, 0.06, { type: 'square', vol: 0.08 }); tone(curved ? 1320 : 930, 0.04, { type: 'triangle', vol: 0.06, at: 0.02 }); },
  pop() { tone(520, 0.08, { type: 'triangle', vol: 0.12, slide: 1.6 }); },
  whistle() { tone(740, 0.22, { type: 'triangle', vol: 0.12, attack: 0.03 }); tone(740, 0.3, { type: 'triangle', vol: 0.12, at: 0.28, attack: 0.03 }); tone(1110, 0.3, { type: 'sine', vol: 0.05, at: 0.28 }); },
  chug() { noise(0.06, { vol: 0.08, freq: 500 }); },
  ding(n) { const f = 880 * Math.pow(2, (n * 4) / 12); tone(f, 0.5, { vol: 0.16 }); tone(f * 2, 0.3, { vol: 0.05 }); },
  crash() { noise(0.35, { vol: 0.3, freq: 1200 }); tone(320, 0.45, { type: 'sine', vol: 0.18, at: 0.1, slide: 0.4 }); tone(200, 0.25, { type: 'square', vol: 0.05, at: 0.12, slide: 2.5 }); },
  rewind() { tone(300, 0.3, { type: 'sawtooth', vol: 0.04, slide: 3 }); },
  star(n) { const f = 660 * Math.pow(2, (n * 5) / 12); tone(f, 0.25, { type: 'triangle', vol: 0.14 }); tone(f * 1.5, 0.25, { vol: 0.06, at: 0.06 }); },
  win() { [0, 4, 7, 12].forEach((s, i) => tone(523 * Math.pow(2, s / 12), 0.3, { type: 'triangle', vol: 0.12, at: i * 0.08 })); },
};
