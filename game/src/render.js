// Velvet Vault — canvas rendering. Logical playfield 1280x720, letterboxed.
// Everything is drawn with canvas paths; no images, no network.

import {
  FIELD, WALLS, ENTRY, EXIT, THIEF, GUARD, CAMERA, VAULT_PLINTH,
  COVER, LOOT_SPOTS, PALETTE, FONT,
} from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_WON = 'won';
export const SCREEN_LOST_LOCKDOWN = 'lost-lockdown';
export const SCREEN_LOST_BUSTED = 'lost-busted';
export const SCREEN_PAUSED = 'paused';

function alarmColor(alarm) {
  if (alarm < 40) return PALETTE.alarmGreen;
  if (alarm < 70) return PALETTE.alarmAmber;
  return PALETTE.alarmRed;
}

function drawCone(ctx, x, y, angle, range, halfAngle, fill) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, range, angle - halfAngle, angle + halfAngle);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawFloor(ctx) {
  ctx.fillStyle = PALETTE.floor;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  // Marble tile grid inside the walls.
  const tile = 80;
  for (let ty = WALLS.y; ty < WALLS.y + WALLS.h; ty += tile) {
    for (let tx = WALLS.x; tx < WALLS.x + WALLS.w; tx += tile) {
      const even = ((tx - WALLS.x) / tile + (ty - WALLS.y) / tile) % 2 === 0;
      ctx.fillStyle = even ? PALETTE.tileA : PALETTE.tileB;
      ctx.fillRect(tx, ty, tile, tile);
    }
  }
  // Warm pools of light from the skylight.
  ctx.fillStyle = 'rgba(242,201,76,0.05)';
  ctx.beginPath();
  ctx.ellipse(640, 360, 420, 240, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(300, 200, 180, 110, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(980, 540, 180, 110, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawWalls(ctx, world) {
  ctx.strokeStyle = PALETTE.wallTrim;
  ctx.lineWidth = 4;
  ctx.strokeRect(WALLS.x, WALLS.y, WALLS.w, WALLS.h);
  ctx.fillStyle = PALETTE.wall;
  ctx.fillRect(WALLS.x - 6, WALLS.y - 6, WALLS.w + 12, 6);
  ctx.fillRect(WALLS.x - 6, WALLS.y + WALLS.h, WALLS.w + 12, 6);
  ctx.fillRect(WALLS.x - 6, WALLS.y, 6, WALLS.h);
  ctx.fillRect(WALLS.x + WALLS.w, WALLS.y, 6, WALLS.h);

  // Entry door (bottom centre) with a green arrow.
  ctx.fillStyle = '#1d3a2a';
  ctx.fillRect(ENTRY.x - 45, WALLS.y + WALLS.h - 4, 90, 10);
  ctx.fillStyle = '#3fb950';
  ctx.font = 'bold 20px ' + FONT;
  ctx.textAlign = 'center';
  ctx.fillText('ENTRY', ENTRY.x, WALLS.y + WALLS.h - 14);

  // Exit door (top-right): gold when open, red + locked when sealed.
  const open = world.sapphireTaken;
  ctx.fillStyle = open ? '#3a2f10' : '#3a1d1d';
  ctx.fillRect(EXIT.x, EXIT.y, EXIT.w, EXIT.h);
  ctx.strokeStyle = open ? PALETTE.exitGold : PALETTE.alarmRed;
  ctx.lineWidth = 3;
  ctx.strokeRect(EXIT.x, EXIT.y, EXIT.w, EXIT.h);
  ctx.fillStyle = open ? PALETTE.exitGold : PALETTE.alarmRed;
  ctx.font = 'bold 18px ' + FONT;
  ctx.fillText(open ? 'EXIT' : 'LOCKED', EXIT.x + EXIT.w / 2, EXIT.y + EXIT.h / 2 + 6);
}

function drawCover(ctx) {
  for (const r of COVER) {
    ctx.fillStyle = PALETTE.pedestal;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = PALETTE.goldTrim;
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(r.x, r.y, r.w, 8);
  }
}

function drawVault(ctx, world, showLabels) {
  const cx = VAULT_PLINTH.x + VAULT_PLINTH.w / 2;
  const cy = VAULT_PLINTH.y + VAULT_PLINTH.h / 2;
  ctx.fillStyle = '#2a3350';
  ctx.fillRect(VAULT_PLINTH.x, VAULT_PLINTH.y, VAULT_PLINTH.w, VAULT_PLINTH.h);
  ctx.strokeStyle = PALETTE.goldTrim;
  ctx.lineWidth = 3;
  ctx.strokeRect(VAULT_PLINTH.x + 2, VAULT_PLINTH.y + 2, VAULT_PLINTH.w - 4, VAULT_PLINTH.h - 4);
  if (!world.sapphireTaken) {
    const pulse = 0.6 + 0.4 * Math.sin(world.time * 3);
    const glow = ctx.createRadialGradient(cx, cy, 4, cx, cy, 46);
    glow.addColorStop(0, 'rgba(79,195,247,' + (0.55 * pulse + 0.25) + ')');
    glow.addColorStop(1, 'rgba(79,195,247,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - 46, cy - 46, 92, 92);
    // Sapphire diamond.
    ctx.fillStyle = PALETTE.sapphire;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 16);
    ctx.lineTo(cx + 12, cy);
    ctx.lineTo(cx, cy + 16);
    ctx.lineTo(cx - 12, cy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 16);
    ctx.lineTo(cx + 5, cy - 5);
    ctx.lineTo(cx - 5, cy - 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.sapphire;
    ctx.font = 'bold 13px ' + FONT;
    ctx.textAlign = 'center';
    if (showLabels) ctx.fillText('STAR SAPPHIRE', cx, VAULT_PLINTH.y + VAULT_PLINTH.h + 18);
  } else {
    ctx.fillStyle = PALETTE.muted;
    ctx.font = 'bold 12px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('EMPTY PLINTH', cx, cy + 4);
  }
}

function drawLoot(ctx, world, showLabels) {
  for (const item of world.loot) {
    if (item.taken) continue;
    ctx.fillStyle = PALETTE.lootGold;
    ctx.beginPath();
    ctx.arc(item.x, item.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a6d1d';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#fff8d6';
    ctx.beginPath();
    ctx.arc(item.x - 3, item.y - 3, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.lootGold;
    ctx.font = '11px ' + FONT;
    ctx.textAlign = 'center';
    if (showLabels) ctx.fillText(item.label, item.x, item.y + 24);
  }
}

function drawCameras(ctx, world) {
  for (const c of world.cameras) {
    drawCone(ctx, c.x, c.y, c.angle, CAMERA.range, CAMERA.halfAngle,
      c.seeing ? 'rgba(229,83,75,0.45)' : PALETTE.cameraCone);
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(c.x, c.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.seeing ? '#ff4444' : '#e5534b';
    ctx.beginPath();
    ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
    ctx.fill();
    // Lens direction tick.
    ctx.strokeStyle = '#e5534b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(c.x + Math.cos(c.angle) * 16, c.y + Math.sin(c.angle) * 16);
    ctx.stroke();
  }
}

function drawGuards(ctx, world) {
  for (const g of world.guards) {
    const alerted = g.state === 'chase';
    drawCone(ctx, g.x, g.y, g.angle, GUARD.coneRange, GUARD.coneHalfAngle,
      alerted ? PALETTE.guardConeAlert : PALETTE.guardCone);
    ctx.fillStyle = PALETTE.guard;
    ctx.beginPath();
    ctx.arc(g.x, g.y, GUARD.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7a1f16';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Facing tick.
    ctx.strokeStyle = '#ffd9d4';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.lineTo(g.x + Math.cos(g.angle) * (GUARD.radius + 6), g.y + Math.sin(g.angle) * (GUARD.radius + 6));
    ctx.stroke();
    // Suspicion "!" or chase marker.
    if (alerted) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('!', g.x, g.y - GUARD.radius - 6);
    } else if (g.suspicion > 0.05) {
      ctx.fillStyle = '#f2c94c';
      ctx.font = 'bold 18px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('?', g.x, g.y - GUARD.radius - 6);
      // Suspicion arc above the guard.
      ctx.strokeStyle = '#f2c94c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(g.x, g.y, GUARD.radius + 8, -Math.PI / 2, -Math.PI / 2 + g.suspicion * Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawThief(ctx, world) {
  const t = world.thief;
  if (t.invuln > 0 && Math.floor(world.time * 10) % 2 === 0) return; // blink while invulnerable
  const r = t.sneak ? 10 : THIEF.radius;
  ctx.fillStyle = PALETTE.thief;
  ctx.beginPath();
  ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0b3b35';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Dark mask across the eyes.
  ctx.fillStyle = '#0f2a26';
  ctx.fillRect(t.x - r, t.y - 4, r * 2, 7);
  // Facing tick.
  ctx.strokeStyle = '#e6fffa';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(t.x, t.y);
  ctx.lineTo(t.x + Math.cos(t.angle) * (r + 5), t.y + Math.sin(t.angle) * (r + 5));
  ctx.stroke();
  if (world.coinMarker && world.coinMarkerTimer > 0) {
    ctx.strokeStyle = PALETTE.lootGold;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(world.coinMarker.x, world.coinMarker.y, 6 + (2.5 - world.coinMarkerTimer) * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = PALETTE.lootGold;
    ctx.beginPath();
    ctx.arc(world.coinMarker.x, world.coinMarker.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHud(ctx, world) {
  ctx.fillStyle = 'rgba(10,12,20,0.92)';
  ctx.fillRect(0, 0, FIELD.width, 64);
  ctx.fillStyle = PALETTE.text;
  ctx.textAlign = 'left';
  ctx.font = 'bold 20px ' + FONT;
  ctx.fillText('VELVET VAULT', 16, 28);
  ctx.font = '13px ' + FONT;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText(world.message, 16, 50);

  // Alarm meter.
  const ax = 330;
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 13px ' + FONT;
  ctx.fillText('ALARM', ax, 20);
  ctx.fillStyle = '#222a3d';
  ctx.fillRect(ax, 28, 220, 16);
  ctx.fillStyle = alarmColor(world.alarm);
  ctx.fillRect(ax, 28, Math.max(0, 220 * world.alarm / 100), 16);
  ctx.strokeStyle = '#4a5578';
  ctx.lineWidth = 1;
  ctx.strokeRect(ax, 28, 220, 16);
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 13px ' + FONT;
  ctx.fillText(Math.round(world.alarm) + '%', ax + 228, 41);

  // Loot, timer, coins, lives.
  const hx = 640;
  ctx.fillStyle = PALETTE.lootGold;
  ctx.font = 'bold 17px ' + FONT;
  ctx.fillText('$' + world.lootValue.toLocaleString('en-US'), hx, 28);
  ctx.fillStyle = PALETTE.text;
  ctx.font = '13px ' + FONT;
  ctx.fillText(world.artifacts + '/5 artifacts', hx, 50);

  const mins = Math.floor(world.time / 60);
  const secs = Math.floor(world.time % 60);
  ctx.fillStyle = PALETTE.text;
  ctx.font = 'bold 17px ' + FONT;
  ctx.fillText((mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs, 830, 28);
  if (world.sapphireTaken) {
    ctx.fillStyle = world.escapeTimer < 15 ? PALETTE.alarmRed : PALETTE.exitGold;
    ctx.font = 'bold 14px ' + FONT;
    ctx.fillText('ESCAPE ' + Math.max(0, Math.ceil(world.escapeTimer)) + 's', 830, 50);
  } else {
    ctx.fillStyle = PALETTE.muted;
    ctx.font = '13px ' + FONT;
    ctx.fillText('grab the Sapphire', 830, 50);
  }

  ctx.fillStyle = PALETTE.lootGold;
  ctx.font = 'bold 17px ' + FONT;
  ctx.fillText('coins x' + world.coins, 1010, 28);
  ctx.fillStyle = PALETTE.alarmRed;
  ctx.font = 'bold 17px ' + FONT;
  let hearts = '';
  for (let i = 0; i < world.lives; i++) hearts += '♥';
  ctx.fillText(hearts, 1010, 50);
  ctx.textAlign = 'left';
}

function drawVaultRing(ctx, world) {
  if (world.vaultProgress <= 0 || world.sapphireTaken) return;
  const cx = VAULT_PLINTH.x + VAULT_PLINTH.w / 2;
  const cy = VAULT_PLINTH.y + VAULT_PLINTH.h / 2;
  ctx.strokeStyle = 'rgba(79,195,247,0.35)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, 52, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = PALETTE.sapphire;
  ctx.beginPath();
  ctx.arc(cx, cy, 52, -Math.PI / 2, -Math.PI / 2 + world.vaultProgress * Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = PALETTE.sapphire;
  ctx.font = 'bold 13px ' + FONT;
  ctx.textAlign = 'center';
  ctx.fillText('CRACKING…', cx, cy - 62);
}

function drawVignette(ctx, world) {
  if (world.alarm <= 70) return;
  const strength = (world.alarm - 70) / 30;
  const pulse = 0.5 + 0.5 * Math.sin(world.time * 5);
  const g = ctx.createRadialGradient(640, 360, 260, 640, 360, 720);
  g.addColorStop(0, 'rgba(248,81,73,0)');
  g.addColorStop(1, 'rgba(248,81,73,' + (0.35 * strength * pulse + 0.1 * strength) + ')');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
}

function overlay(ctx, lines, accent) {
  ctx.fillStyle = 'rgba(8,10,18,0.72)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.textAlign = 'center';
  let y = 210;
  for (const line of lines) {
    ctx.fillStyle = line.color || PALETTE.text;
    ctx.font = line.font || '20px ' + FONT;
    ctx.fillText(line.text, FIELD.width / 2, y);
    y += line.gap || 44;
  }
  if (accent) {
    ctx.fillStyle = accent;
    ctx.font = '14px ' + FONT;
    ctx.fillText('Press ENTER to play again · R to restart', FIELD.width / 2, y + 10);
  }
  ctx.textAlign = 'left';
}

export function draw(ctx, world, screen, best) {
  // Letterbox the logical 1280x720 field into the canvas.
  const cw = ctx.canvas.width;
  const ch = ctx.canvas.height;
  const scale = Math.min(cw / FIELD.width, ch / FIELD.height);
  const ox = (cw - FIELD.width * scale) / 2;
  const oy = (ch - FIELD.height * scale) / 2;
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, ox, oy);

  drawFloor(ctx);
  drawWalls(ctx, world);
  drawCover(ctx);
  const showLabels = screen !== SCREEN_TITLE;
  drawVault(ctx, world, showLabels);
  drawLoot(ctx, world, showLabels);
  // Clip the moving actors to the room so vision cones never spill past
  // the walls into the letterbox margins. Walls/doors stay unclipped.
  ctx.save();
  ctx.beginPath();
  ctx.rect(WALLS.x, WALLS.y, WALLS.w, WALLS.h);
  ctx.clip();
  drawCameras(ctx, world);
  drawGuards(ctx, world);
  drawThief(ctx, world);
  drawVaultRing(ctx, world);
  ctx.restore();
  drawHud(ctx, world);
  drawVignette(ctx, world);

  if (screen === SCREEN_TITLE) {
    overlay(ctx, [
      { text: 'VELVET VAULT', font: 'bold 64px ' + FONT, color: PALETTE.lootGold, gap: 80 },
      { text: 'A one-room stealth heist — steal the Star Sapphire and slip out.', font: '20px ' + FONT, gap: 40 },
      { text: 'WASD / arrows move · Shift sneak · E crack the vault · Click toss a coin', font: '17px ' + FONT, color: PALETTE.muted, gap: 34 },
      { text: 'Guards and cameras raise the alarm. At 100% the vault locks down.', font: '17px ' + FONT, color: PALETTE.muted, gap: 34 },
      { text: 'Best score: ' + (best || 0), font: 'bold 18px ' + FONT, color: PALETTE.sapphire, gap: 56 },
      { text: 'Press ENTER to start', font: 'bold 24px ' + FONT, color: PALETTE.text },
    ]);
  } else if (screen === SCREEN_PAUSED) {
    overlay(ctx, [
      { text: 'PAUSED', font: 'bold 48px ' + FONT, color: PALETTE.text, gap: 70 },
      { text: 'Press P or Esc to resume', font: '20px ' + FONT, color: PALETTE.muted },
    ]);
  } else if (screen === SCREEN_WON) {
    overlay(ctx, [
      { text: 'HEIST COMPLETE', font: 'bold 56px ' + FONT, color: PALETTE.lootGold, gap: 72 },
      { text: 'The Star Sapphire is yours. Score: ' + world.score, font: '22px ' + FONT, gap: 40 },
      { text: 'Loot $' + world.lootValue.toLocaleString('en-US') + ' · ' + world.artifacts + '/5 artifacts · ' + world.lives + ' lives left', font: '18px ' + FONT, color: PALETTE.muted, gap: 40 },
      { text: 'Best score: ' + (best || 0), font: 'bold 18px ' + FONT, color: PALETTE.sapphire },
    ], true);
  } else if (screen === SCREEN_LOST_LOCKDOWN) {
    overlay(ctx, [
      { text: 'LOCKDOWN', font: 'bold 56px ' + FONT, color: PALETTE.alarmRed, gap: 72 },
      { text: 'The alarm hit 100% — the vault sealed shut.', font: '22px ' + FONT, gap: 40 },
      { text: 'Score: ' + world.score + ' · Loot $' + world.lootValue.toLocaleString('en-US'), font: '18px ' + FONT, color: PALETTE.muted },
    ], true);
  } else if (screen === SCREEN_LOST_BUSTED) {
    overlay(ctx, [
      { text: 'BUSTED', font: 'bold 56px ' + FONT, color: PALETTE.alarmRed, gap: 72 },
      { text: 'Caught red-handed — three strikes and the crew is in cuffs.', font: '22px ' + FONT, gap: 40 },
      { text: 'Score: ' + world.score + ' · Loot $' + world.lootValue.toLocaleString('en-US'), font: '18px ' + FONT, color: PALETTE.muted },
    ], true);
  }

  ctx.restore();
}
