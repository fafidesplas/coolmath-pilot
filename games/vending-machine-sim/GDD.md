# Vending Machine Sim — Game design document

**Status:** Draft
**Owner:** Pao · **Reviewed by:** — · **Last updated:** 2026-10-20

> Stock one vending machine, price every slot just under what people will pay, and make rent every night as the machine moves to ever pricier spots.

## 1. Summary
- **Pillars:**
  1. **Read the crowd.** Every decision comes from something the player can see: the paper, the location card, the bubbles over customers' heads. No hidden dice that punish a good read.
  2. **One more day.** A day is 40 seconds, the tally is short and the shop is right after it. Stopping always feels one day too early.
  3. **Everyday math, no lesson.** Cost, price, profit and rent are on screen all the time. The player does real arithmetic because it pays, not because they're told to.
- **Player:** Coolmath regulars aged 12–24 on a school Chromebook or a home laptop, in a small tab, often with the sound off. Fans of the shop and stand games (Lemonade Stand, the Papa's games) and of short roguelite runs.
- **Session:** a day is 40 s at 1x (20 s at 2x, 10 s at 4x) plus about 30 s of prep, tally and shop. A location (4 days) takes 4–5 min. A typical visit is 1–3 locations, 5–15 min. A full run to the Museum takes about 30 min.
- **Hook:** the tally reveals the day's result one line at a time, then rent comes out. Then the shop offers 3 cards you can just afford. And the next location is always one day away.

## 2. Core loop
- **Moment (seconds):** a customer walks up, thinks for 0.7 s and buys or walks off with a bubble (heart, `$$!`, `OUT`, `MEH`). The player reads the bubbles and spots what is selling out or priced too high.
- **Level (minutes):** a location is 4 days. Each day: read the paper → stock and price → open → tally and rent → shop. Clearing day 4 awards 0–3 stars and moves the machine.
- **Meta (days):** a run goes Office → Museum, then endless. Clearing a location unlocks it as a starting spot with extra cash. Players chase 3 stars on every location and a higher best day.

## 3. Mechanics
All numbers are as built in `game.js` unless marked **(new)** or **(changed)**. The game renders at 480×270 and scales up; sizes below are in that frame.

### 3.1 Machine and slots
- The machine starts with 4 slots (max 8) and a capacity of 6 stock per slot (max 18).
- Click a slot to edit it. A slot holds one item, a price and its stock.
- **Assigning an item** sets the price to the item's fair price, rounded to the price step. Any stock already in the slot is refunded at wholesale cost.
- **Stock** is paid at wholesale when loaded and refunded at cost when removed. Unsold stock stays overnight. FILL loads as much as cash and capacity allow; CLEAR empties the slot with a refund.
- **Price steps:** $0.25 under $5, $1 under $20, $5 up to the max. **(changed)** Max price is $99 (was $9999). Customers never pay more than their value (3.3), so prices above about 3× fair only make walk-offs. The old $25 and $100 steps go away.

### 3.2 Items and brands
14 items. Wholesale cost / fair price / popularity (chance a customer wants it at all):

| Item | Cost | Fair | Pop | Unlock (shop price) | Peak hours | Tags |
|---|---|---|---|---|---|---|
| Soda | $0.50 | $1.50 | .85 | start | — | drink, cold, sweet |
| Chips | $0.40 | $1.25 | .75 | start | — | snack, salty |
| Candy | $0.30 | $1.00 | .70 | start | — | snack, sweet |
| Water | $0.25 | $1.00 | .60 | start | — | drink, cold |
| Mint gum | $0.20 | $0.75 | .55 | $1.20 | — | snack |
| Cookie | $0.35 | $1.25 | .60 | $1.60 | — | snack, sweet |
| PB cups | $0.50 | $1.75 | .60 | $2.00 | — | snack, sweet |
| Granola | $0.45 | $1.50 | .45 | $2.00 | — | snack, healthy |
| Coffee | $0.60 | $2.00 | .50 | $2.40 | 8–11 | drink, hot |
| Juice | $0.80 | $2.50 | .50 | $2.80 | 8–11 | drink, cold, healthy |
| Energy | $1.00 | $3.00 | .40 | $3.20 | 14–19 | drink, cold |
| Noodles | $1.00 | $3.50 | .40 | $3.60 | 17–20 | food, hot |
| Sandwich | $1.50 | $4.50 | .45 | $4.40 | 11–14 | food |
| Protein | $1.75 | $5.50 | .35 | $5.20 | — | drink, healthy |

- **Peak hours:** demand ×1.6 inside the window, ×0.7 outside it.
- **Brands:** 3 per item, bought in order in the shop. Each tier adds 40% to wholesale cost, 50% to fair price (rounded to $0.05) and +0.05 popularity. Upgrading rescales the price of any slot holding that item.
- **Top-brand perks:** *popular* (+0.2 popularity), *loved* (+0.03 rep per sale instead of +0.01), *allDay* (no ×0.7 outside peak hours), *steady* (bad news can't lower its demand).

### 3.3 Customers
- People arrive at random between 8 AM and 8 PM. Expected arrivals per day = `(16 + 2.4 × day) × rep × traffic upgrades × news traffic × location traffic`. The gap between arrivals is randomized ×0.4–1.6.
- **Rush hours** (Metro 8–10 and 17–20; Airport 9–12 and 15–18): arrivals ×2.2 inside, ×0.6 outside.
- They queue 24 px apart. The one at the front thinks for 0.7 s (×0.4 at the Metro), then decides and shows a bubble for 1 s.
- **Taste:** each item is wanted with its popularity chance, at a strength of 0.6–1.15. One random item is the favorite at 1.4. Budget is 0.85–1.25 × card-slot upgrades × news budget × location budget.
- **Value of an item** = fair price × want × time-of-day demand × news × location × budget.
- **Decision:** among stocked slots priced at or under their value, they buy the one with the best `(value − price) / fair + random 0–0.25`.
  - Otherwise they walk off, and the reason is shown: `$$!` if something they wanted was too pricey; `OUT` if something they wanted was sold out; `MEH` if nothing appealed.
- **Sale juice:** the item drops into the tray, coin sound, floating `+$`. A sale of $50 or more adds a shake and a jingle.

### 3.4 Reputation
- Ranges from 0.3 to 2 and starts at 1. It multiplies arrivals.
- **Per sale:** +0.01 (+0.03 for *loved* brands).
- **Per walk-off, × location patience:** `$$!` −0.02, `OUT` −0.025, `MEH` −0.005. Patience is 0.5 at the Hospital and 1.5 at the Museum.
- The Mascot card gives +0.3.

### 3.5 Rent and eviction
- Rent is paid at the end of each day: `round((3 + 2 × day) × location rent)`. The day count runs across the whole run.
- Rent multipliers: Office 1, Mall 1.3, Hospital 1.5, Metro 1.6, College 1.7, Airport 2.2, Museum 2.5.
- Cash below $0 after rent means **evicted**, and the run ends.
- Example: Office days 1–4 cost $5, $7, $9 and $11. Mall days 5–8 cost $17, $20, $22 and $25.

### 3.6 Morning news ("The Daily Snack")
- Each day rolls one weather report (100%), a trend (75%) and a disaster (15%, from day 3).
- Effects multiply demand by item or tag, and some change traffic or budgets.
- Only news that touches something the player can sell, or the crowd, is printed.
- 23 events in total: 6 weather, 11 trends, 6 disasters (see `newsEvents` in `game.js`).
- **(changed)** News is rolled from the run's seed (12.2), so a reload can't reroll a bad paper.

### 3.7 Shop
- After each day's tally, 3 random cards are offered from the pool of available upgrades. Each card can be bought once per visit.
- **Rerolls** cost $2, then +$1 each time. The cost resets to $2 at each shop visit.
- **Prices** are 20% of each card's listed base and step. Each copy you already own adds one step:

| Card | Effect | Price (1st, then +) | Limit |
|---|---|---|---|
| Extra slot | +1 slot | $3, +$2 | 8 slots |
| Big coils | +3 stock per slot | $2.40, +$1.60 | 18 |
| Neon sign | +30% customers | $4, +$3 | — |
| Card slot | customers spend +20% | $5, +$3 | — |
| Mascot | +0.3 rep | $2, +$1 | rep < 2 |
| New item | unlocks one item | see 3.2 | once |
| Brand tier *n* | next brand of an unlocked item | `0.2 × (10n + 6 × new fair)` | in order |

### 3.8 Locations
4 days each, in this order. Clearing one unlocks it as a starting spot with `+$20 × index` starting cash (base $15). After the Museum the run goes on forever there as **Endless**.

| # | Location | Tastes | Traffic | Budget | Rent | Special |
|---|---|---|---|---|---|---|
| 1 | Office | coffee ×1.5, food ×1.2, gum ×1.5 | 1 | 1 | ×1 | — |
| 2 | Mall | sweet ×1.5, juice ×1.5, coffee ×0.7 | 1.3 | 1.1 | ×1.3 | — |
| 3 | Hospital | water ×1.6, coffee ×1.8, food ×1.4, healthy ×1.3, sweet ×0.8 | 0.9 | 1.2 | ×1.5 | patient (walk-offs cost half rep) |
| 4 | Metro | coffee ×1.5, energy ×1.8, sandwich ×1.4, gum ×1.5, noodles ×0.5 | 1.2 | 0.9 | ×1.6 | rush hours, quick deciders |
| 5 | College | energy ×2, chips ×1.5, noodles ×2.5, coffee ×1.4, sandwich ×0.6, protein ×0.5 | 1.6 | 0.7 | ×1.7 | — |
| 6 | Airport | water ×1.8, sandwich ×1.5, gum ×2, noodles ×0.6 | 1.1 | 1.6 | ×2.2 | rush hours |
| 7 | Museum | healthy ×1.8, cookie ×1.5, chips ×0.4, soda ×0.6 | 0.7 | 1.5 | ×2.5 | picky (walk-offs cost 1.5× rep) |

### 3.9 Pause and hidden tab **(new)**
- A pause button (top right), P or Esc opens the pause overlay: Resume, Restart run (asks to confirm), Settings, Menu.
- The engine already freezes when the tab is hidden: its frame buffer is capped at 50 ms, so time doesn't jump on return.
- **(new)** On `visibilitychange` to hidden during a day, the pause overlay opens, so returning players aren't dropped mid-rush.

### 3.10 First-run tutorial **(new)**
It runs once, on the first Office day 1 of a player with no save, and can be skipped from the pause menu.
1. The machine opens with soda ($1.50 × 6) and chips ($1.25 × 6) already loaded. Cash shows $9.60.
2. Callout on empty slot 3: "Pick something to sell." The player picks candy and presses FILL.
3. Callout on the − / + buttons: "Cheaper sells more. Pricier earns more." The player changes any price once.
4. Callout on OPEN. The day runs at 1x.
5. On the first walk-off, the day freezes for one callout naming the bubble: "`$$!` Too pricey for them", "`OUT` Sold out" or "`MEH` Nothing they wanted".
6. Callout on the RENT line in the tally: "Rent goes up every day. Run out of cash and you're evicted."
7. Callout in the first shop: "Spend profit on upgrades, or save it for rent."

Each callout is one line, at most 7 words where possible, and points at the thing it names.

## 4. Controls
| Action | Mouse / touch | Keyboard |
|---|---|---|
| Edit a slot | Click the slot | 1–8 |
| Pick an item | Click its card | — |
| Price down / up | − / + buttons | ← / → |
| Stock down / up, FILL, CLEAR | Buttons in the slot editor | ↓ / ↑, F, C |
| Next catalog page | Arrow button | Tab |
| Open the machine / continue | OPEN / CONTINUE button | Space or Enter |
| Day speed | 1X / 2X / 4X buttons | Q / W / E **(new)** |
| Buy a shop card | Click the card | — |
| Reroll | REROLL button | R |
| Pause | Pause button | P or Esc |

- Every action works with the mouse alone. Keys are shortcuts only, and all of them are **(new)**: the prototype has no keyboard input.
- **Deviation from `STANDARDS.md`:** R doesn't restart. Restarting ends a run that can be 30 minutes long, so it lives only in the pause menu with a confirm. R rerolls in the shop instead.
- **(changed)** Every clickable target is at least 29×29 px in the 480×270 frame (48 px on an 800×450 window). See 12, riskiest piece.
- **(changed)** Hover is never required. Card details show on hover with a mouse, and on the first tap on touch (a second tap acts).
- No right-click and no double-click.

## 5. Game elements
| Element | Behavior | First appears | Shape/icon (not color alone) |
|---|---|---|---|
| Slot | Holds item, price, stock | Office day 1 | Item sprite + price tag + stock pips |
| Item card | Pick an item for a slot; shows cost, fair price, tags | Office day 1 | Sprite + name + tag chips **(changed: chips get a 1-letter label, e.g. C for COLD, instead of a color-only strip)** |
| Customer | Queues, decides, buys or walks off | Office day 1 | Pixel person + speech bubble |
| Buy bubble | A sale | Office day 1 | Item sprite + heart |
| `$$!` bubble | Too pricey | Office day 1 | Text `$$!` |
| `OUT` bubble | Sold out | Office day 1 | Text `OUT` |
| `MEH` bubble | Nothing appealed | Office day 1 | Text `MEH` |
| Newspaper | Today's weather, trend, disaster | Office day 1 (disasters from day 3) | Headline + effect list with `x2` style multipliers and up/down arrows |
| Peak hour | Item demand ×1.6 in its window | First time coffee, juice, energy, noodles or sandwich is unlocked | Clock icon on the item card **(new)** |
| Rush hour | Arrivals ×2.2 | Metro | "RUSH HOUR" banner on the keypad clock **(new)** |
| Reputation | Scales arrivals | Office day 1 | Star meter with a number |
| Rent | Paid nightly | Office day 1 tally | Text line with a shake |
| Shop card | Upgrade | After Office day 1 | Icon + name + price |
| Location card | Tastes and levers of the new spot | Each move | Location icon + effect list |

## 6. Level design
- **Structure:** one world of 7 locations, plus Endless. A location is a level of 4 days. Locations come from data; there is no level editor in v1, because the game isn't a puzzle and the location table is short.
- **What each location teaches:**

| # | Location | Teaches |
|---|---|---|
| 1 | Office | The loop: stock, price, rent. Coffee in the morning. |
| 2 | Mall | Bigger crowds: running out of stock costs rep. Sweets sell. |
| 3 | Hospital | Richer, patient buyers: room to raise prices. |
| 4 | Metro | Rush hours: stock deep for the peaks, fast deciders. |
| 5 | College | Big, poor crowd: volume over margin; noodles and energy. |
| 6 | Airport | Rich, captive buyers but steep rent: high prices and the best brands. |
| 7 | Museum | Few, picky buyers: walk-offs hurt most; healthy items and cookies. |
| — | Endless | Everything; rent keeps climbing until you're evicted. |

- **Teaching order:** each location changes one or two levers (traffic, budget, patience, rush, tastes) and its card shows them before day 1. The news adds daily variation from the start; disasters wait until day 3, so the Office's first two days are calm.
- **Difficulty curve:** rent grows by 2 per day, times the location multiplier. Crowd size grows by 2.4 per day. Each location needs a better machine, so the shop is the difficulty valve.
- **Stars (per location, awarded at the end of its day 4):** **(new)**
  - Location earnings = sales − wholesale cost of the items sold − rent paid at this location. Shop spending doesn't count against you.
  - ★ survive all 4 days.
  - ★★ location earnings at least equal to the rent paid there (Office: $32).
  - ★★★ location earnings at least twice the rent paid there (Office: $64).
  - These are starting thresholds. They get tuned in phase 4 so that ★★★ needs a good read of the location, not grinding.
- **Endless:** no stars. The score is the best day reached, as today.
- **The first 10 levels:** there are 7 levels plus Endless, listed in the table above. A second world (for example "Downtown" with harder versions of the same spots) is a "later" idea, not v1.
- **Level data format:** locations stay in `locationTypes` in the game code. Shape:

```js
{
  name: 'METRO STATION', tag: 'METRO', icon: 'energy',
  blurb: 'RUSH HOUR IS EVERYTHING',
  felt: ['#2e2e3a', '#3b3b4c'],          // background tint pair
  effects: { coffee: 1.5, energy: 1.8 }, // demand by item or tag
  traffic: 1.2, budget: .9, rent: 1.6,   // optional, default 1
  patience: 1, think: .4,                // optional, default 1
  rush: [[8, 10], [17, 20]],             // optional
  stars: { two: 1, three: 2 },           // (new) earnings ÷ rent paid
}
```

## 7. Progression and retention
- **Unlocks:** clearing a location unlocks it as a starting spot with +$20 × index starting cash. Unlocks never depend on stars, so a struggling player can still see every spot.
- **Stars:** shown per location on the Pick-a-spot map, with the total out of 21. **(new)**
- **Best day:** shown on the title and the map.
- **Run autosave:** saved at the start of each day (12.2), so closing the tab costs at most one day. **(new)**
- **Daily challenge:** not in v1. Planned as the first feature after v1: a date-seeded run from the Office with a fixed news sequence, scored by best day and cash, plus a copyable emoji line (for example `🥤 Vending Machine Sim 10/21 · Day 14 · ⭐⭐⭐⭐⭐⭐⭐ · $212`). The seeded RNG built for v1 makes this cheap.

## 8. Screens and UI flow
Title → Pick a spot → Location card → Newspaper → Stock up → Day → Tally → Shop → Newspaper (next day) … → Location cleared → Location card (next spot). Eviction ends the run.

- **Title (new):** logo, PLAY (continues a saved run if one exists, otherwise opens Pick a spot), NEW RUN (only when a saved run exists; asks to confirm), settings gear, best day.
- **Pick a spot:** the existing location map. Locked spots show a padlock. Unlocked ones show their stars and starting cash.
- **Location card:** existing. Name, blurb, effect list.
- **Newspaper:** existing. CONTINUE goes to stock up.
- **Stock up:** existing. Machine on the left, slot editor and catalog on the right, cash and rent due tonight in the HUD. OPEN starts the day.
- **Day HUD:** cash (counts up), clock on the keypad, reputation meter, day and location, speed buttons, pause button.
- **Tally:** existing line-by-line reveal: customers, sold, walked, sales, rent, rep.
- **Location cleared (new):** after day 4's tally. Stars fly in one at a time, location earnings count up, best result for this spot is shown. CONTINUE (to the shop), MENU.
- **Shop:** existing 3 cards plus reroll. NEXT DAY.
- **Evicted (changed):** day reached, best day, locations cleared this run. RETRY (same starting spot), MENU.
- **Pause (new):** Resume, Restart run, Settings, Menu.
- **Settings (new):** sound on/off. Music on/off appears only if music is added (10).

## 9. Art direction
- **Family:** Retro Pixel, the game's own family, outside the three shared ones (decided 2026-10-20).
  - 16×16 sprites drawn from text maps with an automatic dark outline, rendered at 480×270 and scaled up without smoothing, with a scanline overlay.
  - Sprites and customers draw only from the fixed 22-color sprite palette in `spriteHex` (the ENDESGA 32 set, chosen once). Location backgrounds use their listed tint pairs.
  - The UI uses only the 6 key colors below.
- **Palette (key colors):**

| Hex | Role |
|---|---|
| `#e43b44` | Machine red: the machine body, alerts, `$$!` and `OUT` |
| `#feae34` | Money gold: cash, prices, stars, the main buttons |
| `#3a4466` | Panel navy: panels, cards, secondary buttons |
| `#181425` | Ink: outlines, shadows, text on light chips |
| `#ead4aa` | Cream: body text, newspaper paper |
| `#0099db` | Info blue: weather, selected states, the speed buttons |

  The UI code today also uses orange, green, gray and a second dark navy. They get folded into these six in the slice.
- **Key visuals:** the chunky red SNAX-O-MAT on the left with the slots behind glass and a keypad clock; customers on the sidewalk to the right; a felt background tinted per location with slow diagonal bands; the newspaper as a full-screen card.
- **Juice list:**
  - Item drop into the tray on every sale; floating `+$` text.
  - Cash counter counts up.
  - Shake on the rent line (4), on a sale of $50 or more (5) and on eviction (8).
  - Tally lines reveal every 0.4 s with a rising tick.
  - Shop cards bob and lift on hover; buying one is a small shake plus a jingle.
  - **(new)** Stars on Location cleared pop in with a scale bounce and a sparkle burst each.
  - **(new)** The reputation meter pulses when it crosses a whole number.
  - **(new)** A 3-coin burst from the tray on a customer's favorite item.
- **Concept art prompts:** starting points for an image generator; the art direction above wins if they disagree. Paste each one whole.
  - **Gameplay screenshot (16:9):** *"Pixel art management game screen, a chunky red vending machine on the left with a glass window full of snacks and sodas in a 2 by 4 grid, gold price tags under each item, a short queue of small pixel people on a sidewalk to the right, a speech bubble with a heart, a dark green felt background with soft diagonal bands, navy UI panels with cream text, gold money counter and a day clock, palette of red #e43b44, gold #feae34, navy #3a4466, ink #181425, cream #ead4aa, blue #0099db, 16-bit pixel art, crisp dark outlines, faint scanlines, 16:9"*
  - **Key art / thumbnail (16:9 and 1:1, no text):** *"a cheerful chunky red vending machine glowing at night, a happy pixel customer catching a soda can as it drops into the tray, gold coins popping into the air, a newspaper fluttering by, warm golden light on a deep green background, 16-bit pixel art, limited palette, crisp dark outlines, no anti-aliasing, bold readable silhouette, centered composition with room for a title, game key art"*
  - **Character and element sheet:** *"pixel art game asset sheet: a red vending machine front view, soda can, chips bag, candy bar, water bottle, cookie, coffee cup, energy drink, sandwich, mint gum, peanut butter cups, granola bar, orange juice, cup noodles, protein shake, three recolored brand variants of the soda can, a small customer sprite in 2 walk frames, speech bubbles with heart, dollar signs and OUT, gold stars, 16x16 sprites scaled up, limited palette, crisp dark outlines, plain light background, evenly spaced, consistent scale"*
  - **Logo (try several, keep the most readable):** *"the words "VENDING MACHINE SIM" in chunky pixel letters styled like a lit vending machine sign, gold #feae34 letters on a dark navy panel, a small soda can dropping off the last letter, 16-bit pixel art, crisp dark outlines, game logo on a plain background, bold and readable at small size"*
  - **Negative prompt (generators that support it; drop "text, letters" for the logo):** *"text, letters, watermark, signature, photorealistic, 3D render, smooth gradients, blurry, gritty, horror, violence, weapons, blood, gambling chips, slot machine, cluttered background, low contrast, extra limbs"*

## 10. Audio
All synthesized with ZzFX through `SoundGenerator` (`templates/gameFx.js`).

| Sound | When | Character |
|---|---|---|
| click | Any button | Short square tick, 600 Hz |
| error | Can't afford, invalid action | Low buzz, 140 Hz |
| coin | Each sale | Bright two-note ping, slight random pitch |
| vend | Item drops into the tray | Low thunk with noise |
| sad | Walk-off | Falling tone |
| tally | Each tally line | Tick, pitch rising line by line |
| buy | Shop purchase, $50+ sale, location cleared | Rising jingle |
| bell | Machine opens | Soft bell, 880 Hz |
| evict | Eviction | Falling, bit-crushed tone |
| star **(new)** | Each star on Location cleared | Rising ping, higher per star |

- The `AudioContext` starts on the first click or key press. Sound is on by default (all effects are tiny), and the toggle persists.
- **Music:** none in v1. A short lo-fi loop, off by default, is a "later" idea (14).

## 11. GameAnalytics
Progression ids: `loc01` … `loc07` for the locations, in the standard `world01` / `level05` style.

| Event id | When it fires | Value |
|---|---|---|
| Progression `Start` `loc0n` | Day 1 of a location begins | — |
| Progression `Complete` `loc0n` | Day 4 of a location survived | Stars (1–3) |
| Progression `Fail` `loc0n` | Evicted at that location | Day reached |
| `tutorial:step01` … `tutorial:step07`, `tutorial:done` | Each callout in 3.10 is completed | — |
| `tutorial:skip` | Tutorial skipped from pause | Step reached |
| `run:start:loc0n` | New run started from a spot | Starting cash |
| `run:continue` | Saved run resumed from the title | Day |
| `day:end` | Each tally | Cash after rent |
| `day:walkoff:pricey` / `:soldout` / `:meh` | Each tally, if more than 0 | Count that day |
| `day:speed:2x` / `:4x` | First switch to that speed in a day | — |
| `shop:buy:<card id>` | Card bought | Price paid |
| `shop:reroll` | Reroll | Price paid |
| `run:evicted` | Eviction | Day reached |
| `run:endless` | First day in Endless | Day |
| `ui:restart` | Restart run from pause | Day |
| `settings:sfx:off` | Sound turned off | — |

**Question the data must answer:** on which day and at which location do runs end, and what separates long runs from short ones: buying slots and coils early, buying brands, or avoiding walk-offs?

## 12. Tech plan
- **Engine:** LittleJS stays (decided 2026-10-20). Ship the release engine build with the optional `build.mjs` minify-and-zip. The game also keeps running straight from `index.html` with no build. Target size under 1 MB zipped.
- **Modules:** split the 1,900-line `game.js` into plain scripts under `src/`, loaded in order from `index.html` (no ES-module import graph, so `file://` still works):
  - `data.js` (items, brands, news, locations, upgrades)
  - `sprites.js`
  - `sim.js` (customers, day, rent, rep, shop)
  - `ui.js` (immediate-mode widgets, screens)
  - `audio.js`, `save.js`, `analytics.js`, `main.js`

  The split happens in the slice, before new features, as a move with no behavior change.
- **Simulation:** variable `dt` from the engine at 60 fps, with speed multipliers for 2x and 4x. **(new)** All game randomness (news, shop offers, customer taste and arrivals) comes from one seeded RNG per run. The seed is stored in the run save. Customer visuals may stay unseeded.
- **Save keys (`cm_vending-machine-sim_…`), all `{ v: 1, … }`, reads wrapped in `try/catch`:**
  - `_progress`: `bestDay`, `unlocked` (count), `stars` (array of 7), `bestEarnings` (array of 7), `tutorialDone`.
  - `_run`: the whole run state at the start of the current day, including `seed`, `rngState`, and today's news. Deleted on eviction.
  - `_settings`: `sfx`, `music`.
  - On first load, the old `vendingMachineSim` key is migrated into `_progress` (`bestDay`, `locationsUnlocked`), then removed.
- **Testing hook:** `window.game` with `screen` (`'title' | 'levels' | 'playing' | 'complete'`, plus `phase` for the inner screen), `level` (location number), `day`, `score` (cash), and `start()`, `restart()`, `win()` (debug only: clears the current location with 3 stars).
- **Riskiest piece: the 48 px touch-target rule at 480×270.** It needs every button to be at least 29 px tall in the frame, and today they are 11–18 px. The stock-up screen (slot editor plus an 8-card catalog) is the tightest.
  - **Proof:** before anything else in the slice, mock the stock-up screen at the new sizes and check it at 800×450 and on a touch screen.
  - **If it doesn't fit:** move the catalog to its own panel that slides over the machine while editing a slot.
- **Second risk:** the seeded RNG has to cover every random call that affects play. Prove it with a debug check: two runs with the same seed and the same inputs must produce identical tallies.

## 13. Scope
- **v1:**
  - Everything already built (7 locations plus Endless, 14 items × 3 brands, 23 news events, shop).
  - The first-run tutorial and stars per location.
  - The full shell: title, pick a spot with stars, pause, settings, location cleared, evicted.
  - Run autosave and the standard save keys.
  - Keyboard shortcuts, 48 px targets and no hover-only actions.
  - Tag chips with letters, max price $99, seeded RNG.
  - GameAnalytics, `window.game` and a release build.
- **Later:**
  - Daily challenge (7).
  - Optional music loop.
  - A second world of harder locations.
  - Per-location side goals (for example "sell 30 coffees").
  - More news events.
- **Cut:**
  - **Prices up to $9999:** they only make walk-offs and huge buttons.
  - **A level editor:** locations are a short data table, not puzzles.
  - **Real-money or mystery cards:** they would make the shop read as gambling; every card stays face up with its price shown.

## 14. Open questions
| Question | Recommendation | Who decides | Status |
|---|---|---|---|
| Final name: "Vending Machine Sim" or the machine's own name, "SNAX-O-MAT"? | Keep "Vending Machine Sim": it's what players search for. Keep SNAX-O-MAT on the machine. | Pao + teammate | Open |
| Star thresholds (1× and 2× rent paid) | Keep for the slice, tune in phase 4 so a first-try Office gets ★★. | Pao | Open |
| Does the stock-up screen fit 29 px targets? | Mock it first in the slice (12); fall back to a sliding catalog panel. | Pao | Open |
| Ad breaks with the Coolmath SDK | Between days at most once every 4 days, ideally on Location cleared. Waiting on Coolmath's rules. | Coolmath | Open |
| Music | None in v1; revisit after the polish phase if testers ask for it. | Pao | Open |
| Kid-safe wording: "TECH BROS IN TOWN", "LOCUST SWARM", "EARTHQUAKE" | Fine as cartoon flavor; ask a teammate to read all 23 headlines once. | Teammate | Open |
| Endless scoring | Best day only; add cash as a tiebreak if the daily ships. | Pao | Open |

## 15. Changelog
- 2026-10-20 — First draft from the brief, the code and the phase 1a answers. Decided: guided first day; keep pixel art and enlarge targets; locations are levels with 1–3 stars; one run with per-location stars; all 7 locations in v1; keep LittleJS; autosave at day start; daily later; max price $99; minimal keyboard shortcuts; shop and rerolls stay as they are; Retro Pixel keeps its own family, with 6 key UI colors and the fixed 22-color sprite palette.
