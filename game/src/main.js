// Velvet Vault — boot, fixed-step loop, ?shot= still frames, sounds, best score.

import { STEP, BEST_KEY } from './config.js';
import { createWorld, STATUS_TITLE, STATUS_PLAY, STATUS_WON, STATUS_LOST_LOCKDOWN, STATUS_LOST_BUSTED, STATUS_PAUSED, EVENT_OVER, EVENT_ALERT, EVENT_PICKUP, EVENT_SAPPHIRE, EVENT_BUST, EVENT_COIN } from './world.js';
import { draw } from './render.js';
import { createInput } from './input.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const seed = parseInt(params.get('seed') || '1', 10) || 1;
const shotName = params.get('shot');

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

const world = createWorld(seed);
const input = createInput(canvas);

let screen = STATUS_TITLE;
let best = 0;
try {
  best = parseInt(window.localStorage.getItem(BEST_KEY) || '0', 10) || 0;
} catch (e) {
  best = 0;
}
let muted = false;
let audioCtx = null;

function beep(freq, dur, type, gain) {
  if (muted) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    g.gain.value = gain || 0.08;
    osc.connect(g);
    g.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + dur);
  } catch (e) {
    // Headless / no-audio environments must not throw.
  }
}

function playEventSounds() {
  if (world.events & EVENT_PICKUP) beep(880, 0.12, 'sine', 0.1);
  if (world.events & EVENT_ALERT) {
    beep(220, 0.25, 'square', 0.08);
    setTimeout(() => beep(180, 0.25, 'square', 0.08), 120);
  }
  if (world.events & EVENT_SAPPHIRE) {
    beep(660, 0.15, 'sine', 0.1);
    setTimeout(() => beep(990, 0.3, 'sine', 0.1), 140);
  }
  if (world.events & EVENT_BUST) beep(140, 0.4, 'sawtooth', 0.1);
  if (world.events & EVENT_COIN) beep(1320, 0.08, 'triangle', 0.07);
  if (world.events & EVENT_OVER) {
    if (world.status === STATUS_WON) {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.2, 'sine', 0.1), i * 130));
    } else {
      [330, 262, 196].forEach((f, i) => setTimeout(() => beep(f, 0.3, 'triangle', 0.1), i * 160));
    }
  }
}

function updateStatusLine() {
  if (!statusEl) return;
  if (screen === STATUS_PLAY) {
    statusEl.textContent =
      'Alarm ' + Math.round(world.alarm) + '% · Loot $' + world.lootValue +
      ' · ' + world.artifacts + '/5 artifacts · ' + world.lives + ' lives · ' + world.message;
  } else if (screen === STATUS_WON) {
    statusEl.textContent = 'Heist complete! Score ' + world.score + '.';
  } else if (screen === STATUS_LOST_LOCKDOWN || screen === STATUS_LOST_BUSTED) {
    statusEl.textContent = world.message + ' Score ' + world.score + '.';
  } else {
    statusEl.textContent = 'Velvet Vault — a one-room stealth heist. Press Enter to start.';
  }
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
}
window.addEventListener('resize', resize);
resize();

function render() {
  draw(ctx, world, screen, best);
  updateStatusLine();
}

function restart() {
  world.reset();
  world.status = STATUS_PLAY;
  screen = STATUS_PLAY;
  input.clearPressed();
}

// --- Deterministic still frame for screenshots ---
if (shotName) {
  const staged = stageShot(shotName, world);
  screen = staged.screen;
  best = staged.best || 0;
  render();
} else {
  // --- Live game loop ---
  let last = performance.now();
  let acc = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;

    if (input.consumePressed('KeyM')) muted = !muted;

    if (screen === STATUS_TITLE) {
      if (input.consumePressed('Enter') || input.consumePressed('NumpadEnter')) {
        world.reset();
        world.status = STATUS_PLAY;
        screen = STATUS_PLAY;
      }
    } else if (screen === STATUS_PLAY) {
      if (input.consumePressed('KeyP') || input.consumePressed('Escape')) {
        world.prevStatus = STATUS_PLAY;
        world.status = STATUS_PAUSED;
        screen = STATUS_PAUSED;
      }
    } else if (screen === STATUS_PAUSED) {
      if (input.consumePressed('KeyP') || input.consumePressed('Escape')) {
        world.status = STATUS_PLAY;
        screen = STATUS_PLAY;
      }
    } else {
      // Won / lost screens.
      if (input.consumePressed('Enter') || input.consumePressed('NumpadEnter') || input.consumePressed('KeyR')) {
        restart();
      }
    }

    if (screen === STATUS_PLAY) {
      acc += dt;
      let steps = 0;
      while (acc >= STEP && steps < 5) {
        const ctrl = {
          moveX: input.moveX,
          moveY: input.moveY,
          sneak: input.sneak,
          interactHeld: input.interactHeld,
          coinTarget: input.consumeCoinTarget(),
        };
        world.step(STEP, ctrl);
        playEventSounds();
        acc -= STEP;
        steps += 1;
        if (world.status === STATUS_WON || world.status === STATUS_LOST_LOCKDOWN || world.status === STATUS_LOST_BUSTED) {
          screen = world.status;
          if (world.status === STATUS_WON && world.score > best) {
            best = world.score;
            try {
              window.localStorage.setItem(BEST_KEY, String(best));
            } catch (e) {
              // Storage unavailable — best score just won't persist.
            }
          }
          break;
        }
      }
      if (steps >= 5) acc = 0;
    }

    render();
  }
  requestAnimationFrame(frame);
}
