# Dock All The Boats — game brief

> Park a rowboat, then park a cruise ship right next to it while the camera zooms out like crazy. Boats from 2.4 m to 400 m share one harbor. Steer in, stop, let go. Physics does the comedy.

![How Dock All The Boats plays](mechanic.svg)

**Rank:** Prototype · **Genre:** Physics parking puzzle · **Art family:** Toybox Flat · **Audience habit:** Play at the desk

@../../STANDARDS.md
@../../PHASES.md

## Why it works for Coolmath
Everyone knows how hard parallel parking is, and a boat has no brakes. The goal is clear at a glance: a dashed box to stop in, either way round. A level takes 20–60 seconds, and a miss costs nothing but pride, so players retry for three stars. The jokes are visual (ducks spin, boats wobble, the captain's eyes pop) and work with the sound off.

## Core loop
A level is a chain of boats of wildly different sizes parked one after another in the same harbor (rowboat → cruise ship, or container ship → trawler). Between boats the camera zooms (out by 100x, or back in) and a card shows the new boat's size ("300 m · 105x BIGGER"). Boats parked earlier stay put as tiny dots or huge obstacles. For each boat: steer it across the harbor → line it up in the slip → stop and let go → once the boat rests in the slip for 0.5 s it is checked → inside: 1–3 stars by accuracy and the anchor drops by itself; partly outside: "Not in the slip. Try again.", and the boat must move before the next check.

## Mechanics (what is built)
- **Scale:** world units are meters. Each boat type is drawn at toy size and scaled by `k` to real size. Mass scales with k³, so big ships shove small boats and barely notice. Boats react slower the bigger they are (k^0.3 times slower, capped at 1.25x: `MAX_SLOWDOWN`, try others with `?slowdown=`), so big ships are a bit slower relative to their own length without dragging, and tiny boats are twitchy. All handling, resting and judging numbers convert from the toy values the same way (`makeBoat` in `src/main.js`).
- **Camera:** frames the current boat and its slip, never closer than a few boat lengths. When a new boat starts, it first shows that boat's slip at the boat's own framing for 3 s, then glides back to the boat at 40% of the normal camera speed. The boat gets control when the camera is nearly there (`SLIP_SHOW`, `SLIP_GLIDE`, `SLIP_MAX`; a click, Space or Enter cuts to the glide). Moves zoom in log space and pan at a speed relative to the zoom; going from a parked rowboat to a cruise ship's slip, the zoom shows the size jump. The player can't zoom: each boat has its set framing. A map-style scale bar shows the zoom; boats too small to see draw as dots, and the player gets a ring when tiny. Outlines, shadows, popups and the UI stay a constant size on screen.
- **Boat physics:** each boat is a rigid body built from circles along its keel. On pointy hulls the circles shrink toward the bow and stern to fit the drawn hull (`fitCircles`), so the tips collide where they are drawn. Water drag is low along the keel and high sideways, so boats coast and drift. Let go of the throttle and forward drag drops to 30% (`COAST_DRAG`, try others with `?coast=`), so boats glide about 3x farther and stopping with reverse is the skill. Below 1 u/s with no throttle the coast ends (full forward drag, 2x spin drag: `SETTLE_SPEED`, try others with `?settle=`), so a nearly stopped boat comes to rest instead of creeping. The rudder turns the boat more the faster it goes, plus a little prop wash at low speed. Reverse is weaker than forward. Every boat type has its own mass, power, turn rate and drag; all engine power is multiplied by 1.5 (`SPEED`, try others with `?speed=`).
- **No anchor control:** the player never drops an anchor. A boat rests when it is under 0.25 u/s and 0.25 rad/s with no input (`REST_SPEED`, `REST_SPIN`). Resting with part of the hull in the slip fills a yellow ring around the boat; after 0.5 s (`REST_TIME`) it is judged. Resting anywhere else is never judged, so stopping to wait for traffic is safe. When a boat parks, an anchor drops from its bow (splash, chain) and holds it for the celebration.
- **Judging:** when the boat has rested for 0.5 s with part of its hull in the slip, every hull circle must be inside the slip. Accuracy = 60% position (0.8 toy units off = 0) + 40% angle (20° off = 0). Boats 50 m and longer get 15% more room: the slip is 15% longer and wider and the angle allowance is 23° (`BIG_SHIP_LENGTH`, `BIG_SHIP_LEEWAY`). Nose-in or stern-in both count. Level accuracy is the average over its boats; 3 stars at 85%+, 2 at 60%+, else 1.
- **Obstacles:** docks and pilings (static), landmasses (static blobs of circles: islets, Pangaea), moored boats (no springs: a bump moves them and they stay where they end up; boats waiting their turn in the chain too, so a turn starts from wherever that boat was knocked to), loose drifting boats and logs (push them), traffic (boats that drive a path you draw: back and forth, loop, or stop at the end; at a share of their top speed; on a loop, an optional pace in m/s keeps them to a timetable so boats sharing the loop stay evenly spaced; only during the parking turns you pick. They are real bodies with an engine, so a hit shoves them off course and they steer back), buoys (free-floating, very bouncy; a cheat keeps them at least 1/12 of the current boat's length wide, growing smoothly when a bigger boat starts, so they stay visible: `BUOY_SHARE`, try others with `?buoy=`), duck families (mother wanders and flees the player, ducklings follow in a line, a hit stuns and spins them), currents (zones that move the water itself).
- **Score extras:** a damage bill in dollars and a count of ducks hit, shown in the HUD and on the result screen. They don't affect stars.

## Boats (real size)
Jet Ski (2.4 m, quick and slidey, almost no reverse), Swan Pedalo (2.6 m, spins), Rowboat (2.9 m), Zippy (6.8 m speedboat, drifts), Party Barge (9.2 m, wide), Sailboat (12 m, strong keel), Trawler (26 m fishing boat, strong, pushes things; replaced the tugboat, whose boxy top view looked like an iPad), Mega Yacht (80 m), Cruise Ship (300 m), Container Ship (400 m), Island (30 km), Continent (3000 km). Islands and continents are blob hulls made of circles, and for now they appear only in the hidden bonus level.

## Levels
- **World 1, Big & Small (5):** Odd Couple (rowboat → cruise ship), Way Down (container ship → trawler → jet ski), Mixed Nuts (mega yacht → cruise ship → swan), Rush Hour (jet ski down a 30 m channel crossed by three 6 m canals of looping traffic, all on one screen: 10 rowboats and swans at 2.2 m/s, 10 jet skis and rowboats at 3 m/s, then 10 jet skis at 4 m/s; the loops turn round in lagoons just off screen; wait on the 3.5 m of sand between canals for a gap).
  Marina (jet ski → sailboat → 48 m yacht in a packed yacht marina: big yachts along the quay, two piers lined on both sides with yachts, sailboats, speedboats, party barges, rowboat tenders and jet skis; each boat has one free berth in a row; tenders, jet skis, speedboats and a party barge cruise the fairways. No ships or tugs).
- **Unparking mode (1, prototype):** its own button on the title (PARKING / UNPARKING), its own level list. Marina Jam, Unparking level 1. Eight boats packed into a harbor corner (quay along the top, sand on the west and along the bottom up to a mouth at x 30-44, open sea to the east). Tap a boat to select it (an RTS-style ring shows which), then drive it out with the usual controls (hold the mouse, or WASD); tapping another boat swaps, and the one you leave stops where it is. Every other boat is fixed in place, so you bounce off and never shove the jam. A real knock costs a bump of $1,000 of a $10,000 budget (gentle scrapes are free); stars from money kept (90% / 60%). Code in `src/jam.js` (a level with `jam: true`, `view`, `budget`, and the jam boats in `moored`). `jamSolve()` in the console checks the jam can be cleared driving each boat straight out (a floor: steering can do more) and lists the rounds: here 3 (sailboat, jet ski, east speedboat; then the party barge and swan; then the trawler, yacht and west speedboat).
- **Bonus (1, hidden for now):** Continental Drift (rowboat → cruise ship → island into a bay → continent into the gap in Pangaea, 100x each step). Marked `bonus: true` in the data. Players don't see bonus levels. Load `index.html?bonus` to show them (the editor sees them that way too). When shown, they sit after the regular ones in level select on a "BONUS" card. PLAY never picks them as the next level, and the last regular level's NEXT button reads "BONUS".

Data in `levels/levels.js`.

## Writing
In-game text is plain and direct: instructions and results, no jokes or quips. The fun comes from the physics and the visuals.

## Ideas to try in future levels
Not built yet. Candidates for the GDD and for new levels.
- **More crowded harbors:** tighter slips between more moored boats, so a parking job means threading a gap without bumping the neighbors.
- **More boat traffic:** built as `traffic` (see Obstacles); no level uses it yet. Still to try: a boat towing a barge (the tugboat is gone; a redrawn tug or the trawler could do it).
- **Submarine:** a boat that can dive and pass under boats on the surface, then surface to park. Needs a dive control and a way to show what is under the water.
- **More drift:** trying it now for every boat (see Boat physics). Next question: keep it global, or make it a trait of certain boats.

## Concerns and design questions
Problems seen in play and design changes to decide, for the GDD's open questions.
- **Score:** decided (see `GDD.md` 3.6): not time. Each level has a budget, damage comes off it, and stars come from the money kept. Not built yet: the game still gives stars by accuracy.
- **Camera with small boats:** with a small boat like the Jet Ski, the camera has to stay very zoomed out so the player sees other boats in time. The boat itself is then tiny on screen, which works against fine control.

## Stretch goals
Not built and not in v1 scope. Two-player local modes on one keyboard, for the GDD to describe once the single-player game is done.
- **Parking race (versus):** two players, each with a boat, race to park in the same harbor. The first boat judged inside its slip wins the round. Each player could get their own slip, or both could go for one slip and bump each other out of it. Bumping is allowed, and that is the fun.
- **Tugboat co-op:** (needs a redrawn tugboat: the old one was cut for looking like an iPad) two players each drive a tugboat and push a big ship that has no engine (a cruise or container ship) into its slip together. Pushing on one end turns the ship, so the players have to work together. The ship is judged like a normal parking job.
- **Open questions:**
  - Controls: P1 uses WASD and drops the anchor with Space. P2 uses the arrows and drops the anchor with Right Shift or Enter, both right next to the arrow keys. L was the other option, but it is too far from the arrows. The mouse can only steer one boat. Some cheap keyboards can't register many keys at once, so test that.
  - Camera: one shared view that frames both boats. In the race, both players should have boats of the same size.
  - Stars: what counts as a score in versus mode.

## Level editor (debug only)
`tools/editor.js`, loaded by `index.html` after `src/main.js`. The game's hooks are `window.pmbEditor?.` calls, so without the script they do nothing; remove the script tag for release.
- **Open:** press `E` on any screen (or load `index.html?edit=2` for level 2). `E` play-tests from the first boat, `Shift+E` from the selected boat (earlier boats are parked for you), and `E` comes back. Test runs save no stars.
- **Edit:** drag empty space to pan, wheel to zoom, click to select, drag to move. `[ ]` rotate 15° (Shift: 90°), or drag the round handle on an arm off a selected boat, slip or log (15° steps, Alt: free; slips 90°), arrows nudge, `D` duplicate, `Delete` remove, `Shift`+drag on empty space for new sand, drag a sand/dock/current edge to resize, `T` turns sand into a dock, then a quay. Traffic: **Add traffic** in the panel, then `P` and click to add path points (`P`, Enter or Esc to finish); drag a point to move it, `I` inserts one after the selected point, `Delete` removes it; the panel sets the end behavior, speed and which parking turns it moves in. Slips under a pier slide along it (Shift moves them off). The panel has every field (boat type, size, hint, slip room and fingers, landmass circles…), the parking order, and buttons to add things. All keys are listed in the panel.
- **Save (`⌘S`):** writes `levels/levels.js` in place through Chrome's file access (pick the `park-my-boat` or `levels` folder once; it is remembered). Only edited levels change. Inside them, every part you didn't touch keeps its exact text, comments and helper calls included (`...basin(...)`, `tiedUp(...)`, `...HARBOR_ISLAND.lands`); a part you touched is written out as plain numbers. New levels go at the end of the list. Levels are found in the file by name, so keep names unique.
- **Check:** `await pmbEditor.selfTest()` in the console (over HTTP) rewrites every level and checks that unedited ones reproduce the file exactly and that each one written out in full loads back the same.

## Controls
- Mouse: hold anywhere on the water and the boat steers toward the cursor; it backs up if the cursor is behind it. Farther cursor = more throttle. Let go to stop and park.
- Keyboard: W/Up throttle, S/Down reverse, A/D or Left/Right rudder. Space/Enter skip the slip preview, R restart, P/Esc pause.

## Art direction
Toybox Flat: flat fills, 0.1-unit ink outlines (#2B2D42), soft offset drop shadows. Palette: water teal #8CD6D1, wood #E8B873, coral #F2635F, sunny #FFCC47, cream #FFF7E5, teal #33949E. Everything is drawn in code with Canvas 2D (`setGLEnable(false)` so text and shapes draw in order). The UI is laid out in a fixed 40 × 22.5 box (1280 × 720 at 32 px per unit), letterboxed; the world camera is free and fills the window. Water ripples come in octaves 10x apart so the water keeps its texture at every zoom.

## Audio
ZzFX through LittleJS `Sound`: motor putts (pitch by boat size), bonk, quack, buoy bong, splash, anchor chain, win jingle, fail womp, click. Sound toggle on the title.

## GameAnalytics
Not wired. `track()` logs `progression Start/Complete/Fail` with `world01:levelNN` ids (`bonus:levelNN` for bonus levels) and accuracy as the score, plus `ui:restart` and `settings:sfx:off`, to the console.

## Gaps against STANDARDS.md
- No GDD yet (this started as a prototype on request).
- All levels are unlocked; no worlds beyond one; no daily challenge.
- No music toggle (there is no music). Touch is untested (the engine maps touch to mouse).
- Color-only cues: the slip turns solid when you are inside it (shape change, fine), but star states rely on fill color plus outline only.
- `window.game.win()` is a debug helper and must be removed for release.

## How to start
Play it, decide whether the feel is worth it, then phase 1 of `../../PHASES.md`: write `GDD.md` describing what is built and what changes, and get it Approved before adding content.
