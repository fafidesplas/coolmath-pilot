# Vending Machine Sim — devlog

## 2026-10-19 — Moved into coolmath-pilot
- Moved from the prototype-city repo into `games/vending-machine-sim/`, with its git history.
- Current state: playable LittleJS prototype with 7 locations, 14 items in 3 brands, morning news and an upgrade-card shop. No game shell, saving format, analytics or GDD yet.
- Added the brief (`CLAUDE.md`), the mechanic diagram (`mechanic.svg`) and this devlog.
- Next: write `GDD.md` for what is built and decide what changes (phase 1).

## 2026-10-16 — Locations, vending classics and brand tiers
- Added 7 locations (Office, Mall, Hospital, Metro, College, Airport, Museum), 4 days each, with their own demand, crowd, budgets, rent, rush hours and patience. Clearing one unlocks it as a starting spot on a new map screen.
- Replaced the odd rule-bending items with vending classics: mint gum, PB cups, granola, juice, noodles and protein shakes.
- Every item now comes in 3 brands bought in the shop, each with a recolored sprite. Top brands get a perk.
- Cheaper upgrades and bigger crowds.
- Color-coded tag chips on item cards, the slot editor and the news, so players can match items to headlines.

## 2026-10-15 — First prototype
- Pixel art LittleJS game: stock and price a vending machine, simulate the day's customers, pay rent, spend profit on upgrade cards.
- Included odd joker-style items and a morning news briefing (weather, trends, natural disasters) that shifts demand.
