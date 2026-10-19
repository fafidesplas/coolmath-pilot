# Shared standards — every Coolmath pilot game

These rules apply to every game. The game's own `CLAUDE.md` adds the design; where the two disagree, ask before deviating.

## Audience and content

- Coolmath's players run from school kids to young adults; its biggest age group is 18–24. Design for "quick to learn, hard to put down", playable in a small browser tab with the sound off.
- Kid-safe: no violence beyond cartoon bumps, no gore, no gambling or loot boxes, no chat, no links out, no personal data.
- All in-game text in English, short, readable at a glance. Teach by playing, not by reading: the first level is the tutorial.
- Never use color alone to carry meaning (shape or icon too), so color-blind players can play.

## Tech

- Static HTML5: `index.html` + JavaScript (ES modules are fine) + optional `style.css`. No build step, no frameworks unless the brief says so. Canvas 2D by default; Three.js only if the brief asks for 3D (bundle it locally).
- Self-contained: no requests to other servers except GameAnalytics and the Coolmath SDK. No CDNs, no web fonts from Google; use a system font stack or an embedded font file.
- Size target: [confirm Coolmath's limit]; aim for under 2 MB for 2D games. Prefer art drawn in code (shapes, gradients pre-rendered to offscreen canvases, particles) over image files.
- Performance: 60 fps on a 4 GB school Chromebook. Pool objects, no allocations in the hot loop, no full-screen gradients redrawn every frame.
- Game loop on delta time (`dt` in seconds, capped at 0.05) so it plays the same at 60 Hz and 144 Hz. Pause when the tab is hidden (`visibilitychange`).
- Canvas sized to the window with `devicePixelRatio` (capped at 2) and a resize handler. Design at 16:9 (1280×720) and letterbox; must work from 800×450 up to 1920×1080.
- Loads to the title screen in under 3 seconds; one click from title to playing.

## Input

- Mouse and trackpad first (Chromebooks). Keyboard where it helps: arrows and WASD, Space/Enter to confirm, R to restart, P to pause.
- Touch through Pointer Events (one code path for mouse and touch). Touch targets at least 48 px.
- No right-click, no hover-only actions, no double-click requirements.

## Game shell (every game)

1. **Title screen:** logo, big Play button, level select, settings (music and sound toggles).
2. **Level select:** levels grouped in worlds of 10–15, stars earned shown, next level highlighted.
3. **In game:** clear goal, pause button, restart button; restart takes under 1 second.
4. **Level complete:** 1–3 stars, best result, Next / Retry / Menu. Celebrate with motion and sound.
5. **Daily challenge** (where the brief says so): one date-seeded level per day, same for everyone, with a streak counter and a copyable emoji result line (no social APIs).

## Saving

- `localStorage`, every key prefixed `cm_<game-slug>_`. Store `{ v: 1, ... }` and wrap reads in `try/catch`: a broken save resets to defaults, never crashes.
- Save after every level complete and every settings change.

## Audio

- Small synthesized sound effects with WebAudio (click, success, fail, combo). Optional short music loop, off by default if it is large.
- Create or resume the `AudioContext` only after the first click or key press. Mute settings persist.

## Look and feel

- Use the art family named in the brief (Toybox Flat, Chunky Cartoon or Night Neon). 4–6 colors per game, chosen once.
- Juice is required: eased UI motion, squash and stretch, particles on success, a short screen shake on impact, count-up numbers on the results screen.

## GameAnalytics

Every game sends the same core events from its first playable build, so games can be compared and polished after release.

- Initialise the GameAnalytics JS SDK with the game key and secret from a config file ([confirm keys per game]). Sessions are tracked by the SDK.
- **Progression events** for every level: `Start`, `Complete`, `Fail` with `world01` / `level05` style ids. Send the score on `Complete` (stars or the game's main metric).
- **Design events** (colon-separated ids):
  - `tutorial:step01` … `tutorial:done`
  - `daily:start`, `daily:complete`, `daily:streak:<n>` (games with a daily)
  - `ui:restart`, `ui:hint`, `ui:skip` (where they exist)
  - `settings:music:off`, `settings:sfx:off`
- Each brief lists the extra events that game needs and the question its data should answer.
- Log events to the console in development so they can be checked by eye.

## Coolmath integration [confirm]

- Coolmath SDK and how it is loaded: [confirm]
- Ad breaks: where they are allowed (between levels only, never mid-level): [confirm]
- Required branding, splash or links: [confirm]
- File size limit and hosting format: [confirm]

## Testing hook

Expose `window.game` with read-only state for automated checks: `screen` (`'title' | 'levels' | 'playing' | 'complete'`), `level`, `score`, and helpers `start()`, `restart()`, `win()` (debug only, removed in release builds).

## Folder layout

```
games/<game-slug>/
  CLAUDE.md      the brief (do not delete)
  GDD.md         the game design document (phase 1, source of truth for the design)
  DEVLOG.md      short notes per work session: what changed, what is next
  index.html
  src/           game code, split by concern (game, render, input, levels, audio, ui, analytics)
  levels/        level data as JSON or JS modules (puzzle games)
  assets/        only if needed
```

## Working rhythm with Claude Code

Every game follows the phases in `PHASES.md`, with ready-to-paste prompts and an exit gate for each:

1. **GDD:** no code until `GDD.md` (from `templates/GDD.md`) is written, reviewed and marked Approved.
2. **Vertical slice:** one complete, juicy, playable level with the full shell, before adding content.
3. **Content:** levels in data files; puzzle games get a simple in-game level editor (debug only) and a solver.
4. **Polish:** feel, sound, juice, difficulty curve, then GameAnalytics checks.
5. **Release:** the done checklist below.

Play it yourself after every step. Write what changed in `DEVLOG.md`. If the design changes, update `GDD.md` in the same commit.

## Done checklist

- [ ] Plays start to finish with mouse, keyboard and touch
- [ ] 60 fps on a low-end Chromebook (or Chrome with 4× CPU throttle)
- [ ] Works at 800×450 and 1920×1080; no page scroll
- [ ] Save survives reload; a corrupted save does not crash
- [ ] Sound off by default or mutable; settings persist
- [ ] All levels solvable; difficulty rises smoothly
- [ ] GameAnalytics events arrive for start, complete, fail, tutorial and daily
- [ ] No console errors; no network calls except GameAnalytics and the Coolmath SDK
- [ ] Size within the limit
- [ ] A teammate played it cold and understood it without help
