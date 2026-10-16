/*
    Vending Machine Sim
    - Prep phase: pick an item for each slot, set its price, and load stock.
      Stock is paid for at wholesale cost when it goes in, and leftovers stay overnight.
    - Day phase: customers queue at the machine. Each wants different things and has
      a budget. Too pricey or sold out and they walk off unhappy, which hurts reputation,
      and reputation decides how many people show up.
    - End of day: rent comes out of your cash. Can't pay and you're evicted.
    - Shop: spend profit on upgrade cards (more slots, bigger coils, new items...)
    - The shop unlocks more vending classics, from mint gum up to protein shakes
    - Every item comes in 3 brands, like Arbee Cola > Arbee Orange > RedWhite Cola.
      Brand upgrades in the shop raise the price people will pay, and top brands get a perk
    - Morning news: each day rolls weather, maybe a trend, and rarely a natural
      disaster, which push demand for items up or down and change foot traffic
    - Locations: the machine moves Office > Mall > Hospital > Metro > College >
      Airport > Museum. Each one lasts 4 days and has its own tastes, crowd size,
      budgets, and rent. Clearing one unlocks the next as a starting spot
    - Pixel art is drawn from text maps into a sprite sheet at startup, and the
      whole game renders at 480x270 and is scaled up without smoothing
    - Controls: mouse only
*/

'use strict';
debugWatermark = false; // hide the FPS/version watermark in the corner

// render at a fixed low resolution and scale it up crisp
const screenW = 480, screenH = 270;
setCanvasFixedSize(vec2(screenW, screenH));
setCanvasPixelated(true);

///////////////////////////////////////////////////////////////////////////////
// pixel art: 16x16 text maps, one character per pixel, '.' is transparent
// every sprite gets a dark 1 pixel outline added automatically

const spriteHex =
{
    k:'#181425', w:'#ffffff', s:'#c0cbdc', S:'#8b9bb4', d:'#5a6988', D:'#3a4466',
    r:'#e43b44', R:'#a22633', o:'#f77622', y:'#feae34', Y:'#fee761',
    g:'#63c74d', G:'#3e8948', b:'#0099db', B:'#124e89', c:'#2ce8f5',
    p:'#b55088', P:'#68386c', n:'#b86f50', N:'#733e39', t:'#e4a672', T:'#ead4aa',
};

const spriteMaps =
{
    soda: [
        '................',
        '................',
        '.....ssssss.....',
        '....sSSSSSSs....',
        '....rrrrrrrr....',
        '....rwwrrrrr....',
        '....rrwwrrrr....',
        '....rrrwwrrr....',
        '....rrrrwwrr....',
        '....rrrwwrrr....',
        '....rrwwrrrr....',
        '....RRRRRRRR....',
        '....sSSSSSSs....',
        '.....ssssss.....',
        '................',
        '................'],
    chips: [
        '................',
        '...yyyyyyyyyy...',
        '...YyYyYyYyYy...',
        '...yyyyyyyyyy...',
        '...yrrrrrrrry...',
        '...yrYYYYYYry...',
        '...yrYrrrrYry...',
        '...yrYYYYYYry...',
        '...yrrrrrrrry...',
        '...yyyttttyyy...',
        '...yyttnnttyy...',
        '...yyyttttyyy...',
        '...yyyyyyyyyy...',
        '...YyYyYyYyYy...',
        '...yyyyyyyyyy...',
        '................'],
    candy: [
        '................',
        '................',
        '................',
        '......NNNN......',
        '.....NnnnnN.....',
        '.....NnNNnN.....',
        '.....NnnnnN.....',
        '.....NnNNnN.....',
        '.....pppppp.....',
        '.....pYYYYp.....',
        '.....pppppp.....',
        '.....pPPPPp.....',
        '.....pppppp.....',
        '.....pPPPPp.....',
        '.....pppppp.....',
        '................'],
    water: [
        '................',
        '......BBBB......',
        '......bbbb......',
        '.......cc.......',
        '......cccc......',
        '.....cwcccc.....',
        '.....cwcccc.....',
        '.....bbbbbb.....',
        '.....bwwwwb.....',
        '.....bBBBBb.....',
        '.....bbbbbb.....',
        '.....cwcccc.....',
        '.....cwcccc.....',
        '.....cwcccc.....',
        '......cccc......',
        '................'],
    cookie: [
        '................',
        '................',
        '................',
        '......tttt......',
        '....tttttttt....',
        '...ttNttttNtt...',
        '...tttttttttt...',
        '..ttttNttttttt..',
        '..tttttttNtttt..',
        '..tNtttttttttt..',
        '...tttttNtttt...',
        '...ttNtttttNt...',
        '....tttttttt....',
        '......tttt......',
        '................',
        '................'],
    coffee: [
        '................',
        '.......w..w.....',
        '......w..w......',
        '.......w..w.....',
        '....SSSSSSSS....',
        '....ssssssss....',
        '....wwwwwwww....',
        '.....wwwwww.....',
        '.....NNNNNN.....',
        '.....nTnnnn.....',
        '.....NNNNNN.....',
        '.....wwwwww.....',
        '......wwww......',
        '......wwww......',
        '................',
        '................'],
    energy: [
        '................',
        '.....ssssss.....',
        '....sSSSSSSs....',
        '....GGGGGGGG....',
        '....GggggggG....',
        '....GgYYgggG....',
        '....GggYYggG....',
        '....GgggYYgG....',
        '....GggYYggG....',
        '....GgYYgggG....',
        '....GggggggG....',
        '....GggggggG....',
        '....GGGGGGGG....',
        '....sSSSSSSs....',
        '.....ssssss.....',
        '................'],
    sandwich: [
        '................',
        '................',
        '................',
        '...........tt...',
        '.........ttTt...',
        '.......ttTTTt...',
        '.....ttTTTTTt...',
        '...ttTTTTTTTt...',
        '..tggggggggggg..',
        '..rrrrrrrrrrrr..',
        '..YYYYYYYYYYYY..',
        '..tTTTTTTTTTTt..',
        '..tttttttttttt..',
        '................',
        '................',
        '................'],
    coin: [
        '................',
        '................',
        '................',
        '................',
        '......YYYY......',
        '.....YyyyyY.....',
        '....YyYYYYyY....',
        '....YyYyyYyY....',
        '....YyYyyYyY....',
        '....YyYYYYyY....',
        '.....YyyyyY.....',
        '......YYYY......',
        '................',
        '................',
        '................',
        '................'],
    gum: [
        '................',
        '................',
        '.......ss.......',
        '.......sw.......',
        '.......sw.......',
        '...gggggggggg...',
        '...gwwwwwwwwg...',
        '...gwccccccwg...',
        '...gwcGGGGcwg...',
        '...gwccccccwg...',
        '...gwcGGGGcwg...',
        '...gwccccccwg...',
        '...gwwwwwwwwg...',
        '...gggggggggg...',
        '................',
        '................'],
    pbcups: [
        '................',
        '................',
        '................',
        '................',
        '....NNNNNNNN....',
        '...NnnnnnnnnN...',
        '...NnnnnnnttN...',
        '...NnnnnnntTt...',
        '...NnnnnnnttN...',
        '...oooooooooo...',
        '...oyoyoyoyoo...',
        '....oyoyoyoy....',
        '....oyoyoyoy....',
        '.....oooooo.....',
        '................',
        '................'],
    granola: [
        '................',
        '................',
        '................',
        '................',
        '................',
        '..s..........s..',
        '..sggggggggggs..',
        '..sgtnTtntTngs..',
        '..sgnTtntTtngs..',
        '..sgtnTtntTngs..',
        '..sggggggggggs..',
        '..s..........s..',
        '................',
        '................',
        '................',
        '................'],
    juice: [
        '................',
        '......GGGG......',
        '......gggg......',
        '......oooo......',
        '.....oooooo.....',
        '.....owoooo.....',
        '.....wwwwww.....',
        '.....wyyyyw.....',
        '.....wyoogw.....',
        '.....wyyyyw.....',
        '.....wwwwww.....',
        '.....owoooo.....',
        '.....owoooo.....',
        '.....oooooo.....',
        '......oooo......',
        '................'],
    noodles: [
        '......w...w.....',
        '.....w...w......',
        '..ssssssssssss..',
        '..SSSSSSSSSSSS..',
        '..wwwwwwwwwwww..',
        '...rrrrrrrrrr...',
        '...rYYrrYYrrr...',
        '...rrrrrrrrrr...',
        '...wwwwwwwwww...',
        '....wwwwwwww....',
        '....wwwwwwww....',
        '....rrrrrrrr....',
        '.....wwwwww.....',
        '................',
        '................',
        '................'],
    protein: [
        '................',
        '.......dd.......',
        '......DDDD......',
        '.....DDDDDD.....',
        '.....ssssss.....',
        '.....bbbbbb.....',
        '.....bcbbbb.....',
        '.....bcwwwb.....',
        '.....bwBBwb.....',
        '.....bwBBwb.....',
        '.....bcwwwb.....',
        '.....bcbbbb.....',
        '.....bbbbbb.....',
        '.....BBBBBB.....',
        '......BBBB......',
        '................'],
    heart: [
        '................',
        '................',
        '................',
        '................',
        '....rr...rr.....',
        '...rrrr.rrrr....',
        '...rwrrrrrrr....',
        '...rrrrrrrrr....',
        '....rrrrrrr.....',
        '.....rrrrr......',
        '......rrr.......',
        '.......r........',
        '................',
        '................',
        '................',
        '................'],
};

// customers are drawn in tinted layers so every one can look different:
// h hair, e skin, w shirt, p pants, k always black (eyes and shoes)
const personFrames = [
    [
        '................',
        '......hhhh......',
        '.....hhhhhh.....',
        '.....heeeeh.....',
        '.....ekeeke.....',
        '.....eeeeee.....',
        '......eeee......',
        '.....wwwwww.....',
        '....wwwwwwww....',
        '....ewwwwwwe....',
        '....ewwwwwwe....',
        '.....pppppp.....',
        '.....pp..pp.....',
        '.....pp..pp.....',
        '.....kk..kk.....',
        '................'],
    [
        '................',
        '......hhhh......',
        '.....hhhhhh.....',
        '.....heeeeh.....',
        '.....ekeeke.....',
        '.....eeeeee.....',
        '......eeee......',
        '.....wwwwww.....',
        '....wwwwwwww....',
        '....ewwwwwwe....',
        '....ewwwwwwe....',
        '.....pppppp.....',
        '....pp....pp....',
        '....pp....pp....',
        '....kk....kk....',
        '................'],
];

const spriteIndex = {}; // sprite name -> tile index in the sheet

// draw every sprite into one canvas, handed to the engine as its texture
function buildSpriteSheet()
{
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const context = canvas.getContext('2d');
    let count = 0;

    const filled = (map, x, y) => map[y] && map[y][x] && map[y][x] != '.';
    const addTile = (name, pixelFn) =>
    {
        const ox = count % 16 * 16, oy = (count / 16 | 0) * 16;
        for (let y = 0; y < 16; ++y)
        for (let x = 0; x < 16; ++x)
        {
            const color = pixelFn(x, y);
            if (!color)
                continue;
            context.fillStyle = color;
            context.fillRect(ox + x, oy + y, 1, 1);
        }
        spriteIndex[name] = count++;
    };
    const isOutline = (map, x, y) => !filled(map, x, y) &&
        (filled(map, x-1, y) || filled(map, x+1, y) || filled(map, x, y-1) || filled(map, x, y+1));

    // full color sprites with an automatic outline
    for (const name in spriteMaps)
    {
        const map = spriteMaps[name];
        addTile(name, (x, y) => isOutline(map, x, y) ? spriteHex.k : filled(map, x, y) ? spriteHex[map[y][x]] : 0);
    }

    // higher brands are palette swaps of the base item
    for (const key of itemKeys)
    for (const brand of itemTypes[key].brands)
    {
        if (!brand.recolor)
            continue;
        const map = spriteMaps[key];
        const color = (char) => spriteHex[brand.recolor[char] || char];
        addTile(brand.sprite, (x, y) => isOutline(map, x, y) ? spriteHex.k : filled(map, x, y) ? color(map[y][x]) : 0);
    }

    // customer layers, each one white so it can be tinted when drawn
    personFrames.forEach((map, frame) =>
    {
        addTile('personOutline' + frame, (x, y) => isOutline(map, x, y) || map[y][x] == 'k' ? spriteHex.k : 0);
        addTile('personPants' + frame, (x, y) => map[y][x] == 'p' ? '#fff' : 0);
    });
    const map = personFrames[0];
    for (const [layer, char] of [['personHair', 'h'], ['personSkin', 'e'], ['personShirt', 'w']])
        addTile(layer, (x, y) => map[y][x] == char ? '#fff' : 0);

    return canvas.toDataURL();
}

///////////////////////////////////////////////////////////////////////////////
// items and upgrades

// cost is wholesale, fair is what a typical customer thinks it's worth
// pop is the chance a customer is in the mood for it at all
// peak hours boost demand (coffee in the morning, sandwiches at lunch)
const itemTypes =
{
    soda:     {name:'SODA',     cost:.50,  fair:1.50, pop:.85, tags:['drink', 'cold', 'sweet']},
    chips:    {name:'CHIPS',    cost:.40,  fair:1.25, pop:.75, tags:['snack', 'salty']},
    candy:    {name:'CANDY',    cost:.30,  fair:1.00, pop:.70, tags:['snack', 'sweet']},
    water:    {name:'WATER',    cost:.25,  fair:1.00, pop:.60, tags:['drink', 'cold']},
    cookie:   {name:'COOKIE',   cost:.35,  fair:1.25, pop:.60, unlock:8, tags:['snack', 'sweet']},
    coffee:   {name:'COFFEE',   cost:.60,  fair:2.00, pop:.50, unlock:12, peak:[8, 11], tags:['drink', 'hot']},
    energy:   {name:'ENERGY',   cost:1.00, fair:3.00, pop:.40, unlock:16, peak:[14, 19], tags:['drink', 'cold']},
    sandwich: {name:'SANDWICH', cost:1.50, fair:4.50, pop:.45, unlock:22, peak:[11, 14], tags:['food']},

    gum:      {name:'MINT GUM', cost:.20,  fair:.75,  pop:.55, unlock:6,  tags:['snack']},
    pbcups:   {name:'PB CUPS',  cost:.50,  fair:1.75, pop:.60, unlock:10, tags:['snack', 'sweet']},
    granola:  {name:'GRANOLA',  cost:.45,  fair:1.50, pop:.45, unlock:10, tags:['snack', 'healthy']},
    juice:    {name:'OJ',       cost:.80,  fair:2.50, pop:.50, unlock:14, peak:[8, 11], tags:['drink', 'cold', 'healthy']},
    noodles:  {name:'NOODLES',  cost:1.00, fair:3.50, pop:.40, unlock:18, peak:[17, 20], tags:['food', 'hot']},
    protein:  {name:'PROTEIN',  cost:1.75, fair:5.50, pop:.35, unlock:26, tags:['drink', 'healthy']},
};
const itemKeys = Object.keys(itemTypes);
itemTypes.juice.name = 'JUICE';

// each item comes in 3 brands, bought up through the shop: [name, sprite recolor, perk]
// the recolor swaps sprite palette characters so every brand looks different
const itemBrands =
{
    soda:     [['ARBEE COLA'],  ['ARBEE ORANGE', {r:'o', R:'n'}],        ['REDWHITE COLA', {r:'w', w:'r', R:'s'}, 'popular']],
    chips:    [['CRUNCHOS'],    ['CRUNCHOS BBQ', {y:'o', Y:'y'}],        ['KETTLE KING', {y:'P', Y:'p', r:'Y'}, 'steady']],
    candy:    [['CHOCO CHOMP'], ['CHOMP CARAMEL', {p:'o', P:'n'}],       ['VELVET BAR', {p:'D', P:'k', Y:'y'}, 'loved']],
    water:    [['AQUAPURE'],    ['GLACIER H2O', {b:'c', B:'b'}],         ['ALPINE MIST', {b:'s', B:'S', c:'w'}, 'popular']],
    cookie:   [['CRUMBLES'],    ['GRAN\'S BATCH', {t:'T'}],              ['BUTTER BARON', {t:'y', N:'n'}, 'loved']],
    coffee:   [['JOE-TO-GO'],   ['BEANWORKS', {N:'G', n:'g'}],           ['ROAST ROYALE', {N:'P', n:'p', w:'T'}, 'allDay']],
    energy:   [['VOLTZ'],       ['VOLTZ ZERO', {G:'D', g:'d'}],          ['MEGAWATT', {G:'B', g:'b', Y:'w'}, 'allDay']],
    sandwich: [['QUIKSUB'],     ['DELI CLUB', {Y:'o'}],                  ['ARTISAN STACK', {t:'n', T:'t'}, 'allDay']],
    gum:      [['MINTZ'],       ['ARCTIC MINTZ', {g:'b', G:'B'}],        ['ZEN LEAF', {g:'w', c:'g'}, 'loved']],
    pbcups:   [['NUTTY CUPS'],  ['NUTTY CUPS XL', {o:'r', y:'Y'}],       ['PB PALACE', {o:'P', y:'p'}, 'steady']],
    granola:  [['OATIES'],      ['OATIES HONEY', {g:'y'}],               ['SUMMIT CRUNCH', {g:'G', s:'Y'}, 'steady']],
    juice:    [['SUNNY OJ'],    ['FRESH SQUEEZE', {G:'Y', g:'y'}],       ['GROVE GOLD', {o:'y', y:'Y'}, 'allDay']],
    noodles:  [['SLURPO'],      ['SLURPO SPICY', {r:'o', Y:'r'}],        ['RAMEN MASTER', {r:'D', w:'T'}, 'popular']],
    protein:  [['GAINZ'],       ['GAINZ CHOCO', {b:'n', B:'N', c:'t'}],  ['IRON WHEY', {b:'D', B:'k', c:'Y'}, 'loved']],
};

// perks for the top brands, with how they read on a shop card and in the slot editor
const brandPerks =
{
    popular: {card:'MORE PEOPLE\nWANT IT',  note:'BEST SELLER'},
    loved:   {card:'+REP ON\nEVERY SALE',   note:'FAN FAVORITE: +REP'},
    allDay:  {card:'NO SLOW\nHOURS',        note:'SELLS WELL ALL DAY'},
    steady:  {card:'IGNORES\nBAD NEWS',     note:'LOYAL FANS, NO BAD NEWS'},
};

// each brand tier costs 40% more wholesale but sells for 50% more, and a bit more people want it
const roundCents = (amount) => Math.round(amount * 100) / 100;
for (const key of itemKeys)
{
    const item = itemTypes[key];
    item.brands = itemBrands[key].map(([name, recolor, perk], tier) => (
    {
        name, recolor, perk,
        sprite: tier ? key + tier : key,
        cost: roundCents(item.cost * (1 + .4 * tier)),
        fair: Math.round(item.fair * (1 + .5 * tier) * 20) / 20,
        pop: Math.min(.95, item.pop + .05 * tier + (perk == 'popular' ? .2 : 0)),
    }));
}

///////////////////////////////////////////////////////////////////////////////
// morning news: every day rolls one weather report, usually a trend, and
// sometimes a natural disaster
// effects multiply how much customers want items, keyed by item or by tag,
// traffic scales how many people show up, budget scales what they'll pay

// every tag has its own chip color, used on items and in the news so they match up
// color is a sprite palette character, dark chips get white text
const tagStyles =
{
    drink:   {label:'DRINK',   color:'b', dark:true},
    cold:    {label:'COLD',    color:'c'},
    hot:     {label:'HOT',     color:'o'},
    snack:   {label:'SNACK',   color:'y'},
    sweet:   {label:'SWEET',   color:'p', dark:true},
    salty:   {label:'SALTY',   color:'n', dark:true},
    food:    {label:'FOOD',    color:'R', dark:true},
    healthy: {label:'HEALTHY', color:'g'},
};

const newsCategories =
{
    weather:  {label:'WEATHER',  color:new Color().setHex('#0099db'), chance:1},
    trend:    {label:'TRENDING', color:new Color().setHex('#b55088'), chance:.75},
    disaster: {label:'DISASTER', color:new Color().setHex('#e43b44'), chance:.15, minDay:3},
};

const newsEvents =
[
    // weather
    {cat:'weather', title:'CLEAR SKIES',    blurb:'A PERFECTLY NORMAL DAY',      weight:4, effects:{}},
    {cat:'weather', title:'HEATWAVE',       blurb:'THE SIDEWALK IS SIZZLING',    weight:2, effects:{cold:2, hot:.4, candy:.5}},
    {cat:'weather', title:'RAINY DAY',      blurb:'BRING AN UMBRELLA',           weight:2, effects:{hot:1.6, snack:1.3}, traffic:.75},
    {cat:'weather', title:'SNOW DAY',       blurb:'SCHOOL IS CANCELLED',         weight:1, effects:{hot:2.2, cold:.6}, traffic:.6},
    {cat:'weather', title:'PEA SOUP FOG',   blurb:'CAN\'T SEE A THING',          weight:1, effects:{hot:1.4}, traffic:.85},
    {cat:'weather', title:'GALE WARNING',   blurb:'HOLD ON TO YOUR HATS',        weight:1, effects:{hot:1.3, chips:.6}, traffic:.8},

    // trends
    {cat:'trend', title:'HYDRATION INFLUENCER', blurb:'DRINK WATER, BESTIES',    effects:{water:2.5, soda:.6}},
    {cat:'trend', title:'KETO CRAZE',       blurb:'CARBS ARE CANCELLED',         effects:{sweet:.4, chips:.6, protein:2.5}},
    {cat:'trend', title:'NATIONAL SUGAR DAY', blurb:'DENTISTS FURIOUS',          effects:{sweet:2}},
    {cat:'trend', title:'ESPORTS FINALS',   blurb:'GAMERS NEED FUEL',            effects:{energy:2.5, chips:1.5}},
    {cat:'trend', title:'OFFICE LUNCH RUSH', blurb:'NOBODY PACKED A LUNCH',      effects:{food:1.8}, traffic:1.1},
    {cat:'trend', title:'NEW YEAR RESOLUTIONS', blurb:'THE GYM IS PACKED',       effects:{healthy:2, sweet:.6}},
    {cat:'trend', title:'FRESH BREATH WEEK', blurb:'DATE NIGHT EVERY NIGHT',     effects:{gum:3}},
    {cat:'trend', title:'PB CUP CHALLENGE', blurb:'NOBODY CAN EAT JUST ONE',     effects:{pbcups:3}},
    {cat:'trend', title:'JUICE CLEANSE',    blurb:'VITAMIN C IS BACK',           effects:{juice:2.5, soda:.6}},
    {cat:'trend', title:'NOODLE NIGHT',     blurb:'SLURP RESPONSIBLY',           effects:{noodles:2.5}},
    {cat:'trend', title:'TECH BROS IN TOWN', blurb:'MONEY TO BURN',              effects:{protein:2, sandwich:1.5}, budget:1.2},

    // natural disasters
    {cat:'disaster', title:'EARTHQUAKE',    blurb:'EVERYTHING IS SHAKY',         effects:{water:2.5}, traffic:.7},
    {cat:'disaster', title:'FLASH FLOOD',   blurb:'WATER, WATER EVERYWHERE',     effects:{water:.2, food:1.8}, traffic:.6},
    {cat:'disaster', title:'VOLCANO ERUPTS', blurb:'ASH IN THE AIR',             effects:{hot:.2, cold:2.5}, traffic:.7},
    {cat:'disaster', title:'METEOR SHOWER', blurb:'TOURISTS FLOCK IN',           effects:{cold:1.5, snack:1.5}, traffic:1.6},
    {cat:'disaster', title:'BLIZZARD',      blurb:'SNOWED IN',                   effects:{hot:3, noodles:1.5}, traffic:.4},
    {cat:'disaster', title:'LOCUST SWARM',  blurb:'NOBODY IS HUNGRY NOW',        effects:{snack:.4, food:.4}, traffic:.8},
];

// an event only makes the paper if it touches something you can sell, or the crowd
function newsIsRelevant(event)
{
    if (event.traffic || event.budget || !Object.keys(event.effects).length)
        return true;
    return Object.keys(event.effects).some(key => itemTypes[key] ?
        game.unlocked.includes(key) : game.unlocked.some(item => itemTypes[item].tags.includes(key)));
}

function rollNews()
{
    const news = [];
    for (const cat in newsCategories)
    {
        const category = newsCategories[cat];
        if (game.day < (category.minDay || 0) || rand() > category.chance)
            continue;
        const options = newsEvents.filter(event => event.cat == cat && newsIsRelevant(event));
        let pick = rand(options.reduce((sum, event) => sum + (event.weight || 1), 0));
        news.push(options.find(event => (pick -= event.weight || 1) < 0) || options[0]);
    }
    return news;
}

// multiplier from an effects table like {cold:2, coffee:.5} on one item
function effectDemand(effects, key)
{
    let demand = 1;
    for (const [target, multiplier] of Object.entries(effects))
        if (target == key || itemTypes[key].tags.includes(target))
            demand *= multiplier;
    return demand;
}

// today's multiplier on how much customers want an item
const newsDemand = (key) => game.news.reduce((product, event) => product * effectDemand(event.effects, key), 1);
const newsTraffic = () => game.news.reduce((product, event) => product * (event.traffic || 1), 1);
const newsBudget  = () => game.news.reduce((product, event) => product * (event.budget || 1), 1);

// effects as [label, multiplier, tag], tag effects get drawn as a colored chip
const effectEntries = (effects) => Object.entries(effects).map(([key, m]) =>
    tagStyles[key] ? [tagStyles[key].label, m, key] : [itemTypes[key].name, m]);

// readable effect list for the paper, like ['COLD', 2, 'cold']
function newsEffectList(event)
{
    const list = effectEntries(event.effects);
    if (event.traffic)
        list.push(['CUSTOMERS', event.traffic]);
    if (event.budget)
        list.push(['BUDGETS', event.budget]);
    return list;
}
const formatMultiplier = (m) => 'x' + (m % 1 ? m.toFixed(1) : m);

///////////////////////////////////////////////////////////////////////////////
// locations: the machine moves somewhere new every few days, like Balatro antes
// effects work like news effects, traffic scales the crowd, budget what they pay,
// rent scales the nightly rent, rush hours bunch customers up, think is how long
// they stand there deciding, and patience scales the rep lost when they walk off

const levelsPerLocation = 4;

const locationTypes =
[
    {name:'OFFICE', tag:'OFFICE', icon:'coffee', blurb:'NINE TO FIVE, EASY MONEY',
        felt:['#1b3a33', '#22483f'], effects:{coffee:1.5, food:1.2, gum:1.5}},
    {name:'MALL', tag:'MALL', icon:'pbcups', blurb:'SHOPPERS WITH CASH TO BURN',
        felt:['#3b1f3a', '#4a2848'], effects:{sweet:1.5, juice:1.5, coffee:.7}, traffic:1.3, budget:1.1, rent:1.3},
    {name:'HOSPITAL', tag:'HOSPITAL', icon:'heart', blurb:'LONG SHIFTS, TOO TIRED TO COMPLAIN',
        felt:['#1f3a4a', '#284a5c'], effects:{water:1.6, coffee:1.8, food:1.4, healthy:1.3, sweet:.8}, traffic:.9, budget:1.2, rent:1.5, patience:.5},
    {name:'METRO STATION', tag:'METRO', icon:'energy', blurb:'RUSH HOUR IS EVERYTHING',
        felt:['#2e2e3a', '#3b3b4c'], effects:{coffee:1.5, energy:1.8, sandwich:1.4, gum:1.5, noodles:.5}, traffic:1.2, budget:.9, rent:1.6,
        rush:[[8, 10], [17, 20]], think:.4},
    {name:'COMMUNITY COLLEGE', tag:'COLLEGE', icon:'chips', blurb:'BROKE BUT ALWAYS HUNGRY',
        felt:['#3a2f1b', '#4a3c24'], effects:{energy:2, chips:1.5, noodles:2.5, coffee:1.4, sandwich:.6, protein:.5}, traffic:1.6, budget:.7, rent:1.7},
    {name:'AIRPORT', tag:'AIRPORT', icon:'water', blurb:'CAPTIVE AUDIENCE, AIRPORT PRICES',
        felt:['#1b2a4a', '#24365c'], effects:{water:1.8, sandwich:1.5, gum:2, noodles:.6}, traffic:1.1, budget:1.6, rent:2.2,
        rush:[[9, 12], [15, 18]]},
    {name:'MUSEUM', tag:'MUSEUM', icon:'juice', blurb:'QUIET HALLS, PICKY PATRONS',
        felt:['#3a1b1b', '#4a2424'], effects:{healthy:1.8, cookie:1.5, chips:.4, soda:.6}, traffic:.7, budget:1.5, rent:2.5, patience:1.5},
];
for (const loc of locationTypes)
    loc.feltColors = loc.felt.map(hex => new Color().setHex(hex));

const currentLocation = () => locationTypes[game.locIndex];
const isLastLocation = () => game.locIndex == locationTypes.length - 1;
const locationDemand = (key) => effectDemand(currentLocation().effects, key);
const demandFor = (key) => (hasPerk(key, 'steady') ? Math.max(1, newsDemand(key)) : newsDemand(key)) * locationDemand(key);
const isRushHour = () => (currentLocation().rush || []).some(([start, end]) => dayHour() >= start && dayHour() < end);
const startBonus = (index) => index * 20; // later starting spots come with extra cash

// readable lever list for the location card, like ['COFFEE', 1.5]
function locationEffectList(loc)
{
    const list = effectEntries(loc.effects);
    for (const [label, key] of [['CUSTOMERS', 'traffic'], ['BUDGETS', 'budget'], ['PATIENCE', 'patience']])
        if (loc[key])
            list.push([label, key == 'patience' ? 1 / loc[key] : loc[key]]);
    return list;
}

const brandTier = (key) => game.brands[key] || 0;
const itemBrand = (key) => itemTypes[key].brands[brandTier(key)];
const itemCost = (key) => itemBrand(key).cost;
const itemFair = (key) => itemBrand(key).fair;
const itemSprite = (key) => itemBrand(key).sprite;
const hasPerk = (key, perk) => itemBrand(key).perk == perk;

// price buttons step bigger as the price climbs, so it can skyrocket
const priceStep = (price, up) =>
{
    const p = up ? price : price - .001;
    return p < 5 ? .25 : p < 20 ? 1 : p < 100 ? 5 : p < 500 ? 25 : 100;
};
const maxPrice = 9999;

const maxSlots = 8;
const maxCapacity = 18;
const dayLength = 40;      // seconds of real time per day at 1x speed
const queueFrontX = 200;   // where the first customer in line stands
const queueSpacing = 24;
const streetY = 240;       // center height of customers on the sidewalk

const formatMoney = (amount) => (amount < 0 ? '-$' : '$') + Math.abs(amount).toFixed(2);
const formatPrice = (amount) => amount >= 100 ? '$' + Math.round(amount) : formatMoney(amount);

const upgradeTypes =
[
    {id:'slot',   name:'EXTRA SLOT', desc:'+1 SLOT',            base:15, step:10,
        available: () => game.slotCount < maxSlots,     apply: () => ++game.slotCount},
    {id:'coil',   name:'BIG COILS',  desc:'+3 STOCK\nPER SLOT', base:12, step:8,
        available: () => game.capacity < maxCapacity,  apply: () => game.capacity += 3},
    {id:'neon',   name:'NEON SIGN',  desc:'+30%\nCUSTOMERS',    base:20, step:15,
        available: () => true,                          apply: () => game.traffic += .3},
    {id:'reader', name:'CARD SLOT',  desc:'CUSTOMERS\nSPEND +20%', base:25, step:15,
        available: () => true,                          apply: () => game.spend += .2},
    {id:'mascot', name:'MASCOT',     desc:'+0.3 REP',           base:10, step:5,
        available: () => game.rep < 2,                  apply: () => game.rep = Math.min(2, game.rep + .3)},
    ...itemKeys.filter(key => itemTypes[key].unlock).map(key => (
    {id:'item_' + key, name:itemTypes[key].brands[0].name, desc:'NEW ITEM\n' + itemTypes[key].name, icon:key, base:itemTypes[key].unlock, step:0,
        available: () => !game.unlocked.includes(key),  apply: () => game.unlocked.push(key)})),
    ...itemKeys.flatMap(key => [1, 2].map(tier =>
    {
        const brand = itemTypes[key].brands[tier];
        const fairText = 'SELLS ~' + formatPrice(brand.fair);
        return {id:'brand_' + key + tier, name:brand.name, icon:brand.sprite, base:10 * tier + brand.fair * 6, step:0,
            desc: brand.perk ? brandPerks[brand.perk].card + '\n' + fairText : 'BRAND UPGRADE\n' + fairText,
            available: () => game.unlocked.includes(key) && brandTier(key) == tier - 1,
            apply: () => upgradeBrand(key)};
    })),
];

const upgradeDiscount = .2; // upgrades cost 20% of their listed base/step
const upgradePrice = (upgrade) => upgradeDiscount * (upgrade.base + upgrade.step * (game.owned[upgrade.id] || 0));
const rentForDay = (day, loc=currentLocation()) => Math.round((3 + day * 2) * (loc.rent || 1));

// fits in 4 characters on an item card
function formatCost(cost)
{
    if (cost < 1)
        return '.' + String(Math.round(cost * 100)).padStart(2, '0');
    return cost < 10 ? cost.toFixed(1) : '$' + Math.round(cost);
}

///////////////////////////////////////////////////////////////////////////////
// sounds

const sfx =
{
    click:  new SoundGenerator({frequency:600, release:.04, volume:.3, shapeCurve:0}),
    error:  new SoundGenerator({frequency:140, release:.12, volume:.4, shapeCurve:0}),
    coin:   new SoundGenerator({frequency:990, pitchJump:660, pitchJumpTime:.05, release:.15, volume:.4}),
    vend:   new SoundGenerator({frequency:120, slide:-.3, release:.12, noise:.3, volume:.6}),
    sad:    new SoundGenerator({frequency:300, slide:-.6, release:.2, volume:.35}),
    tally:  new SoundGenerator({frequency:700, release:.06, volume:.35}),
    buy:    new SoundGenerator({frequency:520, pitchJump:260, pitchJumpTime:.06, release:.3, volume:.5}),
    bell:   new SoundGenerator({frequency:880, release:.6, volume:.4, delay:.1}),
    evict:  new SoundGenerator({frequency:200, slide:-.4, release:.6, bitCrush:.2, volume:.6}),
};

///////////////////////////////////////////////////////////////////////////////
// run state

let game;                // everything about the current run
let phase = 'news';      // news, prep, day, summary, shop
let selectedSlot = 0;    // slot being edited in prep
let catalogPage = 0;     // item cards are shown 8 at a time
let shownMoney = 0;      // money counter animates toward the real value
let saveData = readSaveData('vendingMachineSim', {bestDay: 0, locationsUnlocked: 1});
let infoReturnPhase = 'news'; // where the location card goes back to

// day state
let dayTime = 0;         // 0 to 1 across the day
let simSpeed = 1;
let spawnTimer = 0, spawnInterval = 1;
let customers = [];
let dayStats;
let vendAnim = null;     // item dropping from a slot into the tray

// summary and shop state
let summary;
let shopOffers = [], rerollCost = 2;

// juice
let floatTexts = [];
let shakeAmount = 0;
let shakeOffset = vec2();

function newRun(locIndex=0)
{
    game =
    {
        day: 1, money: 15 + startBonus(locIndex), rep: 1,
        locIndex, locDay: 1,
        slotCount: 4, capacity: 6,
        traffic: 1, spend: 1,
        unlocked: ['soda', 'chips', 'candy', 'water'],
        brands: {}, // item -> brand tier bought in the shop
        owned: {},
        slots: [...Array(maxSlots)].map(() => ({item: null, price: 0, stock: 0})),
    };
    shownMoney = game.money;
    selectedSlot = 0;
    catalogPage = 0;
    dayTime = 0;
    game.news = rollNews();
    showLocation('news');
}

function showLocation(returnPhase)
{
    infoReturnPhase = returnPhase;
    phase = 'location';
}

///////////////////////////////////////////////////////////////////////////////
// prep phase actions

function assignItem(slot, key)
{
    if (slot.item == key)
        return;
    // whatever was loaded comes back out at cost
    if (slot.item)
        game.money += slot.stock * itemCost(slot.item);
    slot.item = key;
    slot.stock = 0;
    // start at the fair price, rounded onto the price button steps
    const fair = itemFair(key), step = priceStep(fair, true);
    slot.price = Math.max(.25, Math.round(fair / step) * step);
}

function changeStock(slot, amount)
{
    const cost = itemCost(slot.item);
    amount = clamp(amount, -slot.stock, game.capacity - slot.stock);
    if (amount > 0)
        amount = Math.min(amount, Math.floor((game.money + 1e-6) / cost));
    if (!amount)
        return false;
    slot.stock += amount;
    game.money -= amount * cost;
    return true;
}

// stock already in the machine becomes the new brand, and prices scale up with it
function upgradeBrand(key)
{
    const oldFair = itemFair(key);
    game.brands[key] = brandTier(key) + 1;
    for (const slot of game.slots)
        if (slot.item == key)
        {
            const price = slot.price * itemFair(key) / oldFair, step = priceStep(price, true);
            slot.price = Math.max(.25, Math.round(price / step) * step);
        }
}

function clearSlot(slot)
{
    if (slot.item)
        game.money += slot.stock * itemCost(slot.item);
    Object.assign(slot, {item: null, price: 0, stock: 0});
}

const totalStock = () => game.slots.slice(0, game.slotCount).reduce((sum, slot) => sum + slot.stock, 0);

///////////////////////////////////////////////////////////////////////////////
// day phase

function startDay()
{
    phase = 'day';
    dayTime = 0;
    customers = [];
    dayStats = {customers: 0, sold: 0, revenue: 0, pricey: 0, soldOut: 0, meh: 0, repStart: game.rep};
    // reputation and upgrades bring more people, and the town grows a little each day
    const expected = (16 + game.day * 2.4) * game.rep * game.traffic * newsTraffic() * (currentLocation().traffic || 1);
    spawnInterval = 1 / Math.max(3, expected);
    spawnTimer = .02;
    sfx.bell.play();
}

const dayHour = () => 8 + 12 * dayTime;

function updateDay(dt)
{
    dayTime = Math.min(1, dayTime + dt / dayLength);

    // people arrive at random through opening hours
    if (dayTime < 1)
    {
        // rush hours pack the crowd in, the rest of the day goes quiet
        const rush = !currentLocation().rush ? 1 : isRushHour() ? 2.2 : .6;
        spawnTimer -= dt / dayLength * rush;
        if (spawnTimer <= 0)
        {
            customers.push(new Customer);
            ++dayStats.customers;
            spawnTimer = spawnInterval * rand(.4, 1.6);
        }
    }

    for (const customer of customers)
        customer.update(dt);
    customers = customers.filter(customer => !customer.gone);

    if (vendAnim && (vendAnim.time += dt) > 1.2)
        vendAnim = null;

    // close up once the day is over and the last customer has left
    if (dayTime >= 1 && !customers.length)
        endDay();
}

class Customer
{
    constructor()
    {
        this.x = screenW + 20;
        this.state = 'walk';
        this.timer = 0;
        this.walkPhase = rand();
        this.bubble = null;
        this.gone = false;

        // look
        this.skin = new Color().setHex(['#ead4aa', '#e4a672', '#b86f50', '#733e39'][randInt(4)]);
        this.hair = new Color().setHex(['#181425', '#733e39', '#feae34', '#e43b44', '#c0cbdc'][randInt(5)]);
        this.shirt = hsl(rand(), rand(.5, .8), rand(.45, .6));
        this.pants = new Color().setHex(['#3a4466', '#124e89', '#5a6988', '#3e2731'][randInt(4)]);

        // taste: what they're in the mood for, one favorite, and how much they'll pay
        this.wants = {};
        for (const key of itemKeys)
            this.wants[key] = rand() < itemBrand(key).pop ? rand(.6, 1.15) : 0;
        this.wants[itemKeys[randInt(itemKeys.length)]] = 1.4;
        this.budget = rand(.85, 1.25) * game.spend * newsBudget() * (currentLocation().budget || 1);
    }

    update(dt)
    {
        const line = customers.filter(customer => customer.state != 'leave');
        const place = line.indexOf(this);
        if (this.state == 'walk')
        {
            const targetX = queueFrontX + place * queueSpacing;
            const step = 60 * dt;
            this.walkPhase += dt * 3;
            if (Math.abs(this.x - targetX) <= step)
            {
                this.x = targetX;
                if (place == 0)
                    this.state = 'think', this.timer = .7 * (currentLocation().think || 1);
            }
            else
                this.x -= Math.sign(this.x - targetX) * step;
        }
        else if (this.state == 'think')
        {
            if ((this.timer -= dt) <= 0)
                this.decide();
        }
        else if (this.state == 'react')
        {
            if ((this.timer -= dt) <= 0)
                this.state = 'leave';
        }
        else if (this.state == 'leave')
        {
            this.x += 70 * dt;
            this.walkPhase += dt * 3;
            if (this.x > screenW + 20)
                this.gone = true;
        }
    }

    // how much they'd pay for an item right now, zero if they don't want it
    valueOf(key)
    {
        const item = itemTypes[key];
        if (!this.wants[key])
            return 0;
        let demand = 1;
        if (item.peak)
            demand = dayHour() >= item.peak[0] && dayHour() < item.peak[1] ? 1.6 : hasPerk(key, 'allDay') ? 1 : .7;
        demand *= demandFor(key);
        return itemFair(key) * this.wants[key] * demand * this.budget;
    }

    decide()
    {
        let best = null, bestScore = -1, tooPricey = false, soldOut = false;
        game.slots.slice(0, game.slotCount).forEach((slot, i) =>
        {
            if (!slot.item)
                return;
            const value = this.valueOf(slot.item);
            if (!value)
                return;
            if (!slot.stock)
                return soldOut = true;
            if (slot.price > value)
                return tooPricey = true;
            const score = (value - slot.price) / itemFair(slot.item) + rand(.25);
            if (score > bestScore)
                best = i, bestScore = score;
        });

        this.state = 'react';
        this.timer = 1;
        if (best !== null)
        {
            const slot = game.slots[best];
            --slot.stock;
            game.money += slot.price;
            dayStats.revenue += slot.price;
            ++dayStats.sold;
            game.rep = Math.min(2, game.rep + (hasPerk(slot.item, 'loved') ? .03 : .01));
            this.bubble = {kind: 'buy', sprite: itemSprite(slot.item)};
            vendAnim = {slot: best, sprite: itemSprite(slot.item), time: 0};
            addFloatText('+' + formatPrice(slot.price), this.x, streetY - 40, spriteColor('Y'));
            if (slot.price >= 50)
                shake(5), sfx.buy.play(); // a big sale deserves a big moment
            sfx.vend.play();
            sfx.coin.play(undefined, 1, 1 + rand(.1));
            return;
        }

        // walked away: the reason decides how much reputation it costs
        const patience = currentLocation().patience || 1;
        if (tooPricey)
            this.bubble = {kind: 'pricey'}, ++dayStats.pricey, game.rep -= .02 * patience;
        else if (soldOut)
            this.bubble = {kind: 'soldOut'}, ++dayStats.soldOut, game.rep -= .025 * patience;
        else
            this.bubble = {kind: 'meh'}, ++dayStats.meh, game.rep -= .005 * patience;
        game.rep = Math.max(.3, game.rep);
        sfx.sad.play();
    }

    render()
    {
        const moving = this.state == 'walk' || this.state == 'leave';
        const frame = moving ? (this.walkPhase * 4 | 0) % 2 : 0;
        const bob = moving && frame ? -1 : 0;
        const x = this.x, y = streetY + bob;
        drawSprite('personPants' + frame, x, y, 2, this.pants);
        drawSprite('personShirt', x, y, 2, this.shirt);
        drawSprite('personSkin', x, y, 2, this.skin);
        drawSprite('personHair', x, y, 2, this.hair);
        drawSprite('personOutline' + frame, x, y, 2);

        if (this.state == 'think')
            drawBubble(x, y - 30, () => uiText('...', x, y - 30, 1, spriteColor('D'), 'center', false));
        else if (this.bubble && this.state == 'react')
        {
            const by = y - 30;
            const b = this.bubble;
            if (b.kind == 'buy')
                drawBubble(x, by, () => { drawSprite(b.sprite, x - 6, by, 1); drawSprite('heart', x + 7, by, 1); });
            else if (b.kind == 'pricey')
                drawBubble(x, by, () => uiText('$$!', x, by, 1, spriteColor('r'), 'center', false));
            else if (b.kind == 'soldOut')
                drawBubble(x, by, () => uiText('OUT', x, by, 1, spriteColor('r'), 'center', false));
            else
                drawBubble(x, by, () => uiText('MEH', x, by, 1, spriteColor('d'), 'center', false));
        }
    }
}

function endDay()
{
    phase = 'summary';
    simSpeed = 1;
    const rent = rentForDay(game.day);
    game.money -= rent;
    const repChange = game.rep - dayStats.repStart;
    summary =
    {
        time: 0, shown: 0,
        lines: [
            ['CUSTOMERS', dayStats.customers + ''],
            ['SOLD',      dayStats.sold + ''],
            ['WALKED',    dayStats.pricey + dayStats.soldOut + dayStats.meh + ''],
            ['SALES',     '+' + formatMoney(dayStats.revenue)],
            ['RENT',      '-' + formatMoney(rent)],
            ['REP',       (repChange >= 0 ? '+' : '') + repChange.toFixed(2)],
        ],
        evicted: game.money < 0,
    };

    // surviving the last day here clears the location and unlocks the next one
    if (!summary.evicted && game.locDay == levelsPerLocation)
    {
        if (isLastLocation())
            summary.lines.push(['ALL CLEARED!', 'YOU WIN']);
        else
        {
            summary.lines.push(['CLEARED!', 'NEXT: ' + locationTypes[game.locIndex + 1].tag]);
            saveData.locationsUnlocked = Math.max(saveData.locationsUnlocked, game.locIndex + 2);
            writeSaveData('vendingMachineSim', saveData);
        }
    }
}

function updateSummary(dt)
{
    // reveal the tally one line at a time, Balatro style
    summary.time += dt;
    const target = Math.min(summary.lines.length, summary.time / .4 | 0);
    while (summary.shown < target)
    {
        const label = summary.lines[summary.shown++][0];
        sfx.tally.play(undefined, 1, 1 + summary.shown * .08);
        if (label == 'RENT')
            shake(4);
        if (label.includes('CLEARED'))
            sfx.buy.play(), shake(3);
    }
    if (summary.shown == summary.lines.length && summary.evicted && !summary.evictPlayed)
    {
        summary.evictPlayed = true;
        sfx.evict.play();
        shake(8);
    }
}

///////////////////////////////////////////////////////////////////////////////
// shop

function openShop()
{
    phase = 'shop';
    rerollCost = 2;
    rollShop();
}

function rollShop()
{
    const pool = upgradeTypes.filter(upgrade => upgrade.available());
    shopOffers = [];
    while (shopOffers.length < 3 && pool.length)
        shopOffers.push({upgrade: pool.splice(randInt(pool.length), 1)[0], sold: false});
}

function buyOffer(offer)
{
    const price = upgradePrice(offer.upgrade);
    if (offer.sold || game.money < price)
        return sfx.error.play();
    game.money -= price;
    offer.upgrade.apply();
    game.owned[offer.upgrade.id] = (game.owned[offer.upgrade.id] || 0) + 1;
    offer.sold = true;
    sfx.buy.play();
    shake(2);
}

// the location the machine will be at tomorrow
const nextLocationIndex = () => game.locDay >= levelsPerLocation && !isLastLocation() ? game.locIndex + 1 : game.locIndex;

function nextDay()
{
    ++game.day;
    dayTime = 0;
    if (game.day > saveData.bestDay)
        saveData.bestDay = game.day, writeSaveData('vendingMachineSim', saveData);

    // pack up and move once this location is cleared, the last one goes on forever
    const moving = nextLocationIndex() != game.locIndex;
    if (moving)
        game.locIndex = nextLocationIndex(), game.locDay = 1;
    else
        ++game.locDay;
    game.news = rollNews();
    if (moving)
        showLocation('news');
    else
        phase = 'news';
}

///////////////////////////////////////////////////////////////////////////////
// juice

function addFloatText(text, x, y, color)
{
    floatTexts.push({text, x, y, color, life: 1});
}

function shake(amount) { shakeAmount = Math.max(shakeAmount, amount); }

///////////////////////////////////////////////////////////////////////////////
// immediate mode ui: the same layout code runs twice a frame,
// once in gameUpdate to handle clicks, then in gameRenderPost to draw
// (mouse presses are cleared before rendering, so clicks can't be read there)

let uiDrawing = false;

const spriteColorCache = {};
const spriteColor = (char) => spriteColorCache[char] || (spriteColorCache[char] = new Color().setHex(spriteHex[char]));

const uiColors =
{
    red:    new Color().setHex('#e43b44'),
    blue:   new Color().setHex('#0099db'),
    orange: new Color().setHex('#f77622'),
    green:  new Color().setHex('#3e8948'),
    gray:   new Color().setHex('#5a6988'),
    panel:  new Color().setHex('#3a4466'),
    dark:   new Color().setHex('#262b44'),
    ink:    new Color().setHex('#181425'),
    gold:   new Color().setHex('#feae34'),
    cream:  new Color().setHex('#ead4aa'),
};

const mouseIn = (x, y, w, h) =>
    mousePosScreen.x >= x && mousePosScreen.x < x + w && mousePosScreen.y >= y && mousePosScreen.y < y + h;
const clicked = (x, y, w, h) => !uiDrawing && mouseWasPressed(0) && mouseIn(x, y, w, h);

// solid rectangle from its top left corner, in screen pixels
function uiRect(x, y, w, h, color)
{
    if (uiDrawing)
        drawRect(vec2(x + w/2 + shakeOffset.x, y + h/2 + shakeOffset.y), vec2(w, h), color, 0, true, true);
}

// 8x8 pixel font text, y is the vertical center
function uiText(text, x, y, scale=1, color=WHITE, align='center', shadow=true)
{
    if (!uiDrawing)
        return;
    text += '';
    const size = 8 * scale;
    const width = Math.max(...text.split('\n').map(line => line.length)) * size;
    const left = align == 'left' ? x : align == 'right' ? x - width : 0;
    const pos = vec2((align == 'center' ? x : left + size/2) + shakeOffset.x, y + shakeOffset.y);
    if (shadow)
        engineImageFont.drawTextScreen(text, pos.add(vec2(scale)), size, align == 'center', uiColors.ink.scale(1, color.a));
    engineImageFont.drawTextScreen(text, pos, size, align == 'center', color);
}

// chunky panel with an outline and a drop shadow
function uiPanel(x, y, w, h, color=uiColors.panel)
{
    uiRect(x + 3, y + 3, w, h, new Color(0, 0, 0, .35));
    uiRect(x - 1, y - 1, w + 2, h + 2, uiColors.ink);
    uiRect(x, y, w, h, color);
}

// button with a lip underneath that presses down, returns true when clicked
function uiButton(label, x, y, w, h, color=uiColors.blue, enabled=true, scale=1)
{
    const hover = enabled && mouseIn(x, y, w, h);
    const down = hover && mouseIsDown(0);
    if (uiDrawing)
    {
        const face = !enabled ? uiColors.gray : hover ? color.lerp(WHITE, .2) : color;
        const press = down ? 2 : 0;
        uiRect(x - 1, y - 1, w + 2, h + 3, uiColors.ink);
        uiRect(x, y + 2, w, h, face.scale(.6, 1));
        uiRect(x, y + press, w, h, face);
        uiText(label, x + w/2, y + h/2 + press, scale, enabled ? WHITE : uiColors.cream.scale(.7, 1));
    }
    if (clicked(x, y, w, h))
    {
        if (!enabled)
            return sfx.error.play(), false;
        sfx.click.play();
        return true;
    }
    return false;
}

function drawSprite(name, x, y, scale=2, color=WHITE)
{
    if (!uiDrawing)
        return;
    const size = 16 * scale;
    drawTile(vec2(x + shakeOffset.x, y + shakeOffset.y), vec2(size), tile(spriteIndex[name], 16), color, 0, false, undefined, true, true);
}

// one pip per brand tier, filled up to the brand you own
function drawBrandPips(key, x, y)
{
    for (let i = 0; i < 3; ++i)
        uiRect(x + i * 4, y, 3, 3, i <= brandTier(key) ? uiColors.gold : uiColors.gray);
}

function drawBubble(x, y, contentFn)
{
    uiRect(x - 15, y - 9, 30, 18, uiColors.ink);
    uiRect(x - 14, y - 8, 28, 16, WHITE);
    uiRect(x - 2, y + 9, 4, 3, uiColors.ink);
    uiRect(x - 1, y + 8, 2, 3, WHITE);
    contentFn();
}

///////////////////////////////////////////////////////////////////////////////
// the vending machine

const machine = {x: 12, y: 10, w: 168, h: 250};
const machineWindow = {x: 22, y: 40, w: 110, h: 172};
const slotW = 55, slotH = 43;

const slotRect = (i) => ({x: machineWindow.x + i % 2 * slotW, y: machineWindow.y + (i / 2 | 0) * slotH, w: slotW, h: slotH});

function drawMachine()
{
    const {x, y, w, h} = machine;
    const body = uiColors.red;

    // body with a darker side and the brand sign on top
    uiPanel(x, y, w, h, body);
    uiRect(x + w - 10, y, 10, h, body.scale(.75, 1));
    uiRect(x + 8, y + 6, w - 26, 20, uiColors.ink);
    const glow = .85 + .15 * Math.sin(time * 6);
    uiText('SNAX-O-MAT', x + (w - 10) / 2, y + 16, 1, uiColors.gold.scale(glow, 1));

    // glass window with the slots
    const win = machineWindow;
    uiRect(win.x - 2, win.y - 2, win.w + 4, win.h + 4, uiColors.ink);
    uiRect(win.x, win.y, win.w, win.h, new Color().setHex('#1d2b53'));
    for (let i = 0; i < maxSlots; ++i)
    {
        const r = slotRect(i);
        const cx = r.x + r.w/2;
        if (i >= game.slotCount)
        {
            // slots you haven't bought yet
            uiRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4, uiColors.dark);
            uiText('--', cx, r.y + r.h/2, 1, uiColors.gray, 'center', false);
            continue;
        }
        const slot = game.slots[i];
        const selected = phase == 'prep' && i == selectedSlot;
        const flashing = vendAnim && vendAnim.slot == i && vendAnim.time < .25;
        if (selected)
            uiRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2, uiColors.gold);
        uiRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4, flashing ? uiColors.cream : new Color().setHex('#29366f'));

        // spiral coil shelf
        uiRect(r.x + 4, r.y + 32, r.w - 8, 2, uiColors.gray);
        if (slot.item)
        {
            if (slot.stock)
                drawSprite(itemSprite(slot.item), cx, r.y + 17, 2);
            else
                drawSprite(itemSprite(slot.item), cx, r.y + 17, 2, new Color(1, 1, 1, .25));
            uiText(formatPrice(slot.price), cx, r.y + 38, 1, uiColors.gold, 'center', false);
            const outOfStock = !slot.stock && phase != 'prep';
            uiText(outOfStock ? 'OUT' : 'x' + slot.stock, r.x + r.w - 4, r.y + 7, 1, outOfStock ? uiColors.red : WHITE, 'right');
        }
        else
            uiText('EMPTY', cx, r.y + 18, 1, uiColors.gray, 'center', false);
    }
    // glass glare
    uiRect(win.x + 6, win.y + 4, 3, win.h - 8, new Color(1, 1, 1, .08));

    // coin and keypad panel
    const px = win.x + win.w + 6;
    uiRect(px, win.y, 26, 70, uiColors.dark);
    uiRect(px + 3, win.y + 4, 20, 10, new Color().setHex('#0b3d2e'));
    uiText(Math.round(dayHour()) + '', px + 13, win.y + 9, 1, new Color().setHex('#63c74d'), 'center', false);
    for (let k = 0; k < 9; ++k)
        uiRect(px + 4 + k % 3 * 7, win.y + 20 + (k / 3 | 0) * 7, 5, 5, uiColors.gray);
    uiRect(px + 9, win.y + 46, 8, 14, uiColors.ink);
    uiRect(px + 12, win.y + 48, 2, 10, uiColors.gray);

    // pickup tray, with the item that just dropped
    const ty = win.y + win.h + 10;
    uiRect(win.x, ty, win.w, 24, uiColors.ink);
    uiRect(win.x + 4, ty + 3, win.w - 8, 18, new Color().setHex('#0e0c17'));
    if (vendAnim)
    {
        const r = slotRect(vendAnim.slot);
        const fall = Math.min(1, vendAnim.time / .35);
        const startY = r.y + 17, endY = ty + 12;
        drawSprite(vendAnim.sprite, r.x + r.w/2, lerp(startY, endY, fall * fall), 2);
    }
    uiRect(win.x, ty + 18, win.w, 6, body.scale(.6, 1)); // tray flap in front of the item
}

///////////////////////////////////////////////////////////////////////////////
// screens

const panelX = 192, panelW = 280;

function topBar()
{
    uiPanel(panelX, 8, panelW, 24, uiColors.dark);
    uiText(currentLocation().tag, panelX + 8, 15, 1, uiColors.gold, 'left');
    const dayText = 'DAY ' + game.day;
    uiText(dayText, panelX + 8, 26, 1, WHITE, 'left');
    // one pip per day spent at this location
    for (let i = 0; i < levelsPerLocation; ++i)
        uiRect(panelX + 12 + dayText.length * 8 + i * 6, 23, 4, 5, i < game.locDay ? uiColors.gold : uiColors.gray);
    uiText(formatMoney(shownMoney), panelX + panelW/2, 20, 2, uiColors.gold);
    uiText('RENT $' + rentForDay(game.day), panelX + panelW - 8, 20, 1, uiColors.red.lerp(WHITE, .3), 'right');
}

function prepScreen()
{
    topBar();

    // click a slot in the machine to edit it
    for (let i = 0; i < game.slotCount; ++i)
    {
        const r = slotRect(i);
        if (clicked(r.x, r.y, r.w, r.h))
            selectedSlot = i, sfx.click.play();
    }

    // slot editor
    const slot = game.slots[selectedSlot];
    const ex = panelX, ey = 38;
    uiPanel(ex, ey, panelW, 114);
    uiText('SLOT ' + (selectedSlot + 1) + (slot.item ? ' - ' + itemTypes[slot.item].name : ''), ex + 8, ey + 10, 1, uiColors.cream, 'left');
    if (slot.item && demandFor(slot.item) != 1)
    {
        const demand = demandFor(slot.item);
        uiText('TODAY ' + formatMultiplier(demand), ex + panelW - 8, ey + 10, 1, demand > 1 ? uiColors.green.lerp(WHITE, .3) : uiColors.red.lerp(WHITE, .3), 'right');
    }
    if (!slot.item)
    {
        uiText('EMPTY SLOT', ex + panelW/2, ey + 44, 2, WHITE);
        uiText('PICK AN ITEM BELOW', ex + panelW/2, ey + 66, 1, uiColors.cream);
    }
    else
    {
        const item = itemTypes[slot.item];
        uiRect(ex + 8, ey + 20, 40, 40, uiColors.dark);
        const brand = itemBrand(slot.item);
        drawSprite(brand.sprite, ex + 28, ey + 40, 2);
        drawBrandPips(slot.item, ex + 22, ey + 62);
        uiText(brand.name, ex + 56, ey + 28, 2, WHITE, 'left');
        const fairText = formatPrice(itemFair(slot.item));
        uiItemTags(slot.item, ex + 56, ey + 45);
        uiText('COST ' + formatMoney(itemCost(slot.item)) + '  FAIR ~' + fairText, ex + 56, ey + 58, 1, uiColors.cream, 'left');
        const peak = item.peak && brand.perk != 'allDay' ? `BUSY ${item.peak[0]}-${item.peak[1]}H` : '';
        const note = [brand.perk && brandPerks[brand.perk].note, peak].filter(Boolean).join('  ');
        uiText(note, ex + 56, ey + 68, 1, uiColors.gold, 'left');

        // price
        const rowY = ey + 76;
        uiText('PRICE', ex + 10, rowY + 8, 1, WHITE, 'left');
        if (uiButton('-', ex + 60, rowY, 18, 16, uiColors.red))
            slot.price = Math.max(.25, slot.price - priceStep(slot.price, false));
        uiText(formatPrice(slot.price), ex + 108, rowY + 8, 1, uiColors.gold);
        if (uiButton('+', ex + 138, rowY, 18, 16, uiColors.green))
            slot.price = Math.min(maxPrice, slot.price + priceStep(slot.price, true));

        // stock, paid for as it goes in
        const stockY = ey + 96;
        uiText('STOCK', ex + 10, stockY + 6, 1, WHITE, 'left');
        if (uiButton('-', ex + 60, stockY - 2, 18, 16, uiColors.red))
            changeStock(slot, -1);
        uiText(slot.stock + '/' + game.capacity, ex + 108, stockY + 6, 1, WHITE);
        if (uiButton('+', ex + 138, stockY - 2, 18, 16, uiColors.green) && !changeStock(slot, 1))
            sfx.error.play();
        if (uiButton('FILL', ex + 170, stockY - 2, 44, 16, uiColors.blue) && !changeStock(slot, game.capacity))
            sfx.error.play();
        if (uiButton('CLEAR', ex + 222, stockY - 2, 50, 16, uiColors.gray))
            clearSlot(slot);
    }

    // item catalog cards, locked ones tease what the shop can unlock
    const cy = 158;
    uiPanel(panelX, cy, panelW, 70, uiColors.dark);
    uiText('ITEMS', panelX + 8, cy + 8, 1, uiColors.cream, 'left');
    if (uiButton('NEWS', panelX + 54, cy + 2, 40, 11, uiColors.orange))
        phase = 'news';
    if (uiButton('SITE', panelX + 98, cy + 2, 40, 11, uiColors.blue))
        showLocation('prep');
    const pages = Math.ceil(itemKeys.length / 8);
    uiText(catalogPage + 1 + '/' + pages, panelX + panelW - 52, cy + 8, 1, uiColors.cream);
    if (uiButton('<', panelX + panelW - 80, cy + 2, 14, 11, uiColors.blue))
        catalogPage = (catalogPage + pages - 1) % pages;
    if (uiButton('>', panelX + panelW - 38, cy + 2, 14, 11, uiColors.blue))
        catalogPage = (catalogPage + 1) % pages;
    itemKeys.slice(catalogPage * 8, catalogPage * 8 + 8).forEach((key, i) =>
    {
        const unlocked = game.unlocked.includes(key);
        const x = panelX + 6 + i * 34, y = cy + 16;
        const hover = unlocked && mouseIn(x, y, 32, 48);
        const lift = hover ? -3 : Math.round(Math.sin(time * 2 + i) * .8);
        uiRect(x - 1, y - 1 + lift, 34, 50, uiColors.ink);
        uiRect(x, y + lift, 32, 48, unlocked ? (slot.item == key ? uiColors.gold : uiColors.cream) : uiColors.gray);
        if (unlocked)
        {
            drawSprite(itemSprite(key), x + 16, y + 18 + lift, 2);
            drawBrandPips(key, x + 3, y + 3 + lift);
            // a strip along the bottom in the item's tag colors, to match against the news
            const tags = itemTypes[key].tags, stripW = 32 / tags.length;
            tags.forEach((tag, t) => uiRect(x + Math.round(t * stripW), y + 45 + lift, Math.round((t + 1) * stripW) - Math.round(t * stripW), 3, spriteColor(tagStyles[tag].color)));
            uiText(formatCost(itemCost(key)), x + 16, y + 40 + lift, 1, uiColors.ink, 'center', false);
            // today's news and the location push demand up or down
            const demand = demandFor(key);
            if (demand > 1)
                uiText('^', x + 27, y + 6 + lift, 1, uiColors.green, 'center', false);
            else if (demand < 1)
                uiText('v', x + 27, y + 5 + lift, 1, uiColors.red, 'center', false);
        }
        else
            uiText('?', x + 16, y + 22, 2, uiColors.dark, 'center', false);
        if (clicked(x, y, 32, 48))
        {
            if (unlocked)
                assignItem(slot, key), sfx.click.play();
            else
                sfx.error.play();
        }
    });

    // open for business
    const stock = totalStock();
    if (uiButton(stock ? 'OPEN FOR THE DAY' : 'LOAD SOME STOCK FIRST', panelX, 238, panelW, 22, uiColors.orange, stock > 0, stock ? 2 : 1))
        startDay();
}

function dayScreen()
{
    topBar();
    uiPanel(panelX, 38, panelW, 62);

    // clock
    const hour = dayHour();
    const h = Math.floor(hour), m = Math.floor((hour - h) * 6) * 10;
    const clock = `${(h + 11) % 12 + 1}:${m ? m : '00'} ${h < 12 ? 'AM' : 'PM'}`;
    uiText(clock, panelX + 10, 54, 2, WHITE, 'left');
    uiRect(panelX + 10, 66, 120, 4, uiColors.dark);
    uiRect(panelX + 10, 66, 120 * dayTime, 4, uiColors.gold);

    // stats and reputation
    const walked = dayStats.pricey + dayStats.soldOut + dayStats.meh;
    uiText(`SOLD ${dayStats.sold}  WALKED ${walked}`, panelX + 10, 82, 1, uiColors.cream, 'left');
    uiText('REP', panelX + 10, 93, 1, uiColors.cream, 'left');
    uiRect(panelX + 40, 90, 90, 6, uiColors.dark);
    uiRect(panelX + 40, 90, 90 * game.rep / 2, 6, game.rep >= 1 ? uiColors.green : uiColors.red);

    // speed
    uiText('SPEED', panelX + 214, 50, 1, uiColors.cream);
    [1, 2, 4].forEach((speed, i) =>
    {
        if (uiButton(speed + 'X', panelX + 160 + i * 38, 60, 32, 18, simSpeed == speed ? uiColors.orange : uiColors.blue))
            simSpeed = speed;
    });
    if (dayTime >= 1)
        uiText('CLOSING...', panelX + 214, 90, 1, uiColors.gold);
    else if (isRushHour())
        uiText('RUSH HOUR!', panelX + 214, 90, 1, uiColors.orange.scale(.85 + .15 * Math.sin(time * 10), 1));

    // news ticker, flipping through today's headlines
    if (game.news.length)
    {
        const event = game.news[(time / 3 | 0) % game.news.length];
        const category = newsCategories[event.cat];
        uiPanel(panelX, 106, panelW, 14, uiColors.dark);
        // category badges are ink with colored text, so they never look like tag chips
        uiRect(panelX, 106, category.label.length * 8 + 6, 14, uiColors.ink);
        uiText(category.label, panelX + 3, 113, 1, category.color.lerp(WHITE, .2), 'left', false);
        // headline and effects together if they fit, otherwise take turns
        const effects = newsEffectList(event);
        const tx = panelX + category.label.length * 8 + 10, room = panelX + panelW - 4 - tx;
        const title = event.title + (effects.length ? ':' : '');
        const together = (title.length + 1) * 8 + effectListWidth(effects) <= room;
        if (together || !effects.length || time % 3 < 1.5)
            uiText(title, tx, 113, 1, uiColors.cream, 'left', false);
        if (together)
            uiEffectList(effects, tx + (title.length + 1) * 8, 113, room, true, false);
        else if (effects.length && time % 3 >= 1.5)
            uiEffectList(effects, tx, 113, room, true, false);
    }
}

function summaryScreen()
{
    uiRect(0, 0, screenW, screenH, new Color(0, 0, 0, .5));
    const linesBottom = 42 + summary.lines.length * 16;
    const w = 240, h = linesBottom + (summary.evicted ? 70 : 56), x = (screenW - w) / 2, y = Math.round((screenH - h) / 2);
    uiPanel(x, y, w, h);
    uiText(`DAY ${game.day} DONE`, x + w/2, y + 18, 2, uiColors.gold);
    summary.lines.slice(0, summary.shown).forEach(([label, value], i) =>
    {
        const ly = y + 42 + i * 16;
        const pop = Math.max(0, 1 - (summary.time - (i + 1) * .4) * 5); // freshly revealed lines kick in from the right
        uiText(label, x + 20, ly, 1, WHITE, 'left');
        const color = value[0] == '-' ? uiColors.red.lerp(WHITE, .25) : value[0] == '+' ? uiColors.gold : WHITE;
        uiText(value, x + w - 20 + pop * 12, ly, 1, color, 'right');
    });
    if (summary.shown < summary.lines.length)
        return;
    const by = y + linesBottom;
    uiRect(x + 16, by - 6, w - 32, 1, uiColors.cream);
    uiText('CASH ' + formatMoney(game.money), x + w/2, by + 8, 2, game.money < 0 ? uiColors.red : uiColors.gold);
    if (summary.evicted)
    {
        uiText('BEST RUN: DAY ' + saveData.bestDay, x + w/2, by + 55, 1, uiColors.cream);
        if (uiButton('EVICTED! TRY AGAIN', x + 20, by + 22, w - 40, 20, uiColors.red))
            phase = 'map';
    }
    else if (uiButton('TO THE SHOP', x + 20, by + 22, w - 40, 20, uiColors.orange))
        openShop();
}

function shopScreen()
{
    uiRect(0, 0, screenW, screenH, new Color(0, 0, 0, .5));
    const w = 400, h = 230, x = (screenW - w) / 2, y = 20;
    uiPanel(x, y, w, h, uiColors.dark);
    uiText('SHOP', x + w/2, y + 16, 2, uiColors.gold);
    uiText(formatMoney(shownMoney), x + w - 12, y + 16, 1, uiColors.gold, 'right');
    const nextLoc = locationTypes[nextLocationIndex()];
    uiText((nextLoc != currentLocation() ? nextLoc.tag + ' ' : 'DAY ' + (game.day + 1) + ' ') + 'RENT $' + rentForDay(game.day + 1, nextLoc), x + 12, y + 16, 1, uiColors.cream, 'left');

    // upgrade cards bob gently and lift when hovered
    const cardW = 114, cardH = 140, gap = 12;
    const startX = x + (w - (cardW * 3 + gap * 2)) / 2;
    if (!shopOffers.length)
        uiText('SOLD OUT!', x + w/2, y + 100, 2, uiColors.cream);
    shopOffers.forEach((offer, i) =>
    {
        const cx = startX + i * (cardW + gap), cy = y + 34;
        const price = upgradePrice(offer.upgrade);
        const affordable = game.money >= price;
        const hover = !offer.sold && mouseIn(cx, cy, cardW, cardH);
        const lift = offer.sold ? 0 : hover ? -5 : Math.round(Math.sin(time * 2 + i * 2) * 1.5);
        const top = cy + lift;
        uiRect(cx + 3, cy + 4, cardW, cardH, new Color(0, 0, 0, .35));
        uiRect(cx - 1, top - 1, cardW + 2, cardH + 2, uiColors.ink);
        uiRect(cx, top, cardW, cardH, offer.sold ? uiColors.gray : uiColors.cream);
        if (offer.sold)
        {
            uiText('SOLD', cx + cardW/2, top + cardH/2, 2, uiColors.dark, 'center', false);
            return;
        }
        uiRect(cx + 6, top + 6, cardW - 12, 56, uiColors.panel);
        if (offer.upgrade.icon)
            drawSprite(offer.upgrade.icon, cx + cardW/2, top + 34, 3);
        else
            drawSprite('coin', cx + cardW/2, top + 34, 3);
        uiText(offer.upgrade.name, cx + cardW/2, top + 70, 1, uiColors.ink, 'center', false);
        offer.upgrade.desc.split('\n').forEach((line, j) =>
            uiText(line, cx + cardW/2, top + 84 + j * 11, 1, uiColors.panel, 'center', false));
        uiRect(cx + 16, top + cardH - 26, cardW - 32, 18, affordable ? uiColors.orange : uiColors.gray);
        uiText(formatMoney(price), cx + cardW/2, top + cardH - 17, 1, WHITE);
        if (clicked(cx, cy, cardW, cardH))
            buyOffer(offer);
    });

    const by = y + h - 34;
    if (uiButton('REROLL ' + formatMoney(rerollCost), x + 20, by, 140, 22, uiColors.green, game.money >= rerollCost))
    {
        game.money -= rerollCost++;
        rollShop();
    }
    if (uiButton('NEXT DAY', x + w - 160, by, 140, 22, uiColors.blue))
        nextDay();
}

function newsScreen()
{
    uiRect(0, 0, screenW, screenH, new Color(0, 0, 0, .5));
    const sectionH = 50;
    const w = 400, h = 76 + game.news.length * sectionH, x = (screenW - w) / 2, y = Math.round((screenH - h) / 2);
    const paper = new Color().setHex('#f3ead7');
    uiPanel(x, y, w, h, paper);

    // masthead
    uiText('THE DAILY SNACK', x + w/2, y + 15, 2, uiColors.ink, 'center', false);
    uiText(`DAY ${game.day} - ${currentLocation().tag} EDITION - 25C`, x + w/2, y + 31, 1, uiColors.gray, 'center', false);
    uiRect(x + 8, y + 38, w - 16, 1, uiColors.ink);
    uiRect(x + 8, y + 40, w - 16, 1, uiColors.ink);

    game.news.forEach((event, i) =>
    {
        const sy = y + 48 + i * sectionH;
        const category = newsCategories[event.cat];
        const chipW = category.label.length * 8 + 8;
        uiRect(x + 10, sy, chipW, 12, uiColors.ink);
        uiText(category.label, x + 14, sy + 6, 1, category.color.lerp(WHITE, .2), 'left', false);
        uiText(event.title, x + 18 + chipW, sy + 6, 1, uiColors.ink, 'left', false);
        uiText(event.blurb, x + 10, sy + 19, 1, uiColors.gray, 'left', false);

        // effects in green or red, wrapping onto a second line if needed
        const effects = newsEffectList(event);
        if (!effects.length)
            uiText('NO EFFECT ON SALES', x + 10, sy + 31, 1, uiColors.gray, 'left', false);
        uiEffectList(effects, x + 10, sy + 31, w - 20);
        if (i < game.news.length - 1)
            uiRect(x + 10, sy + sectionH - 4, w - 20, 1, uiColors.cream.scale(.8, 1));
    });

    if (uiButton('STOCK UP', x + w/2 - 70, y + h - 24, 140, 16, uiColors.orange))
        phase = 'prep';
}

// colored tag chip like [HOT], centered on y, returns its width
function uiTagChip(tag, x, y)
{
    const style = tagStyles[tag], w = style.label.length * 8 + 4;
    uiRect(x, y - 5, w, 10, spriteColor(style.color));
    uiText(style.label, x + 2, y, 1, style.dark ? WHITE : uiColors.ink, 'left', false);
    return w;
}

// a row of chips for an item's tags, returns the width used
function uiItemTags(key, x, y)
{
    let tx = x;
    for (const tag of itemTypes[key].tags)
        tx += uiTagChip(tag, tx, y) + 3;
    return tx - x;
}

// how wide one effect list entry is: label or chip, a gap, then the multiplier
const effectEntryWidth = ([label, m, tag]) => (tag ? label.length * 8 + 4 : label.length * 8) + 4 + formatMultiplier(m).length * 8;
const effectListWidth = (effects) => effects.reduce((sum, entry) => sum + effectEntryWidth(entry) + 12, -12);

// effect list with tag chips and green or red multipliers, returns the last line's y
// wraps onto new lines, or with wrap off cuts off with '..' when out of room
function uiEffectList(effects, x, y, w, onDark=false, wrap=true)
{
    const good = onDark ? uiColors.green.lerp(WHITE, .35) : uiColors.green;
    const bad = onDark ? uiColors.red.lerp(WHITE, .3) : uiColors.red;
    const plain = onDark ? uiColors.cream : uiColors.ink;
    let ex = x;
    for (const [label, m, tag] of effects)
    {
        const mult = formatMultiplier(m);
        const labelW = tag ? label.length * 8 + 4 : label.length * 8;
        const entryW = effectEntryWidth([label, m, tag]);
        if (ex + entryW > x + w)
        {
            if (!wrap)
                return uiText('..', ex, y, 1, plain, 'left', false), y;
            ex = x, y += 12;
        }
        if (tag)
            uiTagChip(tag, ex, y);
        else
            uiText(label, ex, y, 1, plain, 'left', false);
        uiText(mult, ex + labelW + 4, y, 1, m > 1 ? good : bad, 'left', false);
        ex += entryW + 12;
    }
    return y;
}

// card for where the machine is right now, shown on arrival and from the SITE button
function locationScreen()
{
    uiRect(0, 0, screenW, screenH, new Color(0, 0, 0, .5));
    const loc = currentLocation();
    const w = 360, h = 192, x = (screenW - w) / 2, y = Math.round((screenH - h) / 2);
    uiPanel(x, y, w, h, uiColors.dark);
    uiText(`LOCATION ${game.locIndex + 1} OF ${locationTypes.length}`, x + w/2, y + 12, 1, uiColors.cream);
    uiRect(x + 10, y + 22, 52, 52, loc.feltColors[1]);
    drawSprite(loc.icon, x + 36, y + 48, 3);
    uiText(loc.name, x + 72, y + 36, loc.name.length > 11 ? 1 : 2, uiColors.gold, 'left');
    uiText(loc.blurb, x + 72, y + 56, 1, WHITE, 'left');
    const daysText = isLastLocation() && game.locDay > levelsPerLocation ? 'ENDLESS' : `DAY ${game.locDay} OF ${levelsPerLocation}`;
    uiText(daysText + '  RENT ' + formatMultiplier(loc.rent || 1), x + 72, y + 68, 1, uiColors.red.lerp(WHITE, .3), 'left');

    uiRect(x + 10, y + 82, w - 20, 1, uiColors.cream.scale(.6, 1));
    uiText('CROWD HERE', x + 10, y + 92, 1, uiColors.cream, 'left');
    let ly = uiEffectList(locationEffectList(loc), x + 10, y + 106, w - 20, true);
    if (loc.rush)
        uiText('RUSH HOURS ' + loc.rush.map(([start, end]) => start + '-' + end + 'H').join(' '), x + 10, ly += 12, 1, uiColors.orange, 'left', false);
    if (loc.think)
        uiText('QUICK DECIDERS', x + 10, ly += 12, 1, uiColors.orange, 'left', false);

    if (uiButton(infoReturnPhase == 'prep' ? 'BACK' : 'SET UP SHOP', x + w/2 - 70, y + h - 24, 140, 16, uiColors.orange))
        phase = infoReturnPhase;
}

// pick where to start a run, later spots unlock by clearing the one before
function mapScreen()
{
    uiRect(0, 0, screenW, screenH, new Color(0, 0, 0, .6));
    uiText('PICK A SPOT', screenW/2, 18, 2, uiColors.gold);
    uiText(`CLEAR ${levelsPerLocation} DAYS TO UNLOCK THE NEXT`, screenW/2, 34, 1, uiColors.cream);
    const cardW = 100, cardH = 96, gap = 12;
    let hovered = null;
    locationTypes.forEach((loc, i) =>
    {
        const row = i < 4 ? 0 : 1, perRow = row ? 3 : 4, col = row ? i - 4 : i;
        const cx = (screenW - (cardW * perRow + gap * (perRow - 1))) / 2 + col * (cardW + gap);
        const cy = 46 + row * (cardH + 12);
        const unlocked = i < saveData.locationsUnlocked;
        const hover = unlocked && mouseIn(cx, cy, cardW, cardH);
        if (hover)
            hovered = loc;
        const lift = hover ? -4 : 0, top = cy + lift;
        uiRect(cx + 3, cy + 4, cardW, cardH, new Color(0, 0, 0, .35));
        uiRect(cx - 1, top - 1, cardW + 2, cardH + 2, uiColors.ink);
        uiRect(cx, top, cardW, cardH, unlocked ? uiColors.cream : uiColors.gray);
        uiRect(cx + 6, top + 6, cardW - 12, 44, unlocked ? loc.feltColors[1] : uiColors.dark);
        uiText(i + 1 + '', cx + 12, top + 13, 1, uiColors.cream, 'center', false);
        if (unlocked)
        {
            drawSprite(loc.icon, cx + cardW/2, top + 28, 2);
            uiText(loc.tag, cx + cardW/2, top + 60, 1, uiColors.ink, 'center', false);
            uiText('RENT ' + formatMultiplier(loc.rent || 1), cx + cardW/2, top + 74, 1, uiColors.panel, 'center', false);
            if (startBonus(i))
                uiText('+$' + startBonus(i) + ' CASH', cx + cardW/2, top + 86, 1, uiColors.green, 'center', false);
        }
        else
        {
            uiText('?', cx + cardW/2, top + 28, 2, uiColors.gray, 'center', false);
            uiText('LOCKED', cx + cardW/2, top + 66, 1, uiColors.dark, 'center', false);
        }
        if (clicked(cx, cy, cardW, cardH))
        {
            if (unlocked)
                sfx.click.play(), newRun(i);
            else
                sfx.error.play();
        }
    });
    if (hovered)
        uiText(hovered.blurb, screenW/2, 260, 1, WHITE);
    else
        uiText('BEST RUN: DAY ' + saveData.bestDay, screenW/2, 260, 1, uiColors.cream);
}

function uiFrame()
{
    if (phase == 'map')
        mapScreen();
    else if (phase == 'location')
        locationScreen();
    else if (phase == 'news')
        newsScreen();
    else if (phase == 'prep')
        prepScreen();
    else if (phase == 'day')
        dayScreen();
    else if (phase == 'summary')
        summaryScreen();
    else if (phase == 'shop')
        shopScreen();
}

///////////////////////////////////////////////////////////////////////////////
// background: slow diagonal bands like Balatro's swirling felt, plus scanlines

function drawBackground()
{
    const feltColors = currentLocation().feltColors;
    uiRect(0, 0, screenW, screenH, feltColors[0]);
    const scroll = time * 6 % 64;
    for (let i = -4; i < 14; ++i)
    {
        const x = i * 64 + scroll;
        drawRect(vec2(x, screenH/2), vec2(26, 700), feltColors[1], .6 + Math.sin(time * .4 + i * .5) * .04, true, true);
    }

    // sidewalk the customers stand on
    uiRect(machine.x + machine.w, streetY + 16, screenW, 2, uiColors.ink);
    uiRect(machine.x + machine.w, streetY + 18, screenW, screenH, new Color(0, 0, 0, .25));
}

function drawScanlines()
{
    const line = new Color(0, 0, 0, .12);
    for (let y = 0; y < screenH; y += 2)
        drawRect(vec2(screenW/2, y + .5), vec2(screenW, 1), line, 0, true, true);
}

///////////////////////////////////////////////////////////////////////////////
function gameInit()
{
    newRun();
    phase = 'map';
}

///////////////////////////////////////////////////////////////////////////////
function gameUpdate()
{
    // handle clicks with the same layout code that draws the ui
    uiDrawing = false;
    uiFrame();

    if (phase == 'day')
        updateDay(timeDelta * simSpeed);
    else if (phase == 'summary')
        updateSummary(timeDelta);

    // money counts toward its real value
    shownMoney += (game.money - shownMoney) * .15;
    if (Math.abs(game.money - shownMoney) < .01)
        shownMoney = game.money;

    for (const float of floatTexts)
        float.life -= timeDelta, float.y -= 20 * timeDelta;
    floatTexts = floatTexts.filter(float => float.life > 0);

    shakeAmount = Math.max(0, shakeAmount - 30 * timeDelta);
}

///////////////////////////////////////////////////////////////////////////////
function gameUpdatePost()
{
    shakeOffset = vec2(rand(-1, 1), rand(-1, 1)).scale(shakeAmount).floor();
}

///////////////////////////////////////////////////////////////////////////////
function gameRender()
{
    uiDrawing = true;
    drawBackground();
    drawMachine();
    for (const customer of [...customers].reverse())
        customer.render();
}

///////////////////////////////////////////////////////////////////////////////
function gameRenderPost()
{
    uiDrawing = true;
    uiFrame();
    for (const float of floatTexts)
        uiText(float.text, float.x, float.y, 1, float.color.scale(1, Math.min(1, float.life * 2)));
    drawScanlines();
}

///////////////////////////////////////////////////////////////////////////////
// Startup LittleJS Engine
engineInit(gameInit, gameUpdate, gameUpdatePost, gameRender, gameRenderPost, [buildSpriteSheet()]);
