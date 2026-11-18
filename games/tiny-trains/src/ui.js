// Shell screens and HUD (GDD 8), drawn on the canvas in 1280×720 design units.
// Buttons register a hit box every frame; game.js maps their ids to actions.
import { INK, CREAM, PANEL, GREEN, TRAIN_COLORS, WOOD, WOOD_LIGHT, GRASS, CRASH_TEXT, mix } from './config.js';
import { roundRect, star, drawTrain, GOLD } from './render.js';
import { WORLDS, levelPos } from '../levels/index.js';

export const FONT = '"Trebuchet MS", "Segoe UI", "Helvetica Neue", Arial, sans-serif';
export const buttons = [];

export function resetButtons() { buttons.length = 0; }
export function hitButton(x, y) {
  for (let i = buttons.length - 1; i >= 0; i--) {
    const b = buttons[i];
    if (!b.disabled && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.id;
  }
  return null;
}

export function text(ctx, s, x, y, size, color = INK, align = 'center', weight = 'bold') {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

function outlinedText(ctx, s, x, y, size, fill, lw = 8) {
  ctx.font = `bold ${size}px ${FONT}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = lw;
  ctx.strokeText(s, x, y);
  ctx.fillStyle = fill; ctx.fillText(s, x, y);
}

export function button(ctx, G, id, x, y, w, h, label, o = {}) {
  buttons.push({ id, x, y, w, h, disabled: !!o.disabled });
  const pressed = G.pressId === id;
  const dy = pressed ? 4 : 0;
  const col = o.disabled ? mix(o.color || CREAM, CREAM, 0.6) : (o.color || '#FFFFFF');
  ctx.fillStyle = 'rgba(46,36,64,0.85)';
  roundRect(ctx, x, y + 5, w, h, o.r ?? 16); ctx.fill();
  ctx.fillStyle = col; ctx.strokeStyle = o.disabled ? mix(INK, CREAM, 0.5) : INK; ctx.lineWidth = 4;
  roundRect(ctx, x, y + dy, w, h, o.r ?? 16); ctx.fill(); ctx.stroke();
  if (o.icon) o.icon(ctx, x + w / 2, y + h / 2 + dy, o.disabled);
  else text(ctx, label, x + w / 2, y + h / 2 + dy + 1, o.size || 26, o.disabled ? mix(INK, CREAM, 0.5) : (o.textColor || INK));
}

// ---- Icons --------------------------------------------------------------------------
const iconPause = (ctx, x, y) => { ctx.fillStyle = INK; roundRect(ctx, x - 10, y - 12, 7, 24, 2); ctx.fill(); roundRect(ctx, x + 3, y - 12, 7, 24, 2); ctx.fill(); };
const iconPlay = (s, col = '#FFFFFF') => (ctx, x, y) => {
  ctx.fillStyle = col; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x - s * 0.5, y - s * 0.6); ctx.lineTo(x + s * 0.6, y); ctx.lineTo(x - s * 0.5, y + s * 0.6); ctx.closePath(); ctx.fill(); ctx.stroke();
};
const iconFast = on => (ctx, x, y) => {
  ctx.fillStyle = on ? '#FFFFFF' : INK;
  for (const ox of [-11, 5]) { ctx.beginPath(); ctx.moveTo(x + ox - 6, y - 11); ctx.lineTo(x + ox + 8, y); ctx.lineTo(x + ox - 6, y + 11); ctx.closePath(); ctx.fill(); }
};
const iconSound = on => (ctx, x, y) => {
  ctx.fillStyle = INK; ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - 14, y - 6); ctx.lineTo(x - 7, y - 6); ctx.lineTo(x + 2, y - 14); ctx.lineTo(x + 2, y + 14); ctx.lineTo(x - 7, y + 6); ctx.lineTo(x - 14, y + 6); ctx.closePath(); ctx.fill();
  if (on) { ctx.beginPath(); ctx.arc(x + 4, y, 8, -0.8, 0.8); ctx.stroke(); ctx.beginPath(); ctx.arc(x + 4, y, 14, -0.8, 0.8); ctx.stroke(); }
  else { ctx.beginPath(); ctx.moveTo(x + 8, y - 7); ctx.lineTo(x + 18, y + 7); ctx.moveTo(x + 18, y - 7); ctx.lineTo(x + 8, y + 7); ctx.stroke(); }
};
const iconBack = (ctx, x, y) => {
  ctx.strokeStyle = INK; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x + 6, y - 12); ctx.lineTo(x - 6, y); ctx.lineTo(x + 6, y + 12); ctx.stroke();
};
function padlock(ctx, x, y, s) {
  ctx.strokeStyle = INK; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(x, y - s * 0.2, s * 0.32, Math.PI, 0); ctx.stroke();
  ctx.fillStyle = mix(INK, CREAM, 0.35);
  roundRect(ctx, x - s * 0.45, y - s * 0.2, s * 0.9, s * 0.7, 5); ctx.fill(); ctx.stroke();
}

// ---- Title --------------------------------------------------------------------------
function scenery(ctx) {
  ctx.fillStyle = CREAM; ctx.fillRect(0, 0, 1280, 720);
  ctx.fillStyle = GRASS;
  ctx.beginPath(); ctx.ellipse(250, 760, 520, 170, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(1050, 780, 560, 190, 0, 0, Math.PI * 2); ctx.fill();
}

export function drawTitle(ctx, G) {
  scenery(ctx);
  // Oval wooden track with a train looping round
  const cx = 640, cy = 342, rx = 360, ry = 66;
  ctx.lineWidth = 46; ctx.strokeStyle = INK;
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 40; ctx.strokeStyle = WOOD_LIGHT; ctx.stroke();
  ctx.lineWidth = 3; ctx.strokeStyle = WOOD;
  ctx.beginPath(); ctx.ellipse(cx, cy, rx - 9, ry - 9, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(cx, cy, rx + 9, ry + 9, 0, 0, Math.PI * 2); ctx.stroke();
  const order = ['red', 'blue', 'yellow'];
  order.forEach((col, i) => {
    const a = G.time * 0.7 + i * 0.5;
    const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
    const h = Math.atan2(Math.cos(a) * ry, -Math.sin(a) * rx);
    drawTrain(ctx, x, y, h, col, 90, { bob: Math.sin(G.time * 12 + i) * 1.5 });
  });
  // Logo
  const letters = 'TINY TRAINS';
  const cols = [TRAIN_COLORS.red, TRAIN_COLORS.blue, TRAIN_COLORS.yellow, TRAIN_COLORS.green];
  ctx.font = `bold 108px ${FONT}`;
  const total = ctx.measureText(letters).width + 4 * (letters.length - 1);
  let x = 640 - total / 2;
  for (let i = 0, ci = 0; i < letters.length; i++) {
    const ch = letters[i];
    const w = (ctx.font = `bold 108px ${FONT}`, ctx.measureText(ch).width);
    if (ch !== ' ') {
      const bob = Math.sin(G.time * 3 + i * 0.6) * 4;
      outlinedText(ctx, ch, x + w / 2, 150 + bob, 108, cols[ci++ % 4], 12);
    }
    x += w + 4;
  }
  text(ctx, 'Flip the switches. Get every train home.', 640, 232, 26, mix(INK, CREAM, 0.25), 'center', 'bold');
  button(ctx, G, 'play', 520, 450, 240, 88, 'PLAY', { color: GREEN, size: 40, textColor: '#FFFFFF', r: 24 });
  button(ctx, G, 'levels', 540, 568, 200, 64, 'Levels', { size: 28 });
  button(ctx, G, 'sound', 1196, 20, 64, 64, '', { icon: iconSound(G.save.settings.sfx) });
  text(ctx, 'Prototype', 1240, 700, 16, mix(INK, CREAM, 0.5), 'right', 'normal');
}

// ---- Level select ------------------------------------------------------------------
export function drawLevels(ctx, G) {
  scenery(ctx);
  button(ctx, G, 'back', 20, 20, 64, 64, '', { icon: iconBack });
  button(ctx, G, 'sound', 1196, 20, 64, 64, '', { icon: iconSound(G.save.settings.sfx) });
  const world = WORLDS[0];
  outlinedText(ctx, `World 1 — ${world.name}`, 640, 120, 56, '#FFFFFF', 10);
  // One row up to 6 levels, then two rows (the top row takes the extra one).
  const n = world.levels.length, rows = n > 6 ? 2 : 1, perRow = Math.ceil(n / rows);
  const k = rows > 1 ? 0.8 : 1, gap = 190;
  world.levels.forEach((lv, i) => {
    const row = Math.floor(i / perRow), col = i % perRow, inRow = Math.min(perRow, n - row * perRow);
    const x = 640 - ((inRow - 1) * gap) / 2 + col * gap, y = rows > 1 ? 255 + row * 205 : 330;
    const rec = G.save.levels[lv.id];
    const open = G.isOpen(i);
    const next = i === G.nextIndex();
    const bob = next ? Math.abs(Math.sin(G.time * 4)) * -10 : 0;
    const R = 64 * k;
    button(ctx, G, `lvl:${i}`, x - R, y - R + bob, R * 2, R * 2, '', {
      r: R, color: open ? (rec ? '#FFFFFF' : TRAIN_COLORS.yellow) : mix(CREAM, INK, 0.12), disabled: !open,
      icon: (c, bx, by) => {
        if (!open) padlock(c, bx, by, 48);
        else outlinedText(c, String(i + 1), bx, by + 2, 56 * k, rec ? INK : '#FFFFFF', open && !rec ? 8 : 0.01);
      },
    });
    text(ctx, lv.name, x, y + R + 30 * k, 22, open ? INK : mix(INK, CREAM, 0.5));
    for (let s = 0; s < 3; s++) star(ctx, x - 36 * k + s * 36 * k, y + R + 66 * k, 15 * k, rec && rec.stars > s ? TRAIN_COLORS.yellow : mix(CREAM, INK, 0.1), INK, 3);
  });
  const total = world.levels.reduce((a, l) => a + (G.save.levels[l.id]?.stars || 0), 0);
  const ty = rows > 1 ? 636 : 560;
  star(ctx, 600, ty, 20, TRAIN_COLORS.yellow, INK, 3);
  text(ctx, `${total} / ${n * 3}`, 660, ty + 2, 30);
  text(ctx, 'More worlds coming soon', 640, rows > 1 ? 690 : 640, 20, mix(INK, CREAM, 0.45), 'center', 'normal');
}

// ---- Playing HUD -------------------------------------------------------------------
export function drawHUD(ctx, G) {
  ctx.fillStyle = PANEL; ctx.fillRect(0, 0, 1280, 80);
  ctx.fillStyle = INK; ctx.fillRect(0, 78, 1280, 4);
  button(ctx, G, 'pause', 16, 10, 56, 56, '', { icon: iconPause });
  const pos = levelPos(G.level);
  ctx.fillStyle = INK; roundRect(ctx, 88, 20, 64, 38, 19); ctx.fill();
  text(ctx, pos.label, 120, 40, 22, '#FFFFFF');
  text(ctx, G.level.name, 166, 40, 30, INK, 'left');
  const flips = G.flips();
  text(ctx, `Flips ${flips} · Par ${G.level.par}`, 760, 40, 26, flips > G.level.par ? mix(TRAIN_COLORS.red, INK, 0.2) : INK);
  text(ctx, `Run ${G.runs + (G.phase === 'plan' ? 1 : 0)}`, 950, 40, 22, mix(INK, CREAM, 0.4), 'center', 'bold');
  if (G.level.ticket) {   // ticket slot: empty outline until a train collects it this run
    star(ctx, 1040, 40, 18, G.ticketGot ? GOLD : mix(CREAM, INK, 0.1), G.ticketGot ? INK : mix(INK, CREAM, 0.45), 3);
  }
  button(ctx, G, 'reset', 1100, 10, 164, 56, 'Reset', { size: 24, disabled: G.phase !== 'plan' || flips === 0 });

  // Go / Stop and fast-forward
  const running = G.phase === 'run';
  button(ctx, G, 'go', 1060, 642, 200, 66, running ? 'STOP' : 'GO', {
    color: running ? TRAIN_COLORS.red : GREEN, textColor: '#FFFFFF', size: 34, r: 22,
    disabled: !(G.phase === 'plan' || running),
  });
  if (running) button(ctx, G, 'fast', 976, 642, 66, 66, '', { color: G.fast ? TRAIN_COLORS.blue : '#FFFFFF', icon: iconFast(G.fast) });

  // Hint button (GDD 3.13): slides up beside GO once it is earned.
  const hint = G.hintReady();
  if (hint) {
    const k = ease(G.hintVisT / 0.3);
    const wob = G.hintUsed ? 0 : Math.sin(G.time * 5) * 2 * Math.max(0, Math.sin(G.time * 1.3));
    button(ctx, G, 'hint', 884, 642 + (1 - k) * 90 + wob, 160, 66, '', { color: TRAIN_COLORS.yellow, r: 22, icon: iconHint });
  }
  // Bottom line: the hint message for a few seconds after a hint, the loop notice while a
  // looping run fast-forwards, otherwise the level tip.
  const tipW = hint ? 820 : 1000;
  if (G.phase === 'plan' && G.hintMsg && G.hintT < 5) {
    const a = Math.min(1, G.hintT / 0.2);
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = TRAIN_COLORS.yellow; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    roundRect(ctx, 30, 652, Math.min(tipW + 10, 700), 48, 24); ctx.fill(); ctx.stroke();
    iconBulb(ctx, 58, 676, 0.8);
    lineText(ctx, G.hintMsg, 82, 677, 22, INK, Math.min(tipW, 640));
    ctx.restore();
  } else if (running && G.loopAt >= 0 && G.pos >= G.loopAt) {
    lineText(ctx, 'Going round in circles… skipping ahead', 40, 676, 22, mix(INK, CREAM, 0.2), tipW);
  } else if (G.level.tip && G.phase === 'plan') {
    lineText(ctx, G.level.tip, 40, 676, 22, mix(INK, CREAM, 0.2), tipW);
  }
}

function lineText(ctx, s, x, y, size, color, maxW) {
  ctx.font = `bold ${size}px ${FONT}`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
  ctx.fillText(s, x, y, maxW);
}

// Light bulb: round glass, two filament lines, a ribbed base.
function iconBulb(ctx, x, y, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = INK; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, -5, 12, Math.PI * 0.8, Math.PI * 2.2); ctx.lineTo(5, 10); ctx.lineTo(-5, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-4, 2); ctx.lineTo(0, -4); ctx.lineTo(4, 2); ctx.stroke();
  ctx.fillStyle = mix(INK, CREAM, 0.35);
  roundRect(ctx, -6, 10, 12, 8, 3); ctx.fill(); ctx.stroke();
  ctx.restore();
}
const iconHint = (ctx, x, y) => {
  iconBulb(ctx, x - 40, y - 2, 1);
  text(ctx, 'Hint', x + 12, y + 1, 28, INK);
  text(ctx, 'H', x + 58, y + 18, 13, mix(INK, CREAM, 0.35));
};

// Tutorial hand (level 1-1): points at the switch, then at Go.
export function drawHand(ctx, x, y, t) {
  const b = Math.sin(t * 6) * 8;
  ctx.save();
  ctx.translate(x + 10, y + 16 + b);
  ctx.rotate(-0.5);
  ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineJoin = 'round';
  roundRect(ctx, -9, -4, 18, 40, 9); ctx.fill(); ctx.stroke();
  roundRect(ctx, -16, 26, 38, 40, 14); ctx.fill(); ctx.stroke();
  ctx.restore();
}

export function drawCrashLabel(ctx, G, x, y, cause, t) {
  const s = Math.min(1, t / 0.15);
  const pop = s < 1 ? 0.6 + s * 0.5 : 1.1 - Math.min(0.1, (t - 0.15) * 0.5);
  const msg = CRASH_TEXT[cause] || 'Crash!';
  ctx.save();
  ctx.translate(Math.max(170, Math.min(1110, x)), Math.max(120, y - 70));
  ctx.scale(pop, pop);
  ctx.font = `bold 30px ${FONT}`;
  const w = ctx.measureText(msg).width + 76;
  ctx.fillStyle = 'rgba(46,36,64,0.3)'; roundRect(ctx, -w / 2 + 4, -28 + 6, w, 56, 28); ctx.fill();
  ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = INK; ctx.lineWidth = 4;
  roundRect(ctx, -w / 2, -28, w, 56, 28); ctx.fill(); ctx.stroke();
  star(ctx, -w / 2 + 30, 0, 17, TRAIN_COLORS.red, INK, 3, t * 2);
  text(ctx, msg, 18, 2, 30, INK);
  ctx.restore();
}

export function drawPause(ctx, G) {
  ctx.fillStyle = 'rgba(46,36,64,0.55)'; ctx.fillRect(0, 0, 1280, 720);
  ctx.fillStyle = CREAM; ctx.strokeStyle = INK; ctx.lineWidth = 5;
  roundRect(ctx, 440, 170, 400, 400, 28); ctx.fill(); ctx.stroke();
  outlinedText(ctx, 'Paused', 640, 230, 52, '#FFFFFF', 10);
  button(ctx, G, 'resume', 520, 290, 240, 66, 'Resume', { color: GREEN, textColor: '#FFFFFF', size: 30 });
  button(ctx, G, 'restart', 520, 376, 240, 60, 'Restart', { size: 26 });
  button(ctx, G, 'menu', 520, 456, 240, 60, 'Levels', { size: 26 });
  button(ctx, G, 'sound', 790, 186, 40, 40, '', { r: 12, icon: iconSound(G.save.settings.sfx) });
}

const ease = t => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

export function drawComplete(ctx, G) {
  const t = G.t, R = G.result;
  ctx.fillStyle = `rgba(46,36,64,${0.5 * ease(t / 0.3)})`; ctx.fillRect(0, 0, 1280, 720);
  const py = 130 + (1 - ease(t / 0.35)) * 600;
  ctx.fillStyle = 'rgba(46,36,64,0.4)'; roundRect(ctx, 356, py + 10, 568, 470, 32); ctx.fill();
  ctx.fillStyle = CREAM; ctx.strokeStyle = INK; ctx.lineWidth = 5;
  roundRect(ctx, 350, py, 580, 470, 32); ctx.fill(); ctx.stroke();
  outlinedText(ctx, 'All aboard!', 640, py + 60, 54, TRAIN_COLORS.yellow, 10);
  const labels = ['Home', 'Ticket', R.hint ? 'Par (hint used)' : 'Par'];
  const earned = [true, R.ticket, R.parStar];
  for (let i = 0; i < 3; i++) {
    const x = 640 + (i - 1) * 140, y = py + 160;
    const at = 0.45 + i * 0.35;
    star(ctx, x, y, 50, mix(CREAM, INK, 0.1), INK, 4);
    if (earned[i] && t > at) {
      const k = Math.min(1, (t - at) / 0.18);
      const sc = k < 1 ? 1.8 - 0.8 * k : 1;
      star(ctx, x, y, 50 * sc, TRAIN_COLORS.yellow, INK, 4);
    }
    text(ctx, labels[i], x, y + 72, 20, earned[i] ? INK : mix(INK, CREAM, 0.5));
  }
  const shown = Math.min(R.flips, Math.floor(Math.max(0, t - 0.4) * 8));
  text(ctx, `Flips ${shown} · Par ${R.par}`, 640, py + 290, 30);
  if (R.first && t > 1.4) {
    ctx.save(); ctx.translate(800, py + 290); ctx.rotate(-0.12);
    ctx.fillStyle = TRAIN_COLORS.red; ctx.strokeStyle = INK; ctx.lineWidth = 3;
    roundRect(ctx, -10, -20, 150, 40, 12); ctx.fill(); ctx.stroke();
    text(ctx, 'Perfect run!', 65, 1, 20, '#FFFFFF');
    ctx.restore();
  }
  text(ctx, `Best: ${'★'.repeat(R.bestStars)}${'☆'.repeat(3 - R.bestStars)}`, 640, py + 336, 22, mix(INK, CREAM, 0.3), 'center', 'bold');
  if (t > 0.35) {
    button(ctx, G, 'menu', 380, py + 382, 150, 62, 'Menu', { size: 26 });
    button(ctx, G, 'retry', 550, py + 382, 150, 62, 'Retry', { size: 26 });
    button(ctx, G, 'next', 720, py + 382, 190, 62, G.hasNext() ? 'Next' : 'Levels', { color: GREEN, textColor: '#FFFFFF', size: 30 });
  }
}
