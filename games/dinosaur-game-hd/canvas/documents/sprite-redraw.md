# Sprite redraw in Aseprite: plan

**Status:** done. All 6 batches are approved (batch 6 on 2026-11-27), and the old cell maps are deleted. Every sprite, background and UI button now comes from an `.aseprite` file.

## Goal
Replace the placeholder sprites in `src/art.js` (cell maps drawn in code) with hand-drawn pixel art made in Aseprite. The result is real SNES-style art, as GDD section 9 asks for: "a PNG sprite sheet drawn in a pixel editor".

The image "Current placeholder sprites" on this board shows everything that gets replaced. Each runner row shows run 1, run 2, jump, crash, sleep, slide 1, slide 2, slide crash. The bottom row shows the small and large cactus, pterodactyl (2 frames), egg (2), golden egg (2) and the hatch egg.

## What stays the same
- **Sizes and hitboxes.** Standing frames 22×23 art px, slide frames 28×10 art px, the same as now. Every frame must still pass `tools/art-test.mjs`: no hitbox pixel more than 2 px from the drawn sprite (4 px in the tail notch).
- **Scale.** 1 art pixel = 2×2 logical px, so the game keeps its chunky look.
- **Style rules.** 1 px Night Ink (`#1B2340`) outline, each runner's main color from GDD 7.1, no runner in Cactus Green, and the T-Rex stays slate.
- **Game code that uses the sprites.** `SPR` keeps the same shape, so `render.js` and `ui.js` don't change. The night rim and the locked-runner silhouette are still made in code from the new frames.

## What gets better
- **Shading.** 4–5 colors per runner (outline, shadow, main, light, accent) instead of flat fills: a light top edge, a shaded belly and legs, and a highlight in the eye.
- **4 real run poses.** Now there are 2 leg poses shown 4 times. The redraw gets contact, passing, contact, passing poses, plus a 1 px body bob and arm swing. The game already cycles 4 frames, so the timing stays the same.
- **Clearer faces and features.** Each dinosaur's one head feature (horn, crest, dome, sail, bill, claws) is drawn by hand to read at game size.
- **Crash and sleep.** The dizzy "X" eyes and open mouth on crash. On sleep, shut eyes and a slow-breathing pose (for the title).

## How it is made (Aseprite skill)
1. One editable source file per sprite set in `art/aseprite/` (for example `trex.aseprite`), with tags for each animation: `run`, `jump`, `crash`, `sleep`, `slide`, `slideCrash`.
2. I draw the pixels with Aseprite Lua scripts run in batch mode (`aseprite --batch --script`), so every frame can be redrawn and reviewed. You can open any `.aseprite` file and edit it by hand. The pipeline exports your edits too.
3. Export with the Aseprite CLI to `assets/sprites/<set>.png` and `<set>.json` (fixed grid, no trim, tags listed), with one export script: `tools/export-sprites.sh`.
4. `src/sprites.js` loads the sheets instead of building cell maps. `tools/art-test.mjs` reads the exported PNGs, so the hitbox check covers the real art.
5. The old cell maps stay in `art.js` until the last batch, so a runner that isn't redrawn yet still works.

## Batches
Each batch ends with a review on this board: a contact sheet of the new frames next to the old ones, an animated GIF of the run cycle, and an in-game screenshot. I wait for your OK before I start the next batch.

| # | Batch | Sprites | Frames |
|---|---|---|---|
| 1 | **Pipeline + T-Rex** (the pilot: sets the style for the rest) **Approved** | T-Rex; Lua drawing helpers, palette, export script, sheet loader, art test on PNGs | 10 |
| 2 | **Hatch dinosaurs** **Approved** | Velociraptor, Pachycephalosaurus, Parasaurolophus | 30 |
| 3 | **Achievement dinosaurs I** **Approved** | Hadrosaur, Ceratosaurus, Megalosaurus, Therizinosaurus | 40 |
| 4 | **Achievement dinosaurs II** **Approved** | Allosaurus, Spinosaurus | 20 |
| 5 | **World and eggs** **Approved** | Small cactus, large cactus, pterodactyl (2), flight mount (2, own art, not a flipped pterodactyl), egg (2), golden egg (2), hatch egg (4 stages + 3 shell pieces) | 16 |
| 6 | **Backgrounds and UI buttons** (added by Pao) **Approved** | Sky bands (day, night), stars, sun, moon, clouds, mesas, dunes, ground; button frames (orange, slate and gold, normal and pressed, 9-slice) and icons (pause, sound on and off, previous, next) | 21 |

A dinosaur has 10 frames: 4 run, jump, crash, sleep, 2 slide and a slide crash (slide 1 with dizzy eyes).

The T-Rex goes first and alone because it fixes the shading style, the run cycle and the pipeline. Every other runner then follows it. If you don't like how batch 1 looks, we change the style once, before 10 more runners use it.

## Style decisions (from Pao's T-Rex edits)
- No teeth: the mouth is one ink line out to the snout tip, with a plain jaw under it.
- Crash: X eyes only, no open mouth. Sleep: a single shut line.
- The arm doesn't swing.
- Every other dinosaur is built on Pao's T-Rex (`art/aseprite/runners/base.lua`, made from `trex.aseprite`): same body, legs, run cycle and slide, with its own head, tail and colors on top.

## Batch 6 notes
- **Backgrounds** are drawn in code now (`buildLayers` in `src/render.js`): each layer becomes one Aseprite image at art resolution (1 px per art px, scaled 2× in game), tiling every 640 logical px like now. The night versions stay tinted in code. Parallax speeds and the day and night fade don't change.
- **Buttons** are drawn in code at any width with their label on top: they become 9-slice Aseprite frames (corners fixed, middle stretched), so the text and layout code stay the same. Icons become small frames in one sheet.
- The bitmap font stays in code (`src/font.js`).
- **Done:** the layers are `art/aseprite/bg-*.aseprite` (scripts in `art/aseprite/bg/`), the buttons `ui-button.aseprite` (one `nine` slice; Aseprite's slice center sets the stretched part) and the glyphs `ui-icons.aseprite` (scripts in `art/aseprite/ui/`).
- A button shows its pressed frame for 140 ms after a press. Buttons act on press, so the pressed frame is easiest to see on buttons that keep the screen (sound, page arrows).
- Panels, cards and the NEW BEST tag are still drawn in code.
- Debug key **N** starts night at once, to check the night look.

## Checks for every batch
- `node tools/art-test.mjs` passes (hitboxes and footprints).
- Played in the game with real input: run, jump, duck, crash, title sleep, Runners screen card and locked silhouette, by day and by night.
- Size: all sheets together stay under 100 KB.

## Defaults I will use (tell me if you want them changed)
- Same art resolution as now (22×23 art px per runner). A higher resolution would need new hitbox work and a different look, so it is not in this plan.
- The run cycle stays at 12 fps and the pterodactyl keeps 2 flap frames.
- The old cell maps were deleted from `art.js` after batch 5 was approved. Every sprite now loads from its sheet, with no fallback.

## Editing a sprite by hand
- Open `art/aseprite/<name>.aseprite` in Aseprite, draw, save.
- Run `tools/export-sprites.sh <name>` and reload the game.
- `node tools/art-test.mjs` checks the hitboxes.
- Do not run `BUILD=1 tools/export-sprites.sh`: it rebuilds the file from its Lua script (`art/aseprite/runners/`, `world/`, `bg/` or `ui/<name>.lua`) and loses hand edits.
