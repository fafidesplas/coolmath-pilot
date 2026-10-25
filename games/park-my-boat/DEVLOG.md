# Dock All The Boats — devlog

## 2026-10-25 — GDD questions answered
- Pao answered the GDD's open questions: time-based stars with a 50% accuracy minimum, retry in place, clock paused between boats, restart skips the first preview, 2 worlds of 10, first scale jump at level 4, finish-to-unlock, look-ahead camera with edge arrows, no daily, global drift, par = clean run × 1.2, support tones kept, analytics question confirmed.
- Music: Pao adds it later; the MUSIC toggle comes with it.
- Next: phase 1c critical review, then Fafi reads it.

## 2026-10-24 — GDD first draft
- Wrote `GDD.md` (Status: Draft, reviewer: Fafi). It records the prototype as built and proposes the v1 changes: stars from time against a par (a boat counts when parked with 50%+ accuracy), 2 worlds of 10 levels (5 existing levels slot in as 4, 10, 11, 14, 18), finish-to-unlock, restart without the slip preview, camera look-ahead and edge arrows, a music loop, and the analytics event list.
- The 12 phase 1a answers are in the GDD as "Proposed" under Open questions, waiting for Pao and Fafi to confirm.
- `meta.json` stage: brief → gdd.
- Next: phase 1c critical review, then Fafi reads it.

## 2026-10-24 — Slower glide from the slip
- Owner: the move back from the slip was too fast. The camera now stays on the slip for 3 s (was 2), then glides back at 40% of its normal speed (`SLIP_GLIDE`).
- The boat gets control when the camera is nearly back (within 10% of the view, zoom within 20%), not after a fixed time, so short trips end soon and long ones get the time they need (capped at 6 s, `SLIP_MAX`). The camera then eases back to full speed over 0.4 s, so it doesn't jump.
- Glide times measured: Way Down 1.4 s, Odd Couple 2.7 s (the rowboat starts about one screen away from its slip), Marina 4.8 s for the jet ski and 4 s for the sailboat, Rush Hour 5.4 s. Click, Space or Enter still cuts to the glide.
- Next: owner plays; with the 3 s hold, a long level takes about 8 s before you can steer, so check that restarts don't feel slow.

## 2026-10-24 — Every boat starts by showing its slip
- Owner: instead of a full-level preview, show the parking spot before every boat, then glide back to the boat. Each turn now opens on the new boat's slip at that boat's framing for 2 s, then the camera glides back and the boat gets control 1.4 s later. The "Boat 2 of 3" card stays up the whole time. A click, Space or Enter cuts to the glide.
- This replaces the size reveal (framing the parked boat next to the new one): the zoom from the parked boat to the new slip shows the size jump instead.
- Removed the level preview from the last commit (`preview` fields on Marina and Rush Hour, `PREVIEW_TIME`). Single-boat levels (Rush Hour) also show the slip, without the card.
- Checked in Chrome on all 5 levels: opens on the slip, ends on the boat, no console errors, editor self-test 5 levels 0 problems.
- Next: owner plays; tune the 2 s / 1.4 s, and see if the slip shot should be skipped when the slip is already in view (Odd Couple's rowboat).

## 2026-10-24 — Level preview for big layouts
- Owner: big levels should open on the whole layout, then zoom in to the first boat. A level can now have `preview: [x0, y0, x1, y1]`: on load the camera frames that box for 3 s with a card (level number, name, how many boats to park), then the usual zoom in and boat card follow. Single-boat levels skip the boat card.
- Click, Space or Enter skips the preview. Restart skips it too; it plays again after you play another level. The editor's test play skips it.
- Marina and Rush Hour have a preview. Editor self-test: 5 levels, 0 problems.
- Next: owner plays both; decide if 3 s is the right length and if the smaller levels want one too.

## 2026-10-24 — Marina
- Owner (from a photo of a crowded yacht marina): new level 5, Marina. A 380 x 350 m basin with big yachts (40–52 m) along the quay, an upper pier from the west wall (sailboats, speedboats and party barges on top, 28–36 m yachts underneath) and a lower pier from the east wall (small craft on top, sailboats and speedboats underneath). 218 moored boats, only jet ski to yacht size: no ships, tugs or swans.
- The jet ski parks in a gap among small craft on the lower pier, the sailboat on the upper pier, then a 48 m yacht (k 6) waits in the middle fairway and squeezes into a 26 m gap on the quay. Six traffic boats at ~3 m/s: rowboat tenders, speedboats, a jet ski loop round the upper pier's end, a party barge.
- New helper `berths` in `levels/levels.js`: a row of boats side by side along a pier edge from a repeating pattern, with free gaps left for the player's slips.
- Checked: 60 fps, no moored boat moves on load, `win()` parks all three boats with no neighbor bumped, editor self-test 5 levels 0 problems.
- Next: owner plays it; check the yacht has room to turn into its berth (fairway is ~77 m) and tune traffic.

## 2026-10-24 — Rush Hour
- Owner (from an HTML sketch): new level 4, Rush Hour. The jet ski runs east down a 290 m channel to a slip at a quay. Three canals cross it at right angles, each packed with traffic on a loop that crosses the channel twice (north on one leg, south on the other): 6 rowboats + 6 swans at ~3 m/s, 3 party barges + 3 sailboats + 3 Zippys at ~4 m/s, 5 mega yachts + 5 tugboats at ~7 m/s. 20 m of sand between canals is where you stop and wait for a gap.
- Two level helpers in `levels/levels.js`: `loopLane` (boats spaced evenly on a racetrack loop across a canal) and `sandAround` (sand everywhere in a box except a list of water rects). Traffic speeds are shares of each boat's top speed, picked so a whole lane moves at one pace.
- Traffic gets an optional `pace` (m/s, loops only, also in the editor panel): each boat keeps to a timetable around its loop, speeding up to 3x its throttle when behind and easing off when ahead. Without it, boats sharing a loop drifted together within minutes (0.1 m/s differences add up).
- The yachts can't U-turn in their 140 m canal, so the loop ends open into wide lagoons. In a 10-minute simulated run all 31 traffic boats stay at least 5 m off the sand, with one brief yacht-tug touch. Editor self-test: 4 levels, 0 problems.
- Next: owner plays it; tune gaps and lane speeds so a run takes 30–60 s.

## 2026-10-24 — Jet ski camera zoomed out 3x
- Owner: the jet ski's camera shows 3x more around it (27 boat lengths across instead of 9), so other boats come into view in time. New optional `view` field on a boat type multiplies its framing.
- Next: play Way Down and see if the jet ski is still big enough on screen to control.

## 2026-10-24 — Jet ski in Way Down
- Owner (level editor): Way Down is now container ship → tugboat → jet ski. Two traffic boats sail every turn at 0.6 speed: a Party Barge going back and forth on a short line, and a Sailboat on a long loop near the jet ski's start.
- Next: give the jet ski a hint, and play it to see how the camera works with the smallest boat (see Concerns in the brief).

## 2026-10-24 — Renamed to Dock All The Boats
- Owner: the game is now called Dock All The Boats. Changed the page title, the title screen (smaller type, 2.8 instead of 3.6, so the longer name fits), the brief and the code headers.
- Kept the folder `games/park-my-boat/`, the save key `cm_park-my-boat_save` and the `pmbEditor` hooks, so saves and the dashboard link keep working.
- Next: check the title screen at 800x450.

## 2026-10-24 — Pointy hulls get tapered colliders
- Owner: the collision circles on pointy hulls were full width all the way to the bow, so big ships collided 20-30 m past their drawn tips. Pointy hulls now get circles fitted to the hull (`fitCircles` in `src/boats.js`): each as big as fits inside the hull plus 5% of the half-width, shrinking toward the bow and stern. Cruise ship 18 -> 28 circles, bow circle 20 m -> 1.4 m.
- Spin inertia now spreads the mass over the circles by area (`src/physics.js`), so the small tip circles don't make boats hard to turn. Small boats still come out up to 13% harder to turn.
- Swan, Party Barge, Tugboat, logs and landmasses keep their colliders.
- Next: play every level and check the bow bumps and the turning feel.

## 2026-10-24 — Bonus level hidden
- Owner: hide the bonus for now, but keep it in the design. Continental Drift stays in `levels/levels.js` and in the brief, but the game leaves out `bonus: true` levels unless the URL has `?bonus`. Players see World 1's three levels only.
- Next: write it into the GDD as a bonus level once the GDD exists.

## 2026-10-24 — Islands and continents are a bonus level
- Owner: the island and the continent are a bonus for now. Continental Drift is marked `bonus: true`, so World 1 is now Odd Couple, Way Down and Mixed Nuts.
- Level select: bonus levels come after the regular ones on a light "BONUS" card. PLAY skips them when it picks the next level. After the last regular level, the NEXT button reads "BONUS". Analytics ids for bonus levels are `bonus:levelNN`.
- Next: decide whether the bonus unlocks only after World 1, once levels are locked.

## 2026-10-24 — Jet ski
- Owner: new boat, the Jet Ski (`jetski`), 2.4 m long: smaller than the rowboat (2.9 m), bigger than the old bathtub (1.8 m). It is now the smallest boat.
- Handling: light (mass 0.8) and quick (power 7). It slides a lot (sideways drag 1.2, about the same as Zippy) and turns well even when slow (wash 2.6, like jet steering). Reverse is very weak (0.3), so stopping takes the anchor or planning ahead. Teal hull with a cream nose cowl, navy seat, handlebars and a jet nozzle.
- Not used in any level yet. Next: put it in a level (it can be picked in the editor) and tune how it feels.

## 2026-10-24 — Bathtub and paper boat removed
- Owner: removed the Bathtub and the Paper Boat, with their hulls (`tub`, `paper`) and deck decorations. The smallest boat is now the Swan Pedalo (2.6 m).
- Way Down is now container ship → tugboat, and Mixed Nuts is mega yacht → cruise ship → swan. The title parade shows Zippy in place of the paper boat.
- Next: play Way Down and Mixed Nuts. They are shorter now, so check that they still have enough going on. The ducks in Way Down sat by the paper boat's slip and may need to move.

## 2026-10-24 — Buoys grow with big boats
- Owner: buoys should stay visible next to the bigger boats. Each buoy is now at least 1/12 of the current boat's length wide (`BUOY_SHARE`; try others with `?buoy=`). When a bigger boat starts, it grows smoothly over about a second. Its collision size and mass grow with it, so what you see is what you hit. When a smaller boat comes next, it shrinks back, but never below its size in the level data. The damage bill still uses the level size.
- Checked in Chrome: in Odd Couple the buoys go from 9 m wide with the rowboat to 25 m with the cruise ship, and the buoy is clearly visible. Mixed Nuts starts at 13 m with the mega yacht. No console errors.
- Next: in Continental Drift the buoys grow to 2.5 km for the island and 250 km for the continent. Check whether that looks silly or right.

## 2026-10-24 — No more mooring springs
- Owner: a start point is just a start point. Nothing is pulled back home anymore: boats waiting their turn in the chain, parked boats, moored boats and buoys all stay wherever a bump leaves them. A boat knocked off its start starts its turn from there.
- Removed the `home` spring from `Body` and `moor()` from `src/main.js`. Moored boats now behave like drifters and slow down only by water drag. Buoys are free-floating and still bouncy.
- Next: play each level and check that nothing important drifts away (buoys especially), and that a knocked boat never starts in a bad spot.

## 2026-10-24 — Anchor spin-out no longer knocks big ships out of the slip
- Owner: dropping anchor in the slip as a big ship spun it out of the slip. The spin-out now starts at zero at the speed limit and reaches full strength 3 units over it (`ANCHOR_SPIN` = 6 rad/s). It's divided by the square root of the boat's size and spun up over 0.3 s (`ANCHOR_SPIN_TIME`), not in one frame. It goes the way the boat is already turning (a random side only when it isn't turning), and the anchor lands on that side of the bow.
- Measured, turn 0.6 s after the drop (before → after): rowboat just over the limit 63° → 1°, rowboat at top speed 149° → 74°; mega yacht just over 22° → 1°, at top speed → 8°; container ship at 5.3 units 43° → 3°, at top speed → 4°. Below the limit nothing changed.

## 2026-10-24 — Clearer message for dropping anchor too fast
- Owner: "Too fast!" is now "Slow down before you drop anchor!" (slightly smaller text so it fits). Popups now stay on screen when the boat is near the edge.
- Found while looking into the jerk on anchoring: above 2.5 speed units the boat got an instant spin in a random direction (4 rad/s just over the limit, up to 13 for the rowboat, 8 for the container ship).

## 2026-10-24 — Closer camera for big ships, arrow to an off-screen slip
- Owner: the container ship was too far zoomed out. The camera no longer has to keep the slip in view. It follows the boat, a little ahead of where it's going (0.8 s of travel, at most a quarter of the view).
- Ships of 50 m and longer (`BIG_SHIP_LENGTH`) now get 3.5 boat lengths across (`BIG_SHIP_VIEW`; try others with `?shipview=`), down from about 7.8. The container ship view went from about 3.2 km wide to 1.4 km. Smaller boats keep their old number of lengths (3 + 6 / slowdown).
- When the middle of the slip is off screen, a yellow arrow at the edge of the play area points to it and shows the distance. It stays below the scale bar.
- Checked in Chrome: container ship in Way Down (arrow with the slip up-left and straight up), mega yacht in Mixed Nuts. No console errors. Not checked: every level played through with the new framing.
- Next: owner checks the zoom on each big ship.

## 2026-10-24 — Foam trails along the sides of moving boats
- Owner asked for foam on the sides of the boat, like a car's tire tracks when it drifts. Every moving boat (player, traffic, and boats that get shoved) now lays a foam streak along each side. The streaks drift outward and fade over 2.2 s, so a straight run leaves a V and a turn leaves curved tracks.
- Sliding sideways puts more foam on the side that pushes the water, spreads that streak wider, and throws spray drops off it. The amount follows the boat's speed as a share of its own top speed, so a rowboat and a container ship both foam the same way. The stern rings are unchanged.
- Checked in Chrome: rowboat straight and turning hard in Odd Couple, the container ship turning in Way Down. No console errors.
- Next: owner checks the look and the amount of foam.

## 2026-10-24 — Fixed zoom in play, editor object list, smoother editor zoom
- Owner: the player can no longer zoom. The mouse wheel did nothing else in play, so it's simply gone (with `zoomBias`); each boat gets the camera's set framing. The editor's zoom never carries into play: a play-test and every level start snap the camera to the boat's framing.
- Editor: an Objects list in the panel shows every moored, loose and traffic boat, buoy, log, duck family, landmass, sand, dock and current, grouped by kind. Click a row to select and frame it; selecting on the canvas highlights its row.
- Editor zoom follows the real scroll amount (LittleJS only gives the sign per event, so trackpads zoomed far too fast): about 15% per mouse notch, small steps on a trackpad.
- Next: owner checks the zoom feel on the trackpad.

## 2026-10-24 — Editor: no sounds, and a selection crash fixed
- Owner: boat sounds played while dragging in the editor (every edit reloads the level, which sounds the new boat's horn). `sfx()` is now silent while the editor is open; play-tests still have sound. Checked: 0 sounds during a 15-step drag, the horn plays when a play-test starts.
- Fixed a bug from the traffic change: in a level with no traffic, selecting anything threw in the panel title (`def.traffic[...]` on a missing list), so the panel stopped drawing and drags didn't work. Checked by clicking every start, slip, moored boat, buoy, duck family, landmass and dock in all 4 levels (57 clicks): the panel draws in full each time, no console errors.

## 2026-10-24 — Traffic boats with drawn paths
- Owner's choices: end behavior per boat, real physics, click-to-place points, and per-turn timing. New `traffic` in the level data: `{ boat, k?, path: [[x, y], ...], end: 'back' | 'loop' | 'stop', speed: share of top speed (default .6), during: [boat numbers] (default every turn) }`.
- Each traffic boat is a normal body with the player's engine and rudder (`driveBoat`, now shared). It follows a Catmull-Rom curve through the points, aiming 1.5 boat lengths ahead and slowing for sharp turns. Outside its turns it cuts the engine and coasts to a stop where it is. Hits count on the damage bill like other boats; traffic leaves a wake and has a captain.
- Editor: Add traffic (type from the list), P to add points by clicking, drag points, I insert, Delete point, Reverse path; the panel has boat, size, speed %, end behavior and a checkbox per parking turn. Paths show as curves; the selected boat's points get numbered handles.
- Measured (tug on a 1.5 km loop in Odd Couple, simulated 60 s): 0.4 m off the curve on average, 3.6 m at most, cruising at 59% of top speed with speed .6. Back and forth turns around at the ends, stop halts at the last point, `during: [2]` sits still in turn 1 and moves in turn 2, knocked 60 m sideways it is back on the path within ~7 s, a rowboat ramming it moves it 0.01 m.
- Fixed in the editor: snapped values carried float dust (442.40000000000003), so a second save would have rewritten unchanged parts; values are cleaned and Save ignores differences under 1e-9.
- No level has traffic yet; the tests above used temporary data. Next: add traffic to a level in the editor and play it.

## 2026-10-24 — Odd Couple edit from the editor
- Owner's first save from the level editor into the real folder (it works). Odd Couple: the bottom sand strip is gone, so the harbor is open to the sea to the south, and the cruise ship starts at (225, 210) facing 75° instead of (1180, 470) facing left. `...basin(...)` was written out as `land` and `docks` because one of its strips changed.
- Not replayed by hand yet.

## 2026-10-24 — Level editor
- New debug-only level editor, modeled on Hop Race's: `tools/editor.js`, opened with `E` (or `?edit=<level number>`). Pan and zoom over the whole range (paper boat to Pangaea), select and drag boat starts, slips, moored and loose boats, buoys, logs, ducks, sand, docks, currents and landmasses; rotate, nudge, duplicate, delete, add from the panel; reorder the parking chain; undo/redo; new and duplicated levels. `E` play-tests (Shift+E from the selected boat), finishing a test returns to the editor with the result.
- Save writes `levels/levels.js` through Chrome's file access. Unchanged parts of an edited level keep their exact text; changed parts are written as numbers (angles as PI fractions when they are, big numbers as `3.5e6`). Editing something that came from a helper (`...basin(...)`, `tiedUp(...)`, `HARBOR_ISLAND`) writes that part out in full; the helper itself is never changed.
- Hooks in `src/main.js`, all no-ops without the editor: `pmbEditor.update()` at the top of `gameUpdate`, `renderWorld()`/`renderUi()` in `gameRender` (the HUD is hidden while editing), no `Start` analytics while editing, and test runs don't save stars.
- Tested in Chrome with simulated mouse drags over several frames and a stand-in folder (the real folder picker is a permission prompt for the owner): move, rotate, slip sliding along its pier, sand moved and undone, new sand, resize, sand to dock, delete a moored boat, add and duplicate a buoy, move a harbor island lobe (helper unchanged), save two levels (only their text changed; the written file loads back to the editor's data, apart from angles rounded to 4 decimals), save a new level, play-test, play from boat 3, finish a test run (no stars saved). `selfTest()`: 4 levels, 0 problems. Normal play unaffected: all 4 levels still complete.
- Not tested: saving into the real folder. Not done: editing a landmass's circles by dragging (they are a text field), deleting a level (remove it from the file by hand).

## 2026-10-24 — Roomier slips for big ships
- Boats 50 m and longer (mega yacht, cruise, container, island, continent) get slips 15% longer and wider, and 23° of heading allowance instead of 20° (`BIG_SHIP_LENGTH`, `BIG_SHIP_LEEWAY` in `src/main.js`). Position scoring is unchanged.
- Moved things so the bigger slips don't overlap anything: cruise slip in Odd Couple and Continental Drift 30 m right; in Mixed Nuts the swan 25 m left, the cruise 10 m right, the yacht, bathtub and ducks 15 m right; the island bay's islets 1.8 km apart; Pangaea's landmasses 210 km out and 150 km right.
- Fixed: Way Down's container ship started 50 m inside the land; it now starts 100 m left. Harbor sand strips overlap instead of meeting edge to edge, so the hairline seams in the sand are gone.
- Next: play the big-ship parks and see if 15% is enough.

## 2026-10-24 — Plain text
- Replaced the joke writing with plain text: hints are instructions, the anchor spin-out says "Too fast!", a miss says "Not in the slip. Try again.", the title line is "Park boats of every size.", level select says "SELECT LEVEL", "Ducks offended" is "Ducks hit".
- Removed the collision popups (BONK!, QUACK!, "Insurance!" and so on) and the quote on the results screen. Hits still show through sound, splash and wobble.
- Added a Writing rule to the brief: plain and direct, no quips.
- Next: decide on the level names (Odd Couple, Way Down, Mixed Nuts, Continental Drift) and the dollar damage bill.

## 2026-10-24 — 50% faster
- Every boat's engine power is multiplied by 1.5 (`SPEED` in `src/main.js`, `?speed=1` in the URL for the old speeds), so top speed is 50% higher for all of them. Turning circles stay the same size; coasting goes 50% farther.
- Top speed in lengths per second, before → now: rowboat 2.1 → 3.1, paper boat 2.9 → 4.4, swan 1.0 → 1.5, tug 1.0 → 1.5, cruise 0.45 → 0.68, island 0.34 → 0.51, continent 0.30 → 0.45.
- Next: play it with the new drift. Arriving faster means more anchor spin-outs (they start above 2.5 toy units per second).

## 2026-10-24 — More drift
- Letting go of the throttle drops the player's forward drag to 30% (`COAST_DRAG` in `src/main.js`, `?coast=1` in the URL for the old feel). Top speed and acceleration are unchanged; reverse and the anchor brake as before.
- Coasting from top speed to 10%, before → now: rowboat 1.7 → 5.6 lengths (2.1 → 6.9 s), tug 0.7 → 2.5 (1.9 → 6.4 s), cruise 1.0 → 3.4 (5.8 → 19 s), continent 0.6 → 1.9 (4.8 → 16 s).
- Next: play it. Watch for big ships taking too long to settle, and more anchor spin-outs from boats arriving fast.

## 2026-10-23 — Harbor island
- Continental Drift: the harbor is now a bay cut into the south coast of a grassy island (sand jetties with round tips, lobes of land around them), open to the sea. Before, it was a square of sand with round bumps that read as a flower when zoomed out. The other levels keep their enclosed harbor.
- Next: see if the harbor island reads at island zoom without a label.

## 2026-10-23 — Big ships stop dragging
- The size slowdown (k^0.3) is now capped at 1.25x (`MAX_SLOWDOWN` in `src/main.js`; `?slowdown=2` etc. in the URL to compare). Boats under ~2 m are unchanged.
- Seconds to cover one boat length from a standstill, before → now: tug 2.6 → 1.7, yacht 6 → 3.8, cruise 9.4 → 4.3, container 10+ → 4.6, island 10+ → 4.8, continent 10+ → 5.3. Turning is 2–7x quicker too.
- Next: play all 4 levels and see if the big ones are still too slow (the next lever is their own power stats in `src/boats.js`).

## 2026-10-23 — Classic levels cut
- Removed World 2 (the 10 one-boat Classic Marina levels) and the fixed-camera, toy-scale code only they used. The game is the 4 World 1 chain levels.
- Old saves keep stars for levels 5–14; they are ignored.
- Next: play the 4 levels by hand, then the GDD.

## 2026-10-23 — Continental Drift
- New World 1 level: rowboat → cruise ship → island (30 km) → continent (3000 km), each 100x the last. The island parks in a bay between two islets next to the harbor island; the continent closes the gap in Pangaea.
- Islands and continents are boats with blob hulls (circles, outline traced from them) and grass, volcano, palms, mountains, forests and a city drawn on. Static landmasses (`lands` in level data) collide as round posts.
- Land rects and blobs draw as one shape (all outlines, then all fills), so no seams. Water ripples go up to continent scale.
- Ducks: ducklings trail on a rope (no more ramming an idle mother); ducks sleep when zoomed out too far to see.
- Inserting the level shifted World 2 by one slot, so saved stars of classic levels are off by one.
- Next: play it by hand and tune island and continent handling and the bay and Pangaea gaps.

## 2026-10-23 — Boats at wildly different scales
- World is now in meters and boats have real sizes: paper boat 33 cm up to container ship 400 m (new: cruise ship, container ship, paper boat). Mass scales with size cubed; big ships react slower relative to their length.
- Levels are chains of boats in one harbor. Park a rowboat, then the camera zooms out ~100x to bring in a cruise ship ("105x BIGGER" card, horn pitched by size). Parked boats stay as dots or obstacles.
- Zooming camera with a scale bar, mouse-wheel zoom out, constant on-screen outlines and popups, multi-scale water ripples, dots for boats too small to see.
- 3 new levels (World 1: Odd Couple, Way Down, Mixed Nuts); the 10 original levels kept as World 2 at toy scale with the fixed camera.
- Next: play the chains by hand and tune (cruise/container handling, camera framing, slip pads), then decide whether the classic levels stay. Then the GDD.

## 2026-10-23 — First playable prototype
- LittleJS prototype: 8 boat types, 10 levels, one boat per level. Steer with the mouse (hold to steer toward the cursor) or WASD/arrows, Space to drop anchor.
- Custom top-down rigid-body physics (circle hulls, keel drag, impulse collisions with spin), currents that move the water, moored boats on springs, buoys, logs, drifting boats and duck families that flee and get dizzy.
- Anchor drops at the bow; dropping at speed spins the boat out. Stars from position and angle accuracy; damage bill and "ducks offended" for laughs.
- Toybox Flat look drawn in code, title / level select / pause / result screens, save in `cm_park-my-boat_save`.
- Next: playtest the handling of each boat, then write the GDD (phase 1).
