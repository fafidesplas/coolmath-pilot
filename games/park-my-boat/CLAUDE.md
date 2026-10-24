# Park My Boat — game brief

> Every level is one boat and one empty slip. Steer it in, stop, drop anchor. Physics does the comedy.

![How Park My Boat plays](mechanic.svg)

**Rank:** Prototype · **Genre:** Physics parking puzzle · **Art family:** Toybox Flat · **Audience habit:** Play at the desk

@../../STANDARDS.md
@../../PHASES.md

## Why it works for Coolmath
Everyone knows how hard parallel parking is, and a boat has no brakes. The goal is clear at a glance: a dashed box with a ghost of your boat in it. A level takes 20–60 seconds, and a miss costs nothing but pride, so players retry for three stars. The jokes are visual (ducks spin, boats wobble, the captain's eyes pop) and work with the sound off.

## Core loop
Level card → steer the boat across the marina → line it up in the slip → stop → drop anchor → the game waits for the boat to settle → inside the slip: 1–3 stars by accuracy; outside: a quip, the anchor comes up, try again.

## Mechanics (what is built)
- **Boat physics:** each boat is a rigid body built from circles along its keel. Water drag is low along the keel and high sideways, so boats coast and drift. The rudder turns the boat more the faster it goes, plus a little prop wash at low speed. Reverse is weaker than forward. Every boat type has its own mass, power, turn rate and drag.
- **Anchor:** Space, Enter or the anchor button. The anchor lands at the bow on a short rope with heavy drag. Dropping it at speed (over 2.5 u/s) spins the boat out ("SKRRRT!"). Press again to raise it before it settles.
- **Judging:** when the boat is nearly still for 0.5 s (or after 3.5 s), every hull circle must be inside the slip. Accuracy = 60% position (0.8 units off = 0) + 40% angle (20° off = 0). Nose-in or stern-in both count. 3 stars at 85%+, 2 at 60%+, else 1.
- **Obstacles:** docks and pilings (static), moored boats (on springs, they wobble back home), loose drifting boats and logs (push them), buoys (springy tether, very bouncy), duck families (mother wanders and flees the player, ducklings follow in a line, a hit stuns and spins them), currents (zones that move the water itself).
- **Score extras (comedy):** a damage bill in dollars and a count of ducks offended, shown in the HUD and on the result screen. They don't affect stars.

## Boats
Dinghy, Zippy (speedboat, drifts), Swan Pedalo (spins), Party Barge (wide, slow), Sailboat (long, strong keel), Tugboat (heavy, pushes things), Bathtub (no keel at all), Mega Yacht (8 units long, huge momentum).

## Levels (10, one world)
Baby Steps, Buoy Oh Buoy, Zippy, Swan Song, Party Barge (slip on a side pier), Long Story (current and logs), Tug Life (clear your own slip), Rip Current, Rubber Ducky, Mega Yacht (parallel parking). Data in `levels/levels.js`.

## Controls
- Mouse: hold anywhere on the water and the boat steers toward the cursor; it backs up if the cursor is behind it. Farther cursor = more throttle. Click the anchor button to drop or raise the anchor.
- Keyboard: W/Up throttle, S/Down reverse, A/D or Left/Right rudder. Space/Enter anchor, R restart, P/Esc pause.

## Art direction
Toybox Flat: flat fills, 0.1-unit ink outlines (#2B2D42), soft offset drop shadows. Palette: water teal #8CD6D1, wood #E8B873, coral #F2635F, sunny #FFCC47, cream #FFF7E5, teal #33949E. Everything is drawn in code with Canvas 2D (`setGLEnable(false)` so text and shapes draw in order). The view is a fixed 40 × 22.5 world units (1280 × 720 at 32 px per unit), letterboxed.

## Audio
ZzFX through LittleJS `Sound`: motor putts (pitch by boat size), bonk, quack, buoy bong, splash, anchor chain, win jingle, fail womp, click. Sound toggle on the title.

## GameAnalytics
Not wired. `track()` logs `progression Start/Complete/Fail` with `world01:levelNN` ids and accuracy as the score, plus `ui:restart` and `settings:sfx:off`, to the console.

## Gaps against STANDARDS.md
- No GDD yet (this started as a prototype on request).
- All levels are unlocked; no worlds beyond one; no daily challenge.
- No music toggle (there is no music). Touch is untested (the engine maps touch to mouse).
- Color-only cues: the slip turns solid when you are inside it (shape change, fine), but star states rely on fill color plus outline only.
- `window.game.win()` is a debug helper and must be removed for release.

## How to start
Play it, decide whether the feel is worth it, then phase 1 of `../../PHASES.md`: write `GDD.md` describing what is built and what changes, and get it Approved before adding content.
