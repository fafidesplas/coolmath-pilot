# Magnet Twins — devlog

## 2026-10-26 — GDD approved
- Pao approved `GDD.md`; status set to Approved and stage to `slice`. The vertical slice is already playable.
- Next: the phase 2 gate, a teammate plays the slice cold, with no explanation.

## 2026-10-21 — Feel loop 1: aim preview
- First playtest (Fafi): the slice works, but choosing the field direction felt unclear, especially aiming down.
- Fixed the menu buttons ignoring mouse clicks.
- Added the aim preview: a dashed ghost cone and arrow show where the field would go while the power is off, and targets in reach get a pulsing ring.
- Next: more feel notes from playtesting.

## 2026-10-21 — Vertical slice, first playable
- Started phase 2 before Pao's GDD approval, by Fafi's decision, so the GDD review and the slice run in parallel.
- Deterministic 120 Hz sim with no DOM (`src/sim.js`, `physics.js`, `magnet.js`): run, jump, stacking, carrying, crate pushing, 4-way fields with the shield rule, aim grace window, fixed plates, doors with lock plates, spikes, bolts, exit for two.
- One level, `w1l01` "Workshop Shift": pull the crate across the spikes, use it as a step, hold the door for each other, launch for the high bolt.
- Full shell: title (1P/2P start at once), level select, HUD, pause with controls card, restart, level complete with stars, saving, sound effects and hums, GameAnalytics stub logging to the console, `window.game`.
- Debug: `?keytest`, `?level=sandbox`, `?hz=144`, `?record`, `?replay=coop|solo`.
- `node tools/simtest.mjs` checks the mechanics against the GDD numbers and replays the bot solutions (co-op 13.5 s, solo 13.7 s). Both reach the exit and replay identically.
- Design changes found while building are in the GDD changelog. The biggest: the level 2 pit couldn't work with a 30° cone, so it now uses spikes.
- Not yet checked in a real browser (the agent sandbox can't run one). Next: play it, test `?keytest` on a Chromebook, then the 2c feel loop.

## 2026-10-21 — GDD ready for review
- Second critical review pass applied: up-aim grace window, radial field force, levels 2 and 3 can no longer be solved without powers, solo par from the solo recording.
- `GDD.md` status set to In review.
- Next: Pao reads the GDD; once approved, set Approved and stage "slice", then phase 2a build plan.

## 2026-10-21 — GDD critical review applied
- Phase 1c review: fixed three game-breaking issues (infinite flight with both fields, doors a single robot could open for itself, levels 1, 5 and 6 unsolvable as written) and eleven smaller ones. Full list in the GDD changelog.
- New tools committed to the design: per-level co-op and solo solution recordings, replayed to prove every level is solvable and to set par times.
- Next: one more review pass, then Pao reads it for approval.

## 2026-10-21 — GDD first draft
- Wrote `GDD.md` (Status: Draft) from the brief, using the recommended answers to the phase 1a questions.
- Key calls: 4-direction aim, fixed metal plates move the robot (Plus grapple, Minus jetpack), solo power is a toggle, 120 Hz fixed-step physics with a constant field force, robots can stack, solo par = co-op par × 1.5, paint shop is hats and patterns only, weekly challenge moved to Later, vanilla Canvas 2D.
- Next: phase 1c critical review, then Pao reads it for approval.
