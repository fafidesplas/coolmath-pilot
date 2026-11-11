// World 4, Night Fair: gravity switches (the arrow sets your gravity when you touch it, even
// in mid-air) and everything chained together.
//   node tools/build-world4.mjs [id …]      then: node tools/levels.mjs w4l01 …
import { Cave, writeLevel } from './levelkit.mjs';
import { gliderRoom, pistonSeg, glideSeg, glideMovingSeg, zoneRun, twinZones, lanes, tail } from './segments.mjs';

const only = process.argv.slice(2);
const levels = {};
const SPEED = 530;
const cave = n => { const c = new Cave(n); c.speed = SPEED; return c; };

function warmup(c) {
  c.hint(8, 'TAP!');
  c.floorSpikes(22, 24).ceilSpikes(33, 34).floorSpikes(44, 46);
  c.flagFloor(50);
}

// A bumper pattern in the standard corridor: the switch sits on a surface, so it only catches a
// bat running there. [kind, switch surface, hazard surface, hazard distance]
function switchRun(c, s0, pattern, pitch = 24) {
  pattern.forEach(([sw, hz, d], i) => {
    const b = s0 + i * pitch;
    if (sw === 'floor') c.bumper(b, 10, -1); else c.bumper(b, 5, 1);     // floor switch: arrow up; ceiling switch: arrow down
    if (hz === 'floor') c.floorSpikes(b + d, b + d + 1); else c.ceilSpikes(b + d, b + d + 1);
  });
  return s0 + pattern.length * pitch;
}

// 1. Switchboard: a switch on a surface flips a bat running on it. Switches next to spikes.
levels.w4l01 = () => {
  const c = cave(500);
  warmup(c); c.ceilSpikes(56, 57); c.hint(60, 'ARROW!');
  const e = switchRun(c, 66, [['floor', 'floor', 10], ['ceil', 'ceil', 10], ['floor', 'ceil', 9], ['ceil', 'floor', 9],
    ['floor', 'floor', 10], ['floor', 'ceil', 9], ['ceil', 'ceil', 10], ['ceil', 'floor', 9], ['floor', 'ceil', 9]]);
  c.star(100, 10); c.star(176, 5); c.star(250, 10);
  c.flagFloor(60).flagFloor(150).flagFloor(230);
  c.goal(e + 20);
  return c;
};

// A tall room with bumpers in mid-air: [column, row, g].
function bumperRoom(c, c0, c1, bumpers, hazards) {
  c.room(c0, c1, 1, 14);
  for (const [col, row, g] of bumpers) c.bumper(col, row, g);
  for (const [surf, col, w = 2] of hazards) { if (surf === 'floor') c.floorSpikes(col, col + w - 1); else c.ceilSpikes(col, col + w - 1); }
  return c.funnel(c1 + 1, 1, 5, 14, 11);
}

// 2. Bumpers: a tall room. A bumper in mid-air sets your gravity as you fly through it.
levels.w4l02 = () => {
  const c = cave(500);
  warmup(c); c.ceilSpikes(56, 57); c.hint(60, 'BUMP!');
  const e = bumperRoom(c, 66, 300, [[90, 8, -1], [106, 6, 1], [122, 9, -1], [138, 5, 1], [154, 8, -1], [170, 6, 1], [186, 9, -1], [202, 5, 1], [218, 8, -1], [234, 6, 1], [250, 9, -1], [266, 5, 1], [282, 8, -1]],
    [['floor', 78], ['floor', 98], ['ceil', 114], ['floor', 130], ['ceil', 146], ['floor', 162], ['ceil', 178], ['floor', 194], ['ceil', 210], ['floor', 226], ['ceil', 242], ['floor', 258], ['ceil', 274]]);
  c.star(96, 13); c.star(172, 1); c.star(256, 13);
  c.flag(72, 13); c.flag(150, 13); c.flag(230, 13);
  tail(c, e);
  return c;
};

// 3. Pinball: a narrower tall room, bumpers closer together.
levels.w4l03 = () => {
  const c = cave(500);
  warmup(c); c.ceilSpikes(56, 57); c.hint(60, 'BUMP!');
  c.room(66, 300, 3, 12);
  const bump = [[88, 6, 1], [100, 8, -1], [112, 5, -1], [124, 9, 1], [136, 6, 1], [148, 8, -1], [160, 5, -1], [172, 9, 1], [184, 6, 1], [196, 8, -1], [208, 5, -1], [220, 9, 1], [232, 6, 1], [244, 8, -1], [256, 5, -1], [268, 9, 1]];
  for (const [col, row, g] of bump) c.bumper(col, row, g);
  const hz = [['floor', 76], ['floor', 94], ['ceil', 106], ['floor', 118], ['ceil', 130], ['floor', 142], ['ceil', 154], ['floor', 166], ['ceil', 178], ['floor', 190], ['ceil', 202], ['floor', 214], ['ceil', 226], ['floor', 238], ['ceil', 250], ['floor', 262], ['ceil', 274], ['floor', 288]];
  for (const [surf, col] of hz) { if (surf === 'floor') c.floorSpikes(col, col + 1); else c.ceilSpikes(col, col + 1); }
  c.star(100, 11); c.star(172, 3); c.star(250, 11);
  c.flag(72, 11); c.flag(150, 11); c.flag(230, 11);
  tail(c, c.funnel(301, 3, 5, 12, 11));
  return c;
};

// 4. Carousel: bumper rooms and glider rooms, one after the other.
levels.w4l04 = () => {
  const c = cave(900);
  warmup(c); c.ceilSpikes(56, 57);
  let e = switchRun(c, 66, [['floor', 'ceil', 9], ['ceil', 'floor', 9], ['floor', 'floor', 10]]);
  c.star(90, 10);
  c.flagFloor(60);
  const g = glideSeg(c, e + 4, 90, [[12, 3, 5], [26, 8, 5], [40, 2, 5], [54, 7, 5], [68, 3, 5], [82, 8, 5]]);
  c.star(g.r0 + 27, 12);
  c.flagFloor(g.r0 + 4);
  e = g.end + 6;
  const e2 = bumperRoom(c, e, e + 150, [[e + 24, 8, -1], [e + 40, 6, 1], [e + 56, 9, -1], [e + 72, 5, 1], [e + 88, 8, -1], [e + 104, 6, 1], [e + 120, 9, -1]],
    [['floor', e + 12], ['floor', e + 32], ['ceil', e + 48], ['floor', e + 64], ['ceil', e + 80], ['floor', e + 96], ['ceil', e + 112], ['floor', e + 128], ['ceil', e + 142]]);
  c.star(e + 70, 1);
  c.flag(e + 6, 13);
  tail(c, e2);
  return c;
};

// 5. Funhouse: a twin room with bumpers in both lanes (whichever lane your bat is in, it hits one).
levels.w4l05 = () => {
  const c = cave(500);
  warmup(c); c.ceilSpikes(56, 57); c.hint(60, 'TWINS!');
  c.twinRoom(64, 300);
  c.twinPortal(70);
  c.laneSpikes('a', 'floor', 80, 81);
  for (let i = 0; i < 9; i++) {
    const col = 92 + i * 22, g = i % 2 ? 1 : -1;
    c.bumper(col, 3, g); c.bumper(col, 11, g);                 // one in each lane, same arrow
    if (i % 2) c.laneSpikes(i % 4 === 1 ? 'a' : 'b', 'ceil', col + 8, col + 9); else c.laneSpikes(i % 4 === 0 ? 'b' : 'a', 'floor', col + 8, col + 9);
  }
  c.laneSpikes('b', 'ceil', 290, 291);
  c.star(112, 5); c.star(200, 13); c.star(272, 1);
  c.flag(75, 13); c.flag(160, 13); c.flag(240, 13);
  tail(c, c.twinExit(300));
  return c;
};

// A tall room with speed gates: bumpers and hazards spaced by time. zones: [{ from, mult, pitch }].
function bumperZones(c, c0, c1, zones) {
  c.room(c0, c1, 1, 14);
  const rows = [8, 6, 9, 5]; let k = 0;
  zones.forEach((z, zi) => {
    if (z.mult !== 1 || zi > 0) c.pad(z.from, z.mult, 4);
    const zEnd = (zones[zi + 1] ? zones[zi + 1].from : c1) - 3;
    for (let h = z.from + 5; h + 2 <= zEnd; h += z.pitch, k++) {
      const col = Math.round(h);
      c.bumper(col, rows[k % 4], k % 2 ? 1 : -1);
      const hc = col + Math.round(z.pitch / 2);
      if (hc + 2 <= zEnd + 3) { if (k % 2) c.ceilSpikes(hc, hc + 1); else c.floorSpikes(hc, hc + 1); }
    }
  });
  return c.funnel(c1 + 1, 1, 5, 14, 11);
}

// Bumpers for a twin room: one in each lane, same arrow, with a lane hazard after each.
function twinBumpers(c, c0, c1, pitch, first = 0) {
  for (let k = first, h = c0; h + 10 < c1; k++, h += pitch) {
    const col = Math.round(h), g = k % 2 ? 1 : -1;
    c.bumper(col, 3, g); c.bumper(col, 11, g);
    if (k % 2) c.laneSpikes(k % 4 === 1 ? 'a' : 'b', 'ceil', col + 8, col + 9); else c.laneSpikes(k % 4 === 0 ? 'b' : 'a', 'floor', col + 8, col + 9);
  }
}

// 6. Ferris Wheel: a tall room with bumpers and speed gates.
levels.w4l06 = () => {
  const c = cave(520);
  warmup(c); c.ceilSpikes(56, 57); c.hint(60, 'BUMP!');
  const e = bumperZones(c, 66, 330, [{ from: 70, mult: 1, pitch: 16 }, { from: 150, mult: 1.35, pitch: 22 }, { from: 240, mult: 0.75, pitch: 12 }, { from: 300, mult: 1, pitch: 16 }]);
  c.star(100, 13); c.star(200, 1); c.star(270, 13);
  c.flag(72, 13); c.flag(150, 13); c.flag(240, 13);
  tail(c, e);
  return c;
};

// 7. Rails: pistons with switches on the surface you would use to pass.
levels.w4l07 = () => {
  const c = cave(700);
  warmup(c); c.ceilSpikes(56, 57); c.hint(60, 'ARROW!');
  const ats = ['start', 'far', 'far', 'start', 'far', 'start', 'far', 'far'];
  const e = pistonSeg(c, 70, ats);
  // after piston i, a switch on the surface you used (start = floor lane, far = ceiling lane)
  ats.forEach((at, i) => { const col = 70 + i * 22 + 6; if (at === 'start') c.bumper(col, 10, -1); else c.bumper(col, 5, 1); });
  c.star(73, 10); c.star(188, 5); c.star(262, 10);
  c.flagFloor(64).flagFloor(150).flagFloor(240);
  tail(c, e);
  return c;
};

// 8. Three Rings: Flip with switches, a glider weave, a twin room with bumpers.
levels.w4l08 = () => {
  const c = cave(1000);
  warmup(c); c.ceilSpikes(56, 57);
  let e = switchRun(c, 66, [['floor', 'ceil', 9], ['ceil', 'floor', 9], ['floor', 'floor', 10], ['ceil', 'ceil', 10]]);
  let g = glideSeg(c, e + 4, 90, [[12, 3, 5], [26, 8, 5], [40, 2, 5], [54, 7, 5], [68, 3, 5], [82, 8, 5]]);
  c.star(g.r0 + 27, 12);
  c.flagFloor(g.r0 + 4);
  e = g.end + 8;
  c.twinRoom(e, e + 190);
  c.twinPortal(e + 6);
  twinBumpers(c, e + 18, e + 190, 22, 0);
  c.star(e + 62, 5); c.star(e + 150, 13);
  c.flag(e + 4, 13); c.flag(e + 100, 13);
  tail(c, c.twinExit(e + 190));
  return c;
};

// 9. Big Top: pistons, a tall bumper room with gates, moving pillars, a twin room.
levels.w4l09 = () => {
  const c = cave(1300);
  warmup(c); c.ceilSpikes(56, 57);
  let e = pistonSeg(c, 70, ['start', 'far', 'start', 'far']);
  c.star(73, 10);
  c.flagFloor(64);
  const e2 = bumperZones(c, e + 4, e + 200, [{ from: e + 8, mult: 1, pitch: 16 }, { from: e + 90, mult: 1.35, pitch: 22 }, { from: e + 160, mult: 1, pitch: 16 }]);
  c.star(e + 100, 1);
  c.flag(e + 6, 13); c.flag(e + 100, 13);
  e = e2 + 4;
  const g = glideMovingSeg(c, e, 90, [[12, 3.2], [26, 2.8], [40, 3.4], [54, 3.0], [68, 3.2], [82, 2.8]]);
  c.star(g.r0 + 33, 11);
  tail(c, g.end);
  return c;
};

// 10. Fair Exit: the exam, ~55 s. Switches, bumpers with gates, a weave, a twin room.
levels.w4l10 = () => {
  const c = cave(1500);
  warmup(c); c.ceilSpikes(56, 57);
  let e = switchRun(c, 66, [['floor', 'ceil', 9], ['ceil', 'floor', 9], ['floor', 'floor', 10], ['ceil', 'ceil', 10], ['floor', 'ceil', 9]]);
  const rs = e + 4;
  e = bumperZones(c, rs, rs + 150, [{ from: rs + 4, mult: 1, pitch: 16 }, { from: rs + 60, mult: 1.35, pitch: 22 }, { from: rs + 110, mult: 0.75, pitch: 12 }]);
  c.star(rs + 90, 13);
  c.flag(rs + 2, 13); c.flag(rs + 90, 13);
  const g = glideSeg(c, e + 4, 80, [[12, 2, 4], [24, 8, 4], [36, 3, 4], [48, 9, 4], [60, 2, 4], [72, 8, 4]]);
  c.star(g.r0 + 37, 5);
  const ts = g.end + 8;
  c.twinRoom(ts, ts + 100);
  c.twinPortal(ts + 6);
  c.laneSpikes('a', 'floor', ts + 10, ts + 11);
  twinBumpers(c, ts + 18, ts + 100, 22, 1);
  c.star(ts + 55, 5);
  c.flag(ts + 4, 13);
  tail(c, c.twinExit(ts + 100));
  return c;
};

for (const [id, build] of Object.entries(levels)) {
  if (only.length && !only.includes(id)) continue;
  const names = { w4l01: 'Switchboard', w4l02: 'Bumpers', w4l03: 'Pinball', w4l04: 'Carousel', w4l05: 'Funhouse', w4l06: 'Ferris Wheel', w4l07: 'Rails', w4l08: 'Three Rings', w4l09: 'Big Top', w4l10: 'Fair Exit' };
  writeLevel(id, names[id], build(), { speed: SPEED });
  console.log('wrote', id);
}
