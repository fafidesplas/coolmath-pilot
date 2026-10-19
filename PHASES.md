# Production phases — every Coolmath pilot game

Every game goes through the same five phases. Each phase has prompts to paste into Claude Code (run from `games/<slug>/`) and an exit gate. Don't skip a gate: when it passes, update the game's `stage` in `games.json` so the dashboard shows it.

| # | Phase | `stage` in games.json | Output | Gate |
|---|---|---|---|---|
| 0 | Brief | `brief` | `CLAUDE.md` (already written) | — |
| 1 | Game design document | `gdd` | `GDD.md`, status **Approved** | The team has read it and agrees |
| 2 | Vertical slice | `slice` | One complete, juicy level with the full shell | A teammate plays it cold and wants more |
| 3 | Content | `content` | All v1 levels, daily, editor/solver | Every level solvable, curve feels right |
| 4 | Polish | `polish` | Juice, audio, tuning, analytics verified | Nothing feels unfinished |
| 5 | Release | `done` | Release build | `STANDARDS.md` done checklist passes |

Rules for every phase:

- Paste one prompt at a time. Read what Claude proposes before saying "go".
- Play the game after every step. Log what changed and what is next in `DEVLOG.md` (newest entry on top, `## <date> — <title>`).
- If the design changes while building, update `GDD.md` in the same commit. The GDD is the source of truth, not the chat.
- Commit at the end of every step with a message that starts with the game name, e.g. `Mirror Maze: beam bounces off walls`.

---

## Phase 1 — Game design document (no code)

Goal: turn the brief into a design concrete enough that building it is mostly execution. No code in this phase.

**1a. Questions first**

```
Read CLAUDE.md and STANDARDS.md. We are writing the game design document before any code; do not write code in this phase.
Restate the game in 5 lines. Then ask me the questions that the brief leaves open or that would change the design: every item under "Risks and open questions", every [confirm], and anything else a designer would need to decide (feel, difficulty, session length, what makes a level interesting). Max 12 questions, most important first. For each one give your recommended answer and why, so I can just confirm or correct it.
```

**1b. Write the GDD**

```
Write GDD.md in this folder following ../../templates/GDD.md, using the brief and my answers. Be concrete: real numbers for speeds, sizes, timings, grid sizes and star thresholds; every game element with its rules and the level where it first appears; the world list with what each world teaches; the first 10 levels described in one line each; the screen flow; a palette of 4–6 hex colors; the full GameAnalytics event list. Anything still uncertain goes under "Open questions" with your recommendation. Set Status: Draft.
```

**1c. Critical review**

```
Review GDD.md as a demanding game designer who knows the Coolmath audience (quick to learn, hard to put down, small browser tab, sound off). What is boring, confusing, too big for v1, hard to build, or untestable? Check it against STANDARDS.md. List problems by severity with a concrete fix for each, and don't change the file yet.
```

Then: "Apply fixes 1, 2 and 4" (or whichever you accept), and repeat 1c until nothing important is left.

**Gate:** someone else on the team reads `GDD.md`. When you both agree, set `Status: Approved` in the GDD, `stage: "slice"` in `games.json`, and commit.

---

## Phase 2 — Vertical slice

Goal: one complete, juicy, playable level with the full game shell. This is where we find out if the game is fun.

**2a. Build plan**

```
Read GDD.md (approved) and the "Vertical slice" section of CLAUDE.md. Propose a build plan: file and module structure (following STANDARDS.md's folder layout), data formats, the order you will build things in, and what you will fake or leave out for now. Flag anything in the GDD that looks hard to build and how you would de-risk it first. Wait for my OK before coding.
```

**2b. Build**

```
Build the vertical slice following the plan. Include the full game shell (title, level select, pause, restart, level complete with stars), saving, settings, the window.game testing hook, and GameAnalytics stubs that log every event to the console. Stop as soon as it's playable and tell me exactly what to test.
```

**2c. Feel loop** (repeat until it's fun)

```
I played it. Notes: <what felt wrong, what was confusing, what was fun>. Fix these, add juice where it's flat, update DEVLOG.md, and update GDD.md if the design changed.
```

**Gate:** a teammate plays it cold, with no explanation, understands it and wants to keep playing. If not, go back to 2c or to the GDD. Then set `stage: "content"`.

---

## Phase 3 — Content

Goal: all v1 content from the GDD, built from data, with tools to make it fast and safe.

**3a. Tools**

```
Read the level design section of GDD.md. Build the content tools: for puzzle games, a debug-only in-game level editor that saves and loads level JSON, and a solver that checks a level is solvable and computes the star target. For skill games, a debug level-select with a quick-retry and a way to tweak tuning values live. Keep them out of release builds. Then tell me how to use them.
```

**3b. Levels, one world at a time**

```
Make world <n> following the GDD: introduce its element as the GDD says, then rise in difficulty smoothly. Run the solver on every level (puzzle games). Give me the list of levels with one line each and the star targets, then stop so I can play the world.
```

**3c. Daily challenge** (games whose brief has one)

```
Build the daily challenge from the GDD: date-seeded, same level for everyone, verified solvable, with the streak counter and the copyable emoji result line. Add a debug option to preview any date.
```

**Gate:** every world played by someone who didn't make it; no level skipped out of frustration; the difficulty curve matches the GDD. Then set `stage: "polish"`.

---

## Phase 4 — Polish

**4a. Juice and audio**

```
Do a juice and audio pass over the whole game, screen by screen: eased UI motion, squash and stretch, particles on success, screen shake on impact, count-up numbers on results, all sound effects from the GDD audio list. List what you changed.
```

**4b. Tuning**

```
Here are playtest notes: <notes>. Rebalance the difficulty and the star thresholds, and fix the spots where players got stuck or bored. Update GDD.md with the new numbers.
```

**4c. Analytics check**

```
List every GameAnalytics event this game sends, when it fires and with what value, and compare it with GDD.md and STANDARDS.md. Fix anything missing or wrong. Then tell me how to check them in the console in one play session.
```

**Gate:** the team agrees nothing feels unfinished. Move on to phase 5; `stage` stays `polish` until the release checks pass.

---

## Phase 5 — Release

```
Go through the "Done checklist" in STANDARDS.md item by item. Check everything you can automatically (use window.game, measure the build size, look for console errors and network calls), and tell me exactly how to check the rest by hand. Report pass/fail with evidence for each item, then fix the failures. Finally make sure debug tools and window.game.win() are removed from the release build.
```

**Gate:** every checklist item passes. Set `stage: "done"` in `games.json`.
