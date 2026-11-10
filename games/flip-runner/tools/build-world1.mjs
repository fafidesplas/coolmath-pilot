// World 1, Crystal Cave: levels 2–10 (level 1 is built by tools/build-slice.mjs).
//   node tools/build-world1.mjs [id …]      then: node tools/levels.mjs
import { Cave, writeLevel } from './levelkit.mjs';

const only = process.argv.slice(2);
const levels = {};

// 2. Ping Pong: spikes alternate between floor and ceiling in an even rhythm.
levels.w1l02 = () => {
  const c = new Cave(330);
  c.hint(8, 'TAP!');
  // a calm beat: one group every second
  c.floorSpikes(22, 24).ceilSpikes(33, 35).floorSpikes(44, 46).ceilSpikes(55, 57).floorSpikes(66, 68).ceilSpikes(77, 79);
  // faster: every 0.73 s
  c.floorSpikes(92, 93).ceilSpikes(100, 101).floorSpikes(108, 109).ceilSpikes(116, 117).floorSpikes(124, 125).ceilSpikes(132, 133);
  // a star on the ceiling between two floor groups, on the way
  c.floorSpikes(148, 150).ceilSpikes(158, 160).floorSpikes(168, 170);
  c.star(154, 5);
  // the rhythm breaks: two in a row on the same side
  c.floorSpikes(186, 188).floorSpikes(197, 199).ceilSpikes(208, 210).ceilSpikes(219, 221).floorSpikes(230, 232);
  c.star(203, 10);
  // finale: 8-column beat
  c.ceilSpikes(246, 247).floorSpikes(254, 255).ceilSpikes(262, 263).floorSpikes(270, 271).ceilSpikes(278, 279).floorSpikes(286, 287).ceilSpikes(294, 295);
  c.star(274, 5);
  c.flagFloor(110).flagFloor(176).flagFloor(240);
  c.goal(318);
  return c;
};

// 3. Mind the Gap: open sections where flipping at the wrong moment means flying out.
levels.w1l03 = () => {
  const c = new Cave(330);
  c.hint(8, 'TAP!');
  c.floorGapAt(36, 41);                       // be on the ceiling over it
  c.ceilGapAt(54, 59);                        // be on the floor under it
  c.floorGapAt(72, 77).floorSpikes(82, 84);   // gap, then spikes you must flip over
  c.ceilGapAt(96, 102).ceilSpikes(106, 108);
  c.star(100, 10);                            // on the floor under the ceiling gap
  c.flagFloor(112);
  c.floorGapAt(120, 124).ceilGapAt(132, 136).floorGapAt(144, 148).ceilGapAt(156, 160);   // a zigzag of gaps
  c.star(134, 10);
  c.floorGapAt(176, 183).ceilGapAt(192, 199);  // wide ones: no mid-air flipping
  c.flagFloor(166);
  c.floorSpikes(208, 210).ceilSpikes(214, 216).floorGapAt(224, 228).ceilGapAt(236, 240);
  c.star(226, 5);
  c.flagFloor(204);
  c.floorGapAt(252, 256).floorSpikes(262, 263).ceilGapAt(270, 275).ceilSpikes(282, 283).floorGapAt(292, 297);
  c.goal(318);
  return c;
};

// 4. Islands: platforms in the middle of the room; run on top of them or hang under them.
levels.w1l04 = () => {
  const c = new Cave(330);
  c.hint(8, 'TAP!');
  c.floorSpikes(22, 24).ceilSpikes(33, 34);
  // Island A: two thin lanes, spikes on its top and underside
  c.island(44, 66, 7, 8, { top: [[52, 53]], under: [[58, 59]] });
  c.star(56, 6);
  c.cs.add(72); c.cs.add(73); c.cs.add(74);
  // Island B: a roomy lane below, a 1-tile lane above
  c.island(86, 112, 6, 7, { under: [[94, 95], [104, 105]] });
  c.floorSpikes(98, 99);
  c.star(100, 5);
  c.flagFloor(78);
  c.floorSpikes(121, 123);
  // Island C: a roomy lane above with spikes on the island's top, a 1-tile tunnel below
  c.island(134, 158, 8, 9, { top: [[140, 141], [150, 151]] });
  c.ceilSpikes(145, 146);
  c.flagFloor(126);
  // Island D: a zipper, hazards on every surface of both lanes, 6 columns apart in each lane
  c.island(190, 230, 7, 8, { top: [[194, 195], [206, 207], [218, 219]], under: [[203, 204], [217, 218]] });
  c.ceilSpikes(200, 201).ceilSpikes(212, 213).ceilSpikes(224, 225).floorSpikes(196, 197).floorSpikes(210, 211).floorSpikes(224, 225);
  c.star(206, 10);
  c.flagFloor(180);
  c.floorSpikes(164, 166).ceilSpikes(172, 174).floorSpikes(183, 184);
  c.floorSpikes(240, 242).ceilSpikes(250, 252).floorSpikes(260, 262);
  c.island(272, 296, 7, 8, { top: [[280, 281]], under: [[286, 287]] });
  c.goal(318);
  return c;
};

// 5. Tall Room: the corridor changes height; taller rooms need earlier taps.
levels.w1l05 = () => {
  const c = new Cave(330);
  c.hint(8, 'TAP!');
  c.floorSpikes(24, 25).ceilSpikes(36, 37).floorSpikes(48, 49);
  // a 9-tile room
  c.room(60, 109, 2, 11);
  c.floorSpikes(70, 72).ceilSpikes(82, 84).floorSpikes(94, 96);
  c.star(88, 2);
  c.flagFloor(64);
  // back to 6 tiles (the ceiling comes down: be on the floor)
  c.floorSpikes(116, 117).ceilSpikes(124, 125);
  // a 13-tile shaft
  c.room(132, 199, 1, 14);
  c.flagFloor(136);
  c.floorSpikes(148, 150).ceilSpikes(162, 164).floorSpikes(176, 178).ceilSpikes(188, 190);
  c.star(170, 14 - 1);
  // ramp back up to a 9-tile room through 1-tile steps
  const e = c.rampCeil(200, 1, 3); c.rampFloor(200, 14, 12);
  c.room(e, 262, 3, 12);
  c.floorSpikes(216, 218).ceilSpikes(228, 230).floorSpikes(240, 242).ceilSpikes(252, 254);
  c.flagFloor(210);
  c.star(235, 3);
  // finale: quick pairs in a 6-tile room
  c.room(263, 329, 5, 11);
  c.floorSpikes(272, 273).ceilSpikes(279, 280).floorSpikes(286, 287).ceilSpikes(293, 294);
  c.goal(318);
  return c;
};

// 6. Squeeze: the corridor narrows to 2 tiles: quick, short flips.
levels.w1l06 = () => {
  const c = new Cave(330);
  c.hint(8, 'TAP!');
  c.floorSpikes(24, 25).ceilSpikes(36, 37);
  // 2-tile tunnel (the ceiling wall is 3 tiles: be on the floor going in)
  c.room(52, 100, 8, 10);
  c.ceilSpikes(62, 63).floorSpikes(70, 71).ceilSpikes(78, 79).floorSpikes(86, 87).ceilSpikes(94, 95);
  c.flagFloor(46);
  c.star(66, 9);
  // a breather, then a 3-tile tunnel
  c.floorSpikes(112, 113).ceilSpikes(120, 121);
  c.room(130, 190, 7, 10);
  c.ceilSpikes(138, 139).floorSpikes(144, 145).ceilSpikes(150, 151).floorSpikes(156, 157).ceilSpikes(162, 163).floorSpikes(168, 169).ceilSpikes(174, 175);
  c.flagFloor(126);
  c.star(147, 7);
  // a wavy 2-tile tunnel: it shifts one tile at a time. Hazards stay 2+ columns away
  // from every step (a step-up lifts you into the band under the next ceiling).
  const shifts = [[8, 10], [7, 9], [6, 8], [7, 9], [8, 10], [9, 11], [10, 12], [9, 11], [8, 10]];
  shifts.forEach(([t, b], i) => {
    const s0 = 200 + i * 10;
    c.room(s0, s0 + 9, t, b);
    if (i % 2 === 0) c.ceilSpikes(s0 + 4, s0 + 5); else c.floorSpikes(s0 + 4, s0 + 5);
  });
  c.flagFloor(196);
  c.star(237, 7);
  c.room(290, 329, 5, 11);
  c.floorSpikes(298, 300).ceilSpikes(308, 310);
  c.goal(318);
  return c;
};

// 7. Star Bait: the safe route and the star route split visibly around an island.
levels.w1l07 = () => {
  const c = new Cave(330);
  c.hint(8, 'TAP!');
  c.floorSpikes(22, 24).ceilSpikes(33, 34);
  // Split 1: the upper lane has the stars and a busy rhythm, the lower lane is calmer
  c.island(50, 100, 7, 8, { top: [[58, 59], [70, 71], [82, 83], [94, 95]] });
  c.ceilSpikes(64, 65).ceilSpikes(76, 77).ceilSpikes(88, 89);
  c.floorSpikes(60, 61).floorSpikes(90, 91);
  c.star(67, 5);
  c.flagFloor(44);
  c.floorSpikes(108, 110).ceilSpikes(118, 119).floorSpikes(129, 130);
  c.flagFloor(126);
  // Split 2: a 1-tile tunnel with a star inside whose exit is a trap
  c.island(140, 190, 8, 9, { top: [[148, 149], [160, 161], [172, 173], [184, 185]] });
  c.ceilSpikes(154, 155).ceilSpikes(166, 167).ceilSpikes(178, 179);
  c.star(175, 10);
  c.floorSpikes(197, 198).ceilSpikes(206, 207);
  c.flagFloor(134);
  c.flagFloor(212);
  // Finale: a star above a run of floor spikes, a star in a gap
  c.floorSpikes(224, 232).floorSpikes(246, 248).ceilSpikes(256, 258).floorGapAt(266, 272).ceilSpikes(282, 284).floorSpikes(292, 294);
  c.star(228, 5);
  c.goal(318);
  return c;
};

// 8. Zigzag: double flips. Land and flip again right away.
levels.w1l08 = () => {
  const c = new Cave(330);
  c.hint(8, 'TAP!');
  c.floorSpikes(22, 24).ceilSpikes(33, 34);
  // a 4-tile zigzag: hazards alternate every 7 columns
  c.room(44, 130, 6, 10);
  for (let i = 0, a = 52; a < 126; i++, a += 7) (i % 2 ? c.ceilSpikes(a, a + 1) : c.floorSpikes(a, a + 1));
  c.star(63, 9);
  c.star(98, 6);
  c.flagFloor(46);
  // a breather
  c.floorSpikes(140, 142).ceilSpikes(150, 152);
  c.flagFloor(136);
  // a 5-tile zigzag in pairs
  c.room(160, 250, 6, 11);
  for (let i = 0, a = 168; a < 246; i++, a += 7) { (i % 2 ? c.ceilSpikes(a, a + 1) : c.floorSpikes(a, a + 1)); }
  c.star(206, 10);
  c.flagFloor(164);
  // out, then a short double zigzag
  c.room(251, 329, 5, 11);
  c.floorSpikes(262, 263).ceilSpikes(268, 269).floorSpikes(274, 275).ceilSpikes(280, 281).floorSpikes(286, 287).ceilSpikes(292, 293);
  c.flagFloor(256);
  c.goal(318);
  return c;
};

// 9. Long Drop: tall shafts with spikes on the far side: time when you leave.
levels.w1l09 = () => {
  const c = new Cave(330);
  c.hint(8, 'TAP!');
  c.floorSpikes(22, 24).ceilSpikes(33, 34);
  // shaft 1: 13 tiles tall, hazards 12 columns apart
  c.floorSpikes(44, 46);
  c.room(54, 150, 1, 14);
  c.flagFloor(58);
  for (let i = 0, a = 70; a < 146; i++, a += 12) (i % 2 ? c.ceilSpikes(a, a + 3) : c.floorSpikes(a, a + 3));
  c.star(88, 13);
  c.star(112, 1);
  // out of the shaft through 1-tile steps
  const e = c.rampCeil(151, 1, 5); c.rampFloor(151, 14, 11);
  c.room(e, 185, 5, 11);
  c.floorSpikes(170, 172).ceilSpikes(178, 180);
  c.flagFloor(166);
  // shaft 2: 11 tiles, closer hazards
  c.room(190, 290, 3, 14);
  c.flagFloor(194);
  for (let i = 0, a = 204; a < 284; i++, a += 10) (i % 2 ? c.ceilSpikes(a, a + 2) : c.floorSpikes(a, a + 2));
  c.star(235, 13);
  const e2 = c.rampCeil(291, 3, 5); c.rampFloor(291, 14, 11);
  c.room(e2, 329, 5, 11);
  c.floorSpikes(306, 308);
  c.goal(318);
  return c;
};

// 10. Cave Exit: the world's exam, ~50 s, three flags. One of everything.
levels.w1l10 = () => {
  const c = new Cave(600);
  c.hint(8, 'TAP!');
  c.floorSpikes(22, 24);
  // ping pong
  c.ceilSpikes(34, 35).floorSpikes(42, 43).ceilSpikes(50, 51).floorSpikes(58, 59).ceilSpikes(66, 67).floorSpikes(74, 75).ceilSpikes(82, 83).floorSpikes(90, 91);
  // gaps
  c.floorGapAt(104, 109).ceilGapAt(118, 123).floorGapAt(132, 136).floorSpikes(142, 143).ceilGapAt(150, 154);
  c.star(106, 5);
  c.flagFloor(164);
  // an island
  c.island(172, 218, 7, 8, { top: [[180, 181], [192, 193], [204, 205]], under: [[186, 187], [198, 199], [210, 211]] });
  c.ceilSpikes(174, 175).ceilSpikes(188, 189).ceilSpikes(200, 201).floorSpikes(180, 181).floorSpikes(192, 193).floorSpikes(206, 207);
  // a tall room, then back down through steps
  c.room(228, 299, 2, 11);
  c.floorSpikes(238, 240).ceilSpikes(250, 252).floorSpikes(262, 264).ceilSpikes(274, 276).floorSpikes(286, 288);
  c.star(256, 2);
  c.rampCeil(300, 2, 5);
  c.floorSpikes(314, 316);
  c.flagFloor(322);
  // a squeeze (enter on the floor)
  c.room(330, 402, 8, 10);
  for (let i = 0, a = 338; a < 398; i++, a += 8) (i % 2 ? c.floorSpikes(a, a + 1) : c.ceilSpikes(a, a + 1));
  c.star(358, 9);
  // a zigzag
  c.floorSpikes(414, 416);
  c.room(424, 480, 6, 10);
  for (let i = 0, a = 432; a < 476; i++, a += 7) (i % 2 ? c.ceilSpikes(a, a + 1) : c.floorSpikes(a, a + 1));
  c.flagFloor(420);
  // a long drop
  c.room(494, 560, 1, 14);
  for (let i = 0, a = 504; a < 556; i++, a += 12) (i % 2 ? c.ceilSpikes(a, a + 3) : c.floorSpikes(a, a + 3));
  c.rampCeil(561, 1, 5); c.rampFloor(561, 14, 11);
  c.floorSpikes(576, 577);
  c.goal(586);
  return c;
};

for (const [id, build] of Object.entries(levels)) {
  if (only.length && !only.includes(id)) continue;
  const names = { w1l02: 'Ping Pong', w1l03: 'Mind the Gap', w1l04: 'Islands', w1l05: 'Tall Room', w1l06: 'Squeeze', w1l07: 'Star Bait', w1l08: 'Zigzag', w1l09: 'Long Drop', w1l10: 'Cave Exit' };
  writeLevel(id, names[id], build());
  console.log('wrote', id);
}
