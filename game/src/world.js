// Velvet Vault — world state, detection, alarm, win/lose rules.
// Deterministic: no Math.random, no Date.now in any of this logic.

import {
  FIELD, WALLS, ENTRY, EXIT, THIEF, GUARD, CAMERA, ALARM, LIVES,
  COINS_START, COINS_MAX, ESCAPE_SECONDS, VAULT, COVER, VAULT_PLINTH,
  GUARD_PATROLS, CAMERAS, LOOT_SPOTS, SAPPHIRE,
} from './config.js';

export const EVENT_OVER = 1;
export const EVENT_ALERT = 2;
export const EVENT_PICKUP = 4;
export const EVENT_SAPPHIRE = 8;
export const EVENT_BUST = 16;
export const EVENT_COIN = 32;
export const EVENT_CRACK = 64;

export const STATUS_TITLE = 'title';
export const STATUS_PLAY = 'play';
export const STATUS_WON = 'won';
export const STATUS_LOST_LOCKDOWN = 'lost-lockdown';
export const STATUS_LOST_BUSTED = 'lost-busted';
export const STATUS_PAUSED = 'paused';

export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

// Slab test: does segment (x1,y1)-(x2,y2) cross rect r?
export function segmentHitsRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tmin = 0;
  let tmax = 1;
  if (dx === 0) {
    if (x1 < r.x || x1 > r.x + r.w) return false;
  } else {
    let t1 = (r.x - x1) / dx;
    let t2 = (r.x + r.w - x1) / dx;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  if (dy === 0) {
    if (y1 < r.y || y1 > r.y + r.h) return false;
  } else {
    let t1 = (r.y - y1) / dy;
    let t2 = (r.y + r.h - y1) / dy;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

function allBlockers() {
  return COVER.concat([VAULT_PLINTH]);
}

function segmentBlocked(x1, y1, x2, y2) {
  const rects = allBlockers();
  for (let i = 0; i < rects.length; i++) {
    if (segmentHitsRect(x1, y1, x2, y2, rects[i])) return true;
  }
  return false;
}

// Push a circle (px,py,r) out of rect r; returns corrected position.
function pushOutOfRect(px, py, r, radius) {
  const cx = Math.max(r.x, Math.min(px, r.x + r.w));
  const cy = Math.max(r.y, Math.min(py, r.y + r.h));
  let dx = px - cx;
  let dy = py - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= radius * radius) return { x: px, y: py };
  if (d2 === 0) {
    // Centre inside the rect: push out along the smallest penetration axis.
    const left = px - r.x;
    const right = r.x + r.w - px;
    const top = py - r.y;
    const bottom = r.y + r.h - py;
    const m = Math.min(left, right, top, bottom);
    if (m === left) return { x: r.x - radius, y: py };
    if (m === right) return { x: r.x + r.w + radius, y: py };
    if (m === top) return { x: px, y: r.y - radius };
    return { x: px, y: r.y + r.h + radius };
  }
  const d = Math.sqrt(d2);
  dx /= d;
  dy /= d;
  return { x: cx + dx * radius, y: cy + dy * radius };
}

export function createWorld(seed) {
  const world = {
    seed: seed || 1,
    time: 0,
    status: STATUS_TITLE,
    prevStatus: STATUS_TITLE,
    thief: { x: ENTRY.x, y: ENTRY.y, angle: -Math.PI / 2, sneak: false, invuln: 0 },
    guards: [],
    cameras: [],
    loot: [],
    sapphireTaken: false,
    vaultProgress: 0,
    alarm: 0,
    lives: LIVES,
    coins: COINS_START,
    score: 0,
    lootValue: 0,
    artifacts: 0,
    escapeTimer: 0,
    events: 0,
    message: 'Sneak in, grab the Star Sapphire, escape out the top-right door.',
    coinMarker: null,
    coinMarkerTimer: 0,
  };

  world.reset = function () {
    world.time = 0;
    world.status = STATUS_TITLE;
    world.prevStatus = STATUS_TITLE;
    world.thief = { x: ENTRY.x, y: ENTRY.y, angle: -Math.PI / 2, sneak: false, invuln: 0 };
    world.guards = GUARD_PATROLS.map((p) => ({
      x: p.waypoints[0].x,
      y: p.waypoints[0].y,
      waypoints: p.waypoints,
      wpIndex: 1,
      speed: p.speed,
      state: 'patrol',
      suspicion: 0,
      alertTimer: 0,
      targetX: 0,
      targetY: 0,
      angle: 0,
      seeing: false,
    }));
    world.cameras = CAMERAS.map((c) => ({
      x: c.x, y: c.y, angle: c.baseAngle, baseAngle: c.baseAngle,
      sweepArc: c.sweepArc, period: c.period, phase: c.phase, seeing: false,
    }));
    world.loot = LOOT_SPOTS.map((s) => ({
      kind: s.kind, label: s.label, x: s.x, y: s.y, value: s.value, taken: false,
    }));
    world.sapphireTaken = false;
    world.vaultProgress = 0;
    world.alarm = 0;
    world.lives = LIVES;
    world.coins = COINS_START;
    world.score = 0;
    world.lootValue = 0;
    world.artifacts = 0;
    world.escapeTimer = 0;
    world.events = 0;
    world.message = 'Sneak in, grab the Star Sapphire, escape out the top-right door.';
    world.coinMarker = null;
    world.coinMarkerTimer = 0;
  };

  world.reset();

  // Can observer at (fx,fy) facing `facing` see point (px,py)?
  world.canSee = function (px, py, fx, fy, facing, range, halfAngle, sneak) {
    const dx = px - fx;
    const dy = py - fy;
    const dist = Math.hypot(dx, dy);
    const effRange = sneak ? range * 0.5 : range;
    if (dist > effRange) return false;
    if (dist < 1) return true;
    const ang = Math.atan2(dy, dx);
    if (Math.abs(angleDiff(ang, facing)) > halfAngle) return false;
    return !segmentBlocked(fx, fy, px, py);
  };

  world.anyoneSeesThief = function (px, py, sneak) {
    const t = world.thief;
    const x = px === undefined ? t.x : px;
    const y = py === undefined ? t.y : py;
    for (const g of world.guards) {
      if (world.canSee(x, y, g.x, g.y, g.angle, GUARD.coneRange, GUARD.coneHalfAngle, sneak)) return true;
    }
    for (const c of world.cameras) {
      if (world.canSee(x, y, c.x, c.y, c.angle, CAMERA.range, CAMERA.halfAngle, sneak)) return true;
    }
    return false;
  };

  function moveThief(dt, ctrl) {
    const t = world.thief;
    const speed = ctrl.sneak ? THIEF.sneakSpeed : THIEF.walkSpeed;
    t.sneak = ctrl.sneak;
    let nx = t.x + ctrl.moveX * speed * dt;
    let ny = t.y + ctrl.moveY * speed * dt;
    if (ctrl.moveX !== 0 || ctrl.moveY !== 0) {
      t.angle = Math.atan2(ctrl.moveY, ctrl.moveX);
    }
    // Clamp inside the room walls.
    nx = Math.max(WALLS.x + THIEF.radius, Math.min(WALLS.x + WALLS.w - THIEF.radius, nx));
    ny = Math.max(WALLS.y + THIEF.radius, Math.min(WALLS.y + WALLS.h - THIEF.radius, ny));
    // Push out of every cover rect + the vault plinth.
    const rects = allBlockers();
    for (let i = 0; i < rects.length; i++) {
      const p = pushOutOfRect(nx, ny, rects[i], THIEF.radius);
      nx = p.x;
      ny = p.y;
    }
    t.x = nx;
    t.y = ny;
    if (t.invuln > 0) t.invuln -= dt;
  }

  function updateCameras(dt) {
    for (const c of world.cameras) {
      c.angle = c.baseAngle + c.sweepArc * Math.sin((2 * Math.PI * world.time) / c.period + c.phase);
    }
  }

  function updateGuards(dt) {
    const t = world.thief;
    for (const g of world.guards) {
      if (g.state === 'chase') {
        g.alertTimer -= dt;
        const dx = t.x - g.x;
        const dy = t.y - g.y;
        const d = Math.hypot(dx, dy);
        if (d > 1) {
          g.x += (dx / d) * GUARD.chaseSpeed * dt;
          g.y += (dy / d) * GUARD.chaseSpeed * dt;
          g.angle = Math.atan2(dy, dx);
        }
        if (g.alertTimer <= 0) {
          g.state = 'patrol';
          g.suspicion = 0;
        }
      } else if (g.state === 'investigate') {
        g.alertTimer -= dt;
        const dx = g.targetX - g.x;
        const dy = g.targetY - g.y;
        const d = Math.hypot(dx, dy);
        if (d > 6) {
          g.x += (dx / d) * GUARD.patrolSpeed * dt;
          g.y += (dy / d) * GUARD.patrolSpeed * dt;
          g.angle = Math.atan2(dy, dx);
        }
        if (d <= 6 || g.alertTimer <= 0) {
          g.state = 'patrol';
          g.suspicion = 0;
        }
      } else {
        const wp = g.waypoints[g.wpIndex];
        const dx = wp.x - g.x;
        const dy = wp.y - g.y;
        const d = Math.hypot(dx, dy);
        if (d <= 6) {
          g.wpIndex = (g.wpIndex + 1) % g.waypoints.length;
        } else {
          g.x += (dx / d) * g.speed * dt;
          g.y += (dy / d) * g.speed * dt;
          g.angle = Math.atan2(dy, dx);
        }
      }
      // Vision: suspicion builds while the thief is in the cone.
      const seen = world.canSee(t.x, t.y, g.x, g.y, g.angle, GUARD.coneRange, GUARD.coneHalfAngle, t.sneak);
      g.seeing = seen;
      if (seen && world.status === STATUS_PLAY) {
        g.suspicion += (dt / GUARD.suspicionTime) * (t.sneak ? 0.5 : 1);
        if (g.suspicion >= 1) {
          g.suspicion = 0;
          g.state = 'chase';
          g.alertTimer = GUARD.alertChaseTime;
          world.alarm = Math.min(ALARM.max, world.alarm + ALARM.guardAlert);
          world.events |= EVENT_ALERT;
          world.message = 'Spotted! A guard is chasing you!';
        }
      } else {
        g.suspicion = Math.max(0, g.suspicion - dt);
      }
    }
  }

  function updateCamerasAlarm(dt) {
    const t = world.thief;
    for (const c of world.cameras) {
      const seen = world.canSee(t.x, t.y, c.x, c.y, c.angle, CAMERA.range, CAMERA.halfAngle, t.sneak);
      c.seeing = seen;
      if (seen && world.status === STATUS_PLAY) {
        world.alarm = Math.min(ALARM.max, world.alarm + CAMERA.alarmPerSecond * dt * (t.sneak ? 0.5 : 1));
      }
    }
  }

  function bustThief() {
    world.lives -= 1;
    world.alarm = Math.min(ALARM.max, world.alarm + ALARM.bust);
    world.events |= EVENT_BUST;
    world.thief.x = ENTRY.x;
    world.thief.y = ENTRY.y;
    world.thief.invuln = THIEF.invulnerable;
    world.vaultProgress = 0;
    for (const g of world.guards) {
      g.state = 'patrol';
      g.suspicion = 0;
    }
    if (world.lives <= 0) {
      world.status = STATUS_LOST_BUSTED;
      world.events |= EVENT_OVER;
      world.message = 'Caught red-handed — the crew is in cuffs.';
    } else {
      world.message = 'Busted! Back to the entry door. ' + world.lives + ' lives left.';
    }
  }

  world.step = function (dt, ctrl) {
    world.events = 0;
    if (world.status !== STATUS_PLAY) return;
    world.time += dt;
    const t = world.thief;

    // Coin throw: nearest guard investigates the clink.
    if (ctrl.coinTarget && world.coins > 0) {
      world.coins -= 1;
      world.coinMarker = { x: ctrl.coinTarget.x, y: ctrl.coinTarget.y };
      world.coinMarkerTimer = 2.5;
      world.events |= EVENT_COIN;
      let best = null;
      let bestD = Infinity;
      for (const g of world.guards) {
        const d = Math.hypot(g.x - ctrl.coinTarget.x, g.y - ctrl.coinTarget.y);
        if (d < bestD) { bestD = d; best = g; }
      }
      if (best) {
        best.state = 'investigate';
        best.targetX = ctrl.coinTarget.x;
        best.targetY = ctrl.coinTarget.y;
        best.alertTimer = GUARD.investigateTime;
        best.suspicion = 0;
      }
      world.message = 'Coin tossed — a guard goes to check the noise.';
    }
    if (world.coinMarkerTimer > 0) world.coinMarkerTimer -= dt;

    moveThief(dt, ctrl);
    updateCameras(dt);
    updateGuards(dt);
    updateCamerasAlarm(dt);

    // Side-loot pickup.
    for (const item of world.loot) {
      if (!item.taken && Math.hypot(t.x - item.x, t.y - item.y) < 30) {
        item.taken = true;
        world.score += item.value;
        world.lootValue += item.value;
        world.artifacts += 1;
        world.coins = Math.min(COINS_MAX, world.coins + 1);
        world.events |= EVENT_PICKUP;
        world.message = item.label + ' pocketed! +$' + item.value + ' (and a spare coin).';
      }
    }

    // Vault cracking at the central plinth.
    const plinthCx = VAULT_PLINTH.x + VAULT_PLINTH.w / 2;
    const plinthCy = VAULT_PLINTH.y + VAULT_PLINTH.h / 2;
    const nearVault = Math.hypot(t.x - plinthCx, t.y - plinthCy) < 72;
    const cracking = nearVault && ctrl.interactHeld && !world.sapphireTaken;
    if (cracking) {
      world.vaultProgress += dt / VAULT.crackSeconds;
      world.events |= EVENT_CRACK;
      if (world.anyoneSeesThief()) {
        world.alarm = Math.min(ALARM.max, world.alarm + ALARM.tamperPerSecond * dt);
      }
      if (world.vaultProgress >= 1) {
        world.sapphireTaken = true;
        world.score += SAPPHIRE.value;
        world.lootValue += SAPPHIRE.value;
        world.artifacts += 1;
        world.escapeTimer = ESCAPE_SECONDS;
        world.events |= EVENT_SAPPHIRE;
        world.message = 'Star Sapphire secured! Get to the EXIT door, top-right!';
      }
    } else {
      world.vaultProgress = Math.max(0, world.vaultProgress - dt * 0.5);
    }

    // Alarm decay while unseen and not cracking.
    if (!world.anyoneSeesThief() && !cracking) {
      world.alarm = Math.max(0, world.alarm - ALARM.decayPerSecond * dt);
    }

    // Escape phase.
    if (world.sapphireTaken) {
      world.escapeTimer -= dt;
      if (world.escapeTimer <= 0) {
        world.alarm = Math.min(ALARM.max, world.alarm + 5 * dt);
      }
      if (
        t.x > EXIT.x && t.x < EXIT.x + EXIT.w &&
        t.y > EXIT.y && t.y < EXIT.y + EXIT.h
      ) {
        const timeBonus = Math.max(0, Math.round(world.escapeTimer)) * 10;
        const alarmBonus = Math.max(0, Math.round(ALARM.max - world.alarm)) * 5;
        world.score += timeBonus + alarmBonus;
        world.status = STATUS_WON;
        world.events |= EVENT_OVER;
        world.message = 'HEIST COMPLETE — out clean with the Sapphire!';
      }
    }

    // Guard touch = busted (unless invulnerable).
    if (t.invuln <= 0) {
      for (const g of world.guards) {
        if (Math.hypot(t.x - g.x, t.y - g.y) < THIEF.radius + GUARD.radius) {
          bustThief();
          break;
        }
      }
    }

    if (world.alarm >= ALARM.max && world.status === STATUS_PLAY) {
      world.status = STATUS_LOST_LOCKDOWN;
      world.events |= EVENT_OVER;
      world.message = 'LOCKDOWN — the vault sealed shut. The crew is caught.';
    }
  };

  return world;
}
