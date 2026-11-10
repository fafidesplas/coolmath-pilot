// World 3, Firefly Forest: the Twin form (a second bat in a parallel lane) and speed pads.
//   node tools/build-world3.mjs [id …]      then: node tools/levels.mjs w3l01 …
import { Cave, writeLevel } from './levelkit.mjs';

const only = process.argv.slice(2);
const levels = {};
const SPEED = 500;
const cave = n => { const c = new Cave(n); c.speed = SPEED; return c; };

function warmup(c) {
  c.hint(8, 'TAP!');
  c.floorSpikes(22, 24).ceilSpikes(33, 34).floorSpikes(44, 46);
  c.flagFloor(50);
}

// 1. Two of Us: the first twin room. Hazards are the same in both lanes at first.
levels.w3l01 = () => {
  const c = cave(500);
  warmup(c);
  c.hint(60, 'TWINS!');
  c.twinRoom(64, 240);
  c.twinPortal(70);
  // identical hazards in both lanes: flip together
  c.laneSpikes('a', 'floor', 92, 94).laneSpikes('b', 'floor', 92, 94);
  c.laneSpikes('a', 'ceil', 106, 108).laneSpikes('b', 'ceil', 106, 108);
  c.laneSpikes('a', 'floor', 120, 122).laneSpikes('b', 'floor', 120, 122);
  c.laneSpikes('a', 'ceil', 134, 136).laneSpikes('b', 'ceil', 134, 136);
  c.laneSpikes('a', 'ceil', 82, 84).laneSpikes('b', 'ceil', 82, 84);
  c.flag(75, 13);
  // now only one lane has a hazard, but both still flip
  c.laneSpikes('a', 'floor', 150, 152).laneSpikes('b', 'ceil', 164, 166).laneSpikes('a', 'floor', 178, 180).laneSpikes('b', 'ceil', 192, 194).laneSpikes('a', 'floor', 206, 208);
  c.laneSpikes('b', 'ceil', 220, 222).laneSpikes('a', 'floor', 232, 234);
  c.star(98, 5);
  c.star(170, 9);
  c.star(199, 13);
  c.flag(142, 13);
  c.flag(212, 13);
  const e = c.twinExit(240);
  c.floorSpikes(e + 8, e + 10).ceilSpikes(e + 18, e + 19).floorSpikes(e + 28, e + 29);
  c.goal(e + 50);
  return c;
};

// Lane hazards: [lane, surface, offset from the section start, width].
function lanes(c, c0, hz) { for (const [w, surf, off, wd = 3] of hz) c.laneSpikes(w, surf, c0 + off, c0 + off + wd - 1); }
function tail(c, e) { c.floorSpikes(e + 8, e + 10).ceilSpikes(e + 18, e + 19).floorSpikes(e + 28, e + 29); c.goal(e + 50); }

// 2. Mirror Mirror: lanes of different heights. The short lane lands first, but both must land before the next flip.
levels.w3l02 = () => {
  const c = cave(500);
  warmup(c); c.hint(60, 'TWINS!');
  c.twinRoom(64, 262, [3, 5], [9, 13]);
  c.twinPortal(70);
  lanes(c, 80, [['a', 'floor', 0], ['b', 'floor', 0], ['a', 'ceil', 12], ['b', 'ceil', 12], ['a', 'floor', 24], ['b', 'ceil', 36], ['a', 'floor', 48], ['b', 'floor', 48],
    ['a', 'ceil', 60], ['b', 'ceil', 60], ['b', 'floor', 72], ['a', 'floor', 84], ['a', 'ceil', 96], ['b', 'ceil', 96], ['b', 'ceil', 108], ['a', 'floor', 120], ['a', 'ceil', 132], ['b', 'floor', 144], ['a', 'ceil', 156], ['a', 'floor', 168], ['b', 'floor', 168]]);
  c.star(98, 5); c.star(160, 13); c.star(206, 3);
  c.flag(75, 13); c.flag(152, 13); c.flag(216, 13);
  tail(c, c.twinExit(262));
  return c;
};

// 3. Odd One Out: only one lane has a hazard at a time, alternating, tightly.
levels.w3l03 = () => {
  const c = cave(500);
  warmup(c); c.hint(60, 'TWINS!');
  c.twinRoom(64, 262);
  c.twinPortal(70);
  const h = [];
  for (let i = 0; i < 17; i++) h.push([i % 2 ? 'b' : 'a', i % 2 ? 'ceil' : 'floor', i * 11 + (i % 3 === 2 ? 2 : 0)]);
  lanes(c, 80, h);
  c.star(100, 13); c.star(150, 1); c.star(205, 5);
  c.flag(75, 13); c.flag(150, 13); c.flag(216, 13);
  tail(c, c.twinExit(262));
  return c;
};

// 4. Fireflies: short lanes, dense hazards, stars in the lane you are not watching.
levels.w3l04 = () => {
  const c = cave(500);
  warmup(c); c.hint(60, 'TWINS!'); c.ceilSpikes(56, 57);
  c.twinRoom(64, 262, [3, 5], [9, 11]);
  c.twinPortal(70);
  const h = [];
  for (let i = 0; i < 16; i++) h.push([(i % 4 < 2) ? 'a' : 'b', (i % 2) ? 'ceil' : 'floor', i * 11, 2]);
  lanes(c, 76, h);
  c.star(97, 3); c.star(152, 11); c.star(207, 5);
  c.flag(77, 11); c.flag(150, 11); c.flag(216, 11);
  tail(c, c.twinExit(262));
  return c;
};

// Speed zones. Hazards are placed by time, not by columns: the spacing grows with the speed,
// so a fast stretch is not simply a harder one. zones: [{ from, mult, pitch, width }].
function zoneRun(c, zones, end) {
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

// 5. Fast Lane: speed gates. Fast (») makes everything come quicker, slow («) gives you time.
levels.w3l05 = () => {
  const c = cave(520);
  warmup(c); c.hint(60, 'SPEED!'); c.ceilSpikes(56, 57);
  zoneRun(c, [{ from: 62, mult: 1, pitch: 11 }, { from: 130, mult: 1.35, pitch: 15 }, { from: 215, mult: 1, pitch: 11 }, { from: 270, mult: 0.75, pitch: 8 }, { from: 330, mult: 1.35, pitch: 15 }], 400);
  c.star(98, 5); c.star(180, 10); c.star(300, 5);
  c.flagFloor(60).flagFloor(128).flagFloor(262);
  c.goal(420);
  return c;
};

// 6. Slow Burn: slow gates before the dense parts, fast gates on the long empty ones.
levels.w3l06 = () => {
  const c = cave(520);
  warmup(c); c.hint(60, 'SLOW!'); c.ceilSpikes(56, 57);
  zoneRun(c, [{ from: 62, mult: 0.75, pitch: 8 }, { from: 130, mult: 1, pitch: 11 }, { from: 190, mult: 0.75, pitch: 7.5 }, { from: 250, mult: 1.35, pitch: 15 }, { from: 330, mult: 0.75, pitch: 8 }], 410);
  c.star(86, 5); c.star(176, 10); c.star(284, 5);
  c.flagFloor(60).flagFloor(128).flagFloor(248);
  c.goal(425);
  return c;
};

// 7. Speed Run: fast gates and wider hazards.
levels.w3l07 = () => {
  const c = cave(560);
  warmup(c); c.hint(60, 'SPEED!');
  zoneRun(c, [{ from: 62, mult: 1.35, pitch: 15, width: 3 }, { from: 150, mult: 1.35, pitch: 17, width: 4 }, { from: 250, mult: 1, pitch: 12, width: 3 }, { from: 320, mult: 1.35, pitch: 16, width: 3 }], 440);
  c.star(95, 5); c.star(204, 10); c.star(300, 5);
  c.flagFloor(60).flagFloor(148).flagFloor(248);
  c.goal(460);
  return c;
};

// Twin lane hazards by time: alternating lanes and surfaces, with speed gates. zones: [{ from, mult, pitch }].
function twinZones(c, zones, end, first = 0) {
  const pat = [['a', 'floor'], ['b', 'ceil'], ['a', 'ceil'], ['b', 'floor']];
  let k = first;
  zones.forEach((z, zi) => {
    if (z.mult !== undefined && (zi > 0 || z.mult !== 1)) c.pad(z.from, z.mult, 4);
    const zEnd = (zones[zi + 1] ? zones[zi + 1].from : end) - 3;
    for (let h = z.from + 5; h + 2 <= zEnd; h += z.pitch, k++) { const [w, surf] = pat[k % 4]; c.laneSpikes(w, surf, Math.round(h), Math.round(h) + 1); }
  });
}

// 8. Twin Pads: a twin room with speed gates across both lanes.
levels.w3l08 = () => {
  const c = cave(520);
  warmup(c); c.hint(60, 'TWINS!'); c.ceilSpikes(56, 57);
  c.twinRoom(64, 300);
  c.twinPortal(70);
  twinZones(c, [{ from: 74, mult: 1, pitch: 11 }, { from: 130, mult: 1.35, pitch: 15 }, { from: 200, mult: 0.75, pitch: 8 }, { from: 250, mult: 1, pitch: 11 }], 300);
  c.star(120, 5); c.star(196, 13); c.star(262, 1);
  c.flag(75, 13); c.flag(148, 13); c.flag(236, 13);
  tail(c, c.twinExit(300));
  return c;
};

// 9. Switch: Flip, Twin, Flip, Twin, with gates in between.
levels.w3l09 = () => {
  const c = cave(900);
  warmup(c); c.ceilSpikes(56, 57);
  zoneRun(c, [{ from: 62, mult: 1.35, pitch: 15 }], 134);
  c.star(90, 5);
  c.twinRoom(136, 250);
  c.twinPortal(142);
  twinZones(c, [{ from: 144, mult: 1.35, pitch: 15 }], 250);
  c.star(176, 13);
  c.flag(140, 13);
  let e = c.twinExit(250);
  zoneRun(c, [{ from: e, mult: 0.75, pitch: 8 }], e + 64);
  c.flagFloor(e);
  const t0 = e + 68;
  c.twinRoom(t0, t0 + 120);
  c.twinPortal(t0 + 6);
  twinZones(c, [{ from: t0 + 8, mult: 1, pitch: 11 }], t0 + 120, 1);
  c.star(t0 + 60, 1);
  c.flag(t0 + 4, 13);
  e = c.twinExit(t0 + 120);
  c.floorSpikes(e + 8, e + 10).ceilSpikes(e + 18, e + 19).floorSpikes(e + 28, e + 29);
  c.goal(e + 50);
  return c;
};

// 10. Forest Exit: the exam. Gates, a twin room with pads, flip, twin again.
levels.w3l10 = () => {
  const c = cave(1200);
  warmup(c); c.ceilSpikes(56, 57);
  zoneRun(c, [{ from: 62, mult: 1, pitch: 11 }, { from: 130, mult: 1.35, pitch: 15 }, { from: 210, mult: 0.75, pitch: 8 }], 270);
  c.flagFloor(128);
  const t0 = 276;
  c.twinRoom(t0, t0 + 190, [3, 5], [9, 13]);
  c.twinPortal(t0 + 6);
  twinZones(c, [{ from: t0 + 8, mult: 1.35, pitch: 15 }, { from: t0 + 90, mult: 0.75, pitch: 8 }, { from: t0 + 150, mult: 1, pitch: 11 }], t0 + 190);
  c.star(t0 + 50, 5); c.star(t0 + 168, 13);
  c.flag(t0 + 4, 13); c.flag(t0 + 96, 13);
  let e = c.twinExit(t0 + 190);
  zoneRun(c, [{ from: e, mult: 1.35, pitch: 15 }, { from: e + 60, mult: 1, pitch: 11 }], e + 110);
  c.star(e + 80, 5);
  c.goal(e + 130);
  return c;
};

for (const [id, build] of Object.entries(levels)) {
  if (only.length && !only.includes(id)) continue;
  const names = { w3l01: 'Two of Us', w3l02: 'Mirror Mirror', w3l03: 'Odd One Out', w3l04: 'Fireflies', w3l05: 'Fast Lane', w3l06: 'Slow Burn', w3l07: 'Speed Run', w3l08: 'Twin Pads', w3l09: 'Switch', w3l10: 'Forest Exit' };
  writeLevel(id, names[id], build(), { speed: SPEED });
  console.log('wrote', id);
}
