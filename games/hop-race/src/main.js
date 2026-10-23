/*
    HOP RACE - engine setup, the play state machine and the window.game testing hook.
    Screens: title | modes | levels | settings | playing | paused | complete | round | match
*/

'use strict';

let hrWorld = 0, hrLevelIndex = 0, hrVersus = false;
let hrRun = null;      // solo attempt: timer, ghost, nudge, tutorial prompt
let hrMatch = null;    // versus match: wins, countdown, round time
let hrResult = null;   // last solo finish, shown on the level complete screen
let hrFinishT = -1;    // real seconds since the finish line, -1 while racing
const hrTutorialSent = {};

function hrLevelDef() { return hrLevelsOf(hrWorld)[hrLevelIndex]; }
function hrIsTutorial() { return !hrVersus && hrLevelDef().id == 'hop-01'; }

// load a level and (re)start it; keepMatch keeps the versus score between rounds
function hrStartLevel(world, index, versus = hrVersus, keepMatch = false)
{
    const newLevel = world != hrWorld || index != hrLevelIndex || versus != hrVersus || !hrRun;
    hrWorld = world; hrLevelIndex = index; hrVersus = versus;
    const def = hrLevelDef();
    hrSaveLast(def.id);
    hrLoadLevel(def);
    hrMode().clear?.();
    hrCameraReset();
    clearParticles();
    hrPlayers = versus ? [hrMakePlayer(0), hrMakePlayer(1)] : [hrMakePlayer(0)];
    hrPlayers.forEach(hrResetPlayer);
    hrRun = {started: false, frames: 0, best: 1e9, stuckT: 0, nudge: false,
        prompt: index == 0 && def.prompt ? 1 : 0, promptFade: false, hintT: index == 0 ? 0 : 3,
        promptSeen: hrRun && !newLevel ? hrRun.promptSeen : false};
    if (hrRun.promptSeen) hrRun.prompt = 0;
    hrFinishT = -1;
    if (versus)
    {
        if (!keepMatch)
        {
            hrMatch = {wins: [0, 0], rounds: 0};
            hrGaDesign(`mode:${HR_WORLDS[world].id}:versus`);
        }
        hrMatch.countdown = 2.4;
        hrMatch.frames = 0;
        hrMatch.winner = -1;
        hrMatch.beep = 4;
    }
    else
    {
        hrMatch = null;
        hrGhostLoad(def.id);
        hrGaDesign(`mode:${HR_WORLDS[world].id}:solo`);
    }
    hrGo('playing');
}

// solo: an attempt that sent Start and did not finish counts as a Fail when it is left
function hrLeaveAttempt()
{
    if (hrVersus || !hrRun || !hrRun.started || hrFinishT >= 0) return;
    hrGaProgress('Fail', hrWorld, hrLevelIndex, hrRunMs());
    hrGaDesign(`player:respawn:${HR_WORLDS[hrWorld].id}`, hrPlayers[0].falls);
    hrRun.started = false;
}

function hrRestart()
{
    hrGaDesign('ui:restart');
    if (hrVersus)
    {
        // restart the round without a point
        hrStartLevel(hrWorld, hrLevelIndex, true, true);
        return;
    }
    hrLeaveAttempt();
    hrStartLevel(hrWorld, hrLevelIndex, false);
}

function hrRunMs() { return Math.round(hrRun.frames * 1000 / frameRate); }

// gameplay events from modes and player rules
function hrEmit(type, p)
{
    const tut = hrIsTutorial();
    if (type == 'hold' && tut) hrTutorial('step01');
    if (type == 'jump' || type == 'fire')
    {
        if (tut) hrTutorial('step02');
        if (hrRun.prompt) hrRun.promptFade = true;   // the prompt fades after the first successful action
        hrRun.promptSeen = true;
    }
    if (type == 'land' && tut) hrTutorial('step03');
    if (type == 'finish') hrVersus ? hrRoundWon(p) : hrSoloFinish(p);
}

function hrTutorial(step, value)
{
    if (hrTutorialSent[step]) return;
    hrTutorialSent[step] = true;
    hrGaDesign('tutorial:' + step, value);
}

function hrFinishFx(p)
{
    hrSfx.finish.play();
    hrConfetti(vec2(p.x, p.y), p.color);
    addScreenShake(.15, .25);
    hrPulse = 1;
    hrFinishT = 0;
    p.squash = -.35;   // stretch pop on the finish
    p.pupilKick(0, .3);
}

function hrSoloFinish(p)
{
    const def = hrLevelDef(), ms = hrRunMs();
    const prev = hrSaveLevel(def.id);
    const best = hrSaveResult(def.id, ms);
    if (best) hrGhostSave(def.id);
    hrResult = {ms, best: best && prev.bestMs > 0, bestMs: best ? ms : prev.bestMs, prevMs: prev.bestMs, fanfare: false};
    hrGaProgress('Complete', hrWorld, hrLevelIndex, ms);
    hrGaDesign(`player:respawn:${HR_WORLDS[hrWorld].id}`, p.falls);
    if (hrIsTutorial()) hrTutorial('done', ms);
    hrRun.started = false;
    hrFinishFx(p);
}

function hrRoundWon(p)
{
    const m = hrMatch;
    if (m.winner >= 0) return;   // the first player to finish wins the round
    m.winner = p.index;
    m.wins[p.index]++;
    m.rounds++;
    hrGaDesign('versus:round:p' + (p.index + 1), Math.round(m.frames * 1000 / frameRate));
    if (m.wins[p.index] >= 3) hrGaDesign('versus:match:p' + (p.index + 1), m.rounds);
    hrFinishFx(p);
}

///////////////////////////////////////////////////////////////////////////////

function gameInit()
{
    hrSaveLoad();
    hrAudioInit();
    hrInputInit();
    hrLoadLevel(hrLevelsOf(0)[0]);   // backdrop for the title screen
    hrGo('title');
    document.addEventListener('visibilitychange', () =>
    {
        if (document.hidden && hrScreen == 'playing') hrGo('paused');
    });
}

function gameUpdate()
{
    hrInputBegin();
    hrUiAdvance(timeDelta);
    if (hrPulse > 0) hrPulse = max(0, hrPulse - timeDelta * 2);

    if (hrIsPortrait())
    {
        hrInputEnd(false, hrVersus);
        return;   // the game waits behind the rotate screen
    }
    hrUiUpdate();
    const racing = hrScreen == 'playing' && hrFinishT < 0 && !(hrMatch && hrMatch.countdown > 0);
    hrInputEnd(racing, hrVersus);
    hrUiContinue();

    if (hrScreen == 'playing')
    {
        hrGatesUpdate();
        hrMode().update?.();
        hrPlayUpdate(racing);
    }
}

function hrPlayUpdate(racing)
{
    if (hrFinishT >= 0)
    {
        hrPlayers.forEach(p => hrPlayerStep(p, {down: false, pressed: false, released: false}));
        hrFinishT += timeDelta;
        if (hrFinishT > .5)
        {
            if (!hrVersus) hrGo('complete');
            else hrGo(hrMatch.wins[hrMatch.winner] >= 3 ? 'match' : 'round');
        }
        return;
    }

    if (hrMatch && hrMatch.countdown > 0)
    {
        // 3-2-1-GO: input is ignored until GO
        hrMatch.countdown -= timeDelta;
        const n = Math.ceil(hrMatch.countdown / .8);
        if (n < hrMatch.beep) { hrMatch.beep = n; (n > 0 ? hrSfx.beepLow : hrSfx.beepHigh).play(); }
        hrPlayers.forEach(p => hrPlayerStep(p, {down: false, pressed: false, released: false}));
        return;
    }

    if (hrRun.prompt && hrRun.promptFade) hrRun.prompt = max(0, hrRun.prompt - timeDelta * 2);
    hrRun.hintT += timeDelta;

    if (hrVersus)
    {
        hrMatch.frames++;
        hrPlayers.forEach(p => hrPlayerStep(p, hrButtons[p.index]));
        return;
    }

    const p = hrPlayers[0], input = hrButtons[0];
    if (!hrRun.started && input.pressed)
    {
        // the timer (and ghost) start at the first input, so reading the level is free
        hrRun.started = true;
        hrGaProgress('Start', hrWorld, hrLevelIndex);
    }
    hrPlayerStep(p, input);
    if (!hrRun.started || hrFinishT >= 0) return;
    hrGhostRecord(p, hrRun.frames);
    hrRun.frames++;

    // stuck nudge: 8 s without getting closer to the flag
    const d = hrFlagDistance(p);
    if (d < hrRun.best - .05) { hrRun.best = d; hrRun.stuckT = 0; hrRun.nudge = false; }
    else if ((hrRun.stuckT += timeDelta) > 8 && !hrRun.nudge)
    {
        hrRun.nudge = true;
        hrGaDesign('ui:nudge');
    }
}

function gameUpdatePost()
{
    hrCameraFit();
}

function gameRender()
{
    hrDrawBackground();
    if (!hrInWorld()) return;
    hrDrawLevel();
    hrMode().drawWorld?.();
    if (!hrVersus && hrRun && hrSave.settings.ghost)
        hrDrawGhost(hrGhostPos(hrRun.started || hrFinishT >= 0 ? hrRun.frames : 0));
    hrPlayers.forEach(p => hrMode().draw(p));
    // in Versus both spawn on the same point: P2 is drawn behind, with its eye nudged so both show
    for (let i = hrPlayers.length; i--;)
    {
        const p = hrPlayers[i], other = hrPlayers[1 - i];
        const nudge = i == 1 && other && Math.hypot(p.x - other.x, p.y - other.y) < .4 ? -.45 : 0;
        hrMode().drawPlayer ? hrMode().drawPlayer(p, nudge) : hrDrawPlayer(p, nudge);
    }
    hrDrawPrompt();
}

function gameRenderPost() { hrUiRender(); }

///////////////////////////////////////////////////////////////////////////////
// testing hook (STANDARDS.md): read-only state plus helpers; win() is debug only

window.game = {
    get screen() { return hrIsPortrait() ? 'rotate' : hrScreen; },
    get level() { return hrInWorld() ? hrLevelDef().id : null; },
    get mode() { return HR_WORLDS[hrWorld].id; },
    get versus() { return hrVersus; },
    get score() { return hrVersus ? (hrMatch ? hrMatch.wins.slice() : null) : (hrResult ? hrResult.ms : null); },
    start(levelId = 'hop-01', versus = false)
    {
        const f = hrFindLevel(levelId);
        if (f) hrStartLevel(f.world, f.index, versus);
        return !!f;
    },
    restart() { if (hrInWorld()) hrRestart(); },
    win()
    {
        if (hrScreen != 'playing' || hrFinishT >= 0) return;
        const p = hrPlayers[0];
        if (!hrVersus && !hrRun.started) { hrRun.started = true; hrGaProgress('Start', hrWorld, hrLevelIndex); }
        p.x = hrLevel.flag.x; p.y = hrLevel.flag.y + HR_PSIZE / 2;
        p.vx = p.vy = 0; p.grounded = true;
        hrMode().warp?.(p);
    },
};

setDebugWatermark(false);
hrCanvasSetup();
engineInit(gameInit, gameUpdate, gameUpdatePost, gameRender, gameRenderPost);
