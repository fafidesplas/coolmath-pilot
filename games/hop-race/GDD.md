# Hop Race — Game design document

**Status:** Draft
**Owner:** Pao · **Reviewed by:** — · **Last updated:** 2026-10-21

> One button, four meanings: hold and release to hop, blast, swing or pour your way to the flag, alone against your ghost or against a friend on the same keyboard.

## 1. Summary
- **Pillars**
  1. **One button, instantly understood.** Every action in every mode is hold, press or release of a single input. Nothing else to learn.
  2. **Short and snappy.** A level is 8–20 s, a restart under a second, a rematch one press away.
  3. **Same button, new meaning.** Each mode reinterprets the button so the fourth world feels as fresh as the first.
- **Player:** Coolmath regulars on a school Chromebook or home laptop, mostly alone (solo is the main path), sometimes two friends sharing one keyboard or one tablet.
- **Session:** one level 8–20 s solo; a versus match (first to 3) about 1–2 min; a typical visit 10–15 min.
- **Hook:** beating your own ghost by a few tenths, chasing the 3rd star, and "one more round" against a friend.

## 2. Core loop
- **Moment (seconds):** hold to charge or aim → release (or press) to act → land, cling, swing or settle → read the next obstacle.
- **Level (minutes):** pick a level → race your ghost to the flag → see time and stars → Retry for a better time or Next.
- **Meta (days):** fill in stars across 4 worlds × 10 levels; bring a friend for Versus on any level.

## 3. Mechanics
Units: positions and speeds are in world units (u). Each level is a 16:9 box from 24 × 13.5 u to 30 × 16.9 u, and the camera always shows the whole level (3.6). At 1280×720 that makes 1 u ≈ 43–53 px, so the 0.8 u player square is 34–43 px on screen (the prototype's 42 u wide view drew it at 24 px). The engine updates at a fixed 60 Hz. Gravity is 42 u/s² unless a mode says otherwise.

Numbers below are the prototype's values in `game.js` and are the starting point for tuning. The prototype's levels were 42 u wide; in smaller levels a full-power hop (about 15 u at 45°) and the rocket blast cover a lot of the screen, so expect jump speed and blast strength to come down about 20 % in the slice so each level holds 3–5 obstacles.

### 3.1 Shared rules (all modes)
- **Start:** players start grounded at the level's `start` point. In Versus both start at the same x, side by side 1.0 u apart, and swap sides every round.
- **Falling:** dropping below the kill line (1 u under the level's bottom edge) sends you back to the level's start with zero speed. The timer keeps running; nothing else is lost. In Versus the other player keeps racing. There are no checkpoints: levels are short enough that a restart from the start is fair.
- **Finish (Hop, Rocket, Grapple):** touch the flag's trigger box, 1.5 u wide × 3 u tall around the pole. Grounding is not needed. Sand has its own rule (3.5). Solo: the timer stops. Versus: the first player to finish wins the round.
- **Timer (solo):** starts at your first input, not when the level appears, so reading the level is free. Shown as seconds with one decimal; stored in ms.
- **Players in Versus** pass through each other in Hop and Sand. In Rocket, blasts push both players. In Grapple, a hook only sticks to level geometry.

### 3.2 Hop (merges the prototype's Classic and Wall Jump)
- **Hold** (only while grounded or clinging): power charges from 0 to full in 1.1 s; the aim angle sweeps between 18° and 80° at 2.6 rad/s (a full up-down cycle ≈ 2.4 s). A dotted arc and an arrow preview the jump.
- **Release:** jump at 9 u/s (no charge) up to 25 u/s (full charge) along the aim angle, in the facing direction.
- **You only move by jumping.** Landing stops you dead (no sliding), except on ice. On the ground you face right. Hop stays precise on purpose: you land where you aimed.
- **Plain walls bounce:** hitting one mid-air reverses your horizontal speed at 35 %.
- **Ice floor** (from level 5): landing on ice with more than 2 u/s of horizontal speed keeps 80 % of it, and you slide with a friction of 0.8/s. You can charge and jump while sliding; the jump replaces your slide speed. Sliding off an edge drops you. A steep, soft landing barely slides.
- **Grip walls** (from level 7): hitting one mid-air makes you cling. You stop, turn to face away, and slide down at up to 3 u/s. Charge and jump off as normal. If the wall ends below you, you let go and fall.
- **Ceilings** stop upward motion; you keep your sideways speed.

### 3.3 Rocket
- A launcher spins around you all the time at 3 rad/s. Each shot reverses the spin direction.
- **Press** to fire (cooldown 0.1 s). The rocket flies at 38 u/s and explodes on any solid. Firing gives you a small recoil of 4 u/s backwards.
- **Blast:** radius 4 u, pushes every player inside away from its center at up to 30 u/s (falling off with distance). Top speed 27 u/s. Ground friction 7/s. You keep your momentum through the air and slide to a stop on the ground.
- **Buttons and gates** (from level 3): a blast within 2.5 u of a button presses it; its gate slides up into the ceiling and stays open.
- **Ice floor** (from level 4): ground friction drops to 0.6/s, so a blast sends you gliding.
- **Sticky floor** (from level 7): landing on it stops you dead, and while you stand on it blasts push you at only 50 %. Get off it by blasting twice, or avoid landing on it.

### 3.4 Grapple
- Same spinning launcher (3 rad/s); it freezes while the hook is out.
- **Press** to fire the hook (55 u/s, no range limit). It sticks to the first solid it touches, except no-grip surfaces (from level 6), which it bounces off. A hook that leaves the level is lost (0.3 s cooldown).
- **Hold** to reel in: you accelerate toward the anchor at 95 u/s² up to 26 u/s along the rope; any speed you already had is kept. Sideways speed is damped (1.2/s) so you don't orbit. Within 1.1 u of the anchor you hang there.
- **Release** cuts the rope. You keep your speed (top speed 32 u/s). This is the skill: let go at the right moment to fly.

### 3.5 Sand (merges the prototype's Flow and Flow 2)
- You are a square of 7 × 7 = 49 sand grains on tilted slabs. A solid square sticks to slopes under about 42°.
- **Hold:** crumble into grains that pour downhill (grain gravity 30 u/s², they slide on slabs and heap on each other).
- **Release:** grains pull toward their center and pack back into a square once 85 % have gathered (or after 2.5 s with whatever has gathered). The square shrinks as you lose grains.
- **Losing grains:** grains that fall off are gone. Under 12 grains, you go back to the level's start with all 49.
- **Fire pit** (from level 6): sand that falls in turns to gas. Gas rises (20 u/s² up) and slides along ceilings almost without friction. **Press** while gas: condense and fall as sand. **Let go** of the button while gas: condense through liquid back into a solid square over 1.5 s. Gas that floats out of the top of the level sends you back to the start.
- **Finish:** at least 40 grains touching the flag (a whole square touching it counts all its grains). Arriving with fewer than 40 sends you back to the start, so care beats speed.

### 3.6 Camera and screen
- **Fixed camera:** the camera frames the whole level box plus a 0.5 u margin and never moves or zooms during play. The only camera motion is screen shake. Players always see the flag and every obstacle.
- **Any landscape size:** the level box is fitted to the window at any aspect ratio from 4:3 to 21:9. Space outside the box shows the level's background (solids that touch the box edge are drawn on to the screen edge), never black bars.
- **Portrait:** when the window is taller than it is wide, the game pauses behind a "Rotate your device" screen with a rotating phone icon.

## 4. Controls
| Action | Mouse / touch | Keyboard |
|---|---|---|
| The button (solo) | Click or tap anywhere in the play area | Space, A or L |
| The button (Versus) | Touch: P1 = left half, P2 = right half | P1 `A`, P2 `L` |
| Pause | Pause button (top right, 56 px) | P or Esc |
| Restart level (solo) / restart round without a point (Versus) | Restart button (top right, 56 px) | R |
| Menu navigation | Click / tap | Arrows + Enter or Space |
| Continue after a win | Click / tap a button | Space, Enter, A or L |

The mode screen says that Versus needs a keyboard or a touch screen.

## 5. Game elements
| Element | Behavior | First appears | Shape/icon (not color alone) |
|---|---|---|---|
| Player 1 | The racer, controlled by A / left half | Hop 1 | Square, letter **A** on the body, round eye |
| Player 2 | The racer, controlled by L / right half | Versus | Square, letter **L** on the body, bar eye |
| Ghost | Your best run on this level, replayed; no collision | Solo, after first finish | Hollow outline square, no eye, 40 % alpha |
| Platform | Solid; you stand on its top | Hop 1 | Flat block, thick dark outline, soft drop shadow |
| Flag | The goal; touch its trigger box | Hop 1 | Pole with a pennant and checker line |
| Plain wall | Solid; bounces you back in Hop | Hop 4 | Flat block, smooth sides |
| Icy floor | You slide after landing (Hop); low friction (Rocket) | Hop 5, Rocket 4 | Pale block with white diagonal shine streaks |
| Hanging wall / ceiling | Blocks upward motion; duck under it | Hop 6 | Block hanging from the top |
| Grip wall | You cling to it and slide down (Hop) | Hop 7 | Block with a dark zigzag stripe on its sides |
| Rocket button | A blast near it opens its gate | Rocket 3 | Round target icon; turns to a check mark when pressed |
| Gate | Solid until its button is pressed, then slides up | Rocket 3 | Block with vertical bars, linked to its button by a dotted line |
| Pit | No floor; falling in sends you back to the start | Hop 1 (gaps), Rocket 6 | Gap in the floor |
| Sticky floor | Stops you dead; blasts push you at 50 % (Rocket) | Rocket 7 | Dark goo drips hanging along the top edge; player squashes flat on it |
| Hook anchor surface | Any solid; hanging pillars are the usual target | Grapple 1 | Pillars hang from the ceiling |
| No-grip surface | The hook bounces off; it does not stick | Grapple 6 | Block with diagonal hatching |
| Slab | Tilted platform in Sand | Sand 1 | Thin tilted bar with a dark outline |
| Fire pit | Turns sand into gas | Sand 6 | Flickering flame triangles |
| Hanging flag | Flag on the underside of a ceiling slab | Sand 7 | Upside-down pole and pennant |

## 6. Level design
- **Structure:** 4 worlds of 10 levels, one per mode, 40 levels in v1. Every level is a single 16:9 screen (24–30 u wide), holds 3–5 obstacles, and takes 8–20 s solo for a first clean run.
  - **World 1 — Hop:** charge and aim, gaps, walls, ice, ducking, then grip walls.
  - **World 2 — Rocket:** blast yourself around, buttons and gates, ice, pits, then sticky floors.
  - **World 3 — Grapple:** swing between hanging pillars, release timing, then no-grip surfaces.
  - **World 4 — Sand:** pour down slopes without losing grains, then fire and gas to reach hanging flags.
- **Teaching order:** each world's level 1 is a safe tutorial for the button's new meaning, with one short in-world prompt that fades after the first successful action. New elements enter alone in a safe level, then get a twist (tighter, higher or timed), then combine with older elements.
- **Difficulty curve:** harder means narrower landings, wider gaps, less forgiving aim windows, and more obstacles between start and flag (so a fall back to the start costs more). Levels 1–3 of each world are easy, 4–7 introduce and twist the world's new elements, 8–10 combine. Each world's level 1 is easier than the previous world's level 10, because the button means something new.
- **Stars (solo only):**
  - 1★: finish the level.
  - 2★: finish under the **par** time.
  - 3★: finish under the **expert** time.
  - Par and expert are set per level in the content phase: expert ≈ the designer's best clean run × 1.1, par ≈ × 1.6. Falling only costs time.
- **First 10 levels (World 1 — Hop):**
  1. **First Hop:** flat ground, one 3 u gap, flag on the far side. Prompt: "Hold… release!"
  2. **Stepping Stones:** three gaps getting wider (3, 4, 5 u) between low platforms.
  3. **Up We Go:** a staircase of three rising platforms, the last one floating over a pit; needs steeper aims.
  4. **The Wall:** a 4 u wall in the middle; jump too flat and it bounces you back.
  5. **Thin Ice:** land on a long ice floor and slide to the flag; a wall at the end stops you safely. Steep landings slide less.
  6. **Low Ceiling:** a hanging wall over a gap forces a low, flat jump under it.
  7. **Grip:** a short shaft between two grip walls (3 u apart, 5 u tall) to an upper ledge; zigzag up.
  8. **Which Wall?:** a plain wall and a grip wall side by side; one bounces, one clings.
  9. **Slide and Climb:** an ice ledge that ends at a pit, then a grip shaft up to the flag.
  10. **The Gauntlet:** a gap, an ice landing, a low ceiling and a grip shaft in one run.
- **Other worlds (outline; full level lists in phase 3):**
  - **Rocket:** 1 flat floor, blast yourself forward · 2 hop a ledge with a downward blast · 3 first button and gate · 4 first ice floor, blasts send you gliding · 5 a button reached by a bank shot · 6 first pits · 7 first sticky floor · 8–10 combinations (the prototype's level, cut down to fit, ≈ 8).
  - **Grapple:** 1 one pillar over a short pit · 2 two pillars · 3 release timing for distance · 4–5 rising pillars and floating platforms · 6 first no-grip surfaces · 7–10 combinations (prototype level, cut down, ≈ 5).
  - **Sand:** 1 one gentle slope to the flag · 2 a switchback · 3 edges where grains spill · 4–5 longer runs with drops · 6 first fire pit · 7 first hanging flag (prototype Flow 2, cut down, ≈ 7) · 8–10 combinations.
- **Level data format:** one JS file per world in `levels/` (e.g. `levels/hop.js`) that adds to a global, because the game must run from `file://` where `fetch` of JSON and ES modules are blocked. Coordinates are centered on the level box: a `size: 24` level spans x −12…12 and y −6.75…6.75.
  ```js
  HR_LEVELS.hop = [
    {
      id: 'hop-01', name: 'First Hop',
      size: 24,                            // level box width in u (24–30); height = size × 9/16
      start: {x: -10, y: -4},              // ground point under the players
      solids: [                            // l, r, top, optional bottom (default: below the kill line)
        {l: -13, r: -1.5, top: -4},
        {l: 1.5, r: 13, top: -4},
        // optional flags: grip, ice (Hop); ice, sticky (Rocket); nogrip (Grapple)
      ],
      slabs: [],                           // Sand only: [x0, y0, x1, y1] top surface ends
      gates: [],                           // Rocket only: {solid: {l, r, top, bottom}, button: {x, y}}
      fire: null,                          // Sand only: {x0, x1, y}
      flag: {x: 10, y: -4},                // pole foot; {x, y, hang: true, dir: -1} for a hanging flag
      prompt: 'Hold… release!',            // optional tutorial text
      par: 8.0, expert: 5.0,               // seconds
    },
  ];
  ```

## 7. Progression and retention
- **Unlocks:** every world and every level is open from the start. All unlock checks go through one function, `isUnlocked(world, level)`, driven by a single setting `UNLOCK_RULE = 'all'` (with `'linear'` and `'stars'` ready to switch on later), so gating can be added without touching screens.
- **Stars and best times** are saved per level and shown on the level select. Each world shows its star total (out of 30).
- **Ghost:** your best run on each level replays as a hollow outline. It updates whenever you beat your time. A settings toggle hides it.
- **Versus:** a win counter per match (first to 3). Nothing saved for Versus.
- **No daily challenge.**

## 8. Screens and UI flow
```
Title ──Play──▶ Mode select ──▶ Level select ──▶ Playing ──▶ Level complete ──Next/Retry/Menu
  │               (Solo | Versus tabs,                │ ▲
  │                4 world cards)                     ▼ │
  └─Settings                                       Pause
Versus: Mode select (Versus tab) ──▶ Level select ──▶ Race ──▶ Round result ──▶ … ──▶ Match result (Rematch / Levels / Menu)
Any screen, portrait window ──▶ "Rotate your device" (game paused)
```
- **Title:** logo with an idle hopping square, big **Play** button, Settings (sound on/off, music on/off, show ghost on/off). One click from Title to playing: Play opens the mode select with the next unfinished Hop level highlighted, and the first click on a level starts it.
- **Mode select:** Solo / Versus toggle at the top. Four world cards, each with an animated mini schematic of its button meaning, name and star total.
- **Level select:** 10 tiles per world in 2 rows of 5, each with number, stars and best time; the next level without 3★ is highlighted. Versus uses the same grid without stars.
- **Playing HUD (solo):** timer top center, ghost's best time under it, pause and restart buttons top right. The mode's button hint (e.g. "Hold: charge · Release: hop") shows for the first 3 s and in the pause menu. The HUD sits in the margin above the level where the screen allows, and never covers the flag.
- **Playing HUD (Versus):** P1 panel top left, P2 panel top right, each with key letter, color and three score pips. A 3-2-1-GO countdown before each round; input is ignored until GO.
- **Pause:** Resume, Restart, Levels, Settings. The game pauses itself when the tab is hidden.
- **Level complete:** time counts up, then stars pop in one by one, "New best!" if it is one, Next / Retry / Menu. Next is the default action (Space/Enter).
- **Round result (Versus):** winner banner with letter and color, pip fills, auto-continues after 1.5 s or on any key. **Match result:** big winner, Rematch (swaps start sides) / Levels / Menu.
- **Rotate screen:** a phone icon turning sideways and "Rotate your device". The game resumes where it was when the window is landscape again.

## 9. Art direction
- **Family:** Toybox Flat (changed from the prototype's Night Neon look; the brief is updated to match).
- **Palette:**
  | Hex | Role |
  |---|---|
  | `#FFF3DC` | Background (warm cream) |
  | `#2B2A3A` | Outlines, eyes, letters, text, sticky goo, grip zigzags |
  | `#5CC8B4` | Platforms, slabs, walls (ice is this tint lightened, with white shine streaks) |
  | `#3D8BF2` | Player 1 |
  | `#FF8A3D` | Player 2, fire |
  | `#FFD23F` | Flag, stars, buttons, rockets, UI highlights |
  White is used for highlights, ice shine, the players' inner squares and UI panels.
- **Key visuals:** bright flat shapes with thick dark outlines (0.08 u) and soft drop shadows offset down-right. The background is the cream color with a few flat paper-cut hills and clouds, pre-rendered once to an offscreen canvas. Players are flat squares with a white inner square, eye and key letter, a faint trail and squash and stretch. Dotted aim arcs and chunky power bars. Sand drawn as small outlined circles. Everything drawn in code; no image files. Rocket blasts stay cartoon puffs and rings, never weapon-like.
- **Juice list:** squash on charge and land, stretch on launch; dust puffs on landing; ice sparkle while sliding; goo splat on sticky floors; trail while airborne; charge ticks with rising pitch; blast ring and short screen shake for rockets; small shake when a hook sticks; grain spray on crumble; flame flicker and gas shimmer; flag confetti and a 0.2 s slow-mo on finish; star pop with sparkles; count-up time; eased slide-in for every panel; button press bounce.
- **Concept art prompts:** *"Toybox-flat one-button racing game, warm cream background with flat paper-cut hills and clouds, teal toy-block platforms with thick dark outlines and soft drop shadows, two chunky square characters (blue with letter A, orange with letter L) mid-hop with dotted arc trails, yellow pennant flag, bright flat vector, 16:9."* Per world: add "spinning toy rocket launcher, cartoon blast puffs, pale icy floor with shine streaks, dark goo floor" (Rocket), "grappling hook rope to pillars hanging from the ceiling" (Grapple), "square crumbling into a stream of sand on tilted slabs, small fire pit with rising gas" (Sand).

## 10. Audio
| Sound | When | Character |
|---|---|---|
| Charge tick | While holding, rising pitch with power | Soft blip |
| Jump | Hop release | Upward slide |
| Land | Landing or clinging | Low thump |
| Ice slide | Sliding on ice | Light scrape loop, fades with speed |
| Goo | Landing on a sticky floor | Wet squelch |
| Fall | Below the kill line | Downward slide |
| Rocket fire / hook fire | Press in Rocket / Grapple | Short noisy whoosh |
| Explosion | Rocket blast | Noisy pop with shake |
| Hook stick | Hook hits a solid | Short click |
| Crumble / pack | Sand hold / square re-forms | Soft hiss / click |
| Ignite / condense | Sand enters fire / gas condenses | Whoomph / falling tone |
| Countdown | 3-2-1-GO in Versus | Two low beeps, one high |
| Finish | Reaching the flag | Win jingle (existing) |
| Star | Each star popping in | Rising chime per star |
| New best | Beating your best time | Short fanfare |
| UI click | Any button | Tiny click |

All synthesized with ZzFX through `SoundGenerator`. Sound on by default, toggle persists. **Music:** none in v1; the music toggle exists (off) for later.

## 11. GameAnalytics
Worlds map to ids: Hop `world01`, Rocket `world02`, Grapple `world03`, Sand `world04`. Levels `level01`–`level10`.

| Event id | When it fires | Value |
|---|---|---|
| Progression `Start:world0N:level0M` | Solo level starts (first input) | — |
| Progression `Complete:world0N:level0M` | Solo level finished | Time in ms (score); stars as a design event below |
| Progression `Fail:world0N:level0M` | Solo level left by restart or quit before finishing | Time played in ms |
| `level:stars:<1-3>` | With every Complete | Stars |
| `tutorial:step01` | First hold in Hop 1 | — |
| `tutorial:step02` | First jump in Hop 1 | — |
| `tutorial:step03` | First landing in Hop 1 | — |
| `tutorial:done` | Hop 1 finished | Time in ms |
| `mode:<hop\|rocket\|grapple\|sand>:<solo\|versus>` | A level or match starts | — |
| `versus:round:<p1\|p2>` | A Versus round is won | Round time in ms |
| `versus:match:<p1\|p2>` | A Versus match is won | Rounds played |
| `player:respawn:<mode>` | With each solo Complete or Fail | Falls back to the start in that attempt |
| `ui:restart` | Restart pressed | — |
| `settings:sfx:off` / `settings:music:off` | Toggle switched off | — |

**Question the data must answer:** which modes get played most, solo vs Versus, and how long a level and a Versus round take in each mode.

## 12. Tech plan
- **Engine:** LittleJS (`dist/littlejs.js`), kept as the brief's allowed exception to "no frameworks". The game runs from `index.html` with no build. `build.mjs` (vendored) optionally minifies into a release zip in phase 5, where size is measured against the limit.
- **Modules:** split `game.js` during the slice into classic scripts (not ES modules, so `file://` works), all globals prefixed `hr`/`HR_`: `src/main.js` (engine init, state machine), `src/modes/hop.js`, `rocket.js`, `grapple.js`, `sand.js`, `src/level.js` (load level data, solids, gates, flag), `src/camera.js` (fit the level box to the window, aspect handling, rotate screen), `src/input.js` (one-button abstraction over keys and Pointer Events, touch halves), `src/render.js`, `src/ui.js` (screens, HUD), `src/ghost.js`, `src/save.js`, `src/audio.js`, `src/analytics.js`. Levels in `levels/<world>.js`.
- **Simulation:** LittleJS fixed 60 Hz step, which also makes it frame-rate independent. Each mode exposes `step(player, input)` and `draw(player)`; input is a per-player `{down, pressed, released}` read once per frame, so modes never touch the keyboard directly.
- **Camera:** on level load and on every resize, set the camera position to the level center and the scale so the level box plus margin fits the window. No per-frame camera logic beyond shake.
- **Ghost:** record the player's position (and Sand's center) every 2nd frame, quantized to 0.01 u, as an Int16 array; at 20 s that is ~600 samples, under 3 KB per level as base64. Replay interpolates. No dependence on deterministic physics.
- **Save keys:** `cm_hop-race_save` = `{v: 1, levels: {"hop-01": {stars, bestMs}}, settings: {sfx, music, ghost}}`; ghosts in `cm_hop-race_ghost_<levelId>`. All reads wrapped in `try/catch`; a broken save resets to defaults. Saved after every level complete and settings change.
- **Testing hook:** `window.game` with `screen` (`'title' | 'levels' | 'playing' | 'complete'`), `level` (id), `mode`, `versus`, `score` (time or wins), and `start(levelId)`, `restart()`, `win()` (debug only, stripped from release).
- **Riskiest piece:** turning 6 hand-tuned one-level modes into 40 smaller, data-driven levels without breaking their feel, especially Sand (grain physics tuned to specific slab angles, and a flag position computed from the last slab) and the jump and blast ranges in a smaller box. Prove it in the slice: load the prototype's levels from data at their old size (`size: 42`) and confirm each plays the same, then retune ranges for 24–30 u levels and build Hop 1–3.

## 13. Scope
- **v1:** 4 worlds (Hop, Rocket, Grapple, Sand) × 10 levels; solo time trial with stars and ghost; 2-player Versus on any level; full shell (title, mode select, level select, pause, restart, complete, settings, rotate screen); mouse, keyboard and touch; any landscape aspect from 4:3 to 21:9; saving; GameAnalytics; `window.game`.
- **Vertical slice (phase 2):** Hop levels 1–3 from data, solo with timer, stars and ghost, Versus on the same levels, full shell, saving, analytics stubs logging to the console.
- **Later:** hats and cosmetics for the players, unlocked by star totals (gives stars a purpose without locking levels); 3–4 player Versus (needs a keyboard ghosting test first); CPU opponent; more modes on the one-button idea; best-of-N options for Versus; star gates if the data shows players skip around too much.
- **Cut:**
  - **Orbit:** disorienting to play; its rotating-exit idea doesn't fit the left-to-right race.
  - **Rocket Jump (pits)** as a separate mode: its pits become an element in the Rocket world.
  - **Separate Wall Jump and Flow 2 modes:** merged into Hop and Sand as elements, which gives those worlds a second half.
  - **Daily challenge:** not part of this game.
  - **Checkpoints:** levels are small enough that falling back to the start is fair.
  - **Dynamic camera zoom and scrolling levels:** every level fits the screen, so the camera stays fixed and players are drawn bigger.
  - **Portrait play:** the level box is 16:9; a portrait phone would shrink it to a third. Portrait shows the rotate screen.
  - **Momentum in Hop landings:** Hop stays precise (land where you aim); momentum lives in Rocket, Grapple, Sand and on ice.
  - **Sand grain-count debug text:** removed (`RC_SAND.debug` off).

## 14. Open questions
| Question | Recommendation | Who decides | Status |
|---|---|---|---|
| 3–4 players on one keyboard? | Not in v1: many keyboards can't register 3–4 held keys at once, and touch quarters are too small. Revisit with a ghosting test. | Pao | Later |
| Mouse in Versus: let a mouse click count as P1 so a mouse + L pair works? | Yes, cheap and removes the "keyboard only" caveat. | Pao | Open |
| Par/expert times: set by hand or by a replay bot? | By hand from designer runs (expert ×1.1, par ×1.6), checked by a teammate in phase 3. | Pao | Open |
| Jump and blast ranges in 24–30 u levels | Lower Hop's top jump speed and the rocket blast about 20 % in the slice; keep the aim sweep and charge time. | Pao | Open |
| P2 orange vs fire orange in Sand | Fire uses flicker and a flame shape so it never reads as a player; recheck in the slice. | Pao | Open |
| Sand finish needs 40 of 49 grains: too strict for kids? | Keep 40; if playtests show frustration, drop to 35. | Pao | Open |
| Coolmath SDK, ad breaks (between levels only), size limit, GA keys | Follow `STANDARDS.md` once the shared [confirm]s are answered. | Team | Open |

## 15. Changelog
- 2026-10-21 — Owner review: art family changed to Toybox Flat (new palette, visuals and prompts). Levels shrink to one 24–30 u screen with a fixed camera that always shows the whole level, so players are drawn bigger; landscape only from 4:3 to 21:9, with a rotate screen in portrait. Falling sends you back to the level's start, no checkpoints. One finish rule for Hop, Rocket and Grapple: touch the flag's trigger box. New elements: ice (Hop 5, Rocket 4) and sticky floor (Rocket 7). Hop stays precise (no landing momentum). Hats and cosmetics added to Later.
- 2026-10-21 — First draft from the brief and the phase 1a answers: 4 modes as worlds of 10, solo time trial with ghost as the main path, Versus on any level, all levels unlocked behind one switchable rule, no daily, LittleJS kept.
