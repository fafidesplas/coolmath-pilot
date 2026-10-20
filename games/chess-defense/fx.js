/*
    Sounds and particle bursts. Everything here is generated at runtime —
    no external audio or image assets.
*/

'use strict';

///////////////////////////////////////////////////////////////////////////////
// SOUNDS

const soundShoot = {
    pawn:   new SoundGenerator({frequency:520, volume:.18, release:.06, randomness:.12, slide:-.5, shape:5, shapeCurve:.4}),
    knight: new SoundGenerator({frequency:340, volume:.28, release:.1,  randomness:.08, slide:-.8, shape:1}),
    bishop: new SoundGenerator({frequency:660, volume:.22, release:.09, randomness:.1,  slide:1.2}),
    rook:   new SoundGenerator({frequency:190, volume:.4,  release:.14, randomness:.06, slide:-1.4, shape:2, bitCrush:.2}),
    queen:  new SoundGenerator({frequency:780, volume:.32, release:.12, randomness:.08, slide:-1.8, shape:1, delay:.04}),
};

const soundKill  = new SoundGenerator({frequency:150, volume:.5, release:.18, noise:6, bitCrush:.35, shape:4, sustainVolume:.5});
const soundBuild = new SoundGenerator({frequency:440, volume:.4, release:.1, pitchJump:220, pitchJumpTime:.05, shape:1});
const soundSell  = new SoundGenerator({frequency:520, volume:.35, release:.12, slide:-1.2, shape:1});
const soundDeny  = new SoundGenerator({frequency:120, volume:.35, release:.1, shape:5, shapeCurve:.2});
const soundMove  =new SoundGenerator({frequency:300, volume:.3, release:.09, slide:.9, shape:1, pitchJump:120, pitchJumpTime:.04});
const soundPieceLost = new SoundGenerator({frequency:200, volume:.6, attack:.01, sustain:.06, release:.4, slide:-1.6, shape:2, bitCrush:.3, noise:1.5});
const soundWave  = new SoundGenerator({frequency:280, volume:.5, attack:.02, sustain:.08, release:.25, slide:1.6, shape:1, delay:.08});
const soundSmash = new SoundGenerator({frequency:70, volume:.6, attack:.005, release:.3, slide:-.6, shape:4, noise:3, bitCrush:.25});
const soundOver  = new SoundGenerator({frequency:220, volume:.7, attack:.05, sustain:.3, release:.6, slide:-.5, shape:2, delay:.3, sustainVolume:.5});

// recorded UI clicks (sfxData.js), one picked at random per click
const soundUiClicks = UI_CLICK_DATA.map(data => new Sound(data, .05));
function playUiClick() { soundUiClicks[randInt(soundUiClicks.length)].play(undefined, .7); }

// recorded placement slaps (sfxData.js), random pick pitched by piece weight
const soundPlaceSlaps = PLACE_DATA.map(data => new Sound(data, .04));
const PLACE_PITCH = {pawn:1.2, knight:1.08, bishop:1, rook:.82, queen:.9};
function playPlaceSound(type, pos)
{ soundPlaceSlaps[randInt(soundPlaceSlaps.length)].play(pos, .8, PLACE_PITCH[type]); }

// recorded impacts (sfxData.js) when a piece's shot lands, one random take from
// that piece's set. Each piece type is spaced out on its own so a board of
// pawns firing together is a patter rather than a wall of noise.
const soundHits = {};
for (const type in HIT_DATA)
    soundHits[type] = HIT_DATA[type].map(data => new Sound(data, .06));
const lastHitTime = {};
function playHitSound(type, pos)
{
    if (time - (lastHitTime[type] ?? -9) < HIT_SPACING)
        return;
    lastHitTime[type] = time;
    const takes = soundHits[type];
    takes[randInt(takes.length)].play(pos, .45);
}

// recorded explosions (sfxData.js) when an enemy reaches the king, one random take
const soundKingHits = KING_HIT_DATA.map(data => new Sound(data, .05));
function playKingHitSound()
{ soundKingHits[randInt(soundKingHits.length)].play(undefined, .7); }

// recorded boot steps (sfxData.js) as an enemy lands on its next tile
const soundSteps = STEP_DATA.map(data => new Sound(data, .05));

// recorded low-health explosions (sfxData.js) once the king is below 20% HP
const soundKingLowHits = KING_LOW_HIT_DATA.map(data => new Sound(data, .05));
function playKingLowHitSound()
{ soundKingLowHits[randInt(soundKingLowHits.length)].play(undefined, .7); }

///////////////////////////////////////////////////////////////////////////////
// PARTICLES

function spawnHitSpark(pos, color)
{
    new ParticleEmitter(
        pos, 0, .12, .05, 40, PI, undefined,
        color, rgb(1, 1, .85),
        rgb(color.r, color.g, color.b, 0), rgb(1, 1, .85, 0),
        .25, .16, .03, .1, .18, .9, 1, 0, PI, .3, .5, false, true);
}

function spawnDeathBurst(pos, color, size)
{
    new ParticleEmitter(
        pos, 0, size * .5, .1, 90, PI, undefined,
        color, rgb(1, 1, 1),
        rgb(color.r, color.g, color.b, 0), rgb(1, 1, 1, 0),
        .5, size * .7, .05, .16, .3, .92, 1, .3, PI, .2, .5);
}

// Ravager impact: a low ring of dust thrown out across the squares it just hit.
function spawnSmashBurst(pos)
{
    const c = SMASH_COLOR;
    new ParticleEmitter(
        pos, 0, CELL_SIZE * 1.6, .08, 110, PI, undefined,
        c, rgb(.55, .45, .35),
        rgb(c.r, c.g, c.b, 0), rgb(.55, .45, .35, 0),
        .45, .45, .1, .12, .25, .88, 1, 0, PI, .2, .5);
}

function spawnLeakBurst(pos)
{
    new ParticleEmitter(
        pos, 0, .8, .15, 120, PI, undefined,
        rgb(1, .3, .2), rgb(1, .8, .3),
        rgb(1, .3, .2, 0), rgb(1, .8, .3, 0),
        .7, .9, .1, .2, .4, .9, 1, .4, PI, .2, .5);
}

// Puffs at both ends plus a few along the way, so the eye follows the piece to
// its new square instead of having to re-find it.
function spawnMoveTrail(from, to)
{
    spawnBuildPuff(from);
    spawnBuildPuff(to);
    const steps = 4;
    for (let i = 1; i < steps; ++i)
        new ParticleEmitter(
            from.lerp(to, i / steps), 0, .25, .06, 24, PI, undefined,
            rgb(.6, .85, 1), rgb(1, 1, 1),
            rgb(.6, .85, 1, 0), rgb(1, 1, 1, 0),
            .3, .3, .05, .06, .12, .9, 1, 0, PI, .3, .5);
}

function spawnBuildPuff(pos)
{
    new ParticleEmitter(
        pos, 0, .7, .12, 50, PI, undefined,
        rgb(1, 1, .9), rgb(.7, .8, 1),
        rgb(1, 1, .9, 0), rgb(.7, .8, 1, 0),
        .4, .5, .1, .1, .2, .9, 1, -.2, PI, .3, .5);
}

// Queen fireball: embers shed behind the ball. Emits until the shot lands and
// destroys it; the emitter is moved along with the ball each frame.
function spawnFireTrail(pos)
{
    return new ParticleEmitter(
        pos, 0, .12, 0, 90, PI, undefined,
        rgb(1, .8, .3), rgb(1, .45, .1),
        rgb(.9, .15, 0, 0), rgb(.4, .05, 0, 0),
        .3, .22, .04, .01, .1, .9, 1, 0, PI, .3, .5, false, true);
}
