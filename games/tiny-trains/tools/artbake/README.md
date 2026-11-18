# artbake: top-down sprites from the 3D art packs

The sprite-kit art styles (see `src/theme.js`) use PNGs rendered from the packs' own 3D models. Nothing here runs in the game.

Setup (outside the repo): a scratch folder `/tmp/tooling` with `npm i playwright three pngjs` and these files copied in; the unzipped packs under `/tmp` (paths in `gen.mjs`); `python3 -m http.server 8765 --directory /private/tmp`; `CHROME` pointing at a Chromium binary.

    node gen.mjs voxel > jobs.json      # one render job per sprite (orthographic top-down, oblique 0.5)
    node bake.mjs jobs.json out/voxel   # renders each job in headless Chromium with three.js
    node atlas.mjs out/voxel            # packs the 64 train frames into trains.png
    node shots.mjs assets/art/previews 1-7 classic voxel   # 1600x900 previews (game served on :8766)
