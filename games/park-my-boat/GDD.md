# Dock All The Boats — Game design document

**Status:** Draft
**Owner:** Pao · **Reviewed by:** Fafi · **Last updated:** 2026-10-25

> Park a rowboat, then a cruise ship 100x bigger right next to it, against the clock, in a harbor where nothing has brakes.

This GDD describes the prototype that is already built (`src/`, `levels/levels.js`, `tools/editor.js`) and the changes for v1. Lines marked **(new)** are not built yet. The owner's decisions are listed in section 14.

## 1. Summary
- **Pillars:**
  1. **No brakes.** Boats coast, drift and slide. Stopping in the right place is the skill.
  2. **Wildly different sizes.** A 2.4 m jet ski and a 400 m container ship share one harbor. The camera zoom sells the jump.
  3. **Physics is the joke.** Bumps, spinning ducks and wobbling boats are funny with the sound off. The text stays plain.
- **Player:** Coolmath players aged 12–24, on a school Chromebook or at a desk, mouse or trackpad, often with the sound off.
- **Session:** one boat takes 15–40 s; one level (1–5 boats) takes 20–90 s of clock time (par ≤ 90 s, see 3.6); a typical visit is 10–20 minutes (6–12 levels).
- **Hook:** a clock and a par time. "I was 3 s off three stars" brings players back. Knowing the harbor makes the next run faster.

## 2. Core loop
- **Moment (seconds):** steer → let go early → coast → line up → drop anchor → wait for the boat to settle.
- **Level (20–90 s of clock time, plus camera moves):** the camera shows the slip → glides back to the boat → park it → the camera zooms to the next boat, bigger or smaller → … → results with time and stars.
- **Meta (days):** unlock the next level, replay for three stars, beat your best time, find the bonus level.

## 3. Mechanics
Units: the world is in meters, and the camera is free (no fixed px scale). Each boat type has a toy size (`L`, `W` in toy units) and a scale `k` to real size. All handling numbers below are in toy units and scale with `k` (`makeBoat` in `src/main.js`). UI is laid out in a 40 × 22.5 unit box (1280 × 720 at 32 px per unit).

### 3.1 Scale
- Real length = toy length × `k`. Mass scales with k³, so big ships shove small boats and barely notice.
- Big boats react slower: response time × k^0.3, capped at 1.25x (`MAX_SLOWDOWN`). Small boats feel twitchy, and big ships feel heavy without dragging.

### 3.2 Boat physics
- Each boat is a rigid body made of circles along the keel. On pointy hulls the circles shrink toward the bow and stern (`fitCircles`), so the tips collide where they are drawn.
- Water drag is low along the keel and high sideways. With no throttle, forward drag drops to 30% (`COAST_DRAG = 0.3`), so boats glide about 3x farther. This is global for every boat; the boat stats make the differences.
- The rudder turns more at higher speed, plus some prop wash at low speed. Reverse is weaker than forward. All engine power × 1.5 (`SPEED`).
- 2 physics substeps per frame (`SUBSTEPS`).

### 3.3 Boat types
| Boat | Real length | Mass | Power | Reverse | Turn | Feel |
|---|---|---|---|---|---|---|
| Jet Ski | 2.4 m | 0.8 | 7 | 0.3 | 1.5 | Quick, slides, almost no reverse |
| Swan Pedalo | 2.6 m | 1 | 3.5 | 0.7 | 2.2 | Slow, spins on the spot |
| Rowboat | 2.9 m | 1 | 6 | 0.6 | 1.1 | Neutral, the learning boat |
| Zippy | 6.8 m | 1.5 | 13 | 0.5 | 0.9 | Fast, drifts in turns |
| Party Barge | 9.2 m | 4 | 12 | 0.6 | 0.55 | Wide, slow to turn |
| Sailboat | 12 m | 3.5 | 7 | 0.5 | 0.7 | Strong keel, tracks straight |
| Tugboat | 26 m | 5 | 30 | 0.8 | 0.9 | Strong, pushes things |
| Mega Yacht | 80 m | 10 | 30 | 0.5 | 0.35 | Long, slow to turn |
| Cruise Ship | 300 m | 12 | 34 | 0.5 | 0.32 | Huge, takes ages to stop |
| Container Ship | 400 m | 14 | 34 | 0.45 | 0.28 | The biggest regular boat |
| Island (bonus) | 30 km | 14 | 36 | 0.5 | 0.3 | Blob hull |
| Continent (bonus) | 3000 km | 16 | 36 | 0.5 | 0.28 | Blob hull |

Mass and power are toy values before scaling. A level can set its own `k` for a boat (for example the 48 m yacht in Marina).

### 3.4 Anchor
- Space, Enter or the anchor button drops the anchor at the bow on a short rope with heavy drag.
- Dropping it faster than 2.5 toy units/s spins the boat out (spin 6 rad/s for 0.3 s, `ANCHOR_SPIN`) with a "Too fast!" popup.
- Pressing again before the boat settles raises the anchor.
- **(new) Speed cue:** the anchor button shows a calm anchor icon below the limit and a ⚠ shape above it (shape, not just color). A thin arc around the player's boat fills with speed and shows a notch at the limit.

### 3.5 Judging
- The boat is judged when it is nearly still for 0.5 s, or 3.5 s after the anchor drops.
- **Inside:** every hull circle is inside the slip. Nose-in and stern-in both count.
- **Accuracy:** 60% position (0.8 toy units off = 0) + 40% angle (20° off = 0). Boats 50 m and longer get a slip 15% longer and wider and a 23° angle allowance (`BIG_SHIP_LENGTH`, `BIG_SHIP_LEEWAY`).
- **(new) Parked:** inside and accuracy ≥ 50%. The slip turns solid, a check mark pops up, and the next boat starts.
- **Not parked (new: a message per cause):** the anchor comes up and the player keeps going from where the boat is. The clock keeps running. The message says what was wrong, and the ghost in the slip flashes the matching part:
  - a hull circle is outside the slip: "Not in the slip." (the ghost outline flashes);
  - inside, but the angle part is the bigger loss: "Line it up straighter." (the ghost rocks to the right angle);
  - inside, but the position part is the bigger loss: "Closer to the middle." (the ghost's center mark flashes).

### 3.6 Time and stars (new)
- The clock runs only while the player has control. It stops during the slip preview and the camera glides between boats, while paused, and while the tab is hidden (the game pauses then too).
- A boat's time stops at the anchor drop that ends up parking it, so the settle wait doesn't count. After a miss, the wait counts.
- Level time = sum of the times for all boats.
- Each level has a `par` time in seconds in its data. 3★ ≤ par, 2★ ≤ 1.5 × par, 1★ for finishing.
- **Setting par:** the designer's clean run (no misses) × 1.2, rounded up to the next whole second. Checked again in playtests. Par is at most 90 s per level (120 s for level 20); if a level needs more, move ship slips closer to where the ships start.
- Accuracy, the damage bill and ducks hit show on the results as extras. They do not change stars.
- There is no fail state. A level only ends when all its boats are parked, or when the player restarts or quits.

### 3.7 Camera
- Each boat has a set framing ("a few boat lengths") and the player can't zoom. The jet ski multiplies its framing by `view` (3 today, **(new)** 2 with look-ahead). Ships of 50 m and longer use `BIG_SHIP_VIEW = 3.5`.
- **Slip preview:** when a boat starts, the camera shows its slip for 3 s (`SLIP_SHOW`), then glides back to the boat at 40% speed (`SLIP_GLIDE`). Control starts when the camera is within 10% of the view and 20% of the zoom (capped at 6 s, `SLIP_MAX`). A click, Space or Enter cuts to the glide.
- **(new) Restart skips the boat 1 preview:** after R, RESTART or RETRY (results screen), boat 1 has control at once (restart < 1 s). Later boats still get their preview.
- **(new) Look-ahead:** the camera leads the boat by up to 25% of the view in its direction of travel, eased over 0.5 s.
- **(new) Edge arrows:** when the slip is off screen, an arrow with a slip icon at the screen edge points to it. Traffic on course to come within (the player's length + its own length) of the player in the next 3 s gets a coral arrow with a boat icon. At most 2 traffic arrows show, for the nearest threats.
- Zoom moves are in log space. A scale bar shows the zoom. Boats too small to see draw as dots, and the player gets a ring when tiny. Outlines, shadows, popups and UI stay the same size on screen.

### 3.8 Obstacles
See section 5 for each element. Things that get bumped stay where they end up: nothing springs back home. A boat waiting its turn that gets knocked starts its turn from there.

**(new) Clearing the slip.** Nothing may block the current boat's slip for long:
- Any boat other than the player (moored, drifting, waiting its turn, or parked earlier) whose hull overlaps the current slip starts its engine (putt sound, wake) and drives to the nearest open water outside the slip at 40% of its top speed, then stops there. Traffic does this too, then goes back to its path.
- Logs and buoys inside the slip get a gentle push out of it (0.5 toy units/s, like a small current), until they are clear.
- This runs at the start of each turn and all through it. It doesn't move the player's boat; a wedged player can always reverse, and R is the last resort.

### 3.9 Score extras
A damage bill in dollars (from impact energy) and a count of ducks hit, shown in the HUD and on the results. They don't affect stars.

## 4. Controls
| Action | Mouse / touch | Keyboard |
|---|---|---|
| Throttle and steer | Hold anywhere on the water: the boat steers toward the pointer. Farther = more throttle | W / Up |
| Reverse | Hold behind the boat | S / Down |
| Rudder | (by pointer position) | A / D, Left / Right |
| Drop or raise anchor | Anchor button (bottom right, 3.6 units round) | Space / Enter |
| Skip slip preview | Click or tap | Space / Enter |
| Restart level | RESTART button | R |
| Pause | II button | P / Esc |

**(new)** At 800×450 the pause and restart buttons are smaller than 48 px. Make them at least 48 × 48 px at that size.

## 5. Game elements
| Element | Behavior | First appears | Shape/icon (not color alone) |
|---|---|---|---|
| Slip | Dashed box with a ghost of the boat; turns solid with a check mark when parked | 1 | Dashed outline → solid fill + check |
| Dock / quay | Static wood or concrete edge | 1 | Planks / stone blocks |
| Sand / landmass | Static; boats bump off | 1 | Sand fill, round blobs |
| Pilings | Static posts | 2 | Small round posts |
| Buoy | Floats free, very bouncy; at least 1/12 of the current boat's length wide (`BUOY_SHARE`); drifts out of the current slip | 5 | Round with a stripe |
| Duck family | Mother wanders and flees the player, ducklings follow; a hit stuns and spins them | 6 | Duck silhouette |
| Moored boat | Free body; a bump moves it and it stays; drives out of the current slip (3.8) | 7 | Boat shape, no captain |
| Drifting boat / log | Loose, can be pushed; drifts out of the current slip (3.8) | 8 | Log shape / empty boat |
| Current | Zone that moves the water; arrows show the flow | 9 | Animated arrow stripes |
| Scale jump | Next boat is much bigger or smaller; card shows "300 m · 105x BIGGER" | 4 | Card with size text |
| Traffic | Boats that drive a path (back and forth, loop, stop at the end); a hit shoves them and they steer back | 11 | Boat shape with wake |
| Big ship (≥ 50 m) | Wider slip and angle allowance | 4 | — |

## 6. Level design
- **Structure (v1):** 2 worlds of 10 levels, plus 1 hidden bonus.
  - **World 1, Learn the Ropes:** one boat per level at first, then pairs. Teaches throttle, coasting, the anchor, the first scale jump, then one new obstacle per level.
  - **World 2, Big & Small:** chains of 2–5 boats with big scale jumps, traffic, crowded marinas and currents together.
  - **Bonus, Continental Drift:** rowboat → cruise ship → island → continent, 100x each step. Unlocks when all 20 levels are finished.
- **Teaching order:** each new element first appears where it can't hurt (ducks away from the line to the slip), next in the way (ducks crossing the fairway), then with an earlier element (ducks plus moored boats).
- **Difficulty curve:** a level gets harder with: more boats in the chain, bigger scale jumps, a narrower slip (less `pad`), a longer or bent route, moving things in the way, current across the approach. Add one of these per level, and never two new ones at once. Par stays at most 90 s (3.6). A level should take a first-time player at most 3 tries.
- **Stars:** see 3.6. 3★ ≤ par, 2★ ≤ 1.5 × par, 1★ for finishing.
- **Levels:** (existing levels are named in quotes)

| # | Name | Boats | What it teaches |
|---|---|---|---|
| 1 | First Mooring | Rowboat | Empty harbor, big slip straight ahead at a dock. Taught by play: a ghost pointer holds and drags from the boat toward the slip until the player moves; when the boat is slow inside the slip, a SPACE key and anchor icon pulse over the anchor button. Text: "Park in the box." |
| 2 | Easy Does It | Rowboat | Slip to the side past two pilings: turn 90° and let go early. Hint: "Let go early. Boats keep gliding." |
| 3 | Too Fast! | Zippy | Long straight run, slip at the end. Anchoring at speed spins you out. Hint: "Slow down before you drop anchor." |
| 4 | "Odd Couple" | Rowboat → Cruise Ship | The first scale jump. The parked rowboat sits next to the cruise ship's slip. |
| 5 | Buoy Alley | Jet Ski | The jet ski's own level: quick, slidey, almost no reverse, through a line of bouncy buoys to a pier slip. |
| 6 | Duck Crossing | Swan Pedalo → Sailboat | Duck families cross the fairway; the swan spins, the sailboat tracks straight. |
| 7 | Tight Squeeze | Sailboat | Parallel park between two moored boats on a pier. |
| 8 | Tug Life | Tugboat → Mega Yacht | Push drifting logs and an empty barge out of the yacht's slip, then park the yacht. |
| 9 | River Mouth | Zippy → Party Barge | A current crosses the approach; aim upstream. The wide barge gets pushed more. |
| 10 | "Mixed Nuts" | Mega Yacht → Cruise Ship → Swan Pedalo | World finale: big, bigger, tiny. |
| 11 | "Way Down" | Container Ship → Tugboat → Jet Ski | Big-to-small chain, first slow traffic (party barge, sailboat). |
| 12 | Ferry Lane | Rowboat → Mega Yacht | One ferry lane of back-and-forth traffic to cross twice. |
| 13 | Container Port | Tugboat → Container Ship | Tight ship berth between two moored container ships. |
| 14 | "Rush Hour" | Jet Ski | Three canals of looping traffic; stop on the sand and wait for a gap. |
| 15 | Swan Lake | Swan Pedalo → Rowboat → Jet Ski → Cruise Ship | Three tiny slips side by side, then the ship parks next to them without crushing them. |
| 16 | Crosscurrent | Sailboat → Cruise Ship | A strong current along the quay. |
| 17 | Drift Field | Zippy → Tugboat → Mega Yacht | A harbor full of loose boats and logs. |
| 18 | "Marina" | Jet Ski → Sailboat → 48 m Yacht | Packed yacht marina with tenders in the fairways. |
| 19 | Busy Harbor | Party Barge → Container Ship → Rowboat | Traffic plus current plus moored boats. |
| 20 | Dock All The Boats | Jet Ski → Rowboat → Sailboat → Mega Yacht → Container Ship | Five boats, 2.4 m to 400 m, one harbor. |

Levels 1–3 and 5–9, 12–13, 15–17 and 19–20 are new.

- **Level data format:** `levels/levels.js` (JS so levels can use helpers like `basin(...)`, `berths(...)`, `loopLane(...)`). The level editor writes this file in place.

```js
{
    name: 'Odd Couple',
    par: 45,                       // (new) seconds for 3 stars
    bonus: false,                  // hidden unless ?bonus, unlocks after all regular levels (new)
    land: [[x0, y0, x1, y1], ...], // sand rects, meters
    docks: [{ x0, y0, x1, y1, quay?, plank? }],
    lands: [{ x, y, k, circles: [[x, y, r], ...], grass? }],
    boats: [{ boat: 'dinghy', k?, start: { x, y, a }, slip: { x, y, a, pad?, fingers? }, hint? }],
    moored: [...], drifters: [...], buoys: [[x, y, scale]], ducks: [{ x, y, kids }],
    currents: [...],
    traffic: [{ boat, k?, path: [[x, y], ...], end?: 'back' | 'loop' | 'stop', speed?, during?, pace? }],
}
```

The `world` of a level comes from its position in the list (levels 1–10 → world 1, 11–20 → world 2) **(new)**.

## 7. Progression and retention
- **(new) Unlocks:** finishing a level (any stars) unlocks the next one. No star gates. World 2 opens when level 10 is finished.
- **(new) Bonus:** Continental Drift unlocks when all 20 levels are finished. Its card says "BONUS". `?bonus` still shows it for testing.
- **Best time** per level, shown on the level card and the results.
- **Replay pull:** the results show how many seconds were missing for the next star ("2.4 s to ★★★").
- **Daily challenge:** not in v1 (see 13).
- **Save (new shape):** `cm_park-my-boat_save` = `{ v: 1, stars: [], best: [] /* best time in ms */, sound: true, music: true }`. The prototype stored best accuracy in `best`; no one outside the team has a save, so old saves are reset.

## 8. Screens and UI flow
**Title → Level select → Playing (⇄ Pause) → Level complete → next level / retry / menu.**

- **Title:** logo with a bobbing title, a boat parade doing donuts and a cruise ship passing behind. PLAY (goes to the first level without 3 stars), LEVELS, SOUND toggle, **(new)** MUSIC toggle once the music is in (see 10).
- **Level select:** **(new)** two pages, one per world (title "World 1 · Learn the Ropes"), 10 cards each. A card shows the level number, stars (filled vs outline), and the best time. Locked levels show a lock. The next level pulses. The bonus card comes after level 20.
- **Playing:** HUD bar on top: level number and name, boat name and size, "Boat 2/3", **(new)** the clock with the par time ("0:31 / ★★★ 0:45"), damages, the scale bar, RESTART and II. The anchor button sits bottom right and shows the speed cue (3.4). The hint shows at the bottom for 6 s. Between boats a card shows "Boat 2 of 3" and the size line ("300 m · 105x BIGGER").
- **Pause:** dims the screen. RESUME, RESTART, MENU.
- **Level complete:** "PARKED!", 3 stars that pop in one by one, **(new)** level time counting up, the par times, "NEW BEST!", time per boat, accuracy per boat, anchor drops, damages, ducks hit. NEXT (BONUS when the bonus is next), RETRY, MENU.

## 9. Art direction
- **Family:** Toybox Flat. Everything is drawn in code with Canvas 2D: flat fills, 0.1-unit ink outlines, soft offset drop shadows.
- **Palette:**

| Hex | Role |
|---|---|
| `#8CD6D1` | Water |
| `#33949E` | Teal: UI accents, jet ski, slip outline |
| `#F2635F` | Coral: warnings, damages, rowboat, tug |
| `#FFCC47` | Sunny: title, stars, party barge |
| `#FFF7E5` | Cream: panels, white hulls |
| `#E8B873` | Wood: docks, decks |

`#2B2D42` ink is the outline color. Sand, stone, navy, grass and skin are support tones (see 14).
- **Key visuals:** the player boat with a captain (eyes pop on a bump); slips as dashed boxes with a ghost of the boat; water ripples in octaves 10x apart so the water keeps its texture at every zoom; a map-style scale bar.
- **Juice list:**
  - Bump: screen shake scaled by impact (max 0.5), bonk, the captain's eyes pop.
  - Anchor drop: splash ring and chain sound; "Too fast!" spin-out.
  - Ducks hit: the duck spins and quacks.
  - Wake foam behind moving boats.
  - Parked: slip goes solid with a check, **(new)** confetti burst from the slip, horn.
  - Between boats: zoom glide with the size card sliding in.
  - Results: panel drops in with overshoot, stars pop one by one with rising clicks, **(new)** time counts up, "NEW BEST!" bounces.
  - Title: bobbing logo, boat parade.
- **Concept art prompts:**
  - "Top-down toy harbor in flat vector style, teal water #8CD6D1, wooden docks #E8B873, a tiny coral rowboat parked next to a giant navy cruise ship, thick dark outlines #2B2D42, soft drop shadows, cream and sunny yellow accents, playful, no text."
  - "Flat vector sticker sheet of toy boats seen from above: jet ski, swan pedal boat, rowboat, speedboat, party barge, sailboat, tugboat, mega yacht, cruise ship, container ship; each with a tiny cartoon captain, thick ink outlines, palette teal, coral, sunny yellow, cream, wood."
  - "Top-down crowded yacht marina in toy flat style, piers lined with boats, one empty berth outlined with a dashed box, ducks in a line, buoys, teal water."

## 10. Audio
| Sound | When | Character |
|---|---|---|
| putt | Motor running, repeats with throttle | Low putter, pitch lower for bigger boats |
| bonk | Any bump | Hollow wooden knock, louder with impact |
| quack | Duck hit or fleeing | Short squeaky quack |
| bong | Buoy hit | Bell-like ring |
| splash | Anchor hits the water | Short noise burst |
| chain | Anchor rope paying out | Fast rattling clicks |
| horn | Boat parked / ship starts | Deep ship horn |
| win | Level complete | Rising two-note jingle |
| fail | Not in the slip | Soft descending womp |
| click | UI buttons, each star | Short tick, pitch rises per star |

All are ZzFX through LittleJS `Sound`, created after the first input.

Music **(new)**: yes. Pao adds it later in production; mood and length are decided then. The MUSIC toggle on the title comes with it (required by `STANDARDS.md`).

## 11. GameAnalytics
Level ids: `world01:level04` (`bonus:level01` for the bonus).

| Event id | When it fires | Value |
|---|---|---|
| `progression Start world01:level04` | Level loads (also on restart) | — |
| `progression Complete world01:level04` | Last boat parked | Level time in tenths of a second |
| `progression Fail world01:level04` | Player restarts or quits to the menu before finishing | Seconds played |
| `tutorial:step01` | Level 1: first throttle input | — |
| `tutorial:step02` | Level 1: first anchor drop | — |
| `tutorial:step03` | Level 1: first boat judged (inside or not) | — |
| `tutorial:done` | Level 1 complete | — |
| `boat:world01:level04:b2:start` | Boat 2 gets control | — |
| `boat:world01:level04:b2:park` | Boat 2 parked | Seconds for that boat |
| `boat:world01:level04:b2:miss` | Boat 2 judged outside the slip | Miss count for this boat so far |
| `anchor:toofast` | Anchor dropped too fast | Boat number |
| `ui:restart` | R or RESTART | — |
| `ui:skip` | Slip preview skipped | — |
| `settings:sfx:off` | Sound toggled off | — |
| `settings:music:off` | Music toggled off | — |

No daily events (no daily in v1).

**Question the data must answer:** On which boat of which level do players give up? The last `boat:…:start` in a session with no `park` after it marks the boat, also for players who just close the tab. `Fail` and the `miss` count before it add detail.

## 12. Tech plan
- **Engine:** LittleJS (`dist/littlejs.js`, bundled), Canvas 2D (`setGLEnable(false)`), no build step.
- **Modules today:** `src/boats.js` (boat types, hulls, colors), `src/physics.js` (circle rigid bodies), `src/render.js` (water, drawing), `src/main.js` (game, camera, UI, input, judging, 1389 lines), `levels/levels.js`, `tools/editor.js` (debug editor, removed in release).
- **(new) Split `main.js`** by concern as the first step of phase 2, in its own commit with no behavior change: `camera.js`, `ui.js`, `audio.js`, `analytics.js`, `save.js`, keeping `main.js` for the game state and loop.
- **Simulation:** LittleJS fixed 60 Hz update with 2 physics substeps. Not deterministic across machines; nothing needs it to be (no replays, no daily).
- **Save:** one key, `cm_park-my-boat_save`, read in `try/catch`, reset on any error.
- **Testing hook:** `window.game` with `screen`, `level`, `score` (level time), `start()`, `restart()`, `win()` (debug only).
- **Riskiest piece:** performance in big levels on a 4 GB Chromebook. Marina has 218 moored boats and 6 traffic boats; Rush Hour has 31 traffic boats. **Prove it early:** run Marina and Rush Hour in Chrome with 4x CPU throttle in the first slice week. If under 60 fps, put moored boats to sleep until something touches them, and draw far-away boats as cached sprites.
- **Second risk:** par times that feel fair. The `boat:…:park` times from playtests set them.

## 13. Scope
- **Vertical slice (phase 2):** the 5 existing levels (Odd Couple, Mixed Nuts, Way Down, Rush Hour, Marina, in that order) inside the full v1 shell: timer and par stars, unlocks, restart without preview, clearing the slip, miss messages, anchor speed cue, look-ahead and edge arrows, the new results screen, save, and analytics stubs that log to the console. The new tutorial levels come in phase 3. Gate: a teammate plays it cold and wants more.
- **v1:**
  - 20 levels in 2 worlds, plus the hidden bonus.
  - Time and stars (3.6), unlocks (7), restart without preview, look-ahead camera and edge arrows.
  - Level select by world; results with time.
  - Music and its toggle, added by Pao later in production.
  - GameAnalytics events (11); 48 px touch targets; the full shell from `STANDARDS.md`.
  - The done checklist's daily events item doesn't apply: v1 has no daily.
- **Later:**
  - Daily challenge (a seeded harbor needs a level generator; too big for v1).
  - Two-player local modes: parking race (versus) and tugboat co-op. Notes are in `CLAUDE.md` under Stretch goals.
  - A tug towing a barge.
  - More worlds (World 3 could be "Open Sea": waves, wind, islands).
- **Cut:**
  - Submarine: needs a dive control and an underwater view. Too much new UI for a pilot.
  - Player zoom: the set framing per boat keeps the size jump readable and the controls simple.
  - Stars from accuracy alone: replaced by time (3.6).

## 14. Open questions
Decided with the owner on 2026-10-25:

| Question | Decision | Who decides | Status |
|---|---|---|---|
| How is a level scored? | Time plus at least 50% accuracy to count; stars from par times (3.6) | Pao | Decided |
| What happens on a miss? | The clock keeps running; retry from where you are; no fail state | Pao | Decided |
| Should the clock run during the slip preview and glide between boats? | No: it runs only while the player can steer | Pao | Decided |
| Restart under 1 s? | Restart skips the boat 1 slip preview; later boats keep theirs | Pao | Decided |
| v1 size? | 2 worlds of 10 levels | Pao | Decided |
| When is the first scale jump? | Level 4 (Odd Couple); levels 1–3 teach the controls | Pao | Decided |
| Unlocks? | Finish to unlock the next; no star gates; bonus after all 20 | Pao | Decided |
| Small-boat camera? | Look-ahead plus edge arrows; jet ski framing 3x → 2x | Pao | Decided |
| Daily challenge? | Not in v1 | Pao | Decided |
| Music? | Pao adds it later; the toggle comes with it | Pao | Decided |
| Drift for every boat? | Keep it global; boat stats make the differences | Pao | Decided |
| Out of v1? | Later: two-player modes, tug towing a barge. Cut: submarine, player zoom | Pao | Decided |
| Par times | Designer's clean run × 1.2, rounded up to a whole second, checked in playtests | Pao | Decided |
| Palette: 6 main colors plus sand, stone, navy, grass, skin | Keep the extras as support tones for land, quays, ship hulls and captains | Pao | Decided |
| Main analytics question | Which boat makes players give up | Pao | Decided |

Decided in review 1 (2026-10-25):

| Question | Decision | Who decides | Status |
|---|---|---|---|
| Something blocks the slip | Boats in it start their engines and drive out; logs and buoys drift out (3.8) | Pao | Decided |
| Inside but under 50% accuracy | A message per cause, with the ghost showing what's wrong (3.5) | Pao | Decided |
| Settle wait on the clock | A parked boat's time stops at the anchor drop (3.6) | Pao | Decided |
| Vertical slice | The 5 existing levels in the full v1 shell (13) | Pao | Decided |
| Players who close the tab | `boat:…:start` events; `stars:…` dropped (11) | Pao | Decided |
| Too fast to anchor | Anchor button icon + speed arc (3.4) | Pao | Decided |
| Teaching order | Jet ski gets level 5; level 9 is Zippy → Party Barge; traffic first at 11 | Pao | Decided |
| Edge arrows | Size-aware warning, at most 2 traffic arrows (3.7) | Pao | Decided |
| Level 1 tutorial | Ghost pointer and key icons, 3-word text (6) | Pao | Decided |
| Level length | Par ≤ 90 s (120 s for level 20) | Pao | Decided |
| RETRY and hidden tab | RETRY skips the preview; a hidden tab pauses the game and clock | Pao | Decided |
| Swan Lake, Night Shift | Swan Lake gets 3 different small boats; Night Shift renamed Busy Harbor | Pao | Decided |
| When to split `main.js` | First step of phase 2, own commit | Pao | Decided |
| Daily checklist item | Noted as not applying (13) | Pao | Decided |

Still open:

| Question | Recommendation | Who decides | Status |
|---|---|---|---|
| Music mood and length | Decide when the music is made | Pao | Open |
| Coolmath SDK, ad breaks, branding, size limit, GA keys | Team-wide `[confirm]` items in `STANDARDS.md` | Team | Open |
| Fafi's review | Fafi reads the GDD and agrees, or lists changes | Fafi | Open |

## 15. Changelog
- 2026-10-25 — Review 1 applied: slip clearing, miss messages, clock stops at the anchor drop, vertical slice defined, per-boat start events, anchor speed cue, teaching order and level fixes, par cap, edge cases.
- 2026-10-25 — Owner answered the open questions; all proposals confirmed except music, which Pao adds later.
- 2026-10-24 — First draft. Records the prototype as built (10 regular boats, 5 levels, the editor) and proposes time-based stars, 2 worlds of 10 levels, unlocks, camera look-ahead and music.
