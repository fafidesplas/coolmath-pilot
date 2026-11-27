// Sprites (GDD 9): every sprite loads from its Aseprite sheet (SHEETS and
// the world sheets below). Each art pixel is CELL×CELL logical px, with a
// 1 cell Night Ink outline.
// Every sprite canvas has a 1 cell margin for the outline: draw it at
// (x - MARGIN, y + oy - MARGIN), where oy is the sprite's own offset.
import { CELL, CACTUS_OY } from './art.js';

export const PAL = {
  ink: '#1B2340', sand: '#F2C879', orange: '#F08A24', green: '#3FA34D', slate: '#5A6B7D', cream: '#FFF6E0',
};
export const MARGIN = CELL;
function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

// A canvas CELL times bigger, crisp.
export function up(src) {
  const [c, g] = canvas(src.width * CELL, src.height * CELL);
  g.imageSmoothingEnabled = false;
  g.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

// A night rim (GDD 3.6): the outlined shape grown by 1 cell, in Egg Cream.
// Draw it 1 cell further up and left than the sprite, under it, so only the ring shows.
function rim(small) {
  const [out, o] = canvas(small.width + 2, small.height + 2);
  for (let dy = 0; dy <= 2; dy++) for (let dx = 0; dx <= 2; dx++) if (dx !== 1 || dy !== 1) o.drawImage(small, dx, dy);
  o.globalCompositeOperation = 'source-in';
  o.fillStyle = PAL.cream;
  o.fillRect(0, 0, out.width, out.height);
  return up(out);
}

// The sprite filled with Night Ink.
function silhouette(img) {
  const [c, g] = canvas(img.width, img.height);
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = PAL.ink;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

// ---- Aseprite sheets (art/aseprite, exported by tools/export-sprites.sh) ----
// One horizontal strip per sprite set, with tags. Runner sheets are 30×25 art
// px frames with two slices: 'stand' (24×25) and 'slide' (30×12); world
// sheets (cacti, pterodactyl, eggs...) are their own size, no slices. Every
// frame includes the 1 px outline margin.
const SHEETS = ['trex', 'velociraptor', 'pachycephalosaurus', 'parasaurolophus', 'hadrosaur', 'ceratosaurus', 'megalosaurus', 'therizinosaurus', 'allosaurus', 'spinosaurus'];
const OY = { stand: 1, slide: 5 };   // px below the footprint's top

function loadImage(url) {
  return new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => fail(new Error(`can't load ${url}`));
    img.src = url;
  });
}

// { tag: [small canvas at 1 px per art px, ...] }; a runner frame has .kind.
async function loadSheet(name) {
  const url = ext => new URL(`../assets/sprites/${name}.${ext}`, import.meta.url).href;
  const [img, data] = await Promise.all([loadImage(url('png')), fetch(url('json')).then(r => r.json())]);
  const slice = Object.fromEntries((data.meta.slices || []).map(s => [s.name, s.keys[0].bounds]));
  const tags = {};
  // A 9-slice's fixed borders, in art px: { left, top, right, bottom }.
  const nine = (data.meta.slices || []).find(s => s.keys[0].center)?.keys[0];
  if (nine) {
    const { bounds: b, center: c } = nine;
    Object.defineProperty(tags, 'nine', { value: { left: c.x, top: c.y, right: b.w - c.x - c.w, bottom: b.h - c.y - c.h } });
  }
  for (const t of data.meta.frameTags) {
    const kind = slice.stand ? (t.name.startsWith('slide') ? 'slide' : 'stand') : null;
    tags[t.name] = [];
    for (let i = t.from; i <= t.to; i++) {
      const f = data.frames[i].frame, b = kind ? slice[kind] : { x: 0, y: 0, w: f.w, h: f.h };
      const [c, g] = canvas(b.w, b.h);
      g.drawImage(img, f.x + b.x, f.y + b.y, b.w, b.h, 0, 0, b.w, b.h);
      c.kind = kind;
      tags[t.name].push(c);
    }
  }
  return tags;
}

// A sheet frame as a game sprite: scaled up, with its offset and night rim.
function sheetSprite(small, oy, withRim) {
  const img = up(small);
  img.oy = oy;
  if (withRim) img.rim = rim(small);
  return img;
}

function sheetRunner(T) {
  const one = c => sheetSprite(c, OY[c.kind]);
  const jump = one(T.jump[0]);
  return {
    run: T.run.map(one), jump, crash: one(T.crash[0]), sleep: one(T.sleep[0]),
    slide: T.slide.map(one), slideCrash: one(T.slideCrash[0]),
    shadow: silhouette(jump),
  };
}

const runners = Object.fromEntries(await Promise.all(SHEETS.map(async id => [id, sheetRunner(await loadSheet(id))])));

const [cactusSmall, cactusLarge, ptero, egg, goldEgg, mount, hatchEgg] = await Promise.all([
  loadSheet('cactus-small').then(T => sheetSprite(T.idle[0], CACTUS_OY['cactus-small'], true)),
  loadSheet('cactus-large').then(T => sheetSprite(T.idle[0], CACTUS_OY['cactus-large'], true)),
  loadSheet('ptero').then(T => T.flap.map(c => sheetSprite(c, 0, true))),
  loadSheet('egg').then(T => T.glint.map(c => sheetSprite(c, 0, true))),
  loadSheet('gold-egg').then(T => T.glint.map(c => sheetSprite(c, 0, true))),
  loadSheet('mount').then(T => T.flap.map(c => sheetSprite(c, 0))),
  loadSheet('hatch-egg').then(T => ({
    stages: T.stage.map(c => sheetSprite(c, 0)),
    left: sheetSprite(T.left[0], 0), right: sheetSprite(T.right[0], 0), bottom: sheetSprite(T.bottom[0], 0),
  })),
]);

// Background layers (GDD 3.6), at art resolution (1 px per art px); render.js
// scales them up and makes the night versions.
const BG = ['sky', 'stars', 'sun', 'moon', 'clouds', 'mesas', 'dunes', 'ground'];
const bg = Object.fromEntries(await Promise.all(BG.map(async id => [id, await loadSheet(`bg-${id}`)])));

// Buttons (GDD 8): 9-slice frames per color, [normal, pressed]; icon glyphs.
const [button, icons] = await Promise.all([loadSheet('ui-button'), loadSheet('ui-icons')]);

// Header font (GDD 8): one glyph per tag, left-aligned in its cell. adv is
// the glyph's width with its outline, in art px: the next glyph starts there.
// The font is Rubik Dirt (Pixel), art/aseprite/ui/font-header.lua.
const reader = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
async function loadFont(name) {
  return Object.fromEntries(Object.entries(await loadSheet(name)).map(([k, [small]]) => {
    reader.canvas.width = small.width; reader.canvas.height = small.height;
    reader.drawImage(small, 0, 0);
    const a = reader.getImageData(0, 0, small.width, small.height).data;
    let adv = 0;
    for (let i = 3; i < a.length; i += 4) if (a[i]) adv = Math.max(adv, ((i - 3) / 4) % small.width + 1);
    return [k, { small, adv }];
  }));
}
const header = await loadFont('font-header');

export const SPR = {
  bg,
  header,
  button,
  icons,
  runners,
  'cactus-small': cactusSmall,
  'cactus-large': cactusLarge,
  ptero,
  egg,       // plain, glinting
  goldEgg,
  mount,
  hatchEgg,
};
