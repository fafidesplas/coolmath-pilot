# Tiny Trains — art credits

Art styles switch with `?art=<id>`, the **Art** pill (title, level select, pause) or the **A** key. Only the files the game uses are kept in `assets/art/<id>/`, each with its pack's license file. Licenses were checked on each pack's own page on 2026-11-18.

## classic — Classic Toybox
- Everything drawn in code (palette, shapes, particles) with synthesized WebAudio sounds. No third-party assets.

## pixel — Pixel Town
| Asset | Author | License | Source |
|---|---|---|---|
| Tiny Town (grass tiles, trees, bushes, mushrooms: `tiles/tile_00xx.png`) | Kenney (kenney.nl) | CC0 1.0 | https://kenney.nl/assets/tiny-town |
| Digital Audio (sound effects: `sfx/*.mp3`, converted from OGG) | Kenney (kenney.nl) | CC0 1.0 | https://kenney.nl/assets/digital-audio |
| Pixelify Sans (font: `PixelifySans.ttf`) | The Pixelify Sans Project Authors (github.com/eifetx/Pixelify-Sans) | SIL Open Font License 1.1 | https://fonts.google.com/specimen/Pixelify+Sans |

License files: `art/pixel/License-TinyTown.txt`, `art/pixel/License-DigitalAudio.txt`, `art/pixel/OFL-PixelifySans.txt`.

## meadow — Storybook Meadow
| Asset | Author | License | Source |
|---|---|---|---|
| Medieval RTS (grass tiles, pines, cypresses, bushes, rock: `sprites/*.png`, environment sprites trimmed) | Kenney (kenney.nl) | CC0 1.0 | https://kenney.nl/assets/medieval-rts |
| Interface Sounds (switch, click, confirmations, glass ding: `sfx/*.mp3`, converted from OGG) | Kenney (kenney.nl) | CC0 1.0 | https://kenney.nl/assets/interface-sounds |
| Impact Sounds (crash: `sfx/impactWood_heavy_000.mp3`, `sfx/impactPlank_medium_000.mp3`) | Kenney (kenney.nl) | CC0 1.0 | https://kenney.nl/assets/impact-sounds |
| Fredoka (font: `Fredoka.ttf`) | The Fredoka Project Authors (github.com/hafontia/Fredoka-One) | SIL Open Font License 1.1 | https://fonts.google.com/specimen/Fredoka |

License files: `art/meadow/License-MedievalRTS.txt`, `art/meadow/License-InterfaceSounds.txt`, `art/meadow/License-ImpactSounds.txt`, `art/meadow/OFL-Fredoka.txt`.

## neon — Night Neon
| Asset | Author | License | Source |
|---|---|---|---|
| Audiowide (font: `Audiowide.ttf`) | Astigmatic (Brian J. Bonislawsky) | SIL Open Font License 1.1 | https://fonts.google.com/specimen/Audiowide |

Everything else (glowing rails, trains, board, sounds) is drawn or synthesized in code. License file: `art/neon/OFL-Audiowide.txt`.

Fonts are embedded as local files (loaded with `FontFace`), not fetched from Google, so the game stays self-contained (STANDARDS.md). Kenney asks for nothing in return; crediting is appreciated, not required.
