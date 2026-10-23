# Hop Race — Game design document

**Status:** Approved
**Owner:** Pao · **Reviewed by:** Pao (team review waived) · **Last updated:** 2026-10-23

> One button, four meanings: hold and release to hop, blast, swing or climb your way to the flag, alone against your ghost or against a friend on the same keyboard.

**Still finding the fun.** The four core worlds are the v1 plan: Hop, Rocket, Grapple and Climb (Phase was rejected, §13). New button meanings keep getting tried as **Lab worlds**: a short feel test (§13.1) that is then kept, grown into a full world, or cut. Climb (§3.7) was the first, and grew into World 4.

## 1. Summary
- **Pillars**
  1. **One button, instantly understood.** Every action in every mode is hold, press or release of a single input. Nothing else to learn.
  2. **Short and snappy.** A level is 8–20 s, a restart under a second, a rematch one press away.
  3. **Same button, new meaning.** Each mode reinterprets the button so the fourth world feels as fresh as the first.
- **Player:** Coolmath regulars on a school Chromebook or home laptop, mostly alone (solo is the main path), sometimes two friends sharing one keyboard or one tablet. **Ages:** the core is about 13–24 (teens and young adults at school or on a break, matching Coolmath's biggest group, 18–24); the floor is about 9–10, so younger kids can still finish the early levels. One button and a tutorial first level keep it open to the young end; best times and the ghost give the older end a skill ceiling. **Tone:** playful but never babyish; text short and dry ("Nice." over "Yay, great job!!").
- **Session:** one level 8–20 s solo; a versus match (first to 3) about 1–2 min; a typical visit 10–15 min.
- **Hook:** beating your own ghost by a few tenths, shaving a best time down, and "one more round" against a friend.

## 2. Core loop
- **Moment (seconds):** hold to charge or aim → release (or press) to act → land, cling, swing or settle → read the next obstacle.
- **Level (minutes):** pick a level → race your ghost to the flag → see your time and the gap to your best → Retry for a better time or Next.
- **Meta (days):** finish levels across 4 worlds × 10 levels to unlock hats and lower your best times; bring a friend for Versus on any level.

## 3. Mechanics
Units: positions and speeds are in world units (u). Each level is a 16:9 box from 24 × 13.5 u to 30 × 16.9 u, and the camera always shows the whole level (3.6). At 1280×720 that makes 1 u ≈ 43–53 px, so the 0.8 u player square is 34–43 px on screen (the prototype's 42 u wide view drew it at 24 px). The engine updates at a fixed 60 Hz. Gravity is 42 u/s² unless a mode says otherwise.

Numbers below are the prototype's values in `game.js` and are the starting point for tuning. The prototype's levels were 42 u wide; in smaller levels a full-power hop (about 15 u at 45°) and the rocket blast cover a lot of the screen, so expect jump speed and blast strength to come down about 20 % in the slice so each level holds 3–5 obstacles.

### 3.1 Shared rules (all modes)
- **Start:** players start grounded at the level's `start` point. In Versus both spawn on exactly the same point; P2 is drawn behind P1, with its eye nudged so both eyes show, until they separate.
- **Level box edges:** the left and right edges of the level box act as plain walls, so a bounce can never carry a player off screen. They are drawn as ink walls 0.5 u thick (the camera margin), so on screens wider than 16:9 the background shows past them and the HUD buttons never sit on ink. Floors that touch the edge still run on to the screen edge; floating pieces such as ceilings stop at the wall.
- **No contact between players:** players pass through each other. The one exception is Rocket, where blasts push every player in range (3.3).
- **Falling:** dropping below the kill line (1 u under the level's bottom edge) sends you back to the level's start with zero speed. The timer keeps running; nothing else is lost. In Versus the other player keeps racing. There are no checkpoints: levels are short enough that a restart from the start is fair.
- **Finish (Hop, Rocket, Grapple):** touch the flag's trigger box, which runs from the pole to the pennant tip (1.44 u wide) and from the ground to the top of the pole (3 u). Grounding is not needed. Phase has its own rule (3.5). Solo: the timer stops. Versus: the first player to finish wins the round.
- **Timer (solo):** starts at your first input, not when the level appears, so reading the level is free. Shown as seconds with one decimal; stored in ms.
- **Stuck nudge (solo):** after 8 s without getting closer to the flag (your best distance to it has not improved), in any mode, a small "R to restart" fades in near the restart button. It disappears as soon as you get closer again.

### 3.2 Hop (merges the prototype's Classic and Wall Jump)
- **Hold** (only while grounded or clinging): power charges from 0 to full in 1.1 s; the aim angle sweeps between 18° and 80° at 2.6 rad/s (a full up-down cycle ≈ 2.4 s). Nothing is drawn for the aim or the power: the googly pupil looks along the launch direction, and the player's shape shows the power (flatter with more power, squeezed from the sides as the aim drops flat past full charge), so where you land stays a surprise.
- **Release:** jump at 9 u/s (no charge) up to 20 u/s (full charge; the prototype used 25 in its 42 u level) along the aim angle, in the facing direction.
- **You only move by jumping.** Landing stops you dead (no sliding), except on ice. On the ground you face right, except against a grip wall on your right, where you face away from it. Hop stays precise on purpose: you land where you aimed.
- **Plain walls bounce:** hitting one mid-air reverses your horizontal speed at 35 %.
- **Ice floor** (from level 5): landing on ice with more than 2 u/s of horizontal speed keeps 80 % of it, and you slide with a friction of 0.8/s. You can charge and jump while sliding; the jump replaces your slide speed. Sliding off an edge drops you. A steep, soft landing barely slides. Built (`HR_HOP.iceKeep`, `iceMin`, `iceFriction`): walls stop a slide dead, and sliding onto a floor that isn't ice stops you dead.
- **Grip walls** (from level 7): hitting one mid-air makes you cling. You stop, even if you hit it moving up fast (no riding up the wall), turn to face away, and slide down at up to 3 u/s, or at 0.5 u/s while you charge: holding grips the wall and slows the slide (`HR_HOP.clingChargeSlide`; 0 holds you still, 3 is no slower). Charge and jump off as normal. If the wall ends below you, you let go and fall. Landing at the foot of a grip wall turns you away from it, so a jump from there crosses the shaft.
- **Ceilings** stop upward motion; you keep your sideways speed.

### 3.3 Rocket
- A launcher spins around you all the time at 3 rad/s, always clockwise. Firing doesn't change its direction.
- A faint dotted sight line, as in Grapple, shows the rocket's path up to where it would explode (the first solid or unpressed button). It hides during the 0.1 s cooldown. It doesn't stop at the other player.
- **Press** to fire (cooldown 0.1 s). The rocket flies at 38 u/s and explodes on any solid, button or the other player; your own rocket flies through you. Firing gives you a small recoil of 4 u/s backwards. You can fire in the air too.
- **Blast:** radius 4 u, pushes **every player in range** (the one who fired it and the other one) away from its center at up to 24 u/s (falling off with distance; the prototype's 30 less 20 %). Top speed 22 u/s (was 27). Ground friction 7/s. You keep your momentum through the air and slide to a stop on the ground. Walls bounce you back at 30 %.
- **Whose blast is it:** rockets, blast rings and splash particles take their owner's color (P1 blue, P2 red), so in Versus it is always obvious whose shot is whose. Being blasted by the other player can knock you off a ledge or into a pit; watch for one player pinning the other in playtests.
- **Buttons and gates** (from level 3): a rocket that hits a button, or a blast within 2.5 u of it, presses it; its gate slides up into the ceiling and stays open. Gate levels have a thin ceiling just under the HUD, so the only way past a gate is its button. In Versus a gate opened by either player is open for both.
- **Ice floor** (from level 4): ground friction drops to 0.6/s, so a blast sends you gliding.
- **Sticky floor** (from level 7): landing on it stops you dead, and while you stand on it blasts push you at only 50 %. Get off it by blasting twice, or avoid landing on it.

### 3.4 Grapple
- Same spinning launcher (3 rad/s, always clockwise, as in Rocket); it freezes while the hook is out and keeps its direction when the rope is cut. Firing never reverses it (owner decision); the old reversal stays behind a switch (`HR_GRAPPLE.reverseSpin`, off). A faint dotted sight line shows where the hook will go while it is ready.
- **Press** to fire the hook (55 u/s, no range limit). It sticks to the first solid it touches, except no-grip surfaces (from level 6), which it bounces off. A hook that leaves the level is lost (0.3 s cooldown).
- **Hold** to reel in: you accelerate toward the anchor at 95 u/s² up to 26 u/s along the rope; any speed you already had is kept. Sideways speed is damped (1.2/s) so you don't orbit. Within 1.1 u of the anchor you hang there.
- **Release** cuts the rope. You keep your speed (top speed 32 u/s). This is the skill: let go at the right moment to fly.
- **Walls** stop you dead (no bounce).
- **Closed top:** the top edge of the level box stops you like a ceiling, so a hard swing never flies off the screen. The hook can't stick to it; a hook that flies past it is lost.

### 3.5 Phase (solid, liquid, gas; merges the prototype's Flow and Flow 2) — rejected
> **Rejected 2026-10-22** (see §13 Rejected modes). Hidden in the game; kept below for reference.

You are a block of matter made of 7 × 7 = 49 drops. **Each press switches you to the next state, always in the same order: solid → liquid → gas → solid.** There is no holding in Phase.

| State | Looks like | How it moves | Press |
|---|---|---|---|
| **Solid** | A square | Falls; sticks to slopes under about 42° | Melt into liquid at once; the drops keep the square's speed |
| **Liquid** | 49 drops in your color | Pours downhill (drop gravity 30 u/s²), slides on slabs, heaps on itself | Evaporate into gas at once; the drops become rings and start to rise |
| **Gas** | Hollow rings in your color | Rises (20 u/s² up) and slides along ceilings almost without friction | Condense into a solid: the rings pull together for 0.5 s, then pack into a square that falls |

- **Liquid can't freeze directly:** to stop pouring, you press twice (liquid → gas → solid), so you rise a little before you freeze and drop. Timing that hop is the world's core skill. Built: from a pour, evaporating and then condensing lifts the drops about 2–3 u while they drift on, then the square falls with half the drops' sideways speed (never upward).
- **Press timing:** presses closer than 0.15 s apart are ignored, so a double tap never skips a state by accident; presses during the 0.5 s condense are ignored too.
- **Grate** (from level 6): ink bars with gaps. A solid stands on it and is blocked by it; liquid drips through it; gas rises through it. Choosing the right state for each grate is the second half of the world.
- **Losing drops:** drops that fall off a slab are gone, and the solid square shrinks to match. Under 12 drops, or gas that floats out of the top of the level, and you go back to the start with all 49.
- **Finish:** at least 40 drops touching the flag, in any state (a whole square touching it counts all its drops; liquid drops and gas rings count one each). Arriving with fewer than 40 sends you back to the start, so care beats speed. The counting box is the flag's box (3.1) reaching 1 u below the pole's foot, because a flag on a slope has drops pooling lower than its foot.
- **Built numbers** (`HR_PHASE`, `src/modes/phase.js`): the square and liquid drops fall at 30 u/s² (the prototype's value, not 42); gas rises at 20 u/s² with a drag of 1/s; liquid friction 0.12 on slabs and 0.35 between drops; gas friction 0.03; speed cap 22 u/s; slabs 0.5 u thick. Plain solids act as flat slabs, so Phase levels can mix both.
- **Change from the prototype:** the prototype used hold to crumble and release to pack, and gas came only from fire pits. Both are replaced by the press cycle; fire pits are gone because gas is reachable anywhere, and grates take their place.

### 3.6 Camera and screen
- **Fixed camera:** the camera frames the whole level box plus a 0.5 u margin and never moves or zooms during play. The only camera motion is screen shake. Players always see the flag and every obstacle.
- **Any landscape size:** the level box is fitted to the window at any aspect ratio from 4:3 to 21:9. Space outside the box shows the level's background (solids that touch the box edge are drawn on to the screen edge), never black bars.
- **Portrait:** when the window is taller than it is wide, the game pauses behind a "Rotate your device" screen with a rotating phone icon.

### 3.7 Climb (World 4; grew from a Lab feel test; inspired by Getting Over It)
- A stiff **arm** sticks out of the player: 2 u from the body's center to a round **head** (radius 0.24 u). The player has no other way to move.
- **Hold** to whip the arm **clockwise** at 10 rad/s (the head moves at 20 u/s). **Let go** and the arm **coasts**: it slows evenly from full spin to a stop in 0.3 s (about 85° more turn, `HR_CLIMB.coastTime`; 0 makes it stop dead). A coasting head doesn't strike: the moment it touches a surface the arm stops and the cup sticks, so you can fling it onto a wall. The arm's length never changes.
- **The arm is always solid.** The head never passes through anything. Wherever turning the arm would push the head into a solid, the body is pushed the other way instead.
- **Strikes pop you:** while turning, the head doesn't slip on the surface it hits, so a strike levers the body around it. From standing, one swing into the floor pops you about 4.8 u up and 4 u forward. A strike on a wall shoves you away from it and up.
- **Suction cup while stopped:** with the button up, the head is a plunger. As soon as it touches any surface (floor, wall, tooth or ceiling, within 0.05 u) it sticks and holds your whole weight in any direction: perch on the arm, hang from a wall face, dangle under a ceiling, or catch a ledge by letting go as you fly past it. On a floor or ceiling it lets go as soon as you hold again. **On a wall it takes a soft touch** (testing, 2026-10-23): a press shorter than 0.2 s keeps the cup on and turns the arm slowly (2 rad/s) around it, levering the body (on a wall to your right, up and toward it), so taps inch you along; only a hold past 0.2 s peels it off and whips. `HR_CLIMB.peelTime = 0` brings back peel-on-press. `HR_CLIMB.suction = false` brings back the earlier grip, which peeled off when gravity pulled it away from the surface.
- **Body:** gravity 42 u/s², top speed 20 u/s, ground friction 8/s. Walls stop it dead.
- **Wedged:** if the arm can't turn without pushing the head or the body into a solid, it doesn't turn that frame. You don't phase through anything.
- **Skill:** holding blindly whips the arm around and around, popping you wherever the strikes go. The game is choosing when to let go: stop the arm where you want it, then whip it into the next surface. Holding the whole time still finishes Climb 1 (the tutorial) but falls in Climb 2 and falls into Climb 3's pit.
- **Draw:** the arm is a thick ink line to a round ink head. While stuck, the head becomes a **suction cup**: an ink half disc with its flat side flush on the surface (snapped to the face it is over, so it never sits at a slant on a corner) and a thin white lip along that side, landing with a quick squash (wider and flatter for 0.15 s).
- **Numbers to tune** live in `HR_CLIMB` (`src/modes/climb.js`).

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
| Hat | Cosmetic, unlocked by levels finished | Title screen | Small ink shapes on top of the square (§7) |
| Platform | Solid; you stand on its top | Hop 1 | Solid dark block |
| Flag | The goal; touch its trigger box | Hop 1 | Dark pole with a waving checkered flag (6 × 4 ink and white cells, F1-style) |
| Plain wall | Solid; bounces you back in Hop | Hop 4 | Solid dark block, straight sides |
| Icy floor | You slide after landing (Hop); low friction (Rocket) | Hop 5, Rocket 4 | Dark block with a white hatched stripe along its top |
| Hanging wall / ceiling | Blocks upward motion; duck under it | Hop 6 | Block hanging from the top |
| Grip wall | You cling to it and slide down (Hop) | Hop 7 | Dark block with a sawtooth face |
| Launcher | Spins around you; aims rockets and the hook | Rocket 1, Grapple 1 | Short barrel in the player's color circling the player |
| Rocket and blast | Pushes every player in range; explodes on the other player | Rocket 1 | Small capsule, ring and splash particles in the owner's color |
| Rocket button | A blast near it opens its gate | Rocket 3 | White target on a dark mount; becomes a white check mark when pressed |
| Gate | Solid until its button is pressed, then slides up | Rocket 3 | Barred block (dark bars, background between), linked to its button by a dotted line |
| Pit | No floor; falling in sends you back to the start | Hop 1 (gaps), Rocket 6 | Gap in the floor |
| Sticky floor | Stops you dead; blasts push you at 50 % (Rocket) | Rocket 7 | Dark block with a bumpy, rounded top edge; player squashes flat on it |
| Hook and rope | Sticks to solids; reel in while held | Grapple 1 | Rope line and hook in the player's color, with a small white hook tip |
| Hook anchor surface | Any solid; hanging pillars are the usual target | Grapple 1 | Pillars hang from the ceiling |
| No-grip surface | The hook bounces off; it does not stick | Grapple 6 | Hollow block (dark outline, background inside) |
| Slab | Tilted platform in Phase | Phase 1 | Thin tilted dark bar |
| Arm and head | Whips around while held; a strike levers the body, a stopped head sticks like a suction cup (Climb) | Climb 1 | Thick ink line to a round ink head; a suction cup (ink half disc, white lip) while stuck |
| Tooth | Ledge of varied size on a wall face to strike and stick to (Climb) | Climb 3 | Ink block sticking out of the wall |
| Grate | Solid stands on it; liquid drips through; gas rises through | Phase 6 | Thin ink bars with even gaps, no dotted link (unlike a gate) |
| Hanging flag | Flag on the underside of a ceiling slab | Phase 7 | Upside-down pole and checkered flag |

## 6. Level design
- **Structure:** 4 worlds of 10 levels, one per mode, 40 levels in v1. Every level is a single 16:9 screen (24–30 u wide), holds 3–5 obstacles, and takes 8–20 s solo for a first clean run.
  - **World 1 — Hop:** charge and aim, gaps, walls, ice, ducking, then grip walls.
  - **World 2 — Rocket:** blast yourself around, buttons and gates, ice, pits, then sticky floors.
  - **World 3 — Grapple:** swing between hanging pillars, release timing, then no-grip surfaces.
  - **World 4 — Climb:** whip the arm into surfaces to pop up, let go to stick, pits at the foot of walls, then teeth on wall faces.
  - ~~**Phase:**~~ rejected (§13). Was: melt and pour down slopes without losing drops, evaporate to rise, freeze to land, then grates and hanging flags.
  - **Lab worlds** (§13.1) come after the core four, with 3 levels each, and are not part of the 40.
- **Teaching order:** each world's level 1 is a safe tutorial for the button's new meaning, with one short in-world prompt that fades after the first successful action. The prompts: Hop "Hold A then release to Jump!", Rocket "Press to blast.", Grapple "Hold to reel in. Let go to fly.", Climb "Hold to swing. Let go to stop." Level 1 shows only the prompt; from level 2 on, the button hint shows instead (§8). New elements enter alone in a safe level, then get a twist (tighter, higher or timed), then combine with older elements.
- **No dead ends:** in Hop you can only jump right except off grip walls, so every spot a player can stand on must lead to the flag or to a pit. In Phase, no slab or ceiling pocket may trap liquid or gas with no way out. The phase 3 level tool checks both (simulated jumps from every standable spot in Hop, pocket detection in Phase); the stuck nudge (3.1) is the safety net.
- **Difficulty curve:** harder means narrower landings, wider gaps, less forgiving aim windows, and more obstacles between start and flag (so a fall back to the start costs more). Levels 1–3 of each world are easy, 4–7 introduce and twist the world's new elements, 8–10 combine. Each world's level 1 is easier than the previous world's level 10, because the button means something new.
- **Times, not stars (solo only):** a level is scored only by its time. There are no stars, par or expert times: the target is your own best time, which the ghost replays. Falling only costs time.
- **World 1 — Hop (all 10 built in `levels/hop.js`):**
  1. **First Hop:** flat ground, one 3 u gap, flag on the far side. Prompt: "Hold A then release to Jump!"
  2. **Stepping Stones:** three gaps getting wider (3, 4, 5 u) between low platforms.
  3. **Up We Go:** a staircase of three rising platforms, the last one floating over a pit; needs steeper aims.
  4. **The Wall:** one long floor (no pits) with a 2 u wall to learn the bounce on, then a 4 u wall: jump too flat and it bounces you back. Clearing it takes a near-full, steep hop; landing on top of either wall is fine.
  5. **Thin Ice:** hop from a high ledge over a pit onto a long ice floor; the slide carries you to a 1 u bump that stops it, then more ice slides you to the flag. Steep landings slide less.
  6. **Low Ceiling:** a 5.5 u gap with a block hanging from the top 2.5 u over it, so a high arc bonks and drops into the pit; the gap needs a long hold that sweeps back down to a flat, strong jump. Then a 3 u gap up a 2 u step to the flag.
  7. **Grip:** a shaft 3 u across between a hanging grip wall (hop in under it, 1.7 u of room) and the 5 u grip face of the flag's ledge; zigzag up.
  8. **Which Wall?:** a cliff whose foot is plain and whose top half is grip, with a floating grip pillar 3 u in front of it. Jump at the cliff too low and the plain foot bounces you back; high enough and the grip half holds you, then zigzag between it and the pillar to the top.
  9. **Slide and Climb:** a hop onto an ice ledge that slides you toward a 3.5 u pit; jump while sliding (the slide's speed carries a low hop across), under a hanging grip wall, then climb a grip shaft to the flag.
  10. **The Gauntlet:** a gap, an ice landing that slides you under a low ceiling toward a 3 u gap, then a grip shaft (hop in under a hanging grip wall) to the flag.
  - **Bot check** (`tools/hop-bot.js`: every hold length from every spot you can stand or cling): every level finishes and none has a dead end. Fastest bot runs, without the 0.5 s pause per hop a person needs: 1 3.6 s, 2 4.9, 3 6.6, 4 5.0, 5 3.7, 6 5.7, 7 6.0, 8 7.0, 9 6.1, 10 6.8. The tightest hops on the bot's route: 1-3 13 of 163 hold lengths, 1-4 (over the 4 u wall) 17, 1-9 10. Climbing is the only way up: with the grip walls turned plain, the bot can't finish 1-7 to 1-10.
- **Other worlds (outline; full level lists in phase 3):**
  - **Rocket (built; 4–10 are drafts, hidden until 1–3 are played and the mode is tuned):** 1 **Blast Off**: flat floor with one block in the middle, 2 u wide and 4 u tall; prompt "Press to blast." · 2 **Step Up**: two 2.5 u ledges, blast down to climb · 3 **Knock Knock**: first button and gate, then a short pit · 4 **Glide**: first ice floor with a bump, ending at a pit before a raised landing · 5 **Around the Corner**: the button hides behind the gate under a low ceiling; hit the wall next to it so the blast reaches it · 6 **Mind the Gap**: three narrow islands over pits · 7 **Sticky Situation**: a long sticky floor before a 2.5 u step, then a sticky trough · 8 **Gatehouse**: ice start, button and gate, two landings over pits (the prototype's level, cut down) · 9 **Goo Hop**: two sticky islands over pits, then rising pillars · 10 **The Works**: ice, a hidden button, a sticky floor under a low ceiling, two pits.
  - **Grapple (1–3 built; 4–10 still an outline):** 1 **Swing By**: one pillar over a 3 u pit's far edge; prompt "Hold to reel in. Let go to fly." (placed under the pillar) · 2 **Two Pillars**: a 14 u pit, swing from one pillar to the next · 3 **Let Go**: one pillar, an 8 u pit; the later you let go, the farther you fly · 4–5 rising pillars and floating platforms · 6 first no-grip surfaces · 7–10 combinations (prototype level, cut down, ≈ 5). Pillars hang from the top of the level box and stay out of the HUD (x −2.5…2.5 at the top center, and the top right). Where floor runs past the flag with no pillar in reach (1 and 3), a thin ceiling under the HUD runs from x 2.5 to the right wall, so a player who overshoots can hook it and swing back (otherwise only the wall and floor are in reach, and you were stuck).
  - **Climb (1–3 built in `levels/climb.js`; 4–10 still to outline: levels that need the release, such as gaps and overhangs, rather than more height, §14):** 1 **Roll Along**: flat floor, a 1 u step, then a 2.5 u step to the flag; prompt "Hold to swing. Let go to stop." · 2 **Boulders**: a 3.5 u pit (holding blindly falls in), then rocks stepping up 1.5 u at a time · 3 **The Wall**: a 9 u wall with the flag on top, a 3.5 u pit at its foot, and three **teeth** of varied size on its face (0.8 × 0.4 u at y −4.5, 1.0 × 0.4 at −1.7, 0.6 × 0.5 at 0.4), made by `hrClimbTeeth` from a fixed seed. Bot check, 200 random hold/release runs per level: 1 finishes every run (holding alone: 7.9 s); 2 finishes all 200, with about 2 falls per run; 3 finishes 157 (best 4.1 s, about 5 falls per run). Holding alone fails 2 and 3. Over 450 runs, neither the head nor the body ended a frame inside a solid deeper than 0.02 u.
  - **Phase (rejected, hidden; 1–3 built in `levels/phase.js`, kept for reference):** 1 **Melt**: one gentle slope (16°) from wall to wall, flag in the low corner where the drops pool; nothing can spill; prompt "Press to melt." · 2 **Switchback**: three slopes, right, left, right, so the pour turns twice before it pools at the flag; nothing can spill · 3 **Spill**: the start slope ends at an edge over a 3.5 u pit, with the flag slope beyond it. A pour alone spills into the pit; stop before the edge (press twice: liquid → gas → solid), hop across as gas, land as a square, then melt again. Bot check: evaporating while the pour's center is between 1.5 u before the edge and 1.7 u past it works (about 0.4–0.6 s, depending on how fast you condense); too early, and the square lands back on the start slope to try again. Simulated times: 1 3.3 s, 2 10.9 s (no faster way), 3 best 6.8 s · 4 first gas: rise past a wall · 5 freeze out of gas to land on a ledge · 6 first grate · 7 first hanging flag (prototype Flow 2, cut down, ≈ 7) · 8–10 combinations.
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
    },
  ];
  ```

## 7. Progression and retention
- **Unlocks:** every world and every level is open from the start. All unlock checks go through one function, `isUnlocked(world, level)`, driven by a single setting `UNLOCK_RULE = 'all'` (with `'linear'`, finish the level before, ready to switch on later), so gating can be added without touching screens.
- **Best times** are saved per level and shown on the level select. Each world shows how many of its levels you have finished (e.g. "4/10 done").
- **Hats:** 8 hats unlock at 3, 6, 10, 15, 20, 25, 32 and 40 core levels finished (40 = every level; Lab levels don't count). Each is a few ink shapes drawn in code (cap, top hat, crown, propeller, party hat, beanie, viking horns, halo). P1 and P2 each pick a hat on the Hats screen; hats show in solo, Versus and on the ghost. A new hat is announced on the level complete screen.
- **Ghost:** your best run on each level replays as a hollow outline. It updates whenever you beat your time. A settings toggle hides it.
- **Versus:** a win counter per match (first to 3). Nothing saved for Versus.
- **No daily challenge.**

## 8. Screens and UI flow
```
Title ──Play 1P / Play 2P──▶ Playing / Race (last level played) ──▶ Level complete ──Next/Retry/Menu
  ├─Levels──▶ Mode select (Solo | Versus) ──▶ Level select ──▶ Playing ⇄ Pause
  ├─Hats
  └─Settings
Versus: Mode select (Versus tab) ──▶ Level select ──▶ Race ──▶ Round result ──▶ … ──▶ Match result (Rematch / Levels / Menu)
Any screen, portrait window ──▶ "Rotate your device" (game paused)
```
- **Title:** logo with an idle hopping square, two big buttons, **Play 1P** (solo) and **Play 2P** (versus), then **Levels**, **Hats** and **Settings** (sound on/off, music on/off, show ghost on/off). One click from title to playing: both Play buttons go to the last level played, solo or versus (saved as `last`). With no level played yet, they start the first level not finished yet, in world and level order (Hop 1 for a new player).
- **Mode select:** Solo / Versus toggle at the top. One card per world (the four core worlds, then any Lab worlds, marked "LAB"), each with an animated mini schematic of its button meaning, name and levels finished (solo only).
- **Level select:** 10 tiles per world in 2 rows of 5, each with its number and best time; the first level not finished yet is highlighted. Versus uses the same grid without times.
- **Hats:** a grid of the 8 hats, locked ones shown as outlines with the number of levels needed; tap one to put it on P1 or P2.
- **Playing HUD (solo):** world-level label (e.g. "1-5") and timer top center, ghost's best time under it, pause and restart buttons top right, drawn as ink discs with the icon cut out in the world's background color and a thin background-colored rim, so they read over the background and over ink level pieces alike. From level 2 on, the mode's button hint (e.g. "Hold: charge · Release: hop") shows for the first 3 s and always in the pause menu. The HUD sits in the margin above the level where the screen allows, and never covers the flag.
- **Playing HUD (Versus):** P1's key letter and three square pips top left, P2's top right, as plain dark text with no panels; the world-level label, pause and restart sit top center. A 3-2-1-GO countdown before each round; input is ignored until GO.
- **Pause:** Resume, Restart, Levels, Settings. The game pauses itself when the tab is hidden.
- **Level complete:** time counts up, then the gap to your old best pops in ("-0.3" or "+1.2") with the best under it, "New best!" if it is one (a first finish shows only the time), a new hat if one unlocked, Next / Retry / Menu. Next is the default action (Space/Enter).
- **Round result (Versus):** winner banner with letter and color, pip fills, auto-continues after 1.5 s or on any fresh key press after the input lock. The next round is a random level of the same world, with no repeats until every unlocked level of the world has been played (the picked level starts the match; restart keeps the round's level; Rematch starts on a random level). **Match result:** big winner, Rematch / Levels / Menu.
- **Results input lock:** on the level complete, round result and match result screens, input is ignored for the first 0.6 s, and a button held down from gameplay must be released and pressed again before it counts. A player mashing across the finish line never skips their result.
- **Rotate screen:** a phone icon turning sideways and "Rotate your device". The game resumes where it was when the window is landscape again.

## 9. Art direction
- **Family:** Two-tone minimal. It is outside the three art families in the README (closest to Toybox Flat with everything removed), so the team must agree; see §14. Mockups: the "D" frames on the Hop Race Art Direction canvas.
- **Rule:** each screen has one flat background color, and everything solid is one dark ink. No outlines on level pieces, no shading, textures, gradients or decoration. The players are the only other color, so the eye always finds them.
- **Palette:** 7 colors in all, at most 5 on screen at once (one more than the 4–6 in `STANDARDS.md`; see §14). Climb shares Rocket's coral (§14). Yellow is Hop's and also the "home" color of the title and menus.
  | Hex | Role |
  |---|---|
  | `#1D1A22` | Ink: every solid, googly eye pupils, text, HUD, aim dots |
  | `#FFFFFF` | Googly eyes, player letters, checkered flag cells, ice hatching, buttons, hook tip, confetti |
  | `#2E5BFF` | Player 1 (and P1's launcher, rockets, blasts, rope, hook, drops and gas) |
  | `#E5262B` | Player 2 (and P2's launcher, rockets, blasts, rope, hook, drops and gas) |
  | `#FFC94A` | Background, World 1 Hop; title and menus |
  | `#FF8C69` | Background, World 2 Rocket and World 4 Climb |
  | `#7FD1C7` | Background, World 3 Grapple |
- **Key visuals:**
  - **Players:** flat squares with no outline. Each has one big googly eye (about 60 % of the square's width) that sticks out past its top corner: a plain white ball with no outline and an ink pupil. The pupil is loose: it lags behind and swings with the player's motion (charging, launch, landing, sliding), which carries most of the character. P1 is blue with a white **A**; P2 is red with a white **L**. They differ in hue and letter, never in color alone: the letter is always there, and blue and red stay apart for the common types of color blindness (red reads as a dark brown). P2 can't be white (the eye would blend into the body) or any other palette color (each is a world background or the level ink).
  - **Level pieces:** solid ink shapes; each element is told apart by its silhouette (see §5): hatched top for ice, sawtooth face for grip walls, bumpy top for sticky floors, hollow for no-grip, bars for gates.
  - **Phase:** liquid is solid drops in the player's color; gas is hollow rings in the player's color, so liquid and gas never look alike.
  - **UI:** dark text on the world color, square pips, icon buttons without panels. Menus use the same two tones; world cards take their world's color.
  - **Font:** a heavy grotesque (the mockups use Archivo ExtraBold). Embed a subset as a woff2 file (it is open-licensed), since the game may not load Google Fonts; fall back to `system-ui` at weight 800.
  - Everything is drawn with engine rectangles and polygons; no image files.
- **Juice list:** with no decoration, motion carries the charm, so every item here is required, not optional. Googly pupils wobble on every jump, landing and bump; each eye blinks every 2.5–5 s (sometimes twice), on its own timer so P1 and P2 never blink in sync; after 5 s standing still, the pupil darts left and right furtively, then rests in the middle and repeats, until the player moves or charges; while you charge in Hop, the pupil looks along the aim and follows its sweep; squash down toward the floor while charging, deeper the more power is charged (up to 45 % flatter at full charge), leaning back like a \ when facing right as power and aim height build (up to 0.25 u at full power and the highest aim), with the eye opening up to 15 % bigger; the lean and the bigger eye let go on launch, where the stretch takes over; past full charge, as the aim sweeps back down toward a long flat hop, the squash eases into a squeeze from the sides (at the flattest aim 0.44 u wide and 0.64 u tall, still shorter than the 0.8 u square) and the top leans forward into the hop, feet planted, like a / when facing right (up to 0.25 u), with the eye squinting (up to 35 % narrower) and sitting 0.08 u lower; a lunge launches in that pose (no stretch), keeps it for the first 35 % of the jump and eases back to square by the time it would land back at launch height (at least 0.3 s); on landing, a short squeeze (held flat for a moment, deeper on harder landings, then a small spring back past square), stretch on launch; ink dust puffs on landing; white sparkle while sliding on ice; flatten on sticky floors; short trail while airborne; blast ring and splash in the owner's color and a short screen shake for rockets; small shake when a hook sticks; splash on melt, puff on evaporate, snap on freeze; white confetti and a stretch pop on finish (no slow-mo: it dropped the frame rate); one soft, lighter pulse of the background on finish (never repeated or strobing); count-up time and gap pop; eased slide-in for every panel; button press bounce.
- **Concept art prompts:** *"Minimal two-tone platformer, flat warm yellow background, all platforms solid near-black shapes with no texture, one blue square character with a white letter A and one red square character with a white letter L, no outlines, each with one big googly eye, dotted square aim trail, black-and-white checkered racing flag on a black pole, bold flat vector, 16:9."* Per world: swap the background to coral with "blue and red rockets and blast rings, hatched icy floor" (Rocket), teal with "black rope to pillars hanging from the ceiling" (Grapple), yellow with "square melting into a stream of drops on tilted black bars, a black grate with gaps, hollow rings of gas rising" (Phase).

## 10. Audio
| Sound | When | Character |
|---|---|---|
| Charge tick | While holding, rising pitch with power; in Hop, past full charge it keeps rising as the aim drops into the flat lunge (up to 2.6× the base pitch) and falls back as the aim swings up | Soft blip |
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
| New best / new hat | Beating your best time / unlocking a hat | Short fanfare |
| UI click | Any button | Tiny click |

All synthesized with ZzFX through `SoundGenerator`. Sound on by default, toggle persists. **Music:** none in v1; the music toggle exists (off) for later.

## 11. GameAnalytics
Worlds map to ids: Hop `world01`, Rocket `world02`, Grapple `world03`, Phase `world04` (rejected; the id stays reserved and unused), Climb `world05` (its id from its Lab days, kept); new Lab worlds take the next ids. The HUD numbers worlds as shown, so Climb, World 4, reads "4-1" even though its id is `world05`. Levels `level01`–`level10`.

| Event id | When it fires | Value |
|---|---|---|
| Progression `Start:world0N:level0M` | Solo level starts (first input) | — |
| Progression `Complete:world0N:level0M` | Solo level finished | Time in ms (score; lower is better) |
| Progression `Fail:world0N:level0M` | Solo level left by restart or quit before finishing, only if `Start` was sent for this attempt | Time played in ms |
| `tutorial:step01` | First hold in Hop 1 | — |
| `tutorial:step02` | First jump in Hop 1 | — |
| `tutorial:step03` | First landing in Hop 1 | — |
| `tutorial:done` | Hop 1 finished | Time in ms |
| `mode:<hop\|rocket\|grapple\|phase\|climb>:<solo\|versus>` | A level or match starts | — |
| `versus:round:<p1\|p2>` | A Versus round is won | Round time in ms |
| `versus:match:<p1\|p2>` | A Versus match is won | Rounds played |
| `player:respawn:<mode>` | With each solo Complete or Fail | Falls back to the start in that attempt |
| `hat:unlock:<name>` | A hat unlocks | Levels finished |
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
- **Save keys:** `cm_hop-race_save` = `{v: 1, levels: {"hop-01": {bestMs}}, last: "hop-01", hats: {p1, p2}, settings: {sfx, music, ghost}}`; ghosts in `cm_hop-race_ghost_<levelId>`. Unlocked hats are computed from the levels finished, not stored. Older saves may still hold a `stars` field per level; it is ignored. All reads wrapped in `try/catch`; a broken save resets to defaults. Saved after every level complete, hat change and settings change, and when a different level starts (`last`).
- **Testing hook:** `window.game` with `screen`, `level` (id), `mode`, `versus`, `score` (time or wins), and `start(levelId)`, `restart()`, `win()` (debug only, stripped from release). `screen` uses the standard values `'title' | 'levels' | 'playing' | 'complete'` plus `'modes'` (counts as `levels`), `'hats'` (counts as `title`), `'paused'` and `'rotate'` (count as `playing`), `'round'` and `'match'` (count as `complete`).
- **Level editor (debug only):** `tools/editor.js`, loaded by `index.html` but not `build.json`, so release builds never have it. `E` opens it over the real level: drag to move and resize solids, the start, the flag, the prompt and Rocket's gates; play-test in place (a test run saves no time or ghost); for Hop levels, run the bot and see its route and dead ends. Save writes only the edited levels into `levels/<world>.js` (Chrome's file access), keeping comments and Climb's seeded teeth.
- **Riskiest piece:** turning 6 hand-tuned one-level modes into 40 smaller, data-driven levels without breaking their feel, especially Phase (drop physics tuned to specific slab angles, a flag position computed from the last slab, the new press cycle and grates) and the jump and blast ranges in a smaller box. Prove it in the slice: load the prototype's levels from data at their old size (`size: 42`) and confirm each plays the same, then retune ranges for 24–30 u levels and build Hop 1–3.

## 13. Scope
- **v1:** 4 worlds (Hop, Rocket, Grapple, Climb) × 10 levels; solo time trial with best times and ghost; 8 hats unlocked by levels finished; 2-player Versus on any level; full shell (title, mode select, level select, hats, pause, restart, complete, settings, rotate screen); mouse, keyboard and touch; any landscape aspect from 4:3 to 21:9; saving; GameAnalytics; `window.game`.
- **Build order:** worlds are built Hop → Rocket → Grapple → Climb. Phase was the original fourth world and has been rejected (below); Climb grew from a Lab world to take its place (2026-10-22).
- **Vertical slice (phase 2):** Hop levels 1–3 from data, solo with timer, best times and ghost, Versus on the same levels, full shell, saving, analytics stubs logging to the console.
- **Lab worlds:** see 13.1. They don't change the v1 list above until one graduates.
- **Later:** 3–4 player Versus (needs a keyboard ghosting test first); CPU opponent; more modes on the one-button idea; best-of-N options for Versus; more hats; 12 levels per world if players want more; unlock gates (`'linear'`) if the data shows players skip around too much.
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
- **Rejected modes:** built and played, then dropped. A rejected mode is hidden in the game (`hidden: true` in `HR_WORLDS`: no card, no levels, not reachable from Play or `window.game.start`), but its code, levels and GDD section stay for reference.
  - **Phase** (§3.5, rejected 2026-10-22): the owner played levels 1–3 and found it "very weak". Built: the press cycle (solid → liquid → gas → solid), drop physics from the prototype's Flow, and levels Melt, Switchback and Spill. `src/modes/phase.js` and `levels/phase.js` are kept; GA id `world04` stays reserved.

### 13.1 Lab worlds (finding the fun)
New physics and new meanings for the button keep being tried while the core worlds are built. Each one goes through the same short loop, so trying an idea is cheap and cutting one is normal:
1. **Pitch:** a few lines in chat or a short §3.x entry: what hold/press/release means, what levels it wants.
2. **Feel test:** the mode in `src/modes/<id>.js` and **3 levels** in `levels/<id>.js`, listed in `HR_WORLDS` with `lab: true`. The menu shows it after the core worlds with a "LAB" tag; its "done" count counts only its own levels. Its GDD section says "Lab world, feel test". Uncertain choices go behind a switch in the mode's tuning object, so both versions can be played.
3. **Call:** the owner plays it (and a teammate cold, if possible) and decides: **keep** as a Lab world for now, **grow** it into a full world (10 levels, its own background color if the palette allows, §6 outline, hats rebalanced, and it joins the v1 list in §13 by owner and teammate decision), or **cut** it (remove its files and world entry, and move it to Cut below with the reason).
- Lab worlds are kept to one 16:9 screen with the fixed camera like every other world, and they follow §3.1 (start, falling, flag, Versus).
- Lab levels don't count toward hats until the world graduates, so cutting one never takes a hat away.
- **Current Lab worlds:** none. Climb (§3.7), the first, grew into World 4 on 2026-10-22.

## 14. Open questions
| Question | Recommendation | Who decides | Status |
|---|---|---|---|
| World 4's name: "Phase" is a working name | Moot: Phase is rejected (§13). | Pao | Closed |
| Hats: thresholds assume 40 core levels (3 … 40), but v1 had 30 after Phase was rejected | Moot: Climb grew into World 4, so v1 is 40 levels again and the thresholds stand. | Pao | Closed |
| 3–4 players on one keyboard? | Not in v1: many keyboards can't register 3–4 held keys at once, and touch quarters are too small. Revisit with a ghosting test. | Pao | Later |
| Mouse in Versus: let a mouse click count as P1 so a mouse + L pair works? | Yes, cheap and removes the "Versus needs a keyboard" caveat. | Pao | Open |
| Hats now unlock by levels finished, so they reward finishing, not speed. Should any reward speed? | Not now: the ghost and the gap to your best already reward speed. If the data shows players stop replaying, try one hat per world for beating a time shown only after you finish the whole world. | Pao | Open |
| Jump and blast ranges in 24–30 u levels | Hop's top jump speed is now 20 u/s (−20 %). Rocket blast is 24 u/s, top speed 22 u/s (both −20 %); keep the aim sweep and charge time. Grapple keeps the prototype's numbers (hook 55, reel 95 u/s² up to 26 u/s, top 32 u/s); the levels are sized to them. | Pao | Hop, Rocket, Grapple done |
| Hop 1-4 The Wall needs improvement (owner, 2026-10-23) | Reason not written down yet. Play it and note what is wrong, then rework it in the editor and re-run the bot. | Pao | Open |
| Player-to-player collision? A cold playtester (Hop, 2026-10-21) said bumping into the other player might be exciting | Recorded only, no change to bodies yet: players still pass through each other (§3.1). Rocket blasts now push both players (3.3), which tests some of this idea. If it is tried, make it Versus-only and light (a bump that trades some speed, no pushing off ledges) and playtest it against the pinning problem. | Pao | Open |
| Phase 3 needs the double press (liquid → gas → solid), but only level 1 shows a prompt; from level 2 the hint "Press: next state" is all there is | Play it cold first. If players don't find the hop, give level 3 a prompt too ("Press twice to stop."), as a second teaching level of the world. | Pao | Moot (Phase rejected) |
| Phase 1 and 2 are a single press and then watching (2 takes 11 s with no faster way) | Fine as the feel test of the liquid; if 2 drags, shorten its slopes. Pressing again mid-pour turns you to gas, which floats off the open top and back to the start. | Pao | Moot (Phase rejected) |
| Phase finish needs 40 of 49 drops: too strict for the younger end (9–12)? | Keep 40; if playtests show frustration, drop to 35. | Pao | Moot (Phase rejected) |
| Art direction: two-tone minimal is outside the three art families | Owner chose it over Toybox Flat (too close to an existing pastel one-button game), wind-up toys, dusk storybook, paint daubs, broken-color painting and a garden world. The team agrees, then the README lists it as a fourth family or as a Toybox Flat variant. | Team | Open |
| P2 red makes 7 colors, one over `STANDARDS.md`'s 4–6 | Keep: no palette color works for P2 (each is a world background or the ink), and white hid the eye. Teammate agrees or proposes a merge. | Team | Open |
| Grapple launcher: reverse the spin on each shot? | Without it, after letting go the launcher swings backward and the next pillar is rarely in reach before you fall: in 3-2 a bot never catches the second pillar in mid-air. It finishes 20 of 169 hold pairs (49 with reversal), each with one long fling from the first pillar or a second shot fired from standing. Play both; if no reversal stays, rework 3-2. | Pao | Decided 2026-10-22 (owner): no reversal, and the launcher turns clockwise. Clockwise didn't make 3-2 worse: a random bot finishes 55 of 200 runs (41 counterclockwise). |
| Climb: what should letting go do? | Decided 2026-10-22 (owner): letting go stops the arm, and a stopped head grips what it touches. Now testing a coast (the arm slows to a stop in 0.3 s, and a coasting head sticks on touch): random play finishes 5-3 far more often (112 vs 7 of 200 with a new bot), and holding alone still fails 5-2 and 5-3. Set `coastTime` to 0 for the dead stop. The first version (the head stuck to everything and turning levered you slowly) was too easy: holding finished every level. Its `letGo` switch, which let the head pass through solids after release, is gone. | Pao | Testing coast |
| Climb 3: is a 9 u sheer wall too hard? | Yes (owner, 2026-10-22). Teeth on the wall face fixed it. Bigger teeth alone made it worse: holding alone won on 58 of 60 random layouts, because big ledges give blind strikes more to pop off. A 3.5 u pit at the foot of the wall fixed that: holding alone failed on all 40 layouts tried, so the teeth can be bigger and varied. | Pao | Done |
| Climb: teeth re-rolled on every attempt? | No: each level's teeth come from a fixed seed. Re-rolling would break best times, the ghost and Versus fairness. If variety is wanted, a "new wall" daily or per-match seed shared by both players could work later. | Pao | Open |
| Climb: can a ceiling be a route, not just a rest? | No, and not pursued. A test level (Climb 4 Hang Time, 2026-10-22) showed a ceiling hang is only a rest: whipping from it levers you backward or drops you, and no layout needed it. The owner cut the level ("ceiling sucks"). The pendulum-hang idea is dropped with it. The suction cup still sticks to ceilings; no level uses one. | Pao | Done |
| Climb: is the suction cup worth keeping? | Random play finishes 5-3 just as often with it (137 of 200) as without it (136 of 200), so its value only shows with a player who uses it on purpose. Play it and compare with `HR_CLIMB.suction = false`. | Pao | Open |
| Climb: keep, grow or cut? (§13.1) | Decide after playing Climb 1–3. If it is kept, the next step is levels that need the release (gaps, overhangs where hanging still matters) rather than more height. | Pao | Decided 2026-10-22 (owner): grow. Climb is World 4. |
| Climb's background: it shares Rocket's coral | Keep coral for now: the palette is already one color over `STANDARDS.md`. Hop's yellow is free of a second world since Phase was rejected, so Climb could take yellow instead; a new color would make 8. | Pao | Open |
| Coolmath SDK, ad breaks (between levels only), size limit, GA keys | Follow `STANDARDS.md` once the shared [confirm]s are answered. | Team | Open |

## 15. Changelog
- 2026-10-23 — Hop: charging toward a high hop leans back (\) with a bigger eye, the mirror of the flat lunge's /.
- 2026-10-23 — Hop: a lunge flies in its / pose and eases back to square over the jump.
- 2026-10-23 — Hop: the lunge pose is narrower (0.44 u wide) and its eye sits 0.08 u lower.
- 2026-10-23 — Hop: the lunge pose stays shorter than the square: 0.52 × 0.64 u at the flattest aim (was 0.52 × 0.94).
- 2026-10-23 — Hop: the lunge lean flips to forward (a / when facing right) and the eye squints, up to 35 %.
- 2026-10-23 — Hop: in the flat lunge the player also leans back (top 0.25 u behind the planted bottom at the flattest aim).
- 2026-10-23 — Hop: the charge ticks keep rising past full charge as the aim drops into the flat lunge, matching the side squeeze.
- 2026-10-23 — Hop: while you charge, the googly pupil looks along the launch direction, the only hint for the aim now that the arrow is gone.
- 2026-10-23 — Hop: the aim arrow and the power bar are removed; the player's squash (flatter with power) and the new side squeeze (as the aim drops flat past full charge) are the only charge feedback.
- 2026-10-23 — Hop: the dotted arc that previewed the whole jump is replaced by a short arrow along the launch direction (player feedback: seeing where you land took the thrill away). It grows a little with power and sits 1.3 u out so it clears the power bar.
- 2026-10-23 — HUD pause and restart buttons are ink discs with the icon and rim in the background color, so they stay visible over ink (levels such as Rocket 2-4 Rapid Fire and the Climb 4 draft run walls up under them).
- 2026-10-23 — Rocket: new level Rapid Fire (`rocket-11`, made in the editor from the owner's sketch), live as 2-4: blast up a tall left wall, then over a tower to the flag.
- 2026-10-23 — Climb 4-3 The Wall: the lower tooth sits at y −5 (was −4.5).
- 2026-10-23 — Climb (testing): on a wall, quick presses no longer peel the cup off. A press under 0.2 s creeps the arm around the stuck cup at 2 rad/s, levering the body; a longer hold peels and whips. Floors and ceilings peel on any press, as before.
- 2026-10-23 — Climb 4-3 The Wall: the wall is 7 u (was 9) with two teeth (was three), flag at (12, 1). Grapple 3-3 Let Go: the ceiling past the flag is higher (y 7.1–7.9) and starts at the pillar (x −5).
- 2026-10-23 — Rocket 2-1 Blast Off: the middle block is 3 u tall (was 4) and the flag is at x 10.25 (was 9).
- 2026-10-23 — Versus rounds are random levels of the world instead of the same level every round; no repeats until the world has been played through.
- 2026-10-23 — First levels made in the editor: 1-6's ceiling sits 2.5 u over the gap (was 2), 2-1 Blast Off has one 2 × 4 u block in the middle instead of two low bumps, and 2-3's gate button moved to the top left (-10.5, 4.5).
- 2026-10-23 — Level editor (`tools/editor.js`, debug only): press E on any level to edit it in place, play-test it, check it with the bot (Hop) and save it straight into `levels/<world>.js`. Only edited levels change in the file; their comments and Climb's `hrClimbTeeth(...)` line are kept.
- 2026-10-23 — Fixed: jumping from some floors teleported you to the floor's left side (and onto its face if it was grip, as on 1-9's top ledge). Rounding put your feet a hair inside the floor (1.4 − 0.4 = 0.9999999999999999), so takeoff treated it as a wall. Hop's wall check now ignores the floor you stand on, as Rocket's and Grapple's already did.
- 2026-10-23 — Grip walls: the slide while charging drops from 1.5 to 0.5 u/s (owner: climbing took too many wall jumps). From the 1-7 test cling, about 32 of 50 hold lengths climb (26 at 1.5).
- 2026-10-23 — Grip walls stop you on contact, even moving up fast: a hard launch used to ride up the whole wall (owner: wall climbing should be the only way). You face away from a grip wall you land against, so a jump from its foot crosses the shaft instead of clinging straight back on. With grip walls turned plain, the bot can't finish 1-7 to 1-10.
- 2026-10-23 — Grip walls: charging slows your slide to 1.5 u/s instead of stopping it (owner: holding still was too easy). From a cling in 1-7, 26 of 50 hold lengths climb (39 when holding still, 7 with the full 3 u/s slide), the earliest at 0.45 s. `HR_HOP.clingChargeSlide` replaces `gripWhileCharging`.
- 2026-10-23 — Grip walls hold you still while you charge (owner: "I slide down before I can climb up"). Before, you slid at up to 3 u/s while charging, so only holds of 0.7–0.9 s gained height in a 3 u shaft (3 of 25 tried); now 13 of 25 cling higher from 0.3 s on, and 7 more land on top of the wall. Behind `HR_HOP.gripWhileCharging`.
- 2026-10-23 — Hop 4–10 built (The Wall, Thin Ice, Low Ceiling, Grip, Which Wall?, Slide and Climb, The Gauntlet), all checked by a new bot (`tools/hop-bot.js`): every level finishes, no dead ends. Hop's ice is built (it was only drawn before): walls and non-ice floors stop a slide. Which Wall? changed from the outline: a cliff with a plain foot and a grip top half, plus a grip pillar to zigzag on, because bouncing off a plain wall (35 %) can't climb a shaft.
- 2026-10-22 — Launcher, rope and hook take the player's color instead of ink, so they stay visible when they cross an ink floor or pillar (a launcher pointing down used to vanish into the floor). Rockets and blasts were already in the owner's color.
- 2026-10-22 — Climb grows into World 4 (owner decision): v1 is Hop, Rocket, Grapple and Climb, 40 levels again, so the hat thresholds stand (§14 closed). Climb's "LAB" tag is gone and its levels count toward hats; 4–10 are still to outline. Its GA id stays `world05`. It keeps Rocket's coral for now (§14). No Lab worlds are running.
- 2026-10-22 — Phase rejected (owner: "very weak"). Hidden in the game with `hidden: true` in `HR_WORLDS`; code, levels and §3.5 kept for reference. v1 is three worlds, 30 levels. The HUD numbers worlds as shown (Climb is now "4-x"). New §13 list, Rejected modes; hat thresholds to rebalance (§14).
- 2026-10-22 — Grapple: the launcher turns clockwise, like Rocket's; no reversal on firing (owner decision, §14 closed).
- 2026-10-22 — Rocket: the launcher always turns clockwise; firing no longer reverses it (owner decision).
- 2026-10-22 — Rocket gets Grapple's dotted sight line: it runs along the launcher's aim to the first solid or unpressed button, and hides during the cooldown.
- 2026-10-22 — Stars removed (owner decision): levels are scored by time only. Par and expert times are gone from the level data. The level complete screen shows the time and the gap to your old best; tiles show the best time; world cards show levels finished. Hats unlock by core levels finished (3 to 40). The `level:stars` event and the star chime are gone. The unlock rule `'stars'` is removed; `'linear'` now means "finish the level before".
- 2026-10-22 — Title: **Play** becomes **Play 1P** and **Play 2P**. Both go to the last level played (new save field `last`) instead of the first level under 3 stars, which is now only the fallback for a new player.
- 2026-10-22 — Phase built (`src/modes/phase.js`) with levels 1–3: Melt, Switchback, Spill. Level 3 is "stop before the edge": the first use of the liquid → gas → solid hop. The flag's counting box reaches 1 u below the pole's foot. Built numbers in §3.5.
- 2026-10-22 — Climb: after letting go, the arm coasts to a stop in 0.3 s (`HR_CLIMB.coastTime`) instead of stopping dead; a coasting head sticks to the first surface it touches. Holding is unchanged.
- 2026-10-22 — Climb 4 Hang Time removed: ceiling hanging wasn't fun or useful. Climb is back to 3 levels.
- 2026-10-22 — Climb: the stuck head is drawn as a suction cup (half disc flush on the surface, white lip, squash on landing) instead of a white dot. Climb 4 Hang Time added, a level to try sticking to the ceiling. Lab worlds can have more than 3 levels while they are being tested.
- 2026-10-22 — Climb: when stopped, the head is a suction cup that sticks to any surface on touch (ceilings too) and holds your weight until you hold again. Climb 3: three bigger teeth of varied size, from a fixed seed (`hrClimbTeeth`), and a 3.5 u pit at the foot of the wall, so holding blindly falls in.
- 2026-10-22 — Climb 3 gets two teeth on its wall (0.4 u ledges at heights −2 and 1): the sheer wall was far too hard.
- 2026-10-22 — Climb reworked after the owner played it: holding whips the arm at 10 rad/s and a strike pops you (about 4.8 u up); letting go stops the arm and the head grips what it touches. The arm is always solid (the head no longer passes through solids after letting go), and the body no longer grips walls. Climb 2's pit is 3.5 u so holding blindly falls in. Tutorial prompt "Hold to swing. Let go to stop."
- 2026-10-22 — Lab worlds (§13.1): a way to keep trying new button meanings with a 3-level feel test, then keep, grow or cut. First one: Climb (§3.7), a clockwise-turning arm whose head sticks to solids, inspired by Getting Over It, with 3 levels (Roll Along, Boulders, The Wall). The mode select shows one card per world, Lab ones tagged "LAB". Analytics: Climb is `world05`.
- 2026-10-22 — Grapple 1 and 3 get a ceiling over the right side, so overshooting the flag is no longer a soft lock. Ceilings that touch the box edge stop at the side wall when drawn.
- 2026-10-22 — The level box's side walls are drawn (0.5 u ink walls); before, they collided but were invisible.
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
