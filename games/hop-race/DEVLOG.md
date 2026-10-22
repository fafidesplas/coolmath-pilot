# Hop Race — devlog

## 2026-10-22 — Grapple: try the launcher without spin reversal
- The launcher keeps spinning the same way after a shot, as in the prototype. The reversal is still there behind `HR_GRAPPLE.reverseSpin` (set it to `true` in `src/modes/grapple.js` to compare).
- Bot check: 3-1 and 3-3 are unchanged (one swing each). 3-2 changes a lot: after the first swing the launcher sweeps backward and the bot never catches the second pillar (0 of 169 hold pairs, 49 with reversal). It only finishes with one long fling from the first pillar (hold about 0.53 s), so 3-2 plays like 3-3.
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
