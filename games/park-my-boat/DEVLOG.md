# Park My Boat — devlog

## 2026-10-23 — First playable prototype
- LittleJS prototype: 8 boat types, 10 levels, one boat per level. Steer with the mouse (hold to steer toward the cursor) or WASD/arrows, Space to drop anchor.
- Custom top-down rigid-body physics (circle hulls, keel drag, impulse collisions with spin), currents that move the water, moored boats on springs, buoys, logs, drifting boats and duck families that flee and get dizzy.
- Anchor drops at the bow; dropping at speed spins the boat out. Stars from position and angle accuracy; damage bill and "ducks offended" for laughs.
- Toybox Flat look drawn in code, title / level select / pause / result screens, save in `cm_park-my-boat_save`.
- Next: playtest the handling of each boat, then write the GDD (phase 1).
