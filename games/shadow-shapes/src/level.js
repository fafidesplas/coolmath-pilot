// Level module → everything the game needs (GDD 6 data format). Pure.
import { makeFrame, parsePicture, picturePolys, outlineLoops, shadowMask, area, rasterize } from './shadow.js';
import { MASK_N, TARGET_AREA, MAX_CELL_PX } from './config.js';

export function parseLevel(level) {
  const part = level.parts[0];
  if (!part.blocks || !part.blocks.length) throw new Error(`${level.id}: no blocks (run tools/levelcheck.mjs --write)`);
  const blocks = part.blocks;
  const frame = makeFrame(blocks, MASK_N);
  const { cells, W, H } = parsePicture(part.picture, part.cuts);
  const polys = picturePolys(cells, frame.pivot);
  const solutions = part.solutions || [[0, 0, 0]];
  const target = shadowMask(blocks, frame, solutions[0]);
  const axes = { turn: level.axes.includes('turn'), tip: level.axes.includes('tip'), spin: level.axes.includes('spin') };
  return {
    id: level.id,
    name: level.name,
    par: level.par,
    anim: level.anim || 'bob',
    axes,
    blocks,
    frame,
    cells, W, H,
    polys,
    loops: outlineLoops(cells, frame.pivot),
    target,
    targetArea: area(target),
    pictureMask: rasterize(polys, frame),
    match: part.match,
    base: part.base,
    solutions,
    start: part.start.slice(),
    cellPx: Math.min(MAX_CELL_PX, TARGET_AREA / Math.max(frame.size[0], frame.size[1])),
  };
}
