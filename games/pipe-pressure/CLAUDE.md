# Pipe Pressure — game brief

> Rotate the pipe tiles to route the water to every tank before the pressure gauge maxes out.

**Rank:** #8 · **Genre:** Tile-rotation puzzle · **Art family:** Toybox Flat · **Audience habit:** Daily puzzle

@../../STANDARDS.md

## Why it works for Coolmath
Pipe puzzles are a timeless, instantly understood format. A gentle pressure timer adds tension in later worlds, while early levels stay calm and untimed.

## Core loop
See the board → click tiles to rotate them → connect the source to every tank → open the valve → water flows and fills → stars for fewest rotations and for finishing before the gauge fills (1–3 minutes per level).

## Mechanics
- Grid of pipe tiles (straight, corner, T, cross) that rotate 90° per click. Some tiles are locked.
- Source and one or more tanks; all tanks must be filled. Leaks (open pipe ends on the flow path) spill water and fail the level.
- World 1 untimed. From world 2 a pressure gauge fills slowly; open the valve before it maxes out.
- Later elements: valves that switch between two outputs, pumps that push water uphill, colored water that must reach matching tanks, cracked pipes that break after one use.

## Controls
Click or tap to rotate clockwise (Shift-click counter-clockwise); keyboard cursor with arrows, Space to rotate, Enter to open the valve. Z undo, R reset.

## Progression and content (v1)
- 60 levels in 4 worlds (Garden, Factory, City, Lab).
- Generator plus solver for daily puzzles; debug level editor.

## Retention
Daily puzzle (random rotation of a solvable board) with streak and emoji line; garden decorations unlocked by stars (the garden in the menu grows).

## Art direction
Toybox Flat: shiny chunky pipes with bolts, bright blue water with animated flow, cute tanks that smile when full. Warm workshop background.
Concept prompt: *"Flat cartoon pipe puzzle game, grid of chunky shiny pipe tiles carrying bright blue water from a valve to smiling water tanks, garden workshop theme, warm light background, thick outlines, soft shadows, top-down 2D game screenshot, 16:9"*

## Audio
Ratchet click on rotate, gurgle and flow, happy "bloop" as each tank fills, comic leak spray.

## GameAnalytics
- Extra events: `level:rotations` (value), `level:leak`, `level:pressure_fail`.
- Question to answer: does the pressure timer raise drop-off compared with untimed levels?

## Scope
- **v1:** 60 levels, daily, garden unlocks, editor (debug).
- **Later:** relaxed mode toggle (no pressure) if data shows timer drop-off.

## Risks and open questions
- Generator must guarantee a unique or at least valid solution; verify with the solver.

## Definition of done
`STANDARDS.md` checklist, plus: solver verifies every level and daily board.

## First prompt for Claude Code
"Read CLAUDE.md and STANDARDS.md. Restate the design in 5 lines and propose a build plan. Then build a vertical slice: grid of rotating pipe tiles, source, tanks, flow simulation with leaks, valve, 3 tutorial levels, the full game shell and GameAnalytics stubs. Stop there so I can play it."
