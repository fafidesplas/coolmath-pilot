# Crowd Tower — Game design document

**Status:** Draft
**Owner:** Pao · **Reviewed by:** — · **Last updated:** 2026-10-27

> Every hour, thousands of players vote on which block to pull from one shared wooden tower; if it falls, it falls for everyone, and the next tower tries to beat its record.

## 1. Summary
- **Pillars:**
  1. **One tower, all of us.** Every player sees the same tower, the same vote and the same result. "We" lost the tower, not "you".
  2. **Will it stand?** Every pull is a small moment of suspense: the block slides, the tower wobbles, then it settles or crashes.
  3. **Ten seconds is enough.** Open, see what happened, vote, leave. Anything longer (replays, solo practice) is optional.
- **Player:** Coolmath players aged 10–24 on a school Chromebook or phone, often with the sound off, opening the game between classes or from the Coolmath home page.
- **Session:** A quick visit is 20–60 s (replay of missed pulls + one vote). A long visit adds the live reveal of the current round and solo practice towers (3–5 min each), so 5–10 minutes.
- **Hook:** "Did it survive?" brings you back. The live record race ("pull 143, last tower fell at 187") and seeing *your* pick get pulled make you vote again.

## 2. Core loop
- **Moment (seconds):** Look at the three tagged blocks → pick one → watch the vote bars move.
- **Round (1 hour):** Votes come in → the round closes on the hour → the top pick slides out → the tower stands (block goes on top) or falls.
- **Meta (days):** Come back → replay the pulls you missed → vote again and keep your streak → the tower climbs toward the record → it falls, enters the hall of fame, and a new tower starts.

## 3. Mechanics

### 3.1 The tower
- A new tower has **18 layers of 3 blocks** (54 blocks). Layers alternate direction: odd layers run along the X axis, even layers along the Z axis, like the real game.
- Each block slot in a layer is **Left, Middle or Right** (L, M, R). A layer's shape is one of:
  | Shape | Slots filled | Notes |
  |---|---|---|
  | Full | L M R | New layers |
  | Center | M + one edge | Off-center: adds **lean** (3.4) |
  | Bridge | L + R | Stable, but no block in it can be pulled |
  | Pillar | M only | Stable, nothing in it can be pulled |
  | Wedge | one edge only | Never allowed; the tower falls (3.3) |
- Pulled blocks are placed on top by the game: a new layer fills L → M → R in the direction that the layer below does not use. The top layer is "open" while it has fewer than 3 blocks.

### 3.2 Legal pulls
- A block can be pulled only if it is **below the top two layers** (the open layer and the last full one), as in the real rules.
- A pull is legal only if the layer it leaves is Full-minus-one (Center or Bridge) or Center-minus-edge (Pillar). Pulling the middle of a Center layer would leave a Wedge, so it is never offered.
- So each layer gives **at most 2 pulls** over its life. A fresh tower has 16 pullable layers = 32 pulls, and every 3 pulls complete one new layer that later adds 2 more. The theoretical maximum is about **96 pulls**; a tower with no legal pull left is retired as a **Perfect Tower** (3.8).

### 3.3 Pull outcome (deterministic rules plus one seeded roll)
Each legal pull has a fall chance `p`. The round's seed decides the roll: the tower falls if `rand(seed) < p`.

`p = clamp(0.004 + K + S + L + H, 0, 0.6)`

| Term | Meaning | Value |
|---|---|---|
| **K** (kind) | What the pull leaves | Full → Bridge (middle pulled): 0.000 · Full → Center (edge pulled): 0.010 · Center → Pillar: 0.025 |
| **S** (stress) | Weight above the block | 0.030 × (layers above ÷ total layers) |
| **L** (lean) | Lean on the block's axis after the pull | 0.012 × lean² |
| **H** (height) | Taller towers sway | 0.0015 × max(0, layers − 18) |

- **Lean** per axis = sum of the offsets of that axis's Center layers (an L+M layer = −1, an M+R layer = +1). Layers on top can cancel lean by being pulled the other way.
- Starting values give a crowd that picks the safest candidate half the time a **median life of ~55 pulls**. The headless simulator (12) tunes the constants; the target is in 13.
- The seed per round is `hash(towerId, roundNumber, serverSecret)`. The server publishes the secret for a round after it closes, so anyone (and the client) can check the result.

### 3.4 Lean you can see
- The tower is drawn leaning by **1.5° per lean point**, so off-center choices show at a glance. Blocks in a Center layer show a small crack mark on the empty side.
- `p` is never shown as a number during a vote. After a reveal, the pulled block gets a label: **Steady** (p < 2%, one bar icon), **Shaky** (2–6%, two bars) or **Risky** (> 6%, three bars). The crowd learns to read the tower from these labels.

### 3.5 Rounds and voting
- **Round length: 60 minutes**, closing on the hour (UTC). Rounds with **zero votes are skipped**: no pull happens, so the tower rests at night.
- Each round offers **3 candidates**, tagged **A, B, C** from lowest to highest on the tower. The round seed picks them from the legal pulls: one from the safest third, one from the middle third, one from the riskiest third (by `p`). With fewer than 3 legal pulls, all of them are offered.
- One vote per player per round, keyed to an anonymous device token (12). A vote can be changed until the round closes; the latest one counts.
- **Top pick wins.** A tie goes to the candidate with the lower `p`.
- The panel shows each candidate's share as a bar and a percentage, rounded to whole numbers, plus "**N players voted this round**". Below 20 voters the panel shows bars without percentages and "A few players voted", so small numbers do not look empty.

### 3.6 The reveal (2.5–4 s)
1. The winning block glows; its tag pops (300 ms).
2. It slides out along its axis over 1200 ms with an ease-in-out, with three small judders.
3. The tower wobbles: amplitude 1° + 25° × p, damped over 800 ms.
4. **Stand:** the block arcs up and lands on the open top layer (500 ms, squash on landing), then "Pull 144 — it stands!".
5. **Fall:** the tower breaks at the pulled layer; the blocks above tumble as scripted rigid bodies (gravity 2400 px/s², bounce 0.3, spin), bounce on the table, and settle in 2 s. Then the **Tower fell** panel (8).

The collapse is a scripted animation drawn from the seed, not a physics simulation; the result is already decided by 3.3.

### 3.7 Since your last visit
- On opening, the client compares the last pull it showed (saved) with the server's current pull.
- 1–10 missed pulls: each replays at 3× speed (about 0.9 s each) with a counter "Pull 132 → 141". A **Skip** button jumps to now.
- More than 10: show a summary card ("27 pulls while you were away") and replay only the last 3.
- If the tower fell while you were away: replay the last pull at normal speed, then the Tower fell panel.

### 3.8 Towers, records and the hall of fame
- **Record = pulls survived.** Days lasted are shown too ("Tower #12 — 143 pulls, 4 days").
- When a tower falls, the next one starts at the next round, with the same 18-layer setup.
- A **Perfect Tower** (no legal pulls left) gets a gold crown in the hall of fame and is retired the same way.
- The hall of fame lists the last 30 towers: number, pulls, days, and the block that ended it with its vote share ("Block B, 35%").

### 3.9 Solo practice tower
- The same rules, but you choose every pull from all legal blocks (not just 3), and each reveal is 1.5 s.
- The seed is random per tower, so solo play has no daily or shared state.
- During solo play, selecting a block shows its Steady / Shaky / Risky label before you confirm, so solo play teaches the risk rules the community vote hides.
- Score = pulls survived. **Stars per tower: 1★ at 20 pulls, 2★ at 40, 3★ at 60.** Best score is saved.

## 4. Controls
| Action | Mouse / touch | Keyboard |
|---|---|---|
| Vote for a candidate | Click or tap its tag on the tower, or its row in the panel | A / B / C, or ↑ ↓ then Enter |
| Change vote | Pick another candidate, then **Change vote** | Same as voting |
| Skip replay | **Skip** button | Space |
| Solo: pick a block | Click or tap the block (hit area grows to 48 px) | Arrows move the cursor block to block, Enter selects |
| Solo: confirm pull | **Pull** button | Enter |
| Pause / back | Pause button | P or Esc |
| Restart solo tower | Restart button | R |

## 5. Game elements
| Element | Behavior | First appears | Shape/icon (not color alone) |
|---|---|---|---|
| Block | Wooden block, 3:1 length to width | Title | Wood grain |
| Candidate tag | Marks a votable block | First community vote | Letter A / B / C in a speech bubble |
| Your vote | Marks your choice | After your first vote | Check mark plus "You" |
| Vote bar | Share of votes | First community vote | Bar length plus % text |
| Crack mark | Center layer's empty side | First edge pull | Zig-zag line |
| Risk label | Steady / Shaky / Risky | First reveal | 1, 2 or 3 bars |
| Round timer | Time to close | Community screen | Clock icon + "12:04" |
| Record line | Last tower's pulls, drawn on the tower's side as a height | Tower #2 | Flag icon + "187" |
| Perfect crown | Tower with no legal pulls left | Hall of fame | Crown |

## 6. Level design
Crowd Tower has no level list. The community tower is the "daily", and the solo practice tower is endless with stars per run. This replaces the worlds-of-levels shell in STANDARDS.md (see 14).

- **Structure:** Community tower (main mode) and Solo practice (endless towers, best score).
- **Teaching order** (first community visit, 3 steps, each a one-line hint over the play area):
  1. "Pick the block you want pulled." (tags bounce)
  2. "Everyone votes. The top pick is pulled on the hour." (panel bar animates)
  3. "If it falls, it falls for everyone." (shows the record line)
  The first solo tower adds: "Pull blocks yourself. Watch the lean."
- **Difficulty curve:** the tower itself gets harder: `S` and `H` grow with height, legal pulls run out, lean builds up. The crowd does not choose difficulty.
- **Stars:** solo only: 20 / 40 / 60 pulls (3.9). Community play has no stars; its result is the tower's record.
- **First 10 levels:** not applicable. The first 10 *community rounds* of every tower are the safe part (p < 3%) and are good moments for new players to join.
- **Data format** (server response, also used by the local fake crowd):

```json
{
  "towerId": 12,
  "round": 144,
  "closesAt": "2026-10-27T15:00:00Z",
  "layers": ["LMR", "LMR", "LM.", "L.R", ".M.", "..."],
  "candidates": [
    { "tag": "A", "layer": 2, "slot": "L" },
    { "tag": "B", "layer": 6, "slot": "M" },
    { "tag": "C", "layer": 11, "slot": "R" }
  ],
  "votes": { "A": 5412, "B": 4503, "C": 2958 },
  "history": [
    { "round": 143, "pulled": { "layer": 4, "slot": "R" }, "share": 0.51, "p": 0.018, "fell": false, "secret": "…" }
  ],
  "record": { "towerId": 11, "pulls": 187 }
}
```
`layers[0]` is the bottom; `.` is an empty slot; odd/even index gives the direction.

## 7. Progression and retention
- **Vote streak:** consecutive local days with at least one vote. Missing a day resets it.
- **Emoji result line** (Copy button, clipboard only, no link):
  ```
  Crowd Tower #12 🧱 Pull 144 stands
  🟫🟫🟫🟫🟫⬛ I voted B (35%)
  Record 187 · Streak 5 🔥
  ```
  The row is the last 6 pulls: 🟫 stand, ⬛ the round you voted in, 💥 fall.
- **Your pick:** when the pull you voted for wins and stands, the reveal says "Your pick! It stands." This is the main personal reward.
- **Solo best and stars** on the title screen.
- No unlocks or cosmetics in v1.

## 8. Screens and UI flow
`Title → Community tower ⇄ Hall of fame` and `Title → Solo practice → Tower over`

- **Title:** logo built of blocks, big **Play** (goes to the community tower), **Solo practice** (with best score and stars), **Hall of fame**, settings cog (music, sound). A live line: "Tower #12 · Pull 144 · Record 187".
- **Community tower (main screen):** tower on the left half on a wooden table; HUD top-left: "Round 144" and "Vote closes in 12:04"; vote panel on the right: "Which block gets pulled?", the 3 rows with bars, "N players voted", **Vote** / **Change vote**; status box below: "This tower has survived 143 pulls · Last tower fell after 187 pulls"; Copy result button; streak flame. Matches the idea slide's mockup.
- **Reveal:** plays in place when the round closes while the screen is open (3.6).
- **Tower fell panel:** "Tower #12 fell after 143 pulls (4 days)", the fatal block with its vote share, NEW RECORD badge if it beat the last one, count-up of the pulls, **See the new tower**.
- **Hall of fame:** list of the last 30 towers (3.8), the record on top.
- **Solo practice:** same tower view; HUD with pulls counter and the 3 star marks; Pause, Restart.
- **Solo tower over:** pulls count-up, stars, best, **Again** / **Menu**.
- **Pause** (solo): Resume, Restart, Menu, sound toggles.
- **Offline / server error:** the last known tower, greyed vote panel, "Can't reach the crowd right now. Try solo practice." Never a blank screen.

## 9. Art direction
- **Family:** Toybox Flat.
- **Palette:**
  | Hex | Role |
  |---|---|
  | `#2F5A9E` | Stage blue: background (darker `#1F3F73` vignette pre-rendered once) |
  | `#E8B86D` | Wood: blocks (lighter top faces `#F3CF8E`, side faces `#C9944D`) |
  | `#8A5A2B` | Table and panel headers |
  | `#2B2233` | Ink: outlines (3 px), text, shadows at 25% |
  | `#FFD23F` | Vote accent: candidate tags, bars, timer digits |
  | `#5CB85C` | Your vote: your check mark, Vote button |
- **Key visuals:** the tower in a fixed **3/4 isometric view** so both faces show block ends: X layers show 3 ends on the left face, Z layers on the right face. This keeps every block clickable (a straight front view, as in the mockup, hides 2 of the 3 blocks in every other layer). Blocks are pre-rendered sprites (3 faces). The camera zooms to keep the whole tower in the 560 px play height down to a 14 px layer, then scrolls with the tower top pinned.
- **Juice list:**
  - Vote: the tag pops with squash, the bar grows with ease-out, "+1" floats up.
  - Pull: three judders as the block slides, dust puff from the hole.
  - Wobble: tower sways (3.6), creak sound in sync.
  - Stand: block lands on top with squash and a dust ring, "It stands!" stamp, confetti if it was your pick.
  - Fall: blocks tumble and bounce, 10 px screen shake for 300 ms, dust cloud, then the panel slides in.
  - Record broken: gold flag on the record line rises past the old one with sparkles.
  - Replays: counter ticks up with each pull.
  - UI: buttons press down 4 px, panels slide in with ease-out.
- **Concept art prompts** (updated from the brief):
  - **Gameplay screenshot (16:9):** *"Flat cartoon wooden block tower in a 3/4 isometric view on a wooden table, deep blue background, one layer missing blocks and leaning slightly, three blocks marked with yellow speech-bubble tags A, B and C, a vote panel with yellow and green bars on the right, thick dark outlines, soft shadows, 2D game screenshot, 16:9"*
  - **Key art / thumbnail (16:9 and 1:1, no text):** *"a tall slightly leaning wooden block tower on a table, one block halfway pulled out, yellow speech-bubble tags with letters on three blocks, many small cartoon hands raised below like a crowd voting, deep blue background with soft spotlights, flat vector cartoon style, warm wood colors, thick dark outlines, soft drop shadows, toy-like and clean, room for a title, game key art"*
  - **Element sheet:** *"game pieces on a plain background: wooden blocks in isometric view from three angles, a block with a zig-zag crack mark, yellow speech-bubble tags with A, B, C, a green check mark badge, a gold crown, a small flag, a clock icon, one, two and three bar icons, flat vector cartoon style, thick dark outlines, soft drop shadows, game asset sheet, evenly spaced, consistent scale"*
  - **Logo:** *"the words "CROWD TOWER" built from stacked wooden blocks, one block half pulled out, flat vector cartoon style, thick dark outlines, soft drop shadows, plain background, bold and readable at small size"*
  - **Negative prompt:** *"text, letters, watermark, signature, photorealistic, gritty, horror, violence, weapons, blood, cluttered background, blurry, low contrast, UI buttons"*

## 10. Audio
All sounds are synthesized with WebAudio and stay under 500 ms unless noted.

| Sound | When | Character |
|---|---|---|
| Vote click | Vote cast or changed | Soft wooden knock |
| Tick | Last 10 s of a round on screen | Quiet clock tick |
| Slide | Block sliding out | Scraping wood, 3 small knocks for the judders |
| Creak | Wobble | Low wooden creak, louder with p |
| Land | Block on top | Hollow thump |
| Stands | Pull holds | Short rising two-note chime; crowd "ooh" if p > 6% |
| Collapse | Tower falls | Cascade of wood clatters, 1.2 s |
| Record | New record | Small fanfare, 1 s |

Music: optional, off by default. A light lo-fi loop (30 s) on the community screen.

## 11. GameAnalytics
| Event id | When it fires | Value |
|---|---|---|
| Progression `Start` `solo` | Solo tower starts | — |
| Progression `Complete` `solo` | Solo tower falls or is perfect | pulls survived |
| `tutorial:step01` … `step03`, `tutorial:done` | Community hints (6) | — |
| `daily:start` | First community screen of the local day | — |
| `daily:complete` | First vote of the local day | — |
| `daily:streak:<n>` | Streak count after the first vote of the day | n |
| `vote:cast` | Vote sent | tower pull number |
| `vote:change` | Vote changed | — |
| `vote:pick:<tag>:<band>` | Vote sent: tag and its risk band (`low` `mid` `high`) | — |
| `replay:seen:<n>` | Missed pulls replayed on open (n capped at 10, `summary` above) | n |
| `replay:skip` | Skip pressed | — |
| `reveal:live` | Player watched a reveal live | 1 if your pick |
| `tower:fell:seen` | Player saw a tower fall (live or replay) | pulls of that tower |
| `share:copy` | Result line copied | — |
| `ui:restart` | Solo restart | — |
| `settings:music:off`, `settings:sfx:off` | Toggles | — |
| `error:offline` | Server unreachable | — |

**Question the data must answer:** Do players who vote come back the next day to see what happened (D1 return of voters vs non-voters), and does watching a fall make them more or less likely to return?

## 12. Tech plan
- **Modules (`src/`):**
  - `tower.js`: pure rules: layers, legal pulls, `p`, lean, place on top, candidate choice. No DOM. Shared byte-for-byte with the server.
  - `rng.js`: seeded generator (mulberry32 over a 32-bit hash of the seed string).
  - `community/service.js`: the interface `getState()`, `vote(tag)`, `onUpdate(cb)`. Two versions:
    - `localCrowd.js`: fake crowd in the browser, 60 s rounds, 500–5000 simulated voters with a bias toward safer picks, for development and the slice.
    - `remote.js`: Coolmath community service (contract in 6, to be agreed). Polls every 30 s and 2 s around round close.
  - `render.js` (isometric tower, sprites pre-rendered once), `reveal.js` (scripted pull, wobble, collapse), `ui.js`, `audio.js`, `analytics.js`, `main.js`.
- **Simulation:** no physics engine. The result of a pull is fixed by `tower.js` + seed; all motion is animation. The game loop runs on `dt` capped at 0.05.
- **Server (outside this repo, needs Coolmath):** stores towers, rounds and votes; closes rounds on the hour; runs the same `tower.js`; dedupes votes per device token; publishes each round's secret after close; rate-limits votes.
- **Save keys:** `cm_crowd-tower_settings`, `cm_crowd-tower_solo` (best, stars), `cm_crowd-tower_community` (`lastSeen: { towerId, round }`, `myVotes` for the last 48 rounds, streak, last vote day), `cm_crowd-tower_device` (random anonymous token; no personal data).
- **Tools:** `tools/simulate.mjs` (Node, headless): runs 10 000 towers with crowd models (safest, random, 50/50, 10% griefers) and prints the median, 10th and 90th percentile life. Used to tune 3.3.
- **Riskiest pieces:**
  1. **The backend does not exist yet.** STANDARDS.md allows no network calls except GameAnalytics and the Coolmath SDK. Build everything against `localCrowd.js` so the slice is playable without a server; the service is a swap.
  2. **Is voting enough fun?** Prove it in the slice with the fake crowd at 60 s rounds before investing in the server.
  3. **Tuning:** prove with `simulate.mjs` before the slice that a tower lasts days, not hours.

## 13. Scope
- **v1:** community tower (rounds, vote, reveal, replay, fell panel), hall of fame, solo practice tower, emoji line and streak, local fake crowd, simulator, remote service against the agreed contract.
- **Later:** event towers (double-speed weekend tower, giant 30-layer tower), community-voted tower skins, "predict: will it stand?" side vote, per-class (teacher) towers.
- **Cut:**
  - Free choice of any block in the community vote: too easy to grief, too hard to read with thousands of voters. Three candidates keep the vote readable.
  - Real rigid-body physics: results would differ between devices and the server could not decide them.
  - Player names, chat or comments on the leaderboard: kid-safety. The hall of fame lists towers, not people.
  - Drag-to-pull skill in solo: adds a second game; revisit after the slice.

**Tuning targets:** median tower life 55 pulls (10th percentile ≥ 20, 90th ≤ 95) with the 50/50 crowd; with 10% griefers the median drops by less than 15%. At hourly rounds with nights mostly skipped (~14 rounds a day), a tower lasts about 3–5 days.

## 14. Open questions
| Question | Recommendation | Who decides | Status |
|---|---|---|---|
| Round length: daily (as the idea slide says), hourly, or shorter? | Hourly: a daily pull makes a tower last months and nobody ever sees a reveal live; hourly gives 3–5-day towers and a live reveal most school periods | Pao + Coolmath | Open |
| Who runs the backend (votes, tower state, rounds)? STANDARDS.md forbids other servers | A Coolmath community service; we write the contract (6) and the shared `tower.js` | Coolmath | Open |
| Identity for one-vote-per-round: Coolmath account, or anonymous device token? | Device token for v1 (no personal data); Coolmath account if they have one | Coolmath | Open |
| Record in pulls or in days (the slide says days, the mockup says pulls)? | Pulls as the record, days shown alongside; pulls don't depend on round length | Pao | Open |
| Show risk (`p`) during the vote? | No number; Steady / Shaky / Risky labels only after a reveal, and before a pull in solo | Pao | Open |
| Is solo practice in v1? It replaces the level-select shell from STANDARDS.md | Yes, small (same rules); it gives the shell stars and teaches the rules | Pao + team | Open |
| Skip rounds with zero votes? | Yes, so towers don't die at night when no one is watching | Pao | Open |
| Name: "Crowd Tower" vs other options | Crowd Tower; never "Jenga" (trademark) | Team | Open |
| Ad breaks | After a replay or a fell panel, never during a reveal | Coolmath | Open |

## 15. Changelog
- 2026-10-27 — First draft from the "CMG Community Features (part 3)" idea slide.
