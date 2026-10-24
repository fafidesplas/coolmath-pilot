# Park My Boat — devlog

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
