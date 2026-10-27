# Ink Path — devlog

## 2026-10-26 — GDD first draft and review
- Wrote `GDD.md` from the brief and the phase 1a answers. Key calls: stars from ink only (the brief's touch-stars cut), Dot drops 150 ms after you let go, drawing again restarts at once, ghost of the last line and a drop preview, fail-fast rules, triggered ferries, latching buttons, ink blocks air, Dot and Dash plus low gravity in Space, 40 levels in 4 worlds (not 50), two reference lines per level that also give the hint and the dev record.
- Checked the physics and levels 1–4 and 6–9 in a throwaway simulation outside the repo. It changed the design: no bounce on ink, glancing hits keep speed (curves lost about 10% of their speed without it), lips up to 10 px roll over, RDP is required so jittery gentle lines roll, backboards built into cups, a turn-back fail rule, and three level layouts fixed (one was winnable with no ink).
- Phase 1c review applied: reference lines tested after simplification, distinct overlay styles, easy lines kept under 600 px for trackpads, hint counts only real attempts. Status set to In review.
- Next: Pao reads the GDD for approval; then phase 2, porting the scratch contact checks into `tools/simtest.mjs` first and testing the pen on a real Chromebook trackpad.
