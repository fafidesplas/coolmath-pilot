## 2026-11-08 — Planet types: each landing level has its own gravity
- Three planet types (`PLANETS` in `levels/levels.js`), each with a pull (a share of each ship's own full thrust, so a ship hovers at that throttle) and a ground color (`ROCK_INKS` in `src/skin.js`). Moon: 17%, grey. Rocky: 35% (as before), brick red. Heavy: 55%, ochre.
- Touchdown and Pad Towers are rocky, Moon Hop is a moon, Heavy Lift is heavy. `landing()` takes the planet type after the name.
- Checked in Chrome: each level pulls at its share, the grounds show grey, brick and ochre, and the editor's self-test still passes for Touchdown. No errors.
- Not checked: how hard each level now plays by hand (Heavy Lift's 400 m Frigate falls about twice as fast as before, Moon Hop's ships about half as fast).

## 2026-11-08 — Trial: getting a ship on its side back up (Moon Hop only)
- Moon Hop has two ways to stand up a ship lying on the ground, picked in the URL: `?ground=boost` or `?ground=pivot` (`groundTurn` in `src/space.js`, `groundTrial: true` on the level). With no `?ground`, Moon Hop plays as before. Both apply only to the ship you drive, on the ground, tilted more than 20 degrees from upright, turning toward nose up.
- boost: the side thrusters spin it 3x as hard as it takes to beat gravity round the end touching the ground (`GROUND_BOOST`).
- pivot: the ship swings round the end touching the ground at its in-air turn rate, slowing over the last 20 degrees. It stops upright and stays there while the key is held. The pivot is the outermost of its lowest points, so a fin that reaches the ground takes over as the pivot.
- Checked in Chrome on the Asteroid Miner lying on its side, holding A (nose right) or D (nose left). Before (no trial): it stays within a few degrees of flat. Boost: upright in about 1.5 s, but it swings up hard and lands on its fins ($2,375 damage); at 1.6x it stalled near 60 degrees after 5 s with no damage. Pivot: upright in about 3.5 s, stops there, no damage.
- To drop the trial: remove `groundTrial` from Moon Hop, the `groundTurn` call in `src/main.js` and the TRIAL block in `src/space.js`.

## 2026-11-08 — Flat ground in the landing levels
- Touchdown, Moon Hop, Pad Towers and Heavy Lift land on flat ground (a `land` rect with its top at y = 0) instead of a round planet. On the slope, a winged ship (the Stealth Cruiser) could lie stuck on its side, propped up by a wing. `landing()` in `levels/levels.js` no longer takes a planet radius.
- Checked in Chrome: the four levels load with one flat ground and no round planet, the pads sit on it (the towers still stand 30 m and 55 m tall), and there are no errors.
- Found: a ship lying flat on its side still mostly can't turn upright. A or D for 3.5 s leaves it within a few degrees of flat (once it got to 30 degrees). The side thrusters are too weak to lift one end against gravity, so RESTART is the only way out.

## 2026-11-08 — Level editor copied in from Park My Boat
- E opens the level editor again: `tools/editor.js` is Park My Boat's, copied, with its saved-folder ids renamed, and `index.html` loads it. It never came over in the fork. `tools/export.mjs` lists its scripts, so the editor stays out of the export.
- Saving a level built by a helper (Moon Hop, Pad Towers, Heavy Lift from `landing()`) is refused with a message. Before, it would have added a second copy of the level to `levels.js`.
- Checked in Chrome: E opens the editor on Spin Dock and Moon Hop, E play-tests Moon Hop, and the editor's self-test passes for the three hand-written levels. No errors.
- Not done: station slips are drawn off the station in the editor, and the space fields (station, gravity, ports, riders) have no inspector fields.

## 2026-11-08 — Every ship turns when stopped, in every level
- The turn-when-stopped trial is now the rule: the `spinTurn` flag is gone from Spin Dock, and every ship (traffic too, not only the one you drive) turns with the nose thrusters in the levels without gravity (`spinTurn` in `src/space.js`, `driveBoat` in `src/main.js`). The gravity levels already turned a stopped ship with the side thrusters (`thrusterSpin`).
- The mouse's reverse steering no longer flips the turn in any level. This also fixes the gravity levels, where the flip turned the ship the wrong way.
- Checked headless, all six levels: a stopped ship turns with A or D (Escape Pod about 28 degrees in a second, the big ships 7 to 19), and reversing with A turns it left. Grand Station's Space Liner, which could not turn from a stop before, now does. No errors.
- Not checked: the mouse's reverse steering by hand.

## 2026-11-08 — Four new levels: three landings and a big station
- Moon Hop (landing: Asteroid Miner 26 m, Solar Sailer 12 m, Flying Saucer 2.6 m), Grand Station (docking: Space Liner 300 m, Asteroid Miner 26 m, Zoomer 6.8 m, Rocket Scooter 2.4 m), Pad Towers (landing: Star Yacht 80 m on the ground, Zoomer and Rocket Scooter on 30 m and 55 m towers), Heavy Lift (landing: Classic Frigate 400 m, Stealth Cruiser 112 m, Flying Saucer 2.6 m). Order: Spin Dock, Touchdown, Moon Hop, Grand Station, Pad Towers, Heavy Lift.
- `landing()` in `levels/levels.js` builds a gravity level from a planet radius and a pad per ship (towers with `lift`).
- Stations can be scaled (`scale`), get extra docking ports (`ports`), and a slip can sit at a port by number (`port`). Grand Station is Spin Dock's station at 7x. Its small ships wait riding on the station near their ports (`start: { on: 'station' }`), released when their turn gives control: flying in from outside the wings' sweep took the Rocket Scooter over 40 s.
- No Stealth Cruiser at a station: cloaked, it passes through the station. In Heavy Lift it can cloak under the parked Frigate; harmless.
- Checked headless: every level loads, and every ship teleported into its slip parks, through to the results screen (Grand Station with no damage; the landing levels charge a little because the test drops ships onto the pads, as it does in Touchdown). A released rider flies off with no hit. No errors.
- Not checked: flying each level by hand (approach paths, how hard each landing is). The turn-when-stopped trial is still on Spin Dock only.

## 2026-11-08 — Forked harbor levels removed
- Removed the seven levels that came from Park My Boat: Odd Couple, Way Down, Rush Hour, Open Space, Spaceport, Docking Ring and the hidden bonus Moon Drift. The game is now Spin Dock, then Touchdown; `?test` still adds the Test Map. `LEVEL_NAMES` (their space names) is gone from `src/skin.js`; the level helpers stay in `levels/levels.js`, unused for now.
- Stars are saved by level number, so the save goes to `v: 2` and old stars are cleared rather than shown on the wrong level.
- The turn-when-stopped trial moved from Odd Couple to Spin Dock (`spinTurn: true`).
- Checked headless: the level select shows the two levels, both load and play, the stopped pod turns about 30 degrees in a second in Spin Dock, and `?test` still opens the Test Map. No errors.
- Next: new space levels to fill the game back out.

## 2026-11-08 — Trial: the nose thrusters turn a stopped ship (Odd Couple only)
- In Odd Couple (`spinTurn: true` in `levels/levels.js`) the ship you drive turns even when it is stopped, about as fast as the side thrusters turn it in Touchdown, so the flame and the turn now agree. Moving, it turns as fast as before. Left always turns the nose left, reversing too (in the other levels reversing flips the turn like a car), and the mouse's reverse steering follows that (`spinTurn` in `src/space.js`).
- Checked headless: in Odd Couple a stopped pod turns about 30 degrees in a second with A or D, and reversing with A turns it left; in Way Down a stopped ship still doesn't turn. No errors.
- To revert: remove `spinTurn` from Odd Couple. To keep it: set it on every level, or drop the flag and use `spinTurn()` everywhere.
- Not changed: in Touchdown the mouse's reverse steering still uses the harbor sign, which with the side thrusters likely turns the wrong way. Untested.

## 2026-11-07 — Turning fires a retro thruster
- Turning fires the retro thruster on the outside of the turn, the one that pushes the nose round: left fires the starboard (right) one, right fires the port one, at 70% of a full reverse flame, with its own smoke puffs. Reversing still fires both. Only the ship you drive does this (`retroFire` in `src/skin.js`; `RETRO_TURN`, `RETRO_TURN_MIN` for the flame size and the smallest mouse turn that fires it).
- Checked headless on the Escape Pod: A lights the right thruster, D the left one. No errors.
- The thruster is only a look: in the levels without gravity a ship still needs speed to turn, so a ship sitting still shows the flame without turning.

## 2026-11-07 — Selection rim round the whole ship
- The cream rim round the ship you drive in the crowded levels now goes round its whole outline (fins, boosters, sail, drill), not only the body, and is half as thick at 80% opacity (`SELECT_W`, `SELECT_ALPHA`, `drawJamSelection` in `src/skin.js`). All the shapes are stroked as one path, so there are no darker spots where they meet. Over a cloaked ship the rim is cut to the outside of the outline, so no lines cross the ship.
- Checked headless in Open Space: Star Yacht, Solar Sailer and a cloaked Stealth Pod. No errors.

## 2026-11-07 — Cargo Hauler renamed Classic Frigate
- The Saturn V-style ship (`container`) is now called Classic Frigate (`SHIP_NAMES` in `src/skin.js`).

## 2026-11-07 — Retro thrusters at the nose
- Reversing no longer puffs exhaust out of the main engine. Instead two retro thrusters, one on each side of the nose (where the hull has narrowed to 60% of its widest), fire forward and out at 35 degrees with the main engine's brick-and-mustard flame, and their smoke drifts off ahead of the ship. They replace the cream circles. Coasting backward makes no puffs at all.
- Each ship type gets `retro` (port position and flame size) from its drawn outline; puffs for the player now come from one helper, `puffExhaust` in `src/skin.js` (main.js and jam.js call it).
- Checked headless on the Escape Pod: flames at both nose shoulders, smoke ahead, nothing at the stern, no errors.
- Next: check the retro flames on the long ships (Space Liner, Cargo Hauler) and the Asteroid Miner's drill.

## 2026-11-07 — Parallax stars everywhere; trails hug the ships
- Parallax stars are kept and now on in every level (the `parallax` level flag is gone).
- The faint side trails started at the edges of the old boat hulls, so slim ships (Solar Sailer most of all: 1.6 wide as a boat, 0.52 as drawn) had a gap between hull and trail. Each ship type now gets `trailW`, the width of its drawn outline (body, fins, boosters, sail) where the trails start (`outlineHalfWidth`, `TRAIL_AT` in `src/skin.js`), and the trails start there and are sized to it.
- Checked headless: the Solar Sailer's trails come off its hull, no errors.
- Next: play a few levels and check the trails on the wider ships (Star Yacht fins, Stealth Pod boosters).

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
