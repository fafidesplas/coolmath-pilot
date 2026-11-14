// Tile types and edge-connection tables (GDD 3.4, 3.5, 12). Pure data, no DOM.
// Edges: 0 N, 1 E, 2 S, 3 W. A train's heading uses the same numbers (the edge it
// is moving towards). `rot` turns a tile clockwise in 90° steps.
export const N = 0, E = 1, S = 2, W = 3;
export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];
export const opp = e => (e + 2) & 3;

// Switch arms. `rot` is the heading of a train making a facing move on the straight
// branch, so the trunk is the opposite edge. The curved branch turns right (clockwise)
// from that heading, or left when `mirror` is set.
export function switchArms(t) {
  const r = t.rot & 3;
  return { trunk: opp(r), straight: r, curved: t.mirror ? (r + 3) & 3 : (r + 1) & 3 };
}

// Edges a tile connects to its neighbours.
//   straight: rot and the opposite edge      curve: rot and rot+1 (rot 0 = N–E)
//   switch: trunk, straight, curved          station / buffer / depot: just rot
export function tileEdges(t) {
  const r = t.rot & 3;
  switch (t.t) {
    case 'straight': return [r, opp(r)];
    case 'curve': return [r, (r + 1) & 3];
    case 'switch': { const a = switchArms(t); return [a.trunk, a.straight, a.curved]; }
    case 'station': case 'buffer': case 'depot': return [r];
    default: return [];
  }
}

export const isEndTile = t => t.t === 'station' || t.t === 'buffer' || t.t === 'depot';

// The edge a train leaves through after entering `t` through edge `inE`, or -1.
// Switches (GDD 3.5): a facing move (in through the trunk) takes the set branch,
// 0 = straight, 1 = curved; a trailing move (in through a branch) always goes to the
// trunk, whatever the setting (sprung switch, never a crash).
export function exitEdge(t, inE, set) {
  const r = t.rot & 3;
  switch (t.t) {
    case 'straight': return inE === r ? opp(r) : inE === opp(r) ? r : -1;
    case 'curve': { const b = (r + 1) & 3; return inE === r ? b : inE === b ? r : -1; }
    case 'switch': {
      const a = switchArms(t);
      if (inE === a.trunk) return set ? a.curved : a.straight;
      if (inE === a.straight || inE === a.curved) return a.trunk;
      return -1;
    }
    default: return -1;
  }
}
