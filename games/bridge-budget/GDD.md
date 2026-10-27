# Bridge Budget — Game design document

**Status:** In review
**Owner:** Fafi · **Reviewed by:** — · **Last updated:** 2026-10-26

> Drag beams, cables and road across a gap, press Test, and watch a little truck with a face drive over it. Will it hold, sag, or snap into the river? Then make it cheaper, because there is always a cheaper bridge.

## 1. Summary
- **Pillars:**
  1. **Build, test, laugh, fix, all in seconds.** One key starts the test, one key brings you back to your bridge, untouched. The test is a show (creaks, slow motion on the first snap, splashes, a cheering horn), and fixing it is never more than a few drags away.
  2. **Forces you can read.** Every input shows what it will do before you commit (ghost beam with its cost, reach and joints). Stress is always visible by color, thickness and icons, and after a failed test the first piece that broke is marked. The physics is deterministic: a bridge that passes always passes.
  3. **There is always a cheaper bridge.** Passing is easy to reach (any working bridge earns a star); mastery is about money. Stars, your best cost, and a hard-hat badge for beating the engineer's own bridge pull players back to optimize.
- **Player:** Coolmath players aged 10–24 at a school Chromebook with a trackpad (or a mouse), often with the sound off, in a desk break. Touch works, but phones are a secondary target.
- **Session:** One level takes 1–3 minutes to a first pass, plus as long as the player wants to optimize (typically 2–5 minutes total). A typical visit is 15–30 minutes (a handful of levels, or a star hunt on old ones).
- **Hook:** "Let's see if it holds" (the test is the reward), "it broke right there, I know how to fix it", and "I'm $40 over the three-star target".

## 2. Core loop
- **Moment (seconds):** Drag from a joint → the ghost shows cost, length and what it connects → release to place → watch the cost meter tick.
- **Level (minutes):** Read the gap, the vehicle and the budget → build → Test → watch it hold or collapse → back to build with the first break marked and the stress view → fix → pass → stars → optimize for the target.
- **Meta (days):** Stars unlock vehicle skins → each world adds new terrain, materials and vehicles → old levels call back with a missing star, a best cost to beat, and a hard hat to win.

## 3. Mechanics

### 3.1 Space and scale
- Design resolution 1280×720, letterboxed (`STANDARDS.md`). The **top bar** takes the top 64 px (information only), the **toolbar** the bottom 96 px; the **playfield** is the 1280×560 px between them.
- **1 grid cell = 1 m = 40 px.** The playfield is **32 × 14 cells**. Every level fits on one screen: **no zoom and no panning in v1** (a deliberate change from the brief, see 4).
- Gravity is 9.81 m/s² (392 px/s²). All physics numbers below are in meters, kilograms and newtons; px values are at 1280×720.
- At the smallest supported window (800×450) a cell is 25 px on screen. That is enough for a mouse or trackpad because building snaps to the grid and picks the nearest joint (3.4).

### 3.2 Simulation
- **Model:** a 2D spring-mass bridge solved with **XPBD** (position-based Verlet with compliant distance constraints). Joints are point masses; every member is a distance constraint with a stiffness; anchors never move. This is the brief's "simple spring-mass (Verlet)" model, solved in a way that stays stable with a 3-tonne truck sitting on 10 kg joints.
- **Rate:** fixed step at **120 Hz** with an accumulator (frame `dt` capped at 0.05 s), **8 substeps per step** (substep h = 1/960 s), **one constraint pass per substep**. Each substep: apply gravity and predict positions, solve every member once in creation order, solve the vehicle bodies, solve wheel contacts (normal, then friction and drive), then derive velocities from positions.
- **Damping:**
  - **Axial damping of 100 /s** on every member: it damps stretching along members without slowing falling debris.
  - **Settle phase:** extra damping of **8 /s** on every bridge joint (never on vehicles) during the **first 1.0 s** of a test.
  - Velocities are clamped to **30 m/s**.
- **Gravity ramp:** gravity rises from 0 to full over the **first 0.5 s** of a test.
- **Why the ramp and the settle phase:** members are soft enough to bend visibly (3.3), so a suddenly switched-on weight overshoots, inflating early stresses by up to 50%, and leaves the whole bridge bobbing at about 1 Hz for over 10 s (jelly). With both, the bridge sags into place in one smooth motion while the vehicle drives up (it reaches the gap after about 1.2 s), and nothing changes once the vehicle is on it.
- **Masses:** each member's mass (length × mass per meter) is split half to each end joint. A joint weighs at least **10 kg**.
- **Force and stress:** a member's force comes from its XPBD multiplier (force = λ / h²; positive is tension, negative compression), **averaged over the 8 substeps of a step**. **Stress ratio = |force| / the material's limit** (tension or compression limit). 0% is unloaded; 100% is the breaking point.
- **Breaking:** a member breaks when its step-averaged stress ratio is **over 1.0** (100%). It is removed from the solver at once and splits into two halves that dangle from their joints (visual only, no collision). A joint left with no members falls freely. A member stretched past 150% of its rest length also breaks (a safety net; normal breaking happens long before).
- **Cables** are tension-only: when compressed they go slack (no force, drawn with a slight droop) instead of pushing.
- **Debris:** joints more than 2 m below the bottom of the playfield stop simulating.
- **Determinism:** `sim.js` uses only `+ − × ÷`, comparisons and `Math.sqrt` (IEEE-exact in every engine). **No `Math.hypot`, `sin`, `cos`, `atan2`, `pow`, `exp` and no `Math.random` in the simulation.** Members are solved in creation order and contacts in a fixed order. Joint positions are integer grid cells. So the same level plus the same bridge gives bit-identical results in every browser and in Node, at 60 Hz or 144 Hz, with or without fast-forward. A bridge that passes always passes, and the Node tests can prove it.
- Build-mode geometry (lengths, overlaps, crossings, splits) also works on integer grid coordinates, so validation is exact, with no tolerance to tune.
- **Bridge parts never collide with terrain, each other or the vehicles' bodies.** Only wheels collide, with road members and with the ground (3.6). Debris falls past cliffs. This keeps the model cheap and predictable.
- **Calibration:** all numbers in 3.2–3.6 come from a throwaway prototype used while writing this GDD (not in the repo). Its results are summarized in 12 and become `tools/simtest.mjs` checks in phase 2.

### 3.3 Materials
| Material | Cost | Max length | Mass | Stiffness (EA) | Tension limit | Compression limit | Notes |
|---|---|---|---|---|---|---|---|
| **Road** | $200 /m | 2.5 m | 60 kg/m | 2,000 kN | 40 kN | 40 kN | The deck. The only material wheels drive on |
| **Wood** | $100 /m | 3 m | 20 kg/m | 1,000 kN | 30 kN | 30 kN | Cheap, light, weak |
| **Steel** | $250 /m | 4 m | 40 kg/m | 3,000 kN | 90 kN | 90 kN | 3× wood's strength for 2.5× the price, twice the weight |
| **Cable** | $60 /m | 14 m | 6 kg/m | 3,000 kN | 80 kN | 0 (goes slack) | Tension only. Long, light and cheap, but needs something high to hang from |

- **Piece cost** = cost per meter × length, rounded to the nearest $10 (a 2.24 m wood piece costs $220). The bridge cost is the sum of its pieces; locked pre-built pieces cost $0.
- **Strain at the breaking point:** road 2%, wood and steel 3%, cable 2.7%. A loaded 12 m bridge sags 5–13 px under the truck: visible, never jelly.
- **Road is deliberately weak.** A bare road deck breaks even under the car (level 2), and on long spans the road is often the first thing to go, so it must be held up every 2–2.5 m from above or below. The road can't be upgraded in v1 (one member per joint pair, 3.4); the fix is always better structure. Watch this in playtests (see 14).
- **What the numbers create** (measured in the prototype with the final settings):
  - Triangles: a 6 m bare road breaks under the car (needs 54 kN); a 1 m-tall wooden truss on the same gap holds it at 73%.
  - Depth: under the truck (3 t), 1 m-tall trusses break (102–116%) and a 2 m-tall one holds (83%). A plain wooden truss can't carry the truck past about 6 m.
  - Mixing: on 8–10 m truck spans, steel goes where the force is (end diagonals, middle of the top chord) and wood elsewhere. The best mixes cost about 20–25% less than all steel.
  - Long spans: a plain steel truss over 20 m breaks under the bus (109%, $19,700). Cables from towers carry it at 53% for about half the price ($10,160).
- **Materials unlock by level:** Road (1), Wood (2), Steel (5), Cable (14). Locked materials are hidden from the toolbar. A level can also restrict its materials (`materials` in the level data).

### 3.4 Building
- **Joints are automatic.** There is no joint tool: a member is drawn **from an existing joint or anchor to any grid node** within the material's max length. A new joint appears at the far end if there wasn't one. Joints sit only on grid nodes.
- **Two ways to draw, decided by the gesture, no mode switch:**
  - **Drag:** press on a joint, drag, release on the end node. This is the main gesture, taught in level 1.
  - **Click-click** (for trackpad tap-to-click users): a press and release on a joint without moving more than 8 px picks it up, and the beam then follows the pointer. Click a node to place it; the beam keeps following from the new end (**chaining**), so a deck is click, click, click. Click the current start joint again, press Esc, or pick another tool to stop. (Two clicks at different places, never a double-click requirement.)
- **Picking:** a press picks the nearest joint within 0.75 cell (30 px), or within 1 cell on touch. Pressing on empty space starts nothing: the nearby joints pulse once and a small "Start from a joint" bubble appears.
- **Ghost preview** while drawing: the member drawn in its material at 60% opacity; the snapped end node with a ring; a label near the pointer with **the piece cost** ("+$220"), while the cost meter (8) previews the new total as a striped segment, so you see which star line it would cross; a dashed circle showing the material's **max reach** around the start joint; a ring on **every existing joint the member will connect to**. On touch, the label sits 64 px above the finger.
- **Max length is a clamp, never an error:** if the pointer is out of reach, the ghost end snaps to the reachable grid node nearest to the pointer.
- **Invalid ends** show a crossed ghost (⊘ icon plus red dashes) with a one-word reason, and releasing there places nothing. Invalid means: the end is inside or on terrain, outside the build area, inside a no-build zone, the member would cross terrain or a no-build zone, or it would lie along an existing member (collinear overlap).
- **Auto-split:** a member passing exactly through an existing joint is split there into two members that connect to it (rings show this in the preview).
- **One member per joint pair. Drawing over an existing member replaces it** with the selected material, and the ghost label shows the difference ("Upgrade +$300", "Swap −$300"). The one exception: wood, steel or cable drawn over a road is blocked ("Road here"), so a deck is never deleted by accident. Road drawn over a beam replaces the beam.
- **Crossing members** (an X with no joint in the middle) are allowed and don't interact.
- **Eraser tool:** tap a member to remove it (full refund); drag across members to erase all it touches; tap a joint to remove it with all its members. Anchors and locked pieces can't be erased.
- **Undo / redo:** unlimited within a level visit (place, erase, replace, clear, load best). Undo has a toolbar button; redo is keyboard only (Y or Shift+Z).
- **Clear:** removes everything the player built, with no dialog; a toast says "Cleared · Undo".
- **Mirror** (M or toolbar toggle, only on levels marked `mirror: true`, whose terrain and anchors are symmetric): every piece drawn or erased is copied mirrored across the gap's center line. The ghost shows both pieces and their total cost. If the mirrored piece is invalid it is skipped (its ghost shows ⊘); a piece that is its own mirror is placed once. One undo step covers the pair. Most references have 15–60 pieces and most bridges are symmetric, so this roughly halves building time on a trackpad.
- **No move tool in v1.** Erase-and-redraw plus undo covers it (Later).
- **Caps:** 160 members and 100 joints per bridge (performance budget, see 12). At the cap the ghost shows "Max pieces".
- **Disconnected parts are allowed**; they simply fall when the test starts.
- **Steep road warning:** in build mode a road piece at 45° or steeper shows a small warning chevron ("Steep!"). It doesn't block anything: vehicles stall on long steep climbs (3.5).
- **Autosave:** the current bridge of each level is saved 1 s after every change and on every test, so leaving and coming back restores it.

### 3.5 Vehicles
| Vehicle | Mass | Wheelbase | Wheel radius | Cruise speed | First level |
|---|---|---|---|---|---|
| **Car** | 1 t | 1.4 m | 0.3 m | 5 m/s (200 px/s) | 1 |
| **Truck** | 3 t | 2.0 m | 0.4 m | 4 m/s (160 px/s) | 4 |
| **Bus** | 4 t | 3.0 m | 0.4 m | 3.5 m/s (140 px/s) | 23 |

- **Body model:** two wheel particles (half the mass each) joined by a rigid distance constraint. The body is drawn along the line between the wheels. The whole load goes through the wheels, so it lands exactly where the wheels touch.
- **Wheel contact:** circle against segment, against every road member and every ground segment. The contact pushes the wheel out and pushes the road's two end joints the opposite way, split by where along the road the wheel is (so a wheel in the middle of a road piece loads both ends equally).
- **Drive:** accelerate at 3 m/s² up to cruise speed and hold it (also downhill). Traction is tyre friction (**μ = 0.7** of the normal push) and the drive force is capped at **0.55 g** (an engine limit). Result: slopes up to about 2:3 (34°) are climbed at full or reduced speed; a long 45° climb stalls the vehicle ("Stuck!"); a short steep bump can be taken on momentum.
- **Start:** vehicles wait on the left bank in build mode, idling, with a weight tag ("Truck · 3 t"). At Test the first vehicle starts with its front wheel 4 m before the gap edge (wide-gap levels start it partly off-screen). In a **convoy**, each next vehicle starts 2.5 m behind the previous one's rear wheel, and all start together.
- **Faces:** every vehicle has big eyes. They look ahead while driving, go wide with a sweat drop when any member within 2 m of the vehicle is above 80% stress, make an "O" mouth when falling, and grin with a honk at the flag.
- **Skins** (7) change only the look, never the physics.

### 3.6 Terrain, anchors and level elements
- **Banks / cliffs / quays:** solid polygons. Wheels drive on their top surfaces. Joints can't be placed inside or on them.
- **Anchors:** fixed joints that are part of the level: always at both road-level bank edges, plus any of the following on some levels: on **bank or cliff faces** below the road (supports from below, from level 3), on **rocks** in the river (level 1 at road level, level 8 below the road), on **overhangs** above the road (cables, level 14), and on **towers** at several heights (level 21). Drawn as big white bolts (14 px radius) with a shadow, bigger than player joints (8 px).
- **Build area:** a dashed outline per level; joints must be inside it. It sets how tall or deep a bridge may be (for example, at most 1 m above the road in level 7).
- **No-build zone:** a hatched rectangle inside the build area: no joint inside and no member crossing it (waterfalls, rock overhangs, boat lanes).
- **Pre-built pieces:** members that are already there when the level starts. **Locked** pieces (old wood, grey with moss, a padlock icon) cost $0 and can't be erased or replaced (level 9). Unlocked pre-built pieces belong to the player like anything they built and count in the cost (level 6).
- **Water and floor:** the gap ends in water (River, Harbor) or a canyon floor (Canyon), drawn about 3–4 m below the road.
- **Flag:** a checkered flag 3 m past the far gap edge.
- **Boat lane** (Harbor): a no-build zone from the water up to the lane's top. During the test a sailboat crosses it at a time set by the level (tuned so it passes under the bridge while the vehicle is on it). If any member or joint touches the boat's box at any moment, the boat bonks, honks and stops, and the test fails ("Bonk!"). Nothing can be built in the lane, so only a bridge that sags too far or collapses can hit it: **the boat turns stiffness into a goal**.

### 3.7 Test, pass and fail
- **Test** (Space, Enter or the big button) starts the simulation at once, with no countdown. **Stop** (Space again or the button) returns to build mode in the same frame, with the bridge exactly as built.
- **R always runs the test from the start:** in build mode it starts a test; in test mode it restarts it instantly. Since the simulation is deterministic, a restart is a true replay.
- **Fast-forward** (F or button) toggles 2× speed (240 simulation steps per real second), and the setting is remembered. Slow-motion moments still happen, but last half as long.
- **Slow motion on the first break** (9) plays only when the first member to break is a different one than in the previous test of this visit. A retry with the same weak spot carries no new information, so it plays at normal speed.
- A hidden tab (`visibilitychange`) pauses the test.
- **Pass:** every vehicle's center crosses the flag. After the flag, vehicles keep driving off the right edge, so a convoy never piles up. **Once every vehicle has passed, the result is locked:** a collapse or a boat bonk after that is only animation. **Broken members don't matter:** if the vehicle made it, it made it. (A bridge collapsing right behind the truck is the best moment in the genre, and determinism makes it repeatable, so it's skill, not luck.) After the pass the simulation keeps running for 1.5 s so the player sees whether the bridge stands, then the results panel slides in.
  - A pass with any broken member is stamped **"HELD TOGETHER!"**; a pass with a peak stress of 95% or more and nothing broken is stamped **"CLOSE CALL!"**. These are just for fun, with no effect on stars.
- **Fail**, whichever comes first:
  - a vehicle's center falls 4 m below the lower bank top: **"SPLASH!"** (water) or **"CRASH!"** (canyon floor);
  - a vehicle makes less than 0.2 m of forward progress in 3 s: **"STUCK!"**;
  - the boat bonks (3.6): **"BONK!"**;
  - 30 s pass without every vehicle at the flag: **"TOO SLOW"** (a safety net, rare).
- **After a fail**, the result is decided at once, but the stamp lands 0.5 s later (after the splash), shows for 1.2 s, then a small banner offers **Fix it** (Space) and **Watch again** (R). Any click or key skips the wait, and Space goes straight to Fix it. Fix it returns to build mode with:
  - the **first member that broke** marked with a crack icon and a bouncing arrow (until it is changed or erased);
  - the stress view on (3.8).

### 3.8 Stress display and stress view
- **During a test** each member keeps its material's shape and texture (wood grain, steel rivets and dark edges, the cable's thin line, the road's dashes), and its **fill color shows its stress ratio**: green (0–40%) → yellow (60%) → orange (80%) → red (95%+). Three cues don't rely on color:
  - drawn width grows by up to +50% from 50% to 100% stress;
  - small zigzag chevrons appear on members at 75% or more;
  - members at 90% or more shake by ±1 px.
- **Stress view** (eye button or S, build mode): each member is tinted by the **peak stress it reached in the last test**, with a % label on members at 75% or more and a crack icon on broken ones. Members at 50% or more show a tiny glyph telling **pulled** (arrows out) from **squeezed** (arrows in), and a slack cable shows a wavy "slack" mark. This is how players learn which pieces can be wood, why a cable didn't help, and what to reinforce. Pieces added or changed since the last test show no tint ("untested"). Opening it is free, and it turns on by itself after a fail.
- **No stress prediction while building.** The test is the reveal; the stress view shows the last test only.

### 3.9 Stars, budget and the reference bridge
- Every level ships with a **reference bridge**, the designer's cheapest solid solution. It is saved as data (6) and must pass with a **peak stress at or under 90%** and no broken member, checked by `tools/simtest.mjs` (the margin keeps it valid through small physics tuning).
- From its cost:
  - **3-star target** = reference × 1.05, rounded up to the next $50.
  - **Budget** = reference × 1.3, rounded up to the next $100. Levels about saving money use a tighter factor, stated in their line (level 6: × 1.15).
- **Stars** (the best ever is kept per level):
  - ★ the vehicle crosses, **at any cost**. Going over budget is allowed, so no one is ever stuck;
  - ★★ crossing with cost ≤ budget;
  - ★★★ crossing with cost ≤ target.
- **Hard hat:** crossing at or under the reference cost itself ("You beat the engineer!") earns a hard-hat badge on the level tile. After a level's third star, the results show the engineer's cost so players know the number to beat.
- The cost meter (8) always shows the budget line, the target line and your best.

## 4. Controls
| Action | Mouse / touch | Keyboard |
|---|---|---|
| Draw a piece | Drag from a joint to a node, or click a joint then click a node (chains) | — |
| Stop chaining | Click the start joint again, or pick a tool | Esc |
| Pick material | Toolbar: Road, Wood, Steel, Cable | 1 / 2 / 3 / 4 |
| Eraser | Toolbar, then tap or swipe pieces | E (toggle) |
| Undo / redo | Toolbar undo | Z / Y or Shift+Z |
| Mirror (symmetric levels) | Toolbar toggle | M |
| Stress view | Eye button | S |
| Hint (after 3 failed tests) | Light-bulb button | H |
| Test / stop | Big TEST button (STOP during a test) | Space or Enter |
| Run test from the start | RESTART button (test mode) | R (build or test mode) |
| Fast-forward | Button (test mode) | F |
| Pause | Toolbar button | P or Esc (when not chaining) |
| Menus | Click / tap | Arrows, Enter / Space |

- **Mouse and trackpad first** (`STANDARDS.md`), with one Pointer Events code path for mouse and touch. No right-click, no hover-only actions, no double-click.
- **Deviation from the brief: no zoom and no two-finger pan.** Every level fits the 32 × 14-cell playfield, so nothing needs them, and leaving them out avoids the worst trackpad problems on Chromebooks (pinch triggers browser zoom; two-finger scroll scrolls the page). If touch playtests on phones need it, a 2× zoom comes later (13, 14).
- **R restarts the test, not the level.** In a builder, wiping the level is the Clear button (undoable). Both take well under 1 s (`STANDARDS.md`: restart under 1 second).
- **Toolbar buttons are 80 × 80 design px**, so they stay at least 50 CSS px at 800×450 (above the 48 px minimum). The Test button is 200 × 80. In-game text is at least 22 design px (14 CSS px at 800×450).
- `preventDefault` on Space, the arrow keys, wheel and touch moves over the canvas, so the page never scrolls or zooms.

## 5. Game elements
| Element | Behavior | First appears | Shape/icon (not color alone) |
|---|---|---|---|
| Road | Deck the wheels drive on; weak (40 kN) | 1 | Thick dark band with dashed center line |
| Anchor | Fixed joint, part of the level | 1 | Big white bolt with a cross slot and shadow |
| Joint | Auto-created at piece ends | 1 | Small round bolt |
| Car | 1 t, 5 m/s | 1 | Small round coupe with a face |
| River rock | Carries anchors mid-river | 1 | Rounded grey rock with moss |
| Flag | Pass line | 1 | Checkered flag on a pole |
| Wood | Cheap, weak beam | 2 | Tan plank with grain lines, rounded ends |
| Face anchors | Anchors below the road on a bank face | 3 | Bolt set into the cliff with a metal plate |
| Truck | 3 t, 4 m/s | 4 | Boxy truck with a face and a cargo box |
| Steel | Strong, costly beam | 5 | Blue-grey I-beam with dark edges and rivet dots |
| Pre-built piece | Already built: yours (counts) or locked (free) | 6 / 9 | Locked: grey mossy wood with a padlock |
| Build area cap | Limits height or depth | 7 | Dashed outline |
| Canyon floor | Fall = "Crash!" | 11 | Rocky floor with dust |
| Uneven banks | Road must climb or descend | 13 | Banks at different heights; steep road gets a chevron |
| Cable | Tension only, long and light | 14 | Thin dark line; wavy when slack |
| Overhang anchors | Anchors above the road | 14 | Bolt under a rock ledge |
| Convoy | Two (or three) vehicles at once | 15 | Vehicles queued on the bank, "×2" tag |
| Tower | Pylon with anchors at several heights | 21 | Striped concrete pylon with bolt plates |
| Boat lane + boat | No-build lane; a boat sails under during the test | 22 | Hatched lane with a buoy at each corner; sailboat with a tall mast |
| Bus | 4 t, long, 3.5 m/s | 23 | Long bus with a face and windows |

## 6. Level design
- **Structure:** 30 levels in 3 worlds of 10.
  - **World 1 — River (1–10): "Triangles are strong."** Road, wood, triangles, supports from below, the truck, steel, mixing materials (stress view), rocks, repairing an old bridge. Gaps 4–16 m.
  - **World 2 — Canyon (11–20): "Push from below, hang from above."** Deep cliff anchors and curved arches, uneven banks and ramps, cables from overhangs (14), convoys (15). Gaps 8–20 m. No water: falls end in a dust cloud on the canyon floor.
  - **World 3 — Harbor (21–30): "Big spans need towers."** Towers and cable-stayed bridges, boat lanes that keep the middle clear and the deck stiff, the bus, suspension cables, a mid-harbor island tower. Gaps 14–24 m.
- **Teaching order:** each new element gets a safe intro level where it is the obvious answer, then a twist (a heavier vehicle, a tighter build area, an uneven bank), then a combination with older ideas. One new idea per level.
- **Variety, not just bigger gaps:** a level gets harder by changing *what* is asked: heavier or more vehicles, a smaller build area, fewer or awkward anchors, uneven banks, locked pieces, a boat lane, a tighter budget. Span grows slowly, and each world starts easier than the end of the last.
- **Difficulty curve:** World 1 needs 2–25 pieces, World 2 15–40, World 3 20–60. No level needs more than 60 pieces in its reference bridge (keeps building time under about 3 minutes on a trackpad).
- **Fair-play rules:**
  - every level's reference passes with peak ≤ 90%;
  - a lesson level also stores a **naive bridge that must fail** (for example, a bare road in level 2), checked by `simtest`, so the lesson can't silently disappear when physics is tuned;
  - the vehicle and the whole bridge area are always on screen;
  - **"barely made it" check:** `optimize.mjs` also searches with breaks allowed. If it finds a passing bridge (collapsing behind the vehicle) under 75% of the reference cost, the level is reworked (a heavier vehicle, a convoy, a boat lane), so these lucky-looking passes stay a fun surprise and don't make the 3-star target meaningless.
- **Vertical slice level:** level 4 **Big Wheels** (road, wood, the truck), exactly the brief's slice scope.
- **Hints:** after the **third failed test** in a level visit, a light-bulb button appears in the toolbar. Pressing it shows the level's one-line hint and draws 2–3 **ghost pieces from the reference bridge** (the level lists which ones). It never shows the whole answer.
- **Tutorial (no text screens):**
  - Level 1: a ghost hand drags a road piece from the left anchor to the rock until the first piece is placed; then the Test button pulses.
  - Level 2: after the first failed test, "Snap! Make triangles with wood", and the ghost hand drags a wood piece once.
  - Level 3: the face anchors pulse with "Push from below!".
  - Level 6: the eye button pulses with "Which steel is green? Draw wood over it to swap it."
  - The first time the Eraser is picked: "Tap pieces to remove them."
  - The first symmetric level with many pieces (level 5): the Mirror button pulses once.
  - Each prompt fades as soon as the player does the thing.
- **Stars:** see 3.9.
- **First 10 levels (River).** Costs are from the calibration prototype; final numbers come from the saved reference bridges in phase 3. "Peak" is the reference's highest stress ratio.
  1. **First Road** — 4 m creek with a rock anchor in the middle, car. Two road pieces, anchor to anchor (ghost hand). Reference $800; target $850, budget $1,100.
  2. **Snap!** — 6 m, car. A bare road breaks (54 kN against its 40 kN limit); a 1 m-tall wooden truss above the road (two slanted ends, a top chord, two posts and one diagonal) holds. Reference $2,260 (peak 73%); target $2,400, budget $3,000.
  3. **Under the Road** — 6 m, car, with anchors on both bank faces 2 m below the road. Two wood struts from below make it the cheapest bridge yet. Reference $1,760 (peak 44%). Level 2's truss also passes, but at $2,260, over the $1,850 target.
  4. **Big Wheels** — 6 m, first truck (3 t). Level 2's 1 m truss breaks (116%); a 2 m-tall truss holds. Reference $2,920 (peak 83%); target $3,100, budget $3,800.
  5. **Steel** — 8 m, truck, build area up to 2 m above the road. A 2 m all-wood truss breaks (109%). Steel unlocks: steel in the end diagonals and the middle of the top chord. Reference $5,620 (peak 86%); all steel passes at $7,580 (peak 40%), so the budget is set at × 1.35 ($7,600) to let it earn 2 stars.
  6. **Penny Pincher** — 10 m, truck. The level starts with an all-steel bridge of the player's own ($9,600, passes at 50%) that is over the $8,700 budget (× 1.15). The eye button pulses: draw wood over the green steel. Reference $7,560 (peak 71%).
  7. **Low Branches** — 10 m, truck, the build area stops 1 m above the road, anchors on both bank faces. A 1 m truss alone breaks (117% in steel); struts from both faces plus the 1 m truss hold. Reference $7,660 (peak 48%: steel top chord and inner diagonals, wood elsewhere). The optimizer already found $6,170 at 90%, so the target will drop in phase 3. A full truss under the deck also works at about $8,100.
  8. **Stepping Stones** — 16 m, truck, two rocks whose anchors sit 2 m below the road, plus face anchors. A trestle of struts and posts: steel struts, wood posts. Reference $7,150 (peak 58%); all-wood breaks (102%).
  9. **Old Bridge** — 10 m, truck. An old 1 m-tall wooden truss is already there (locked, free), with two diagonals missing. Filling the gaps still breaks (116%). A steel top chord built over it and tied to the old joints holds. Reference $3,390 (peak 85%).
  10. **River Exam** — 14 m, truck, a rock anchor 2 m below the road mid-river, and face anchors. Struts from the rock and the banks plus two small wood trusses: reference $7,500 (peak 63%), against $13,640 for an all-steel truss that ignores the rock (and only just holds, at 94%).
- **Levels 11–30 (plan, tuned in phase 3):**
  | # | Name | New idea | Vehicle(s) |
  |---|---|---|---|
  | 11 | Canyon Floor | Deep face anchors 3 m down: posts and struts from below; first "Crash!" | Truck |
  | 12 | Arch | A curved, braced arch from anchors 4 m down beats a flat truss over 14 m (prototype: ≈ $10,500 at 86%, against a flat steel truss at 94%) | Truck |
  | 13 | Uphill | Far bank 3 m higher: 1:2 ramps; steep road stalls ("Stuck!") | Car |
  | 14 | Hang On | **Cable** unlocks; overhang anchors 5 m above the road | Truck |
  | 15 | Convoy | Car and truck at once | Car + truck |
  | 16 | Downhill | Far bank 2 m lower; arch plus ramp | Truck |
  | 17 | Spire | A rock spire mid-canyon with a top anchor (cables) and a low anchor (struts) | Truck |
  | 18 | Rope Bridge | Locked old cables and road that sag too much; reinforce | Truck |
  | 19 | Two Trucks | Truck and truck, 12 m (the 8 m reference of level 5 breaks with two, 107%) | 2 trucks |
  | 20 | Canyon Exam | Uneven banks, high and low anchors, convoy | Car + truck |
  | 21 | Tower Power | Towers on both quays, anchors 6 and 8 m up: cable-stayed 16 m | Truck |
  | 22 | Boat Lane | A lane in the middle: no supports there, and the deck must not sag into the boat | Truck |
  | 23 | The Bus | Bus (4 t): cable-stayed 20 m (prototype: $10,160 at 53%); tip: flat cables squeeze the road, steep ones help | Bus |
  | 24 | Tall Ship | The lane rises 2 m above the quays: a hump bridge on 1:2 ramps | Truck |
  | 25 | Suspension | Main cable from tower top to tower top, hangers to the deck | Truck |
  | 26 | Island Tower | A tower on a mid-harbor island: 24 m (prototype: 3 towers ≈ $13,200 at 35%) | Bus |
  | 27 | Ferry Rush | Bus and truck, a boat lane | Bus + truck |
  | 28 | Old Pier | Locked old pier pieces; reinforce for the bus | Bus |
  | 29 | High Quay | Far quay 3 m higher; ramps plus cables | Bus |
  | 30 | Harbor Exam | 24 m, two boat lanes, convoy | Bus + truck |
- **Level data format** (one JS module per level in `levels/`, exporting this object, so levels load without `fetch`):

```json
{
  "id": "w1l04",
  "name": "Big Wheels",
  "world": "river",
  "terrain": [
    [[0, 7], [13, 7], [13, 14], [0, 14]],
    [[19, 7], [32, 7], [32, 14], [19, 14]]
  ],
  "water": 10,
  "anchors": [[13, 7], [19, 7]],
  "buildArea": [11, 3, 10, 7],
  "noBuild": [],
  "prebuilt": [],
  "materials": ["road", "wood"],
  "vehicles": ["truck"],
  "boat": null,
  "flag": 22,
  "reference": 2920,
  "budget": 3800,
  "target": 3100,
  "mirror": true,
  "hint": "Taller triangles are stronger.",
  "hintMembers": [[13, 7, 14, 5], [14, 5, 15, 7]]
}
```

  All coordinates are grid cells (1 cell = 1 m = 40 px) from the playfield's top-left, y down. `terrain` is a list of solid polygons. `water` is the water row (omit for a canyon floor). `buildArea` and no-build `rect`s are `[x, y, w, h]`. A no-build zone is `{ "rect": [x, y, w, h], "kind": "waterfall" | "rock" | "lane" }`. A prebuilt piece is `[x1, y1, x2, y2, "wood", true]`, where the last value is `locked`. `vehicles` is the convoy order. `boat` is `{ "lane": [x, y, w, h], "start": 2.4, "speed": 2 }` (start in seconds of test time, speed in m/s). `flag` is the flag's x. `mirror` turns on the Mirror tool (symmetric terrain and anchors only; the editor checks it). `reference` and the two thresholds are written by the tools, not typed by hand.
- **Solution files** (repo only, not shipped): `levels/solutions/<id>.json` = `{ "v": 1, "level": "w1l04", "cost": 2920, "peak": 0.85, "members": [[13, 7, 15, 7, "road"], …], "naive": [[13, 7, 15, 7, "road"], …] }`. `naive` is optional: a bridge that must fail.

## 7. Progression and retention
- **Unlocks:** any pass unlocks the next level. A world unlocks when the previous world's level 10 is passed. No star gates.
- **Personal best:** each level keeps your **cheapest passing bridge** and its cost. The level tile shows the stars, the best cost and the hard hat. In build mode, the pause menu's **Load my best bridge** brings it back (undoable). The results panel's **Replay** re-runs the passing test, which is exactly the same every time.
- **Garage:** 7 cosmetic skins unlock automatically at total star counts, item *k* at round(*k* × 12) stars (the last at 84 of 90). No currency.
  - Car: Taxi, Beach Buggy, Rocket Car.
  - Truck: Ice Cream Truck, Fire Truck.
  - Bus: School Bus, Party Bus.
  - Each vehicle keeps its size, face and weight tag, so readability never changes.
- **Return reasons:** missing stars and hard hats on the level select, the "engineer's cost" shown after a third star, the next garage skin with its star count on the title, and the "there's always a cheaper bridge" itch.
- **No daily challenge** in v1 (the brief has none); a daily bridge is in Later.

## 8. Screens and UI flow
- **Title:** logo; a live demo of a truck crossing a small bridge that collapses just behind it (the real simulation with a stored bridge, deterministic); a big **PLAY** button that opens the next unpassed level in one click; **LEVELS**, **GARAGE**; music and sound toggles.
- **Level select:** 3 world tabs, 10 tiles each with stars (★ shapes), best cost, hard hat, and the next level highlighted and bouncing. Tapping a tile opens the level at once (your last bridge restored).
- **Playing, build mode:**
  - **Top bar (64 px, information only):** level number and name at the left; the **cost meter** in the middle; the vehicle card ("Truck · 3 t", or "×2" for a convoy) at the right.
  - **Cost meter:** a 440 px bar filled to the current cost, with a ★★★ tick at the target, a ★★ tick at the budget and a small flag at your best, plus the text "$2,920 / budget $3,800". Over budget the fill turns red with a ⚠ icon and the label "Over budget: 1 ★ max".
  - **Toolbar (96 px):** Pause | Road, Wood, Steel, Cable (each with its icon, "$200/m" and its key number; locked materials are hidden) | Eraser, Undo, Clear | Mirror (symmetric levels only), Stress view | Hint (light bulb, after 3 failed tests) | the big **TEST** button at the right. At most 11 buttons of 80 px plus the 200 px Test button: 1,176 px, inside 1,280.
- **Playing, test mode:** the build grid fades out, the toolbar swaps to **STOP**, **RESTART**, **⏩ FAST**, and the cost meter stays. Stress colors are live.
- **Pause:** Resume, Load my best bridge, Clear bridge, a controls card (draw, chain, erase, test), Menu.
- **Level complete:** the vehicle honks at the flag, confetti; the panel slides in with:
  - the stamp (MADE IT! / HELD TOGETHER! / CLOSE CALL!);
  - 3 stars stamping in one by one;
  - the cost counting up against the target and budget lines, the best cost, and the hard hat if earned ("You beat the engineer!");
  - the engineer's cost once the level has 3 stars;
  - buttons **Next**, **Improve** (back to build with this bridge), **Replay**, **Menu**.
- **Garage:** the three vehicles on pedestals with their skins; locked skins show their star count.

## 9. Art direction
- **Family:** Toybox Flat: a cardboard-and-wood diorama with bright flat shapes, thick dark outlines, soft drop shadows and a warm light background.
- **Palette** (6 base colors; every other tone is a tint or shade of these):
  | Hex | Role |
  |---|---|
  | `#F6EFE3` | Cream: sky base, panels, UI background |
  | `#2B2B2B` | Ink: outlines (3 px), text, road asphalt, cables, shadows at 15% |
  | `#4AA3DF` | Blue: water, sky tint; shaded towards ink (`#47708F`) it is steel |
  | `#5CC46B` | Green: low stress, pass, grass, the TEST button |
  | `#FFC93C` | Yellow: mid stress, stars, the road's center line, the cost meter; its warm shade `#C98F55` is wood and `#A86E3F` is earth and cliffs |
  | `#EF5B5B` | Red: high stress, breaks, fail stamps, the default truck |

  World tints, all from the base colors: River is light blue sky and green banks; Canyon is warm cream with terracotta cliffs from the earth shade; Harbor is a blue evening sky with ink-grey quays and towers.
- **Key visuals:** chunky pieces with rounded ends and visible bolts at every joint; cute vehicles with big eyes; cardboard-cutout scenery at the edges (trees, cacti, cranes, lighthouses) that never covers the build area; the snap grid as soft dots inside the dashed build area only.
- **Rendering:** all art drawn in code. Background, terrain and scenery are pre-rendered once per level to an offscreen canvas; only pieces, vehicles, the boat and particles are drawn each frame (at most 160 pieces).
- **Juice list:**
  - **Placing:** the piece pops in with a squash (110% → 100% in 120 ms), joints bounce, and a dust puff appears on anchors. The cost meter ticks up with a small bounce, and its fill flashes when it crosses a star line.
  - **Invalid:** the ghost wiggles left-right 3 px.
  - **Test start:** the bridge settles visibly during the 0.5 s gravity ramp; the vehicle honks twice and bounces on its wheels.
  - **Creaks:** members at 90% or more shake by ±1 px.
  - **First break** (only when it is a new member, see 3.7): time slows to 0.3× for 1 s and the camera eases in 1.3× around the point between the break and the vehicle, then eases back over 0.4 s. Splinters (wood), sparks (steel), a whip (cable) or chunks (road), plus a 4 px shake for 150 ms. Later breaks get particles and the shake, without slow motion.
  - **Falling:** the vehicle's "O" mouth; a big splash or a dust cloud; 8 px shake. The stamp slams in with a squash.
  - **Pass:** the camera eases 1.15× onto the vehicle at the flag, then confetti, a horn and the driver's grin.
  - **Results:** stars stamp in with count-up numbers; the hard hat drops onto the panel with a bounce.
  - **Boat:** wake particles; on a bonk, the mast wobbles and the boat stops.
- **Concept art prompts** (updated from the brief):
  - **Gameplay screenshot (16:9):** *"Flat cartoon bridge building puzzle game in a cardboard diorama style, side view, a cute red toy truck (#EF5B5B) with big eyes crossing a truss bridge made of tan wooden planks (#C98F55) and blue-grey steel I-beams with rivets over a light blue river (#4AA3DF), beams tinted green, yellow and red by stress, a thick dark road deck with a yellow dashed center line, big white bolt anchors on the riverbanks, a dashed build outline and soft grid dots, a checkered flag on the far bank, warm cream sky (#F6EFE3), thick dark outlines (#2B2B2B), soft drop shadows, 2D game screenshot, 16:9"*
  - **Key art / thumbnail (16:9 and 1:1, no text):** *"a cute toy truck with big worried eyes bravely crossing a wooden and steel truss bridge over a river, the bridge creaking with one beam glowing red and snapping into splinters right behind it, dust puffs, a sweat drop on the truck, cardboard diorama look, flat vector cartoon style, bright flat colors, thick dark outlines, soft drop shadows, warm cream background, toy-like and clean, highly readable shapes, centered composition with room for a title, game key art"*
  - **Character and element sheet:** *"pieces on a plain background: a tan wooden plank beam with grain lines, a blue-grey steel I-beam with rivets, a thin dark cable, a thick dark road segment with a yellow dashed line, a small round bolt joint, a big white anchor bolt, a striped concrete tower, a river rock with moss, a cute small red car, a red truck and a yellow bus, all with big eyes, a sailboat with a tall mast, a checkered flag, a beam snapping with splinters and a dust puff, stress colors from green to yellow to red with zigzag warning chevrons, flat vector cartoon style, bright flat colors, thick dark outlines, soft drop shadows, warm cream background, toy-like and clean, highly readable shapes, game asset sheet on a plain light background, evenly spaced, consistent scale"*
  - **Logo:** *"the words "BRIDGE BUDGET" in chunky letters built from wooden beams and steel bolts, a tiny red truck with eyes driving across the top of the letters, a little dollar coin as the dot of a letter, flat vector cartoon style, bright flat colors, thick dark outlines, soft drop shadows, warm cream background, toy-like and clean, highly readable shapes, game logo on a plain background, bold and readable at small size"*
  - **Negative prompt:** *"text, letters, watermark, signature, photorealistic, gritty, horror, violence, weapons, blood, cluttered background, blurry, low contrast, extra limbs, UI buttons"* (drop "text, letters" for the logo).

## 10. Audio
| Sound | When | Character |
|---|---|---|
| Place wood | Wood piece placed | Wooden knock; pitch lower for longer pieces |
| Place steel | Steel piece placed | Short metallic clank |
| Place cable | Cable placed | Taut zip-twang |
| Place road | Road piece placed | Soft thunk |
| Erase / clear | Piece removed / bridge cleared | Pop / paper-crumple whoosh |
| Undo | Undo | Quick reverse whoosh |
| Invalid | Release on an invalid end | Soft bonk |
| Engine | Test start and while driving | Two honks, then a low hum whose pitch follows speed |
| Creak | While any member is above 50% | Filtered noise bursts; rate and volume rise with the highest stress ratio; wood creaks, steel groans |
| Snap | A member breaks | Wood crack / steel clang with a ping / cable whip / road crunch |
| Splash / crash | Vehicle or debris hits water / canyon floor | Big splash / thud with rock clatter |
| Bonk | Boat hits the bridge | Wooden bonk and a foghorn |
| Pass | Vehicle at the flag | Horn plus a small crowd cheer |
| Close call | "CLOSE CALL!" stamp | Relieved "phew" whistle |
| Star | Each star stamps in | Stamp thump plus a rising note |
| Hard hat | Badge earned | Hard-hat knock plus a ding |
| UI | Buttons | Soft click |

Music: **yes, on by default**, synthesized in WebAudio (tiny), with its own toggle. Flip Runner's first build felt bland without music; a builder needs the same lift.
- **Build mode:** a light "toy workshop" loop, 8 bars of marimba-like plucks, soft kick and shaker at ~100 BPM, quiet under the sound effects.
- **Test mode:** the same loop adds a snare roll whose volume follows the highest stress ratio, so tension is audible.
- **Endings:** a short brass fanfare on a pass, a comic two-note "wah-wah" on a fail.

Music and sound effects have separate toggles, and both persist.

## 11. GameAnalytics
| Event id | When it fires | Value |
|---|---|---|
| `Start:world0N:level0M` | Level opened (Play, level select, Next) | — |
| `Complete:world0N:level0M` | First passing test in this visit of the level | Stars of that pass (1–3) |
| `Fail:world0N:level0M` | Leaving the level (menu, level select) without any pass in this visit | Tests run this visit |
| `level:giveup` | Leaving a level that has **never** been passed, without passing | Tests run this visit |
| `test:pass` | Every passing test | Bridge cost ($) |
| `test:fail:fall` / `test:fail:stuck` / `test:fail:boat` / `test:fail:time` | Every failing test, by reason | Bridge cost ($) |
| `level:tests_to_pass` | With `Complete` | Tests run before the first pass, this visit |
| `level:cost` | Leaving a level that was passed in this visit | Cheapest passing cost this visit |
| `level:optimize` | Leaving a level that was passed in this visit | Tests run after the first pass (0 = stopped at the first pass) |
| `level:stars_up` | A pass beats the level's saved stars | New star count |
| `material:road:used` / `material:wood:used` / `material:steel:used` / `material:cable:used` | With `Complete`, one per material in the passing bridge | Meters of that material |
| `badge:engineer` | First hard hat on a level | Bridge cost ($) |
| `tutorial:step01` | First piece ever placed (level 1) | — |
| `tutorial:step02` | First test ever | — |
| `tutorial:step03` | First failed test ever (level 2) | — |
| `tutorial:step04` | First wood piece placed | — |
| `tutorial:step05` | First time the stress view is opened | — |
| `tutorial:done` | Level 6 passed | — |
| `ui:hint` | Hint button pressed | — |
| `ui:undo` | Leaving a level, if > 0 | Undo presses this visit |
| `ui:restart` | Leaving a level, if > 0 | Test restarts (R) this visit |
| `ui:stressview` | Leaving a level, if > 0 | Times the stress view was opened this visit |
| `ui:clear` | Clear pressed | — |
| `ui:fast:on` | Fast-forward switched on | — |
| `ui:mirror:on` | Mirror switched on | — |
| `ui:best` | "Load my best bridge" used | — |
| `garage:equip:<skin>` | Skin equipped | — |
| `settings:music:off` / `settings:sfx:off` | Toggle switched off | — |

- **Fail means leaving without a pass**, not a failed test: in a builder, failing tests is how you solve the level. Clearing the bridge isn't a fail either. Failed tests have their own events, with the reason.
- Per-action counts (undo, restarts, stress view) are sent **once per level visit with a value**, never per press. Tests are sent one by one because the brief asks for them (a test takes 5–10 s, so the volume stays low).
- Events log to the console in development (`STANDARDS.md`).

**Question the data must answer:** how many tests does a solve take (`level:tests_to_pass` per level), and do players keep optimizing after the first pass (share of passed visits with `level:optimize` > 0, `level:cost` against the first passing cost, `level:stars_up`)? Also: which levels make players give up (`level:giveup`, which, unlike `Fail`, ignores optimization revisits of passed levels), and which material they reach for (`material:*:used`).

## 12. Tech plan
- **Stack:** vanilla Canvas 2D, ES modules, no build step (`STANDARDS.md`). Useful code from Magnet Twins and Flip Runner is **copied** into this folder, not imported: the fixed-step accumulator loop, letterboxed resize with `devicePixelRatio`, `save.js`, the `analytics.js` stub, the `audio.js` synth and Flip Runner's music sequencer, `fx.js` pooled particles and shake, canvas buttons and panels, and the `window.game` hook.
- **Modules (`src/`):**
  - `main.js`: boot.
  - `game.js`: frame loop, screens, HUD glue.
  - `config.js`: every tuning number in this GDD, in one place.
  - `sim.js`: the deterministic world: joints, members, vehicles, contacts, breaking, boat. No DOM, runs in Node.
  - `bridge.js`: the editable bridge. Grid joints and members, validation (lengths, terrain, zones, overlap, auto-split), costs, serialization, undo/redo.
  - `build.js`: build-mode input (drag and click-click gestures, snapping, ghost, eraser).
  - `level.js`: parser.
  - `render.js`: pre-rendered level layer, pieces, stress drawing, vehicles.
  - `camera.js`: test camera, slow motion.
  - `fx.js`, `ui.js`, `input.js` (Pointer Events and keys), `audio.js`, `save.js`, `analytics.js`.
- **Hot loop:** typed arrays for joint positions and velocities, members and contacts; the road-member list rebuilt only when something breaks; no allocations per step. **Budget: under 2 ms per 120 Hz step for a 160-member bridge at 4× CPU throttle.** The calibration prototype (plain JS objects, allocating every substep) ran a 142-member bridge with the bus at **0.35 ms per step** on a desktop.
- **Calibration results** (prototype; each becomes a `simtest` check):
  - A loaded king-post truss settles to member forces within 1% of hand statics (vertical 11.15 kN against 11.18 kN expected).
  - Pass/fail outcomes agree between 8 and 16 substeps; 4 substeps flips borderline cases, so 8 is the minimum.
  - With members soft enough to bend visibly, a whole bridge bobs at about 1 Hz after gravity switches on, and axial damping alone barely touches that mode (still 2 cm/s after 12 s at 20 /s). The settle phase plus 100 /s axial damping brings it under 3 cm/s by 1.5 s, and changes truck peaks by under 3 points.
  - Slopes: 1:2 and 2:3 ramps are climbed by every vehicle; a 4 m-high 45° ramp stalls all of them.
  - Two identical runs give bit-identical joint positions.
- **Tools (`tools/`, Node, never shipped):**
  - `simtest.mjs` runs the mechanics checks above, plus three more: determinism across different frame-time sequences (60 Hz, 144 Hz, fast-forward); every level's reference passing with peak ≤ 90% and no breaks; every stored naive bridge failing. It also recomputes target and budget from each reference cost and flags a mismatch.
  - `optimize.mjs` (phase 3): a greedy pass that tries swapping each steel piece to wood and removing each non-road piece, keeping any change that still passes at peak ≤ 90%, to push references (and so targets) down. It was prototyped for this GDD: it found levels 5–10's references above in about 1 s each. A second mode allows breaks, for the "barely made it" check (6).
- **Level editor** (phase 3, debug only, `?editor`): paint terrain polygons, place anchors, build area, zones, boat lane, vehicles and flag; build the reference with the normal build tools; **Save reference** writes the solution file and fills in `reference`, `target` and `budget`. Thirty levels with hand-typed polygons would be slow and error-prone.
- **Save keys:**
  - `cm_bridge-budget_save` → `{ v: 1, stars: { "w1l04": 3 }, best: { "w1l04": { cost: 2900, members: [...] } }, last: { "w1l04": [...] }, hats: { "w1l04": 1 }, skins: { car: 0, truck: 0, bus: 0 }, tut: {} }`. Bridges are stored as member lists in grid coordinates, about 3 KB for 160 pieces, so the whole save stays under 200 KB.
  - `cm_bridge-budget_settings` → `{ v: 1, music: true, sfx: true, fast: false }`.
  - Reads in `try/catch`; broken data resets to defaults. Saved after every pass, every settings change, and (for `last`) 1 s after a build change.
- **Audio and tab rules:** the `AudioContext` is created or resumed on the first click or key press; a hidden tab pauses the loop and the test (`STANDARDS.md`).
- **Testing hook:** `window.game` with `screen` (`'title' | 'levels' | 'playing' | 'complete'`), `mode` (`'build' | 'test'`), `level`, `score` (current bridge cost), `bridge` (read-only copy), `start()`, `restart()` (restart the test), and debug-only `win()` and `loadBridge(json)`.
- **Riskiest piece:** the simulation's feel and stability on a real Chromebook (a heavy truck on light joints, many pieces, breaking cascades). **Prove it first** in phase 2: port the prototype's numbers into `sim.js` and `config.js`, write `simtest.mjs` with the calibration checks on day one, then build a `?level=sandbox` with the reference bridges of levels 1–5 and a 160-piece stress bridge, and measure milliseconds per step at 4× CPU throttle.
- **Second risk:** building on a trackpad. Test drag versus click-click with tap-to-click on a real Chromebook in the first feel loop, and watch a new player build level 2.

## 13. Scope
- **v1:**
  - the simulation, building and stress view of section 3;
  - Road, Wood, Steel, Cable; Mirror tool;
  - car, truck, bus and convoys; towers, boat lanes, locked pieces;
  - 30 levels in 3 worlds;
  - hints, best bridge and replay, hard hats, garage (7 skins);
  - full shell, saving, sound and music, analytics;
  - `simtest`, `optimize` and the debug level editor.
- **Later:**
  - hydraulics and drawbridges (the brief's Later);
  - sandbox mode;
  - a move-joint tool;
  - reinforced road (a stronger, pricier deck);
  - jump levels (at 4–5 m/s vehicles only hop about 2 m, so jumps need a boost element first);
  - a daily bridge (same level for everyone, emoji result line);
  - 2× zoom for phones;
  - shareable bridge codes;
  - a ghost of your best bridge drawn in build mode.
- **Cut:**
  - **Bending and buckling:** members are pin-jointed rods. Bending would hide forces the stress colors can't show, and a length-based buckling rule is invisible.
  - **Bridge parts colliding with terrain:** it would let piles of debris act as free supports and make tests harder to predict.
  - **Two members on the same joint pair:** replace-on-redraw is clearer; reinforced road covers the real need later.
  - **Live stress prediction while building:** it spoils the test, which is the reward.
  - **Zoom and pan in v1:** every level fits one screen (see 4).
  - **Lives, timers or test limits:** testing is free and instant; failing is part of solving.

## 14. Open questions
| Question | Recommendation | Who decides | Status |
|---|---|---|---|
| Is a 40 kN road too weak on long spans, since it can't be reinforced? | Keep it; log the first broken material per failed test in the phase 2 sandbox. If the road breaks first in more than 30% of failed tests on World 2–3 references, raise it to 50 kN and re-run `simtest` (level 2 still fails: 54 kN against 50 kN) | Fafi | Open |
| Should a pass over budget earn a star? | Yes (1 ★): nobody gets stuck. `level:optimize` will show whether players still chase the budget | Team | Open |
| Music on by default in a calm builder? | Yes, quiet, with its own toggle; check in the first feel loop | Fafi | Open |
| Do phones need zoom (25 px cells at 800×450)? | Not for v1 (nearest-joint picking, lifted labels); test on a phone in phase 2, add 2× zoom later if needed | Team | Open |
| Is 2× fast-forward enough for Harbor tests (about 10 s at 1×)? | Yes; add a 4× step only if playtests ask | Fafi | Open |
| Coolmath SDK, ad breaks, branding, size limit | Ads only after **Next** on the results screen, never in build or test mode | Team | Open |
| GameAnalytics game key and secret | One key per game in a config file | Team | Open |

## 15. Changelog
- 2026-10-26 — Phase 1c review applied. Status set to In review.
  - **No more jelly:** soft members made the bridge bob at about 1 Hz for over 10 s; added a 1 s settle phase and raised axial damping to 100 /s.
  - **Numbers re-verified:** every level 1–10 claim re-run with the final settings and updated. Level 7's reference changed to a robust $7,660 at 48%; level 23's flat-cable claim became a hint.
  - **Mirror tool** on symmetric levels, to halve building time on a trackpad.
  - **Slow motion** only when the first break is a new member; fail stamps can be skipped.
  - **Results lock at the pass** (later collapses and bonks are animation); vehicles drive off-screen after the flag.
  - **"Barely made it" check** in `optimize.mjs`, so collapsing passes can't empty the 3-star target.
  - **Analytics:** `level:giveup` (never-passed levels only) and `ui:mirror:on`.
  - **Teaching and controls:** replace-by-drawing taught in level 6; R always runs the test from the start.
  - **Layout and shell:** cost preview moved from the ghost label to the cost meter; hint button moved into the toolbar; minimum text size; tab and audio rules; level 4 named as the vertical slice level.
- 2026-10-26 — First draft from the brief and the phase 1a answers. Key decisions:
  - XPBD spring-mass at 120 Hz × 8 substeps, with gravity ramp, axial damping and step-averaged breaking; arithmetic-only and deterministic.
  - Material table with a weak road; vehicles at 1 / 3 / 4 t.
  - Pass even with broken members; 1 star at any cost, 2 under budget (reference × 1.3), 3 under target (reference × 1.05), plus a hard hat at the reference cost.
  - Automatic joints, drag or click-click building, ghost preview with cost, reach and connections; replace on redraw; eraser and undo; no move tool, zoom or pan.
  - First break marked and stress view after every test.
  - Three worlds that add terrain, cables, convoys, towers, boats and the bus rather than only bigger gaps.
  - Numbers calibrated with a throwaway prototype (not in the repo).
