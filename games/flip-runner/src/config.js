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
  gravity: 7000,
  maxVy: 2000,
  kick: 250,                    // initial push towards the new surface
  bufferSteps: Math.round(0.10 * HZ),
  coyoteSteps: Math.round(0.06 * HZ),
  cornerForgive: 10,
};

// Forms (prototype): glider climbs or dives at this share of the forward speed.
export const GLIDE = 0.85;

export const SPIKE_INSET = 6;   // deadly area starts this far inside the drawn spike
export const SPIKE_H = 22;      // drawn spike height
export const RESPAWN_STEPS = Math.round(0.35 * HZ);
export const LAND_EVENT_SPEED = 300;

export const CAMERA = { lead: 0.30, leadFast: 0.22, fastSpeed: 700 };

export const WORLD_SPEED = [440, 470, 500, 530];
export const NEAR_MISS = 10;   // px around a spike's deadly area that counts as a close call

// Bat theme (GDD 9): a little bat racing home through the night before sunrise.
export const COLORS = {
  ink: '#1B1430',      // outlines, text, HUD
  runner: '#B79CFF',   // the bat (lilac)
  belly: '#E9DFFF',
  ear: '#FF8FB1',
  scarf: '#FF5A4E',
  star: '#FFD45C',
  spike: '#7FF3E4',
  panel: '#FFF7EC',
  moon: '#FFF3C4',
};

// Each world: sky gradient (bg → bg2), rock shades, an accent light and a
// backdrop kind. The sky warms world by world towards dawn.
export const WORLD_COLORS = [
  { name: 'Crystal Cave', kind: 'cave', bg: '#1E1740', bg2: '#35266A', floor: '#4B3D7C', ceiling: '#3B2F68', accent: '#5FF0D8', spike: '#7FF3E4' },
  { name: 'Bell Tower', kind: 'tower', bg: '#241E4E', bg2: '#4B3B82', floor: '#6E5E93', ceiling: '#5A4B7E', accent: '#FFC857', spike: '#E9E2FF' },
  { name: 'Firefly Forest', kind: 'forest', bg: '#132B3C', bg2: '#235A5C', floor: '#3E6B4F', ceiling: '#2E5641', accent: '#D7FF6B', spike: '#C9F28A' },
  { name: 'Night Fair', kind: 'fair', bg: '#3A2050', bg2: '#C46A6A', floor: '#5B3A6E', ceiling: '#4A2E5E', accent: '#FF9B4A', spike: '#FFE3F0' },
];

export const SAVE_KEY = 'cm_flip-runner_save';
export const SETTINGS_KEY = 'cm_flip-runner_settings';
