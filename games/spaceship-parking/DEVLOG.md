## 2026-11-07 — Parallax stars trial on Odd Couple
- Trial: in Odd Couple the stars scroll at different speeds as the camera follows the ship. The smallest (farthest) scroll at 15% of the ships' speed, the biggest at 100%, flares at 60% (`starDepth` in `src/skin.js`). Turned on by `parallax: true` on the level; every other level is unchanged. To drop it, revert this commit.
- Checked headless: during a 48 px pan the tiniest stars moved about 9 px, flares 31 px, the biggest stars 37-48 px. No errors.
- Next: play it and decide whether to keep it, and whether all levels get it.

## 2026-11-07 — Zero-g trial dropped
- Tried Asteroids-style physics on Odd Couple: almost no drag, so a ship coasts on and stopping means a well-timed reverse burn. Too hard to stop when played, so it was reverted (commit `b02b428` has it if it is ever wanted again). Every level flies as before.

## 2026-11-06 — Touchdown largest first; solid solar wings
- Touchdown now lands the biggest ship first: the Space Liner on the 100 m pad, then a 28 m Star Yacht on a new 20 m pad, then the Escape Pod on the 8 m pad. Checked: each ship set down on its pad parks with no damage, and the level completes.
- Spin Dock: each pair of solar wings collides as one solid rectangle reaching in to the truss, so the pod can no longer wedge in the scalloped edges, the slot between two wings or the slot next to the truss. The drawing is unchanged. New in `src/physics.js`: bodies can carry `boxes` (solid rectangles in body coordinates); `?hitbox` outlines them.
- Fix: the game froze (an engine assert in `drawFoam`) once a ship was held in place after landing or docking, because its side trail divided by zero. Held ships no longer lay a trail.
- Next: play Touchdown by hand (the yacht's start, the pad spacing) and Spin Dock with the pod near the wings.

## 2026-11-06 — Renamed Spaceship Parking; no side spray
- The game is now Spaceship Parking: folder `games/spaceship-parking`, page title, title screen ("Spaceship" over a big "Parking"), save key `cm_spaceship-parking_save` (progress under the old key is not carried over), export folder `~/Desktop/spaceship-parking` and its title.
- A ship sliding sideways no longer throws cream spray drops off its side (left over from the boats' water spray). The faint contrails stay.
- Next: play the crowded levels by hand (see below).

## 2026-11-06 — Crowded levels inside a station
- Open Space and Docking Ring now take place in a station's docking bay, not open space: the station's main hull walls the bay in, a few spur modules fill its empty corners, and more modules reach out beyond the hull. New helper `bay()` in `levels/levels.js`. The hull replaces the invisible walls and stands at least 4 m clear of every slip; the camera views grew to show it.
- Next: play both levels through by hand to check that the hull and spurs leave room to turn the big ships (Asteroid Miner, Star Yacht).

## 2026-11-06 — Spin Dock: ships dock across the end of the stack
- The docking ports are back at the two ends of the module stack, and each slip lies across the stack's end, broadside to the port like the bar of a T: the pod at the front end, the yacht at the aft end. The solar wings and the pod's start are back where they were before the side ports.
- Checked: a ship held in each slip docks with no damage.
- Next: play it by hand and tune.

## 2026-11-06 — Touchdown: ships fall straight down
- Gravity pulled straight down, but falling ships still had the boat's water drag (easy along the keel, stiff sideways), so a tilted ship fell along its own nose. A falling ship's drag is now the same in every direction, so it falls straight down whichever way it points.
- Next: play Touchdown by hand and retune gravity share if landings got harder.

## 2026-11-06 — Spin Dock: ships dock across the station
- The docking ports moved from the ends of the module stack to its sides, so both slips stand at right angles to it: the pod on the lab's side, the yacht on the far side of the aft module. The solar wings moved 7 m farther out along the truss to make room for the yacht's slip, and the pod starts 6 m farther out to stay clear of their sweep.
- Next: play it by hand and tune.

## 2026-11-06 — Hitboxes follow the ships; Spin Dock and Touchdown
- Hitboxes: every ship's collision circles are rebuilt from its poster outline (body, fins, boosters, wings, sail, drill), no longer from the boat hull it replaced. Fins now bump; the Space Liner, Cargo Hauler and Stealth Cruiser are wider (fins), the Solar Sailer and Zoomer slimmer. Slips grow where the outline is wider. `?hitbox` shows the circles. Every level checked: no ships start overlapping. Spaceport's yacht slip has 0.1 less side room so it stays the width it was.
- New level Spin Dock: dock the Escape Pod, then a Star Yacht, at the ports of a drifting, spinning space station whose solar wings sweep round it. A docking beam in the slip carries the ship with the port.
- New level Touchdown: gravity. Land the Escape Pod upright on a pad, then a Space Liner on the big pad next door. Side thrusters turn the ship with no speed.
- New file `src/space.js` (station, moving slips, beam, gravity, pads), added to the export.
- Next: play both levels by hand and tune (station spin and drift, the pod's view, gravity share, the liner's start height).

## 2026-11-06 — Dashboard schematic redrawn
- New `mechanic.svg` in the poster style: an Escape Pod flies in with its thruster lit, stops in a slip between two docking arms of a station (a Rocket Scooter already parked next door), the resting ring fills, the slip lights up, then DOCKED! and three stars. Starry sky with flares and a ringed planet. Loop 6 s.

## 2026-11-06 — Renamed Starship Parking; pick hint
- The game is now Starship Parking: folder `games/starship-parking`, page title, title screen ("Starship" over a big "Parking"), save key `cm_starship-parking_save` (progress under the old key is not carried over), export folder `~/Desktop/starship-parking`.
- Crowded levels (Open Space, Docking Ring): until a ship is picked, "Click the ship you want to park first" pulses at the bottom of the screen. Brief's Writing rule updated for this one exception.
- Next: a GDD.

## 2026-11-06 — Own folder, forked from Park My Boat
- The space skin of Park My Boat (`../park-my-boat/space/`) is now its own game: the harbor game's code, levels and engine copied here as of commit `40a0e9c`, with the skin as `src/skin.js` and the export script as `tools/export.mjs`.
- Save key is now `cm_lost-in-parking-space_save` (the old `cm_park-my-boat_space_save` progress is not carried over).
- Shown on the team dashboard like the other games.
- Next: a mechanic.svg of its own, a GDD, and deciding which harbor fixes to keep copying over.
