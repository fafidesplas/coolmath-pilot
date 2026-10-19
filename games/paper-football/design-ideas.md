# Paper Football: design ideas

Ideas that were built, played, and taken out of the game, kept here so they can come back.

## Roguelike upgrade cards (removed)

The last commit with the full system is `ba2e725`. Run `git show ba2e725:chalk-talk/game.js` to see all of it.

### How it played

- Every 120 yards of the drive (`UPGRADE_EVERY`), the game stopped between plays and offered 3 random cards. You picked 1. The cards lasted until the drive ended.
- For testing, `UPGRADE_ON_FIRST_DOWN = true` offered a card on every first down instead.
- Each card had a max count. A card you had maxed out left the pool. When fewer than 3 cards were left, it offered fewer.
- A huge gain could pass two marks at once. The game then offered a second pick right after the first.
- The HUD listed the cards you held (`STIFF ARM · QB RUN x2`) and the yards to the next pick.
- Input: 1 / 2 / 3 or ← → to pick a card, SPACE / ENTER to take it. On touch, tap the card (each third of the screen).

### The cards

| Card | Tag | Max | Effect |
| --- | --- | --- | --- |
| EXTRA WR | PERMANENT | 1 | Another receiver (a CPU decoy on a deep route). +1 defender (a CB). |
| STIFF ARM | PERMANENT | 1 | The ball carrier shrugs off one tackle per first down. **Now standard for every receiver.** |
| QB RUN | 1 USE | 9 | The QB can tuck it and run past the line. No throw that play. |
| TIGHT END | PERMANENT | 1 | An extra blocker on the end of the line. +1 defender (an LB). |
| RUNNING BACK | PERMANENT | 1 | Blocks by the QB, then after the catch flattens one tackler. +1 defender (an LB). |

The EXTRA WR, TIGHT END and RUNNING BACK players now come from the team size setting on the title screen.

### QB RUN details

- The QB normally can't cross the LOS with the ball. With a QB RUN charge, crossing it spends the charge and turns the play into a run with the QB as the ball carrier ("QB RUN!").
- The roles flipped for the run, so the regular ball carrier code could handle it. `endRun` then gave the QB job back ("YOU stay at QB").
- 1P with you at WR: before the snap, a "USE QB RUN?" YES / NO screen came up (Y / N, ← →, or tap a half). If you said yes, your call for the ball after the snap became "RUN IT!", and the CPU QB tucked the ball and ran for the line, sliding away from the closest rusher.
- 1P with you at QB: a blinking "cross the LOS to run!" hint showed under the QB while you held a charge.

### Core code (from `ba2e725`)

```js
const UPGRADE_EVERY = 120;   // drive yards between upgrade picks
const UPGRADE_ON_FIRST_DOWN = true; // testing: pick a card on every first down instead
let nextUpgrade = UPGRADE_EVERY;
let upgradeDue = false;    // UPGRADE_ON_FIRST_DOWN: the last play moved the chains
let upgrades;              // what this drive has picked up, see resetUpgrades
let cards = [], cardChoice = 0; // the upgrade cards on offer, and the highlighted one

const UPGRADES =
[
    {key: 'decoy', name: 'EXTRA WR', tag: 'PERMANENT', max: 1,
        lines: ['another receiver', 'runs a deep route', '+1 defender (a CB)']},
    {key: 'stiffArm', name: 'STIFF ARM', tag: 'PERMANENT', max: 1,
        lines: ['the ball carrier', 'shrugs off a tackle', '(once per first down)']},
    {key: 'qbRun', name: 'QB RUN', tag: '1 USE', max: 9,
        lines: ['your QB can tuck it', 'and run past the line', '(no throw that play)']},
    {key: 'tightEnd', name: 'TIGHT END', tag: 'PERMANENT', max: 1,
        lines: ['an extra blocker', 'on the end of the line', '+1 defender (an LB)']},
    {key: 'runningBack', name: 'RUNNING BACK', tag: 'PERMANENT', max: 1,
        lines: ['blocks by the QB, then', 'flattens a tackler', '+1 defender (an LB)']},
];

// between plays: a drive that just passed the next mark picks a card first
function nextPlay()
{
    if (UPGRADE_ON_FIRST_DOWN)
    {
        if (!upgradeDue)
            return setupPlay();
        upgradeDue = false;
    }
    else
    {
        if (los - START_LOS < nextUpgrade)
            return setupPlay();
        nextUpgrade += UPGRADE_EVERY;
    }
    const pool = UPGRADES.filter(u => upgrades[u.key] < u.max);
    cards = [];
    while (cards.length < 3 && pool.length)
        cards.push(pool.splice(randInt(pool.length), 1)[0]);
    cardChoice = (cards.length - 1) >> 1; // the middle card, or the only one once the pool runs dry
    gameState = 'upgrade';
    stateTimer.set(.6); // a beat so a button mashed through the result banner doesn't pick blind
    sndCatch.play();
}

function pickCard(i)
{
    ++upgrades[cards[i].key];
    sndHut.play();
    nextPlay(); // a huge gain can pass two marks at once
}

// QB run: the QB crosses the line with the ball and the play becomes a run, with them as the ball carrier.
// The roles flip for the run (every run reads wr() as the ball carrier), and endRun hands them the QB job back
function startQBRun(q)
{
    --upgrades.qbRun;
    qbRunning = true;
    qbIndex = 1 - q.index;
    catchY = los;
    catchTime = time;
    gameState = 'run';
    sndHut.play(q.pos);
    addEffect('QB RUN!', q.pos.add(vec2(0, 2)), q.ink, 1.8, true);
}
```

The card screen (`drawCards`), the QB RUN prompt (`drawAskRun`, `answerRun`) and the `'upgrade'` / `'askRun'` input handling in `gameUpdate` are in the same commit.

### Notes for bringing it back

- The cards that added players now come from team size. A returning card system should offer other things: one-use plays, juke and hurdle boosts, a better arm, or defense debuffs.
- Do not use speed upgrades. Cards in these games must not change player speed.
