# Hop Race — Game design document

**Status:** Approved
**Owner:** Pao · **Reviewed by:** Pao (team review waived) · **Last updated:** 2026-10-22

> One button, four meanings: hold and release to hop, blast, swing or melt your way to the flag, alone against your ghost or against a friend on the same keyboard.

## 1. Summary
- **Pillars**
  1. **One button, instantly understood.** Every action in every mode is hold, press or release of a single input. Nothing else to learn.
  2. **Short and snappy.** A level is 8–20 s, a restart under a second, a rematch one press away.
  3. **Same button, new meaning.** Each mode reinterprets the button so the fourth world feels as fresh as the first.
- **Player:** Coolmath regulars on a school Chromebook or home laptop, mostly alone (solo is the main path), sometimes two friends sharing one keyboard or one tablet. **Ages:** the core is about 13–24 (teens and young adults at school or on a break, matching Coolmath's biggest group, 18–24); the floor is about 9–10, so younger kids can still finish the early levels. One button and a tutorial first level keep it open to the young end; expert times, 3 stars and the ghost give the older end a skill ceiling. **Tone:** playful but never babyish; text short and dry ("Nice." over "Yay, great job!!").
- **Session:** one level 8–20 s solo; a versus match (first to 3) about 1–2 min; a typical visit 10–15 min.
- **Hook:** beating your own ghost by a few tenths, chasing the 3rd star for the next hat, and "one more round" against a friend.

## 2. Core loop
- **Moment (seconds):** hold to charge or aim → release (or press) to act → land, cling, swing or settle → read the next obstacle.
- **Level (minutes):** pick a level → race your ghost to the flag → see time and stars → Retry for a better time or Next.
- **Meta (days):** earn stars across 4 worlds × 10 levels to unlock hats; bring a friend for Versus on any level.

## 3. Mechanics
Units: positions and speeds are in world units (u). Each level is a 16:9 box from 24 × 13.5 u to 30 × 16.9 u, and the camera always shows the whole level (3.6). At 1280×720 that makes 1 u ≈ 43–53 px, so the 0.8 u player square is 34–43 px on screen (the prototype's 42 u wide view drew it at 24 px). The engine updates at a fixed 60 Hz. Gravity is 42 u/s² unless a mode says otherwise.

Numbers below are the prototype's values in `game.js` and are the starting point for tuning. The prototype's levels were 42 u wide; in smaller levels a full-power hop (about 15 u at 45°) and the rocket blast cover a lot of the screen, so expect jump speed and blast strength to come down about 20 % in the slice so each level holds 3–5 obstacles.

### 3.1 Shared rules (all modes)
- **Start:** players start grounded at the level's `start` point. In Versus both spawn on exactly the same point; P2 is drawn behind P1, with its eye nudged so both eyes show, until they separate.
- **Level box edges:** the left and right edges of the level box act as plain walls, so a bounce can never carry a player off screen.
- **No contact between players:** players pass through each other. The one exception is Rocket, where blasts push every player in range (3.3).
- **Falling:** dropping below the kill line (1 u under the level's bottom edge) sends you back to the level's start with zero speed. The timer keeps running; nothing else is lost. In Versus the other player keeps racing. There are no checkpoints: levels are short enough that a restart from the start is fair.
- **Finish (Hop, Rocket, Grapple):** touch the flag's trigger box, which runs from the pole to the pennant tip (1.44 u wide) and from the ground to the top of the pole (3 u). Grounding is not needed. Phase has its own rule (3.5). Solo: the timer stops. Versus: the first player to finish wins the round.
- **Timer (solo):** starts at your first input, not when the level appears, so reading the level is free. Shown as seconds with one decimal; stored in ms.
- **Stuck nudge (solo):** after 8 s without getting closer to the flag (your best distance to it has not improved), in any mode, a small "R to restart" fades in near the restart button. It disappears as soon as you get closer again.

### 3.2 Hop (merges the prototype's Classic and Wall Jump)
- **Hold** (only while grounded or clinging): power charges from 0 to full in 1.1 s; the aim angle sweeps between 18° and 80° at 2.6 rad/s (a full up-down cycle ≈ 2.4 s). A dotted arc previews the jump and a power bar above the player fills.
- **Release:** jump at 9 u/s (no charge) up to 20 u/s (full charge; the prototype used 25 in its 42 u level) along the aim angle, in the facing direction.
- **You only move by jumping.** Landing stops you dead (no sliding), except on ice. On the ground you face right. Hop stays precise on purpose: you land where you aimed.
- **Plain walls bounce:** hitting one mid-air reverses your horizontal speed at 35 %.
- **Ice floor** (from level 5): landing on ice with more than 2 u/s of horizontal speed keeps 80 % of it, and you slide with a friction of 0.8/s. You can charge and jump while sliding; the jump replaces your slide speed. Sliding off an edge drops you. A steep, soft landing barely slides.
- **Grip walls** (from level 7): hitting one mid-air makes you cling. You stop, turn to face away, and slide down at up to 3 u/s. Charge and jump off as normal. If the wall ends below you, you let go and fall.
- **Ceilings** stop upward motion; you keep your sideways speed.

### 3.3 Rocket
- A launcher spins around you all the time at 3 rad/s. Each shot reverses the spin direction.
- **Press** to fire (cooldown 0.1 s). The rocket flies at 38 u/s and explodes on any solid, button or the other player; your own rocket flies through you. Firing gives you a small recoil of 4 u/s backwards. You can fire in the air too.
- **Blast:** radius 4 u, pushes **every player in range** (the one who fired it and the other one) away from its center at up to 24 u/s (falling off with distance; the prototype's 30 less 20 %). Top speed 22 u/s (was 27). Ground friction 7/s. You keep your momentum through the air and slide to a stop on the ground. Walls bounce you back at 30 %.
- **Whose blast is it:** rockets, blast rings and splash particles take their owner's color (P1 blue, P2 red), so in Versus it is always obvious whose shot is whose. Being blasted by the other player can knock you off a ledge or into a pit; watch for one player pinning the other in playtests.
- **Buttons and gates** (from level 3): a rocket that hits a button, or a blast within 2.5 u of it, presses it; its gate slides up into the ceiling and stays open. Gate levels have a thin ceiling just under the HUD, so the only way past a gate is its button. In Versus a gate opened by either player is open for both.
- **Ice floor** (from level 4): ground friction drops to 0.6/s, so a blast sends you gliding.
- **Sticky floor** (from level 7): landing on it stops you dead, and while you stand on it blasts push you at only 50 %. Get off it by blasting twice, or avoid landing on it.

### 3.4 Grapple
- Same spinning launcher (3 rad/s); it freezes while the hook is out and keeps its direction when the rope is cut (as in the prototype). Reversing the spin on each shot, as in Rocket, is behind a switch (`HR_GRAPPLE.reverseSpin`) and off while the prototype's feel is tested; see §14. A faint dotted sight line shows where the hook will go while it is ready.
- **Press** to fire the hook (55 u/s, no range limit). It sticks to the first solid it touches, except no-grip surfaces (from level 6), which it bounces off. A hook that leaves the level is lost (0.3 s cooldown).
- **Hold** to reel in: you accelerate toward the anchor at 95 u/s² up to 26 u/s along the rope; any speed you already had is kept. Sideways speed is damped (1.2/s) so you don't orbit. Within 1.1 u of the anchor you hang there.
- **Release** cuts the rope. You keep your speed (top speed 32 u/s). This is the skill: let go at the right moment to fly.
- **Walls** stop you dead (no bounce).
- **Closed top:** the top edge of the level box stops you like a ceiling, so a hard swing never flies off the screen. The hook can't stick to it; a hook that flies past it is lost.

### 3.5 Phase (solid, liquid, gas; merges the prototype's Flow and Flow 2)
You are a block of matter made of 7 × 7 = 49 drops. **Each press switches you to the next state, always in the same order: solid → liquid → gas → solid.** There is no holding in Phase.

| State | Looks like | How it moves | Press |
|---|---|---|---|
| **Solid** | A square | Falls; sticks to slopes under about 42° | Melt into liquid at once; the drops keep the square's speed |
| **Liquid** | 49 drops in your color | Pours downhill (drop gravity 30 u/s²), slides on slabs, heaps on itself | Evaporate into gas at once; the drops become rings and start to rise |
| **Gas** | Hollow rings in your color | Rises (20 u/s² up) and slides along ceilings almost without friction | Condense into a solid: the rings pull together for 0.5 s, then pack into a square that falls |

- **Liquid can't freeze directly:** to stop pouring, you press twice (liquid → gas → solid), so you rise a little before you freeze and drop. Timing that hop is the world's core skill.
- **Press timing:** presses closer than 0.15 s apart are ignored, so a double tap never skips a state by accident; presses during the 0.5 s condense are ignored too.
- **Grate** (from level 6): ink bars with gaps. A solid stands on it and is blocked by it; liquid drips through it; gas rises through it. Choosing the right state for each grate is the second half of the world.
- **Losing drops:** drops that fall off a slab are gone, and the solid square shrinks to match. Under 12 drops, or gas that floats out of the top of the level, and you go back to the start with all 49.
- **Finish:** at least 40 drops touching the flag, in any state (a whole square touching it counts all its drops; liquid drops and gas rings count one each). Arriving with fewer than 40 sends you back to the start, so care beats speed.
- **Change from the prototype:** the prototype used hold to crumble and release to pack, and gas came only from fire pits. Both are replaced by the press cycle; fire pits are gone because gas is reachable anywhere, and grates take their place.

### 3.6 Camera and screen
- **Fixed camera:** the camera frames the whole level box plus a 0.5 u margin and never moves or zooms during play. The only camera motion is screen shake. Players always see the flag and every obstacle.
- **Any landscape size:** the level box is fitted to the window at any aspect ratio from 4:3 to 21:9. Space outside the box shows the level's background (solids that touch the box edge are drawn on to the screen edge), never black bars.
- **Portrait:** when the window is taller than it is wide, the game pauses behind a "Rotate your device" screen with a rotating phone icon.

## 4. Controls
| Action | Mouse / touch | Keyboard |
|---|---|---|
| The button (solo) | Click or tap anywhere in the play area except the HUD buttons | Space, A or L |
| The button (Versus) | Touch: P1 = left half, P2 = right half (taps on the HUD buttons never count) | P1 `A`, P2 `L` |
| Pause | Pause button (top right, 56 px) | P or Esc |
| Restart level (solo) / restart round without a point (Versus) | Restart button (top right, 56 px) | R |
| Menu navigation | Click / tap | Arrows + Enter or Space |
| Continue after a win | Click / tap a button | Space, Enter, A or L |

The mode screen says that Versus needs a keyboard or a touch screen.

## 5. Game elements
| Element | Behavior | First appears | Shape/icon (not color alone) |
|---|---|---|---|
| Player 1 | The racer, controlled by A / left half | Hop 1 | Blue square, no outline, big googly eye, white letter **A** |
| Player 2 | The racer, controlled by L / right half | Versus | Red square, no outline, big googly eye, white letter **L** |
| Ghost | Your best run on this level, replayed; no collision | Solo, after first finish | Hollow outline square, no eye, 40 % alpha |
| Hat | Cosmetic, unlocked by stars | Title screen | Small ink shapes on top of the square (§7) |
| Aim dots | Preview of the jump (Hop) | Hop 1 | Small ink squares fading along the arc |
| Power bar | Charge level while holding (Hop) | Hop 1 | Thin ink outline above the player, filling with ink |
| Platform | Solid; you stand on its top | Hop 1 | Solid dark block |
| Flag | The goal; touch its trigger box | Hop 1 | Dark pole with a waving checkered flag (6 × 4 ink and white cells, F1-style) |
| Plain wall | Solid; bounces you back in Hop | Hop 4 | Solid dark block, straight sides |
| Icy floor | You slide after landing (Hop); low friction (Rocket) | Hop 5, Rocket 4 | Dark block with a white hatched stripe along its top |
| Hanging wall / ceiling | Blocks upward motion; duck under it | Hop 6 | Block hanging from the top |
| Grip wall | You cling to it and slide down (Hop) | Hop 7 | Dark block with a sawtooth face |
| Launcher | Spins around you; aims rockets and the hook | Rocket 1, Grapple 1 | Short ink barrel circling the player |
| Rocket and blast | Pushes every player in range; explodes on the other player | Rocket 1 | Small capsule, ring and splash particles in the owner's color |
| Rocket button | A blast near it opens its gate | Rocket 3 | White target on a dark mount; becomes a white check mark when pressed |
| Gate | Solid until its button is pressed, then slides up | Rocket 3 | Barred block (dark bars, background between), linked to its button by a dotted line |
| Pit | No floor; falling in sends you back to the start | Hop 1 (gaps), Rocket 6 | Gap in the floor |
| Sticky floor | Stops you dead; blasts push you at 50 % (Rocket) | Rocket 7 | Dark block with a bumpy, rounded top edge; player squashes flat on it |
| Hook and rope | Sticks to solids; reel in while held | Grapple 1 | Ink rope line with a small white hook tip |
| Hook anchor surface | Any solid; hanging pillars are the usual target | Grapple 1 | Pillars hang from the ceiling |
| No-grip surface | The hook bounces off; it does not stick | Grapple 6 | Hollow block (dark outline, background inside) |
| Slab | Tilted platform in Phase | Phase 1 | Thin tilted dark bar |
| Grate | Solid stands on it; liquid drips through; gas rises through | Phase 6 | Thin ink bars with even gaps, no dotted link (unlike a gate) |
| Hanging flag | Flag on the underside of a ceiling slab | Phase 7 | Upside-down pole and checkered flag |

## 6. Level design
- **Structure:** 4 worlds of 10 levels, one per mode, 40 levels in v1. Every level is a single 16:9 screen (24–30 u wide), holds 3–5 obstacles, and takes 8–20 s solo for a first clean run.
  - **World 1 — Hop:** charge and aim, gaps, walls, ice, ducking, then grip walls.
  - **World 2 — Rocket:** blast yourself around, buttons and gates, ice, pits, then sticky floors.
  - **World 3 — Grapple:** swing between hanging pillars, release timing, then no-grip surfaces.
  - **World 4 — Phase:** melt and pour down slopes without losing drops, evaporate to rise, freeze to land, then grates and hanging flags.
- **Teaching order:** each world's level 1 is a safe tutorial for the button's new meaning, with one short in-world prompt that fades after the first successful action. The prompts: Hop "Hold A then release to Jump!", Rocket "Press to blast.", Grapple "Hold to reel in. Let go to fly.", Phase "Press to melt." Level 1 shows only the prompt; from level 2 on, the button hint shows instead (§8). New elements enter alone in a safe level, then get a twist (tighter, higher or timed), then combine with older elements.
- **No dead ends:** in Hop you can only jump right except off grip walls, so every spot a player can stand on must lead to the flag or to a pit. In Phase, no slab or ceiling pocket may trap liquid or gas with no way out. The phase 3 level tool checks both (simulated jumps from every standable spot in Hop, pocket detection in Phase); the stuck nudge (3.1) is the safety net.
- **Difficulty curve:** harder means narrower landings, wider gaps, less forgiving aim windows, and more obstacles between start and flag (so a fall back to the start costs more). Levels 1–3 of each world are easy, 4–7 introduce and twist the world's new elements, 8–10 combine. Each world's level 1 is easier than the previous world's level 10, because the button means something new.
- **Stars (solo only):**
  - 1★: finish the level.
  - 2★: finish under the **par** time.
  - 3★: finish under the **expert** time.
  - Par and expert are set per level in the content phase: expert ≈ the designer's best clean run × 1.1, par ≈ × 1.6. Falling only costs time.
- **First 10 levels (World 1 — Hop):**
  1. **First Hop:** flat ground, one 3 u gap, flag on the far side. Prompt: "Hold A then release to Jump!"
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
  - **Rocket (built; 4–10 are drafts, hidden until 1–3 are played and the mode is tuned):** 1 **Blast Off**: flat floor with two low bumps; prompt "Press to blast." · 2 **Step Up**: two 2.5 u ledges, blast down to climb · 3 **Knock Knock**: first button and gate, then a short pit · 4 **Glide**: first ice floor with a bump, ending at a pit before a raised landing · 5 **Around the Corner**: the button hides behind the gate under a low ceiling; hit the wall next to it so the blast reaches it · 6 **Mind the Gap**: three narrow islands over pits · 7 **Sticky Situation**: a long sticky floor before a 2.5 u step, then a sticky trough · 8 **Gatehouse**: ice start, button and gate, two landings over pits (the prototype's level, cut down) · 9 **Goo Hop**: two sticky islands over pits, then rising pillars · 10 **The Works**: ice, a hidden button, a sticky floor under a low ceiling, two pits.
  - **Grapple (1–3 built; 4–10 still an outline):** 1 **Swing By**: one pillar over a 3 u pit's far edge; prompt "Hold to reel in. Let go to fly." (placed under the pillar) · 2 **Two Pillars**: a 14 u pit, swing from one pillar to the next · 3 **Let Go**: one pillar, an 8 u pit; the later you let go, the farther you fly · 4–5 rising pillars and floating platforms · 6 first no-grip surfaces · 7–10 combinations (prototype level, cut down, ≈ 5). Pillars hang from the top of the level box and stay out of the HUD (x −2.5…2.5 at the top center, and the top right).
  - **Phase:** 1 melt and pour down one gentle slope to the flag · 2 a switchback · 3 edges where drops spill · 4 first gas: rise past a wall · 5 freeze out of gas to land on a ledge · 6 first grate · 7 first hanging flag (prototype Flow 2, cut down, ≈ 7) · 8–10 combinations.
- **Level data format:** one JS file per world in `levels/` (e.g. `levels/hop.js`) that adds to a global, because the game must run from `file://` where `fetch` of JSON and ES modules are blocked. Keep the top 1.5 u of the level clear near the right edge and the center: the HUD sits there when the window is exactly 16:9 and the margin is too thin for it. Coordinates are centered on the level box: a `size: 24` level spans x −12…12 and y −6.75…6.75.
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
      slabs: [],                           // Phase only: [x0, y0, x1, y1] top surface ends
      gates: [],                           // Rocket only: {solid: {l, r, top, bottom}, button: {x, y}}
      grates: [],                          // Phase only: {l, r, top, bottom}
      flag: {x: 10, y: -4},                // pole foot; {x, y, hang: true, dir: -1} for a hanging flag
      prompt: 'Hold A then release to Jump!', // level 1 of each world only
      // promptAt: {x, y},                 // optional: where the prompt sits (default: above the start)
      par: 8.0, expert: 5.0,               // seconds
    },
  ];
  ```

## 7. Progression and retention
- **Unlocks:** every world and every level is open from the start. All unlock checks go through one function, `isUnlocked(world, level)`, driven by a single setting `UNLOCK_RULE = 'all'` (with `'linear'` and `'stars'` ready to switch on later), so gating can be added without touching screens.
- **Stars and best times** are saved per level and shown on the level select. Each world shows its star total (out of 30).
- **Hats:** 8 hats unlock at star totals 5, 15, 30, 45, 60, 80, 100 and 120 (120 = every star). Each is a few ink shapes drawn in code (cap, top hat, crown, propeller, party hat, beanie, viking horns, halo). P1 and P2 each pick a hat on the Hats screen; hats show in solo, Versus and on the ghost. A new hat is announced on the level complete screen.
- **Ghost:** your best run on each level replays as a hollow outline. It updates whenever you beat your time. A settings toggle hides it.
- **Versus:** a win counter per match (first to 3). Nothing saved for Versus.
- **No daily challenge.**

## 8. Screens and UI flow
```
Title ──Play──▶ Playing (first level under 3★) ──▶ Level complete ──Next/Retry/Menu
  ├─Levels──▶ Mode select (Solo | Versus) ──▶ Level select ──▶ Playing ⇄ Pause
  ├─Hats
  └─Settings
Versus: Mode select (Versus tab) ──▶ Level select ──▶ Race ──▶ Round result ──▶ … ──▶ Match result (Rematch / Levels / Menu)
Any screen, portrait window ──▶ "Rotate your device" (game paused)
```
- **Title:** logo with an idle hopping square, a big **Play** button, then **Levels**, **Hats** and **Settings** (sound on/off, music on/off, show ghost on/off). One click from title to playing: Play starts the first level with fewer than 3 stars, in world and level order (Hop 1 for a new player, and Hop 1 again once every level has 3 stars).
- **Mode select:** Solo / Versus toggle at the top. Four world cards, each with an animated mini schematic of its button meaning, name and star total.
- **Level select:** 10 tiles per world in 2 rows of 5, each with number, stars and best time; the next level without 3★ is highlighted. Versus uses the same grid without stars.
- **Hats:** a grid of the 8 hats, locked ones shown as outlines with their star cost; tap one to put it on P1 or P2.
- **Playing HUD (solo):** world-level label (e.g. "1-5") and timer top center, ghost's best time under it, pause and restart buttons top right. From level 2 on, the mode's button hint (e.g. "Hold: charge · Release: hop") shows for the first 3 s and always in the pause menu. The HUD sits in the margin above the level where the screen allows, and never covers the flag.
- **Playing HUD (Versus):** P1's key letter and three square pips top left, P2's top right, as plain dark text with no panels; the world-level label, pause and restart sit top center. A 3-2-1-GO countdown before each round; input is ignored until GO.
- **Pause:** Resume, Restart, Levels, Settings. The game pauses itself when the tab is hidden.
- **Level complete:** time counts up, then stars pop in one by one, "New best!" if it is one, a new hat if one unlocked, Next / Retry / Menu. Next is the default action (Space/Enter).
- **Round result (Versus):** winner banner with letter and color, pip fills, auto-continues after 1.5 s or on any fresh key press after the input lock. **Match result:** big winner, Rematch / Levels / Menu.
- **Results input lock:** on the level complete, round result and match result screens, input is ignored for the first 0.6 s, and a button held down from gameplay must be released and pressed again before it counts. A player mashing across the finish line never skips their result.
- **Rotate screen:** a phone icon turning sideways and "Rotate your device". The game resumes where it was when the window is landscape again.

## 9. Art direction
- **Family:** Two-tone minimal. It is outside the three art families in the README (closest to Toybox Flat with everything removed), so the team must agree; see §14. Mockups: the "D" frames on the Hop Race Art Direction canvas.
- **Rule:** each screen has one flat background color, and everything solid is one dark ink. No outlines on level pieces, no shading, textures, gradients or decoration. The players are the only other color, so the eye always finds them.
- **Palette:** 7 colors in all, at most 5 on screen at once (one more than the 4–6 in `STANDARDS.md`; see §14). Phase shares Hop's yellow, which also makes yellow the "home" color of the title and menus.
  | Hex | Role |
  |---|---|
  | `#1D1A22` | Ink: every solid, googly eye pupils, text, HUD, aim dots, power bar, launcher, rope |
  | `#FFFFFF` | Googly eyes, player letters, checkered flag cells, ice hatching, buttons, hook tip, confetti |
  | `#2E5BFF` | Player 1 (and P1's rockets, blasts, drops and gas) |
  | `#E5262B` | Player 2 (and P2's rockets, blasts, drops and gas) |
  | `#FFC94A` | Background, World 1 Hop and World 4 Phase; title and menus |
  | `#FF8C69` | Background, World 2 Rocket |
  | `#7FD1C7` | Background, World 3 Grapple |
- **Key visuals:**
  - **Players:** flat squares with no outline. Each has one big googly eye (about 60 % of the square's width) that sticks out past its top corner: a plain white ball with no outline and an ink pupil. The pupil is loose: it lags behind and swings with the player's motion (charging, launch, landing, sliding), which carries most of the character. P1 is blue with a white **A**; P2 is red with a white **L**. They differ in hue and letter, never in color alone: the letter is always there, and blue and red stay apart for the common types of color blindness (red reads as a dark brown). P2 can't be white (the eye would blend into the body) or any other palette color (each is a world background or the level ink).
  - **Level pieces:** solid ink shapes; each element is told apart by its silhouette (see §5): hatched top for ice, sawtooth face for grip walls, bumpy top for sticky floors, hollow for no-grip, bars for gates.
  - **Phase:** liquid is solid drops in the player's color; gas is hollow rings in the player's color, so liquid and gas never look alike.
  - **UI:** dark text on the world color, square pips, icon buttons without panels. Menus use the same two tones; world cards take their world's color.
  - **Font:** a heavy grotesque (the mockups use Archivo ExtraBold). Embed a subset as a woff2 file (it is open-licensed), since the game may not load Google Fonts; fall back to `system-ui` at weight 800.
  - Everything is drawn with engine rectangles and polygons; no image files.
- **Juice list:** with no decoration, motion carries the charm, so every item here is required, not optional. Googly pupils wobble on every jump, landing and bump; each eye blinks every 2.5–5 s (sometimes twice), on its own timer so P1 and P2 never blink in sync; after 5 s standing still, the pupil darts left and right furtively, then rests in the middle and repeats, until the player moves or charges; squash down toward the floor while charging, deeper the more power is charged (up to 45 % flatter at full charge), on landing, a short squeeze (held flat for a moment, deeper on harder landings, then a small spring back past square), stretch on launch; ink dust puffs on landing; white sparkle while sliding on ice; flatten on sticky floors; short trail while airborne; blast ring and splash in the owner's color and a short screen shake for rockets; small shake when a hook sticks; splash on melt, puff on evaporate, snap on freeze; white confetti and a stretch pop on finish (no slow-mo: it dropped the frame rate); one soft, lighter pulse of the background on finish (never repeated or strobing); star pop; count-up time; eased slide-in for every panel; button press bounce.
- **Concept art prompts:** *"Minimal two-tone platformer, flat warm yellow background, all platforms solid near-black shapes with no texture, one blue square character with a white letter A and one red square character with a white letter L, no outlines, each with one big googly eye, dotted square aim trail, black-and-white checkered racing flag on a black pole, bold flat vector, 16:9."* Per world: swap the background to coral with "blue and red rockets and blast rings, hatched icy floor" (Rocket), teal with "black rope to pillars hanging from the ceiling" (Grapple), yellow with "square melting into a stream of drops on tilted black bars, a black grate with gaps, hollow rings of gas rising" (Phase).

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
| Melt / evaporate / freeze | Each press in Phase | Soft pour / airy whoosh / crisp click |
| Countdown | 3-2-1-GO in Versus | Two low beeps, one high |
| Finish | Reaching the flag | Win jingle (existing) |
| Star | Each star popping in | Rising chime per star |
| New best / new hat | Beating your best time / unlocking a hat | Short fanfare |
| UI click | Any button | Tiny click |

All synthesized with ZzFX through `SoundGenerator`. Sound on by default, toggle persists. **Music:** none in v1; the music toggle exists (off) for later.

## 11. GameAnalytics
Worlds map to ids: Hop `world01`, Rocket `world02`, Grapple `world03`, Phase `world04`. Levels `level01`–`level10`.

| Event id | When it fires | Value |
|---|---|---|
| Progression `Start:world0N:level0M` | Solo level starts (first input) | — |
| Progression `Complete:world0N:level0M` | Solo level finished | Time in ms (score; lower is better); stars as a design event below |
| Progression `Fail:world0N:level0M` | Solo level left by restart or quit before finishing, only if `Start` was sent for this attempt | Time played in ms |
| `level:stars:<1-3>` | With every Complete | Stars |
| `tutorial:step01` | First hold in Hop 1 | — |
| `tutorial:step02` | First jump in Hop 1 | — |
| `tutorial:step03` | First landing in Hop 1 | — |
| `tutorial:done` | Hop 1 finished | Time in ms |
| `mode:<hop\|rocket\|grapple\|phase>:<solo\|versus>` | A level or match starts | — |
| `versus:round:<p1\|p2>` | A Versus round is won | Round time in ms |
| `versus:match:<p1\|p2>` | A Versus match is won | Rounds played |
| `player:respawn:<mode>` | With each solo Complete or Fail | Falls back to the start in that attempt |
| `hat:unlock:<name>` | A hat unlocks | Star total |
| `ui:restart` | Restart pressed | — |
| `ui:nudge` | The stuck nudge appears | — |
| `settings:sfx:off` / `settings:music:off` | Toggle switched off | — |

**Question the data must answer:** which modes get played most, solo vs Versus, and how long a level and a Versus round take in each mode.

## 12. Tech plan
- **Engine:** LittleJS (`dist/littlejs.js`), kept as the brief's allowed exception to "no frameworks". The game runs from `index.html` with no build. `build.mjs` (vendored) optionally minifies into a release zip in phase 5, where size is measured against the limit.
- **Modules:** split `game.js` during the slice into classic scripts (not ES modules, so `file://` works), all globals prefixed `hr`/`HR_`: `src/config.js` (palette, worlds, unlock rule), `src/main.js` (engine init, state machine), `src/player.js` (shared player rules: start, kill line, finish, pupil), `src/modes/hop.js`, `rocket.js`, `grapple.js`, `phase.js`, `src/level.js` (load level data, solids, gates, flag), `src/camera.js` (fit the level box to the window, aspect handling, rotate screen), `src/input.js` (one-button abstraction over keys and Pointer Events, touch halves), `src/render.js`, `src/ui.js` (screens, HUD), `src/hats.js`, `src/ghost.js`, `src/save.js`, `src/audio.js`, `src/analytics.js`. Levels in `levels/<world>.js`.
- **Simulation:** LittleJS fixed 60 Hz step, which also makes it frame-rate independent. Each mode exposes `step(player, input)` and `draw(player)`; input is a per-player `{down, pressed, released}` read once per frame, so modes never touch the keyboard directly.
- **Canvas and camera:** the canvas fills the window at `devicePixelRatio` capped at 2 and is resized on every window resize. On level load and on every resize, the camera is set to the level center with the scale that fits the level box plus margin. No per-frame camera logic beyond shake.
- **Ghost:** recording and replay both start at the player's first input, the same moment the timer starts. Record the player's position (and Phase's center) every 2nd frame, quantized to 0.01 u, as an Int16 array; at 20 s that is ~600 samples, under 3 KB per level as base64. Replay interpolates. No dependence on deterministic physics.
- **Save keys:** `cm_hop-race_save` = `{v: 1, levels: {"hop-01": {stars, bestMs}}, hats: {p1, p2}, settings: {sfx, music, ghost}}`; ghosts in `cm_hop-race_ghost_<levelId>`. Unlocked hats are computed from the star total, not stored. All reads wrapped in `try/catch`; a broken save resets to defaults. Saved after every level complete, hat change and settings change.
- **Testing hook:** `window.game` with `screen`, `level` (id), `mode`, `versus`, `score` (time or wins), and `start(levelId)`, `restart()`, `win()` (debug only, stripped from release). `screen` uses the standard values `'title' | 'levels' | 'playing' | 'complete'` plus `'modes'` (counts as `levels`), `'hats'` (counts as `title`), `'paused'` and `'rotate'` (count as `playing`), `'round'` and `'match'` (count as `complete`).
- **Riskiest piece:** turning 6 hand-tuned one-level modes into 40 smaller, data-driven levels without breaking their feel, especially Phase (drop physics tuned to specific slab angles, a flag position computed from the last slab, the new press cycle and grates) and the jump and blast ranges in a smaller box. Prove it in the slice: load the prototype's levels from data at their old size (`size: 42`) and confirm each plays the same, then retune ranges for 24–30 u levels and build Hop 1–3.

## 13. Scope
- **v1:** 4 worlds (Hop, Rocket, Grapple, Phase) × 10 levels; solo time trial with stars and ghost; 8 hats unlocked by stars; 2-player Versus on any level; full shell (title, mode select, level select, hats, pause, restart, complete, settings, rotate screen); mouse, keyboard and touch; any landscape aspect from 4:3 to 21:9; saving; GameAnalytics; `window.game`.
- **Build order and cut line:** worlds are built Hop → Rocket → Grapple → Phase. When World 3's content is done, Phase levels 1–3 must be built and played cold by someone who didn't make them, who finishes them without help. If not, v1 ships with three worlds (30 levels, hats rebalanced to 90 stars) and Phase follows in an update. Pao and a teammate make the call together.
- **Vertical slice (phase 2):** Hop levels 1–3 from data, solo with timer, stars and ghost, Versus on the same levels, full shell, saving, analytics stubs logging to the console.
- **Later:** 3–4 player Versus (needs a keyboard ghosting test first); CPU opponent; more modes on the one-button idea; best-of-N options for Versus; more hats; 12 levels per world if players want more; star gates if the data shows players skip around too much.
- **Cut:**
  - **Orbit:** disorienting to play; its rotating-exit idea doesn't fit the left-to-right race.
  - **Rocket Jump (pits)** as a separate mode: its pits become an element in the Rocket world.
  - **Separate Wall Jump and Flow 2 modes:** merged into Hop and Phase as elements, which gives those worlds a second half.
  - **Hold and release in Phase, and fire pits:** Phase is one press per state change (solid → liquid → gas → solid). Fire pits are gone because gas is reachable anywhere; grates replace them.
  - **Daily challenge:** not part of this game.
  - **Checkpoints:** levels are small enough that falling back to the start is fair.
  - **Dynamic camera zoom and scrolling levels:** every level fits the screen, so the camera stays fixed and players are drawn bigger.
  - **Portrait play:** the level box is 16:9; a portrait phone would shrink it to a third. Portrait shows the rotate screen.
  - **Momentum in Hop landings:** Hop stays precise (land where you aim); momentum lives in Rocket, Grapple, Phase and on ice.
  - **Reduce-motion setting:** not in v1; the finish pulse is kept to one soft flash instead.
  - **Flow grain-count debug text:** removed (`RC_SAND.debug` off).

## 14. Open questions
| Question | Recommendation | Who decides | Status |
|---|---|---|---|
| World 4's name: "Phase" is a working name | Keep "Phase" (short, says solid/liquid/gas); alternatives "Matter", "Melt". | Pao | Open |
| 3–4 players on one keyboard? | Not in v1: many keyboards can't register 3–4 held keys at once, and touch quarters are too small. Revisit with a ghosting test. | Pao | Later |
| Mouse in Versus: let a mouse click count as P1 so a mouse + L pair works? | Yes, cheap and removes the "Versus needs a keyboard" caveat. | Pao | Open |
| Par/expert times: set by hand or by a replay bot? | By hand from designer runs (expert ×1.1, par ×1.6), checked by a teammate in phase 3. | Pao | Open |
| Jump and blast ranges in 24–30 u levels | Hop's top jump speed is now 20 u/s (−20 %). Rocket blast is 24 u/s, top speed 22 u/s (both −20 %); keep the aim sweep and charge time. Grapple keeps the prototype's numbers (hook 55, reel 95 u/s² up to 26 u/s, top 32 u/s); the levels are sized to them. | Pao | Hop, Rocket, Grapple done |
| Player-to-player collision? A cold playtester (Hop, 2026-10-21) said bumping into the other player might be exciting | Recorded only, no change to bodies yet: players still pass through each other (§3.1). Rocket blasts now push both players (3.3), which tests some of this idea. If it is tried, make it Versus-only and light (a bump that trades some speed, no pushing off ledges) and playtest it against the pinning problem. | Pao | Open |
| Phase finish needs 40 of 49 drops: too strict for the younger end (9–12)? | Keep 40; if playtests show frustration, drop to 35. | Pao | Open |
| Art direction: two-tone minimal is outside the three art families | Owner chose it over Toybox Flat (too close to an existing pastel one-button game), wind-up toys, dusk storybook, paint daubs, broken-color painting and a garden world. The team agrees, then the README lists it as a fourth family or as a Toybox Flat variant. | Team | Open |
| P2 red makes 7 colors, one over `STANDARDS.md`'s 4–6 | Keep: no palette color works for P2 (each is a world background or the ink), and white hid the eye. Teammate agrees or proposes a merge. | Team | Open |
| Grapple launcher: reverse the spin on each shot (as in Rocket)? | Without it, after letting go the launcher swings backward and the next pillar is rarely in reach before you fall: in 3-2 a bot never catches the second pillar in mid-air. It finishes 20 of 169 hold pairs (49 with reversal), each with one long fling from the first pillar or a second shot fired from standing. Play both; if no reversal stays, rework 3-2. | Pao | Testing no reversal |
| Coolmath SDK, ad breaks (between levels only), size limit, GA keys | Follow `STANDARDS.md` once the shared [confirm]s are answered. | Team | Open |

## 15. Changelog
- 2026-10-22 — Grapple launcher no longer reverses its spin on each shot (owner wants to try the prototype's feel); the reversal stays behind `HR_GRAPPLE.reverseSpin`. Open question added in §14.
- 2026-10-22 — Grapple 1–3 built (Swing By, Two Pillars, Let Go). The launcher reverses its spin on each shot, as in Rocket; without it, catching the next pillar after a release needed most of a full turn. The top of the level box is closed in Grapple. A dotted sight line shows the hook's path. Levels can place their tutorial prompt (`promptAt`).
- 2026-10-21 — Owner decision: rocket blasts push every player in range, and a rocket explodes on the other player (as in the prototype). Removed from the Cut list; watch for pinning in Versus playtests.
- 2026-10-21 — Rocket 4–10 hidden as drafts (`draft: true`); 1–3 are the Rocket slice to tune the mode first.
- 2026-10-21 — Rocket world built: 10 levels listed in §6 (replacing the outline). Blast 24 u/s, top speed 22 u/s. Rockets pass through players and explode on buttons. Gate levels get a thin ceiling under the HUD. New open question: player-to-player collision.
- 2026-10-21 — Idle glance: after 5 s standing still, the pupil looks left and right furtively in a loop.
- 2026-10-21 — The finish flag is a waving checkered flag, F1-style, instead of a white pennant. Same size, so the trigger box is unchanged.
- 2026-10-21 — Landing squeeze is longer (0.36 s: hold flat, then a small spring back) and deeper on harder landings, so it reads on screen.
- 2026-10-21 — Players' eyes blink every 2.5–5 s, now and then twice in a row.
- 2026-10-21 — Flag trigger box now spans the pole to the pennant tip instead of centering on the pole. The 0.2 s finish slow-mo is replaced by a stretch pop, because slowing the engine dropped the frame rate to 20 fps.
- 2026-10-21 — Hop 1 prompt is now "Hold A then release to Jump!". In Hop the player squashes down toward the floor while charging, deeper with more power.
- 2026-10-21 — P2 changes from white to red (`#E5262B`) with a white L, because the outline-free white eye vanished on a white body. Palette is 7 colors; players differ in hue and letter.
- 2026-10-21 — The googly eye loses its ink rim: a plain white ball with an ink pupil.
- 2026-10-21 — Slice build: the level box's side edges act as plain walls; levels keep the top 1.5 u clear for the HUD; `src/config.js` and `src/player.js` added to the module list. Hop's top jump speed is 20 u/s (was 25).
- 2026-10-21 — Approved by the owner; the team agreed to skip the peer review. Phase 2 (vertical slice) starts. The art family question in §14 stays open.
- 2026-10-21 — Phase controls: one press cycles solid → liquid → gas → solid, with no holding; liquid reaches solid only through gas. Fire pits removed; grates (solid stands, liquid drips through, gas rises through) arrive at Phase 6. Tutorial prompt, level outline, audio, art and data format updated.
- 2026-10-21 — Second review pass: 0.6 s input lock and fresh press on results screens; stuck nudge in every mode based on progress toward the flag; Phase pockets added to the dead-end check; testable Phase cut criterion; world-level label in the HUD; Phase finish counts drops in any state; Play goes to the first level under 3 stars; ghost starts at first input; HUD buttons excluded from touch halves.
- 2026-10-21 — Review pass (1c) applied. Play starts the next level in one click; Levels and Hats buttons on the title. World 4 renamed Phase, with three visible states (solid, liquid, gas) in a state table; gas only becomes solid. Hop no-dead-ends rule plus a stuck nudge after 8 s. Versus players spawn on the same point and never affect each other; rockets push only their owner, with color-coded blasts. 8 hats unlocked by stars in v1. Cut line: Phase can slip to an update. Launcher, rope, hook, aim dots and power bar defined. Per-world tutorial prompts. Palette down to 6 colors (Phase shares Hop's yellow). `window.game` screens, analytics edge cases, canvas DPR and wall bounces specified. Finish pulse is one soft flash.
- 2026-10-21 — Players lose their outlines and get one big googly eye each, with a loose pupil that swings with motion. The round-eye vs bar-eye difference is gone; letters and lightness tell the players apart.
- 2026-10-21 — Art direction is now two-tone minimal: one background color per world, solid dark level pieces, players the only other color. P2 changes from orange to white. Element shapes in §5 and the Versus HUD in §8 updated to match.
- 2026-10-21 — Player line names the age range (core 13–24, floor 9–10) and the tone. Art direction reopened as an open question.
- 2026-10-21 — Owner review: art family changed to Toybox Flat (new palette, visuals and prompts). Levels shrink to one 24–30 u screen with a fixed camera that always shows the whole level, so players are drawn bigger; landscape only from 4:3 to 21:9, with a rotate screen in portrait. Falling sends you back to the level's start, no checkpoints. One finish rule for Hop, Rocket and Grapple: touch the flag's trigger box. New elements: ice (Hop 5, Rocket 4) and sticky floor (Rocket 7). Hop stays precise (no landing momentum). Hats and cosmetics added to Later.
- 2026-10-21 — First draft from the brief and the phase 1a answers: 4 modes as worlds of 10, solo time trial with ghost as the main path, Versus on any level, all levels unlocked behind one switchable rule, no daily, LittleJS kept.
