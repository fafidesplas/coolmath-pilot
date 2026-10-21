/*
    HOP RACE - GameAnalytics (GDD §11). Stubs for now: every event is logged to the console.
    When the SDK and keys arrive, send from hrGaSend and keep the call sites as they are.
*/

'use strict';

function hrGaSend(kind, id, value)
{
    console.log('[GA]', kind, id, value === undefined ? '' : value);
}

// status: 'Start' | 'Complete' | 'Fail'
function hrGaProgress(status, worldIndex, levelIndex, value)
{
    const level = 'level' + String(levelIndex + 1).padStart(2, '0');
    hrGaSend('progression', `${status}:${HR_WORLDS[worldIndex].ga}:${level}`, value);
}

function hrGaDesign(id, value) { hrGaSend('design', id, value); }
