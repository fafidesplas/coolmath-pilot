# Dinosaur Game: Cool Edition — Game design document

**Status:** Approved
**Owner:** Pao · **Reviewed by:** Fafi · **Last updated:** 2026-10-30

> The offline browser dino you already know, with the same jump, the same speed and the same "one mistake and it's over". Now in 16-bit pixel art, with eggs to collect, new runners to hatch and unlock, a golden egg that earns a bonus pterodactyl flight, a daily run, and a race against a friend on the same keyboard.

**Folder slug:** `dinosaur-game-hd` (kept so links don't break; the game's name is **Dinosaur Game: Cool Edition**).

## 1. Summary
- **Pillars:**
  1. **It feels exactly like the original.** The jump, duck, speed curve, obstacle rules and hitboxes are the original's numbers. A player who knows it is at home in one second.
  2. **No bloat.** Everything new sits on top of the run, never inside it: no power-ups, no upgrades, no lives, no levels. Every runner is cosmetic. The one bonus round, the pterodactyl flight (3.8), plays **after** a run ends, never during it.
  3. **One more run, under a second away.** A crash shows the result over the frozen scene; R or Retry starts the next run at once, and Space does after the original's 1.2 s lock.
- **Player:** Coolmath players aged 10–24, on a school Chromebook with a keyboard or trackpad, or a tablet, sound often off. Almost all of them have played the no-internet dino.
- **Session:** One run lasts 20–90 s (a 1000 m run takes about 80 s). A typical visit is 10–20 runs, or a few 2P races: 10–15 minutes.
- **Hook:** "My best is 1,240, I can beat that." Then: "38 more eggs and the Parasaurolophus hatches", "I grabbed the golden egg, bonus flight!", "the Hadrosaur unlocks at 1000 m", the daily run's streak, and the friend next to you who just won.

## 2. Core loop
- **Moment (seconds):** see the obstacle → jump (tap or hold) or duck → grab the eggs on the riskier path, or play it safe.
- **Run (a minute):** sleeping dino → any key → run as the speed rises and day turns to night → one hit ends it → distance and eggs count up → Space, and you are running again. If the golden egg was grabbed, the results offer a 20 s **bonus flight** first (3.8).
- **Meta (days):** eggs hatch 3 dinosaurs → achievements unlock 6 more dinosaurs and the Hangman beast → daily run streak → 2P races with a friend.

## 3. Mechanics

All tuning numbers are the original game's values (Chromium `components/neterror/resources/dino_game/`, the "T-Rex runner"), in its own units: **logical pixels** and **per frame at 60 fps**. They were **checked against the Chromium source on 2026-10-30**, and the jump heights and airtimes below come from a frame-by-frame simulation of its rules. The slice still compares them with `chrome://dino` side by side (see 12). We copy numbers and rules only, never code or art.

### 3.1 Space and scale
- **Logical resolution 640×360**, drawn crisp (`imageSmoothingEnabled = false`) and scaled up to the window: ×2 at 1280×720, ×3 at 1920×1080, letterboxed. The original's playfield is 600×150 logical px, so ours shows a little more ahead (640 vs 600) and has room above for sky and parallax.
- **1P:** the ground line is at **y = 250**, with a sand layer below it (dunes and pebbles scrolling at full speed). The dino stands at x = 50 (like the original's `START_X_POS`). The 250 px of sky above is the stage for day and night: big mesas and clouds fill it, the sun and moon move across it, and the HUD sits in its top band. The look-ahead stays 640 px, so the feel doesn't change.
- **2P:** two lanes of 640×180. Each lane's ground line is 150 px below its top, the same height as the original's whole playfield, so the jump fits exactly.

### 3.2 Simulation
- **Fixed step at 60 Hz** with an accumulator (frame `dt` capped at 0.05 s). Since the original's numbers are per frame at 60 fps, one step = one original frame, so the numbers apply unchanged and the game plays the same at 60 Hz and 144 Hz.
- Deterministic: obstacles and eggs come from seeded PRNGs (mulberry32), in **separate streams** derived from the run seed: one for obstacles, one for eggs (including the golden egg), and one for the bonus flight. A change to egg logic can never change the obstacles of a daily seed or a 2P lane, and nothing the player does ever consumes a random number. The same seed and the same inputs give the same run (daily run, 2P lanes, replays in tests).

### 3.3 Speed and distance
- **Start speed:** 6 px/frame (360 px/s). **Acceleration:** +0.001 px/frame every frame from the first frame of the run, including the 3 s clear time. **Cap:** 13 px/frame (780 px/s), reached after **7,000 frames: about 117 s / 1,660 m**.
- **Whole-pixel scrolling:** obstacles and the ground move `floor(speed)` px per frame (so 6 px per frame until the speed reaches 7, and so on), as in the original. Distance uses the exact speed.
- **Distance:** 1 m = 40 px travelled (the original's score coefficient of 0.025, shown as `round(ceil(px) × 0.025)`), so our metres equal the original's points. The score starts at 9 m/s and reaches 19.5 m/s at the cap.
- **Reference times:** 100 m ≈ 10 s, 500 m ≈ 46 s, 1000 m ≈ 80 s, 2000 m ≈ 135 s, 3000 m ≈ 185 s.
- **Clear time:** no obstacles for the first **3 s** of a run.
- **Milestones:** every 100 m the score flashes 4 times and a beep plays (as in the original).

### 3.4 The runner (jump, duck, fast-fall)
- **Size:** 44×47 px standing, 59×25 ducking (the original's T-Rex footprint). Every runner is drawn inside this footprint.
- **Jump:** only from the ground and not while ducking. The start velocity is **10 + speed/10** px/frame upwards; **gravity 0.6** px/frame². Each frame the height moves by the velocity **rounded to a whole pixel**, then gravity is added.
  - **Minimum height:** once the runner is more than **30 px** up, releasing the button cuts the upward velocity to **5 px/frame** (if it is faster). A release before 30 px does nothing, so a very short tap (under about 50 ms) gives a full jump, exactly like the original.
  - **Maximum height:** at more than **63 px** up the velocity is cut to 5 px/frame anyway, held or not.
  - **Result at 60 Hz (simulated from the source rules):** the shortest jump (released at 67 ms) peaks at **62 px**, airtime **0.47 s**; a held jump peaks at **87–91 px**, airtime **0.55–0.58 s** (slightly different at each speed because of the rounding). Releases between 67 and 133 ms give everything in between (70, 78, 85 px).
  - **Holding the jump key** makes the runner jump again as soon as it lands: the original gets this from keyboard auto-repeat. We repeat the jump on landing while a jump key is held. Touch and mouse don't repeat, as in the original.
- **Duck (drawn as a belly slide):** hold down on the ground. The runner drops onto its belly and slides, with the original's duck hitbox, for as long as down is held, exactly like the original's duck: same input, same timing, no time limit. A jump can't start while sliding. Sand puffs up when the slide starts (a bigger burst when a jump or fast-fall lands into it) and trails behind it. Players see "slide"; code and analytics keep the name `duck`. The slide pose is long and flat, so it can't fill the top of the original's 55×25 duck box (an exception to the hitbox template below). That never causes an unseen hit: a mid pterodactyl's boxes stop above it, and a low pterodactyl or a cactus that touches the box also touches the body. The jump frame is the second exception: its back slopes from the neck to the tail tip, so the original's back box reaches up to about 11 px past the outline at the top-left. Pao chose to keep the original's box (rare: only a jump into a high pterodactyl that has almost passed can touch that corner). The standing frames (run, crash, sleep) draw their tail like the slide's, slim and pointed up and back, with the tip 8 px past the back of the 44×47 footprint. That is drawing only: the hitbox doesn't change, and the rump still covers the original's tail boxes to within 2 px.
- **Fast-fall:** down in the air sets the vertical velocity to 1 px/frame downward, and while down is held each frame's movement is the velocity × **3** (the original's speed-drop coefficient); gravity keeps adding to the velocity. **Releasing down ends the fast-fall** and the jump continues normally. On landing, the runner ducks if down is still held.
- **No input buffer and no coyote time**, as in the original. A jump pressed in the air is ignored.
- **Hitboxes:** the original's T-Rex collision boxes (6 boxes standing, 1 box ducking: 55×25 at (1, 18)), checked only when the outer boxes overlap. The outer box is the runner's **standing** 44×47 box shrunk by 1 px on each side, **also while ducking**, and the obstacle's box shrunk the same way. **Only the nearest obstacle** is checked each frame. The same boxes are used for every runner, so **every sprite is drawn over a hitbox template**: each frame's outline must cover every box to within 2 px, so no runner can die without visibly touching something. A debug key (**H**, removed in release builds) draws the boxes over the runner and the obstacles.
- **Animation rates:** run cycle 12 fps, duck cycle 8 fps, pterodactyl flap 6 fps (the original's). Our 4-frame run cycle keeps 12 fps per frame step.
- **Crash:** the runner shows its crash frame (dizzy face), the scene freezes, and a short shake and thud play.

### 3.5 Obstacles
All sizes and rules are the original's. Each obstacle type uses its original collision boxes.

| Obstacle | Size (px) | Height | Groups | From |
|---|---|---|---|---|
| Small cactus | 17×35 each | on the ground | 1–3 in a row once speed > 4 (from the start) | 3 s |
| Large cactus | 25×50 each | on the ground | 1 at first; 1–3 once speed > 7 | 3 s; groups from about 160 m |
| Pterodactyl | 46×40, 2-frame flap | low (jump), mid (duck or jump), high (run under, don't jump) | single | speed ≥ 8.5: about **450 m** |

- **Choice:** each new obstacle picks one of the 3 types at random (equal odds). If the type is not allowed yet (pterodactyl below speed 8.5) or would be the 3rd of its type in a row, it picks again. The group size is 1–3 at random, cut to 1 below the type's group speed (4 small, 7 large). Groups of 2–3 widen the middle collision box to fill the group.
- **Gap:** after each obstacle, the next one comes after a random whole-pixel gap between `minGap = round(groupWidth × speed + obstacleMinGap × 0.6)` and `round(1.5 × minGap)` (obstacleMinGap 120 for cacti, 150 for pterodactyls), using the speed when the obstacle spawned. The next obstacle spawns just off the right edge once the last one's right end plus its gap is inside the view. This is what keeps every gap clearable at the current speed.
- **No more than 2** obstacles of the same type in a row.
- **Pterodactyl heights** (bottom of the sprite above the ground): low **0 px**, mid **25 px** (a standing runner hits it, a ducking runner passes), high **50 px** (a standing runner passes under; a jump hits it), equal odds. Each flies at the scroll speed **±0.8** px/frame, picked at random, also moved in whole pixels (`floor(speed ± 0.8)`).
- **Teaching order (the only change from the original):** the first obstacle of every run is a **single small cactus**, and the first pterodactyl of every run flies at **mid** height, where both ducking and jumping work. After that it's random.

### 3.6 Day and night
- Night begins every **700 m** and lasts **12 s**, then fades back to day (as in the original). The nights start at 700, 1400, 2100, 2800 m…
- Instead of inverting the colors, the sky fades over 1 s from day to a deep blue night with stars and a moon. Every sprite keeps its dark outline; at night obstacles and eggs also get a 1 px light rim, so nothing gets harder to read.

### 3.7 Eggs
- **What:** small cream eggs with orange speckles (10×13 px), wobbling gently with a glint. Picking one up gives +1 egg; the pickup box is **16×16 px** around the egg, bigger than the egg, so a near miss still counts.
- **Eggs never block or change the run.** All eggs from a run are banked when it ends, crash or not. Nothing is lost.
- **Placement:** each new obstacle may get an egg pattern **over or under it** (**50% chance**, never after two obstacles in a row), chosen at random from the patterns unlocked at the current distance that fit that obstacle. Like Jetpack Joyride's coins, the bigger patterns are dense bunches and blocks that look generous and are fun to sweep through. **The move that collects the eggs is always the move that clears the obstacle** (a held jump, a duck, or staying on the ground), so eggs never lead into a crash and never change the obstacles. Pterodactyl eggs move with their pterodactyl. Eggs that start inside the view fade in.
- **Nothing goes in the gaps.** The original spawns the next obstacle as soon as the last one leaves the view, so a real gap is never longer than about 660 px whatever the generator's gap says; an extra jump for eggs between two obstacles lands on the next one (found in the slice: a nest in a gap killed Pao on a pterodactyl right after it).

| Pattern | Eggs | Where | Asks you to | From |
|---|---|---|---|---|
| Jump arc | 5 | along the full-jump arc over a small cactus | hold the jump (a tap gets the lower 2–3) | 30 m |
| Grid | 3 rows × 4–6, 12 px apart | a block on the held jump's apex over a group of 2–3 cacti | hold the jump to sweep the whole block | 200 m |
| Big arc | 5 | above a large cactus group, top egg near the ~89 px apex | a perfectly timed full jump | 300 m |
| Pterodactyl arc | 5 | along the full-jump arc over a low or mid pterodactyl | jump over it | first pterodactyl (~450 m) |
| Duck line | 6, 12 px apart | at duck height, centered under a mid pterodactyl (a mid one gets this or an arc) | duck rather than jump | first pterodactyl |
| Head line | 6, 12 px apart | at head height, centered under a high pterodactyl | stay on the ground: jumping hits it | first pterodactyl |
| Nest | 17 in a tight egg-shaped bunch | on the held jump's apex over a cactus, at most once per 500 m | one well-timed held jump through the middle | 500 m |

- **Every pterodactyl height gets eggs that reward its answer:** an arc over a low one (jump), a duck line or an arc for a mid one (duck or jump), a head line under a high one (stay down). The flat ground line was cut in the slice: eggs that ask nothing were boring.
- **Arcs follow the real jump.** A held jump lasts about 0.58 s (34–35 frames), so it covers about 210 px at the start speed and 440 px at the cap. Arc, grid and nest eggs are placed along the **simulated jump curve at the speed when the pattern spawns**, centered on the jump that clears the obstacle by the widest margin. `tools/egg-test.mjs` replays every pattern over 300 seeds and checks that its move (held jump, duck or stay down) collects every egg without touching the obstacle.

- Eggs are generated from the same seed as the obstacles, so the daily run and both 2P lanes have the same eggs.
- **Target:** a typical 400 m run collects **20–50 eggs**, a great run about 150 (grids and nests raise the rate). Slice measurement (`tools/egg-test.mjs`, 300 seeds): at 25% only 24 eggs were placed in the first 400 m, so the chance went to 50%. With the ground line cut, arcs from 30 m, and grids and nests over obstacles: 60 placed on average (40–80), all of them on the moves that clear obstacles, so a typical run's count depends on jumping well. If playtesters die chasing eggs in the first 30 s, the patterns there get easier.
- **Egg streak:** eggs picked up less than 0.6 s apart raise the pickup sound's pitch one step each, up to 8 steps.

#### Golden egg
- **What:** a gold egg with a sparkle (12×15 px), the ticket to the bonus flight (3.8). Worth no eggs by itself.
- **When:** at most **one per run**. The egg stream picks a distance between **500 and 900 m**; the first gap after it that is long enough gets the golden egg. So every run that passes 900 m sees one.
- **Where:** alone, at the **apex of a held jump** (about 87 px up) in an empty gap, so it takes a full jump to get. Missed is missed: it doesn't come back in that run.
- **Grabbing it** never changes the run: a chime, a sparkle, and a gold egg icon appears next to the HUD egg count. The run carries on as normal.
- **Modes:** endless and daily (same seed, so everyone's daily has the same golden egg). **Not in 2P races**, so a race stays a pure race.

### 3.8 Bonus flight (pterodactyl, Jetpack Joyride style)
A 20-second bonus round after the run, earned with the golden egg. It is the only "level" in the game, and it plays outside the run, so the run itself stays exactly like the original.

- **Start:** after a run with the golden egg, the results panel shows a big **Fly!** button (Space) next to **Retry**. Fly starts the flight at once. **Retry skips it** and banks it: up to **3 flights** can be banked, and a **Fly** button on the title and results shows how many are waiting. Nothing is ever lost.
- **The mount:** the equipped runner rides a pterodactyl. All runners use the same mount and the same hitbox (the pterodactyl's body plus the rider, 56×40 px).
- **Controls, Joyride-style:** hold (Space, Up, W, mouse or touch anywhere) to flap up; release to glide down. Values at 60 Hz: **gravity 0.45** px/frame², **flap 0.9** px/frame² upward while held (net 0.45 up), vertical speed capped at **±7** px/frame. The play area is the full 640×360 frame: the ceiling is y = 40 (below the HUD), the floor is the ground at y = 300; touching either is safe, the mount skims along it.
- **Scroll:** a fixed **8 px/frame** (480 px/s), no ramp. The flight lasts **20 s** (about 9,600 px). Distance in the flight does **not** count for the score, the best or any distance achievement.
- **Hazards** (each with its own shape, not color alone):
  - **Thunderclouds:** a cloud with a lightning bar hanging under it (static, like Joyride's zappers): vertical 60–140 px, horizontal 100–160 px, or diagonal. They scroll with the world.
  - **Wild pterodactyls:** fly straight left at 14 px/frame at your current height, like Joyride's missiles. A flashing **!** at the right edge warns **1 s** before one arrives, at the height it will fly.
- **Eggs:** Joyride's coin shapes, built from eggs: lines, sine waves, blocks (5×8), staircases and arrows, placed between hazards. A full flight holds **about 120 eggs**; a good flight gets 60–90.
- **Difficulty:** the first **3 s** are hazard-free eggs only; hazard density rises over the 20 s, from one hazard every ~1.5 s to one every ~0.7 s. The gap rules guarantee a path: a hazard never closes more than 60% of the height, and two hazards are never closer than the time needed to cross the free height at full flap.
- **A hit ends the flight:** the rider tumbles off and the pterodactyl flaps away (no crash shake). **Every egg grabbed so far is kept.**
- **End:** after 20 s (or a hit), "+N eggs" counts up over the sky, then back to the results, with the egg total and hatch progress updated. Space retries the run.
- **First flight:** a "Hold to fly up" icon for the first 3 s.
- **Seed:** the flight has its own PRNG stream derived from the run seed, so the daily run's flight is the same for everyone and replays are deterministic.
- **Achievements:** flight eggs count for everything eggs count for (hatching). Nothing else in the flight counts.

## 4. Controls

### 1 player
| Action | Mouse / touch | Keyboard |
|---|---|---|
| Jump (hold for higher) | press anywhere in the top ⅔ of the play area | Space, Up, W |
| Duck / fast-fall | press and hold in the bottom ⅓ | Down, S |
| Pause | pause button (top right, 48 px) | P, Esc |
| Restart | Retry button on the results | R, or Space on the results |

**Bonus flight:** hold Space, Up, W, the mouse button or anywhere on the screen to flap up; release to glide down. P or Esc pauses.

During a player's **first run only**, faint jump (up arrow) and duck (down arrow) icons show in the two touch zones and fade out after the first jump or after 5 s. Before the first pterodactyl, the duck icon shows again for 2 s.

A 64 px square around the pause button is not part of the jump zone: pressing pause never jumps.

### 2 players
| Action | Touch | Keyboard |
|---|---|---|
| P1 jump | press the left half, above the bottom-left corner | W |
| P1 duck | press and hold the bottom-left corner (bottom ⅓ of the left half) | S |
| P2 jump | press the right half, above the bottom-right corner | Up |
| P2 duck | press and hold the bottom-right corner | Down |
| Pause | pause button (top centre) | P, Esc |

**Space does nothing during a race**, so neither player gets an extra key; it still presses Race! and Rematch.

The lanes are stacked (P1 top, P2 bottom) but the touch zones are split left and right, so each half shows a faint "P1" or "P2" label with jump and duck arrows for the first 3 s of each race. Every pointer is tracked separately (Pointer Events), so both players can press at once.

## 5. Game elements
| Element | Behavior | First appears | Shape/icon (not color alone) |
|---|---|---|---|
| Runner | runs by itself, jumps, ducks, fast-falls | title | each runner's own silhouette |
| Small cactus | static, 1–3 in a row | 3 s | thin column with arms |
| Large cactus | static, 1–3 in a row | 3 s | thick column with arms, taller |
| Pterodactyl | flies at 3 heights, flapping | ~450 m | wide flapping wings, beak |
| Egg | +1 egg when touched | 30 m | oval with speckles and a glint |
| Golden egg | earns a bonus flight; at most one per run | 500–900 m | bigger egg with a sparkle and no speckles |
| Thundercloud (flight) | static lightning bar; a hit ends the flight | bonus flight | dark cloud with a zigzag bar |
| Wild pterodactyl (flight) | flies straight at you after a 1 s warning | bonus flight | flashing **!** at the edge, then a pterodactyl |
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
| 30 m | | egg arcs over cacti can appear |
| 100 m | 10 s | first milestone flash |
| ~160 m | 17 s | groups of large cacti |
| 300 m | | big arcs |
| ~450 m | 42 s | first pterodactyl (mid); pterodactyl arcs, duck and head lines |
| 500–900 m | | the golden egg (once per run) |
| 700 m | 60 s | first night |
| 1000 m | 80 s | the Hadrosaur's achievement |
| ~1660 m | 117 s | top speed |
| 3000 m | 185 s | the Therizinosaurus's achievement |

- **Stars:** none. The run's score is its distance; the results show the best distance and a "NEW BEST" banner.
- **Seed format:** a 32-bit integer. 1P endless picks a random seed per run; the daily run's seed comes from the local date (`YYYYMMDD`); a 2P race picks one seed for both lanes.

## 7. Progression and retention

### 7.1 Runners
11 runners: 10 dinosaurs and the Hangman beast. All are cosmetic: same jump, same speed, same hitbox. Each is drawn inside the 44×47 / 59×25 footprint, over the hitbox template (3.4). Every dinosaur is a two-legged runner, so it fits the T-Rex's silhouette; four-legged dinosaurs (Triceratops, Stegosaurus) are out because they can't.
- **Dinosaurs: 8 frames** (4 run, 1 jump, 2 slide, 1 crash; a crash while sliding reuses a slide frame with dizzy eyes). They share one two-legged run cycle, redrawn per species.
- **Hangman beast: 5 frames** (2 run, 1 jump, 1 slide, 1 crash). It bounces instead of running.

| Runner | Unlock | How it moves |
|---|---|---|
| **T-Rex** | free | big head, tiny arms, the classic |
| **Velociraptor** | hatch for **300 eggs** | small and quick, long stiff tail, sickle claw; feathered, rust brown; ducks low and flat |
| **Pachycephalosaurus** | hatch for **750 eggs** | ducks with its dome forward |
| **Parasaurolophus** | hatch for **1500 eggs** | long tube crest swept back, teal; ducks with the crest flat along its back |
| **Hadrosaur** | reach **1000 m** in one run | flat duck bill, no crest, olive and cream; ducks with its bill forward |
| **Ceratosaurus** | play the daily run **7 days in a row** | nose horn and a bumpy back, red-orange stripes |
| **Megalosaurus** | run **50 km** in total | the first dinosaur ever named: a plain, heavy theropod, brown with a cream belly |
| **Therizinosaurus** | reach **3000 m** in one run | pot belly, long neck, giant scythe claws that swing on the run; fluffy, pale gold |
| **Hangman beast** | see **10 nights** in total (each run past 700, 1400… m adds its nights) | black fur ball with horns; light rim so it shows at night |
| **Allosaurus** | win **10 two-player races** | horn crests over the eyes, purple-gray; the **2P-only bonus** |
| **Spinosaurus** | unlock every other runner **except Allosaurus** | tall back sail, long croc snout, deep blue with an orange sail; the completionist prize |

- **Hatching:** spending eggs plays a short scene: the egg wobbles, cracks in 3 steps, and the dinosaur pops out with a jingle. The hatched runner is equipped right away.
- **Allosaurus and 2P:** any race that ends with a winner counts (P1 or P2 wins, not a draw), since both players share one save. A solo player can farm it by playing both lanes alone; that's accepted, it's a bonus. Spinosaurus doesn't need Allosaurus, so a solo player can finish the collection.
- **Achievement runners** unlock when the condition is met. They are announced on the results screen, not during the run.
- **Fitting the footprint:** the Spinosaurus's sail and the Parasaurolophus's crest stay inside the 47 px height (a smaller head and body under them); the Therizinosaurus's claws stay inside the front of the box. Every slide pose lays the body flat on its belly and flattens the sail, crest or claws, so each one passes under a mid pterodactyl like the T-Rex.
- **Telling them apart:** several are big two-legged meat-eaters, so each one gets one clear head feature (Ceratosaurus nose horn, Allosaurus eye crests, Megalosaurus plain heavy head and dark stripe) and its own main color. The Hadrosaur and the Parasaurolophus differ by the crest.
- **Reference for the redraw:** `reference/hangman-beast.png`.

### 7.2 Daily run
- One seed per day from the local date, the same obstacles and eggs for everyone.
- Unlimited tries; the day's **best** distance counts. Eggs earned in the daily run count as normal.
- **Streak:** +1 for each calendar day with at least one daily run; a missed day resets it to 0.
- **Daily #:** days since launch (launch date set at release).
- **Emoji result line** (copy button on the daily results): `🦖 Daily #12 — 1,840 m 🥚32 🔥5` (distance, eggs from the best run, streak).

### 7.3 What brings players back
Best distance, the golden egg and its bonus flight (a reason to take the full jump), the next egg hatch (the results show "Parasaurolophus: 1,230 / 1,500 🥚"), the next achievement (the Runners screen shows each one's progress), the daily streak, and 2P rematches.

## 8. Screens and UI flow
```
Title ──Play / Space──▶ Playing ──crash──▶ Results ──Retry / Space / R──▶ Playing
  │                        │                  ├──Fly! (golden egg)──▶ Bonus flight ──end or hit──▶ Results
  │                        │                  ├──Runners──▶ Runners
  │                        └─P─▶ Paused       └──Menu──▶ Title
  ├──2 Players──▶ Race setup ──Race!──▶ 3-2-1 ──▶ Racing ──first crash──▶ Race results ──Rematch──▶ 3-2-1
  ├──Daily──▶ Playing (daily seed) ──crash──▶ Daily results (+ copy emoji line)
  ├──Runners──▶ Runners (hatch / equip)
  ├──Fly (banked flights)──▶ Bonus flight ──▶ Title
  └──Settings (sound, music)
```
- **Title:** the desert with the equipped runner asleep ("Zz"), the logo "DINOSAUR GAME" with a "COOL EDITION" banner, the buttons **Play** (big), **2 Players**, **Daily** (with the streak 🔥), **Runners**, **Fly** (only when flights are banked, with the count), and sound and music toggles. Pressing Space, Up or W starts a 1P run, and that first press is also the run's first jump, like the original.
- **Playing (HUD):** in the sky band. Top center, the original's score style: `HI 01240  00321`. Top left, an egg icon with this run's count. Top right corner, the pause button (alone, so it never covers the score).
- **Bonus flight (HUD):** a 20 s bar at the top center instead of the score, the egg count top left, pause top right.
- **Paused:** dimmed scene, **Resume**, **Restart**, **Menu**. The game also pauses when the tab is hidden.
- **Results (1P and daily):** the panel slides up over the frozen scene **500 ms** after the crash. Space, Up and W can't restart for **1.2 s** after the crash (the original's lock against accidental restarts) and restart on key release, as in the original; R, Enter and the Retry button work at once. Distance and eggs count up, best distance, "NEW BEST" if it is one, any runner unlocked in this run (sprite and name), the next hatch's progress bar. Buttons: **Retry** (big) / **Runners** / **Menu**. Space (after the lock), R or Enter retries; the new run starts in under 1 s. **After a run with the golden egg**, **Fly!** becomes the big button and takes Space; R and Retry still start a run at once and bank the flight.
- **Race setup (2P):** both lanes with their runners. P1 changes runner with A/D, P2 with Left/Right; on touch, arrows beside each runner. P1 starts with the equipped runner, P2 with the last runner P2 used (or the T-Rex with a "P2" badge). One big **Race!** button: two clicks from the title.
- **Racing:** a 3-2-1 countdown (1.5 s), then both lanes run from the same seed at the same speed. **The first crash ends the race:** the crashed runner stays in its lane as a ghost (faded, X eyes) and the lane freezes; the winner keeps running for a 1.5 s victory lap. Both crashing in the same step is a **Draw**.
- **Race results:** "P1 WINS" (or P2, or DRAW) with a crown on the winner, the winner's distance, both players' eggs (they go to the shared bank), and a running tally ("P1 2 – 1 P2") kept until you return to the menu. **Rematch** (big) / **Runners** / **Menu**. No best-of-3.
- **Runners:** a 6×2 grid of the 11 runners (one slot empty). Unlocked ones show their sprite; a selected runner runs on a treadmill strip at the top. Locked egg dinosaurs show as an egg with a progress bar ("Velociraptor 180 / 300 🥚") and a **Hatch** button when there are enough eggs; locked achievement runners show as a silhouette with their condition and progress ("Reach 1000 m: best 640"). Click an unlocked runner to equip it. The total egg bank is shown top right.

## 9. Art direction
- **Family:** HD Pixel (new): a 16-bit SNES look, chunky sprites with dark outlines.
- **Palette:**

| Color | Hex | Role |
|---|---|---|
| Night Ink | `#1B2340` | outlines, night sky, UI text |
| Desert Sand | `#F2C879` | ground and dunes by day |
| Sunset Orange | `#F08A24` | sky band, egg speckles, highlights, buttons |
| Cactus Green | `#3FA34D` | cacti |
| Dino Slate | `#5A6B7D` | the T-Rex (a nod to the original's gray), UI panels |
| Egg Cream | `#FFF6E0` | eggs, light rims at night, text on dark |

  The T-Rex is slate, not green, so it never blends with the cacti. Each dinosaur has its own main color (7.1), none of them Cactus Green; the Hangman beast keeps its colors from Hangman. All use the same Night Ink outline.
- **Key visuals:**
  - **Runners:** about 44×47 logical px each, 1 px Night Ink outline, 3–5 colors each. The crash frame has dizzy eyes. Final art is a PNG sprite sheet in `assets/` (about 100 KB) drawn in a pixel editor; until then, the prototype uses best-effort placeholder sprites drawn in code.
  - **Obstacles:** cacti with strong silhouettes and arms; a pterodactyl with a big wing flap.
  - **Bonus flight:** a bigger pterodactyl mount (about 56×32 px) with the equipped runner's jump frame on its back; the golden egg in gold (`#F5C542`) with a white sparkle; thunderclouds in Night Ink with a cream zigzag bar; the same desert sky, seen higher up (more sky, the mesas low).
  - **Background:** 3 parallax layers (dunes at 0.2×, mesas at 0.1×, clouds at 0.05× the scroll speed), each pre-rendered once to an offscreen canvas. A warm sunset band by day; stars and a moon at night.
  - **UI:** a pixel bitmap font drawn in code (no web fonts), slate panels with a Night Ink border, orange buttons.
- **Juice list:**
  - run cycle dust puffs (one at each footfall); a puff from the feet on takeoff and on landing; landing squash (2 frames) and jump stretch;
  - jump frame: legs stretched long with the toes pointing down, the tail drooping to a point;
  - slide: a sand burst on entry (bigger when landing into it) and a dust trail while it lasts;
  - egg pickup: a pop, "+1" floating up, the egg icon in the HUD bumps;
  - 100 m: the score flashes 4 times;
  - crash: a 150 ms screen shake (4 px), dizzy stars over the runner;
  - results: count-up numbers, the "NEW BEST" banner bounces in;
  - hatching: wobble, 3 cracks, shell pieces fly, the dinosaur pops out;
  - achievement unlock: the runner's sprite bounces in with sparkles;
  - 2P win: a crown drops onto the winner, confetti in their lane;
  - night: a 1 s sky fade, stars twinkling in;
  - golden egg: a sparkle burst and a gold icon popping in next to the HUD egg count;
  - bonus flight: wing flap on every press, wind streaks, egg trails pop as you sweep them, "+N eggs" counts up at the end.
- **Concept art prompts:**
  - **Gameplay screenshot (16:9):** *"16-bit pixel art side-scrolling runner, a cute slate-gray pixel dinosaur with a big head and tiny arms jumping over a green cactus in a desert, an arc of small cream eggs with orange speckles above the cactus, a pterodactyl flying ahead, parallax sand dunes and mesas, warm orange sunset sky, dark outlines, crisp SNES-style pixel art, 16:9 game screenshot"*
  - **Key art / thumbnail (16:9 and 1:1, no text):** *"a cute slate-gray pixel art dinosaur mid-jump over a cactus, speckled eggs flying around it, a second dinosaur and a cracked eggshell below, desert at sunset turning to night with stars, crisp 16-bit SNES-style pixel art, dark outlines, saturated colors, room for a title, game key art"*
  - **Character sheet:** *"pixel art dinosaur sprite sheet: run cycle, jump, duck, crash with dizzy eyes; plus a velociraptor, a pachycephalosaurus and a parasaurolophus in the same poses, all two-legged and the same size, each hatching from a speckled egg, 16-bit SNES style, dark outlines, consistent size, plain light background, evenly spaced"*
  - **Logo:** *"the words "DINOSAUR GAME" in chunky pixel letters with a small "COOL EDITION" banner, a pixel dinosaur head peeking over the letters next to a cracked speckled egg, 16-bit pixel art, plain background, bold and readable at small size"*
  - **Negative prompt:** *"text, letters, watermark, signature, photorealistic, gritty, horror, violence, blood, Google logo, Chrome logo, coins, cluttered background, blurry, low contrast, UI buttons"*

## 10. Audio
| Sound | When | Character |
|---|---|---|
| Jump | jump starts | short square-wave "boop" rising |
| Duck | slide or fast-fall starts | soft noise swoosh |
| Slide | while sliding | quiet looping sandy scrape |
| Egg | egg picked up | bright "pip", one step higher per egg in a streak (up to 8) |
| Milestone | every 100 m | the original-style two-tone beep |
| Crash | runner hits an obstacle | low thud plus a short wobble |
| Night | night begins | soft low chime |
| Hatch | each crack, then the reveal | 3 clicks, then a 4-note jingle |
| Achievement | runner unlocked (results) | rising 5-note fanfare |
| Golden egg | golden egg picked up | bright 3-note chime with a shimmer |
| Flap | each flap press in the bonus flight | soft "whup" |
| Warning | wild pterodactyl warning in the flight | 2 short high blips |
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
| `eggs:progress:<0-20\|20-40\|40-60\|60-80\|80-100\|done>` | run starts | % of the way to the next hatch |
| `runner:hatch:<id>` | an egg runner is hatched | eggs spent |
| `runner:equip:<id>` | a runner is equipped | — |
| `achievement:<id>` | a runner is unlocked by achievement | — |
| `bonus:golden-egg` | golden egg picked up | distance (m) |
| `bonus:start` | a bonus flight starts | flights still banked |
| `bonus:end:<hit\|complete>` | a bonus flight ends | eggs in the flight |
| `bonus:bank` | Retry skips an earned flight | flights banked |
| `versus:start` | race starts | — |
| `versus:winner:<p1\|p2\|draw>` | race ends | — |
| `daily:start` | daily run starts | — |
| `daily:complete` | first daily run of the day ends | distance (m) |
| `daily:streak:<n>` | the streak goes up | n |
| `ui:restart` | Retry, Space or R after a run | — |
| `settings:music:off` / `settings:sfx:off` | a toggle is switched off | — |

**Questions the data must answer:**
1. Do players play more runs per session when they are within 20% of the next hatch than when they aren't? (`eggs:progress` on each run start; a true A/B test of eggs vs no eggs is for later.)
2. How often is 2P played, and are 2P sessions longer?
3. Where do players die (`run:death` by type and distance)? Do eggs cause early deaths?
4. How many runs reach the golden egg, and how many grab it? Do players who get a flight play more runs afterwards, or do they skip it (`bonus:bank`)?

## 12. Tech plan
- **Stack:** static HTML5, ES modules, Canvas 2D, no engine, no build step.
- **Modules (`src/`):** `main.js` (loop, screens), `sim.js` (runner physics, obstacles, eggs, collisions: no drawing), `gen.js` (seeded PRNG and obstacle/egg generator), `flight.js` (bonus flight physics, hazards and egg shapes: no drawing), `render.js` (scene, parallax, HUD), `sprites.js` (loads the sprite sheet and slices it into frames; in the prototype, placeholder sprites drawn in code), `input.js` (keys and pointers, 1P and 2P zones), `ui.js` (title, results, runners, race setup), `font.js` (the pixel bitmap font), `audio.js`, `save.js`, `analytics.js`.
- **Rendering:** draw the 640×360 scene straight onto the display canvas through a scale transform, with smoothing off, and draw each frame between the last two sim steps (render interpolation) snapped to device pixels, so 144 Hz screens don't judder. Use the **largest integer scale that fills at least 85%** of the window; when no integer scale does, use the exact fit. The rest of the window shows more sky and sand (no black bars); obstacles are clipped to the 640 px view. `devicePixelRatio` capped at 2. Background layers are pre-rendered once, with a night-tinted copy of each faded in at night.
- **Simulation:** fixed 60 Hz step, deterministic (3.2). The sim runs headless, so a test can replay a seed and a list of inputs.
- **Save:** one key, `cm_dinosaur-game-hd_save`:
  `{ v: 1, best, eggs, flights, totalEggs, totalDistance, totalNights, versusWins, unlocked: [ids], equipped, p2Runner, daily: { lastDate, streak, best, bestEggs }, firstRunDone, tutorial: { jump, duck, done }, settings: { sfx, music } }` (`tutorial` remembers which `tutorial:*` events were sent), read inside `try/catch` (a broken save resets to defaults). Saved after every run, hatch, equip and settings change.
- **Testing hook:** `window.game`, matching STANDARDS: `screen` (`'title' | 'playing' | 'complete'` as in STANDARDS, plus `'runners' | 'setup' | 'paused' | 'bonus'`; `'complete'` is the results screen), `level` (the mode name), `score` (distance), plus `mode` (`'endless' | 'daily' | 'versus'`) and `eggs`. Helpers `start()`, `restart()`, `crash()` and `win()` (an alias of `crash()`, so shared checks work), debug only, removed in release builds.
- **Riskiest piece: matching the original's feel.** Prove it first: build `sim.js` with the original's numbers, then compare jump apex, airtime, the gap range at 3 speeds and the time to top speed against `chrome://dino` (frame-by-frame screen recordings), and log the measured values in `DEVLOG.md`. Only then add art and eggs.
- **Second risk: runner art.** 10 dinosaurs × 8 frames plus the Hangman beast × 5 frames is 85 sprites, plus eggs, hatching, obstacles and backgrounds. The shared run cycle keeps that manageable. Prototype with placeholders; draw the Spinosaurus and the Parasaurolophus early as rough sprites over the hitbox template to check that the sail and the crest fit at 44×47, and put the 4 big theropods side by side to check that they read as different dinosaurs.
- **Third risk: the bonus flight's fairness.** Every flight must have a path through. `flight.js` runs headless, so a test flies 1,000 seeds with a simple bot and checks that each one can be finished.

## 13. Scope
- **v1:** 1P endless, 2P race (keyboard and touch), daily run, eggs, the golden egg and its 20 s bonus pterodactyl flight, 11 runners (10 dinosaurs at 8 frames, the Hangman beast at 5 frames), day and night, one desert scene.
- **Later (only if data says so):** more scenes (jungle, volcano, ice) every 1000 m; a ghost of your best run; color variants of each dinosaur as an egg sink once all 3 are hatched; more flight hazards or a longer flight.
- **Cut:**
  - power-ups, upgrades, lives, missions, loot boxes: they break the "feels like the original" pillar;
  - a bonus flight in the middle of a run: it plays after the run, so the run never changes;
  - golden eggs in 2P races: a race stays a pure race;
  - a 2P speed ramp after the cap: 2P matches 1P exactly;
  - best-of-3 matches: single races with a rematch tally are faster;
  - a separate achievements screen: the Runners screen is the list;
  - input buffering and coyote time: the original has none.

## 14. Open questions
| Question | Recommendation | Who decides | Status |
|---|---|---|---|
| Are the recalled original numbers (3.3–3.5) exact? | Checked against the Chromium source on 2026-10-30 and corrected (jump heights, minimum-height rule, fast-fall, whole-pixel scrolling, restart lock). Still compare with `chrome://dino` side by side in the slice. | Pao | Closed |
| Is "Dinosaur Game" in the name OK to publish? | It's the generic name players use; keep "Chrome", "Google" and "T-Rex Runner" out. Ask the team before any public build. | Team | Open |
| Egg rate and prices (300 / 750 / 1500) | Keep; check that a typical run gives 15–40 eggs in the slice, retune in phase 4. | Pao | Open |
| Achievement targets | Keep; check against real run data in phase 4. | Pao | Open |
| Coolmath ad breaks | Only between runs, and never more often than every few minutes; never on Retry. | Coolmath | Open |
| Daily seed: local date or UTC? | Local date: simpler for players, small differences around midnight don't matter. | Pao | Open |
| Mouse and trackpad players rarely duck (they must move to the bottom third), so duck-line eggs mostly reward keyboard and touch players. OK? | Accept: the original never forces a duck (a mid pterodactyl can be jumped). Check in playtest. | Playtest | Open |
| Bonus flight egg rate (~120 in a flight, 60–90 for a good one) | Keep; a flight should feel like a jackpot next to a 20–50 egg run, but not make hatching trivial. Retune with the hatch prices in phase 4. | Pao | Open |
| Golden egg window (500–900 m) | Keep; most new players die before 500 m, so the flight is a goal to reach. If data shows few players ever see it, move it earlier. | Pao | Open |
| Does 2P on a tablet work with four hands? | Build it; if testers can't use it, show "Needs a keyboard" on touch. | Playtest | Open |

## 15. Changelog
- 2026-10-30 — Standing tail drawn like the slide's, its tip 8 px past the footprint (3.4); hitbox unchanged.
- 2026-10-30 — Jump frame hitbox: the original's box is kept although the sloped back leaves its top-left corner empty (3.4), Pao's call.
- 2026-10-30 — Juice (9): footfall dust, takeoff and landing puffs, a jump frame with long legs and a drooping tail (Pao).
- 2026-10-30 — Slide pose slimmed (the belly looked huge); the duck box exception noted in 3.4.
- 2026-10-30 — The duck is drawn as a belly slide with dust (3.4, 7.1, 9, 10), Pao's idea from the feel loop. Hitbox, input and timing are the original's duck, unchanged.
- 2026-10-30 — Eggs (3.7): duck and head lines grow from 3 to 6 eggs (3 felt unsatisfying in play).
- 2026-10-30 — Eggs (3.7): grids and nests moved from the gaps onto the jump that clears a cactus; nothing goes in the gaps, since a real gap is at most ~660 px and an extra jump there could land on the next obstacle.
- 2026-10-30 — Eggs (3.7) after Pao's play test: the flat ground line is cut (boring); jump arcs unlock at 30 m; new pterodactyl patterns: an arc over low and mid ones, a head line under high ones, the duck line stays for mid ones.
- 2026-10-30 — Eggs (3.7): pattern chance raised from 25% to 50% after measuring the slice; fit rules for each pattern spelled out.
- 2026-10-30 — Rendering (12): drawn straight to the display canvas with render interpolation; the exact fit is used when no integer scale fills 85% of the window. Save gains `tutorial` flags.
- 2026-10-30 — Physics checked against the Chromium source (3.3–3.5): the jump peaks at 62 px (shortest) to 87–91 px (held), not 51 / 84; a release before 30 px gives a full jump; holding the jump key re-jumps on landing; fast-fall ends when down is released; positions round to whole pixels and obstacles scroll `floor(speed)` px per frame; the outer hitbox stays standing-size while ducking and only the nearest obstacle is checked; obstacle type choice and group rules spelled out. Egg grid, big arc and golden egg heights follow the new apex. Space restart is locked for 1.2 s after a crash (the original's value), R, Enter and Retry work at once.
- 2026-10-30 — Approved by Fafi.
- 2026-10-30 — Roster changed: the Tag characters are out, and the Triceratops and Stegosaurus are out (four legs don't fit the T-Rex silhouette). 11 runners: the T-Rex; Velociraptor, Pachycephalosaurus and Parasaurolophus hatched with eggs (300 / 750 / 1500); Hadrosaur (1000 m), Ceratosaurus (7-day daily streak), Megalosaurus (50 km), Therizinosaurus (3000 m), the Hangman beast (10 nights), Allosaurus (10 2P wins, the 2P-only bonus) and Spinosaurus (completionist) by achievement. The "1000 eggs in total" achievement is dropped. Every dinosaur now has 8 frames.
- 2026-10-29 — Bonus pterodactyl flight added (3.7 golden egg, 3.8 flight): a Jetpack Joyride-style 20 s flight after the run, earned with a golden egg grabbed between 500 and 900 m; hold to flap up, release to glide; thunderclouds and wild pterodactyls; a hit ends it but eggs are kept; up to 3 flights banked. Not in 2P. Pillar 2 reworded; controls, screens, art, audio, analytics, tech and scope updated.
- 2026-10-29 — Phase 1c review applied: a hitbox template and an H debug view for every runner; 8 frames for the classic dinosaurs, 5 for the crossover characters, a PNG sprite sheet later and placeholders in the prototype; Hangman beast now unlocks at 10 nights in total; 1P ground moved up to y = 250 with a fuller sky; integer scaling with a filled border; Joyride-style egg grids and nests, and egg arcs placed on the simulated jump; analytics question 1 reworded with `eggs:progress`; `window.game` matches STANDARDS; HUD and pause layout; first-run icons; Space idle in 2P; separate RNG streams for eggs and obstacles. Not applied: a minimum race length for Alien (solo farming is accepted).
- 2026-10-29 — First draft from the brief and the phase 1a answers: HD Pixel in Canvas 2D; the original's numbers; name **Dinosaur Game: Cool Edition**; **eggs** instead of coins, with hatching; 7 Tag characters with their real names (Squatch, Griffin, Unicorn, Kraken, Pixie, Alien, Dragon) plus the Hangman beast; Alien is the 2P-only bonus and Dragon needs every runner except Alien; Hangman beast at the 4th night; 2P speed matches 1P; no best-of-3; touch 2P with left/right halves; the first crash ends a race.
