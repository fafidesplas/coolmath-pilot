// The in-room HUD (GDD 8): room name, timeline (from room 3), echo slots, the two
// goals with the running room time, and the Loop / Delete / Restart / Pause buttons.
import { VIEW_W, HUD_H, HZ, COLORS as C, ECHO_ALPHA } from './config.js';
import { rrect, text, rgba, drawStar, drawKeycap } from './render.js';

export const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export const fmtTenths = s => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;

export function iconLoop(ctx, x, y, r, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = Math.max(2, r * 0.28); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x, y, r, -0.2, Math.PI * 1.6); ctx.stroke();
  const a = Math.PI * 1.6, ax = x + Math.cos(a) * r, ay = y + Math.sin(a) * r;
  ctx.beginPath(); ctx.moveTo(ax + r * 0.55, ay - r * 0.05); ctx.lineTo(ax - r * 0.1, ay - r * 0.5); ctx.lineTo(ax - r * 0.05, ay + r * 0.45); ctx.closePath(); ctx.fill();
  ctx.restore();
}

export function iconClock(ctx, x, y, r, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, r * 0.25); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - r * 0.6); ctx.moveTo(x, y); ctx.lineTo(x + r * 0.45, y + r * 0.2); ctx.stroke();
  ctx.restore();
}

export function iconDelete(ctx, x, y, s, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x - s * 0.45, y - s * 0.6); ctx.lineTo(x + s, y - s * 0.6); ctx.lineTo(x + s, y + s * 0.6); ctx.lineTo(x - s * 0.45, y + s * 0.6); ctx.closePath(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - s * 0.05, y - s * 0.28); ctx.lineTo(x + s * 0.55, y + s * 0.28); ctx.moveTo(x + s * 0.55, y - s * 0.28); ctx.lineTo(x - s * 0.05, y + s * 0.28); ctx.stroke();
  ctx.restore();
}

export function iconRestart(ctx, x, y, r, color) {
  ctx.save();
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x, y, r, -0.3, Math.PI * 1.55); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + r + 1, y - r - 1); ctx.lineTo(x + r + 3, y + 2); ctx.lineTo(x + 2, y - 4); ctx.fill();
  ctx.restore();
}

export function drawHud(g) {
  const ctx = g.ctx, sim = g.sim, s = sim.s, lv = sim.lv, t = g.t;
  ctx.fillStyle = C.navy;
  ctx.fillRect(0, 0, VIEW_W, HUD_H);
  ctx.fillStyle = rgba(C.pale, 0.15); ctx.fillRect(0, HUD_H - 2, VIEW_W, 2);

  // Left: room number and name
  const pos = g.roomPos(g.room.id);
  rrect(ctx, 20, 20, 44, 40, 10); ctx.fillStyle = C.cyan; ctx.fill();
  text(ctx, String((pos.world - 1) * 12 + pos.level), 42, 41, 22, C.navy, 'center', 900);
  text(ctx, g.room.name.toUpperCase(), 78, 41, 22, C.pale, 'left', 800);

  // Center: timeline (from room 3) with the loop time
  if (g.showTimeline()) drawTimeline(g, 330, 360);

  // Echo slots
  const shake = g.slotShake > 0 ? Math.sin(t * 60) * 4 * g.slotShake : 0;
  for (let i = 0; i < lv.slots; i++) {
    const x = 718 + i * 32 + shake, y = 40;
    const filled = i < s.count;
    const pop = g.slotPop[i] > 0 ? 1 + g.slotPop[i] * 0.5 : 1;
    ctx.beginPath(); ctx.arc(x, y, 12 * pop, 0, Math.PI * 2);
    if (filled) {
      ctx.globalAlpha = ECHO_ALPHA[i] + 0.15;
      ctx.fillStyle = C.violet; ctx.fill(); ctx.globalAlpha = 1;
      text(ctx, String(i + 1), x, y + 1, 14, C.navy, 'center', 900);
      if (s.echoes[i].broken) {   // crack
        ctx.strokeStyle = C.navy; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x - 4, y - 11); ctx.lineTo(x + 2, y - 3); ctx.lineTo(x - 3, y + 3); ctx.lineTo(x + 3, y + 11); ctx.stroke();
      }
    } else {
      ctx.lineWidth = 2; ctx.strokeStyle = rgba(C.violet, 0.7); ctx.stroke();
    }
  }
  if (s.count >= lv.slots && g.phase === 'play') {
    // Slots full: show how to free one.
    drawKeycap(ctx, 718 + 16 * lv.slots - 34, 72, '⌫', 0.9 + Math.sin(t * 6) * 0.1);
    drawKeycap(ctx, 718 + 16 * lv.slots + 4, 72, 'R', 0.9 + Math.sin(t * 6) * 0.1);
  }

  // Goals: ⟳ ≤ par and ⏱ par beside the running room time
  const gx = 862;
  const over = s.count > lv.par.echoes;
  iconLoop(ctx, gx + 8, 26, 7, over ? rgba(C.pale, 0.35) : C.violet);
  text(ctx, `≤ ${lv.par.echoes}`, gx + 22, 27, 16, over ? rgba(C.pale, 0.35) : C.pale, 'left', 800);
  const rt = sim.roomTime, missed = rt > lv.par.time;
  iconClock(ctx, gx + 8, 54, 7, missed ? rgba(C.pale, 0.35) : C.yellow);
  text(ctx, fmtTime(lv.par.time), gx + 22, 55, 16, missed ? rgba(C.pale, 0.35) : C.pale, 'left', 800);
  text(ctx, fmtTenths(rt), gx + 66, 55, 14, rgba(C.pale, 0.7), 'left', 700);

  // Buttons: Loop (E), Delete (⌫), Restart, Pause
  if (g.screen !== 'playing' || g.paused) return;
  const live = g.phase === 'play';
  g.addButton({ key: 'hud:loop', hud: true, x: 960, y: 12, w: 56, h: 56, r: 14, disabled: !live || !!g.replay,
    action: () => g.input.press(8),
    draw: (c, b) => { iconLoop(c, b.x + 28, b.y + 23, 10, C.cyan); text(c, 'E', b.x + 28, b.y + 46, 12, C.pale, 'center', 900); } });
  g.addButton({ key: 'hud:delete', hud: true, x: 1040, y: 12, w: 56, h: 56, r: 14, disabled: !live || !!g.replay,
    action: () => g.input.press(16),
    draw: (c, b) => { iconDelete(c, b.x + 28, b.y + 23, 11, C.violet); text(c, 'DEL', b.x + 28, b.y + 46, 11, C.pale, 'center', 900); } });
  g.addButton({ key: 'hud:restart', hud: true, x: 1120, y: 12, w: 56, h: 56, r: 14, action: () => g.restart(),
    draw: (c, b) => { iconRestart(c, b.x + 28, b.y + 24, 10, C.pale); text(c, 'R', b.x + 28, b.y + 46, 12, C.pale, 'center', 900); } });
  g.addButton({ key: 'hud:pause', hud: true, x: 1200, y: 12, w: 56, h: 56, r: 14, action: () => g.pause(true),
    draw: (c, b) => { c.fillStyle = C.pale; c.fillRect(b.x + 20, b.y + 14, 6, 20); c.fillRect(b.x + 31, b.y + 14, 6, 20); text(c, 'P', b.x + 28, b.y + 46, 12, C.pale, 'center', 900); } });
}

// Bar from 0 to the loop length with a playhead; one lane per echo (GDD 3.6).
function drawTimeline(g, x, w) {
  const ctx = g.ctx, sim = g.sim, s = sim.s, L = sim.lv.loopSteps, fc = g.forecast;
  const clock = g.phase === 'rewind' ? 0 : s.clock;
  text(ctx, `${(clock / HZ).toFixed(1)} / ${(L / HZ).toFixed(1)}`, x + w / 2, 14, 13, C.pale, 'center', 800);
  const by = 26;
  ctx.fillStyle = rgba(C.pale, 0.15); ctx.fillRect(x, by, w, 4);
  ctx.fillStyle = C.cyan; ctx.fillRect(x, by, w * clock / L, 4);
  for (let sec = 1; sec < L / HZ; sec++) { ctx.fillStyle = rgba(C.pale, 0.35); ctx.fillRect(x + w * sec * HZ / L - 0.5, by - 2, 1, 8); }
  for (let i = 0; i < s.count; i++) {
    const ly = 38 + i * 9, tape = sim.tapes[i];
    const end = Math.min(tape.len, L) / L * w;
    ctx.globalAlpha = ECHO_ALPHA[i];
    ctx.fillStyle = C.violet; ctx.fillRect(x, ly, end, 3);
    ctx.fillStyle = rgba(C.violet, 0.6);
    for (let px = end + 2; px < w; px += 6) ctx.fillRect(x + px, ly + 0.5, 2, 2);
    // filled blocks while it holds a plate
    if (fc && i < fc.count) {
      const hold = fc.paths[i].hold;
      ctx.fillStyle = C.yellow;
      let a = -1;
      for (let c = 0; c <= L; c++) {
        const h = c < L && hold[c];
        if (h && a < 0) a = c;
        if (!h && a >= 0) { ctx.fillRect(x + a / L * w, ly - 2, Math.max(2, (c - a) / L * w), 7); a = -1; }
      }
    }
    ctx.globalAlpha = 1;
    const e = s.echoes[i];
    if (e.broken && e.brokeAt >= 0) text(ctx, '✕', x + e.brokeAt / L * w, ly + 2, 11, C.pink, 'center', 900);
  }
  ctx.fillStyle = C.pale; ctx.fillRect(x + w * clock / L - 1, by - 5, 2, 14 + s.count * 9);
}

export { drawStar };
