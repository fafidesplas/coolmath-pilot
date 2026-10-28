# Bridge Budget — devlog

## 2026-10-28 — Vertical slice, first playable
- **Built:** deterministic XPBD sim (`src/sim.js`: 120 Hz × 8 substeps, gravity ramp 0.5 s, settle damping 1 s, 100 /s axial damping, 30 m/s clamp, step-averaged stress, breaking, slack cables, wheel contacts with friction and an engine cap, pass/fail rules). Editable bridge (`src/bridge.js`: automatic joints, snap and max-length clamp, terrain/area/overlap checks, auto-split, replace-on-redraw with "Upgrade/Swap", "Road here" block, caps, eraser, unlimited undo/redo). Road, wood, steel and cable all exist in the sim and editor; levels 1–4 only show road and wood.
- **Levels 1–4** (`levels/`), each with its reference and naive bridge in `levels/solutions/`. Level 4 Big Wheels is the slice level.
- **Play:** drag or click-click (chaining) building, ghost with cost label, reach circle, joint rings and ⊘ reason; Mirror (M); stress view (S) with %, pulled/squeezed arrows and cracks; first break marked after a fail; hint after 3 failed tests; tutorials for levels 1–3 and the eraser; Test / Stop / Restart (R) / 2× fast (F); slow motion and camera zoom on a new first break; stamps (MADE IT!, HELD TOGETHER!, CLOSE CALL!, SPLASH!, STUCK!), Fix it / Watch again; cost meter with ★★★ and ★★ lines, best flag, striped preview and the over-budget warning.
- **Shell:** title with one-click PLAY and a live demo of the real sim; level select (3 world tabs, stars, best cost, hard hat); pause (resume, load my best, clear, controls, levels, sound/music, menu); results (stamped stars, cost count-up, best, hard hat, engineer's cost after 3 stars; Next, Replay, Improve, Menu); saving (`cm_bridge-budget_save` with stars, best, last bridge per level, hats; `cm_bridge-budget_settings` with music, sfx, fast); synthesized SFX and a 100 BPM toy-workshop loop (on by default) with a snare roll that follows stress; GA stub logging the GDD 11 events; `window.game` with `mode`, `bridge`, `win()`, `loadBridge()`.
- **Design fixes (GDD changelog):** road stiffness 2,000 → 4,000 kN so level 2's bare road fails with margin (it needed only 101–107% before); level 4's reference is a 2 m Warren truss (82%); drive acceleration measured before gravity so 1:2 and 2:3 slopes are climbable.
- **Verified (Node only):** `node tools/simtest.mjs` passes 53/53: king-post within 1% of hand statics, settle under 3 cm/s by 1.5 s, slack cables, breaking, 8 vs 16 substeps agree, slopes, bit-identical runs at 60 Hz / 144 Hz / uneven frames / 2×, sim uses only exact arithmetic, every reference passes at ≤ 90% with no breaks (L1 0%, L2 70.4%, L3 44.0%, L4 82.0%), costs and thresholds match, every naive bridge fails with ≥ 110% demand, every bare-road split on level 2 fails. A 151-member bridge plus the truck takes about 0.02 ms per 120 Hz step in Node. A throwaway smoke test (stubbed DOM and canvas, real frame loop, real pointer and key events, buttons clicked by coordinates) passes 80/80: title toggles, PLAY, levels 1–4 built by drag, click-click, mirror, eraser and undo, fails with Fix it and stress view, hint, clear, fast-forward, replay, saving and restore, GA log, resizes, hidden tab. **Not seen in a real browser** (no browser in the sandbox): look, sound and feel are untested.
- **Left out:** garage and skins, convoys, boat, towers, prebuilt pieces in play (parsed only), "Load my best" ghost, level editor and `optimize.mjs`, a title demo that collapses behind the truck (it loops the level 4 reference), joints pulsing for the hint, dangling halves are drawn, not simulated.
- **Fafi, test first:** serve the repo root (`python3 -m http.server 8000`) and open `/games/bridge-budget/` (or `?level=w1l04` to jump to Big Wheels). Build level 4 with the trackpad: drag vs click-click, the ghost and cost label, the Warren truss. Then try level 2's 1 m truss on level 4 and watch the slow-motion snap and Fix it. Watch for: readability of stress colors, whether 8 px click slop feels right, music volume, frame rate on a Chromebook, and any console errors.

## 2026-10-28 — Phase 2a build plan
Fafi said go ahead without waiting for a plan review, so this is the plan the slice is built from.
- **Files** (STANDARDS.md layout, GDD 12): `src/config.js` (every number), `sim.js` (DOM-free, exact arithmetic), `bridge.js` (editable bridge, validation, costs, undo), `level.js` (parser, star thresholds), `game.js` (screens, build input, test flow, HUD; build gestures and the camera live here rather than in separate `build.js` / `camera.js`, since they are small), `render.js`, `fx.js`, `audio.js`, `save.js`, `analytics.js`, `input.js`, `main.js`. `levels/` one module per level plus `index.js`; `levels/solutions/<id>.json`. `tools/simtest.mjs`.
- **Copied, not imported**, from Ink Path: frame loop, letterbox resize, keyed canvas buttons (matched by key on pointerup), panels, FX pool, Sound synth and sequencer, save and the GA stub, renamed and re-tuned.
- **Order:** sim and `simtest.mjs` first with the GDD 12 calibration checks; then the reference and naive bridges for levels 1–4; then the bridge editor; then the play screen, the shell, audio and juice; last a Node smoke test of the whole game.
- **Faked or left out:** garage, convoys, boats, towers, editor and optimizer; the title demo loops the reference instead of collapsing.
- **Risks:** the sim's numbers (ported first and checked against the GDD's prototype figures); trackpad building (needs a real Chromebook).

## 2026-10-27 — GDD approved
- Pao approved `GDD.md`; status Approved, stage `slice`.
- Next: phase 2, the vertical slice.

## 2026-10-26 — GDD first draft and review
- Wrote `GDD.md` from the brief and the phase 1a answers. Key decisions:
  - XPBD spring-mass at 120 Hz × 8 substeps, deterministic (arithmetic and `sqrt` only), with a deliberately weak road deck.
  - Material and vehicle numbers calibrated with a throwaway prototype (not in the repo).
  - A pass counts even if pieces break. 1 star at any cost, 2 under budget, 3 under the reference × 1.05, plus a hard hat for beating the reference.
  - Joints are automatic; build by drag or click-click, with a ghost preview. No zoom or pan in v1.
- Levels 1–10 are checked in the prototype: each lesson's naive bridge fails and each reference passes at a peak of 90% or less. The worlds add terrain, arches, cables, convoys, towers, boats and the bus, not just bigger gaps.
- Review fixes:
  - a settle phase and stronger damping, because soft members made the bridges wobble like jelly;
  - all numbers re-verified with the final settings, and level 7's reference replaced with a robust one;
  - a Mirror tool, and slow motion only when the first break is new;
  - a check so that collapse-behind-the-truck passes can't empty the targets;
  - `level:giveup` analytics. Full list in the GDD changelog.
- Next: Pao reads the GDD for approval; then phase 2 (vertical slice on level 4, Big Wheels), starting with `sim.js` and `tools/simtest.mjs`.
