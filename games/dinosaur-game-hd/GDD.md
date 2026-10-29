# Dinosaur Game: Cool Edition — Game design document

**Status:** Draft
**Owner:** Pao · **Reviewed by:** — · **Last updated:** 2026-10-29

> The offline browser dino you already know, with the same jump, the same speed and the same "one mistake and it's over". Now in 16-bit pixel art, with eggs to collect, new runners to hatch and unlock, a daily run, and a race against a friend on the same keyboard.

**Folder slug:** `dinosaur-game-hd` (kept so links don't break; the game's name is **Dinosaur Game: Cool Edition**).

## 1. Summary
- **Pillars:**
  1. **It feels exactly like the original.** The jump, duck, speed curve, obstacle rules and hitboxes are the original's numbers. A player who knows it is at home in one second.
  2. **No bloat.** Everything new sits on top of the run, never inside it: no power-ups, no upgrades, no lives, no levels. Every runner is cosmetic.
  3. **One more run, under a second away.** A crash shows the result over the frozen scene; Space starts the next run at once.
- **Player:** Coolmath players aged 10–24, on a school Chromebook with a keyboard or trackpad, or a tablet, sound often off. Almost all of them have played the no-internet dino.
- **Session:** One run lasts 20–90 s (a 1000 m run takes about 80 s). A typical visit is 10–20 runs, or a few 2P races: 10–15 minutes.
- **Hook:** "My best is 1,240, I can beat that." Then: "38 more eggs and the Stegosaurus hatches", "Squatch unlocks at 1000 m", the daily run's streak, and the friend next to you who just won.

## 2. Core loop
- **Moment (seconds):** see the obstacle → jump (tap or hold) or duck → grab the eggs on the riskier path, or play it safe.
- **Run (a minute):** sleeping dino → any key → run as the speed rises and day turns to night → one hit ends it → distance and eggs count up → Space, and you are running again.
- **Meta (days):** eggs hatch the 3 classic dinosaurs → achievements unlock the 7 Tag characters and the Hangman beast → daily run streak → 2P races with a friend.

## 3. Mechanics

All tuning numbers are the original game's values (Chromium `offline.js`, the "T-Rex runner"), in its own units: **logical pixels** and **per frame at 60 fps**. They are recalled here and **must be checked against the Chromium source and by playing `chrome://dino` side by side** in the first slice step (see 12). We copy numbers only, never code or art.

### 3.1 Space and scale
- **Logical resolution 640×360**, drawn crisp (`imageSmoothingEnabled = false`) and scaled up to the window: ×2 at 1280×720, ×3 at 1920×1080, letterboxed. The original's playfield is 600×150 logical px, so ours shows a little more ahead (640 vs 600) and has room above for sky and parallax.
- **1P:** the ground line is at y = 300. The dino stands at x = 50 (like the original's `START_X_POS`).
- **2P:** two lanes of 640×180. Each lane's ground line is 150 px below its top, the same height as the original's whole playfield, so the jump fits exactly.

### 3.2 Simulation
- **Fixed step at 60 Hz** with an accumulator (frame `dt` capped at 0.05 s). Since the original's numbers are per frame at 60 fps, one step = one original frame, so the numbers apply unchanged and the game plays the same at 60 Hz and 144 Hz.
- Deterministic: obstacles and eggs come from a seeded PRNG (mulberry32). The same seed and the same inputs give the same run (daily run, 2P lanes, replays in tests).

### 3.3 Speed and distance
- **Start speed:** 6 px/frame (360 px/s). **Acceleration:** +0.001 px/frame every frame. **Cap:** 13 px/frame (780 px/s), reached after about **117 s / 1,660 m**.
- **Distance:** 1 m = 40 px travelled (the original's score coefficient of 0.025), so our metres equal the original's points. The score starts at 9 m/s and reaches 19.5 m/s at the cap.
- **Reference times:** 100 m ≈ 10 s, 500 m ≈ 46 s, 1000 m ≈ 80 s, 2000 m ≈ 135 s, 3000 m ≈ 185 s.
- **Clear time:** no obstacles for the first **3 s** of a run.
- **Milestones:** every 100 m the score flashes 4 times and a beep plays (as in the original).

### 3.4 The runner (jump, duck, fast-fall)
- **Size:** 44×47 px standing, 59×25 ducking (the original's T-Rex footprint). Every runner is drawn inside this footprint.
- **Jump:** only from the ground. The start velocity is **10 + speed/10** px/frame upwards; **gravity 0.6** px/frame².
  - **Tap:** the jump always rises at least **30 px**. If the button is already released by then, the upward velocity is cut to 5 px/frame: apex about **51 px**, airtime about **0.41 s**.
  - **Hold:** the jump is cut at **63 px** above the ground (the original's `MAX_JUMP_HEIGHT`) the same way: apex about **84 px**, airtime about **0.54 s**.
- **Duck:** hold down on the ground. The runner switches to the low pose and hitbox for as long as down is held.
- **Fast-fall:** down in the air sets the vertical velocity to 1 px/frame downward and multiplies it by **3** (the original's `SPEED_DROP_COEFFICIENT`); on landing, the runner ducks if down is still held.
- **No input buffer and no coyote time**, as in the original. A jump pressed in the air is ignored.
- **Hitboxes:** the original's T-Rex collision boxes (6 boxes standing, 1 box ducking), checked only when the outer box (shrunk by 1 px) overlaps. The same boxes are used for every runner.
- **Crash:** the runner shows its crash frame (dizzy face), the scene freezes, and a short shake and thud play.

### 3.5 Obstacles
All sizes and rules are the original's. Each obstacle type uses its original collision boxes.

| Obstacle | Size (px) | Height | Groups | From |
|---|---|---|---|---|
| Small cactus | 17×35 each | on the ground | 1–3 in a row once speed > 4 (from the start) | 3 s |
| Large cactus | 25×50 each | on the ground | 1 at first; 1–3 once speed > 7 | 3 s; groups from about 160 m |
| Pterodactyl | 46×40, 2-frame flap | low (jump), mid (duck or jump), high (run under, don't jump) | single | speed ≥ 8.5: about **450 m** |

- **Gap:** after each obstacle, the next one comes after a random gap between `minGap = width × speed + obstacleMinGap × 0.6` and `1.5 × minGap` (obstacleMinGap 120 for cacti, 150 for pterodactyls). This is what keeps every gap clearable at the current speed.
- **No more than 2** obstacles of the same type in a row.
- **Pterodactyl heights** (bottom of the sprite above the ground): low **0 px**, mid **25 px** (a standing runner hits it, a ducking runner passes), high **50 px** (a standing runner passes under; a jump hits it). Each flies at the scroll speed **±0.8** px/frame, picked at random.
- **Teaching order (the only change from the original):** the first obstacle of every run is a **single small cactus**, and the first pterodactyl of every run flies at **mid** height, where both ducking and jumping work. After that it's random.

### 3.6 Day and night
- Night begins every **700 m** and lasts **12 s**, then fades back to day (as in the original). The nights start at 700, 1400, 2100, 2800 m…
- Instead of inverting the colors, the sky fades over 1 s from day to a deep blue night with stars and a moon. Every sprite keeps its dark outline; at night obstacles and eggs also get a 1 px light rim, so nothing gets harder to read.

### 3.7 Eggs
- **What:** small cream eggs with orange speckles (10×13 px), wobbling gently with a glint. Picking one up gives +1 egg; the pickup box is **16×16 px** around the egg, bigger than the egg, so a near miss still counts.
- **Eggs never block or change the run.** All eggs from a run are banked when it ends, crash or not. Nothing is lost.
- **Placement:** after an obstacle, the next gap may get an egg pattern (25% chance, never two gaps in a row), chosen from the patterns unlocked at the current distance:

| Pattern | Eggs | Where | Asks you to | From |
|---|---|---|---|---|
| Ground line | 3 | at ground level in a long gap | nothing, it's free | 30 m |
| Jump arc | 5 | along the full-jump arc over a small cactus | hold the jump (a tap gets the lower 2–3) | 150 m |
| Big arc | 5 | above a large cactus group, top egg near the 84 px apex | a perfectly timed full jump | 300 m |
| Duck line | 3 | at duck height under a mid pterodactyl | duck rather than jump | 450 m |

- Eggs are generated from the same seed as the obstacles, so the daily run and both 2P lanes have the same eggs.
- **Target:** a typical 400 m run collects **15–40 eggs**, a great run about 100. Tune in the slice. If playtesters die chasing eggs in the first 30 s, the patterns there get easier.
- **Egg streak:** eggs picked up less than 0.6 s apart raise the pickup sound's pitch one step each, up to 8 steps.

## 4. Controls

### 1 player
| Action | Mouse / touch | Keyboard |
|---|---|---|
| Jump (hold for higher) | press anywhere in the top ⅔ of the play area | Space, Up, W |
| Duck / fast-fall | press and hold in the bottom ⅓ | Down, S |
| Pause | pause button (top right, 48 px) | P, Esc |
| Restart | Retry button on the results | R, or Space on the results |

During a player's **first run only**, faint jump (up arrow) and duck (down arrow) icons show in the two touch zones and fade out after the first jump and the first duck.

### 2 players
| Action | Touch | Keyboard |
|---|---|---|
| P1 jump | press the left half, above the bottom-left corner | W |
| P1 duck | press and hold the bottom-left corner (bottom ⅓ of the left half) | S |
| P2 jump | press the right half, above the bottom-right corner | Up |
| P2 duck | press and hold the bottom-right corner | Down |
| Pause | pause button (top centre) | P, Esc |

The lanes are stacked (P1 top, P2 bottom) but the touch zones are split left and right, so each half shows a faint "P1" or "P2" label with jump and duck arrows for the first 3 s of each race. Every pointer is tracked separately (Pointer Events), so both players can press at once.

## 5. Game elements
| Element | Behavior | First appears | Shape/icon (not color alone) |
|---|---|---|---|
| Runner | runs by itself, jumps, ducks, fast-falls | title | each runner's own silhouette |
| Small cactus | static, 1–3 in a row | 3 s | thin column with arms |
| Large cactus | static, 1–3 in a row | 3 s | thick column with arms, taller |
| Pterodactyl | flies at 3 heights, flapping | ~450 m | wide flapping wings, beak |
| Egg | +1 egg when touched | 30 m | oval with speckles and a glint |
| Night | 12 s of dark sky every 700 m | 700 m | stars and moon |
| Ghost (2P) | the crashed player's runner stays faded in its lane | 2P | 50% opacity, X eyes |

## 6. Run design
An endless runner has no levels: the run itself is the level, and the original's rules give it its curve.

- **Structure:** one endless run in one desert scene. 1P endless, 2P race and the daily run all use the same rules; only the seed changes.
- **Teaching order:** 3 s of empty desert (the title already showed "Space to start") → a single small cactus (teaches jump) → random cacti → the first pterodactyl at mid height (~450 m; duck or jump both work) → all three heights.
- **Difficulty curve:** speed rises from 360 to 780 px/s over the first 117 s. Faster speed means wider gaps but less time to react. Groups of large cacti come from ~160 m and pterodactyls from ~450 m.

| Distance | Time | What happens |
|---|---|---|
| 0 m | 0–3 s | empty desert, the runner wakes up |
| ~25 m | 3 s | first obstacle: a single small cactus |
| 30 m | | egg ground lines can appear |
| 100 m | 10 s | first milestone flash |
| 150 m | | jump arcs |
| ~160 m | 17 s | groups of large cacti |
| 300 m | | big arcs |
| ~450 m | 42 s | first pterodactyl (mid); duck lines |
| 700 m | 60 s | first night |
| 1000 m | 80 s | Squatch's achievement |
| ~1660 m | 117 s | top speed |
| 2800 m | 175 s | 4th night: the Hangman beast's achievement |
| 3000 m | 185 s | Pixie's achievement |

- **Stars:** none. The run's score is its distance; the results show the best distance and a "NEW BEST" banner.
- **Seed format:** a 32-bit integer. 1P endless picks a random seed per run; the daily run's seed comes from the local date (`YYYYMMDD`); a 2P race picks one seed for both lanes.

## 7. Progression and retention

### 7.1 Runners
12 runners. All are cosmetic: same jump, same speed, same hitbox. Each has its own run (4 frames), jump, duck (2 frames) and crash frames, drawn inside the 44×47 / 59×25 footprint.

| Runner | Unlock | How it moves |
|---|---|---|
| **T-Rex** | free | big head, tiny arms, the classic |
| **Triceratops** | hatch for **300 eggs** | four legs; ducks by lowering its horns |
| **Pachycephalosaurus** | hatch for **750 eggs** | ducks with its dome forward |
| **Stegosaurus** | hatch for **1500 eggs** | four legs; ducks by flattening its plates |
| **Squatch** (Tag) | reach **1000 m** in one run | blue fuzzy head on little feet |
| **Griffin** (Tag) | collect **1000 eggs** in total | orange bird-griffin, big eye; flaps on jumps |
| **Unicorn** (Tag) | play the daily run **7 days in a row** | pink pony with a white horn |
| **Kraken** (Tag) | run **50 km** in total | teal octopus with glasses; tentacles flail on jumps |
| **Pixie** (Tag) | reach **3000 m** in one run | purple hooded droplet; bounces instead of running |
| **Hangman beast** | reach the **4th night** (2800 m) in one run | black fur ball with horns; light rim so it shows at night |
| **Alien** (Tag) | win **10 two-player races** | mint-green, cap and glasses; the **2P-only bonus** |
| **Dragon** (Tag) | unlock every other runner **except Alien** | red one-eyed dino with jagged teeth; the completionist prize |

- **Hatching:** spending eggs plays a short scene: the egg wobbles, cracks in 3 steps, and the dinosaur pops out with a jingle. The hatched runner is equipped right away.
- **Alien and 2P:** any race that ends with a winner counts (P1 or P2 wins, not a draw), since both players share one save. Dragon doesn't need Alien, so a solo player can finish the collection.
- **Achievement runners** unlock when the condition is met. They are announced on the results screen, not during the run.
- **References for the redraws:** `reference/tag-roster.png` (Pixie, Squatch, Alien, Griffin with names), `reference/tag-kraken.png`, `reference/tag-forest.png` (Squatch, Kraken, Dragon, Unicorn), `reference/tag-tower.png` (Unicorn, Alien, Pixie, Griffin), `reference/hangman-beast.png`.

### 7.2 Daily run
- One seed per day from the local date, the same obstacles and eggs for everyone.
- Unlimited tries; the day's **best** distance counts. Eggs earned in the daily run count as normal.
- **Streak:** +1 for each calendar day with at least one daily run; a missed day resets it to 0.
- **Daily #:** days since launch (launch date set at release).
- **Emoji result line** (copy button on the daily results): `🦖 Daily #12 — 1,840 m 🥚32 🔥5` (distance, eggs from the best run, streak).

### 7.3 What brings players back
Best distance, the next egg hatch (the results show "Stegosaurus: 1,230 / 1,500 🥚"), the next achievement (the Runners screen shows each one's progress), the daily streak, and 2P rematches.

## 8. Screens and UI flow
```
Title ──Play / Space──▶ Playing ──crash──▶ Results ──Retry / Space / R──▶ Playing
  │                        │                  ├──Runners──▶ Runners
  │                        └─P─▶ Paused       └──Menu──▶ Title
  ├──2 Players──▶ Race setup ──Race!──▶ 3-2-1 ──▶ Racing ──first crash──▶ Race results ──Rematch──▶ 3-2-1
  ├──Daily──▶ Playing (daily seed) ──crash──▶ Daily results (+ copy emoji line)
  ├──Runners──▶ Runners (hatch / equip)
  └──Settings (sound, music)
```
- **Title:** the desert with the equipped runner asleep ("Zz"), the logo "DINOSAUR GAME" with a "COOL EDITION" banner, the buttons **Play** (big), **2 Players**, **Daily** (with the streak 🔥), **Runners**, and sound and music toggles. Pressing Space, Up or W starts a 1P run, like the original.
- **Playing (HUD):** top right, the original's score style: `HI 01240  00321`. Top left, an egg icon with this run's count. Pause button, top right corner.
- **Paused:** dimmed scene, **Resume**, **Restart**, **Menu**. The game also pauses when the tab is hidden.
- **Results (1P and daily):** the panel slides up over the frozen scene **500 ms** after the crash (the original's lock against accidental restarts). Distance and eggs count up, best distance, "NEW BEST" if it is one, any runner unlocked in this run (sprite and name), the next hatch's progress bar. Buttons: **Retry** (big) / **Runners** / **Menu**. Space or R retries; the new run starts in under 1 s.
- **Race setup (2P):** both lanes with their runners. P1 changes runner with A/D, P2 with Left/Right; on touch, arrows beside each runner. P1 starts with the equipped runner, P2 with the last runner P2 used (or the T-Rex with a "P2" badge). One big **Race!** button: two clicks from the title.
- **Racing:** a 3-2-1 countdown (1.5 s), then both lanes run from the same seed at the same speed. **The first crash ends the race:** the crashed runner stays in its lane as a ghost (faded, X eyes) and the lane freezes; the winner keeps running for a 1.5 s victory lap. Both crashing in the same step is a **Draw**.
- **Race results:** "P1 WINS" (or P2, or DRAW) with a crown on the winner, the winner's distance, both players' eggs (they go to the shared bank), and a running tally ("P1 2 – 1 P2") kept until you return to the menu. **Rematch** (big) / **Runners** / **Menu**. No best-of-3.
- **Runners:** a 6×2 grid of the 12 runners. Unlocked ones show their sprite; a selected runner runs on a treadmill strip at the top. Locked classic dinosaurs show as an egg with a progress bar ("Triceratops 180 / 300 🥚") and a **Hatch** button when there are enough eggs; locked achievement runners show as a silhouette with their condition and progress ("Reach 1000 m: best 640"). Click an unlocked runner to equip it. The total egg bank is shown top right.

## 9. Art direction
- **Family:** HD Pixel (new): a 16-bit SNES look, chunky sprites with dark outlines, matching Tag.
- **Palette:**

| Color | Hex | Role |
|---|---|---|
| Night Ink | `#1B2340` | outlines, night sky, UI text |
| Desert Sand | `#F2C879` | ground and dunes by day |
| Sunset Orange | `#F08A24` | sky band, egg speckles, highlights, buttons |
| Cactus Green | `#3FA34D` | cacti |
| Dino Slate | `#5A6B7D` | the T-Rex (a nod to the original's gray), UI panels |
| Egg Cream | `#FFF6E0` | eggs, light rims at night, text on dark |

  The T-Rex is slate, not green, so it never blends with the cacti. Each crossover runner keeps its own colors from Tag or Hangman, with the same Night Ink outline.
- **Key visuals:**
  - **Runners:** about 44×47 logical px each, 1 px Night Ink outline, 3–5 colors each. The crash frame has dizzy eyes.
  - **Obstacles:** cacti with strong silhouettes and arms; a pterodactyl with a big wing flap.
  - **Background:** 3 parallax layers (dunes at 0.2×, mesas at 0.1×, clouds at 0.05× the scroll speed), each pre-rendered once to an offscreen canvas. A warm sunset band by day; stars and a moon at night.
  - **UI:** a pixel bitmap font drawn in code (no web fonts), slate panels with a Night Ink border, orange buttons.
- **Juice list:**
  - run cycle dust puffs; landing squash (2 frames) and jump stretch;
  - egg pickup: a pop, "+1" floating up, the egg icon in the HUD bumps;
  - 100 m: the score flashes 4 times;
  - crash: a 150 ms screen shake (4 px), dizzy stars over the runner;
  - results: count-up numbers, the "NEW BEST" banner bounces in;
  - hatching: wobble, 3 cracks, shell pieces fly, the dinosaur pops out;
  - achievement unlock: the runner's sprite bounces in with sparkles;
  - 2P win: a crown drops onto the winner, confetti in their lane;
  - night: a 1 s sky fade, stars twinkling in.
- **Concept art prompts:**
  - **Gameplay screenshot (16:9):** *"16-bit pixel art side-scrolling runner, a cute slate-gray pixel dinosaur with a big head and tiny arms jumping over a green cactus in a desert, an arc of small cream eggs with orange speckles above the cactus, a pterodactyl flying ahead, parallax sand dunes and mesas, warm orange sunset sky, dark outlines, crisp SNES-style pixel art, 16:9 game screenshot"*
  - **Key art / thumbnail (16:9 and 1:1, no text):** *"a cute slate-gray pixel art dinosaur mid-jump over a cactus, speckled eggs flying around it, a second dinosaur and a cracked eggshell below, desert at sunset turning to night with stars, crisp 16-bit SNES-style pixel art, dark outlines, saturated colors, room for a title, game key art"*
  - **Character sheet:** *"pixel art dinosaur sprite sheet: run cycle, jump, duck, crash with dizzy eyes; plus a triceratops, a pachycephalosaurus and a stegosaurus in the same poses, each hatching from a speckled egg, 16-bit SNES style, dark outlines, consistent size, plain light background, evenly spaced"*
  - **Logo:** *"the words "DINOSAUR GAME" in chunky pixel letters with a small "COOL EDITION" banner, a pixel dinosaur head peeking over the letters next to a cracked speckled egg, 16-bit pixel art, plain background, bold and readable at small size"*
  - **Negative prompt:** *"text, letters, watermark, signature, photorealistic, gritty, horror, violence, blood, Google logo, Chrome logo, coins, cluttered background, blurry, low contrast, UI buttons"*

## 10. Audio
| Sound | When | Character |
|---|---|---|
| Jump | jump starts | short square-wave "boop" rising |
| Duck | duck or fast-fall starts | soft noise swoosh |
| Egg | egg picked up | bright "pip", one step higher per egg in a streak (up to 8) |
| Milestone | every 100 m | the original-style two-tone beep |
| Crash | runner hits an obstacle | low thud plus a short wobble |
| Night | night begins | soft low chime |
| Hatch | each crack, then the reveal | 3 clicks, then a 4-note jingle |
| Achievement | runner unlocked (results) | rising 5-note fanfare |
| Countdown | 3-2-1-GO in 2P | 3 beeps, a higher "go" |
| Win | 2P race won | short victory jingle |
| UI click | any button | soft tick |

All synthesized with WebAudio. **Music:** a 20–30 s chiptune desert loop, light and bouncy, **off by default**, toggle in settings.

## 11. GameAnalytics
Progression ids are one per mode: `endless`, `versus`, `daily`. A run has no "complete", so every run ends with `Fail` and the distance as score.

| Event id | When it fires | Value |
|---|---|---|
| Progression `Start:endless` / `Start:daily` / `Start:versus` | a run or race starts | — |
| Progression `Fail:endless` / `Fail:daily` | the run ends | distance (m) |
| Progression `Complete:versus` | the race ends with a winner or draw | winner's distance (m) |
| `tutorial:step01` | first jump ever | — |
| `tutorial:step02` | first duck ever | — |
| `tutorial:done` | first run past 100 m | — |
| `run:death:<cactus-small\|cactus-large\|ptero-low\|ptero-mid\|ptero-high>` | crash | distance (m) |
| `run:distance` | run ends | distance (m) |
| `eggs:earned` | run ends | eggs this run |
| `runner:hatch:<id>` | an egg runner is hatched | eggs spent |
| `runner:equip:<id>` | a runner is equipped | — |
| `achievement:<id>` | a runner is unlocked by achievement | — |
| `versus:start` | race starts | — |
| `versus:winner:<p1\|p2\|draw>` | race ends | — |
| `daily:start` | daily run starts | — |
| `daily:complete` | first daily run of the day ends | distance (m) |
| `daily:streak:<n>` | the streak goes up | n |
| `ui:restart` | Retry, Space or R after a run | — |
| `settings:music:off` / `settings:sfx:off` | a toggle is switched off | — |

**Questions the data must answer:**
1. Do eggs and unlockable runners raise runs per session compared with plain best distance? (Compare runs/session before and after the first hatch.)
2. How often is 2P played, and are 2P sessions longer?
3. Where do players die (`run:death` by type and distance)? Do eggs cause early deaths?

## 12. Tech plan
- **Stack:** static HTML5, ES modules, Canvas 2D, no engine, no build step.
- **Modules (`src/`):** `main.js` (loop, screens), `sim.js` (runner physics, obstacles, eggs, collisions: no drawing), `gen.js` (seeded PRNG and obstacle/egg generator), `render.js` (scene, parallax, HUD), `sprites.js` (all pixel art as string grids → offscreen canvases at startup), `input.js` (keys and pointers, 1P and 2P zones), `ui.js` (title, results, runners, race setup), `audio.js`, `save.js`, `analytics.js`.
- **Rendering:** draw at 640×360 into an offscreen canvas, then scale up to the display canvas with smoothing off. Integer scale where the window allows; otherwise the nearest fit, letterboxed. `devicePixelRatio` capped at 2.
- **Simulation:** fixed 60 Hz step, deterministic (3.2). The sim runs headless, so a test can replay a seed and a list of inputs.
- **Save:** one key, `cm_dinosaur-game-hd_save`:
  `{ v: 1, best, eggs, totalEggs, totalDistance, versusWins, unlocked: [ids], equipped, p2Runner, daily: { lastDate, streak, best, bestEggs }, firstRunDone, settings: { sfx, music } }`, read inside `try/catch` (a broken save resets to defaults). Saved after every run, hatch, equip and settings change.
- **Testing hook:** `window.game` with `screen` (`'title' | 'runners' | 'setup' | 'playing' | 'paused' | 'results'`), `mode` (`'endless' | 'daily' | 'versus'`), `score` (distance), `eggs`, and the helpers `start()`, `restart()`, `crash()` (debug only, removed in release builds).
- **Riskiest piece: matching the original's feel.** Prove it first: build `sim.js` with the original's numbers, then compare jump apex, airtime, the gap range at 3 speeds and the time to top speed against `chrome://dino` (frame-by-frame screen recordings), and log the measured values in `DEVLOG.md`. Only then add art and eggs.
- **Second risk: four-legged runners in the footprint.** Draw the Triceratops and Stegosaurus early as rough sprites to check they read well at 44×47.

## 13. Scope
- **v1:** 1P endless, 2P race (keyboard and touch), daily run, eggs, 12 runners (4 dinosaurs, 7 Tag characters, the Hangman beast), day and night, one desert scene.
- **Later (only if data says so):** more scenes (jungle, volcano, ice) every 1000 m; a ghost of your best run; color variants of each dinosaur as an egg sink once all 3 are hatched; a rare golden egg worth 10.
- **Cut:**
  - power-ups, upgrades, lives, missions, loot boxes: they break the "feels like the original" pillar;
  - a 2P speed ramp after the cap: 2P matches 1P exactly;
  - best-of-3 matches: single races with a rematch tally are faster;
  - a separate achievements screen: the Runners screen is the list;
  - input buffering and coyote time: the original has none.

## 14. Open questions
| Question | Recommendation | Who decides | Status |
|---|---|---|---|
| Are the recalled original numbers (3.3–3.5) exact? | Check them against the Chromium source and `chrome://dino` in slice step 1 and update this GDD. | Pao | Open |
| Is "Dinosaur Game" in the name OK to publish? | It's the generic name players use; keep "Chrome", "Google" and "T-Rex Runner" out. Ask the team before any public build. | Team | Open |
| Egg rate and prices (300 / 750 / 1500) | Keep; check that a typical run gives 15–40 eggs in the slice, retune in phase 4. | Pao | Open |
| Achievement targets | Keep; check against real run data in phase 4. | Pao | Open |
| Coolmath ad breaks | Only between runs, and never more often than every few minutes; never on Retry. | Coolmath | Open |
| Daily seed: local date or UTC? | Local date: simpler for players, small differences around midnight don't matter. | Pao | Open |
| Does 2P on a tablet work with four hands? | Build it; if testers can't use it, show "Needs a keyboard" on touch. | Playtest | Open |

## 15. Changelog
- 2026-10-29 — First draft from the brief and the phase 1a answers: HD Pixel in Canvas 2D; the original's numbers; name **Dinosaur Game: Cool Edition**; **eggs** instead of coins, with hatching; 7 Tag characters with their real names (Squatch, Griffin, Unicorn, Kraken, Pixie, Alien, Dragon) plus the Hangman beast; Alien is the 2P-only bonus and Dragon needs every runner except Alien; Hangman beast at the 4th night; 2P speed matches 1P; no best-of-3; touch 2P with left/right halves; the first crash ends a race.
