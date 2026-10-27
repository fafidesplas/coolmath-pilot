# Echo Steps — devlog

## 2026-10-26 — GDD first draft and review
- Wrote `GDD.md` from the brief, using the recommended answers to the phase 1a questions. Key calls: echoes replay their recorded path exactly and break visibly if you change their past; a resting echo keeps its spot; the clock waits for your first move; a laser zap turns your attempt into an echo that blocks the beam; each stacked echo is worth one tile of climb (105 px jump).
- Previews are part of the design from the start (lesson from Magnet Twins): echo paths with the next second highlighted, forecast arcs on gates 1 s before echoes change them, and a timeline of echo events. Pace is designed in too (lesson from Flip Runner): 5–10 s loops, Loop key, fast-forward while waiting, music that gains a layer per echo.
- Phase 1c review applied: rooms 3, 10 and 26 fixed (two had a cheap solution, one was jumpable), no boost jumps off echoes, no floating echoes, a 0.25 s timing tolerance test and a lone-runner bot, hints from the reference solutions plus a skip. Full list in the GDD changelog. Status: In review.
- Next: Pao reads the GDD for approval; then phase 2 (rooms 1–3, the echo model and the full shell).
