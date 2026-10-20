# Chess Defense — devlog

## 2026-10-20 — Moved into coolmath-pilot
- Copied from the LittleJS-AI playground (`examples/chessDefense`) without its git history; added this brief, `mechanic.svg`, devlog and meta for the dashboard.
- Fixed loading: the engine (`dist/littlejs.js`, 1.18.26) and `templates/gameFx.js` now live in this folder instead of two folders up. Added `build.mjs`, `package.json` and `.gitignore` like the other prototypes; the raw `.wav` files in `sfx/` stay out of git.
- Current state: playable LittleJS prototype with 8 boards, 5 piece types, perks, lane upgrades and a free draft pick after every wave; mouse and keyboard only, no shell or analytics. The early game is not balanced.
- Next: write `GDD.md` for what is built (phase 1): pick the name, set balance targets and decide what v1 keeps.

## 2026-10-07 — Draft picks and slower enemies (in the playground)
- A free pick of 1 of 3 pieces with a signature ability after every cleared wave; Vertical Waves Test board; the gold-free draft ruleset is parked.
- Every enemy's speed halved; two-column board select with wheel scrolling.

## 2026-09-26 to 2026-10-01 — Lanes, Ravager, editor (in the playground)
- Pieces move freely and can stand on the route for ×2 damage; Pierce and Rapid perks; lane upgrades.
- Ravager smashes nearby pieces; piece damage persists; recorded sounds; walls, unusable squares and several Kings per board.
- Level editor (`editor.html`) and the drop-in `levels/` folder; boards 6 and 7.

## 2026-07-26 — First playable (in the playground)
- Chess-piece tower defense: a piece's move pattern is its attack range; warded creeps that stay on one square color; Diagonal Pincer and The Ward Lab boards.
