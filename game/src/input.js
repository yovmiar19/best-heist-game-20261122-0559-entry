// Keyboard + mouse input. Tracks held keys and queued coin-throw clicks.

export function createInput(canvas) {
  const keys = new Set();
  let mouseX = 0;
  let mouseY = 0;
  let coinTarget = null;
  const pressed = new Set();

  function toLogical(e) {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / 1280, rect.height / 720);
    const ox = (rect.width - 1280 * scale) / 2;
    const oy = (rect.height - 720 * scale) / 2;
    return {
      x: (e.clientX - rect.left - ox) / scale,
      y: (e.clientY - rect.top - oy) / scale,
    };
  }

  function onKeyDown(e) {
    const code = e.code;
    if (
      code === 'ArrowUp' || code === 'ArrowDown' || code === 'ArrowLeft' ||
      code === 'ArrowRight' || code === 'Space'
    ) {
      e.preventDefault();
    }
    if (!keys.has(code)) pressed.add(code);
    keys.add(code);
  }

  function onKeyUp(e) {
    keys.delete(e.code);
  }

  function onMouseMove(e) {
    const p = toLogical(e);
    mouseX = p.x;
    mouseY = p.y;
  }

  function onMouseDown(e) {
    const p = toLogical(e);
    mouseX = p.x;
    mouseY = p.y;
    if (e.button === 0) coinTarget = { x: p.x, y: p.y };
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);

  function moveVector() {
    let x = 0;
    let y = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.hypot(x, y);
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  return {
    get moveX() { return moveVector().x; },
    get moveY() { return moveVector().y; },
    get sneak() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    get interactHeld() { return keys.has('KeyE'); },
    get mouse() { return { x: mouseX, y: mouseY }; },
    consumeCoinTarget() {
      const t = coinTarget;
      coinTarget = null;
      return t;
    },
    consumePressed(code) {
      if (pressed.has(code)) {
        pressed.delete(code);
        return true;
      }
      return false;
    },
    clearPressed() { pressed.clear(); },
  };
}
