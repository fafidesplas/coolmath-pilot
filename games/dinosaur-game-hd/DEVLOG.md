# Dinosaur Game: Cool Edition — devlog

## 2026-10-30 — Longer lines under pterodactyls
- Pao: placement feels good now; the 3-egg lines were the least satisfying. Duck and head lines are now 6 eggs, 12 px apart, centered under the pterodactyl (`EGGS.lineCount`).
- `tools/egg-test.mjs` still passes: ducking takes every duck line and staying down every head line, never touching the pterodactyl.
- Next: rest of the feel loop.

## 2026-10-30 — Grids and nests moved onto the obstacle jump
- Pao died on a pterodactyl right after a nest: grids and nests sat in gaps and asked for their own jump. Cause: the original (and our sim) spawns the next obstacle as soon as the last one leaves the view, so a real gap is at most ~660 px whatever `gap` says; there's never room for a third jump.
- Now every pattern sits over or under an obstacle, and the move that collects it is the one that clears it. Grid: a 3-row block on the held-jump apex over a cactus group (from 200 m). Nest: 17 eggs on the apex over a cactus (from 500 m, one per 500 m).
- `tools/egg-test.mjs`: all 17,734 patterns over 300 seeds are fully collected by their move without touching the obstacle; 60 eggs placed in 400 m (40–80).
- Next: Pao plays again; then the rest of the feel loop.

## 2026-10-30 — Eggs that answer the pterodactyls
- Pao played: arcs and big bunches tempt, the flat 3-egg ground lines were boring. High pterodactyls (fly over, don't jump) are the original's and stay.
- Cut the ground line; jump arcs now unlock at 30 m. New: an arc over low and mid pterodactyls, a head-height line under high ones; mid ones get the duck line or an arc. Pterodactyl eggs move with their pterodactyl.
- `tools/egg-test.mjs`: each pattern's move (held jump, duck, stay down) collects every egg and never touches the obstacle, over 14,881 patterns; 53.5 eggs placed in 400 m (35–72).
- Local server now sends `Cache-Control: no-store` (stale modules hid the new eggs at first).
- Next: Pao plays the pterodactyl patterns; then the rest of the 2c feel loop.

## 2026-10-30 — Slice step 3: eggs
- `gen.js` `EggGen`: its own seeded stream; after each obstacle spawns it may place a pattern (ground line, jump arc, grid, big arc, duck line, nest) unlocked by distance, only where the existing gap fits. Arcs follow `jumpCurve()`, the sim's own held jump, with the apex over the obstacle.
- `sim.js`: eggs scroll with the world (duck lines with their pterodactyl), the runner's full footprint picks them up through a 16×16 box, `eggCount` and `pickups`.
- Game: egg sprite with wobble and glint, "+1" pop, HUD count with a hop, pickup pitch rising on a streak, results count up "+N EGGS" and the Velociraptor progress bar; eggs banked to the save after every run; `eggs:earned` and `eggs:progress:*` events.
- `tools/egg-test.mjs` (5 checks, 300 seeds): obstacles identical with and without eggs; no egg on an obstacle; unlock distances, spacing and nest rules; a held jump timed to the obstacle collects all 7,007 arcs, ducking all 1,805 duck lines; 41 eggs placed in 400 m (25–59).
- Changed: pattern chance 25% → 50% (at 25% only 24 eggs were placed in 400 m). GDD 3.7 updated.
- Next: Pao plays it (2c feel loop): do eggs tempt without distracting, and is the count right? Then a teammate plays it cold.

## 2026-10-30 — Slice step 2: shell and first playable build
- Pao checked `physics.html` against `chrome://dino` on a 60 Hz display: it feels the same.
- `index.html` is now playable: title with the sleeping T-Rex, run, pause (P, Esc, button, hidden tab), crash with shake and dizzy stars, results panel (count-up, NEW BEST, Retry/Menu), R/Enter/Retry restart at once, Space/Up/W on release after the 1.2 s lock.
- New modules: `main.js` (60 Hz steps, render interpolation), `render.js` (banded sky, sun, clouds, mesas, dunes, sand; 1 s night fade with stars and moon), `ui.js`, `sprites.js` (placeholder T-Rex, cacti, pterodactyl drawn over the hitbox template), `font.js` (5×7 pixel font), `input.js`, `audio.js` (jump, duck, milestone, crash, night, click), `save.js`, `analytics.js` (console stubs).
- First-run jump and duck zone hints, best distance saved, sound toggle, `window.game` hook; H shows hitboxes and I toggles invincibility (debug only).
- Checked in Chrome: title, run, crash, results, pause, menu, keyboard and pointer zones, GA logs; no console errors. `tools/physics-test.mjs` still 40/40.
- Not in yet: eggs, music, landing dust and squash, night rims on obstacles, the pterodactyl duck reminder.
- Next: step 3, eggs (patterns, pickup, HUD count, egg stream), then the feel loop.

## 2026-10-30 — Slice step 1: physics sim
- `src/sim.js` (no drawing), `src/gen.js` (seeded obstacles) and `src/config.js` (the original's numbers) run one original frame per 60 Hz step, with whole-pixel rounding and `floor(speed)` scrolling.
- `tools/physics-test.mjs`: 40 checks pass. Measured: jumps 62 px / 0.47 s (shortest) to 91 px / 0.58 s (held) at speed 6, 87 px / 0.55 s at 9.5, 90 px / 0.57 s at 13; fast-fall from frame 10 lands at 0.28 s; top speed after 7,001 frames at 1,663 m; first obstacle at 3 s; night lasts 12 s; generator rules hold over 300 seeds; every cactus group clearable at its speed; pterodactyl heights hit and miss as in the original.
- `physics.html`: boxes only, for a side-by-side check with `chrome://dino` (H boxes, P pause, . one frame, , slow motion, I invincible, `?seed=`). Not the game, so `index.html` doesn't exist yet.
- The original's speed depends on the refresh rate (whole-pixel steps per frame): on Pao's 144 Hz monitor `chrome://dino` scrolls at about 80% of its 60 Hz speed and reaches top speed in ~49 s. Decided: we stay locked to the 60 Hz design. Measured on that monitor: 144 fps drawn, 60 sim steps/s, score 9.2 m/s.
- Next: compare with `chrome://dino` on a 60 Hz display; once it feels the same, step 2 (shell), with render interpolation so 144 Hz screens don't judder.

## 2026-10-30 — Physics checked against the original
- Read the Chromium dino source (numbers and rules only) and simulated its jump frame by frame. Speed, acceleration, cap, gaps, obstacle sizes, pterodactyl heights, night and distance were right in `GDD.md`.
- Corrected in `GDD.md` 3.3–3.5: jump apex 62 px (shortest) to 87–91 px (held), airtime 0.47–0.58 s; a release before 30 px gives a full jump; a held jump key re-jumps on landing; fast-fall ends when down is released; whole-pixel positions and `floor(speed)` scrolling; standing-size outer hitbox while ducking; only the nearest obstacle is checked; 1.2 s Space restart lock. Egg and golden egg heights follow the new apex.
- Next: phase 2a build plan, with `sim.js` and a headless physics test first.

## 2026-10-30 — GDD approved
- Fafi read `GDD.md` and approved it. Status: Approved, stage `slice`.
- Next: phase 2a, the vertical slice build plan (match the original's feel first, in `sim.js`).

## 2026-10-30 — New dinosaur roster
- Removed the Tag characters and the Triceratops and Stegosaurus (four legs don't fit the T-Rex silhouette) from `GDD.md`. The Hangman beast stays.
- 11 runners: T-Rex (free); Velociraptor, Pachycephalosaurus, Parasaurolophus hatched with eggs (300 / 750 / 1500); Hadrosaur, Ceratosaurus, Megalosaurus, Therizinosaurus, Hangman beast, Allosaurus (2P bonus) and Spinosaurus (completionist) by achievement. "1000 eggs in total" is dropped; all dinosaurs get 8 frames.
- Brief (`CLAUDE.md`) updated to the new roster; the Tag screenshots are removed from `reference/`. `mechanic.svg` only shows the T-Rex, so it needed no change.
- Next: a teammate reads the GDD.

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
