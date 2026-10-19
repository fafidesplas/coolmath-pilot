# Stay Awake — devlog

## 2026-10-19 — Moved into coolmath-pilot
- Moved from the prototype-city repo with its git history; added the brief (`CLAUDE.md`), `mechanic.svg` and this devlog.
- Current state: playable LittleJS clicker with 8 lectures, 13 skills, cold calls and grades, saved to localStorage; no shell, analytics or GDD yet.
- Next: write `GDD.md` describing what is built and deciding what changes (phase 1), and get it approved before any new features.

## 2026-10-16 — Prototype built in prototype-city
- First playable: incremental clicker about surviving a college lecture, with a close-up camera on the hero and classmates cropped at the frame edges.
- Three-column layout (stats, hero portrait, professor subtitles and cold calls); note taking now creeps up while drowsy and shoots up near full wake.
- Stronger pinch, tickle and slap; active abilities moved to their own tray with number keys in the tooltip; new hero look (kayumanggi skin, short black hair, brown eyes).
- Wake became a tank with a max (20 to start, Sleep Eight Hours doubles it up to 10K) that leaks in proportion to what you hold; boredom grows 50% per lecture without limit.
- Notes scale with max wake with up to a x20 awake multiplier; Daydream About Lunch and Bribe the Janitor speed up the lecture clock; new save key.
