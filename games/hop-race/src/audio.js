/*
    HOP RACE - sound effects (GDD §10), all synthesized with ZzFX through SoundGenerator.
    The engine creates the AudioContext and resumes it on the first click or key press.
*/

'use strict';

let hrSfx = {};

function hrAudioInit()
{
    hrSfx = {
        charge:    new SoundGenerator({frequency: 200, release: .03, volume: .15}),
        jump:      new SoundGenerator({frequency: 300, release: .12, slide: .3, volume: .5}),
        land:      new SoundGenerator({frequency: 120, release: .06, slide: -.2, volume: .4}),
        fall:      new SoundGenerator({frequency: 400, release: .4, slide: -.8, volume: .4}),
        finish:    new SoundGenerator({frequency: 600, release: .5, pitchJump: 400, pitchJumpTime: .1, repeatTime: .12, volume: .5}),
        star:      new SoundGenerator({frequency: 700, release: .25, slide: .4, volume: .4}),
        fanfare:   new SoundGenerator({frequency: 520, release: .4, pitchJump: 260, pitchJumpTime: .08, repeatTime: .16, volume: .45}),
        beepLow:   new SoundGenerator({frequency: 330, release: .15, volume: .35}),
        beepHigh:  new SoundGenerator({frequency: 660, release: .3, volume: .4}),
        click:     new SoundGenerator({frequency: 900, release: .03, volume: .25}),
        fire:      new SoundGenerator({frequency: 500, release: .12, slide: -.4, noise: 3, volume: .3}),
        boom:      new SoundGenerator({frequency: 90, release: .35, slide: -.3, noise: 12, bitCrush: .2, volume: .5}),
        melt:      new SoundGenerator({frequency: 220, release: .25, slide: -.5, noise: 1, volume: .4}),
        evaporate: new SoundGenerator({frequency: 500, attack: .05, release: .3, slide: .4, noise: 8, volume: .25}),
        freeze:    new SoundGenerator({frequency: 1400, release: .05, slide: -.2, volume: .35}),
        goo:       new SoundGenerator({frequency: 140, release: .2, slide: -.6, tremolo: .5, repeatTime: .05, volume: .4}),
    };
    hrApplySound();
}

function hrApplySound() { setSoundEnable(!!hrSave.settings.sfx); }
