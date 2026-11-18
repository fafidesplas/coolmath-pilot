# Tiny Trains — art credits

Art styles switch with `?art=<id>`, the **Art** pill (title, level select, pause) or the **A** key. Every style except classic replaces the track, trains, ground and scenery with art from a third-party pack. Only the files the game uses are kept in `assets/art/<id>/`, each with its pack's license file. Licenses were checked on each pack's own page on 2026-11-18. The list of styles with previews is in `art-options.json`.

The packs are 3D model kits; the PNGs are top-down renders of their models (orthographic camera, slight three-quarter tilt), made with `tools/artbake`. Nothing is redrawn or recolored by hand. Station houses, depots, switch levers, the golden ticket and the HUD stay drawn in code in every style, so the shape symbols and colors read the same everywhere.

## classic — Classic Toybox
- Everything drawn in code (palette, shapes, particles) with synthesized WebAudio sounds. No third-party assets.

## voxel — Voxel Railway
| Asset | Author | License | Source |
|---|---|---|---|
| Voxel Path And Terrain (forest ground tiles, trees, stones, rails, dead end) | Kytric | CC0 1.0 | https://kytric.itch.io/voxel-path-and-terrain |
| Voxel Vehicles (train-v1 locomotives in red, blue, yellow, green) | Kytric | CC0 1.0 | https://kytric.itch.io/voxel-vehicles |

Attribution is not required by CC0; credit line used: "Voxel art by Kytric (CC0 1.0)". License file: `art/voxel/License-Kytric.txt`.
