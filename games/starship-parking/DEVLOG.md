## 2026-11-06 — Renamed Starship Parking; pick hint
- The game is now Starship Parking: folder `games/starship-parking`, page title, title screen ("Starship" over a big "Parking"), save key `cm_starship-parking_save` (progress under the old key is not carried over), export folder `~/Desktop/starship-parking`.
- Crowded levels (Open Space, Docking Ring): until a ship is picked, "Click the ship you want to park first" pulses at the bottom of the screen. Brief's Writing rule updated for this one exception.
- Next: a mechanic.svg of its own, a GDD.

## 2026-11-06 — Own folder, forked from Park My Boat
- The space skin of Park My Boat (`../park-my-boat/space/`) is now its own game: the harbor game's code, levels and engine copied here as of commit `40a0e9c`, with the skin as `src/skin.js` and the export script as `tools/export.mjs`.
- Save key is now `cm_lost-in-parking-space_save` (the old `cm_park-my-boat_space_save` progress is not carried over).
- Shown on the team dashboard like the other games.
- Next: a mechanic.svg of its own, a GDD, and deciding which harbor fixes to keep copying over.
