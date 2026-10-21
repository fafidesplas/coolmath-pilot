# Magnet Twins — Game design document

**Status:** Draft
**Owner:** Fafi · **Reviewed by:** — · **Last updated:** 2026-10-21

> Two little robots share one keyboard: red Plus pulls metal, blue Minus pushes it, and every level needs both of them working together.

## 1. Summary
- **Pillars:**
  1. **We need each other.** Every level has at least one moment where one robot's power is the other robot's only way forward. Plus and Minus are never copies.
  2. **Magnetism you can read.** The field is always drawn, its direction is always shown by shape (arcs flowing in or out), and the same rule works on every metal thing. No hidden physics.
  3. **Bouncy and forgiving.** No lives, no game over. A mistake costs under a second, and failing is funny (sparks, a poof, a quick rebuild).
- **Player:** Coolmath players aged 10–24 on a school Chromebook. Two friends on one keyboard at school or home, or one player alone in solo mode. Sound often off.
- **Session:** One level takes 30–90 s. A typical visit is 10–20 minutes (a world's worth of levels, or a star hunt).
- **Hook:** "Wait, what if you push me up there?" Discovering a combo together, plus the par-time star and the paint shop, brings pairs back for one more level.

## 2. Core loop
- **Moment (seconds):** Aim a field → pull or push metal (or your twin) → land, stack, launch.
- **Level (minutes):** Read the room → split the jobs → combine powers to open the way → both robots stand in the exit → stars.
- **Meta (days):** Stars unlock hats and patterns in the paint shop → a new world adds a new metal object → replay for bolts and par times.

## 3. Mechanics

### 3.1 Space and scale
- Design resolution 1280×720. The HUD bar takes the top 80 px; the playfield is the remaining 1280×640.
- Levels are a grid of **40 px tiles, 32 columns × 16 rows**. One level is one screen; the camera never scrolls.
- At 800×450 a tile is 25 px on screen, which stays readable because the robots and metal objects have thick outlines and symbols.

### 3.2 Simulation
- Fixed step at **120 Hz** with an accumulator (frame `dt` capped at 0.05 s). The simulation is deterministic for the same inputs, so par times and solo checks can be replayed.
- Bodies are axis-aligned boxes. Movement and collision are resolved per axis against the tile map, then against other dynamic bodies.
- Dynamic bodies: the 2 robots and every crate. Rail bodies (hanging platforms, spring plates, door gates) move along one axis only.
- Anything standing on a body that moves is carried with it (robots on crates, crates on platforms, robots on robots).
- **Riders add no mass.** A field moving a body moves it at full strength whatever stands on it, so a crate held up by Minus is an elevator for Plus.

### 3.3 Robots
- **Hitbox:** 30 × 36 px (fits through a 1-tile gap). Drawn about 40 × 44 px with squash and stretch.
- **Run:** max speed 240 px/s (6 tiles/s), acceleration 2400 px/s², ground deceleration 3000 px/s². Air control 70%.
- **Gravity:** 2000 px/s². Max fall speed 900 px/s.
- **Jump:** take-off speed 640 px/s, which gives a full jump height of about 102 px (2.5 tiles). Releasing jump early cuts upward speed by half (short hop of about 1 tile).
- **Forgiveness:** coyote time 80 ms, jump buffer 100 ms.
- **Stacking:** a robot can stand on the other robot's head. The bottom robot can still walk and carries the top one. Robots never push each other sideways by walking; they bump and stop.
- **Field riding:** a robot held up by a field (upward magnet force and vertical speed under 60 px/s) counts as standing, so it can jump off the field.
- **Hover damping:** any body pushed upward by a field loses 8% of its vertical speed per step, so it settles at the hover point in about 0.3 s instead of bouncing.

### 3.4 Magnet powers
- **Plus (red, +)** pulls metal towards itself. **Minus (blue, −)** pushes metal away from itself.
- A power is active while its key is held (2-player) or while it is toggled on (solo, see 3.9).
- **Aim:** 4 directions, **fixed at the moment the power turns on**. Up or down held at that moment aims the field up or down; otherwise it points the way the robot faces. While the power stays on, a sideways field turns with the robot when it turns around, but up and down never change the aim, so the up key keeps jumping. To aim again, release (or toggle off) and press again. Co-op and solo use the same rule.
- **Cone:** range **160 px (4 tiles)**, half-angle **30°**, from the robot's center. A target is affected when its center is inside the cone and the line from the robot to it is not blocked by a solid, non-metal tile. Fields do not pass through walls.
- **Strength:** acceleration **3000 px/s²** on the target, constant out to 120 px, then fading linearly to 0 at 160 px. Velocity caused by magnets is capped at 480 px/s.
- **Every metal thing in the cone is affected,** not only the nearest.
- **Plus stops things at contact.** A pulled crate ends up pressed against Plus. If Plus walks, the crate comes along (carrying). Pulling something that rests under Plus has no effect.
- **The other robot is metal.** Plus pulls Minus; Minus pushes Plus.
- **Shield rule:** a robot whose own power is on is **immune to its twin's field** (it glows with a thin shield ring while its power is on). This stops the "both fields on each other" combo from flying forever. Fixed plates still move a robot that uses its own power on them.
- **Launch:** Minus aiming up with Plus above it lifts Plus. With gravity at 2000, Plus rises and hovers where the force equals gravity, about **133 px (3.3 tiles)** above Minus. Plus can jump off the field for 2.5 more tiles, so the full launch reaches about 6 tiles.
- **Fixed metal (anchored):** riveted metal plates are part of the level and never move. When the field hits a fixed plate, **the robot moves instead:**
  - Plus aiming at a plate is pulled to it and sticks while the power is on. Stuck to a ceiling plate, Plus can move left and right along it at 50% speed (monkey bars). Releasing the power drops Plus.
  - Minus aiming at a plate is pushed away from it. Aiming down at a floor plate makes Minus hover about 3.3 tiles up (jetpack); aiming sideways at a wall plate gives a horizontal dash capped at 480 px/s.
- **Self effects only come from fixed plates.** Pulling a crate never drags Plus towards the crate.

### 3.5 Metal objects
- **Crate (1×1 tile):** dynamic, mass 1. Falls with gravity, ground deceleration 2400 px/s², stacks, can be stood on. A robot walking into a crate pushes it slowly, at 80 px/s, along the ground; lifting, throwing or moving it at a distance needs magnets. A crate that falls in water sinks and respawns at its start position after 1 s, waiting until that spot is clear of robots and other bodies.
- **Fixed plate (1×1 tile, riveted):** part of the tile map, solid. Anchor for Plus grapple and Minus jetpack and dash.
- **Hanging platform (3×1 tiles):** metal slab on a rail. Two kinds: **horizontal rail** (hangs from a ceiling track) and **vertical chain** (slides up and down a chain). It moves only along its rail, between the rail's ends, under magnet force at half the normal acceleration (1500 px/s²). With no force it stops within 0.2 s and stays where it was left (no gravity). Riders are carried.
- **Magnetic door:** a 1×3 metal gate in a frame with a lock plate on each side. While any field touches a lock plate, the gate slides up (open in 300 ms). When no field touches it, the gate falls shut in 600 ms. A closing gate never crushes a robot and never stays open for one: it gently pushes a robot standing in the doorway out to the side it came from (crates too). Lock plates sit at least 5 tiles from their gate, or out of reach behind a wall or on a ledge, so the robot holding a door can't walk through it (see 6).
- **Polarity lock door:** like the magnetic door, but its lock plates show **+** (only Plus can open it) or **−** (only Minus can open it).
- **Spring plate (1×1, on a floor rail):** anything that lands on it is launched up at 1000 px/s (about 6 tiles). Magnets slide it along its floor rail, so players reposition it before using it.

### 3.6 Hazards and checkpoints
- **Water** and **spikes** reset **both** robots to the last checkpoint (or to the level start), with a 400 ms poof-and-rebuild. No lives, no fail screen.
- **Checkpoints** are flags. One touch from either robot activates the flag for both, and the robots respawn side by side at it. Only levels with a co-op par over 60 s get checkpoints; shorter levels reset to the start.
- A hazard reset moves only the robots. Crates, platforms, spring plates and collected bolts stay as they are. **R** restarts the whole level from scratch in under 1 s, so a stuck state is always one key away.
- Crates are solid on spikes and can be used to cover them.

### 3.7 Bolts, exit, completion
- **3 bolts** per level. Either robot collects a bolt by touching it. Bolts collected stay collected through hazard resets, but not through R.
- **Exit:** a double door, 2 tiles wide and 2 tall. The level is complete when **both robots** are inside it for 300 ms.

### 3.8 Stars
- Each star is earned on its own and kept forever (you don't need all three in one run):
  - ★ finish the level;
  - ★ finish with all 3 bolts;
  - ★ finish under par time.
- **Co-op par = the level's recorded co-op solution time × 1.25** (see 6, solution recordings), rounded up to the second. **Solo par = co-op par × 1.5**, rounded up. Stars count the same in both modes.

### 3.9 Solo mode
- One player controls one robot at a time. **Tab** (or **Q**) switches robots. A switch takes effect at once, and an arrow over the active robot shows who you control.
- In solo, the power key **toggles** the power on and off instead of holding it. Aiming works as in co-op: set when the power turns on.
- The inactive robot stands still but keeps its power state, so you can leave Minus holding a door or hovering Plus while you switch.
- **Every level must be solvable in solo.** This is checked for each level in phase 3.

## 4. Controls
| Action | Mouse / touch | Keyboard |
|---|---|---|
| Plus: move / jump | Solo touch buttons (see below) | A / D, W to jump |
| Plus: power (hold) / aim | — | F (alt E); hold W or S as you press it to aim up or down |
| Minus: move / jump | Solo touch buttons | ← / →, ↑ to jump |
| Minus: power (hold) / aim | — | / (alt Right Shift); hold ↑ or ↓ as you press it to aim up or down |
| Solo: move / jump | ◀ ▶ and Jump buttons | WASD or arrows, W / ↑ / Space to jump |
| Solo: power (toggle) | Power button, drag up or down on it to aim | F, E, / or Right Shift |
| Solo: switch robot | Switch button, or tap a robot | Tab or Q |
| Restart | HUD button | R |
| Pause | HUD button | P or Esc |
| Menus | Click / tap | Arrows, Enter / Space |

- **Keyboard first is a deliberate exception** to "mouse first" in `STANDARDS.md`: a platformer for two on one keyboard can't be played with a mouse. The mouse works for all menus and the HUD.
- **Touch** is solo only: 5 on-screen buttons (◀ ▶ bottom left; Jump, Power, Switch bottom right), sized in CSS pixels rather than scaled with the canvas: 64 CSS px each, never under 56, so they stay above the 48 px minimum at 800×450.
- **Key load:** no key moment in a level may need more than 3 keys held at once by one player (for example move + jump + power). This keeps ghosting risk and finger strain down.
- Tab and the arrow keys have `preventDefault` so the page never scrolls or loses focus.
- **Key ghosting:** the exact key set (WASD+F held with arrows+/) is tested on a real Chromebook in phase 2. A debug key-test overlay (`?keytest` in the URL) shows every key the browser sees. If a combination ghosts, switch to the alternate power keys (E and Right Shift).

## 5. Game elements
| Element | Behavior | First appears | Shape/icon (not color alone) |
|---|---|---|---|
| Plus robot | Pulls metal (3.4) | 1 | Round red robot, big **+** on chest, field arcs flow inward with ‹ › chevrons |
| Minus robot | Pushes metal (3.4) | 1 | Round blue robot, big **−** on chest, field rings flow outward |
| Bolt | Collectible, 3 per level | 1 | Yellow hex bolt, spinning |
| Exit door | Both robots inside → win | 1 | Double door with a 2-robot sign |
| Crate | Dynamic metal box (3.5) | 2 | Grey box with rivets and an X brace |
| Magnetic door | Opens while a lock plate is in a field | 4 | Gate with stripes, lock plate with a magnet icon |
| Polarity lock door | Only + or only − opens it | 5 | Lock plate with a large **+** or **−** |
| Spikes | Hazard, resets robots | 8 | Triangles |
| Water | Hazard, sinks crates (they respawn) | 8 | Wavy surface, bubbles |
| Checkpoint flag | Respawn point for both | 10 | Pole with a flag that raises when touched |
| Fixed plate | Anchored metal: grapple, jetpack, dash | 11 | Dark plate with 4 big rivets |
| Hanging platform (rail) | Slides along a ceiling track | 13 | Slab hanging from a track with wheels |
| Spring plate | Launches up 6 tiles, slides on a floor rail | 21 | Plate on a coiled spring, rail under it |
| Hanging platform (chain) | Slides up and down a chain | 24 | Slab on a chain |

## 6. Level design
- **Structure:** 30 levels in 3 worlds of 10.
  - **World 1 — Workshop (1–10):** movement, both powers, crates, magnetic and polarity doors, launching, stacking. Hazards appear late in the world.
  - **World 2 — Scrapyard (11–20):** fixed plates (grapple, jetpack, dash) and hanging platforms on a horizontal rail.
  - **World 3 — Power Plant (21–30):** spring plates on rails, hanging platforms on a chain (from 24), then levels that combine every element.
- **Teaching order:** each new element gets a safe intro level (no hazard, one obvious use), then a twist level (a second use, or using it on your twin), then a combination with an older element.
- **Difficulty curve:** a level gets harder with more steps that must happen in order, with steps that need both robots at the same time, with tighter jumps over hazards, and with red herrings (metal you don't need). Each world starts easier than the end of the last one. At most one "hard timing" moment per level; puzzles are about ideas, not precision.
- **Solo rule:** no step may need both robots to act precisely at the same instant. "One holds, the other moves" is fine because solo toggles hold the power.
- **Door rule:** a lock plate is never within reach of the doorway (at least 5 tiles away, or behind a wall or up on a ledge), so the robot holding a door can't let itself through. Every door is a job for two.
- **Key load rule:** see 4, at most 3 keys at once per player.
- **Solution recordings:** every level ships (in the repo, not the release build) with a recorded input solution for co-op and one for solo, in `levels/solutions/<id>.coop.json` and `<id>.solo.json`. Because the simulation is deterministic, a debug replay tool runs every recording and flags any level that no longer reaches the exit after a physics or level change. A level is not done until both recordings pass. The co-op recording also sets the par time (3.8).
- **Stars:** see 3.8. Bolts are placed to reward an extra idea or a small detour, never a precision trick.
- **First 10 levels (Workshop):**
  1. **Hello, Twins** — no metal. Keycap prompts float over each robot. Two easy paths of steps and short jumps lead to the shared exit, which needs both robots. One bolt sits on a ledge too high for a single jump: stand on your twin's head to grab it (optional).
  2. **Pull** — a crate sits on a lower floor. Plus pulls it over to make a step up a ledge for both robots. Power keycap prompt appears near the crate.
  3. **Push** — a crate on a shelf blocks the way. Minus pushes it down into a pit to make a bridge.
  4. **Hold the Door** — a magnetic door. One robot holds the lock plate while the other walks through, then holds the far-side plate for the first.
  5. **Your Lock, My Lock** — two parallel corridors to the exit, one closed by a + door and one by a − door. Plus opens the + door so Minus can go through; Minus then opens the − door from its side so Plus can follow.
  6. **Boost** — a ledge 4 tiles high. Minus launches Plus up onto it. Then Plus faces the drop with its power on, and Minus jumps into Plus's cone and gets pulled up onto the ledge.
  7. **Tower** — two crates and a tall wall: stack crates, stand on them, stand on each other.
  8. **Wet Feet** — first water and spikes. A crate pushed into the water sinks and comes back; the way across is to cover the spikes with crates and walk over them.
  9. **Carry** — Plus carries a crate along a corridor to Minus, and Minus launches it up onto a high shelf, where it becomes the step both robots need to reach the exit.
  10. **Workshop Exam** — door, launch and crates together; the first level with a par over 60 s, so it gets one checkpoint halfway.
- **Level data format** (one JS module per level in `levels/`, exporting this object):

```json
{
  "id": "w1l04",
  "name": "Hold the Door",
  "par": 25,
  "tiles": [
    "################################",
    "#..............................#",
    "... 16 rows of 32 characters ..."
  ],
  "spawn": { "plus": [3, 13], "minus": [5, 13] },
  "exit": [28, 12],
  "bolts": [[8, 10], [16, 6], [24, 13]],
  "objects": [
    { "type": "crate", "x": 10, "y": 13 },
    { "type": "door", "x": 15, "y": 11, "lock": "any" },
    { "type": "platform", "x": 6, "y": 8, "rail": "h", "from": 4, "to": 12 },
    { "type": "spring", "x": 20, "y": 14, "from": 18, "to": 24 },
    { "type": "checkpoint", "x": 14, "y": 13 }
  ]
}
```

  Tile characters: `.` empty, `#` solid, `M` fixed metal plate, `~` water, `^` spikes. `par` is the co-op par in seconds, filled in from the co-op solution recording (solo par is derived). A recording is `{ "v": 1, "level": "w1l04", "mode": "coop", "frames": N, "inputs": [[step, key, down], …] }`, where `step` is the 120 Hz simulation step. Door `lock` is `"any"`, `"plus"` or `"minus"`. Platform `rail` is `"h"` or `"v"`, with `from`/`to` in tiles along that axis.

## 7. Progression and retention
- **Unlocks:** finishing a level unlocks the next. A world unlocks when the previous world's level 10 is finished. No star gates, so no one gets stuck behind a wall of stars.
- **Paint shop:** 6 hats and 6 chest patterns per robot (24 items). Items unlock automatically at total star counts (item *k* of 24 unlocks at round(*k* × 3.25) stars, so the last one at 78 of 90). No currency. **The body stays red or blue with its + or − symbol**, so customization never hurts readability.
- **Weekly co-op challenge:** moved to Later (see 13).
- **Return reasons:** missing stars shown on the level select, the next locked item shown in the shop with its star count, and the par time shown before each level.

## 8. Screens and UI flow
- **Title:** logo, two big buttons **1 Player** and **2 Players** that start the next unfinished level straight away (one click from title to playing), then **Levels**, **Paint Shop**, sound and music toggles. Both robots idle on the title and react to the mouse.
- **Level select:** 3 world tabs, 10 level tiles each, with stars earned (★ shapes) and the next level highlighted and bouncing. Current mode shown at the top, switchable.
- **Playing (HUD, top 80 px):** level number and name; 3 bolt slots; timer with the par time beside it (turns from yellow to grey when par is missed); in solo, a portrait of the active robot; pause and restart buttons on the right.
- **Pause:** Resume, Restart, switch 1P/2P, a controls card for the current mode, Menu.
- **Level complete:** the robots high-five in the exit, then a panel slides in: 3 stars stamping in one by one, time counting up against par and best, bolts 0/3. Buttons **Next**, **Retry**, **Menu**.
- **Paint shop:** both robots on pedestals; a row of hats and a row of patterns per robot; locked items show their star count.
- **First run:** no text tutorial. Level 1 shows keycap prompts above each robot (WASD over Plus, arrows over Minus, or the solo keys), fading once each robot has moved. Power keycap prompts appear the first time a robot is near metal (levels 2 and 3).

## 9. Art direction
- **Family:** Chunky Cartoon.
- **Palette:**
  | Hex | Role |
  |---|---|
  | `#E8463A` | Plus red: robot, its field arcs, + locks |
  | `#2F7FE0` | Minus blue: robot, its field rings, − locks |
  | `#2B2238` | Outlines, text, solid tiles' edges |
  | `#FFF1DC` | Warm background base (tinted per world) |
  | `#9AA5B1` | Metal: crates, plates, platforms, doors |
  | `#FFC531` | Accent: bolts, stars, highlights |

  World tints: Workshop warm cream, Scrapyard dusty orange, Power Plant soft teal, all made from the base with low contrast so the play layer pops.
- **Key visuals:** round squishy robots with big eyes that look at each other and at whatever their field is touching; chunky tiles with thick outlines; metal objects with rivets; field arcs animated in code (inward chevrons for Plus, outward rings for Minus).
- **Rendering:** all art drawn in code. Tiles and backgrounds pre-rendered to offscreen canvases per level; only robots, metal objects, fields and particles are drawn each frame.
- **Juice list:**
  - Jump stretch, landing squash, dust puff.
  - Field arcs pulse while held; sparks where a field touches metal.
  - Clank shake of 3 px for 100 ms when a crate lands or hits a wall at over 300 px/s.
  - Bolt pickup: pop, sparkle burst, flies to the HUD slot.
  - Door gate slides with an ease and a little bounce when it shuts.
  - Spring plate: deep squash, then a big stretch on the launched body.
  - Hazard: robots poof into sparks, a 400 ms rebuild at the checkpoint.
  - Checkpoint: flag whips up with confetti.
  - Exit: robots jump in, high-five, star burst; stars stamp in on the results panel with count-up numbers.
- **Concept art prompts** (updated from the brief):
  - **Gameplay screenshot (16:9):** *"Two cute chunky round robots, one red (#E8463A) with a big plus sign on its chest, one blue (#2F7FE0) with a big minus sign, in a friendly cartoon workshop platform level made of chunky tiles, the blue robot pushing the red one upward with glowing outward magnetic rings, a grey riveted metal crate and a striped magnetic door, yellow hex bolts to collect, warm cream background, bright saturated colors, thick dark outlines, 2D side view game screenshot, 16:9"*
  - **Key art / thumbnail (16:9 and 1:1, no text):** *"two cute chunky round robots side by side, a red one with a plus sign on its chest and a blue one with a minus sign, high-fiving, glowing magnetic field arcs swirling around them, a riveted metal crate floating between them, yellow hex bolts sparkling, friendly workshop background, chunky cartoon style, round squishy shapes, big expressive eyes, saturated colors, thick dark outlines, soft cel shading, playful squash-and-stretch energy, centered composition with room for a title, game key art"*
  - **Character and element sheet:** *"the red Plus robot and the blue Minus robot from front and side, idle, jump, magnet-power and hovering poses, plus a riveted metal crate, a fixed metal wall plate, a striped magnetic door with plus and minus lock plates, a hanging metal platform on a rail, a spring plate on a rail, a yellow hex bolt, a checkpoint flag and a double exit door, plus three small hats, chunky cartoon style, round squishy shapes, big expressive eyes, saturated colors, thick dark outlines, soft cel shading, game asset sheet on a plain light background, evenly spaced, consistent scale"*
  - **Logo:** *"the words "MAGNET TWINS" in chunky rounded letters, a red plus and a blue minus magnet worked into the letters, small magnetic arcs, chunky cartoon style, saturated colors, thick dark outlines, soft cel shading, game logo on a plain background, bold and readable at small size"*
  - **Negative prompt:** *"text, letters, watermark, signature, photorealistic, gritty, horror, violence, weapons, blood, cluttered background, blurry, low contrast, extra limbs, UI buttons"* (drop "text, letters" for the logo).

## 10. Audio
| Sound | When | Character |
|---|---|---|
| Plus hum | While Plus's field is on | Low warm buzz (~110 Hz), slow wobble |
| Minus hum | While Minus's field is on | Brighter buzz (~165 Hz), faster wobble |
| Clank | Metal lands or hits a wall | Short metallic hit, pitch by speed |
| Jump / land | Robot jumps / lands | Springy blip / soft thud |
| Bolt | Bolt collected | Bright ding, pitch rises per bolt (3 notes) |
| Door | Gate opens / shuts | Slide whoosh / clunk |
| Spring | Spring plate fires | Boing |
| Splash / zap | Water / spikes reset | Splash / electric fizz, then rebuild ratchet |
| Checkpoint | Flag raised | Two-note chime |
| Exit | Level complete | Cheerful 2-second jingle |
| Star | Each star stamps in | Stamp plus rising note |
| UI | Buttons | Soft click |

Music: yes, one short synthesized loop per world (16 bars, upbeat, generated in WebAudio), **off by default**. Sound effects on by default, both toggles persist.

## 11. GameAnalytics
Progression ids carry the mode as the third tier, so co-op and solo can be compared per level: `world01:level04:coop` / `world01:level04:solo`.

| Event id | When it fires | Value |
|---|---|---|
| `Start:world0N:level0M:<mode>` | Level begins (also after R) | — |
| `Complete:world0N:level0M:<mode>` | Both robots in the exit | Stars earned this run (1–3) |
| `Fail:world0N:level0M:<mode>` | Player restarts with R / button, or quits to the menu | Seconds played |
| `tutorial:step01` | Plus moves for the first time (level 1) | — |
| `tutorial:step02` | Minus moves for the first time (or first switch, solo) | — |
| `tutorial:step03` | First Plus power use | — |
| `tutorial:step04` | First Minus power use | — |
| `tutorial:done` | Level 6 (Boost) complete | — |
| `mode:coop` / `mode:solo` | Mode chosen on the title or switched in pause | — |
| `power:plus:use` | Level end (complete, fail or quit) | Number of Plus activations this attempt |
| `power:minus:use` | Level end | Number of Minus activations this attempt |
| `solo:switch` | Level end, solo only | Number of robot switches this attempt |
| `checkpoint:reset:water` / `checkpoint:reset:spikes` | Hazard reset | — |
| `ui:restart` | R or restart button | — |
| `shop:equip:<item>` | Item equipped | — |
| `settings:music:off` / `settings:sfx:off` | Toggle switched off | — |

Power and switch counts are sent once per attempt with a value, not per press, to keep event volume low.

**Question the data must answer:** which levels make pairs give up (high Fail-to-Complete ratio and quits in co-op), and do solo players finish as often as pairs (Complete rate per level by mode)?

## 12. Tech plan
- **Stack:** vanilla Canvas 2D, ES modules, no build step, following `STANDARDS.md`.
- **Modules (`src/`):** `main.js` (boot, loop), `game.js` (screen state machine), `physics.js` (fixed step, AABB vs tiles and bodies, carrying), `magnet.js` (cones, line of sight, forces, fixed-plate self-move), `entities.js` (robots, crates, platforms, doors, springs), `levels.js` (loader for `levels/`), `render.js` (offscreen tile layers, robots, fields, particles), `input.js` (keyboard, touch buttons, solo switching, key-test overlay), `ui.js` (screens, HUD, paint shop), `audio.js` (WebAudio synth), `save.js`, `analytics.js` (GameAnalytics wrapper, console log in development).
- **Simulation:** fixed 120 Hz step, deterministic, no allocations in the step (pooled particles and contact lists).
- **Save keys:** `cm_magnet-twins_save` → `{ v: 1, stars: { "w1l01": [1,1,0] }, best: { coop: { "w1l01": 31.2 }, solo: {} }, equip: { plus: {hat, pattern}, minus: {hat, pattern} }, mode: "coop" }` and `cm_magnet-twins_settings` → `{ v: 1, music: false, sfx: true }`. Reads in `try/catch`, broken data resets to defaults.
- **Testing hook:** `window.game` with `screen`, `level`, `score`, `mode`, `start()`, `restart()`, `win()` (debug only).
- **Riskiest piece:** stacked bodies (robot on robot on crate on platform) under magnet forces can jitter or tunnel. **Prove it first** in phase 2 with a physics sandbox level: two robots, three crates, a platform, both fields on, stacked every way, at 60 and 144 Hz.
- **Second risk:** keyboard ghosting on Chromebooks. Build the `?keytest` overlay on day one of phase 2 and test on a real device.
- **Content safety net:** input recording and replay (`?record` and a debug "replay all" screen) built in phase 2 alongside the physics, since every level's solvability and par depend on it. Determinism must hold across frame rates: test the same recording at 60 and 144 Hz.

## 13. Scope
- **v1:** both robots with all mechanics in section 3; 30 levels in 3 worlds; co-op and solo; stars and par times; paint shop (24 items); keyboard for two, touch buttons for solo; full shell, saving, audio, analytics.
- **Later:** weekly co-op challenge (a pool of extra levels rotating by ISO week, no server); level editor with shareable codes; more worlds.
- **Cut:**
  - **Swapping polarity** (a robot switching between + and −): it erases the "we need each other" pillar.
  - **Body color customization:** red and blue must always mean pull and push.
  - **Lives or game over:** against the forgiving pillar.
  - **Scrolling levels:** single screens keep both players in view and levels short.

## 14. Open questions
| Question | Recommendation | Who decides | Status |
|---|---|---|---|
| Does WASD+F with arrows+/ ghost on Chromebook keyboards? | Test in phase 2 with `?keytest`; fall back to E and Right Shift | Fafi | Open |
| Does hover-then-jump (field riding) feel good, or is the launch better as a burst? | Keep hover; tune in the phase 2 feel loop | Fafi | Open |
| Coolmath SDK, ad breaks, branding, size limit | Ads only on the level complete screen, never mid-level | Team | Open |
| GameAnalytics game key and secret | One key per game in a config file | Team | Open |
| Is a 3rd progression tier for mode acceptable for cross-game comparison? | Yes; the first two tiers match `STANDARDS.md` | Team | Open |

## 15. Changelog
- 2026-10-21 — Phase 1c review applied: shield rule (a robot using its power ignores its twin's field) to stop infinite flight; lock plates kept out of reach of their door, and closing doors push robots out; levels 1, 5 and 6 redesigned so they are solvable; aim fixed when the power turns on (same rule in co-op and solo, up keeps jumping); solution recordings per level and mode, with par = recording × 1.25; riders add no mass; slow crate pushing (80 px/s); touch buttons in CSS px (min 56); hover damping; 3-key load rule; chain platform moved to world 3; 1P/2P start playing at once; crate respawn waits for a clear spot; checkpoints only for levels with par over 60 s.
- 2026-10-21 — First draft from the brief and the phase 1a answers (4-direction aim, fixed plates move the robot, solo power toggle, constant field force at 120 Hz fixed step, robot stacking, shared checkpoints, world elements, solo par ×1.5, 1P/2P on the title, paint shop without body colors, weekly challenge moved to Later, keyboard-first exception, vanilla Canvas).
