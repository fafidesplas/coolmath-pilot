# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Hop Race: a local 2-player, one-button-each jump race built on the LittleJS engine (P1 holds `A`, P2 holds `L`). Hold to charge, release to jump. There is no framework or bundler for development: `index.html` loads `dist/littlejs.js`, `templates/gameFx.js`, then `game.js` as plain scripts.

## Commands

- **Run:** open `index.html` directly, or serve the folder (`python3 -m http.server`) and load `http://localhost:8000`. Prefer HTTP when driving it from an agent browser; `file://` previews can render only a static snapshot.
- **Syntax check:** `node --check game.js` (there is no test suite or linter).
- **Release zip (only when shipping):** copy `littlejs.release.js` from the LittleJS plugin's `dist/` into `./dist/`, then `npm install && npm run build`. Output is `build/index.html` plus `hopRace.zip` (both gitignored). Confirm the build log says it used the release engine, not the debug one.

## Architecture

- **`game.js`** is the whole game. Everything is global and prefixed `rc` / `RC_` to avoid colliding with LittleJS globals (top-level consts and function names share the engine's global scope).
- **`dist/littlejs.js`, `build.mjs`, `templates/`** are vendored from the LittleJS plugin and marked `linguist-vendored` in `.gitattributes`. Do not edit or review `dist/littlejs.js`; `templates/gameFx.js` (SoundGenerator, screen shake) is copied verbatim.
- **State machine:** `rcState` is `menu` | `play` | `win` (and `frozen`, a value I set from the console when headless-testing so the engine loop stops stepping players). `M` returns to the menu from play or win.
- **Modes** live in the `RC_MODES` array. Each has `name`, `desc`, optional `hint`, `solids`, and flags: `wallCling` (Wall Jump) or `type: 'orbit'` (Orbit). Adding an entry adds it to the menu automatically. `rcLoadMode(i)` builds `rcSolids`; `rcStart(i)` loads a mode and resets players.
- **Per-frame flow:** `gameUpdate` -> `rcStep(p)` per player, which dispatches to `rcOrbitStep` for Orbit. Win is `rcFinished(p)`. Rendering branches on `rcIsOrbit()`: platform modes draw `rcSolids` plus a finish flag; Orbit draws `rcDrawOrbitBoard`.
- **Platform modes (Classic, Wall Jump):** side view with Y up. Players move only by jumping. `rcAim` sweeps the angle with a cosine while the key is held, and power is the charge fraction. Collision is AABB against `rcSolids`, resolving X then Y. With `wallCling`, a mid-air side hit clings, faces the player away from the wall, and lets them charge and jump from it. Falling below `RC_KILL_Y` respawns at the last landed position.
- **Orbit mode:** polar physics, `(r, th)` plus `vr`, `vt`. "Down" is outward. The ball rests against the outer wall of its groove and always runs clockwise. `rcOrbitAdvance` is the single physics step used by both the real ball and the dotted jump preview, so the preview matches the real arc. Ridges are circles at `RC_ORBIT.ridge` radii with rotating exits (`gapW`, `gapSpeed`, `gapPhase`); `rcInGap` decides whether a ball passes a ridge. Winning means getting inside the innermost ridge. All Orbit tuning constants are in `RC_ORBIT`.

## LittleJS gotchas that bit this project

- Argument orders and units differ from other engines: circle/ellipse sizes are diameters, `ParticleEmitter` speed is per frame, and `Color.scale(scale, alphaScale)` scales alpha separately. Check `dist/littlejs.js` or the littlejs-api skill rather than guessing.
- Key tracking: `keyIsDown`/`keyWasPressed` take `KeyboardEvent.code` strings (`'KeyA'`, `'Space'`).
- When testing from a browser console, a backgrounded or hidden tab may not run the engine loop. Set `rcState = 'frozen'` and call `rcStep` / `rcOrbitStep` yourself, overriding `window.keyIsDown` to simulate input.
