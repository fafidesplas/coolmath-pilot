# Flip Runner — devlog

## 2026-11-10 — Phase 3: the Bell Tower (world 2)
- Ten levels (Take Off, Weave, Scraper, Stalactites, Switchback, Pistons, Lifts, Moving Pillars, Bell Ringer, Tower Exit), 26–50 s at 470 px/s, all solver-verified with 3 stars. 181 checks in `simtest`.
- **Moving blocks** in the sim: smoothstep path (no trig), carry when you ride them, side = wall, closing on you = `crush`, block clock stored in the flag snapshot so retries are identical.
- Lesson: the bat's speed is constant, so a block's phase when you arrive is fixed; a block with a free period can sit in the middle and make the level impossible (level 6 died at column 186 for every route). The kit's `mover(..., at)` now picks the phase so the block is at an end of its path when you arrive.
- Glider levels have no flip windows to measure, so `simtest` checks spatial slack instead: still beatable with a bat 8 px bigger (all pass at 16).
- Solver memory: nodes now keep only a summary; the first glider level ran out of memory with full states.
- The level select has clickable world tabs (the Bell Tower opens when the Crystal Cave's last level is done; `?debug` opens everything), and Next carries over to the next world.
- Not seen in a browser. Next: Fafi plays worlds 1 and 2; then world 3 (Twin), the daily/endless, skins.

## 2026-11-10 — Phase 3: the Crystal Cave (world 1)
- Phase 3a tools, per `PHASES.md` for skill games: a level kit (`tools/levelkit.mjs`, levels as programs), `levels.mjs` / `stars.mjs` / `deaths.mjs` / `show.mjs` around the solver, and `?debug` in the game (every level open, jump between checkpoints, live gravity/speed/kick).
- Phase 3b: levels 2–10 built (Ping Pong, Mind the Gap, Islands, Tall Room, Squeeze, Star Bait, Zigzag, Long Drop, Cave Exit). All ten pass `simtest`: 3 stars reachable, tightest flip window ≥150 ms, no plain stretch over 1.6 s, stored solution replays identically. 96 checks.
- Found while building: a hazard right next to a 1-tile step is a trap (the step lifts the bat under the next ceiling spike), stars on hazard tiles need a 25 ms double flip, and an exit with no ramps is a wall of 3–4 tiles. All now rules in the GDD.
- Levels open one by one now; the forms prototype is the debug level `proto`.
- Not seen in a browser. Next: Fafi plays world 1 (the gate for 3b), then world 2 (Glider) and 3 (Twin), the daily/endless, skins.

## 2026-10-28 — Bat theme
- Fafi: the game looked flat and generic. New theme: a lilac baby bat racing home before sunrise. It explains the mechanics: bats live upside down (Flip), fly (Glider: the bat spreads its wings) and travel with family (Twin: its orange sibling).
- Worlds renamed Crystal Cave, Bell Tower, Firefly Forest, Night Fair, each with a night sky gradient that warms towards dawn, two silhouette layers (stalactites, bells, trees, a ferris wheel), the moon and drifting motes of light instead of speed lines.
- Rock tiles with lit lips, little stalactites and crystal veins; crystal-shard spikes; glowing dashed edges on wall faces; lantern checkpoints; a moonlit home roost as the goal; moonlight portals; glowing stars. Title and menus sit in the cave too.
- Only visuals changed: the sim, the levels and the solver are untouched (simtest and the smoke test still pass). GDD art direction, world names and prompts updated.
- Not seen in a browser yet. Next: Fafi checks the look; then phase 3 (editor and the Crystal Cave levels).

## 2026-10-27 — Slice gate passed
- Pao played the vertical slice and gave the OK; stage moves to `content`.
- Next: phase 3a, the content tools, then the levels world by world.

## 2026-10-26 — GDD approved
- Pao approved `GDD.md`; status set to Approved and stage to `slice`. The vertical slice is already playable.
- Next: the phase 2 gate, a teammate plays the slice cold, with no explanation.

## 2026-10-22 — GDD rewritten around forms
- The forms prototype played better than flip-only, so the GDD now builds the game on three forms switched by portals: Flip (world 1), Glider (world 2), Twin (world 3), all mixed in world 4.
- Moving blocks move to level 15, speed pads to 25; no-flip zones are cut. Analytics add `quit:form:<form>`; the HUD shows the current form.
- GDD status stays In review: Pao needs to read the new design.
- Next: Pao reviews; then turn the prototype into world 2 and 3 openers.

## 2026-10-22 — Twin lane fix
- Playtest (Fafi): twins only worked when entering the top lane. Entering from the floor put you in the bottom lane, and the twin also spawned there, on top of you.
- Twin portals now list both lanes; the twin always takes the lane you are not in. Regression test added for both entries.

## 2026-10-22 — Forms prototype
- Fafi wants more varied mechanics. Prototyping "forms" switched by portals, all on the same single button:
  - **Flip**: tap flips gravity (the current game).
  - **Glider**: hold to climb, release to dive, at a fixed angle; surfaces can be slid along, wall faces kill.
  - **Twin**: a second runner appears in a parallel lane; one tap flips both, only when both have their feet down.
- New level `proto` (Lab 2 in the level select, ~29 s): Flip warm-up → Glider room with pillars → Flip → Twin lanes → Flip. Solver: 3/3 stars, tightest window 300 ms.
- Input now also sends a "held" bit; recordings and the solver handle holds.
- The GDD is not updated yet: if the prototype works, the next step is rewriting the worlds around forms.

## 2026-10-22 — Feel loop 1: faster, denser, louder
- First playtest (Fafi): "too slow and bland".
- Speed 320 → 440 px/s, gravity 5000 → 7000 with a stronger kick: a corridor flip now takes ~0.22 s.
- Rebuilt `w1l01` denser: 33 flips in 28 s (was 22 in 33 s); the solver's tightest window is 300 ms. A star that needed a 25 ms window was moved.
- Music: a synthesized 4-bar loop (kick, snare, hats, bass, arpeggio) on by default, with its own toggle.
- Speed feel: speed lines, a fast parallax layer of pillars with blinking lights, running dust, afterimages during flips.
- Close calls: "CLOSE!" pop, sparks and a ping when passing within 10 px of a spike; counted on the results screen.
- Next: play it again.

## 2026-10-21 — Vertical slice, first playable
- Started phase 2 before Pao's GDD approval, by Fafi's decision, as with Magnet Twins.
- Deterministic 120 Hz runner (`src/sim.js`, no DOM): gravity flip with 100 ms buffer and 60 ms coyote, auto-step on 1-tile rises, corner forgiveness, forgiving spikes, deaths (spikes, gap, wall), flag snapshots so every retry is identical, stars banked at flags.
- One level, `w1l01` "First Flip" (285 columns, ~33 s, 3 flags, 3 stars): spikes, floor gaps, a tall room, ping pong, an open ceiling, a squeeze with an auto-step, and islands. Generated by `tools/build-slice.mjs` until the phase 3 editor exists. "TAP!" cues for the first flips.
- Solver (`tools/solve.mjs`): beatable with 3/3 stars, 22 flips, tightest window 192 ms (the star in the tall room). `node tools/simtest.mjs` checks flip time, buffer, coyote, auto-step, spikes and identical respawns, and replays the solver's route.
- Full shell: title (runner flips when you click the corridor; Daily and Endless shown locked), level select with check badges, HUD with star slots, progress bar and death counter, pause, restart, results with COMPLETE ribbon and DEATHS stamp, saving, sounds, GameAnalytics stub, `window.game`. Code copied from Magnet Twins where it fit.
- Debug: `?level=w1l01`, `?replay`, `?record`, `?hz=144`.
- Not yet checked in a real browser (the agent sandbox can't run one). Next: play it, then the 2c feel loop.

## 2026-10-21 — GDD critical review applied
- Phase 1c review: 11 fixes, mostly about fair deaths. Every retry of a section is now identical (flag snapshots), 1-tile rises are auto-stepped, and hitboxes are forgiving. Also: death analytics as counts plus `quit:<type>`, daily best of 3, no death flash, endless speed cap, editor planned. Full list in the GDD changelog.
- `GDD.md` status set to In review.
- Next: Pao reads it for approval; then phase 2 (vertical slice).

## 2026-10-21 — GDD first draft
- Wrote `GDD.md` (Status: Draft) from the brief, using the recommended answers to the phase 1a questions.
- Key calls: gravity flip at 5000 px/s² (~0.29 s across a 6-tile corridor), 100 ms buffer and 60 ms coyote, collectible stars are the rating and bank at flags, free geometry instead of a fixed tunnel, gravity switches replace portals in world 4, endless and daily chain hand-made chunks, deterministic sim with a one-button solver.
- Next: phase 1c critical review, then Pao reads it for approval.
