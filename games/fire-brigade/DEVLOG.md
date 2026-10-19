# Fire Brigade — devlog

## 2026-10-19 — Moved into coolmath-pilot
- Moved from the prototype-city repo with its full git history; added the brief (`CLAUDE.md`) and `mechanic.svg`.
- Current state: playable LittleJS prototype with two buildings (Apartments, Shopping Mall), solo and 2P co-op, keyboard only.
- Next: write `GDD.md` for what is built and decide what changes (phase 1 of `PHASES.md`).

## 2026-10-17 — Shopping mall, co-op stacking, ledges and barricades
- Added the Shopping Mall level, picked on the title screen next to Apartments: open atrium that never burns, balconies, walkable escalators (one broken), loading dock and roof skylight entries, two fires per floor.
- 2P co-op: a partner's head is a platform; burning ledges and steel barricades opened by levers you reach with a boost. Solo gets ledges with their ladder already down.
- Aerial ladder now always stands street to roof with a landing per floor; debris walls in each standpipe.
- Fire tuning: fires never burn out and spread faster, never spread up a floor; the round is lost only when the whole building is charred.
- Standpipes slowly refill; levers, doors, debris and refill signs draw above fire and smoke.

## 2026-10-16 — First prototype and refill signs
- First playable: side-scrolling firefighting platformer in a four-floor building cross-section, 1P or 2P local co-op.
- Choose a way in (front door, aerial ladder to a window, or roof hatch); auto hose and auto axe; refill at the truck or standpipes.
- Replaced the floating REFILL text with water-drop signs on the truck and standpipes, plus a refill stream and blue glow; wider standpipe refill range.
