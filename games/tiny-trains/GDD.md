# Tiny Trains — Game design document

**Status:** Draft
**Owner:** Pao · **Reviewed by:** — · **Last updated:** 2026-10-19

> Flip the track switches so every colored train reaches its own station, then press Go and watch your plan run like a toy train set.

## 1. Summary
- **Pillars:**
  1. **Calm planning.** Time is frozen while you think. Nothing in the planning phase rushes the player.
  2. **Readable at a glance.** Every route can be traced with a finger. No hidden rules and no surprises that the board does not show.
  3. **The run is a show.** Pressing Go pays off with motion, sound and either a happy arrival or a comic crash.
- **Player:** Coolmath players aged 10–24, mostly on a school Chromebook with a trackpad, often with the sound off, in short breaks.
- **Session:** One level takes 1–3 minutes (1–4 runs of 7–15 s each, plus planning). A typical visit is the daily puzzle plus 3–6 levels, so 10–15 minutes.
- **Hook:** A crash shows you exactly what went wrong, so the fix feels one flip away. The golden ticket and the par star bring you back to a solved level.

## 2. Core loop
- **Moment (seconds):** Trace a train's path → flip a switch → see the route light up.
- **Level (minutes):** Plan → Go → trains run → arrive (win) or crash (see why, rewind, adjust) → stars.
- **Meta (days):** Daily puzzle and streak → stars unlock liveries → new world and new element.

## 3. Mechanics

### 3.1 Board and grid
- The board is a grid of square cells. Each cell holds at most one track tile.
- The design resolution is 1280×720. The HUD bar takes the top 80 px, so the board area is 1200×600 px, centered.
- **Cell size:** the board is scaled to fit its area, with a cell size between 72 and 112 px. The largest board is 12×7 cells (12 × 80 = 960, 7 × 80 = 560). The smallest is 5×3.
- At 800×450 a 72 px cell becomes 45 px, but a switch's tap target is 1.2 × the cell (54 px), so the target stays above 48 px.

### 3.2 Simulation (deterministic ticks)
- The run is a fixed-step simulation. In one **tick**, every moving train advances exactly one cell.
- **Tick duration:** 450 ms at 1×, 225 ms at 2× (fast-forward). The renderer interpolates positions between ticks with an ease-in-out curve. The sim itself uses only integers.
- Moves are computed for all trains at the same time. Then collisions are checked. Ties are resolved in train-id order, so a given setup always gives the same result.
- **Tick limit:** a run ends as "lost" after `tickLimit` ticks (the level sets it; the default is the solver's solution length + 12, capped at 120). This catches trains that loop forever.

### 3.3 Trains
- A train takes one cell. It is drawn as an engine with a small coal tender inside that cell. Carriages are cut (see 13).
- Each train has a **color**, a **shape symbol** and a **departure tick**. Shapes: red = circle, blue = square, yellow = triangle, green = diamond.
- A train waits in its **depot** until its departure tick. A waiting train does not take up a board cell. On its departure tick it enters the depot's exit cell.
- The departure tick is shown on the depot as a small clock badge with pips (one pip = one tick: 0, 2, 4 …). The level sets departure ticks. The player cannot change them.
- Each level has 1–4 trains.

### 3.4 Track tiles
| Tile | Connects | Notes |
|---|---|---|
| Straight | 2 opposite edges | 2 rotations |
| Curve | 2 adjacent edges | 4 rotations |
| Switch | Trunk edge + 2 branch edges (one straight, one curved) | 4 rotations × left/right mirror |
| Flat crossing | N–S and E–W | Trains on both lines can collide |
| Bridge | N–S over, E–W under | Trains on different levels never collide |
| Buffer stop | 1 edge, dead end | A train entering it derails |
| Station | 1 edge, terminal | Accepts only its own color |
| Depot | 1 edge, start | Holds one or more trains of any color |
| Tunnel portal | 1 edge + a linked portal | See 3.8 |

### 3.5 Switches
- A switch has two settings: **straight** or **curved**. Its starting setting comes from the level data.
- **Facing move** (the train enters from the trunk): the train takes the set branch.
- **Trailing move** (the train enters from a branch): the train always goes to the trunk, whatever the setting. The switch is sprung, so it never causes a crash. This keeps crashes readable: the only way a switch "goes wrong" is the branch it is set to.
- **Switches are locked during the run.** Each switch has one setting per run. This is the heart of the puzzle: two trains that face the same switch both go the same way, so the player must find routes that share switches without conflict.
- In planning, clicking a switch flips it with a 120 ms snap animation. The route from that switch is shown as a soft highlight in the color of the next train to reach it, if any.
- **Flip count** = the number of switches whose setting at Go differs from the level's starting setting (net changes). Flipping back and forth while experimenting costs nothing.

### 3.6 Flip switches (timed)
- A flip switch works like a switch, but its setting toggles **after any train leaves it** (facing or trailing).
- It has a circular-arrow icon and a small two-state indicator that shows the current setting.
- One flip switch can send two trains in different directions. This is the World 2 twist on 3.5.
- In planning, the player sets its starting state like any switch. The planning highlight shows the first train's path only.

### 3.7 Signals
- A signal sits on a straight cell. It starts red. A train that reaches a red signal cell stops there and waits.
- During the run, the player clicks or taps the signal (or presses Tab to select it and Enter) to turn it green. The release takes effect on the next tick. A green signal stays green for the rest of the run.
- A waiting train takes up its cell, so another train can hit it.
- **Design rule:** every signal level must have a release window of at least 3 ticks (1.35 s at 1×) in which the release works. The solver checks this. Signals test timing judgment, not reflexes.
- Fast-forward is turned off while any train waits at a red signal.

### 3.8 Tunnels
- Two linked portals form a tunnel with a length of L ticks (2–6), shown as dots on both portal arches.
- A train that enters portal A disappears and comes out of portal B L ticks later, with the same color and heading.
- Trains inside a tunnel never collide. They come out in the order they went in. If the exit cell is occupied when a train comes out, it is a normal collision.
- Tunnels hide trains, so the player must count. The dots make the count visible.

### 3.9 Stations and arrival
- A train that enters a station of its own color arrives. It plays its ding, sinks into the platform over 300 ms and leaves the board.
- A station can accept more than one train of its color (World 1, level 10 onward).
- **The level is solved** when every train has arrived.

### 3.10 Crashes and failure
| Cause id | Rule |
|---|---|
| `collision` | Two trains end a tick in the same cell (not counting bridge levels or tunnel interiors) |
| `swap` | Two trains swap cells head-on in one tick |
| `derail` | The next cell has no track that connects to the train's heading, is off the board, or is a buffer stop |
| `wrong_station` | A train enters a station of a different color |
| `lost` | The tick limit is reached before every train arrives |

- **On a crash:** the sim stops. All trains freeze. The crash cell gets a comic puff (cloud particles, stars) and a 150 ms shake of 6 px. The cause shows as an icon and two words ("Head-on crash!", "Wrong station!", "Off the rails!", "Lost in a loop!") next to the cell.
- After 1.2 s (or a tap to skip), the trains rewind to their depots in 400 ms. The game goes back to planning with the switches as they were. Signals reset to red.

### 3.11 Golden ticket
- Some levels have a golden ticket on one track cell (a gold star-shaped token, so it does not read as yellow).
- The first train that passes through that cell during a run collects it. It shows only if that run solves the level.
- Every level from 1-4 onward has a ticket. Levels 1-1 to 1-3 have none, so the tutorial stays simple.

### 3.12 Stars (best result kept per level)
- ★ **Home:** solve the level.
- ★ **Ticket:** solve it in a run that collects the golden ticket. In levels without a ticket (1-1 to 1-3), this star comes with the solve.
- ★ **Par:** solve it with flip count ≤ par.
- All three stars count from one winning run, so a perfect run is always possible. **Par** = the solver's minimum flip count over all solutions that also collect the ticket.
- **Perfect run** (solved on the first Go of a visit) is not a star. It is a badge on the results screen and a mark in the daily emoji line.

### 3.13 Hints
- The hint button appears after 2 failed runs on a level.
- A hint sets one switch to its solution setting and locks it with a small padlock and a pulse. It takes the wrong switch that the earliest train reaches. The game uses the solver solution closest to the player's current setup.
- Using a hint on a level means that run cannot earn the par star. A hint never gives away more than one switch.
- No hints in the daily puzzle.

## 4. Controls
| Action | Mouse / touch | Keyboard |
|---|---|---|
| Flip switch (planning) | Click / tap the switch | Tab / Shift+Tab to select, Enter to flip |
| Go | Go button | Space |
| Stop run, back to planning | Stop button (Go turns into Stop) | Space or R |
| Fast-forward 2× | ⏩ button during the run | F |
| Release signal (run) | Click / tap the signal | Tab to select, Enter to release |
| Reset switches to start | Reset button (planning) | R |
| Hint | 💡 button (after 2 fails) | H |
| Pause | Pause button | P or Esc |
| Skip crash replay | Tap anywhere | Any key |

The selected switch or signal gets a thick ink ring. Nothing depends on hover or right-click.

## 5. Game elements
| Element | Behavior | First appears | Shape/icon (not color alone) |
|---|---|---|---|
| Train | Moves 1 cell/tick from its depot at its departure tick | 1-1 | Shape on the engine's roof: ● ■ ▲ ◆ |
| Station | Accepts its own color only | 1-1 | Matching roof color + the same shape on the roof sign |
| Depot | Starts trains; clock badge shows departure ticks | 1-1 | Shed with a clock and pips |
| Switch | Facing: set branch; trailing: always trunk; locked during run | 1-1 | Lever with an arrow on the active branch |
| Buffer stop | Dead end, derails | 1-1 | Striped bumper |
| Second train | Two routes share the board | 1-3 | — |
| Golden ticket | Collected by the first train through it | 1-4 | Gold star token with a shine |
| Departure delays | Trains leave at different ticks | 1-5 | Clock pips |
| Loop | A wrong setting can send a train around forever (`lost`) | 1-9 | — |
| Shared station | Two trains of one color, one station | 1-10 | — |
| Flat crossing | Both lines meet; timing matters | 2-1 | X with a crossing sign |
| Flip switch | Toggles after each train | 2-5 | Circular-arrow icon + state dot |
| Bridge | Crossing without collisions | 3-1 | Arched bridge, under-track shaded |
| Signal | Train waits at red until clicked | 3-4 | Post with a lamp: red ✕ / green ✓ |
| Tunnel | Train hidden for L ticks, exits at the twin portal | 4-1 | Stone arch with L dots; twin portals share a number |
| Fourth train | 4 colors on one board | 4-5 | ◆ green |

## 6. Level design
- **Structure:** 50 levels in 4 worlds.
  - **World 1 — Village (12 levels):** switches, facing vs trailing, 1→3 trains, departure delays, the ticket, loops. Boards from 5×3 up to 9×5.
  - **World 2 — Farm (13 levels):** flat crossings (timing conflicts), then flip switches (one switch, two routes). Boards up to 10×6.
  - **World 3 — City (13 levels):** bridges (contrast with flat crossings), then signals (live timing). Boards up to 12×7.
  - **World 4 — Mountain (12 levels):** tunnels (hidden timing), 4 trains, all elements combined. Boards up to 12×7.
- **Teaching order** for each element: a safe intro level where the new element is the whole puzzle → a twist where it creates a trap → two or three levels that combine it with earlier elements.
- **Difficulty drivers:** number of switches (1 → 9), trains (1 → 4), shared track segments, crossings, decoy branches that look right, tight timing, and how few solutions exist. Par runs from 1 (World 1) to 6 (World 4).
- **Curve:** each world starts easier than the previous world's end. A world's last two levels are its hardest. No more than one new element per 4 levels.
- **First 10 levels:**
  1. **First Switch** (5×3): one red train, one switch, the station on one branch and a buffer stop on the other; the switch starts wrong. Par 1. Tutorial: a hand points at the switch, then at Go.
  2. **Two Turns** (6×3): one train, two switches in a row; only one of the four combos reaches the station. Par 2.
  3. **Two Colors** (6×4): red and blue on parallel lines, one switch each; red's wrong branch leads into blue's station. Par 2.
  4. **Merge** (7×4): two trains from separate depots join on one line through a trailing switch, then the line splits; first ticket. Par 1.
  5. **Wait Your Turn** (7×4): blue leaves at tick 0, red at tick 3 on the same line; the short branch makes them collide, the long one does not. Par 2.
  6. **Scenic Route** (7×5): the ticket sits on a longer branch that is only safe if the other train takes the short one. Par 2.
  7. **Three's Company** (8×5): first 3-train level, 3 switches, two of which are shared. Par 2.
  8. **Both Ways** (8×5): one switch is facing for red and trailing for blue; its setting must suit red without blocking blue. Par 2.
  9. **Round and Round** (8×5): a loop siding; one wrong setting sends a train around forever and teaches `lost`. Par 2.
  10. **Twin Reds** (9×5): two red trains and a blue; both reds share one station, so their timing must not clash. Par 3.
- **Level data format** (`levels/world01.json` holds an array of these):

```json
{
  "id": "world01:level04",
  "name": "Merge",
  "w": 7, "h": 4,
  "tiles": [
    { "x": 0, "y": 1, "t": "depot", "rot": 1 },
    { "x": 1, "y": 1, "t": "straight", "rot": 1 },
    { "x": 3, "y": 1, "t": "switch", "rot": 1, "mirror": false, "set": 0 },
    { "x": 5, "y": 2, "t": "flip", "rot": 0, "mirror": true, "set": 1 },
    { "x": 6, "y": 1, "t": "station", "rot": 3, "color": "red" },
    { "x": 4, "y": 3, "t": "signal", "rot": 1 },
    { "x": 2, "y": 0, "t": "tunnel", "rot": 0, "link": 1, "len": 3 }
  ],
  "trains": [
    { "id": 0, "color": "red",  "depot": [0, 1], "depart": 0 },
    { "id": 1, "color": "blue", "depot": [0, 3], "depart": 2 }
  ],
  "ticket": [4, 1],
  "tickLimit": 40,
  "par": 1,
  "solution": { "switches": { "3,1": 1 }, "signals": {} }
}
```
`rot` is 0–3 in 90° steps clockwise from north. `set` 0 = straight, 1 = curved. The solver writes `par`, `tickLimit` and `solution`, so nobody types them by hand.

## 7. Progression and retention
- **Unlocks:** levels open in order. The two levels after your furthest solved level are always open, so a stuck player can skip ahead (`ui:skip`). A world opens when you can reach its first level this way. There are no star gates, so stars never block progress.
- **Daily puzzle:**
  - It unlocks after level 1-6.
  - **Pool:** 366 levels pre-made by the debug generator, each verified by the solver, stored in `levels/daily.json`. Day index = days since 2026-01-01 (local date) mod 366, so everyone gets the same puzzle each day.
  - **Elements:** switches, flip switches, flat crossings and the ticket, with 2–3 trains on boards up to 10×6. No signals, since they need live timing.
  - **Streak:** consecutive local days solved. Missing a day resets it to 0.
  - **Emoji result line** (Copy button, clipboard only, no link):
    ```
    Tiny Trains Daily #293 🚂
    💥💥✅ ⭐⭐⭐
    Streak 5 🔥
    ```
    One mark per run: 💥 crash, ✅ solve.
- **Liveries (Garage screen):** 8 cosmetic patterns painted on the train body: Classic, Stripes, Polka Dots, Checker, Stars, Candy, Steam (tall chimney), Gold Trim. A livery never changes a train's color or shape symbol.
  - Classic is free. Stripes, Polka Dots, Checker, Stars and Candy unlock at 20, 45, 75, 105 and 135 stars (150 max). Steam unlocks at a 7-day daily streak. Gold Trim unlocks when all 50 levels are solved.

## 8. Screens and UI flow
`Title → (Levels | Daily | Garage | Settings) → Playing ⇄ Pause → Complete → Next / Retry / Menu`

- **Title:** logo with a little train looping across it, big **Play** (goes straight to the next unsolved level), **Levels**, **Daily** (with the streak flame), **Garage**, settings cog (music, sound).
- **Level select:** 4 world tabs with their scenery; a grid of 12–13 round buttons with stars; the next level bounces; locked levels show a padlock. A star counter shows the next livery goal.
- **Playing HUD (top bar, 80 px):** Pause · level name ("1-4 Merge") · flips counter ("Flips 1 · Par 1") · ticket slot (empty or gold) · Reset · Hint (after 2 fails). The big **Go** button sits at the bottom right (it turns into Stop during the run), with the ⏩ button next to it during the run.
- **Pause:** Resume, Restart, Levels, sound toggles.
- **Level complete:** 3 star slots fill one by one (each with a ding and a burst). "Flips 2 · Par 2" counts up. A "Perfect run!" badge shows when it applies. Best result. Next / Retry / Menu.
- **Daily complete:** stars, runs, the emoji line preview, **Copy**, streak flame with the count-up.

## 9. Art direction
- **Family:** Toybox Flat.
- **Palette** (6 base colors; tints and shades of these only):
  | Hex | Role |
  |---|---|
  | `#FFF3DC` | Cream: background, UI panels |
  | `#2E2440` | Ink: outlines (4 px at 80 px cells), text, shadows at 25% opacity |
  | `#E8483B` | Red train and station, crash puff accent |
  | `#3B7DD8` | Blue train and station, City tint |
  | `#F5C327` | Yellow train and station; darkened to `#C98B4F` for wooden rails and sleepers; Farm tint |
  | `#4DB35E` | Green train and station, grass and trees (Village tint) |
  The golden ticket uses yellow plus a white shine and a star shape, so it reads as different from the yellow train.
- **Key visuals:** chunky wooden rails on a rounded board with grass edges; trains as rounded wooden engines with a shape symbol on the roof; stations as small houses with colored roofs; switches with a big lever knob; the scenery per world (cottages, barns and hay, city blocks, pines and snow) stays at the edges and never covers the track.
- **Juice list:**
  - Switch flip: 120 ms snap with overshoot, lever wiggle, small dust puff.
  - Go: trains squash then stretch as they leave; a puff of steam from each chimney.
  - Running: engines bob 2 px at each tick; steam puffs every 2 ticks.
  - Ticket collected: the token spins up into the HUD slot with sparkles.
  - Arrival: the station roof bounces; confetti in the train's color; the train sinks into the platform.
  - Crash: comic puff, cartoon stars, 6 px shake for 150 ms, trains tilt.
  - Rewind: trains slide back with motion trails.
  - Level complete: stars stamp in with squash, count-up numbers, a train-whistle burst of confetti.
  - UI: buttons press down 4 px; panels slide in with ease-out.
- **Concept art prompts** (updated from the brief to match this GDD):
  - **Gameplay screenshot (16:9):** *"Flat cartoon toy train set puzzle, chunky wooden rails on a rounded grass board grid, track switches with big lever knobs, small rounded wooden trains in red, blue and yellow each with a white shape symbol on the roof (circle, square, triangle), little stations with matching colored roofs and the same shape symbols, a gold star ticket on the track, cottages and trees at the edges, warm cream background, thick dark purple outlines, soft shadows, top-down 2D game screenshot, 16:9"*
  - **Key art / thumbnail (16:9 and 1:1, no text):** *"a cheerful wooden toy train set seen from above, red, blue, yellow and green rounded toy trains with shape symbols on their roofs running along curving wooden tracks through switches with lever knobs towards little stations with matching colored roofs, a gold star ticket on the track, tiny village, farm and pine trees around, flat vector cartoon style, bright flat colors, thick dark purple outlines, soft drop shadows, warm cream background, toy-like and clean, highly readable shapes, centered composition with room for a title, game key art"*
  - **Character and element sheet:** *"game pieces on a plain background: rounded wooden toy engines in red, blue, yellow and green each with a white circle, square, triangle or diamond on the roof, the same engines with stripes, polka dots and gold trim patterns, straight, curved, switch, flat crossing and bridge track tiles, buffer stop, train depot shed with a clock, stations with matching roofs and shape signs, signal post with red and green lamps, stone tunnel arch with dots, gold star ticket, flat vector cartoon style, bright flat colors, thick dark purple outlines, soft drop shadows, warm cream background, toy-like and clean, highly readable shapes, game asset sheet on a plain light background, evenly spaced, consistent scale"*
  - **Logo:** *"the words "TINY TRAINS" in rounded wooden toy letters in red, blue, yellow and green, a small red toy engine with a white circle on its roof running along the top of the letters on a wooden track, flat vector cartoon style, bright flat colors, thick dark purple outlines, soft drop shadows, warm cream background, toy-like and clean, highly readable shapes, game logo on a plain background, bold and readable at small size"*
  - **Negative prompt:** *"text, letters, watermark, signature, photorealistic, gritty, horror, violence, weapons, blood, fire, explosion, cluttered background, blurry, low contrast, extra limbs, UI buttons"*

## 10. Audio
All sounds are synthesized with WebAudio and stay under 400 ms unless noted.

| Sound | When | Character |
|---|---|---|
| Switch click | Flip a switch | Wooden clack, pitch up for curved, down for straight |
| Choo-choo | Go | Two soft whistle toots, 600 ms |
| Chug | Every tick per moving train (max 2 voices) | Soft low tick, quiet |
| Ticket | Ticket collected | Bright sparkle arpeggio |
| Arrival ding | Each train arrives | Bell; pitch rises with each arrival in the run |
| Signal | Signal turns green | Short beep-boop |
| Crash puff | Crash | Comic "poof" plus a boing, 500 ms |
| Rewind | Back to planning | Quick reverse whoosh |
| Star | Each star on results | Rising chime, one step higher per star |
| UI tap | Buttons | Soft pop |

Music: an optional calm ukulele/xylophone-style loop of 30 s, synthesized, off by default.

## 11. GameAnalytics
| Event id | When it fires | Value |
|---|---|---|
| Progression `Start:world01:level04` | Every Go press (each run is an attempt) | — |
| Progression `Fail:world01:level04` | Run ends in a crash | — |
| Progression `Complete:world01:level04` | Run solves the level | Stars (1–3) |
| `level:runs` | On solve | Runs this visit |
| `level:crash:<cause>` | On crash (`collision`, `swap`, `derail`, `wrong_station`, `lost`) | Tick of the crash |
| `level:abandon:world01:level04` | Leaving an unsolved level after ≥ 1 run | Runs |
| `level:perfect` | Solved on the first run | — |
| `tutorial:step01` | Level 1-1 starts (hand on the switch) | — |
| `tutorial:step02` | First switch flipped | — |
| `tutorial:step03` | First Go pressed | — |
| `tutorial:done` | Level 1-3 solved | — |
| `ui:hint` | Hint used | Fails before the hint |
| `ui:restart` | Reset button or R in planning | — |
| `ui:skip` | Starting a level past the next unsolved one | — |
| `ui:fastforward` | ⏩ turned on | — |
| `daily:start` | First Go of the daily | Day index |
| `daily:complete` | Daily solved | Runs |
| `daily:streak:<n>` | Streak count after a daily solve | — |
| `daily:share` | Copy button | — |
| `livery:unlock:<name>` | Livery unlocked | — |
| `livery:equip:<name>` | Livery picked in the Garage | — |
| `settings:music:off`, `settings:sfx:off` | Toggled off | — |

**Question the data must answer:** how many runs a solve takes (`level:runs` per level) and which element makes players quit (`level:abandon` and crash causes per level, mapped to the element table in section 5).

## 12. Tech plan
- **Modules (`src/`):**
  - `main.js`: boot, loop (dt capped at 0.05), visibility pause.
  - `track.js`: tile types and edge-connection tables (pure data).
  - `sim.js`: the deterministic tick sim. It has no DOM and no randomness, and it is shared by the game and the solver.
  - `game.js`: states (planning, running, crashed, solved) and stars.
  - `render.js`: board, pre-rendered tile sprites on offscreen canvases, trains, particles.
  - `input.js`: Pointer Events and keyboard focus ring.
  - `ui.js`: the shell screens.
  - `levels.js`, `audio.js`, `save.js`, `analytics.js`, `daily.js`.
  - `debug/editor.js`, `debug/solver.js`, `debug/generator.js`: loaded only with `?debug`, removed from release.
- **Simulation:** integer cells and integer ticks; a pure `step(state) → state` function plus `run(level, setup) → { result, cause, tick, ticket }`. Setup = switch settings + signal release ticks. Rendering reads tick N and N+1 and interpolates.
- **Solver:** brute force over all switch setups (2^n, n ≤ 9 → 512) × signal release ticks (each signal tried at every tick up to `tickLimit`). It finds every solution, then par, the closest solution for hints, and the width of each signal window (must be ≥ 3). A full level checks in well under 1 s. A debug page re-runs the solver on every level and the daily pool and fails loudly on a mismatch.
- **Save:** key `cm_tiny-trains_save` = `{ v: 1, levels: { "world01:level04": { stars, ticket, bestFlips } }, daily: { lastDay, streak, best }, liveries: [...], livery, settings: { music, sfx } }`. Reads are wrapped in try/catch; a bad save resets to defaults.
- **Riskiest piece:** the track connection tables, plus switch facing/trailing logic in the sim. **De-risk:** build `track.js` and `sim.js` first in the slice with a console test that replays hand-written solutions for levels 1-1 to 1-3, before any art.

## 13. Scope
- **v1:** 50 levels in 4 worlds, every element in section 5, stars, hints, daily with streak and emoji line, 8 liveries, the full shell, debug editor, solver and daily generator.
- **Vertical slice (phase 2):** levels 1-1 to 1-3 (switches, buffer stops, 2 trains, 2 stations), planning and run, crash feedback with rewind, the full shell, saving, GameAnalytics stubs that log to the console.
- **Later:** free-build sandbox, more liveries, a "speed run" daily variant with signals.
- **Cut:**
  - Multi-cell trains with carriages: they make collisions and tunnels much harder to read and to solve.
  - Player-set departure times: too many free variables, and the puzzle becomes searching instead of reasoning.
  - Flipping switches during the run: it turns a calm puzzle into a reflex game. Signals are the one controlled exception.
  - Derailing on a wrong trailing move: realistic, but it produces crashes that players read as unfair.

## 14. Open questions
| Question | Recommendation | Who decides | Status |
|---|---|---|---|
| Is a 450 ms tick the right pace? | Start at 450 ms; tune in slice playtests between 350 and 550 ms | Pao after the slice | Open |
| Should a hint cost the par star? | Yes, it keeps par meaningful; revisit if `ui:hint` is high and stars are low | Team | Open |
| Should the daily include bridges or tunnels? | Not in v1; keep the daily mid-difficulty and quick | Team | Open |
| Do signals feel too real-time for the calm pillar? | Keep them with the 3-tick window and no fast-forward while waiting; cut to World 4 extras if playtests say so | Pao after World 3 playtest | Open |
| Coolmath SDK, ad breaks, size limit | Ads only between levels, after the results screen; aim for < 1 MB | Team, per `STANDARDS.md` [confirm] | Open |
| GameAnalytics keys | One key pair per game in `src/config.js` | Team [confirm] | Open |

## 15. Changelog
- 2026-10-19 — First draft from the brief, using the recommended answers to the phase 1a questions.
