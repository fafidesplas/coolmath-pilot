/*
    HOP RACE - Coolmath Games integration ("Game Instructions CMG", updated 2026-06-18).
    - Game events (display ad refresh): postMessage to the parent page on the first Play,
      on every level start and on every replay of the same level.
    - Midroll ads: cmgAdBreak() from cmg-ads.js (loaded at the end of index.html). Coolmath decides
      whether an ad really shows; the game only pauses inside the adBreakStart / adBreakComplete events.
    - Rewarded ads: cmgRewardAds() takes no callback and cmg-ads.js (v2.6.4) has no "reward earned" signal:
      watched, skipped, no ad and ad-free subscribers all end with adBreakComplete. So the reward is given
      on the adBreakComplete that ends a reward request.
    - The Coolmath splash screen on load, not clickable (input is ignored until it is gone).
    Offline, from file:// or outside the Coolmath iframe, the SDK is missing and every call does nothing.
*/

'use strict';

let hrCmgPlayed = false;    // the 'start' event for level 0 (the Play button) is sent once per session
let hrCmgInAd = false;      // true between adBreakStart and adBreakComplete
let hrCmgReward = null;     // the reward to give when the requested rewarded ad ends

function hrCmgPost(evt, lvl)
{
    if (hrEditDef) return;   // level editor test runs are not real play
    try { window.parent.postMessage({cm_game_event: true, cm_game_evt: evt, cm_game_lvl: lvl}, '*'); }
    catch {}
}

// one number per level across worlds: World 1 is 1-10, World 2 is 11-20, ...
function hrCmgLevel(world, index) { return (hrWorldNumber(world) - 1) * HR_LEVELS_PER_WORLD + index + 1; }

// called by hrStartLevel; replay = the same level again (Retry, restart, a Versus tie)
function hrCmgLevelStart(world, index, replay)
{
    if (!hrCmgPlayed) { hrCmgPlayed = true; hrCmgPost('start', 0); }
    hrCmgPost(replay ? 'replay' : 'start', hrCmgLevel(world, index));
}

// midroll: ask for an ad break; the game goes on, and pauses only if an ad really starts
function hrCmgAdBreak()
{
    if (hrEditDef || typeof cmgAdBreak != 'function') return;
    try { cmgAdBreak(); } catch {}
}

// rewarded ads: only offered when the SDK is there
function hrCmgCanReward() { return typeof cmgRewardAds == 'function' && !hrEditDef && !hrCmgReward; }

function hrCmgRewardAd(onReward)
{
    if (!hrCmgCanReward()) return;
    hrCmgReward = onReward;   // set first: for a subscriber, adBreakComplete fires inside the call
    try { cmgRewardAds(); } catch { hrCmgReward = null; }
}

function hrCmgInit()
{
    document.addEventListener('adBreakStart', () =>
    {
        hrCmgInAd = true;
        setPaused(true);          // gameUpdate and all engine objects stop; the frame stays drawn
        setSoundEnable(false);
    });
    document.addEventListener('adBreakComplete', () =>
    {
        hrCmgInAd = false;
        hrPointerQueue = [];      // clicks on the ad never reach the game
        setPaused(false);
        hrApplySound();           // back to the player's sound setting
        const reward = hrCmgReward;
        hrCmgReward = null;
        reward?.();
    });
    hrSplashInit();
}

///////////////////////////////////////////////////////////////////////////////
// splash: Coolmath's 800x600 image fitted to the window on its own background, then a fade to the title

const HR_CMG_SPLASH = {fadeIn: .25, hold: 2, fadeOut: .35, bg: '#242424', maxWait: 3};
const hrCmgSplash = {img: null, t0: -1, done: false, fallback: false};

function hrSplashInit()
{
    // the level editor (?edit=...) and ?nosplash skip it
    if (/[?&](edit|nosplash)\b/.test(location.search)) return hrCmgSplash.done = true;
    const img = hrCmgSplash.img = new Image();
    img.onload = () => hrCmgSplash.t0 = timeReal;
    // the dev page loads it from assets/; the release build flattens data files next to index.html
    img.onerror = () => hrCmgSplash.fallback ? hrCmgSplash.done = true : (hrCmgSplash.fallback = true, img.src = 'cmg-splash.png');
    img.src = 'assets/cmg-splash.png';
}

function hrSplashActive()
{
    const s = hrCmgSplash;
    if (s.done) return false;
    if (s.t0 < 0 && timeReal > HR_CMG_SPLASH.maxWait) s.done = true;   // never stuck behind an image that won't load
    else if (s.t0 >= 0 && timeReal - s.t0 > HR_CMG_SPLASH.fadeIn + HR_CMG_SPLASH.hold + HR_CMG_SPLASH.fadeOut) s.done = true;
    return !s.done;
}

function hrSplashRender()
{
    if (!hrSplashActive()) return;
    const S = HR_CMG_SPLASH, W = mainCanvasSize.x, H = mainCanvasSize.y, ctx = mainContext;
    const t = hrCmgSplash.t0 < 0 ? 0 : timeReal - hrCmgSplash.t0;
    const out = clamp((S.fadeIn + S.hold + S.fadeOut - t) / S.fadeOut);   // the whole splash fades to the title
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = out;
    ctx.fillStyle = S.bg;
    ctx.fillRect(0, 0, W, H);
    if (hrCmgSplash.t0 >= 0)
    {
        const s = min(W / 800, H / 600);
        ctx.globalAlpha = out * clamp(t / S.fadeIn);
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(hrCmgSplash.img, (W - 800 * s) / 2, (H - 600 * s) / 2, 800 * s, 600 * s);
    }
    ctx.restore();
}
