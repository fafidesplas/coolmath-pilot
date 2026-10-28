// Turns a level module (GDD 6, level data format) into what the sim, the build
// tools and the renderer need. Grid cells, y down. No DOM.
import { STARS, UNLOCK, MATERIAL_ORDER, DRIVE } from './config.js';

export function parseLevel(data) {
  const terrain = data.terrain.map(p => p.map(([x, y]) => [x, y]));
  // Ground segments: every terrain edge (wheels collide with them, GDD 3.6).
  const ground = [];
  for (const poly of terrain) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      ground.push([a[0], a[1], b[0], b[1]]);
    }
  }
  // The two banks: the polygons touching the left and the right edge.
  const left = terrain.find(p => p.some(q => q[0] <= 0)) || terrain[0];
  const right = terrain.find(p => p.some(q => q[0] >= 32)) || terrain[terrain.length - 1];
  const topOf = p => Math.min(...p.map(q => q[1]));
  const leftTop = topOf(left), rightTop = topOf(right);
  const gapL = Math.max(...left.filter(q => q[1] === leftTop).map(q => q[0]));
  const gapR = Math.min(...right.filter(q => q[1] === rightTop).map(q => q[0]));
  const ba = data.buildArea;
  const levelNo = data.number || 1;
  const materials = (data.materials || MATERIAL_ORDER.filter(m => UNLOCK[m] <= levelNo)).slice();
  return {
    id: data.id,
    name: data.name,
    terrain,
    ground,
    water: data.water ?? null,
    anchors: data.anchors.map(([x, y]) => [x, y]),
    buildArea: { x: ba[0], y: ba[1], w: ba[2], h: ba[3] },
    noBuild: (data.noBuild || []).map(z => ({ x: z.rect[0], y: z.rect[1], w: z.rect[2], h: z.rect[3], kind: z.kind })),
    prebuilt: data.prebuilt || [],
    materials,
    vehicles: data.vehicles.slice(),
    flag: data.flag,
    gapL, gapR, leftTop, rightTop,
    lowerTop: Math.max(leftTop, rightTop),
    reference: data.reference,
    budget: data.budget,
    target: data.target,
    mirror: !!data.mirror,
    mirrorX2: gapL + gapR,          // mirror line × 2 (x' = mirrorX2 − x)
    startX: data.start ?? gapL - DRIVE.startBefore,  // front wheel of the first vehicle (GDD 3.5)
    startY: data.startY ?? leftTop,   // ground under it
    hint: data.hint || '',
    hintMembers: data.hintMembers || [],
    tutorial: data.tutorial || null,
  };
}

// Star thresholds from the reference cost (GDD 3.9).
export function thresholds(reference, budgetFactor = STARS.budget) {
  return {
    target: Math.ceil(reference * STARS.target / 5000) * 50,      // integer math: no rounding surprises
    budget: Math.ceil(reference * budgetFactor / 10000) * 100,
  };
}

export function starsFor(cost, lv) {
  return cost <= lv.target ? 3 : cost <= lv.budget ? 2 : 1;
}
