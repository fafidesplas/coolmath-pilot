# Dinosaur Game: Cool Edition — devlog

## 2026-10-29 — Bonus pterodactyl flight
- Added a Jetpack Joyride-style bonus flight to `GDD.md` (3.7 golden egg, 3.8 flight): a golden egg at the apex of a held jump, once per run between 500 and 900 m, earns a 20 s flight after the run. Hold to flap up, release to glide; thunderclouds and wild pterodactyls; a hit ends it, eggs are kept; up to 3 flights banked.
- It plays after the run, never during it, so the "feels like the original" pillar holds. Not in 2P races.
- Next: a teammate reads the updated GDD; tune the flight's egg rate against the hatch prices in phase 4.

## 2026-10-29 — GDD review applied
- Phase 1c critical review: 13 of 14 fixes applied (hitbox template, frame budget, Hangman beast at 10 nights in total, fuller sky framing, integer scaling, Joyride-style egg grids and nests, analytics, STANDARDS test hook, HUD layout, separate RNG streams). Solo farming of the Alien achievement is accepted.
- Prototype art: best-effort placeholders; final art as a sprite sheet later.
- Next: a teammate reads `GDD.md`; when approved, set Status: Approved and stage `slice`.

## 2026-10-29 — GDD first draft
- Phase 1a answered: HD Pixel in Canvas 2D, the original's tuning numbers, name "Dinosaur Game: Cool Edition", eggs instead of coins (dinosaurs hatch from them), 2P speed same as 1P, single races with a rematch tally, touch 2P split left/right with a duck corner each.
- Tag characters now use their real names: Squatch, Griffin, Unicorn, Kraken, Pixie, Alien (2P-only bonus), Dragon (needs everything but Alien). Hangman beast unlocks at the 4th night. Name references saved as `reference/tag-roster.png` and `reference/tag-kraken.png`.
- Wrote `GDD.md` (Draft), updated the brief and the schematic (eggs, new name).
- Next: phase 1c critical review, then a teammate reads and approves the GDD.

## 2026-10-29 — Brief written
- New game: a remastered 1–2 player take on the offline browser dino, with coins, cosmetic skins, a daily run and a same-keyboard 2P race.
- The brief sets a "no bloat" rule: nothing that changes how a run feels (no power-ups, upgrades, lives or levels).
- Runners: T-Rex (default) plus Triceratops, Pachycephalosaurus and Stegosaurus for coins; the 7 Tag characters unlock through achievements, with the red Tag dino as the completionist prize. Tag screengrabs saved in `reference/`.
- Added the Hangman beast from Coolmath Hangman as an achievement runner (reach the 5th night in one run).
- Next: phase 1 GDD; decide HD pixel vs voxel art, the final name, and 2P on touch.
