/*
    HOP RACE - screens, HUD and menus (GDD §8), drawn in screen space (canvas pixels, y down).
    Each screen lists its buttons in hrUiButtons(); the same list drives hit tests, keyboard
    focus and drawing, so what you see is what you can press.
*/

'use strict';

let hrScreen = 'title', hrScreenT = 0, hrFocus = -1;
let hrPress = null;            // button being pressed: it bounces, then acts
let hrSettingsFrom = 'title';
let hrMenuVersus = false, hrMenuWorld = 0;

const HR_WORLD_SCREENS = ['playing', 'paused', 'complete', 'round', 'match'];
const HR_LOCKED_SCREENS = ['complete', 'round', 'match'];   // 0.6 s input lock on results
function hrInWorld() { return HR_WORLD_SCREENS.includes(hrScreen) && !!hrRun; }

function hrGo(screen)
{
    hrScreen = screen;
    hrScreenT = 0;
    hrPress = null;
    const list = hrUiButtons();
    hrFocus = list.findIndex(b => b.focus);
    if (hrFocus < 0 && screen != 'playing') hrFocus = list.findIndex(b => b.enabled !== false);
}

function hrUiAdvance(dt)
{
    hrScreenT += dt;
    if (hrScreen == 'complete')
    {
        // a fanfare for a new best, once the time has counted up and the gap shows
        const r = hrResult;
        if (r.best && !r.fanfare && hrScreenT >= .9) { r.fanfare = true; hrSfx.fanfare.play(); }
    }
    if (hrPress && (hrPress.t += dt) > .09)
    {
        const act = hrPress.act;
        hrPress = null;
        act();
    }
}

///////////////////////////////////////////////////////////////////////////////
// layout

function hrUiButtons()
{
    const W = mainCanvasSize.x, H = mainCanvasSize.y, u = hrUnit(), list = [];
    const add = b => (list.push(b), b);
    const hud = hrButtonSize(56);
    const back = () => add({id: 'back', x: hud * .9, y: hud * .9, w: hud, h: hud, icon: 'back', act: hrBack});

    if (hrScreen == 'title')
    {
        add({id: 'play1', x: W / 2 - 170 * u, y: H * .6, w: 310 * u, h: 110 * u, label: 'Play 1P', big: true, focus: true,
            act: () => hrPlay(false)});
        add({id: 'play2', x: W / 2 + 170 * u, y: H * .6, w: 310 * u, h: 110 * u, label: 'Play 2P', big: true,
            act: () => hrPlay(true)});
        add({id: 'levels', x: W / 2 - 115 * u, y: H * .8, w: 210 * u, h: 72 * u, label: 'Levels', act: () => hrGo('modes')});
        add({id: 'settings', x: W / 2 + 115 * u, y: H * .8, w: 210 * u, h: 72 * u, label: 'Settings', act: () => hrOpenSettings('title')});
    }
    else if (hrScreen == 'modes')
    {
        back();
        add({id: 'solo', x: W / 2 - 100 * u, y: H * .12, w: 190 * u, h: 64 * u, label: 'Solo', on: !hrMenuVersus,
            act: () => hrMenuVersus = false});
        add({id: 'versus', x: W / 2 + 100 * u, y: H * .12, w: 190 * u, h: 64 * u, label: 'Versus', on: hrMenuVersus,
            act: () => hrMenuVersus = true});
        const shown = HR_WORLDS.map((w, i) => i).filter(i => !HR_WORLDS[i].hidden);
        const n = shown.length, cw = min(250 * u, W / (n + 1.2)), gap = cw * 1.12;
        shown.forEach((i, k) => add({id: 'world' + i, card: i, x: W / 2 + (k - (n - 1) / 2) * gap, y: H * .56, w: cw, h: 330 * u,
            enabled: hrLevelsOf(i).length > 0, focus: i == hrMenuWorld,
            act: () => { hrMenuWorld = i; hrGo('levels'); }}));
    }
    else if (hrScreen == 'levels')
    {
        back();
        const tw = 160 * u, th = 140 * u;
        for (let i = 0; i < HR_LEVELS_PER_WORLD; i++)
        {
            const col = i % 5, row = floor(i / 5);
            add({id: 'level' + i, tile: i, x: W / 2 + (col - 2) * tw * 1.12, y: H * .42 + row * th * 1.18, w: tw, h: th,
                enabled: isUnlocked(hrMenuWorld, i), focus: i == hrNextLevel(hrMenuWorld),
                act: () => hrStartLevel(hrMenuWorld, i, hrMenuVersus)});
        }
    }
    else if (hrScreen == 'settings')
    {
        const s = hrSave.settings;
        const row = (id, label, key, y, ga) => add({id, x: W / 2, y: H * y, w: 380 * u, h: 72 * u, label, on: s[key], toggle: true, side: true,
            act: () => { s[key] = !s[key]; if (!s[key] && ga) hrGaDesign(ga); hrApplySound(); hrSaveWrite(); }});
        row('sfx', 'Sound', 'sfx', .36, 'settings:sfx:off');
        row('music', 'Music', 'music', .5, 'settings:music:off');
        row('ghost', 'Ghost', 'ghost', .64);
        add({id: 'done', x: W / 2, y: H * .82, w: 240 * u, h: 72 * u, label: 'Done', side: true, act: hrBack});
    }
    else if (hrScreen == 'playing')
    {
        const y = hud * .8;
        const x = hrVersus ? W / 2 + hud * .6 : W - hud * .8;
        add({id: 'pause', x, y, w: hud, h: hud, icon: 'pause', chip: true, act: () => hrGo('paused')});
        add({id: 'restart', x: x - hud * 1.2, y, w: hud, h: hud, icon: 'restart', chip: true, act: hrRestart});
    }
    else if (hrScreen == 'paused')
    {
        const labels = [['Resume', () => hrGo('playing')], ['Restart', hrRestart],
            ['Levels', () => { hrLeaveAttempt(); hrMenuWorld = hrWorld; hrMenuVersus = hrVersus; hrGo('levels'); }],
            ['Settings', () => hrOpenSettings('paused')]];
        labels.forEach(([label, act], i) => add({id: label, x: W / 2, y: H * (.42 + i * .12), w: 300 * u, h: 66 * u, label, act,
            focus: i == 0, side: true}));
    }
    else if (hrScreen == 'complete')
    {
        const next = hrLevelIndex + 1 < HR_LEVELS_PER_WORLD && isUnlocked(hrWorld, hrLevelIndex + 1);
        const acts = [['Menu', () => hrGo('title')], ['Retry', () => hrStartLevel(hrWorld, hrLevelIndex, false)],
            ['Next', () => next ? hrStartLevel(hrWorld, hrLevelIndex + 1, false) : hrToLevels()]];
        acts.forEach(([label, act], i) => add({id: label, x: W / 2 + (i - 1) * 230 * u, y: H * .8, w: 210 * u, h: 76 * u,
            label, act, big: i == 2, focus: i == 2}));
    }
    else if (hrScreen == 'match')
    {
        const acts = [['Menu', () => hrGo('title')], ['Levels', hrToLevels],
            ['Rematch', () => hrStartLevel(hrWorld, hrNextVersusLevel(), true)]];
        acts.forEach(([label, act], i) => add({id: label, x: W / 2 + (i - 1) * 230 * u, y: H * .78, w: 210 * u, h: 76 * u,
            label, act, big: i == 2, focus: i == 2}));
    }
    return list;
}

function hrPlay(versus)
{
    // Play 1P / 2P go back to the last level played (solo or versus); a new player starts at
    // the first level not finished yet, in world and level order
    const last = hrFindLevel(hrSave.last);
    if (last && isUnlocked(last.world, last.index)) return hrStartLevel(last.world, last.index, versus);
    for (let w = 0; w < HR_WORLDS.length; w++)
        for (let i = 0; i < hrLevelsOf(w).length; i++)
            if (isUnlocked(w, i) && !hrSaveLevel(hrLevelsOf(w)[i].id).bestMs) return hrStartLevel(w, i, versus);
    hrStartLevel(0, 0, versus);
}

function hrNextLevel(world)
{
    for (let i = 0; i < hrLevelsOf(world).length; i++)
        if (isUnlocked(world, i) && !hrSaveLevel(hrLevelsOf(world)[i].id).bestMs) return i;
    return -1;
}

function hrToLevels() { hrMenuWorld = hrWorld; hrMenuVersus = hrVersus; hrGo('levels'); }
function hrOpenSettings(from) { hrSettingsFrom = from; hrGo('settings'); }

function hrBack()
{
    if (hrScreen == 'settings') hrGo(hrSettingsFrom);
    else if (hrScreen == 'levels') hrGo('modes');
    else hrGo('title');
}

///////////////////////////////////////////////////////////////////////////////
// input

const hrHit = (b, pos) => Math.abs(pos.x - b.x) < b.w / 2 && Math.abs(pos.y - b.y) < b.h / 2;
const hrConfirmKeys = ['Enter', 'Space'];

function hrUiActivate(b)
{
    if (b.enabled === false || hrPress) return;
    hrSfx.click.play();
    hrPress = {id: b.id, t: 0, act: b.act};
}

function hrUiUpdate()
{
    if (hrPress) { hrTaps.forEach(t => t.used = true); return; }
    const list = hrUiButtons();
    const locked = HR_LOCKED_SCREENS.includes(hrScreen) && hrScreenT < .6;
    if (locked) { hrTaps.forEach(t => t.used = true); return; }

    for (const t of hrTaps)
    {
        const b = list.find(b => hrHit(b, t.pos));
        if (b) { t.used = true; hrFocus = -1; hrUiActivate(b); }
        else if (hrScreen != 'playing' && hrScreen != 'round') t.used = true;
    }

    if (hrScreen == 'playing')
    {
        if (keyWasPressed('KeyP') || keyWasPressed('Escape')) hrGo('paused');
        else if (keyWasPressed('KeyR')) hrRestart();
        return;
    }
    if (hrScreen == 'paused')
    {
        if (keyWasPressed('KeyP') || keyWasPressed('Escape')) return hrGo('playing');
        if (keyWasPressed('KeyR')) return hrRestart();
    }
    else if (keyWasPressed('Escape') && ['modes', 'levels', 'settings'].includes(hrScreen)) return hrBack();

    // keyboard focus: arrows move between enabled buttons, Enter or Space presses
    const enabled = list.map((b, i) => i).filter(i => list[i].enabled !== false && list[i].id != 'back');
    if (!enabled.length) return;
    const step = keyWasPressed('ArrowRight') || keyWasPressed('ArrowDown') ? 1 :
        keyWasPressed('ArrowLeft') || keyWasPressed('ArrowUp') ? -1 : 0;
    if (step)
    {
        const at = enabled.indexOf(hrFocus);
        hrFocus = enabled[at < 0 ? 0 : (at + step + enabled.length) % enabled.length];
    }
    const confirm = hrConfirmKeys.some(k => keyWasPressed(k)) ||
        (HR_LOCKED_SCREENS.includes(hrScreen) && (keyWasPressed('KeyA') || keyWasPressed('KeyL')));
    if (confirm)
    {
        if (!list[hrFocus] || list[hrFocus].enabled === false) hrFocus = enabled[0];
        hrUiActivate(list[hrFocus]);
    }
}

// versus round result: auto-continues after 1.5 s, or on a fresh press after the input lock
function hrUiContinue()
{
    if (hrScreen != 'round' || hrScreenT < .6) return;
    if (hrScreenT > 1.5 || hrAnyPressed() || hrTaps.some(t => !t.used))
        hrStartLevel(hrWorld, hrNextVersusLevel(), true, true);
}

///////////////////////////////////////////////////////////////////////////////
// drawing helpers (screen space)

const hrRect = (x, y, w, h, c) => drawRect(vec2(x, y), vec2(w, h), c, 0, false, true);
const hrText = (t, x, y, size, c = HR_INK, align = 'center') =>
    drawTextScreen(t, vec2(x, y), size, c, 0, BLACK, align, HR_FONT, HR_FONT_STYLE);
const hrEaseOut = k => 1 - Math.pow(1 - clamp(k), 3);
const hrEaseBack = k => { k = clamp(k) - 1; return 1 + 2.7 * k * k * k + 1.7 * k * k; };
const hrFmt = ms => (ms / 1000).toFixed(1);

function hrOutline(x, y, w, h, t, c)
{
    hrRect(x, y - h / 2 + t / 2, w, t, c); hrRect(x, y + h / 2 - t / 2, w, t, c);
    hrRect(x - w / 2 + t / 2, y, t, h, c); hrRect(x + w / 2 - t / 2, y, t, h, c);
}

function hrIcon(icon, x, y, s, c)
{
    if (icon == 'pause')
    {
        hrRect(x - s * .16, y, s * .18, s * .56, c);
        hrRect(x + s * .16, y, s * .18, s * .56, c);
    }
    else if (icon == 'restart')
    {
        // open ring, clockwise from a flat-cut tail at 75 deg to the arrowhead at the top
        const ro = s * .3, ri = s * .18, a0 = 75 * PI / 180, a1 = 378 * PI / 180, pts = [];
        for (let i = 0; i <= 24; i++)
        {
            const a = a0 + (a1 - a0) * i / 24;
            pts.push(vec2(Math.sin(a) * ro, Math.cos(a) * ro));   // screen-space polygons are y up
        }
        for (let i = 24; i >= 0; i--)
        {
            const a = a0 + (a1 - a0) * i / 24;
            pts.push(vec2(Math.sin(a) * ri, Math.cos(a) * ri));
        }
        drawPoly(pts, c, 0, c, vec2(x, y), 0, false, true);
        drawPoly([vec2(0, -s * .17), vec2(s * .2, 0), vec2(0, s * .17)], c, 0, c, vec2(x + s * .06, y - s * .24), 0, false, true);
    }
    else if (icon == 'back')
        drawPoly([vec2(s * .18, -s * .24), vec2(-s * .18, 0), vec2(s * .18, s * .24)], CLEAR_WHITE, s * .11, c,
            vec2(x, y), 0, false, true);
}

function hrScreenBg() { return hrInWorld() ? hrWorldBg() : HR_YELLOW; }

function hrDrawButton(b, i)
{
    const u = hrUnit(), pressed = hrPress && hrPress.id == b.id;
    const focused = i == hrFocus && b.enabled !== false;
    const s = pressed ? .9 : focused ? 1.05 : 1, w = b.w * s, h = b.h * s;
    const bg = hrScreenBg();
    if (b.icon && b.chip)
    {
        // in-play HUD: an ink disc with the icon cut out in the background color and a background rim,
        // so it reads over the background and over ink level pieces alike
        drawCircle(vec2(b.x, b.y), w * .9, HR_INK, 3 * u, bg, false, true);
        hrIcon(b.icon, b.x, b.y, w * .85, bg);
        if (focused) hrRect(b.x, b.y + h * .6, w * .6, 4 * u, HR_INK);
        return;
    }
    if (b.icon)
    {
        hrIcon(b.icon, b.x, b.y, w, HR_INK);
        if (focused) hrRect(b.x, b.y + h * .55, w * .6, 4 * u, HR_INK);
        return;
    }
    if (b.card !== undefined) return hrDrawCard(b, w, h, focused);
    if (b.tile !== undefined) return hrDrawTile(b, w, h, focused);
    const filled = b.toggle ? true : b.on === undefined ? true : b.on;
    const c = b.enabled === false ? HR_INK.scale(1, .25) : HR_INK;
    if (filled) hrRect(b.x, b.y, w, h, c);
    else hrOutline(b.x, b.y, w, h, 5 * u, c);
    const size = (b.big ? 48 : 30) * u * s;
    if (b.toggle)
    {
        hrText(b.label, b.x - w / 2 + 28 * u, b.y, size, bg, 'left');
        hrText(b.on ? 'On' : 'Off', b.x + w / 2 - 28 * u, b.y, size, b.on ? bg : bg.scale(1, .45), 'right');
    }
    else hrText(b.label, b.x, b.y, size, filled ? bg : HR_INK);
    if (focused && !b.side) hrRect(b.x, b.y + h / 2 + 10 * u, w * .5, 5 * u, HR_INK);
    if (focused && b.side) hrRect(b.x - w / 2 - 18 * u, b.y, 10 * u, h * .5, HR_INK);
}

function hrDrawCard(b, w, h, focused)
{
    const u = hrUnit(), world = HR_WORLDS[b.card], live = b.enabled !== false;
    hrRect(b.x, b.y, w, h, live ? HR_INK : HR_INK.scale(1, .25));
    hrRect(b.x, b.y, w - 14 * u, h - 14 * u, live ? world.bg : world.bg.scale(1, .5));
    hrText(world.name, b.x, b.y + h * .26, 40 * u, HR_INK);
    if (world.lab) hrText('LAB', b.x, b.y - h * .39, 20 * u, HR_INK);   // a feel test, not a finished world
    if (live)
    {
        const done = hrLevelsOf(b.card).filter(l => hrSaveLevel(l.id).bestMs).length;
        if (!hrMenuVersus)
            hrText(`${done}/${world.lab ? hrLevelsOf(b.card).length : HR_LEVELS_PER_WORLD} done`, b.x, b.y + h * .4, 24 * u, HR_INK);
        hrDrawSchematic(b.card, b.x, b.y - h * .12, w * .7);
    }
    else hrText('Soon', b.x, b.y - h * .1, 28 * u, HR_INK.scale(1, .5));
    if (focused) hrRect(b.x, b.y + h / 2 + 14 * u, w * .5, 6 * u, HR_INK);
}

// screen-space line, circle and polygon (polygon points given y down like everything else here)
const hrSLine = (x0, y0, x1, y1, t, c) => drawLine(vec2(x0, y0), vec2(x1, y1), t, c, vec2(), 0, false, true);
const hrSCircle = (x, y, d, c, lw = 0, lc = BLACK) => drawCircle(vec2(x, y), d, c, lw, lc, false, true);
const hrSPoly = (pts, c) => drawPoly(pts.map(([px, py]) => vec2(px, -py)), c, 0, c, vec2(), 0, false, true);
const hrSmooth = k => clamp(k) * clamp(k) * (3 - 2 * clamp(k));

// animated mini schematic of the world's button meaning, on a floor at y + w * .3
function hrDrawSchematic(world, x, y, w)
{
    const u = hrUnit(), s = min(26 * u, w * .18), gy = y + w * .3 - 4 * u;   // gy: top of the floor
    const id = HR_WORLDS[world].id;
    if (id == 'rocket') return hrSchemRocket(x, y, w, u, s, gy);
    if (id == 'grapple') return hrSchemGrapple(x, y, w, u, s, gy);
    if (id == 'phase') return hrSchemPhase(x, y, w, u, s, gy);
    if (id == 'climb') return hrSchemClimb(x, y, w, u, s, gy);

    // Hop: squash while charging, the dotted aim arc, then the hop
    const k = (timeReal % 2) / 2, x0 = x - w * .35, arc = t => gy - s / 2 - Math.sin(t * PI) * w * .32;
    hrRect(x, gy + 4 * u, w, 8 * u, HR_INK);
    const charge = clamp(k / .35);
    for (let i = 0; i < 7; i++)
        hrRect(x0 + i / 6 * w * .7, arc(i / 6), 6 * u, 6 * u, HR_INK.scale(1, k < .35 ? .6 * charge : .6));
    if (k < .35)
    {
        const sw = s * (1 + charge * .35), sh = s * (1 - charge * .35);
        hrRect(x0, gy - sh / 2, sw, sh, HR_BLUE);
    }
    else
    {
        const t = clamp((k - .35) / .5);
        hrRect(x0 + t * w * .7, arc(t), s, s, HR_BLUE);
    }
}

// Rocket: the launcher spins around the square; a press blasts at its feet and throws it up and over
function hrSchemRocket(x, y, w, u, s, gy)
{
    const k = (timeReal % 2.2) / 2.2, fire = .4, x0 = x - w * .25, x1 = x + w * .3;
    hrRect(x, gy + 4 * u, w, 8 * u, HR_INK);
    let px = x0, py = gy - s / 2;
    if (k >= fire)
    {
        const t = clamp((k - fire) / .45);
        px = lerp(x0, x1, t); py = gy - s / 2 - Math.sin(t * PI) * w * .42;
    }
    if (k >= fire && k < fire + .35)
    {
        // blast ring in the owner's color, where the launcher pointed (down and back)
        const t = (k - fire) / .35, e = 1 - (1 - t) * (1 - t);
        hrSCircle(x0 - s * .55, gy, s * (.6 + 2.4 * e), CLEAR_WHITE, (1 - t) * 6 * u + u, HR_BLUE.scale(1, 1 - t));
    }
    hrRect(px, py, s, s, HR_BLUE);
    const a = 3 * PI / 4 + (k - fire) * 2 * PI * 1.3;   // clockwise; points down and back at the press
    drawRect(vec2(px + Math.cos(a) * s * .78, py + Math.sin(a) * s * .78), vec2(s * .62, s * .25), HR_BLUE, a, false, true);
}

// Grapple: hook the ceiling, swing across the gap on the rope, let go and fly to the far ledge
function hrSchemGrapple(x, y, w, u, s, gy)
{
    const k = (timeReal % 2.4) / 2.4, ay = y - w * .42;
    hrRect(x, ay - 4 * u, w, 8 * u, HR_INK);   // ceiling
    hrRect(x - w * .38, gy + 4 * u, w * .24, 8 * u, HR_INK);   // ledges either side of the gap
    hrRect(x + w * .38, gy + 4 * u, w * .24, 8 * u, HR_INK);
    const ax = x - w * .02, x0 = x - w * .38, y0 = gy - s / 2, R = Math.hypot(x0 - ax, y0 - ay);
    const th0 = Math.atan2(x0 - ax, y0 - ay), swingAt = (t => th0 * Math.cos(t * PI * .78));
    const onRope = th => [ax + Math.sin(th) * R, ay + Math.cos(th) * R];
    let px = x0, py = y0, tip = null;
    if (k < .15) tip = [lerp(x0, ax, k / .15), lerp(y0, ay, k / .15)];
    else if (k < .6) { [px, py] = onRope(swingAt(hrSmooth((k - .15) / .45) * .92 + (k - .15) / .45 * .08)); tip = [ax, ay]; }
    else
    {
        // released: a curve from the release point up and over to the far ledge
        const [rx, ry] = onRope(swingAt(1)), lx = x + w * .38, ly = y0, t = clamp((k - .6) / .25);
        const cx = (rx + lx) / 2 + w * .05, cy = min(ry, ly) - w * .22;
        px = (1 - t) ** 2 * rx + 2 * (1 - t) * t * cx + t * t * lx;
        py = (1 - t) ** 2 * ry + 2 * (1 - t) * t * cy + t * t * ly;
    }
    if (tip)
    {
        hrSLine(px, py, tip[0], tip[1], 3 * u, HR_INK);
        hrSCircle(tip[0], tip[1], s * .42, HR_INK);
        hrSCircle(tip[0], tip[1], s * .22, HR_WHITE);
    }
    hrRect(px, py, s, s, HR_BLUE);
}

// Phase: solid -> melts into a puddle -> rises as rings of gas -> condenses into a square that falls back
function hrSchemPhase(x, y, w, u, s, gy)
{
    const k = (timeReal % 3.2) / 3.2, d = s / 3, top = y - w * .3;
    hrRect(x, gy + 4 * u, w, 8 * u, HR_INK);
    const grid = (i, cy) => [x + (i % 3 - 1) * d, cy + (floor(i / 3) - 1) * d];
    const puddle = i => [x + (i - 4) * d * 1.15, gy - d * .55];
    const cloud = i => [x + (i - 4) * d * 1.3 + Math.sin(timeReal * 3 + i * 1.7) * d * .3,
        top + Math.sin(timeReal * 2.3 + i * 2.1) * d * .5 + (i % 2) * d * .8];
    if (k < .2) return hrRect(x, gy - s / 2, s, s, HR_BLUE);
    if (k >= .82)
    {
        // the packed square falls and lands with a squash
        const t = (k - .82) / .12, land = t >= 1, sq = land ? .3 * (1 - (k - .94) / .06) : 0;
        const sh = s * (1 - sq), cy = land ? gy - sh / 2 : lerp(top, gy - s / 2, t * t);
        return hrRect(x, cy, s * (1 + sq), sh, HR_BLUE);
    }
    for (let i = 0; i < 9; i++)
    {
        let p, gas = k >= .42;
        if (k < .42) { const t = hrSmooth((k - .2) / .18), a = grid(i, gy - s / 2), b = puddle(i); p = [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]; }
        else if (k < .72) { const t = 1 - (1 - (k - .42) / .3) ** 2, a = puddle(i), b = cloud(i); p = [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]; }
        else { const t = hrSmooth((k - .72) / .1), a = cloud(i), b = grid(i, top); p = [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]; }
        if (gas) hrSCircle(p[0], p[1], d * (k < .72 ? 1.7 : lerp(1.7, 1.1, (k - .72) / .1)), CLEAR_WHITE, 2.5 * u, HR_BLUE);
        else hrSCircle(p[0], p[1], d * 1.4, HR_BLUE);
    }
}

// Climb: the arm turns clockwise until its head sticks to the step, then the body levers up and over onto it
function hrSchemClimb(x, y, w, u, s, gy)
{
    const k = (timeReal % 2.6) / 2.6, ty = gy - w * .24, L = w * .34;
    hrRect(x, gy + 4 * u, w, 8 * u, HR_INK);
    hrRect(x + w * .28, (ty + gy) / 2, w * .44, gy - ty, HR_INK);   // the step
    const P = [x + w * .1, ty];   // where the head sticks
    const by0 = gy - s / 2, bx0 = P[0] - Math.sqrt(L * L - (P[1] - by0) ** 2);
    const phiP = Math.atan2(P[1] - by0, P[0] - bx0);
    const beta0 = Math.atan2(by0 - P[1], bx0 - P[0]), beta1 = 2 * PI + Math.atan2(-s / 2, Math.sqrt(L * L - s * s / 4));
    let bx = bx0, by = by0, hx, hy, ang = 0, stuck = k >= .35;
    if (!stuck)
    {
        const phi = lerp(-PI + .3, phiP, hrSmooth(k / .35));   // clockwise (screen y down) over the top, toward the step
        hx = bx + Math.cos(phi) * L; hy = by + Math.sin(phi) * L;
    }
    else
    {
        const t = hrSmooth((k - .35) / .4), beta = lerp(beta0, beta1, t);
        bx = P[0] + Math.cos(beta) * L; by = P[1] + Math.sin(beta) * L;
        ang = t * PI / 2;   // a quarter turn, so it lands flat
        [hx, hy] = P;
    }
    hrSLine(bx, by, hx, hy, 4 * u, HR_INK);
    if (stuck)
    {
        // suction cup: a half disc, flat side on the step
        const r = s * .26, pts = [];
        for (let i = 0; i <= 10; i++) pts.push([hx + Math.cos(PI + i / 10 * PI) * r, hy + Math.sin(PI + i / 10 * PI) * r]);
        hrSPoly(pts, HR_INK);
    }
    else hrSCircle(hx, hy, s * .4, HR_INK);
    drawRect(vec2(bx, by), vec2(s), HR_BLUE, ang, false, true);
}

function hrDrawTile(b, w, h, focused)
{
    const u = hrUnit(), live = b.enabled !== false;
    const def = hrLevelsOf(hrMenuWorld)[b.tile], rec = def ? hrSaveLevel(def.id) : null;
    const next = b.tile == hrNextLevel(hrMenuWorld);
    if (!live)
    {
        hrOutline(b.x, b.y, w, h, 3 * u, HR_INK.scale(1, .25));
        hrText(String(b.tile + 1), b.x, b.y, 40 * u, HR_INK.scale(1, .25));
        return;
    }
    hrRect(b.x, b.y, w, h, HR_INK);
    if (next && !hrMenuVersus) hrOutline(b.x, b.y, w + 16 * u, h + 16 * u, 4 * u, HR_INK.scale(1, .5 + .5 * Math.sin(timeReal * 5)));
    const timed = !hrMenuVersus && rec.bestMs;   // the number moves up to make room for the best time
    hrText(String(b.tile + 1), b.x, b.y - (timed ? h * .12 : 0), 46 * u, HR_YELLOW);
    if (timed) hrText(hrFmt(rec.bestMs), b.x, b.y + h * .27, 24 * u, HR_YELLOW);
    if (focused) hrRect(b.x, b.y + h / 2 + 14 * u, w * .5, 6 * u, HR_INK);
}

///////////////////////////////////////////////////////////////////////////////
// screens

function hrUiRender()
{
    const W = mainCanvasSize.x, H = mainCanvasSize.y, u = hrUnit();
    if (hrIsPortrait()) return hrDrawRotate(W, H, u);

    if (hrScreen == 'playing') hrDrawHud(W, H, u);
    if (['paused', 'complete', 'round', 'match'].includes(hrScreen) || (hrScreen == 'settings' && hrSettingsFrom == 'paused'))
        hrRect(W / 2, H / 2, W, H, hrScreenBg().scale(1, .82 * hrEaseOut(hrScreenT / .2)));

    // panels slide in with an eased overshoot
    const slide = (1 - hrEaseBack(hrScreenT / .35)) * H * .25;
    const y0 = slide;
    if (hrScreen == 'title') hrDrawTitle(W, H, u);
    else if (hrScreen == 'modes')
    {
        hrText('Pick a world', W / 2, H * .24 + y0, 34 * u);
        if (hrMenuVersus) hrText('Versus needs a keyboard (A and L) or a touch screen', W / 2, H * .93, 22 * u);
    }
    else if (hrScreen == 'levels')
        hrText(HR_WORLDS[hrMenuWorld].name + (hrMenuVersus ? ' · Versus' : ''), W / 2, H * .17 + y0, 54 * u);
    else if (hrScreen == 'settings') hrText('Settings', W / 2, H * .18 + y0, 54 * u);
    else if (hrScreen == 'paused')
    {
        hrText('Paused', W / 2, H * .2 + y0, 64 * u);
        hrText(HR_WORLDS[hrWorld].hint, W / 2, H * .3 + y0, 26 * u);
    }
    else if (hrScreen == 'complete') hrDrawComplete(W, H, u, y0);
    else if (hrScreen == 'round') hrDrawRound(W, H, u, y0);
    else if (hrScreen == 'match') hrDrawMatch(W, H, u, y0);

    const list = hrUiButtons();
    list.forEach((b, i) =>
    {
        const off = b.id == 'pause' || b.id == 'restart' || b.id == 'back' ? 0 : y0;
        hrDrawButton({...b, y: b.y + off}, i);
    });
}

function hrDrawTitle(W, H, u)
{
    hrText('HOP RACE', W / 2, H * .2, 120 * u);
    // idle hopping square
    const k = (timeReal % 1.1) / 1.1, s = 56 * u, ground = H * .46;
    const hop = Math.sin(k * PI), squash = k < .12 ? (1 - k / .12) * .25 : 0;
    const x = W / 2 + Math.sin(timeReal * .9) * 170 * u, y = ground - s / 2 - hop * 50 * u;
    hrRect(W / 2, ground + 4 * u, 460 * u, 8 * u, HR_INK);
    const sw = s * (1 + squash), sh = s * (1 - squash);
    hrRect(x, ground - sh / 2 - hop * 50 * u, sw, sh, HR_BLUE);
    hrText('A', x - 6 * u, ground - sh * .42 - hop * 50 * u, 26 * u, HR_WHITE);
    const ex = x + 14 * u, ey = ground - sh - hop * 50 * u + 4 * u;
    const open = hrBlinkOpen(timeReal % 3.4);
    drawEllipse(vec2(ex, ey), vec2(30 * u, 30 * u * max(open, .12)), HR_WHITE, 0, 0, BLACK, false, true);
    if (open > .5)
        drawEllipse(vec2(ex + 3 * u, ey + (hop > .5 ? -4 : 4) * u * open), vec2(13 * u, 13 * u * open), HR_INK, 0, 0, BLACK, false, true);
    else hrRect(ex, ey, 21 * u, 3 * u, HR_INK);
}

function hrDrawHud(W, H, u)
{
    const top = hrButtonSize(56) * .8;
    const label = `${hrWorldNumber(hrWorld)}-${hrLevelIndex + 1}`;
    if (hrVersus)
    {
        hrText(label, W / 2 - hrButtonSize(56) * 1.6, top, 30 * u, HR_INK, 'right');
        hrPlayers.forEach((p, i) =>
        {
            const right = i == 1, x = right ? W - 40 * u : 40 * u, dir = right ? -1 : 1;
            hrText(p.letter, x, top, 44 * u, HR_INK, right ? 'right' : 'left');
            for (let k = 0; k < 3; k++)
            {
                const px = x + dir * (60 + k * 34) * u;
                if (k < hrMatch.wins[i]) hrRect(px, top, 22 * u, 22 * u, HR_INK);
                else hrOutline(px, top, 22 * u, 22 * u, 4 * u, HR_INK);
            }
        });
        const c = hrMatch.countdown;
        if (c > 0) hrText(String(Math.ceil(c / .8)), W / 2, H * .45, 160 * u * (1 + (c % .8) * .4));
        else if (hrMatch.frames < 40) hrText('GO', W / 2, H * .45, 160 * u, HR_INK.scale(1, 1 - hrMatch.frames / 40));
        return;
    }
    const ms = hrFinishT >= 0 && hrResult ? hrResult.ms : hrRunMs();
    hrText(`${label}   ${hrFmt(ms)}`, W / 2, top, 34 * u);
    const best = hrSaveLevel(hrLevelDef().id).bestMs;
    if (best) hrText('Best ' + hrFmt(best), W / 2, top + 34 * u, 22 * u, HR_INK.scale(1, .6));
    // from level 2 on, the button hint shows for the first 3 s
    if (hrRun.hintT < 3.5 && hrLevelIndex > 0)
        hrText(HR_WORLDS[hrWorld].hint, W / 2, H - 40 * u, 26 * u, HR_INK.scale(1, clamp(3.5 - hrRun.hintT)));
    if (hrRun.nudge)
    {
        const hud = hrButtonSize(56), a = clamp(hrRun.stuckT - 8);
        hrText(isTouchDevice ? 'Tap to restart' : 'R to restart', W - hud * 2, top + hud * .95, 24 * u, HR_INK.scale(1, a), 'right');
    }
}

// world-space tutorial prompt above the start, level 1 of each world only
function hrDrawPrompt()
{
    if (!hrRun || !hrRun.prompt || hrScreen != 'playing' || (hrMatch && hrMatch.countdown > 0)) return;
    const def = hrLevelDef(), s = hrLevel.start;
    // high enough to stay clear of a full-power aim arc, unless the level places it
    const at = def.promptAt ? vec2(def.promptAt.x, def.promptAt.y) : vec2(0, s.y + 6);
    drawText(def.prompt, at, .9, HR_INK.scale(1, hrRun.prompt), 0, BLACK, 'center', HR_FONT, HR_FONT_STYLE);
}

function hrDrawComplete(W, H, u, y0)
{
    const r = hrResult, t = hrScreenT;
    hrText(r.best ? 'New best!' : 'Nice.', W / 2, H * .17 + y0, 60 * u);
    // time counts up, then the gap to the old best pops in
    const shown = r.ms * hrEaseOut((t - .15) / .6);
    hrText(hrFmt(shown), W / 2, H * .34 + y0, 96 * u);
    if (r.prevMs)
    {
        const gap = r.ms - r.prevMs, pop = hrEaseBack(clamp((t - .8) / .25));
        hrText(`${gap < 0 ? '-' : '+'}${hrFmt(Math.abs(gap))}`, W / 2, H * .52 + y0, 44 * u * max(.01, pop), HR_INK);
        hrText(`${r.best ? 'Old best' : 'Best'} ${hrFmt(r.best ? r.prevMs : r.bestMs)}`, W / 2, H * .64 + y0, 24 * u, HR_INK.scale(1, .7));
    }
}

function hrDrawRound(W, H, u, y0)
{
    const p = hrPlayers[hrMatch.winner];
    hrRect(W / 2 - 150 * u, H * .38 + y0, 90 * u, 90 * u, p.color);
    hrText(p.letter, W / 2 - 150 * u, H * .38 + y0, 56 * u, p.letterColor);
    hrText('wins the round', W / 2 - 80 * u, H * .38 + y0, 52 * u, HR_INK, 'left');
    hrPlayers.forEach((q, i) =>
    {
        for (let k = 0; k < 3; k++)
        {
            const x = W / 2 + (i ? 60 + k * 40 : -60 - k * 40) * u, y = H * .56 + y0;
            const fresh = i == hrMatch.winner && k == hrMatch.wins[i] - 1;
            const s = 28 * u * (fresh ? hrEaseBack(hrScreenT / .3) : 1);
            if (k < hrMatch.wins[i]) hrRect(x, y, s, s, HR_INK);
            else hrOutline(x, y, 28 * u, 28 * u, 4 * u, HR_INK);
        }
        hrText(q.letter, W / 2 + (i ? 200 : -200) * u, H * .56 + y0, 36 * u);
    });
}

function hrDrawMatch(W, H, u, y0)
{
    const p = hrPlayers[hrMatch.winner], s = 150 * u * hrEaseBack(hrScreenT / .4);
    hrRect(W / 2, H * .32 + y0, s, s, p.color);
    hrText(p.letter, W / 2, H * .32 + y0, s * .6, p.letterColor);
    hrText(`${p.letter} wins the match`, W / 2, H * .56 + y0, 60 * u);
    hrText(`${hrMatch.wins[0]} – ${hrMatch.wins[1]}`, W / 2, H * .64 + y0, 30 * u, HR_INK.scale(1, .7));
}

function hrDrawRotate(W, H, u)
{
    hrRect(W / 2, H / 2, W, H, HR_YELLOW);
    const s = min(W, H) / 1000;
    const a = -PI / 2 * hrEaseOut(((timeReal % 2) - .4) / .8);
    const pts = [vec2(-90, -160), vec2(90, -160), vec2(90, 160), vec2(-90, 160)].map(v => v.scale(s).rotate(a));
    drawPoly(pts, CLEAR_WHITE, 14 * s, HR_INK, vec2(W / 2, H * .42), 0, false, true);
    hrText('Rotate your device', W / 2, H * .72, 70 * s);
}
