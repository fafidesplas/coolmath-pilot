# Paper Football — devlog

## 2026-10-19 — Moved into coolmath-pilot
- Moved from the prototype-city repo with its git history (earlier names: Chalk Talk, Endless Football).
- Current state: a playable endless whiteboard-football drive, 1 player with a CPU teammate or 2 players, Normal and Puzzle modes, team size and receiver settings, records per setting.
- Added the brief (`CLAUDE.md`), `mechanic.svg` and this devlog.
- Next: write `GDD.md` for what is built (phase 1 of `PHASES.md`).

## 2026-10-19 — Paper Football: playbook, team size, Puzzle mode
- Renamed Endless Football to Paper Football. 1 player at QB: pick the target before the snap; every play comes from a 7-play playbook, and any route can be redrawn.
- Upgrade cards removed (kept in `design-ideas.md`); stiff arm is now standard, a 40% chance once per first down.
- Title screen settings: team size (2 to 11 a side) and receivers (1 to 5); the defense matches body for body. Default 8 on 8 with 2 receivers; records kept per setting; M returns to the menu.
- Sky-high intro on the first kickoff of a session, and a hand-drawn YOU callout before the snap.
- Puzzle mode: blades, blocks and trapdoors replace the deep defenders, plus portal pairs for receivers; coverage thinned to 2 (1 on a crowded field).

## 2026-10-18 — Chalk Talk prototype to Endless Football
- First build as Chalk Talk: endless two-player whiteboard football. QB calls HUT and throws, WR gets open; a catch moves the line and swaps roles. 1 player with a CPU teammate, keyboard or split-screen touch.
- Added downs (4 to gain 10), saved records, man or zone defensive calls; the solo WR calls for the ball.
- Juke replaced the shove; rushers bat passes; drawn route zigzags become jukes; defenders swat passes and picks are rarer.
- Run after the catch with diving tackles and a jump to hurdle them.
- Renamed to Endless Football; added and reworked upgrade cards every 120 yards; the mouse works as a floating stick and touch auto-runs the ball carrier upfield.
