# Vertical Waves Test — Roguelike Draft Ideas

## Status

**Live on every board: the between-waves draft.** After each cleared wave the
player picks 1 of 3 offered pieces for free, on top of the gold shop. Each
offered piece carries one random signature (the pool of 8 below). Shop pieces
have none. Rules:

- No draft before wave 1, and every board gets the pick, once per wave.
- Pick a card, then place it at once. Prep time starts after it is placed.
- It can go on any square the shop could build on, route squares included.
- A drafted piece is a normal piece: it can be upgraded, take perks, move, and
  be sold for 60% of its base price.
- If a board has no free square left, the pick is skipped.

**PARKED: the gold-free roguelike ruleset.** The full mode was hard to balance,
so Vertical Waves Test (`levels/level08.js`) plays by the normal rules for now.
The code is still in the game. Boards without `draft: true` never touch it.

**To bring it back,** add two fields to the `addLevel` call in `level08.js`:

```js
draft: true,        // no gold; pick 1 of 3 pieces after every wave
buildRows: [7, 8],  // only these rows hold pieces (10 slots)
```

Optional: `startPieces: [["pawn", 8, 0], ...]` puts pieces on the board at the
start of a run. It works on any board.

### What is built

- `signatures.js`: the draft itself. Offers, rarity weights, and 8 signatures:
  Pierce, Rapid, Splash, Sticky, Fork, Martyr, Cleric, Banner.
- `game.js`: the `draft` phase (pick, then place). On a `draft: true` board there
  are also 5 starting picks, and the pick after each wave is all you get. Pieces stay dead. Placing on a back-row piece pushes it one
  square forward when the square ahead is free. A full board means replacing.
- `ui.js`: the 3-card pick screen, placement highlights, and the army bar.
- `towers.js`: signature hooks, plus `addTower` (a free piece) and `relocateTower`.
- `board.js`: `buildRows` support and `isDraftMap()`.

### Why it is parked

- Waves are tuned for a gold economy, so early waves overwhelm a drafted army.
  Every build square is a lane square, so creeps trample the front row.
- Random-pick test runs mostly died around wave 5, even with enemy speeds halved.
- Ideas for later: a lower `hpMul`, a gentler wave table for draft boards, or
  making the front row safer.

### Other changes made along the way (these affect all boards)

- Every enemy's `speed` in `constants.js` was halved.
- The level select is now two columns, with wheel scrolling.

## The mode, as asked

- No gold. Nothing is bought.
- After every wave, the player picks 1 of 3 offered pieces.
- Each offered piece is a chess piece plus a random **signature ability**.
- Only the 2 rows above the King row take pieces (rows 7 and 8 on the
  5×10 board). That is 10 slots. An 11th piece must replace one already there.

## Tags

| Tag  | Meaning |
|------|---------|
| OFF  | Changes how it deals damage |
| CTL  | Slows, freezes, pushes, or stuns enemies |
| SUP  | Helps other pieces or the King |
| RISK | Strong, with a cost or a gamble |
| WILD | Changes the rules of the board |
| NEW  | Needs a new engine feature, not just a number change |

## PAWN — cheap, weak, many of them

1. **Pierce Pawn** — Its shot goes through 2 enemies. `OFF`
2. **Splash Pawn** — Hits explode for 50% damage in a 1-square radius. `OFF`
3. **En Passant** — An enemy that walks past its diagonal takes a free triple-damage shot. `OFF`
4. **Promoter** — Every 10 kills it levels up. After 3 levels it becomes a random bigger piece. `WILD` `NEW`
5. **Phalanx** — +25% damage for each adjacent friendly Pawn. `SUP`
6. **Martyr** — When trampled, it explodes for 8× its hit in a 2-square radius. `RISK`
7. **Sticky Pawn** — Hits slow the enemy by 30% for 2 seconds. `CTL`
8. **Tiny Hammer** — Every 3rd shot knocks the enemy back 1 square. `CTL` `NEW`
9. **Pawn Storm** — Fires a fan of 3 shots, each at 40% damage. `OFF`
10. **Poison Pawn** — Hits poison for 3 damage per second over 4 seconds. Stacks. `OFF` `NEW`
11. **Medic Pawn** — Each hit it lands heals adjacent pieces for 2 HP. `SUP`
12. **Bomb Pawn** — Every 5th shot is a bomb: 4× damage, splash. `OFF`
13. **Shield Pawn** — Absorbs the first hit it takes each wave. `SUP`
14. **Skirmisher** — After a kill, it jumps to a random free square in the 2 build rows. `WILD` `NEW`
15. **Glass Pawn** — 5× damage, 1 HP. `RISK`
16. **Chain Pawn** — Its shot arcs to 2 nearby enemies at 60% damage each. `OFF` `NEW`
17. **Repulse Pawn** — Hits push the enemy back half a square. `CTL` `NEW`
18. **Coin Flip** — Each shot is 50% triple damage, 50% a miss. `RISK`
19. **Echo Pawn** — Repeats its last shot 0.3 seconds later at the same target. `OFF`
20. **Frost Pawn** — Every 4th hit freezes the enemy for 1.5 seconds. `CTL` `NEW`
21. **Rally Pawn** — Adjacent pieces fire 15% faster. `SUP`
22. **Kamikaze Pawn** — Click to sacrifice it: 12× blast in a 2-square radius. Frees the slot. `RISK` `NEW`
23. **Taunt Pawn** — Ravager smashes on adjacent pieces hit this Pawn instead. `SUP` `NEW`
24. **Long Pawn** — Its diagonals reach 2 squares deep instead of 1. `OFF`
25. **Overclock Pawn** — Fire rate rises 5% per consecutive hit. Resets after 2 idle seconds. `OFF`
26. **Tithe Pawn** — Every 8 kills heal the King by 1 HP. `SUP`
27. **Mirror Pawn** — Copies the signature of the piece beside it. `WILD` `NEW`
28. **Domino Pawn** — Kills explode for 30% of the dead enemy's max HP in splash. `OFF`
29. **Spare** — Takes no slot. Max 2 Spares on the board. `WILD` `NEW`
30. **Swarm Pawn** — At wave start, spawns a 50% copy in a free adjacent square. `WILD` `NEW`
31. **Caltrops** — Its target square becomes a 2-second slow zone. `CTL` `NEW`
32. **Squire** — Adjacent Knights deal +30% damage. `SUP`

## KNIGHT — jumps, ignores blockers, hits the opposite color

1. **Fork** — One shot hits two enemies from two different L-squares. `OFF`
2. **Nightrider** — Repeats the L-jump along a line, like a ray made of knight moves. `WILD` `NEW`
3. **Camel** — Leaps (3,1) instead of (2,1). `WILD`
4. **Zebra** — Leaps (3,2). `WILD`
5. **Giraffe** — Leaps (4,1). `WILD`
6. **Alfil** — Leaps (2,2), a diagonal jump that skips a square. `WILD`
7. **Dabbaba** — Leaps (2,0), straight lines two squares out. `WILD`
8. **Knook** — Knight L-squares plus one rook step in each direction. `OFF`
9. **Landing Slam** — When it relocates, it deals a splash hit around the landing square. `OFF` `NEW`
10. **Shockwave Knight** — Each shot has a 1-square splash. `OFF`
11. **Ricochet** — The shot bounces to 2 more enemies. `OFF` `NEW`
12. **Pegasus** — Can relocate to any free build square, not just its L-squares. `WILD` `NEW`
13. **Lancer** — Ignores armor completely. Great against Bulwarks. `OFF`
14. **Executioner** — Kills any non-boss enemy under 25% HP outright. `OFF`
15. **Rearing Horse** — After a kill, its cooldown resets. `OFF`
16. **Dark Horse** — Deals +10% damage for every wave it survives. `OFF`
17. **Trojan Horse** — When it dies, it spawns 2 Pawns where it stood. `RISK` `NEW`
18. **Warhorse** — Double HP. Enemies on its L-squares move 15% slower. `CTL`
19. **Stampede** — Fires faster for every enemy in its range. `OFF`
20. **Switchback** — After each shot, hops to the opposite L-square on its own. `WILD` `NEW`
21. **Chameleon** — Hits both square colors. `OFF`
22. **Shield Bash** — Hits knock enemies back 2 squares. `CTL` `NEW`
23. **Jouster** — Targets the farthest enemy instead of the nearest, for 2× damage. `OFF`
24. **Barded Knight** — Takes 50% less Ravager smash damage. `SUP`
25. **Blitz** — Fires 3× faster for the first 3 seconds of each wave. `OFF`
26. **Gambit Knight** — Click to sacrifice it: 10× damage to every enemy on its L-squares. `RISK` `NEW`
27. **Zugzwang** — Enemies on any of its L-squares are slowed 25%. `CTL`
28. **Crit Knight** — 20% chance for 5× damage. `OFF`
29. **Frostmare** — Hits chill enemies. Two chills in a row freeze them. `CTL` `NEW`
30. **Banner Knight** — Adjacent allies deal +20% damage. `SUP`
31. **Octopus Jump** — Every 5th shot fires from all 8 L-squares at once. `OFF`
32. **Time Knight** — Every 10 seconds it heals to full and resets its cooldown. `SUP`

## BISHOP — diagonals, locked to one square color

1. **Prism** — Shots split into a 3-way fan. `OFF`
2. **Billiard** — The ray bounces off the board edge and hits enemies on the way back. `OFF` `NEW`
3. **Cleric** — Pulses a heal to all pieces within 2 squares every 4 seconds. `SUP` `NEW`
4. **Turncoat** — Flips its square color at the start of each wave. `WILD` `NEW`
5. **Beacon** — The enemy it hits takes +50% damage from every piece. `SUP` `NEW`
6. **Zealot** — Each kill gives +10% damage until the wave ends. Stacks. `OFF`
7. **Burning Ray** — No direct damage. Sets every enemy on its diagonals on fire. `OFF` `NEW`
8. **Mitre** — Adjacent pieces get a 20 HP shield each wave. `SUP` `NEW`
9. **Sniper Bishop** — Fires 3× slower for 3× damage. `OFF`
10. **Smite** — Every 3 seconds, lightning hits a random enemy anywhere. Ignores geometry. `WILD` `NEW`
11. **Convert** — Hit enemies walk backward for 2 seconds. `CTL` `NEW`
12. **Pilgrim** — Slow shot that hits every enemy on the diagonal, with no falloff. `OFF`
13. **Bishop Pair** — +40% damage while a Bishop of the opposite color is on the board. `SUP`
14. **Crossfire** — 2× damage to enemies that another Bishop also covers. `OFF`
15. **Stained Glass** — Shots splash for 1 square. `OFF`
16. **Wraith** — Rays pass through walls and your own pieces. `WILD`
17. **Holy Water** — Hit squares stay blessed 3 seconds. Enemies on them take +25% from all. `CTL` `NEW`
18. **Reliquary** — Absorbs the first 100 damage dealt to any friendly piece. `SUP` `NEW`
19. **Chain Lightning** — The shot arcs through 3 enemies. `OFF` `NEW`
20. **Metronome** — Alternates 0.5× and 2× damage every shot. `RISK`
21. **Leech** — Heals itself for 10% of the damage it deals. `SUP`
22. **Rift** — Hit enemies are teleported back 2 squares. `CTL` `NEW`
23. **Short Sight** — Rays only reach 2 squares, but deal 4× damage. `RISK`
24. **Rapid Fire Bishop** — 3× fire rate, 40% damage. `OFF`
25. **Pyromancer** — Splash that ignites. `OFF` `NEW`
26. **Choir** — +10% fire rate for each other Bishop on the board. `SUP`
27. **Compass** — Fires one diagonal per volley at 3× damage, rotating. `OFF` `NEW`
28. **Veil** — Takes 50% less damage from Ravager smashes. `SUP`
29. **Diagonal Doom** — A hit bursts along the other diagonal through the target. `OFF` `NEW`
30. **Hex** — Hit enemies lose 10% of their max HP per second for 3 seconds. Strong against Titans. `OFF` `NEW`
31. **Resurrection** — When a friendly piece dies, 30% chance it returns at full HP. `SUP` `NEW`
32. **Tithe Bishop** — Every 10 kills heal the King by 1 HP. `SUP`

## ROOK — ranks and files, hits both colors

1. **Battery** — A Rook directly behind it on the same file doubles its fire rate. `SUP`
2. **Castling** — Can relocate by swapping places with any adjacent friendly piece. `WILD` `NEW`
3. **Siege Tower** — 3× damage, half the fire rate, 1-square splash. `OFF`
4. **Barricade** — Each shot drops a 3-second wall in front of the enemy. `CTL` `NEW`
5. **Artillery** — Hits any enemy on the board for half damage, ignoring lines. Slow. `WILD` `NEW`
6. **Earthquake** — Every 6th shot stuns every enemy on its file for 2 seconds. `CTL` `NEW`
7. **Shockwave** — The shot hits every enemy along the whole rank or file. `OFF`
8. **Fortress** — 3× HP, half the fire rate. Adjacent pieces ignore Ravager smashes. `SUP`
9. **Gatling Rook** — Fire rate climbs the longer it keeps shooting, up to 4×. `OFF`
10. **Trebuchet** — Lobs over blockers. Hits the first enemy on its file with 2-square splash. `OFF` `NEW`
11. **Ram** — Hits push the enemy back 1 square. `CTL` `NEW`
12. **Rank and File** — Fires along its rank and its file at the same time. `OFF`
13. **Tower Shield** — Adjacent pieces get a 30 HP shield each wave. `SUP` `NEW`
14. **Overwatch** — Double damage to any enemy that has just entered its rank. `OFF`
15. **Spikes** — Enemies that trample it take 20 damage and are slowed. `RISK`
16. **Gambler** — Damage is random between 0.2× and 5×. `RISK`
17. **Demolition** — 3× damage to Ravagers and Titans. `OFF`
18. **Chain Gang** — Enemies hit share 30% of the damage with their neighbors. `OFF` `NEW`
19. **Crossroads** — Friendly pieces on its rank deal +15% damage. `SUP`
20. **Lockdown** — Every 8 seconds, freezes all enemies in its row for 1 second. `CTL` `NEW`
21. **Smelter** — Kills drop scrap. Each scrap gives +1% damage next wave. `OFF` `NEW`
22. **Lightning Rod** — Every 3rd shot strikes every enemy on its file. `OFF` `NEW`
23. **Reload** — Stores up to 6 shots while idle, then fires them all at once. `OFF` `NEW`
24. **Moat** — Enemies on its rank and file move 20% slower. `CTL`
25. **Bulwark Rook** — Takes half the damage meant for adjacent pieces. `SUP` `NEW`
26. **Pillar of Fire** — Leaves a burning trail on its file. `OFF` `NEW`
27. **Turret** — Alternates its direction each shot, for 2× damage. `OFF`
28. **Sapper** — Plants 3 mines on its rank squares at wave start. `WILD` `NEW`
29. **Siege Engineer** — Splash radius grows by 1 square each wave survived. `OFF` `NEW`
30. **Last Rites** — Once per wave, hits the strongest enemy in line for 25× damage. `OFF`
31. **Sync Rook** — Adjacent Rooks fire at the same moment, each doing +30%. `SUP`
32. **Bell Tower** — Rings every 12 seconds, stunning every enemy for 1 second. `CTL` `NEW`

## QUEEN — all eight directions, hits both colors

1. **Sovereign** — Adjacent pieces get +20% damage and fire rate. `SUP`
2. **Regicide** — 10× damage to the Titan. A Titan kill heals the King. `OFF`
3. **Blazing Star** — Fires all 8 beams at once, each at 50%. `OFF`
4. **Black Widow** — Each kill spawns a Pawn in a free adjacent square. `WILD` `NEW`
5. **Court** — Heals every piece on the board for 3 HP per second. `SUP` `NEW`
6. **Nova** — Every 10 seconds, a pulse hits every enemy on the board. `OFF` `NEW`
7. **Warlord** — Every friendly piece deals +25% damage. `SUP`
8. **Hypnotist** — Hit enemies walk backward for 3 seconds. `CTL` `NEW`
9. **Storm Queen** — Chain lightning through 6 enemies. `OFF` `NEW`
10. **Empress** — Rook lines plus knight L-squares. `WILD`
11. **Princess** — Bishop lines plus knight L-squares. `WILD`
12. **Amazon** — Queen lines plus knight L-squares. Fires slowly. `WILD`
13. **Immortal** — Revives once per wave at half HP. `SUP` `NEW`
14. **Glass Cannon** — 6× damage, 10 HP. `RISK`
15. **Spellcaster** — Each shot adds a random effect: freeze, burn, poison, or heal. `WILD` `NEW`
16. **Guillotine** — Kills any non-boss enemy under 30% HP outright. `OFF`
17. **Devour** — Sacrifice an adjacent friendly piece to gain its signature for good. `WILD` `NEW`
18. **Black Hole** — Every 12 seconds, pulls enemies within 2 squares into one point and damages them. `CTL` `NEW`
19. **Cleave** — Every 2 seconds, hits all 8 squares around her. `OFF`
20. **Time Stop** — Every 20 seconds, freezes all enemies for 2 seconds. `CTL` `NEW`
21. **Phoenix** — When she dies, she explodes and returns next wave at half HP. `RISK` `NEW`
22. **Ricochet Queen** — Shots bounce to 3 more enemies. `OFF` `NEW`
23. **Lady-in-Waiting** — Spawns a free Pawn each wave in a free adjacent square. `WILD` `NEW`
24. **Royal Decree** — Adds 1 to the placement cap. Counts toward the cap itself. `WILD` `NEW`
25. **Vampire** — Heals every piece for 10% of the damage she deals. `SUP` `NEW`
26. **Storm** — Random lightning strikes 5 times per second on random enemies. `OFF` `NEW`
27. **Hall of Mirrors** — Duplicates the shots of every adjacent piece. `WILD` `NEW`
28. **Poison Garden** — Poisons every enemy that enters range. `OFF` `NEW`
29. **Zenith** — Deals more damage for every enemy on the board. `OFF`
30. **Anchor** — Enemies within 5 squares move 50% slower. `CTL`
31. **Check and Mate** — 3 hits mark an enemy. The 4th kills any non-boss outright. `OFF` `NEW`
32. **Ascendant** — All her stats grow +15% for each wave survived. `OFF`

## What this means for the code

- **Every build square is a route square.** Paths fill all 5 columns, so rows
  7 and 8 are lane squares. Every creep that gets that far tramples whatever
  stands there, and lane damage ×2 applies to all 10 slots. This is the core
  tension of the map. It is also why Martyr, Spikes, Shield, and Immortal fit.
- **Gold is out, but the rest of the economy needs a replacement.** No sell
  refunds, upgrades, or perks bought with gold. Draft picks replace all of it.
- **The slot limit.** `canBuildAt` needs a per-map rule: only rows 7 and 8,
  a cap of 10, and a prompt to pick which piece to replace.
- **Per-map fields.** I would add optional fields to the level file, for
  example `draft: true` and `buildRows: [7, 8]`, so other maps stay untouched.
- **A signature system.** Each piece gets one `signature` key. The existing
  `PERKS` table has the shape to copy: a registry of hooks that `towers.js`
  calls at fire time, on hit, on kill, on death, and at wave start.
- **`NEW` entries need more than a number.** Roughly two thirds of this list
  needs something the engine lacks: knockback, freeze, damage over time, shields,
  chain targets, and auras. These are worth building once and sharing.

## Decisions (Pao)

1. Each offered piece has 1 signature.
2. Rarity is set by piece type. Pawns are common, Queens are rare.
3. Fallen pieces stay dead.
4. The existing Pierce and Rapid perks join the signature pool.
