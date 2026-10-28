// The pen (GDD 3.4): lazy string, point spacing, blocked areas, the ink pot.
// No DOM: the game feeds it pointer positions, the tools feed it designer paths,
// so reference lines are recorded through exactly the same pen.
import { PEN } from './config.js';
import { simplifyStroke } from './geom.js';

const SUB = 2;   // px between blocked-area samples along a tip move

export class Pen {
  // blocked(x, y) returns a truthy area kind where the pen can't draw.
  constructor(blocked, pot) {
    this.blocked = blocked;
    this.pot = pot;
    this.reset();
  }

  reset() {
    this.active = false;     // a stroke exists
    this.waiting = false;    // pressed on a blocked spot, waiting for a free one
    this.pts = [];
    this.tip = null;
    this.ptr = null;
    this.used = 0;           // ink used: the length the tip has travelled
    this.sinceLast = 0;
    this.tether = null;      // area kind when the tip is stopped at a blocked edge
    this.dry = false;
    this.events = [];        // 'blocked', 'dry', 'mark' — read and cleared by the game
    this.hitBlocked = false; // this stroke touched a blocked area at least once
  }

  get left() { return Math.max(0, this.pot - this.used); }

  begin(x, y) {
    this.reset();
    this.ptr = [x, y];
    if (this.blocked(x, y)) { this.waiting = true; return; }
    this.start(x, y);
  }

  start(x, y) {
    this.waiting = false;
    this.active = true;
    this.tip = [x, y];
    this.pts = [[x, y]];
  }

  clearPath(ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, d = Math.sqrt(dx * dx + dy * dy);
    const n = Math.max(1, Math.ceil(d / SUB));
    for (let i = 1; i <= n; i++) if (this.blocked(ax + dx * i / n, ay + dy * i / n)) return false;
    return true;
  }

  move(x, y) {
    this.ptr = [x, y];
    if (this.waiting) { if (!this.blocked(x, y)) this.start(x, y); return; }
    if (!this.active || this.dry) return;
    const [tx, ty] = this.tip;
    if (this.tether) {
      const dx = x - tx, dy = y - ty;
      if (dx * dx + dy * dy > PEN.resume * PEN.resume || !this.clearPath(tx, ty, x, y)) return;
      this.tether = null;
    }
    // Lazy string: the tip only moves when the pointer is more than 4 px away.
    const dx = x - tx, dy = y - ty, d = Math.sqrt(dx * dx + dy * dy);
    if (d <= PEN.lazy) return;
    let len = d - PEN.lazy;
    const ux = dx / d, uy = dy / d;
    // Out of ink: the tip stops where the pot runs dry.
    let dry = false;
    if (this.used + len >= this.pot) { len = this.pot - this.used; dry = true; }
    // Blocked areas: stop at the edge.
    const n = Math.max(1, Math.ceil(len / SUB));
    let ok = len, hit = null;
    for (let i = 1; i <= n; i++) {
      const k = len * i / n;
      const kind = this.blocked(tx + ux * k, ty + uy * k);
      if (kind) {
        let lo = len * (i - 1) / n, hi = k;
        for (let j = 0; j < 8; j++) { const m = (lo + hi) / 2; if (this.blocked(tx + ux * m, ty + uy * m)) hi = m; else lo = m; }
        ok = lo; hit = kind; dry = false;
        break;
      }
    }
    this.advance(ux, uy, ok);
    if (hit) { this.tether = hit; this.hitBlocked = true; this.events.push({ type: 'blocked', kind: hit }); }
    if (dry) { this.dry = true; this.events.push({ type: 'dry' }); }
  }

  advance(ux, uy, len) {
    if (len <= 0) return;
    const before = this.used;
    let left = len;
    // Points every 6 px of tip motion.
    while (this.sinceLast + left >= PEN.spacing) {
      const step = PEN.spacing - this.sinceLast;
      this.tip = [this.tip[0] + ux * step, this.tip[1] + uy * step];
      this.pts.push(this.tip);
      left -= step;
      this.sinceLast = 0;
    }
    this.tip = [this.tip[0] + ux * left, this.tip[1] + uy * left];
    this.sinceLast += left;
    this.used = before + len;
  }

  // The line as drawn so far (points plus the tip), for rendering.
  line() {
    if (!this.active) return [];
    const l = this.pts[this.pts.length - 1];
    return l === this.tip ? this.pts : this.pts.concat([this.tip]);
  }

  // Let go: returns { pts, ink } of the simplified solid line, or null when the
  // line is too short to count.
  finish() {
    if (!this.active || this.used < PEN.minLen) return null;
    return { pts: simplifyStroke(this.line(), PEN.rdp), ink: this.used };
  }
}

// Draws a whole designer path through the pen (densified like a hand drag),
// as the reference-line tools and window.game.stroke() do.
export function penStroke(blocked, pot, path, stepPx = 3) {
  const pen = new Pen(blocked, pot);
  pen.begin(path[0][0], path[0][1]);
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = path[i - 1], [bx, by] = path[i];
    const d = Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2), n = Math.max(1, Math.ceil(d / stepPx));
    for (let k = 1; k <= n; k++) pen.move(ax + (bx - ax) * k / n, ay + (by - ay) * k / n);
  }
  // As on a real release, the tip stays up to 4 px short of the last point.
  return { pen, result: pen.finish() };
}
