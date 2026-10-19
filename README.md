# Coolmath pilot — game briefs

12 original HTML5 games for Coolmath Games, ranked. Each game has its own folder with a `CLAUDE.md` brief that Claude Code loads automatically, plus the shared rules in `STANDARDS.md` that every game follows.

## The 12 games

| # | Game | In one line | Audience habit | Suggested owner |
|---|---|---|---|---|
| 1 | [Magnet Twins](games/magnet-twins/CLAUDE.md) | 2-player co-op platformer: one robot attracts, one repels | Coolmath nostalgia | Fafi |
| 2 | [Flip Runner](games/flip-runner/CLAUDE.md) | Runner where you tap to flip gravity | Coolmath nostalgia | Fafi |
| 3 | [Mirror Maze](games/mirror-maze/CLAUDE.md) | Bend a laser onto every crystal | Daily puzzle | Pao |
| 4 | [Ice Slide](games/ice-slide/CLAUDE.md) | A sliding penguin pushes fish into holes | Daily puzzle | Pao |
| 5 | [Tiny Trains](games/tiny-trains/CLAUDE.md) | Flip switches so every train gets home | Daily puzzle | Pao |
| 6 | [Echo Steps](games/echo-steps/CLAUDE.md) | Your past attempts help solve each room | Play at the desk | Fafi |
| 7 | [Bridge Budget](games/bridge-budget/CLAUDE.md) | Build a bridge, then a truck tests it | Play at the desk | Fafi |
| 8 | [Pipe Pressure](games/pipe-pressure/CLAUDE.md) | Route the water before it overflows | Daily puzzle | Pao |
| 9 | [Ink Path](games/ink-path/CLAUDE.md) | Draw one line to guide the ball | Play at the desk | Fafi |
| 10 | [Orbit Hop](games/orbit-hop/CLAUDE.md) | Slingshot between planets | Play at the desk | Pao |
| 11 | [Gear Works](games/gear-works/CLAUDE.md) | Connect gears to turn the last one right | Play at the desk | Pao |
| 12 | [Shadow Shapes](games/shadow-shapes/CLAUDE.md) | Rotate objects to match a shadow | Play at the desk | Fafi |

Suggested split: Pao takes the grid and logic puzzles (shared tech: tile grids, level editor, daily puzzle); Fafi takes physics, 2-player and 3D-ish games. Change it freely.

## Art families

Three shared looks, so games reuse parts and the catalog feels coherent:

- **Toybox Flat** — bright flat shapes, thick dark outlines, soft drop shadows, warm light background. Puzzles: Mirror Maze, Tiny Trains, Pipe Pressure, Gear Works, Bridge Budget, Ink Path.
- **Chunky Cartoon** — round characters with big eyes, saturated colors, squash-and-stretch. Character games: Magnet Twins, Flip Runner, Ice Slide.
- **Night Neon** — dark navy backgrounds, glowing outlines, a few vivid accents. Mood games: Echo Steps, Orbit Hop, Shadow Shapes.

## How to work on a game with Claude Code

1. Copy the whole `coolmath-pilot` folder into your repo (keep `STANDARDS.md` two levels above each game).
2. `cd games/<game>` and run `claude`. It reads that game's `CLAUDE.md`, which pulls in `STANDARDS.md`.
3. Paste the "First prompt" at the end of the brief. Claude proposes a plan, then builds a playable first level.
4. Iterate in short loops: play it, tell Claude what feels wrong, repeat. Keep notes in `DEVLOG.md` in the game folder.
5. Before calling a game done, run through the checklist in `STANDARDS.md`.

Anything marked **[confirm]** is still open and gets decided with the team.

## Dashboard

`index.html` at the repo root is a progress dashboard for the 12 games: phase, owner, last commit, latest `DEVLOG.md` entry, and a **Play** button that opens the game exactly as it is on `main`.

- **Online:** GitHub Pages, rebuilt by `.github/workflows/dashboard.yml` on every push to `main`. One-time setup: repo **Settings → Pages → Source: GitHub Actions**.
- **Local:** `node scripts/build-status.mjs && python3 -m http.server 8000`, then open http://localhost:8000.
- **A game becomes playable** as soon as `games/<slug>/index.html` exists.
- **Phase and owner** are edited by hand in `games.json` (`brief → plan → slice → content → polish → done`). Last commit, commit count and devlog come from git automatically.
- Write `DEVLOG.md` entries as `## <date> — <title>` with the newest entry at the top; the dashboard shows the latest one.
