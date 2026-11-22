// Velvet Vault — staged ?shot= scenes for screenshots.
// Each scene resets the world and simulates fixed 1/60 steps with a simple
// autopilot, then returns the screen to draw. Deterministic (seed 1).

import { STEP, VAULT_PLINTH, EXIT, GUARD, CAMERA, COVER, WALLS } from './config.js';
import { EVENT_OVER } from './world.js';
import { makeRandom } from './random.js';

// --- Coarse grid pathfinding so the autopilot routes around cover instead
// of pressing against a pedestal's long side (greedy steering alone stalls
// there: every short step either hits the rect or moves away from the loot).
const CELL = 40;
const COLS = Math.ceil(1280 / CELL);
const ROWS = Math.ceil(720 / CELL);

function cellBlocked(cx, cy) {
  const x = cx * CELL + CELL / 2;
  const y = cy * CELL + CELL / 2;
  if (x < WALLS.x + 16 || x > WALLS.x + WALLS.w - 16) return true;
  if (y < WALLS.y + 16 || y > WALLS.y + WALLS.h - 16) return true;
  const rects = COVER.concat([VAULT_PLINTH]);
  for (const r of rects) {
    const qx = Math.max(r.x, Math.min(x, r.x + r.w));
    const qy = Math.max(r.y, Math.min(y, r.y + r.h));
    if (Math.hypot(x - qx, y - qy) < 18) return true;
  }
  return false;
}

// Breadth-first search over the grid; returns the next waypoint (cell centre)
// on a route from (sx,sy) to (tx,ty), or null if no route exists.
function nextWaypoint(sx, sy, tx, ty) {
  const scx = Math.max(0, Math.min(COLS - 1, Math.floor(sx / CELL)));
  const scy = Math.max(0, Math.min(ROWS - 1, Math.floor(sy / CELL)));
  let tcx = Math.max(0, Math.min(COLS - 1, Math.floor(tx / CELL)));
  let tcy = Math.max(0, Math.min(ROWS - 1, Math.floor(ty / CELL)));
  // If the target cell is blocked (loot hugging a pedestal), use the
  // nearest unblocked neighbour as the destination instead.
  if (cellBlocked(tcx, tcy)) {
    let found = null;
    for (let ring = 1; ring <= 3 && !found; ring++) {
      for (let dy = -ring; dy <= ring && !found; dy++) {
        for (let dx = -ring; dx <= ring && !found; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
          const nx = tcx + dx;
          const ny = tcy + dy;
          if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
          if (!cellBlocked(nx, ny)) found = { x: nx, y: ny };
        }
      }
    }
    if (!found) return null;
    tcx = found.x;
    tcy = found.y;
  }
  if (scx === tcx && scy === tcy) return { x: tx, y: ty };
  const key = (x, y) => y * COLS + x;
  const prev = new Map();
  const queue = [[scx, scy]];
  prev.set(key(scx, scy), null);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (queue.length > 0) {
    const [cx, cy] = queue.shift();
    if (cx === tcx && cy === tcy) break;
    for (const [dx, dy] of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      if (prev.has(key(nx, ny))) continue;
      if (cellBlocked(nx, ny)) continue;
      prev.set(key(nx, ny), [cx, cy]);
      queue.push([nx, ny]);
    }
  }
  if (!prev.has(key(tcx, tcy))) return null;
  // Walk back from the target to find the first step out of the start cell.
  let cur = [tcx, tcy];
  let step = cur;
  while (prev.get(key(cur[0], cur[1]))) {
    step = cur;
    cur = prev.get(key(cur[0], cur[1]));
  }
  return { x: step[0] * CELL + CELL / 2, y: step[1] * CELL + CELL / 2 };
}

const DIRS = [
  { x: 0, y: 0 }, { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
  { x: 0.7071, y: 0.7071 }, { x: 0.7071, y: -0.7071 },
  { x: -0.7071, y: 0.7071 }, { x: -0.7071, y: -0.7071 },
];

function pointBlocked(x, y, radius) {
  const rects = COVER.concat([VAULT_PLINTH]);
  for (const r of rects) {
    const cx = Math.max(r.x, Math.min(x, r.x + r.w));
    const cy = Math.max(r.y, Math.min(y, r.y + r.h));
    if (Math.hypot(x - cx, y - cy) < radius) return true;
  }
  return false;
}

function dangerAt(world, x, y, sneak) {
  // 1.0 if a guard or camera would see the thief standing at (x,y) right now,
  // 0.2 if just outside a cone's edge, else 0. Standing behind cover inside
  // a cone is safe (danger 0) — that is what cover is for.
  // Also 1.0 if within touching distance of a guard: never walk into a patrol.
  for (const g of world.guards) {
    if (Math.hypot(x - g.x, y - g.y) < 60) return 1;
  }
  let danger = 0;
  for (const g of world.guards) {
    const dx = x - g.x;
    const dy = y - g.y;
    const dist = Math.hypot(dx, dy);
    const range = sneak ? GUARD.coneRange * 0.5 : GUARD.coneRange;
    if (dist < range) {
      const ang = Math.atan2(dy, dx);
      let diff = ang - g.angle;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      if (Math.abs(diff) < GUARD.coneHalfAngle) {
        if (world.canSee(x, y, g.x, g.y, g.angle, GUARD.coneRange, GUARD.coneHalfAngle, sneak)) {
          return 1;
        }
        // In the cone but behind cover: safe.
      } else if (Math.abs(diff) < GUARD.coneHalfAngle + 0.25) {
        danger = Math.max(danger, 0.2);
      }
    }
  }
  for (const c of world.cameras) {
    const dx = x - c.x;
    const dy = y - c.y;
    const dist = Math.hypot(dx, dy);
    const range = sneak ? CAMERA.range * 0.5 : CAMERA.range;
    if (dist < range) {
      const ang = Math.atan2(dy, dx);
      let diff = ang - c.angle;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      if (Math.abs(diff) < CAMERA.halfAngle) {
        if (world.canSee(x, y, c.x, c.y, c.angle, CAMERA.range, CAMERA.halfAngle, sneak)) return 1;
        // Behind cover: safe.
      }
    }
  }
  return danger;
}

function pickTarget(world) {
  const t = world.thief;
  let best = null;
  let bestD = Infinity;
  for (const item of world.loot) {
    if (item.taken) continue;
    const d = Math.hypot(item.x - t.x, item.y - t.y);
    if (d < bestD) { bestD = d; best = { x: item.x, y: item.y, vault: false }; }
  }
  if (best) return best;
  if (!world.sapphireTaken) {
    return {
      x: VAULT_PLINTH.x + VAULT_PLINTH.w / 2,
      y: VAULT_PLINTH.y + VAULT_PLINTH.h / 2 + 60,
      vault: true,
    };
  }
  return { x: EXIT.x + EXIT.w / 2, y: EXIT.y + EXIT.h / 2, vault: false, exit: true };
}

// lookahead: seconds of travel to evaluate per direction.
// dangerWeight: how much the autopilot fears being seen.
// sneakNear: sneak when an observer is close (careful play only).
// noise: 0..1 chance per step of wandering off in a random direction
// (reckless play only). rng: seeded random source for the noise.
export function autopilotCtrl(world, lookahead, dangerWeight, sneakNear, noise, rng) {
  const t = world.thief;
  const target = pickTarget(world);
  const nearObserver = world.guards.some((g) => Math.hypot(g.x - t.x, g.y - t.y) < 280) ||
    world.cameras.some((c) => Math.hypot(c.x - t.x, c.y - t.y) < 280);
  const sneak = sneakNear && nearObserver;
  const speed = sneak ? 100 : 200;
  const distToVault = Math.hypot(
    t.x - (VAULT_PLINTH.x + VAULT_PLINTH.w / 2),
    t.y - (VAULT_PLINTH.y + VAULT_PLINTH.h / 2),
  );
  const interactHeld = target.vault && distToVault < 72;

  // Flee: if a guard is chasing — or about to alert (suspicion high) —
  // run straight away from the nearest one at full speed.
  let chaser = null;
  let chaserD = Infinity;
  for (const g of world.guards) {
    if (g.state === 'chase' || g.suspicion > 0.6) {
      const d = Math.hypot(g.x - t.x, g.y - t.y);
      if (d < chaserD) { chaserD = d; chaser = g; }
    }
  }
  if (chaser) {
    let bestDir = DIRS[0];
    let bestD = -Infinity;
    for (const d of DIRS) {
      if (d.x === 0 && d.y === 0) continue;
      const cx = t.x + d.x * 60;
      const cy = t.y + d.y * 60;
      if (pointBlocked(cx, cy, 16)) continue;
      const dist = Math.hypot(cx - chaser.x, cy - chaser.y);
      if (dist > bestD) { bestD = dist; bestDir = d; }
    }
    return { moveX: bestDir.x, moveY: bestDir.y, sneak: false, interactHeld: false, coinTarget: null };
  }

  // Reckless wander: sometimes step in a random direction instead.
  if (noise > 0 && rng && rng() < noise) {
    const d = DIRS[1 + Math.floor(rng() * 8)];
    return { moveX: d.x, moveY: d.y, sneak: false, interactHeld, coinTarget: null };
  }

  let bestDir = DIRS[0];
  let bestScore = Infinity;
  // Steer toward the next BFS waypoint, not the raw target, so the thief
  // walks around pedestals and cases instead of pressing against them.
  const waypoint = nextWaypoint(t.x, t.y, target.x, target.y) || target;
  const distToTarget = Math.hypot(waypoint.x - t.x, waypoint.y - t.y);
  // Do not overshoot the waypoint: evaluate a step no longer than the
  // remaining distance (with a small floor so the thief keeps moving).
  const stepLen = Math.max(20, Math.min(speed * lookahead, distToTarget));
  for (const d of DIRS) {
    const cx = t.x + d.x * stepLen;
    const cy = t.y + d.y * stepLen;
    if (pointBlocked(cx, cy, 16)) continue;
    const danger = dangerAt(world, cx, cy, sneak);
    const dist = Math.hypot(waypoint.x - cx, waypoint.y - cy);
    const score = danger * dangerWeight + dist;
    if (score < bestScore) {
      bestScore = score;
      bestDir = d;
    }
  }
  return {
    moveX: bestDir.x,
    moveY: bestDir.y,
    sneak,
    interactHeld,
    coinTarget: null,
  };
}

const IDLE = { moveX: 0, moveY: 0, sneak: false, interactHeld: false, coinTarget: null };

export function stageShot(name, world) {
  world.reset();
  if (name === 'start') {
    // Let the guards patrol for 5 s behind the title screen.
    world.status = 'play';
    for (let i = 0; i < 5 * 60; i++) world.step(STEP, IDLE);
    world.status = 'title';
    return { screen: 'title', best: 0 };
  }
  if (name === 'play') {
    world.status = 'play';
    for (let i = 0; i < 12 * 60; i++) {
      world.step(STEP, autopilotCtrl(world, 0.7, 200, true, 0, null));
      if (world.status !== 'play') break;
    }
    return { screen: world.status === 'play' ? 'play' : world.status, best: world.score };
  }
  if (name === 'end') {
    world.status = 'play';
    const rng = makeRandom(7);
    for (let i = 0; i < 600 * 60; i++) {
      // Reckless run: no danger avoidance, frequent random wander steps,
      // never sneaks — it blunders into cones, eats alerts and busts.
      world.step(STEP, autopilotCtrl(world, 0.2, 0, false, 0.35, rng));
      if (world.events & EVENT_OVER) break;
    }
    return { screen: world.status, best: world.score };
  }
  if (name === 'alarm') {
    // Park the thief inside camera 1's sweep path and wait: the camera
    // sweeps over him, the alarm climbs past 75, red vignette shows.
    world.status = 'play';
    world.thief.x = 146;
    world.thief.y = 223;
    for (let i = 0; i < 90 * 60; i++) {
      world.step(STEP, IDLE);
      if (world.alarm > 75 || world.status !== 'play') break;
    }
    return { screen: world.status === 'play' ? 'play' : world.status, best: world.score };
  }
  world.status = 'play';
  return { screen: 'play', best: 0 };
}
