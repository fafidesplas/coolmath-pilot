# Chess Defense Notes

## Perk badges

Each perk has a small icon that the player sees in three places: on the board,
on the hover card, and on the selected card.

| Perk   | Icon                 | Board position   | Color          |
|--------|----------------------|------------------|----------------|
| Pierce | Arrow, up and right  | Top-right corner | `PIERCE_COLOR` |
| Rapid  | Lightning bolt       | Top-left corner  | `RAPID_COLOR`  |

- **Board:** the piece's square shows the icon. From tier II on, the tier
  number shows next to the icon.
- **Hover card:** shows only the icons and tier numbers, next to the piece
  name. The full text was too long to read quickly.
- **Selected card:** shows the full perk text, with the icon in front of each
  entry. This teaches the player what each icon means.

### Code

- `towers.js`: `PERK_BADGES`, `perkIconShapes`, `drawPerkIcon`, `renderPerkBadges`
- `ui.js`: `renderCardPerks`, `textWidthScreen`

To give a new perk a badge, add its color and corner to `PERK_BADGES`. Then
add its shape to `perkIconShapes`. Use only convex shapes, because WebGL does
not fill concave shapes correctly.

## Balance: needs work (2026-10-07)

The game feels very unbalanced right now, especially in the early game. Two
recent changes pushed it in different directions, and neither was tuned:

- **Enemy speeds were halved** for every enemy type in `ENEMY_TYPES`
  (`constants.js`). The wave script was written for the old speeds. Slower
  enemies spend more time in range, and more of them are on the board at once.
- **Every cleared wave now ends with a free draft pick** (see
  `vertical-waves-ideas.md`). That is extra free pieces on top of the gold
  shop, on every board.
  **Minor UI inconsistency** The special pieces (from cards between waves) show a different "placement" state on the board. For some reason, ALL board squares light up. It should just match the way normal pieces are placed.

To check when tuning:

- Early waves (1 to 6) against the starting 90 gold, with and without the
  free picks.
- Whether the halved Ravager speed (0.25) is too slow to matter.
- Whether a per-board `speedMul`, like `hpMul`, is better than one global
  speed table.
- Whether the draft should start later, or appear less often.

## References (Pao to play these)

- Comet Crash
- PixelJunk Monsters

## Ideas

- Put the perk icons on the P / F buttons on the selected card.
- Show perks the piece does not have yet as dimmed icons on the hover card.
- Make the new icon pulse on the board when the player buys a perk.
