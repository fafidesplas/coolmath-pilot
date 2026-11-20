/*
    HOP RACE - playtest build (debug only): open index.html?playtest. Without ?playtest this file does nothing.
    Only index.html loads it (not build.json), so release builds never have it.
    - Title: only Play 1P and Play 2P (no world cards, Store, Settings or coins).
    - Play 1P: every live level in one run, Hop, then Rocket, Grapple and Climb. Next crosses into the next world;
      after the last level, Finish goes to the title. Play 1P resumes at the first level not finished yet.
    - Play 2P: a match is always 3 rounds, each on a random level of a different random world (mode). A tie replays
      the same level. The match winner has the most wins. Rematch picks 3 new levels.
    - Fresh every load: nothing is read from or written to the normal save, so a reload is a new tester.
    - No coins on the results screens (medals stay), no ads, no Levels button, ghost off, no level editor.
    It changes the game only by replacing functions of src/save.js, src/cmg.js and src/ui.js, so it loads after
    them and before src/main.js.
*/

'use strict';

const HR_PLAYTEST = new URLSearchParams(location.search).has('playtest');
const HR_PT_WORLDS = ['hop', 'rocket', 'grapple', 'climb'];   // Play 1P's order
const HR_PT_ROUNDS = 3;                                       // rounds in a Play 2P match

let hrPtSolo = null;   // the last solo level started: {world, index}

const hrPtWorld = id => HR_WORLDS.findIndex(w => w.id == id);

// Play 1P's levels in order, across worlds
function hrPtSequence()
{
    const seq = [];
    for (const id of HR_PT_WORLDS)
    {
        const w = hrPtWorld(id);
        hrLevelsOf(w, false).forEach((l, i) => seq.push({world: w, index: i, id: l.id}));
    }
    return seq;
}

function hrPtStartSolo(s)
{
    hrPtSolo = {world: s.world, index: s.index};
    hrStartLevel(s.world, s.index, false);
}

// the level after the one being played, or null after the last
function hrPtNextSolo()
{
    const seq = hrPtSequence(), k = seq.findIndex(s => s.world == hrWorld && s.index == hrLevelIndex);
    return k < 0 ? null : seq[k + 1] || null;
}

// Play 1P: the last solo level if it is not finished, else the first level not finished, else Hop 1
function hrPtPlaySolo()
{
    const seq = hrPtSequence(), done = s => hrSaveLevel(s.id).bestMs > 0;
    const last = hrPtSolo && seq.find(s => s.world == hrPtSolo.world && s.index == hrPtSolo.index);
    hrPtStartSolo(last && !done(last) ? last : seq.find(s => !done(s)) || seq[0]);
}

// Play 2P: 3 rounds on random levels of different random worlds (repeats only if fewer than 3 worlds have levels)
function hrPtPlayVersus()
{
    const worlds = HR_PT_WORLDS.map(hrPtWorld).filter(w => hrLevelsOf(w, true).length);
    const order = worlds.map(w => [Math.random(), w]).sort((a, b) => a[0] - b[0]).map(e => e[1]);
    const plan = [];
    for (let r = 0; r < HR_PT_ROUNDS; r++)
    {
        const w = order[r % order.length];
        plan.push({world: w, index: randInt(hrLevelsOf(w, true).length)});
    }
    hrStartLevel(plan[0].world, plan[0].index, true);
    hrMatch.plan = plan;
}

const hrPtMatchWinner = () => hrMatch.wins[0] > hrMatch.wins[1] ? 0 : 1;

function hrPlaytestSetup()
{
    // fresh every load: an in-memory save, ghosts kept only for this session
    hrSaveLoad = () => { hrSave = hrSaveDefaults(); hrSave.settings.ghost = false; };
    hrSaveWrite = () => {};
    const ghosts = {};
    hrGhostRead = id => ghosts[id] || null;
    hrGhostWrite = (id, samples) => { ghosts[id] = samples.slice(); };
    hrGhostClear = id => { delete ghosts[id]; };

    // no midrolls or rewarded ads during a playtest
    hrCmgAdBreak = () => {};
    hrCmgCanReward = () => false;

    hrPlay = versus => versus ? hrPtPlayVersus() : hrPtPlaySolo();

    // the match always lasts 3 rounds: after the third won round, the match screen
    const go = hrGo;
    hrGo = screen => go(screen == 'round' && hrMatch?.plan && !hrMatch.tie && hrMatch.rounds >= HR_PT_ROUNDS ? 'match' : screen);

    // after a round, the next level in the plan (a tie plays the same level again)
    const cont = hrUiContinue;
    hrUiContinue = () =>
    {
        if (!hrMatch?.plan) return cont();
        if (hrScreen != 'round' || hrScreenT < .6) return;
        if (hrScreenT > 1.5 || hrAnyPressed() || hrTaps.some(t => !t.used))
        {
            const next = hrMatch.tie ? {world: hrWorld, index: hrLevelIndex} : hrMatch.plan[hrMatch.rounds];
            hrStartLevel(next.world, next.index, true, true);
        }
    };

    const buttons = hrUiButtons;
    hrUiButtons = () =>
    {
        const list = buttons(), H = mainCanvasSize.y;
        if (hrScreen == 'title')
            return list.filter(b => b.id == 'play1' || b.id == 'play2').map(b => ({...b, y: H * .55}));
        if (hrScreen == 'paused')
            return list.filter(b => b.id != 'Levels').map((b, i) => ({...b, y: H * (.38 + i * .11)}));
        if (hrScreen == 'complete' && !hrVersus)
        {
            const next = hrPtNextSolo();
            return list.filter(b => b.id != 'tripleAd').map(b =>
                b.id != 'Next' ? b : {...b, label: next ? 'Next' : 'Finish', act: () => next ? hrPtStartSolo(next) : hrGo('title')});
        }
        if (hrScreen == 'match' && hrMatch?.plan)
        {
            const W = mainCanvasSize.x, u = hrUnit();
            return list.filter(b => b.id != 'Levels').map((b, i) =>
                ({...b, x: W / 2 + (i - .5) * 230 * u, act: b.id == 'Rematch' ? hrPtPlayVersus : b.act}));
        }
        return list;
    };

    hrDrawTitle = (W, H, u) =>
    {
        hrText('HOP RACE', W / 2, H * .2, 100 * u);
        hrText('Playtest', W / 2, H * .31, 30 * u, HR_INK.scale(1, .6));
    };

    // the level complete screen without "+N coins" (the medal stays)
    const complete = hrDrawComplete;
    hrDrawComplete = (...a) =>
    {
        const coins = hrResult.coins;
        hrResult.coins = 0;
        complete(...a);
        hrResult.coins = coins;
    };

    // a random mode each round: its name and button meaning show during the countdown
    const hud = hrDrawHud;
    hrDrawHud = (W, H, u) =>
    {
        hud(W, H, u);
        if (!hrVersus || !hrMatch?.plan || !(hrCountdown > 0)) return;
        hrText(`Round ${hrMatch.rounds + 1} of ${HR_PT_ROUNDS}: ${HR_WORLDS[hrWorld].name}`, W / 2, H * .2, 48 * u);
        hrText(HR_WORLDS[hrWorld].hint, W / 2, H * .27, 28 * u);
    };

    // round result: who won, the score, and the next round's mode (no coins)
    hrDrawRound = (W, H, u, y0) =>
    {
        const m = hrMatch, p = hrPlayers[m.winner];
        if (m.tie) hrText('Tie! Again', W / 2, H * .38 + y0, 60 * u);
        else
        {
            hrRect(W / 2 - 220 * u, H * .38 + y0, 90 * u, 90 * u, p.color);
            hrText(`${p.name} wins the round`, W / 2 - 150 * u, H * .38 + y0, 52 * u, HR_INK, 'left');
            const next = m.plan?.[m.rounds];
            if (next) hrText(`Next: ${HR_WORLDS[next.world].name}`, W / 2, H * .68 + y0, 30 * u, HR_INK.scale(1, .7));
        }
        hrPlayers.forEach((q, i) =>
        {
            for (let k = 0; k < HR_PT_ROUNDS; k++)
            {
                const x = W / 2 + (i ? 60 + k * 40 : -60 - k * 40) * u, y = H * .56 + y0;
                const fresh = i == m.winner && k == m.wins[i] - 1;
                const s = 28 * u * (fresh ? hrEaseBack(hrScreenT / .3) : 1);
                if (k < m.wins[i]) hrRect(x, y, s, s, HR_INK);
                else hrOutline(x, y, 28 * u, 28 * u, 4 * u, HR_INK);
            }
            hrText(q.name, W / 2 + (i ? 210 : -210) * u, H * .56 + y0, 36 * u);
        });
    };

    // match result: the player with the most wins (not the last round's winner)
    hrDrawMatch = (W, H, u, y0) =>
    {
        const p = hrPlayers[hrPtMatchWinner()], s = 150 * u * hrEaseBack(hrScreenT / .4);
        hrRect(W / 2, H * .32 + y0, s, s, p.color);
        hrText(`${p.name} wins the match`, W / 2, H * .56 + y0, 60 * u);
        hrText(`${hrMatch.wins[0]} – ${hrMatch.wins[1]}`, W / 2, H * .64 + y0, 30 * u, HR_INK.scale(1, .7));
    };
}

if (HR_PLAYTEST) hrPlaytestSetup();
