// The room and the wall (GDD 3.1, 3.8, 3.13, 9), Canvas 2D. The room, the lamp
// beam, the wall panel and the outline glow are pre-rendered once per level; the
// shadow, gap glow, spill hatching, dashed outline and mosaic are drawn each frame.
import { VIEW_W, VIEW_H, WALL, OBJ_CENTER, COLORS as C } from './config.js';
import { rrect, outlinePath, drawMosaic } from './ui.js';

const PANEL = { x: WALL.cx - WALL.size / 2, y: WALL.cy - WALL.size / 2, w: WALL.size, h: WALL.size };

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h));
  return c;
}

function drawRoom(g, withWall) {
  g.fillStyle = C.attic; g.fillRect(0, 0, VIEW_W, VIEW_H);
  // Attic sketched in a few glowing lines: roof beams and a round window.
  g.save();
  g.strokeStyle = 'rgba(180,140,255,0.16)'; g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, 300); g.lineTo(330, 72); g.moveTo(330, 72); g.lineTo(640, 290); g.stroke();
  g.beginPath(); g.moveTo(60, 720); g.lineTo(60, 260); g.moveTo(600, 720); g.lineTo(600, 270); g.stroke();
  g.strokeStyle = 'rgba(234,240,255,0.10)';
  g.beginPath(); g.arc(150, 200, 46, 0, Math.PI * 2); g.moveTo(104, 200); g.lineTo(196, 200); g.moveTo(150, 154); g.lineTo(150, 246); g.stroke();
  g.restore();
  // Lamp at the bottom left and its beam towards the wall.
  const beam = g.createLinearGradient(40, 690, 1100, 400);
  beam.addColorStop(0, 'rgba(255,210,90,0.20)'); beam.addColorStop(1, 'rgba(255,210,90,0.0)');
  g.fillStyle = beam;
  g.beginPath(); g.moveTo(40, 690); g.lineTo(1250, 80); g.lineTo(1250, 720); g.closePath(); g.fill();
  const lamp = g.createRadialGradient(40, 690, 4, 40, 690, 90);
  lamp.addColorStop(0, 'rgba(255,230,160,1)'); lamp.addColorStop(0.2, 'rgba(255,210,90,0.6)'); lamp.addColorStop(1, 'rgba(255,210,90,0)');
  g.fillStyle = lamp; g.fillRect(0, 590, 140, 130);
  if (!withWall) return;
  // The wall panel with a soft pool of lamplight.
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 30;
  rrect(g, PANEL.x, PANEL.y, PANEL.w, PANEL.h, WALL.r); g.fillStyle = C.wall; g.fill();
  g.restore();
  g.save();
  rrect(g, PANEL.x, PANEL.y, PANEL.w, PANEL.h, WALL.r); g.clip();
  const pool = g.createRadialGradient(WALL.cx - 40, WALL.cy + 30, 30, WALL.cx, WALL.cy, 380);
  pool.addColorStop(0, 'rgba(255,210,90,0.16)'); pool.addColorStop(1, 'rgba(255,210,90,0)');
  g.fillStyle = pool; g.fillRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h);
  g.restore();
  rrect(g, PANEL.x, PANEL.y, PANEL.w, PANEL.h, WALL.r);
  g.lineWidth = 2; g.strokeStyle = 'rgba(234,240,255,0.12)'; g.stroke();
}

export class Wall {
  constructor() {
    this.layer = null;
    this.roomLayer = null;
    this.hatch = null;
    this.halo = null;
  }

  build(lv, px) {
    this.lv = lv;
    this.layer = canvas(VIEW_W * px, VIEW_H * px);
    const g = this.layer.getContext('2d');
    g.scale(px, px);
    drawRoom(g, true);
    // Outline glow, pre-rendered (GDD 9).
    g.save();
    g.shadowColor = C.cyan; g.shadowBlur = 18;
    outlinePath(g, lv.loops, WALL.cx, WALL.cy, lv.cellPx);
    g.lineWidth = 4; g.strokeStyle = 'rgba(62,230,255,0.35)'; g.stroke();
    g.restore();
    if (!this.hatch) this.makeSprites();
  }

  buildRoom(px) {
    this.roomLayer = canvas(VIEW_W * px, VIEW_H * px);
    const g = this.roomLayer.getContext('2d');
    g.scale(px, px);
    drawRoom(g, false);
    if (!this.hatch) this.makeSprites();
  }

  makeSprites() {
    const h = canvas(16, 16), g = h.getContext('2d');
    g.strokeStyle = C.pink; g.lineWidth = 3;
    g.beginPath(); g.moveTo(-4, 20); g.lineTo(20, -4); g.moveTo(-4, 4); g.lineTo(4, -4); g.moveTo(12, 20); g.lineTo(20, 12); g.stroke();
    this.hatch = h;
    const halo = canvas(256, 256), hg = halo.getContext('2d');
    const grd = hg.createRadialGradient(128, 128, 10, 128, 128, 128);
    grd.addColorStop(0, 'rgba(255,210,90,0.35)'); grd.addColorStop(1, 'rgba(255,210,90,0)');
    hg.fillStyle = grd; hg.fillRect(0, 0, 256, 256);
    this.halo = halo;
  }

  drawRoom(ctx) { ctx.drawImage(this.roomLayer, 0, 0, VIEW_W, VIEW_H); }

  drawHalo(ctx, alpha, r = 300) {
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(this.halo, OBJ_CENTER.x - r, OBJ_CENTER.y - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
  }

  // st: { polys, pct, t, flash (0..1), mosaic (0..1), anim (seconds into the picture's animation or -1), solid }
  draw(ctx, st) {
    const lv = this.lv, px = lv.cellPx, cx = WALL.cx, cy = WALL.cy;
    ctx.drawImage(this.layer, 0, 0, VIEW_W, VIEW_H);
    ctx.save();
    rrect(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, WALL.r); ctx.clip();

    // Gap glow: the outline's area, under the shadow.
    const targetPath = () => {
      ctx.beginPath();
      for (const p of lv.polys) {
        for (let i = 0; i < p.length; i += 2) (i ? ctx.lineTo(cx + p[i] * px, cy - p[i + 1] * px) : ctx.moveTo(cx + p[i] * px, cy - p[i + 1] * px));
        ctx.closePath();
      }
    };
    if (st.mosaic < 1) {
      targetPath();
      ctx.fillStyle = `rgba(62,230,255,${0.14 + st.pct / 100 * 0.08})`; ctx.fill();
    }

    // The shadow: one path, nonzero fill = the union of the block polygons.
    const shadowPath = () => {
      ctx.beginPath();
      for (const p of st.polys) {
        for (let i = 0; i < p.length; i += 2) (i ? ctx.lineTo(cx + p[i] * px, cy - p[i + 1] * px) : ctx.moveTo(cx + p[i] * px, cy - p[i + 1] * px));
        ctx.closePath();
      }
    };
    if (st.mosaic < 1) {
      shadowPath();
      ctx.fillStyle = C.ink; ctx.fill('nonzero');
      // Spill: the shadow outside the outline, hatched in pink.
      ctx.save();
      shadowPath(); ctx.clip('nonzero');
      ctx.beginPath();
      ctx.rect(PANEL.x, PANEL.y, PANEL.w, PANEL.h);
      for (const p of lv.polys) {
        for (let i = 0; i < p.length; i += 2) (i ? ctx.lineTo(cx + p[i] * px, cy - p[i + 1] * px) : ctx.moveTo(cx + p[i] * px, cy - p[i + 1] * px));
        ctx.closePath();
      }
      ctx.clip('evenodd');
      if (!this.pattern) this.pattern = ctx.createPattern(this.hatch, 'repeat');
      ctx.fillStyle = this.pattern || C.pink;
      ctx.globalAlpha = 0.75;
      ctx.fillRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h);
      ctx.restore();
    }

    // Mosaic reveal: a radial wipe of glowing tiles from the center (GDD 3.13).
    if (st.mosaic > 0) {
      const maxD = Math.hypot(lv.frame.size[0], lv.frame.size[1]) / 2 + 0.5, pv = lv.frame.pivot;
      let ox = 0, oy = 0, rot = 0;
      const a = st.anim;
      if (a >= 0 && a < 0.6) {
        const k = a / 0.6, env = Math.sin(k * Math.PI);
        if (lv.anim === 'bob') oy = -Math.abs(Math.sin(k * Math.PI * 2)) * 14 * env;
        if (lv.anim === 'wiggle') rot = Math.sin(k * Math.PI * 4) * 0.08 * env;
      }
      ctx.save();
      ctx.translate(cx + ox, cy + oy); ctx.rotate(rot); ctx.translate(-cx, -cy);
      const blinkOff = lv.anim === 'blink' && a >= 0 && a < 0.6 && Math.floor(a / 0.12) % 2 === 1;
      drawMosaic(ctx, lv, cx, cy, px, {
        glow: 14,
        tile: c => {
          const d = Math.hypot(c.x + 0.5 - pv[0], c.y + 0.5 - pv[1]) / maxD;
          const k = Math.max(0, Math.min(1, (st.mosaic * 1.35 - d) / 0.35));
          return k <= 0 ? 0 : 1 + 0.25 * Math.sin(k * Math.PI);
        },
        color: blinkOff ? (c => (c.color >= 4 ? '#5A5F80' : undefined)) : null,
      });
      ctx.restore();
    }

    // The dashed outline: marches faster above 80% (GDD 3.8); solid and white when matched.
    outlinePath(ctx, lv.loops, cx, cy, px);
    ctx.lineJoin = 'round';
    if (st.solid) {
      ctx.setLineDash([]);
      ctx.lineWidth = 4;
      ctx.strokeStyle = st.flash > 0 ? `rgba(255,255,255,${0.5 + st.flash * 0.5})` : C.cyan;
      ctx.stroke();
    } else {
      const speed = st.pct > 80 ? 60 : 18;
      ctx.setLineDash([12, 8]);
      ctx.lineDashOffset = -st.t * speed;
      ctx.lineWidth = 3 + st.pct / 100;
      ctx.strokeStyle = C.cyan;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }
}

export { PANEL };
