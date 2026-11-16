/*
    HOP RACE - medals and the coins they pay (GDD §7; scaffolding). A solo level gives a medal for its best time:
    bronze for any finish, silver and gold for beating the level's target times. The first time a level reaches a
    medal, it pays that medal's coins (and those of the medals under it), which the store spends (src/store.js).
    Target times: HR_MEDAL_TIMES where a level has them, else worked out from the bot's time (levels/ghosts.js);
    a level with neither gives bronze only.
*/

'use strict';

// medal tiers by number: 0 none, 1 bronze, 2 silver, 3 gold. coins is what reaching that tier pays, once per level
const HR_MEDALS = [
    null,
    {id: 'bronze', name: 'Bronze', coins: 25},
    {id: 'silver', name: 'Silver', coins: 50},
    {id: 'gold',   name: 'Gold',   coins: 75},
];

// target times by level id, in ms: {gold, silver}. An entry here wins over the bot's times.
// Rocket, Grapple and Climb have no bot yet: add their times here once they are played in.
const HR_MEDAL_TIMES = {
    // 'rocket-01': {gold: 6000, silver: 10000},
};

// from the bot's fastest run: target = bot time × k + add (ms), rounded up to 0.1 s
const HR_MEDAL_FROM_BOT = {gold: {k: 1.25, add: 500}, silver: {k: 1.75, add: 1500}};
const HR_GHOST_LEAD_MS = 2000;   // a built-in ghost stands still this long first (tools/ghost-gen.js)

const hrMedalTimesCache = {};

// {gold, silver} in ms for a level, or null when it has no target times yet
function hrMedalTimes(id)
{
    if (id in hrMedalTimesCache) return hrMedalTimesCache[id];
    let t = HR_MEDAL_TIMES[id] || null;
    const ghost = HR_GHOSTS[id];
    if (!t && ghost)
    {
        const bot = ghost.ms - HR_GHOST_LEAD_MS;
        const target = r => Math.ceil((bot * r.k + r.add) / 100) * 100;
        t = {gold: target(HR_MEDAL_FROM_BOT.gold), silver: target(HR_MEDAL_FROM_BOT.silver)};
    }
    return hrMedalTimesCache[id] = t;
}

// the medal a time earns on a level. Times compare as shown (one decimal), so a "4.3" always beats a 4.3 target
function hrMedalFor(id, ms)
{
    if (!(ms > 0)) return 0;
    const t = hrMedalTimes(id), shown = Math.round(ms / 100) * 100;
    if (!t) return 1;
    return shown <= t.gold ? 3 : shown <= t.silver ? 2 : 1;
}

// the target time of a medal on a level (ms), or 0 if it has none (bronze, or no times yet)
function hrMedalTarget(id, medal)
{
    const t = hrMedalTimes(id);
    return !t ? 0 : medal == 3 ? t.gold : medal == 2 ? t.silver : 0;
}

// pay a level's medals up to the one its best time earns. Returns {medal, from, coins}: the level's medal now,
// the one it had and the coins just paid (0 if nothing new)
function hrMedalAward(id)
{
    const rec = hrSaveLevel(id), medal = hrMedalFor(id, rec.bestMs);
    if (medal <= rec.medal) return {medal: rec.medal, from: rec.medal, coins: 0};
    let coins = 0;
    for (let m = rec.medal + 1; m <= medal; m++) coins += HR_MEDALS[m].coins;
    hrSave.levels[id].medal = medal;
    hrStoreAddCoins(coins);   // writes the save
    return {medal, from: rec.medal, coins};
}

// on load: pay what the saved best times earn but were never paid for (saves from before medals, or target times
// that were added or eased since). A medal once paid is kept, even if its target gets harder
function hrMedalSync()
{
    for (let w = 0; w < HR_WORLDS.length; w++)
        for (const l of hrLevelsOf(w, false))
            if (hrSave.levels[l.id]) hrMedalAward(l.id);
}

// how many levels hold at least this medal, over every solo level in the game
function hrMedalCount(medal)
{
    let n = 0;
    for (let w = 0; w < HR_WORLDS.length; w++)
        for (const l of hrLevelsOf(w, false)) n += hrSaveLevel(l.id).medal >= medal;
    return n;
}

// a medal in screen space, in two tones so it fits the palette (GDD §9): a disc of diameter d hanging on a ribbon.
// The tier is in the shape: bronze is a ring, silver a solid disc, gold a solid disc with a star cut out.
// c is the medal's color, bg the color behind it
function hrDrawMedal(medal, x, y, d, c, bg)
{
    if (!medal) return;
    for (const side of [-1, 1])
        drawRect(vec2(x + side * d * .2, y - d * .68), vec2(d * .26, d * .6), c, side * .35, false, true);
    hrSCircle(x, y, d, c);
    if (medal == 1) hrSCircle(x, y, d * .52, bg);
    if (medal == 3)
    {
        const pts = [];
        for (let i = 0; i < 10; i++)
        {
            const r = d * (i % 2 ? .15 : .36), a = i * Math.PI / 5;
            pts.push([x + Math.sin(a) * r, y - Math.cos(a) * r]);
        }
        hrSPoly(pts, bg);
    }
}
