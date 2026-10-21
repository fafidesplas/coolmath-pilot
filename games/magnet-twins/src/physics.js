// Axis-separated sweeps for boxes against tiles, gates and other bodies.
// Every move clamps at the first obstacle in its path, so nothing tunnels.
import { T } from './config.js';
import { TILE, tileAt } from './level.js';

const EPS = 0.01;
const hit = { body: null, tile: false };

// Solid span of a tile as [top, bottom] in px, or null if it is not solid.
function tileSpan(t, ty) {
  if (t === TILE.SOLID || t === TILE.METAL) return [ty * T, ty * T + T];
  return null;   // spikes are not solid: robots touching them reset, crates sit over them
}

// Move b horizontally by dx. Returns the hit record (body or tile) or null.
export function moveX(w, b, dx, skip = null) {
  if (dx === 0) return null;
  const top = b.y + EPS, bot = b.y + b.h - EPS;
  let limit, found = false;
  hit.body = null; hit.tile = false;

  if (dx > 0) {
    const edge = b.x + b.w;
    limit = edge + dx;
    const c0 = Math.floor((edge - EPS) / T), c1 = Math.floor(limit / T);
    for (let c = Math.max(c0, 0); c <= c1; c++) {
      if (c * T < edge - EPS || c * T >= limit) continue;
      for (let r = Math.floor(top / T); r <= Math.floor(bot / T); r++) {
        const s = tileSpan(tileAt(w.tiles, c, r), r);
        if (s && s[0] < bot && s[1] > top) { limit = c * T; hit.tile = true; hit.body = null; found = true; break; }
      }
    }
    for (const o of w.obstacles) {
      if (o === b || o === skip || o.h <= 0) continue;
      if (o.y >= bot || o.y + o.h <= top) continue;
      if (o.x >= edge - EPS && o.x < limit) { limit = o.x; hit.body = o; hit.tile = false; found = true; }
    }
    b.x = limit - b.w;
  } else {
    const edge = b.x;
    limit = edge + dx;
    const c0 = Math.floor((edge + EPS) / T) - 1, c1 = Math.floor(limit / T);
    for (let c = c0; c >= Math.max(c1, -1); c--) {
      const right = c * T + T;
      if (right > edge + EPS || right <= limit) continue;
      for (let r = Math.floor(top / T); r <= Math.floor(bot / T); r++) {
        const s = tileSpan(tileAt(w.tiles, c, r), r);
        if (s && s[0] < bot && s[1] > top) { limit = right; hit.tile = true; hit.body = null; found = true; break; }
      }
    }
    for (const o of w.obstacles) {
      if (o === b || o === skip || o.h <= 0) continue;
      if (o.y >= bot || o.y + o.h <= top) continue;
      const right = o.x + o.w;
      if (right <= edge + EPS && right > limit) { limit = right; hit.body = o; hit.tile = false; found = true; }
    }
    b.x = limit;
  }
  return found ? hit : null;
}

// Move b vertically by dy. When moving up, bodies riding on b are not obstacles
// (they get carried afterwards).
export function moveY(w, b, dy) {
  if (dy === 0) return null;
  const left = b.x + EPS, right = b.x + b.w - EPS;
  let limit, found = false;
  hit.body = null; hit.tile = false;

  if (dy > 0) {
    const edge = b.y + b.h;
    limit = edge + dy;
    for (let r = Math.floor((edge - EPS) / T); r <= Math.floor(limit / T); r++) {
      for (let c = Math.floor(left / T); c <= Math.floor(right / T); c++) {
        const s = tileSpan(tileAt(w.tiles, c, r), r);
        if (s && s[0] >= edge - EPS && s[0] < limit) { limit = s[0]; hit.tile = true; hit.body = null; found = true; }
      }
    }
    for (const o of w.obstacles) {
      if (o === b || o.h <= 0) continue;
      if (o.x >= right || o.x + o.w <= left) continue;
      if (o.y >= edge - EPS && o.y < limit) { limit = o.y; hit.body = o; hit.tile = false; found = true; }
    }
    b.y = limit - b.h;
  } else {
    const edge = b.y;
    limit = edge + dy;
    for (let r = Math.floor((edge + EPS) / T); r >= Math.floor(limit / T); r--) {
      for (let c = Math.floor(left / T); c <= Math.floor(right / T); c++) {
        const s = tileSpan(tileAt(w.tiles, c, r), r);
        if (s && s[1] <= edge + EPS && s[1] > limit) { limit = s[1]; hit.tile = true; hit.body = null; found = true; }
      }
    }
    for (const o of w.obstacles) {
      if (o === b || o.h <= 0 || o.ground === b) continue;
      if (o.x >= right || o.x + o.w <= left) continue;
      const bottom = o.y + o.h;
      if (bottom <= edge + EPS && bottom > limit) { limit = bottom; hit.body = o; hit.tile = false; found = true; }
    }
    b.y = limit;
  }
  return found ? hit : null;
}

export function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
