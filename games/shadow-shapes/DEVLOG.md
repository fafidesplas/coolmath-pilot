# Shadow Shapes — devlog

## 2026-10-27 — GDD approved
- Pao approved `GDD.md`; status Approved, stage `slice`.
- Next: phase 2, the vertical slice.

## 2026-10-26 — GDD first draft and review
- Wrote `GDD.md` from the brief using the recommended phase 1a answers. Key calls: three path-independent dials (Turn, Tip, Spin) with axis-locked drags and rings that show the axis before it turns; match by IoU on 64×64 masks from our own orthographic projection, with a threshold calibrated per level for a ±6° window; an honest match % plus spill and gap visuals on the wall; time stars with a hint cap; sculptures generated from pixel pictures and revealed as a glowing mosaic; rooms add Spin (Museum), two-part puppets (Theater) and two lights (Observatory).
- Checked the numbers with a throwaway script (outside the repo): one fixed 0.90 threshold gave windows from ±3.5° (key) to ±11° (fish); a nearly symmetric picture (a fish, 0.89 with its mirror) traps players, hence the picture symmetry rule; 50–100% of random sculptures pass the level check.
- Phase 1c review applied: Spin moved to a notched wheel under the object (a dial on the wall changed what a wall drag did and didn't fit two-light or two-part layouts), orthographic camera so the front faces line up into the picture at the reveal, thin pictures rejected instead of clamped, holes at least 2×2 cells, plus smaller fixes listed in the GDD changelog. Status: In review.
- Next: Pao reads the GDD for approval; then set Approved and stage "slice", and start phase 2 by proving the drag feel on a Chromebook trackpad.
