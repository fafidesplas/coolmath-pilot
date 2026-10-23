# Hop Race — devlog

## 2026-10-22 — Grapple: the launcher turns clockwise
- Owner decision: Grapple's launcher turns clockwise like Rocket's, and firing doesn't reverse it (`reverseSpin` stays off). It still starts pointing up and forward and freezes while the hook is out.
- Bot check (Chrome, 200 random hold/release runs per level, same seeds both ways), clockwise vs the old counterclockwise: 3-1 81 vs 74 finishes (best 1.1 vs 1.4 s); 3-2 55 vs 41 (best 1.3 vs 1.7 s); 3-3 57 vs 38 (best 1.3 vs 1.5 s). Falls per run about the same or lower. Holding alone fails every level both ways. No errors.
- So clockwise doesn't make 3-2 worse; the GDD §14 question on reversal is closed. Bot times are not human times.
- Next: unchanged (play 4-1 to 4-3), plus a replay of 3-1 to 3-3 to feel the new direction.

## 2026-10-22 — Rocket: the launcher always turns clockwise
- Owner decision: firing no longer reverses the launcher. It always turns clockwise at 3 rad/s (before, it started counterclockwise and flipped on every shot). The mode select schematic already turned clockwise.
- It still starts pointing down and back, so a press right away blasts you up and forward. After a shot you now wait for the launcher to come round again instead of it swinging back toward where it was.
- Rocket 1–3 aren't re-checked with a bot yet: aim windows after a shot change, so play 2-1 to 2-3 to see whether any chain of shots got harder.
- Next: unchanged (play 4-1 to 4-3), plus a quick replay of 2-1 to 2-3.

## 2026-10-22 — Rocket: dotted sight line
- Owner asked: an aim line on the Rocket launcher like Grapple's. Same look (faint ink dots 0.7 u apart, fading with distance, up to about 17 u). It stops at the first solid, gates included, or at an unpressed button, which is where the rocket would explode. Rockets fly straight, so the line is exact. It hides during the 0.1 s cooldown, the same as Grapple hides it while the hook is not ready.
- It doesn't stop at the other player in Versus, so it doesn't point the other player out as a target.
- Headless check (Chrome, 1280×720): 2-1 and 2-3 draw it with no errors; pointing into the floor shows no dots.
- Next: unchanged (play 4-1 to 4-3).

## 2026-10-22 — Stars removed: times only
- Owner decision: no star system; a level is scored only by its time. The target is your own best, which the ghost already replays.
- Level data: `par` and `expert` removed from all levels. Save: each level stores only `bestMs` (an old `stars` field is ignored, so existing saves keep their times).
- Level complete: the time counts up, then the gap to your old best pops in ("-2.0" with "Old best 8.3", or "+1.2" with "Best 6.3"). A first finish shows only the time. The fanfare for a new best plays at 0.9 s instead of after the stars.
- Level select: tiles show the best time; a tile with no time shows its number centered. The highlight and the Play fallback go to the first level not finished yet. World cards show levels finished ("1/10 done") instead of a star total.
- Unlock rule: `'stars'` removed; `'linear'` now means "finish the level before". GA: `level:stars` removed.
- GDD: hats (not built yet) now unlock at 3, 6, 10, 15, 20, 25, 32 and 40 core levels finished. New open question in §14: should any hat reward speed?
- Headless check (Chrome, 1280×720 and 800×450): first finish, new best and slower run on 1-1 all show the right gap and save the right best; Play with no `last` goes to 1-2 after 1-1 is finished. No script errors.
- Next: unchanged (play 4-1 to 4-3).

## 2026-10-22 — Mode select: one schematic per world
- Owner noticed: every world card showed the same hop animation. Each card now loops its own button meaning, drawn with the world's own pieces:
  - Hop: squashes while the aim arc fades in, then hops along it.
  - Rocket: the launcher spins; at the press it points down and back, a blast ring goes off at the feet and throws the square up and over.
  - Grapple: the hook flies to the ceiling, the square swings across the gap on the rope, lets go and lands on the far ledge.
  - Phase: solid square, melts into a puddle, rises as gas rings, condenses at the top and falls back as a square (a seamless loop).
  - Climb: the arm turns clockwise over the top until its head sticks to a step as a suction cup, then levers the body up onto it.
- Checked with a contact sheet of each loop at 8 times, and the mode select at 1280×720 and 800×450.
- Next: unchanged (play 4-1 to 4-3).

## 2026-10-22 — Title: Play 1P and Play 2P
- Owner asked: two Play buttons on the title instead of one, both going to the last level played instead of Hop 1.
- **Play 1P** starts it solo and **Play 2P** starts it as a versus race. The last level started (solo or versus) is saved as `last` in `cm_hop-race_save`. A new player with no `last` still gets the first level under 3 stars. Play 1P has keyboard focus.
- Headless check: a new save goes to hop-01. After phase-02, 1P goes to phase-02 solo and 2P to phase-02 versus. After a versus race on rocket-02, 1P goes to rocket-02, and it still does after a reload. The title fits at 1280×720 and 800×450.
- GDD §8, §12 and changelog updated.
- Next: unchanged (play 4-1 to 4-3).

## 2026-10-22 — Phase: the eye no longer jumps through slabs
- Owner noticed: as gas (or liquid), the eye could jump through a slab. It was drawn at the center of all the drops, so when the drops split around a slab or wrapped around its end, that center landed inside the slab or on its far side.
- The eye now rides one drop (the square's middle one, or the drop nearest the eye if that one is lost) and sits at the center of the drops within 3 drop sizes of it. Drops can't pass through a slab, so the eye can't either. As gas it no longer floats 0.25 u up into the ceiling it presses against.
- Condensing pulls the rings toward the eye, and the square packs at the eye. Before packing, it is pushed out of the level from the eye's side. Before this change, a square that packed under a slab could pop up through it.
- Headless check (4-2, gas wrapping around the middle slab): the old center was inside the slab for 16 and 8 frames in two runs. The new eye was never inside, and squares packed under the slab stayed under it.
- Next: unchanged (play 4-1 to 4-3).

## 2026-10-22 — Phase: World 4 prototype, levels 1–3
- New mode `src/modes/phase.js`, ported from the prototype's Flow with the GDD's press cycle: each press goes solid → liquid → gas → solid. Presses under 0.15 s apart and presses while condensing are ignored. The drop physics (pour, heap, friction) is the prototype's. Gas rises and drifts. Condensing pulls the rings together for 0.5 s, then packs them into a square that falls. Drops below the kill line are lost; under 12 drops, or gas floating off the top, sends you back to the start. Finish: 40 drops touching the flag.
- Drawing: tilted ink slabs; a tilted square with its letter and eye while solid; filled drops while liquid; hollow rings while gas. The eye floats with the drops. Splash on melt, puff on evaporate, a click and a stretch on freeze. New sounds: melt, evaporate, freeze.
- Shared hooks (game folder only): `hrRespawn()` in `player.js`; optional mode hooks `finished(p)`, `drawPlayer(p, nudge)` and `warp(p)` (used by `window.game.win()`).
- Levels: 4-1 Melt (one slope), 4-2 Switchback (three slopes), 4-3 Spill (stop before the edge, hop across the pit, melt again). Headless bot (Chrome): 4-1 3.3 s and 4-2 10.9 s with one press. 4-3: one press always falls in; the hop works when you evaporate up to 1.5 u before the edge or up to 1.7 u past it (0.4–0.6 s); best 6.8 s. No errors in Solo or Versus.
- Finding: the flag box ended at the pole's foot, but on a slope the drops pool below it, so only 17 counted. Phase now counts 1 u lower.
- Par/expert are placeholders from bot times.
- Next: play 4-1 to 4-3. Does a cold player find the double press in 4-3 with only the hint "Press: next state"? (GDD §14.) Then 4-4 first gas.

## 2026-10-22 — Climb: the arm coasts after letting go
- Owner asked: the arm should ease to a stop after release instead of stopping dead, to see if walls get easier to climb without making holding the answer.
- `HR_CLIMB.coastTime` (0.3 s): after release the arm slows evenly from 10 rad/s to 0 in 18 frames, turning about 85° more. A coasting head doesn't lever the body: on touch it stops and the cup sticks, so you can fling it onto a wall. `coastTime = 0` brings back the dead stop. Holding works exactly as before.
- Bot check (new random hold/release bot, 200 runs, so numbers differ from earlier entries; compare rows, not with older logs): 5-2 111 → 181 finishes (falls 2.8 → 1.1); 5-3 7 → 112 (best 8.4 → 4.5 s, falls 3.4 → 1.8). With 0.5 s: 5-2 190, 5-3 134. Holding alone still fails 5-2 and 5-3 at every setting. Head never deeper than 0.02 u in a solid.
- Next: play 5-3 and tune `coastTime` (0.15 is subtler, 0.5 is floatier). If the wall gets too easy, shrink the teeth back.

## 2026-10-22 — Climb: 5-4 Hang Time removed
- Owner played it: ceiling hanging isn't worth it. Level removed; Climb is 3 levels again. The pendulum-hang idea is dropped (GDD §14). The suction cup still sticks to ceilings, and its new look stays.
- Next: unchanged (play 5-1 to 5-3: is the suction cup fun, is the 5-3 pit fair).

## 2026-10-22 — Climb: suction-cup look, 5-4 Hang Time
- Stuck head drawn as a suction cup: an ink half disc whose flat side sits flush on the surface, with a thin white lip so the seal reads against ink, and a quick squash on landing. On a corner it snaps to the face it is more over, so it never sits at a slant. Checked in the browser on a ceiling, a wall face, a tooth top and a corner.
- 5-4 Hang Time (owner request, a level to test ceiling sticking): 9 u pit with a pillar, under a 1 u ceiling slab 4.5 u over the floor (a slab, not a block to the top, so the HUD stays off ink). Random play 183/200, best 3.5 s; holding alone fails.
- Finding: the ceiling is a rest and a steady drop point, not a route. A bot that lets go near the ceiling hangs in most of its wins, but wins as often with suction off; across 16 layouts none needed the ceiling. With the arm frozen while stuck and only clockwise turning, whipping from a ceiling hang levers you backward or drops you. Idea logged in GDD §14: let the body swing like a pendulum under a stuck cup.
- Next: play 5-4; decide whether to try the pendulum hang.

## 2026-10-22 — Climb: suction-cup head, varied teeth, pit at the wall
- Owner asked: when the button is up, the head acts like a plunger that sticks to any surface and holds your weight; bigger, randomized teeth so holding alone can't win.
- Suction (`HR_CLIMB.suction`, on): a stopped head sticks on touch (within 0.05 u) to floors, walls, teeth and ceilings and never peels off; only holding again releases it. Low "thwop" on stick. `suction = false` brings back the earlier grip, which peeled off when pulled away.
- Teeth: `hrClimbTeeth(seed, face, side, from, to)` in `levels/climb.js` makes ledges of varied size (0.5–1.1 u deep, 0.3–0.6 u tall, 2–3.2 u apart) from a fixed seed, so the wall is the same every attempt (best times, ghost, Versus).
- Finding: bigger teeth alone made holding win on 58 of 60 seeds (big ledges give blind strikes more to pop off). A pit at the foot of the wall fixed it: with a 3.5 u pit, holding alone failed on all 40 seeds. Picked seed 102947 (3 teeth): holding alone fails, all 10 single-release runs fail, 71 % of random runs finish.
- Bot check: 5-1 200/200 (holding alone also wins); 5-2 200/200 with about 2 falls per run; 5-3 157/200, best 4.1 s, about 5 falls per run. Holding alone fails 5-2 and 5-3. The random bot finishes 5-3 the same with or without suction (137 vs 136 of 200), so a human has to judge it.
- Next: play 5-3. Is the suction cup fun, and is the pit too punishing?

## 2026-10-22 — Climb 3: teeth on the wall
- Owner: 5-3 far too difficult. Added two teeth to the wall face (0.4 × 0.4 u ledges at heights −2 and 1, 3 u apart) to strike and grip.
- Bot check (300 random runs per layout): no teeth 5 %; 0.4 u teeth at −2 and 1: 61 %, and holding alone fails. Wider (0.6–1 u) or closer teeth went to 85–99 %, but holding alone won again, so they were left out. In the level: 138 of 200 random runs finish, best 4.2 s.
- Next: play 5-3 again. If it's still too hard, deepen the teeth to 0.6 u (holding alone may then win).

## 2026-10-22 — Climb: strikes pop you, letting go stops the arm
- Owner notes: too easy (holding alone reached every flag), and with `letGo` on the arm passed through the ground.
- New model (`src/modes/climb.js`): hold whips the arm clockwise at 10 rad/s; let go and it stops dead at its angle. The arm is always solid: when it would push the head into a solid, the body is pushed instead, and the head doesn't slip on the surface while turning, so a strike levers you. One swing from standing pops you about 4.8 u up and 4 u forward. A stopped head grips what it touches (perch on the arm, hang on a wall, catch a ledge by letting go). It lets go when you hold again or when gravity pulls it off. If the arm is wedged it can't turn, instead of phasing. Removed: the slow stuck lever, the `letGo` switch, the head passing through solids, and the body's wall grip.
- Fixed while testing: the jam fallback made the head grip while the button was held, which could lock you in 5-2's pit.
- 5-2's pit is now 3.5 u, so holding blindly falls in. 5-1 prompt: "Hold to swing. Let go to stop."
- Bot check (200 random hold/release runs per level): 5-1 200 finish (holding alone also wins, 7.9 s); 5-2 198 finish, about 1.8 falls per run; 5-3 10 finish, best 16.1 s, and holding alone stalls at the foot of the wall. Over 450 runs, neither the head nor the body ended a frame inside a solid. Friction tried at 1.2, 3 and 6: the wall can't be climbed below full friction.
- Next: play 5-1 to 5-3. If 5-3 is too hard, add a ledge or lower the wall (GDD §14). Tuning knobs: `spin` and `arm` in `HR_CLIMB`.

## 2026-10-22 — Climb: first Lab world (feel test)
- New mode, inspired by Getting Over It (`src/modes/climb.js`): a 2 u arm with a round head. Hold to turn it clockwise, let go to stop. The head sticks to any solid it hits; turning while it's stuck levers the body around it (a wheel on flat ground, a walk up a wall). Letting go while stuck holds you still. If the body would hit a solid, the head comes loose. In the air the body grips walls and slides down slowly, which is what makes a sheer wall climbable.
- 3 levels in `levels/climb.js`: 5-1 Roll Along, 5-2 Boulders (2.5 u pit, rocks stepping up), 5-3 The Wall (9 u sheer wall).
- Switch to try: `HR_CLIMB.letGo = true` makes release while stuck let go of the head, so you fly on with the lever's speed (a fling).
- Bot check (headless, same frame count as the browser: 5-3 in 8.567 s): holding all the time finishes all three (5.3, 6.5, 8.6 s). 200 random hold/release runs per level: with the default, every run finishes and the only falls are in 5-2's pit; with `letGo`, 100 % / 86 % / 64 % finish, with many more falls. A 3 u pit can't be crossed with the default and can with `letGo`. Takeaway: with the default these levels show the motion but don't test skill yet.
- GDD: §3.7 Climb, §13.1 Lab worlds (pitch → 3-level feel test → keep, grow or cut), open questions in §14. The mode select now fits 5 cards; Lab worlds get a "LAB" tag and a star total out of their own levels.
- Par/expert are placeholders.
- Next: play 5-1 to 5-3 both ways (`letGo` off and on) and decide what release should mean; then keep, grow or cut.

## 2026-10-22 — Grapple: no soft lock past the flag
- Owner found it: land to the right of the flag in 3-1 or 3-3 and nothing to the left is in hook reach (the wall and floor only pull you along them), so you were stuck. Both levels now have a thin ceiling under the HUD from x 2.5 to the right wall. 3-2 doesn't need one: its second pillar is in reach from past the flag.
- Bot check: started past the flag and hooking only the ceiling, it reached the flag in 44 of 108 tries (3-1) and 71 of 108 (3-3); the rest overshot into the pit, which costs time but isn't a lock. First-swing results are unchanged.
- Drawing: ceilings that touch the box edge now stop at the side wall instead of crossing it to the screen edge (also tidies Rocket 2-3's ceiling). Floors still run off screen.
- The 3-1 prompt moved to the center; since the flag moved to x 7 it ran into the flag.

## 2026-10-22 — Side walls are visible
- The level box's left and right walls, which already collided, now draw as ink walls in every world. They are 0.5 u thick (the camera margin): at 16:9 they reach the screen edge, and on wider screens the background shows past them, so the pause and restart buttons stay on the background. Drawn all the way out, the walls hid both buttons.
- Next: unchanged (play Grapple 3-1 to 3-3).

## 2026-10-22 — Grapple: try the launcher without spin reversal
- The launcher keeps spinning the same way after a shot, as in the prototype. The reversal is still there behind `HR_GRAPPLE.reverseSpin` (set it to `true` in `src/modes/grapple.js` to compare).
- Bot check: 3-1 and 3-3 are unchanged (one swing each). 3-2 changes a lot: after the first swing the launcher sweeps backward and the bot never catches the second pillar in mid-air. It finishes 20 of 169 hold pairs (49 with reversal), each with one long fling from the first pillar (hold about 0.53 s) or a second shot fired from standing, so 3-2 plays like 3-3.
- Next: play 3-2 both ways; if no reversal stays, rework 3-2 (pillars closer, or the second one lower) so the second catch is reachable.

## 2026-10-22 — Grapple world: levels 1–3
- Grapple mode ported from the prototype (`src/modes/grapple.js`): press to fire the hook, hold to reel in, release to fly. Same numbers as the prototype (hook 55 u/s, reel 95 u/s² up to 26 u/s, top speed 32 u/s, walls stop you dead).
- Two changes from the prototype: the launcher reverses its spin on each shot, as in Rocket (otherwise it swung backward after a release and you had to wait most of a turn for the next pillar), and the top of the level box is closed (swings went up to 11 u, off the screen). A faint dotted sight line shows the hook's path while it is ready.
- Levels 3-1 Swing By, 3-2 Two Pillars, 3-3 Let Go in `levels/grapple.js`. Pillars hang from the top of the box and stay clear of the HUD timer and buttons.
- Checked with a bot that fires at the first pillar in its sight and holds for a set time. 3-1: any hold over 0.35 s crosses the pit. 3-3: a hold of about 0.5–0.65 s lands on the far side, longer or shorter falls in. 3-2: 49 of 169 hold pairs finish. Same results in the browser engine.
- The 3-1 prompt sits under the pillar (new optional `promptAt` in the level data), because ink text over the ink pillar was unreadable.
- Par/expert are placeholders (the bot's best runs are 1.2–1.5 s).
- Spotted, not fixed: the bottom button hint ("Hold: reel in · Release: fly") is ink on ink wherever a floor runs under the screen center (3-3, also Rocket 2-1).
- Next: play 3-1 to 3-3 and send notes; then Grapple 4–10.

## 2026-10-21 — Slice gate passed, Rocket world built
- Gate: Fafi's partner played the Hop slice cold and had fun, so stage is now `content`. Her note: player-to-player collision might be exciting. Recorded as an open question in GDD §14; no change yet.
- Rocket mode ported from the prototype (`src/modes/rocket.js`): spinning launcher, press to fire, blast pushes only its owner, rockets in the owner's color pass through players. Blast 24 u/s, top speed 22 u/s (−20 % for the smaller levels).
- New level pieces, drawn as GDD §5 says: ice (white hatched top), sticky floor (bumpy top, stops you dead, blasts at 50 %), gates (bars, dotted line to the button) and buttons (white target, check mark when pressed). Gates and buttons live in `src/level.js`, so later worlds can use them.
- 10 Rocket levels in `levels/rocket.js`. A random-press bot finished every level; win rates fall from 90 % (2-1) to 30 % (2-10), and no run got past a gate without its button.
- Par/expert are placeholders (the bot's best times, 1–4 s, are not human times).
- Rocket blasts now push both players, and a rocket explodes on the other player (owner decision; it reverses the GDD cut). Checked in Versus: a direct hit sends the other player sliding at 19 u/s.
- Measured jump heights: Hop's best is 4.45 u, one rocket blast 5.6 u. Chained blasts off the level's side edges can climb 19 u, off the top of the screen; fix proposed (close the top of the level box), not done yet.
- Rocket 4–10 are now hidden drafts (`draft: true` in `levels/rocket.js`, filtered in `hrLevelsOf`). 2-1 to 2-3 are the Rocket slice: tune the mode on them first, then rework 4–10 against the final numbers and remove the flags.
- Next: play 2-1 to 2-3 and send notes; set par/expert from your runs; Hop 4–10.

## 2026-10-21 — Feel loop: landing squeeze, blink, checkered flag
- Landing squeeze: the player holds flat for a moment, then springs back with a small stretch (0.36 s). Harder landings squeeze more. Before, it decayed in about 6 frames and you could hardly see it.
- Eyes blink every 2.5–5 s, sometimes twice, on their own timer per player.
- Flag trigger box runs from the pole base to the pennant tip; no slow-mo on finish (it dropped the frame rate).
- Finish flag is now a waving checkered flag (6 × 4 cells), F1-style, in place of the white pennant. Same footprint, so the trigger box still fits. No outline; every cell waves, white ones included.
- Idle glance: after 5 s standing still, the pupil darts left, right, left, right, then rests in the middle and repeats. Any press or movement stops it.
- Restart icon: the ring is an open arc whose tail ends in a flat cut, instead of a full circle with a background-colored patch over it.
- Next: more feel notes, real par/expert times, then a teammate plays it cold.

## 2026-10-21 — Vertical slice: Hop 1–3 with the full shell
- New structure: classic-script modules in `src/`, Hop levels in `levels/hop.js`. The old `game.js` moved to `prototype/` as the tuning reference.
- Hop ported and checked against the prototype: same inputs give the same positions frame for frame (Wall Jump exact; Classic exact until the first fall, which now goes back to the start as the GDD says). Then the top jump speed was lowered from 25 to 20 u/s for 24–30 u levels.
- Hop 1–3 built (First Hop, Stepping Stones, Up We Go) with placeholder par/expert times.
- Shell: title, mode select (Solo/Versus, Hop live, other worlds "Soon"), level select, HUD with timer and best, pause, restart, level complete with count-up and stars, settings (sound, music, ghost), rotate screen, pause on hidden tab.
- Solo: timer and ghost start at first input, stars, saving, stuck nudge after 8 s. Versus: same spawn, touch halves or A/L, 3-2-1-GO, round and match results, first to 3.
- `window.game` hook and GameAnalytics stubs that log every event to the console (`[GA] ...`).
- Owner notes: the googly eye has no outline; P2 is red instead of white (the eye vanished on white); the Hop 1 prompt reads "Hold A then release to Jump!"; the player squashes toward the floor while charging, deeper with more power.
- Next: play it (feel loop, 2c), set real par/expert times, then a teammate plays it cold.

## 2026-10-21 — GDD approved, vertical slice starts
- GDD set to Approved; the team agreed to skip the peer review. Stage is now `slice`.
- Build plan (2a) agreed: classic-script modules in `src/`, Hop levels 1–3 in `levels/hop.js`, prototype kept in `prototype/` as the tuning reference.
- Next: scaffold the new structure, then port Hop and check it plays the same as the prototype.

## 2026-10-21 — GDD owner review and art direction
- Owner review applied: smaller one-screen levels with a fixed camera, landscape only, falls send you back to the start, ice and sticky floors, one flag trigger box. GDD now names the age range (core 13–24) and tone.
- Art direction settled after trying six looks on the "Hop Race Art Direction" canvas: two-tone minimal (look D). One flat background color per world, solid dark level pieces, players as flat squares with no outline and one big googly eye. The Toybox Flat mockup was too close to an existing game.
- Next: critical review pass (1c); team agrees on the new art family; a teammate reviews the GDD for approval.

## 2026-10-21 — GDD first draft
- Phase 1a questions answered; wrote `GDD.md` (Status: Draft).
- Decisions: 4 modes as worlds of 10 levels (Hop = Classic + Wall Jump, Rocket, Grapple, Sand = Flow + Flow 2); Orbit and Rocket (pits) cut. Solo time trial with stars and a ghost is the main path; 2-player Versus on any level. All levels unlocked behind one switchable rule. No daily. LittleJS kept.
- Next: critical review pass (1c), then a teammate reviews for approval.

## 2026-10-19 — Moved into coolmath-pilot
- Moved from its own repo (onebutton-twoplayer-game) with its git history; added this brief, `mechanic.svg`, devlog and meta for the dashboard.
- Current state: playable LittleJS prototype, 2 players with one key each, six modes in the menu (Classic, Wall Jump, Rocket Jump, Grappling Hook, Flow, Flow 2); keyboard only, no shell, saving or analytics.
- Next: write `GDD.md` for what is built (phase 1) and decide which modes ship and whether there is a solo mode.

## 2026-10-01 — Prototype: hop race and five more modes
- First playable: hold to charge and sweep the aim, release to hop; first to the flag wins. Wall Jump mode clings to walls.
- Rocket Jump: a spinning launcher; blasts push you and open a gate via a ceiling button. Grappling Hook: fire, reel in, cut loose keeping your speed.
- Flow: crumble into sand that pours down slopes and packs back into a square. Flow 2: a fire pit turns you to gas that slides up the ceiling to a hanging flag, then condenses back through liquid.
- Orbit and Rocket Jump (pits) are hidden from the menu.
