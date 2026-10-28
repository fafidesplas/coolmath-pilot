// Headless math checks (GDD 12): projection, IoU, dial order, key steps, Spin
// stops, nearest solution, drag axes and the generator fingerprint.
//   node tools/simtest.mjs
import { wrap, matrix, apply, keyStep, spinStop, nearestSolution, rotationAngle, dragDirs, pickAxis } from '../src/pose.js';
import { makeFrame, projectBlocks, rasterize, shadowMask, iou, area, matchPct, parsePicture, picturePolys, outlineLoops } from '../src/shadow.js';
import { sculpt, fingerprint, isConnected } from '../src/sculpt.js';
import { parseLevel } from '../src/level.js';
import { LEVELS } from '../levels/index.js';

let failed = 0, passed = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (cond) passed++; else failed++; };
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const vecNear = (a, b, e = 1e-9) => a.every((v, i) => near(v, b[i], e));
const polyArea = p => { let s = 0; for (let i = 0; i < p.length; i += 2) s += p[i] * p[(i + 3) % p.length] - p[(i + 2) % p.length] * p[i + 1]; return s / 2; };
const width = p => { let a = Infinity, b = -Infinity; for (let i = 0; i < p.length; i += 2) { a = Math.min(a, p[i]); b = Math.max(b, p[i]); } return b - a; };

// ---- Projection of a cube ---------------------------------------------------------
{
  const cube = [[0, 0, 0, 0, 0]];
  const f = makeFrame(cube, 64);
  ok(vecNear(f.pivot, [0.5, 0.5, 0.5]) && near(f.R, Math.sqrt(3) / 2), `cube pivot (0.5, 0.5, 0.5), R = √3/2 (${f.R.toFixed(4)})`);
  const p0 = projectBlocks(cube, f.pivot, [0, 0, 0])[0];
  ok(p0.length === 8 && near(polyArea(p0), 1), `front shadow of a cube is a unit square (area ${polyArea(p0).toFixed(4)})`);
  const p45 = projectBlocks(cube, f.pivot, [45, 0, 0])[0];
  ok(near(width(p45), Math.SQRT2) && near(polyArea(p45), Math.SQRT2), `Turn 45°: width √2 (${width(p45).toFixed(4)})`);
  const pt = projectBlocks(cube, f.pivot, [0, 30, 0])[0];
  ok(near(polyArea(pt), Math.cos(Math.PI / 6) + Math.sin(Math.PI / 6)), `Tip 30°: area cos30 + sin30 (${polyArea(pt).toFixed(4)})`);
  const ps = projectBlocks(cube, f.pivot, [0, 0, 45])[0];
  ok(near(polyArea(ps), 1) && near(width(ps), Math.SQRT2), 'Spin 45°: same area, turned like a diamond');
  const m = rasterize([p0], f);
  const expect = (1 / f.cell) ** 2;
  ok(Math.abs(area(m) - expect) / expect < 0.08, `rasterized square ≈ ${expect.toFixed(0)} cells (${area(m)})`);
  const wedge = [[0, 0, 0, 0, 3]];
  const pw = projectBlocks(wedge, makeFrame(wedge).pivot, [0, 0, 0])[0];
  ok(pw.length === 6 && near(polyArea(pw), 0.5), 'front shadow of a wedge is a half-cell triangle');
  const pwBack = projectBlocks(wedge, makeFrame(wedge).pivot, [180, 0, 0])[0];
  ok(near(polyArea(pwBack), 0.5), 'wedge from behind is still a half cell');
}

// ---- IoU identities ---------------------------------------------------------------
{
  const blocks = sculpt(['aab', '.bb', '.c.'], {}, 3, 5);
  const f = makeFrame(blocks);
  const a = shadowMask(blocks, f, [10, 20, 0]);
  const b = shadowMask(blocks, f, [10, 20, 0]);
  ok(iou(a, b) === 1, 'IoU of identical masks = 1');
  const z = new Uint8Array(a.length);
  ok(iou(a, z) === 0, 'IoU with an empty mask = 0');
  ok(near(iou(a, shadowMask(blocks, f, [40, 0, 0])), iou(shadowMask(blocks, f, [40, 0, 0]), a)), 'IoU is symmetric');
  ok(matchPct(0.5, 0.5, 0.9) === 0 && matchPct(0.9, 0.5, 0.9) === 100 && near(matchPct(0.7, 0.5, 0.9), 50, 1e-6) && matchPct(0.2, 0.5, 0.9) === 0, 'match %: 0 at base, 100 at threshold, clamped');
  ok(iou(shadowMask(blocks, f, [0, 0, 0]), shadowMask(blocks, f, [360, 0, 0])) === 1, 'a full turn casts the same shadow');
}

// ---- Dials ------------------------------------------------------------------------
{
  ok(wrap(180) === 180 && wrap(-180) === 180 && wrap(190) === -170 && wrap(-190) === 170 && wrap(540) === 180 && wrap(0) === 0, 'wrap to (−180, 180]');
  const m = matrix(90, 90, 0);
  // Turn first: the front (0,0,1) turns to +x, then Tip leaves it; up (0,1,0) tips to +z.
  ok(vecNear(apply(m, 0, 0, 1), [1, 0, 0], 1e-12) && vecNear(apply(m, 0, 1, 0), [0, 0, 1], 1e-12), 'order Spin·Tip·Turn: Turn 90 then Tip 90');
  const m2 = matrix(0, 90, 0), m3 = matrix(90, 0, 0);
  const tipThenTurn = apply(m3, ...apply(m2, 0, 0, 1));
  ok(!vecNear(tipThenTurn, apply(m, 0, 0, 1), 1e-6), 'the other order gives a different pose (order is fixed, not path-dependent)');
  ok(vecNear(apply(matrix(30, 0, 0), 0, 0, 1), [Math.sin(Math.PI / 6), 0, Math.cos(Math.PI / 6)], 1e-12), '+Turn moves the front to the right');
  ok(apply(matrix(0, 30, 0), 0, 0, 1)[1] < 0, '+Tip tips the front down');
  ok(vecNear(apply(matrix(0, 0, 90), 1, 0, 0), [0, 1, 0], 1e-12), '+Spin turns counterclockwise on the wall');
  ok(near(rotationAngle([0, 0, 0], [90, 0, 0]), 90, 1e-6) && near(rotationAngle([0, 180, 0], [180, 0, 180]), 0, 1e-6), 'rotation angle (Tip 180 = Turn 180 + Spin 180)');
}

// ---- Keyboard steps and Spin stops ------------------------------------------------
{
  ok(keyStep(37, 1) === 45 && keyStep(37, -1) === 30 && keyStep(45, 1) === 60 && keyStep(45, -1) === 30, 'key steps go to the next multiple of 15 (37 → 45, 45 → 60)');
  ok(keyStep(-37, -1) === -45 && keyStep(-37, 1) === -30 && keyStep(180, 1) === 195 && wrap(keyStep(180, 1)) === -165, 'key steps: negatives and past 180');
  ok(spinStop(7) === 0 && spinStop(8) === 15 && spinStop(-173) === 180 && spinStop(-172) === -165 && spinStop(353) === 0, 'Spin stops on 15° notches');
}

// ---- Nearest solution with wrap-around --------------------------------------------
{
  const sols = [[0, 0, 0], [180, 0, 0]];
  let r = nearestSolution([170, 0, 0], sols);
  ok(r.solution === sols[1] && vecNear(r.target, [180, 0, 0]), 'from 170 the nearest is 180');
  r = nearestSolution([-170, 0, 0], sols);
  ok(r.solution === sols[1] && vecNear(r.target, [-180, 0, 0]), 'from −170 it eases the short way to −180 (= 180)');
  r = nearestSolution([-100, 5, 0], [[0, 0, 0]]);
  ok(vecNear(r.target, [0, 0, 0]), 'single solution');
  r = nearestSolution([150, 0, 0], [[-150, 0, 0]]);
  ok(vecNear(r.target, [210, 0, 0]), 'wraps through 180 instead of going 300° round');
}

// ---- Drag axes --------------------------------------------------------------------
{
  const d = dragDirs([0, 0, 0]);
  ok(pickAxis(10, 2, d) === 'turn' && pickAxis(2, -10, d) === 'tip', 'Spin 0: horizontal = Turn, vertical = Tip');
  ok(dragDirs([0, 120, 0]).flip === -1 && dragDirs([0, 90, 0]).flip === 1 && dragDirs([0, -135, 0]).flip === -1, 'Turn flips when upside down (|Tip| > 90)');
  const s = dragDirs([0, 0, 90]);
  ok(pickAxis(0, -10, s) === 'turn' && pickAxis(10, 0, s) === 'tip', 'Spin 90: the arrows turn with the shadow');
}

// ---- Generator fingerprint ----------------------------------------------------------
{
  const pic = ['.aa.', 'abba', 'Dccd'];
  const b1 = sculpt(pic, { '0,2': 'tr' }, 4, 1234), b2 = sculpt(pic, { '0,2': 'tr' }, 4, 1234);
  ok(fingerprint(b1) === fingerprint(b2), 'generator is deterministic');
  ok(fingerprint(b1) === 'fcaeeb55', `generator fingerprint unchanged (${fingerprint(b1)}; update only on purpose)`);
  ok(isConnected(b1), 'generated sculpture is connected');
  const f = makeFrame(b1);
  const { cells } = parsePicture(pic, { '0,2': 'tr' });
  ok(iou(shadowMask(b1, f, [0, 0, 0]), rasterize(picturePolys(cells, f.pivot), f)) === 1, 'front view is exactly the picture');
  const loops = outlineLoops(parsePicture(['aa', 'aa'], {}).cells, [1, 1]);
  ok(loops.length === 1 && loops[0].length === 9, 'outline of a 2×2 square is one loop of 8 edges');
}

// ---- Shipped levels ---------------------------------------------------------------
for (const level of LEVELS) {
  const p = level.parts[0];
  const regen = sculpt(p.picture, p.cuts, p.depth, p.seed);
  ok(fingerprint(regen) === fingerprint(p.blocks), `${level.id} blocks match the generator (${fingerprint(p.blocks)})`);
  const lv = parseLevel(level);
  ok(iou(lv.target, lv.pictureMask) === 1, `${level.id} target is exactly the picture`);
  for (const s of lv.solutions) ok(iou(lv.target, shadowMask(lv.blocks, lv.frame, s)) >= 0.97, `${level.id} solution (${s}) matches`);
  ok(iou(lv.target, shadowMask(lv.blocks, lv.frame, lv.start)) < lv.match, `${level.id} start pose does not match`);
}

// ---- Speed (GDD 12: about 50 µs per mask) ---------------------------------------------
{
  const lv = parseLevel(LEVELS[2]);
  const out = new Uint8Array(64 * 64);
  const t0 = performance.now();
  for (let i = 0; i < 2000; i++) shadowMask(lv.blocks, lv.frame, [i % 360, (i * 7) % 360, 0], out);
  const us = (performance.now() - t0) / 2000 * 1000;
  ok(us < 400, `shadow mask of ${lv.blocks.length} blocks in ${us.toFixed(0)} µs`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
