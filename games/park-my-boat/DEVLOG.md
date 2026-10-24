# Park My Boat — devlog

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
