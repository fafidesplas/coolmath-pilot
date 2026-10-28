# Daily Community Game — devlog

## 2026-10-27 — Renamed from Crowd Tower
- New name: Daily Community Game; folder moved to `games/daily-community-game/`, save keys now `cm_daily-community-game_*`.
- Decided the Jenga-style tower is not the way to go: the vote has no real choice, luck decides, and the payoff comes only every two weeks. The design needs a major rethink.
- Next: pick a new direction (Storm Island, Crowd Climb or One Shared Puzzle), rewrite the brief, then the GDD.

## 2026-10-27 — 3D and a physics collapse
- The game must be 3D: brief and GDD now use Three.js (orthographic 3/4 camera, flat toy shading, outlines, table shadows) and cannon-es for the collapse.
- The collapse is the payoff: slow-motion tip, break into physics bodies, crash and pile-up, camera pull-back, Watch again (recorded frames). Physics only plays the crash; the rules still decide every result.
- Next: a throwaway collapse prototype to check the look, 60 fps on a Chromebook and the size, then the phase 1c critical review.

## 2026-10-27 — Daily rounds
- Round length decided: 24 hours, closing at midnight Pacific. You see yesterday's result, then vote. The GDD now uses daily rounds everywhere.
- One pull a day, so the fall odds are about 4× higher, aiming for ~2-week towers (median 14 pulls). Risk labels, solo stars, streak, timer, polling and examples updated to match.
- The reveal now plays on your first visit after the close, not live on the hour.
- Next: check the new odds with the simulator plan, phase 1c critical review, then a teammate reads it.

## 2026-10-27 — Brief and GDD first draft
- New game from the "CMG Community Features (part 3)" idea slide: brief, meta.json, mechanic.svg and `GDD.md` (Status: Draft).
- Named Crowd Tower, not "Crowd Jenga" (Hasbro trademark).
- Key calls: hourly rounds, 3 candidate blocks per round, structure rules plus a seeded roll decide each pull, record counted in pulls, solo practice tower for the shell.
- Next: answer the open questions (round length, backend, solo mode), phase 1c critical review, then a teammate reads it.
