/*
    HOP RACE - debug panel (debug tool). index.html loads it before the level editor; build.json leaves it out,
    so release builds never have it.

    Type "debug" on any screen to open or close it. It tunes values live, while you play:
    - Player size: HR_PSIZE (u). The players keep their feet where they are, so a player on the ground stays on it.
      The readout shows how tall the player is on screen right now. Nothing is saved: a reload goes back to the default in src/config.js.
      (Phase's drop size is fixed at load, so it ignores this; Phase is a hidden world.)
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
    // the panel (DOM, top left)

    const panel = document.createElement('div');
    panel.style.cssText = `position:fixed;top:12px;left:12px;width:280px;box-sizing:border-box;padding:12px 14px;
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
        el('div', {textContent: 'Type "debug" to close. Not saved.', style: 'color:#6E6976;font-size:11px;margin-top:6px'}));

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
