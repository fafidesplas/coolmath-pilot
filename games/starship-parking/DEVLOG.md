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
