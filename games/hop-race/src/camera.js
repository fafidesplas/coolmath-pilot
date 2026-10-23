/*
    HOP RACE - fixed camera (GDD §3.6): frame the whole level box plus a margin at any landscape
    aspect. Only screen shake (templates/gameFx.js) ever moves it during play.
*/

'use strict';

function hrCanvasSetup()
{
    setCanvasPixelRatio(min(devicePixelRatio || 1, 2));
    setCanvasMaxSize(vec2(3840, 2160));
    setGLEnable(false);   // one Canvas 2D context keeps world, HUD and menus drawn in call order
    setFontDefault(HR_FONT);
}

// on level load: center on the level box (shake nudges cameraPos and undoes itself)
function hrCameraReset() { cameraPos = vec2(0, 0); }

// every frame in gameUpdatePost, so a resize is picked up at once
function hrCameraFit()
{
    if (window.hrEditor?.fitCamera()) return;   // the level editor leaves room for its panel
    const w = hrLevel ? hrLevel.w : 24, h = hrLevel ? hrLevel.h : 13.5;
    cameraScale = min(mainCanvasSize.x / (w + 2 * HR_MARGIN), mainCanvasSize.y / (h + 2 * HR_MARGIN));
}

function hrIsPortrait() { return mainCanvasSize.y > mainCanvasSize.x; }

// screen-space unit: 1 = one pixel of the 1280x720 design, in canvas pixels
function hrUnit() { return min(mainCanvasSize.x / 1280, mainCanvasSize.y / 720); }

// smallest touch target is 48 CSS px (STANDARDS.md)
function hrButtonSize(design) { return max(design * hrUnit(), 48 * canvasPixelRatio); }
