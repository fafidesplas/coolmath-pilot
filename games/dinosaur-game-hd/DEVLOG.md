# Dinosaur Game: Cool Edition — devlog

## 2026-10-30 — The first 3 runners to hatch
- Velociraptor, Pachycephalosaurus and Parasaurolophus, as cell maps in `src/art.js` like the T-Rex: every runner is now an entry in `RUNNERS` with its own colors, body, legs and slide. All keep the T-Rex's silhouette, so the hitboxes are unchanged. Velociraptor: rust with feather bands, flat toothy snout, a stiff straight tail, sickle claws. Pachycephalosaurus: dusty rose with a bone dome; it slides dome first. Parasaurolophus: teal with an orange tube crest and a cream bill; the crest lies flat along its back in the slide. Placeholders until the final sprite sheet.
- Runners screen (title and results have a RUNNERS button): one card per runner, egg cards with a progress bar and a HATCH button once there are enough eggs, the egg bank top right, and the focused runner on a treadmill. Mouse or Left/Right + Space; Esc goes back where you came from.
- Hatch scene: a big egg (22×28 art px) wobbles, cracks 3 times, the top flies off, and the runner hops out. New `crack` and `hatch` sounds. The eggs are spent, the runner unlocked and equipped, and the save written the moment Hatch is pressed. `runner:hatch:<id>` and `runner:equip:<id>` events.
- The save drops unknown runner ids and falls back to the T-Rex if the equipped runner isn't unlocked.
- `tools/art-test.mjs` checks every runner's frames against the hitboxes (168 checks pass): the Velociraptor is within 2 px everywhere; the Pachycephalosaurus and Parasaurolophus keep the T-Rex's back, so they share its 4 px notch exception (GDD 3.4); physics and egg tests pass. Hatched all 3 in Chrome, then ran with each; no console errors.
- Next: Pao to judge the 3 looks; then the night ground seam and the cold playtest.

## 2026-10-30 — Tail notch as in the one-pager
- Pao: a bump on the back that isn't in the one-pager. It was the corner filled between the tail and the back for the hitbox. The standing frames now use the one-pager's rows exactly, notch included.
- The original's body box now reaches up to 4 px past the outline at the top of the notch (was within 2 px); a partial fill still left 3 px, so it wasn't worth the bump. Recorded as an exception in GDD 3.4; `tools/art-test.mjs` allows 4 px there.

## 2026-10-30 — Chunky pixels, like the one-pager
- Pao: the pixels looked too small on a 1440p screen. The one-pager draws its whole scene at half resolution, so every art pixel is 2×2 game pixels; the game now does the same everywhere, so the pixel size stays consistent.
- Sprites are cell maps in `src/art.js` (renamed from `rex.js`), each cell drawn 2×2 with a 1 cell (2 px) Night Ink outline. The T-Rex uses the one-pager's cells as they are (no more Scale2x). New cell maps for the small and large cactus, the pterodactyl (both wing frames) and the egg (plain and glinting), drawn over their hitboxes. Night rims are 1 art pixel too.
- Background layers (sky bands, stars, sun, moon, clouds, mesas, dunes, ground) are built at half resolution and scaled up. Dust, the Zz, sparks and "+1" snap to the 2 px grid; icons, arrows, panels and buttons step in 2 px; text sizes are even (1 → 2, 3 → 4). The results panel is wider and taller to fit.
- Physics, positions and hitboxes are unchanged (640×360 logical), and motion stays smooth.
- `tools/art-test.mjs` (was `rex-test.mjs`) checks every sprite against its hitboxes: all within 2 px. Physics, egg and art tests pass; checked title, run, slide, night, results and pause in Chrome, no console errors.

## 2026-10-30 — T-Rex redrawn from the one-pager
- Pao liked the one-pager's T-Rex silhouette much more than the game's (which was a rect placeholder reshaped by paint-overs). Every frame now comes from the one-pager's art: a boxy head with a jaw line, a body tapering into a tail that rises up and back, a light slate belly, thin legs. Run is the one-pager's 2 leg poses alternating; jump uses the standing pose (like the original); crash has the dizzy eye and open mouth; sleep shuts the eye.
- Slide: the one-pager's low duck, 3 cells longer, with both legs laid back along the sand; frame 2 flicks the tail tip and toes. This replaces Pao's slide and jump paint-overs (Pao's call).
- The one-pager draws 2 px per cell; the maps are scaled with Scale2x, so the diagonals are clean 1 px steps, and keep the game's 1 px outline. Data in `src/rex.js` (no DOM).
- Hitbox: the inner corner between the tail and the body is filled, and the slide got a fuller throat, so every run box is within 2 px of the outline (the jump frame's old exception is gone). New `tools/rex-test.mjs` checks every frame.
- Footfall dust: one puff per run frame (the planted foot alternates every frame now), same total as before.
- Physics, egg and rex tests pass; checked every frame and a run in Chrome, no console errors.

## 2026-10-30 — Belly dust on the slide
- Pao: more dust from the belly, to show the whole body is sliding. The slide trail is now 120 puffs a second (was 40): a third from the tail as before, two thirds spread along the belly. Belly puffs are drawn over the runner, so the sand sprays over the belly's lower edge and streams back.
- The slide start burst is bigger (14 puffs, 24 landing into it, was 6 and 12), half of them along the belly. The dust pool grew from 48 to 128 puffs.
- Physics and egg tests pass; checked mid-slide in Chrome, no console errors.

## 2026-10-30 — Hatch prices raised
- Pao collected ~207 eggs in a 3000 m run, so the old prices (300 / 750 / 1500) hatched all three in about 12 runs. Rather than cut eggs, the prices are now 300 / 1200 / 3000: the Velociraptor stays an early reward for new players (~10 runs at ~30 eggs), the later two are long-term goals.
- GDD 14 now targets runs to hatch instead of eggs per run; the egg rate is unchanged. Check against `eggs:earned` in phase 4.
- Next: the night ground seam, then a cold playtest by a teammate for the slice gate.

## 2026-10-30 — No music
- Pao: no music in the game. Cut from the GDD (audio, title, settings, save, the `settings:music:off` event) and the brief; the save no longer has a `music` setting. Sound effects stay, with their toggle.
- Next: a cold playtest by a teammate for the slice gate; before it, check the night ground seam and the egg rate per run (GDD 14).

## 2026-10-30 — Jump stretch, night rims, slide reminder
- Takeoff stretch: 2 frames (50 ms each: 6 px narrower and taller, then 2 px) with the feet kept in place, the mirror of the landing squash. Drawing only; the hitbox doesn't change.
- Night rims: at night every cactus, pterodactyl and egg gets a 1 px Egg Cream rim outside its outline, faded in and out with the night (GDD 3.6). Pre-rendered once per sprite (`SPR.rim`).
- Slide reminder: until the player has slid once, the SLIDE arrow shows again for 2 s (or until they slide) as the run's first pterodactyl comes, starting one view-width before it comes into view. GDD 4 said "first run only", but most first runs end before ~450 m, so it now keys off the first slide instead (GDD updated).
- Physics and egg tests pass; checked in Chrome (reminder timing, rims at 745 m, stretch frame), no console errors.
- Pao: the stretch was too subtle. Now 3 frames: 8 px narrower and 10 px taller, then 4 and 5, then 2 and 2 (about 150 ms).
- Next: music (20–30 s chiptune loop, off by default, with its toggle), then a cold playtest by a teammate for the slice gate.

## 2026-10-30 — Run tail points straight back
- Pao: the run tail should point straight back, not up. Run, crash and sleep frames: the top runs level with the back, the underside rises 1 px every 3 px to a 3 px rounded tip and drops 2:1 into the rump. Same length (7 px past the footprint), still clean pixel lines, still covers the tail boxes to within 2 px.

## 2026-10-30 — Obstacles no longer cut on wide screens
- Pao: on a 1440p monitor the obstacles were cut at the 640 px view's edges. The clip is gone; obstacles and eggs now live `OFFSCREEN` (640) px past both sides of the view, so they spawn and leave out of sight on any screen up to about 5:1.
- The run is unchanged: each obstacle spawns early, exactly as far out as the ground will scroll (replayed from the speed curve) before the original would spawn it, so it crosses the original's spawn line on that very frame. Pterodactyls drift only from there. Collisions check the nearest obstacle not yet passed.
- Checked against the old sim: 400 runs, about 1.27 million frames, every obstacle and egg in the same place on the same frame, same crashes, scores and eggs. Physics and egg tests pass (the clear-time test now times the original's spawn line); checked in a wide Chrome window.

## 2026-10-30 — Clean tail lines
- Every new tail (run, jump, both slides) now has edges in regular pixel steps instead of uneven ones, so they read as straight diagonals. Same general shapes.
- Run: top 1 px down every 2 px; underside 1:1 from the tip, then 2:1 into the rump. Jump: back 1:1 from the neck (the old kink at the neck is gone), then 3 rows per pixel, then straight down; underside 1:1 back to the tip, which ends 1 px higher. Slides: top steps of 2, 2, 1; underside 4 steps then a hold (the slide maps were edited row by row).
- Hitbox coverage unchanged; physics and egg tests pass; checked in Chrome.
- Pao: the run tail was too pointy. Its underside moved down 1 px, so the tip is 3 px thick instead of 2 and the slim part is 1 px fuller.
- Pao: then a teeny bit shorter. The tip is 1 px shorter (now 7 px past the footprint, `TAIL_OUT` 7), same 3 px rounded tip and same lines.

## 2026-10-30 — Longer, pointier running tail
- Run, crash and sleep frames: the blocky tail is now a slim point sweeping up and back like the slide's, with Slate dark on its underside. The tip reaches 8 px past the 44×47 footprint, so these frames are 52 px wide and drawn 8 px further left (`TAIL_OUT`, `canvas.ox`); the body doesn't move.
- The rump stays full, so the original's tail boxes are still covered to within 2 px; the hitbox doesn't change (GDD 3.4 notes it).
- Physics and egg tests still pass; checked in Chrome.

## 2026-10-30 — Slide frames, second paint-over pass
- Slide 1: the tail slimmed again (top edge shaved 1–4 px more). Slide 2: the tip trimmed by a pixel, the far leg's top made smaller. The slide crash frame follows slide 1.

## 2026-10-30 — Slide frames from Pao's paint-overs
- Both slide frames now come from Pao's paint-overs: a slimmer tail (top edge shaved 1–3 px) with Slate dark shading on its underside, the far leg's top reshaped; frame 2 flicks the tail tip higher, up to the frame edge. The slide crash frame uses frame 1 with the dizzy eye.
- The slides are stored as pixel maps (`SLIDE_MAPS` in `sprites.js`) instead of rects, so paint-overs go in exactly. Same 59×25 footprint and hitbox.
- Paint-over page: overlay any other frame (with its paint-over) and set each layer's opacity.
- Physics and egg tests still pass.
- Pao: keep the original's hitbox on the jump frame (GDD 3.4 notes the exception). Paint-over page: empty pixels are now a sand checker in both themes (the dark-mode navy was too close to the slate body).

## 2026-10-30 — Jump pose: sloped back, from Pao's paint-over
- New paint-over page (a private artifact for Pao): every sprite on a pixel grid with the game's palette and hitboxes; saved paint-overs are read back pixel by pixel.
- First one used: the jump frame's square rump is cut away, so the back slopes in one line from the neck down to the tail tip (`JUMP_BACK` in `sprites.js`).
- Open: the original's back hitbox now reaches past the slope at the top-left of the jump frame (up to ~11 px at the top). Pao to decide: keep it (as the original) or trim the jump frame's boxes.
- Physics and egg tests still pass.

## 2026-10-30 — Running dust, takeoff puff, jump pose
- Pao liked the landing. Now: 2 small puffs kicked back at each footfall (run frames 0 and 2), 6 puffs out both sides of the feet on takeoff.
- New jump frame: legs stretched long with the toes pointing down, the tail drooping to a point down and back. Checked over the hitbox template: every box stays inside the outline.
- Physics and egg tests still pass; checked in Chrome frame by frame.
- Next: jump stretch, night rims on obstacles, the pterodactyl duck reminder, music.

## 2026-10-30 — Landing dust and squash
- Landing on the feet: 10 sand puffs spread out both sides of the feet and drift back with the ground, and a 2-frame squash (50 ms each: 6 px wider and lower, then 2 px) with the feet kept on the ground. Drawing only; the hitbox and the sim don't change.
- Landing into a slide keeps the slide's bigger burst, with no squash.
- Checked in Chrome frame by frame; physics and egg tests still pass.
- Next: jump stretch (the other half of that GDD 9 juice line), night rims on obstacles, the pterodactyl duck reminder, music.

## 2026-10-30 — Slide redrawn from Pao's sketch
- Shorter body, a long tail tapering to a sharp point up and back (second pass, from Pao's paint-over), both back legs stretched out along the sand with toes tipped up (a dark line keeps them apart); head, eye and arm unchanged. Same footprint and hitbox.
- Hitbox overlay page (a private artifact for Pao) shows every pose with the boxes `Run.collides()` tests.

## 2026-10-30 — Slimmer slide
- Pao: the belly looked huge. The slide body is now long and flat (about half as tall) with a thin belly stripe, the head raised a little and leading. Same footprint and hitbox; GDD 3.4 notes why the flat pose can't fill the top of the duck box and why that never causes an unseen hit.

## 2026-10-30 — The duck becomes a belly slide
- Pao's idea: the duck is now drawn as a belly slide (2 frames: tail and feet flick), with a dizzy slide frame for crashes mid-slide. Same 59×25 footprint and hitbox; input and timing are the original's duck (held as long as down is held).
- Dust: a sand burst when the slide starts, a bigger one when a jump or fast-fall lands into it, a trail while sliding; a fixed pool of 48 puffs, dimmed at night. A quiet looping scrape while sliding. The first-run hint says SLIDE.
- Physics and egg tests unchanged and passing.
- Next: Pao plays the slide; rest of the feel loop.

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
