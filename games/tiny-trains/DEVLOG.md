# Tiny Trains — devlog

## 2026-11-14 — First playable prototype (for the 2026-11-20 presentation)
- Fafi took Tiny Trains over and asked for a prototype built from the Draft GDD (GDD not yet Approved; `meta.json` left as is, since `PHASES.md` has no "prototype" stage).
- **Built:** `index.html` + `src/` (vanilla ES modules, canvas, no build step). `track.js` holds the edge tables, `sim.js` the deterministic integer tick sim shared with the tests, `game.js` the states, `render.js` the board, trains and particles, `ui.js` the shell, plus `audio.js` (WebAudio blips), `save.js` (`cm_tiny-trains_save`), `analytics.js` (console GA stub).
- **Plays:** straight, curved and switch tiles, buffer stops, depots with clock pips, stations with roof color and shape. Planning (tap a switch, or Tab / Shift+Tab then Enter) → GO / Space → trains run at 450 ms ticks (F or ⏩ for 2×) → crashes (`collision`, `swap`, `derail`, `wrong_station`, `lost`) stop the run with a puff, shake and a label, then rewind to planning (tap or any key skips). All trains home → results with 3 stars: Home, First run, Par (prototype stand-in for the Ticket star, see GDD 3.12). R resets switches (or stops a run), P / Esc pauses.
- **Shell:** title (Play goes to the next unsolved level), level select with stars and unlocks (two past your furthest solve), pause, results with Next / Retry / Menu, sound toggle, save. `?level=1-3` (or `world01:level03`, or `3`) jumps straight into a level. `window.game` testing hook with `start()`, `restart()`, `go()`, `flip(x,y)`, `win()`.
- **Levels:** World 1 levels 1-1 First Switch, 1-2 Two Turns, 1-3 Two Colors, 1-4 Merge, 1-5 Wait Your Turn, in `levels/world01.js`. 1-4 and 1-5 were redesigned because two trains that merge onto one line can never be split to different stations with locked switches (GDD 6 updated).
- **Tests:** `node tools/simtest.mjs` (66 checks: track tables, every crash cause, the loop, and per level: track joins up, reference solution wins and replays identically, start setting does not win, brute force over every switch setup matches par). `node tools/smoketest.mjs` (20 checks: boots the real game in node with a stub canvas and plays the shell and every level). The art has not been checked in a real browser in this session, so give it a look before the presentation.
- **How to play locally:** from the repo root run `python3 -m http.server 8000`, then open `http://localhost:8000/games/tiny-trains/` (it needs a server because it uses ES modules).
- **Not built yet:** golden ticket, hints, flip switches, crossings, bridges, signals, tunnels, daily, garage/liveries, music, level editor and solver page, levels 1-6 onward. The planning route highlight from GDD 3.5 is also missing; switches show their active branch and an arrow instead.
- **Next:** play it in Chrome at 800×450 and 1920×1080 and tune the art and the 450 ms tick; add the ticket (1-4 onward) and the hint; build levels 1-6 to 1-12; GDD review and approval.

## 2026-10-19 — GDD first draft
- Wrote `GDD.md` (Status: Draft) from the brief, using the recommended answers to the phase 1a questions.
- Key calls: deterministic 450 ms ticks, 1-cell trains, switches locked during the run, sprung trailing switches, stars = home + ticket + par (net flips).
- Next: phase 1c critical review, then a teammate reads it for approval.
