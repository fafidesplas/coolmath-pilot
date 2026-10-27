# Shadow Shapes — Game design document

**Status:** Approved
**Owner:** Fafi · **Reviewed by:** Pao · **Last updated:** 2026-10-27

> Turn a strange clump of glowing blocks in the lamplight until its shadow fills the outline on the wall, then watch the shadow light up into a picture.

## 1. Summary
- **Pillars:**
  1. **The magic reveal.** A random-looking clump suddenly casts a perfect cat. Every solve ends with a snap, a swing of the camera and the shadow lighting up into a picture. Nothing may weaken that moment.
  2. **Always warmer or colder.** You always see what the shadow is doing wrong (where it spills, where it is missing) and how close you are (match %, rising notes). No blind searching.
  3. **Calm and in control.** No fail and no time limit. Every drag turns exactly one visible axis, the same three angles always give the same pose, and R takes you back. You can't get lost.
- **Player:** Coolmath players aged 10–24 at a school Chromebook with a trackpad, often with the sound off; a "brain game" played at the desk.
- **Session:** One level takes 20 s–2 min (target median about 45 s). A typical visit is the daily shadow plus 5–10 levels: 10–20 minutes.
- **Hook:** "What will it become?" and "93%… one more nudge." Filling the book with pictures, the time stars and the daily moon line bring players back.

## 2. Core loop
- **Moment (seconds):** Drag → the shadow changes live → the match % and the notes rise or fall → nudge.
- **Level (minutes):** Read the outline → turn and tip (later spin) → snap → the shadow lights up into the picture → stars for time → next.
- **Meta (days):** Fill the book room by room → each room adds a new way to rotate → daily shadow and streak.

## 3. Mechanics

### 3.1 Screen and scene
- Design resolution 1280×720. The HUD bar takes the top 72 px.
- **Object zone** (left): x 0–620, y 72–720. The object floats at (320, 410). A WebGL canvas covers exactly this rectangle.
- **Wall zone** (right): x 620–1280. The wall is a 600×600 rounded panel centered at (950, 400), seen face-on. The target fits a 440×440 area in its center (cells up to 56 px); a rotated shadow can reach further and is clipped to the panel. Two-light levels split it into two 600×290 panels (3.10).
- **Light:** a warm lamp at the bottom left of the object zone; its beam (a pre-rendered gradient) passes behind the object towards the wall. The shadow on the wall is the object's silhouette as seen along the light, the same layout as the brief's schematic (lamp, object, wall).
- **Camera:** **orthographic**, looking at the object from 20° to the left and 15° above the light axis, so the blocks read as 3D (lit faces, like an isometric view). Its zoom is set per level so the object's bounding sphere is 230 px in radius on screen (200 px in levels with the Spin wheel, 3.4). Orthographic on purpose: with perspective, back blocks would look about 13% smaller than front ones, and the front faces would not line up into the picture at the reveal (3.13).
- **Text:** never under 22 px at 1280×720 (14 CSS px in an 800×450 window).

### 3.2 The object
- A sculpture of unit blocks on a grid, made of **cubes** and **wedges** (half-cubes cut along a diagonal, extruded along the light axis, so seen from the front a wedge is a half-cell triangle).
- Size: up to 10×10 cells seen from the front, 3–5 cells deep (two-light levels: as deep as the side picture is wide, up to 8), 12–60 blocks.
- Each sculpture is **built from a picture**: a small pixel picture (its front view, 6 colors). Every picture cell gets one or more blocks in its column, at random depths, plus hidden blocks in the same columns that bridge neighbors, so the sculpture is one connected piece. From the front it is exactly the picture; from any other side it is a clump.
- Every block takes its column's picture color, so the front faces of the blocks form the colored picture (the reveal uses this, 3.13).
- The pivot is the center of the sculpture's bounding box.

### 3.3 Rotation: three dials
- The pose is three angles, each in (−180°, 180°]:
  - **Turn:** around the object's own up axis, like a turntable.
  - **Tip:** tilts that turntable towards or away from the wall (around the horizontal axis parallel to the wall).
  - **Spin:** around the light axis. The shadow rotates in place like a clock hand; its shape does not change.
- Orientation = Spin · Tip · Turn (Turn applied first). The pose depends only on the three angles, never on the order of the moves, so going back is always possible.
- Each level lists the dials it allows. The others stay at their start values.
- Edge case: at Tip ±90° the turntable faces the light and Turn spins the shadow in place. Start poses never sit there (6, authoring rules).

### 3.4 Dragging (mouse, trackpad, touch)
- **Drag anywhere to turn and tip:** the whole playfield (object zone and wall zone) is one drag surface in every level; only the HUD bar and the Spin wheel are not. A drag on the shadow works exactly like a drag on the object.
- After **8 CSS px** of movement the drag **locks to one axis** until release: the axis whose ring arrow (3.5) best matches the drag direction. With Spin at 0 this is simply horizontal = Turn, vertical = Tip.
- **Sensitivity:** 0.5° per CSS px along the locked direction (a 360 px swipe = 180°). Measured in CSS px, not canvas px, so the hand feel is the same at any window size.
- **The front of the object follows the pointer.** When the object is upside down (|Tip| > 90°) Turn's direction is flipped, so a drag to the right always moves the front to the right. Decided at the start of each drag.
- Rotation is 1:1 with the pointer: no smoothing, no inertia.
- Dragging along an axis the level does not allow: the object wobbles ±3° for 150 ms and a lock icon flashes where that ring would be.
- A second finger during a drag is ignored.
- **Spin wheel** (levels with Spin): a wheel 240×80 px centered under the object at (320, 668), with a notch every 15°, ⟲ and ⟳ arrows at its ends, and the current Spin marked on it. Drag sideways on the wheel to spin (0.5° per CSS px, the wheel turns with it); on release Spin settles on the nearest notch in 100 ms with a soft click. A tap on ⟲ or ⟳ steps 15° (each end has a hit area of at least 48 CSS px). Spin always rests on 15° notches, because a 3° spin error already drops the match by about 12% (measured). The wheel sits outside the drag surface, so it never steals a turn or tip, and it fits every layout (two parts, two lights).

### 3.5 Showing what a drag will do: rings
- Each allowed axis has a thin glowing ring around the object: **Turn** (mint, a horizontal band), **Tip** (peach, a vertical band), **Spin** (lilac, facing the camera; it lights up while the wheel turns).
- At the front of the Turn and Tip rings, an arrow pair shows the drag direction that drives it, with an icon (⟷, ↕). Rings follow the pose: the Turn ring tilts with Tip, all rings rotate with Spin.
- Idle: 30% opacity. Pointer down on the drag surface: the Turn and Tip rings at 60%. Locked: the active ring at 100% with chevrons sliding the way it turns; the others at 10%. A key press or a wheel move lights its ring for 300 ms.

### 3.6 Keyboard
- ←/→ (A/D) Turn, ↑/↓ (W/S) Tip, Q/E Spin: **15° per press**, eased over 120 ms.
- A press moves to the next multiple of 15° in that direction (37° → 45°), so keyboard poses are always on the 15° grid, where every solution is. Keyboard players can always land exactly.
- Holding repeats every 150 ms after 300 ms; browser auto-repeat is ignored. Keys are ignored during a drag.

### 3.7 Shadow and match
- **Shadow:** orthographic projection along the light axis. Computed by our own code, not Three.js shadow maps: the corners of each block are rotated and flattened, and the 2D convex hull of each block is its shadow polygon; the shadow is the union. The same pure module draws the shadow (vector polygons on the 2D canvas), computes the match, and runs in Node for the tests.
- **Mask:** 64×64 cells over a square of side 2R around the pivot (R = the sculpture's bounding sphere radius), so the shadow of any pose fits. A cell belongs to the shadow when its center is inside a polygon.
- **Target:** the shadow at the solution pose, rasterized the same way. It is exactly the picture.
- **Match value = IoU** = |shadow ∩ target| ÷ |shadow ∪ target|. IoU rather than "overlap %", so a thin edge-on shadow sitting inside the outline can never win: a shadow smaller than `match` × the target's area cannot reach `match`.
- **Threshold `match`, per level:** the level tool sets it to the lowest IoU found on a 6° circle (in Turn and Tip) around each solution, rounded down to 0.01, capped at 0.92. Typical values are 0.80–0.90. This gives every level a window of at least ±6° in every direction (±12 px of drag). If the value comes out under 0.75, the picture is too thin to read as a match and the tool rejects it (thicken it); it is never clamped up, which would shrink the window. Measured in phase 1: one fixed threshold of 0.90 gave windows from ±3.5° (a thin key) to ±11° (a round fish).
- **Snap trigger:** match ≥ threshold held for **150 ms**, or at the moment a drag is released, or when a key step lands. A fast swipe passing through the window does not count.
- **Snap:** input locks; the dials ease to the nearest solution (each the short way round) in 300 ms with a slight overshoot; the shadow fills the outline exactly.
- **Several correct poses are fine.** A mirror-symmetric picture also matches from behind (Turn 180°). The level tool finds every solution and stores it; the snap goes to the nearest.

### 3.8 Warmer or colder
- **Match %** (ring and number in the wall's top-left corner): 0% = a typical random pose (the level's median IoU, `base`), 100% = the snap threshold. Clamped to 0–100.
- **On the wall:** the part of the outline not yet covered glows faintly (cyan fill at 14%); the part of the shadow outside the outline is drawn with pink diagonal hatching ("spill"); the dashed outline marches faster above 80%.
- **Notes:** each time the % crosses a 10% step upwards, the next note of a rising pentatonic scale plays (10 notes from 0 to 100); downwards, a muted low tick. At most one note every 80 ms.
- **Honest signal:** the % measures the shadow, never the angle to the answer, so it is not a metal detector. Shape similarity mostly rises in the last 30° before a solution (measured), so far away the hatching and glow tell you what is wrong, and close in the % and the notes guide the last stretch.

### 3.9 Two-part puppets (Theater)
- Two sculptures hang on one rod, one above the other (or side by side). Each has its own pivot, start pose and part of the picture; together they make one scene. Stacked parts are drawn up to 125 px in radius at (320, 210) and (320, 485); side-by-side parts up to 140 px at (165, 390) and (475, 390). Each part has its own mask frame.
- **Select** a part by pressing on it, or with Tab (or 1 / 2). The selected part is bright and shows its rings; the other dims to 60%. A press on a part selects it and starts the drag at once; a drag that starts anywhere else moves the selected part. Keys and the Spin wheel act on the selected part. Badges **A** and **B** (56 px, hit areas at least 48 CSS px) sit at the left edge of the object zone, level with their parts; tapping a badge also selects its part.
- Each part has its own dashed outline and its own match (same rules as 3.7). When a part matches it snaps and **locks**: a clack, its outline turns solid, its badge shows a closed lock, and the selection jumps to the other part. A locked part can't move; pressing on it makes its badge wiggle.
- Both parts locked → the reveal.
- From level 24 the scene shows **one outline for both parts**: working out which part makes which piece becomes part of the puzzle. The match is still checked per part, so the selected part's % still tells you when it is in its own place (an intended clue).
- The match % shows the selected part, labeled "A" or "B".

### 3.10 Two lights (Observatory)
- A second, cool lamp (☾) shines from the left onto a side wall. The wall zone splits into two 600×290 panels: the top one (☀) is the usual wall; the bottom one (☾) shows the side silhouette as seen from the side lamp: up is still up, and the object's front is on the panel's right. Targets fit a 240×240 area per panel (cells up to 30 px).
- One object, two targets. Each panel has its own outline, hatching and match %. The level snaps when **both** panels are at threshold (same trigger as 3.7).
- The sculpture is built from two pictures with the same rows filled: a block can sit at (x, y, z) only where the front picture has (x, y) and the side picture has (z, y); blocks are then removed at random while both silhouettes stay complete. Side pictures use full cells only (no wedges).
- The reveal lights up both panels; the side panel's mosaic uses the side picture's own colors (the blocks carry the front picture's colors).

### 3.11 Hint
- A bulb button in the HUD charges for 20 s from the level start (a ring fills), then pulses once. Press it or H.
- A **ghost** of the object (of the selected part in the Theater; translucent cyan) replays the way from the current pose to the nearest solution **one dial at a time**: Spin, then Turn, then Tip, 600 ms each with that ring lit, then holds 500 ms and fades in 300 ms. The player can keep moving meanwhile.
- Unlimited. Using a hint caps that run at ★★.
- No hint button in levels 1–3, where the ghost hand teaches the moves.

### 3.12 Restart
- R or the restart button: the dials ease back to the start pose in 250 ms, the clock and the hint charge reset, and locked parts unlock.
- Exception, the daily: R resets the pose but not the clock (7).

### 3.13 The reveal
Sequence after the snap (a tap, click or Space skips straight to the results):
- **0 ms:** the snap (300 ms); the outline flashes solid white.
- **300 ms:** the camera swings to look straight down the light axis (500 ms). Because the camera is orthographic, the blocks' front faces line up exactly into the colored picture, whatever their depth. On the wall, the shadow fills with the same picture as a mosaic of glowing tiles, in a radial wipe from the center (500 ms). 40 sparkles run along the outline.
- **800 ms:** the picture plays its little animation (bob, wiggle or blink, 600 ms) and its name pops under it: "CAT!".
- **1600 ms:** the results panel slides in.

### 3.14 Stars and time
- The clock starts at the **first rotation** (a drag that locks, or a key step), not when the level opens. Looking is free.
- ★ solved · ★★ solved within 2 × par · ★★★ solved within par. A hint caps the run at ★★. Best stars and best time are kept.
- HUD: three stars. A ring around the third star drains over par, then a ring around the second drains over the next par; an emptied star dims to an outline, silently. No fail at any time.
- `par` is set per level in its data.

## 4. Controls
| Action | Mouse / touch | Keyboard |
|---|---|---|
| Turn | Drag sideways anywhere on the playfield | ← / → or A / D (15° steps) |
| Tip | Drag up or down anywhere on the playfield | ↑ / ↓ or W / S (15° steps) |
| Spin (from level 11) | Drag sideways on the Spin wheel, or tap its ⟲ / ⟳ ends | Q / E (15° steps) |
| Select a part (Theater) | Press on the part | Tab, or 1 / 2 |
| Hint | Bulb button | H |
| Restart | HUD button | R |
| Pause | HUD button | P or Esc |
| Skip the reveal | Click / tap | Space or Enter |
| Menus | Click / tap | Arrows, Enter / Space |

- Mouse and trackpad first, as in `STANDARDS.md`. Everything is a press-and-drag or a tap: no right-click, no double-click, no hover-only action.
- Arrows, Tab and Space call `preventDefault` so the page never scrolls or loses focus.
- HUD buttons are drawn at 56 px with hit areas of at least 48 CSS px at every window size.

## 5. Game elements
| Element | Behavior | First appears | Shape/icon (not color alone) |
|---|---|---|---|
| Sculpture | Rotates on its dials, casts the shadow (3.2–3.3) | 1 | Clump of rounded blocks with glowing edges |
| Wedge block | Half-cell triangle in the front view | 1 | Block with a slanted face |
| Turn ring | Horizontal drag turns it | 1 | Horizontal band with ⟷ arrows |
| Tip ring | Vertical drag tips it | 3 | Vertical band with ↕ arrows |
| Shadow | Live silhouette on the wall | 1 | Near-black shape |
| Target outline | The picture to match | 1 | Dashed glowing line; solid when matched |
| Gap glow / spill hatch | Missing part / part sticking out | 1 | Soft fill / diagonal stripes |
| Match % | 0–100, snap at 100 | 1 | Ring meter with a number |
| Hole in the picture | At least 2×2 cells; opens only when the pose is close, a precision cue | 7 | Empty cells inside the outline |
| Hint ghost | Replays the way to the answer | 4 | Translucent copy of the sculpture |
| Spin wheel and ring | Drag the wheel sideways or tap its ends to spin; the ring shows the axis | 11 | Notched wheel with ⟲ ⟳ ends under the object; ring facing the camera |
| Two-part puppet | Two parts, each locks when right | 21 | Two sculptures on one rod; A / B badges with lock icons |
| Side wall | Second shadow from a second lamp | 31 | Lower panel with a ☾ lamp icon; top panel has ☀ |

## 6. Level design
- **Structure:** 40 levels in 4 rooms of 10. Each room teaches one new way to rotate, then mixes it with the old ones.
  - **Room 1 — Attic (1–10):** Turn, then Tip, then both. Everyday things and pets. Shallow sculptures (3–4 deep).
  - **Room 2 — Museum (11–20):** **Spin**, the third axis (11), then all three dials. Exhibits: pictures with holes, mirror traps, deeper sculptures (up to 5 deep).
  - **Room 3 — Theater (21–30):** **two-part puppets** (21), parts with different dials (22), one outline for both parts (24), parts with Spin (26). Scenes with two characters.
  - **Room 4 — Observatory (31–40):** **two lights, two shadows** (31), then two lights with Spin (34), and the finale. Sky and night things.
- **Teaching order:** each new idea gets a level where it is the only thing to do, then a level that combines it with an older idea, then harder mixes. Each room starts easier than the end of the previous room. The first two-dial levels (4–5) start within 60° on Tip, so the warm zone is found quickly.
- **Difficulty knobs:** number of dials to set (1 → 2 → 3), angle from the start to the nearest solution (60° → 180°), sculpture depth and block count (harder to read the 3D shape), fewer solutions (asymmetric pictures), holes and thin parts (smaller windows), near-miss poses (mirror or upside-down looks, kept clearly below the threshold), two parts, two lights.
- **Stars:** see 3.14. `par` starts from room defaults (Attic 15–40 s, Museum 20–50 s, Theater 35–60 s, Observatory 40–75 s) and is tuned in phase 4 from playtests and `level:time`.
- **First 10 levels (Attic):** start poses are (Turn, Tip, Spin); every solution is (0, 0, 0) unless noted.
  1. **Little House** — Turn only; start (90, 0, 0). The house is symmetric, so it also matches from behind (180°): both directions work, 90° away. The ghost hand drags sideways until the first turn.
  2. **Key** — Turn only; start (135, 0, 0). From behind it is a mirrored key (clearly wrong): only one side is right.
  3. **Table Lamp** — Tip only; start (0, −75, 0), seen from below. The ghost hand drags up and down until the first tip.
  4. **Fish** — Turn and Tip; start (60, 45, 0). First level with both dials; both rings pulse with their icons. The fish's tail is on one side only.
  5. **Cat** — Turn and Tip; start (−120, 30, 0). The signature reveal (the cat blinks). Unlocks the daily.
  6. **Umbrella** — Turn and Tip; start (30, 165, 0). The shadow starts upside down: tip it all the way over.
  7. **Teapot** — Turn and Tip; start (105, −30, 0). First hole (2×2 cells inside the handle): it opens only near the answer, a cue for the last nudge.
  8. **Rubber Duck** — Turn and Tip; start (−150, −45, 0). A deeper sculpture (5 deep, about 50 blocks): harder to read.
  9. **Bird** — Turn and Tip; start (75, −105, 0). Far on both dials.
  10. **Rocking Horse** — Turn and Tip; start (165, −60, 0). The Attic exam: the biggest picture (10×8), wedge rockers.
- **First level of each later room:**
  - 11. **Lighthouse** — Spin only; start (0, 0, 90): the shadow lies on its side. The Spin wheel appears with a pop; the ghost hand drags it until the first spin. A turn or tip drag wobbles and the wheel pulses.
  - 21. **Rabbit in a Hat** — two parts (rabbit above, hat below), Turn and Tip each, separate outlines. The ghost hand taps the second part.
  - 31. **Star and Moon** — two lights, Turn and Tip: a star on the wall, a crescent moon on the side wall. The second lamp switches on with a short animation.
- **Pictures per room** (can change in phase 3):
  - Attic: House, Key, Table Lamp, Fish, Cat, Umbrella, Teapot, Rubber Duck, Bird, Rocking Horse.
  - Museum: Lighthouse, Vase, Crown, Anchor, Elephant, Chess Knight, Dinosaur, Owl, Trophy, Sailing Ship.
  - Theater: Rabbit in a Hat, Dog and Bone, Snowman, Bird on a Branch, Mouse and Cheese, Bee and Flower, Snail and Leaf, Penguin on Ice, Rider and Horse, Dragon and Castle.
  - Observatory (front / side): Star / Moon, Rocket / Planet, Comet / Telescope, Sun / Cloud, Owl / Crescent, UFO / Cow, Satellite / Earth, Astronaut / Flag, Bear / Big Dipper, Dome / Galaxy.
- **Authoring (backwards):** draw the picture → the sculpt tool builds the sculpture from a seed → pick the start pose → the level tool checks it. The tool (`tools/levelcheck.mjs`, same `shadow.js` as the game) enforces:
  1. **Picture symmetry:** the picture's mirror, upside-down and half-turn images each match the picture at IoU ≥ 0.97 (a real symmetry: the extra solution is added) or ≤ 0.75 (clearly different). In between is rejected: a fish whose only asymmetry is its tail (0.89) would leave players stuck at 97% on the mirrored fish.
  2. **Exact front view:** the blocks' front silhouette is exactly the picture; the sculpture is connected; at most 60 blocks per part. Holes are at least 2×2 cells, so closing one costs about 0.1 of match (a 1-cell hole is about 3%, too small to matter).
  3. **Threshold** calibrated as in 3.7; a picture whose threshold comes out under 0.75 is rejected as too thin.
  4. **All solutions listed:** every pose on the 15° grid reachable with the level's dials whose IoU is ≥ 0.97.
  5. **No false near-matches:** a sweep of every reachable pose (3° steps; Spin at its 15° stops) finds each connected region where IoU ≥ `match` − 0.06; each region must contain a listed solution. Otherwise the tool tries the next seed.
  6. **Start pose:** on the 15° grid, at least 45° (rotation angle) from every solution, match % at the start ≤ 35%, |Tip| ≠ 90°. Dials the level does not allow are already at their solution value, so the target is reachable with the allowed dials only.
  7. **Two parts:** rules 1–6 per part; sub-pictures don't overlap. **Two lights:** both pictures fill the same rows; rule 5 uses both panels at once.
  8. **Report:** threshold, window per direction, `base`, start %, keyboard steps from start to solution, block count, and a difficulty estimate for ordering levels.
  - Measured in phase 1 with a throwaway script of this check (not in the repo): 50–100% of random seeds pass for typical pictures 3–4 deep, so the sculpt tool needs 1–3 tries per level. A 2-dial sweep takes under 1 s in Node; a 3-dial level about 20 s.
- **Level data format** (one JS module per level in `levels/`, exporting this object; the tools write `blocks`, `match`, `base` and `solutions`):

```json
{
  "id": "w1l05",
  "name": "Cat",
  "axes": ["turn", "tip"],
  "par": 25,
  "anim": "blink",
  "parts": [
    {
      "picture": [
        ".D...D..",
        ".ddddd..",
        ".deded..",
        ".ddddd..",
        "..ddd..d",
        ".ddddd.d",
        ".dddddd.",
        ".dd.dd.."
      ],
      "cuts": { "1,0": "bl", "5,0": "br" },
      "seed": 4127,
      "depth": 4,
      "start": [-120, 30, 0],
      "at": [0, 0],
      "blocks": [[1, 7, 2, 4, 3], [2, 6, 0, 4, 0], "…"],
      "match": 0.86,
      "base": 0.47,
      "solutions": [[0, 0, 0]]
    }
  ],
  "side": null
}
```

  Picture characters: `.` empty, `a`–`f` a full cell in color 1–6 (pink, lilac, mint, peach, white, gold), `A`–`F` a half cell (wedge) in that color, with `cuts` giving the corner of its right angle (`tl`, `tr`, `bl`, `br`). A block is `[x, y, z, color, shape]`: x from the left, y from the bottom row up, z from the back towards the light; shape 0 = cube, 1–4 = wedge with its right angle at `tl`, `tr`, `bl`, `br`. `axes` lists the allowed dials. `at` is a part's pivot offset in cells (two-part levels). `side` holds the side picture in two-light levels. `anim` is `bob`, `wiggle` or `blink`.

## 7. Progression and retention
- **Unlocks:** finishing a level unlocks the next. A room unlocks when the previous room's level 10 is finished. No star gates.
- **The book:** the level select is a book with one page per room. Each page has 10 frames: solved levels show their revealed picture with its stars; open levels show the dashed outline; locked levels show a padlock. Filling the book is the collection.
- **Daily shadow:**
  - Unlocks after level 5. One per local day, the same for everyone: the daily number is the count of days since 2026-01-01 plus 1 (2026-10-26 is #299), and entry (number − 1) mod 366 of the pool in `levels/daily.js` is that day's shadow. A debug option previews any date.
  - The pool is built from **60 extra pictures** (animals, food, tools, toys, vehicles) × seeds by the sculpt tool, Turn and Tip only, one object, mid-difficulty (start 60°–150° away, par 30 s). `tools/dailycheck.mjs` checks all 366 with the level rules. Entries store the picture, seed and start pose; the sculpture is rebuilt by the same deterministic generator at runtime.
  - Scoring: the time from the first move to the solve, across restarts (R resets the pose, not the clock). Replays after the solve are practice.
  - **Streak:** consecutive local days with a daily solved; missing a day resets it to 0.
  - **Result line** (Copy button, clipboard only):
    `Shadow Shapes Daily #299 · 🌑🌒🌓🌔🌕 · 0:42 · 🔥4`
    The moons tell the story of the solve: the time is cut into 5 equal slices and each moon shows the best match % reached in that slice (🌑 under 25%, 🌒 25–49%, 🌓 50–74%, 🌔 75–99%, 🌕 solved). A 💡 is added if a hint was used.
  - The book has a **Daily** page: a calendar of the month with each solved day's picture.

## 8. Screens and UI flow
`Title → (Play | Book | Daily) → Playing ⇄ Pause → Reveal → Results → Next / Retry / Book`

- **Title:** the logo; a sculpture slowly turning in the lamplight that clicks into its picture every few seconds; big **PLAY** (starts the next unsolved level, one click), **BOOK**, **DAILY** (with the streak flame; locked until level 5 with "Solve level 5"), music and sound toggles.
- **Book (level select):** tabs for the 4 rooms and Daily; 10 frames per room in two rows; the next level bounces. Locked rooms show a padlock and "Finish the Attic" (etc.).
- **Room intro:** entering a room's first level shows its name and the new dial for 1.2 s ("THE MUSEUM · new: SPIN ⟳").
- **Playing (HUD, top 72 px):** pause button; room and level name; three stars with their draining rings and the clock; hint bulb with its charge ring; restart button. Match % on the wall panel; the Spin wheel under the object (from level 11); part badges A / B at the left of the object zone (Theater); ☀ / ☾ icons on the panels (Observatory).
- **Pause:** Resume, Restart, Book, music and sound toggles, and a controls card (drag and keys).
- **Results:** slides in over the object zone, leaving the revealed picture visible on the wall: level name, stars stamping in, time counting up, best time, "★★★ within 0:25", a 💡 if a hint capped the stars, "Added to your book" with the picture flying into a book icon. Buttons **Next** (big, also Enter or Space), **Retry**, **Book** (the menu). The panel ignores presses for its first 300 ms, so a Space that skips the reveal can't also skip the stars. From the snap to playing the next level takes under 3 s with one press.
- **Daily results:** the time, the moon line building up moon by moon, the streak flame counting up, **Copy result**.
- **First run:** no text tutorial. Level 1 shows a glowing ghost hand dragging sideways over the object (with ← → keycaps under it) until the first turn, and a 3-word caption "Fill the outline" that fades after the first move.

## 9. Art direction
- **Family:** Night Neon.
- **Palette (core):**
  | Hex | Role |
  |---|---|
  | `#121833` | Night navy: room background |
  | `#232A52` | Wall navy: wall panels, HUD bar |
  | `#080B1C` | Shadow ink: the shadow, text outlines |
  | `#FFD25A` | Lamp gold: light beam, stars, sparkles |
  | `#3EE6FF` | Neon cyan: target outline, match %, hint ghost |
  | `#EAF0FF` | Moon white: text, icons, UI lines |

  **Block pastels** (the blocks, the pictures and the rings): `#FF5FA2` pink (also the spill hatching), `#B48CFF` lilac (Spin ring), `#5FF0C0` mint (Turn ring), `#FFB46B` peach (Tip ring). Pictures use these four plus moon white and lamp gold.

  Room tints (backgrounds only, darker shifts of the night navy): Attic `#1A1633`, Museum `#10202E`, Theater `#1E1230`, Observatory `#0C1230`.

  **Deviation from `STANDARDS.md` (4–6 colors):** 6 core colors run the scene and the UI; the 4 block pastels are an extra set because the revealed pictures need at least 6 picture colors (the 4 pastels plus moon white and lamp gold) to read as cats, keys and rockets. All 10 are chosen once here; room tints are shades of the night navy, as Flip Runner does with its worlds.
- **Key visuals:** rounded blocks with a bright edge and a soft inner glow; a warm halo behind the object; the wall a slightly lighter navy with a soft pool of lamplight; the shadow a crisp near-black shape; the outline dashed and glowing. Rooms sketched in a few glowing lines: attic beams and a round window, museum columns and pedestals, theater curtains and footlights, the observatory dome with stars and a telescope.
- **Rendering:** blocks in Three.js (see 12); everything else drawn in code on Canvas 2D. Room backgrounds and the outline glow are pre-rendered per level; only the shadow, the meter and particles are redrawn each frame.
- **Juice list:**
  - Rotating: the halo brightens with rotation speed; ring chevrons slide; dust motes drift in the beam.
  - Getting warm: the outline glow and its dash speed rise with the match %.
  - Snap: dials overshoot and settle; the outline flashes white; a ring of light expands from the shadow; a 2 px nudge of the screen.
  - Reveal: camera swing, mosaic wipe, 40 sparkles, the picture's animation, its name pops with a squash.
  - Part lock (Theater): a mini snap, its outline goes solid, 12 sparkles, the lock badge clicks shut.
  - Results: stars stamp in with squash, time counts up, "NEW BEST" ribbon, the picture flies into the book.
  - Daily: moons pop in one by one; the streak flame grows.
  - UI: buttons squash on press (0.94); panels slide with an ease-out.
- **Concept art prompts** (updated from the brief):
  - **Gameplay screenshot (16:9):** *"Dark cozy attic at night with a warm spotlight beam from the lower left, on the left an abstract floating sculpture of rounded glowing pastel blocks (pink #FF5FA2, lilac #B48CFF, mint #5FF0C0, peach #FFB46B) with thin glowing rings around it, on the right a dark navy wall panel (#232A52) where the sculpture's near-black shadow almost fills a dashed glowing cyan (#3EE6FF) outline of a sitting cat, one corner of the shadow sticking out with pink diagonal stripes, a small round meter reading 87%, minimal neon style, 3D puzzle game screenshot, 16:9"*
  - **Key art / thumbnail (16:9 and 1:1, no text):** *"an abstract floating sculpture of rounded glowing pastel blocks under a single warm spotlight in a dark cozy room, its shadow on the wall exactly filling a dashed glowing outline of a cat and lighting up into a colorful glowing mosaic of the cat, sparkles along the outline, minimal neon style, dark navy background, glowing outlines, a few vivid accent colors, clean geometric shapes, soft glow, calm and atmospheric, centered composition with room for a title, game key art"*
  - **Character and element sheet:** *"several abstract sculptures of rounded cubes and wedge blocks in pink, lilac, mint, peach, white and gold, seen from different angles, each next to the shadow silhouette it casts and the glowing mosaic picture it reveals (a cat, a key, a teapot, a rocket), a two-part puppet hanging on a rod, a warm lamp and a cool moon lamp, three rotation rings with arrows, a dashed glowing target outline, a round match meter, a lightbulb icon, star icons, minimal neon style, dark navy background, glowing outlines, a few vivid accent colors, clean geometric shapes, soft glow, calm and atmospheric, game asset sheet on a plain dark navy background, evenly spaced, consistent scale"*
  - **Logo:** *"the words "SHADOW SHAPES" in soft glowing letters with a long cast shadow behind them that forms the silhouette of a cat, minimal neon style, dark navy background, glowing outlines, a few vivid accent colors, clean geometric shapes, soft glow, calm and atmospheric, game logo on a plain dark navy background, bold and readable at small size"*
  - **Negative prompt:** *"text, letters, watermark, signature, photorealistic, gritty, horror, violence, weapons, blood, cluttered background, blurry, low contrast, extra limbs, UI buttons"* (drop "text, letters" for the logo).

## 10. Audio
| Sound | When | Character |
|---|---|---|
| Whirr | While the object rotates | Soft filtered noise; volume and brightness follow the rotation speed |
| Warm notes | Match % crosses a 10% step | Soft pluck, rising pentatonic scale going up; muted low tick going down |
| Axis lock | A drag locks to an axis | Very soft click |
| Locked wobble | Drag on a dial the level doesn't allow | Dull "tock" |
| Spin stop | Spin settles on a 15° step | Tiny ratchet click |
| Snap | Match | Wooden clack plus a short rising sweep |
| Reveal | The picture lights up | Celesta-like arpeggio (5 notes, 1.2 s) with a shimmer |
| Part lock | A puppet part locks | Clack plus one chime note |
| Hint ready / hint | Charge full / ghost plays | Soft bell / whoosh with falling sparkles |
| Star | Each star stamps in | Stamp plus a rising note |
| Page | Book page turn | Paper swish |
| Streak | Daily streak counts up | Warm "fwoomp" |
| UI | Buttons | Soft click |

Music: yes, a calm synthesized ambient loop per room (8 bars at 72 BPM: soft pads, a slow plucked arpeggio, in the same pentatonic key as the warm notes so they harmonize). **On by default:** it carries the mood, and it is tiny because it is generated. Music and sound effects have separate toggles; both persist. The game is fully playable with the sound off: every audio cue has a visual one.

## 11. GameAnalytics
| Event id | When it fires | Value |
|---|---|---|
| `Start:world0N:level0M` | Level begins (also after R) | — |
| `Complete:world0N:level0M` | Level solved (snap) | Stars this run (1–3) |
| `Fail:world0N:level0M` | R / restart button, or quitting to the menu or book | Seconds since the level started |
| `level:time:world0N:level0M` | On Complete | Solve time in seconds (from the first move) |
| `level:moves:world0N:level0M` | On Complete | Drags plus key steps this attempt |
| `level:best:world0N:level0M` | On Fail | Best match % reached this attempt |
| `level:hint:complete:world0N:level0M` | On Complete, if a hint was used | Hints used this attempt |
| `level:hint:fail:world0N:level0M` | On Fail, if a hint was used | Hints used this attempt |
| `axis3:unlocked` | Level 11 starts for the first time (Spin appears) | — |
| `tutorial:step01` | First Turn ever (level 1) | — |
| `tutorial:step02` | Level 1 complete (first reveal) | — |
| `tutorial:step03` | First Tip ever (level 3) | — |
| `tutorial:done` | Level 4 complete (first level with two dials) | — |
| `daily:start` | First move in today's daily | Day number |
| `daily:complete` | Today's daily solved (scored solve only) | Seconds |
| `daily:streak:<n>` | After a scored daily solve | — |
| `daily:share` | Copy result button | — |
| `ui:restart` | R or restart button | — |
| `ui:hint` | First hint in an attempt | Seconds since the level started |
| `settings:music:off` / `settings:sfx:off` | Toggle switched off | — |

- The brief's `level:hint` and `level:time` get the level id as extra tiers (and the hint event the outcome), so the data can be split per level. Counts are sent once per attempt with a value, never one event per drag.
- In development every event is logged to the console.

**Question the data must answer:** do players get stuck on 3-axis levels, and do hints keep them going? Compare the Complete/Fail ratio and `level:time` of 2-dial levels (world01) with 3-dial levels (world02 onward); `level:best` on Fail shows whether quitters were lost (under 50%) or close (over 80%); `level:hint:complete` against `level:hint:fail` gives the completion rate of attempts that used a hint, compared with the level's overall rate; `ui:hint`'s value shows how long players struggle before asking.

## 12. Tech plan
- **Stack:** ES modules, no build step. **Three.js** (the brief asks for 3D) only for the object view, bundled locally in `lib/` (a pinned release of the minified core module plus its license file, about 0.6–0.7 MB; no CDN, no add-ons). The wall, HUD and menus are Canvas 2D. Three stacked canvases share the letterboxed 16:9 frame: the 2D background and wall, the WebGL object view (object zone only, transparent), the 2D UI on top (it alone receives pointer events).
- **Loop:** delta time capped at 0.05 s; pauses (and stops the clock) when the tab is hidden. No physics, so no fixed step: the pose only changes on input and in eased animations. The `AudioContext` starts on the first click or key press. Three.js loads with the page; the title shows in under 3 s.
- **Copied, not imported,** from Magnet Twins and Flip Runner: the frame loop and screen shell, `save.js`, the analytics stub, the synth sound module and music sequencer, pooled particles, canvas buttons and the `simtest` harness.
- **Modules (`src/`):** `main.js` (boot), `game.js` (loop, screens, flow, HUD), `pose.js` (dials → rotation matrix, wrap, key steps, Spin stops, nearest solution, front-follows-pointer rule; pure), `shadow.js` (projection, hulls, rasterization, IoU, targets, outline tracing, match %; pure), `sculpt.js` (picture → blocks, two-picture builder, seeded PRNG; pure), `level.js` (parser), `scene3d.js` (Three.js: orthographic camera, merged block meshes, rings, ghost, halo, camera swing), `wall.js` (beam, shadow polygons, gap glow, spill hatching, outline, mosaic reveal), `input.js` (drag surface, axis lock, Spin wheel, part picking, keys and repeat), `ui.js` (buttons, panels, book pages), `fx.js`, `audio.js`, `daily.js`, `save.js`, `analytics.js`, `config.js`.
- **One rotation, two views:** `pose.js` builds the rotation matrix; the same matrix is copied into the Three.js mesh (`matrixAutoUpdate` off) and used by `shadow.js`, so the object and its shadow can never disagree.
- **Rendering budget:** each part is one merged mesh (internal faces between touching blocks removed): at most 60 blocks × 12 triangles. One shared 64×64 edge-glow texture, Lambert material with a little emissive, no real-time shadows, no post-processing (the glow is a halo sprite). The WebGL canvas uses `devicePixelRatio` capped at 2 and drops to 1 if frames take over 18 ms for 2 s. The shadow mask is recomputed only when the pose changes (about 50 µs measured in Node for 60 blocks).
- **Size:** about 0.7 MB of Three.js plus about 0.2 MB of game code and level data; aim under 1.2 MB in total, no image or audio files.
- **Tools (`tools/`, run in Node on the same pure modules):** `simtest.mjs` (math checks: known projections of a cube, IoU of identical masks = 1, dial order, key steps and Spin stops, nearest solution with wrap-around, generator fingerprint so nobody changes the sculptures of shipped levels by accident), `levelcheck.mjs` (the rules in 6; `--write` fills `match`, `base`, `solutions`), `sculpt.mjs` (picture + seed → blocks, retrying seeds until the check passes), `dailycheck.mjs` (all 366 daily entries).
- **Level editor (phase 3, debug only, `?editor`):** paint the picture (6 colors, 4 wedge corners), choose depth and seed, rotate to pick the start pose, run the check in the page with a heat map of the Turn × Tip match landscape, export the level module.
- **Save keys:** `cm_shadow-shapes_save` → `{ v: 1, levels: { "w1l05": { stars: 3, best: 18.4 } }, daily: { last: 299, streak: 4, max: 9, days: { "299": { t: 42.1, hint: false } } }, tut: { turn: true, tip: true, spin: false, parts: false, lights: false } }` and `cm_shadow-shapes_settings` → `{ v: 1, music: true, sfx: true }`. Reads in `try/catch`; broken data resets to defaults. Saved after every level and every settings change.
- **Testing hook:** `window.game` with `screen` (`'title' | 'levels' | 'playing' | 'complete'` as in `STANDARDS.md`; the book reports `'levels'`, the reveal and results `'complete'`), `level`, `score`, plus `pose` and `match`; helpers `start()`, `restart()`, and debug-only `win()` and `setPose(turn, tip, spin)`.
- **Riskiest piece:** the drag feel on a Chromebook trackpad (axis lock, 0.5°/px, ring readability). **Prove it first** in phase 2 with a bare sculpture, its live shadow and the match %, before any art; a new player should match level 1 in under 20 s.
- **Second risk:** whether the warmer/colder loop and the reveal are fun. The phase 2 gate tests exactly that with the 3 tutorial levels.
- **Third risk:** WebGL on low-end Chromebooks. Measure 60 fps with 4× CPU throttle in phase 2. Fallback if it fails: a Canvas 2D painter's renderer for the blocks (sorted by depth), which `shadow.js` does not depend on.

## 13. Scope
- **v1:** the three dials with rings, axis lock, keyboard steps and Spin stops; match by IoU with per-level thresholds; warmer/colder feedback; snap and reveal; hints; two-part puppets; two lights; 40 levels in 4 rooms; the book; daily shadow with streak and moon line; full shell, saving, sound and ambient music, analytics; `simtest`, `levelcheck`, `sculpt`, `dailycheck` and the debug editor.
- **Later:** two-object levels whose shadows overlap and combine (from the brief); a point light, so moving the object nearer or farther scales its shadow (a fourth "dial"); colored glass blocks that cast colored shadows; moving lights and mirrors; a 3D viewer of each sculpture in the book; two-finger twist for Spin on touch; player-made sculptures with share codes.
- **Cut:**
  - **Free trackball rotation:** the pose depends on the path, players get lost, and levels can't limit the axes.
  - **Inertia:** it overshoots the small match window.
  - **Time limits and fail states:** against the calm pillar; time only buys stars.
  - **Stars for fewest moves:** they punish exploring, which is the fun.
  - **Three.js shadow maps:** costly, not deterministic, can't be tested in Node.
  - **Hand-drawn reveal pictures as image files:** too much art and size for 100 pictures; the mosaic comes free from the blocks.
  - **A match % based on the angle to the answer:** it would be a metal detector and the shadow would stop mattering.

## 14. Open questions
| Question | Recommendation | Who decides | Status |
|---|---|---|---|
| Is 0.5° per CSS px with an 8 px axis lock right on a Chromebook trackpad? | Keep; tune in the phase 2 feel loop | Fafi | Open |
| Is a 6° match window right? | Keep; try 5–8° with the 3 slice levels | Fafi | Open |
| Does the camera swing at the reveal feel magical or dizzying? | Keep it, 500 ms and skippable | Fafi | Open |
| Spin wheel, or twisting the shadow directly on the wall? | Wheel: it fits every layout and never changes what a drag on the wall does; try a twist gesture in the feel loop only if the wheel feels indirect | Fafi | Open |
| Hint after 20 s, unlimited, caps stars at ★★? | Keep; check `ui:hint` timing after release | Fafi | Open |
| Ambient music on by default? | Yes, as Flip Runner's playtest showed; toggle persists | Team | Open |
| Daily: Turn and Tip only, unlocked after level 5? | Yes, so every player who meets it knows both dials | Fafi | Open |
| Coolmath SDK, ad breaks, branding, size limit | Ads only after the results panel, never during the reveal | Team | Open |
| GameAnalytics game key and secret | One key per game in `src/config.js` | Team | Open |
| Three.js vs a Canvas 2D block renderer | Three.js as the brief asks; Canvas 2D fallback only if phase 2 fails 60 fps | Fafi | Open |

## 15. Changelog
- 2026-10-27 — Approved by Pao. Stage moves to `slice`.
- 2026-10-26 — Phase 1c review applied: Spin moves from a dial on the wall to a notched wheel under the object (the wall dial changed what a wall drag did at level 11 and did not fit two-light or two-part layouts); the whole playfield is one Turn/Tip drag surface in every level; orthographic camera, so the front faces line up into the picture at the reveal (with perspective, back blocks were about 13% smaller); thresholds under 0.75 reject the picture instead of being clamped; holes at least 2×2 cells; R keeps the daily clock running; daily number defined; side panel orientation and colors; Theater badges and locked-part feedback; Enter/Space for Next; minimum text size; the extra pastel set documented as a deviation; `window.game` screen names as in `STANDARDS.md`. Second pass: target area and part sizes on screen, two-light depth up to 8, 48 CSS px hit areas for the wheel ends and part badges, results ignore presses for 300 ms, loop and audio unlock rules, consistent data example. Status set to In review.
- 2026-10-26 — First draft from the brief and the phase 1a answers: three path-independent dials (Turn, Tip, Spin) with axis-locked drags and rings; IoU on 64×64 masks from our own orthographic projection, with per-level thresholds for a 6° window (measured with a prototype of the check: a fixed 0.90 gave ±3.5° to ±11°); honest match % plus spill and gap visuals; time stars with a hint cap; voxel sculptures generated from pixel pictures, revealed as a mosaic; rooms teach Turn/Tip, Spin, two-part puppets and two lights; the book is the level select; daily from a 366-entry pool with a moon result line.
