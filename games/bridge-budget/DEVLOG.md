# Bridge Budget — devlog

## 2026-10-27 — GDD approved
- Pao approved `GDD.md`; status Approved, stage `slice`.
- Next: phase 2, the vertical slice.

## 2026-10-26 — GDD first draft and review
- Wrote `GDD.md` from the brief and the phase 1a answers. Key decisions:
  - XPBD spring-mass at 120 Hz × 8 substeps, deterministic (arithmetic and `sqrt` only), with a deliberately weak road deck.
  - Material and vehicle numbers calibrated with a throwaway prototype (not in the repo).
  - A pass counts even if pieces break. 1 star at any cost, 2 under budget, 3 under the reference × 1.05, plus a hard hat for beating the reference.
  - Joints are automatic; build by drag or click-click, with a ghost preview. No zoom or pan in v1.
- Levels 1–10 are checked in the prototype: each lesson's naive bridge fails and each reference passes at a peak of 90% or less. The worlds add terrain, arches, cables, convoys, towers, boats and the bus, not just bigger gaps.
- Review fixes:
  - a settle phase and stronger damping, because soft members made the bridges wobble like jelly;
  - all numbers re-verified with the final settings, and level 7's reference replaced with a robust one;
  - a Mirror tool, and slow motion only when the first break is new;
  - a check so that collapse-behind-the-truck passes can't empty the targets;
  - `level:giveup` analytics. Full list in the GDD changelog.
- Next: Pao reads the GDD for approval; then phase 2 (vertical slice on level 4, Big Wheels), starting with `sim.js` and `tools/simtest.mjs`.
