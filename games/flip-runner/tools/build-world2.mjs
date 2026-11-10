// World 2, Bell Tower: the Glider form (hold to climb, release to dive) and moving blocks.
//   node tools/build-world2.mjs [id …]      then: node tools/levels.mjs w2l01 …
import { Cave, writeLevel } from './levelkit.mjs';

const only = process.argv.slice(2);
const levels = {};
const SPEED = 470;
const cave = n => { const c = new Cave(n); c.speed = SPEED; return c; };

// Enter a glider room at `portalCol`: a funnel opens the corridor to rows 1..14, the room
// spans [r0, r1], and a second funnel closes it again before the flip portal.
function gliderRoom(c, portalCol, r0, r1) {
  c.portal(portalCol, 'glider');
  c.funnel(portalCol + 2, 5, 1, 11, 15);       // widens over 12 columns
  c.room(r0, r1, 1, 15);
  const e = c.funnel(r1 + 1, 1, 5, 15, 11);    // narrows over 12 columns
  c.portal(e + 2, 'flip');
  return e;
}

// 1. Take Off: the first glider room. Wide gaps, far apart.
levels.w2l01 = () => {
  const c = cave(330);
  c.hint(8, 'TAP!');
  c.floorSpikes(22, 24).ceilSpikes(33, 34).floorSpikes(44, 46);
  c.hint(52, 'HOLD!');
  c.flagFloor(54);
  const e = gliderRoom(c, 58, 74, 216);
  // pillars every 12 columns, gaps 6 tiles tall, alternating high and low
  const gaps = [[3, 8], [7, 12], [4, 9], [6, 11], [3, 8], [7, 12], [5, 10], [4, 9], [7, 12], [3, 8], [6, 11], [5, 10]];
  gaps.forEach(([gt, gb], i) => c.pillar(86 + i * 11, gt, gb));
  c.star(86 + 11 + 1, 12);
  c.star(86 + 5 * 11 + 1, 12);
  c.star(86 + 9 * 11 + 1, 3);
  c.flagFloor(78);
  // back on the ground
  c.floorSpikes(e + 12, e + 14).ceilSpikes(e + 22, e + 23).floorSpikes(e + 32, e + 34).ceilSpikes(e + 42, e + 43).floorSpikes(e + 52, e + 53).ceilSpikes(e + 60, e + 61);
  c.goal(318);
  return c;
};

// A little flip warm-up used by several levels.
function warmup(c, hold = true) {
  c.hint(8, 'TAP!');
  c.floorSpikes(22, 24).ceilSpikes(33, 34).floorSpikes(44, 46);
  if (hold) c.hint(54, 'HOLD!');
  c.flagFloor(50);
}

// 2. Weave: narrower gaps, closer together, alternating high and low.
levels.w2l02 = () => {
  const c = cave(330);
  warmup(c);
  const e = gliderRoom(c, 60, 76, 214);
  const tops = [2, 8, 3, 9, 2, 9, 4, 10, 3, 9, 2, 8, 5, 9];
  tops.forEach((gt, i) => c.pillar(90 + i * 9, gt, gt + 3));
  c.star(90 + 3 * 9 + 1, 12);
  c.star(90 + 7 * 9 + 1, 13);
  c.star(90 + 10 * 9 + 1, 3);
  c.flagFloor(80);
  c.floorSpikes(e + 12, e + 14).ceilSpikes(e + 22, e + 23).floorSpikes(e + 32, e + 33).ceilSpikes(e + 42, e + 43).floorSpikes(e + 52, e + 53);
  c.goal(318);
  return c;
};

// 3. Scraper: spikes along the ceiling and the floor of a long room: stay in the air.
levels.w2l03 = () => {
  const c = cave(330);
  warmup(c);
  const e = gliderRoom(c, 60, 76, 214);
  // a band: the room narrows to 8 tiles with spikes on both surfaces for 35 columns
  c.room(92, 130, 4, 12);
  c.ceilSpikes(92, 130).floorSpikes(92, 130);
  c.pillar(108, 6, 9, 2);
  c.pillar(120, 6, 9, 2);
  c.star(109, 7);
  c.star(121, 8);
  c.flagFloor(80);
  // then a wide-open stretch with only ceiling spikes, and one with only floor spikes
  c.ceilSpikes(142, 168);
  c.pillar(150, 5, 10, 2);
  c.pillar(162, 4, 9, 2);
  c.floorSpikes(176, 202);
  c.pillar(184, 5, 10, 2);
  c.pillar(196, 3, 8, 2);
  c.star(190, 12);
  c.floorSpikes(e + 12, e + 14).ceilSpikes(e + 22, e + 23).floorSpikes(e + 32, e + 33).ceilSpikes(e + 42, e + 43).floorSpikes(e + 52, e + 53);
  c.goal(318);
  return c;
};

// 4. Stalactites: rock hanging from the ceiling and rising from the floor, in all sizes.
levels.w2l04 = () => {
  const c = cave(330);
  warmup(c);
  const e = gliderRoom(c, 60, 76, 214);
  // [column, kind, size, width]: kind 'c' hangs from the ceiling, 'f' rises from the floor
  const rocks = [[92, 'c', 6, 2], [102, 'f', 6, 2], [112, 'c', 8, 3], [121, 'f', 8, 2], [130, 'c', 5, 1], [136, 'f', 5, 1], [142, 'c', 9, 2],
    [152, 'f', 9, 2], [162, 'c', 7, 2], [168, 'f', 7, 2], [176, 'c', 6, 1], [181, 'f', 6, 1], [186, 'c', 6, 1], [191, 'f', 6, 1], [200, 'c', 9, 3]];
  for (const [col, kind, size, w] of rocks) {
    if (kind === 'c') c.pillar(col, 1 + size, 14, w); else c.pillar(col, 1, 14 - size, w);
  }
  c.star(114, 12);
  c.star(155, 3);
  c.star(190, 8);
  c.flagFloor(80);
  c.floorSpikes(e + 12, e + 14).ceilSpikes(e + 22, e + 23).floorSpikes(e + 32, e + 33).ceilSpikes(e + 42, e + 43).floorSpikes(e + 52, e + 53);
  c.goal(318);
  return c;
};

// 5. Switchback: Flip, Glider, Flip, Glider, Flip: the form changes every few seconds.
levels.w2l05 = () => {
  const c = cave(430);
  warmup(c);
  let e = gliderRoom(c, 60, 76, 118);
  [[88, 3], [100, 8], [110, 5]].forEach(([col, gt]) => c.pillar(col, gt, gt + 4));
  c.star(101, 12);
  c.flagFloor(78);
  // flip part 1
  c.floorSpikes(e + 10, e + 12).ceilSpikes(e + 18, e + 19).floorSpikes(e + 26, e + 27).ceilSpikes(e + 34, e + 35);
  c.flagFloor(e + 4);
  const p2 = e + 44;
  e = gliderRoom(c, p2, p2 + 16, p2 + 70);
  [[p2 + 26, 2], [p2 + 36, 9], [p2 + 46, 4], [p2 + 56, 8], [p2 + 66, 3]].forEach(([col, gt]) => c.pillar(col, gt, gt + 3));
  c.star(p2 + 37, 12);
  c.flagFloor(p2 + 20);
  c.floorSpikes(e + 10, e + 12).ceilSpikes(e + 18, e + 19).floorSpikes(e + 26, e + 27);
  const p3 = e + 36;
  e = gliderRoom(c, p3, p3 + 16, p3 + 50);
  [[p3 + 26, 6], [p3 + 36, 2], [p3 + 46, 9]].forEach(([col, gt]) => c.pillar(col, gt, gt + 3));
  c.star(p3 + 47, 12);
  c.floorSpikes(e + 10, e + 12).ceilSpikes(e + 18, e + 19).floorSpikes(e + 26, e + 27).ceilSpikes(e + 34, e + 35);
  c.goal(e + 46);
  return c;
};

// 6. Pistons: blocks sliding up and down in the corridor. Each one is at an end of its
// path when you reach it, so the free lane is readable: bottom = the ceiling is free, top = the floor is.
levels.w2l06 = () => {
  const c = cave(330);
  warmup(c, false);
  // [column, height, travel, period, where it is when you arrive]
  const pistons = [[70, 3, 3, 3.0, 'start'], [92, 3, 3, 2.6, 'far'], [114, 4, 2, 3.2, 'far'], [138, 4, 2, 2.8, 'start'],
    [162, 5, 1, 3.4, 'far'], [186, 5, 1, 3.0, 'far'], [210, 4, 2, 3.0, 'start'], [234, 3, 3, 2.6, 'far']];
  pistons.forEach(([col, h, d, per, at]) => c.mover(col, 5, 2, h, 0, d, per, at));
  c.floorSpikes(80, 81).ceilSpikes(102, 103).floorSpikes(126, 127).ceilSpikes(150, 151).floorSpikes(174, 175).ceilSpikes(198, 199).floorSpikes(222, 223);
  c.star(77, 10);
  c.star(158, 5);
  c.star(228, 10);
  c.flagFloor(60).flagFloor(130).flagFloor(206);
  c.ceilSpikes(56, 57);
  c.ceilSpikes(250, 252).floorSpikes(262, 264).ceilSpikes(274, 276).floorSpikes(286, 288);
  c.goal(318);
  return c;
};

// 7. Lifts: floors that move. A long stretch of floor is a platform that rises while you
// ride it, with spikes on the ceiling so you cannot fly over. Its left edge is level with the
// floor when you arrive.
levels.w2l07 = () => {
  const c = cave(330);
  warmup(c, false);
  c.hint(80, 'RIDE!');
  // [first column of the gap, width, rise in tiles, period]
  const lifts = [[100, 19, 2, 6.0], [150, 19, 1, 4.4], [200, 21, 2, 5.4]];
  for (const [col, w, rise, per] of lifts) {
    c.floorGapAt(col, col + w - 1);
    c.mover(col, 11, w, 1, 0, -rise, per, 'start', 'left');
    c.ceilSpikes(col + 4, col + w - 1);
  }
  c.floorSpikes(128, 130).floorSpikes(181, 183).floorSpikes(60, 62).ceilSpikes(72, 74).floorSpikes(86, 88).ceilSpikes(192, 193).floorSpikes(232, 233);
  c.star(139, 5);
  c.star(172, 10);
  c.star(226, 5);
  c.flagFloor(70).flagFloor(134).flagFloor(186);
  c.floorSpikes(240, 242).ceilSpikes(250, 252).floorSpikes(260, 262).ceilSpikes(270, 272).floorSpikes(280, 282).ceilSpikes(290, 292);
  c.goal(318);
  return c;
};

// 8. Moving Pillars: a glider room whose pillars slide up and down.
levels.w2l08 = () => {
  const c = cave(330);
  warmup(c);
  const e = gliderRoom(c, 60, 76, 214);
  // [column, travel in tiles, period]: a 7-tile pillar from the ceiling that drops to the floor and back
  const pillars = [[92, 7, 3.2], [104, 7, 2.8], [116, 7, 3.4], [128, 7, 3.0], [140, 7, 2.6], [152, 7, 3.2], [164, 7, 3.4], [176, 7, 2.8], [188, 7, 3.0], [200, 7, 3.2]];
  pillars.forEach(([col, d, per], i) => c.mover(col, 1, 2, 7, 0, d, per + (i % 2 ? 0.2 : 0)));
  c.star(110, 11);
  c.star(146, 6);
  c.star(190, 12);
  c.flagFloor(80);
  c.floorSpikes(e + 12, e + 14).ceilSpikes(e + 22, e + 23).floorSpikes(e + 32, e + 33).ceilSpikes(e + 42, e + 43).floorSpikes(e + 52, e + 53);
  c.goal(318);
  return c;
};

// Segments for the longer levels. Each returns the first free column after it.
const PISTONS = [[3, 3, 3.0], [3, 3, 2.6], [4, 2, 3.2], [4, 2, 2.8], [5, 1, 3.4], [5, 1, 3.0]];
function pistonSeg(c, s0, ats) {
  ats.forEach((at, i) => {
    const col = s0 + i * 22, [h, d, per] = PISTONS[(i + s0) % PISTONS.length];
    c.mover(col, 5, 2, h, 0, d, per, at);
    // after a piston, a spike on the surface you were using forces you across
    if (at === 'start') c.floorSpikes(col + 10, col + 11); else c.ceilSpikes(col + 10, col + 11);
  });
  return s0 + ats.length * 22;
}
// A glider room with static pillars: [offset from the room start, first open row, open rows]
function glideSeg(c, portalCol, len, pillars) {
  const r0 = portalCol + 16;
  const e = gliderRoom(c, portalCol, r0, r0 + len);
  pillars.forEach(([off, gt, gh]) => c.pillar(r0 + off, gt, gt + gh - 1));
  return { end: e + 4, r0 };
}
// A glider room with sliding pillars: [offset, period]
function glideMovingSeg(c, portalCol, len, pillars) {
  const r0 = portalCol + 16;
  const e = gliderRoom(c, portalCol, r0, r0 + len);
  pillars.forEach(([off, per], i) => c.mover(r0 + off, 1, 2, 7, 0, 7, per, i % 2 ? 'far' : 'start'));
  return { end: e + 4, r0 };
}

// 9. Bell Ringer: everything so far, one after the other.
levels.w2l09 = () => {
  const c = cave(900);
  warmup(c, false);
  c.ceilSpikes(56, 57);
  let e = pistonSeg(c, 70, ['start', 'far', 'start']);
  c.star(74, 10);
  c.flagFloor(64);
  let g = glideSeg(c, e + 4, 76, [[12, 3, 5], [24, 8, 5], [36, 2, 5], [48, 7, 5], [60, 3, 5], [72, 8, 5]]);
  c.star(g.r0 + 25, 12);
  c.flagFloor(g.r0 + 4);
  e = pistonSeg(c, g.end + 8, ['far', 'start', 'far']);
  c.flagFloor(e - 64);
  g = glideMovingSeg(c, e + 4, 90, [[12, 3.2], [26, 2.8], [40, 3.4], [54, 3.0], [68, 3.2], [82, 2.8]]);
  c.star(g.r0 + 33, 11);
  e = g.end;
  c.floorSpikes(e + 10, e + 12).ceilSpikes(e + 20, e + 21).floorSpikes(e + 30, e + 31).ceilSpikes(e + 40, e + 41);
  c.goal(e + 56);
  return c;
};

// 10. Tower Exit: the world's exam (~50 s, three flags).
levels.w2l10 = () => {
  const c = cave(1100);
  warmup(c, false);
  c.ceilSpikes(56, 57);
  let e = pistonSeg(c, 70, ['start', 'far', 'far', 'start']);
  c.star(74, 10);
  c.flagFloor(64);
  // two moving floors under ceiling spikes
  const lifts = [[e + 6, 19, 2, 6.0], [e + 56, 19, 1, 4.4]];
  for (const [col, w, rise, per] of lifts) {
    c.floorGapAt(col, col + w - 1);
    c.mover(col, 11, w, 1, 0, -rise, per, 'start', 'left');
    c.ceilSpikes(col + 4, col + w - 1);
  }
  c.floorSpikes(e + 32, e + 34).floorSpikes(e + 46, e + 47);
  c.star(e + 40, 5);
  c.flagFloor(e + 2);
  e = e + 84;
  // a weave with static pillars
  let g = glideSeg(c, e, 100, [[12, 2, 4], [22, 8, 4], [32, 3, 4], [42, 9, 4], [52, 2, 4], [62, 8, 4], [72, 4, 4], [82, 9, 4], [92, 3, 4]]);
  c.star(g.r0 + 53, 5);
  c.flagFloor(g.r0 + 4);
  e = g.end;
  // ping pong on the ground
  c.ceilSpikes(e + 8, e + 9).floorSpikes(e + 16, e + 17).ceilSpikes(e + 24, e + 25).floorSpikes(e + 32, e + 33);
  e = e + 40;
  // moving pillars
  g = glideMovingSeg(c, e, 80, [[12, 3.2], [24, 2.8], [36, 3.4], [48, 3.0], [60, 3.2], [72, 2.8]]);
  e = g.end;
  c.floorSpikes(e + 10, e + 12).ceilSpikes(e + 20, e + 21).floorSpikes(e + 30, e + 31).ceilSpikes(e + 40, e + 41);
  c.goal(e + 56);
  return c;
};

for (const [id, build] of Object.entries(levels)) {
  if (only.length && !only.includes(id)) continue;
  const names = { w2l01: 'Take Off', w2l02: 'Weave', w2l03: 'Scraper', w2l04: 'Stalactites', w2l05: 'Switchback', w2l06: 'Pistons', w2l07: 'Lifts', w2l08: 'Moving Pillars', w2l09: 'Bell Ringer', w2l10: 'Tower Exit' };
  writeLevel(id, names[id], build(), { speed: SPEED });
  console.log('wrote', id);
}
