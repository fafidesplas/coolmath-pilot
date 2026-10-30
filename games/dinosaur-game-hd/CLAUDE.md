# Dinosaur Game: Cool Edition — game brief

> The offline browser dino, remastered: jump the cacti, duck the pterodactyls, grab eggs, and race a friend on the same keyboard.

![How Dinosaur Game: Cool Edition plays](mechanic.svg)

**Rank:** New idea · **Genre:** One-button endless runner, 1–2 players · **Art family:** HD Pixel (new, 16-bit SNES look) · **Audience habit:** Coolmath nostalgia (everyone has played the no-internet dino)

@../../STANDARDS.md
@../../PHASES.md

## Why it works for Coolmath
Almost every player has already played the dinosaur game in Chrome when the internet was down, often at school. It needs no tutorial, a run lasts under a minute, and "one more try" comes by itself. The original is bare on purpose; this version keeps its exact feel and adds only the modern runner features that give a reason to come back: eggs, unlockable runners (more dinosaurs, plus the beast from our game Hangman), a daily run, and a 2-player race on one keyboard.

**Name:** "Dinosaur Game: Cool Edition" (the folder slug stays `dinosaur-game-hd`). The original belongs to Google: the name, the logo and the store text never say "Chrome", "Google" or "T-Rex Runner", and the dino and its sprites are original art, not traced from Chrome. We copy the original's tuning numbers, never its code or art.

## The design rule: no bloat
The first 10 seconds must feel exactly like the original: the same two inputs, the same speed curve, the same "you missed one jump and it's over". Every addition must pass this test: *does it change what a run feels like?* If yes, it is out of v1. Eggs, runners and achievements are on top of the run, never inside it: no power-ups, no upgrades that change physics, no lives, no levels.

## Core loop
Title (the dino sleeps; any key wakes it) → run starts → jump and duck through obstacles as the speed rises, grab eggs on the way → one hit ends the run → results: distance, eggs, best → instant restart (under 1 s), or spend eggs to hatch a new runner. A run that grabbed the golden egg also earns a 20 s bonus pterodactyl flight after the results.

## Mechanics
- **Run:** the dino runs automatically. Speed starts slow and rises steadily up to a cap, like the original. Score is distance.
- **Jump:** tap to jump; hold for a higher jump (variable height, as in the original).
- **Duck:** hold down to duck under flying obstacles. Down in the air does a fast-fall.
- **Obstacles:** small and large cacti (single and in groups), and pterodactyls at three heights (jump, duck, or either). Obstacles are generated from a seed; gaps are always clearable at the current speed.
- **Eggs:** small speckled eggs (more "in-world" than coins), placed in arcs, lines, grids and big bunches (like Jetpack Joyride's coins), often on the riskier path (over a tall cactus group, at duck height under a pterodactyl). Eggs never block or change the run. They are counted and banked at the end of the run, crash or not.
- **Day and night:** the scene changes from day to night and back every few hundred meters, like the original, with a smooth color change.
- **Milestones:** a short flash and chime every 100 m.

## 2-player mode
- Two lanes stacked on one screen (P1 top, P2 bottom), both from the same seed, so both see the same obstacles at the same time.
- Both run at the same speed, the same curve as 1P. The first crash ends the race: the crashed dino stays in its lane as a ghost and the other wins after a short victory lap. Crashing in the same frame is a draw.
- Single races, no best-of-3: a big Rematch button and a running tally ("P1 2 – 1 P2"). Eggs earned in 2P go to the shared bank.

## Controls
- **1 player:** Space, Up or W to jump (hold for higher); Down or S to duck / fast-fall. Mouse/touch: press the top two thirds of the screen to jump, hold the bottom third to duck; faint icons show the zones in the first run.
- **2 players:** P1 W (jump) and S (duck); P2 Up (jump) and Down (duck). Touch: P1 has the left half (press to jump, hold the bottom-left corner to duck), P2 the right half (bottom-right corner to duck).
- P to pause, R to restart.

## Shell (differs from STANDARDS)
An endless runner has no levels, so the level-select and star screens are replaced:
- **Title:** logo, **Play** (1P), **2 Players**, **Daily**, **Runners**, settings.
- **Runners:** a row of all the runners. Locked ones show as silhouettes, with their price in eggs (shown as an egg with a progress bar) or their achievement and progress (for example "Reach 2000 m: 1450 / 2000").
- **Results:** distance and eggs count up, best distance, any achievement earned in this run, **Retry** (big) / **Runners** / **Menu**.
- **Daily run:** one date-seeded run per day, same for everyone, with a streak and an emoji result line (STANDARDS daily challenge).

## Runners
All runners are cosmetic: same jump, same speed, same hitbox. Each one has its own run, jump, duck and crash frames, drawn to fit the T-Rex's footprint. Every dinosaur runs on two legs, so it fits the T-Rex's silhouette; four-legged dinosaurs (Triceratops, Stegosaurus) are left out because they don't.

### Dinosaurs hatched with eggs
- **T-Rex:** the default, free from the start.
- **Velociraptor** (300 eggs), **Pachycephalosaurus** (750) and **Parasaurolophus** (1500): spending the eggs plays a short hatch scene, and the dinosaur pops out.

### Dinosaurs unlocked by achievements
The rewards for achievers and completionists: each one unlocks with one achievement and can't be bought.

| Dinosaur | Look | Achievement |
|---|---|---|
| **Hadrosaur** | flat duck bill, no crest | Reach 1000 m in one run |
| **Ceratosaurus** | nose horn, bumpy back | Play the daily run 7 days in a row |
| **Megalosaurus** | plain, heavy meat-eater | Run 50 km in total |
| **Therizinosaurus** | pot belly, giant scythe claws | Reach 3000 m in one run |
| **Allosaurus** | horn crests over the eyes | Win 10 two-player races (the 2P-only bonus) |
| **Spinosaurus** | tall back sail, long snout | Unlock every other runner except Allosaurus (the completionist prize) |

### Hangman beast (achievement)
The furry beast from **Coolmath Hangman** (also ours) joins as one more achievement runner: a round black fur ball with two horns, sleepy white eyes and one fang (reference: `reference/hangman-beast.png`, redrawn as pixel art). Achievement: see 10 nights in total, since it is a creature of the dark. Its sprite needs a light rim or outline so it stays visible against the night sky.

The achievements are tracked only in the save file: no separate achievements screen, the Runners screen is the list.

## Progression and content (v1)
- Endless 1P run, 2P race, daily run.
- 11 runners: the T-Rex, 3 dinosaurs hatched with eggs, and 6 dinosaurs plus the Hangman beast unlocked by achievements.
- One desert scene with day and night.

## Retention
Best distance, daily run streak, saving eggs for the next hatch, chasing the achievement runners, and the friend you just lost to sitting next to you.

## Art direction
**Decided: HD Pixel.** Voxel 3D was the other candidate and is not used.
1. **HD Pixel:** a 16-bit SNES look. The dino is a chunky pixel sprite with more frames than the original (run, jump, duck, crash with a dizzy face), a few colors per sprite instead of one gray, parallax desert layers (dunes, mesas, clouds), and a warm sunset to deep blue night. Drawn in code or a small sprite sheet, Canvas 2D, stays well under 2 MB.
2. **Voxel 3D (not chosen):** the same side-on game rendered as voxel models with a slightly tilted camera, soft shadows and depth. Needs Three.js bundled locally, costs more size and Chromebook performance, and more art time.

Either way: the dino reads instantly as "the dino" (big head, tiny arms), obstacles have strong silhouettes, eggs wobble and glint, and runners change the look, never the hitbox.

### Concept art prompts
- **Gameplay screenshot (16:9):** *"16-bit pixel art side-scrolling runner, a cute green pixel dinosaur with a big head and tiny arms jumping over a cactus in a desert, an arc of small speckled eggs above the cactus, a pterodactyl flying ahead, parallax dunes and mesas, warm sunset sky, crisp SNES-style pixel art, 16:9 game screenshot"*
- **Key art / thumbnail (16:9 and 1:1, no text):** *"a cute pixel art dinosaur mid-jump over a cactus, speckled eggs flying around it, a second dinosaur in another color running below, desert at sunset turning to night with stars, crisp 16-bit SNES-style pixel art, saturated colors, room for a title, game key art"*
- **Character sheet:** *"pixel art dinosaur sprite sheet: run cycle, jump, duck, crash with dizzy eyes; plus a velociraptor, a pachycephalosaurus and a parasaurolophus in the same poses, all two-legged, 16-bit SNES style, consistent size, plain light background, evenly spaced"*
- **Logo:** *"the words "DINOSAUR GAME" in chunky pixel letters with a small "COOL EDITION" banner, a pixel dinosaur head peeking over the letters, 16-bit pixel art, plain background, bold and readable at small size"*
- **Negative prompt:** *"text, letters, watermark, signature, photorealistic, gritty, horror, violence, blood, Google logo, Chrome logo, cluttered background, blurry, low contrast, UI buttons"*

## Audio
Jump "boop", duck swoosh, egg "pip" (pitch rises on an egg streak), hatch crack and jingle, 100 m milestone beep, crash thud. A short chiptune loop, off by default.

## GameAnalytics
- No levels, so progression events use one id per mode: `endless`, `versus`, `daily`, with the distance as score on `Fail`.
- Extra events: `run:death:<obstacle-type>`, `run:distance` (value), `eggs:earned` (value), `runner:hatch:<id>`, `runner:equip:<id>`, `achievement:<id>`, `versus:start`, `versus:winner:<p1|p2>`.
- Questions to answer: do eggs and unlockable runners make runs per session go up compared with plain best-distance? How often is the 2P mode played, and are those sessions longer?

## Scope
- **v1:** 1P endless, 2P race, daily run, eggs, a golden egg that earns a bonus pterodactyl flight (Jetpack Joyride style, after the run), 11 runners (4 dinosaurs, 6 achievement dinosaurs and the Hangman beast), day/night, one desert scene.
- **Later (only if data says so):** more scenes (jungle, volcano, ice) that change every 1000 m, ghost of your best run, color variants of each dinosaur as an egg sink once all 3 are hatched. Not planned: power-ups, missions, upgrades, lives, loot boxes.

## Risks and open questions
- **Feel:** the original's jump arc, hitbox forgiveness and speed curve are what make it work. Measure them by playing the original side by side and match them before adding anything.
- **IP:** keep the name and art clearly original (see above); check "Dinosaur Game" in the name with the team before any public build.
- **Egg sink:** with only 3 dinosaurs to hatch, eggs lose their purpose once all are hatched. Set prices so that takes a while, and keep color variants for later if the data shows players stop caring about eggs.
- **Achievement tuning:** each achievement must be reachable by a committed player without grinding for hours; check the targets against real run data in phase 4.
- **Fitting the footprint:** the Spinosaurus's sail and the Parasaurolophus's crest must stay inside the T-Rex's height. Test those sprites early.
- **Look-alikes:** the Allosaurus, Megalosaurus and Ceratosaurus are all big meat-eaters; each needs one clear head feature and its own color.
- **2P on touch:** left and right halves with a duck corner each; if four hands on one tablet don't work in playtests, 2P becomes keyboard only.
- **Egg placement:** eggs must tempt, not distract. If players die chasing eggs in the first 30 s, move them.

## Definition of done
`STANDARDS.md` checklist, plus: a player who knows the original says it "feels the same, but better" within one run; two players can start a race from the title in two clicks.

## Vertical slice (phase 2)
1P run with jump (variable height), duck and fast-fall; cacti and pterodactyls from a seed; speed ramp; eggs; day/night; crash, results and instant restart; best distance saved; the title with the sleeping dino; GameAnalytics stubs. 2P, runners and achievements come in phase 3.

## How to start
Follow `../../PHASES.md`. `GDD.md` is the design source of truth; no code until it is Approved, then build the vertical slice above.
