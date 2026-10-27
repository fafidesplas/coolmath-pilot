# Ink Path — Game design document

**Status:** In review
**Owner:** Fafi · **Reviewed by:** — · **Last updated:** 2026-10-26

> Draw one line with a small pot of ink, let go, and Dot the ball drops and rolls along it into the cup. Any line that works wins; a clever, short line wins three stars.

## 1. Summary
- **Pillars:**
  1. **Your line, your answer.** Many different lines solve a level. Cups are generous, smooth curves keep Dot's speed, small bumps roll over, and no solution needs pixel precision.
  2. **Instant tries.** Let go and Dot drops at once. A lost ball fails in about a second, and starting a new line restarts immediately. No confirm buttons, no waiting.
  3. **See it before you draw it.** Ink left, star marks, Dot's drop point, no-ink zones, pad throws, air streams and rails are all shown before Dot moves. The only surprise is how clever your line was.
- **Player:** Coolmath players aged 10–24 at a desk or in class, on a school Chromebook with a trackpad (main case), a mouse, or a tablet. Sound often off.
- **Session:** One level takes 30 s–2 min: 1–6 tries of 2–4 s each, plus thinking. A typical visit is 15–25 minutes (a world, or a star hunt).
- **Hook:** "I can do it with less ink." The star notches on the ink meter and the ghost of your last line make a shorter try irresistible. Hardcore players chase the designer's own ink record.

## 2. Core loop
- **Moment (seconds):** Look → draw (the meter drains, star icons pop off as you pass them) → let go → Dot drops, rolls, jumps → plop into the cup, or miss → draw again.
- **Level (minutes):** Find a line that works (1★) → find the trick that saves ink (3★) → results: stars, ink %, tries.
- **Meta (days):** Stars unlock pen colors and line styles → each world adds new elements → come back for missing stars and dev records.

## 3. Mechanics

### 3.1 Space and scale
- Design resolution 1280×720. The HUD bar takes the top 80 px; the playfield is 1280×640 (origin at its top-left, y down). One level is one screen; no camera.
- Level geometry uses free px coordinates, snapped to 10 px in the editor.
- At 800×450 everything scales by 0.625: Dot is 22 px across, still readable with its thick outline and face.

### 3.2 Simulation
- Fixed step at **120 Hz** with an accumulator (frame `dt` capped at 0.05 s), as in Magnet Twins and Flip Runner. Nothing in the level moves until Dot drops; step 0 is the drop. The same stroke always gives the same run.
- **Deterministic and portable:** the sim uses only `+ − × ÷` and `sqrt` (exact in IEEE 754 in every browser), never `Math.sin`, `cos`, `atan2` or `Math.random`. Directions in level data are unit vectors, not angles. Trig is allowed in rendering only. So saved best lines replay identically on any machine.
- Bodies: 1–2 balls (circles). Everything else is static or kinematic: walls (polygons), the ink stroke (a chain of capsules), cups, pads, buttons, gates and ferries.

### 3.3 Dot (the ball)
- **Radius 18 px.** Gravity **1800 px/s²** (falling the whole 640 px playfield takes 0.84 s). Space levels use 0.7× gravity (3.12).
- **Max speed 1500 px/s** (12.5 px per step, less than the 23 px contact distance to a line, so Dot never tunnels through ink).
- **Rolling:** Dot slides with a rolling resistance of **60 px/s²** while touching anything. It keeps rolling on any slope steeper than 1.9°; at 400 px/s on a flat line it rolls about 1300 px. Its spin and face rotation are visual only, from its speed along the surface.
- **Contacts (tuned with a scratch simulation, see 15):**
  - **Ink does not bounce** (restitution 0): Dot lands on a line and rolls along it. **Walls** bounce at 0.3 when hit faster than 60 px/s.
  - **Glancing hits keep speed:** if Dot meets a surface at less than 25° to its path, it is turned along the surface at the same speed. This is what makes smooth curves and ramps keep Dot's speed (measured: a drawn quarter-pipe keeps 98–100% of the ideal speed; without the rule Dot loses about 10% of its speed in every curve). Steeper hits lose the part of the speed going into the surface.
  - **Small lips roll over:** a stroke end or a convex wall corner that sticks at most **10 px** into Dot's path (measured across its direction of travel) lifts Dot over it at 95% speed, like Flip Runner's auto-step. Players' lines rarely meet walls flush; this keeps a line that starts 4 px too high from killing the run. Joints inside a stroke never trigger it.
- **Face:** looks at the pen tip while you draw, squints at the trapdoor, opens its mouth when fast, squashes on landings, grins in the cup, goes dizzy on a fail.

### 3.4 The pen and the ink
- **One stroke per attempt.** Press in the playfield and drag; the line follows the pointer.
- **Smoothing:** the pen tip trails the pointer on a 4 px "lazy string" (it moves only when the pointer is more than 4 px away), which removes trackpad jitter. A point is added when the tip has moved 6 px. Coalesced pointer events are used so fast strokes stay smooth.
- **Ink pot:** each level has a pot measured in px of line (`ink`, 160–1000). Ink used = length of the drawn line. The HUD meter and the ring at the pen tip both show the ink left.
- **Blocked areas:** the pen cannot draw inside walls, cups (walls and inside), pads, fans' bodies, buttons, closed gates and their housings, ferry rails (3.10), no-ink zones (3.6), a 32 px circle around each waiting ball and its trapdoor, the HUD, or outside the playfield. When the next bit of line would enter one, **the tip stops at the edge**, a thin red tether runs from the tip to the pointer with a ✕, the area's hatching flashes and a soft "tk" plays. Drawing resumes when the pointer comes back within 40 px of the tip with a clear straight path, so the line never jumps.
- **Starting on a blocked spot:** nothing is drawn until the pointer reaches a free spot; the line starts there.
- **Out of ink:** the tip stops, the ring shows an empty pot and the tip sputters. The line is final; Dot drops when you let go.
- **Lines may cross themselves** (loops are fine) and may touch walls. Direction does not matter: a line drawn from the cup back to Dot works the same.
- **Let go:** a line under **20 px** is ignored (a click does nothing, no attempt is counted). Otherwise the line is simplified with Ramer–Douglas–Peucker at **ε = 1.5 px**, rounded to whole pixels, and becomes solid. The simplification is not just for speed: without it, the ±1 px jitter of a hand-drawn gentle line leaves tiny pockets where Dot gets stuck on slopes under 6°. Stars use the ink the meter showed (the drawn length), never the simplified length.
- **Collision shape:** a chain of capsules of radius 5 px around the simplified line (drawn 10 px thick), so the contact distance from Dot's center is 23 px.
- **Cancel:** Z (or Backspace) while drawing removes the line and gives the ink back; nothing drops and no attempt is counted. Pointer-only players just let go and draw again.
- **Interruptions:** `pointercancel`, window blur or a hidden tab cancel the stroke (no drop). Pointer capture keeps the stroke when the pointer leaves the canvas. Only the first pointer draws; extra fingers are ignored.

### 3.5 Drop, run, retry
- **Drop:** 150 ms after you let go (the ink "sets" with a glossy flash), the trapdoor under each ball opens and the balls drop from rest. Every ball always starts in a trapdoor.
- **Drop preview:** while you draw, a thin dotted line runs straight down from each waiting ball to the first solid thing below it (including the line being drawn), ending in a small ✕. If nothing is below, it runs off the bottom with a ↓.
- **Draw again any time:** pressing and dragging more than 6 px in the playfield during a run abandons the run at once: the balls snap back into their trapdoors, the old line becomes the ghost (3.5) and the new line starts. A press without a drag does nothing, so stray clicks never reset a run. Input is ignored during the win celebration.
- **R / ↻ button:** resets the attempt (balls back, line becomes the ghost). Pressed while drawing, it cancels the line like Z.
- **Ghost:** the previous attempt's line stays as a faint line (25% opacity) until the next release, so the next try can be "a bit higher than last time".
- **Overlay styles (never two alike):** your line is solid and glossy; the ghost is the same line, solid but faint; the hint (7) is a grey pencil line of dots with a 💡 at its start; the level 1 guide is a dashed line traced by the ghost hand; the drop preview is a thin vertical dotted line ending in ✕; the blocked tether is short, red and ends in ✕. Star beads sit only on the live line, never on the ghost.
- **Attempts:** each drop is one attempt. The HUD shows "Try 3"; attempts never affect stars.

### 3.6 Failing fast
An attempt fails as soon as one of these happens to any ball:

| Cause | Rule | Bubble on Dot |
|---|---|---|
| Lost | Center leaves the playfield by 40 px at the left, right or bottom (off the top is allowed; an arrow at the top edge tracks it) | "Oops!" |
| Stuck | Stays inside a 24 × 24 px box for 1.0 s, or rolls to a stop and turns back for the second time (its sideways motion reverses under 60 px/s while touching a surface) | "Stuck!" |
| Loop | Comes back within 8 px and 30 px/s of a state it had 0.5–4 s earlier while no ferry or gate is moving (endless pad bouncing, hovering in air) | "Dizzy!" |
| Timeout | 12 s after the drop | "Too slow!" |

- Measured in the scratch sim: a ball rocking in a valley used to take 12 s to give up; with the turn-back rule it fails in about 2 s. Endless pad bounces fail at 1.4 s, hovering in an updraft at 2.0 s.
- **Fail feedback:** Dot's face and bubble for 0.3 s (lost balls splat at the screen edge), then the reset: the line fades to the ghost, the balls pop back into their trapdoors, the meter refills with a glug (0.25 s). You can start drawing at any moment of this; the animation is skipped.

### 3.7 Cups and winning
- **Cup:** a U of 12 px walls, **inner width 104 px** (worlds 1–2) or **80 px** (small cup, worlds 3–4), 64 px deep. A cup stands on a surface or sits sunk in a floor with its rim flush (the floor leaves a 2 px gap on each side, which Dot rolls over smoothly).
- **Backboard (optional):** the back wall rises 120–160 px above the rim, so overshoots drop in. Used in early levels and wherever an overshoot should be forgiven. It is part of the cup, never a separate wall (a separate wall leaves a slot where Dot gets stuck, found in the scratch sim).
- **Capture:** a ball is in when its center is within (inner width / 2 − 6 px) of the cup's center line and lower than 12 px above the rim. It is captured at once: it leaves the simulation and plops into the cup with a squash. A sunk cup that Dot crosses faster than about 1300 px/s can be skipped over, as in real life.
- **Win:** every ball is in a cup (any ball, any cup; a cup holds two). The results follow about 1 s after the last capture. Labels: "Swish!" if the ball touched no cup wall, "Rim!" if it touched the rim first; a lost ball that passed within 24 px of a cup's mouth shows "So close!".

### 3.8 Stars
- Stars come **only from ink**, one rule, readable at a glance:
  - ★ reach the cup (always within the pot);
  - ★★ use no more ink than the ★★ mark;
  - ★★★ use no more ink than the ★★★ mark.
- The marks are notches on the ink meter, each with a star icon and a numeral (★3, ★2), so they don't rely on gold/silver colors. While drawing, the star icon pops off the meter with a "pip" the moment you pass a notch, and a small star bead is left on the line at that point.
- Best stars and **best ink** (lowest %) are kept per level, each on its own (the best ink may come from a different run than the best stars).
- **Dev record:** after 3★ the results show the designer's best ink for the level ("Dev: 21%"). Matching or beating it gives the level a **gold nib** badge. It is not a star.
- **Setting the marks** (from the two reference lines, 6):
  - ★★★ mark = gold line's ink × 1.15, rounded up to 10 px (room for hand drawing);
  - ★★ mark = halfway between the ★★★ mark and the easy line's ink, rounded up to 10 px;
  - pot = easy line's ink × 1.25, rounded up to 10 px.
  - Example (level 4): gold 90 px, easy 126 px → ★★★ 110, ★★ 120, pot 160.
  - Levels 1–2 set their marks by hand (tracing the guide earns 3★). A level may lower its pot when the pot is the puzzle (level 4's pot forbids a bridge); the test only checks the order: gold ink × 1.1 ≤ ★★★ < ★★ < easy ink ≤ pot ÷ 1.1.

### 3.9 Jelly pads (world 2)
- A pad is a block with one springy face (yellow jelly with ^^^ chevrons on that face; the other faces act as walls).
- Touching the springy face throws the ball out along the face's normal at a **fixed 1080 px/s**, keeping its speed along the face. A ball thrown straight up rises **324 px** (463 px in Space). Fixed speed means the throw height never depends on how Dot arrived: predictable.
- **Throw preview:** a faint dotted line along the pad's normal, 324 px long (the height a resting ball would reach), ending in a chevron.
- A pad fires once per contact (100 ms cooldown). Endless bounces end through the Loop rule.

### 3.10 Ferries (moving platforms, world 3)
- A 120 × 20 px platform (a lily pad in the Garden) on a straight dotted rail, with an arrow at the far end. Rails are horizontal or diagonal up to 45°, never steeper.
- It waits at the start of its rail. **When a ball first touches it, it starts** (eases to **200 px/s** over 0.25 s), moves to the end of the rail and **stops dead** there. Balls on it are carried (they match its speed within 0.1 s); when it stops they roll on at about 200 px/s along the rail. It moves once per attempt.
- The area it sweeps is a no-ink zone and contains no walls, so it never crushes a ball; it pushes balls out of its way.
- Why triggered and not looping: a looping platform makes the result depend on timing the player cannot see before the drop. A ferry is fully readable from the frozen level.

### 3.11 Air streams (fans, world 3)
- A fan is a solid box (40 px deep, 80–200 px wide) blowing a straight stream as wide as itself, `reach` 160–480 px long. Air streaks flow along it all the time, even before the drop (a preview).
- Inside the stream, the ball's speed **along the stream** is pulled towards the wind speed at **6 /s**: 800 px/s up to 70% of the reach, fading to 0 at the end. Speed across the stream is untouched. So an updraft carries Dot up at up to 500 px/s and lets it hover near the end of the air (about 89% of the reach); a side wind carries it towards 800 px/s.
- **Walls and ink block the air:** a ball only feels the wind if the straight line from its center back to the fan (along the stream) crosses no wall and no ink. The streaks stop at walls and at your line, live while you draw. Drawing a shield is a real tactic.
- A ball fed into an updraft from a slope rides it up and drifts off sideways at the speed it came in (checked: a ball fed from a 20° line lands on a shelf 360 px above the fan).

### 3.12 Buttons and gates (world 2)
- **Button:** a 48 × 10 px dome on a floor, wall or ceiling (low enough to roll over, 3.3). A ball touching it presses it (it sinks with a click) and **every gate with the same symbol opens** and **stays open** for the rest of the attempt.
- **Gate:** a 20 px striped bar, 80–200 px long, with its symbol; it slides into a solid housing over 0.25 s. A closed gate is solid and its area is a no-ink zone (the doorway cannot be pre-filled with ink).
- Pairs: **●** (blue) and **▲** (coral), at most two pairs per level. Symbols carry the meaning; colors only help.
- Buttons latch on purpose: a "hold the button" design would make a ball wait, which the Stuck rule fails.

### 3.13 No-ink zones (world 1)
- Hatched areas (diagonal hatching plus a crossed-pen icon) where the pen cannot draw. Balls pass through them freely. Dressed per world (masking tape, a wet patch, a pond, a force field) but always with the same hatching and icon.

### 3.14 Two balls: Dot and Dash (world 4)
- **Dash** is a yellow ball with a dash-shaped stripe; Dot is coral with a round highlight. Both drop at the same time from their own trapdoors.
- Ball–ball hits bounce at 0.5 (equal mass), so one ball can knock the other.
- Both must end in a cup; if either fails, the attempt fails at once. A captured ball leaves the simulation, so the other can land in the same cup.

### 3.15 Low gravity (world 4)
- Space levels use **1260 px/s²** (0.7×): falls take 20% longer, pads throw 463 px, updrafts carry Dot at up to 590 px/s. A "Low gravity" badge with a feather icon sits in the HUD, and loose paper stars drift in the background.

## 4. Controls
| Action | Mouse / trackpad / touch | Keyboard |
|---|---|---|
| Draw a line | Press and drag in the playfield | — |
| Drop the balls | Let go | — |
| Cancel the line being drawn | — (let go and draw again) | Z or Backspace |
| Retry (reset, keep the ghost) | ↻ button, or just start a new line | R |
| Hint (after 3 misses) | 💡 button | H |
| Pause | II button | P or Esc |
| Menus | Click / tap | Arrows, Enter / Space |
| Results: next level | Next button | Enter / Space |

- Pointer Events only, one code path for mouse, trackpad and touch; left button only, no right-click, no hover-only actions. The canvas has `touch-action: none`.
- The cursor over the playfield is a CSS pen-nib cursor (generated at boot from a small canvas), so it has no frame lag; it switches to a crossed nib over blocked areas.
- HUD buttons are drawn 64 px but take touches over the full 80 px bar height (50 CSS px at 800×450, above the 48 px minimum).
- Drawing needs a pointer; the keyboard covers everything else. That fits `STANDARDS.md` ("keyboard where it helps").

## 5. Game elements
| Element | Behavior | First appears | Shape/icon (not color alone) |
|---|---|---|---|
| Dot | The ball (3.3) | 1 | Round, shiny highlight dot, big eyes and mouth |
| Trapdoor | Holds a ball until the drop | 1 | Small cardboard hatch with a hinge |
| Ink line | Your one stroke, solid after release | 1 | Glossy hand-drawn line with a paper rim |
| Cup | Goal; capture rule 3.7 | 1 | Paper cup (U shape) with a flag |
| Wall | Solid, bounces 0.3 | 1 | Thick cardboard pieces with outline and drop shadow (books, boxes) |
| Gap | Fall through = Lost | 2 | Open space, torn-paper edges |
| Backboard cup | Cup with a tall back | 1 | Cup with a tall back panel |
| No-ink zone | Pen can't draw, balls pass | 5 | Diagonal hatching + crossed-pen icon |
| Jelly pad | Throws at 1080 px/s | 11 | Jelly block, ^^^ chevrons on the springy face, dotted throw line |
| Button | Opens its gates, latches | 15 | Dome with a ● or ▲ |
| Gate | Solid until opened | 15 | Striped bar with a ● or ▲, housing box |
| Small cup | Inner width 80 px | 21 | Narrower cup, same shape |
| Fan / air | Carries towards 800 px/s, blocked by ink | 21 | Fan with spinning blades, air streaks |
| Ferry | Starts on touch, 200 px/s, once | 25 | Platform (lily pad) on a dotted rail with an arrow |
| Low gravity | 0.7× gravity | 31 | HUD feather badge, drifting stars |
| Dash | Second ball | 34 | Yellow ball with a dash stripe |

## 6. Level design
- **Structure:** **40 levels in 4 worlds of 10** (the brief asked for 50; see 13). Each world adds two ideas, then combines them.
  - **World 1 — Notebook (1–10):** pure drawing: ramps, bridges, the ink limit, stars, jumps, catching a fall, backboards, U-turns, momentum; gaps and no-ink zones (tape).
  - **World 2 — Kitchen (11–20):** jelly pads (11) and buttons and gates (15), then both together.
  - **World 3 — Garden (21–30):** small cups and air streams (21), ferries (25), then combinations.
  - **World 4 — Space (31–40):** low gravity (31), Dot and Dash (34), then everything.
- **Teaching order:** each element gets a safe intro (the element does the wow, the line is easy), then a twist (a second use, or the element in the way), then a combination with an older element.
- **Difficulty curve:** harder means a smaller pot relative to the obvious line, a less obvious 3★ trick, smaller cups, more steps in order (button, then gate, then cup), elements that must be predicted (pad angles, wind), red herrings, and no-ink zones removing the obvious path. Each world starts easier than the end of the previous one.
- **Rules every level follows (checked by the tools, 12):**
  - It fails with no line.
  - It has two **reference lines**: an **easy** one (what a new player would draw; wins, still wins shifted 8 px in each direction, uses more ink than the ★★ mark, and is the hint) and a **gold** one (the level's trick; wins, still wins shifted 4 px each way).
  - Every 3★ idea contains a moment: a jump, a bounce, a wind ride, a ferry ride, a knock.
  - A winning run lasts at most 8 s (most are 2–4 s).
  - **Trackpad length:** no easy line is longer than 600 px, and most are under 450 px (about one comfortable drag on a Chromebook trackpad). Gold lines are shorter still.
  - **Reference lines are recorded through the real pen** (lazy string, spacing, simplification) in the editor, and the shift tests move those simplified points. (In the scratch sim, level 4's 78 px kicker won as a raw curve but failed once simplified.)
  - Where a drawn line hands Dot to a surface, that surface sits a little lower than the natural end of the line (20–40 px), so Dot drops onto it instead of meeting a step (found in the scratch sim: a bridge drawn 8 px low stopped Dot at the far desk).
  - Walls never overlap or touch; pieces that meet leave a 2 px gap and are flush.
  - No ball ever needs to wait more than 1 s (the Stuck rule).
- **Stars:** see 3.8.
- **First 10 levels (Notebook).** Levels 1–4 and 6–9 were checked in the scratch simulation (see 15): each fails with no line and its easy line wins shifted 8 px. Levels 5 and 10 only reuse checked ideas and get checked first in phase 3.
  1. **First Line** — Dot hangs top left, a backboard cup sits on a desk bottom right, nothing else. A ghost hand loops a dashed line from under Dot to the cup; trace it and let go. The guide is 682 px and wins in 1.7 s, still winning shifted 8 px. Pot 1000, ★★★ 800, ★★ 900: tracing earns 3★.
  2. **Bridge** — Dot rolls down a desk slope towards a 320 px gap; the cup is sunk in the far desk, which is 24 px lower. Bridge it (about 315 px, even a wobbly line). The meter bounces at the start; the pot (480) is tight enough that a loopy line runs dry. ★★★ 360, ★★ 420.
  3. **Less Is More** — a cardboard slide already leads to a backboard cup, but Dot drops 80 px left of its top. A ramp from under Dot down onto the middle of the slide (about 400 px) earns 1★; a 120 px nudge onto its top earns 3★. The star notches bounce at the start with the label "Less ink, more stars".
  4. **Ski Jump** — a long, steep slope ends at a 360 px gap; the far desk is level with the takeoff. The pot (160) can't bridge it, and a flat extension falls short: bend the end upward. Kickers of 90–126 px land, and still land shifted 4 px.
  5. **Masking Tape** — first no-ink zone: tape covers the space under Dot, so the ramp must start below it. Dot falls through the tape, picking up speed; the shortest line starts right under the tape's lower corner.
  6. **Catch** — Dot falls from the top; the cup is up on a cabinet. A J-curve (about 470 px) catches the fall and throws Dot up onto the cabinet, with a bookcase behind it to stop overshoots; straight ramps and V shapes fall short. Teaches: curves keep speed.
  7. **Backboard** — a steep slide throws Dot over the cup sitting right under its end. A 136 px upright line hugging the back of the cup stops Dot and drops it in; a curved hood (215 px) also works.
  8. **U-Turn** — Dot rolls right off a high shelf, but the cup is sunk under the shelf, to the left. A curl of about 390–450 px catches the shot and sends Dot back left along the desk into the cup.
  9. **Uphill** — tape blocks the direct path to a cup on a cabinet. Swoop under the tape and back up (about 710 px in the check; the level is narrowed to bring it under 600 px); momentum carries Dot onto the cabinet, and a bookcase stops overshoots.
  10. **Notebook Exam** — a jump over a taped gap, then a backboard catch: two ideas in one line. One star needs about 500 px of ink; 3★ needs both ideas in one short, smooth line.
- **Worlds 2–4 plan** (names and ideas; tuned in phase 3):
  - Kitchen: 11 Jelly (ramp Dot onto a tilted jelly that throws it onto a shelf; checked), 12 Up and Over (the cup is higher than Dot's start), 13 Wall Jelly (bank off a jelly on a wall), 14 Jelly Juggle (two jellies, one line sets both angles), 15 Push the Button (the button is on the way), 16 Detour (the button is off the obvious path), 17 Button Bounce (a jelly throws Dot into a ceiling button), 18 Two Locks (● and ▲), 19 Short Cut (a red-herring jelly; 3★ ignores it), 20 Kitchen Exam.
  - Garden: 21 Breeze (an updraft lifts Dot onto a shelf; feed it in from a slope), 22 Headwind (a side wind blows Dot away; draw a shield), 23 Tailwind (wind carries Dot over a pond), 24 Fan Maze (use one fan, shield the other), 25 Lily Pad (first ferry across a pond), 26 Ferry Jump (jump off the ferry's end), 27 Uphill Ferry (a diagonal ferry), 28 Ferry and Fan, 29 Garden Party (jelly, button, fan), 30 Garden Exam.
  - Space: 31 Moonwalk (a jump only possible in low gravity), 32 Moon Jelly (a 463 px throw), 33 Solar Wind, 34 Dot and Dash (one ramp catches both; checked, to shorten to under 600 px), 35 Two Cups (one ball's ramp is the other's wall), 36 Hold the Door (Dash presses the button that opens Dot's gate), 37 Bump (Dot knocks Dash in), 38 Ferry for Two, 39 Everything, 40 Last Page.
- **Level data format** (one JS module per level in `levels/`, exporting this JSON-shaped object, as in the other games, so no fetch is needed):

```json
{
  "id": "w1l04",
  "name": "Ski Jump",
  "gravity": 1,
  "ink": 160,
  "marks": { "three": 110, "two": 120 },
  "balls": [ { "x": 60, "y": 60 } ],
  "cups": [ { "x": 1110, "y": 420, "w": 104, "board": 0, "boardSide": "right" } ],
  "walls": [ [[0,140],[560,420],[560,640],[0,640]], [[920,420],[1044,420],[1044,640],[920,640]] ],
  "noInk": [ [[600,0],[700,0],[700,300],[600,300]] ],
  "pads": [ { "x": 480, "y": 590, "len": 120, "normal": [0.164, -0.986] } ],
  "fans": [ { "x": 700, "y": 620, "dir": [0, -1], "w": 200, "reach": 420 } ],
  "buttons": [ { "x": 400, "y": 600, "normal": [0, -1], "sym": "circle" } ],
  "gates": [ { "x": 760, "y": 440, "len": 160, "open": "up", "sym": "circle" } ],
  "ferries": [ { "x": 300, "y": 500, "to": [700, 500] } ],
  "guide": [[210,200],[850,430]],
  "refs": {
    "easy": { "ink": 126, "pts": [[562,423],[590,436],[620,440],[650,430],[675,410]] },
    "gold": { "ink": 90, "pts": [[563,423],[598,428],[628,414],[642,402]] }
  }
}
```

  Coordinates are playfield px. `y` of a cup is its rim; `w` its inner width. Walls and no-ink zones are polygons. Pads, fans and buttons carry unit vectors, never angles (3.2). `guide` exists only on level 1. `refs` hold the reference lines as the sim uses them, plus the ink the meter showed when they were drawn; the dev record is the gold line's ink.

## 7. Progression and retention
- **Unlocks:** finishing a level unlocks the next. The **two** levels after your furthest finished level are always open, so a stuck player can skip one (`ui:skip`). No star gates.
- **Hint:** after 3 failed attempts in a visit (attempts cut short by a new line in under 1 s don't count), a 💡 button wiggles in the HUD. It shows the level's easy line for the rest of the visit. The easy line uses more ink than the ★★ mark, so a traced hint earns 1★ and the star hunt stays intact. No hint on level 1 (it has the guide).
- **Records:** best stars, best ink % and the gold nib per level, shown on the level tiles and the results.
- **Watch your best:** the best winning line is saved; "Watch" on the results screen and in the pause menu replays it being drawn (at 900 px/s) and the run. Saves store the sim version; a replay from an older sim version is hidden until the level is beaten again.
- **Pens (cosmetics),** unlocked automatically by total stars (120 max), never changing physics or line width:

| Item | Stars |
|---|---|
| Blue marker (default) | 0 |
| Graphite color | 6 |
| Crayon style | 15 |
| Coral color | 27 |
| Brush style | 40 |
| Green color | 55 |
| Chalk style | 70 |
| Rainbow style (cycles the palette along the line) | 88 |
| Glitter style | 105 |

  Colors are palette colors only (9); any color pairs with any style.
- **No daily** (the brief has none; see 13).

## 8. Screens and UI flow
`Title → (Play | Levels | Pens) → Playing ⇄ Pause → Complete → Next / Retry / Menu`

- **Title:** logo, big **PLAY** (starts the next unfinished level), **LEVELS**, **PENS**, music and sound toggles. The title is a sheet of paper you can doodle on: Dot bounces around and rolls on your doodles.
- **Level select:** a notebook with 4 world tabs; 10 sticky-note tiles each with ★ shapes, best ink % and the gold nib; the next level bounces; locked tiles show a padlock.
- **Playing (HUD, 80 px):** left: II and "1-4 Ski Jump"; center: the ink meter (a 420 px pen-shaped bar with ★3 and ★2 notches and "% used"); right: "Try 3", 💡 (after 3 misses), ↻. In Space, the low-gravity badge.
- **Pause:** Resume, Retry, Watch best (if solved), Levels, Menu, music and sound toggles.
- **Level complete** (about 1 s after the capture): the cup cheers, then a panel slides in: stars stamp in one by one, ink % counts up, "New best!", tries, and after 3★ the dev record line. Buttons **Next**, **Retry**, **Menu**, **Watch**. Retry restarts the level with the winning line as the ghost.
- **Pens:** a pencil case; colors and styles; locked items show their star count; a preview line with Dot rolling on it.
- **First run:** no text tutorial. Level 1's ghost hand; level 2's bouncing meter; level 3's bouncing star notches with "Less ink, more stars"; level 5's tape flashes its crossed-pen icon the first time the pen hits it.

## 9. Art direction
- **Family:** Toybox Flat with a paper-craft feel.
- **Palette:**

| Hex | Role |
|---|---|
| `#F6EFE3` | Paper: backgrounds (tinted per world), UI panels, the rim around ink |
| `#2B2B2B` | Outline: outlines (3 px at 1280×720), text, hatching, shadows at 15% |
| `#3A6FD8` | Ink blue: default pen, ink meter, ● button and gate, Space paper (darkened) |
| `#EF5B5B` | Coral: Dot, fail splats, ▲ button and gate |
| `#5CC46B` | Leaf green: cups, success, Garden tint |
| `#FFC93C` | Sun yellow: stars, jelly pads, flags, Dash |

  Worlds (tints and shades of the palette only): **Notebook** lined paper (blue lines at 15%, a coral margin line); **Kitchen** tiled backsplash; **Garden** green-tinted paper with paper-cut flowers at the edges; **Space** dark-blue construction paper with yellow paper stars. Solid pieces are always light cardboard with outlines and shadows, so they read on every background; the ink always has a 2 px paper rim, so it reads on Space's dark paper too.
- **Key visuals:** Dot and Dash with big expressive faces; the glossy ink line with a slight hand-drawn wobble (render only; collision follows the true line); paper cups with flags; cardboard books and boxes; jelly cubes; fans with spinning blades; lily pads on rails.
- **Rendering:** all art drawn in code. Each level's paper, walls, tape and cups are pre-rendered to an offscreen canvas. The line being drawn is appended to a "wet ink" canvas (no full redraw); on release it is rendered once with its style. Only balls, moving parts, particles and the HUD are drawn each frame.
- **Juice list:**
  - Drawing: pen scratch particles at the tip; the ring drains; star icons pop off the meter with a spin; the tip sputters when dry.
  - Release: the ink flashes glossy and "sets"; the trapdoor clacks open; Dot does a little gulp before falling.
  - Run: squash on landings, stretch at speed, speed lines over 900 px/s, a ripple running along the ink under Dot, dust puffs on walls, a 3 px shake on hard wall hits (over 700 px/s).
  - Jelly: deep wobble and a stretch on Dot. Fan: streaks bend around Dot. Button: click-sink and a spark along to the gate; the gate slides with a bounce. Ferry: a clunk and splash at start and stop.
  - Win: Dot plops into the cup, cup squash, confetti burst from the cup, "Swish!" or "Rim!", a 2% zoom punch for 200 ms; results with stamped stars and a count-up.
  - Fail: face, bubble, splat or poof, quick rebuild pop.
- **Concept art prompts** (updated from the brief):
  - **Gameplay screenshot (16:9):** *"Flat cartoon physics drawing puzzle on lined notebook paper, a thick glossy blue hand-drawn ink line with a slight wobble guiding a cute shiny coral ball with a big happy face towards a green paper cup with a yellow flag, cardboard book blocks with thick dark outlines and soft drop shadows, a hatched masking-tape zone with a crossed-pen icon, a yellow jelly block with chevrons, a small pen-shaped ink meter with star notches at the top, warm cream background, 2D game screenshot, 16:9"*
  - **Key art / thumbnail (16:9 and 1:1, no text):** *"a thick wobbly glossy blue ink line drawn across notebook paper, a shiny coral cartoon ball with a happy face rolling and jumping along it towards a green paper cup with a yellow flag, a yellow ball with a dash stripe following, ink drops and doodles around, flat vector cartoon style, bright flat colors, thick dark outlines, soft drop shadows, warm cream background, toy-like and clean, highly readable shapes, centered composition with room for a title, game key art"*
  - **Character and element sheet:** *"pieces on a plain background: a shiny coral ball with a face in several expressions (curious, falling, fast, happy, dizzy), a yellow ball with a dash stripe, a green paper cup with a flag and one with a tall back panel, a cardboard trapdoor hatch, a pen-shaped ink meter full and empty with star notches, cardboard book wall blocks, a hatched tape zone with a crossed-pen icon, a yellow jelly pad with chevrons, a round push button and a striped gate with circle and triangle symbols, a fan with air streaks, a lily pad on a dotted rail with an arrow, sample ink strokes in marker, crayon, brush, chalk and rainbow styles, flat vector cartoon style, bright flat colors, thick dark outlines, soft drop shadows, warm cream background, toy-like and clean, highly readable shapes, game asset sheet on a plain light background, evenly spaced, consistent scale"*
  - **Logo:** *"the words "INK PATH" written as one continuous thick glossy blue ink stroke, with a small shiny coral cartoon ball with a face rolling along the end of the line, flat vector cartoon style, bright flat colors, thick dark outlines, soft drop shadows, warm cream background, toy-like and clean, highly readable shapes, game logo on a plain background, bold and readable at small size"*
  - **Negative prompt:** *"text, letters, watermark, signature, photorealistic, gritty, horror, violence, weapons, blood, cluttered background, blurry, low contrast, extra limbs, UI buttons"* (drop "text, letters" for the logo).

## 10. Audio
All synthesized with WebAudio; the `AudioContext` starts on the first click or key.

| Sound | When | Character |
|---|---|---|
| Pen scratch | While drawing | Filtered noise, volume and brightness follow pen speed |
| Star pip | The ink passes a star notch | Short falling two-note blip |
| Dry pen | Out of ink | Dry scratchy sputter |
| Blocked | Pen hits a blocked area | Soft "tk" |
| Ink set | Release | Glossy "thup" with a tiny shimmer |
| Trapdoor | Drop | Cardboard clack |
| Roll | While a ball touches a surface | Low filtered rumble, pitch and volume by speed |
| Bump | Wall hit / ink landing | Cardboard thud / soft pat, pitch by speed |
| Boing | Jelly pad | Wobbly boing |
| Air | Ball in a stream | Soft whoosh |
| Click / slide | Button / gate | Click, then a wooden slide |
| Ferry | Start / stop | Splashy clunk, gentle motor hum while moving |
| Plop + cheer | Ball captured | Plop, then synthesized claps and a major arpeggio ("yay") |
| Swish | Clean entry | Bright swish |
| Fail | Lost / stuck / dizzy | Sad "bwomp" / dizzy warble |
| Refill | Reset | Quick glug |
| Star stamp | Results | Stamp thump plus a rising note per star |
| UI | Buttons | Soft click |

Music: yes, one short synthesized loop per world (8–16 bars, 90–100 BPM, plucky marimba, soft bass, light percussion), **on by default** because it is tiny and Flip Runner played much better with it. A shaker layer joins while a ball is rolling, so each run feels like a little show. Music and sound toggles are separate and persist.

## 11. GameAnalytics
Each **attempt** (each drop) is one progression attempt, so GameAnalytics' own attempt counter answers the brief's question directly. Design events carry the level in their id, because GameAnalytics does not link design events to progression events.

| Event id | When it fires | Value |
|---|---|---|
| `Start:world0N:level0M` | The balls drop | — |
| `Complete:world0N:level0M` | All balls in cups | Stars (1–3) |
| `Fail:world0N:level0M` | The attempt ends without a win: lost, stuck, loop, timeout, a new line or R during the run, or leaving mid-run | — |
| `level:attempts:world0N:level0M` | On Complete | Attempts this visit |
| `level:ink_used:world0N:level0M` | On Complete | Ink used, % of the pot |
| `level:abandon:world0N:level0M` | Leaving an unfinished level after ≥ 1 attempt | Attempts this visit |
| `level:replay:world0N:level0M` | Entering a level already finished | Stars held (1–3) |
| `stars:improve:world0N:level0M` | A Complete that beats the level's best stars | New stars |
| `nib:earned:world0N:level0M` | Ink at or under the dev record, first time | Ink % |
| `fail:<cause>:world0N:level0M` | Level end (complete or leave), one per cause that happened; causes `lost`, `stuck`, `loop`, `timeout`, `redraw` | Count this visit |
| `stroke:blocked` | Level end, if any | Lines that hit a blocked area this visit |
| `stroke:dry` | Level end, if any | Lines that ran out of ink this visit |
| `stroke:cancel` | Level end, if any | Lines canceled (Z or under 20 px) this visit |
| `tutorial:step01` | First line ever started | — |
| `tutorial:step02` | First drop ever | — |
| `tutorial:step03` | Level 1 complete | — |
| `tutorial:done` | Level 3 complete | — |
| `ui:restart` | Level end, if R or ↻ was used | Count this visit |
| `ui:hint` | Hint shown | Failed attempts before it |
| `ui:skip` | Starting a level past the next unfinished one | — |
| `ui:replay` | "Watch best" played | — |
| `pen:color:<name>` / `pen:style:<name>` | Pen item equipped | — |
| `settings:music:off` / `settings:sfx:off` | Toggle switched off | — |

Per-action counts are sent once per level end with a value, never one event per action. In development every event is logged to the console.

**Question the data must answer:** how many attempts each level takes (attempt count on `Complete` and `level:attempts`), where players give up (`level:abandon`, `fail:<cause>`), and whether players replay for ink stars (`level:replay` per finished level, and how often it ends in `stars:improve`).

## 12. Tech plan
- **Stack:** vanilla Canvas 2D, ES modules, no build step, following `STANDARDS.md`. Code from Magnet Twins and Flip Runner is **copied** into this folder, never imported: fixed-step loop and screen handling, resize and letterbox, save, analytics stub, WebAudio synth and music sequencer, pooled particles and squash springs, canvas button UI, the recording helpers (adapted: here a recording is the line's points).
- **Modules (`src/`):** `main.js` (boot), `game.js` (screens, HUD, attempt flow, analytics glue), `sim.js` (deterministic world: balls, contacts, pads, air, buttons and gates, ferries, cups, fail rules; no DOM), `geom.js` (segment and capsule distance, polygon tests, ray casts, RDP), `pen.js` (lazy string, spacing, blocked test, ink measure, simplify), `level.js` (parser and validation), `render.js` (pre-rendered level layer, ink styles, faces), `fx.js`, `input.js` (Pointer Events with capture and coalesced events, keys, CSS cursor), `audio.js`, `save.js`, `analytics.js`, `config.js` (every tuning number in this GDD, in one place).
- **Collision:** each step, integrate gravity and air, cap speed, move, then up to 4 passes resolving the deepest contact first (circle against capsules, polygon edges and convex corners), applying the rules in 3.3. A 64 px grid broadphase is built once per attempt (level plus line, at most about 300 segments).
- **Save keys:** `cm_ink-path_save` → `{ v: 1, levels: { "w1l04": { stars: 2, ink: 96, pct: 60, nib: false, best: [[x, y], …], sv: 1 } }, pen: { color: "blue", style: "marker" }, tut: {} }` and `cm_ink-path_settings` → `{ v: 1, music: true, sfx: true }`. Reads in `try/catch`; broken data resets to defaults. Saved after every level complete and every settings change.
- **Testing hook:** `window.game` with `screen`, `level`, `score` (stars of the last result), `start()`, `restart()`, plus debug-only `win()` and `stroke(points)` (draws a line and drops), removed in release.
- **Tools (`tools/`, Node, not shipped):**
  - `simtest.mjs`: mechanics checks against this GDD (fall time 0.84 s, pad throw 324 / 463 px, a curve keeps its speed, a 10 px lip rolls over, a jittery 5° line rolls after RDP, each fail rule fires in time), then every level: fails with no line; the easy line wins shifted 0 and ±8 px; the gold line wins shifted 0 and ±4 px; marks in order (3.8); winning runs under 8 s; the same line gives the same end state twice.
  - `search.mjs` (the solver): tries every straight line on a 20 px grid shorter than the ★★★ mark, then shortens the gold line with a seeded hill-climb over 3–5 point lines. It reports the cheapest win found; if it beats the gold line by more than 15%, the level has a shortcut (accept it as the new gold line or fix the level). Minutes per level; a check, not the source of truth.
  - Debug editor (`?edit`, phase 3): polygon walls and tape on a 10 px snap, cups, balls, elements; play-test in place; "Save as easy / gold" records the current winning line; exports the level module.
- **Riskiest piece:** the feel of drawing and rolling, and its robustness to imperfect lines. The contact rules in 3.3 came from a scratch simulation; **prove them first** in phase 2 by porting those cases into `simtest.mjs` before any art, then tune by hand.
- **Second risk:** drawing with a Chromebook trackpad (click-drag, accidental lifts, jitter). Test on a real Chromebook on day one of phase 2, logging stroke lengths and short strokes.
- **Third risk:** authoring 40 levels with two reference lines each. The editor and `search.mjs` exist for that.

## 13. Scope
- **v1:** Dot and Dash with all mechanics in section 3; 40 levels in 4 worlds; ink stars, best ink, dev record and gold nibs; hints; skip-ahead; best-line replays; 9 pen items; title doodle; full shell, saving, audio with music, analytics; debug editor, `simtest.mjs` and `search.mjs`.
- **Vertical slice (phase 2, from the brief):** the pen with the ink meter and blocked areas, line to solid body, ball physics on the fixed step, cups, fail rules and instant retry, levels 1–3, the full shell and GameAnalytics stubs.
- **Later:** level editor for players with share codes (brief); 10 more levels (a world 5) if `Complete` rates show players reach world 4; an "ink of the day" daily; race your ghost.
- **Cut:**
  - **On-level stars the ball must touch for 3★** (in the brief): a second rule on the same rating, at odds with saving ink and hard to read at a glance. Buttons already give "the ball must pass here" puzzles.
  - **Several strokes per attempt and an eraser:** one stroke is the hook and the ink economy; drawing again is faster than editing.
  - **Lines that fall or move:** a different game (dynamic drawing).
  - **Looping moving platforms:** results would depend on timing the player cannot see before the drop; ferries start on touch instead.
  - **Hold-down buttons:** a ball would have to wait, which fails as Stuck.
  - **50 levels in v1:** with 7 elements, 40 keeps every level built around a real idea; the last 10 move to Later.

## 14. Open questions
| Question | Recommendation | Who decides | Status |
|---|---|---|---|
| Do Chromebook trackpad users lift by accident mid-line? | Keep drop on release; if the slice test shows many short accidental strokes, add a setting "Tap to drop" (release ends the line, a tap or Space drops) | Fafi after the Chromebook test | Open |
| Lazy string 4 px and point spacing 6 px | Keep; tune in the 2c feel loop | Fafi | Open |
| Air model (800 px/s, pull 6 /s) and pad throw 1080 px/s | Keep; tune when world 2 and 3 levels are built | Fafi | Open |
| Space gravity 0.7× | Keep; try 0.6× if Space doesn't feel different enough | Fafi | Open |
| Music on by default | Yes (tiny, synthesized); revisit if `settings:music:off` is very high | Team | Open |
| Coolmath SDK, ad breaks, branding, size limit | Ads only between levels, after the results screen, never mid-level | Team | Open |
| GameAnalytics game key and secret | One key per game in `src/config.js` | Team | Open |

## 15. Changelog
- 2026-10-26 — Phase 1c review applied: reference lines recorded through the real pen and shift-tested after simplification (level 4's shortest kicker failed once simplified; example marks updated); distinct styles for the line, ghost, hint, guide, drop preview and blocked tether; trackpad length rule (easy lines ≤ 600 px), with level 3's naive route shortened and levels 9 and 34 flagged to shorten; hint counts only real attempts; results timing for two balls; which levels were simulated is stated. Status set to In review.
- 2026-10-26 — First draft from the brief and the phase 1a answers: stars from ink only (touch-stars cut), drop 150 ms after release, drawing again restarts at once, ghost of the last line, drop preview, fail-fast rules, ink and walls block air, triggered ferries, latching buttons, Dot and Dash, low gravity in Space, 40 levels in 4 worlds, two reference lines per level with the hint and the dev record taken from them, pens unlocked by stars, per-attempt progression events. The physics numbers and levels 1–4 and 6–9 (plus 11 and 34) were checked in a throwaway simulation outside the repo, which changed the design: no bounce on ink, glancing hits keep speed, small lips roll over, RDP needed so jittery gentle lines roll, landing surfaces lower than the line's end, backboards built into cups, a turn-back fail rule (a rocking ball took 12 s to fail), the level 4 jump made steeper with a smaller pot, level 6 rebuilt around throwing Dot up (a straight ramp threw as far as a curve), level 7's cup moved under the slide (it was winnable with no ink).
