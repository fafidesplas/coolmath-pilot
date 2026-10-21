# Flip Runner — devlog

## 2026-10-21 — GDD critical review applied
- Phase 1c review: 11 fixes, mostly about fair deaths. Every retry of a section is now identical (flag snapshots), 1-tile rises are auto-stepped, and hitboxes are forgiving. Also: death analytics as counts plus `quit:<type>`, daily best of 3, no death flash, endless speed cap, editor planned. Full list in the GDD changelog.
- `GDD.md` status set to In review.
- Next: Pao reads it for approval; then phase 2 (vertical slice).

## 2026-10-21 — GDD first draft
- Wrote `GDD.md` (Status: Draft) from the brief, using the recommended answers to the phase 1a questions.
- Key calls: gravity flip at 5000 px/s² (~0.29 s across a 6-tile corridor), 100 ms buffer and 60 ms coyote, collectible stars are the rating and bank at flags, free geometry instead of a fixed tunnel, gravity switches replace portals in world 4, endless and daily chain hand-made chunks, deterministic sim with a one-button solver.
- Next: phase 1c critical review, then Pao reads it for approval.
