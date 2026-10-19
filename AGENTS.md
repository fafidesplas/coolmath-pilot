# Working in this repo

Rules for AI coding agents (Claude Code and others) and for the people driving them. Two people build games here in parallel, each on their own games, straight on `main`. These rules keep that conflict-free.

## Repo map

```
AGENTS.md            these rules (CLAUDE.md at the root just imports this file)
README.md            the 12 games, art families, getting started
STANDARDS.md         shared rules every game follows (tech, input, shell, saving, analytics, done checklist)
PHASES.md            the production phases with ready-to-paste prompts and exit gates
templates/GDD.md     game design document template
index.html           progress dashboard (published to GitHub Pages)
scripts/             dashboard data generator (status.json, generated, never committed)
.github/workflows/   builds and deploys the dashboard on every push to main
games/<slug>/        one folder per game, owned by one person
```

Each game folder holds: `CLAUDE.md` (brief), `meta.json` (owner and stage), `mechanic.svg` (animated schematic), and, as work progresses, `GDD.md`, `DEVLOG.md`, `index.html`, `src/`, `levels/`, `assets/`.

## Ownership: stay in your game folder

- Work only inside the folder of the game you were asked to work on (`games/<slug>/`). Never edit another game's folder.
- Each game's owner is in its `meta.json`. If you're not the owner, ask before touching it.
- Everything outside `games/` is shared (`STANDARDS.md`, `PHASES.md`, `templates/`, `index.html`, `scripts/`, `.github/`, `README.md`, `AGENTS.md`). Don't change shared files as a side effect of game work. If a game needs a shared change, propose it, and make it in its own commit with a message that says why.
- Code reuse between games is welcome, but by copying into your own folder, not by importing from another game's folder. Shared code moves to a shared location only after the team agrees.

## Git workflow

- Before starting: `git pull --rebase`.
- Commit small and often, one step at a time. Message starts with the game name: `Mirror Maze: beam bounces off walls`. Shared changes start with what they touch: `Dashboard: …`, `Standards: …`.
- Push after every commit (`git pull --rebase && git push`). The dashboard republishes on every push, so the team always sees the current state.
- Never `git push --force` to `main`, never rewrite pushed history, never commit `status.json`, `.DS_Store` or secrets.
- If a pull hits a conflict in a file you don't own, stop and ask; don't resolve it by picking your version.

## How a game is built

- Follow `PHASES.md`. Phase 1 is the GDD: no game code until `GDD.md` is Approved by a teammate.
- `GDD.md` is the source of truth for the design. If the design changes while building, update it in the same commit.
- When a phase gate passes, update `stage` in the game's `meta.json` (`brief → gdd → slice → content → polish → done`). That is what the dashboard shows.
- Log each work session at the top of `DEVLOG.md` as `## <YYYY-MM-DD> — <title>` plus a few bullets: what changed, what is next. The dashboard shows the latest entry.
- A game is playable on the dashboard as soon as `games/<slug>/index.html` exists. Keep `main` playable: don't push a build that doesn't load.

## Language

Everything in the repo is in English: game text, UI, code, comments, docs, commit messages. The chat with the agent can be in any language.
