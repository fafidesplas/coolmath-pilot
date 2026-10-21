// Every tuning number from GDD.md lives here, in one place.

export const T = 40;            // tile size in px
export const ROWS = 16;
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const HUD_H = 80;

export const HZ = 120;
export const STEP = 1 / HZ;
export const MAX_FRAME_DT = 0.05;

export const RUNNER = {
  w: 24, h: 28,
  gravity: 5000,
  maxVy: 1600,
  kick: 150,                    // initial push towards the new surface
  bufferSteps: Math.round(0.10 * HZ),
  coyoteSteps: Math.round(0.06 * HZ),
  cornerForgive: 10,
};

export const SPIKE_INSET = 6;   // deadly area starts this far inside the drawn spike
export const SPIKE_H = 22;      // drawn spike height
export const RESPAWN_STEPS = Math.round(0.35 * HZ);
export const LAND_EVENT_SPEED = 300;

export const CAMERA = { lead: 0.30, leadFast: 0.22, fastSpeed: 540 };

export const COLORS = {
  ink: '#2B2238',
  runner: '#3DBE8B',
  scarf: '#FF5A4E',
  star: '#FFC531',
  spike: '#EEF1F6',
  panel: '#FFF7EC',
};

export const WORLD_COLORS = [
  { name: 'Lab', bg: '#EAF4FF', floor: '#8FAAD0', ceiling: '#BACCE6' },
  { name: 'Caves', bg: '#F3E6D3', floor: '#B48455', ceiling: '#D6AF85' },
  { name: 'Sky Factory', bg: '#FFE9D6', floor: '#E0915E', ceiling: '#F2C29C' },
  { name: 'Space Station', bg: '#232A4A', floor: '#5F70A6', ceiling: '#8696C9' },
];

export const SAVE_KEY = 'cm_flip-runner_save';
export const SETTINGS_KEY = 'cm_flip-runner_settings';
