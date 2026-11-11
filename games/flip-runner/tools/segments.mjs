// Reusable level segments, shared by the world builders. Each takes a Cave `c` (with c.speed set).
import { Cave } from './levelkit.mjs';

// Enter a glider room at `portalCol`: a funnel opens the corridor to rows 1..14, the room
// spans [r0, r1], and a second funnel closes it again before the flip portal.
export function gliderRoom(c, portalCol, r0, r1) {
  c.portal(portalCol, 'glider');
  c.funnel(portalCol + 2, 5, 1, 11, 15);       // widens over 12 columns
  c.room(r0, r1, 1, 15);
  const e = c.funnel(r1 + 1, 1, 5, 15, 11);    // narrows over 12 columns
  c.portal(e + 2, 'flip');
  return e;
}

// Segments for the longer levels. Each returns the first free column after it.
const PISTONS = [[3, 3, 3.0], [3, 3, 2.6], [4, 2, 3.2], [4, 2, 2.8], [5, 1, 3.4], [5, 1, 3.0]];
export function pistonSeg(c, s0, ats) {
  ats.forEach((at, i) => {
    const col = s0 + i * 22, [h, d, per] = PISTONS[(i + s0) % PISTONS.length];
    c.mover(col, 5, 2, h, 0, d, per, at);
    // after a piston, a spike on the surface you were using forces you across
    if (at === 'start') c.floorSpikes(col + 10, col + 11); else c.ceilSpikes(col + 10, col + 11);
  });
  return s0 + ats.length * 22;
}
// A glider room with static pillars: [offset from the room start, first open row, open rows]
export function glideSeg(c, portalCol, len, pillars) {
  const r0 = portalCol + 16;
  const e = gliderRoom(c, portalCol, r0, r0 + len);
  pillars.forEach(([off, gt, gh]) => c.pillar(r0 + off, gt, gt + gh - 1));
  return { end: e + 4, r0 };
}
// A glider room with sliding pillars: [offset, period]
export function glideMovingSeg(c, portalCol, len, pillars) {
  const r0 = portalCol + 16;
  const e = gliderRoom(c, portalCol, r0, r0 + len);
  pillars.forEach(([off, per], i) => c.mover(r0 + off, 1, 2, 7, 0, 7, per, i % 2 ? 'far' : 'start'));
  return { end: e + 4, r0 };
}

// Speed zones. Hazards are placed by time, not by columns: the spacing grows with the speed,
// so a fast stretch is not simply a harder one. zones: [{ from, mult, pitch, width }].
export function zoneRun(c, zones, end) {
  let k = 0;
  zones.forEach((z, zi) => {
    c.pad(z.from, z.mult, 4);
    const zEnd = (zones[zi + 1] ? zones[zi + 1].from : end) - 3, w = z.width || 2;
    for (let h = z.from + 5; h + w <= zEnd; h += z.pitch, k++) {
      const col = Math.round(h);
      if (k % 2 === 0) c.ceilSpikes(col, col + w - 1); else c.floorSpikes(col, col + w - 1);
    }
  });
}

// Lane hazards: [lane, surface, offset from the section start, width].
export function lanes(c, c0, hz) { for (const [w, surf, off, wd = 3] of hz) c.laneSpikes(w, surf, c0 + off, c0 + off + wd - 1); }
export function tail(c, e) { c.floorSpikes(e + 8, e + 10).ceilSpikes(e + 18, e + 19).floorSpikes(e + 28, e + 29); c.goal(e + 50); }

// Twin lane hazards by time: alternating lanes and surfaces, with speed gates. zones: [{ from, mult, pitch }].
export function twinZones(c, zones, end, first = 0) {
  const pat = [['a', 'floor'], ['b', 'ceil'], ['a', 'ceil'], ['b', 'floor']];
  let k = first;
  zones.forEach((z, zi) => {
    if (z.mult !== undefined && (zi > 0 || z.mult !== 1)) c.pad(z.from, z.mult, 4);
    const zEnd = (zones[zi + 1] ? zones[zi + 1].from : end) - 3;
    for (let h = z.from + 5; h + 2 <= zEnd; h += z.pitch, k++) { const [w, surf] = pat[k % 4]; c.laneSpikes(w, surf, Math.round(h), Math.round(h) + 1); }
  });
}

