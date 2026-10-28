// The level rules of GDD 6 ("Authoring"), on the same pure modules as the game.
//   node tools/levelcheck.mjs            check every level, print the report
//   node tools/levelcheck.mjs --write    build each sculpture from its seed (trying
//                                        the next seeds until the rules pass) and
//                                        write blocks, match, base and solutions
//   node tools/levelcheck.mjs w1l02      only that level
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sculpt, isConnected, fingerprint } from '../src/sculpt.js';
import { makeFrame, shadowMask, iou, parsePicture, picturePolys, rasterize, matchPct } from '../src/shadow.js';
import { rotationAngle, wrap, nearestSolution } from '../src/pose.js';
import { LEVEL_RULES as RULES, MASK_N } from '../src/config.js';
import { LEVELS } from '../levels/index.js';

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const only = args.filter(a => !a.startsWith('--'));
const AX = ['turn', 'tip', 'spin'];

const r2 = v => Math.round(v * 100) / 100;
const floor2 = v => Math.floor(v * 100 + 1e-9) / 100;

// Every pose on a grid over the allowed dials; the other dials stay at 0 (the solution value).
function grid(dials, step) {
  const vals = [];
  for (let v = -180 + step; v <= 180; v += step) vals.push(v);
  const out = [];
  const rec = (i, pose) => {
    if (i === dials.length) { out.push(pose.slice()); return; }
    for (const v of vals) { pose[dials[i]] = v; rec(i + 1, pose); }
    pose[dials[i]] = 0;
  };
  rec(0, [0, 0, 0]);
  return { out, vals };
}

// Directions of the window circle around a solution, in the allowed dials.
function circleDirs(dials) {
  if (dials.length === 1) return [[1], [-1]];
  if (dials.length === 2) return Array.from({ length: 24 }, (_, i) => [Math.cos(i * Math.PI / 12), Math.sin(i * Math.PI / 12)]);
  const d = [];
  for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) {
    if (!x && !y && !z) continue;
    const l = Math.hypot(x, y, z);
    d.push([x / l, y / l, z / l]);
  }
  return d;
}

function holesOk(cells, W, H) {
  // Empty cells inside the picture that can't reach the border must form holes
  // of at least 2×2 cells (GDD 6, rule 2).
  const filled = new Set(cells.map(c => `${c.x},${c.y}`));
  const seen = new Set();
  const errs = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = `${x},${y}`;
    if (filled.has(k) || seen.has(k)) continue;
    const comp = [], stack = [[x, y]];
    let border = false;
    seen.add(k);
    while (stack.length) {
      const [cx, cy] = stack.pop();
      comp.push([cx, cy]);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy, nk = `${nx},${ny}`;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) { border = true; continue; }
        if (filled.has(nk) || seen.has(nk)) continue;
        seen.add(nk); stack.push([nx, ny]);
      }
    }
    if (border) continue;
    const set = new Set(comp.map(p => `${p[0]},${p[1]}`));
    const square = comp.some(([cx, cy]) => set.has(`${cx + 1},${cy}`) && set.has(`${cx},${cy + 1}`) && set.has(`${cx + 1},${cy + 1}`));
    if (!square) errs.push(`hole at ${comp[0]} is smaller than 2×2`);
  }
  return errs;
}

export function checkPart(level, part, blocks) {
  const errors = [];
  const dials = AX.map((a, i) => (level.axes.includes(a) ? i : -1)).filter(i => i >= 0);
  const frame = makeFrame(blocks, MASK_N);
  const { cells, W, H } = parsePicture(part.picture, part.cuts);
  const mask = pose => shadowMask(blocks, frame, pose);

  // Rule 2: exact front view, connected, block budget, holes.
  if (blocks.length > RULES.maxBlocks) errors.push(`${blocks.length} blocks (max ${RULES.maxBlocks})`);
  if (!isConnected(blocks)) errors.push('sculpture is not connected');
  const colOf = new Map(cells.map(c => [`${c.x},${c.y}`, c]));
  const cols = new Set();
  for (const b of blocks) {
    const c = colOf.get(`${b[0]},${b[1]}`);
    if (!c || c.color !== b[3] || c.shape !== b[4]) { errors.push(`block ${b} is not in its picture column`); break; }
    cols.add(`${b[0]},${b[1]}`);
  }
  if (cols.size !== cells.length) errors.push('some picture cells have no block');
  const target = mask([0, 0, 0]);
  const pic = rasterize(picturePolys(cells, frame.pivot), frame);
  if (iou(target, pic) !== 1) errors.push(`front view differs from the picture (IoU ${iou(target, pic).toFixed(3)})`);
  errors.push(...holesOk(cells, W, H));

  // Rule 1: picture symmetry.
  const sym = {};
  for (const [name, pose] of [['mirror', [180, 0, 0]], ['upside-down', [0, 180, 0]], ['half-turn', [0, 0, 180]]]) {
    const v = iou(target, mask(pose));
    sym[name] = r2(v);
    if (v < RULES.symHigh && v > RULES.symLow) errors.push(`${name} image matches at ${v.toFixed(2)} (must be ≥ ${RULES.symHigh} or ≤ ${RULES.symLow})`);
  }

  // Rule 4: all solutions on the 15° grid.
  const solutions = grid(dials, 15).out.filter(p => iou(target, mask(p)) >= RULES.solution).map(p => p.map(v => (v === 0 ? 0 : v)));
  if (!solutions.some(s => s.every(v => v === 0))) errors.push('the picture pose is not a solution');

  // Rule 3: threshold from the 6° circle around each solution.
  let low = 1;
  for (const s of solutions) {
    for (const d of circleDirs(dials)) {
      const p = s.slice();
      dials.forEach((di, k) => { p[di] = s[di] + d[k] * RULES.window; });
      low = Math.min(low, iou(target, mask(p)));
    }
  }
  const match = Math.min(RULES.cap, floor2(low));
  if (match < RULES.minMatch) errors.push(`threshold ${match} under ${RULES.minMatch}: picture too thin`);

  // Sweep (3° steps): base = median IoU; rule 5, no false near-matches.
  const { vals } = grid([], RULES.sweepStep);
  const sweep = grid(dials, RULES.sweepStep).out;
  const values = sweep.map(p => iou(target, mask(p)));
  const base = r2([...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]);
  const n = vals.length, near = match - RULES.nearMargin;
  const idx = p => dials.reduce((acc, di) => acc * n + vals.indexOf(p[di]), 0);
  const region = new Int32Array(values.length).fill(-1);
  let regions = 0, falseRegions = 0, worstFalse = 0;
  const isSolution = new Set(solutions.map(s => idx(s)));
  for (let i = 0; i < values.length; i++) {
    if (values[i] < near || region[i] >= 0) continue;
    let hasSol = false, peak = 0;
    const stack = [i];
    region[i] = regions;
    while (stack.length) {
      const c = stack.pop();
      if (isSolution.has(c)) hasSol = true;
      peak = Math.max(peak, values[c]);
      // neighbors with wrap-around in each dial
      const digits = [];
      let rest = c;
      for (let k = dials.length - 1; k >= 0; k--) { digits[k] = rest % n; rest = Math.floor(rest / n); }
      for (let k = 0; k < dials.length; k++) {
        for (const dd of [-1, 1]) {
          const dg = digits.slice();
          dg[k] = (dg[k] + dd + n) % n;
          const j = dg.reduce((acc, v) => acc * n + v, 0);
          if (values[j] >= near && region[j] < 0) { region[j] = regions; stack.push(j); }
        }
      }
    }
    if (!hasSol) { falseRegions++; worstFalse = Math.max(worstFalse, peak); }
    regions++;
  }
  if (falseRegions) errors.push(`${falseRegions} near-match region(s) without a solution (peak IoU ${worstFalse.toFixed(2)})`);

  // Rule 6: the start pose.
  const start = part.start;
  if (start.some(v => v % 15 !== 0)) errors.push('start is not on the 15° grid');
  if (Math.abs(wrap(start[1])) === 90) errors.push('start Tip is ±90°');
  AX.forEach((a, i) => { if (!dials.includes(i) && start[i] !== 0) errors.push(`start ${a} must stay at its solution value 0`); });
  const minAngle = Math.min(...solutions.map(s => rotationAngle(start, s)));
  if (minAngle < RULES.startMinAngle) errors.push(`start is only ${minAngle.toFixed(0)}° from a solution`);
  const startPct = matchPct(iou(target, mask(start)), base, match);
  if (startPct > RULES.startMaxPct) errors.push(`start match ${startPct.toFixed(0)}% (max ${RULES.startMaxPct}%)`);

  // Rule 8: report. Window per direction from the nearest solution.
  const near0 = nearestSolution(start, solutions);
  const windows = {};
  for (const di of dials) {
    for (const sgn of [-1, 1]) {
      let d = 0;
      while (d < 60) {
        const p = near0.solution.slice();
        p[di] += sgn * (d + 0.25);
        if (iou(target, mask(p)) < match) break;
        d += 0.25;
      }
      windows[`${AX[di]}${sgn > 0 ? '+' : '-'}`] = d;
    }
  }
  const keySteps = near0.target.reduce((s, v, i) => s + Math.abs(Math.round((v - start[i]) / 15)), 0);
  const minWindow = Math.min(...Object.values(windows));
  return {
    errors,
    result: { match, base, solutions },
    report: {
      blocks: blocks.length,
      fingerprint: fingerprint(blocks),
      size: frame.size.join('×'),
      match, base, solutions: solutions.map(s => `(${s.join(',')})`).join(' '),
      windows, sym, startPct: Math.round(startPct), startAngle: Math.round(minAngle), keySteps, regions,
      difficulty: r2(keySteps * dials.length / Math.max(1, minWindow)),
    },
  };
}

function serialize(level) {
  const p = level.parts[0];
  const blocks = p.blocks.map(b => JSON.stringify(b)).join(', ');
  const lines = [
    `// ${level.name} (GDD 6). Picture, cuts, seed, depth and start are hand-made;`,
    '// blocks, match, base and solutions are written by tools/levelcheck.mjs --write.',
    'export default {',
    `  "id": ${JSON.stringify(level.id)},`,
    `  "name": ${JSON.stringify(level.name)},`,
    `  "axes": ${JSON.stringify(level.axes)},`,
    `  "par": ${level.par},`,
    `  "anim": ${JSON.stringify(level.anim)},`,
    '  "parts": [{',
    '    "picture": [',
    p.picture.map(r => `      ${JSON.stringify(r)}`).join(',\n'),
    '    ],',
    `    "cuts": ${JSON.stringify(p.cuts)},`,
    `    "seed": ${p.seed},`,
    `    "depth": ${p.depth},`,
    `    "start": ${JSON.stringify(p.start)},`,
    `    "at": ${JSON.stringify(p.at || [0, 0])},`,
    `    "blocks": [${blocks}],`,
    `    "match": ${p.match},`,
    `    "base": ${p.base},`,
    `    "solutions": ${JSON.stringify(p.solutions)}`,
    '  }],',
    `  "side": ${JSON.stringify(level.side ?? null)}`,
    '};',
    '',
  ];
  return lines.join('\n');
}

let failures = 0;
const t0 = Date.now();
for (const level of LEVELS) {
  if (only.length && !only.includes(level.id)) continue;
  const part = level.parts[0];
  let res, blocks, seed = part.seed;
  if (WRITE) {
    for (let tries = 0; tries < 60; tries++, seed++) {
      blocks = sculpt(part.picture, part.cuts, part.depth, seed);
      res = checkPart(level, part, blocks);
      if (!res.errors.length) break;
      console.log(`  ${level.id} seed ${seed}: ${res.errors.join('; ')}`);
    }
    if (!res.errors.length) {
      Object.assign(part, { seed, blocks, ...res.result });
      writeFileSync(fileURLToPath(new URL(`../levels/${level.id}.js`, import.meta.url)), serialize(level));
    }
  } else {
    blocks = part.blocks || [];
    res = checkPart(level, part, blocks);
    const regen = sculpt(part.picture, part.cuts, part.depth, part.seed);
    if (fingerprint(regen) !== fingerprint(blocks)) res.errors.push('stored blocks differ from the generator (seed or generator changed)');
    const r = res.result;
    if (r.match !== part.match || r.base !== part.base || JSON.stringify(r.solutions) !== JSON.stringify(part.solutions)) {
      res.errors.push(`stored match/base/solutions (${part.match}, ${part.base}, ${JSON.stringify(part.solutions)}) differ from computed (${r.match}, ${r.base}, ${JSON.stringify(r.solutions)})`);
    }
  }
  const ok = !res.errors.length;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${level.id} ${level.name} (seed ${WRITE ? seed : part.seed})`);
  console.log('      ' + JSON.stringify(res.report));
  for (const e of res.errors) console.log('      ! ' + e);
}
console.log(`${failures ? 'FAILED' : 'All levels pass'} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(failures ? 1 : 0);
