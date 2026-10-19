# Coolmath pilot — game briefs

12 original HTML5 games for Coolmath Games, ranked. Each game has its own folder with a `CLAUDE.md` brief that Claude Code loads automatically, plus the shared rules in `STANDARDS.md` and the production phases in `PHASES.md` that every game follows.

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

## Getting started (new to the repo)

You need [git](https://git-scm.com), the [GitHub CLI](https://cli.github.com) (`gh`), [Claude Code](https://claude.com/claude-code) and a GitHub account that has accepted the invitation to this repo.

```bash
gh auth login                                  # once, with your GitHub account
gh repo clone fafidesplas/coolmath-pilot
cd coolmath-pilot
git config user.name "<Your name>"             # how you appear on the dashboard
git config user.email "<your work email>"
git config pull.rebase true                    # keeps history linear when you pull
```

Then, every work session:

```bash
git pull                                       # get your teammate's latest work
cd games/<your-game>
claude                                         # loads the brief, STANDARDS.md, PHASES.md and AGENTS.md
# ... work through the phase prompts in PHASES.md, commit as you go ...
git pull && git push                           # publish; the dashboard updates in ~2 minutes
```

Read [AGENTS.md](AGENTS.md) once: it has the house rules. The short version: **only touch your own game folder** (owners are in each game's `meta.json` and in the table above), commit small with the game name first (`Ice Slide: fish sink into holes`), push often, never force-push, everything in English. Since each person works in their own folders, pulls and pushes don't conflict.

Dashboard: https://fafidesplas.github.io/coolmath-pilot/

## How to work on a game with Claude Code

1. `cd games/<game>` and run `claude`. It reads that game's `CLAUDE.md`, which pulls in `STANDARDS.md` and `PHASES.md`.
2. **Phase 1, GDD:** paste the phase 1 prompts from `PHASES.md`. Claude asks the open questions, writes `GDD.md` from `templates/GDD.md`, and reviews it critically. No code until a teammate approves it.
3. **Phase 2, vertical slice:** Claude plans, then builds one juicy, playable level with the full shell (scope in the brief's "Vertical slice" section). Iterate on feel until it's fun.
4. **Phases 3–5:** content, polish, release, each with its own prompts and exit gate in `PHASES.md`.
5. Play after every step, keep notes in `DEVLOG.md`, and move `stage` in the game's `meta.json` when a gate passes.

Anything marked **[confirm]** is still open and gets decided with the team.

## Dashboard

`index.html` at the repo root is a progress dashboard for the 12 games: phase, owner, last commit, latest `DEVLOG.md` entry, and a **Play** button that opens the game exactly as it is on `main`.

- **Online:** GitHub Pages, rebuilt by `.github/workflows/dashboard.yml` on every push to `main`. One-time setup: repo **Settings → Pages → Source: GitHub Actions**.
- **Local:** `node scripts/build-status.mjs && python3 -m http.server 8000`, then open http://localhost:8000.
- **A game becomes playable** as soon as `games/<slug>/index.html` exists.
- **Phase and owner** are edited by hand in each game's `meta.json` (`brief → gdd → slice → content → polish → done`, see `PHASES.md`). The GDD status (Draft / In review / Approved) is read from `GDD.md`. Last commit, commit count and devlog come from git automatically.
- Write `DEVLOG.md` entries as `## <date> — <title>` with the newest entry at the top; the dashboard shows the latest one.
