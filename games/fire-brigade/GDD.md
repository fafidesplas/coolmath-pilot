# Fire Brigade — Game design document

**Status:** Draft
**Owner:** Pao · **Reviewed by:** — · **Last updated:** 2026-10-21

> Pick a way in, chop through doors and hose down every fire before the building chars. Alone or with a friend on one keyboard.

## 1. Summary
- **Pillars:**
  1. **Plan the route, not the button presses.** Spraying and chopping are automatic. The skill is which way in, which fire first and when to go back for water.
  2. **Two heads are better than one.** In 2P, some fires can only be reached by standing on your partner's head. Co-op is a real need, not a bonus.
  3. **Always finish, then do better.** No game over. Every level ends with all fires out, and the stars show how much of the building you saved.
- **Player:** Coolmath regulars aged 10–24 on a school Chromebook or home laptop, often two friends sharing one keyboard or a tablet. They are fans of the classic two-players-one-keyboard co-op games (Fireboy and Watergirl and similar).
- **Session:** a level is 1–4 minutes. A typical visit is 5–8 levels, 15–25 minutes.
- **Hook:** the % saved count-up on Level complete, with the 3rd star just out of reach. You think you can save that floor if you go in by the roof next time.

## 2. Core loop
- **Moment (seconds):** walk toward the flames, the hose turns on by itself, the fire shrinks and sizzles out. The tank runs low, so you turn back to the truck or a standpipe while the fire behind you creeps sideways.
- **Level (minutes):** pick a way in → clear the floors one at a time, chopping doors and debris → refill when needed → the last fire goes out → stars from % saved.
- **Meta (days):** 20 levels in 2 worlds (Apartments, Shopping Mall). Players chase ★★★ on every level, in solo and with a friend.

## 3. Mechanics
All numbers are as built in `game.js` unless marked **(new)** or **(changed)**. The game renders at 480×270 and scales up. 1 tile = 8 px in that frame = about 21 px at 1280×720. Speeds are in tiles per second (t/s).

### 3.1 The building
- A side-on cross-section of 4 floors. Each floor is 5 tiles of room plus a 1-tile slab. Interior walls split each floor into rooms. A wall has either an open doorway or a closed wooden door.
- Each floor has one ladder up to the next floor. The top floor's ladder leads to the roof hatch.
- **Apartments:** 62 columns wide, 3 interior walls per floor.
- **Shopping Mall:** 100 columns wide. It has 3 shops per wing on each side of a central atrium that never burns, plus balconies and escalators (3.9).
- The floor plans are fixed per building. **(changed)** Fire rooms, ledges and barricades come from the level data (6.6), not from a random roll.

### 3.2 Fire
- The building is a grid of cells: one per column per floor, plus the cells on each ledge. A cell has `heat` from 0 to 1 and `burnt` from 0 to 1.
- A burning cell gains 0.1 heat per second, up to 1.
- Above 0.4 heat, a cell can spread sideways. The chance is 0.45 per second for each neighbor, multiplied by the level's `spread`. A new fire starts at 0.12 heat.
- Fire passes open doorways. A closed door burns through after 9 heat-seconds. A steel barricade lets fire through after 5.4 heat-seconds, without opening.
- Fire never spreads up a floor. A ledge cell at more than 0.8 heat drips fire onto the floor below, at a chance of 0.075 per second.
- Fires never burn out on their own.
- **Charring:** a burning cell chars at `heat / 50` per second, so a full fire chars a cell completely in 50 s. **% saved** is `1 − (sum of burnt) / (number of cells)`.
- **Starting fires:** each fire is 2 cells wide on floor 1, up to 5 cells on floor 4, at a starting heat of 0.3–0.7. A ledge fire is 3 cells at 0.3–0.6.

### 3.3 Hose (automatic)
- If a fire on your floor is within 6 tiles, you spray. You spray ahead while walking, or toward the nearest fire while standing. Walls, doors and debris block the spray.
- You don't spray while climbing or mid-chop.
- The hose shoots 30 drops per second. A drop lowers the cell it hits by 0.08 heat and its two neighbors by 0.025 each.
- Spraying uses 7 water per second. A full tank (100) lasts about 14 s.
- At 0 water, the hose clicks dry and the water gauge blinks.

### 3.4 Axe (automatic)
- Walking into a door, window, hatch, skylight or debris pile swings the axe every 380 ms.
- Hits to break: a window, hatch or debris pile takes 2, an interior door or skylight 3, the front door or loading dock shutter 4.
- Each hit shakes the screen a little, and the target shows notches.

### 3.5 Refill
- **Truck:** stand at the truck to refill at 45 water per second. It never runs out.
- **Standpipe:** refills at 35 water per second. A standpipe holds 180 water and recovers 3 per second (empty to full in 60 s).
- Each standpipe is walled in by debris on both sides. You chop through to use it.
- Water-drop signs on the truck and standpipes light up while any player is under 30 water. A dry standpipe's sign turns grey with a slash **(changed: the slash is new)**.

### 3.6 Health
- Standing in a cell above 0.35 heat costs `heat × 30` health per second. You have 100 health. Out of the fire, you regain 5 per second.
- At 0 you are **worn out** **(changed: was "knocked out")**. You sit down with stars over your helmet for 3 s, then walk back out from the truck with full health. Your water is kept.

### 3.7 Movement
- Walk 7.8 t/s (166 px/s at 1280), or 6 t/s on an escalator. Climb ladders at 6.6 t/s.
- A jump reaches about 2.4 tiles. It can't clear a 3-tile ledge alone.
- **2P stacking:** a partner's head is a one-way platform, and a jump off it reaches about 3.3 tiles. The player underneath can't jump while carrying.
- **2P camera:** one shared screen follows both players. Neither can walk off screen.

### 3.8 Ways in
- Before play, the player picks a way in. The level data lists which ways are allowed (6.6).
  - `ground`: the front door.
  - `floor2`, `floor3`, `floor4`: a window off the aerial ladder, which stands against the left wall from the street to the roof. Each upper floor has a landing. Windows need chopping.
  - `roof`: the roof hatch, which also needs chopping.
  - **Mall only:** `dock`, the loading dock at the back of the ground floor. The roof entry is the `skylight` instead of a hatch.
- The level starts the moment the way in is picked. The timer runs from then.

### 3.9 Ledges, barricades and the mall
- **Ledge:** a burning shelf 3 tiles above a floor.
  - **Solo:** its ladder is already down.
  - **2P:** boost up off your partner's head, put the fire out, then pull the lever to drop the ladder.
- **Barricade (2P):** a 3-tile steel barricade that can't be chopped. Boost over it and pull the lever on the far side to roll it up. **(changed)** In solo, a barricade in the level data becomes a wooden door.
- **Lever:** walk into it to pull it. A lever turns green and its handle flips down. It works once.
- **Mall atrium:**
  - Never burns. Balconies on floors 2–4.
  - Walkable escalator ramps cross the atrium and hand you onto the balcony ahead.
  - One escalator is broken (its bottom 3 steps are missing). 2P boost onto it; solo uses the stairwell ladders in the shop wings.

### 3.10 End of a level **(changed)**
- The level is complete when no cell is burning.
- There is no fail state and no timer limit (chosen 2026-10-21).
- See Open questions for the backstop when a building reaches 0% saved.
- After the last fire goes out:
  - Play continues for 1 s (the last sizzle, cheering firefighters).
  - Then Level complete shows stars, % saved and time.

### 3.11 Pause and hidden tab **(new)**
- Pause stops the fire, the timer and the players.
- The game pauses itself when the tab is hidden (`visibilitychange`) and shows the pause menu on return.

### 3.12 First-run tutorial **(new)**
- Level 1 is the tutorial: one fire on floor 1, the front door only. There are no text boxes, only pictures.
  1. Key and arrow icons float by each player until they move.
  2. A pulsing flame arrow points at the fire until the hose turns on.
  3. When the fire is out, a ✓ pops over it.
- Level 3 shows a water-drop arrow over the truck the first time a tank drops under 30.
- Each tutorial prompt shows only once per save.

## 4. Controls
| Action | Mouse / touch | Keyboard (solo) | Keyboard (2P) |
|---|---|---|---|
| Move | ◀ ▶ buttons | A/D or ←/→ | P1 A/D · P2 ←/→ |
| Climb up / down | ▲ ▼ buttons (on a ladder) | W/S or ↑/↓ | P1 W/S · P2 ↑/↓ |
| Jump | ▲ button (off a ladder) | W, ↑ or Space | P1 W · P2 ↑ |
| Spray, chop, pull lever | automatic | automatic | automatic |
| Pick a way in | tap the arrow by the entry | ↑/↓ then Enter/Space | same |
| Pause | ⏸ button | P or Esc | P or Esc |
| Restart | ↻ button | R | R |
| Menus | click / tap | arrows, Enter/Space, Esc back | same |

- **Touch layout (new):**
  - Solo: ◀ ▶ bottom left, ▲ ▼ bottom right.
  - 2P: P1 gets ◀ ▶ ▲ ▼ in the bottom-left corner, P2 the same in the bottom-right corner. Each set is framed in its player's color and number.
  - Buttons are 30 px in the 480×270 frame (48 px at 800×450) and drawn at 60% opacity.
  - Touch controls appear after the first touch and hide on the next key press.
  - Multi-touch: each pointer is tracked on its own, so both players can hold buttons at once.
- No hover-only actions, no right-click, no double-click.

## 5. Game elements
| Element | Behavior | First appears | Shape/icon (not color alone) |
|---|---|---|---|
| Fire | Grows, spreads sideways, chars the building | L1 | Animated flames, taller with heat; smoke above |
| Charred wall | Damage only, shows % lost | L1 | Black scorch marks on the back wall |
| Fire truck | Unlimited refill | L1 | Truck with a water-drop sign and a light bar |
| Closed door | Blocks fire for 9 heat-s; 3 chops (front door 4) | L2 | Wooden door with a knob |
| Ladder | Up to the next floor | L2 | Rungs |
| Aerial ladder + window | Way in to floors 2–4; window 2 chops | L4 | Long ladder against the left wall, glass pane |
| Standpipe | Refill, 180 reserve, recovers 3/s | L5 | Wall pipe with a valve and water-drop sign; grey sign with a slash when dry |
| Debris | Walls in standpipes and paths; 2 chops | L5 | Pile of planks and bricks |
| Roof hatch | Way in from the roof; 2 chops | L6 | Square hatch with a handle |
| Ledge | Burning shelf 3 tiles up, drips fire down | L7 | Shelf with brackets and a folded ladder |
| Lever (2P) | Drops a ledge ladder or opens a barricade | L7 | Lever with a handle that flips down, ✓ when pulled |
| Barricade (2P) | Can't be chopped, leaks fire; door in solo | L8 | Steel roll-up shutter with diagonal stripes |
| Atrium | Never burns | L11 | Tiled floor, fountain, pillars |
| Escalator | Walkable ramp across the atrium | L11 | Stepped ramp with handrails |
| Loading dock | Way in at the back; 4 chops | L12 | Roll-up door with a dock bumper |
| Broken escalator | 2P boost; solo uses the stairwell | L13 | Ramp with its bottom 3 steps missing |
| Skylight | Way in from the mall roof; 3 chops | L14 | Glass panes in a frame |
| Firefighter | P1 red coat, P2 blue coat, yellow helmets | L1 | **(new)** "1" or "2" plate on the helmet and a number tag above in 2P |

## 6. Level design
### 6.1 Structure
- **World 1, Apartments (10 levels):** teaches every core rule (spray, chop, refill, ways in, standpipes, ledges, barricades) in a small building.
- **World 2, Shopping Mall (10 levels):** a wide building with two wings, an atrium, escalators and new ways in. It teaches route planning across a big space, and 2P splitting up.
- Every level is playable solo and in 2P. The same level data serves both modes; co-op spots adapt (3.9).

### 6.2 Teaching order
- Each new element gets its own level with low fire pressure (safe intro). Then it returns with faster spread or a second fire (twist). Then it appears next to other elements (combination).
- The two world finales are the old prototype layouts: fire on every floor.

### 6.3 Difficulty curve
- The knobs, in the order they are turned up:
  1. Number of fires.
  2. Fires spread out across floors.
  3. The level's `spread` multiplier (0.6 in L1, up to 1.3 in L20).
  4. Fewer ways in.
  5. Fires behind doors, debris or barricades.
- Upper-floor fires start bigger (3.2), so a fire on floor 4 is harder than one on floor 1.
- A level gets harder by about one knob step at a time. The first level of World 2 drops back to 2 fires.

### 6.4 Stars
- ★: all fires out (every completed level).
- ★★: % saved ≥ the level's `stars[0]` (default 75).
- ★★★: % saved ≥ the level's `stars[1]` (default 90).
- The thresholds are tuned per level in phase 4 so a first try gets ★★ and ★★★ needs a good route.
- Stars and the best % are saved per level as the best across solo and 2P.

### 6.5 The 20 levels
In this list, floor 1 is the ground floor. In the data, `f` is 0-based.

| # | Name | One line |
|---|---|---|
| 1 | First Call | One small fire on floor 1, front door only, slow spread (0.6). Tutorial. |
| 2 | Upstairs | Fire on floor 2 behind a closed door. Climb the ladder, chop through. |
| 3 | Tank Check | Two fires far apart on floor 1 and floor 2. The tank runs dry, back to the truck. |
| 4 | The Long Ladder | Fire on floor 3 with the aerial ladder windows open. Going in by the window is much faster. |
| 5 | Standpipe | Fires on floors 2 and 3. A standpipe behind debris on floor 2 saves the trip down. |
| 6 | From the Top | Fire on floor 4 near the roof hatch, plus a small one on floor 1. Pick your end. |
| 7 | Shelf Fire | A burning ledge on floor 2 dripping onto the floor. Solo climbs its ladder; 2P boost and pull the lever. |
| 8 | Shutters | A barricade on floor 3 with the fire behind it (a door in solo). Fire leaks through while you work. |
| 9 | Every Floor | One fire per floor, all ways in, spread 1.0. The old Apartments prototype. |
| 10 | Full Alarm | Every floor burning, a ledge, a barricade, standpipes on 2 and 4, spread 1.15. |
| 11 | Mall Hours | Two small fires, one per wing on floor 1. Cross the atrium, learn the escalators. |
| 12 | Back Door | Fires in the back shops on floors 1 and 2. The loading dock is the short way in. |
| 13 | Out of Order | Fire on the floor 2 balcony side, reached by the broken escalator (2P) or the stairwell (solo). |
| 14 | Skylight | Fires in both wings on floor 4. Drop in through the skylight. |
| 15 | Wing Pipes | Fires on floors 2 and 4 in opposite wings. Standpipes on both, behind debris. |
| 16 | Shop Shelves | Two ledges in shops on floors 2 and 3, both dripping. |
| 17 | Lockdown | Two barricades on floors 1 and 3 with fires behind them. |
| 18 | Split Up | Four fires, two per wing on floors 2 and 3. In 2P, splitting up is the fastest route. |
| 19 | Rush | Three fires on floors 1, 3 and 4, spread 1.25, ground and dock entries only. |
| 20 | Grand Opening | Two fires per floor, a ledge and a barricade, spread 1.3. The old Mall prototype. |

### 6.6 Level data format
One JSON file per world in `levels/`, an array of levels:

```json
{
  "id": "w1l05",
  "name": "Standpipe",
  "building": "apartments",
  "entries": ["ground", "floor2", "floor3"],
  "spread": 0.9,
  "fires": [
    { "f": 1, "col": 40, "size": 3, "heat": 0.5 },
    { "f": 2, "col": 24, "size": 4, "heat": 0.6 }
  ],
  "pipes": [1],
  "ledges": [{ "f": 1, "c0": 8, "c1": 14 }],
  "barricades": [{ "f": 2, "col": 30, "far": 1 }],
  "stars": [75, 90]
}
```

- `building` is `apartments` or `mall`. Walls, doors, ladders and the debris around each standpipe come from the building's fixed plan.
- `pipes` lists the floors whose standpipe is in use. Unused standpipes are not drawn.
- `col` and `c0`/`c1` are columns relative to the building's left wall. `far` is the side of the barricade where the fire is (−1 left, 1 right).
- `size` and `heat` are optional. They default to the 3.2 rule.
- A debug check at load rejects fires inside walls, the atrium or a standpipe's debris pocket. It also rejects ledges and barricades that overlap.

## 7. Progression and retention
- **Unlocks:** levels unlock in order. Completing a level (any stars) unlocks the next. World 2 unlocks when Level 10 is completed.
- **Stars:** up to 60. The level select shows the total per world.
- **Best result:** the best % saved and the best time per level, shown on the level tile and on Level complete with a "NEW BEST" ribbon.
- **Co-op pull:** the level select has a Solo / 2P toggle. A small two-helmets icon marks the levels whose ★★★ came from a 2P run.
- **Not in v1:** daily challenge (cut, 13), endless mode.

## 8. Screens and UI flow
Title → Level select → Way in → Playing ⇄ Pause → Level complete → Next level's Way in. Every button works with mouse, touch and keyboard. Every button is at least 30 px in the 480×270 frame.

- **Title:** the logo over the burning-building backdrop. It has a big PLAY button, a Solo / 2P toggle (two helmet icons) and a sound toggle. PLAY goes to the level select, with the next unplayed level highlighted.
- **Level select:**
  - Two world tabs (Apartments, Mall) with star totals.
  - 10 level tiles per world, each with its number, stars and best %. The next level glows. Locked tiles show a padlock.
  - Buttons: Solo / 2P toggle, back.
- **Way in:**
  - Shows the building from the street, with an arrow on each allowed way in and the fires shown as small flame icons.
  - Tap an arrow, or use ↑/↓ and Enter. Play starts at once.
  - **(new)** Level 1 skips this screen and starts at the front door.
- **Playing (HUD):**
  - Top left: P1 panel with "P1", a water bar (drop icon) and a health bar (heart icon). In 2P, the P2 panel is top right.
  - Top center: flame icon with the count of burning cells, the timer, and the % saved bar. The bar has a house icon and turns orange under 50%, with the number shown as well.
  - Top right (solo) or top center-right (2P): ⏸ and ↻ buttons.
  - The minimap stays.
  - Low water: "REFILL" blinks in the player's panel and the drop signs light up.
- **Pause:** Resume, Restart, Levels, Sound on/off.
- **Level complete:**
  - "ALL FIRES OUT!", then the stars pop in one by one.
  - % saved counts up from 0, then the time. Best shown under them.
  - Next / Retry / Levels. Enter or Space = Next.
- **Settings:** the sound toggle on the title and pause screens. There is no music in v1, so there is no music toggle.

## 9. Art direction
- **Family:** Night Pixel, the game's own family, outside the three shared ones (same call as Vending Machine Sim's pixel family).
  - Low-res pixel art at 480×270, scaled up without smoothing.
  - Sprites are text maps in code, drawn from the fixed ENDESGA 32 sprite palette shared with Vending Machine Sim.
  - The UI uses only the 6 key colors below.
- **Palette (key colors):**

| Hex | Role |
|---|---|
| `#f77622` | Fire orange: flames, the burning-cell count, the % bar under 50% |
| `#feae34` | Helmet gold: stars, main buttons, helmets, the selected way in |
| `#0099db` | Water blue: water bars, spray, refill signs |
| `#3a4466` | Night navy: panels, secondary buttons |
| `#181425` | Ink: outlines, shadows, the dark overlay |
| `#ead4aa` | Cream: body text and numbers |

  P1 red `#e43b44` and P2 blue `#124e89` appear only on sprites, player panels and touch-button frames. They always come with the 1/2 number.
- **Key visuals:**
  - A cut-away building on a dithered purple night sky with a moon, stars and a two-layer skyline.
  - Street lamps. The red truck with a blinking light bar on the left.
  - Muted wallpapers with procedural furniture in the apartments, bright shop interiors in the mall.
  - 16 px firefighters with yellow helmets.
- **Juice list:**
  - Screen shake on chops (small) and on breaks (medium).
  - Sizzle steam puff and a ✓ sparkle when a fire goes out. **(new: the ✓ sparkle)**
  - Smoke and rising embers from every fire. Back walls char.
  - Refill stream, blue glow and pitch-rising gurgle.
  - **(new)** A squash on landing, a stretch on jumps and on a boost off a partner's head.
  - **(new)** On the last fire out: a water-drop burst over the building, both firefighters cheer.
  - **(new)** Level complete: the stars pop in with a scale bounce, % saved and time count up.
  - **(new)** UI buttons ease in and press down on click.
- **Concept art prompts:** starting points for an image generator; the art direction above wins if they disagree. Paste each one whole.
  - **Gameplay screenshot (16:9):** *"Pixel art side-view cross-section of a four-floor apartment building at night, rooms with furniture and wallpaper, small firefighters in yellow helmets, one red coat and one blue coat, spraying water arcs at orange #f77622 pixel flames, smoke, a red fire truck with an aerial ladder against the left wall, dithered purple night sky with a moon and distant city skyline, navy #3a4466 UI panels with blue #0099db water bars and gold #feae34 stars, crisp 16-bit retro game screenshot, 16:9"*
  - **Key art / thumbnail (16:9 and 1:1, no text):** *"two cheerful pixel art firefighters, one in a red coat and one in a blue coat, yellow helmets, one standing on the other's head spraying a bright blue water arc at orange flames in a cut-away building window, fire truck below, embers and smoke, dithered purple night sky with a moon, crisp limited-palette pixel art, warm orange fire against cool night blues, centered composition with room for a title, game key art"*
  - **Character and element sheet:** *"pixel art game sprites on a plain background: firefighter idle, walking, climbing a ladder, chopping with an axe, sitting tired with stars over the helmet, cheering; flames in three sizes, wooden door, window, debris pile, steel roll-up shutter with stripes, lever up and down, wall standpipe with water-drop sign, roof hatch, skylight, escalator, fire truck, crisp limited-palette pixel art, evenly spaced, consistent scale"*
  - **Logo (try several, keep the most readable):** *"the words "FIRE BRIGADE" in chunky pixel letters, orange #f77622 and gold #feae34 with small pixel flames on top and a blue water drop dotting the I, crisp limited-palette pixel art, game logo on a plain dark background, bold and readable at small size"*
  - **Negative prompt (generators that support it; drop "text, letters" for the logo):** *"text, letters, watermark, signature, photorealistic, gritty, horror, violence, injured people, blood, cluttered background, blurry, low contrast, extra limbs, UI buttons"*

## 10. Audio
All synthesized with ZzFX through `SoundGenerator` in `templates/gameFx.js`, positional in play.

| Sound | When | Character |
|---|---|---|
| Hose hiss | While spraying, every 120 ms | Soft white noise |
| Dry click | Spraying with an empty tank | Low dull click |
| Axe chop | Each axe hit | Woody thunk with noise |
| Break | Door, window, hatch or debris breaks | Crunchy bit-crushed crash |
| Sizzle | A cell goes out | Falling high hiss |
| Ignite | A ledge drips fire down | Low whoomph |
| Refill | While refilling | Gurgle, pitch rises as the tank fills |
| Hurt | First moment in fire (every 250 ms) | Short falling tone |
| Lever | Lever pulled | Bright clack |
| Win | Last fire out | Rising arpeggio |
| Star **(new)** | Each star popping in | Ascending chime, one step higher per star |
| UI click **(new)** | Any button | Short tick |

- **(changed)** The old lose sting is cut with the fail state.
- **Music:** none in v1.
- **Sound setting:** sound is on by default (it's small and synthesized). The toggle persists. The `AudioContext` starts on the first click, tap or key.

## 11. GameAnalytics
Core events from `STANDARDS.md`, with progression ids `world01:level05`:

| Event id | When it fires | Value |
|---|---|---|
| Progression `Start` world01:level01 | Way in picked | — |
| Progression `Complete` | Last fire out | % saved (0–100) |
| Progression `Fail` | Restart or quit mid-level, or the 0% backstop (14) | % saved at that moment |
| `tutorial:step01` | First move in Level 1 | — |
| `tutorial:step02` | First spray in Level 1 | — |
| `tutorial:step03` | First fire out in Level 1 | — |
| `tutorial:done` | Level 1 complete | — |
| `ui:restart` | Restart button or R | — |
| `settings:sfx:off` | Sound turned off | — |
| `mode:solo` / `mode:2p` | Each level start | — |
| `input:touch` | First touch of a session | — |
| `entry:<ground\|dock\|floor2\|floor3\|floor4\|roof>` | Way in picked | — |
| `player:down` | A firefighter is worn out | — |
| `coop:lever` | A lever is pulled (2P) | — |
| `level:stars` | Level complete | 1–3 |
| `level:time` | Level complete | seconds |

**Question the data must answer:** which way in do players pick, and does it change how much of the building they save? Second: do 2P runs save more of the building than solo on the same level?

## 12. Tech plan
- **Engine:** LittleJS stays, as with Vending Machine Sim (confirm in 14).
  - The release build uses the optional `build.mjs` minify-and-zip, and the game still runs straight from `index.html` with no build.
  - Target size under 1 MB zipped.
  - Fix `build.mjs`'s leftover `examples/` path.
- **Modules:** split the 2,600-line `game.js` into plain scripts under `src/`, loaded in order from `index.html`. There is no ES-module import graph, so `file://` still works.
  - `data.js` (building plans, palette, tuning)
  - `sprites.js`
  - `building.js` (layout, breakables, ladders, escalators)
  - `fire.js`
  - `player.js`
  - `input.js` (keyboard + touch buttons)
  - `ui.js` (screens, HUD, minimap)
  - `audio.js`, `save.js`, `analytics.js`, `main.js`

  The split happens first in the slice, as a move with no change in behavior.
- **Levels:** `levels/world01.json` and `levels/world02.json`. They are also inlined as JS (`levels/levels.js`) so `file://` loading works without `fetch`.
- **Simulation:**
  - Variable `dt` from the engine at 60 fps, capped at 0.05.
  - Fire spread uses `Math.random`. With fixed starting fires, the run-to-run spread is small, and star thresholds leave room for it.
  - Decor stays on its own fixed seed.
- **Save keys (`cm_fire-brigade_…`), all `{ v: 1, … }`, reads wrapped in `try/catch`:**
  - `_progress`: `unlocked` (count), `stars` (array of 20), `bestSaved` (array of 20), `bestTime` (array of 20), `coopStar` (array of 20 booleans), `tutorial` (flags).
  - `_settings`: `sfx`, `players` (1 or 2).
- **Testing hook:** `window.game` with:
  - `screen` (`'title' | 'levels' | 'playing' | 'complete'`, plus `phase: 'entry' | 'play' | 'paused'`), `level`, `score` (% saved), `burning`, `players`.
  - `start(level, players)`, `restart()`, `win()` (debug only: puts out every fire).
- **Riskiest piece: 2P touch controls on one small screen.**
  - Two sets of four 30 px buttons in the bottom corners cover the street, the truck and the ground floor's edges.
  - **Proof:** before anything else in the slice, draw both button sets over Level 9 and play it with two people on a tablet and at 800×450.
  - **If it doesn't fit:** shrink the world view to the top 80% of the screen and put the buttons in a dark strip below it.
- **Second risk: % saved has to spread across levels.** With no fail, stars are the only pressure. If the % barely moves, stars mean nothing.
  - **Proof:** add a debug readout of % saved per minute, and play Levels 1, 9 and 20 once well and once slowly. The gap must be at least 15 points.

## 13. Scope
- **v1:**
  - Both buildings as 20 authored levels in 2 worlds, solo and 2P.
  - Everything already built: fire, hose, axe, refill, health, ways in, ledges, barricades, mall atrium and escalators.
  - The full shell: title, level select with stars, way in, pause, restart, Level complete.
  - Touch controls for solo and 2P. Mouse and touch in every menu.
  - Saving, GameAnalytics, `window.game`, the Level 1 tutorial and a release build.
  - **(changed)** No fail state, stars from % saved.
- **Later:**
  - A third building (hospital or school) with a new element.
  - Music loop.
  - Hazards (gas tanks, collapsing floors).
  - Per-level side goals (for example "go in only by the roof").
- **Cut:**
  - **Daily challenge:** left out by the owner (2026-10-21). The authored levels are the content.
  - **Random fire layouts:** they make stars unfair and solo/2P winnability hard to prove. Levels are authored instead.
  - **Fail state and game over:** the game is about how well you save the building, not whether you survive (chosen 2026-10-21).
  - **Manual spray and chop buttons:** they'd add a button per player and make 2P on one keyboard cramped.

## 14. Open questions
| Question | Recommendation | Who decides | Status |
|---|---|---|---|
| Fires never burn out. What ends a round where the building reaches 0% saved? | At 0% the fire burns itself out: the round ends with "BURNED DOWN", 0 stars, Retry highlighted, the next level stays locked. Rare at tuned rates (a cell takes 50 s at full heat to char). | Pao | Open |
| Keep LittleJS, as Vending Machine Sim did? | Yes. The engine is already built around it, and a port would cost the whole slice. | Pao + teammate | Open |
| Do 2P touch buttons fit at 800×450? | Prove it first in the slice (12). Fall back to a control strip below a smaller view. | Pao | Open |
| Star thresholds (75 / 90 default) | Keep for the slice, set per level in phase 4 so a first try gets ★★. | Pao | Open |
| Should stars be tracked per mode (solo and 2P separately)? | No, keep the best across both. The co-op icon is enough credit. 2P levels aren't easier, just different. | Pao | Open |
| Is "worn out" with stars over the helmet kid-safe enough for burning buildings? | Yes. No people are trapped or hurt, and the building is empty. Ask a teammate to watch Level 9 once. | Teammate | Open |
| Ad breaks with the Coolmath SDK | Only between levels, at most once every 3 levels. Waiting on Coolmath's rules. | Coolmath | Open |
| Pixel text readable at 800×450? | Check in the slice. If not, use 2× text for the HUD numbers. | Pao | Open |

## 15. Changelog
- 2026-10-21: first draft, from the prototype and the brief. Decided: 20 authored levels in 2 worlds, no fail state with stars from % saved, touch controls for solo and 2P, no daily challenge.
