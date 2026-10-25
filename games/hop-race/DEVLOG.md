# Hop Race — devlog

## 2026-10-25 — Hop: auto-run keeps the charge hop
- Owner asked to keep the hop's physics and animation in auto-run: hold to squeeze, release to jump with more power. Answers: you keep running while you charge, and the power sets the angle (no aim sweep). Built in `HR_MODES.hop.run()`: power and speed as before (1.1 s, 9–20 u/s), angle 18°–80° with power, squash and a back lean growing with power, charge ticks, the eye looks along the hop. Running off an edge while charging loses the charge after 0.08 s. A mid-air wall bounces at 35 % and turns you around. The world hint is back to "Hold: charge · Release: hop"; level 1's prompt is "Press A to run. Hold, then let go to jump!". Removed `runJump` and `runCut`.
- Checked in Chrome with a search over wait and hold timings per hop: levels 1, 2, 4, 5 and 6 can be finished (6 needs the low flat hops). 3 and 7–10 can't. Hop 3's 3 u steps are too short to charge for its 2.5 u climbs while running. Seen in play: the squash and lean show while running, and a 0.7 s charge already carries you 4 u, to the gap's edge in 1-1.
- Next: owner plays; decide on charging while running vs. slowing down, and what to do with 3 and 7–10.

## 2026-10-25 — Hop: auto-run test
- Owner asked for Hop with automatic running and a tap to jump. Their answers: a switch inside Hop (`HR_HOP.autoRun`, on now; false is the old hold-to-charge hop), hold for a higher jump, every wall turns you around, and the first press only starts the run. Built as `HR_MODES.hop.run()`: 6 u/s run, 20 u/s jump (4.8 u high when held, about 1.5 u on a tap), 0.08 s coyote time. Level 1 has a new prompt and the world hint changed (`HR_MODES.hop.prompt`, used by the prompt drawing in `ui.js`).
- Checked in Chrome with a simple bot (jump when a wall or a drop is ahead, 140 timings): levels 1–5 finish in 3–4 s; 6–10 never do. Hop 6's gap is under a 2.5 u ceiling, and a running jump there carries only about 2 u. 7–10 climb shafts by clinging to grip walls, which turning around rules out. Real keyboard play finished 1-1.
- Not changed: the editor's Check (`tools/hop-bot.js`) still simulates the charge hop, and saved best times and ghosts are from the charge hop.
- Next: owner plays 1–5, then decides what to do with 6–10.

## 2026-10-25 — Title world cards: no blank screen on a finished world
- Owner: clicking a world card on the title gave a blank screen ("Cannot read properties of undefined (reading 'id')"). With every level of a world finished, the card asked for level -1. It now starts the last level played in that world, or its first (`hrCardLevel`). Play 1P/2P already had a fallback, so they worked.
- Checked in Chrome with every level marked finished: all four cards start a level, no console errors.

## 2026-10-25 — Climb: the cup breaks on resistance
- Owner found that tapping (presses under 0.2 s) with the cup stuck on a wall could teleport the body under a platform. Creeping turned the arm into a solid, and the push-out moved the body to the far side, so the cup never let go. Now, if creeping would put the body into a solid or the arm through one, the cup breaks at once (`resisted()`, `hrClimbArmCuts()`). Then the press whips as it does after a hold past 0.2 s.
- Checked headless on every Climb wall face, with taps of 3, 6 and 11 frames from 16,428 starts. Body or arm through a solid with the cup still on: 2,774 before, 0 after. Taps still lift the body more than 1 u in 5,038 starts (6,134 before; the difference is climbs that only worked by clipping).
- Not touched: a whipping arm (cup off) can still cut through a corner, because only the head and the body collide.

## 2026-10-23 — Title shows the worlds
- A cold playtester never realized there were worlds besides Hop: they were behind "Levels". The title now has a row of the four world cards (same as Mode select) under the Play buttons, labeled "or pick a world"; a card starts that world's next level, solo. Play 1P / Play 2P are unchanged, so it's still one click to playing. The Levels button is gone, Settings is a small button top right, the title is a bit smaller and the idle hopping square was removed to make room. GDD §8 updated.
- Checked in Chrome at 1568×762 as a mockup first, which the owner approved.
- Level select and Mode select are now only reached from Pause ▶ Levels, so there's no way from the title to pick a specific level or a Versus level. Next: decide on Versus from the cards, and whether Hop's yellow card (outline only on the yellow title) needs a fill.

## 2026-10-23 — Hop: no bigger eye on high hops
- Owner: the eye growing on the \ was too much. Removed `HR_HOP.eyeGrow`; the eye keeps its size and just looks up along the aim. The eye still stays put on a backward lean, so it doesn't cover the letter.

## 2026-10-23 — Hop: high hops lean back
- Owner asked for a \ for high hops, to mirror the / lunge. Answers to my questions: build it with power × aim height, 0.25 u like the /, no carry into the jump (the launch stretch stays), and a wide, bigger eye. While charging, the lean is now `HR_HOP.lean × lunge − HR_HOP.backLean × power × aim height`, so past full charge the \ turns smoothly into the / through square as the aim drops. The eye grows up to 15 % (`HR_HOP.eyeGrow`, `p.eyeGrow`) and stays put on a backward lean, because sliding back with the top put it over the letter.
- Checked in Chrome on 1-2: the lean builds from 0 to −0.25 u by 1.22 s (full power, aim 80°); frozen there, it reads as a \ with the big eye on the front corner and the letter visible. No console errors.

## 2026-10-23 — Hop: lunge pose carries into the jump
- Owner asked for the / pose to last into the jump and ease back to square. A release with any lunge in it now keeps the pose (`p.lunge`, `HR_MODES.hop.easeLunge`): held for the first 35 % (`HR_HOP.lungeKeep`) of the airtime back to launch height (at least 0.3 s), then eased to square. The launch stretch is scaled down by the lunge, so a full lunge doesn't stretch up. Landing, clinging, respawning and finishing end it.
- Checked in Chrome on 1-2 with a frame-stepped full lunge: 0.44 × 0.64 with the lean until 0.10 s, square by 0.30 s (airtime 0.32 s). No console errors.
- The airtime is to launch height, so a lunge off a ledge is square before it lands lower down.

## 2026-10-23 — Hop: narrower lunge, lower eye
- Owner: the lunge pose should be narrower, height is good, and the eye a little lower. Pinch .47 → .57, so the pose is 0.44 × 0.64 u at the flattest aim. The eye drops up to 0.08 u (`HR_HOP.eyeDrop`, `p.eyeDrop`), still following the lean.
- Checked in Chrome on 1-2, frozen at the flattest aim. No console errors.

## 2026-10-23 — Hop: lunge pose stays low
- Owner asked for the lunge pose to be shorter than the normal square, about 0.64 u tall. Past full charge the squash now eases from 45 % to 20 % (`HR_HOP.lungeCrouch`) instead of to nothing, and the side pinch is 0.47, so the width stays 0.52 u. The pinch no longer makes the player taller (`hrSquashY`).
- Checked in Chrome on 1-2 with a frame-stepped hold: 1.02 × 0.44 u at full charge and highest aim, 0.52 × 0.64 u at the flattest aim, with the / lean and squint. No console errors.

## 2026-10-23 — Hop: lunge leans forward and squints
- Owner asked to flip the lean to a / (forward, into the hop) and make the eye squint a little. The top now slides toward the facing side, and the eye narrows to 65 % open at the flattest aim (`HR_HOP.squint` .35, `p.squint`), easing back when you let go. A blink still closes it fully.
- Checked in Chrome on 1-2, frozen at 2.3 s of hold: a / with a narrowed eye on the leading top corner. No console errors.
- Next: play it and judge both amounts.

## 2026-10-23 — Hop 1-4 marked "needs improvement"
- Owner flagged 1-4 The Wall as needing improvement. Marked in GDD §14 (open question) and with a comment on the level in `levels/hop.js`. No change to the level yet.
- Next: note what's wrong with it, then rework it.

## 2026-10-23 — Hop: lean back into the lunge
- Owner asked for the lunge pose to lean back like a \. With the side squeeze, the top of the player now slides back away from the hop while the bottom stays planted: a parallelogram, up to 0.25 u at the flattest aim (`HR_HOP.lean`, `p.lean`). The letter and the eye follow the lean. The player is drawn with `drawPoly` only while it leans, and with `drawRect` otherwise.
- Checked in Chrome on 1-2, frozen at 2.3 s of hold (flattest aim): it reads as a \ with the eye on the leaning top. No console errors.
- Next: play it and judge the amount; on a grip wall the top leans back toward the wall, which is untested.

## 2026-10-23 — Hop: charge ticks follow the lunge
- Owner asked for the audio ramp to cover the flat lunge too. The charge ticks used to stop at full charge. Now they count charge plus the lunge amount (the same value that drives the side squeeze), so past full charge they keep rising as the aim drops flat, from 2× to 2.6× the base pitch (`HR_HOP.lungePitch`), and step back down when the aim swings up again.
- Checked in Chrome on 1-2 with a frame-stepped 4 s hold: 8 ticks to full charge (1.1 s), a pause while the aim is near the top, 7 rising ticks to the flattest aim (about 2.05 s), then falling ticks as the aim swings back up. The top step is capped so the turn doesn't tick twice. No console errors.
- Next: listen to it. Judge whether the pause at the top of the aim reads as "high hop" or as the sound cutting out.

## 2026-10-23 — Hop: the eye shows the aim
- Owner asked to hint the direction with the eye. While you charge, Hop sets `p.look` to the aim direction and the pupil springs toward it, to the edge of the eye (`hrPlayerStep` in `src/player.js`; other modes don't set it). It follows the sweep, and faces left when you charge on a wall that's on your right.
- Checked in Chrome on 1-2 with frame-stepped holds: the pupil's angle stays within 2° of the aim from 25° to 80° and back. No console errors.
- Next: play it and judge whether the eye is readable at speed in versus, where both players charge at once.

## 2026-10-23 — Hop: no aim arrow, no power bar
- Owner asked to remove both. While you charge, nothing is drawn around the player now (`HR_MODES.hop.draw` is empty); the squash and the side squeeze are the only feedback for power and aim. GDD §3.2, §5 and the palette line updated.
- Next: play 1-1 cold and check a new player can still read when to release.

## 2026-10-23 — Hop: side squeeze for flat hops
- Owner asked for a third part to the charge animation. Holding past full charge sweeps the aim back down toward a long, flat hop, so the squash toward the floor now turns into a squeeze from the sides as the aim drops: at the flattest aim (18°) the player is 35 % narrower and about 17 % taller (`HR_HOP.pinch`, new `p.pinch`). Before full charge nothing changes. GDD §5 juice list updated.
- Checked in Chrome on 1-2 with frame-stepped holds: the player is 1.27 × 0.55 at full charge and highest aim, square at about 50°, and 0.65 × 1.17 at the flattest aim. No console errors.
- Next: play it and judge whether the squeeze reads as "long and flat", and whether 0.35 is the right amount.

## 2026-10-23 — Hop: launch arrow instead of the arc
- Player feedback: the full dotted arc telegraphed where you land and took the thrill away. While you charge, Hop now shows a short ink arrow along the launch direction instead (`HR_MODES.hop.draw`). It is 0.5–0.9 u long, growing with power, and starts 1.3 u from the player's center so it clears the power bar at every aim angle (18°–80°). GDD §3.2 and §5 updated.
- Checked in Chrome on 1-2: the arrow draws and sweeps with the aim, and there are no console errors. The mode-select card's schematic still shows a dotted arc, as an illustration of the hop.
- Next: playtest whether the jumps (especially 1-6 Low Ceiling and the wall levels) are still readable without the arc.

## 2026-10-23 — Climb 4 draft from the editor
- Owner added `climb-04` (draft, "New Level", size 26): a start ledge on the left (top 3), a safe pit floor across the middle (top −3.25), a floating block (x 1…4, y −0.25…3), the flag ledge on the right (top 3.75, flag at x 10.25) and a post on it past the flag (x 11.75…13.5, up to 8.75). Not named yet; not checked with a bot.

## 2026-10-23 — HUD buttons readable over ink
- Owner: the pause and restart buttons must be visible against ink (Rapid Fire's right wall and the Climb 4 draft's post reach the top of the screen under them). They are now ink discs with the icon cut out in the world's background color and a 3 px background-colored rim (`chip: true` on the playing screen's buttons in `hrUiButtons`). Over the background they read as solid ink buttons, like the filled menu buttons; over ink the icon and rim show. Menu icon buttons (back) are unchanged.
- Checked in Chrome on Rocket 2-1 with an ink rectangle drawn under the lower half of both buttons: both halves readable. The timer and level label are still plain ink text, so they would vanish over ink too.

## 2026-10-23 — Rocket draft: Over the Top (from the owner's sketch)
- New hidden draft `rocket-11` "Over the Top" (size 28), drawn from the owner's sketch: start on a pit floor between two steps (left) and a tall tower (right); blast up the steps to a tall left wall, then arc right over the tower to the flag ledge. The left wall stops at y 6.3, under the HUD, so the pause button stays on the background (the sketch runs it to the top edge).
- Random-press bot (presses every 0.1–0.8 s, 150 runs, 30 s cap; it now runs the shared rocket update each frame, which the first try forgot): 2-1 finishes 109, 2-3 66, Over the Top 2–4, slowest ~16–20 s. 134 runs reach the steps, 35 get high on the left wall, 23 pass over the tower. Tower height is the knob: top 4 → 4/150, 3 → 5, 2 → 21, 1 → 39.
- Owner reworked it in the editor and made it live as 2-4 "Rapid Fire" (`draft` flag removed): the steps became one tall left wall (x −14.5…−5, up to y 8), the pit floor is wider (from x −7.25), the tower is x 0…6 up to 4.25, and a wall hangs from the top over the right end of the flag ledge (x 10.5…15.25, down to y −3.25). Flag at x 8.75. Not re-checked with the bot.

## 2026-10-23 — Climb 4-3: lower tooth moved down
- Owner edit: 4-3 The Wall's lower tooth is 0.5 u lower (top y −4.5 → −5). Not re-checked with a bot.

## 2026-10-23 — Climb: soft touch on walls (testing)
- Owner asked: quick presses shouldn't detach the arm from a wall, to reward a soft touch where slow and steady can win. While the cup is stuck to a wall face, a press creeps the arm around the cup at `HR_CLIMB.creep` 2 rad/s, levering the body (on a wall to your right, up and in); only a hold past `HR_CLIMB.peelTime` 0.2 s peels it off and whips at full speed. If creeping would push the body into a solid, the arm holds. `peelTime = 0` brings back peel-on-press.
- Walls only. First tried on every surface: the cup then also held on the floor, so a player who only tapped never moved (0 of 30 tap-only runs left the start).
- Measured on 4-3's wall (cup at y −3): taps creep the body from y −3 to −1.35, where it stands on the lower tooth; a steady hold peels at 0.2 s.
- Bot (random hold/release 0.03–0.63 s, 100 runs): 4-1 100, 4-2 98, 4-3 86 finish (before: 100, 100, 87). Holding alone: finishes 4-1 in 7.9 s, fails 4-2 and the new 7 u 4-3.
- Blind tapping (presses 0.03–0.17 s, 50 runs) got worse, not better: 40 / 20 / 9 finish (before: 50 / 50 / 46). Before, every tap was a small whip, so mashing climbed nearly every time; now blind taps creep until the body meets the wall and then stall until you hold. Bots can't tell whether deliberate creeping feels good: it needs a person.
- Next: play 4-1 to 4-3. Things to judge: is the creep speed right, is 0.2 s a natural line between a tap and a hold, and does the stall when the body meets the wall read clearly.

## 2026-10-23 — Climb 4-3 shorter wall, Grapple 3-3 higher ceiling
- Owner edits in the level editor. 4-3 The Wall: the wall is 7 u (top y 3 → 1), the flag moved from (8, 3) to (12, 1), and the top tooth went with the lost height; the two lower teeth are now plain solids instead of the `hrClimbTeeth(102947, …)` line. 3-3 Let Go: the ceiling past the flag is higher and longer (x 2.5…15 at y 5.9–6.4 → x −5…14.5 at y 7.1–7.9).
- Not re-checked with a bot: the 4-3 numbers logged earlier (holding alone fails, 157 of 200 random runs finish) were for the 9 u wall.

## 2026-10-23 — Rocket 2-1: lower block, flag further right
- Owner edit: Blast Off's middle block is 3 u tall (top y 0 → −1) and the flag moved from x 9 to 10.25. Owner playtest: very easy to clear, as a first Rocket level should be.

## 2026-10-23 — Versus: each round is a random level of the world
- Owner: Versus shouldn't repeat the same level every round. The level you pick starts the match; each next round draws a random level from the same world (`hrNextVersusLevel` in `src/main.js`), with no repeats until every unlocked level of the world has come up, and never the same level twice in a row. Restart (R) keeps the round's level. Rematch starts a new match on a random level too. The editor's play-test stays on its level.
- Checked in Chrome through 24 rounds each: Hop goes through all 10 levels before any repeats; Rocket (3 levels) and Climb (3) cycle with no back-to-back repeat. No console errors.

## 2026-10-23 — First levels saved from the editor
- The owner's first real saves (Chrome file access works): 1-6's ceiling bottom −2 → −1.5 (2.5 u over the gap; its comment updated by hand), 2-1 Blast Off's two low bumps → one block at x −1…1 up to y 0, 2-3 Knock Knock's gate button (−3, 2.5) → (−10.5, 4.5).
- Bot on 1-6: finishes, no dead ends, 5.7 s; the hop under the ceiling now takes 72 of 163 hold lengths (60 before). Rocket has no bot: 2-1 and 2-3 are unchecked until played.

## 2026-10-23 — Level editor
- Owner asked for one; chose in-game and debug only, saving straight into `levels/<world>.js`, all four worlds. New `tools/editor.js`, loaded by `index.html` after `main.js` and left out of `build.json`. Hooks in the game are no-ops without it: `hrEditDef` (the editor's level, played in place of the list), `window.hrEditor?.update()` / `render()` / `fitCamera()`, and a test run's finish saves no time or ghost.
- Editing: select, drag, resize by edges, draw new solids, nudge with arrows, grip/ice/sticky/no-grip keys, floor/floating/hanging, solid ↔ gate (Rocket), duplicate, delete, level size, undo/redo, new and duplicated levels, drafts. The overlay shows a grid, the level box, the HUD's no-go spots, the kill line, the flag's box and the prompt. E plays the level from its start (Shift+E from the mouse), E comes back; finishing comes back with the time.
- Saving uses Chrome's file access (the folder is remembered in IndexedDB). Only the edited levels' entries in the file are rewritten: comments stay on their lines (by each solid's place in the file), new levels go at the end of the list, and Climb's teeth stay one `...hrClimbTeeth(...)` line unless a tooth is edited (`hrClimbTeeth` marks its teeth with a hidden `_teeth`). `hrEditor.selfTest()` rewrites all 26 levels and compares: all match except 2-5 and 5-2, which write `.5` where the editor writes `0.5`.
- Check (Hop) runs `tools/hop-bot.js` on the level as it is, draws the route as numbered hops and dead ends as red crosses. The bot now also returns `routeSpots` and `deadSpots`, and can run on a level that's already loaded.
- Tested in Chrome (1512×806) with simulated mouse drags over several frames and a stand-in folder (the real folder picker is a permission prompt for the owner): move, undo, new solid, ice, edge resize, play-test and return, bot check, saving 1-8 + Climb 3 + a new level (only the edited lines changed; all three files still parse), a second save of the same level, an edited tooth written out as numbers, and a Rocket gate. Fixed along the way: comments kept their original spacing, a failed save of the remembered folder could hang, and an edited tooth's comment repeated on every tooth.
- Not done: deleting a level (remove it from the file by hand), Phase (rejected), a hanging flag toggle.

## 2026-10-23 — Fix: takeoff teleported you onto the wall
- Owner, on 1-9's top ledge: jumping teleported the player back onto the grip wall. Cause: standing on a top at y 1, your center is 1 + 0.4 = 1.4, and 1.4 − 0.4 = 0.9999999999999999, so on the takeoff frame Hop's wall check found your feet inside the floor, pushed you out its left side, and the grip face caught you. Reproduced: every hold from x 7.8 ended at x 6.6, clinging.
- Fix: Hop's wall check uses the slightly short box (`hrOverlapSolid(..., .1)`) that Rocket and Grapple already used "so the floor we rest on doesn't count".
- Checks (Chrome): the same jumps now go forward. A jump from every standable spot in 1-1 to 1-10 (840, every 0.25 u): none is pushed backward on takeoff. Bot, all 10: all finish, no dead ends; 1-9 is 6.1 s (was 6.8, the glitch cost the bot time there); 1-7 to 1-10 still can't be finished with their grip walls turned plain.

## 2026-10-23 — Grip walls: 0.5 u/s slide while charging
- Owner: climbing took too much work (too many wall jumps). Of the options (steep aim on walls, ledge grab, keeping some upward speed, a slower slide, shorter climbs) the owner picked the slower slide: `HR_HOP.clingChargeSlide` 1.5 → 0.5 u/s. Earlier measurement from the 1-7 test cling: 32 of 50 hold lengths climb at 0.5 (26 at 1.5, 39 at 0).
- Bot, 1-7 to 1-10: all finish, no dead ends (6.0, 7.0, 6.8, 6.8 s); with grip walls turned plain none can be finished.
- Still open if climbs feel long: start the aim steep on walls, or a ledge grab near the top.

## 2026-10-23 — No riding up grip walls
- Owner: launching into a grip wall hard enough slid you up the whole wall. The cling kept your upward speed and only slowed it at 12 u/s², so arriving at 15 u/s carried you about 9 u. Now a cling stops you (upward speed 0), as GDD §3.2 already said.
- That alone would trap you at the foot of a grip wall on your right: you always faced right on the ground, so every jump clung straight back on at floor height and dropped. Now landing against a grip wall turns you away from it (plain walls don't, so you can still hop over a bump you slid into).
- Checks (Chrome): the highest cling from one jump off 1-7's shaft floor is y −0.2, under the ledge top (0); after sliding down to the foot of the right wall you face left. Bot, 1-7 to 1-10: all finish, no dead ends (6.4, 7.5, 7.6, 7.0 s); with every grip wall turned plain, none of the four can be finished, so climbing is the only way.
- 1-7 and 1-9 need only one cling: cling to the far wall, then hop onto the top of the hanging grip wall. If they should take a real zigzag, the hanging walls can be made lower than the ledge.

## 2026-10-23 — Grip walls: a slower slide while charging
- Owner: holding still while charging was too easy. Now charging slows the slide to 1.5 u/s (half the normal 3) instead of stopping it: `HR_HOP.clingChargeSlide` (0 = hold still, 3 = no slower) replaces `gripWhileCharging`.
- From a cling in 1-7, 50 hold lengths (0.05–2.5 s), holds that land higher or on top of the wall: 0 u/s 39 (from 0.30 s, best +2.4 u) · 0.5 32 · 1 29 · **1.5 26 (from 0.45 s, best +2.4 u)** · 2 18 (from 0.50 s, best +2.1 u) · 3 7 (from 0.65 s, best +1.1 u). If 1.5 still feels easy, 2 is the next step.
- Bot, 1-7 to 1-10: all finish, no dead ends; 6.2, 7.1, 7.6 and 6.6 s. 1-1 to 1-6 have no grip walls.
- Next: play 1-7 to 1-10 again.

## 2026-10-23 — Grip walls hold you while you charge
- Owner, playing 1-7: "I can't reliably climb the walls fast enough, I slide down before I can climb up." Measured from a cling 3 u across from the other wall (1-7), trying holds of 0.1–2.5 s: sliding while charging (3 u/s), only 0.7–0.9 s gained height (3 of 25, at most +0.9 u); longer holds slid off the wall. The aim starts flat and reaches steep only after about 1 s, so the slide ate the climb. The bot climbed because its timing is exact.
- Now the wall holds you still while you hold the button; you slide only when you let go of it. Same test: 13 of 25 cling higher (+0.1 to +2 u, from 0.3 s), 7 more (0.8–1.4 s) land on top of the wall. Switch: `HR_HOP.gripWhileCharging` (false = the old slide).
- Bot re-run, all 10 Hop levels: all finish, no dead ends. Changed: 1-7 5.8 s (was 6.6), 1-8 6.7 (7.4), 1-9 6.5 (7.6), 1-10 6.5 (6.7); the climbs in 1-7 and 1-8 now take 40–60 of 163 hold lengths.
- Next: play 1-7 to 1-10 again with the grip.

## 2026-10-23 — Hop 4–10 built, with a level bot
- Hop's ice was drawn but did nothing: landing on it stopped you dead. Now it follows GDD §3.2: a landing over 2 u/s keeps 80 % of it, the slide slows at 0.8/s, you can charge while sliding, walls stop a slide, and sliding off an edge drops you (`HR_HOP.slide`).
- New `tools/hop-bot.js` (debug only, not in `index.html`): from every spot you can stand or cling, tries every hold length (0.13–2.8 s, after waits of 0, 0.2, 0.5 and 1 s for slides) and follows each jump. It reports the fastest route (each hop costs a 0.5 s pause so it can't win by tapping), how many hold lengths make each hop, and dead ends.
- Levels 4–10 as in GDD §6. Bot results (s is the bot's play time; "tightest" is the fewest hold lengths of 163 that make a hop on the route):

  | Level | Bot | Hops | Tightest | Dead ends |
  |---|---|---|---|---|
  | 1-4 The Wall | 5.0 | 4 | 17 | 0 |
  | 1-5 Thin Ice | 3.7 | 2 | 87* | 0 |
  | 1-6 Low Ceiling | 5.7 | 5 | 60* | 0 |
  | 1-7 Grip | 6.6 | 6 | 47 | 0 |
  | 1-8 Which Wall? | 7.4 | 7 | 31 | 0 |
  | 1-9 Slide and Climb | 7.6 | 6 | 9 | 0 |
  | 1-10 The Gauntlet | 6.7 | 7 | 29 | 0 |

  \* not counting the last hop: the bot finishes with a long leap at the flag box that only a few hold lengths make, but landing short of the flag and hopping again is easy.
- Design changes found by the bot: Low Ceiling's gap went from 4 to 5.5 u and its ceiling from 2.2 to 2 u, because 88 of 163 hold lengths made it under. Which Wall?'s first version (a plain wall across a shaft from a grip wall) can't be finished: a 35 % bounce off a plain wall never climbs. It is now a cliff with a plain foot and a grip top half, with a grip pillar in front.
- Found and kept: at the foot of a grip wall on your right, every jump goes into the wall and clings higher, because you always face right on the ground. It reads as the way a climb starts (GDD §3.2).
- Checked in Chrome at 1512×750: all seven levels draw cleanly; the top 1.5 u stays clear for the HUD.
- Next: play 1-4 to 1-10 cold. Bot times are not human times; the GDD's 8–20 s first clean run needs a person.

## 2026-10-22 — Launcher, rope and hook in the player's color
- Owner: the launcher disappeared when it pointed into the floor, because it was ink on ink. The barrel (Rocket and Grapple), the rope and the hook ring now use the player's color; the hook keeps its white center, and the barrel still fades while cooling down. Rockets and blasts were already in the owner's color. The dotted sight lines stay ink: they stop at the first solid, so they never sit on ink.
- Checked in Chrome (1512×806): 2-1 Versus with both launchers pointing into the floor (blue and red both show); 3-1 with the hook stuck under the first pillar (rope and hook show). No console errors.
- Next: unchanged (outline Climb 4–10).

## 2026-10-22 — Climb grows into World 4
- Owner decision: Climb is a core world, replacing the rejected Phase. `lab: true` is off its `HR_WORLDS` entry, so the card loses the "LAB" tag and shows "x/10 done" like the other worlds; 4–10 show as not built yet. Its GA id stays `world05`; the HUD already reads "4-x".
- GDD: v1 is four worlds, 40 levels, so the hat thresholds (3 … 40) stand and the rebalance question is closed. New §14 question: Climb shares Rocket's coral; keep it or move it to yellow.
- Next: outline Climb 4–10 (levels that need the release: gaps, overhangs), then build them.

## 2026-10-22 — Phase rejected and hidden
- Owner decision: Phase feels very weak. It is hidden, not deleted: `hidden: true` on its `HR_WORLDS` entry makes `hrLevelsOf()` return no levels, so it has no card on the mode select and Play 1P / 2P and `window.game.start` can't reach it (a save whose `last` is a Phase level falls back to the first unfinished level). `src/modes/phase.js` and `levels/phase.js` stay loaded.
- The HUD's world number now skips hidden worlds (`hrWorldNumber`), so Climb reads "4-1". GA ids are unchanged (Climb is still `world05`).
- GDD: v1 is three worlds, 30 levels; Phase is listed under §13 Rejected modes with §3.5 kept for reference; hat thresholds need a rebalance to 30 (§14).
- Next: play 2-1 to 2-3 and 3-1 to 3-3 with the new clockwise launchers; decide Climb (keep, grow or cut).

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
