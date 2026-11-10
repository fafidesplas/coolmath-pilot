# Flip Runner — Game design document

**Status:** Approved
**Owner:** Fafi · **Reviewed by:** Pao · **Last updated:** 2026-11-11

> A little bat has to race home before sunrise. It dashes on by itself and one button does everything: hop between the floor and the ceiling (bats love hanging upside down), spread its wings to glide, or steer it and its sibling at once. Read the cave, time the press, thread the gaps.

**Theme:** a lilac baby bat racing home through the night, from a crystal cave to a bell tower, a firefly forest and a night fair, while the sky slowly warms towards dawn. The theme explains every mechanic: bats live upside down (Flip), fly on their wings (Glider) and travel with family (Twin).

## 1. Summary
- **Pillars:**
  1. **One button, many meanings.** The whole game is one button, and every press is about *when*. Portals change the runner's **form**, and each form gives the button a new meaning, so the game keeps surprising you without ever adding a second input.
  2. **Every death is my fault, and it's quick.** Deaths are readable (you see exactly what got you) and cost under half a second.
  3. **Speed you can read.** The camera shows what is coming, floor and ceiling look different, and the bat's scarf always shows which way is "down".
- **Player:** Coolmath players aged 10–24, on a school Chromebook with a trackpad or on a phone, sound often off, in short breaks.
- **Session:** One level takes 20–60 s of running, plus retries (typically 1–3 minutes). A typical visit is 5–8 levels or a few endless runs: 10–15 minutes.
- **Hook:** "I was so close." and "What's behind the next portal?" The death counter, the star on the risky route, new forms to master, and the daily run with a shareable distance bring players back.

## 2. Core loop
- **Moment (seconds):** See the obstacle → press (or hold) at the right instant → flip, climb or steer → land and run.
- **Level (minutes):** Run → pass a portal and switch form → die → back at the flag in under 0.5 s → learn the section → reach the goal → stars and death count.
- **Meta (days):** Stars unlock skins → each world adds a new form or obstacle → daily endless run and streak.

## 3. Mechanics

### 3.1 Space and scale
- Design resolution 1280×720. The HUD takes the top 80 px; the playfield is 1280×640.
- Levels are strips of **40 px tiles, 16 rows tall** and as many columns as needed (a 40 s level at 8 tiles/s is about 320 columns).
- The camera scrolls horizontally only, with the runner at **30% of the screen width** from the left, so 22 tiles (2 s at world 1 speed) of what is coming are visible. At higher speeds the camera leads more, easing the runner back to 22% of the width at 700 px/s, so the look-ahead time stays above 1.4 s.

### 3.2 Simulation
- Fixed step at **120 Hz** with an accumulator (frame `dt` capped at 0.05 s). Deterministic for the same inputs, so levels can be checked by a solver and replayed.
- The runner is an axis-aligned box swept against the tiles and moving blocks, per axis.

### 3.3 The runner
- **Hitbox:** 24 × 28 px, smaller than the drawing (about 40 × 40 px with squash and stretch), so grazes don't kill.
- **Forward speed:** constant per level, set by the world: **440 px/s** (11 tiles/s) in world 1, 470 in world 2, 500 in world 3, 530 in world 4. Speed pads change it inside a level (3.5).
- **Gravity:** **7000 px/s²**, pointing down or up. Max vertical speed 2000 px/s.
- **Flip:** gravity reverses and the runner gets a 250 px/s kick towards the new surface so the arc starts at once. Crossing a standard 6-tile corridor (212 px of travel) takes **about 0.22 s** (measured in the sim) and covers about 2.3 tiles forward. Taller rooms mean longer flips (9 tiles: about 0.28 s).
- **Auto-step:** a rise of exactly 1 tile in the surface the runner is on (floor, or ceiling when gravity is up) is climbed automatically with a quick hop, no input. Only walls of 2 tiles or more stop the runner, and they are drawn with a warning edge.
- **Only from a surface:** a flip needs the runner to be standing (floor, ceiling, platform or moving block, whichever is "down" right now). No mid-air flips.
- **Forgiveness:** a tap is **buffered for 100 ms** (a tap just before landing flips on touchdown), and **coyote time is 60 ms** (a tap just after running off an edge still flips).
- **Input:** the flip is processed on key down / pointer down, never on release. Holding a key or a finger does not repeat the flip (keyboard auto-repeat is ignored): one press, one flip. Input events are queued with the step they arrive in, so latency is at most one step (8 ms) plus the frame.

### 3.4 Forms and portals
The runner always moves forward on its own. A **portal** changes its form instantly; each form uses the same single button differently.

- **Flip** (default, world 1): tap flips gravity (3.3).
- **Glider** (from world 2): no gravity. **Hold** the button to climb at a fixed angle, **release** to dive at the same angle. The climb/dive speed is **0.85 × the forward speed** (about 40°). Floors and ceilings can be slid along safely; wall faces and spikes kill as usual. Drawn as a dart that points where it is going, leaving a zigzag trail.
- **Twin** (from world 3): a **second runner** appears in a parallel lane. One tap flips **both** (they always share the same gravity), and only when **both** have their feet down; a tap is buffered until both land. Either runner dying is a death; either can grab stars. The second runner always appears in the lane the first one is *not* in, standing on the surface gravity points at. The twin disappears at the next portal.
- **Portals:** a full-height dashed band in the form's color with the form's name at the top and bottom (shape and text, not color alone). They are visible at least 1.2 s before you reach them. A portal never sits where the new form would die instantly.
- **First time a form appears,** a one-word cue pops over the runner: "HOLD!" for Glider, "TWINS!" for Twin.
- **Checkpoints remember the form:** a flag's snapshot includes the form (and the twin's lane), so a respawn puts you back in the same form.

### 3.5 Death
- The runner dies when it:
  - touches **spikes** (their deadly area starts 6 px inside the drawn triangle);
  - leaves the playfield through the top or bottom (an open gap);
  - **runs into a wall face** of 2 tiles or more head-on, with a corner forgiveness of 10 px: hitting the very top or bottom 10 px of a wall nudges the runner over or under it instead (1-tile rises are auto-stepped, 3.3; in glider form any wall face kills);
  - is **crushed** between a moving block and another solid.
- Death: a crunch, the runner bursts into pieces, a short shake and a soft vignette (never a full-screen flash: deaths repeat a lot), then it rebuilds at the last flag. **Back to running in 0.35 s.**
- No lives and no game over in levels. The level's death counter goes up by one.

### 3.6 Obstacles and objects
- **Gaps:** missing floor or ceiling. With a surface on the other side, flip over them; with nothing on either side, they are deadly.
- **Spikes:** on floors (pointing up) or ceilings (pointing down), and on block faces.
- **Platforms:** solid islands in the middle of a room; the runner can land on their top (gravity down) or their underside (gravity up).
- **Moving blocks (world 2):** solid blocks that slide back and forth along a straight path with a smoothstep ease (arithmetic only, so it is deterministic) and a fixed period (3–6 s); the path is drawn as a dashed outline of everything the block sweeps, so you can read where it will be. Rules:
  - The top of a block is a floor and its underside is a ceiling: you can **ride** it (you are carried with it) or hang under it. A block moving up carries you up.
  - Its **side is a wall**: running into it kills, like any wall.
  - A block that closes on you against rock or another block **crushes** you (`death:crush`).
  - **The bat's speed is constant, so a block's phase at the moment you reach it is fixed.** A block cannot be "waited out". The designer therefore chooses where each block is when you arrive (`at`: start, far end, halfway out, halfway back), so that a lane is always free; a block left to chance can sit in the middle and be impossible. Pistons arrive resting at an end of their path (where the ease is slow), so the free lane is easy to read.
  - A flag stores the block clock, so every retry of a section is identical (3.7).
- **Speed gates, "pads" (world 3):** a band across the whole corridor with chevrons running through it, like a portal. **Fast gate** (», yellow, "FAST"): from its column on, the speed is × 1.35. **Slow gate** («, blue, "SLOW"): × 0.75. A **× 1 gate** ("NORMAL") restores the normal speed. The new speed lasts until the next gate; a respawn restores the speed saved at the flag (3.7). *Change from the first design (pads lying on one surface, so choosing a surface chose a speed):* it made the time you reach any point depend on your route, which made levels hard to verify (the solver's state count exploded) and hard to read. A gate depends only on where you are, so the time to reach any column is the same for everyone; the variety comes from the rhythm changing against the hazards. Hazards in a speed zone are spaced **by time, not by columns** (a fast stretch has wider spacing), so a fast zone is not simply a harder one. Moving blocks and gates do not mix in one level: a block's arrival phase is computed for a constant speed.
- **Gravity switches (world 4):** a round pad with an arrow. Touching it flips gravity without a tap, in the arrow's direction (both twins in twin form). A switch can be passed through from either side and fires once per pass.
- **Glider pillars (world 2):** columns from floor and ceiling with a gap to weave through; in the Bell Tower they are stone columns and hanging bells.
- **Stars:** 3 per level, placed on the risky route (3.8).
- **Checkpoint flags:** about every 15 s of running. Passing one activates it with a whip-up animation.
- **Goal (home roost):** a ring of rock around the full moon, with a HOME sign, at the end. Running through it completes the level.

### 3.7 Checkpoints and restart
- **Every retry of a section is identical.** When a flag activates it saves a snapshot: the runner's form, speed and gravity (and the twin's lane), and the phase of every moving block. On death everything is restored from that snapshot, so the section always plays the same way and can be learned. The runner respawns on the surface the flag stands on.
- **R** restarts the level from the start (under 1 s).

### 3.8 Stars and rating
- Each level has **3 collectible stars**. They are the level rating (0–3 stars). Finishing the level always marks it as complete, even with no stars.
- A star you grab is **banked when you pass the next flag** (or the goal). If you die before that, it goes back to its place.
- Each star, once banked, stays collected forever, so you don't need all three in one run. Banked stars are drawn as outlines on later runs.
- The results screen also shows the **death count** for the run and the best (lowest) death count, proudly: dying a lot is part of the fun.

## 4. Controls
| Action | Mouse / touch | Keyboard |
|---|---|---|
| Press (flip, or flip both twins) | Click or tap anywhere in the playfield | Space, ↑, ↓, W or S |
| Hold (glider climbs) | Keep the mouse button or finger down | Keep any of those keys down |
| Pause | HUD button | P or Esc |
| Restart level | HUD button | R |
| Menus | Click / tap | Arrows, Enter / Space |

- All the button keys do the same thing. There is no "flip up" vs "flip down", and no second button in any form.
- HUD buttons never trigger a flip. Taps on the HUD bar are ignored by the runner.
- Mouse and touch first, as in `STANDARDS.md`; the whole game is playable with one finger.

## 5. Game elements
| Element | Behavior | First appears | Shape/icon (not color alone) |
|---|---|---|---|
| Bat (the runner) | Auto-runs, flips gravity | 1 | Round lilac bat with pointed ears, big eyes, tiny fangs, folded wings, and a red scarf that trails and points "down" |
| Floor / ceiling | Surfaces to run on | 1 | Floor top faces and ceiling bottom faces are different shades and patterns (floor: tiles with a top lip; ceiling: tiles with a bottom lip and hanging bolts) |
| Spikes | Kill on touch | 1 | Crystal shards (triangles with a lit and a shaded facet and a thick outline), drawn in the world's spike color |
| Gap | Deadly if open on both sides | 1 | Visible void with warning stripes on the edges |
| Star | Collectible, banked at the next flag | 1 | Five-point star, spinning |
| Checkpoint lantern | Respawn point | 1 | Lantern on a post that lights up with a glow |
| Home roost | Ends the level | 1 | Rock ring around a full moon, HOME sign |
| Platform | Land on top or underside | 4 | Floating block with lips on both faces |
| Moving block | Slides on a visible rail, crushes | 15 | Block with bolts and a dotted rail |
| Fast / slow gate | Speed × 1.35 / × 0.75 until the next gate | 25 | A band across the corridor with » (yellow, FAST) or « (blue, SLOW) chevrons |
| Gravity switch | Flips gravity on touch | 31 | Round pad with a big arrow |
| Portal | Changes form | 11 | Full-height dashed band with the form's name top and bottom |
| Glider (form) | Hold to climb, release to dive | 11 | The bat with its wings spread, tilted where it goes, flapping; sky-blue accent and a trail |
| Glider pillars | Weave through the gap | 11 | Stalactite/stalagmite columns |
| Twin (form) | Second runner, one tap flips both | 21 | The bat's sibling, an orange bat with its own scarf, in its own lane |

## 6. Level design
- **Structure:** 40 levels in 4 worlds of 10.
  - **World 1 — Crystal Cave (1–10):** Flip form only: flipping, gaps, spikes, platforms, room heights.
  - **World 2 — Bell Tower (11–20, built as levels 1–10 of the world):** the **Glider** form, glider pillars and rock hanging from the ceiling, switchbacks between Flip and Glider, then **moving blocks**: pistons (blocks sliding between the ceiling and the floor), lifts (floors that rise while you ride them) and sliding pillars in glider rooms.
  - **World 3 — Firefly Forest (21–30, built as levels 1–10 of the world):** the **Twin** form (a second bat in a parallel lane, one tap flips both), then speed gates, then levels that mix the two. Twin rooms have two lanes with a rock divider; the lanes can have different heights, so one bat lands before the other and the next flip waits for both.
  - **World 4 — Night Fair (31–40):** gravity switches (31), then levels that chain all three forms through portals.
- **Form rhythm:** a level spends at least 6 s in a form before the next portal, so each form has room to breathe. From the middle of world 2, most levels use two forms; from world 4, three.
- **Teaching order:** each element first appears with no other danger nearby and a generous window, then with a twist (on the ceiling, at speed, in a tall room), then combined with older elements.
- **Density:** something to react to every 0.6–1 s; no empty stretch longer than about 1.5 s after the first 2 s of a level and before the last 2 s (the run-in to the goal). `simtest` measures this on the level map (columns with spikes, gaps, platforms or steps count as busy) and fails a level above 1.6 s.
- **Difficulty curve:** a level gets harder with shorter windows between flips, taller rooms (longer flips to plan ahead), flips that must happen in the middle of a sequence, higher speed, and stars placed off the safe route. Each world starts easier than the end of the last. The first level of each world has no star off the safe route.
- **Fair-play rules:** every obstacle and every portal is visible for at least 1.2 s before it must be acted on; a portal is never followed by an obstacle that needs the new form in under 0.8 s; no blind drops (the landing surface is always on screen); no flip needs a window shorter than 120 ms (checked by the solver); **no hazard within 2 columns of a 1-tile step** (a step-up lifts the bat into the band under the next ceiling, so a spike right at the step is a trap that looks like a plain obstacle); **a star never sits on a hazard tile**, and never needs a double flip in under 200 ms (found while building the Crystal Cave, where three stars did); no tile where both surfaces of a 2-tile lane carry spikes in the same column.
- **Stars:** placed where grabbing one needs a riskier flip or an extra flip (a deeper dive in glider form, a lane detour in twin form), never a frame-perfect one. Stars sit on surfaces or on a natural glider path, not in mid-air spots that need a double flip.
- **First 10 levels (Crystal Cave).** All ten are built and verified by the solver (3 stars reachable, tightest flip window 150–300 ms except level 10 at 200 ms). Each is 28–53 s at 440 px/s (11 columns per second), with 2–4 flags. Hazards are crystal shards; "lane" means the space above or below a platform.
  1. **First Flip** (28 s) — hint cues for the first taps, then floor and ceiling spikes, floor gaps, a tall room, ping pong, an open ceiling (do not flip there), a squeeze with a 1-tile step, and islands. No one who taps when told can die. Built by `tools/build-slice.mjs`.
  2. **Ping Pong** (29 s) — spikes alternate floor/ceiling in an even beat: every 1 s, then every 0.73 s, then an 8-column beat; pairs on the same side break the rhythm in the middle; a star on the ceiling between floor groups.
  3. **Mind the Gap** (29 s) — floor gaps (be on the ceiling), ceiling gaps (be on the floor), a zigzag of alternating gaps, wide gaps of 7–8 columns where mid-air flipping can't help, and gaps mixed with spikes.
  4. **Islands** (29 s) — platforms floating in the corridor. Run on top, or hang under them: four islands, from two thin lanes to a "zipper" with hazards on every surface of both lanes, 6 columns apart. Stars on the island tops and undersides.
  5. **Tall Room** (29 s) — the corridor grows from 6 to 9 to 13 tiles and back; taller rooms mean longer flights, so you tap earlier. Leaving the 9-tile room is a 3-tile wall for the ceiling (be on the floor); the 13-tile shaft is left by 1-tile steps.
  6. **Squeeze** (29 s) — a 2-tile tunnel (the ceiling wall is 3 tiles: enter on the floor), a 3-tile tunnel, and a wavy 2-tile tunnel that shifts one tile at a time (hazards keep 4 columns from each step).
  7. **Star Bait** (29 s) — two splits where the star route is visibly different: an island whose upper lane has the stars and a busy rhythm while the lower lane is calm, and a 1-tile tunnel with a star inside whose exit is a trap (spikes right after it).
  8. **Zigzag** (29 s) — hazards alternate every 7 columns in a 4-tile and a 5-tile corridor: land and flip again at once; stars sit on a free surface between hazards.
  9. **Long Drop** (29 s) — 13-tile and 11-tile shafts with hazards on the far side 10–12 columns apart: time when you leave so you land past them.
  10. **Cave Exit** (53 s, 3 flags) — the exam: ping pong, gaps, an island, a tall room, a squeeze, a zigzag and a long drop in one run.
- **First level of each later world:**
  - 11. **Take Off** — a short flip warm-up, a "HOLD!" cue and the glider portal; then a long glider room with wide gaps (6 tiles) between pillars every 11 columns.
  - **The Bell Tower (levels 11–20), as built** (26–50 s at 470 px/s; every level passes the solver with all stars; glider levels stay beatable with a bat 16 px bigger):
    1. **Take Off** — the first glider room: wide gaps, far apart, stars at the gap edges.
    2. **Weave** — 4-tile gaps every 9 columns, alternating high and low.
    3. **Scraper** — a room narrowed to 8 tiles with spikes on the ceiling and floor for 35 columns (stay in the air), then a stretch with ceiling spikes only and one with floor spikes only.
    4. **Stalactites** — rock hanging from the ceiling and rising from the floor in all sizes, 1 to 3 columns wide.
    5. **Switchback** — Flip → Glider → Flip → Glider → Flip: the form changes every few seconds.
    6. **Pistons** — eight blocks sliding between the ceiling and the floor; each arrives at an end of its path, so the free lane is readable; spikes between them make you cross.
    7. **Lifts** — long stretches of floor are a platform that rises while you ride it, with spikes on the ceiling so you cannot fly over.
    8. **Moving Pillars** — a glider room whose pillars slide up and down.
    9. **Bell Ringer** — pistons, a glider weave, pistons, moving pillars.
    10. **Tower Exit** (50 s, 3 flags) — the exam: pistons, two lifts, a weave, ping pong, moving pillars.
  - 21. **Two of Us** — after a short flip warm-up, a Twin portal; at first the two lanes have the same spikes, then they start to differ.
  - **The Firefly Forest (levels 21–30), as built** (24–48 s at 500 px/s; every level passes the solver with all stars, tightest flip window ≥ 180 ms):
    1. **Two of Us** — the first twin room: identical hazards in both lanes, then one lane at a time.
    2. **Mirror Mirror** — lanes of different heights (3 and 5 tiles): the short one lands first, but both must land before the next flip.
    3. **Odd One Out** — one lane has a hazard at a time, alternating lane and surface.
    4. **Fireflies** — two short lanes (3 tiles each), dense hazards, stars in the lane you are not watching.
    5. **Fast Lane** — the first speed gates (flip form): normal, fast, normal, slow, fast.
    6. **Slow Burn** — slow gates before the dense parts, fast gates on the long empty ones.
    7. **Speed Run** — fast gates and wider hazards.
    8. **Twin Pads** — a twin room with speed gates across both lanes.
    9. **Switch** — Flip → Twin → Flip → Twin, with gates in between.
    10. **Forest Exit** (48 s) — the exam: gates, a twin room with gates, flip, twin again.
  - 31. **Switchboard** — gravity switches that flip you for free, inside a Flip → Glider → Flip run.
- **Level data format** (one JS module per level in `levels/`):

```json
{
  "id": "w1l01",
  "name": "First Flip",
  "speed": 440,
  "start": { "x": 3, "y": 12, "gravity": 1 },
  "tiles": [
    "################################################ … ",
    "#...............................................",
    "… 16 rows, all the same length …"
  ],
  "objects": [
    { "type": "star", "x": 40, "y": 4 },
    { "type": "flag", "x": 120, "y": 13 },
    { "type": "mover", "x": 60, "y": 6, "w": 3, "h": 1, "dx": 0, "dy": 5, "period": 3 },
    { "type": "pad", "x": 80, "y": 13, "mult": 1.35 },
    { "type": "portal", "x": 150, "form": "glider" },
    { "type": "portal", "x": 220, "form": "twin", "lanes": [3, 11] },
    { "type": "hint", "x": 148, "label": "HOLD!" },
    { "type": "switch", "x": 140, "y": 13, "gravity": -1 },
    { "type": "goal", "x": 300 }
  ]
}
```

  Tile characters: `.` empty, `#` solid, `^` floor spikes, `v` ceiling spikes, `>` and `<` wall spikes. `gravity` is 1 (down) or −1 (up). A portal's `form` is `flip`, `glider` or `twin`; a twin portal lists the two lane rows, and the twin takes the one the runner is not in.

## 7. Progression and retention
- **Completed levels:** a finished level shows a check badge on its tile, and the results screen shows a COMPLETE ribbon, even with 0 stars. (This deviates from the "1–3 stars" in `STANDARDS.md` on purpose: here the stars are the collectibles.)
- **Unlocks:** finishing a level unlocks the next. A world unlocks when the previous world's level 10 is finished.
- **Endless mode:** unlocked by finishing world 1. Chunks of 5–10 s (40–80 columns), each tagged with a tier 1–4, are chained by a seeded random generator. Chunks start and end on a shared neutral seam (floor at row 13, ceiling at row 2, 4 safe columns), so any chunk follows any other. Chunks are tagged with their form; the seam between two chunks of different forms gets a portal. One life. Speed starts at 440 px/s and rises 2% every 30 s up to a cap of 680 px/s; after that only the tier mix keeps getting harder. Score = distance in meters (1 tile = 1 m). Best distance is saved.
- **Daily run:** the same endless run for everyone that day, seeded by the date (`YYYYMMDD`). Three scored attempts per day, and the best one counts (later attempts are practice), a streak counter for consecutive days, and a copyable result line with the best attempt, for example:
  `Flip Runner Daily #142 · 1,284 m · 🟩🟩🟨🟧 · 🔥3`
  (one square per tier reached, then the streak). No social APIs.
- **Skins:** 12 bat colors and 12 scarf patterns, unlocked automatically at total star counts (item *k* of 24 unlocks at round(*k* × 4.8) stars, the last at 115 of 120). No currency. The scarf always trails against the run and droops towards gravity, whatever the skin.

## 8. Screens and UI flow
- **Title:** logo with "RUNNER" upside down, big **PLAY** button (starts the next unfinished level), **LEVELS**, **DAILY** and **ENDLESS** (locked until world 1 is done, with a lock and "Finish the Crystal Cave"), **SKINS**, sound and music toggles. The bat runs in place in a strip of cave under the moon and flips when you click it; the tagline reads "Race home before sunrise!".
- **Level select:** 4 world tabs, 10 level tiles each with stars (★ shapes), the next level highlighted and bouncing.
- **Playing (HUD, top 80 px):** level number and name; a small badge with the current form; 3 star slots (filled, outline for banked earlier, empty); a progress bar to the goal with flag markers; death counter (skull-free icon: a little crumbled runner) with the count; pause and restart buttons.
- **Pause:** Resume, Restart, Menu, and a one-line control reminder ("Tap or Space to flip · hold to glide").
- **Level complete:** the bat flies into its roost; panel slides in with stars stamping in, time counting up, **DEATHS ×12** stamped big, best death count, buttons **Next**, **Retry**, **Menu**.
- **Endless / daily end:** distance counting up, best, tiers reached; daily adds the streak and a **Copy result** button.
- **Skins:** the runner on a pedestal, rows of colors and scarves, locked items with their star count.

## 9. Art direction
- **Family:** Chunky Cartoon, at night: saturated colors, round squishy shapes and thick dark outlines on deep night skies lit by crystals, lanterns and the moon.
- **Palette (core, used in every world):**
  | Hex | Role |
  |---|---|
  | `#1B1430` | Outlines, text, HUD |
  | `#B79CFF` | The bat (default skin); belly `#E9DFFF`, inner ears `#FF8FB1` |
  | `#FF5A4E` | Scarf, danger accents |
  | `#FFD45C` | Stars, lanterns, the HOME sign |
  | `#FFF3C4` | The moon |
  | `#FFF7EC` | UI panels |

  Two accents mark the forms (portals, the glider, the twin): `#5FC8FF` Glider (sky blue) and `#FFB05F` Twin (the orange sibling). Flip uses the bat's lilac. Each form is also told apart by shape and by the name on its portal.

  Each world has its own night: a sky gradient, rock shades, an accent light and the spike color. **The sky warms world by world towards dawn**, so the trip home is also a countdown.
  | World | Sky (top → bottom) | Floor | Ceiling | Accent light | Spikes | Backdrop |
  |---|---|---|---|---|---|---|
  | Crystal Cave | `#1E1740` → `#35266A` | `#4B3D7C` | `#3B2F68` | `#5FF0D8` crystals | crystal shards `#7FF3E4` | stalactite and stalagmite silhouettes, glowing crystals |
  | Bell Tower | `#241E4E` → `#4B3B82` | `#6E5E93` | `#5A4B7E` | `#FFC857` lamps | `#E9E2FF` | arched windows, hanging bells |
  | Firefly Forest | `#132B3C` → `#235A5C` | `#3E6B4F` | `#2E5641` | `#D7FF6B` fireflies | thorns `#C9F28A` | tree silhouettes, hanging roots |
  | Night Fair | `#3A2050` → `#C46A6A` (first light) | `#5B3A6E` | `#4A2E5E` | `#FF9B4A` bulbs | `#FFE3F0` | ferris wheel, tents |

  (`STANDARDS.md` asks for 4–6 colors chosen once: the 6 core colors are fixed; the world tables are the same kind of per-world shades Flip Runner used from the start, plus one accent light each.)
- **Key visuals:** a round lilac baby bat with pointed ears, big shiny eyes, two tiny fangs and folded wings that flap as it scurries; a red scarf (simulated as a short rope) that trails behind and droops towards gravity; spread wings in glider form; the orange sibling in twin form. Rock tiles with lit lips on the running faces, little stalactites under ceilings and glowing crystal veins; crystal-shard spikes; glowing dashed crystal edges on every wall face (where you would crash). Behind: a sky gradient, the moon, two silhouette layers per world and drifting motes of light (crystal dust, fireflies) that stream past faster than the world.
- **Rendering:** all art drawn in code. Long levels are pre-rendered in cached strips of 32 columns (three strips alive at a time); the sky gradient and the silhouette layers are pre-rendered once per level, so no frame redraws the whole level or a full-screen gradient.
- **Juice list:**
  - Flip: stretch along the gravity axis at take-off, a curved motion trail, squash and dust on landing; the ears and wings flop with the flip.
  - Scarf whips around on every flip.
  - Motes of light streaming past faster than the world, two parallax layers, running dust; more motes on a fast pad.
  - Afterimages trailing the bat during every flip, and a trail behind the glider; the wings beat while gliding.
  - Portal: a band of moonlight with motes rising through it pulses; the bat bursts into confetti of the new form's color, and the form's name pops over it.
  - **Close call:** passing within 10 px of a spike's deadly area pops a "CLOSE!" with sparks and a ping; the results screen counts them.
  - Star: glowing, pops with a sparkle burst and flies to its HUD slot; banking at a lantern makes the slots shine.
  - Death: crunch, the bat bursts into pieces, 6 px shake for 0.2 s, soft vignette pulse, rebuild pop at the lantern.
  - Checkpoint: the lantern lights up with a warm glow and confetti.
  - Goal: the bat flies into its moonlit roost, confetti, results count-up, the death count stamps in.
- **Concept art prompts** (updated from the brief):
  - **Gameplay screenshot (16:9):** *"Cute round lilac cartoon baby bat (#B79CFF) with pointed ears, big shiny eyes, tiny fangs and a long red scarf, running upside down on the ceiling of a night crystal cave, deep indigo sky gradient, glowing teal crystals and stalactite silhouettes in the background, the full moon far away, crystal-shard spikes and a gap below, a glowing yellow star on the risky route, a lit lantern on a post, a curved gravity flip motion trail, bright chunky cartoon style, thick dark outlines, 2D side-scrolling game screenshot, 16:9"*
  - **Key art / thumbnail (16:9 and 1:1, no text):** *"a round determined lilac baby bat with a trailing red scarf flipping in mid-air between the floor and ceiling of a glowing crystal cave at night, its orange sibling bat behind it, a big full moon ahead, motion arc showing the flip, crystal shards, yellow stars, sense of speed, chunky cartoon style, round squishy shapes, big expressive eyes, saturated colors, thick dark outlines, soft cel shading, playful squash-and-stretch energy, centered composition with room for a title, game key art"*
  - **Character and element sheet:** *"the round lilac baby bat with a red scarf: running, flipping, upside-down running on a ceiling, gliding with its wings spread, landing squash, bursting apart; its orange sibling bat; plus floor and ceiling crystal-shard spikes, a gap with glowing crystal edges, a floating rock platform, a moving block on a dotted rail, fast and slow chevron pads, a round gravity switch with an arrow, a band-of-moonlight portal with a name tag, a lantern on a post (unlit and lit), a glowing star and a rock ring around the full moon with a HOME sign, chunky cartoon style, round squishy shapes, big expressive eyes, saturated colors, thick dark outlines, soft cel shading, game asset sheet on a plain dark indigo background, evenly spaced, consistent scale"*
  - **Logo:** *"the words "FLIP RUNNER" in bold rounded letters, with the word RUNNER flipped upside down like a mirror, a little lilac bat hanging from the letters, a curved arrow showing a gravity flip, chunky cartoon style, saturated colors, thick dark outlines, soft cel shading, game logo on a plain background, bold and readable at small size"*
  - **Negative prompt:** *"text, letters, watermark, signature, photorealistic, gritty, horror, violence, weapons, blood, cluttered background, blurry, low contrast, extra limbs, UI buttons"* (drop "text, letters" for the logo).

## 10. Audio
| Sound | When | Character |
|---|---|---|
| Whoop | Every flip | Short rising sweep; pitch steps up for each flip within 0.5 s of the last (up to 5 steps) |
| Land | Touching down after a flip | Soft thud |
| Crunch | Death | Crunchy noise burst plus a falling blip |
| Rebuild | Respawn | Quick rising ratchet |
| Star | Star grabbed | Chime, higher for each star in the level |
| Bank | Stars banked at a flag | Short sparkle |
| Checkpoint | Flag passed | Two-note chime |
| Zoom / slow | Fast / slow pad | Rising / falling whoosh |
| Switch | Gravity switch | Boing with a pitch bend |
| Portal | Changing form | Two-note chime with a whoosh |
| Goal | Level complete | Cheerful 2-second jingle |
| Stamp | Stars and deaths on results | Stamp thump |
| UI | Buttons | Soft click |

Music: yes, one short synthesized loop per world (4 bars of kick, snare, hats, bass and arpeggio at ~132 BPM, tempo matched to the world speed), **on by default**: in a runner the music carries the rhythm, and it is tiny because it is generated. Music and sound effects have separate toggles, both persist. (Close call: passing within 10 px of a spike plays a bright double ping.)

## 11. GameAnalytics
| Event id | When it fires | Value |
|---|---|---|
| `Start:world0N:level0M` | Level begins (also after R) | — |
| `Complete:world0N:level0M` | Goal reached | Stars banked this run (0–3) |
| `Fail:world0N:level0M` | Player restarts with R / button, or quits to the menu | Seconds played |
| `level:deaths` | On Complete and on Fail | Deaths this attempt |
| `death:spikes` / `death:gap` / `death:wall` / `death:crush` | On Complete and on Fail, one per type that happened | Deaths of that type this attempt |
| `quit:spikes` / `quit:gap` / `quit:wall` / `quit:crush` | On Fail | — (the type of the last death before giving up) |
| `quit:form:flip` / `quit:form:glider` / `quit:form:twin` | On Fail | — (the form the runner was in when the player gave up) |
| `checkpoint:<n>` | Flag *n* passed for the first time in an attempt | — |
| `tutorial:step01` | First flip ever | — |
| `tutorial:step02` | First checkpoint ever | — |
| `tutorial:done` | Level 1 complete | — |
| `endless:distance` | Endless run ends | Meters |
| `daily:start` / `daily:complete` | Scored daily run starts / ends | Meters on complete |
| `daily:streak:<n>` | Daily run ends | — |
| `ui:restart` | R or restart button | — |
| `settings:music:off` / `settings:sfx:off` | Toggle switched off | — |

**Question the data must answer:** which obstacle and which form cause the most quits (`quit:<type>`, `quit:form:<form>`), and how many retries a level takes before players finish or leave (`level:deaths` on Complete vs Fail, per level).

## 12. Tech plan
- **Stack:** vanilla Canvas 2D, ES modules, no build step, following `STANDARDS.md`. Useful code from Magnet Twins (fixed-step loop, input recording, save, analytics stub, sound synth, particles) is **copied** into this folder, not imported.
- **Modules (`src/`):** `main.js` (boot), `game.js` (loop, screens, HUD), `sim.js` (deterministic runner world: movement, flips, deaths, stars, flags; no DOM), `level.js` (parser), `chunks.js` (endless and daily chain from a seed), `render.js` (strip cache, the bat and its scarf, objects, sky and parallax), `fx.js`, `input.js` (keys and pointer to a press queue plus a held state), `audio.js`, `record.js`, `save.js`, `analytics.js`.
- **Input bits:** each 120 Hz step gets two bits: "pressed this step" and "held". Recordings store them, so glider runs replay exactly.
- **Solver (`tools/`):** a one-button game can be searched. From each state the solver tries "act now" or "wait one step" (act = press in flip and twin form, hold in glider form), with memoization on (column, gravity, y, speed), and reports whether the level is beatable, the tightest flip window on the easiest route, and which stars are reachable. It runs in Node on the same `sim.js`. A level is not done until the solver passes it and the tightest window is at least 120 ms. Windows can have holes (flipping late can also work by entering a room in mid-air), so the solver builds its route by flipping in the middle of the widest good window each time, and reports that width.
- **Level kit (phase 3):** levels are small programs, not hand-typed grids. `tools/levelkit.mjs` has a `Cave` class (`room`, `floorSpikes`, `ceilSpikes`, `floorGapAt`, `ceilGapAt`, `island`, `rampFloor`, `rampCeil`, `star`, `flagFloor`, `hint`, `portal`, `goal`) that renders the 16-row text grid, and `tools/build-world1.mjs` builds levels 2–10 with it. Any level that needs a change is edited as code and rebuilt, so the solver can re-check it in under a second.
- **Glider levels have no flip windows to measure** (holding and releasing has no critical instant), so they are checked for **spatial slack** instead: the level must still be beatable with the bat's hitbox 8 px bigger in each direction (`solve.mjs`'s `slack`, stored in the solution file and checked by `simtest`). A level with no slack asks for pixel precision.
- **Twin levels in the kit:** `twinRoom` (two lanes with a divider; the lanes may differ in height), `laneSpikes(lane, surface, …)`, `twinPortal`, `twinExit` (funnels back to the corridor, then the flip portal) and `pad` (a speed gate). **Stars in a twin room are placed away from the hazards of both lanes** (3 columns), because both bats share gravity: a star on the floor of one lane next to a floor hazard of the other lane needs two opposite gravities at once. `Cave.star` moves every star to the nearest safe cell and fails if there is none. The solver merges states whose x differs by less than 6 px and keeps the lineage of real inputs, so the route it returns replays exactly.
- **Level tools (`tools/`):** `levels.mjs` (solve every level and print time, stars, flips, tightest window and longest plain stretch), `stars.mjs` (is each star reachable on its own?), `deaths.mjs` (where and how the explored routes die: the way to find the trap in a level that can't be beaten), `show.mjs` (print a slice of a map). `simtest.mjs` runs the mechanics checks and, for every level, the rules above plus a stored solution (`levels/solutions/<id>.json`, with the solver's results) that must reach the goal, bank all three stars and replay identically; `--write` re-solves everything and rewrites them (`--only=id,id` to limit it; solving a long glider level with its slack check takes about a minute). `levelkit.mjs` also has `mover` (with `at` for the phase), `pillar` and `funnel`; solver nodes keep only a summary of their state, because a glider room has hundreds of possible heights per step.
- **Debug mode (`?debug`):** every level open; `.` and `,` jump to the next or previous checkpoint, `J` and `K` change level, `[` `]` change the forward speed by 20 px/s, `-` `=` change gravity by 500, `9` `0` change the flip kick by 50, all live, with the numbers on screen. This is the "debug level select and live tuning" that `PHASES.md` asks for in skill games.
- **Visual level editor:** moved to **Later**. The level kit and the solver cover world 1; a visual editor is worth building only if the endless chunks (30 hand-made pieces) turn out to be easier to paint than to program.
- **Save keys:** `cm_flip-runner_save` → `{ v: 1, stars: { "w1l01": [1,0,1] }, best: { "w1l01": { time, deaths } }, endless: { best }, daily: { last, streak, best }, skin, tut }` and `cm_flip-runner_settings` → `{ v: 1, music: true, sfx: true }`. Reads in `try/catch`.
- **Testing hook:** `window.game` with `screen`, `level`, `score`, `start()`, `restart()`, `win()` (debug only).
- **Riskiest piece:** input latency and the feel of the flip on a Chromebook trackpad. Prove it first in phase 2 with the bare runner on a test corridor, measuring time from input event to the first frame that shows the flip.
- **Second risk:** long levels on low-end hardware. The strip cache keeps drawing cost flat; test a 60 s level with 4× CPU throttle.

## 13. Scope
- **v1:** the runner, the three forms (Flip, Glider, Twin) and all mechanics in section 3; 40 levels in 4 worlds; endless mode; daily run with streak and result line; 24 skins; full shell, saving, audio, analytics.
- **Later:** a visual level editor (see 12); more forms (a Bounce form where the button jumps); ghost of your best run (cheap thanks to deterministic replays); player level editor with shareable codes.
- **Cut:**
  - **Mid-air flips:** they remove the timing that the whole game is about.
  - **Lives and game over** in levels: against the quick-death pillar.
  - **Separate "flip up" and "flip down" buttons:** one button is the hook.
  - **No-flip zones:** replaced by the forms, which add more variety for the same cost.

## 14. Open questions
| Question | Recommendation | Who decides | Status |
|---|---|---|---|
| Glider angle: is 0.85 × speed (about 40°) right? | Keep; tune in the feel loop | Fafi | Open |
| Twin: does "flip only when both are down" feel fair, or should a press flip whichever can? | Keep both-down, buffered; revisit if players feel ignored | Fafi | Open |
| A fourth form for world 4? | No for v1: world 4 mixes the three; Bounce goes to Later | Team | Open |
| Coolmath SDK, ad breaks, branding, size limit | Ads only between levels and after endless runs, never mid-run | Team | Open |
| GameAnalytics game key and secret | One key per game in a config file | Team | Open |
| Should endless chunks be hand-made only, or also cut from levels? | Hand-made with the level editor, 30 chunks for v1 (8 per tier, 6 neutral) | Fafi | Open |

## 15. Changelog
- 2026-11-11 — **Phase 3, world 3 (Firefly Forest).** Ten levels built and solver-verified (Twin rooms with lanes of different heights, speed gates). Speed pads became full-corridor **speed gates** (see 3.6): surface-dependent pads made arrival times route-dependent and blew up the solver. Density is now measured in seconds using each zone's real speed. The kit places stars on safe cells (twin rooms: 3 columns from any hazard of either lane). Two world 1 stars moved one column because of that and were re-verified.
- 2026-11-10 — **Phase 3, world 2 (Bell Tower).** Ten levels built and solver-verified (Glider rooms, switchbacks, moving blocks). Moving blocks implemented in the sim: smoothstep path, riding, wall, crush, flag-stored clock, controlled phase (a block's phase at arrival is fixed because the bat's speed is constant). Glider levels are checked by spatial slack instead of flip windows. The solver's memory use was cut (lighter nodes). New fair-play insight: a block with a free-chosen period can make a level unbeatable.
- 2026-11-10 — **Phase 3, world 1 (Crystal Cave).** Levels 1–10 built and solver-verified; the forms prototype leaves world 1 and stays as the debug level `proto` (the Glider and Twin worlds will get their own opener levels). New fair-play rules found while building: no hazard within 2 columns of a step, stars never on hazards, no lane with spikes on both surfaces in one column. Density rule now exempts the first and last 2 s and is checked by `simtest`. Levels open one by one (a level opens when the previous is done). Tools: level kit, `levels.mjs`, `stars.mjs`, `deaths.mjs`, `show.mjs`, debug mode; the visual editor moves to Later.
- 2026-10-28 — **Bat theme** (Fafi: the game looked flat and generic): the runner is a baby bat racing home before sunrise; worlds renamed Crystal Cave, Bell Tower, Firefly Forest and Night Fair (they replace the brief's Lab, Caves, Sky Factory and Space Station), with a sky that warms towards dawn; new night palette; crystal-shard spikes, lantern checkpoints, a moonlit home roost as the goal, the glider is the bat with its wings spread, the twin is its orange sibling. Mechanics and levels unchanged.
- 2026-10-26 — Approved by Pao. Stage moves to `slice`.
- 2026-10-22 — Redesign around **forms** after the forms prototype playtested better than flip-only: portals switch between Flip, Glider (hold to climb) and Twin (two runners, one tap); worlds now introduce Glider (world 2) and Twin (world 3), world 4 mixes all; moving blocks move to level 15, speed pads to 25; no-flip zones cut; input sends press and held bits; analytics add the form on quits; two form accent colors. Status stays In review: the team needs to read the new design.
- 2026-10-22 — Feel loop 1 ("too slow and bland"): world speeds 440–530 px/s (+37%), gravity 7000 and a 250 px/s kick (flip ~0.22 s), denser levels (something every 0.6–1 s), music on by default, speed lines, pillars, afterimages, running dust, and close calls with a counter on the results.
- 2026-10-21 — Vertical slice built: flip measured at ~0.27 s across a 6-tile corridor (kick included); solver picks the widest window per flip.
- 2026-10-21 — Phase 1c review applied: flag snapshots make every retry identical (mover phases, speed, gravity); 1-tile rises are auto-stepped, only walls of 2+ tiles kill; death events sent as counts per attempt plus `quit:<type>` on Fail; forgiving hitboxes (runner 24×28, spikes 6 px inset); daily counts the best of 3 attempts; no full-screen death flash; level editor planned for phase 3; endless speed capped at 520 px/s; check badge and COMPLETE ribbon for 0-star finishes; camera leads more at high speed; holding a key never repeats a flip. Status set to In review.
- 2026-10-21 — First draft from the brief and the phase 1a answers (gravity flip at 5000 px/s² taking ~0.29 s, 100 ms buffer and 60 ms coyote, collectible stars are the rating and are banked at flags, 320–400 px/s with the camera at 30%, free geometry, gravity switches instead of portals in world 4, endless and daily built from chunks, skins unlocked by stars, a level 1 no one can fail, deterministic sim with a one-button solver).
