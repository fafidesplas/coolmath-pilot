## 2026-11-10 — Release export without debug

- `tools/export.mjs` now cuts every debug piece from the exported build (`RELEASE`): the Test Map level and its spawn/remove/clear buttons, `?test`, `?bonus`, `?hitbox` (and `drawHitboxes`), the URL tuning knobs (`?speed`, `?coast`, `?slowdown`, `?shipview`, `?settle`, `?buoy`, now fixed at their defaults), `window.game.win()` and `load()`, and the level editor hooks. Each cut must match exactly, and a `DEBUG` check fails the export if anything is left.
- Exported to `~/Desktop/spaceship-parking` (+ `.zip`, 236 KB).
- Checked in headless Chrome: title screen, 8 levels (Spin Dock to Nesting Dolls), each loads and plays; `?test&hitbox&bonus` adds nothing; `game.win` and the editor are undefined. No errors.
- Next: upload the folder to the Netlify site if the public copy should update.

## 2026-11-08 — Editor: levels like Nesting Dolls
- The level editor can now make everything Nesting Dolls uses. Station, moored ships and chain starts get "waits inside boat n" (`in`). Chain slips get "lies": open space, the station, or inside a moored ship, with "in its hangar" for the Ark. They also get "holds the ship once parked" (`hold`). Moored ships get "fixed" and "flies off into a portal at the end", with the portal's distance and size; the portal ring shows on the canvas.
- Moving or turning a slip that has things waiting inside its boat carries them along. Moving or turning a moored ship carries the slips inside it. Removing a moored ship frees its slips where they are and drops its portal. Removing or reordering chain boats renumbers every `in`.
- Red notes under the level settings flag nesting mistakes (no `hold`, a start nested in a later boat, a slip in a ship or station that appears too late, a hangar slip in a ship with no hangar). The hierarchy tags rows (fixed, inside n, portal, holds, parks in moored n). The canvas tags nested things "inside n" once they are big enough on screen.
- New level is now open space (one Escape Pod and its slip) instead of the harbor template.
- Fix in the game: a slip on a station or inside a ship no longer gets finger docks (`makeSlip`). In a hangar slip they were placed at NaN and froze the game. The current levels all had `fingers: 'none'` there, so they don't change.
- Checked in Chrome: built a level from scratch through the panel (a Carrier, then a Star Yacht waiting inside it, parking in the hangar of a fixed Ark that waits inside the Carrier and flies into a portal). Test play hid the Ark and yacht until the Carrier parked, then completed through the portal (3 stars). Test play from boat 2 of it and from boat 3 of Nesting Dolls also completed. Moving and turning Nesting Dolls' first slip carried the station, Ark and pod start right; undo gave back the file's exact text. Editor self-test: 8 levels, 0 problems. The export passes.
- Next: make a second nested level with the editor and play it by hand.

## 2026-11-08 — Nesting Dolls: motes pulled into the portal
- The portal's yellow arms are gone; 48 motes spiral into it instead (`moveMotes`, `PORTAL_MOTES` in `src/space.js`), 4 in 10 lilac and the rest cream. They start up to 2.4 portal radii out, turn and fall faster closer in, and fade into the hole. Each one has a faint trail drawn like the ships' side trails (a ribbon that thins and fades toward its tail) and a brighter head. While the portal opens they are spread over the whole way in; none come once it closes, and those left shrink away with it.
- Tried first in a preview page (amount, color, arms on or off); these are the settings picked there: some motes, cream and lilac, no arms.
- Checked in Chrome: 48 motes while open, the right mix, spiraling the same way as in the preview; the ending still completes on its own (8.7 s after the yacht parks), frames 7 ms median. Editor self-test: 8 levels, 0 problems. The export passes. No console errors.

## 2026-11-08 — Nesting Dolls: a darker portal
- The portal was too colorful: it is now dark blues and purples with yellow. A mustard rim and faint glow, rings darkening inward from dusky purple through slate blue and indigo to a near-black middle, the same mustard arms. Teal, lilac and cream are gone from it.
- Then the rim and its glow turned lilac too, so the yellow is only in the arms.
- Checked in Chrome: a close-up of the open portal in Nesting Dolls.

## 2026-11-08 — Nesting Dolls: the Ark flies off into a portal
- The level ends with the Star Yacht again: once it parks in the Ark's hangar, the Ark (now a fixed moored ship, not a chain ship) flies off on its own into a portal opening 3 Ark lengths ahead of its bow, the yacht inside it, and then the level is complete. Nobody pilots the Ark.
- Portal (`portal: { i, ahead, r }` in a level, `src/space.js`): opens over 1.2 s while the camera pulls out to the Ark, the Ark fires its engines at 1.8 s, speeds up for 3.6 s and shrinks into the portal over its last length; the portal closes and the complete screen shows a second later. It is drawn over the other ships (the Battle Station's rim) and under the Ark. The slip, the route guide and the YOU marker hide during it.
- `on: 'moored'` slips take `hangar: true` (the middle of that ship's hangar). The chain-ship hangar slips (`on: 'boat'`) and the Battle Station's bay are gone, as nothing parks in them now; the hangar mechanics stay.
- Checked in Chrome: the whole level by `game.win()` three times, then left alone: the portal opens, the Ark flies straight in and shrinks, the yacht hides with it, the complete screen shows 8.6 s after the yacht's last win (3 stars, $0). No stray guide line during the flight (found and fixed: the hidden yacht left its slip behind). Editor self-test: 8 levels, 0 problems. The export passes. No console errors.
- Next: play it by hand; tune the portal's size and distance and the flight's timing.

## 2026-11-08 — Nesting Dolls: the Ark ends the chain
- Nesting Dolls has a fourth ship. The Star Yacht no longer parks in the Carrier (gone from this level); it flies up into a hangar in the rim of the Ark's collar, the 30 km Ark waiting level 300 m above the station. Then the Ark, the yacht riding inside it, flies 75 km along the surface and parks in a bay cut into the Battle Station's rim.
- Hangars cut into a hull (`hangar` on a boat type, `fitHangar` in `src/space.js`): the hull's circles ignore anything whose middle is in the hangar (`carve`, checked in `collideBodies`), and three walls hold it in there. Boxes can now have a frame of their own (`boxFrame` in `src/physics.js`), so the walls can lie at any angle. A box with its middle in another ship's hangar ignores that ship's hull. The route guide leaves hangars open.
- Slips in a chain ship's hangar (`on: 'boat', n`). A ship parked in another rides it, never bumps it, and is drawn over it when the host is the ship you drive. The fleet is now built before the slips.
- The Ark's collar collides as one exact circle and is drawn with 720 points (within 0.3 m of round), so the hangar's mouth sits where the hull is drawn. Its hitbox went from 22 circles to 16.
- Bumping a ship you don't drive is priced by the smaller of the two masses: a light touch on the Ark cost billions (the fixed Carrier had the same problem). This also makes it cheaper for a small ship to bump a much bigger parked one in other levels.
- The editor no longer moves a slip in a ship off a removed station (only `on: 'station'` slips).
- Checked in Chrome: all four turns by `game.win()` (Complete, 100); the yacht stopped by the hull beside the hangar mouth and slid into the mouth with no damage; the Ark stopped by the rim beside the bay, slid into the bay along a wall with no damage, and stayed put at rest in its slip (it was pushed out before the box fix); the yacht stays in the Ark's hangar while the Ark moves. Spin Dock: the pod still bounces off the solar wings. Editor self-test: 8 levels, 0 problems. The export passes. No console errors.
- Not checked: flying the whole level by hand (the Ark's turn and the 75 km trip at real throttle), editor test play from boat 3 or 4.
- Next: play it; tune the Ark's height above the station, the bay's distance and the hangar widths.

## 2026-11-08 — Nesting Dolls: the station turns slower
- The station the Escape Pod docks at turned once a minute, too fast for the pod: it now turns once every three minutes (`spin: 2*PI/180`), so its front port moves at about 1.1 m/s with the drift (2.9 m/s before) and the wings sweep by a third as fast. The Star Yacht also leaves it at a third of the speed it had.
- Checked in Chrome: after the Battle Station parks, the station turns once every 180 s and the front port moves at 1.1 m/s.

## 2026-11-08 — Nesting Dolls: ships parked inside ships
- New last level, Nesting Dolls: park the 3000 km Battle Station between two moons; the camera dives to an Escape Pod coming out of a hatch on its sphere, which docks at a small spinning station just above its surface; then the Star Yacht docked at that station flies off and parks inside a Carrier's hangar.
- Nesting (`src/space.js`): a station, moored boat or chain boat start with `in: n` stays out of the level until boat n parks, then appears where boat n really parked (moved and turned with it, so it works off-center and backwards). Slips with `hold: true` hold the ship once parked.
- Slips inside a ship (`on: 'moored'`): the slip lives in the moored ship's coordinates; it and the route guide are drawn over other ships. `fixed: true` moored boats don't move.
- New ship, the Carrier (100 m): a U-shaped hauler with an open hangar at the stern, its floor drawn under the hull (chevrons, chasing lights); it collides on its walls only.
- Battle Station close-up (`drawBattleSurface`): past 2000 UI units long it draws only its sphere's surface, exactly round, in view-relative coordinates, plated like the Rest Stop walls with a lit rim and a launch hatch. Its sphere's hitbox is now exactly the drawn radius, and the sphere is traced with 360 points.
- Checked in Chrome: all three turns by `game.win()`, and the yacht flown into the hangar with the keys (no damage, parked, 3 stars). With the Battle Station parked 300 km off and backwards, pod, station, Carrier and yacht slip all appear in place (pod 3.00 m above the real surface). Editor self-test: 8 levels, 0 problems; the editor shows the nested parts. Carrier drives in the Test Map. No console errors.
- Not checked: flying the whole level by hand, the pod's dock through the spinning wings, editor test play from boat 2 or 3.
- Next: play it and tune distances (station height, carrier gap, hangar width).

## 2026-11-08 — A tidier Ark dome; The Moon becomes a Battle Station
- Ark: the biosphere is four tidy quarters on a meadow, each one shape type: a lake (upper left), a clump of same-size trees (lower left), a 3x2 grid of farm fields (lower right) and a 3x2 block of white houses (upper right). The river, scattered trees with crowns, meadow patches, clouds, the glass ribs, rings and hub are gone; the glass keeps a faint tint and one shine along the top.
- The Moon (`continent`) is now the Battle Station: a planet-sized steel sphere (plating as latitudes and meridians, lit and shaded caps, rows of lit windows, three hangar bays, four turrets), a cream command spire with a blinking beacon at the bow, and an engine block at the stern with four big cream boosters (brick noses and bands) and light engine bells, with four flames (`JETS`). It keeps its steel grey anywhere (`ownColor`). Hitbox: one circle for the sphere plus the block, spire and boosters (10 circles).
- Checked in Chrome on the Test Map: both drawn as designed, the Battle Station's hitbox (`?hitbox`) covers the sphere, block, boosters and spire, its flames fire from the boosters, no console errors. The export still passes. No level uses either ship yet.

## 2026-11-08 — The Asteroid becomes the Ark
- The `island` type (30 km) is now the Ark, a generation ship: a long cream hull with a round, bolted collar midships carrying a big clear glass dome, swept fins, an engine mount and three engines (with flames, `JETS`). Inside the dome, a biosphere in the poster inks: meadows, a lake fed by a river, forests, farm fields, a small white town and clouds drifting slowly; over it faint glass ribs, a tint and a highlight.
- Its outline is the hull and the collar traced as one shape (`unionOutline`), and its hitbox is built from hull, dome and fins like the other ships (22 circles). It keeps its cream hull wherever it appears (`ownColor`), since a teal hull from the Test Map's color list blended into the dome.
- Checked in Chrome on the Test Map: drawn as designed, hitbox (`?hitbox`) follows hull, dome and fins, 6 lengths across on screen, no new errors. No level uses it yet.

## 2026-11-08 — Big ships get a closer camera
- 16 lengths across made the Space Liner too small. Ships up to 50 m keep 16; bigger ones get fewer, smoothly on a log scale, down to 6 at 400 m (`shipScreen` in `src/main.js`): Star Yacht 13.7, Stealth Cruiser 12.1, Space Liner 7.4, Classic Frigate 6.
- Checked in Chrome: Space Liner (Touchdown) 7.4 lengths across, Classic Frigate (Heavy Lift) 6.0, Zoomer (Rest Stop) still 16.

## 2026-11-08 — Guide dashes stand still; edge arrow removed
- The route guide's dashes no longer move, and the big yellow arrow at the screen edge (with its distance) is gone: `drawSlipArrow` in `src/main.js` and its helpers in `src/guide.js` were removed. The thin line alone leads to the slip.
- Checked in Chrome in Rest Stop: still dashes along the route, no arrow, no new errors.

## 2026-11-08 — Route guide line much thinner
- The guide line was too distracting: it is now about a third as thick (0.045 UI units, was 0.14), with shorter dashes, 60% opacity (was 85%) and a slower drift.
- Checked in Chrome in Rest Stop: reads as a faint thread from the ship; the edge arrow is unchanged.

## 2026-11-08 — Route guide (A*) and a wider camera
- Camera: 16 ship lengths across (was 8), still the same for every ship.
- Route guide (`src/guide.js`, added to `index.html` and the export): a dashed line from the ship to its slip along a way it can fly, found with A* on a grid over the level (walls, docks, sand, landmasses, stations and waiting or parked ships are obstacles, grown by the ship's half width; traffic is not), straightened into a few legs, found again every 0.4 s. The edge arrow now points where the route leaves the screen and shows the route's length instead of the straight distance.
- Fixes found while testing: an obstacle wholly left of the grid filled the whole grid (`fill` reads a negative end from the back); a bay's mooring posts closed its mouth on the grid, so a lane out of a fingered slip's mouth is kept open, and a failed search tries again with less clearance before falling back to a straight line.
- `guideUpdate` runs only while a level is on screen: LittleJS's first frame comes before the later script files load.
- Checked in Chrome: Rest Stop from 11 spots all through the maze, for both ships: a route every time, none through a wall (387 m from the west hangar for the Zoomer, 251 m straight). Every ship of the six other levels, earlier ships parked: a route every time, none through anything (Spin Dock's Star Yacht goes round the station, 248 m vs 201 m straight). Searches take 0 to 3 ms, 7 ms when it retries. No errors.
- Not checked: flying a level by following the line by hand.

## 2026-11-08 — Camera a little wider: 8 ship lengths across
- 5 lengths across was too close. `SHIP_SCREEN` is now 8, still the same for every ship (12.5% of the screen width each; about what most ships had before the change, the big ones see more than they used to).
- Checked in Chrome: Escape Pod (Spin Dock), Classic Frigate (Heavy Lift) and Zoomer (Rest Stop) each span 12.5% of the screen width; in Rest Stop the whole 20 m corridor shows with room around it.

## 2026-11-08 — Same screen share for every ship; Rest Stop moves inside a battle station
- Camera: every ship now spans the same share of the screen, 5 ship lengths across (`SHIP_SCREEN`, `?shipview=` to try others). Before, it was 3.5 lengths for ships of 50 m and more, about 8 for most others, 27 for the Rocket Scooter, and levels widened it further with `view` (up to 68 lengths for Rest Stop's Escape Pod). `view` is gone from the boat types, the levels and the code. Small ships are zoomed in about 1.6x; the big ones are zoomed out a little (from 29% of the screen width to 20%).
- Battle station look: docks with `hull: true` are drawn as the walls of a giant station (grey plating with panel seams in two sizes at a time, shaded panels, a cream rim with amber lights on every edge facing open space, a hard shadow), all as one shape so the pieces show no seams. A level with `interior: true` has a dark deck floor instead of stars. Both are in the editor (dock "battle station wall", level "inside a station").
- Rest Stop rebuilt for the closer camera: inside the station, the corridor is 20 m wide (was 24), the maze is about 2/3 the size (640 m of corridor), the open pockets are now enclosed hangars, traffic lanes are 5 m off the center line. A Zoomer can thread the gap between the two lanes.
- Checked in Chrome: Escape Pod (Spin Dock), Space Liner (Touchdown) and Classic Frigate (Heavy Lift) each span 20% of the screen width. Rest Stop: traffic gaps 122 to 179 m (ideal 147), within 1.7 m of the loop, no hits; both bays park, 3 stars. Self-test: 8 levels, 0 problems. No errors.
- Not checked: how the big-ship levels and Spin Dock play with the new camera (the Escape Pod no longer sees the solar wings coming from far away), and Rest Stop by hand.

## 2026-11-08 — New level: Rest Stop
- Level 7, Rest Stop: a winding tunnel (24 m wide, nine straight runs) through an asteroid, with dead ends and a rest stop halfway along: a lay-by behind a rock median with a small station hull and two bays. A Zoomer flies in from the west, then an Escape Pod from the east, through ten small ships looping the tunnel both ways at 6 m/s.
- New helpers in `levels/levels.js`: `carve` (rock box minus open rects, as sand rects), `tunnel` (a tunnel's open rects from its center line), `laneLoop` (two-way traffic as one loop along a center line, turning round past both ends). Flying Saucers were left out of the traffic: they top out near 4 m/s.
- Checked in Chrome: 35 s of traffic stays on its loop (within 0.8 m), no hits on the rock, gaps 203 to 248 m (ideal 221), speeds 5.4 to 6.1 m/s. Both bays park, the level completes. Self-test: 8 levels, 0 problems. No errors.
- Not checked: flying it through by hand (how hard the traffic makes it, whether the dead ends read as a maze). Next: play it, then tune traffic count, pace and tunnel width in the editor.

## 2026-11-08 — Editor: stations, gravity and ground starts
- The editor now handles the space mechanics. Level settings: gravity (none or a planet, and its pull %) and a space station checkbox. The station is selected by clicking it or in the hierarchy: drag it, turn it with the handle, and set its position, heading, scale, turn time, drift circle and extra docking ports in the inspector. Ports are ringed and numbered on the canvas.
- A start can ride the station or stand on the ground; a slip can be on the station, at a port or a spot of its own. Toggling keeps the thing where it is. Things on the station are drawn, picked, moved and turned where they really are (before, Grand Station's slips were drawn as straight boxes beside the game's own and its riders far from the station). Dragging a slip at a port moves it to the nearest port. Slips can be placed standing on a pad (`bottom`), and Shift-moving one no longer breaks it.
- Test play from a later boat now clamps the earlier ones to the station or sets them on their pads.
- Save writes `2*PI/60` spins, `{ ...PLANETS.moon }` gravity and port facings as angles, like the file. `pmbEditor.preview()` in the console shows what Save would write for the current level.
- Checked in Chrome: Grand Station heading change moves its slips with it and undoes; rider and slip toggles keep their places; port and spot switching; nudging and turning Spin Dock's slip; test play from boat 2 keeps boat 1 docked (Spin Dock) and on its pad (Moon Hop); gravity and ground fields on Moon Hop; self-test passes for every level.

## 2026-11-08 — Every level saves from the editor
- Moon Hop, Pad Towers and Heavy Lift were built by the `landing()` helper, so the editor refused to save them. They are now plain level objects (like Touchdown) and the helper is gone. Pads are ordinary `pad: true` docks, so they can be moved and resized in the editor.
- Checked in Chrome: the three levels load exactly the same data as before (compared field by field), `pmbEditor.selfTest()` reports 7 levels, 0 problems (it was 3 "not in the file" before), each level loads and plays, no errors.
- Still missing in the editor: station slips are drawn in the station's coordinates (away from the station), and the station, gravity, ports, riders and `ground` starts have no fields in the inspector. They save fine, but must be changed in `levels/levels.js` by hand.

## 2026-11-08 — Moon Hop: every ship starts on the ground
- A ship's `start` can say `ground: true` (`groundStart` in `src/space.js`): the ship waits standing on the ground instead of hanging in the sky. It is moved so its lowest point touches the highest ground or pad top under it that is not above its start y, and under gravity it falls while it waits, so it stays put.
- All three Moon Hop ships use it (same x as before, upright): each takes off from the moon and flies to its pad.
- The editor still can't save Moon Hop (it is built by `landing()`), so this was changed in `levels/levels.js` by hand. That refusal is why the earlier editor changes didn't save.
- Checked in Chrome: Asteroid Miner, Solar Sailer and Flying Saucer each start with their lowest point at y = 0 and don't move for 6 s. W lifts the Miner off (50 m up after 2 s) and, on its turn, the Saucer. No errors.

## 2026-11-08 — Retro smoke puffs at the nose on big ships
- The retro thrusters' smoke puffs (`puffExhaust` in `src/skin.js`) now scale their position by the ship's size `k`, so they come out at the nose ports on every ship. Before, on a big ship they came out near its middle.
- Checked in Chrome, reversing: the puffs sit at 0.93 to 1.16 of the half length toward the nose on the Escape Pod, 0.85 to 0.87 on the Space Liner and 0.81 to 0.87 on the Classic Frigate. No errors.

## 2026-11-08 — Dust kicked up by the engines
- On a planet (gravity levels), each firing nozzle of the ship you drive (main engines and retro thrusters) is traced along its flame to the ground or a pad top, and kicks up dust where it hits (`kickDust`, `drawDust` in `src/skin.js`). The amount grows with throttle, with closeness (none from 1.5 ship lengths out, `DUST_REACH`) and with how straight down the flame points. The dust flies along the ground away from the hit, more to the side the flame leans, rises a little and fades in about 1.6 s. It's tinted like the planet's rock and drawn in front of the ships.
- Checked in Chrome on the Asteroid Miner, engine on full, 1 s: 78 puffs with its tail just off the ground, 71 at 0.3 ship lengths up, 49 at 0.6, 19 at 1.0, none at 1.5. A flame leaning 45 degrees sends 78% of the dust to its side; a sideways flame raises none. Looks right on the moon (grey) and on Heavy Lift (ochre, the Frigate). No errors.

## 2026-11-08 — Pivot stand-up in every landing level
- The pivot from the Moon Hop trial is now how every gravity level works (Touchdown, Moon Hop, Pad Towers, Heavy Lift): turn a ship lying on the ground toward nose up and it swings up round the end touching the ground, stops upright, and W ends the swing. `?ground=`, the boost option and `groundTrial` are gone.
- Checked in Chrome, each level's first ship laid on its side, then A held for 4.5 s: Asteroid Miner (26 m) upright, Star Yacht (80 m) and Space Liner (300 m) at 82 degrees, Classic Frigate (400 m) at 66 degrees (big ships turn slower). No damage in any, W then lifts each off, no errors.

## 2026-11-08 — Pivot trial: W ends the swing
- In `?ground=pivot`, the throttle keys (W/S, arrows) end the swing and hand the ship back to its engine, so it can always take off. Let go of them while still turning on the ground and it swings again. Only the keys do this: mouse steering always throttles a little, so it would never pivot otherwise.
- Before, the engine did nothing during the swing (the pivot sets the ship's motion directly), though the flame still showed.
- Checked in Chrome on the Asteroid Miner: halfway up with A, adding W lifts it off (20 m/s up after 1 s); stood up with A still held, W lifts it off. No damage, no errors.

## 2026-11-08 — Planet types: each landing level has its own gravity
- Three planet types (`PLANETS` in `levels/levels.js`), each with a pull (a share of each ship's own full thrust, so a ship hovers at that throttle) and a ground color (`ROCK_INKS` in `src/skin.js`). Moon: 17%, grey. Rocky: 35% (as before), brick red. Heavy: 55%, ochre.
- Touchdown and Pad Towers are rocky, Moon Hop is a moon, Heavy Lift is heavy. `landing()` takes the planet type after the name.
- Checked in Chrome: each level pulls at its share, the grounds show grey, brick and ochre, and the editor's self-test still passes for Touchdown. No errors.
- Not checked: how hard each level now plays by hand (Heavy Lift's 400 m Frigate falls about twice as fast as before, Moon Hop's ships about half as fast).

## 2026-11-08 — Trial: getting a ship on its side back up (Moon Hop only)
- Moon Hop has two ways to stand up a ship lying on the ground, picked in the URL: `?ground=boost` or `?ground=pivot` (`groundTurn` in `src/space.js`, `groundTrial: true` on the level). With no `?ground`, Moon Hop plays as before. Both apply only to the ship you drive, on the ground, tilted more than 20 degrees from upright, turning toward nose up.
- boost: the side thrusters spin it 3x as hard as it takes to beat gravity round the end touching the ground (`GROUND_BOOST`).
- pivot: the ship swings round the end touching the ground at its in-air turn rate, slowing over the last 20 degrees. It stops upright and stays there while the key is held. The pivot is the outermost of its lowest points, so a fin that reaches the ground takes over as the pivot.
- Checked in Chrome on the Asteroid Miner lying on its side, holding A (nose right) or D (nose left). Before (no trial): it stays within a few degrees of flat. Boost: upright in about 1.5 s, but it swings up hard and lands on its fins ($2,375 damage); at 1.6x it stalled near 60 degrees after 5 s with no damage. Pivot: upright in about 3.5 s, stops there, no damage.
- To drop the trial: remove `groundTrial` from Moon Hop, the `groundTurn` call in `src/main.js` and the TRIAL block in `src/space.js`.

## 2026-11-08 — Flat ground in the landing levels
- Touchdown, Moon Hop, Pad Towers and Heavy Lift land on flat ground (a `land` rect with its top at y = 0) instead of a round planet. On the slope, a winged ship (the Stealth Cruiser) could lie stuck on its side, propped up by a wing. `landing()` in `levels/levels.js` no longer takes a planet radius.
- Checked in Chrome: the four levels load with one flat ground and no round planet, the pads sit on it (the towers still stand 30 m and 55 m tall), and there are no errors.
- Found: a ship lying flat on its side still mostly can't turn upright. A or D for 3.5 s leaves it within a few degrees of flat (once it got to 30 degrees). The side thrusters are too weak to lift one end against gravity, so RESTART is the only way out.

## 2026-11-08 — Level editor copied in from Park My Boat
- E opens the level editor again: `tools/editor.js` is Park My Boat's, copied, with its saved-folder ids renamed, and `index.html` loads it. It never came over in the fork. `tools/export.mjs` lists its scripts, so the editor stays out of the export.
- Saving a level built by a helper (Moon Hop, Pad Towers, Heavy Lift from `landing()`) is refused with a message. Before, it would have added a second copy of the level to `levels.js`.
- Checked in Chrome: E opens the editor on Spin Dock and Moon Hop, E play-tests Moon Hop, and the editor's self-test passes for the three hand-written levels. No errors.
- Not done: station slips are drawn off the station in the editor, and the space fields (station, gravity, ports, riders) have no inspector fields.

## 2026-11-08 — Every ship turns when stopped, in every level
- The turn-when-stopped trial is now the rule: the `spinTurn` flag is gone from Spin Dock, and every ship (traffic too, not only the one you drive) turns with the nose thrusters in the levels without gravity (`spinTurn` in `src/space.js`, `driveBoat` in `src/main.js`). The gravity levels already turned a stopped ship with the side thrusters (`thrusterSpin`).
- The mouse's reverse steering no longer flips the turn in any level. This also fixes the gravity levels, where the flip turned the ship the wrong way.
- Checked headless, all six levels: a stopped ship turns with A or D (Escape Pod about 28 degrees in a second, the big ships 7 to 19), and reversing with A turns it left. Grand Station's Space Liner, which could not turn from a stop before, now does. No errors.
- Not checked: the mouse's reverse steering by hand.

## 2026-11-08 — Four new levels: three landings and a big station
- Moon Hop (landing: Asteroid Miner 26 m, Solar Sailer 12 m, Flying Saucer 2.6 m), Grand Station (docking: Space Liner 300 m, Asteroid Miner 26 m, Zoomer 6.8 m, Rocket Scooter 2.4 m), Pad Towers (landing: Star Yacht 80 m on the ground, Zoomer and Rocket Scooter on 30 m and 55 m towers), Heavy Lift (landing: Classic Frigate 400 m, Stealth Cruiser 112 m, Flying Saucer 2.6 m). Order: Spin Dock, Touchdown, Moon Hop, Grand Station, Pad Towers, Heavy Lift.
- `landing()` in `levels/levels.js` builds a gravity level from a planet radius and a pad per ship (towers with `lift`).
- Stations can be scaled (`scale`), get extra docking ports (`ports`), and a slip can sit at a port by number (`port`). Grand Station is Spin Dock's station at 7x. Its small ships wait riding on the station near their ports (`start: { on: 'station' }`), released when their turn gives control: flying in from outside the wings' sweep took the Rocket Scooter over 40 s.
- No Stealth Cruiser at a station: cloaked, it passes through the station. In Heavy Lift it can cloak under the parked Frigate; harmless.
- Checked headless: every level loads, and every ship teleported into its slip parks, through to the results screen (Grand Station with no damage; the landing levels charge a little because the test drops ships onto the pads, as it does in Touchdown). A released rider flies off with no hit. No errors.
- Not checked: flying each level by hand (approach paths, how hard each landing is). The turn-when-stopped trial is still on Spin Dock only.

## 2026-11-08 — Forked harbor levels removed
- Removed the seven levels that came from Park My Boat: Odd Couple, Way Down, Rush Hour, Open Space, Spaceport, Docking Ring and the hidden bonus Moon Drift. The game is now Spin Dock, then Touchdown; `?test` still adds the Test Map. `LEVEL_NAMES` (their space names) is gone from `src/skin.js`; the level helpers stay in `levels/levels.js`, unused for now.
- Stars are saved by level number, so the save goes to `v: 2` and old stars are cleared rather than shown on the wrong level.
- The turn-when-stopped trial moved from Odd Couple to Spin Dock (`spinTurn: true`).
- Checked headless: the level select shows the two levels, both load and play, the stopped pod turns about 30 degrees in a second in Spin Dock, and `?test` still opens the Test Map. No errors.
- Next: new space levels to fill the game back out.

## 2026-11-08 — Trial: the nose thrusters turn a stopped ship (Odd Couple only)
- In Odd Couple (`spinTurn: true` in `levels/levels.js`) the ship you drive turns even when it is stopped, about as fast as the side thrusters turn it in Touchdown, so the flame and the turn now agree. Moving, it turns as fast as before. Left always turns the nose left, reversing too (in the other levels reversing flips the turn like a car), and the mouse's reverse steering follows that (`spinTurn` in `src/space.js`).
- Checked headless: in Odd Couple a stopped pod turns about 30 degrees in a second with A or D, and reversing with A turns it left; in Way Down a stopped ship still doesn't turn. No errors.
- To revert: remove `spinTurn` from Odd Couple. To keep it: set it on every level, or drop the flag and use `spinTurn()` everywhere.
- Not changed: in Touchdown the mouse's reverse steering still uses the harbor sign, which with the side thrusters likely turns the wrong way. Untested.

## 2026-11-07 — Turning fires a retro thruster
- Turning fires the retro thruster on the outside of the turn, the one that pushes the nose round: left fires the starboard (right) one, right fires the port one, at 70% of a full reverse flame, with its own smoke puffs. Reversing still fires both. Only the ship you drive does this (`retroFire` in `src/skin.js`; `RETRO_TURN`, `RETRO_TURN_MIN` for the flame size and the smallest mouse turn that fires it).
- Checked headless on the Escape Pod: A lights the right thruster, D the left one. No errors.
- The thruster is only a look: in the levels without gravity a ship still needs speed to turn, so a ship sitting still shows the flame without turning.

## 2026-11-07 — Selection rim round the whole ship
- The cream rim round the ship you drive in the crowded levels now goes round its whole outline (fins, boosters, sail, drill), not only the body, and is half as thick at 80% opacity (`SELECT_W`, `SELECT_ALPHA`, `drawJamSelection` in `src/skin.js`). All the shapes are stroked as one path, so there are no darker spots where they meet. Over a cloaked ship the rim is cut to the outside of the outline, so no lines cross the ship.
- Checked headless in Open Space: Star Yacht, Solar Sailer and a cloaked Stealth Pod. No errors.

## 2026-11-07 — Cargo Hauler renamed Classic Frigate
- The Saturn V-style ship (`container`) is now called Classic Frigate (`SHIP_NAMES` in `src/skin.js`).

## 2026-11-07 — Retro thrusters at the nose
- Reversing no longer puffs exhaust out of the main engine. Instead two retro thrusters, one on each side of the nose (where the hull has narrowed to 60% of its widest), fire forward and out at 35 degrees with the main engine's brick-and-mustard flame, and their smoke drifts off ahead of the ship. They replace the cream circles. Coasting backward makes no puffs at all.
- Each ship type gets `retro` (port position and flame size) from its drawn outline; puffs for the player now come from one helper, `puffExhaust` in `src/skin.js` (main.js and jam.js call it).
- Checked headless on the Escape Pod: flames at both nose shoulders, smoke ahead, nothing at the stern, no errors.
- Next: check the retro flames on the long ships (Space Liner, Cargo Hauler) and the Asteroid Miner's drill.

## 2026-11-07 — Parallax stars everywhere; trails hug the ships
- Parallax stars are kept and now on in every level (the `parallax` level flag is gone).
- The faint side trails started at the edges of the old boat hulls, so slim ships (Solar Sailer most of all: 1.6 wide as a boat, 0.52 as drawn) had a gap between hull and trail. Each ship type now gets `trailW`, the width of its drawn outline (body, fins, boosters, sail) where the trails start (`outlineHalfWidth`, `TRAIL_AT` in `src/skin.js`), and the trails start there and are sized to it.
- Checked headless: the Solar Sailer's trails come off its hull, no errors.
- Next: play a few levels and check the trails on the wider ships (Star Yacht fins, Stealth Pod boosters).

## 2026-11-07 — Parallax stars trial on Odd Couple
- Trial: in Odd Couple the stars scroll at different speeds as the camera follows the ship. The smallest (farthest) scroll at 15% of the ships' speed, the biggest at 100%, flares at 60% (`starDepth` in `src/skin.js`). Turned on by `parallax: true` on the level; every other level is unchanged. To drop it, revert this commit.
- Checked headless: during a 48 px pan the tiniest stars moved about 9 px, flares 31 px, the biggest stars 37-48 px. No errors.
- Next: play it and decide whether to keep it, and whether all levels get it.

## 2026-11-07 — Zero-g trial dropped
- Tried Asteroids-style physics on Odd Couple: almost no drag, so a ship coasts on and stopping means a well-timed reverse burn. Too hard to stop when played, so it was reverted (commit `b02b428` has it if it is ever wanted again). Every level flies as before.

## 2026-11-06 — Touchdown largest first; solid solar wings
- Touchdown now lands the biggest ship first: the Space Liner on the 100 m pad, then a 28 m Star Yacht on a new 20 m pad, then the Escape Pod on the 8 m pad. Checked: each ship set down on its pad parks with no damage, and the level completes.
- Spin Dock: each pair of solar wings collides as one solid rectangle reaching in to the truss, so the pod can no longer wedge in the scalloped edges, the slot between two wings or the slot next to the truss. The drawing is unchanged. New in `src/physics.js`: bodies can carry `boxes` (solid rectangles in body coordinates); `?hitbox` outlines them.
- Fix: the game froze (an engine assert in `drawFoam`) once a ship was held in place after landing or docking, because its side trail divided by zero. Held ships no longer lay a trail.
- Next: play Touchdown by hand (the yacht's start, the pad spacing) and Spin Dock with the pod near the wings.

## 2026-11-06 — Renamed Spaceship Parking; no side spray
- The game is now Spaceship Parking: folder `games/spaceship-parking`, page title, title screen ("Spaceship" over a big "Parking"), save key `cm_spaceship-parking_save` (progress under the old key is not carried over), export folder `~/Desktop/spaceship-parking` and its title.
- A ship sliding sideways no longer throws cream spray drops off its side (left over from the boats' water spray). The faint contrails stay.
- Next: play the crowded levels by hand (see below).

## 2026-11-06 — Crowded levels inside a station
- Open Space and Docking Ring now take place in a station's docking bay, not open space: the station's main hull walls the bay in, a few spur modules fill its empty corners, and more modules reach out beyond the hull. New helper `bay()` in `levels/levels.js`. The hull replaces the invisible walls and stands at least 4 m clear of every slip; the camera views grew to show it.
- Next: play both levels through by hand to check that the hull and spurs leave room to turn the big ships (Asteroid Miner, Star Yacht).

## 2026-11-06 — Spin Dock: ships dock across the end of the stack
- The docking ports are back at the two ends of the module stack, and each slip lies across the stack's end, broadside to the port like the bar of a T: the pod at the front end, the yacht at the aft end. The solar wings and the pod's start are back where they were before the side ports.
- Checked: a ship held in each slip docks with no damage.
- Next: play it by hand and tune.

## 2026-11-06 — Touchdown: ships fall straight down
- Gravity pulled straight down, but falling ships still had the boat's water drag (easy along the keel, stiff sideways), so a tilted ship fell along its own nose. A falling ship's drag is now the same in every direction, so it falls straight down whichever way it points.
- Next: play Touchdown by hand and retune gravity share if landings got harder.

## 2026-11-06 — Spin Dock: ships dock across the station
- The docking ports moved from the ends of the module stack to its sides, so both slips stand at right angles to it: the pod on the lab's side, the yacht on the far side of the aft module. The solar wings moved 7 m farther out along the truss to make room for the yacht's slip, and the pod starts 6 m farther out to stay clear of their sweep.
- Next: play it by hand and tune.

## 2026-11-06 — Hitboxes follow the ships; Spin Dock and Touchdown
- Hitboxes: every ship's collision circles are rebuilt from its poster outline (body, fins, boosters, wings, sail, drill), no longer from the boat hull it replaced. Fins now bump; the Space Liner, Cargo Hauler and Stealth Cruiser are wider (fins), the Solar Sailer and Zoomer slimmer. Slips grow where the outline is wider. `?hitbox` shows the circles. Every level checked: no ships start overlapping. Spaceport's yacht slip has 0.1 less side room so it stays the width it was.
- New level Spin Dock: dock the Escape Pod, then a Star Yacht, at the ports of a drifting, spinning space station whose solar wings sweep round it. A docking beam in the slip carries the ship with the port.
- New level Touchdown: gravity. Land the Escape Pod upright on a pad, then a Space Liner on the big pad next door. Side thrusters turn the ship with no speed.
- New file `src/space.js` (station, moving slips, beam, gravity, pads), added to the export.
- Next: play both levels by hand and tune (station spin and drift, the pod's view, gravity share, the liner's start height).

## 2026-11-06 — Dashboard schematic redrawn
- New `mechanic.svg` in the poster style: an Escape Pod flies in with its thruster lit, stops in a slip between two docking arms of a station (a Rocket Scooter already parked next door), the resting ring fills, the slip lights up, then DOCKED! and three stars. Starry sky with flares and a ringed planet. Loop 6 s.

## 2026-11-06 — Renamed Starship Parking; pick hint
- The game is now Starship Parking: folder `games/starship-parking`, page title, title screen ("Starship" over a big "Parking"), save key `cm_starship-parking_save` (progress under the old key is not carried over), export folder `~/Desktop/starship-parking`.
- Crowded levels (Open Space, Docking Ring): until a ship is picked, "Click the ship you want to park first" pulses at the bottom of the screen. Brief's Writing rule updated for this one exception.
- Next: a GDD.

## 2026-11-06 — Own folder, forked from Park My Boat
- The space skin of Park My Boat (`../park-my-boat/space/`) is now its own game: the harbor game's code, levels and engine copied here as of commit `40a0e9c`, with the skin as `src/skin.js` and the export script as `tools/export.mjs`.
- Save key is now `cm_lost-in-parking-space_save` (the old `cm_park-my-boat_space_save` progress is not carried over).
- Shown on the team dashboard like the other games.
- Next: a mechanic.svg of its own, a GDD, and deciding which harbor fixes to keep copying over.
