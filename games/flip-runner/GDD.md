# Flip Runner — Game design document

**Status:** In review
**Owner:** Fafi · **Reviewed by:** — · **Last updated:** 2026-10-21

> A little runner dashes on by itself; one tap flips gravity and sends it arcing to the ceiling and back. Read the corridor, time the flip, thread the gaps.

## 1. Summary
- **Pillars:**
  1. **One button, perfect timing.** Everything is a flip, and every flip is about *when*. No other input ever matters in play.
  2. **Every death is my fault, and it's quick.** Deaths are readable (you see exactly what got you) and cost under half a second.
  3. **Speed you can read.** The camera shows what is coming, floor and ceiling look different, and the scarf always shows which way is "down".
- **Player:** Coolmath players aged 10–24, on a school Chromebook with a trackpad or on a phone, sound often off, in short breaks.
- **Session:** One level takes 20–60 s of running, plus retries (typically 1–3 minutes). A typical visit is 5–8 levels or a few endless runs: 10–15 minutes.
- **Hook:** "I was so close." The death counter, the star on the risky route, and the daily run with a shareable distance bring players back.

## 2. Core loop
- **Moment (seconds):** See the obstacle → tap at the right instant → arc to the other surface → land and run.
- **Level (minutes):** Run → die → back at the flag in under 0.5 s → learn the section → reach the goal → stars and death count.
- **Meta (days):** Stars unlock skins → next world adds a new obstacle → daily endless run and streak.

## 3. Mechanics

### 3.1 Space and scale
- Design resolution 1280×720. The HUD takes the top 80 px; the playfield is 1280×640.
- Levels are strips of **40 px tiles, 16 rows tall** and as many columns as needed (a 40 s level at 8 tiles/s is about 320 columns).
- The camera scrolls horizontally only, with the runner at **30% of the screen width** from the left, so 22 tiles (2.8 s at base speed) of what is coming are visible. At higher speeds the camera leads more, easing the runner back to 22% of the width at 540 px/s, so the look-ahead time stays above 1.6 s.

### 3.2 Simulation
- Fixed step at **120 Hz** with an accumulator (frame `dt` capped at 0.05 s). Deterministic for the same inputs, so levels can be checked by a solver and replayed.
- The runner is an axis-aligned box swept against the tiles and moving blocks, per axis.

### 3.3 The runner
- **Hitbox:** 24 × 28 px, smaller than the drawing (about 40 × 40 px with squash and stretch), so grazes don't kill.
- **Forward speed:** constant per level, set by the world: **320 px/s** (8 tiles/s) in world 1, 350 in world 2, 380 in world 3, 400 in world 4. Speed pads change it inside a level (3.5).
- **Gravity:** **5000 px/s²**, pointing down or up. Max vertical speed 1600 px/s.
- **Flip:** gravity reverses and the runner gets a 150 px/s kick towards the new surface so the arc starts at once. Crossing a standard 6-tile corridor (212 px of travel) takes **about 0.27 s** (measured in the sim, kick included) and covers about 2.2 tiles forward. Taller rooms mean longer flips (12 tiles: about 0.42 s).
- **Auto-step:** a rise of exactly 1 tile in the surface the runner is on (floor, or ceiling when gravity is up) is climbed automatically with a quick hop, no input. Only walls of 2 tiles or more stop the runner, and they are drawn with a warning edge.
- **Only from a surface:** a flip needs the runner to be standing (floor, ceiling, platform or moving block, whichever is "down" right now). No mid-air flips.
- **Forgiveness:** a tap is **buffered for 100 ms** (a tap just before landing flips on touchdown), and **coyote time is 60 ms** (a tap just after running off an edge still flips).
- **Input:** the flip is processed on key down / pointer down, never on release. Holding a key or a finger does not repeat the flip (keyboard auto-repeat is ignored): one press, one flip. Input events are queued with the step they arrive in, so latency is at most one step (8 ms) plus the frame.

### 3.4 Death
- The runner dies when it:
  - touches **spikes** (their deadly area starts 6 px inside the drawn triangle);
  - leaves the playfield through the top or bottom (an open gap);
  - **runs into a wall face** of 2 tiles or more head-on, with a corner forgiveness of 10 px: hitting the very top or bottom 10 px of a wall nudges the runner over or under it instead (1-tile rises are auto-stepped, 3.3);
  - is **crushed** between a moving block and another solid.
- Death: a crunch, the runner bursts into pieces, a short shake and a soft vignette (never a full-screen flash: deaths repeat a lot), then it rebuilds at the last flag. **Back to running in 0.35 s.**
- No lives and no game over in levels. The level's death counter goes up by one.

### 3.5 Obstacles and objects
- **Gaps:** missing floor or ceiling. With a surface on the other side, flip over them; with nothing on either side, they are deadly.
- **Spikes:** on floors (pointing up) or ceilings (pointing down), and on block faces.
- **Platforms:** solid islands in the middle of a room; the runner can land on their top (gravity down) or their underside (gravity up).
- **Moving blocks (world 2):** solid blocks that slide back and forth along a straight path with an eased motion and a fixed period (2–4 s). They can be ridden. They only kill by crushing, and their path is drawn as a dotted rail so it is always visible.
- **Speed pads (world 3):** chevrons on a surface. **Fast pad** (»): speed × 1.35. **Slow pad** («): speed × 0.75. The new speed lasts until the next pad. A respawn restores the speed saved at the flag (3.6).
- **No-flip zones (world 3):** a hatched band across the screen with a crossed-out flip icon. Taps inside are ignored; a tap in the last 100 ms before the zone ends is buffered and fires at its exit.
- **Gravity switches (world 4):** a round pad with an arrow. Touching it flips gravity without a tap, in the arrow's direction. A switch can be passed through from either side and fires once per pass.
- **Stars:** 3 per level, placed on the risky route (3.7).
- **Checkpoint flags:** about every 15 s of running. Passing one activates it with a whip-up animation.
- **Goal gate:** a big striped arch at the end. Running through it completes the level.

### 3.6 Checkpoints and restart
- **Every retry of a section is identical.** When a flag activates it saves a snapshot: the runner's speed and gravity, and the phase of every moving block. On death everything is restored from that snapshot, so the section always plays the same way and can be learned. The runner respawns on the surface the flag stands on.
- **R** restarts the level from the start (under 1 s).

### 3.7 Stars and rating
- Each level has **3 collectible stars**. They are the level rating (0–3 stars). Finishing the level always marks it as complete, even with no stars.
- A star you grab is **banked when you pass the next flag** (or the goal). If you die before that, it goes back to its place.
- Each star, once banked, stays collected forever, so you don't need all three in one run. Banked stars are drawn as outlines on later runs.
- The results screen also shows the **death count** for the run and the best (lowest) death count, proudly: dying a lot is part of the fun.

## 4. Controls
| Action | Mouse / touch | Keyboard |
|---|---|---|
| Flip | Click or tap anywhere in the playfield | Space, ↑, ↓, W or S |
| Pause | HUD button | P or Esc |
| Restart level | HUD button | R |
| Menus | Click / tap | Arrows, Enter / Space |

- All flip keys do the same thing (toggle gravity). There is no "flip up" vs "flip down".
- HUD buttons never trigger a flip. Taps on the HUD bar are ignored by the runner.
- Mouse and touch first, as in `STANDARDS.md`; the whole game is playable with one finger.

## 5. Game elements
| Element | Behavior | First appears | Shape/icon (not color alone) |
|---|---|---|---|
| Runner | Auto-runs, flips gravity | 1 | Round body, big eyes, a scarf that trails and points "down" |
| Floor / ceiling | Surfaces to run on | 1 | Floor top faces and ceiling bottom faces are different shades and patterns (floor: tiles with a top lip; ceiling: tiles with a bottom lip and hanging bolts) |
| Spikes | Kill on touch | 1 | Triangles with thick outline |
| Gap | Deadly if open on both sides | 1 | Visible void with warning stripes on the edges |
| Star | Collectible, banked at the next flag | 1 | Five-point star, spinning |
| Checkpoint flag | Respawn point | 1 | Pole with a flag that whips up |
| Goal gate | Ends the level | 1 | Striped arch |
| Platform | Land on top or underside | 4 | Floating block with lips on both faces |
| Moving block | Slides on a visible rail, crushes | 11 | Block with bolts and a dotted rail |
| Fast / slow pad | Speed × 1.35 / × 0.75 | 21 | » or « chevrons on the surface |
| No-flip zone | Ignores taps | 24 | Hatched band with a crossed-out flip icon |
| Gravity switch | Flips gravity on touch | 31 | Round pad with a big arrow |

## 6. Level design
- **Structure:** 40 levels in 4 worlds of 10.
  - **World 1 — Lab (1–10):** flipping, gaps, spikes, platforms, room heights.
  - **World 2 — Caves (11–20):** moving blocks (ride them, avoid being crushed, time flips to them).
  - **World 3 — Sky Factory (21–30):** speed pads (21), then no-flip zones (24), then both.
  - **World 4 — Space Station (31–40):** gravity switches, then everything together.
- **Teaching order:** each element first appears with no other danger nearby and a generous window, then with a twist (on the ceiling, at speed, in a tall room), then combined with older elements.
- **Difficulty curve:** a level gets harder with shorter windows between flips, taller rooms (longer flips to plan ahead), flips that must happen in the middle of a sequence, higher speed, and stars placed off the safe route. Each world starts easier than the end of the last. The first level of each world has no star off the safe route.
- **Fair-play rules:** every obstacle is visible for at least 1.2 s before it must be acted on; no blind drops (the landing surface is always on screen); no flip needs a window shorter than 120 ms (checked by the solver).
- **Stars:** placed where grabbing one needs a riskier flip or an extra flip, never a frame-perfect one.
- **First 10 levels (Lab):**
  1. **First Flip** (20 s) — 3 s of flat floor with a pulsing "tap" icon, then one floor gap with a ceiling over it, then floor spikes only. No one who taps when told can die.
  2. **Ping Pong** — spikes alternate between floor and ceiling in an even rhythm.
  3. **Mind the Gap** — open sections where flipping at the wrong moment means flying out of the screen.
  4. **Islands** — platforms in the middle of the room; land on top, then on the underside.
  5. **Tall Room** — corridor heights change; taller rooms need earlier taps.
  6. **Squeeze** — the corridor narrows to 2 tiles: quick, short flips.
  7. **Star Bait** — the safe route and the star route split visibly.
  8. **Zigzag** — double flips: land and flip again at once.
  9. **Long Drop** — tall shafts with spikes at the far end: time when you leave so you land past them.
  10. **Lab Exit** (50 s) — everything from the world, three flags.
- **Level data format** (one JS module per level in `levels/`):

```json
{
  "id": "w1l01",
  "name": "First Flip",
  "speed": 320,
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
    { "type": "noflip", "x0": 90, "x1": 100 },
    { "type": "switch", "x": 140, "y": 13, "gravity": -1 },
    { "type": "goal", "x": 300 }
  ]
}
```

  Tile characters: `.` empty, `#` solid, `^` floor spikes, `v` ceiling spikes, `>` and `<` wall spikes. `gravity` is 1 (down) or −1 (up).

## 7. Progression and retention
- **Completed levels:** a finished level shows a check badge on its tile, and the results screen shows a COMPLETE ribbon, even with 0 stars. (This deviates from the "1–3 stars" in `STANDARDS.md` on purpose: here the stars are the collectibles.)
- **Unlocks:** finishing a level unlocks the next. A world unlocks when the previous world's level 10 is finished.
- **Endless mode:** unlocked by finishing world 1. Chunks of 5–10 s (40–80 columns), each tagged with a tier 1–4, are chained by a seeded random generator. Chunks start and end on a shared neutral seam (floor at row 13, ceiling at row 2, 4 safe columns), so any chunk follows any other. One life. Speed starts at 320 px/s and rises 2% every 30 s up to a cap of 520 px/s; after that only the tier mix keeps getting harder. Score = distance in meters (1 tile = 1 m). Best distance is saved.
- **Daily run:** the same endless run for everyone that day, seeded by the date (`YYYYMMDD`). Three scored attempts per day, and the best one counts (later attempts are practice), a streak counter for consecutive days, and a copyable result line with the best attempt, for example:
  `Flip Runner Daily #142 · 1,284 m · 🟩🟩🟨🟧 · 🔥3`
  (one square per tier reached, then the streak). No social APIs.
- **Skins:** 12 body colors and 12 scarf patterns, unlocked automatically at total star counts (item *k* of 24 unlocks at round(*k* × 4.8) stars, the last at 115 of 120). No currency. The scarf always trails against the run and droops towards gravity, whatever the skin.

## 8. Screens and UI flow
- **Title:** logo with "RUNNER" upside down, big **PLAY** button (starts the next unfinished level), **LEVELS**, **DAILY** and **ENDLESS** (locked until world 1 is done, with a lock and "Finish the Lab"), **SKINS**, sound and music toggles. The runner runs in place on the title and flips when you click empty space.
- **Level select:** 4 world tabs, 10 level tiles each with stars (★ shapes), the next level highlighted and bouncing.
- **Playing (HUD, top 80 px):** level number and name; 3 star slots (filled, outline for banked earlier, empty); a progress bar to the goal with flag markers; death counter (skull-free icon: a little crumbled runner) with the count; pause and restart buttons.
- **Pause:** Resume, Restart, Menu, and a one-line control reminder ("Tap, click or Space to flip").
- **Level complete:** the runner leaps through the goal arch; panel slides in with stars stamping in, time counting up, **DEATHS ×12** stamped big, best death count, buttons **Next**, **Retry**, **Menu**.
- **Endless / daily end:** distance counting up, best, tiers reached; daily adds the streak and a **Copy result** button.
- **Skins:** the runner on a pedestal, rows of colors and scarves, locked items with their star count.

## 9. Art direction
- **Family:** Chunky Cartoon.
- **Palette (core, used in every world):**
  | Hex | Role |
  |---|---|
  | `#2B2238` | Outlines, text, HUD |
  | `#3DBE8B` | Runner body (default skin) |
  | `#FF5A4E` | Scarf, danger accents |
  | `#FFC531` | Stars, flags, goal |
  | `#EEF1F6` | Spikes |
  | `#FFF7EC` | UI panels |

  Each world adds a background, a floor shade and a ceiling shade:
  | World | Background | Floor | Ceiling |
  |---|---|---|---|
  | Lab | `#EAF4FF` | `#8FAAD0` | `#BACCE6` |
  | Caves | `#F3E6D3` | `#B48455` | `#D6AF85` |
  | Sky Factory | `#FFE9D6` | `#E0915E` | `#F2C29C` |
  | Space Station | `#232A4A` | `#5F70A6` | `#8696C9` |
- **Key visuals:** a round, determined runner with big eyes and a long scarf (simulated as a short rope) that trails behind and droops towards gravity; chunky tiles with lips on the running faces; parallax backgrounds per world (two layers, pre-rendered).
- **Rendering:** all art drawn in code. Long levels are pre-rendered in cached strips of 32 columns (three strips alive at a time), so no frame redraws the whole level.
- **Juice list:**
  - Flip: stretch along the gravity axis at take-off, a curved motion trail, squash and dust on landing.
  - Scarf whips around on every flip.
  - Speed lines while on a fast pad; a little puff on slow pads.
  - Star: pop, sparkle burst, flies to its HUD slot; banking at a flag makes the slots shine.
  - Death: crunch, runner bursts into pieces, 6 px shake for 0.2 s, soft vignette pulse, rebuild pop at the flag.
  - Checkpoint: flag whips up with confetti.
  - Goal: runner leaps through the arch, confetti, results count-up, the death count stamps in.
- **Concept art prompts** (updated from the brief):
  - **Gameplay screenshot (16:9):** *"Cute round green cartoon runner (#3DBE8B) with a long red scarf running upside down on the ceiling of a light blue lab corridor, floor and ceiling in different shades of blue, a curved gravity flip motion trail, spikes and a gap below, a yellow star on the risky route, bright chunky cartoon style, thick dark outlines, 2D side-scrolling game screenshot, 16:9"*
  - **Key art / thumbnail (16:9 and 1:1, no text):** *"a round determined little green character with a long trailing red scarf flipping in mid-air between floor and ceiling of a colorful corridor, motion arc showing the flip, spikes below, yellow stars, sense of speed, chunky cartoon style, round squishy shapes, big expressive eyes, saturated colors, thick dark outlines, soft cel shading, playful squash-and-stretch energy, centered composition with room for a title, game key art"*
  - **Character and element sheet:** *"the round green runner character with a red scarf: running, flipping, upside-down running on the ceiling, landing squash, bursting apart; plus floor and ceiling spikes, a gap with warning stripes, a floating platform, a moving block on a dotted rail, fast and slow chevron pads, a hatched no-flip zone, a round gravity switch with an arrow, a checkpoint flag, a star and a striped goal arch, chunky cartoon style, round squishy shapes, big expressive eyes, saturated colors, thick dark outlines, soft cel shading, game asset sheet on a plain light background, evenly spaced, consistent scale"*
  - **Logo:** *"the words "FLIP RUNNER" in bold rounded letters, with the word RUNNER flipped upside down like a mirror, a curved arrow showing a gravity flip, chunky cartoon style, saturated colors, thick dark outlines, soft cel shading, game logo on a plain background, bold and readable at small size"*
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
| Goal | Level complete | Cheerful 2-second jingle |
| Stamp | Stars and deaths on results | Stamp thump |
| UI | Buttons | Soft click |

Music: yes, one short synthesized loop per world (16 bars, upbeat, tempo matched to the world speed), **off by default**. Sound effects on by default; both toggles persist.

## 11. GameAnalytics
| Event id | When it fires | Value |
|---|---|---|
| `Start:world0N:level0M` | Level begins (also after R) | — |
| `Complete:world0N:level0M` | Goal reached | Stars banked this run (0–3) |
| `Fail:world0N:level0M` | Player restarts with R / button, or quits to the menu | Seconds played |
| `level:deaths` | On Complete and on Fail | Deaths this attempt |
| `death:spikes` / `death:gap` / `death:wall` / `death:crush` | On Complete and on Fail, one per type that happened | Deaths of that type this attempt |
| `quit:spikes` / `quit:gap` / `quit:wall` / `quit:crush` | On Fail | — (the type of the last death before giving up) |
| `checkpoint:<n>` | Flag *n* passed for the first time in an attempt | — |
| `tutorial:step01` | First flip ever | — |
| `tutorial:step02` | First checkpoint ever | — |
| `tutorial:done` | Level 1 complete | — |
| `endless:distance` | Endless run ends | Meters |
| `daily:start` / `daily:complete` | Scored daily run starts / ends | Meters on complete |
| `daily:streak:<n>` | Daily run ends | — |
| `ui:restart` | R or restart button | — |
| `settings:music:off` / `settings:sfx:off` | Toggle switched off | — |

**Question the data must answer:** which obstacle causes the most quits (`quit:<type>`), and how many retries a level takes before players finish or leave (`level:deaths` on Complete vs Fail, per level).

## 12. Tech plan
- **Stack:** vanilla Canvas 2D, ES modules, no build step, following `STANDARDS.md`. Useful code from Magnet Twins (fixed-step loop, input recording, save, analytics stub, sound synth, particles) is **copied** into this folder, not imported.
- **Modules (`src/`):** `main.js` (boot), `game.js` (loop, screens, HUD), `sim.js` (deterministic runner world: movement, flips, deaths, stars, flags; no DOM), `level.js` (parser), `chunks.js` (endless and daily chain from a seed), `render.js` (strip cache, runner and scarf, objects, parallax), `fx.js`, `input.js` (keys and pointer to a flip queue), `audio.js`, `record.js`, `save.js`, `analytics.js`.
- **Solver (`tools/`):** a one-button game can be searched. From each standing state the solver tries "flip now" or "wait one step", with memoization on (column, gravity, y, speed), and reports whether the level is beatable, the tightest flip window on the easiest route, and which stars are reachable. It runs in Node on the same `sim.js`. A level is not done until the solver passes it and the tightest window is at least 120 ms. Windows can have holes (flipping late can also work by entering a room in mid-air), so the solver builds its route by flipping in the middle of the widest good window each time, and reports that width.
- **Level editor (phase 3, debug only):** paint tiles, place objects and flags, scrub a playtest from any column, run the solver with one click, and export the level module. 40 levels of ~320 columns plus 30 chunks can't be maintained as hand-typed text.
- **Save keys:** `cm_flip-runner_save` → `{ v: 1, stars: { "w1l01": [1,0,1] }, best: { "w1l01": { time, deaths } }, endless: { best }, daily: { last, streak, best }, skin, tut }` and `cm_flip-runner_settings` → `{ v: 1, music: false, sfx: true }`. Reads in `try/catch`.
- **Testing hook:** `window.game` with `screen`, `level`, `score`, `start()`, `restart()`, `win()` (debug only).
- **Riskiest piece:** input latency and the feel of the flip on a Chromebook trackpad. Prove it first in phase 2 with the bare runner on a test corridor, measuring time from input event to the first frame that shows the flip.
- **Second risk:** long levels on low-end hardware. The strip cache keeps drawing cost flat; test a 60 s level with 4× CPU throttle.

## 13. Scope
- **v1:** the runner and all mechanics in section 3; 40 levels in 4 worlds; endless mode; daily run with streak and result line; 24 skins; full shell, saving, audio, analytics.
- **Later:** portals to a parallel lane; ghost of your best run (cheap thanks to deterministic replays); player level editor with shareable codes.
- **Cut:**
  - **Mid-air flips:** they remove the timing that the whole game is about.
  - **Lives and game over** in levels: against the quick-death pillar.
  - **Separate "flip up" and "flip down" buttons:** one button is the hook.

## 14. Open questions
| Question | Recommendation | Who decides | Status |
|---|---|---|---|
| Does a 0.29 s flip feel snappy enough, or does it need to be faster? | Start at 5000 px/s²; tune in the phase 2 feel loop | Fafi | Open |
| Coolmath SDK, ad breaks, branding, size limit | Ads only between levels and after endless runs, never mid-run | Team | Open |
| GameAnalytics game key and secret | One key per game in a config file | Team | Open |
| Should endless chunks be hand-made only, or also cut from levels? | Hand-made with the level editor, 30 chunks for v1 (8 per tier, 6 neutral) | Fafi | Open |

## 15. Changelog
- 2026-10-21 — Vertical slice built: flip measured at ~0.27 s across a 6-tile corridor (kick included); solver picks the widest window per flip.
- 2026-10-21 — Phase 1c review applied: flag snapshots make every retry identical (mover phases, speed, gravity); 1-tile rises are auto-stepped, only walls of 2+ tiles kill; death events sent as counts per attempt plus `quit:<type>` on Fail; forgiving hitboxes (runner 24×28, spikes 6 px inset); daily counts the best of 3 attempts; no full-screen death flash; level editor planned for phase 3; endless speed capped at 520 px/s; check badge and COMPLETE ribbon for 0-star finishes; camera leads more at high speed; holding a key never repeats a flip. Status set to In review.
- 2026-10-21 — First draft from the brief and the phase 1a answers (gravity flip at 5000 px/s² taking ~0.29 s, 100 ms buffer and 60 ms coyote, collectible stars are the rating and are banked at flags, 320–400 px/s with the camera at 30%, free geometry, gravity switches instead of portals in world 4, endless and daily built from chunks, skins unlocked by stars, a level 1 no one can fail, deterministic sim with a one-button solver).
