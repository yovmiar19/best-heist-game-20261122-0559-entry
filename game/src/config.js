// Velvet Vault — tuning numbers, palette and room layout.
// All balance constants live here so playtesting tweaks touch one file.

export const FIELD = { width: 1280, height: 720 };
export const STEP = 1 / 60;

// Room bounds (inner edge of the outer walls). HUD lives above y=64.
export const WALLS = { x: 30, y: 70, w: 1220, h: 640 };
export const ENTRY = { x: 640, y: 660 };
export const EXIT = { x: 1190, y: 55, w: 60, h: 80 };

export const THIEF = {
  radius: 14,
  walkSpeed: 180,
  sneakSpeed: 90,
  invulnerable: 2,
};

export const GUARD = {
  radius: 16,
  patrolSpeed: 90,
  chaseSpeed: 170,
  coneRange: 220,
  coneHalfAngle: (35 * Math.PI) / 180,
  suspicionTime: 0.8,
  alertChaseTime: 3,
  investigateTime: 2.5,
};

export const CAMERA = {
  range: 260,
  halfAngle: (25 * Math.PI) / 180,
  sweepArc: (50 * Math.PI) / 180,
  sweepPeriod: 4,
  alarmPerSecond: 20,
};

export const ALARM = {
  guardAlert: 25,
  bust: 15,
  tamperPerSecond: 10,
  decayPerSecond: 2,
  max: 100,
};

export const LIVES = 3;
export const COINS_START = 3;
export const COINS_MAX = 5;
export const ESCAPE_SECONDS = 60;
export const VAULT = { crackSeconds: 2.5 };

// Central plinth holding the Star Sapphire; also blocks movement + vision.
export const VAULT_PLINTH = { x: 595, y: 325, w: 90, h: 70 };

// Six display pedestals + two long glass cases. All block movement and sight.
export const COVER = [
  { x: 200, y: 170, w: 100, h: 70 },
  { x: 480, y: 170, w: 100, h: 70 },
  { x: 760, y: 170, w: 100, h: 70 },
  { x: 1000, y: 170, w: 100, h: 70 },
  { x: 330, y: 430, w: 100, h: 70 },
  { x: 850, y: 430, w: 100, h: 70 },
  { x: 150, y: 330, w: 220, h: 40 },
  { x: 910, y: 330, w: 220, h: 40 },
];

export const GUARD_PATROLS = [
  { waypoints: [{ x: 180, y: 120 }, { x: 1100, y: 120 }], speed: 90 },
  { waypoints: [{ x: 180, y: 560 }, { x: 1100, y: 560 }], speed: 105 },
  { waypoints: [{ x: 460, y: 120 }, { x: 460, y: 640 }], speed: 80 },
];

export const CAMERAS = [
  { x: 60, y: 100, baseAngle: (55 * Math.PI) / 180, sweepArc: (50 * Math.PI) / 180, period: 4, phase: 0 },
  { x: 1220, y: 100, baseAngle: (125 * Math.PI) / 180, sweepArc: (50 * Math.PI) / 180, period: 4, phase: 1.6 },
];

// Side loot sits just off a pedestal edge so the thief can reach it.
export const LOOT_SPOTS = [
  { kind: 'jade', label: 'Jade Idol', x: 250, y: 265, value: 1200 },
  { kind: 'mask', label: 'Gold Mask', x: 810, y: 265, value: 1500 },
  { kind: 'pearl', label: 'Pearl Necklace', x: 380, y: 525, value: 900 },
  { kind: 'coin', label: 'Ancient Coin', x: 900, y: 525, value: 400 },
];

export const SAPPHIRE = { value: 5000, points: 500 };

export const PALETTE = {
  floor: '#141824',
  tileA: '#1a2030',
  tileB: '#20283c',
  wall: '#2c3550',
  wallTrim: '#3d4a6e',
  pedestal: '#3a4568',
  goldTrim: '#c9a227',
  lootGold: '#f2c94c',
  sapphire: '#4fc3f7',
  guard: '#c0392b',
  guardCone: 'rgba(242,201,76,0.28)',
  guardConeAlert: 'rgba(229,83,75,0.35)',
  cameraCone: 'rgba(229,83,75,0.22)',
  thief: '#2dd4bf',
  text: '#eef1f5',
  muted: '#8b93a3',
  alarmGreen: '#3fb950',
  alarmAmber: '#d29922',
  alarmRed: '#f85149',
  exitGold: '#f2c94c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const BEST_KEY = 'velvet-vault.best';
