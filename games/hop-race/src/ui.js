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
        // a rising chime per star as it pops in, then a fanfare for a new best
        const r = hrResult;
        while (r.chimes < r.stars && hrScreenT >= .8 + r.chimes * .25) hrSfx.star.play(undefined, 1, 1 + r.chimes++ * .25);
        if (r.best && !r.fanfare && hrScreenT >= 1.6) { r.fanfare = true; hrSfx.fanfare.play(); }
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
        add({id: 'play', x: W / 2, y: H * .6, w: 340 * u, h: 110 * u, label: 'Play', big: true, focus: true, act: hrPlay});
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
        const cw = min(250 * u, W / 4.6), gap = cw * 1.12;
        HR_WORLDS.forEach((w, i) => add({id: 'world' + i, card: i, x: W / 2 + (i - 1.5) * gap, y: H * .56, w: cw, h: 330 * u,
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
        add({id: 'pause', x, y, w: hud, h: hud, icon: 'pause', act: () => hrGo('paused')});
        add({id: 'restart', x: x - hud * 1.2, y, w: hud, h: hud, icon: 'restart', act: hrRestart});
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
            ['Rematch', () => hrStartLevel(hrWorld, hrLevelIndex, true)]];
        acts.forEach(([label, act], i) => add({id: label, x: W / 2 + (i - 1) * 230 * u, y: H * .78, w: 210 * u, h: 76 * u,
            label, act, big: i == 2, focus: i == 2}));
    }
    return list;
}

function hrPlay()
{
    // Play starts the first level with fewer than 3 stars, in world and level order
    for (let w = 0; w < HR_WORLDS.length; w++)
        for (let i = 0; i < hrLevelsOf(w).length; i++)
            if (isUnlocked(w, i) && hrSaveLevel(hrLevelsOf(w)[i].id).stars < 3) return hrStartLevel(w, i, false);
    hrStartLevel(0, 0, false);
}

function hrNextLevel(world)
{
    for (let i = 0; i < hrLevelsOf(world).length; i++)
        if (isUnlocked(world, i) && hrSaveLevel(hrLevelsOf(world)[i].id).stars < 3) return i;
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
        hrStartLevel(hrWorld, hrLevelIndex, true, true);
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

function hrStar(x, y, r, c)
{
    const pts = [];
    for (let i = 0; i < 10; i++)
    {
        const a = i * PI / 5, k = i % 2 ? r * .45 : r;
        pts.push(vec2(Math.sin(a) * k, Math.cos(a) * k));   // screen-space polygons are y up
    }
    drawPoly(pts, c, 0, c, vec2(x, y), 0, false, true);
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
        drawCircle(vec2(x, y), s * .48, CLEAR_WHITE, s * .12, c, false, true);
        hrRect(x + s * .14, y - s * .22, s * .2, s * .16, hrScreenBg());   // gap in the ring
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
    if (live)
    {
        const stars = hrLevelsOf(b.card).reduce((n, l) => n + hrSaveLevel(l.id).stars, 0);
        if (!hrMenuVersus)
        {
            hrStar(b.x - 38 * u, b.y + h * .4, 13 * u, HR_INK);
            hrText(`${stars}/${HR_LEVELS_PER_WORLD * 3}`, b.x - 18 * u, b.y + h * .4, 24 * u, HR_INK, 'left');
        }
        hrDrawSchematic(b.card, b.x, b.y - h * .12, w * .7);
    }
    else hrText('Soon', b.x, b.y - h * .1, 28 * u, HR_INK.scale(1, .5));
    if (focused) hrRect(b.x, b.y + h / 2 + 14 * u, w * .5, 6 * u, HR_INK);
}

// animated mini schematic of the world's button meaning
function hrDrawSchematic(world, x, y, w)
{
    const u = hrUnit(), k = (timeReal % 1.6) / 1.6, s = 26 * u;
    hrRect(x, y + w * .3, w, 8 * u, HR_INK);
    for (let i = 0; i < 7; i++)
    {
        const t = i / 6;
        hrRect(x - w * .35 + t * w * .7, y + w * .26 - s / 2 - Math.sin(t * PI) * w * .32, 6 * u, 6 * u, HR_INK.scale(1, .6));
    }
    const hx = x - w * .35 + k * w * .7, hy = y + w * .26 - s / 2 - Math.sin(k * PI) * w * .32;
    hrRect(hx, hy, s, s, HR_BLUE);
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
    hrText(String(b.tile + 1), b.x, b.y - h * .17, 46 * u, HR_YELLOW);
    if (!hrMenuVersus)
    {
        for (let i = 0; i < 3; i++) hrStar(b.x + (i - 1) * 30 * u, b.y + h * .16, 12 * u, i < rec.stars ? HR_YELLOW : HR_YELLOW.scale(1, .25));
        if (rec.bestMs) hrText(hrFmt(rec.bestMs), b.x, b.y + h * .36, 20 * u, HR_YELLOW);
    }
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
    const label = `${hrWorld + 1}-${hrLevelIndex + 1}`;
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
    const s = hrLevel.start;
    // high enough to stay clear of a full-power aim arc
    drawText(hrLevelDef().prompt, vec2(0, s.y + 6), .9, HR_INK.scale(1, hrRun.prompt), 0, BLACK, 'center', HR_FONT, HR_FONT_STYLE);
}

function hrDrawComplete(W, H, u, y0)
{
    const r = hrResult, t = hrScreenT;
    hrText(r.best ? 'New best!' : 'Nice.', W / 2, H * .17 + y0, 60 * u);
    // time counts up, then the stars pop in one by one
    const shown = r.ms * hrEaseOut((t - .15) / .6);
    hrText(hrFmt(shown), W / 2, H * .34 + y0, 96 * u);
    for (let i = 0; i < 3; i++)
    {
        const at = .8 + i * .25, k = clamp((t - at) / .25), got = i < r.stars;
        const pop = got ? hrEaseBack(k) : 1;
        hrStar(W / 2 + (i - 1) * 100 * u, H * .55 + y0, 40 * u * max(.01, pop), got && k > 0 ? HR_INK : HR_INK.scale(1, .2));
    }
    const def = hrLevelDef();
    hrText(`Best ${hrFmt(r.bestMs)}   ·   2★ ${def.par.toFixed(1)}   ·   3★ ${def.expert.toFixed(1)}`, W / 2, H * .67 + y0, 24 * u,
        HR_INK.scale(1, .7));
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
