# Echo Steps — Game design document

**Status:** In review
**Owner:** Fafi · **Reviewed by:** — · **Last updated:** 2026-10-26

> Every try leaves a glowing echo that does exactly what you did. Stand on plates, climb on your own head, take a laser hit for your future self: solve each room by teaming up with your past.

## 1. Summary
- **Pillars:**
  1. **You can always see what your echoes will do.** Echoes replay their path exactly, and their whole path, their next second and the moments they will press or flip something are always drawn. No hidden simulation.
  2. **Quick loops, no dead time.** A loop is 5–10 s, the clock waits for your first move, one key ends a loop early, and a resting echo keeps holding its spot. Recording a helper takes a few seconds, never a long wait.
  3. **Clever beats careful.** Puzzles are about who goes where and when, not pixel-perfect jumps. Timing windows are at least 0.5 s wide, and the fewest-echoes star rewards the smart idea.
- **Player:** Coolmath players aged 10–24 at a desk: school Chromebook with a keyboard, small browser tab, sound often off.
- **Session:** One room takes 1–3 minutes (3–6 loops of 5–10 s plus thinking). A typical visit is 15–25 minutes, about one world.
- **Hook:** "Wait, my echo could do both jobs." The echo star, the time star, the next element in the next room, and a replay of your winning loop on the results screen bring players back for one more room.

## 2. Core loop
- **Moment (seconds):** Run and jump to a spot → do the job (hold a plate, flip a switch, stand still as a step) → press Loop → the room rewinds and your attempt becomes an echo.
- **Room (minutes):** Read the room → plan who does what → record 1–3 echoes → run the final loop with your echoes working for you → reach the exit → stars for the exit, for few echoes and for a fast time.
- **Meta (days):** Three worlds, each adding new elements → missing echo and time stars on the room select → time stars unlock trails, the last one being the Speed Echo.

## 3. Mechanics

### 3.1 Space and scale
- Design resolution 1280×720. The HUD takes the top 80 px; the room is the remaining 1280×640.
- Rooms are a grid of **40 px tiles, 32 columns × 16 rows**, one screen, no scrolling. Rooms use as much of the grid as they need; unused cells are solid and drawn dark, so small tutorial rooms sit centered.
- At 800×450 a tile is 25 px on screen. Players, echoes and every element have thick glowing outlines and symbols, so they stay readable.

### 3.2 Simulation
- Fixed step at **120 Hz** with an accumulator (frame `dt` capped at 0.05 s), deterministic for the same inputs. Inputs are sampled once per step as a bitmask; nothing in the simulation depends on the frame rate.
- No `Math.random`, `Math.sin` or other transcendental functions inside the simulation (they are not guaranteed identical across engines); lifts move linearly. Visual effects use their own random generator outside the simulation.
- **Order of one step:** (1) read the input bits; a Loop or Delete press ends the loop here, before anything moves; (2) devices move towards their state from the previous step (gates, bridges, lifts); (3) echoes take their recorded position for this step and are checked (3.5); resting echoes fall and ride; (4) the live player moves and collides; (5) plates, switches, keys and locks update, then channels; (6) laser beams are traced and can zap the live player; (7) exit check; (8) the live player's state is written to its tape; (9) the loop clock advances.

### 3.3 The live player
- **Hitbox:** 24 × 36 px. Drawn about 32 × 44 px (capsule body, round head, cyan glow) with squash and stretch.
- **Run:** max speed **280 px/s** (7 tiles/s), acceleration 3000 px/s² (full speed in 0.1 s), ground deceleration 4000 px/s². In the air: acceleration 2400 px/s², deceleration 1500 px/s² with no input.
- **Jump:** take-off speed **720 px/s**. Gravity **2400 px/s²** while rising with jump held, **3000 px/s²** otherwise. Max fall speed 900 px/s. Releasing jump while rising multiplies upward speed by 0.45.
- **Measured with this integration (120 Hz):** full jump apex **105 px (2.6 tiles)**, air time 0.57 s, 159 px of horizontal travel at full speed. A tap gives a 21 px hop.
- **What that means for rooms:**

  | Climb | Needs | Spare height | Time above the ledge |
  |---|---|---|---|
  | 2-tile ledge (80 px) | a jump | 25 px | 275 ms |
  | 3-tile ledge (120 px) | 1 echo to stand on | 21 px | 250 ms |
  | 4-tile ledge (160 px) | 2 stacked echoes | 17 px | 225 ms |
  | 5-tile ledge (200 px) | 3 stacked echoes | 13 px | 200 ms |

  A lone jump misses a 3-tile ledge by 15 px, one echo misses 4 tiles by 19 px and two echoes miss 5 tiles by 23 px, so "one echo = one more tile" is never an almost. Ledges taller than 5 tiles are never climbed by stacking.
- **Gaps:** a running jump crosses up to 4.5 tiles (5.1 with coyote time). Gaps meant to be jumped are **at most 4 tiles**; gaps meant to stop you are **at least 6 tiles**. Never 5.
- **Forgiveness:** coyote time **80 ms**, jump buffer **100 ms**, and a 6 px corner nudge (bumping a ceiling corner by up to 6 px slides you past it; a ledge lip within 6 px below your feet while moving into it lifts you onto it). 6 px is less than every "miss" in the table above.
- **No velocity is inherited** from echoes or lifts when jumping: a jump is always the same jump.
- The live player can't push anything and can't be pushed by echoes.

### 3.4 Loops
- Each room has a **loop length** of **5–10 s** (in the room data). The live player and every echo start each loop at the room's spawn point at time 0.
- **The clock waits for your first move.** At the start of each loop everything is frozen until a move or jump key is down (held counts, so holding a direction through the rewind starts at once). This is free planning time and does not count for the time star.
- **The ring:** a 3 px ring of radius 34 px around the live player empties clockwise as the loop runs, with a tick mark per second. Before the clock starts it is full and breathes slowly with a small ▶. In the last 2 s it turns dashed and pulses (shape change, not only color) and the tick sound gets louder.
- **A loop ends** when (a) the clock runs out, (b) you press **Loop** (E / Enter), or (c) a laser zaps you (3.9). The attempt becomes an echo, unless the room's echo slots are full (3.5).
- **Rewind:** at the end of a loop, time freezes for 80 ms, then the whole loop plays backwards in **400 ms** (every body flies back along its path to the spawn, with a scanline shimmer and a reverse whoosh). The new echo turns from cyan to violet with a ripple and its number pops in. Any key press skips the rest of the rewind.
- **Loop before moving:** pressing Loop before the clock starts records an empty tape: an echo that rests at the spawn (a step right where you begin).
- **Delete** (Backspace or Delete) removes the latest echo **and restarts the current loop** (the current attempt is thrown away, nothing is recorded). With no echoes, Delete just restarts the loop. Deleting can't break other echoes: an older echo never depended on a newer one.
- **Restart room** (R) removes all echoes and resets the room and its time in a 300 ms rewind.
- **Fast-forward:** holding ↓ / S while the live player stands still on the ground runs the simulation 4× faster (a » icon on the ring). It changes nothing in the simulation, only how fast steps are shown, so recordings and times are unaffected. It stops the moment you press anything else.

### 3.5 Echoes
- **What an echo is:** the tape of one past loop: the live player's position, facing, pose and "what I stood on" at every step. Up to 1200 steps (10 s).
- **Replay:** during its tape an echo **takes its recorded position every step**. It does not run physics, so it does exactly what you saw, every loop.
- **Resting:** when an echo's tape ends (you pressed Loop, or were zapped), it **stays at its last spot**, standing still with a small ‖ on its badge, until the loop ends. If its tape ended in mid-air it drops straight down (gravity 3000 px/s²) and lands; a resting echo rides lifts and is pushed out by closing gates like the live player. So "walk to the plate, press Loop" makes a holder in 2 seconds, and a jump can't freeze an echo in mid-air.
- **What echoes do:** press plates, flip switches, block lasers, block lifts (a lift won't squeeze an echo), and are immune to lasers. They **can't** carry keys, open locks or use the exit.
- **Standing on echoes:** the top of a standing echo (on the ground, a ledge, a lift or another echo, or resting) is a **one-way ledge 32 px wide** (4 px wider than its hitbox on each side) for the live player and for other echoes' recordings. You walk and jump through echoes from the side and from below. While an echo is in the air (jumping, falling) its top is not solid, so a rider drops off: echoes can't launch you. Standing on a walking echo carries you with it.
- **No crush:** if an echo carries you into a ceiling you simply stop there; the echo's top passes through you.
- **Slots:** each room has **1–4 echo slots** (default 4), shown in the HUD. When all slots are full, ending a loop records nothing: the figure pops in place, the slots shake, and the ⌫ and R keycaps appear next to the slots.
- **Echoes are numbered** 1–4 in the order recorded. Each has a number badge above its head, a dashed outline and a fading violet trail; opacity 85%, 75%, 65%, 55% for echoes 1–4. The live player is always solid cyan, so live and echo differ by shape, outline and number, not only color.
- **Breaks (when the past no longer fits):** only the live player can change what echoes meet (pressing a plate that closes an inverted gate, flipping a switch, not opening a lock, standing in a lift's way). If, during its tape, an echo's recorded box overlaps something solid by more than 2 px (a closed gate, a lock, a bridge, a lift), or the thing it stood on is no longer under it (a bridge gone, a lift elsewhere, a broken echo), the echo **breaks**: it glitches for 250 ms, the thing that blocked it flashes, and it dissolves. It does nothing more this loop, its HUD slot shows a crack and its timeline lane shows a ✕. Echoes standing on it break too. A break is never a fail: the next loop replays every echo fresh.

### 3.6 Seeing the future (previews)
- **Paths:** every echo's whole path for the loop is drawn as a thin dotted line (20% opacity; 45% while the clock waits for your first move). The **next 1 s** of each echo's path is drawn brighter, ending in an arrowhead. Small icons sit on the path where the echo will press a plate (▼), flip a switch (◆) and come to rest (‖). A setting turns paths off.
- **Forecast:** at the start of each loop the game runs the loop once with the echoes alone (a headless pre-run of up to 1200 steps, under 2 ms). Any gate, bridge, lift or laser that the echoes will change shows a countdown arc **1 s before** it changes. If the live player presses a plate or flips a switch on a channel during the loop, that channel's forecast is dropped for the rest of the loop (it no longer applies) and its arcs disappear.
- **Timeline (HUD, from room 3):** a bar from 0 to the loop length with a playhead and the time ("3.4 / 8.0"). One lane per echo: a bar for its tape, dotted after it rests, filled blocks while it holds a plate, ◆ where it flips a switch, ✕ where it broke this loop. Rooms 1–2 show only the ring and the slots, so the first minute has as little UI as possible.

### 3.7 Plates, switches and channels
- Every plate and switch drives a **channel**. A room has up to 4 channels, each with a glyph: **▲ ● ■ ◆**. Plates, switches and the devices they drive all show their channel's glyph, and a dashed wire runs from each plate or switch to its devices in the background (L-shaped: horizontal, then vertical). The glyph and wire light up while the channel is on.
- **Plate (1 tile wide, in the floor):** pressed while any standing body (live player, echo or resting echo) overlaps it by at least 8 px. A channel driven by plates is on while any of its plates is pressed. The plate sinks 4 px when pressed.
- **Switch (1×1, a lever on a post, not solid):** flips its channel each time a body starts overlapping its 24 × 24 px center. Standing in it doesn't flip it again; leaving and coming back does. Each body is tracked separately. Its lever points left with **O** (off) or right with **I** (on). Switches reset to their start state at every loop.
- A channel is driven either by plates or by switches, never both.

### 3.8 Devices
- **Gate (1 tile wide, 2–4 tall, hangs from a solid header):** open while its channel is on. Opens upward in **150 ms**, closes in **200 ms**. A closing gate never crushes: it pushes a body in the doorway out to the side its center is on. **Inverted gate:** open while its channel is off (its glyph has a bar through it). **AND gate:** shows two or more glyphs and opens only while all of them are on.
- **Plate rule:** a plate is always at least **3 tiles of walking** from the gate it opens (0.43 s at full speed, more than the 200 ms closing time), and the lone-runner bot checks it (12). So whoever holds a plate can't use its gate.
- **Bridge (2–6 tiles wide, 1 thick, horizontal):** solid while its channel is on (or off, if inverted); when not solid it is drawn as a faint dashed outline. Fades in or out in 150 ms. A bridge that appears inside a body pushes the body up onto its top.
- **Key (1×1, floating):** the live player picks it up by touching it; it then orbits above their head. Any number can be carried. Echoes pass through keys. Keys go back to their place at every loop.
- **Lock (a gate with a keyhole, 1 tile wide, 2–4 tall):** opens the moment the live player touches it carrying a key, uses the key, and stays open until the loop ends. **Locked exit:** an exit with a keyhole needs a key to be entered.
- **Lift (2–3 tiles wide, 20 px thick, solid on every side):** moves along a straight rail at **120 px/s**. A **powered lift** moves towards its `to` end while its channel is on and back to its start while off. An **auto lift** goes back and forth on its own, pausing 0.5 s at each end, and restarts from its start at every loop. Riders are carried. A lift that would squeeze any body (live or echo) against a solid stops until it can move.
- **Laser (emitter in a wall, floor or ceiling tile):** fires a beam in one direction until it hits a solid tile, a closed gate or lock, a solid bridge, a lift or an **echo**. The beam is drawn 8 px wide; its deadly core is 4 px wide (forgiving). It zaps the live player on touch. A laser may sit on a channel (on while the channel is on, or off with inverted). Upstream of a blocker the beam is live; downstream it is safe, and the blocker flares with sparks.
- **Exit (an arch 1 tile wide, 2 tall):** the room is complete the moment the live player's box overlaps its inner 24 × 60 px.

### 3.9 Zaps (Core world)
- A zap freezes the live player for 120 ms (white outline flash on the figure, never the full screen, 3 px shake for 120 ms), then it dissolves and the loop ends **like a Loop press**: the attempt becomes an echo whose tape ends at the zap.
- An echo is immune to lasers, so it walks back into the beam and **rests there, blocking it**. "Take the hit for your future self" is the Core world's big idea.
- A zap echo's badge shows a small ⚡. If a zap was an accident, the ⌫ keycap appears so it can be removed at once.
- Lab and Archive have no hazards: nothing can hurt you there.

### 3.10 Stars and time
- Each star is earned on its own and kept forever:
  - ★ **Exit:** finish the room.
  - ★ **Echoes:** finish with at most the room's **echo par** echoes alive (the number of echoes in the room at the moment you exit; deleted echoes don't count, an echo that broke this loop still does).
  - ★ **Time:** finish with a **room time** at or under the **time par**.
- **Room time** is the sum of the running clock of every loop since the room started or since the last R, including loops whose echo you deleted. Frozen waits before the first move, rewinds and pauses don't count.
- **Echo par** is the number of echoes in the room's reference solution, the fewest the designer found. **Time par** = the reference solution's room time × 1.25, rounded up to the second (6).
- The HUD shows both goals during play (`⟳ ≤ 1` and `⏱ 0:12` beside the running room time); the time goal turns grey once missed.
- Finishing with fewer echoes than par still earns the star and sends `level:under_par`, so we learn about smarter solutions.

## 4. Controls
| Action | Mouse / touch | Keyboard |
|---|---|---|
| Move | ◀ ▶ buttons | ← → or A D |
| Jump (hold for full height) | Jump button | Space, ↑ or W |
| Loop now (end the loop, make an echo) | ⟳ button (HUD or touch) | E or Enter |
| Delete the latest echo and retry the loop | ⌫ button (HUD or touch) | Backspace or Delete |
| Fast-forward while standing still | » button (touch, hold) | Hold ↓ or S |
| Restart room | HUD button | R |
| Pause | HUD button | P or Esc |
| Hint (when available, 7) | HUD 💡 button | H |
| Menus | Click / tap | Arrows, Enter / Space |

- **Keyboard first is a deliberate exception** to "mouse first" in `STANDARDS.md`: a platformer can't be steered with a pointer. Every menu, the HUD and the Loop / Delete / Restart / Pause / Hint actions work with a click, and the on-screen buttons are Pointer Events, so a mouse can press them too (the game can be finished with mouse or touch alone, just less comfortably).
- **Touch:** 6 on-screen buttons in CSS pixels, not scaled with the canvas: ◀ ▶ bottom left; Jump bottom right with ⟳ and ⌫ above it and » beside it. Move and Jump are 64 CSS px (never under 56); ⟳, ⌫ and » are 56 CSS px. They appear after the first touch and hide again on the next key press. Multi-touch: hold ▶ and tap Jump.
- **One-key rule:** no moment needs more than 2 keys held at once (move + jump). Loop, Delete and Restart are single presses, never combined with movement.
- **HUD buttons** are drawn 56 design px but their hit areas are never under 48 CSS px at any window size (enlarged around the drawing), and on touch devices Loop and Delete also live in the CSS-px button overlay.
- Space, the arrows and Backspace call `preventDefault`, so the page never scrolls or navigates. Key auto-repeat is ignored for Loop, Delete, Restart and Jump.
- Loop and Delete are deliberately far from the movement keys (E is reachable from WASD, Enter and Backspace from the arrows) so they aren't pressed by accident.

## 5. Game elements
| Element | Behavior | First appears | Shape/icon (not color alone) |
|---|---|---|---|
| Live player | Runs, jumps, carries keys (3.3) | 1 | Solid cyan capsule with a round head and glow, ring around it |
| Loop ring | Time left in the loop (3.4) | 1 | Thin circle with second ticks; dashed and pulsing in the last 2 s |
| Echo | Replays a past loop, then rests (3.5) | 1 | Dashed violet outline, number badge 1–4, fading trail; ‖ when resting, ⚡ after a zap |
| Exit | Live player enters → complete | 1 | Rounded arch with a chevron ▲ above it |
| Plate | Channel on while pressed (3.7) | 1 | Flat bar in the floor with its channel glyph; sinks when pressed |
| Gate | Open while its channel is on (3.8) | 1 | Striped bar hanging from a header, channel glyph on it |
| Echo as a step | Stand on a standing echo (3.5) | 2 | Echo's head shows a small ledge line when it can be stood on |
| Echo slots | 1–4 per room (3.5) | 1 (limit felt from 4) | Row of hollow circles in the HUD, filled with the echo's number |
| Timeline | Echo lanes and events (3.6) | 3 | Bar with a playhead and lanes, ◆ ▼ ‖ ✕ marks |
| AND gate | Needs all its channels | 6 | Gate showing two or more glyphs |
| Inverted gate | Open while its channel is off | 7 | Gate whose glyph has a bar through it |
| One-way ledge | Stand on it, jump up through it | 11 | Thin ledge with small down-ticks underneath |
| Switch | Flips its channel when touched (3.7) | 13 | Lever on a post pointing to **O** or **I** |
| Bridge | Solid while its channel is on | 15 | Striped slab; a faint dashed outline when off |
| Break | An echo whose path no longer fits dissolves (3.5) | 16 (can happen from 7) | Glitch jitter, crack on its slot, ✕ on its lane |
| Key | Live player only, opens one lock (3.8) | 19 | Key shape orbiting the player's head |
| Lock / locked exit | Opens for a carried key, stays open this loop | 19 / 21 | Gate or arch with a keyhole |
| Laser | Beam zaps the live player, echoes block it (3.8, 3.9) | 25 | Nozzle emitter, beam with a zigzag core, sparks where blocked |
| Powered lift | Moves while its channel is on | 29 | Slab on a rail with end stops, channel glyph on it |
| Auto lift | Moves back and forth on its own | 31 | Slab on a rail with ⇄ or ⇅ arrows |

## 6. Level design
- **Structure:** 36 rooms in 3 worlds of 12.
  - **World 1 — Lab (1–12): "Your past self helps."** Echoes, the ring, plates and gates, standing on echoes and stacking them, the Loop key, echo slots, AND gates, inverted gates and release timing, one echo doing two jobs, one-way ledges. No hazards.
  - **World 2 — Archive (13–24): "Change things over time."** Switches (state that stays, and timing), bridges, breaks (what happens when you change your echo's past), keys and locks (only you, now, can carry). No hazards.
  - **World 3 — Core (25–36): "Machines and danger."** Lasers (take the hit, then walk in your echo's shadow), powered and auto lifts, then rooms combining every element.
- **Teaching order:** each element gets a safe intro room (one obvious use, little else), then a twist (a second use, or timing), then combinations with older elements. Rooms 1–3 teach one idea each (echo, step, Loop key) and can't be failed: there are no hazards and every mistake costs one loop.
- **Difficulty curve:** harder rooms have more echoes that depend on each other (echo 2 needs echo 1's gate), timing (an echo must leave a plate or flip a switch inside a window), an echo par that needs one echo to do two jobs, tighter loops, and red herrings (plates you don't need). Each world starts easier than the end of the last one. The echo par rises from 1 to about 3; a room needs all 4 slots only as an exam.
- **Room rules** (checked by `tools/simtest.mjs` where marked ✓):
  - **Solution recording ✓:** every room ships with a reference solution (12) that reaches the exit, uses exactly the echo par and sets the time par. A room is not done until it passes.
  - **No lone run ✓:** the lone-runner bot must fail to reach the exit with zero echoes (12). This catches walls that are jumpable after all and plates too close to their gates.
  - **Timing tolerance ✓:** delaying all inputs of any one loop of the reference solution by 0.25 s (30 steps) must still solve the room. No timing needs better than a quarter of a second.
  - **Short waits ✓:** no loop of the reference solution has the live player standing still for more than 3 s; the final loop no more than 1.5 s. Rooms are about doing, not waiting.
  - **Compact:** the spawn sits in the middle of the action; a good player does any one loop's job in 4 s or less. Loop lengths: Lab 5–10 s, Archive and Core 6–10 s.
  - **Heights and gaps:** the table in 3.3 is the law: 2 tiles = jump, 3 = one echo, 4 = two echoes, 5 = three; jumped gaps ≤ 4 tiles, blocking gaps ≥ 6.
  - **Plate rule:** a plate is at least 3 tiles of walking from its gate (3.8). Between two gates that must be open together, there is no room to wait (they are adjacent) unless the room wants you to wait there.
  - **Breaks** are only required knowledge from room 16; earlier rooms are laid out so a break can only come from a deliberate oddity.
- **Stars:** see 3.10. The echo star is where the depth is; the time star rewards replaying a solved room cleanly (R, then execute).
- **First 10 rooms (Lab).** Coordinates are columns (0–31) of a floor whose surface is the top of row 15; walking 1 tile takes 0.14 s.
  1. **Echo** (loop 5 s, par 1) — a corridor 3 tiles high: spawn col 7, plate ▲ col 11, gate ▲ col 17 under a solid header, exit col 22. Stepping on the plate opens the gate and stepping off shuts it (0.63 s of walking to the gate vs 0.2 s to close). A dashed silhouette stands on the plate. Stay there when the ring runs out and your echo holds the gate open for you. ← → keycaps at the spawn.
  2. **Step** (loop 6 s, par 1) — spawn col 10, a 3-tile wall at col 18 with the exit on top at col 24. A jump falls 15 px short. Rest at the foot of the wall (silhouette there, Space keycap) and climb your echo next loop (21 px to spare).
  3. **Loop Now** (loop 10 s, par 2) — spawn col 12, plate ▲ col 8 to the left, plate ● col 16 to the right, gates ▲ and ● side by side at cols 22–23, exit col 28. Both plates must be held at once (no room between the gates to wait), so one echo can't do both. Standing on a plate pops the **E** keycap: no need to wait 10 s. The timeline appears.
  4. **Relay** (loop 8 s, 2 slots, par 2) — plate ▲ col 9 opens gate ▲ col 14; behind it plate ● col 17 opens gate ● col 23; exit col 27. Echo 2 walks through the gate echo 1 holds. Once you leave plate ▲ its gate is shut long before you reach it (5 tiles), so one echo can't do both. Filling both slots with a wrong echo shows the ⌫ keycap.
  5. **Tower** (loop 6 s, par 2) — spawn col 12, a 4-tile wall at col 20, exit on top at col 25. One echo misses by 19 px. Echo 1 rests at the foot, echo 2 jumps on it and rests, you climb both (17 px to spare).
  6. **Both** (loop 8 s, par 2) — an AND gate ▲● at col 20; plate ▲ at col 4, plate ● at col 14, spawn col 9, exit col 26. Two echoes, one on each plate (10 tiles apart, so one body can't press both).
  7. **Let Go** (loop 8 s, par 1) — plate ▲ col 6 opens gate ▲ col 16 and closes inverted gate ▲̸ col 21; a 4-tile waiting room between them; spawn col 10, exit col 26. Your echo holds the plate until you are past the first gate, then walks off (back left), so the second opens. Hold too long and the forecast arc shows the second gate won't open in time; you can wait between the gates.
  8. **Two Jobs** (loop 8 s, 2 slots, par 1) — plates ▲ col 5 and ● col 9 on either side of the spawn (col 7); gate ▲ col 15, a 4-tile waiting room, gate ● col 20; exit col 26. Two echoes is the easy 2-star answer. The 3-star idea: one echo holds ▲ until you pass gate ▲ (about 1.3 s), then walks to ● (0.57 s) and rests while you wait.
  9. **High Plate** (loop 8 s, par 2) — plate ● sits on a shelf 3 tiles high (cols 3–6); gate ● col 22; spawn col 10, exit col 27. Echo 1 rests at the foot of the shelf as a step, echo 2 climbs it and rests on the plate. The plate is 15 tiles from its gate.
  10. **Spawn Step** (loop 6 s, par 2) — spawn col 7 right at the foot of a 3-tile wall (col 8); plate ▲ at col 2, gate ▲ upstairs at col 20 (13 tiles of walking from the plate), exit col 26. One echo holds the plate; the other is a step at the spawn, made by pressing Loop **before moving** (3.4). Both orders work, but the empty-tape echo costs no time, which the time star rewards.
- **Rooms 11–36 (one line each, tuned in phase 3):**

  | # | Name | Idea |
  |---|---|---|
  | 11 | Shelves | One-way ledges: climb through them; echoes rest on them as steps in mid-room |
  | 12 | Lab Exam | AND gate on a ledge, an inverted gate and a tower; the echo par needs one echo to do two jobs (par 3) |
  | 13 | Stay On | First switch: flip it yourself and it stays on; an echo still has to hold a plate for the second gate |
  | 14 | Flip Flop | One switch drives a gate and an inverted gate in series; your echo flips it again after you pass the first |
  | 15 | Bridge | A bridge over a 6-tile trench appears while its plate is held |
  | 16 | Don't Touch | Flip the switch too early and the gate closes in your echo's path: it breaks (first break lesson) |
  | 17 | Up and Over | A switch on a high shelf, reached by a tower; the switch then holds a bridge for you |
  | 18 | Rush Hour | One echo flips a bridge on and off; cross inside the window it leaves |
  | 19 | Key | The key sits behind a gate your echo holds; only you can carry it to the lock |
  | 20 | Ghost Hands | Your key run, replayed as an echo, breaks at the lock: the key belongs to the final loop |
  | 21 | Locked Exit | The exit has a keyhole; the key is across a bridge an echo must hold |
  | 22 | Key Timing | A key behind a switch-timed gate, a lock before the exit |
  | 23 | Stacks | Tower, switch and key in one room |
  | 24 | Archive Exam | Switches, bridges, a key and a lock (par 3) |
  | 25 | Take the Hit | First laser: a floor beam across the way. Walk in, get zapped, your echo stands in the beam and blocks it |
  | 26 | Shadow | Two wall lasers at foot and head height (no way over or under): get zapped in front of one, then walk in your echo's shadow once it arrives |
  | 27 | Shield Ride | Floor lasers along a corridor: ride on your echo's head while it walks through them |
  | 28 | Laser Switch | A laser on a switch channel: an echo turns it off at the right moment |
  | 29 | Lift | A powered lift rises while its plate is held; ride it to the exit ledge |
  | 30 | Going Up Together | An echo rides the lift up and holds a plate upstairs |
  | 31 | Shuttle | First auto lift: its timing is fixed every loop, catch it |
  | 32 | Moving Shield | A lift passing through a beam blocks it for a moment |
  | 33 | Power Cut | Lasers, a switch and a bridge over a trench |
  | 34 | Key Through Fire | Carry the key past lasers your echoes block |
  | 35 | Full House | All 4 slots needed: a tower plus a zap blocker |
  | 36 | Core Exam | Every element (par 3–4) |

- **Level data format** (one JSON object per room in `levels/`, loaded by `levels/index.js`):

```json
{
  "id": "w1l03",
  "name": "Loop Now",
  "loop": 10,
  "slots": 4,
  "par": { "echoes": 2, "time": 9 },
  "tiles": [
    "################################",
    "################################",
    "... 16 rows of 32 characters ..."
  ],
  "spawn": [12, 14],
  "exit": { "x": 28, "y": 13, "lock": false },
  "objects": [
    { "type": "plate", "x": 8, "y": 14, "ch": "A" },
    { "type": "plate", "x": 16, "y": 14, "ch": "B" },
    { "type": "gate", "x": 22, "y": 12, "h": 3, "on": "A" },
    { "type": "gate", "x": 23, "y": 12, "h": 3, "on": "B" },
    { "type": "gate", "x": 18, "y": 12, "h": 3, "on": ["A", "B"] },
    { "type": "gate", "x": 25, "y": 12, "h": 3, "on": "A", "invert": true },
    { "type": "bridge", "x": 10, "y": 9, "w": 4, "on": "C" },
    { "type": "switch", "x": 5, "y": 10, "ch": "C", "start": false },
    { "type": "key", "x": 3, "y": 4 },
    { "type": "lock", "x": 26, "y": 12, "h": 3 },
    { "type": "lift", "x": 14, "y": 13, "w": 2, "to": [14, 6], "on": "D" },
    { "type": "lift", "x": 6, "y": 8, "w": 2, "to": [12, 8], "auto": true },
    { "type": "laser", "x": 18, "y": 15, "dir": "up", "on": "D", "invert": true },
    { "type": "cue", "x": 11, "y": 14, "kind": "silhouette" },
    { "type": "cue", "x": 7, "y": 12, "kind": "keys", "keys": "move" }
  ]
}
```

  Tile characters: `.` empty, `#` solid, `-` one-way ledge. Coordinates are `[column, row]`. Spawn, exit, plates, switches, keys and cues give the empty cell they occupy (feet on the tile below; a plate is drawn in the top of that tile). A gate or lock gives its top cell and height `h`; a bridge its left cell and width `w`; a lift its start cell (left end), width and `to` cell; a laser its emitter tile (solid) and `dir` (`up`, `down`, `left`, `right`). Channels are `"A"`–`"D"` (drawn ▲ ● ■ ◆); `on` is one channel or a list (AND); `invert` flips it. `cue` objects are tutorial drawings only (silhouette, keycaps) with no effect on the simulation.
  The reference solution lives in `levels/solutions/<id>.json`: `{ "v": 1, "level": "w1l03", "frames": N, "inputs": [[step, bits], …] }`, one bitmask per 120 Hz step from the room start, stored only when it changes. Bits: 1 left, 2 right, 4 jump, 8 loop, 16 delete. It replays the whole room: every loop, every echo, the finish.

## 7. Progression and retention
- **Unlocks:** finishing a room unlocks the next. A world unlocks when the previous world's room 12 is finished. No star gates.
- **Hints:** after **60 s of room time or 8 loops** in a room, a 💡 button appears in the HUD. Hint *k* shows the path of echo *k* of the reference solution as a white dotted path with a "?" ghost walking it on a loop, and where it rests; the last hint shows the live route. Hints are free (no star is lost) and stay visible until the room ends; each one sends `ui:hint`.
- **Skip:** after 3 minutes of room time, or once every hint has been shown, the pause menu offers **Skip room**: the next room unlocks, this one shows a ↷ mark and no stars until it is finished. Sends `ui:skip`. Nobody gets stuck behind one puzzle.
- **Trails (the time-attack reward):** cosmetic trails for the live player; echoes copy the trail's shape in violet. Unlocked by **time stars**: Comet at 6, Pixel at 15, Ribbon at 24, and the **Speed Echo** (a string of quick afterimages) at 30 of 36. No currency. Trails never change the player's cyan, the echoes' violet, dashed outlines or number badges.
- **Return reasons:** missing echo and time stars on every room tile (with best echoes and best time shown under it), the next trail and its star count on the title, and a replay of your winning loop on the results screen that makes a better solution tempting.
- **Daily challenge:** none in v1 (the brief has none); a daily room is in Later.

## 8. Screens and UI flow
- **Title:** logo with two violet echoes of the letters trailing behind, big **PLAY** (starts the next unfinished room at once: one click from title to playing), **ROOMS**, **TRAILS**, music and sound toggles. Behind it, the player and three echoes loop a little demo on a plate and a gate.
- **Room select:** 3 world tabs (Lab, Archive, Core), 12 room tiles each with three star shapes (★ exit, ★ echoes, ★ time), best echoes and best time under each tile, the next room highlighted and bouncing, locked worlds with a lock and "Finish the Lab" / "Finish the Archive".
- **Playing (HUD, top 80 px):** left: room number and name; center: the timeline (from room 3) with the loop time; right: echo slots, the two goals (`⟳ ≤ 1`, `⏱ 0:12` with the running room time), then small buttons ⟳ Loop (labelled E), ⌫ (labelled ⌫), 💡 when available, restart and pause. In the room: the ring, echoes with badges, paths and forecast arcs.
- **Pause:** Resume, Restart room, Hint (when available), Skip room (when available), Paths on/off, Music, Sound, a controls card, Menu.
- **Room complete:** time slows to 30% for 0.3 s, the live player is drawn into the exit and each echo follows as a stream of light, one by one with its note. Then a panel slides in: three stars stamp in one by one with their goals ("Exit", "≤ 1 echo", "≤ 0:12"), echoes used and room time count up against par and best. Behind the panel the winning loop replays at 1.5× with every echo. Buttons **Next**, **Retry**, **Menu**.
- **Trails:** the player on a pedestal running in place with the selected trail; locked trails show their time-star count.
- **First run:** no text tutorial. Room 1 shows ← → / A D keycaps at the spawn (fading once you move) and a silhouette on the plate; room 2 a Space keycap and a silhouette at the wall; room 3 an E keycap whenever you stand on a plate. Contextual keycaps, each shown until used once: ⌫ when the slots are full or right after a zap; ↓ (fast-forward) after standing still for 1.5 s with an echo event still to come; 💡 when a hint unlocks.

## 9. Art direction
- **Family:** Night Neon.
- **Palette** (the same six colors as the brief's schematic; tints are these colors at lower opacity):

  | Hex | Role |
  |---|---|
  | `#121833` | Navy: room background and HUD |
  | `#EAF0FF` | Pale light: wall outlines, tile edges, text, UI, hint paths |
  | `#3EE6FF` | Cyan: the live player, its ring, the exit |
  | `#B48CFF` | Violet: echoes, their trails and paths, timeline lanes |
  | `#FFD25A` | Yellow: things you activate: plates, switches, wires, keys, channel glyphs, stars |
  | `#FF5FA2` | Pink: things that block or hurt you: gates, bridges, locks, lasers, the ring's last 2 s |

  World backgrounds stay navy with a 4% pattern: Lab, a cyan grid; Archive, yellow shelf silhouettes; Core, pink concentric rings. Solid tiles are navy filled with pale light at 8% and a 2 px pale edge.
- **Key visuals:** a simple glowing capsule figure (round head, no face, leaning into its run); echoes are the same figure with a dashed outline, a number badge and a trail; gates as striped bars that slide into a header; plates as glowing floor bars; lasers as a bright core in a soft glow with a zigzag running along it; lifts as slabs on thin rails.
- **Rendering:** all art drawn in code. The room (tiles, wires, static glow) is pre-rendered once per room to an offscreen canvas. Glows for the player, echo poses, plates and gates are pre-rendered sprites; no `shadowBlur` per frame. Echo paths are pre-built as one path per echo per loop. Particles are pooled.
- **Juice list:**
  - Run: tiny neon specks at the feet; jump stretch, landing squash and a small spark burst.
  - Ring: smooth emptying, a tick flash each second, dashed pulse in the last 2 s.
  - Loop end: 80 ms freeze, then the 400 ms rewind with a scanline shimmer; the new echo ripples from cyan to violet and its badge pops; its HUD slot fills with a bounce.
  - Plate: sinks 4 px, its glyph lights, a pulse runs along the wire to the device in 200 ms.
  - Gate: slides with an ease, a small bounce when it shuts, a 2 px shake for 60 ms if it shuts within 3 tiles of the player.
  - Switch: the lever snaps over with a spark. Bridge: fades in from its dashed outline with a shimmer.
  - Key: pickup pop and a sparkle orbit; lock: the key flies into the keyhole, click, the gate lifts with sparks.
  - Laser: flickering core, sparks and a flare where it hits an echo; zap: outline flash, pixel dissolve, 3 px shake for 120 ms.
  - Break: RGB-split jitter for 250 ms, the blocking device flashes, the echo dissolves into violet squares, its slot cracks.
  - Exit: 30% slow motion, the player and echoes stream into the arch, star burst; results stamp the stars and count up the numbers.
- **Concept art prompts** (updated from the brief):
  - **Gameplay screenshot (16:9):** *"Dark navy (#121833) neon puzzle platformer room seen from the side, a glowing cyan (#3EE6FF) capsule-shaped character with a thin glowing ring around it, two violet (#B48CFF) translucent ghost copies of itself with dashed outlines and faint trails, one standing on a glowing yellow (#FFD25A) floor plate, the other standing still at the foot of a tall wall while the cyan figure jumps on its head, a striped pink (#FF5FA2) gate lifted open, dashed yellow wires from the plate to the gate, a glowing cyan arch exit, pale glowing tile outlines, minimal clean neon style, 2D side view game screenshot, 16:9"*
  - **Key art / thumbnail (16:9 and 1:1, no text):** *"a glowing cyan figure jumping up a tower made of two fading violet ghost copies of itself standing on each other's heads, a third violet ghost below holding down a glowing yellow pressure plate that lifts a tall striped pink gate, faint motion trails curving back in time, minimal neon style, dark navy background, glowing outlines, a few vivid accent colors, clean geometric shapes, soft glow, calm and atmospheric, centered composition with room for a title, game key art"*
  - **Character and element sheet:** *"the cyan capsule player figure in idle, run, jump and landing poses with a thin glowing ring around it; violet dashed-outline ghost versions with trails and decreasing opacity; a yellow pressure plate, a striped pink gate in a header, a lever on a post, a striped pink bridge and its dashed outline, a yellow key, a pink gate with a keyhole, a laser nozzle with a pink beam hitting a violet ghost, a slab lift on a rail, a cyan arch exit, minimal neon style, dark navy background, glowing outlines, a few vivid accent colors, clean geometric shapes, soft glow, calm and atmospheric, game asset sheet on a plain dark navy background, evenly spaced, consistent scale"*
  - **Logo:** *"the words "ECHO STEPS" in thin glowing cyan neon letters, repeated twice behind themselves in fading violet like echoes, the letters standing on a thin glowing step line, minimal neon style, dark navy background, glowing outlines, a few vivid accent colors, clean geometric shapes, soft glow, calm and atmospheric, game logo on a plain dark navy background, bold and readable at small size"*
  - **Negative prompt:** *"text, letters, watermark, signature, photorealistic, gritty, horror, violence, weapons, blood, cluttered background, blurry, low contrast, extra limbs, UI buttons"* (drop "text, letters" for the logo).

## 10. Audio
| Sound | When | Character |
|---|---|---|
| Tick | Every second of a running loop | Soft woodblock; louder and higher in the last 3 s |
| Rewind | Loop end | Reverse whoosh with a tape-slowdown pitch dip |
| Echo born | New echo created | One note of a chord per echo (1 root, 2 third, 3 fifth, 4 octave) with a shimmer |
| Jump / land | Live player | Light blip / soft thud |
| Plate | Pressed / released | Low click up / down |
| Gate / bridge | Opens / closes | Airy slide up / short clunk; bridge: shimmer in, fizz out |
| Switch | Flipped | Two-pitch toggle click (higher for on) |
| Key / lock | Picked up / used | Bright ding / unlock clack |
| Lift | Moving | Quiet hum while it moves |
| Laser | Live player within 3 tiles | Low buzz; crackle where blocked |
| Zap | Live player zapped | Static crackle and a falling blip |
| Break | An echo breaks | Glitchy stutter |
| Slots full | Loop ends with no free slot | Dull double buzz |
| Exit | Room complete | The current chord resolves, sparkle per echo |
| Stars | Each star stamps | Stamp plus a rising note |
| UI | Buttons | Soft click |

Music: yes, **on by default** (synthesized in WebAudio, so tiny), with its own toggle. It is built from echoes: a soft pad and pulse at 120 BPM play during every loop, restart with it, and run backwards through the rewind; **each echo adds a layer** (1 bass, 2 arpeggio, 3 bells, 4 hats), so a full room sounds full. The game never needs sound: every cue above is also visible. The `AudioContext` starts on the first click or key press. Music and sound toggles persist.

## 11. GameAnalytics
Progression ids use the room's place in its world: room 15 is `world02:level03`.

| Event id | When it fires | Value |
|---|---|---|
| `Start:world0N:level0M` | Room begins (also after R) | — |
| `Complete:world0N:level0M` | Live player reaches the exit | Stars earned this run (1–3) |
| `Fail:world0N:level0M` | R / restart button, skip, or quit to the menu | Room time played (s) |
| `level:echoes_used` | On Complete | Echoes in the room at the finish |
| `level:under_par` | On Complete, if echoes used < echo par | Echoes used |
| `level:loops` | On Complete and on Fail | Loops played this attempt |
| `loop:early` | On Complete and on Fail | Loops ended with Loop (E) this attempt |
| `loop:timeout` | On Complete and on Fail | Loops ended by the clock this attempt |
| `loop:full` | On Complete and on Fail, if it happened | Loops that ended with every slot full |
| `loop:zap` | On Complete and on Fail, Core rooms | Zaps this attempt |
| `echo:delete` | On Complete and on Fail | Echo deletes this attempt |
| `echo:break` | On Complete and on Fail, if it happened | Echoes broken this attempt |
| `tutorial:step01` | First move (room 1) | — |
| `tutorial:step02` | First echo created | — |
| `tutorial:step03` | First time the live player passes a gate an echo holds open | — |
| `tutorial:step04` | First time the live player stands on an echo | — |
| `tutorial:step05` | First Loop (E) press | — |
| `tutorial:done` | Room 3 complete | — |
| `ui:restart` | R or restart button | — |
| `ui:hint` | Hint shown | Hint number |
| `ui:skip` | Room skipped | — |
| `trail:equip:<id>` | Trail equipped | — |
| `settings:music:off` / `settings:sfx:off` / `settings:paths:off` | Toggle switched off | — |

Counts are sent once per attempt with a value, never one event per action, to keep event volume low.

**Question the data must answer:** do players understand echoes by room 3 (the `tutorial:step01…done` funnel, and `level:loops` and Fail rates for rooms 1–3), and where do they get stuck (per room: Fail-to-Complete ratio, `level:loops`, hints and skips, `loop:full` and `echo:break`)?

## 12. Tech plan
- **Stack:** vanilla Canvas 2D, ES modules, no build step, following `STANDARDS.md`. Useful code from Magnet Twins and Flip Runner is **copied** into this folder, not imported: the fixed-step loop with accumulator and `visibilitychange` pause, input recording (`record.js`), axis sweeps against tiles and boxes (`physics.js`), save, the analytics stub, the WebAudio synth and music sequencer, pooled particles and shake, and the canvas button UI.
- **Modules (`src/`):** `main.js` (boot), `game.js` (frame loop, screens, HUD, event glue), `sim.js` (the deterministic room: live player, echoes, devices, channels, clock; no DOM), `physics.js` (sweeps against tiles, one-way ledges, gates, bridges, lifts and echo tops), `tape.js` (echo tapes in preallocated typed arrays: record, replay, rest, break checks), `forecast.js` (the echo-only pre-run for paths, arcs and timeline marks), `level.js` (parser), `render.js` (pre-rendered room layer, glow sprites, bodies, paths, ring, rewind), `hud.js` (timeline, slots, goals), `fx.js`, `input.js` (keys and touch buttons to one bitmask per step), `audio.js` (effects and echo-layered music), `record.js`, `hints.js` (runs a reference solution headless to get its tapes), `save.js`, `analytics.js` (GameAnalytics stub, console log).
- **Echo storage:** each slot holds `Float32Array` x and y and a `Uint8Array` of pose and ground reference for 1200 steps (about 11 KB per echo). Nothing is allocated during play.
- **Reference solutions:** recorded in the game with `?record` (the whole room, all loops, as one input stream, see 6) and shipped in the release build, because hints use them (36 files of a few KB).
- **Tools (`tools/`, Node, same `sim.js`):**
  - `simtest.mjs`: mechanics checks against this GDD (jump apex 105 px, the reach table in 3.3, max gap, coyote and buffer, plate-to-gate timing, rest and drop, breaks, one-way echo tops, rewind restores the exact start state), then every room's reference solution: reaches the exit, echoes used = echo par, room time sets the time par, the 0.25 s timing tolerance and the short-wait rule from 6.
  - `lonebot.mjs`: the **lone-runner bot**. A breadth-first search over standing positions (tile column, floor height) using macro moves played through the real simulation (walk one tile, full jumps left, right and straight up, short hops), with no echoes and the live player free to press plates and flip switches. It must not reach the exit; if it does, the room can be solved without echoes and gets redesigned.
  - A full solver for echo puzzles is not feasible (continuous platforming times up to four tapes), so solvability rests on the reference solutions, and cheaper solutions are caught by playtests and `level:under_par`.
- **Level editor (phase 3, debug only, `?edit`):** paint tiles, place and link objects, set the loop length, slots and pars, play from the editor, record the reference solution, export JSON. It draws the reach envelope from 3.3 (jump, +1 echo, +2 echoes) at the cursor so impossible ledges are seen while drawing.
- **Save keys:** `cm_echo-steps_save` → `{ v: 1, rooms: { "w1l03": { stars: [1,1,0], echoes: 2, time: 11.4, skipped: false } }, trail: "default", tut: { … } }` and `cm_echo-steps_settings` → `{ v: 1, music: true, sfx: true, paths: true }`. Reads in `try/catch`; broken data resets to defaults. Saved after every room complete and every settings change.
- **Testing hook:** `window.game` with `screen`, `level`, `score`, `loop` (time in the current loop), `echoes` (count), `start()`, `restart()`, `win()` (debug only), and `replay()` to play the reference solution (debug only).
- **Debug URL flags:** `?room=w1l03`, `?record`, `?replay`, `?hz=144`, `?edit`, `?forecast` (draws the pre-run for every channel).
- **Riskiest piece:** the echo model, in feel more than in code: do players read the paths, the ring and the timeline, and do rests, breaks and the rewind make sense? **Prove it first** in phase 2: the three tutorial rooms plus a debug sandbox room with an inverted gate and a switch (to provoke breaks), played cold by someone who hasn't read this document.
- **Second risk:** glow rendering on a 4 GB Chromebook with five figures, trails, paths and a rewind. Pre-rendered sprites and room layers; test with 4× CPU throttle in the slice.
- **Acceptance (from the brief):** two new players finish rooms 1–3 and explain what an echo is without being told; checked at the end of phase 2 and again before release.
- **Determinism check:** the same reference solution must replay identically in Node and in the browser at 60 and 144 Hz (`?hz=144`), and after a pause and a hidden tab.

## 13. Scope
- **v1:** the live player and every mechanic in section 3 (loops, ring, rewind, echoes with rest and breaks, paths, forecast, timeline, fast-forward); plates, gates (normal, inverted, AND), one-way ledges, switches, bridges, keys, locks, lasers, powered and auto lifts; 36 rooms in 3 worlds with reference solutions; stars (exit, echoes, time); hints and skip; 4 trails; keyboard and touch; full shell, saving, audio with echo-layered music, analytics; simtest, lone-runner bot and debug editor.
- **Later:** a daily room (date-seeded from a pool of extra rooms, streak and an emoji result line such as `Echo Steps Daily #12 · ⟳⟳ · 0:14 · 🔥3`); a player room editor with shareable codes (the brief's Later); a ghost of your best time run; more worlds.
- **Cut:**
  - **Echoes that replay inputs through physics** (they drift off course whenever anything differs): unreadable. Echoes replay positions and break visibly instead.
  - **Pushable crates and objects that echoes can move:** every push would make the past depend on the present, so breaks would be everywhere.
  - **Bottomless pits, spikes and lives:** rooms are closed boxes and the only hazard is the laser, which is also a tool.
  - **Boost jumps off a jumping echo:** they would make every height rule fuzzy; an echo's top is only solid while it stands.
  - **Scrolling rooms:** one screen keeps every echo and path in view.
  - **Echoes deleted from the middle of the list:** only the latest, so no echo ever loses something it relied on.

## 14. Open questions
| Question | Recommendation | Who decides | Status |
|---|---|---|---|
| Do cold players read the paths and the ring by room 3, or is there too much on screen? | Keep paths at 20% and the timeline from room 3; check in the slice playtest and cut the timeline before the paths if crowded | Fafi | Open |
| Movement numbers (280 px/s, 105 px jump) feel right? | Keep; tune in the feel loop without breaking the reach table in 3.3 | Fafi | Open |
| Loop lengths 5–10 s: too short for planning, too long for pace? | Keep; the clock waits for the first move, and fast-forward covers waits | Fafi | Open |
| Do players get "take the hit" in room 25 without text? | Keep the silhouette in the beam plus the ⚡ badge; fall back to a one-word cue "ZAP!" if playtests miss it | Fafi | Open |
| Hints unlock after 60 s or 8 loops: too early or too late? | Keep; adjust with `ui:hint` and Fail data | Fafi | Open |
| Coolmath SDK, ad breaks, branding, size limit | Ads only between rooms, never during a room | Team | Open |
| GameAnalytics game key and secret | One key per game in a config file | Team | Open |

## 15. Changelog
- 2026-10-26 — Phase 1c review applied: room 3 gates made adjacent (one echo could hold both plates in turn while you waited between them, making the Loop-key room a two-jobs puzzle); room 10 replaced by Spawn Step (the old one-echo answer was the obvious one); room 26 lasers at foot and head height (a waist-high beam could be jumped); echo tops solid only while the echo stands (riding a jumping echo gave 6-tile boost jumps that broke the reach table); resting echoes drop if their tape ends mid-air (no floating platforms); fast-forward while standing still and the short-wait rule, because waiting for an echo's moment was the dullest part; timeline hidden in rooms 1–2 to keep the first minute clean; jitter test (0.25 s) and lone-runner bot so rooms are fair and need their echoes; hints from the reference solutions and a skip after 3 minutes, because a stuck puzzle player leaves; HUD hit areas never under 48 CSS px; Loop before moving records an empty tape; trails cut from 6 to 4; the brief's definition of done added as an acceptance test. Status set to In review.
- 2026-10-26 — First draft from the brief and the phase 1a answers: echoes replay recorded positions and break visibly when the live player changes their past; a resting echo holds its last spot; the clock waits for the first move; Delete removes the latest echo and retries the loop; a laser zap ends the loop and its echo becomes a beam blocker; 280 px/s run and 105 px jump so each stacked echo is one more tile; paths, forecast arcs and timeline as previews; three independent stars (exit, echo par, time par = reference × 1.25); per-room loop length 5–10 s and 1–4 slots; Lab (plates, gates, steps), Archive (switches, bridges, keys), Core (lasers, lifts); music built from echo layers, on by default; reference solution per room replayed by `tools/simtest.mjs`; keyboard-first exception documented.
