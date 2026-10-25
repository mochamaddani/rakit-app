// Countdown to a fixed deadline (docs/DECISIONS.md D-051). Fills in the digits every second, aligned
// to whole seconds; at the end shows the message or hides the block. In the editor canvas
// ([data-lp-block]) nothing hides on its own. Stops once its root leaves the page (canvas patches).
// esbuild wraps this in an IIFE. Budget: 1024 bytes minified (countdown.test.ts).
document.querySelectorAll('[data-lp-countdown]').forEach((root) => {
  if (root.hasAttribute('data-lp-ready')) return;
  root.setAttribute('data-lp-ready', '');
  const end = Number(root.getAttribute('data-end'));
  if (!end) return;
  const block = root.closest('.lp-b');
  const canvas = block && block.hasAttribute('data-lp-block');
  const units = root.querySelector('.lp-countdown__units');
  const message = root.querySelector('.lp-countdown__end');
  const cells = root.querySelectorAll('[data-u]');
  // Without a days cell the hours carry the full count (x % Infinity is x).
  const hourMod = root.querySelector('[data-u="d"]') ? 24 : Infinity;
  const pad = (n) => (n < 10 ? '0' : '') + n;

  const tick = () => {
    if (!root.isConnected) return;
    const now = Date.now();
    // Rounded up, so the timer reads 00:00 exactly at the deadline, not up to a second early.
    const left = Math.max(0, Math.ceil((end - now) / 1000));
    const parts = {
      d: Math.floor(left / 86400),
      h: Math.floor(left / 3600) % hourMod,
      m: Math.floor(left / 60) % 60,
      s: left % 60,
    };
    cells.forEach((cell) => {
      cell.textContent = pad(parts[cell.getAttribute('data-u')]);
    });
    if (left > 0) {
      setTimeout(tick, 1000 - (now % 1000));
    } else if (root.getAttribute('data-on-end') === 'hide' && block && !canvas) {
      block.hidden = true;
    } else {
      message.hidden = false;
      if (!canvas) units.hidden = true;
    }
  };
  tick();
});
