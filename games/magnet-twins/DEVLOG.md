# Magnet Twins — devlog

## 2026-11-18 — Art styles from real art packs
- Feedback: the old styles (pixel, factory, neon) read as recolors of the code art. They are replaced by three styles built on downloaded art packs, all CC0: `?art=bay` Sunset Bay (pixel art: Gum Bot robots by GrafxKid, Mega Bot Areas and Stomper tiles by ansimuz), `?art=lab` Sci-Fi Lab (illustrated: The Robot and the Sci-Fi Platformer Tileset by pzUH / GameArt2D), `?art=yard` Robot Yard (flat vector: Kenney Robot Pack and Platformer Pack Redux). `classic` stays the default.
- The pack sprites now draw the robots (idle, walk, jump frames, flipped with the facing), solid and metal tiles, spikes, water/acid, crates, gates, the platform slab, the exit door, bolts and, where the pack has one, the checkpoint flag and lock plates. Fields, aim previews, the HUD and menus stay drawn in code with each style's palette and font. Each robot keeps a plus/minus badge so color is never the only cue. Hitboxes and the sim are untouched.
- New `src/sprites.js` holds the sprite drawers; `src/art.js` describes each style as sprite rects on small sheets in `assets/art/<id>/` (about 0.3, 0.5 and 0.2 MB). The fonts and Kenney sounds from the old styles moved to the new ones. Credits in `assets/CREDITS.md`, list in `art-options.json`, previews (1600x900, level 1-10) in `assets/art/previews/`.
- Tests: `node tools/arttest.mjs` and `node tools/simtest.mjs` pass. Seen in headless Chromium: level 1-10 in all four styles.
- Next: pick a direction with Coolmath; then draw the missing pieces (plates, flags) in the chosen pack's style.

## 2026-11-18 — Art styles for the Coolmath presentation
- Four looks you can switch live, for comparing in the meeting: `?art=classic` (default, the GDD look), `?art=pixel` (Pixel Workshop), `?art=factory` (Toy Factory), `?art=neon` (Night Neon). The pill at the bottom left or the V key cycles them without a reload and rewrites `?art=` in the URL, keeping the other params (`?level=w1l10&art=neon`). `&pill=0` hides the pill for clean captures. Gameplay and the sim are untouched.
- Each style changes the palette, font, tiles, background, buttons/panels and sounds. Pixel and Toy Factory use Kenney CC0 sprite packs, and Pixel draws the world at 45% resolution for real pixels. Night Neon is drawn in code with glow, plus an OFL font and Kenney sci-fi sounds. Files are in `assets/art/<id>/`, credits and licenses are in `assets/CREDITS.md`, and the list for the presentation page is `art-options.json`. Total about 600 KB.
- Juice: particles are drawn now (they were spawned but never drawn, so the confetti, sparks, dust and the bolt flying to the HUD were invisible), fades between screens, a title intro (the logo pops in and the twins slide in), a toast and a flash when the style changes, and M mutes from anywhere.
- Tests: `node tools/simtest.mjs` passes. The new `node tools/arttest.mjs` boots the real game headless with stub canvas/DOM and, for every style, draws the title, level select, w1l10 and w2l13 in both modes, pause and results. It also checks every asset file exists, the pill/V cycle and URL update, and that art-options.json matches.
- Seen in headless Chrome: the title and levels 1-10 and 2-3 in all four styles. Not checked by hand: the level select and results panels in the new styles, sample playback in Safari, and the 60 fps cost of the neon glow on a Chromebook.
- Next: pick a direction with Coolmath, then fold the chosen style into the GDD (art section and palette).

## 2026-11-17 — World 2 begins: hanging platform and levels 11–13
- New element: the hanging platform on a horizontal rail. A 3×1 metal slab on a ceiling track (drawn with wheels, arms, end stops and ◀ ▶ arrows on the slab). It moves only along its rail between the rail ends, at half the field acceleration, with no gravity, and stops within 0.2 s when no field holds it. Riders are carried. A robot's field never moves the platform it stands on. The vertical chain variant is parsed and drawn too but not tested or used yet.
- Levels 11–13 from `tools/build-world2.mjs`: **Hang On** (Plus on the monkey bars, Minus jetpacks onto the beam, Plus holds the gate), **Piggyback** (Plus rides Minus's dash and jetpack), **Cable Car** (Minus rides the platform while Plus leads it from below, then holds the door for Plus). Par 14 / 14 / 18 s in both modes.
- Level select: world tabs are buttons. World 2 opens when level 10 is finished, and Next on the results of level 10 goes to 11. Add `?unlock` to the URL to open every world for a demo.
- Try it: `?level=w2l13` (add `&mode=solo` for solo), watch the bot with `?level=w2l13&replay=coop` or `replay=solo`, the same for `w2l11` and `w2l12`.
- Tests: `node tools/simtest.mjs` runs 136 checks, all passing. That is the 102 old ones (world 1 unchanged), 13 new platform checks (only moves on its axis, no gravity, half acceleration exactly 1500 px/s², clamps at both rail ends, stops in ≤ 24 steps = 0.2 s, carries a rider, a rider can't move its own platform), and 21 for the new levels.
- Found while building: the platform's sideways pull from below is at most half the force (30° cone), so it can't keep up with a robot running underneath. It does follow short steps. Level 13 is built around that, and it is written down in the GDD.
- Not played in a browser yet (none on this machine): the platform drawing was only checked against a stub canvas. Next: play 11–13 in co-op and solo, check the slab render and that "lead it in steps" reads without text; monkey bars still run at full speed (the GDD says 50%); then levels 14–20.

## 2026-11-16 — Level 10: the Workshop Exam
- `w1l10` is now the real exam on two floors. Downstairs (the old slice level): stack for the block bolt, pull the crate over the spikes, step up, hold the door. A shaft on the right: launch from a one-tile step and pull Minus up, as in Boost. Upstairs, back to the left: stepping stones over water to the exit in the top-left corner.
- First level with a checkpoint: the flag stands where Plus lands at the top of the shaft; a fall in the upper pool respawns both robots there (checked by hand with the bot).
- Recordings: co-op 50.6 s, solo 51.1 s, so par is 64 s in both modes. `node tools/simtest.mjs` passes in full. GDD level line and changelog updated.
- Not yet played in a browser. Next: play it (`?level=w1l10`, or watch the bot with `?level=w1l10&replay=coop`), then worlds 2 and 3.

## 2026-11-11 — Phase 3: world 1 levels 1–9
- Levels 1–9 and the slice level (10) are built from `tools/build-world1.mjs`; each has a solution script (`tools/solutions.mjs`) that a macro bot (`tools/bot.mjs`) plays in co-op and solo. `node tools/simtest.mjs` replays the recordings, checks 3 bolts, determinism, par (recorded time × 1.25) and that a bot that only walks right does not finish.
- New levels: Boost (step added), Tower, Wet Feet (water stones), Carry (crate across a spike pit).
- Workflow for a level: edit the builder, `node tools/try.mjs <id> coop|solo`, then `simtest --write --only=<id>`, rebuild, `simtest`.
- Next: turn level 10 into the real Workshop Exam (launch, checkpoint, par over 60 s), then worlds 2 and 3 (hanging platforms, spring plates, chain platforms need new sim code).

## 2026-10-27 — Slice gate passed
- Pao played the vertical slice and gave the OK; stage moves to `content`.
- Next: phase 3a, the content tools, then the levels world by world.

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
