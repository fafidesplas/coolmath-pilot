# Spaceship Parking — game brief

> Park an escape pod, then a space liner right next to it, while the camera zooms out like crazy. Ships from 2.4 m to 400 m share one patch of sky, drawn like a 1960s space-age poster.

![How Spaceship Parking plays](mechanic.svg)

**Rank:** Prototype
**Genre:** Physics parking puzzle
**Art family:** Space-Age Poster
**Audience habit:** Play at the desk

@../../STANDARDS.md
@../../PHASES.md

## Where it comes from
Forked from Park My Boat on 2026-11-06 (commit `40a0e9c`). It began as a secret skin of that game (`space/` in its folder) and grew far enough from it to be its own game. The two now change independently: a fix in one is not in the other unless it is copied over by hand. Until this brief grows its own detail, `../park-my-boat/CLAUDE.md` describes the shared mechanics as they were at the fork (physics, camera, judging, levels, traffic, the crowded levels, the Test Map).

## How the code is built
- `src/physics.js`, `boats.js`, `render.js`, `jam.js`, `main.js` and `levels/levels.js` are the harbor game's code as forked, still in boat terms (BOATS, drawWater, ducks, buoys...).
- `src/skin.js`, loaded after the game code, repaints it: a poster `painter` replaces the Toybox one (every deck drawing becomes a flat shaded shape; `poster()` maps flat colors to the poster inks), it changes the shared colors in place and replaces drawing functions (`drawWater` is the starfield, `drawBoat`, `drawDock`, `drawLands`, `drawDuck`, `drawBuoy`, the UI panels...). Each ship is drawn from `SHIP_DECO` (thruster positions in `JETS`; most ships are poster rockets whose body outline, fins and boosters are built once in `RK` with `rocketPts`, fins drawn under the body by `SHIP_UNDER`). It renames ships (`SHIP_NAMES`) and levels (`LEVEL_NAMES`), rewrites on-screen words through `txt` (`TEXT_SWAPS`: LAND HO! becomes PREP THE AIRLOCK!, DIVE becomes CLOAK, boat becomes ship), swaps three sounds, and draws all text in Righteous (`drawText` is wrapped).
- Now that the code is its own, space-only changes can go straight into `src/` instead of being patched from `skin.js`. When you add a boat type, give it a space deck in `SHIP_DECO`, a name in `SHIP_NAMES`, jets in `JETS` and its collision outline in `shipHitShapes`.
- **Hitboxes:** every ship collides where it is drawn. `skin.js` rebuilds each type's collision circles from its poster outline (`shipHitShapes`: body, fins, boosters, wings, the sail, the drill and claws; canards, engine bells and flames stay decoration) with `coverCircles`: a row along the keel fitted to the body, then a few circles per fin or booster, mirrored across the keel. `hitL`/`hitW` (the outline's extent) size the slips when they are bigger than the type's `L`/`W`. Load `index.html?hitbox` to see every collision circle in red.
- `src/space.js`, loaded after `skin.js`, adds the space-only mechanics (main.js calls it at a few hooks): space stations, slips that move with them, the docking beam, gravity, side thrusters and landing pads (see Levels after the fork).
- Save key: `cm_spaceship-parking_save`.
- Fonts: Righteous, bundled in `fonts/` with its OFL license, declared in `index.html`.

## Look
1960s space-age poster: flat rounded shapes with a soft shaded edge in teal, mustard, brick and cream on a near-black navy sky (#07091C), glowing stars with four-point flares in zoom octaves 10x apart that scroll at different speeds as the camera moves (parallax: the smallest at 15% of the ships' speed, the biggest at 100%, `starDepth` in `src/skin.js`), faint cream side trails that start at the edge of the drawn ship (`trailW`), retro thrusters on both sides of the nose that fire forward while reversing (`retro`, `puffExhaust`; the main engine stays dark), and the one on the outside of a turn while turning (`retroFire`), film grain over everything, Righteous type. The title screen reads "Spaceship" over a big "Parking". Its look must stay unlike the team's other games (Night Neon was dropped for matching Orbit Hop).

## Export for people outside the team
`node tools/export.mjs [outDir]` (default `~/Desktop/spaceship-parking`, plus a `.zip`) writes a standalone copy that opens from disk: one flat folder, every comment stripped from the game code, the save key and the harbor title renamed, analytics logging silenced. It fails if anything naming the team, Park My Boat or its author is left (`FORBIDDEN`). The engine keeps its MIT header and the font its OFL file, as their licenses require. If you add a string that names Park My Boat, add it to `REWRITES`. The public copy is on Netlify (site `luminous-cassata-2dd71b`); update it by dragging the exported folder onto that site's Deploys tab, which keeps the URL.

## Turning
Every ship turns even when it is stopped, in every level. Without gravity the nose thrusters turn it (`spinTurn` in `src/space.js`): moving, as fast as the harbor rudder would; stopped or slow, as fast as the side thrusters under gravity. Left always turns the nose left, reversing too (no car-style flip), and the mouse's reverse steering follows that.

## Levels
Only levels made for this game are left: the seven levels forked from Park My Boat (Odd Couple, Way Down, Rush Hour, Open Space, Spaceport, Docking Ring, and the hidden bonus Moon Drift) were removed on 2026-11-08. The Test Map (`?test`) stays as a sandbox. The level helpers those levels used (`basin`, `harborIsland`, `bay`, `berths`, `loopLane`...) are still in `levels/levels.js`, unused; `bay()` builds a station docking bay walled by the main hull (docks drawn as modules), in case a crowded level comes back.

- **Spin Dock:** a 124 m orbital lab (truss, eight gold solar wings, radiators, a module stack with a cupola, a docking port at each end of the module stack; `STATION` in `src/space.js`) drifts round a 10 m circle and turns once a minute; it is level 1 (`station` in the level: `spin`, `drift`). Nothing pushes it; a hit costs money like a dock. Each pair of solar wings collides as one solid rectangle reaching in to the truss (`wingBoxes`, body `boxes` in `src/physics.js`), so the pod can't wedge between the wings; the drawing is unchanged. Ships dock across the end of the module stack, lying broadside against its port like the bar of a T: the Escape Pod at the front end, then a 28 m Star Yacht at the aft end. Only the gaps between the wings lead in. A slip with `on: 'station'` is given in the station's coordinates and turns with it. Inside it (and half a ship length round it) a docking beam carries the ship along with the port, so letting go there means resting next to the port; resting is measured against the port's motion. A docked ship is clamped to the station for the rest of the level (no anchor). The pod's camera shows 4x its usual view (`view` on a chain boat) so the wings show as they sweep past.
- **Touchdown:** gravity (`gravity: { share }`): a steady pull down, a share of each ship's own full thrust, so every ship hovers at the same throttle. Each landing level names a planet type (`PLANETS` in `levels/levels.js`, `gravity: { ...PLANETS.rocky }`) that sets the pull and the ground's colors (`ROCK_INKS` in `src/skin.js`): moon 17%, grey; rocky 35%, brick red; heavy 55%, ochre. Touchdown and Pad Towers are rocky, Moon Hop a moon, Heavy Lift heavy. A ship falls once it has control; the next one waits in the sky. Under gravity A/D (or the mouse) fire side thrusters that turn the ship with no speed (`thrusterSpin`, `RCS_TURN`). The slips stand on landing pads (`pad: true` docks, `bottom:` on the slip), upright: stand the rocket on its fins in the pad and let go. A ship that lands is set down for good (no anchor). The ground is flat (a `land` rect with its top at y = 0; round planets were dropped on 2026-11-08 because a winged ship could lie stuck on its side on the slope). Largest first: a 300 m Space Liner on the 100 m pad, then a 28 m Star Yacht on the 20 m pad next door, then the Escape Pod on the 8 m pad beside it.

- **Moon Hop:** landing on a moon (`landing()` in `levels/levels.js` builds a gravity level: flat ground, a pad per ship, invisible walls; `pad: [x, width, lift]`). A 26 m Asteroid Miner, a 12 m Solar Sailer, then a 2.6 m Flying Saucer.
- **Grand Station:** the Spin Dock station seven times bigger (`scale: 7`, 868 m), turning once every five minutes, with two more docking ports at the ends of its side modules (`ports` in the level's `station`). A slip can name a port (`port: n`) and lies across it. A 300 m Space Liner docks at the aft end, a 26 m Asteroid Miner at the front end, then a 6.8 m Zoomer and a 2.4 m Rocket Scooter at the side modules. The two small ships wait their turn riding on the station near their ports (`start: { on: 'station' }`, `rideStation` in `src/space.js`), since the station is too big for them to fly in from outside the wings' sweep.
- **Pad Towers:** an 80 m Star Yacht on a ground pad, then a 6.8 m Zoomer on a 30 m tower and a 2.4 m Rocket Scooter on a 55 m one beside it.
- **Heavy Lift:** a big planet: a 400 m Classic Frigate, a 112 m Stealth Cruiser (it can cloak and pass under the parked Frigate), then a 2.6 m Flying Saucer between them.

## Writing
No tutorial or flavor text in the game. Text is limited to menu buttons, labels and numbers (level and ship names, sizes, money, results), with one exception: in a crowded level (`jam: true`; none at the moment), until a ship is picked, a line at the bottom reads "Click the ship you want to park first" (`drawPickHint` in `src/skin.js`, plain text with a drop shadow).

## Level editor
`tools/editor.js` is Park My Boat's level editor, copied on 2026-11-08 (debug only, not in the export): E opens it on the current level, E again play-tests, Cmd+S saves `levels/levels.js` through Chrome's file access (pick this game's folder). It knows nothing about the space mechanics yet:
- Levels built by a helper (Moon Hop, Pad Towers, Heavy Lift come from `landing()`) open and play-test, but saving them is refused, because they have no object of their own in the file. Change them in `levels/levels.js` by hand.
- Slips on a station (`on: 'station'`) are drawn in the station's coordinates, away from the station; the station, gravity, ports and riders have no fields in the inspector.

## Not carried over
- The boat editor stays in `../park-my-boat/tools/`.

## Gaps against STANDARDS.md
- No GDD yet.
- The same gaps as Park My Boat at the fork: all levels unlocked, no daily, no music, touch untested, `window.game.win()` is a debug helper to remove for release.
