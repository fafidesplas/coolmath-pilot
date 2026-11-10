// World 2, Bell Tower: the Glider form (hold to climb, release to dive) and moving blocks.
//   node tools/build-world2.mjs [id …]      then: node tools/levels.mjs w2l01 …
import { Cave, writeLevel } from './levelkit.mjs';

const only = process.argv.slice(2);
const levels = {};
const SPEED = 470;

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
  const c = new Cave(330);
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
  const c = new Cave(330);
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
  const c = new Cave(330);
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
  const c = new Cave(330);
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
  const c = new Cave(430);
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

for (const [id, build] of Object.entries(levels)) {
  if (only.length && !only.includes(id)) continue;
  const names = { w2l01: 'Take Off', w2l02: 'Weave', w2l03: 'Scraper', w2l04: 'Stalactites', w2l05: 'Switchback' };
  writeLevel(id, names[id], build(), { speed: SPEED });
  console.log('wrote', id);
}
