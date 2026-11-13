/*
    HOP RACE - debug panel (debug tool). index.html loads it before the level editor; build.json leaves it out,
    so release builds never have it.

    Type "debug" on any screen to open or close it. It tunes values live, while you play:
    - Player size: HR_PSIZE (u). The players keep their feet where they are, so a player on the ground stays on it.
      The readout shows how tall the player is on screen right now. Nothing is saved: a reload goes back to the default in src/config.js.
      (Phase's drop size is fixed at load, so it ignores this; Phase is a hidden world.)
    - Leap jump: HR_LEAP's gravity, charge time and the five launch keys (forward and up speed, u/s, from a tap to full
      charge). "Show jump arcs" draws, from a player who can jump, a faint arc for each key and a bright one for the
      charge you are holding; the bright one stays up through the jump until the next charge, so you can see the real jump follow it.
      The arcs show from the first time you open the panel until you untick them, also with the panel closed.
      "Copy launch" puts the tuned lines on the clipboard, ready to paste over HR_LEAP in src/modes/leap.js.
    - Rocket: every value in HR_ROCKET (gravity, aim turn speed, rocket speed, cooldown, recoil, blast and ground values).
      "Copy values" puts the whole HR_ROCKET block on the clipboard, comments included, ready to paste over it in src/modes/rocket.js.
*/

'use strict';

window.hrDebug = (() =>
{
    const DBG = {open: false};
    const WORD = 'debug', DEFAULT = HR_PSIZE, MIN = .4, MAX = 2, STEP = .05;
    let typed = '';

    ///////////////////////////////////////////////////////////////////////////
    // player size

    function setSize(v)
    {
        v = +(Math.round(clamp(v, MIN, MAX) / STEP) * STEP).toFixed(2);
        const grow = v - HR_PSIZE;
        if (!grow) return refresh();
        for (const p of hrPlayers || []) p.y += grow / 2;   // keep the feet in place, so nobody sinks into the floor
        HR_PSIZE = v;
        refresh();
    }

    // the player's height on screen, from the live camera
    function onScreen()
    {
        const frac = HR_PSIZE * cameraScale / mainCanvasSize.y;
        return `${(frac * 100).toFixed(1)}% of screen height, ${Math.round(frac * 720)} px at 1280×720, 1/${(1 / frac).toFixed(0)} of the screen`;
    }

    ///////////////////////////////////////////////////////////////////////////
    // Leap jump tuning and arcs

    const LEAP_DEFAULT = {gravity: HR_LEAP.gravity, chargeT: HR_LEAP.chargeT, launch: HR_LEAP.launch.map(k => ({...k}))};
    DBG.arcs = true;   // only drawn once the panel has been opened (DBG.used)
    const rows = [];   // each tuning row's sync function (Leap and Rocket)

    // the path of a jump launched from p with velocity (vx, vy), in the same steps as HR_MODES.leap.step,
    // until it hits a solid or falls past the kill line (3 s at most)
    function leapPath(p, vx, vy)
    {
        const dt = 1 / 60, g = HR_LEAP.gravity, pts = [];
        let x = p.x + p.dir * .02, y = p.y;
        pts.push(vec2(x, y));
        for (let i = 0; i < 180; i++)
        {
            vy -= g * dt;
            x += vx * dt;
            y += vy * dt;
            pts.push(vec2(x, y));
            if (y < hrLevel.killY || hrLevel.solids.some(s => hrOverlapSolid(x, y, s, .1))) break;
        }
        return pts;
    }

    DBG.drawLeapArcs = (p, mode) =>
    {
        if (!DBG.used || !DBG.arcs || p.finished) return;
        const canJump = p.grounded || p.cling;
        if (canJump)
        {
            // faint: every key, from a tap to full charge
            const keep = p.charge;
            HR_LEAP.launch.forEach((k, i, all) =>
            {
                p.charge = i / (all.length - 1);
                const a = mode.aim(p);
                drawLineList(leapPath(p, a.vx, a.vy), .05, new Color(0, 0, 0, .25));
            });
            p.charge = keep;
            // bright: the jump you are charging; it stays up through the jump and after it, until the next charge
            if (p.down) { const a = mode.aim(p); p.dbgArc = leapPath(p, a.vx, a.vy); }
        }
        if (p.dbgArc) drawLineList(p.dbgArc, .09, new Color(1, 1, 1, .9));
    };

    ///////////////////////////////////////////////////////////////////////////
    // Rocket values: [key, label, min, max, step, source comment]. Declared before the panel is built, which reads them

    const ROCKET_ROWS = [
        ['gravity',      'Gravity',       5, 100, 1,   ''],
        ['spin',         'Aim turn',      .5, 12, .1,  'launcher rotation while the button is held (rad/s), clockwise; it stays still otherwise'],
        ['speed',        'Rocket speed',  5, 100, 1,   'rocket speed (u/s)'],
        ['cooldown',     'Cooldown (s)',  0, 1, .05,   ''],
        ['recoil',       'Recoil',        0, 20, .5,   'kick opposite the firing direction (u/s)'],
        ['radius',       'Blast radius',  1, 10, .1,   'blast radius (u)'],
        ['switchRadius', 'Button radius', 0, 6, .1,    'a blast this close to a button presses it'],
        ['power',        'Blast power',   5, 60, .5,   "blast speed at the center (u/s); the prototype's 30 less 20 % for 24-30 u levels"],
        ['maxSpeed',     'Top speed',     5, 60, .5,   "top speed after a blast; the prototype's 27 less 20 %"],
        ['friction',     'Friction',      0, 20, .1,   'ground friction (1/s)'],
        ['iceFriction',  'Ice friction',  0, 5, .05,   ''],
        ['stickyPush',   'Sticky push',   0, 1, .05,   'blasts push at 50 % while standing on a sticky floor'],
        ['wallBounce',   'Wall bounce',   0, 1, .05,   ''],
    ];
    const ROCKET_DEFAULT = {...HR_ROCKET};

    ///////////////////////////////////////////////////////////////////////////
    // the panel (DOM, top left)

    const panel = document.createElement('div');
    panel.style.cssText = `position:fixed;top:12px;left:12px;width:300px;max-height:calc(100vh - 24px);overflow-y:auto;box-sizing:border-box;padding:12px 14px;
        background:#1D1A22;color:#EDEAF2;font:13px/1.4 system-ui,sans-serif;display:none;z-index:11;border-radius:6px`;
    // LittleJS cancels every mousedown, and a pointer press anywhere is a jump: keep both inside the panel
    for (const ev of ['mousedown', 'pointerdown', 'pointerup', 'touchstart', 'wheel']) panel.addEventListener(ev, e => e.stopPropagation());
    document.body.appendChild(panel);

    const el = (tag, attrs = {}, kids = []) =>
    {
        const e = Object.assign(document.createElement(tag), attrs);
        for (const k of [].concat(kids)) e.append(k);
        return e;
    };
    const btnCss = 'background:#2C2833;color:#fff;border:1px solid #4A4552;padding:3px 9px;font:inherit;cursor:pointer';
    const button = (text, fn) => el('button', {textContent: text, onclick: e => { fn(); e.target.blur(); }, style: btnCss});

    const value = el('b', {style: 'color:#FFC94A;min-width:60px;text-align:right'});
    const slider = el('input', {type: 'range', min: MIN, max: MAX, step: STEP, style: 'width:100%;margin:6px 0'});
    slider.oninput = () => setSize(parseFloat(slider.value));
    slider.onchange = () => slider.blur();   // hand the keyboard back to the game
    const readout = el('div', {style: 'color:#A9A4B0;font-size:12px;min-height:34px'});

    panel.append(
        el('div', {style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px'},
            [el('b', {textContent: 'Debug', style: 'font-size:15px'}), button('Close', () => toggle(false))]),
        el('div', {style: 'display:flex;justify-content:space-between'},
            [el('span', {textContent: 'Player size (u)', style: 'color:#A9A4B0'}), value]),
        slider,
        el('div', {style: 'display:flex;gap:6px;margin-bottom:6px'}, [
            button('−', () => setSize(HR_PSIZE - STEP)), button('+', () => setSize(HR_PSIZE + STEP)),
            button(`Reset (${DEFAULT})`, () => setSize(DEFAULT))]),
        readout,
        rocketSection(),
        leapSection(),
        el('div', {textContent: 'Type "debug" to close. Not saved.', style: 'color:#6E6976;font-size:11px;margin-top:6px'}));

    // one tuning row: label, slider, number box; get/set read and write the live value
    function tuneRow(label, min, max, step, get, set)
    {
        const r = el('input', {type: 'range', min, max, step, style: 'flex:1;min-width:0'});
        const n = el('input', {type: 'number', min, max, step, style: 'width:52px;background:#2C2833;color:#FFC94A;border:1px solid #4A4552;font:inherit'});
        const put = v => { if (isFinite(v)) { set(v); sync(); } };
        r.oninput = () => put(parseFloat(r.value));
        r.onchange = () => r.blur();
        n.onchange = () => { put(parseFloat(n.value)); n.blur(); };
        const sync = () => { const v = +get().toFixed(2); r.value = v; if (document.activeElement != n) n.value = v; };
        rows.push(sync);
        return el('div', {style: 'display:flex;gap:6px;align-items:center;margin:2px 0'},
            [el('span', {textContent: label, style: 'color:#A9A4B0;width:78px;font-size:12px'}), r, n]);
    }

    function leapSection()
    {
        const arcs = el('input', {type: 'checkbox', checked: DBG.arcs, onchange: e => { DBG.arcs = e.target.checked; e.target.blur(); }});
        const names = ['Tap', '¼', '½', '¾', 'Full'];
        const keys = HR_LEAP.launch.flatMap((k, i) => [
            tuneRow(`${names[i]} forward`, 0, 30, .5, () => HR_LEAP.launch[i].vx, v => HR_LEAP.launch[i].vx = v),
            tuneRow(`${names[i]} up`, 0, 40, .5, () => HR_LEAP.launch[i].vy, v => HR_LEAP.launch[i].vy = v)]);
        return el('div', {style: 'border-top:1px solid #4A4552;margin-top:10px;padding-top:8px'}, [
            el('b', {textContent: 'Leap jump'}),
            el('label', {style: 'display:block;margin:4px 0;color:#A9A4B0'}, [arcs, ' Show jump arcs']),
            tuneRow('Gravity', 5, 100, 1, () => HR_LEAP.gravity, v => HR_LEAP.gravity = v),
            tuneRow('Charge (s)', .2, 3, .05, () => HR_LEAP.chargeT, v => HR_LEAP.chargeT = v),
            el('div', {textContent: 'Launch keys, u/s:', style: 'color:#6E6976;font-size:11px;margin-top:4px'}),
            ...keys,
            el('div', {style: 'display:flex;gap:6px;margin-top:6px'}, [
                button('Copy launch', copyLeap),
                button('Reset', () =>
                {
                    HR_LEAP.gravity = LEAP_DEFAULT.gravity; HR_LEAP.chargeT = LEAP_DEFAULT.chargeT;
                    LEAP_DEFAULT.launch.forEach((k, i) => Object.assign(HR_LEAP.launch[i], k));
                    rows.forEach(f => f());
                })]),
        ]);
    }

    // the tuned values as source lines for HR_LEAP in src/modes/leap.js
    function copyLeap()
    {
        const H = HR_LEAP, n = v => +v.toFixed(2);
        const text = `    gravity:   ${n(H.gravity)},\n` +
            `    launch:    [${H.launch.map(k => `{vx: ${n(k.vx)}, vy: ${n(k.vy)}}`).join(', ')}],\n` +
            `    chargeT:   ${n(H.chargeT)},     // seconds to full power\n`;
        navigator.clipboard?.writeText(text).catch(() => {});
        console.log(text);
    }

    function rocketSection()
    {
        return el('div', {style: 'border-top:1px solid #4A4552;margin-top:10px;padding-top:8px'}, [
            el('b', {textContent: 'Rocket'}),
            ...ROCKET_ROWS.map(([k, label, min, max, step]) => tuneRow(label, min, max, step, () => HR_ROCKET[k], v => HR_ROCKET[k] = v)),
            el('div', {style: 'display:flex;gap:6px;margin-top:6px'}, [
                button('Copy values', copyRocket),
                button('Reset', () => { Object.assign(HR_ROCKET, ROCKET_DEFAULT); rows.forEach(f => f()); })]),
        ]);
    }

    // the whole HR_ROCKET block, comments included, for src/modes/rocket.js
    function copyRocket()
    {
        const lines = ROCKET_ROWS.map(([k, , , , , c]) =>
        {
            const head = `    ${k}: ${+HR_ROCKET[k].toFixed(3)},`;
            return c ? head.padEnd(24) + '// ' + c : head;
        });
        const text = `const HR_ROCKET = {\n${lines.join('\n')}\n};\n`;
        navigator.clipboard?.writeText(text).catch(() => {});
        console.log(text);
    }

    function refresh()
    {
        if (!DBG.open) return;
        const v = +HR_PSIZE.toFixed(2);
        value.textContent = `${v}  (×${(HR_PSIZE / DEFAULT).toFixed(2)})`;
        slider.value = v;
        readout.textContent = onScreen();
    }
    setInterval(refresh, 250);   // the camera changes with the level and the window

    function toggle(open = !DBG.open)
    {
        DBG.open = open;
        if (open) { DBG.used = true; rows.forEach(f => f()); }
        panel.style.display = open ? 'block' : 'none';
        refresh();
    }

    ///////////////////////////////////////////////////////////////////////////
    // typing "debug": runs before the editor's keys, so the E in it doesn't open the level editor

    addEventListener('keydown', e =>
    {
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.metaKey || e.ctrlKey || e.altKey) return;
        const c = e.code.startsWith('Key') ? e.code.slice(3).toLowerCase() : '';
        typed = (typed + c).slice(-WORD.length);
        if (!c) typed = '';
        // "d" then "e" is the start of the word: hold back the editor's E (outside the editor only)
        if (c == 'e' && typed.endsWith('de') && !window.hrEditor?.active) e.stopImmediatePropagation();
        if (typed == WORD) { typed = ''; toggle(); }
    }, true);

    return DBG;
})();
